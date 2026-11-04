import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { extractEpub } from '../../src/core/epub/extract';
import { generateEpub } from '../../src/core/epub/generate';
import { buildOutline } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';
import { epubFixture, xhtml } from '../helpers/epub-fixture';

describe('EPUB to TXT', () => {
  it('follows spine order rather than filenames, manifest or ZIP order and reads EPUB2 metadata', async () => {
    const result = await extractEpub(
      epubFixture({
        version: '2.0',
        manifest:
          '<item id="one" href="text/one.xhtml" media-type="application/xhtml+xml" /><item id="two" href="text/two.xhtml" media-type="application/xhtml+xml" />',
        spine: '<itemref idref="two" /><itemref idref="one" />',
        files: { 'Book/text/two.xhtml': xhtml('<h1>第二章 山</h1><p>先读这一章</p>') },
      }),
    );
    expect(result.metadata).toEqual({ title: '山 & 海', author: '某作者', language: 'zh-CN' });
    expect(result.text).toBe('第二章 山\n先读这一章\n\n第一章 风\n正文😀 & 雨\n');
    expect(result.documentCount).toBe(2);
  });

  it('preserves inline words, paragraph boundaries, br, empty paragraphs, entities, CDATA, lists, tables and pre text', async () => {
    const result = await extractEpub(
      epubFixture({
        files: {
          'Book/text/one.xhtml': xhtml(`<h1>章<span>节</span>😀</h1>
        <p>中文<em>强调</em>正文 &lt;字&gt; &amp; &#x1F600;</p>
        <p>Hello <b>world</b>!</p><p>&nbsp;</p><p>行一<br/>行二<br/><br/>行四</p>
        <p><![CDATA[原文 <tag> & 内容]]></p><ul><li>条目一</li><li>条目二</li></ul>
        <table><tr><td>甲</td><td>乙</td></tr><tr><td>丙</td><td>丁</td></tr></table>
        <pre>  保留缩进\n\t下一行<script>不输出</script></pre>`),
        },
      }),
    );
    expect(result.text).toBe(
      '章节😀\n中文强调正文 <字> & 😀\nHello world!\n\n行一\n行二\n\n行四\n原文 <tag> & 内容\n条目一\n条目二\n甲\t乙\n丙\t丁\n  保留缩进\n\t下一行\n',
    );
  });

  it('omits script/style, image alt text, external embeds and explicitly hidden content', async () => {
    const result = await extractEpub(
      epubFixture({
        files: {
          'Book/text/one.xhtml': xhtml(
            '<style>不输出样式</style><script>不输出脚本</script><p hidden="hidden">隐藏一</p><p aria-hidden="true">隐藏二</p><p style="display: none !important">隐藏三</p><p style="visibility:hidden;">隐藏四</p><span epub:type="pagebreak">123</span><img src="https://example.invalid/cover.jpg" alt="图片标题"/><iframe src="https://example.invalid/">外部文字</iframe><p>只输出正文</p>',
          ),
        },
      }),
    );
    expect(result.text).toBe('只输出正文\n');
  });

  it('skips cover and navigation resources, duplicate spine references, but retains nonlinear notes', async () => {
    const result = await extractEpub(
      epubFixture({
        manifest:
          '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/>',
        spine:
          '<itemref idref="cover"/><itemref idref="nav"/><itemref idref="one"/><itemref idref="one"/><itemref idref="notes" linear="no"/>',
        guide: '<guide><reference type="cover" href="cover.xhtml"/></guide>',
        files: {
          'Book/cover.xhtml': xhtml('<p>封面书名</p>'),
          'Book/nav.xhtml': xhtml(
            '<h1>目录</h1><nav epub:type="toc"><ol><li><a href="text/one.xhtml">不输出目录</a></li></ol></nav>',
          ),
          'Book/notes.xhtml': xhtml('<h2>注释</h2><p>保留补充文字</p>'),
        },
      }),
    );
    expect(result.text).toBe('第一章 风\n正文😀 & 雨\n\n注释\n保留补充文字\n');
    expect(result.skippedCount).toBe(3);
  });

  it('omits only a targeted cover/toc fragment when it shares a document with real chapters', async () => {
    const result = await extractEpub(
      epubFixture({
        manifest:
          '<item id="one" href="text/one.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        files: {
          'Book/text/one.xhtml': xhtml(
            '<section id="封面"><h1>封面书名</h1></section><section id="toc"><p>目录内容</p></section><nav epub:type="landmarks"><a epub:type="cover" href="#%E5%B0%81%E9%9D%A2">封面</a><a epub:type="toc" href="#toc">目录</a></nav><h1>第一章</h1><p>正文保留</p>',
          ),
        },
      }),
    );
    expect(result.text).toBe('第一章\n正文保留\n');
  });

  it('resolves URL-encoded relative paths, dot segments and filename fragments', async () => {
    const result = await extractEpub(
      epubFixture({
        manifest:
          '<item id="one" href="./text/../text/%E7%AB%A0%20%E4%B8%80.xhtml#heading" media-type="application/xhtml+xml"/>',
        files: { 'Book/text/章 一.xhtml': xhtml('<p>正确路径</p>') },
      }),
    );
    expect(result.text).toBe('正确路径\n');
  });

  it('decodes UTF-16 XML content', async () => {
    const source = xhtml('<h1>第一章</h1><p>正文</p>').replace('utf-8', 'utf-16');
    const body = Buffer.from('\uFEFF' + source, 'utf16le');
    const result = await extractEpub(epubFixture({ files: { 'Book/text/one.xhtml': body } }));
    expect(result.text).toBe('第一章\n正文\n');
  });

  it('rejects encrypted body text but permits obfuscated fonts that are never read', async () => {
    const encryption = (uri: string) =>
      `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><CipherData><CipherReference URI="${uri}"/></CipherData></EncryptedData></encryption>`;
    await expect(
      extractEpub(
        epubFixture({ files: { 'META-INF/encryption.xml': encryption('Book/text/one.xhtml') } }),
      ),
    ).rejects.toThrow('DRM');
    expect(
      (
        await extractEpub(
          epubFixture({ files: { 'META-INF/encryption.xml': encryption('Book/fonts/font.otf') } }),
        )
      ).text,
    ).toContain('正文');
  });

  it('reports corrupt archives, missing container/resources, invalid spine, malformed XHTML and image-only books', async () => {
    await expect(extractEpub(strToU8('not a ZIP'))).rejects.toThrow('无法解压');
    await expect(extractEpub(zipSync({}))).rejects.toThrow('container.xml');
    await expect(
      extractEpub(
        epubFixture({
          manifest: '<item id="one" href="missing.xhtml" media-type="application/xhtml+xml"/>',
        }),
      ),
    ).rejects.toThrow('missing.xhtml');
    await expect(extractEpub(epubFixture({ spine: '<itemref idref="missing"/>' }))).rejects.toThrow(
      '引用无效',
    );
    await expect(
      extractEpub(
        epubFixture({ files: { 'Book/text/one.xhtml': '<html><body><p>损坏</body></html>' } }),
      ),
    ).rejects.toThrow('无法解析');
    await expect(
      extractEpub(
        epubFixture({ files: { 'Book/text/one.xhtml': xhtml('<img src="page.jpg"/>') } }),
      ),
    ).rejects.toThrow('OCR');
  });

  it.each(['https://example.invalid/book.xhtml', '../../outside.xhtml', '%E0%A4%A'])(
    'rejects an invalid or remote spine URL: %s',
    async (href) => {
      await expect(
        extractEpub(
          epubFixture({
            manifest: `<item id="one" href="${href}" media-type="application/xhtml+xml"/>`,
          }),
        ),
      ).rejects.toThrow('路径');
    },
  );

  it('converts generated EPUB back to text without repeating NAV/NCX, cover titles or split chapter headings', async () => {
    const source =
      '作品介绍\n第一卷 山海\n第一章 风雨\n' +
      Array.from({ length: 1500 }, (_, index) => `${index} ` + '风雨山河'.repeat(20)).join('\n');
    const epub = await generateEpub(
      source,
      await buildOutline(source, DEFAULT_RULES),
      { title: '往返样本', author: '', language: 'zh-CN' },
      undefined,
      { coverPng: new Uint8Array([137, 80, 78, 71]) },
    );
    const result = await extractEpub(epub);
    expect(result.text.startsWith('简介\n作品介绍\n\n第一卷 山海\n\n第一章 风雨\n')).toBe(true);
    expect(result.text.match(/第一章 风雨/g)).toHaveLength(1);
    expect(result.text.match(/^\d+ /gm)).toHaveLength(1500);
    expect(result.text).not.toContain('往返样本');
    expect(result.skippedCount).toBe(1);
    expect(result.text).toContain('1499 ');
    // The converter does not need to inflate the cover image at all.
    expect(unzipSync(epub)['OEBPS/images/cover.png']).toBeDefined();
  });

  it('supports cooperative cancellation while walking a large document', async () => {
    let checks = 0;
    const epub = epubFixture({
      files: { 'Book/text/one.xhtml': xhtml('<p>正文</p>'.repeat(3000)) },
    });
    await expect(
      extractEpub(epub, async (progress) => {
        if (progress >= 0.15 && ++checks === 2) throw new Error('操作已取消');
      }),
    ).rejects.toThrow('操作已取消');
  });
});
