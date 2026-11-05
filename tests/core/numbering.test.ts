import { describe, expect, it } from 'vitest';
import { parseChapterNumber } from '../../src/core/numbering';
import { buildOutline } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';
import { PREFIX_CHAPTER_PATTERN } from '../../src/core/regex';

describe('chapter number parsing', () => {
  it.each([
    ['0', 0],
    ['00233', 233],
    ['２３３', 233],
    ['二〇三', 203],
    ['零零一', 1],
    ['十', 10],
    ['十二', 12],
    ['二十三', 23],
    ['一百零三', 103],
    ['两百', 200],
    ['兩百三十三', 233],
    ['二千零二十', 2020],
    ['一万零一', 10001],
    ['一万二千三百四十五', 12345],
    ['一亿零三万零五', 100030005],
    ['一亿两千万', 120000000],
    ['第233', null],
    ['壹仟贰佰叁拾肆', 1234],
    ['貳萬零陸', 20006],
    ['一 百 零 二', 102],
    ['', null],
    ['二百三', null],
    ['一千二', null],
    ['一万二', null],
    ['十百', null],
    ['一百百', null],
    ['一万万', null],
    ['一百零', null],
    ['一千零零一', null],
    ['12三', null],
    ['-1', null],
    ['零十', null],
    ['零一万', null],
    ['1.5', null],
    ['9007199254740992', null],
  ] as const)('parses %s as %s without guessing ambiguous forms', (raw, expected) => {
    expect(parseChapterNumber(raw)).toBe(expected);
  });

  it('extracts actual chapter numbers behind list prefixes and preserves display titles', async () => {
    const source = '999.第２３３章（上） 比试\n正文\n998.第贰佰叁拾叁章（下） 比试\n正文';
    const result = await buildOutline(source, DEFAULT_RULES, undefined, 60, undefined, [
      {
        id: 'prefix',
        name: '前缀',
        level: 3,
        enabled: true,
        pattern: PREFIX_CHAPTER_PATTERN.replace(
          '零〇一二两三四五六七八九十百千万',
          '零〇一二两三四五六七八九十百千万贰佰叁拾',
        ),
      },
    ]);
    expect(result.sections.map((section) => section.numbering?.value)).toEqual([233, 233]);
    expect(result.sections.map((section) => section.numbering?.part)).toEqual(['上', '下']);
    expect(result.sections[0].title).toBe('第２３３章（上） 比试');
    expect(
      result.sections
        .map((section) => source.slice(section.headingStart, section.bodyEnd))
        .join(''),
    ).toBe(source);
  });

  it('retains a named number even when title extraction removes it; invalid captures do not break recognition', async () => {
    const outline = await buildOutline(
      '233. 比试\n正文\n编号待定. 归来\n正文',
      DEFAULT_RULES,
      undefined,
      60,
      undefined,
      [
        {
          id: 'numeric',
          name: '列表编号',
          level: 3,
          enabled: true,
          pattern: String.raw`^(?<number>[^.]+)\. (?<title>.+)$`,
        },
      ],
    );
    expect(outline.sections.map((section) => section.title)).toEqual(['比试', '归来']);
    expect(outline.sections.map((section) => section.numbering?.value)).toEqual([233, null]);
    expect(outline.sections[0].numbering?.unit).toBe('regex:numeric');
  });

  it('ignores ordinary dates, unnumbered headings and 上山/下雨 words as part markers', async () => {
    const outline = await buildOutline(
      '2026年11月\n序章\n第一章 上山\n第一章 下雨\n尾声',
      DEFAULT_RULES,
    );
    expect(
      outline.sections
        .filter((section) => section.numbering)
        .map((section) => section.numbering?.value),
    ).toEqual([1, 1]);
    expect(outline.sections.every((section) => !section.numbering?.part)).toBe(true);
  });
});
