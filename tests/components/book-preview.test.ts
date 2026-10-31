import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import BookPreview from '../../src/components/BookPreview';
import { buildOutline, sectionPreview } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';
import type { Section } from '../../src/core/types';

function renderParagraphs(text: string, section: Section, removeBlankLines: boolean) {
  const markup = renderToStaticMarkup(
    createElement(BookPreview, {
      selected: section,
      selectedIndex: 0,
      revision: 1,
      headingCount: 1,
      title: '书名',
      preview: {
        text,
        sectionId: section.id,
        revision: 1,
        nextOffset: null,
        totalCharacters: text.length,
      },
      previewLoading: false,
      fontSize: 18,
      removeBlankLines,
      morePreview: () => {},
    }),
  );
  const document = new DOMParser().parseFromString(markup, 'text/html');
  const prose = Array.from(document.getElementsByTagName('div')).find(
    (node) => node.getAttribute('class') === 'prose',
  )!;
  return Array.from(prose.getElementsByTagName('p')).map((node) => node.textContent);
}

describe('blank line cleanup in preview', () => {
  it('can toggle blank paragraphs without changing or merging nonempty paragraphs', async () => {
    const source = '第一章 正文\n\n \t　\n　首段  内部空格 \t\n\n \t\n\t二段 <&> 😀\n\n';
    const section = (await buildOutline(source, DEFAULT_RULES)).sections[0];
    const preview = sectionPreview(source, section).text;
    expect(renderParagraphs(preview, section, false)).toContain('\u00A0');
    expect(renderParagraphs(preview, section, true)).toEqual(['首段  内部空格 \t', '二段 <&> 😀']);
    expect(renderParagraphs(preview, section, false)).toContain('\u00A0');
  });

  it('keeps page boundaries, long indentation and emoji intact after loading subsequent pages', async () => {
    const expected = ['雨😀'.repeat(100) + '   行内空格  ', '正文'.repeat(100)];
    const source =
      '第一章 正文\n' + '　'.repeat(40) + expected[0] + '\n\n \t\n　' + expected[1] + '\n\n';
    const section = (await buildOutline(source, DEFAULT_RULES)).sections[0];
    let offset: number | null = 0;
    let text = '';
    while (offset !== null) {
      const page = sectionPreview(source, section, offset, 20);
      text += page.text;
      offset = page.nextOffset;
    }
    expect(renderParagraphs(text, section, true)).toEqual(expected);
  });
});
