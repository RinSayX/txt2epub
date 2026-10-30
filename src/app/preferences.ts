import { DEFAULT_RULES } from '../core/rules';
import type { HeadingRule } from '../core/types';
import { validateRules } from '../core/outline';

const PREFERENCES_KEY = 'shiye.rules.v1';
export function readPreferences(): { rules: HeadingRule[]; maxLength: number } {
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
      return parsed;
    }
  } catch {
    /* Private browsing or invalid preferences: use safe defaults. */
  }
  return { rules: structuredClone(DEFAULT_RULES), maxLength: 60 };
}
export function persistRules(nextRules: HeadingRule[], length: number) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ rules: nextRules, maxLength: length }));
  } catch {
    /* Session functionality remains available. */
  }
}
