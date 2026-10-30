import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LargeFileNotice from '../src/components/LargeFileNotice';

describe('large file notice', () => {
  it('shows no notice up to and including exactly 50 MiB', () => {
    for (const size of [0, 20 * 1024 ** 2, 30 * 1024 ** 2, 50 * 1024 ** 2]) {
      expect(renderToStaticMarkup(createElement(LargeFileNotice, { size }))).toBe('');
    }
  });

  it('shows an informational notice above 50 MiB without requiring confirmation', () => {
    for (const size of [50 * 1024 ** 2 + 1, 51 * 1024 ** 2]) {
      const markup = renderToStaticMarkup(createElement(LargeFileNotice, { size }));
      expect(markup).toContain('role="status"');
      expect(markup).toContain('超过 50 MiB');
      expect(markup).toContain('仍可继续处理');
      expect(markup).not.toContain('<dialog');
      expect(markup).not.toContain('<button');
    }
    expect(renderToStaticMarkup(createElement(LargeFileNotice, { size: 51 * 1024 ** 2 }))).toContain('51.0 MiB');
  });
});
