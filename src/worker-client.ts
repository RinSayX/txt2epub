import type { WorkerRequest, WorkerResponse } from './core/types';

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
export type Request = WithoutId<Exclude<WorkerRequest, { type: 'cancel' }>>;

export class DocumentClient {
  private worker = new Worker(new URL('./workers/document.worker.ts', import.meta.url), { type: 'module' });
  private sequence = 0;
  private failed = false;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; progress?: (value: number, label: string) => void; type: string }>();
  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      const request = this.pending.get(data.id);
      if (!request) return;
      if (data.type === 'progress') request.progress?.(data.value, data.label);
      else {
        this.pending.delete(data.id);
        if (data.type === 'result') request.resolve(data.payload);
        else request.reject(new Error(data.message));
      }
    };
    this.worker.onerror = () => {
      this.failed = true;
      for (const request of this.pending.values()) request.reject(new Error('后台处理发生错误，请刷新页面重新导入。'));
      this.pending.clear();
    };
  }
  call<T>(request: Request, progress?: (value: number, label: string) => void): Promise<T> {
    if (this.failed) return Promise.reject(new Error('后台处理已停止，请刷新页面重新导入。'));
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, progress, type: request.type });
      this.worker.postMessage({ ...request, id });
    });
  }
  cancel() {
    this.worker.postMessage({ id: ++this.sequence, type: 'cancel' });
    for (const [id, request] of this.pending) {
      if (request.type !== 'preview') { request.reject(new Error('操作已取消')); this.pending.delete(id); }
    }
  }
  dispose() {
    this.worker.terminate();
    for (const request of this.pending.values()) request.reject(new Error('工作台已关闭'));
    this.pending.clear();
  }
}
