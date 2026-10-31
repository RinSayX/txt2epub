import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
import { generateEpub } from '../../src/core/epub/generate';
import { assertXmlCharacters, removeInvalidXmlControls } from '../../src/core/epub/xml';
import { buildOutline, sectionPreview } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';

const metadata = { title: '控制字符验证', author: '测试作者', language: 'zh-Hans' };

describe('XML control character handling', () => {
  it('removes only XML-forbidden C0 controls, retaining whitespace and all legal Unicode', () => {
    const controls = Array.from({ length: 32 }, (_, code) => String.fromCharCode(code)).join('');
    const legal = '正文 <&> 😀𠀀\t\n\r\u007F\u0085\u200B\u200D\uFEFF\uFFFD';
    expect(removeInvalidXmlControls(controls + legal)).toBe('\t\n\r' + legal);
    expect(
      assertXmlCharacters(controls + legal, '正文', { cleanInvalidControls: true }).controlCount,
    ).toBe(29);
  });

  it('cleans body, XHTML titles and NAV/NCX consistently without changing source or outline ranges', async () => {
    const source =
      '第一卷 卷\u001A\n第一章 标题\u0000\n\u001A　　正文 <&> 😀\t  \n\n下一段\u000B\n\u001A\n　\u0000';
    const outline = await buildOutline(source, DEFAULT_RULES);
    const original = structuredClone(outline);
    const counts: number[] = [];
    const files = unzipSync(
      await generateEpub(source, outline, metadata, undefined, {
        cleanInvalidControls: true,
        onCleaned: (count) => counts.push(count),
      }),
    );
    // Count occurrences in the source once, even though headings appear in several XML files.
    expect(counts).toEqual([6]);
    for (const [path, bytes] of Object.entries(files)) {
      if (/\.(xhtml|ncx|opf|xml)$/.test(path)) {
        const xml = strFromU8(bytes);
        expect(xml).toBe(removeInvalidXmlControls(xml));
        assertXmlCharacters(xml, path);
        expect(() => new DOMParser().parseFromString(xml, 'application/xml')).not.toThrow();
      }
    }
    const chapter = new DOMParser().parseFromString(
      strFromU8(files['OEBPS/text/section-000002.xhtml']),
      'application/xml',
    );
    expect(Array.from(chapter.getElementsByTagName('p')).map((node) => node.textContent)).toEqual([
      '正文 <&> 😀\t  ',
      '\u00A0',
      '下一段',
    ]);
    expect(chapter.getElementsByTagName('h1')[0].textContent).toBe('第一章 标题');
    expect(strFromU8(files['OEBPS/nav.xhtml'])).toContain('第一卷 卷');
    expect(strFromU8(files['OEBPS/toc.ncx'])).toContain('<text>第一章 标题</text>');
    expect(outline).toEqual(original);
    expect(sectionPreview(source, outline.sections[1]).text).toContain('\u001A');
    await expect(generateEpub(source, outline, metadata)).rejects.toThrow('U+001A');
  });

  it('reports full-document line numbers and exact UTF-16 offsets after a chunk boundary', async () => {
    const prefix = '第一章 正文\n' + '正文😀\n'.repeat(15000);
    const source = prefix + '\u001A尾行';
    await expect(
      generateEpub(source, await buildOutline(source, DEFAULT_RULES), metadata),
    ).rejects.toThrow(`正文第 15002 行（字符偏移 ${prefix.length}）`);
  });

  it('preserves surrogate pairs crossing validation chunks and reports zero cleaned characters', async () => {
    const source = '正文'.padEnd(65535, '字') + '😀\n尾段';
    const counts: number[] = [];
    const files = unzipSync(
      await generateEpub(source, await buildOutline(source, DEFAULT_RULES), metadata, undefined, {
        cleanInvalidControls: true,
        onCleaned: (count) => counts.push(count),
      }),
    );
    expect(counts).toEqual([0]);
    expect(strFromU8(files['OEBPS/text/section-000001.xhtml'])).toContain('😀</p>');
  });

  it('continues rejecting damaged Unicode and invalid metadata even when control cleanup is enabled', async () => {
    for (const invalid of ['\uD800', '\uDC00', '\uFFFE', '\uFFFF']) {
      const source = '第一章 故事\n正文' + invalid;
      await expect(
        generateEpub(source, await buildOutline(source, DEFAULT_RULES), metadata, undefined, {
          cleanInvalidControls: true,
        }),
      ).rejects.toThrow('XML 不支持');
    }
    const source = '正文';
    for (const field of ['title', 'author']) {
      await expect(
        generateEpub(
          source,
          await buildOutline(source, DEFAULT_RULES),
          { ...metadata, [field]: '信息\u001A' },
          undefined,
          { cleanInvalidControls: true },
        ),
      ).rejects.toThrow('U+001A');
    }
  });

  it('can cancel control cleanup without reporting a completed cleanup', async () => {
    const counts: number[] = [];
    const source = '正文\u001A'.repeat(30000);
    await expect(
      generateEpub(
        source,
        await buildOutline(source, DEFAULT_RULES),
        metadata,
        async () => {
          throw new Error('cancelled');
        },
        { cleanInvalidControls: true, onCleaned: (count) => counts.push(count) },
      ),
    ).rejects.toThrow('cancelled');
    expect(counts).toEqual([]);
  });
});
