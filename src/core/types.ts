export type Encoding = 'auto' | 'utf-8' | 'gb18030' | 'gbk' | 'big5' | 'utf-16le' | 'utf-16be';

export interface HeadingRule {
  id: string;
  keyword: string;
  level: number;
  kind: 'numbered' | 'unnumbered';
  enabled: boolean;
}

export interface RegexHeadingRule {
  id: string;
  name: string;
  pattern: string;
  level: number;
  enabled: boolean;
}

export interface RegexTestResult {
  headingCount: number;
  regexMatchCount: number;
  samples: {
    lineIndex: number;
    original: string;
    title: string;
    ruleName: string;
    level: number;
  }[];
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
  regexRuleId?: string;
  numbering?: SectionNumbering;
}

export interface SectionNumbering {
  raw: string;
  value: number | null;
  unit: string;
  label: string;
  part?: '上' | '中' | '下';
}

export interface ContinuityOptions {
  scope: 'book' | 'volume';
  units: string[];
  strictParts: boolean;
}

export interface ContinuityIssue {
  id: string;
  kind: 'gap' | 'duplicate' | 'order';
  message: string;
  messageEn?: string;
  scope: string;
  scopeEn?: string;
  sectionIds: string[];
}

export interface ContinuityResult {
  documentId: string;
  revision: number;
  optionsKey: string;
  issues: ContinuityIssue[];
  unparsed: string[];
  splits: { label: string; labelEn?: string; sectionIds: string[] }[];
  checkedCount: number;
  excludedCount: number;
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
