import { useText } from '../i18n/LanguageProvider';
import { ChevronDown, ChevronRight, FileText, Search, AlertCircle, ListTree } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Section } from '../core/types';

interface Props {
  sections: Section[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  revealTarget?: { id: string; token: number } | null;
}

const ROW_HEIGHT = 44;

export default function OutlineList({ sections, selectedId, onSelect, revealTarget }: Props) {
  const t = useText();
  const headingTitle = useCallback(
    (section: Section) =>
      section.lineIndex !== null
        ? section.title
        : sections.length > 1
          ? t('简介', 'Introduction')
          : t('正文', 'Text'),
    [sections.length, t],
  );
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(500);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!revealTarget) return;
    const byId = new Map(sections.map((section) => [section.id, section]));
    const ancestors = new Set<string>();
    let parent = byId.get(revealTarget.id)?.parentId;
    while (parent && !ancestors.has(parent)) {
      ancestors.add(parent);
      parent = byId.get(parent)?.parentId;
    }
    setQuery('');
    setCollapsed((previous) => new Set([...previous].filter((id) => !ancestors.has(id))));
  }, [revealTarget, sections]);
  const parents = useMemo(() => new Set(sections.map((section) => section.parentId)), [sections]);
  const visible = useMemo(() => {
    if (query.trim())
      return sections.filter((section) =>
        headingTitle(section).toLowerCase().includes(query.trim().toLowerCase()),
      );
    const hidden = new Set<string>();
    return sections.filter((section) => {
      if (section.parentId && (collapsed.has(section.parentId) || hidden.has(section.parentId))) {
        hidden.add(section.id);
        return false;
      }
      return true;
    });
  }, [sections, query, collapsed, headingTitle]);
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
    if (
      index * ROW_HEIGHT < el.scrollTop ||
      (index + 1) * ROW_HEIGHT > el.scrollTop + el.clientHeight
    )
      el.scrollTop = index * ROW_HEIGHT;
  }, [selectedId, visible, height]);
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const end = Math.min(visible.length, start + Math.ceil(height / ROW_HEIGHT) + 10);
  return (
    <>
      <div className="outline-search">
        <Search size={15} />
        <input
          aria-label={t('搜索章节', 'Search chapters')}
          placeholder={t('查找章节标题…', 'Find a chapter…')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          }}
        />
        <kbd>{t('查找', 'Find')}</kbd>
      </div>
      <div
        className="outline-scroll"
        ref={scrollRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        role="tree"
        aria-label={t('小说章节目录', 'Novel contents')}
      >
        {!sections.length ? (
          <div className="sidebar-empty">
            <ListTree size={30} strokeWidth={1.2} />
            <p>{t('故事的脉络，从这里开始', 'Your contents will appear here')}</p>
            <span>{t('导入 TXT 后自动生成章节目录', 'Import a TXT file to detect chapters')}</span>
          </div>
        ) : !visible.length ? (
          <div className="sidebar-empty">
            <Search size={24} />
            <p>{t('没有找到相关章节', 'No matching chapters')}</p>
            <span>{t('试试其他关键词', 'Try a different search')}</span>
          </div>
        ) : (
          <div style={{ height: visible.length * ROW_HEIGHT, position: 'relative' }}>
            {visible.slice(start, end).map((section, index) => (
              <div
                key={section.id}
                role="treeitem"
                aria-selected={selectedId === section.id}
                aria-level={section.depth + 1}
                aria-expanded={parents.has(section.id) ? !collapsed.has(section.id) : undefined}
                className={`outline-row ${selectedId === section.id ? 'selected' : ''}`}
                style={{ top: (start + index) * ROW_HEIGHT, paddingLeft: 14 + section.depth * 16 }}
              >
                {parents.has(section.id) ? (
                  <button
                    className="tree-toggle"
                    aria-label={t(
                      `${collapsed.has(section.id) ? '展开' : '折叠'} ${section.title}`,
                      `${collapsed.has(section.id) ? 'Expand' : 'Collapse'} ${section.title}`,
                    )}
                    onClick={() =>
                      setCollapsed((previous) => {
                        const next = new Set(previous);
                        if (next.has(section.id)) next.delete(section.id);
                        else next.add(section.id);
                        return next;
                      })
                    }
                  >
                    {collapsed.has(section.id) ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                ) : (
                  <FileText size={14} className="tree-file" />
                )}
                <button
                  className="tree-title"
                  onClick={() => onSelect(section.id)}
                  title={headingTitle(section)}
                >
                  {headingTitle(section)}
                </button>
                {section.suspicious && (
                  <span
                    className="suspicion"
                    title={t('可能是正文引用，请检查', 'Possible quotation. Check this heading.')}
                  >
                    <AlertCircle size={13} />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="outline-footer">
        <span className="tiny-dot" />
        {sections.length
          ? t(
              `${sections.length} 节 · 按原文顺序排列`,
              `${sections.length} sections · In source order`,
            )
          : t('等待导入文件', 'Waiting for a file')}
        <button
          className="text-button"
          disabled={!sections.length}
          onClick={() =>
            setCollapsed(
              collapsed.size
                ? new Set()
                : new Set(
                    sections
                      .filter((section) => parents.has(section.id))
                      .map((section) => section.id),
                  ),
            )
          }
        >
          {collapsed.size ? t('展开全部', 'Expand all') : t('折叠全部', 'Collapse all')}
        </button>
      </div>
    </>
  );
}
