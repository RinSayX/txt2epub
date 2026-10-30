import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { BookMetadata, Checkpoint, Outline, Section } from './types';
import { chapterContentEnd, stripParagraphIndent } from './paragraphs';

const XHTML = 'http://www.w3.org/1999/xhtml';
const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
const SPLIT_SIZE = 250 * 1024;
export const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

export function assertXmlCharacters(text: string, label: string): void {
  let line = 1;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code === 10) line++;
    if (!((code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff) || [9, 10, 13].includes(code))) {
      throw new Error(`${label}第 ${line} 行包含 XML 不支持的字符 U+${code.toString(16).toUpperCase().padStart(4, '0')}。请修正源文件后重试，正文未被自动删除。`);
    }
  }
}

function xhtml(title: string, content: string[], language: string): string {
  // Indent between elements only. Whitespace inside a paragraph is book content.
  return [
    xmlHeader,
    '<!DOCTYPE html>',
    `<html xmlns="${XHTML}" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">`,
    '  <head>',
    `    <title>${escapeXml(title)}</title>`,
    '    <link rel="stylesheet" type="text/css" href="../styles/book.css" />',
    '  </head>',
    '  <body>',
    ...content.map((element) => `    ${element}`),
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

function navigation(sections: Section[], targets: Map<string, string>, ncx: boolean, depth: number): string {
  const children = new Map<string | null, Section[]>();
  for (const section of sections) {
    const group = children.get(section.parentId) ?? [];
    group.push(section);
    children.set(section.parentId, group);
  }
  let order = 0;
  const render = (parent: string | null, depth: number): string[] => (children.get(parent) ?? []).flatMap((section) => {
    const index = ++order;
    const indent = '  '.repeat(depth);
    const target = escapeXml(targets.get(section.id)!);
    const title = escapeXml(section.title);
    const subtree = render(section.id, depth + (ncx ? 1 : 2));
    return ncx ? [
      `${indent}<navPoint id="nav-${index}" playOrder="${index}">`,
      `${indent}  <navLabel>`,
      `${indent}    <text>${title}</text>`,
      `${indent}  </navLabel>`,
      `${indent}  <content src="${target}" />`,
      ...subtree,
      `${indent}</navPoint>`,
    ] : [
      `${indent}<li>`,
      `${indent}  <a href="${target}">${title}</a>`,
      ...(subtree.length ? [`${indent}  <ol>`, ...subtree, `${indent}  </ol>`] : []),
      `${indent}</li>`,
    ];
  });
  return render(null, depth).join('\n');
}

export async function generateEpub(
  text: string,
  outline: Outline,
  metadata: BookMetadata,
  checkpoint: Checkpoint = async () => {},
): Promise<Uint8Array> {
  const title = metadata.title.trim();
  if (!title) throw new Error('请填写书名后再导出。');
  if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(metadata.language)) throw new Error('请选择有效的书籍语言。');
  assertXmlCharacters(title, '书名');
  assertXmlCharacters(metadata.author, '作者');
  // Yield while validating, so even unusual files can be cancelled.
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + 65536);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    assertXmlCharacters(text.slice(start, end), `正文（字符偏移 ${start} 起）`);
    start = end;
    await checkpoint(0.04 * start / Math.max(1, text.length));
  }
  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const chunks: Uint8Array[] = [];
  let zipError: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) zipError = error;
    else chunks.push(chunk);
  });
  const add = async (path: string, content: string, store = false) => {
    if (zipError) throw zipError;
    const entry = store ? new ZipPassThrough(path) : new ZipDeflate(path, { level: 6 });
    zip.add(entry);
    const data = strToU8(content);
    // Avoid a long compression task for exceptionally large single paragraphs.
    for (let start = 0; start < data.length; start += 65536) {
      entry.push(data.subarray(start, start + 65536), start + 65536 >= data.length);
      if (data.length > 1024 * 1024 && start % (1024 * 1024) === 0) await checkpoint(0.9);
    }
    if (!data.length) entry.push(data, true);
  };
  await add('mimetype', 'application/epub+zip', true);
  await add('META-INF/container.xml', [
    xmlHeader,
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />',
    '  </rootfiles>',
    '</container>',
    '',
  ].join('\n'));
  await add('OEBPS/styles/book.css', [
    'body {',
    '  font-family: serif;',
    '  line-height: 1.85;',
    '  margin: 0 5%;',
    '}',
    '',
    'h1 {',
    '  font-size: 1.5em;',
    '  line-height: 1.5;',
    '  margin: 1.5em 0;',
    '}',
    '',
    'p {',
    '  margin: 0;',
    '  text-indent: 0;',
    '  white-space: pre-wrap;',
    '  overflow-wrap: break-word;',
    '}',
    '',
    '.blank {',
    '  min-height: 1em;',
    '}',
    '',
    'nav ol {',
    '  list-style: none;',
    '  padding-left: 1.3em;',
    '}',
    '',
  ].join('\n'));

  const targets = new Map<string, string>();
  const documents: { id: string; path: string }[] = [];
  for (let i = 0; i < outline.sections.length; i++) {
    const section = outline.sections[i];
    const sectionTitle = outline.headingCount === 0 ? title : section.title;
    let parts: string[] = [];
    let size = 0;
    let part = 0;
    const flush = async () => {
      const id = `section-${String(documents.length + 1).padStart(6, '0')}`;
      const path = `text/${id}.xhtml`;
      if (part === 0) targets.set(section.id, `${path}#heading`);
      await add(`OEBPS/${path}`, xhtml(sectionTitle, [
        ...(part === 0 ? [`<h1 id="heading">${escapeXml(sectionTitle)}</h1>`] : []),
        ...parts,
      ], metadata.language));
      documents.push({ id, path });
      parts = []; size = 0; part++;
    };
    let position = section.bodyStart;
    const contentEnd = chapterContentEnd(text, section.bodyStart, section.bodyEnd);
    let lines = 0;
    while (position < contentEnd) {
      const newline = text.indexOf('\n', position);
      const end = newline < 0 || newline >= contentEnd ? contentEnd : newline;
      const line = stripParagraphIndent(text.slice(position, end));
      const html = line.length ? `<p>${escapeXml(line)}</p>` : '<p class="blank">&#160;</p>';
      const bytes = strToU8(html).length + 5; // Four indentation spaces and one LF.
      if (size + bytes > SPLIT_SIZE && parts.length) await flush();
      parts.push(html); size += bytes;
      position = end < contentEnd ? end + 1 : contentEnd;
      if (++lines % 1000 === 0) await checkpoint(0.04 + 0.86 * (i + (position - section.bodyStart) / Math.max(1, section.bodyEnd - section.bodyStart)) / outline.sections.length);
    }
    if (parts.length || part === 0) await flush();
    await checkpoint(0.04 + 0.86 * (i + 1) / outline.sections.length);
  }
  const sections = outline.sections.map((section) => outline.headingCount === 0 ? { ...section, title } : section);
  const nav = navigation(sections, targets, false, 4);
  const ncx = navigation(sections, targets, true, 2);
  await add('OEBPS/nav.xhtml', [
    xmlHeader,
    '<!DOCTYPE html>',
    `<html xmlns="${XHTML}" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(metadata.language)}" lang="${escapeXml(metadata.language)}">`,
    '  <head>',
    '    <title>目录</title>',
    '  </head>',
    '  <body>',
    '    <nav epub:type="toc" id="toc">',
    '      <h1>目录</h1>',
    '      <ol>',
    nav,
    '      </ol>',
    '    </nav>',
    '  </body>',
    '</html>',
    '',
  ].join('\n'));
  await add('OEBPS/toc.ncx', [
    xmlHeader,
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">',
    '  <head>',
    `    <meta name="dtb:uid" content="${uid}" />`,
    `    <meta name="dtb:depth" content="${sections.reduce((depth, section) => Math.max(depth, section.depth + 1), 1)}" />`,
    '    <meta name="dtb:totalPageCount" content="0" />',
    '    <meta name="dtb:maxPageNumber" content="0" />',
    '  </head>',
    '  <docTitle>',
    `    <text>${escapeXml(title)}</text>`,
    '  </docTitle>',
    '  <navMap>',
    ncx,
    '  </navMap>',
    '</ncx>',
    '',
  ].join('\n'));
  await add('OEBPS/content.opf', [
    xmlHeader,
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(metadata.language)}">`,
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `    <dc:identifier id="book-id">${uid}</dc:identifier>`,
    `    <dc:title>${escapeXml(title)}</dc:title>`,
    `    <dc:language>${escapeXml(metadata.language)}</dc:language>`,
    ...(metadata.author.trim() ? [`    <dc:creator>${escapeXml(metadata.author.trim())}</dc:creator>`] : []),
    `    <meta property="dcterms:modified">${modified}</meta>`,
    '  </metadata>',
    '  <manifest>',
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />',
    '    <item id="css" href="styles/book.css" media-type="text/css" />',
    ...documents.map((doc) => `    <item id="${doc.id}" href="${doc.path}" media-type="application/xhtml+xml" />`),
    '  </manifest>',
    '  <spine toc="ncx">',
    ...documents.map((doc) => `    <itemref idref="${doc.id}" />`),
    '  </spine>',
    '</package>',
    '',
  ].join('\n'));
  await checkpoint(0.96);
  zip.end();
  if (zipError) throw zipError;
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  await checkpoint(1);
  return result;
}
