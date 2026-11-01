import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPreferences, persistRules } from '../../src/app/preferences';
import { DEFAULT_RULES } from '../../src/core/rules';
import { PREFIX_CHAPTER_PATTERN } from '../../src/core/regex';

describe('rule preferences migration', () => {
  let saved: string | null;
  beforeEach(() => {
    saved = null;
    vi.stubGlobal('localStorage', {
      getItem: () => saved,
      setItem: (_: string, value: string) => {
        saved = value;
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('preserves existing keyword settings from before regex rules were supported', () => {
    saved = JSON.stringify({ rules: DEFAULT_RULES, maxLength: 80 });
    expect(readPreferences()).toEqual({ rules: DEFAULT_RULES, maxLength: 80, regexRules: [] });
  });
  it('round trips regex order, enabled state and expressions without compiling them in the UI', () => {
    const regexRules = [
      { id: 'one', name: '前置序号', pattern: PREFIX_CHAPTER_PATTERN, level: 3, enabled: true },
      { id: 'two', name: '备用', pattern: '第.+章', level: 2, enabled: false },
    ];
    persistRules(DEFAULT_RULES, 60, regexRules);
    expect(readPreferences().regexRules).toEqual(regexRules);
  });
  it('recovers from corrupt regex preference data', () => {
    saved = JSON.stringify({ rules: DEFAULT_RULES, maxLength: 60, regexRules: [{ pattern: 123 }] });
    expect(readPreferences()).toEqual({ rules: DEFAULT_RULES, maxLength: 60, regexRules: [] });
  });
});
