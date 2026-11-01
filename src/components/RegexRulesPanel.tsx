import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RegexHeadingRule, RegexTestResult } from '../core/types';
import { PREFIX_CHAPTER_PATTERN } from '../core/regex';

interface Props {
  rules: RegexHeadingRule[];
  onChange: (rules: RegexHeadingRule[]) => void;
  disabled: boolean;
  hasDocument: boolean;
  contextKey: string;
  onTest: (sampleText?: string) => Promise<RegexTestResult | null>;
}

export default function RegexRulesPanel({
  rules,
  onChange,
  disabled,
  hasDocument,
  contextKey,
  onTest,
}: Props) {
  const [sampleText, setSampleText] = useState(
    '233.第233章 比试\n233.普通编号列表\n234.第234章 归来',
  );
  const [result, setResult] = useState<RegexTestResult | null>(null);
  useEffect(() => setResult(null), [rules, sampleText, contextKey]);
  function update(id: string, patch: Partial<RegexHeadingRule>) {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }
  function add(example = false) {
    if (rules.length >= 20) return;
    onChange([
      ...rules,
      {
        id: crypto.randomUUID(),
        name: example ? '前置序号章节' : `正则规则 ${rules.length + 1}`,
        pattern: example ? PREFIX_CHAPTER_PATTERN : '',
        level: 3,
        enabled: true,
      },
    ]);
  }
  function move(index: number, delta: number) {
    const next = [...rules];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }
  return (
    <details className="regex-panel" open={rules.length > 0 ? true : undefined}>
      <summary>高级规则 · 自定义正则{rules.length > 0 && `（${rules.length}）`}</summary>
      <p className="regex-help">
        逐行匹配完整标题，按下面的顺序优先于关键词规则。表达式不加 / /，固定使用 Unicode 模式。可用{' '}
        <code>{'(?<title>...)'}</code> 提取显示标题，否则保留整行；原文不变。
      </p>
      {rules.map((rule, index) => (
        <div className="regex-rule" key={rule.id}>
          <div className="regex-rule-heading">
            <label>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(event) => update(rule.id, { enabled: event.target.checked })}
                aria-label={`启用正则规则 ${index + 1}`}
              />
              优先级 {index + 1}
            </label>
            <div className="rule-actions">
              <button
                className="icon-button"
                disabled={index === 0}
                aria-label={`提高正则规则 ${index + 1} 的优先级`}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="icon-button"
                disabled={index === rules.length - 1}
                aria-label={`降低正则规则 ${index + 1} 的优先级`}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={13} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`删除正则规则 ${index + 1}`}
                onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <label className="regex-field">
            名称
            <input
              aria-label={`正则规则 ${index + 1} 名称`}
              value={rule.name}
              maxLength={40}
              onChange={(event) => update(rule.id, { name: event.target.value })}
            />
          </label>
          <label className="regex-field">
            表达式
            <textarea
              aria-label={`正则规则 ${index + 1} 表达式`}
              rows={3}
              value={rule.pattern}
              maxLength={1000}
              spellCheck={false}
              onChange={(event) => update(rule.id, { pattern: event.target.value })}
              placeholder={String.raw`^[0-9]+\.(?<title>第[0-9]+章.*)$`}
            />
          </label>
          <label className="regex-level">
            章节层级
            <select
              aria-label={`正则规则 ${index + 1} 的层级`}
              value={rule.level}
              onChange={(event) => update(rule.id, { level: Number(event.target.value) })}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
      <div className="regex-buttons">
        <button className="text-button" disabled={rules.length >= 20} onClick={() => add()}>
          <Plus size={13} />
          添加正则规则
        </button>
        <button className="text-button" disabled={rules.length >= 20} onClick={() => add(true)}>
          添加前置序号示例
        </button>
      </div>
      <div className="regex-test">
        <label className="regex-field">
          测试文本
          <textarea
            aria-label="正则测试文本"
            value={sampleText}
            rows={3}
            maxLength={20000}
            onChange={(event) => setSampleText(event.target.value)}
          />
        </label>
        <div className="regex-buttons">
          <button
            className="text-button"
            disabled={disabled || !rules.length || !sampleText.trim()}
            onClick={async () => setResult(await onTest(sampleText))}
          >
            测试文本
          </button>
          <button
            className="text-button"
            disabled={disabled || !hasDocument || !rules.length}
            onClick={async () => setResult(await onTest())}
          >
            测试当前文件
          </button>
        </div>
        {result && (
          <div className="regex-result" role="status">
            <p>
              共识别 {result.headingCount} 个标题，正则命中 {result.regexMatchCount} 个。展示前 20
              条正则结果；测试不会应用规则。
            </p>
            {result.samples.map((sample) => (
              <div className="regex-sample" key={sample.lineIndex}>
                <small>
                  第 {sample.lineIndex + 1} 行 · {sample.ruleName} · 层级 {sample.level}
                </small>
                <span>{sample.original}</span>
                <strong>→ {sample.title}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
