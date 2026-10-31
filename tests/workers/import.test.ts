import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { DEFAULT_RULES } from '../../src/core/rules';
import type { DocumentSnapshot, Preview } from '../../src/core/types';
import type { ExportResult, WorkerRequest, WorkerResponse } from '../../src/workers/protocol';

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
    await import('../../src/workers/document.worker');
  });
  afterEach(() => vi.unstubAllGlobals());

  async function request<T>(data: WorkerRequest): Promise<T> {
    await worker.onmessage!({ data } as MessageEvent<WorkerRequest>);
    const response = messages.find(
      (message) => message.id === data.id && message.type !== 'progress',
    );
    expect(response?.type).toBe('result');
    if (response?.type !== 'result') throw new Error(JSON.stringify(response));
    return response.payload as T;
  }

  it('deletes empty titles in preview and EPUB, supports merge/undo/redo and rule reapplication', async () => {
    const source =
      '第一卷 空分组\n第一章 正文\n　保留正文\n第二章 空\n \t　\n第三章 正文\n保留终行\n第四章 空';
    const initial = await request<DocumentSnapshot>({
      id: 1,
      type: 'load',
      file: new File([source], '空章节.txt'),
      encoding: 'auto',
      rules: DEFAULT_RULES,
      maxTitleLength: 60,
    });
    const deleted = initial.sections
      .filter((section) => section.empty)
      .map((section) => section.lineIndex!);
    expect(deleted).toEqual([0, 3, 7]);
    const analyze = (
      id: number,
      deleted: number[],
      ignored: number[] = [],
      rules = DEFAULT_RULES,
    ) =>
      request<DocumentSnapshot>({
        id,
        type: 'analyze',
        deleted,
        ignored,
        rules,
        maxTitleLength: 60,
      });
    const cleaned = await analyze(2, deleted);
    expect(
      cleaned.sections.map((section) => [section.title, section.lineIndex, section.depth]),
    ).toEqual([
      ['第一章 正文', 1, 0],
      ['第三章 正文', 5, 0],
    ]);
    expect(cleaned.revision).toBe(initial.revision + 1);
    const preview = await request<Preview>({
      id: 3,
      type: 'preview',
      sectionId: 'line-1',
      offset: 0,
    });
    expect(preview.text).toBe('保留正文');
    const files = unzipSync(
      (
        await request<ExportResult>({
          id: 4,
          type: 'export',
          metadata: { title: '空章节清理', author: '', language: 'zh-Hans' },
        })
      ).bytes,
    );
    expect(Object.keys(files).filter((path) => path.startsWith('OEBPS/text/'))).toHaveLength(2);
    for (const [path, bytes] of Object.entries(files)) {
      if (/\.(xhtml|ncx|opf)$/.test(path))
        expect(strFromU8(bytes)).not.toMatch(/第一卷 空分组|第二章 空|第四章 空/);
    }
    const merged = await analyze(5, deleted, [5]);
    expect(merged.sections).toHaveLength(1);
    expect(
      (await request<Preview>({ id: 6, type: 'preview', sectionId: 'line-1', offset: 0 })).text,
    ).toContain('第三章 正文\n保留终行');
    expect((await analyze(7, deleted)).sections).toEqual(cleaned.sections);
    expect((await analyze(8, [])).sections).toEqual(initial.sections);
    expect((await analyze(9, deleted)).sections).toEqual(cleaned.sections);
    const disabledRules = DEFAULT_RULES.map((rule) => ({ ...rule, enabled: false }));
    await analyze(10, [], [], disabledRules);
    const redo = await analyze(11, deleted, [], disabledRules);
    expect(redo.headingCount).toBe(0);
    const body = await request<Preview>({
      id: 12,
      type: 'preview',
      sectionId: 'frontmatter',
      offset: 0,
    });
    expect(body.text).not.toMatch(/第一卷 空分组|第二章 空|第四章 空/);
    expect(body.text).toContain('保留终行');
  });

  it('rejects deleting a chapter with body and leaves the document unchanged', async () => {
    const initial = await request<DocumentSnapshot>({
      id: 1,
      type: 'load',
      file: new File(['第一章 有内容\n正文'], '正文.txt'),
      encoding: 'auto',
      rules: DEFAULT_RULES,
      maxTitleLength: 60,
    });
    const invalid: WorkerRequest = {
      id: 2,
      type: 'analyze',
      deleted: [0],
      ignored: [],
      rules: DEFAULT_RULES,
      maxTitleLength: 60,
    };
    await worker.onmessage!({ data: invalid } as MessageEvent<WorkerRequest>);
    expect(messages.find((message) => message.id === 2 && message.type === 'error')).toMatchObject({
      message: expect.stringContaining('只能删除'),
    });
    const preview = await request<Preview>({
      id: 3,
      type: 'preview',
      sectionId: 'line-0',
      offset: 0,
    });
    expect(preview.text).toBe('正文');
    expect(preview.revision).toBe(initial.revision);
  });

  it('cleans controls only for an opted-in export and keeps previews and subsequent strict exports unchanged', async () => {
    const source = '第一章 标题\u001A\n正文\u001A\n\t换行与😀';
    const snapshot = await request<DocumentSnapshot>({
      id: 1,
      type: 'load',
      file: new File([source], '控制字符.txt'),
      encoding: 'auto',
      rules: DEFAULT_RULES,
      maxTitleLength: 60,
    });
    const exportRequest = {
      type: 'export' as const,
      metadata: { title: '控制字符验证', author: '', language: 'zh-Hans' },
    };
    await worker.onmessage!({ data: { id: 2, ...exportRequest } } as MessageEvent<WorkerRequest>);
    expect(messages.find((message) => message.id === 2 && message.type === 'error')).toMatchObject({
      message: expect.stringContaining('U+001A'),
    });
    const result = await request<ExportResult>({
      id: 3,
      ...exportRequest,
      cleanInvalidControls: true,
    });
    expect(result.cleanedControlCount).toBe(2);
    const files = unzipSync(result.bytes);
    expect(strFromU8(files['OEBPS/text/section-000001.xhtml'])).toContain('<p>正文</p>');
    expect(strFromU8(files['OEBPS/nav.xhtml'])).toContain('第一章 标题');
    const preview = await request<Preview>({
      id: 4,
      type: 'preview',
      sectionId: 'line-0',
      offset: 0,
    });
    expect(preview.text).toContain('正文\u001A');
    expect(preview.revision).toBe(snapshot.revision);
    await worker.onmessage!({ data: { id: 5, ...exportRequest } } as MessageEvent<WorkerRequest>);
    expect(messages.find((message) => message.id === 5 && message.type === 'error')).toMatchObject({
      message: expect.stringContaining('U+001A'),
    });
  });

  it('does not reject imports based on size metadata above 20 MiB or 50 MiB', async () => {
    // Test admission separately from allocation; the opt-in case below reads
    // an actual 51 MiB File through the same Worker handler.
    for (const [index, size] of [21 * 1024 ** 2, 50 * 1024 ** 2, 50 * 1024 ** 2 + 1].entries()) {
      const bytes = new TextEncoder().encode('第一章 风雨\n　　正文。\n');
      const read = vi.fn(async () => bytes.buffer);
      const file = { name: '大文件.txt', size, arrayBuffer: read } as unknown as File;
      const snapshot = await request<DocumentSnapshot>({
        id: index + 1,
        type: 'load',
        file,
        encoding: 'auto',
        rules: DEFAULT_RULES,
        maxTitleLength: 60,
      });
      expect(read).toHaveBeenCalledOnce();
      expect(snapshot.size).toBe(size);
      expect(snapshot.headingCount).toBe(1);
      expect(snapshot.sections[0].title).toBe('第一章 风雨');
    }
    expect(messages.some((message) => message.type === 'error')).toBe(false);
  });

  it('exports with blank line cleanup on or off without changing the document or raw preview', async () => {
    const source = '第一章 正文\n\n　首段\n\n \t　\n二段\n\n';
    const initial = await request<DocumentSnapshot>({
      id: 1,
      type: 'load',
      file: new File([source], '空行.txt'),
      encoding: 'auto',
      rules: DEFAULT_RULES,
      maxTitleLength: 60,
    });
    const preview = await request<Preview>({
      id: 2,
      type: 'preview',
      sectionId: 'line-0',
      offset: 0,
    });
    expect(preview.text).toBe('\n首段\n\n\n二段');
    for (const [index, removeBlankLines] of [true, false, true].entries()) {
      const result = await request<ExportResult>({
        id: index + 3,
        type: 'export',
        metadata: { title: '空行验证', author: '', language: 'zh-Hans' },
        removeBlankLines,
      });
      const chapter = strFromU8(unzipSync(result.bytes)['OEBPS/text/section-000001.xhtml']);
      expect(chapter.includes('<p class="blank">')).toBe(!removeBlankLines);
      expect(chapter).toContain('<p>首段</p>');
      expect(chapter).toContain('<p>二段</p>');
    }
    const after = await request<Preview>({
      id: 6,
      type: 'preview',
      sectionId: 'line-0',
      offset: 0,
    });
    expect(after).toEqual(preview);
    expect(after.revision).toBe(initial.revision);
  });

  it.skipIf(!process.env.RUN_SCALE)(
    'reads and previews a real 51 MiB TXT through the Worker',
    async () => {
      const targetSize = 51 * 1024 ** 2;
      const header = '第一章 大文件\n';
      const paragraph = '　　' + '正文内容'.repeat(20) + '。\n';
      const encoder = new TextEncoder();
      const headerSize = encoder.encode(header).length;
      const paragraphSize = encoder.encode(paragraph).length;
      const count = Math.floor((targetSize - headerSize) / paragraphSize);
      const source =
        header +
        paragraph.repeat(count) +
        ' '.repeat(targetSize - headerSize - count * paragraphSize);
      const file = new File([source], '51MiB.txt', { type: 'text/plain' });
      expect(file.size).toBe(targetSize);
      const snapshot = await request<DocumentSnapshot>({
        id: 1,
        type: 'load',
        file,
        encoding: 'auto',
        rules: DEFAULT_RULES,
        maxTitleLength: 60,
      });
      expect(snapshot.size).toBe(targetSize);
      expect(snapshot.headingCount).toBe(1);
      expect(snapshot.lineCount).toBe(count + 2);
      const preview = await request<Preview>({
        id: 2,
        type: 'preview',
        sectionId: snapshot.sections[0].id,
        offset: 0,
      });
      expect(preview.text).toMatch(/^正文内容/);
      expect(preview.nextOffset).not.toBeNull();
      expect(messages.some((message) => message.type === 'error')).toBe(false);
    },
    30000,
  );
});
