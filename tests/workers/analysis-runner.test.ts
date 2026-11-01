import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAnalysis } from '../../src/workers/analysis-runner';
import type { AnalysisJob, AnalysisResponse } from '../../src/workers/analysis-protocol';
import type { Outline } from '../../src/core/types';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  emit(data: AnalysisResponse) {
    this.onmessage?.({ data } as MessageEvent<AnalysisResponse>);
  }
}
const job: AnalysisJob = {
  source: '保留原文',
  rules: [],
  regexRules: [],
  ignored: [],
  deleted: [],
  maxTitleLength: 60,
};
const outline: Outline = { sections: [], headingCount: 0, characterCount: 4, lineCount: 1 };

describe('isolated matching job lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('terminates a stalled matcher after readiness and ignores any late result', async () => {
    const task = startAnalysis(job, () => {});
    const failure = expect(task.promise).rejects.toThrow('正则匹配超时');
    const worker = FakeWorker.instances[0];
    worker.emit({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(2000);
    await failure;
    expect(worker.terminate).toHaveBeenCalledOnce();
    worker.emit({ type: 'result', outline });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('extends the watchdog on progress and returns the source without an unnecessary round trip', async () => {
    const progress = vi.fn();
    const task = startAnalysis(job, progress);
    const worker = FakeWorker.instances[0];
    worker.emit({ type: 'ready' });
    await vi.advanceTimersByTimeAsync(1500);
    worker.emit({ type: 'progress', value: 0.5 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.emit({ type: 'result', outline });
    await expect(task.promise).resolves.toEqual({ text: job.source, outline });
    expect(progress).toHaveBeenCalledWith(0.5);
    await vi.runAllTimersAsync();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('cancels immediately without waiting for a regex or startup to complete', async () => {
    const task = startAnalysis(job, () => {});
    const failure = expect(task.promise).rejects.toThrow('操作已取消');
    task.cancel();
    await failure;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds worker startup time and cleans up on syntax errors', async () => {
    const first = startAnalysis(job, () => {});
    const failure = expect(first.promise).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(15000);
    await failure;
    const second = startAnalysis(job, () => {});
    FakeWorker.instances[1].emit({ type: 'error', message: '正则语法错误' });
    await expect(second.promise).rejects.toThrow('语法错误');
    expect(FakeWorker.instances[1].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
