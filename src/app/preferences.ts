import { DEFAULT_RULES } from '../core/rules';
import type { HeadingRule, RegexHeadingRule } from '../core/types';
import { validateRules } from '../core/outline';
import { validateRegexRules } from '../core/regex';

const PREFERENCES_KEY = 'shiye.rules.v1';
export function readPreferences(): {
  rules: HeadingRule[];
  regexRules: RegexHeadingRule[];
  maxLength: number;
} {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null');
    if (
      parsed &&
      Array.isArray(parsed.rules) &&
      parsed.rules.every(
        (rule: HeadingRule) =>
          typeof rule.id === 'string' &&
          typeof rule.keyword === 'string' &&
          typeof rule.enabled === 'boolean',
      )
    ) {
      validateRules(parsed.rules, parsed.maxLength);
      const regexRules = parsed.regexRules ?? [];
      validateRegexRules(regexRules);
      return { rules: parsed.rules, maxLength: parsed.maxLength, regexRules };
    }
  } catch {
    /* Private browsing or invalid preferences: use safe defaults. */
  }
  return { rules: structuredClone(DEFAULT_RULES), maxLength: 60, regexRules: [] };
}
export function persistRules(
  nextRules: HeadingRule[],
  length: number,
  regexRules: RegexHeadingRule[] = [],
) {
  try {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ rules: nextRules, maxLength: length, regexRules }),
    );
  } catch {
    /* Session functionality remains available. */
  }
}
