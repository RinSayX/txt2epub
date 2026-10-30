export type Encoding = 'auto' | 'utf-8' | 'gb18030' | 'gbk' | 'big5' | 'utf-16le' | 'utf-16be';

export interface HeadingRule {
  id: string;
  keyword: string;
  level: number;
  kind: 'numbered' | 'unnumbered';
  enabled: boolean;
}

export interface Section {
  id: string;
  title: string;
  lineIndex: number | null;
  headingStart: number;
  bodyStart: number;
  bodyEnd: number;
  level: number;
  depth: number;
  parentId: string | null;
  suspicious: boolean;
}

export interface Outline {
  sections: Section[];
  lineCount: number;
  characterCount: number;
  headingCount: number;
}

export interface DocumentSnapshot extends Outline {
  documentId: string;
  revision: number;
  filename: string;
  size: number;
  encoding: string;
  encodingUncertain: boolean;
}

export interface BookMetadata {
  title: string;
  author: string;
  language: string;
}

export interface Preview {
  sectionId: string;
  revision: number;
  text: string;
  nextOffset: number | null;
  totalCharacters: number;
}

export type WorkerRequest =
  | { id: number; type: 'load'; file: File; encoding: Encoding; rules: HeadingRule[]; maxTitleLength: number }
  | { id: number; type: 'analyze'; rules: HeadingRule[]; ignored: number[]; maxTitleLength: number }
  | { id: number; type: 'preview'; sectionId: string; offset: number }
  | { id: number; type: 'export'; metadata: BookMetadata }
  | { id: number; type: 'cancel' };

export type WorkerResponse =
  | { id: number; type: 'result'; payload: unknown }
  | { id: number; type: 'progress'; value: number; label: string }
  | { id: number; type: 'error'; message: string };

export type Checkpoint = (progress: number) => Promise<void>;
export const FILE_LIMIT = 20 * 1024 * 1024;

export const DEFAULT_RULES: HeadingRule[] = [
  { id: 'volume', keyword: '卷', level: 1, kind: 'numbered', enabled: true },
  { id: 'book', keyword: '册', level: 2, kind: 'numbered', enabled: true },
  { id: 'chapter', keyword: '章', level: 3, kind: 'numbered', enabled: true },
  { id: 'episode', keyword: '回', level: 4, kind: 'numbered', enabled: true },
  ...['序章', '楔子', '尾声', '后记', '番外'].map((keyword, i) => ({
    id: `extra-${i}`, keyword, level: 1, kind: 'unnumbered' as const, enabled: true,
  })),
];
