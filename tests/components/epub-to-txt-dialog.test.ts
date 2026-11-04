import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EpubToTxtDialog from '../../src/components/EpubToTxtDialog';

describe('EPUB conversion entry', () => {
  it('offers EPUB input with a clear local conversion scope before a file is selected', () => {
    const markup = renderToStaticMarkup(createElement(EpubToTxtDialog, { onClose: () => {} }));
    expect(markup).toContain('EPUB 转 TXT');
    expect(markup).toContain('accept=".epub,application/epub+zip"');
    expect(markup).toContain('UTF-8');
    expect(markup).toContain('当前 TXT 工作台内容不受影响');
    expect(markup).toContain('DRM');
    expect(markup).not.toContain('下载 TXT');
  });
});
