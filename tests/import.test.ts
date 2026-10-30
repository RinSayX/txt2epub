import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES, type DocumentSnapshot, type Preview, type WorkerRequest, type WorkerResponse } from '../src/core/types';

interface TestWorker {
  onmessage: ((event: MessageEvent<WorkerRequest>) => Promise<void>) | null;
  postMessage: (response: WorkerResponse) => void;
}

describe('document Worker import', () => {
  let worker: TestWorker;
  let messages: WorkerResponse[];

  beforeEach(async () => {
    vi.resetModules();
    messages = [];
    worker = { onmessage: null, postMessage: (response) => messages.push(response) };
    vi.stubGlobal('self', worker);
    await import('../src/workers/document.worker');
  });
  afterEach(() => vi.unstubAllGlobals());

  async function request<T>(data: WorkerRequest): Promise<T> {
    await worker.onmessage!({ data } as MessageEvent<WorkerRequest>);
    const response = messages.find((message) => message.id === data.id && message.type !== 'progress');
    expect(response?.type).toBe('result');
    if (response?.type !== 'result') throw new Error(JSON.stringify(response));
    return response.payload as T;
  }

  it('does not reject imports based on size metadata above 20 MiB or 50 MiB', async () => {
    // Test admission separately from allocation; the opt-in case below reads
    // an actual 51 MiB File through the same Worker handler.
    for (const [index, size] of [21 * 1024 ** 2, 50 * 1024 ** 2, 50 * 1024 ** 2 + 1].entries()) {
      const bytes = new TextEncoder().encode('第一章 风雨\n　　正文。\n');
      const read = vi.fn(async () => bytes.buffer);
      const file = { name: '大文件.txt', size, arrayBuffer: read } as unknown as File;
      const snapshot = await request<DocumentSnapshot>({ id: index + 1, type: 'load', file, encoding: 'auto', rules: DEFAULT_RULES, maxTitleLength: 60 });
      expect(read).toHaveBeenCalledOnce();
      expect(snapshot.size).toBe(size);
      expect(snapshot.headingCount).toBe(1);
      expect(snapshot.sections[0].title).toBe('第一章 风雨');
    }
    expect(messages.some((message) => message.type === 'error')).toBe(false);
  });

  it.skipIf(!process.env.RUN_SCALE)('reads and previews a real 51 MiB TXT through the Worker', async () => {
    const targetSize = 51 * 1024 ** 2;
    const header = '第一章 大文件\n';
    const paragraph = '　　' + '正文内容'.repeat(20) + '。\n';
    const encoder = new TextEncoder();
    const headerSize = encoder.encode(header).length;
    const paragraphSize = encoder.encode(paragraph).length;
    const count = Math.floor((targetSize - headerSize) / paragraphSize);
    const source = header + paragraph.repeat(count) + ' '.repeat(targetSize - headerSize - count * paragraphSize);
    const file = new File([source], '51MiB.txt', { type: 'text/plain' });
    expect(file.size).toBe(targetSize);
    const snapshot = await request<DocumentSnapshot>({ id: 1, type: 'load', file, encoding: 'auto', rules: DEFAULT_RULES, maxTitleLength: 60 });
    expect(snapshot.size).toBe(targetSize);
    expect(snapshot.headingCount).toBe(1);
    expect(snapshot.lineCount).toBe(count + 2);
    const preview = await request<Preview>({ id: 2, type: 'preview', sectionId: snapshot.sections[0].id, offset: 0 });
    expect(preview.text).toMatch(/^正文内容/);
    expect(preview.nextOffset).not.toBeNull();
    expect(messages.some((message) => message.type === 'error')).toBe(false);
  }, 30000);
});
