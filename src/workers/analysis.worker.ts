/// <reference lib="webworker" />
import { buildCorrectedOutline } from '../core/corrections';
import type { AnalysisJob, AnalysisResponse } from './analysis-protocol';

const worker = self as unknown as DedicatedWorkerGlobalScope;
const send = (response: AnalysisResponse) => worker.postMessage(response);
worker.onmessage = async ({ data: job }: MessageEvent<AnalysisJob>) => {
  send({ type: 'ready' });
  try {
    const result = await buildCorrectedOutline(
      job.source,
      job.rules,
      job,
      job.maxTitleLength,
      async (value) => {
        send({ type: 'progress', value });
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      job.regexRules,
    );
    send({
      type: 'result',
      outline: result.outline,
      ...(job.deleted.length ? { text: result.text } : {}),
    });
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : '规则匹配失败。' });
  }
};
