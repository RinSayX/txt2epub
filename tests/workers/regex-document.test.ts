import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildCorrectedOutline } from '../../src/core/corrections';
import { DEFAULT_RULES } from '../../src/core/rules';
import { PREFIX_CHAPTER_PATTERN } from '../../src/core/regex';
import { DEFAULT_CONTINUITY_OPTIONS } from '../../src/core/continuity';
import type {
  DocumentSnapshot,
  Preview,
  RegexHeadingRule,
  RegexTestResult,
  ContinuityResult,
} from '../../src/core/types';
import type { AnalysisJob } from '../../src/workers/analysis-protocol';
import type { ExportResult, WorkerRequest, WorkerResponse } from '../../src/workers/protocol';

const { runner } = vi.hoisted(() => ({ runner: vi.fn() }));
vi.mock('../../src/workers/analysis-runner', () => ({ startAnalysis: runner }));
const regexRules: RegexHeadingRule[] = [
  { id: 'prefix', name: '前置序号', pattern: PREFIX_CHAPTER_PATTERN, enabled: true, level: 3 },
];
const source = '第一卷 分组\n233.第233章 比试\n正文 A\n234.第234章 空章\n235.第235章 归来\n正文 B';

describe('regex rules in document sessions', () => {
  let worker: {
    onmessage: ((event: MessageEvent<WorkerRequest>) => Promise<void>) | null;
    postMessage: (message: WorkerResponse) => void;
  };
  let messages: WorkerResponse[];
  beforeEach(async () => {
    vi.resetModules();
    runner.mockReset();
    runner.mockImplementation((job: AnalysisJob, progress: (value: number) => void) => ({
      promise: buildCorrectedOutline(
        job.source,
        job.rules,
        job,
        job.maxTitleLength,
        async (value) => progress(value),
        job.regexRules,
      ),
      cancel: vi.fn(),
    }));
    messages = [];
    worker = { onmessage: null, postMessage: (message) => messages.push(message) };
    vi.stubGlobal('self', worker);
    await import('../../src/workers/document.worker');
  });
  afterEach(() => vi.unstubAllGlobals());
  const send = (data: WorkerRequest) => worker.onmessage!({ data } as MessageEvent<WorkerRequest>);
  async function request<T>(data: WorkerRequest): Promise<T> {
    await send(data);
    const result = messages.find((m) => m.id === data.id && m.type === 'result');
    if (result?.type !== 'result') throw new Error(JSON.stringify(messages));
    return result.payload as T;
  }
  const load = () =>
    request<DocumentSnapshot>({
      id: 1,
      type: 'load',
      file: new File([source], '正则.txt'),
      encoding: 'auto',
      rules: DEFAULT_RULES,
      regexRules,
      maxTitleLength: 60,
    });
  const analyze = (id: number, ignored: number[] = [], deleted: number[] = []) =>
    request<DocumentSnapshot>({
      id,
      type: 'analyze',
      rules: DEFAULT_RULES,
      regexRules,
      ignored,
      deleted,
      maxTitleLength: 60,
    });

  it('preserves numbering through the isolated regex analysis path and checks corrected titles', async () => {
    const initial = await load();
    expect(initial.sections.map((section) => section.numbering?.value)).toEqual([1, 233, 234, 235]);
    const corrected = await analyze(2, [], [3]);
    const result = await request<ContinuityResult>({
      id: 3,
      type: 'check-numbering',
      documentId: corrected.documentId,
      revision: corrected.revision,
      options: DEFAULT_CONTINUITY_OPTIONS,
    });
    expect(result.issues[0].message).toContain('第234章');
    expect(result.issues[0].sectionIds).toEqual(['line-1', 'line-4']);
  });

  it('uses extracted titles for import/export and preserves original text through merge, delete and undo', async () => {
    const initial = await load();
    expect(initial.sections.map((s) => s.title)).toEqual([
      '第一卷 分组',
      '第233章 比试',
      '第234章 空章',
      '第235章 归来',
    ]);
    const removed = await analyze(2, [], [3]);
    expect(removed.sections).toHaveLength(3);
    const merged = await analyze(3, [4], [3]);
    expect(merged.sections).toHaveLength(2);
    expect(
      (await request<Preview>({ id: 4, type: 'preview', sectionId: 'line-1', offset: 0 })).text,
    ).toContain('235.第235章 归来\n正文 B');
    expect((await analyze(5)).sections).toEqual(initial.sections);
    const result = await request<ExportResult>({
      id: 6,
      type: 'export',
      metadata: { title: '正则书籍', author: '', language: 'zh-Hans' },
    });
    const files = unzipSync(result.bytes);
    expect(strFromU8(files['OEBPS/nav.xhtml'])).toContain('第233章 比试');
    expect(strFromU8(files['OEBPS/nav.xhtml'])).not.toContain('233.第233章');
  });

  it('tests draft rules against the current document without applying them', async () => {
    const initial = await load();
    const before = await request<Preview>({
      id: 2,
      type: 'preview',
      sectionId: 'line-1',
      offset: 0,
    });
    const result = await request<RegexTestResult>({
      id: 3,
      type: 'test-rules',
      rules: DEFAULT_RULES,
      regexRules: [{ ...regexRules[0], pattern: String.raw`[0-9]+\.第[0-9]+章 (?<title>.+)` }],
      ignored: [],
      deleted: [],
      maxTitleLength: 60,
    });
    expect(result.headingCount).toBe(4);
    expect(result.regexMatchCount).toBe(3);
    expect(result.samples[0]).toMatchObject({
      lineIndex: 1,
      original: '233.第233章 比试',
      title: '比试',
      ruleName: '前置序号',
    });
    const after = await request<Preview>({
      id: 4,
      type: 'preview',
      sectionId: 'line-1',
      offset: 0,
    });
    expect(after).toEqual(before);
    expect(after.revision).toBe(initial.revision);
  });

  it('can test pasted text before import and limits previews while counting all matches', async () => {
    const sampleText = Array.from({ length: 25 }, (_, i) => `${i}.第${i}章 章节`).join('\r\n');
    const result = await request<RegexTestResult>({
      id: 1,
      type: 'test-rules',
      rules: DEFAULT_RULES,
      regexRules,
      ignored: [0],
      deleted: [1],
      maxTitleLength: 60,
      sampleText,
    });
    expect(result.headingCount).toBe(25);
    expect(result.regexMatchCount).toBe(25);
    expect(result.samples).toHaveLength(20);
    expect(result.samples[0].lineIndex).toBe(0);
  });

  it('keeps the committed document after syntax errors or watchdog failure', async () => {
    const initial = await load();
    const bad: WorkerRequest = {
      id: 2,
      type: 'analyze',
      rules: DEFAULT_RULES,
      regexRules: [{ ...regexRules[0], pattern: '[' }],
      ignored: [],
      maxTitleLength: 60,
    };
    await send(bad);
    expect(messages.find((m) => m.id === 2 && m.type === 'error')).toMatchObject({
      message: expect.stringContaining('语法错误'),
    });
    runner.mockReturnValueOnce({
      promise: Promise.reject(new Error('正则匹配超时')),
      cancel: vi.fn(),
    });
    await send({ ...bad, id: 3, regexRules });
    expect(messages.find((m) => m.id === 3 && m.type === 'error')).toMatchObject({
      message: '正则匹配超时',
    });
    const preview = await request<Preview>({
      id: 4,
      type: 'preview',
      sectionId: 'line-1',
      offset: 0,
    });
    expect(preview.revision).toBe(initial.revision);
    expect(preview.text).toBe('正文 A');
  });

  it('cancels the isolated matcher without committing a partial directory', async () => {
    const initial = await load();
    let rejectTask!: (error: Error) => void;
    const cancel = vi.fn(() => rejectTask(new Error('操作已取消')));
    runner.mockReturnValueOnce({
      promise: new Promise((_, reject) => {
        rejectTask = reject;
      }),
      cancel,
    });
    const pending = send({
      id: 2,
      type: 'analyze',
      rules: DEFAULT_RULES,
      regexRules,
      ignored: [],
      maxTitleLength: 60,
    });
    await send({ id: 3, type: 'cancel' });
    await pending;
    expect(cancel).toHaveBeenCalledOnce();
    const preview = await request<Preview>({
      id: 4,
      type: 'preview',
      sectionId: 'line-1',
      offset: 0,
    });
    expect(preview.revision).toBe(initial.revision);
  });
});
