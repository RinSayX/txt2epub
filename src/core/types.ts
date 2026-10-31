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
  empty: boolean;
}

export interface Corrections {
  ignored: number[];
  deleted: number[];
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

export type Checkpoint = (progress: number) => Promise<void>;
