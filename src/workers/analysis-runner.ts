import { LocalizedError } from '../i18n/locale';
import type { AnalysisJob, AnalysisResponse, AnalysisResult } from './analysis-protocol';

// Each job gets its own worker. A stalled RegExp cannot block the document
// worker's cancellation handler or destroy its committed text/outline.
export function startAnalysis(job: AnalysisJob, onProgress: (value: number) => void) {
  const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  let rejectJob: (error: Error) => void;
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<AnalysisResult>((resolve, reject) => {
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      worker.terminate();
    };
    rejectJob = (error) => {
      if (settled) return;
      cleanup();
      reject(error);
    };
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          rejectJob(
            new LocalizedError(
              '正则匹配超时，任务已停止，已有文档和目录未改变。请简化表达式后重试。',
              'Regex matching timed out. Your current document and contents are intact. Simplify the pattern and try again.',
            ),
          ),
        ms,
      );
    };
    worker.onmessage = ({ data }: MessageEvent<AnalysisResponse>) => {
      if (settled) return;
      if (data.type === 'error')
        rejectJob(new LocalizedError(data.message, data.messageEn ?? data.message));
      else if (data.type === 'result') {
        cleanup();
        resolve({ outline: data.outline, text: data.text ?? job.source });
      } else {
        arm(2000);
        if (data.type === 'progress') {
          try {
            onProgress(data.value);
          } catch (error) {
            rejectJob(
              error instanceof Error
                ? error
                : new LocalizedError('操作已取消', 'Operation canceled.'),
            );
          }
        }
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      rejectJob(
        new LocalizedError(
          '规则匹配任务异常停止，已有文档和目录未改变。请重试。',
          'Rule matching stopped unexpectedly. Your current document and contents are intact. Try again.',
        ),
      );
    };
    arm(15000);
    try {
      worker.postMessage(job);
    } catch (error) {
      rejectJob(
        error instanceof Error
          ? error
          : new LocalizedError('无法启动规则匹配任务。', 'Could not start rule matching.'),
      );
    }
  });
  return {
    promise,
    cancel: () => rejectJob(new LocalizedError('操作已取消', 'Operation canceled.')),
  };
}
