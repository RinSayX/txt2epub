import { useText } from '../i18n/LanguageProvider';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_RULES } from '../core/rules';
import type { HeadingRule, RegexHeadingRule, RegexTestResult } from '../core/types';
import RegexRulesPanel from './RegexRulesPanel';

interface Props {
  rules: HeadingRule[];
  onChange: (rules: HeadingRule[]) => void;
  maxLength: number;
  setMaxLength: (value: number) => void;
  dirty: boolean;
  disabled: boolean;
  onApply: () => void;
  regexRules: RegexHeadingRule[];
  onRegexChange: (rules: RegexHeadingRule[]) => void;
  onTestRegex: (sampleText?: string) => Promise<RegexTestResult | null>;
  hasDocument: boolean;
  contextKey: string;
}

export default function RulesPanel({
  rules,
  onChange,
  maxLength,
  setMaxLength,
  dirty,
  disabled,
  onApply,
  regexRules,
  onRegexChange,
  onTestRegex,
  hasDocument,
  contextKey,
}: Props) {
  const t = useText();
  const [keyword, setKeyword] = useState('');
  const [kind, setKind] = useState<'numbered' | 'unnumbered'>('numbered');
  const [message, setMessage] = useState('');
  const sorted = [...rules].sort((a, b) => a.level - b.level);
  function update(id: string, patch: Partial<HeadingRule>) {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }
  function move(rule: HeadingRule, delta: number) {
    const levels = [...new Set(rules.map((item) => item.level))].sort((a, b) => a - b);
    const target = levels[levels.indexOf(rule.level) + delta];
    if (target === undefined) return;
    onChange(
      rules.map((item) =>
        item.level === rule.level
          ? { ...item, level: target }
          : item.level === target
            ? { ...item, level: rule.level }
            : item,
      ),
    );
  }
  function add() {
    const value = keyword.trim();
    if (!value || value.length > 20 || /[\r\n]/.test(value)) {
      setMessage(t('请输入 1–20 个字符的关键词。', 'Enter a keyword of 1–20 characters.'));
      return;
    }
    if (rules.some((rule) => rule.keyword === value && rule.kind === kind)) {
      setMessage(t('这个关键词已经存在。', 'This keyword already exists.'));
      return;
    }
    if (rules.length >= 50) {
      setMessage(t('最多支持 50 条规则。', 'You can use up to 50 rules.'));
      return;
    }
    onChange([
      ...rules,
      {
        id: crypto.randomUUID(),
        keyword: value,
        level: kind === 'numbered' ? 3 : 1,
        kind,
        enabled: true,
      },
    ]);
    setKeyword('');
    setMessage('');
  }
  return (
    <div className="rules-panel">
      <div className="rules-intro">
        <span className="eyebrow">{t('让目录更懂你的故事', 'Chapter recognition')}</span>
        <p>
          {t(
            '数字越小，层级越高。相同数字表示同级，调整后点击应用。',
            'Lower numbers indicate higher levels. Headings with the same number share a level. Apply the rules to update the contents.',
          )}
        </p>
      </div>
      <fieldset disabled={disabled} className="rules-fieldset">
        <div className="rule-table-heading">
          <span>{t('关键词 / 类型', 'Keyword / type')}</span>
          <span>{t('层级', 'Level')}</span>
          <span>{t('排序', 'Order')}</span>
        </div>
        <div className="rule-list">
          {sorted.map((rule) => (
            <div className={`rule-row ${!rule.enabled ? 'muted' : ''}`} key={rule.id}>
              <label className="rule-key">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => update(rule.id, { enabled: event.target.checked })}
                  aria-label={t(`启用 ${rule.keyword}`, `Enable ${rule.keyword}`)}
                />
                <span>
                  {rule.keyword}
                  <small>
                    {rule.kind === 'numbered'
                      ? '第…' + rule.keyword
                      : t('无编号标题', 'Unnumbered heading')}
                  </small>
                </span>
              </label>
              <select
                aria-label={t(`${rule.keyword} 的层级`, `Level of ${rule.keyword}`)}
                value={rule.level}
                onChange={(event) => update(rule.id, { level: Number(event.target.value) })}
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
              <div className="rule-actions">
                <button
                  className="icon-button"
                  title={t(`提高 ${rule.keyword} 的层级`, `Move ${rule.keyword} up`)}
                  aria-label={t(`提高 ${rule.keyword} 的层级`, `Move ${rule.keyword} up`)}
                  disabled={rule.level === Math.min(...rules.map((item) => item.level))}
                  onClick={() => move(rule, -1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  className="icon-button"
                  title={t(`降低 ${rule.keyword} 的层级`, `Move ${rule.keyword} down`)}
                  aria-label={t(`降低 ${rule.keyword} 的层级`, `Move ${rule.keyword} down`)}
                  disabled={rule.level === Math.max(...rules.map((item) => item.level))}
                  onClick={() => move(rule, 1)}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  className="icon-button danger"
                  title={t(`删除 ${rule.keyword}`, `Delete ${rule.keyword}`)}
                  aria-label={t(`删除 ${rule.keyword}`, `Delete ${rule.keyword}`)}
                  onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="add-rule">
          <label htmlFor="new-keyword">{t('添加识别关键词', 'Add a heading keyword')}</label>
          <div className="new-rule-input">
            <input
              id="new-keyword"
              placeholder={t('例如：部、篇、终章', 'e.g. Prologue, Epilogue')}
              value={keyword}
              maxLength={20}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <button
              className="icon-button"
              aria-label={t('添加规则', 'Add keyword rule')}
              onClick={add}
            >
              <Plus size={17} />
            </button>
          </div>
          <select
            aria-label={t('新规则类型', 'New rule type')}
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="numbered">
              {t('编号标题：第…关键词', 'Numbered: 第 + number + keyword')}
            </option>
            <option value="unnumbered">
              {t(
                '无编号标题：关键词 / 关键词：副标题',
                'Unnumbered: keyword or keyword with subtitle',
              )}
            </option>
          </select>
          {message && (
            <p className="field-error" role="alert">
              {message}
            </p>
          )}
        </div>
        <RegexRulesPanel
          rules={regexRules}
          onChange={onRegexChange}
          disabled={disabled}
          hasDocument={hasDocument}
          contextKey={contextKey}
          onTest={onTestRegex}
        />
        <label className="max-length">
          {t('标题长度上限', 'Maximum title length')}
          <span>
            <input
              type="number"
              min={4}
              max={500}
              value={Number.isNaN(maxLength) ? '' : maxLength}
              onChange={(event) => setMaxLength(event.target.valueAsNumber)}
            />{' '}
            {t('字', 'characters')}
          </span>
        </label>
        <div className="rule-bottom">
          <button
            className="text-button"
            onClick={() => {
              onChange(structuredClone(DEFAULT_RULES));
              onRegexChange([]);
              setMaxLength(60);
            }}
          >
            <RotateCcw size={13} />
            {t('恢复默认', 'Restore defaults')}
          </button>
          <span>
            {dirty ? t('有未应用的修改', 'Unapplied changes') : t('规则已应用', 'Rules applied')}
          </span>
        </div>
      </fieldset>
      <button
        className="button primary apply-rules"
        disabled={disabled || !dirty}
        onClick={onApply}
      >
        {t('应用识别规则', 'Apply rules')}
      </button>
      <p className="rule-note">
        {t(
          '重新识别会保留当前文件中已取消的标题。',
          'Rebuilding the contents preserves edits to headings in this file.',
        )}
      </p>
    </div>
  );
}
