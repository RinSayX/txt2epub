import { describe, expect, it } from 'vitest';
import { checkContinuity, DEFAULT_CONTINUITY_OPTIONS } from '../../src/core/continuity';
import { buildOutline } from '../../src/core/outline';
import { buildCorrectedOutline } from '../../src/core/corrections';
import { DEFAULT_RULES } from '../../src/core/rules';
import type { DocumentSnapshot, Outline } from '../../src/core/types';

const snapshot = (outline: Outline): DocumentSnapshot => ({
  ...outline,
  documentId: 'sample',
  revision: 1,
  filename: '样本.txt',
  size: 1,
  encoding: 'utf-8',
  encodingUncertain: false,
});
const book = async (text: string) =>
  snapshot(await buildOutline(text, DEFAULT_RULES, undefined, 500));
const chapters = (values: number[]) => values.map((value) => `第${value}章 标题\n正文`).join('\n');

describe('numbering continuity', () => {
  it('can opt into a custom regex series whose display titles contain no numbers', async () => {
    const outline = await buildOutline(
      '233. 比试\n正文\n235. 归来\n正文',
      DEFAULT_RULES,
      undefined,
      60,
      undefined,
      [
        {
          id: 'custom',
          name: '列表章节',
          pattern: String.raw`^(?<number>\d+)\. (?<title>.+)$`,
          enabled: true,
          level: 3,
        },
      ],
    );
    const data = snapshot(outline);
    expect((await checkContinuity(data)).checkedCount).toBe(0);
    const result = await checkContinuity(data, {
      ...DEFAULT_CONTINUITY_OPTIONS,
      units: ['regex:custom'],
    });
    expect(result.issues[0].message).toContain('疑似缺少编号234');
    expect(result.issues[0].scope).toContain('列表章节');
  });
  it('detects gaps only after considering the entire sequence and does not invent missing starts/ends', async () => {
    const complete = await checkContinuity(await book(chapters([300, 302, 301, 303])));
    expect(complete.issues.map((issue) => issue.kind)).toEqual(['order']);
    const missing = await checkContinuity(await book(chapters([300, 303])));
    expect(missing.issues).toHaveLength(1);
    expect(missing.issues[0].message).toContain('301–302');
    expect(missing.issues[0].sectionIds).toEqual(['line-0', 'line-2']);
  });

  it('groups adjacent and non-adjacent duplicate numbers regardless of numeral spelling', async () => {
    const result = await checkContinuity(
      await book(
        '第两百章 标题\n正文\n第二百零一章 标题\n正文\n第２００章 标题\n正文\n第贰佰章 标题\n正文',
      ),
    );
    const duplicate = result.issues.filter((issue) => issue.kind === 'duplicate');
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0].sectionIds).toEqual(['line-0', 'line-4', 'line-6']);
    expect(duplicate[0].message).toContain('出现 3 次');
    expect(result.issues.some((issue) => issue.kind === 'order')).toBe(true);
  });

  it('compacts huge missing ranges into one diagnostic', async () => {
    const result = await checkContinuity(await book(chapters([1, 1000000])));
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('2–999999');
    expect(result.issues[0].message).toContain('999998');
  });

  it('compares full-book numbering by default and can reset at higher numbered volume/book headings', async () => {
    const data = await book(
      '第一卷 初见\n第一册 甲\n' +
        chapters([1, 2]) +
        '\n第二册 乙\n' +
        chapters([1, 2]) +
        '\n第二卷 重逢\n' +
        chapters([100, 101]),
    );
    expect((await checkContinuity(data)).issues.length).toBeGreaterThan(0);
    expect(
      (await checkContinuity(data, { ...DEFAULT_CONTINUITY_OPTIONS, scope: 'volume' })).issues,
    ).toEqual([]);
  });

  it('does not reset on unnumbered interludes and keeps different units and levels separate', async () => {
    const data = await book(
      '第一卷 卷\n第一章 标题\n正文\n番外\n第三章 标题\n正文\n第1回 标题\n正文\n第2回 标题\n正文',
    );
    const result = await checkContinuity(data, { ...DEFAULT_CONTINUITY_OPTIONS, scope: 'volume' });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('第2章');
    expect(result.excludedCount).toBe(1);
    const mixed = structuredClone(data);
    mixed.sections.find((section) => section.numbering?.value === 3)!.level = 2;
    expect((await checkContinuity(mixed)).issues).toEqual([]);
  });

  it('allows distinct explicit parts but still detects repeated parts, reversed parts and strict duplicates', async () => {
    const data = await book('第1章（上） 标题\n正文\n第1章（下） 标题\n正文\n第2章 标题\n正文');
    const normal = await checkContinuity(data);
    expect(normal.issues).toEqual([]);
    expect(normal.splits).toHaveLength(1);
    expect(
      (await checkContinuity(data, { ...DEFAULT_CONTINUITY_OPTIONS, strictParts: true })).issues[0]
        .kind,
    ).toBe('duplicate');
    const repeated = await checkContinuity(
      await book('第1章（上）\n正文\n第1章（上）\n正文\n第1章（下）\n正文'),
    );
    expect(repeated.issues).toHaveLength(1);
    expect(repeated.issues[0].sectionIds).toHaveLength(2);
    expect(
      (await checkContinuity(await book('第1章（下）\n正文\n第1章（上）\n正文'))).issues[0].kind,
    ).toBe('order');
    expect(
      (await checkContinuity(await book('第1章 上山\n正文\n第1章 下雨\n正文'))).issues[0].kind,
    ).toBe('duplicate');
  });

  it('reports unparsed recognized titles and honors selected units without guessing values', async () => {
    const data = await book('第一百百章 标题\n正文\n第一卷 标题\n正文\n第三卷 标题\n正文');
    const normal = await checkContinuity(data);
    expect(normal.unparsed).toEqual(['line-0']);
    expect(normal.issues).toEqual([]);
    const volumes = await checkContinuity(data, { ...DEFAULT_CONTINUITY_OPTIONS, units: ['卷'] });
    expect(volumes.unparsed).toEqual([]);
    expect(volumes.issues[0].message).toContain('第2卷');
    expect(
      (await checkContinuity(data, { ...DEFAULT_CONTINUITY_OPTIONS, units: [] })).checkedCount,
    ).toBe(0);
  });

  it('updates after merge/deletion and restores diagnostics after undo, with stable original line references', async () => {
    const source = '第一章 开始\n正文\n第二章 空\n第三章 结束\n正文';
    const original = await book(source);
    expect((await checkContinuity(original)).issues).toEqual([]);
    for (const corrections of [
      { ignored: [2], deleted: [] },
      { ignored: [], deleted: [2] },
    ]) {
      const corrected = await buildCorrectedOutline(source, DEFAULT_RULES, corrections, 60);
      const result = await checkContinuity(snapshot(corrected.outline));
      expect(result.issues[0].message).toContain('第2章');
      expect(result.issues[0].sectionIds).toEqual(['line-0', 'line-3']);
    }
    expect((await checkContinuity(await book(source))).issues).toEqual([]);
  });

  it('binds results to document/revision/settings and yields for cancellation with large outlines', async () => {
    const data = await book(chapters(Array.from({ length: 16000 }, (_, index) => index + 1)));
    const result = await checkContinuity(data);
    expect(result.issues).toEqual([]);
    expect(result.checkedCount).toBe(16000);
    expect(result.documentId).toBe(data.documentId);
    expect(result.revision).toBe(data.revision);
    expect(result.optionsKey).not.toBe(
      (await checkContinuity(data, { ...DEFAULT_CONTINUITY_OPTIONS, scope: 'volume' })).optionsKey,
    );
    await expect(
      checkContinuity(data, undefined, async (value) => {
        if (value > 0.1) throw new Error('操作已取消');
      }),
    ).rejects.toThrow('操作已取消');
  });
});
