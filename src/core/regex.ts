import type { RegexHeadingRule } from './types';

export const PREFIX_CHAPTER_PATTERN = String.raw`^[0-9０-９]+[ \t　]*[.．][ \t　]*(?<title>第[0-9０-９零〇一二两三四五六七八九十百千万]+章.*)$`;

// Structural validation is safe on the UI thread. Compile/execute user patterns
// only inside the disposable analysis Worker in the application.
export function validateRegexRules(rules: RegexHeadingRule[]): void {
  if (!Array.isArray(rules) || rules.length > 20) throw new Error('最多支持 20 条正则规则。');
  const ids = new Set<string>();
  for (const rule of rules) {
    if (!rule || typeof rule.id !== 'string' || !rule.id || ids.has(rule.id))
      throw new Error('正则规则标识无效或重复。');
    ids.add(rule.id);
    if (
      typeof rule.name !== 'string' ||
      !rule.name.trim() ||
      rule.name.length > 40 ||
      /[\r\n]/.test(rule.name)
    )
      throw new Error('正则规则名称需为 1–40 个字符。');
    if (
      typeof rule.pattern !== 'string' ||
      !rule.pattern.trim() ||
      rule.pattern.length > 1000 ||
      /[\r\n]/.test(rule.pattern)
    )
      throw new Error(`正则规则“${rule.name}”需要 1–1000 个字符的单行表达式。`);
    if (
      !Number.isInteger(rule.level) ||
      rule.level < 1 ||
      rule.level > 10 ||
      typeof rule.enabled !== 'boolean'
    )
      throw new Error(`正则规则“${rule.name}”的层级或启用状态无效。`);
  }
}

export function compileRegexRules(rules: RegexHeadingRule[]) {
  validateRegexRules(rules);
  return rules
    .map((rule) => {
      try {
        return { rule, pattern: new RegExp(`^(?:${rule.pattern})$`, 'u') };
      } catch {
        throw new Error(
          `正则规则“${rule.name}”语法错误。请填写 JavaScript 正则表达式正文，不要附加 / / 或标志。`,
        );
      }
    })
    .filter(({ rule }) => rule.enabled);
}
