import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExportDialog from '../../src/components/ExportDialog';

describe('export cleanup consent', () => {
  it('offers cleanup as an unchecked option with an explanation of its scope', () => {
    const noop = () => {};
    const markup = renderToStaticMarkup(
      createElement(ExportDialog, {
        title: '书名',
        author: '',
        language: 'zh-Hans',
        sectionCount: 1,
        setTitle: noop,
        setAuthor: noop,
        setLanguage: noop,
        onClose: noop,
        onExport: noop,
      }),
    );
    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('checked=""');
    expect(markup).toContain('清理不兼容的隐藏控制字符');
    expect(markup).toContain('源 TXT 和预览不变');
  });
});
