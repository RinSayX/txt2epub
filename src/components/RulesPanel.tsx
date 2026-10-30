import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_RULES, type HeadingRule } from '../core/types';

interface Props {
  rules: HeadingRule[];
  onChange: (rules: HeadingRule[]) => void;
  maxLength: number;
  setMaxLength: (value: number) => void;
  dirty: boolean;
  disabled: boolean;
  onApply: () => void;
}

export default function RulesPanel({ rules, onChange, maxLength, setMaxLength, dirty, disabled, onApply }: Props) {
  const [keyword, setKeyword] = useState('');
  const [kind, setKind] = useState<'numbered' | 'unnumbered'>('numbered');
  const [message, setMessage] = useState('');
  const sorted = [...rules].sort((a, b) => a.level - b.level);
  function update(id: string, patch: Partial<HeadingRule>) { onChange(rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule)); }
  function move(rule: HeadingRule, delta: number) {
    const levels = [...new Set(rules.map((item) => item.level))].sort((a, b) => a - b);
    const target = levels[levels.indexOf(rule.level) + delta];
    if (target === undefined) return;
    onChange(rules.map((item) => item.level === rule.level ? { ...item, level: target } : item.level === target ? { ...item, level: rule.level } : item));
  }
  function add() {
    const value = keyword.trim();
    if (!value || value.length > 20 || /[\r\n]/.test(value)) { setMessage('请输入 1–20 个字符的关键词。'); return; }
    if (rules.some((rule) => rule.keyword === value && rule.kind === kind)) { setMessage('这个关键词已经存在。'); return; }
    if (rules.length >= 50) { setMessage('最多支持 50 条规则。'); return; }
    onChange([...rules, { id: crypto.randomUUID(), keyword: value, level: kind === 'numbered' ? 3 : 1, kind, enabled: true }]);
    setKeyword(''); setMessage('');
  }
  return <div className="rules-panel">
    <div className="rules-intro"><span className="eyebrow">让目录更懂你的故事</span><p>数字越小，层级越高。相同数字表示同级，调整后点击应用。</p></div>
    <fieldset disabled={disabled} className="rules-fieldset">
      <div className="rule-table-heading"><span>关键词 / 类型</span><span>层级</span><span>排序</span></div>
      <div className="rule-list">{sorted.map((rule) => <div className={`rule-row ${!rule.enabled ? 'muted' : ''}`} key={rule.id}>
        <label className="rule-key"><input type="checkbox" checked={rule.enabled} onChange={(event) => update(rule.id, { enabled: event.target.checked })} aria-label={`启用 ${rule.keyword}`} /><span>{rule.keyword}<small>{rule.kind === 'numbered' ? '第…' + rule.keyword : '无编号标题'}</small></span></label>
        <select aria-label={`${rule.keyword} 的层级`} value={rule.level} onChange={(event) => update(rule.id, { level: Number(event.target.value) })}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select>
        <div className="rule-actions"><button className="icon-button" title={`提高 ${rule.keyword} 的层级`} aria-label={`提高 ${rule.keyword} 的层级`} disabled={rule.level === Math.min(...rules.map((item) => item.level))} onClick={() => move(rule, -1)}><ArrowUp size={12} /></button><button className="icon-button" title={`降低 ${rule.keyword} 的层级`} aria-label={`降低 ${rule.keyword} 的层级`} disabled={rule.level === Math.max(...rules.map((item) => item.level))} onClick={() => move(rule, 1)}><ArrowDown size={12} /></button><button className="icon-button danger" title={`删除 ${rule.keyword}`} aria-label={`删除 ${rule.keyword}`} onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}><Trash2 size={12} /></button></div>
      </div>)}</div>
      <div className="add-rule"><label htmlFor="new-keyword">添加识别关键词</label><div className="new-rule-input"><input id="new-keyword" placeholder="例如：部、篇、终章" value={keyword} maxLength={20} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} /><button className="icon-button" aria-label="添加规则" onClick={add}><Plus size={17} /></button></div><select aria-label="新规则类型" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="numbered">编号标题：第…关键词</option><option value="unnumbered">无编号标题：关键词 / 关键词：副标题</option></select>{message && <p className="field-error" role="alert">{message}</p>}</div>
      <label className="max-length">标题长度上限<span><input type="number" min={4} max={500} value={Number.isNaN(maxLength) ? '' : maxLength} onChange={(event) => setMaxLength(event.target.valueAsNumber)} /> 字</span></label>
      <div className="rule-bottom"><button className="text-button" onClick={() => { onChange(structuredClone(DEFAULT_RULES)); setMaxLength(60); }}><RotateCcw size={13} />恢复默认</button><span>{dirty ? '有未应用的修改' : '规则已应用'}</span></div>
    </fieldset>
    <button className="button primary apply-rules" disabled={disabled || !dirty} onClick={onApply}>应用识别规则</button>
    <p className="rule-note">重新识别会保留当前文件中已取消的标题。</p>
  </div>;
}
