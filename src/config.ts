import type { Encoding } from './core/types';

export const LARGE_FILE_WARNING_SIZE = 50 * 1024 * 1024;

export const ENCODINGS: { value: Encoding; label: string }[] = [
  { value: 'auto', label: '自动检测' },
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gb18030', label: 'GB18030' },
  { value: 'gbk', label: 'GBK' },
  { value: 'big5', label: 'Big5' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
];
