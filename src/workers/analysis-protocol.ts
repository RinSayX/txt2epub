import type { Corrections, HeadingRule, Outline, RegexHeadingRule } from '../core/types';

export interface AnalysisJob extends Corrections {
  source: string;
  rules: HeadingRule[];
  regexRules: RegexHeadingRule[];
  maxTitleLength: number;
}
export interface AnalysisResult {
  text: string;
  outline: Outline;
}
export type AnalysisResponse =
  | { type: 'ready' }
  | { type: 'progress'; value: number }
  | { type: 'result'; outline: Outline; text?: string }
  | { type: 'error'; message: string; messageEn?: string };
