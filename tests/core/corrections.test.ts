import { describe, expect, it } from 'vitest';
import { buildCorrectedOutline } from '../../src/core/corrections';
import { buildOutline, sectionPreview } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';

describe('empty chapter deletion', () => {
  const source =
    '前言正文\n第一卷 空分组\n \t　\n第一章 保留\n　正文 A\n第二章 空白\n\t　\n第三章 保留\n正文 B\n第四章 空末章';

  it('detects empty direct bodies, including grouping titles and EOF titles', async () => {
    const outline = await buildOutline(source, DEFAULT_RULES);
    expect(outline.sections.map((section) => section.empty)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(
      (await buildOutline('第一章 字符\n。\n第二章 符号\n😀', DEFAULT_RULES)).sections.every(
        (section) => !section.empty,
      ),
    ).toBe(true);
  });

  it('removes only selected titles and reparents children while preserving source order and line numbers', async () => {
    const result = await buildCorrectedOutline(
      source,
      DEFAULT_RULES,
      { ignored: [], deleted: [1, 5, 9] },
      60,
    );
    expect(
      result.outline.sections.map((section) => [
        section.title,
        section.lineIndex,
        section.parentId,
      ]),
    ).toEqual([
      ['前言', null, null],
      ['第一章 保留', 3, null],
      ['第三章 保留', 7, null],
    ]);
    expect(
      result.outline.sections.map((section) => sectionPreview(result.text, section).text),
    ).toEqual(['前言正文', '正文 A', '正文 B']);
    expect(result.text).not.toMatch(/空分组|空白|空末章/);
    expect(result.outline.characterCount).toBe(source.length);
    expect(result.outline.lineCount).toBe((await buildOutline(source, DEFAULT_RULES)).lineCount);
  });

  it('does not create an empty preface after removing opening titles and keeps nonempty ancestors', async () => {
    const text =
      '第一卷 空卷\n第一册 空册\n第一章 故事\n正文\n第二卷 有卷首\n卷首说明\n第二章 空章\n\n第三章 故事\n终行';
    const result = await buildCorrectedOutline(
      text,
      DEFAULT_RULES,
      { ignored: [], deleted: [0, 1, 6] },
      60,
    );
    expect(
      result.outline.sections.map((section) => [section.title, section.depth, section.parentId]),
    ).toEqual([
      ['第一章 故事', 0, null],
      ['第二卷 有卷首', 0, null],
      ['第三章 故事', 1, 'line-4'],
    ]);
    expect(
      result.outline.sections.map((section) => sectionPreview(result.text, section).text),
    ).toEqual(['正文', '卷首说明', '终行']);
  });

  it('combines deletion with merges and restores exact originals for undo and redo', async () => {
    const corrections = { ignored: [7], deleted: [1, 5, 9] };
    const deleted = await buildCorrectedOutline(source, DEFAULT_RULES, corrections, 60);
    expect(
      deleted.outline.sections.map((section) => sectionPreview(deleted.text, section).text),
    ).toEqual(['前言正文', '正文 A\n\n\n第三章 保留\n正文 B']);
    const restored = await buildCorrectedOutline(
      source,
      DEFAULT_RULES,
      { ignored: [], deleted: [] },
      60,
    );
    expect(restored.text).toBe(source);
    expect(restored.outline).toEqual(await buildOutline(source, DEFAULT_RULES));
    expect(await buildCorrectedOutline(source, DEFAULT_RULES, corrections, 60)).toEqual(deleted);
  });

  it('retains deletions when recognition rules change', async () => {
    const rules = DEFAULT_RULES.map((rule) => ({ ...rule, enabled: false }));
    const result = await buildCorrectedOutline(
      source,
      rules,
      { ignored: [], deleted: [1, 5, 9] },
      60,
    );
    expect(result.text).not.toMatch(/空分组|空白|空末章/);
    expect(result.text).toContain('第一章 保留');
    expect(result.outline.headingCount).toBe(0);
  });

  it('handles a book containing only empty titles without reintroducing them', async () => {
    const text = '第一卷 空\n第一章 空\n \t　\n第二章 空';
    const result = await buildCorrectedOutline(
      text,
      DEFAULT_RULES,
      { ignored: [], deleted: [0, 1, 3] },
      60,
    );
    expect(result.outline.headingCount).toBe(0);
    expect(result.outline.sections).toHaveLength(1);
    expect(sectionPreview(result.text, result.outline.sections[0]).text).toBe('');
  });

  it('can cancel while preparing the working copy', async () => {
    await expect(
      buildCorrectedOutline(
        '第一章 空\n' + '\n'.repeat(5000),
        DEFAULT_RULES,
        { ignored: [], deleted: [0] },
        60,
        async () => {
          throw new Error('cancelled');
        },
      ),
    ).rejects.toThrow('cancelled');
  });
});
