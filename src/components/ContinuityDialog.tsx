import { useMemo, useState } from 'react';
import type { ContinuityOptions, ContinuityResult, DocumentSnapshot } from '../core/types';
import Dialog from './Dialog';

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
const LABELS = { gap: '疑似缺号', duplicate: '重复', order: '顺序异常' };

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
                原文第 {(section.lineIndex ?? 0) + 1} 行 · {section.title}
              </button>
            )
          );
        })}
        {ids.length > count && (
          <button
            className="text-button"
            onClick={() => setReferenceLimits((previous) => ({ ...previous, [key]: count + 20 }))}
          >
            再显示 20 处（共 {ids.length} 处）
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
    <Dialog title="章节编号检查" onClose={onClose}>
      <p className="dialog-intro">
        检查当前有效目录。编号异常可能来自缺章、特殊编号或标题漏识别；标题与正文保持原样，仍可导出。
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <label className="form-field">
        编号范围
        <select
          value={options.scope}
          disabled={busy}
          onChange={(event) =>
            onOptions({ ...options, scope: event.target.value as ContinuityOptions['scope'] })
          }
        >
          <option value="book">全书连续</option>
          <option value="volume">按卷／册分别检查</option>
        </select>
      </label>
      <fieldset className="numbering-units" disabled={busy}>
        <legend>检测对象（不同类型及层级分别检查）</legend>
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
            {label}
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
          严格检查同号章节
          <small>
            关闭时，明确标记（上）（中）（下）的不同分篇允许共用编号；同一分篇重复仍提示。
          </small>
        </span>
      </label>
      {busy ? (
        <div className="numbering-progress" role="status">
          正在检查章节编号…
          <button className="text-button" onClick={onCancel}>
            取消检查
          </button>
        </div>
      ) : !result ? (
        <p className="export-note">
          检查尚未完成。
          <button className="text-button" onClick={() => onOptions({ ...options })}>
            重新检查
          </button>
        </p>
      ) : (
        <>
          <p className="numbering-counts" role="status">
            疑似缺号 {active.filter((issue) => issue.kind === 'gap').length} 处 · 重复{' '}
            {active.filter((issue) => issue.kind === 'duplicate').length} 组 · 顺序异常{' '}
            {active.filter((issue) => issue.kind === 'order').length} 处 · 未检查{' '}
            {result.unparsed.length} 个标题
          </p>
          <p className="export-note">
            已检查 {result.checkedCount} 个编号标题，范围外 {result.excludedCount} 个。分篇{' '}
            {result.splits.length} 组，已确认 {confirmed.size} 个问题。默认不要求从第 1
            章开始，无法判断末尾是否缺章。
          </p>
          <label className="form-field">
            筛选结果
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setLimit(50);
              }}
            >
              <option value="all">全部未确认问题</option>
              <option value="gap">疑似缺号</option>
              <option value="duplicate">重复编号</option>
              <option value="order">顺序异常</option>
              <option value="unparsed">未解析的编号</option>
              <option value="split">允许的分篇</option>
              <option value="confirmed">已确认问题</option>
            </select>
          </label>
          {count === 0 && (
            <p className="numbering-empty">
              {filter === 'all' ? '当前范围未发现待确认的编号异常。' : '此分类没有结果。'}
              {!result.checkedCount && ' 当前没有可检查的编号，请调整检测对象或识别规则。'}
            </p>
          )}
          <div className="numbering-results">
            {filter === 'unparsed'
              ? result.unparsed.slice(0, limit).map((id) => (
                  <article className="numbering-issue" key={id}>
                    <strong>无法明确解析编号</strong>
                    <p>提取值：{sections.get(id)?.numbering?.raw || '未提取到编号'}</p>
                    <p>请核对数字写法；自定义正则可用 number 命名捕获组提取编号。</p>
                    {links([id], id)}
                  </article>
                ))
              : filter === 'split'
                ? result.splits.slice(0, limit).map((group) => (
                    <article className="numbering-issue" key={group.label + group.sectionIds[0]}>
                      <strong>{group.label}</strong>
                      {links(group.sectionIds, group.label)}
                    </article>
                  ))
                : visible.slice(0, limit).map((issue) => (
                    <article className="numbering-issue" key={issue.id}>
                      <span className="numbering-kind">{LABELS[issue.kind]}</span>
                      <strong>{issue.message}</strong>
                      <p>{issue.scope}</p>
                      {links(issue.sectionIds, issue.id)}
                      <button className="text-button" onClick={() => onConfirm(issue.id)}>
                        {confirmed.has(issue.id) ? '恢复为待确认' : '标记已确认'}
                      </button>
                    </article>
                  ))}
          </div>
          {count > limit && (
            <button
              className="button secondary export-confirm"
              onClick={() => setLimit((value) => value + 50)}
            >
              再显示 50 条（共 {count} 条）
            </button>
          )}
        </>
      )}
      <p className="export-note">
        序章、尾声等无编号标题不打断序列。按卷／册检查时，仅更高层级的卷、册作为边界。调整设置或目录后自动重检并清除已确认标记；检查设置和确认仅在当前页面会话内有效。
      </p>
    </Dialog>
  );
}
