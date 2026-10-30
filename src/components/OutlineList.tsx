import { ChevronDown, ChevronRight, FileText, Search, AlertCircle, ListTree } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Section } from '../core/types';

interface Props {
  sections: Section[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ROW_HEIGHT = 43;

export default function OutlineList({ sections, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(500);
  const scrollRef = useRef<HTMLDivElement>(null);
  const parents = useMemo(() => new Set(sections.map((section) => section.parentId)), [sections]);
  const visible = useMemo(() => {
    if (query.trim()) return sections.filter((section) => section.title.toLowerCase().includes(query.trim().toLowerCase()));
    const hidden = new Set<string>();
    return sections.filter((section) => {
      if (section.parentId && (collapsed.has(section.parentId) || hidden.has(section.parentId))) { hidden.add(section.id); return false; }
      return true;
    });
  }, [sections, query, collapsed]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const index = visible.findIndex((section) => section.id === selectedId);
    if (index < 0 || !scrollRef.current) return;
    const el = scrollRef.current;
    if (index * ROW_HEIGHT < el.scrollTop || (index + 1) * ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = index * ROW_HEIGHT;
  }, [selectedId, visible, height]);
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const end = Math.min(visible.length, start + Math.ceil(height / ROW_HEIGHT) + 10);
  return <>
    <div className="outline-search"><Search size={15} /><input aria-label="搜索章节" placeholder="查找章节标题…" value={query} onChange={(event) => { setQuery(event.target.value); if (scrollRef.current) scrollRef.current.scrollTop = 0; }} /><kbd>查找</kbd></div>
    <div className="outline-scroll" ref={scrollRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} role="tree" aria-label="小说章节目录">
      {!sections.length ? <div className="sidebar-empty"><ListTree size={30} strokeWidth={1.2} /><p>故事的脉络，从这里开始</p><span>导入 TXT 后自动生成章节目录</span></div> : !visible.length ? <div className="sidebar-empty"><Search size={24} /><p>没有找到相关章节</p><span>试试其他关键词</span></div> : <div style={{ height: visible.length * ROW_HEIGHT, position: 'relative' }}>
        {visible.slice(start, end).map((section, index) => <div key={section.id} role="treeitem" aria-selected={selectedId === section.id} aria-level={section.depth + 1} aria-expanded={parents.has(section.id) ? !collapsed.has(section.id) : undefined} className={`outline-row ${selectedId === section.id ? 'selected' : ''}`} style={{ top: (start + index) * ROW_HEIGHT, paddingLeft: 14 + section.depth * 16 }}>
          {parents.has(section.id) ? <button className="tree-toggle" aria-label={`${collapsed.has(section.id) ? '展开' : '折叠'} ${section.title}`} onClick={() => setCollapsed((previous) => { const next = new Set(previous); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}>{collapsed.has(section.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button> : <FileText size={14} className="tree-file" />}
          <button className="tree-title" onClick={() => onSelect(section.id)} title={section.title}>{section.title}</button>
          {section.suspicious && <span className="suspicion" title="可能是正文引用，请检查"><AlertCircle size={13} /></span>}
        </div>)}
      </div>}
    </div>
    <div className="outline-footer"><span className="tiny-dot" />{sections.length ? `${sections.length} 节 · 按原文顺序排列` : '等待导入文件'}<button className="text-button" disabled={!sections.length} onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(sections.filter((section) => parents.has(section.id)).map((section) => section.id)))}>{collapsed.size ? '展开全部' : '折叠全部'}</button></div>
  </>;
}
