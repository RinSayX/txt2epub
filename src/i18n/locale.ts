export type Locale = 'zh-CN' | 'en';
export type Copy = readonly [chinese: string, english: string];

export const copy = (chinese: string, english: string): Copy => [chinese, english];
export const localize = (value: string | Copy, locale: Locale): string =>
  typeof value === 'string' ? value : value[locale === 'en' ? 1 : 0];

export class LocalizedError extends Error {
  constructor(
    message: string,
    readonly messageEn: string,
  ) {
    super(message);
  }
}

export function describeError(error: unknown, fallback: Copy): Copy {
  if (error instanceof LocalizedError) return copy(error.message, error.messageEn);
  if (error instanceof Error) return copy(error.message, error.message);
  return fallback;
}

const englishProgress: Record<string, string> = {
  '读取 EPUB': 'Reading EPUB',
  '提取 EPUB 正文': 'Extracting EPUB text',
  '生成 TXT': 'Preparing TXT',
  读取文件: 'Reading file',
  检查编码: 'Checking encoding',
  识别章节: 'Detecting chapters',
  更新章节目录: 'Updating contents',
  测试识别规则: 'Testing rules',
  检查章节编号: 'Checking chapter numbers',
  '生成 EPUB': 'Generating EPUB',
  整理章节: 'Organizing chapters',
};

export const progressText = (label: string, locale: Locale) =>
  locale === 'en' ? (englishProgress[label] ?? label) : label;
