import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { BookMetadata, Checkpoint, Outline } from '../types';
import { chapterContentEnd, stripParagraphIndent } from '../paragraphs';
import {
  assertXmlCharacters,
  escapeXml,
  isInvalidXmlControl,
  removeInvalidXmlControls,
} from './xml';
import {
  BOOK_STYLES,
  renderContainer,
  renderNavigation,
  renderNavigationDocument,
  renderNcx,
  renderPackage,
  renderXhtml,
  type EpubDocument,
} from './templates';

const SPLIT_SIZE = 250 * 1024;

export interface EpubExportOptions {
  cleanInvalidControls?: boolean;
  removeBlankLines?: boolean;
  onCleaned?: (count: number) => void;
}

export async function generateEpub(
  text: string,
  outline: Outline,
  metadata: BookMetadata,
  checkpoint: Checkpoint = async () => {},
  options: EpubExportOptions = {},
): Promise<Uint8Array> {
  const title = metadata.title.trim();
  if (!title) throw new Error('请填写书名后再导出。');
  if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(metadata.language))
    throw new Error('请选择有效的书籍语言。');
  assertXmlCharacters(title, '书名');
  assertXmlCharacters(metadata.author, '作者');
  let line = 1;
  let controlCount = 0;
  const clean = options.cleanInvalidControls ? removeInvalidXmlControls : (value: string) => value;
  // Yield while validating, so even unusual files can be cancelled.
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + 65536);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    const checked = assertXmlCharacters(text.slice(start, end), '正文', {
      startLine: line,
      startOffset: start,
      cleanInvalidControls: options.cleanInvalidControls,
    });
    line = checked.nextLine;
    controlCount += checked.controlCount;
    start = end;
    await checkpoint((0.04 * start) / Math.max(1, text.length));
  }
  const sections = outline.sections.map((section) => {
    const sectionTitle = outline.headingCount === 0 ? title : clean(section.title);
    assertXmlCharacters(sectionTitle, '章节标题');
    return { ...section, title: sectionTitle };
  });
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
  await add('META-INF/container.xml', renderContainer());
  await add('OEBPS/styles/book.css', BOOK_STYLES);

  const targets = new Map<string, string>();
  const documents: EpubDocument[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionTitle = section.title;
    let parts: string[] = [];
    let size = 0;
    let part = 0;
    const flush = async () => {
      const id = `section-${String(documents.length + 1).padStart(6, '0')}`;
      const path = `text/${id}.xhtml`;
      if (part === 0) targets.set(section.id, `${path}#heading`);
      await add(
        `OEBPS/${path}`,
        renderXhtml(
          sectionTitle,
          [...(part === 0 ? [`<h1 id="heading">${escapeXml(sectionTitle)}</h1>`] : []), ...parts],
          metadata.language,
        ),
      );
      documents.push({ id, path });
      parts = [];
      size = 0;
      part++;
    };
    let position = section.bodyStart;
    const contentEnd = chapterContentEnd(
      text,
      section.bodyStart,
      section.bodyEnd,
      options.cleanInvalidControls ? isInvalidXmlControl : undefined,
    );
    let lines = 0;
    while (position < contentEnd) {
      const newline = text.indexOf('\n', position);
      const end = newline < 0 || newline >= contentEnd ? contentEnd : newline;
      const line = stripParagraphIndent(clean(text.slice(position, end)));
      if (line.length || !options.removeBlankLines) {
        const html = line.length ? `<p>${escapeXml(line)}</p>` : '<p class="blank">&#160;</p>';
        const bytes = strToU8(html).length + 5; // Four indentation spaces and one LF.
        if (size + bytes > SPLIT_SIZE && parts.length) await flush();
        parts.push(html);
        size += bytes;
      }
      position = end < contentEnd ? end + 1 : contentEnd;
      if (++lines % 1000 === 0)
        await checkpoint(
          0.04 +
            (0.86 *
              (i +
                (position - section.bodyStart) /
                  Math.max(1, section.bodyEnd - section.bodyStart))) /
              outline.sections.length,
        );
    }
    if (parts.length || part === 0) await flush();
    await checkpoint(0.04 + (0.86 * (i + 1)) / outline.sections.length);
  }
  const nav = renderNavigation(sections, targets, false, 4);
  const ncx = renderNavigation(sections, targets, true, 2);
  await add('OEBPS/nav.xhtml', renderNavigationDocument(metadata.language, nav));
  await add('OEBPS/toc.ncx', renderNcx(sections, uid, title, ncx));
  await add('OEBPS/content.opf', renderPackage(metadata, title, uid, modified, documents));
  await checkpoint(0.96);
  zip.end();
  if (zipError) throw zipError;
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  await checkpoint(1);
  options.onCleaned?.(controlCount);
  return result;
}
