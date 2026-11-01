import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildOutline, sectionPreview } from '../../src/core/outline';
import { buildCorrectedOutline } from '../../src/core/corrections';
import { generateEpub } from '../../src/core/epub/generate';
import { DEFAULT_RULES } from '../../src/core/rules';
import { PREFIX_CHAPTER_PATTERN, validateRegexRules } from '../../src/core/regex';
import type { RegexHeadingRule } from '../../src/core/types';

const prefix: RegexHeadingRule = {
  id: 'prefix',
  name: '前置序号',
  pattern: PREFIX_CHAPTER_PATTERN,
  level: 3,
  enabled: true,
};
const analyze = (text: string, regexRules = [prefix]) =>
  buildOutline(text, DEFAULT_RULES, new Set(), 60, undefined, regexRules);

describe('custom regular expression headings', () => {
  it('extracts titles from prefixed headings with original order, line IDs, ranges and hierarchy', async () => {
    const source =
      '第一卷 天\n233.第233章 比试\n正文 A\n２３４． 第２３４章 归来\n正文 B\n第235章 常规\n正文 C';
    const outline = await analyze(source);
    expect(outline.sections.map((s) => [s.title, s.lineIndex, s.parentId])).toEqual([
      ['第一卷 天', 0, null],
      ['第233章 比试', 1, 'line-0'],
      ['第２３４章 归来', 3, 'line-0'],
      ['第235章 常规', 5, 'line-0'],
    ]);
    expect(outline.sections[1].regexRuleId).toBe('prefix');
    expect(outline.sections.map((s) => source.slice(s.headingStart, s.bodyEnd)).join('')).toBe(
      source,
    );
    expect(sectionPreview(source, outline.sections[1]).text).toBe('正文 A');
  });

  it('requires a whole-line match, skips long lines and leaves ordinary lists in the body', async () => {
    const source =
      '233.普通编号列表\n前文233.第233章 比试\n233.第233章 ' +
      '长'.repeat(80) +
      '\n234.第234章 归来\n正文';
    expect((await analyze(source)).headingCount).toBe(1);
    const partial = { ...prefix, pattern: String.raw`第[0-9]+章` };
    expect(
      (await analyze('前文第233章后文\n第234章\n正文', [partial])).sections.map((s) => s.title),
    ).toEqual(['简介', '第234章']);
  });

  it('uses explicit regex priority before keywords and falls back when a regex is disabled', async () => {
    const first = {
      ...prefix,
      id: 'first',
      pattern: String.raw`第[0-9]+章 (?<title>.+)`,
      level: 1,
    };
    const second = {
      ...prefix,
      id: 'second',
      pattern: String.raw`(?<title>第[0-9]+章 .+)`,
      level: 4,
    };
    const source = '第233章 比试\n正文';
    expect((await analyze(source, [first, second])).sections[0]).toMatchObject({
      title: '比试',
      level: 1,
      regexRuleId: 'first',
    });
    expect((await analyze(source, [second, first])).sections[0]).toMatchObject({
      title: '第233章 比试',
      level: 4,
      regexRuleId: 'second',
    });
    expect((await analyze(source, [{ ...first, enabled: false }])).sections[0]).toMatchObject({
      title: '第233章 比试',
      level: 3,
    });
  });

  it('preserves the full title if no title group is defined and rejects an empty or unmatched title group', async () => {
    expect(
      (
        await analyze('233.第233章 比试', [
          { ...prefix, pattern: String.raw`[0-9]+\.第[0-9]+章.*` },
        ])
      ).sections[0].title,
    ).toBe('233.第233章 比试');
    for (const pattern of [String.raw`(?<title>).*`, String.raw`(?:(?<title>甲)|乙)`]) {
      await expect(analyze('乙', [{ ...prefix, pattern }])).rejects.toThrow('空标题');
    }
  });

  it('reports invalid expressions and structurally invalid rules instead of ignoring them', async () => {
    await expect(analyze('正文', [{ ...prefix, pattern: '[' }])).rejects.toThrow('前置序号');
    await expect(analyze('正文', [{ ...prefix, pattern: '[', enabled: false }])).rejects.toThrow(
      '语法错误',
    );
    expect(() => validateRegexRules([{ ...prefix, pattern: '' }])).toThrow('表达式');
    expect(() => validateRegexRules([{ ...prefix, level: 11 }])).toThrow('层级');
    expect(() => validateRegexRules([prefix, prefix])).toThrow('重复');
    expect(() =>
      validateRegexRules(Array.from({ length: 21 }, (_, i) => ({ ...prefix, id: String(i) }))),
    ).toThrow('20');
  });

  it('merges the original heading text and preserves children, empty deletion and undo', async () => {
    const source = '第一卷 分组\n1.第1章 开端\n正文 A\n2.第2章 空\n3.第3章 末章\n正文 B';
    const initial = await analyze(source);
    const corrected = await buildCorrectedOutline(
      source,
      DEFAULT_RULES,
      { ignored: [4], deleted: [3] },
      60,
      undefined,
      [prefix],
    );
    expect(corrected.outline.sections.map((s) => s.title)).toEqual(['第一卷 分组', '第1章 开端']);
    expect(sectionPreview(corrected.text, corrected.outline.sections[1]).text).toContain(
      '3.第3章 末章\n正文 B',
    );
    expect(corrected.text).not.toContain('2.第2章 空');
    expect(
      (
        await buildCorrectedOutline(
          source,
          DEFAULT_RULES,
          { ignored: [], deleted: [] },
          60,
          undefined,
          [prefix],
        )
      ).outline,
    ).toEqual(initial);
  });

  it('exports extracted titles consistently in XHTML and both navigation formats', async () => {
    const source = '233.第233章 比试 <&>\n正文 <&>😀';
    const files = unzipSync(
      await generateEpub(source, await analyze(source), {
        title: '正则测试',
        author: '',
        language: 'zh-Hans',
      }),
    );
    for (const path of ['OEBPS/text/section-000001.xhtml', 'OEBPS/nav.xhtml', 'OEBPS/toc.ncx']) {
      expect(strFromU8(files[path])).toContain('第233章 比试 &lt;&amp;&gt;');
      expect(strFromU8(files[path])).not.toContain('233.第233章');
    }
    expect(strFromU8(files['OEBPS/text/section-000001.xhtml'])).toContain(
      '<p>正文 &lt;&amp;&gt;😀</p>',
    );
  });
});
