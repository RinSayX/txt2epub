import type { HeadingRule } from './types';

export const DEFAULT_RULES: HeadingRule[] = [
  { id: 'volume', keyword: '卷', level: 1, kind: 'numbered', enabled: true },
  { id: 'book', keyword: '册', level: 2, kind: 'numbered', enabled: true },
  { id: 'chapter', keyword: '章', level: 3, kind: 'numbered', enabled: true },
  { id: 'episode', keyword: '回', level: 4, kind: 'numbered', enabled: true },
  ...['序章', '楔子', '尾声', '后记', '番外'].map((keyword, i) => ({
    id: `extra-${i}`,
    keyword,
    level: 1,
    kind: 'unnumbered' as const,
    enabled: true,
  })),
];
