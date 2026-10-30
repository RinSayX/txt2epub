import type { BookMetadata, Encoding, HeadingRule } from '../core/types';

export type WorkerRequest =
  | {
      id: number;
      type: 'load';
      file: File;
      encoding: Encoding;
      rules: HeadingRule[];
      maxTitleLength: number;
    }
  | { id: number; type: 'analyze'; rules: HeadingRule[]; ignored: number[]; maxTitleLength: number }
  | { id: number; type: 'preview'; sectionId: string; offset: number }
  | { id: number; type: 'export'; metadata: BookMetadata }
  | { id: number; type: 'cancel' };

export type WorkerResponse =
  | { id: number; type: 'result'; payload: unknown }
  | { id: number; type: 'progress'; value: number; label: string }
  | { id: number; type: 'error'; message: string };

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
export type Request = WithoutId<Exclude<WorkerRequest, { type: 'cancel' }>>;
