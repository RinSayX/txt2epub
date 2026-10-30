import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { strFromU8, unzipSync } from 'fflate';
import { generateEpub } from '../src/core/epub';
import { buildOutline } from '../src/core/outline';
import { DEFAULT_RULES } from '../src/core/types';

const metadata = { title: '风 & 雨 <故事>', author: '某某 "作者"', language: 'zh-Hans' };
const text = '前言\n\n第一卷 山\n卷首说明\n第一章 风\n　正文 <tag> & "引号"\n\n次行😀\n第二卷 引用。\n引用的下文\n第二章 雨\n结束';

describe('EPUB3 export', () => {
  it('formats chapter markup, removes indentation and keeps interior/trailing spaces and escaped text', async () => {
    const paragraphs = [' \t　正文 <tag> & "引号"  ', '', '\t行内   空格　与制表符\t ', '<script>alert("正文")</script>', '尾行😀'];
    const source = `第一章 风雨\n${paragraphs.join('\n')}`;
    const files = unzipSync(await generateEpub(source, await buildOutline(source, DEFAULT_RULES), metadata));
    const chapter = strFromU8(files['OEBPS/text/section-000001.xhtml']);
    const document = new DOMParser().parseFromString(chapter, 'application/xml');
    expect(chapter).toContain('\n  <head>\n    <title>');
    expect(chapter).toContain('\n  <body>\n    <h1 id="heading">第一章 风雨</h1>\n');
    expect(chapter.split('\n').filter((line) => line.startsWith('    <p'))).toHaveLength(paragraphs.length);
    expect(chapter.endsWith('\n  </body>\n</html>\n')).toBe(true);
    expect(Array.from(document.getElementsByTagName('p')).map((paragraph) => paragraph.textContent)).toEqual(['正文 <tag> & "引号"  ', '\u00A0', '行内   空格　与制表符\t ', '<script>alert("正文")</script>', '尾行😀']);
    expect(document.getElementsByTagName('tag')).toHaveLength(0);
    expect(document.getElementsByTagName('script')).toHaveLength(0);
  });
  it('indents nested NAV/NCX entries and emits readable package, container and stylesheet files', async () => {
    const source = '第一卷 卷\n第一册 册\n第一章 章\n正文';
    const files = unzipSync(await generateEpub(source, await buildOutline(source, DEFAULT_RULES), metadata));
    const nav = strFromU8(files['OEBPS/nav.xhtml']);
    const ncx = strFromU8(files['OEBPS/toc.ncx']);
    expect(nav).toContain('\n      <ol>\n        <li>\n          <a ');
    expect(nav).toContain('\n          <ol>\n            <li>\n              <a ');
    expect(nav).toContain('\n              <ol>\n                <li>\n                  <a ');
    expect(ncx).toContain('\n  <navMap>\n    <navPoint ');
    expect(ncx).toContain('\n      <navPoint ');
    expect(ncx).toContain('\n        <navPoint ');
    expect(strFromU8(files['OEBPS/content.opf'])).toContain('\n  <manifest>\n    <item ');
    expect(strFromU8(files['META-INF/container.xml'])).toContain('\n  <rootfiles>\n    <rootfile ');
    expect(strFromU8(files['OEBPS/styles/book.css'])).toContain('p {\n  margin: 0;\n  text-indent: 0;\n  white-space: pre-wrap;\n');
    for (const [path, bytes] of Object.entries(files)) {
      if (/\.(xhtml|xml|ncx|opf|css)$/.test(path)) expect(strFromU8(bytes).endsWith('\n')).toBe(true);
    }
  });
  it('omits every trailing blank paragraph, keeps interior blank lines and leaves empty grouping sections without body paragraphs', async () => {
    const source = '第一卷 山\n \t　\n第一章 风\n　　首段  内部空格  \n\n \t\n\t　二段\t \n\n \t　\n第二章 雨\n  尾段\n\n第三章 空\n　 \t\n\n';
    const files = unzipSync(await generateEpub(source, await buildOutline(source, DEFAULT_RULES), metadata));
    const paragraphs = Object.entries(files).filter(([path]) => path.startsWith('OEBPS/text/')).map(([, bytes]) => {
      const document = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
      return Array.from(document.getElementsByTagName('p')).map((paragraph) => paragraph.textContent);
    });
    expect(paragraphs).toEqual([[], ['首段  内部空格  ', '\u00A0', '\u00A0', '二段\t '], ['尾段'], []]);
  });
  it('writes the required first uncompressed mimetype with no extra fields or BOM', async () => {
    const outline = await buildOutline(text, DEFAULT_RULES);
    const bytes = await generateEpub(text, outline, metadata);
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(header.getUint32(0, true)).toBe(0x04034b50);
    expect(header.getUint16(8, true)).toBe(0);
    expect(header.getUint16(28, true)).toBe(0);
    const nameLength = header.getUint16(26, true);
    expect(strFromU8(bytes.subarray(30, 30 + nameLength))).toBe('mimetype');
    expect(strFromU8(unzipSync(bytes).mimetype)).toBe('application/epub+zip');
  });
  it('generates well-formed XML, preserves special characters and resolves every manifest/nav/spine reference', async () => {
    const outline = await buildOutline(text, DEFAULT_RULES, new Set([8]));
    const files = unzipSync(await generateEpub(text, outline, metadata));
    const parsed = new Map<string, Document>();
    for (const [path, data] of Object.entries(files)) {
      if (!/\.(xml|opf|ncx|xhtml)$/.test(path)) continue;
      const document = new DOMParser().parseFromString(strFromU8(data), 'application/xml');
      expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
      parsed.set(path, document as unknown as Document);
    }
    const opf = parsed.get('OEBPS/content.opf')!;
    expect(opf.documentElement.getAttribute('version')).toBe('3.0');
    expect(opf.getElementsByTagName('dc:title')[0].textContent).toBe(metadata.title);
    const items = [...Array.from(opf.getElementsByTagName('item'))];
    const ids = new Set(items.map((item) => item.getAttribute('id')));
    for (const item of items) expect(files[`OEBPS/${item.getAttribute('href')}`]).toBeDefined();
    for (const reference of Array.from(opf.getElementsByTagName('itemref'))) expect(ids.has(reference.getAttribute('idref'))).toBe(true);
    const nav = parsed.get('OEBPS/nav.xhtml')!;
    const ncx = parsed.get('OEBPS/toc.ncx')!;
    const navLinks = Array.from(nav.getElementsByTagName('a')).map((anchor) => anchor.getAttribute('href'));
    const ncxLinks = Array.from(ncx.getElementsByTagName('content')).map((content) => content.getAttribute('src'));
    expect(navLinks).toEqual(ncxLinks);
    expect(navLinks).toHaveLength(outline.sections.length);
    for (const href of navLinks) {
      const [path, fragment] = href!.split('#');
      const doc = parsed.get(`OEBPS/${path}`)!;
      expect(Array.from(doc.getElementsByTagName('h1')).some((heading) => heading.getAttribute('id') === fragment)).toBe(true);
    }
    const chapter = [...parsed.entries()].find(([, doc]) => doc.getElementsByTagName('h1')[0]?.textContent === '第一章 风')![1];
    expect(chapter.getElementsByTagName('p')[0].textContent).toBe('正文 <tag> & "引号"');
    expect(chapter.getElementsByTagName('p')[1].getAttribute('class')).toBe('blank');
    expect(chapter.documentElement.textContent).toContain('第二卷 引用。');
    expect(chapter.documentElement.textContent).toContain('引用的下文');
    expect(Array.from(ncx.getElementsByTagName('navPoint')).map((point) => point.getAttribute('playOrder'))).toEqual(outline.sections.map((_, index) => String(index + 1)));
  });
  it('splits long chapters into spine parts while keeping a single directory entry and all paragraphs', async () => {
    const paragraphs = Array.from({ length: 2500 }, (_, index) => `${index} ` + '山河风雨'.repeat(30));
    const source = `第一章 长篇\n${paragraphs.join('\n')}\n\n \t　\n`;
    const outline = await buildOutline(source, DEFAULT_RULES);
    const files = unzipSync(await generateEpub(source, outline, metadata));
    const paths = Object.keys(files).filter((path) => path.startsWith('OEBPS/text/'));
    expect(paths.length).toBeGreaterThan(1);
    const result = paths.flatMap((path) => Array.from(new DOMParser().parseFromString(strFromU8(files[path]), 'application/xml').getElementsByTagName('p')).map((paragraph) => paragraph.textContent));
    expect(result).toEqual(paragraphs);
    const nav = new DOMParser().parseFromString(strFromU8(files['OEBPS/nav.xhtml']), 'application/xml');
    expect(nav.getElementsByTagName('a')).toHaveLength(1);
  });
  it('uses the book title for unstructured text and does not invent an author', async () => {
    const source = '只有正文\n　没有章节的小说';
    const files = unzipSync(await generateEpub(source, await buildOutline(source, DEFAULT_RULES), { ...metadata, author: '' }));
    expect(strFromU8(files['OEBPS/content.opf'])).not.toContain('dc:creator');
    expect(new DOMParser().parseFromString(strFromU8(files['OEBPS/text/section-000001.xhtml']), 'application/xml').getElementsByTagName('h1')[0].textContent).toBe(metadata.title);
  });
  it('rejects XML-invalid characters and incomplete metadata without silently changing text', async () => {
    const source = '第一章 风\n正文\u0001';
    await expect(generateEpub(source, await buildOutline(source, DEFAULT_RULES), metadata)).rejects.toThrow('U+0001');
    await expect(generateEpub(text, await buildOutline(text, DEFAULT_RULES), { ...metadata, title: ' ' })).rejects.toThrow('书名');
    await expect(generateEpub(text, await buildOutline(text, DEFAULT_RULES), { ...metadata, language: '<script>' })).rejects.toThrow('语言');
  });
  it('can cancel generation cooperatively', async () => {
    await expect(generateEpub(text, await buildOutline(text, DEFAULT_RULES), metadata, async () => { throw new Error('cancelled'); })).rejects.toThrow('cancelled');
  });
});
