import type { BookMetadata, Encoding, HeadingRule, RegexHeadingRule } from '../core/types';

export type WorkerRequest =
  | {
      id: number;
      type: 'load';
      file: File;
      encoding: Encoding;
      rules: HeadingRule[];
      regexRules?: RegexHeadingRule[];
      maxTitleLength: number;
    }
  | {
      id: number;
      type: 'analyze';
      rules: HeadingRule[];
      regexRules?: RegexHeadingRule[];
      ignored: number[];
      deleted?: number[];
      maxTitleLength: number;
    }
  | {
      id: number;
      type: 'test-rules';
      rules: HeadingRule[];
      regexRules: RegexHeadingRule[];
      maxTitleLength: number;
      ignored: number[];
      deleted: number[];
      sampleText?: string;
    }
  | { id: number; type: 'preview'; sectionId: string; offset: number }
  | { id: number; type: 'epub-to-txt'; file: File }
  | {
      id: number;
      type: 'export';
      metadata: BookMetadata;
      coverPng?: Uint8Array;
      cleanInvalidControls?: boolean;
      removeBlankLines?: boolean;
    }
  | { id: number; type: 'cancel' };

export type WorkerResponse =
  | { id: number; type: 'result'; payload: unknown }
  | { id: number; type: 'progress'; value: number; label: string }
  | { id: number; type: 'error'; message: string };

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
export type Request = WithoutId<Exclude<WorkerRequest, { type: 'cancel' }>>;

export interface ExportResult {
  bytes: Uint8Array;
  cleanedControlCount: number;
}

export interface EpubToTxtResult {
  bytes: Uint8Array;
  title: string;
  author: string;
  documentCount: number;
  skippedCount: number;
  characterCount: number;
  preview: string;
}
