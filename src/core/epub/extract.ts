import { DOMParser, type Document, type Element, type Node } from '@xmldom/xmldom';
import { unzipSync } from 'fflate';
import type { BookMetadata, Checkpoint } from '../types';

const OPF = 'http://www.idpf.org/2007/opf';
const DC = 'http://purl.org/dc/elements/1.1/';
const OPS = 'http://www.idpf.org/2007/ops';
const XHTML = 'http://www.w3.org/1999/xhtml';
const BLOCKS = new Set(
  'address article aside blockquote dd div dl dt figcaption figure footer h1 h2 h3 h4 h5 h6 header hr li main ol p section table tr ul'.split(
    ' ',
  ),
);
const OMIT = new Set('head script style iframe object svg img audio video canvas nav'.split(' '));

export interface ExtractedEpub {
  metadata: BookMetadata;
  text: string;
  documentCount: number;
  skippedCount: number;
}

/** Resolve publication URLs inside the archive only; never fetch external resources. */
function archivePath(base: string, href: string): string {
  let path: string;
  try {
    path = decodeURIComponent(href.split(/[?#]/, 1)[0]);
  } catch {
    throw new Error(`EPUB 资源路径编码无效：${href}`);
  }
  if (!path && base && /^[#?]/.test(href)) return base;
  if (!path || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || /[\\\x00]/.test(path))
    throw new Error(`EPUB 包含无法读取的资源路径：${href}`);
  const parts = path.startsWith('/') ? [] : base.split('/').slice(0, -1);
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error(`EPUB 资源路径超出书籍范围：${href}`);
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

function readEntries(bytes: Uint8Array, wanted: Set<string>): Record<string, Uint8Array> {
  const seen = new Set<string>();
  try {
    return unzipSync(bytes, {
      filter: ({ name }) => {
        if (!wanted.has(name)) return false;
        if (seen.has(name)) throw new Error(`重复的 EPUB 资源：${name}`);
        seen.add(name);
        return true;
      },
    });
  } catch (error) {
    throw new Error(
      `无法解压 EPUB，文件可能损坏或受到加密保护。${error instanceof Error ? `（${error.message}）` : ''}`,
    );
  }
}

function parseXml(bytes: Uint8Array | undefined, path: string, xhtml = false): Document {
  if (!bytes) throw new Error(`EPUB 缺少资源：${path}`);
  try {
    // EPUB XML resources use UTF-8 or UTF-16. TextDecoder handles their BOMs explicitly.
    const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0x3c && bytes[1] === 0);
    const bigEndian =
      (bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0 && bytes[1] === 0x3c);
    const text = new TextDecoder(utf16 ? 'utf-16le' : bigEndian ? 'utf-16be' : 'utf-8', {
      fatal: true,
    }).decode(bytes);
    return new DOMParser({
      onError: (level) => {
        if (level !== 'warning') throw new Error('无效的 XML');
      },
    }).parseFromString(text, xhtml ? 'application/xhtml+xml' : 'application/xml');
  } catch {
    throw new Error(`EPUB 资源无法解析：${path}。请检查文件是否损坏、加密或使用了无效的 XHTML。`);
  }
}

function elements(document: Document | Element, namespace: string, name: string): Element[] {
  return Array.from(document.getElementsByTagNameNS(namespace, name));
}

function types(element: Element): string[] {
  return (element.getAttributeNS(OPS, 'type') ?? '').split(/\s+/);
}

function hidden(element: Element): boolean {
  return (
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-hidden') === 'true' ||
    /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(
      element.getAttribute('style') ?? '',
    ) ||
    types(element).some((type) => ['pagebreak', 'cover', 'toc'].includes(type))
  );
}

/** Read text nodes as data. No XHTML is rendered, executed or attached to the page. */
async function bodyText(
  body: Element,
  omittedIds: Set<string>,
  checkpoint: () => Promise<void>,
): Promise<string> {
  const lines: string[] = [];
  let inline: string[] = [];
  const flush = (force = false) => {
    const line = inline.join('').replace(/ +/g, ' ').trim();
    if (line || force) lines.push(line);
    inline = [];
  };
  const stack: { node: Node; exit?: boolean; start?: number }[] = [{ node: body }];
  let visited = 0;
  while (stack.length) {
    const frame = stack.pop()!;
    const node = frame.node;
    if (node.nodeType === 3 || node.nodeType === 4) {
      inline.push((node.nodeValue ?? '').replace(/[\t\r\n\f\u00a0 ]+/g, ' '));
    } else if (node.nodeType === 1) {
      const element = node as Element;
      const tag = (element.localName ?? element.tagName).toLowerCase();
      if (frame.exit) {
        flush(tag === 'p' && lines.length === frame.start);
      } else if (
        !OMIT.has(tag) &&
        !hidden(element) &&
        !omittedIds.has(element.getAttribute('id') ?? '') &&
        !omittedIds.has(element.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') ?? '')
      ) {
        if (tag === 'br') flush(true);
        else if (tag === 'pre') {
          flush();
          const pre: string[] = [];
          const nodes: Node[] = [];
          for (let child = element.lastChild; child; child = child.previousSibling)
            nodes.push(child);
          while (nodes.length) {
            const child = nodes.pop()!;
            if (child.nodeType === 3 || child.nodeType === 4) pre.push(child.nodeValue ?? '');
            else if (child.nodeType === 1) {
              const entry = child as Element;
              const name = (entry.localName ?? entry.tagName).toLowerCase();
              if (name === 'br') pre.push('\n');
              else if (!OMIT.has(name) && !hidden(entry))
                for (let nested = child.lastChild; nested; nested = nested.previousSibling)
                  nodes.push(nested);
            }
            if (++visited % 2000 === 0) await checkpoint();
          }
          for (const line of pre.join('').replace(/\r\n?/g, '\n').split('\n')) lines.push(line);
        } else {
          if (BLOCKS.has(tag)) {
            flush();
            stack.push({ node, exit: true, start: lines.length });
          } else if ((tag === 'td' || tag === 'th') && inline.join('').trim()) inline.push('\t');
          for (let child = node.lastChild; child; child = child.previousSibling)
            stack.push({ node: child });
        }
      }
    }
    if (++visited % 2000 === 0) await checkpoint();
  }
  flush();
  // Remove empty padding at chapter boundaries while retaining interior empty paragraphs.
  const start = lines.findIndex((line) => line.trim());
  if (start < 0) return '';
  let end = lines.length;
  while (end > start && !lines[end - 1].trim()) end--;
  return lines.slice(start, end).join('\n');
}

export async function extractEpub(
  bytes: Uint8Array,
  checkpoint: Checkpoint = async () => {},
): Promise<ExtractedEpub> {
  await checkpoint(0.02);
  const headers = readEntries(
    bytes,
    new Set(['META-INF/container.xml', 'META-INF/encryption.xml']),
  );
  const container = parseXml(headers['META-INF/container.xml'], 'META-INF/container.xml');
  const rootfiles = elements(
    container,
    'urn:oasis:names:tc:opendocument:xmlns:container',
    'rootfile',
  );
  const rootfile =
    rootfiles.find(
      (element) => element.getAttribute('media-type') === 'application/oebps-package+xml',
    ) ?? rootfiles[0];
  if (!rootfile?.getAttribute('full-path')) throw new Error('EPUB 未声明有效的书籍内容文件。');
  const opfPath = archivePath('', rootfile.getAttribute('full-path')!);
  const opf = parseXml(readEntries(bytes, new Set([opfPath]))[opfPath], opfPath);
  const metadata: BookMetadata = {
    title: elements(opf, DC, 'title')[0]?.textContent?.trim() ?? '',
    author: elements(opf, DC, 'creator')
      .map((element) => element.textContent?.trim())
      .filter(Boolean)
      .join('、'),
    language: elements(opf, DC, 'language')[0]?.textContent?.trim() ?? '',
  };
  const manifest = new Map(
    elements(opf, OPF, 'item').map((item) => [item.getAttribute('id'), item]),
  );
  const spine = elements(opf, OPF, 'itemref');
  if (!spine.length) throw new Error('EPUB 没有可读取的阅读顺序（spine）。');
  const paths = spine.map((reference) => {
    const item = manifest.get(reference.getAttribute('idref'));
    if (!item?.getAttribute('href'))
      throw new Error(`EPUB 阅读顺序引用无效：${reference.getAttribute('idref')}`);
    return { item, path: archivePath(opfPath, item.getAttribute('href')!) };
  });
  if (headers['META-INF/encryption.xml']) {
    const encrypted = parseXml(headers['META-INF/encryption.xml'], 'META-INF/encryption.xml');
    const locked = elements(encrypted, 'http://www.w3.org/2001/04/xmlenc#', 'CipherReference').map(
      (reference) => archivePath('', reference.getAttribute('URI') ?? ''),
    );
    if (locked.includes(opfPath) || paths.some(({ path }) => locked.includes(path)))
      throw new Error('这本 EPUB 的正文受到加密或 DRM 保护，无法转换为 TXT。请使用未加密的 EPUB。');
  }
  const excluded = new Set<string>();
  const omittedIds = new Map<string, Set<string>>();
  const excludeTarget = (base: string, href: string) => {
    const path = archivePath(base, href);
    const hash = href.indexOf('#');
    if (hash < 0 || hash === href.length - 1) excluded.add(path);
    else {
      let id: string;
      try {
        id = decodeURIComponent(href.slice(hash + 1));
      } catch {
        throw new Error(`EPUB 资源锚点编码无效：${href}`);
      }
      const ids = omittedIds.get(path) ?? new Set<string>();
      ids.add(id);
      omittedIds.set(path, ids);
    }
  };
  for (const reference of elements(opf, OPF, 'reference')) {
    if (
      /^(cover|toc)$/.test(reference.getAttribute('type') ?? '') &&
      reference.getAttribute('href')
    )
      excludeTarget(opfPath, reference.getAttribute('href')!);
  }
  const navPaths = Array.from(manifest.values())
    .filter((item) => (item.getAttribute('properties') ?? '').split(/\s+/).includes('nav'))
    .map((item) => archivePath(opfPath, item.getAttribute('href') ?? ''));
  const wanted = new Set([
    ...paths
      .filter(({ item }) =>
        ['application/xhtml+xml', 'text/html'].includes(item.getAttribute('media-type') ?? ''),
      )
      .map(({ path }) => path),
    ...navPaths,
  ]);
  await checkpoint(0.1);
  const files = readEntries(bytes, wanted);
  // Landmarks identify cover/toc pages in EPUB3, including books without an EPUB2 guide.
  for (const path of navPaths) {
    const nav = parseXml(files[path], path, true);
    for (const landmarks of elements(nav, XHTML, 'nav').filter((element) =>
      types(element).includes('landmarks'),
    ))
      for (const anchor of elements(landmarks, XHTML, 'a')) {
        if (
          types(anchor).some((type) => type === 'cover' || type === 'toc') &&
          anchor.getAttribute('href')
        )
          excludeTarget(path, anchor.getAttribute('href')!);
      }
  }
  const chapters: string[] = [];
  const seen = new Set<string>();
  let skippedCount = 0;
  for (let index = 0; index < paths.length; index++) {
    const { item, path } = paths[index];
    await checkpoint(0.15 + (0.8 * index) / paths.length);
    if (seen.has(path) || excluded.has(path)) {
      skippedCount++;
      continue;
    }
    seen.add(path);
    if (!['application/xhtml+xml', 'text/html'].includes(item.getAttribute('media-type') ?? '')) {
      skippedCount++;
      continue;
    }
    if (!files[path]) throw new Error(`EPUB 缺少资源：${path}`);
    const document = parseXml(files[path], path, true);
    delete files[path];
    const body = elements(document, XHTML, 'body')[0];
    if (!body) throw new Error(`EPUB 正文缺少 body 元素：${path}`);
    if (types(body).some((type) => type === 'cover' || type === 'toc')) {
      skippedCount++;
      continue;
    }
    let text = await bodyText(body, omittedIds.get(path) ?? new Set(), () =>
      checkpoint(0.15 + (0.8 * index) / paths.length),
    );
    if (navPaths.includes(path))
      text = text.replace(/^(?:目录|目錄|contents|table of contents)(?:\n|$)/i, '');
    if (text.trim()) chapters.push(text);
    else skippedCount++;
  }
  if (!chapters.length)
    throw new Error('未找到可提取的文字正文。图片型或扫描版 EPUB 需要先进行文字识别（OCR）。');
  await checkpoint(1);
  return {
    metadata,
    text: chapters.join('\n\n') + '\n',
    documentCount: chapters.length,
    skippedCount,
  };
}
