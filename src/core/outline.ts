import type { Checkpoint, HeadingRule, Outline, Section } from './types';
import { chapterContentEnd, previewParagraphs } from './paragraphs';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function validateRules(rules: HeadingRule[], maxTitleLength: number): void {
  if (!Number.isInteger(maxTitleLength) || maxTitleLength < 4 || maxTitleLength > 500) {
    throw new Error('标题长度上限需为 4–500 之间的整数。');
  }
  if (rules.length > 50) throw new Error('最多支持 50 条识别规则。');
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!rule.keyword.trim() || rule.keyword !== rule.keyword.trim() || rule.keyword.length > 20 || /[\r\n]/.test(rule.keyword)) {
      throw new Error('关键词需要为 1–20 个字符，且不能包含换行或首尾空格。');
    }
    if (!Number.isInteger(rule.level) || rule.level < 1 || rule.level > 10) throw new Error('层级需为 1–10 之间的整数。');
    if (!['numbered', 'unnumbered'].includes(rule.kind)) throw new Error('未知的规则类型。');
    const key = `${rule.kind}:${rule.keyword}`;
    if (seen.has(key)) throw new Error(`关键词“${rule.keyword}”重复，请删除重复规则。`);
    seen.add(key);
  }
}

export async function buildOutline(
  text: string,
  rules: HeadingRule[],
  ignored: ReadonlySet<number> = new Set(),
  maxTitleLength = 60,
  checkpoint: Checkpoint = async () => {},
): Promise<Outline> {
  validateRules(rules, maxTitleLength);
  const compiled = rules.filter((rule) => rule.enabled).sort((a, b) => b.keyword.length - a.keyword.length).map((rule) => ({
    rule,
    pattern: rule.kind === 'numbered'
      ? new RegExp(`^第[\\s　]*[0-9０-９零〇一二两兩三四五六七八九十百千万萬亿億壹贰貳叁參肆伍陆陸柒捌玖拾佰仟]+[\\s　]*${escapeRegex(rule.keyword)}`)
      : new RegExp(`^${escapeRegex(rule.keyword)}(?:$|[\\s　:：·—-]+.+$)`),
  }));
  const sections: Section[] = [];
  let offset = 0;
  let lineIndex = 0;
  let previousLineBlank = true;
  while (offset < text.length) {
    const newline = text.indexOf('\n', offset);
    const end = newline === -1 ? text.length : newline;
    const raw = text.slice(offset, end);
    const trimmed = raw.trim();
    if (!ignored.has(lineIndex) && trimmed && trimmed.length <= maxTitleLength * 2 && [...trimmed].length <= maxTitleLength) {
      const match = compiled.find(({ pattern }) => pattern.test(trimmed));
      if (match) {
        const nextEnd = text.indexOf('\n', end + 1);
        const nextBlank = !text.slice(end + 1, nextEnd === -1 ? text.length : nextEnd).trim();
        sections.push({
          id: `line-${lineIndex}`, title: trimmed, lineIndex,
          headingStart: offset, bodyStart: newline === -1 ? end : end + 1,
          bodyEnd: text.length, level: match.rule.level, depth: 0, parentId: null,
          suspicious: (!previousLineBlank && !nextBlank) || /[。！？“”「」]/u.test(trimmed),
        });
      }
    }
    previousLineBlank = !trimmed;
    offset = newline === -1 ? text.length : end + 1;
    lineIndex++;
    if (lineIndex % 4000 === 0) await checkpoint(offset / Math.max(1, text.length));
  }
  const headingCount = sections.length;
  if (!sections.length || sections[0].headingStart > 0) {
    const end = sections[0]?.headingStart ?? text.length;
    // Keep even whitespace-only front matter, so no source range disappears.
    sections.unshift({
      id: 'frontmatter', title: headingCount ? '前言' : '正文', lineIndex: null,
      headingStart: 0, bodyStart: 0, bodyEnd: end, level: 1, depth: 0,
      parentId: null, suspicious: false,
    });
  }
  const stack: Section[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    section.bodyEnd = sections[i + 1]?.headingStart ?? text.length;
    if (section.lineIndex === null) continue;
    while (stack.length && stack[stack.length - 1].level >= section.level) stack.pop();
    section.parentId = stack.at(-1)?.id ?? null;
    section.depth = stack.length;
    stack.push(section);
  }
  await checkpoint(1);
  return { sections, headingCount, characterCount: text.length, lineCount: lineIndex };
}

export function sectionPreview(text: string, section: Section, offset = 0, limit = 18000) {
  const total = chapterContentEnd(text, section.bodyStart, section.bodyEnd) - section.bodyStart;
  const start = Math.max(0, Math.min(offset, total));
  let end = Math.min(total, start + limit);
  if (end < total) {
    const newline = text.indexOf('\n', section.bodyStart + end);
    if (newline !== -1 && newline < section.bodyStart + total && newline - section.bodyStart - end < 2000) end = newline - section.bodyStart + 1;
    // Do not split a surrogate pair across preview chunks.
    else if (/[\uD800-\uDBFF]/.test(text[section.bodyStart + end - 1] ?? '')) end--;
  }
  return { text: previewParagraphs(text, section.bodyStart, section.bodyStart + start, section.bodyStart + end), nextOffset: end < total ? end : null, totalCharacters: total };
}
