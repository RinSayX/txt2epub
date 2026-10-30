import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, FileText, HelpCircle, Leaf, ListTree, LoaderCircle, Merge, Minus, Plus, Redo2, Settings2, ShieldCheck, Sparkles, Undo2, Upload, X } from 'lucide-react';
import OutlineList from './components/OutlineList';
import RulesPanel from './components/RulesPanel';
import Dialog from './components/Dialog';
import { DEFAULT_RULES, FILE_LIMIT, type DocumentSnapshot, type Encoding, type HeadingRule, type Preview } from './core/types';
import { validateRules } from './core/outline';
import { formatBytes } from './core/text';
import { DocumentClient, type Request } from './worker-client';
import { DEMO_TEXT } from './demo';

const PREFERENCES_KEY = 'shiye.rules.v1';
function readPreferences(): { rules: HeadingRule[]; maxLength: number } {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null');
    if (parsed && Array.isArray(parsed.rules) && parsed.rules.every((rule: HeadingRule) => typeof rule.id === 'string' && typeof rule.keyword === 'string' && typeof rule.enabled === 'boolean')) {
      validateRules(parsed.rules, parsed.maxLength);
      return parsed;
    }
  } catch { /* Private browsing or invalid preferences: use safe defaults. */ }
  return { rules: structuredClone(DEFAULT_RULES), maxLength: 60 };
}
const numberLabel = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)} 万` : value.toLocaleString('zh-CN');
const ENCODINGS: { value: Encoding; label: string }[] = [
  { value: 'auto', label: '自动检测' }, { value: 'utf-8', label: 'UTF-8' },
  { value: 'gb18030', label: 'GB18030' }, { value: 'gbk', label: 'GBK' },
  { value: 'big5', label: 'Big5' }, { value: 'utf-16le', label: 'UTF-16 LE' }, { value: 'utf-16be', label: 'UTF-16 BE' },
];

export default function App() {
  const [preferences] = useState(readPreferences);
  const [rules, setRules] = useState<HeadingRule[]>(preferences.rules);
  const [appliedRules, setAppliedRules] = useState<HeadingRule[]>(preferences.rules);
  const [maxLength, setMaxLength] = useState(preferences.maxLength);
  const [appliedMaxLength, setAppliedMaxLength] = useState(preferences.maxLength);
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<Encoding>('auto');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'outline' | 'rules'>('outline');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [ignored, setIgnored] = useState<number[]>([]);
  const [past, setPast] = useState<number[][]>([]);
  const [future, setFuture] = useState<number[][]>([]);
  const [busy, setBusy] = useState<{ label: string; progress: number } | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState('zh-Hans');
  const [dialog, setDialog] = useState<'export' | 'help' | null>(null);
  const [pendingImport, setPendingImport] = useState<{ file: File; encoding: Encoding } | null>(null);
  const client = useRef<DocumentClient | null>(null);
  const locked = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(rules) !== JSON.stringify(appliedRules) || maxLength !== appliedMaxLength;
  const selected = snapshot?.sections.find((section) => section.id === selectedId);
  const selectedIndex = snapshot?.sections.findIndex((section) => section.id === selectedId) ?? -1;
  const suspiciousCount = snapshot?.sections.filter((section) => section.suspicious).length ?? 0;

  useEffect(() => { const instance = new DocumentClient(); client.current = instance; return () => { instance.dispose(); client.current = null; }; }, []);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timeout); }, [toast]);

  const perform = useCallback(async <T,>(request: Request): Promise<T | null> => {
    if (locked.current || !client.current) return null;
    locked.current = true;
    setError(''); setBusy({ label: request.type === 'export' ? '生成 EPUB' : '整理章节', progress: 0 });
    try {
      return await client.current.call<T>(request, (progress, label) => setBusy({ progress, label }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '操作失败，请重试。';
      if (message === '操作已取消') setToast(message); else setError(message);
      return null;
    } finally { locked.current = false; setBusy(null); }
  }, []);

  useEffect(() => {
    if (!snapshot || !selectedId || !client.current) { setPreview(null); return; }
    let stale = false;
    setPreview(null); setPreviewLoading(true);
    paper.current?.scrollTo({ top: 0 });
    client.current.call<Preview>({ type: 'preview', sectionId: selectedId, offset: 0 }).then((result) => { if (!stale && result.revision === snapshot.revision) setPreview(result); }).catch((caught: Error) => { if (!stale) setError(caught.message); }).finally(() => { if (!stale) setPreviewLoading(false); });
    return () => { stale = true; };
  }, [snapshot, selectedId]);

  async function importFile(nextFile: File, requestedEncoding: Encoding = encoding) {
    if (locked.current) return;
    if (!/\.txt$/i.test(nextFile.name)) { setError('请选择 .txt 格式的小说文件。'); return; }
    if (nextFile.size > FILE_LIMIT) { setError('文件超过 20 MiB，请缩小文件后重新导入。'); return; }
    try { validateRules(rules, maxLength); } catch (caught) { setError((caught as Error).message); setTab('rules'); return; }
    if (ignored.length || past.length || future.length) { setPendingImport({ file: nextFile, encoding: requestedEncoding }); return; }
    await commitImport(nextFile, requestedEncoding);
  }
  async function commitImport(nextFile: File, requestedEncoding: Encoding) {
    setPendingImport(null);
    const result = await perform<DocumentSnapshot>({ type: 'load', file: nextFile, encoding: requestedEncoding, rules, maxTitleLength: maxLength });
    if (!result) return;
    const sameFile = file === nextFile;
    setFile(nextFile); setSnapshot(result); setEncoding(requestedEncoding);
    setSelectedId(result.sections[0]?.id ?? null);
    setIgnored([]); setPast([]); setFuture([]);
    setAppliedRules(structuredClone(rules)); setAppliedMaxLength(maxLength);
    persistRules(rules, maxLength);
    if (!sameFile) { setTitle(nextFile.name.replace(/\.txt$/i, '')); setAuthor(''); setLanguage('zh-Hans'); }
    setTab('outline');
    setToast(result.headingCount ? `已识别 ${result.headingCount} 个标题，开始整理你的故事吧。` : '未识别到标题，将按整本单章节导出。可在识别规则中调整。');
  }
  function persistRules(nextRules: HeadingRule[], length: number) {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ rules: nextRules, maxLength: length })); } catch { /* Session functionality remains available. */ }
  }
  async function applyRules() {
    try { validateRules(rules, maxLength); } catch (caught) { setError((caught as Error).message); return; }
    if (snapshot) {
      const result = await perform<DocumentSnapshot>({ type: 'analyze', rules, ignored, maxTitleLength: maxLength });
      if (!result) return;
      setSnapshot(result); setSelectedId((id) => result.sections.some((section) => section.id === id) ? id : result.sections[0]?.id ?? null);
    }
    setAppliedRules(structuredClone(rules)); setAppliedMaxLength(maxLength); persistRules(rules, maxLength); setToast('识别规则已应用。');
  }
  async function changeIgnored(next: number[], action: 'merge' | 'undo' | 'redo') {
    const result = await perform<DocumentSnapshot>({ type: 'analyze', rules: appliedRules, ignored: next, maxTitleLength: appliedMaxLength });
    if (!result) return;
    if (action === 'merge') {
      setPast((items) => [...items, ignored]); setFuture([]);
      const previousId = snapshot?.sections[Math.max(0, selectedIndex - 1)]?.id;
      setSelectedId(result.sections.some((section) => section.id === previousId) ? previousId! : result.sections[0]?.id ?? null);
      setToast('已并入上一节，原标题行保留为正文。可点击撤销还原。');
    } else if (action === 'undo') { setPast((items) => items.slice(0, -1)); setFuture((items) => [...items, ignored]); setToast('已撤销上一次纠错。'); }
    else { setFuture((items) => items.slice(0, -1)); setPast((items) => [...items, ignored]); setToast('已重做纠错。'); }
    setIgnored(next); setSnapshot(result);
    if (action !== 'merge') setSelectedId((id) => result.sections.some((section) => section.id === id) ? id : result.sections[0]?.id ?? null);
  }
  function undo() { if (past.length && !locked.current) void changeIgnored(past[past.length - 1], 'undo'); }
  function redo() { if (future.length && !locked.current) void changeIgnored(future[future.length - 1], 'redo'); }
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], dialog') || locked.current) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  async function exportBook() {
    if (!title.trim()) { setError('请先填写书名。'); return; }
    setDialog(null);
    const bytes = await perform<Uint8Array>({ type: 'export', metadata: { title, author, language } });
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/epub+zip' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${title.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') || '小说'}.epub`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setToast(`《${title.trim()}》已生成，下载已开始。`);
  }
  async function morePreview() {
    if (!preview || preview.nextOffset === null || !client.current || previewLoading) return;
    const revision = preview.revision;
    const sectionId = preview.sectionId;
    setPreviewLoading(true);
    try {
      const result = await client.current.call<Preview>({ type: 'preview', sectionId, offset: preview.nextOffset });
      setPreview((previous) => previous?.sectionId === sectionId && previous.revision === revision && result.revision === revision ? { ...result, text: previous.text + result.text } : previous);
    } catch (caught) { setError((caught as Error).message); } finally { setPreviewLoading(false); }
  }
  function onFiles(event: ChangeEvent<HTMLInputElement>) { const selectedFile = event.target.files?.[0]; event.target.value = ''; if (selectedFile) void importFile(selectedFile); }
  function onDrop(event: DragEvent) { event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files[0]; if (dropped) void importFile(dropped); }

  return <div className="app-shell">
    <header className="topbar"><a href="#" className="brand" aria-label="拾页首页" onClick={(event) => event.preventDefault()}><span className="brand-icon"><BookOpen size={24} strokeWidth={1.6} /></span><span>拾页<span className="brand-en">SHIYE</span></span></a><div className="topbar-divider" /><span className="topbar-description">小说格式转换工作台</span><div className="topbar-right"><span className="privacy"><ShieldCheck size={15} />文件仅在本地处理</span><button className="help-button" aria-label="使用帮助" onClick={() => setDialog('help')}><HelpCircle size={17} /><span>使用帮助</span></button></div></header>

    <main className="main">
      <div className="page-heading"><div><div className="eyebrow"><span className="tiny-dot" />TXT TO EPUB · 把文字装订成书</div><h1>{snapshot ? '故事已就绪，整理每一页。' : '让故事，成册。'}</h1><p>{snapshot ? '检查章节脉络，保留原文，然后带走一本属于你的电子书。' : '从一份纯文本，到一本有序的电子书。每一章，都恰到好处。'}</p></div><div className="page-actions"><button className="button secondary" disabled={!!busy} onClick={() => fileInput.current?.click()}><Upload size={16} />{snapshot ? '更换 TXT' : '导入 TXT'}</button><button className="button primary" disabled={!snapshot || !!busy || dirty} title={dirty ? '请先应用修改后的识别规则' : '导出 EPUB3 电子书'} onClick={() => { setError(''); setDialog('export'); }}><ArrowDownToLine size={17} />导出 EPUB<ArrowRight size={15} /></button></div></div>
      <input className="sr-only" type="file" accept=".txt,text/plain" ref={fileInput} aria-label="选择 TXT 小说" onChange={onFiles} disabled={!!busy} />

      {error && <div className="notice error" role="alert"><AlertCircle size={17} /><span>{error}</span><button className="icon-button" aria-label="关闭错误提示" onClick={() => setError('')}><X size={16} /></button></div>}
      {snapshot && <div className="file-strip"><div className="file-symbol"><FileText size={20} /></div><div className="file-info"><strong title={snapshot.filename}>{snapshot.filename}</strong><span>{formatBytes(snapshot.size)}<i />{snapshot.lineCount.toLocaleString()} 行原文</span></div><div className="encoding-field"><label htmlFor="encoding">文本编码</label><select id="encoding" value={encoding} disabled={!!busy} onChange={(event) => { if (file) void importFile(file, event.target.value as Encoding); }}>{ENCODINGS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="encoding-detected">{snapshot.encoding.toUpperCase()}</span></div><div className="file-stats"><div><strong>{snapshot.headingCount}</strong><span>个标题</span></div><div><strong>{numberLabel(snapshot.characterCount)}</strong><span>字符</span></div><span className="local-status"><Check size={13} />本地文件</span></div></div>}
      {snapshot?.encodingUncertain && <div className="notice info"><AlertCircle size={16} /><span>当前编码为自动推测的 {snapshot.encoding.toUpperCase()}。请检查正文是否乱码，可在上方切换编码。</span></div>}
      {dirty && snapshot && <div className="notice info"><Settings2 size={16} /><span>识别规则尚未应用，当前预览仍使用原规则。</span><button className="text-button" disabled={!!busy} onClick={applyRules}>立即应用<ArrowRight size={13} /></button></div>}

      <section className={`workspace ${snapshot ? 'has-document' : ''}`} aria-label="小说整理工作台">
        <aside className="sidebar"><div className="sidebar-tabs"><button className={tab === 'outline' ? 'active' : ''} onClick={() => setTab('outline')}><ListTree size={16} />章节目录{snapshot && <span>{snapshot.sections.length}</span>}</button><button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}><Settings2 size={15} />识别规则{dirty && <span className="dirty-dot" />}</button></div>
          {tab === 'outline' ? <OutlineList key={snapshot?.documentId ?? 'empty'} sections={snapshot?.sections ?? []} selectedId={selectedId} onSelect={setSelectedId} /> : <RulesPanel rules={rules} onChange={setRules} maxLength={maxLength} setMaxLength={setMaxLength} dirty={dirty} disabled={!!busy} onApply={applyRules} />}
        </aside>

        <div className="reader"><div className="reader-toolbar"><span><BookOpen size={16} />{snapshot ? '正文预览' : '等待一份好故事'}</span><div className="reader-tools">{snapshot && <><button className="icon-button" title="缩小字号" aria-label="缩小字号" disabled={fontSize <= 14} onClick={() => setFontSize((size) => size - 2)}><Minus size={14} /></button><span className="font-size">{fontSize}</span><button className="icon-button" title="放大字号" aria-label="放大字号" disabled={fontSize >= 26} onClick={() => setFontSize((size) => size + 2)}><Plus size={14} /></button><span className="tool-divider" /><button className="icon-button" title="撤销纠错（⌘/Ctrl Z）" aria-label="撤销纠错" disabled={!past.length || !!busy} onClick={undo}><Undo2 size={17} /></button><button className="icon-button" title="重做纠错（⌘/Ctrl Shift Z）" aria-label="重做纠错" disabled={!future.length || !!busy} onClick={redo}><Redo2 size={17} /></button></>}<span className="preview-label">{snapshot ? '原始换行已保留' : '你的文件，始终在你手中'}</span></div></div>

          {!snapshot ? <div className={`welcome ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={onDrop}>
            <div className="paper-art" aria-hidden="true"><div className="art-back" /><div className="art-page"><span className="art-mark">拾</span><div className="art-line long" /><div className="art-line" /><div className="art-line long" /><div className="art-line short" /><div className="art-page-number">— 01 —</div></div><span className="art-leaf"><Leaf size={29} strokeWidth={1.3} /></span><span className="art-badge">.txt <ArrowRight size={11} /> .epub</span></div>
            <span className="welcome-kicker">每一个故事，都值得好好收藏</span><h2>{dragging ? '松开，故事就从这里开始' : '把你的小说，放在这里'}</h2><p>拖入 TXT 文件，或点击选择<br />自动识别章节，轻松整理成 EPUB 电子书</p><button className="button primary upload-main" disabled={!!busy} onClick={() => fileInput.current?.click()}><Plus size={17} />选择 TXT 文件</button><span className="file-limit">支持 UTF-8、GBK 等编码 · 最大 20 MiB</span><button className="demo-button" disabled={!!busy} onClick={() => void importFile(new File([DEMO_TEXT], '山川来信.txt', { type: 'text/plain' }), 'auto')}><Sparkles size={14} />没有文件？试用示例小说<ArrowRight size={13} /></button>
          </div> : <>
            <div className="chapter-bar"><div className="chapter-location"><span>{selected?.lineIndex === null ? '卷首内容' : `原文第 ${(selected?.lineIndex ?? 0) + 1} 行`}</span><ChevronRight size={13} /><strong>{snapshot.headingCount === 0 ? title : selected?.title}</strong></div><button className="merge-button" disabled={selected?.lineIndex == null || !!busy || dirty} onClick={() => { if (selected?.lineIndex != null) void changeIgnored([...ignored, selected.lineIndex], 'merge'); }} title="取消此标题，标题行和正文并入前一节，保留子章节"><Merge size={14} />并入上一节</button></div>
            <div className="paper-scroll" ref={paper}>
              {selected?.suspicious && <div className="chapter-warning"><AlertCircle size={15} /><span>这个标题可能是正文引用。若识别有误，可将它并入上一节。</span></div>}
              <article className="book-page" style={{ fontSize }}><div className="chapter-ornament">{String(Math.max(0, selectedIndex) + 1).padStart(2, '0')}<span /></div><h2>{snapshot.headingCount === 0 ? title : selected?.title}</h2><div className="book-divider" /><div className="prose">{preview?.text.split('\n').map((line, index) => <p className={!line ? 'blank-line' : ''} key={index}>{line || '\u00A0'}</p>)}</div>{previewLoading && <div className="preview-loading"><LoaderCircle className="spin" size={18} />加载正文…</div>}{preview && !preview.text && !previewLoading && <p className="no-body">本节为分组标题，没有直属正文。<br />请从目录选择后续章节。</p>}{preview?.nextOffset !== null && preview && <button className="button secondary load-more" disabled={previewLoading} onClick={morePreview}>继续加载本节正文<ArrowDownToLine size={14} /></button>}<div className="page-end">· · ·</div></article>
            </div>
            <div className="reader-footer"><button className="text-button" disabled={selectedIndex <= 0} onClick={() => setSelectedId(snapshot.sections[selectedIndex - 1].id)}><ArrowLeft size={14} />上一节</button><span>{selectedIndex + 1} / {snapshot.sections.length}{ignored.length > 0 && <em>已纠正 {ignored.length} 处</em>}</span><button className="text-button" disabled={selectedIndex >= snapshot.sections.length - 1} onClick={() => setSelectedId(snapshot.sections[selectedIndex + 1].id)}>下一节<ArrowRight size={14} /></button></div>
          </>}
        </div>
      </section>

      <div className="below-workspace">{snapshot ? <span><Check size={14} />{suspiciousCount ? `${suspiciousCount} 个标题建议检查` : '章节已整理'}<i />支持多级目录与旧式 NCX 导航</span> : <div className="workflow-steps"><span><b>01</b>导入纯文本</span><ArrowRight size={13} /><span><b>02</b>整理章节</span><ArrowRight size={13} /><span><b>03</b>带走电子书</span></div>}<span className="privacy-note"><ShieldCheck size={14} />无需注册 · 无需上传</span></div>
    </main>
    <footer className="site-footer"><span>拾页 SHIYE<span className="footer-dot">·</span>让阅读，回归文字本身。</span><span>MADE FOR YOUR STORIES</span></footer>

    {busy && <div className="progress-overlay" role="status" aria-live="polite"><div className="progress-icon"><LoaderCircle size={22} className="spin" /></div><div className="progress-copy"><strong>{busy.label}…<span>{Math.round(busy.progress * 100)}%</span></strong><div className="progress-track"><div style={{ width: `${busy.progress * 100}%` }} /></div><small>文件始终保留在你的设备上</small></div><button className="text-button" onClick={() => client.current?.cancel()}>取消</button></div>}
    {toast && !busy && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button className="icon-button" aria-label="关闭消息" onClick={() => setToast('')}><X size={14} /></button></div>}

    {dialog === 'export' && <Dialog title="为故事，装订成书" onClose={() => setDialog(null)}><p className="dialog-intro">检查书籍信息，导出带有多级目录的 EPUB3 文件。</p><form onSubmit={(event) => { event.preventDefault(); void exportBook(); }}><label className="form-field">书名 <span>必填</span><input value={title} maxLength={200} required onChange={(event) => setTitle(event.target.value)} autoFocus /></label><label className="form-field">作者 <span>选填</span><input value={author} maxLength={200} onChange={(event) => setAuthor(event.target.value)} placeholder="填写作者姓名" /></label><label className="form-field">书籍语言<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="zh-Hans">简体中文</option><option value="zh-Hant">繁體中文</option><option value="en">English</option></select></label><div className="export-summary"><BookOpen size={20} /><div><strong>EPUB3 电子书</strong><p>{snapshot?.sections.length} 节内容 · 多级目录 · 附带旧式 NCX 导航</p></div><span>.epub</span></div><p className="export-note">文字和原始换行将被保留。旧阅读器兼容性取决于具体软件或设备。</p><button className="button primary export-confirm" type="submit" disabled={!title.trim()}><ArrowDownToLine size={17} />生成并下载 EPUB</button></form></Dialog>}
    {dialog === 'help' && <Dialog title="从纯文本，到一本书" onClose={() => setDialog(null)}><div className="help-content"><p><b>1. 导入小说</b>选择不超过 20 MiB 的 TXT。如果预览出现乱码，在文件信息栏切换编码。</p><p><b>2. 调整章节</b>在“识别规则”配置关键词和层级，数字越小层级越高。点击应用后，目录会重新生成。</p><p><b>3. 纠正误判</b>选中误识别的标题，点击“并入上一节”。原标题行会保留为正文，子章节也会保留；支持撤销和重做。</p><p><b>4. 导出 EPUB</b>填写书名与可选作者，下载 EPUB3。附带 NCX 目录，实际兼容性请用目标阅读器确认。</p><div className="help-privacy"><ShieldCheck size={20} /><span>小说不上传，也不会保存到本地持久存储。刷新或关闭页面后需重新导入。仅识别规则会保存在当前浏览器。</span></div></div></Dialog>}
    {pendingImport && <Dialog title="重新导入文件？" onClose={() => setPendingImport(null)}><p className="dialog-intro">更换文件或编码将重置当前的 {ignored.length} 处标题纠错及撤销记录。原 TXT 文件不会改变。</p><div className="dialog-actions"><button className="button secondary" onClick={() => setPendingImport(null)}>继续整理当前文件</button><button className="button primary" onClick={() => void commitImport(pendingImport.file, pendingImport.encoding)}>重新导入</button></div></Dialog>}
  </div>;
}
