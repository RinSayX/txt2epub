/// <reference lib="webworker" />
import { generateEpub } from '../core/epub/generate';
import { sectionPreview } from '../core/outline';
import { decodeText } from '../core/encoding';
import { buildCorrectedOutline } from '../core/corrections';
import type { DocumentSnapshot, RegexTestResult } from '../core/types';
import type { WorkerRequest, WorkerResponse } from './protocol';
import type { AnalysisJob } from './analysis-protocol';
import { startAnalysis } from './analysis-runner';

const worker = self as unknown as DedicatedWorkerGlobalScope;
let state: {
  source: string;
  text: string;
  approvedDeletions: Set<number>;
  snapshot: DocumentSnapshot;
} | null = null;
let activeJob = 0;
let analysisTask: ReturnType<typeof startAnalysis> | null = null;

async function analyze(job: AnalysisJob, progress: (value: number) => void) {
  if (!job.regexRules.length)
    return buildCorrectedOutline(job.source, job.rules, job, job.maxTitleLength, async (value) => {
      progress(value);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const task = startAnalysis(job, progress);
  analysisTask = task;
  try {
    return await task.promise;
  } finally {
    if (analysisTask === task) analysisTask = null;
  }
}

function send(response: WorkerResponse, transfer: Transferable[] = []) {
  worker.postMessage(response, transfer);
}

worker.onmessage = async ({ data: request }: MessageEvent<WorkerRequest>) => {
  if (request.type === 'cancel') {
    activeJob = -1;
    analysisTask?.cancel();
    return;
  }
  const id = request.id;
  let lastProgress = 0;
  if (request.type !== 'preview') activeJob = id;
  const check = () => {
    if (activeJob !== id) throw new Error('操作已取消');
  };
  const progress = async (value: number, label: string) => {
    check();
    lastProgress = Math.max(lastProgress, value);
    send({ id, type: 'progress', value: lastProgress, label });
    await new Promise((resolve) => setTimeout(resolve, 0));
    check();
  };
  try {
    if (request.type === 'load') {
      await progress(0.02, '读取文件');
      const bytes = new Uint8Array(await request.file.arrayBuffer());
      check();
      const decoded = decodeText(bytes, request.encoding);
      await progress(0.16, '检查编码');
      const { outline } = await analyze(
        {
          source: decoded.text,
          rules: request.rules,
          regexRules: request.regexRules ?? [],
          ignored: [],
          deleted: [],
          maxTitleLength: request.maxTitleLength,
        },
        (value) => {
          check();
          send({ id, type: 'progress', value: 0.2 + value * 0.8, label: '识别章节' });
        },
      );
      check();
      const snapshot: DocumentSnapshot = {
        ...outline,
        documentId: crypto.randomUUID(),
        revision: 1,
        filename: request.file.name,
        size: request.file.size,
        encoding: decoded.encoding,
        encodingUncertain: decoded.uncertain,
      };
      state = { source: decoded.text, text: decoded.text, approvedDeletions: new Set(), snapshot };
      send({ id, type: 'result', payload: snapshot });
    } else if (request.type === 'analyze') {
      if (!state) throw new Error('请先导入 TXT 文件。');
      const deleted = request.deleted ?? [];
      const existing = state.approvedDeletions;
      const emptyLines = new Set(
        state.snapshot.sections
          .filter((section) => section.empty && section.lineIndex !== null)
          .map((section) => section.lineIndex),
      );
      if (deleted.some((line) => !existing.has(line) && !emptyLines.has(line))) {
        throw new Error('只能删除没有直属正文的空章节，请重新检查目录。');
      }
      const corrected = await analyze(
        {
          source: state.source,
          rules: request.rules,
          regexRules: request.regexRules ?? [],
          ignored: request.ignored,
          deleted,
          maxTitleLength: request.maxTitleLength,
        },
        (value) => {
          check();
          send({ id, type: 'progress', value, label: '更新章节目录' });
        },
      );
      check();
      state.text = corrected.text;
      deleted.forEach((line) => state!.approvedDeletions.add(line));
      state.snapshot = {
        ...state.snapshot,
        ...corrected.outline,
        revision: state.snapshot.revision + 1,
      };
      send({ id, type: 'result', payload: state.snapshot });
    } else if (request.type === 'test-rules') {
      const useSample = request.sampleText !== undefined;
      if (!useSample && !state) throw new Error('请先导入 TXT 文件，或填写测试文本。');
      const source = useSample ? request.sampleText!.replace(/\r\n?/g, '\n') : state!.source;
      if (useSample && source.length > 20000) throw new Error('测试文本最多支持 20,000 个字符。');
      const result = await analyze(
        {
          source,
          rules: request.rules,
          regexRules: request.regexRules,
          maxTitleLength: request.maxTitleLength,
          ignored: useSample ? [] : request.ignored,
          deleted: useSample ? [] : request.deleted,
        },
        (value) => {
          check();
          send({ id, type: 'progress', value, label: '测试识别规则' });
        },
      );
      check();
      const matched = result.outline.sections.filter((section) => section.regexRuleId);
      const names = new Map(request.regexRules.map((rule) => [rule.id, rule.name]));
      const payload: RegexTestResult = {
        headingCount: result.outline.headingCount,
        regexMatchCount: matched.length,
        samples: matched.slice(0, 20).map((section) => ({
          lineIndex: section.lineIndex!,
          original: result.text.slice(section.headingStart, section.bodyStart).trim(),
          title: section.title,
          ruleName: names.get(section.regexRuleId!)!,
          level: section.level,
        })),
      };
      send({ id, type: 'result', payload });
    } else if (request.type === 'preview') {
      if (!state) throw new Error('请先导入 TXT 文件。');
      const section = state.snapshot.sections.find((item) => item.id === request.sectionId);
      if (!section) throw new Error('章节已更新，请重新选择。');
      send({
        id,
        type: 'result',
        payload: {
          ...sectionPreview(state.text, section, request.offset),
          sectionId: section.id,
          revision: state.snapshot.revision,
        },
      });
    } else if (request.type === 'export') {
      if (!state) throw new Error('请先导入 TXT 文件。');
      let cleanedControlCount = 0;
      const bytes = await generateEpub(
        state.text,
        state.snapshot,
        request.metadata,
        (value) => progress(value, '生成 EPUB'),
        {
          cleanInvalidControls: request.cleanInvalidControls,
          removeBlankLines: request.removeBlankLines,
          onCleaned: (count) => {
            cleanedControlCount = count;
          },
        },
      );
      check();
      send({ id, type: 'result', payload: { bytes, cleanedControlCount } }, [
        bytes.buffer as ArrayBuffer,
      ]);
    }
  } catch (error) {
    send({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : '处理失败，请重试。',
    });
  }
};
