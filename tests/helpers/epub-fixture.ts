import { strToU8, zipSync } from 'fflate';

export const xhtml = (body: string) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>头部标题不应重复导出</title></head><body>${body}</body></html>`;

export function epubFixture(
  options: {
    files?: Record<string, string | Uint8Array>;
    manifest?: string;
    spine?: string;
    guide?: string;
    version?: string;
  } = {},
) {
  const files: Record<string, string | Uint8Array> = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml':
      '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="Book/package.opf" media-type="application/oebps-package+xml" /></rootfiles></container>',
    'Book/package.opf': `<package xmlns="http://www.idpf.org/2007/opf" version="${options.version ?? '3.0'}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>山 &amp; 海</dc:title><dc:creator>某作者</dc:creator><dc:language>zh-CN</dc:language></metadata><manifest>${options.manifest ?? '<item id="one" href="text/one.xhtml" media-type="application/xhtml+xml" />'}</manifest><spine>${options.spine ?? '<itemref idref="one" />'}</spine>${options.guide ?? ''}</package>`,
    'Book/text/one.xhtml': xhtml('<h1>第一章 风</h1><p>正文😀 &amp; 雨</p>'),
    ...options.files,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [
        path,
        typeof data === 'string' ? strToU8(data) : data,
      ]),
    ),
  );
}
