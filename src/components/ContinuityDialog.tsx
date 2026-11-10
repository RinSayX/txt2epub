import { useText } from '../i18n/LanguageProvider';
import { useMemo, useState } from 'react';
import type { ContinuityOptions, ContinuityResult, DocumentSnapshot } from '../core/types';
import Dialog from './Dialog';
import { englishNumberingUnit } from '../core/continuity';

interface Props {
  snapshot: DocumentSnapshot;
  result: ContinuityResult | null;
  options: ContinuityOptions;
  onOptions: (options: ContinuityOptions) => void;
  confirmed: Set<string>;
  onConfirm: (id: string) => void;
  busy: boolean;
  onCancel: () => void;
  onNavigate: (id: string) => void;
  onClose: () => void;
  error?: string;
}
const LABELS = {
  gap: ['疑似缺号', 'Possible gap'],
  duplicate: ['重复', 'Duplicate'],
  order: ['顺序异常', 'Out of order'],
} as const;

export default function ContinuityDialog({
  snapshot,
  result,
  options,
  onOptions,
  confirmed,
  onConfirm,
  busy,
  onCancel,
  onNavigate,
  onClose,
  error,
}: Props) {
  const t = useText();
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(50);
  const [referenceLimits, setReferenceLimits] = useState<Record<string, number>>({});
  const sections = useMemo(
    () => new Map(snapshot.sections.map((section) => [section.id, section])),
    [snapshot],
  );
  const choices = useMemo(() => {
    const units = new Map([
      ['章', '章'],
      ['回', '回'],
    ]);
    snapshot.sections.forEach((section) => {
      if (section.numbering) units.set(section.numbering.unit, section.numbering.label);
    });
    return [...units];
  }, [snapshot]);
  const issues = result?.issues ?? [];
  const active = issues.filter((issue) => !confirmed.has(issue.id));
  const visible = issues.filter((issue) =>
    filter === 'confirmed'
      ? confirmed.has(issue.id)
      : !confirmed.has(issue.id) && (filter === 'all' || filter === issue.kind),
  );
  const links = (ids: string[], key: string) => {
    const count = referenceLimits[key] ?? 20;
    return (
      <div className="numbering-links">
        {ids.slice(0, count).map((id) => {
          const section = sections.get(id);
          return (
            section && (
              <button key={id} className="text-button" onClick={() => onNavigate(id)}>
                {t(
                  `原文第 ${(section.lineIndex ?? 0) + 1} 行 · ${section.title}`,
                  `Source line ${(section.lineIndex ?? 0) + 1} · ${section.title}`,
                )}
              </button>
            )
          );
        })}
        {ids.length > count && (
          <button
            className="text-button"
            onClick={() => setReferenceLimits((previous) => ({ ...previous, [key]: count + 20 }))}
          >
            {t(`再显示 20 处（共 ${ids.length} 处）`, `Show 20 more (of ${ids.length})`)}
          </button>
        )}
      </div>
    );
  };
  const count =
    filter === 'unparsed'
      ? (result?.unparsed.length ?? 0)
      : filter === 'split'
        ? (result?.splits.length ?? 0)
        : visible.length;
  return (
    <Dialog title={t('章节编号检查', 'Chapter numbering check')} onClose={onClose}>
      <p className="dialog-intro">
        {t(
          '检查当前有效目录。编号异常可能来自缺章、特殊编号或标题漏识别；标题与正文保持原样，仍可导出。',
          'Check the current contents for possible missing, duplicate or out-of-order numbers. This check does not edit the book or block export.',
        )}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <label className="form-field">
        {t('编号范围', 'Numbering scope')}
        <select
          value={options.scope}
          disabled={busy}
          onChange={(event) =>
            onOptions({ ...options, scope: event.target.value as ContinuityOptions['scope'] })
          }
        >
          <option value="book">{t('全书连续', 'Whole book')}</option>
          <option value="volume">
            {t('按卷／册分别检查', 'Check each volume or book separately')}
          </option>
        </select>
      </label>
      <fieldset className="numbering-units" disabled={busy}>
        <legend>
          {t(
            '检测对象（不同类型及层级分别检查）',
            'Numbering types (checked separately by type and level)',
          )}
        </legend>
        {choices.map(([unit, label]) => (
          <label key={unit}>
            <input
              type="checkbox"
              checked={options.units.includes(unit)}
              onChange={(event) =>
                onOptions({
                  ...options,
                  units: event.target.checked
                    ? [...options.units, unit]
                    : options.units.filter((value) => value !== unit),
                })
              }
            />
            {t(label, englishNumberingUnit(unit, label))}
          </label>
        ))}
      </fieldset>
      <label className="export-cleanup">
        <input
          type="checkbox"
          checked={options.strictParts}
          disabled={busy}
          onChange={(event) => onOptions({ ...options, strictParts: event.target.checked })}
        />
        <span>
          {t('严格检查同号章节', 'Treat all repeated numbers as duplicates')}
          <small>
            {t(
              '关闭时，明确标记（上）（中）（下）的不同分篇允许共用编号；同一分篇重复仍提示。',
              'When off, distinct parts explicitly marked 上, 中 or 下 may share a number. A repeated part is still flagged.',
            )}
          </small>
        </span>
      </label>
      {busy ? (
        <div className="numbering-progress" role="status">
          {t('正在检查章节编号…', 'Checking chapter numbers…')}
          <button className="text-button" onClick={onCancel}>
            {t('取消检查', 'Cancel check')}
          </button>
        </div>
      ) : !result ? (
        <p className="export-note">
          {t('检查尚未完成。', 'The check has not finished.')}
          <button className="text-button" onClick={() => onOptions({ ...options })}>
            {t('重新检查', 'Run check again')}
          </button>
        </p>
      ) : (
        <>
          <p className="numbering-counts" role="status">
            {t(
              `疑似缺号 ${active.filter((issue) => issue.kind === 'gap').length} 处 · 重复 ${active.filter((issue) => issue.kind === 'duplicate').length} 组 · 顺序异常 ${active.filter((issue) => issue.kind === 'order').length} 处 · 未检查 ${result.unparsed.length} 个标题`,
              `Possible gaps: ${active.filter((issue) => issue.kind === 'gap').length} · Duplicates: ${active.filter((issue) => issue.kind === 'duplicate').length} · Out of order: ${active.filter((issue) => issue.kind === 'order').length} · Unparsed: ${result.unparsed.length}`,
            )}
          </p>
          <p className="export-note">
            {t(
              `已检查 ${result.checkedCount} 个编号标题，范围外 ${result.excludedCount} 个。分篇 ${result.splits.length} 组，已确认 ${confirmed.size} 个问题。默认不要求从第 1 章开始，无法判断末尾是否缺章。`,
              `Checked: ${result.checkedCount} · Out of scope: ${result.excludedCount} · Split groups: ${result.splits.length} · Reviewed: ${confirmed.size}. Sequences may start at any number. Missing final chapters cannot be inferred.`,
            )}
          </p>
          <label className="form-field">
            {t('筛选结果', 'Filter results')}
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setLimit(50);
              }}
            >
              <option value="all">{t('全部未确认问题', 'All unreviewed issues')}</option>
              <option value="gap">{t('疑似缺号', 'Possible gaps')}</option>
              <option value="duplicate">{t('重复编号', 'Duplicate numbers')}</option>
              <option value="order">{t('顺序异常', 'Out of order')}</option>
              <option value="unparsed">{t('未解析的编号', 'Unparsed numbers')}</option>
              <option value="split">{t('允许的分篇', 'Allowed split parts')}</option>
              <option value="confirmed">{t('已确认问题', 'Reviewed issues')}</option>
            </select>
          </label>
          {count === 0 && (
            <p className="numbering-empty">
              {filter === 'all'
                ? t(
                    '当前范围未发现待确认的编号异常。',
                    'No unreviewed numbering issues in this scope.',
                  )
                : t('此分类没有结果。', 'No results in this category.')}
              {!result.checkedCount &&
                t(
                  ' 当前没有可检查的编号，请调整检测对象或识别规则。',
                  ' No chapter numbers to check. Adjust the numbering types or recognition rules.',
                )}
            </p>
          )}
          <div className="numbering-results">
            {filter === 'unparsed'
              ? result.unparsed.slice(0, limit).map((id) => (
                  <article className="numbering-issue" key={id}>
                    <strong>{t('无法明确解析编号', 'Could not parse this number')}</strong>
                    <p>
                      {t('提取值：', 'Extracted value: ')}
                      {sections.get(id)?.numbering?.raw || t('未提取到编号', 'No number extracted')}
                    </p>
                    <p>
                      {t(
                        '请核对数字写法；自定义正则可用 number 命名捕获组提取编号。',
                        'Check the number format. A custom regex can extract the number with a named group called number.',
                      )}
                    </p>
                    {links([id], id)}
                  </article>
                ))
              : filter === 'split'
                ? result.splits.slice(0, limit).map((group) => (
                    <article className="numbering-issue" key={group.label + group.sectionIds[0]}>
                      <strong>{t(group.label, group.labelEn ?? group.label)}</strong>
                      {links(group.sectionIds, group.label)}
                    </article>
                  ))
                : visible.slice(0, limit).map((issue) => (
                    <article className="numbering-issue" key={issue.id}>
                      <span className="numbering-kind">
                        {t(LABELS[issue.kind][0], LABELS[issue.kind][1])}
                      </span>
                      <strong>{t(issue.message, issue.messageEn ?? issue.message)}</strong>
                      <p>{t(issue.scope, issue.scopeEn ?? issue.scope)}</p>
                      {links(issue.sectionIds, issue.id)}
                      <button className="text-button" onClick={() => onConfirm(issue.id)}>
                        {confirmed.has(issue.id)
                          ? t('恢复为待确认', 'Mark as unreviewed')
                          : t('标记已确认', 'Mark as reviewed')}
                      </button>
                    </article>
                  ))}
          </div>
          {count > limit && (
            <button
              className="button secondary export-confirm"
              onClick={() => setLimit((value) => value + 50)}
            >
              {t(`再显示 50 条（共 ${count} 条）`, `Show 50 more (of ${count})`)}
            </button>
          )}
        </>
      )}
      <p className="export-note">
        {t(
          '序章、尾声等无编号标题不打断序列。按卷／册检查时，仅更高层级的卷、册作为边界。调整设置或目录后自动重检并清除已确认标记；检查设置和确认仅在当前页面会话内有效。',
          'Unnumbered headings such as prologues and epilogues do not interrupt the sequence. In per-volume mode, only higher-level volumes or books start a new sequence. Changing the contents or settings reruns the check and clears review marks. Check settings and marks last for this session.',
        )}
      </p>
    </Dialog>
  );
}
