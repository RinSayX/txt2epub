import { describe, expect, it } from 'vitest';
import { buildOutline, sectionPreview, validateRules } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';

describe('chapter identification and corrections', () => {
  it('supports missing hierarchy levels, number forms and literal custom keywords', async () => {
    const outline = await buildOutline(
      '第一卷 风\n\n第１２章 雨\n内容\n第一章 夜\n第2篇+ 归来\n正文',
      [
        ...DEFAULT_RULES,
        { id: 'custom', keyword: '篇+', level: 2, kind: 'numbered', enabled: true },
      ],
    );
    expect(
      outline.sections.map((section) => [section.title, section.depth, section.parentId]),
    ).toEqual([
      ['第一卷 风', 0, null],
      ['第１２章 雨', 1, 'line-0'],
      ['第一章 夜', 1, 'line-0'],
      ['第2篇+ 归来', 1, 'line-0'],
    ]);
  });
  it('requires independent unnumbered headings with an optional explicit delimiter', async () => {
    const outline = await buildOutline(
      '楔子\n故事\n番外的故事尚未开始\n他读到了第十二章\n番外：重逢\n结束',
      DEFAULT_RULES,
    );
    expect(outline.sections.map((section) => section.title)).toEqual(['楔子', '番外：重逢']);
  });
  it('preserves the dismissed heading as body and reparents its children', async () => {
    const text = '第一卷 开端\n第一章 相逢\n正文 A\n第二卷 正文引用\n正文 B\n第二章 夜雨\n正文 C';
    const initial = await buildOutline(text, DEFAULT_RULES);
    expect(initial.sections.at(-1)?.parentId).toBe('line-3');
    const merged = await buildOutline(text, DEFAULT_RULES, new Set([3]));
    expect(merged.sections.map((section) => section.title)).toEqual([
      '第一卷 开端',
      '第一章 相逢',
      '第二章 夜雨',
    ]);
    expect(merged.sections.at(-1)?.parentId).toBe('line-0');
    expect(sectionPreview(text, merged.sections[1]).text).toBe('正文 A\n第二卷 正文引用\n正文 B');
    expect(await buildOutline(text, DEFAULT_RULES)).toEqual(initial);
  });
  it('supports first-heading dismissal, consecutive merges and rule reapplication without losing text', async () => {
    const text = '第一章 标题\n  第一行  \n第二章 引用\n\n第三章 引用\n终行';
    const ignored = new Set([0, 2, 4]);
    const outline = await buildOutline(text, DEFAULT_RULES, ignored);
    expect(outline.headingCount).toBe(0);
    expect(outline.sections).toHaveLength(1);
    expect(sectionPreview(text, outline.sections[0]).text).toBe(text.replace('  第一行', '第一行'));
    const revisedRules = DEFAULT_RULES.map((rule) => ({ ...rule, level: rule.level + 1 }));
    expect((await buildOutline(text, revisedRules, ignored)).headingCount).toBe(0);
  });
  it('uses nonoverlapping source ranges and preserves preface, whitespace and every character', async () => {
    const text = '　前言\n\n第一卷 天\n引言\n\n第一章 雨\n　正文 <&>\n\n第二章 风\n尾行\n';
    const outline = await buildOutline(text, DEFAULT_RULES);
    const reconstructed = outline.sections
      .map((section) => {
        const heading = text.slice(section.headingStart, section.bodyStart);
        return heading + text.slice(section.bodyStart, section.bodyEnd);
      })
      .join('');
    expect(reconstructed).toBe(text);
    expect(outline.sections[0].title).toBe('前言');
    expect(outline.sections[1].bodyEnd).toBe(outline.sections[2].headingStart);
  });
  it('keeps source order, supports sibling aliases and never invents absent levels', async () => {
    const rules = DEFAULT_RULES.map((rule) =>
      rule.keyword === '回' ? { ...rule, level: 3 } : rule,
    );
    const outline = await buildOutline(
      '第一卷 甲\n第9章 九\n第2回 二\n第二卷 乙\n第一章 一',
      rules,
    );
    expect(outline.sections.map((section) => section.depth)).toEqual([0, 1, 1, 0, 1]);
    expect(outline.sections[2].parentId).toBe('line-0');
    expect(outline.sections[4].parentId).toBe('line-3');
  });
  it('bounds title length by Unicode code points', async () => {
    const text = '第一章 😀😀\n正文\n第二章 ' + '长'.repeat(70);
    expect((await buildOutline(text, DEFAULT_RULES, new Set(), 6)).headingCount).toBe(1);
  });
  it('rejects invalid and conflicting rules', () => {
    expect(() => validateRules([...DEFAULT_RULES, DEFAULT_RULES[0]], 60)).toThrow('重复');
    expect(() => validateRules([{ ...DEFAULT_RULES[0], level: 0 }], 60)).toThrow('层级');
    expect(() => validateRules(DEFAULT_RULES, Number.NaN)).toThrow('标题长度');
    expect(() => validateRules([{ ...DEFAULT_RULES[0], keyword: ' 卷' }], 60)).toThrow('关键词');
  });
  it('pages a long preview without dropping or duplicating surrogate pairs', async () => {
    const text = '第一章 长文\n' + '雨😀'.repeat(14000);
    const { sections } = await buildOutline(text, DEFAULT_RULES);
    let offset: number | null = 0;
    let result = '';
    while (offset !== null) {
      const page = sectionPreview(text, sections[0], offset, 5000);
      result += page.text;
      offset = page.nextOffset;
    }
    expect(result).toBe(text.slice(sections[0].bodyStart));
  });
  it('cleans preview indentation and chapter endings while preserving internal blank lines and original source ranges', async () => {
    const text =
      '第一章 风\n　　首段  内部空格  \n\n \t\n\t　二段\t内\t \n\n　\t\n第二章 雨\n  尾段\n\n';
    const { sections } = await buildOutline(text, DEFAULT_RULES);
    expect(sectionPreview(text, sections[0]).text).toBe('首段  内部空格  \n\n\n二段\t内\t ');
    expect(sectionPreview(text, sections[1]).text).toBe('尾段');
    expect(text.slice(sections[0].bodyStart, sections[0].bodyEnd)).toBe(
      '　　首段  内部空格  \n\n \t\n\t　二段\t内\t \n\n　\t\n',
    );
    const blank = '第一卷 空卷\n \t　\n\n';
    const blankSection = (await buildOutline(blank, DEFAULT_RULES)).sections[0];
    expect(sectionPreview(blank, blankSection)).toEqual({
      text: '',
      nextOffset: null,
      totalCharacters: 0,
    });
  });
  it('cleans paginated paragraphs without treating a mid-paragraph page boundary as indentation', async () => {
    for (const [body, expected, limit] of [
      [
        'a'.repeat(4998) + '   内部空格' + '雨'.repeat(5000) + '\n\t　新段\n\n',
        'a'.repeat(4998) + '   内部空格' + '雨'.repeat(5000) + '\n新段',
        5000,
      ],
      [' '.repeat(40) + '正文'.repeat(1000), '正文'.repeat(1000), 20],
    ] as const) {
      const source = `第一章 长文\n${body}`;
      const section = (await buildOutline(source, DEFAULT_RULES)).sections[0];
      let offset: number | null = 0;
      let result = '';
      while (offset !== null) {
        const page = sectionPreview(source, section, offset, limit);
        result += page.text;
        offset = page.nextOffset;
      }
      expect(result).toBe(expected);
    }
  });
  it('can cancel analysis before producing a new outline', async () => {
    await expect(
      buildOutline('正文\n'.repeat(5000), DEFAULT_RULES, new Set(), 60, async () => {
        throw new Error('cancelled');
      }),
    ).rejects.toThrow('cancelled');
  });
});
