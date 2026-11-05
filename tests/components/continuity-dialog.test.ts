import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ContinuityDialog from '../../src/components/ContinuityDialog';
import { buildOutline } from '../../src/core/outline';
import { DEFAULT_RULES } from '../../src/core/rules';
import { checkContinuity, DEFAULT_CONTINUITY_OPTIONS } from '../../src/core/continuity';

describe('numbering report', () => {
  it('shows issue explanations, line links, scope/part options and acknowledgment controls', async () => {
    const snapshot = {
      ...(await buildOutline('第一章 甲\n正文\n第三章 乙\n正文', DEFAULT_RULES)),
      documentId: 'book',
      revision: 1,
      filename: '书.txt',
      size: 1,
      encoding: 'utf-8',
      encodingUncertain: false,
    };
    const result = await checkContinuity(snapshot);
    const markup = renderToStaticMarkup(
      createElement(ContinuityDialog, {
        snapshot,
        result,
        options: DEFAULT_CONTINUITY_OPTIONS,
        confirmed: new Set<string>(),
        busy: false,
        onOptions: () => {},
        onConfirm: () => {},
        onCancel: () => {},
        onNavigate: () => {},
        onClose: () => {},
      }),
    );
    expect(markup).toContain('疑似缺少第2章');
    expect(markup).toContain('原文第 3 行');
    expect(markup).toContain('标记已确认');
    expect(markup).toContain('按卷／册分别检查');
    expect(markup).toContain('严格检查同号章节');
    expect(markup).toContain('仍可导出');
  });
});
