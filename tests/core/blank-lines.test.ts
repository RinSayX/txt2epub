import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { strFromU8, unzipSync } from 'fflate';
import { generateEpub } from '../../src/core/epub/generate';
import { buildOutline } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';

const metadata = { title: '空行清理验证', author: '', language: 'zh-Hans' };
function paragraphs(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  return Object.entries(files)
    .filter(([path]) => path.startsWith('OEBPS/text/'))
    .flatMap(([, content]) => {
      const document = new DOMParser().parseFromString(strFromU8(content), 'application/xml');
      return Array.from(document.getElementsByTagName('p')).map((node) => node.textContent);
    });
}

describe('optional blank line cleanup', () => {
  it('skips leading, repeated and whitespace-only blank lines, retaining paragraph boundaries and internal/trailing spaces', async () => {
    const source =
      '第一卷 分组\n \t　\n第一章 正文\n\n \t　\n　首段  内部空格 \t\n\n \t\n\t二段 <&> 😀\n\n第三段\n\n　';
    const outline = await buildOutline(source, DEFAULT_RULES);
    const original = structuredClone(outline);
    const bytes = await generateEpub(source, outline, metadata, undefined, {
      removeBlankLines: true,
    });
    expect(paragraphs(bytes)).toEqual(['首段  内部空格 \t', '二段 <&> 😀', '第三段']);
    const files = unzipSync(bytes);
    expect(strFromU8(files['OEBPS/text/section-000001.xhtml'])).toContain(
      '<h1 id="heading">第一卷 分组</h1>',
    );
    for (const [path, content] of Object.entries(files)) {
      if (path.startsWith('OEBPS/text/'))
        expect(strFromU8(content)).not.toContain('<p class="blank">');
    }
    expect(outline).toEqual(original);
    expect(paragraphs(await generateEpub(source, outline, metadata))).toContain('\u00A0');
  });

  it('retains every paragraph when long chapters split into several XHTML files', async () => {
    const expected = Array.from(
      { length: 600 },
      (_, index) => `${index} ${'段落 <&> 😀'.repeat(40)}  `,
    );
    const source = '第一章 长文\n\n' + expected.map((line) => `　${line}\n\t　\n\n`).join('');
    const bytes = await generateEpub(
      source,
      await buildOutline(source, DEFAULT_RULES),
      metadata,
      undefined,
      { removeBlankLines: true },
    );
    expect(paragraphs(bytes)).toEqual(expected);
    expect(
      Object.keys(unzipSync(bytes)).filter((path) => path.startsWith('OEBPS/text/')).length,
    ).toBeGreaterThan(1);
  });

  it('also omits control-only lines when both cleanup options are enabled', async () => {
    const source = '第一章 风雨\n正文\n\u001A\n \t\u0000\n下一段\u001A\n';
    const outline = await buildOutline(source, DEFAULT_RULES);
    expect(
      paragraphs(
        await generateEpub(source, outline, metadata, undefined, {
          removeBlankLines: true,
          cleanInvalidControls: true,
        }),
      ),
    ).toEqual(['正文', '下一段']);
    await expect(
      generateEpub(source, outline, metadata, undefined, { removeBlankLines: true }),
    ).rejects.toThrow('U+001A');
  });

  it('still yields and can be cancelled while skipping a long run of empty lines', async () => {
    const source = '第一章 正文\n开头\n' + '\n'.repeat(7000) + '结尾';
    await expect(
      generateEpub(
        source,
        await buildOutline(source, DEFAULT_RULES),
        metadata,
        async (progress) => {
          if (progress > 0.04) throw new Error('cancelled');
        },
        { removeBlankLines: true },
      ),
    ).rejects.toThrow('cancelled');
  });
});
