import type { BookMetadata, Section } from '../types';
import { escapeXml } from './xml';

const XHTML = 'http://www.w3.org/1999/xhtml';
const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';

export interface EpubDocument {
  id: string;
  path: string;
}

export function renderXhtml(title: string, content: string[], language: string): string {
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

export function renderNavigation(
  sections: Section[],
  targets: Map<string, string>,
  ncx: boolean,
  depth: number,
): string {
  const children = new Map<string | null, Section[]>();
  for (const section of sections) {
    const group = children.get(section.parentId) ?? [];
    group.push(section);
    children.set(section.parentId, group);
  }
  let order = 0;
  const render = (parent: string | null, depth: number): string[] =>
    (children.get(parent) ?? []).flatMap((section) => {
      const index = ++order;
      const indent = '  '.repeat(depth);
      const target = escapeXml(targets.get(section.id)!);
      const title = escapeXml(section.title);
      const subtree = render(section.id, depth + (ncx ? 1 : 2));
      return ncx
        ? [
            `${indent}<navPoint id="nav-${index}" playOrder="${index}">`,
            `${indent}  <navLabel>`,
            `${indent}    <text>${title}</text>`,
            `${indent}  </navLabel>`,
            `${indent}  <content src="${target}" />`,
            ...subtree,
            `${indent}</navPoint>`,
          ]
        : [
            `${indent}<li>`,
            `${indent}  <a href="${target}">${title}</a>`,
            ...(subtree.length ? [`${indent}  <ol>`, ...subtree, `${indent}  </ol>`] : []),
            `${indent}</li>`,
          ];
    });
  return render(null, depth).join('\n');
}

export function renderContainer(): string {
  return [
    xmlHeader,
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />',
    '  </rootfiles>',
    '</container>',
    '',
  ].join('\n');
}

export function renderNavigationDocument(language: string, nav: string): string {
  return [
    xmlHeader,
    '<!DOCTYPE html>',
    `<html xmlns="${XHTML}" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">`,
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
  ].join('\n');
}

export function renderNcx(sections: Section[], uid: string, title: string, ncx: string): string {
  return [
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
  ].join('\n');
}

export function renderPackage(
  metadata: BookMetadata,
  title: string,
  uid: string,
  modified: string,
  documents: EpubDocument[],
): string {
  return [
    xmlHeader,
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(metadata.language)}">`,
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `    <dc:identifier id="book-id">${uid}</dc:identifier>`,
    `    <dc:title>${escapeXml(title)}</dc:title>`,
    `    <dc:language>${escapeXml(metadata.language)}</dc:language>`,
    ...(metadata.author.trim()
      ? [`    <dc:creator>${escapeXml(metadata.author.trim())}</dc:creator>`]
      : []),
    `    <meta property="dcterms:modified">${modified}</meta>`,
    '  </metadata>',
    '  <manifest>',
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />',
    '    <item id="css" href="styles/book.css" media-type="text/css" />',
    ...documents.map(
      (doc) => `    <item id="${doc.id}" href="${doc.path}" media-type="application/xhtml+xml" />`,
    ),
    '  </manifest>',
    '  <spine toc="ncx">',
    ...documents.map((doc) => `    <itemref idref="${doc.id}" />`),
    '  </spine>',
    '</package>',
    '',
  ].join('\n');
}

export const BOOK_STYLES = [
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
].join('\n');
