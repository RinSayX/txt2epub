import { LocalizedError } from '../i18n/locale';
import type {
  Checkpoint,
  ContinuityOptions,
  ContinuityResult,
  DocumentSnapshot,
  Section,
} from './types';

export const DEFAULT_CONTINUITY_OPTIONS: ContinuityOptions = {
  scope: 'book',
  units: ['章', '回'],
  strictParts: false,
};

export const continuityKey = (options: ContinuityOptions) =>
  JSON.stringify([options.scope, [...options.units].sort(), options.strictParts]);
const englishUnits: Record<string, string> = {
  章: 'Chapter',
  回: 'Episode',
  卷: 'Volume',
  册: 'Book',
};
export const englishNumberingUnit = (unit: string, label: string) =>
  unit.startsWith('regex:')
    ? `Regex: ${label.slice('正则：'.length)}`
    : (englishUnits[unit] ?? label);
const englishPart = { 上: 'first part', 中: 'middle part', 下: 'last part' };
const englishNumber = (value: number | string, unit: string) =>
  `${englishUnits[unit] ?? (unit.startsWith('regex:') ? 'Number' : unit)} ${value}`;
const numberedLabel = (value: number | string, label: string) =>
  label.startsWith('正则：') ? `编号${value}` : `第${value}${label}`;

export async function checkContinuity(
  snapshot: DocumentSnapshot,
  options: ContinuityOptions = DEFAULT_CONTINUITY_OPTIONS,
  checkpoint: Checkpoint = async () => {},
): Promise<ContinuityResult> {
  if (
    !['book', 'volume'].includes(options.scope) ||
    !Array.isArray(options.units) ||
    options.units.some((unit) => typeof unit !== 'string') ||
    typeof options.strictParts !== 'boolean'
  )
    throw new LocalizedError('编号检查设置无效。', 'Invalid numbering check settings.');
  const result: ContinuityResult = {
    documentId: snapshot.documentId,
    revision: snapshot.revision,
    optionsKey: continuityKey(options),
    issues: [],
    unparsed: [],
    splits: [],
    checkedCount: 0,
    excludedCount: 0,
  };
  const selected = new Set(options.units);
  const groups = new Map<string, { label: string; labelEn: string; sections: Section[] }>();
  const containers: Section[] = [];
  for (let index = 0; index < snapshot.sections.length; index++) {
    const section = snapshot.sections[index];
    const number = section.numbering;
    if (section.lineIndex !== null && number) {
      const boundary =
        options.scope === 'volume'
          ? [...containers].reverse().find((item) => item.level < section.level)
          : undefined;
      if (!selected.has(number.unit)) result.excludedCount++;
      else if (number.value === null) result.unparsed.push(section.id);
      else {
        result.checkedCount++;
        const key = JSON.stringify([number.unit, section.level, boundary?.id ?? 'book']);
        const group = groups.get(key) ?? {
          label: `${boundary?.title ?? '全书'} · ${number.label}（层级 ${section.level}）`,
          labelEn: `${boundary?.title ?? 'Whole book'} · ${englishNumberingUnit(number.unit, number.label)} (level ${section.level})`,
          sections: [],
        };
        group.sections.push(section);
        groups.set(key, group);
      }
      if (number.unit === '卷' || number.unit === '册') {
        while (containers.length && containers[containers.length - 1].level >= section.level)
          containers.pop();
        containers.push(section);
      }
    }
    if (index % 1000 === 0) await checkpoint((0.3 * index) / Math.max(1, snapshot.sections.length));
  }
  let processed = 0,
    processedGroups = 0;
  for (const [key, group] of groups) {
    const byNumber = new Map<number, Section[]>();
    let previous: Section | undefined;
    const add = (
      kind: 'gap' | 'duplicate' | 'order',
      token: string,
      message: string,
      messageEn: string,
      sections: Section[],
    ) =>
      result.issues.push({
        id: `${key}:${kind}:${token}`,
        kind,
        message,
        messageEn,
        scope: group.label,
        scopeEn: group.labelEn,
        sectionIds: sections.map((section) => section.id),
      });
    for (const section of group.sections) {
      const number = section.numbering!;
      const entries = byNumber.get(number.value!) ?? [];
      entries.push(section);
      byNumber.set(number.value!, entries);
      if (previous && number.value! < previous.numbering!.value!)
        add(
          'order',
          section.id,
          `${numberedLabel(number.value!, number.label)}出现在${numberedLabel(previous.numbering!.value!, number.label)}之后`,
          `${englishNumber(number.value!, number.unit)} appears after ${englishNumber(previous.numbering!.value!, number.unit)}.`,
          [previous, section],
        );
      else if (
        previous &&
        !options.strictParts &&
        number.value === previous.numbering!.value &&
        number.part &&
        previous.numbering!.part &&
        '上中下'.indexOf(number.part) < '上中下'.indexOf(previous.numbering!.part!)
      )
        add(
          'order',
          section.id,
          `${numberedLabel(number.value!, number.label)}分篇顺序异常：${previous.numbering!.part} → ${number.part}`,
          `${englishNumber(number.value!, number.unit)} has parts out of order: ${englishPart[previous.numbering!.part!]} → ${englishPart[number.part]}.`,
          [previous, section],
        );
      previous = section;
      if (++processed % 1000 === 0)
        await checkpoint(0.3 + (0.5 * processed) / Math.max(1, result.checkedCount));
    }
    for (const [value, entries] of byNumber) {
      if (entries.length < 2) continue;
      const parts = new Set(entries.map((section) => section.numbering!.part));
      const allowed = !options.strictParts && !parts.has(undefined);
      if (allowed && parts.size === entries.length)
        result.splits.push({
          label: `${group.label} · ${numberedLabel(value, entries[0].numbering!.label)}（分篇）`,
          labelEn: `${group.labelEn} · ${englishNumber(value, entries[0].numbering!.unit)} (split parts)`,
          sectionIds: entries.map((section) => section.id),
        });
      else if (allowed) {
        for (const part of parts) {
          const repeated = entries.filter((section) => section.numbering!.part === part);
          if (repeated.length > 1)
            add(
              'duplicate',
              `${value}:${part}`,
              `${numberedLabel(value, entries[0].numbering!.label)}（${part}）出现 ${repeated.length} 次`,
              `${englishNumber(value, entries[0].numbering!.unit)} (${englishPart[part!]}) appears ${repeated.length} times.`,
              repeated,
            );
        }
      } else
        add(
          'duplicate',
          String(value),
          `${numberedLabel(value, entries[0].numbering!.label)}出现 ${entries.length} 次`,
          `${englishNumber(value, entries[0].numbering!.unit)} appears ${entries.length} times.`,
          entries,
        );
    }
    const values = [...byNumber.keys()].sort((a, b) => a - b);
    for (let index = 1; index < values.length; index++) {
      const before = values[index - 1],
        after = values[index];
      if (after - before > 1) {
        const range = `${before + 1}${after - before > 2 ? `–${after - 1}` : ''}`;
        add(
          'gap',
          `${before}:${after}`,
          `疑似缺少${numberedLabel(range, group.sections[0].numbering!.label)}（${after - before - 1} 个编号）`,
          `Possible gap: ${englishNumber(range, group.sections[0].numbering!.unit)}.`,
          [byNumber.get(before)![0], byNumber.get(after)![0]],
        );
      }
    }
    if (++processedGroups % 100 === 0) await checkpoint(0.85);
  }
  await checkpoint(1);
  return result;
}
