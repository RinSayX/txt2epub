import type { SectionNumbering } from './types';

const NUMERALS = '0-9０-９零〇一二两兩三四五六七八九十百千万萬亿億壹贰貳叁參肆伍陆陸柒捌玖拾佰仟';
const DIGITS = '零一二三四五六七八九';
const ALIASES: Record<string, string> = {
  〇: '零',
  两: '二',
  兩: '二',
  壹: '一',
  贰: '二',
  貳: '二',
  叁: '三',
  參: '三',
  肆: '四',
  伍: '五',
  陆: '六',
  陸: '六',
  柒: '七',
  捌: '八',
  玖: '九',
  拾: '十',
  佰: '百',
  仟: '千',
  萬: '万',
  億: '亿',
};

function smallNumber(text: string): number | null {
  if (!text) return null;
  let value = 0,
    digit: number | null = null,
    lastUnit = 10000,
    zero = false;
  for (const char of text) {
    const next = DIGITS.indexOf(char);
    if (next === 0) {
      if (!value || zero || digit !== null) return null;
      zero = true;
    } else if (next > 0) {
      if (digit !== null) return null;
      digit = next;
    } else {
      const unit = ({ 十: 10, 百: 100, 千: 1000 } as Record<string, number>)[char];
      if (!unit || unit >= lastUnit || (digit === null && !(unit === 10 && (!value || zero))))
        return null;
      value += (digit ?? 1) * unit;
      lastUnit = unit;
      digit = null;
      zero = false;
    }
  }
  if (digit === null) return zero ? null : value;
  // 二百三 / 一千二 are ambiguous colloquial forms; require explicit units or 零.
  if (lastUnit >= 100 && value && !zero) return null;
  return value + digit;
}

export function parseChapterNumber(raw: string): number | null {
  const text = Array.from(
    raw.normalize('NFKC').replace(/\s+/gu, ''),
    (char) => ALIASES[char] ?? char,
  ).join('');
  if (/^\d+$/.test(text)) {
    const value = Number(text);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (/^[零一二三四五六七八九]+$/.test(text)) {
    const value = Number(Array.from(text, (char) => DIGITS.indexOf(char)).join(''));
    return Number.isSafeInteger(value) ? value : null;
  }
  let total = 0,
    start = 0,
    lastUnit = Infinity;
  for (let index = 0; index < text.length; index++) {
    const unit = text[index] === '亿' ? 100000000 : text[index] === '万' ? 10000 : 0;
    if (!unit) continue;
    let group = text.slice(start, index);
    const zero = group.startsWith('零');
    if (zero && start === 0) return null;
    if (zero) group = group.slice(1);
    const value = smallNumber(group);
    if (
      value === null ||
      !value ||
      unit >= lastUnit ||
      (Number.isFinite(lastUnit) && value * unit < lastUnit / 10 && !zero)
    )
      return null;
    total += value * unit;
    lastUnit = unit;
    start = index + 1;
  }
  if (start < text.length) {
    let group = text.slice(start);
    const zero = group.startsWith('零');
    if (zero && start === 0) return null;
    if (zero) group = group.slice(1);
    const value = smallNumber(group);
    if (value === null || (Number.isFinite(lastUnit) && value < lastUnit / 10 && !zero))
      return null;
    total += value;
  }
  return text && Number.isSafeInteger(total) ? total : null;
}

export function numberingExtractor(keywords: string[]) {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const units = [...new Set([...keywords, '章', '回', '卷', '册', '节', '部', '篇'])].sort(
    (a, b) => b.length - a.length,
  );
  const standard = new RegExp(
    `^(?:[0-9０-９]+[ \\t　]*[.．][ \\t　]*)?第[\\s　]*([${NUMERALS}\\s　]+?)[\\s　]*(${units.map(escape).join('|')})(.*)$`,
    'u',
  );
  return (
    raw: string,
    title: string,
    keyword?: string,
    regex?: { id: string; name: string; groups?: Record<string, string> },
  ): SectionNumbering => {
    const found = standard.exec(title) ?? standard.exec(raw);
    const explicit = regex?.groups && Object.hasOwn(regex.groups, 'number');
    const number = explicit ? (regex.groups!.number?.trim() ?? '') : (found?.[1].trim() ?? '');
    const unit = keyword ?? found?.[2] ?? `regex:${regex?.id}`;
    const partMatch = found
      ? /^\s*[（(](上|中|下)[)）]/u.exec(found[3])
      : /[（(](上|中|下)[)）]\s*$/u.exec(title);
    return {
      raw: number,
      value: parseChapterNumber(number),
      unit,
      label: unit.startsWith('regex:') ? `正则：${regex?.name}` : unit,
      ...(partMatch ? { part: partMatch[1] as '上' | '中' | '下' } : {}),
    };
  };
}
