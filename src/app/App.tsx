import { useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  HelpCircle,
  ListTree,
  LoaderCircle,
  Merge,
  Minus,
  Plus,
  Redo2,
  Settings2,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import OutlineList from '../components/OutlineList';
import RulesPanel from '../components/RulesPanel';
import Dialog from '../components/Dialog';
import LargeFileNotice from '../components/LargeFileNotice';
import ImportPanel from '../components/ImportPanel';
import BookPreview from '../components/BookPreview';
import FileInfo from '../components/FileInfo';
import ExportDialog from '../components/ExportDialog';
import HelpDialog from '../components/HelpDialog';
import { useDocumentSession } from './useDocumentSession';

export default function App() {
  const {
    rules,
    setRules,
    maxLength,
    setMaxLength,
    snapshot,
    file,
    importingFile,
    encoding,
    selectedId,
    setSelectedId,
    tab,
    setTab,
    preview,
    previewLoading,
    removeBlankLines,
    setRemoveBlankLines,
    ignored,
    past,
    future,
    busy,
    error,
    setError,
    toast,
    setToast,
    title,
    setTitle,
    author,
    setAuthor,
    language,
    setLanguage,
    pendingImport,
    setPendingImport,
    dirty,
    selected,
    selectedIndex,
    suspiciousCount,
    emptyCount,
    correctionCount,
    deleteEmptySections,
    importFile,
    commitImport,
    applyRules,
    changeIgnored,
    undo,
    redo,
    exportBook,
    morePreview,
    cancel,
  } = useDocumentSession();
  const [fontSize, setFontSize] = useState(18);
  const [dialog, setDialog] = useState<'export' | 'help' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (selectedFile) void importFile(selectedFile);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          href="#"
          className="brand"
          aria-label="拾页首页"
          onClick={(event) => event.preventDefault()}
        >
          <span className="brand-icon">
            <BookOpen size={24} strokeWidth={1.6} />
          </span>
          <span>
            拾页<span className="brand-en">SHIYE</span>
          </span>
        </a>
        <div className="topbar-divider" />
        <span className="topbar-description">小说格式转换工作台</span>
        <div className="topbar-right">
          <span className="privacy">
            <ShieldCheck size={15} />
            文件仅在本地处理
          </span>
          <button className="help-button" aria-label="使用帮助" onClick={() => setDialog('help')}>
            <HelpCircle size={17} />
            <span>使用帮助</span>
          </button>
        </div>
      </header>

      <main className="main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="tiny-dot" />
              TXT TO EPUB · 把文字装订成书
            </div>
            <h1>{snapshot ? '故事已就绪，整理每一页。' : '让故事，成册。'}</h1>
            <p>
              {snapshot
                ? '检查章节脉络，保留原文，然后带走一本属于你的电子书。'
                : '从一份纯文本，到一本有序的电子书。每一章，都恰到好处。'}
            </p>
          </div>
          <div className="page-actions">
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} />
              {snapshot ? '更换 TXT' : '导入 TXT'}
            </button>
            <button
              className="button primary"
              disabled={!snapshot || !!busy || dirty}
              title={dirty ? '请先应用修改后的识别规则' : '导出 EPUB3 电子书'}
              onClick={() => {
                setError('');
                setDialog('export');
              }}
            >
              <ArrowDownToLine size={17} />
              导出 EPUB
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <input
          className="sr-only"
          type="file"
          accept=".txt,text/plain"
          ref={fileInput}
          aria-label="选择 TXT 小说"
          onChange={onFiles}
          disabled={!!busy}
        />

        {error && (
          <div className="notice error" role="alert">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button className="icon-button" aria-label="关闭错误提示" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        <LargeFileNotice size={(importingFile ?? file)?.size ?? 0} />
        {snapshot && (
          <FileInfo
            snapshot={snapshot}
            encoding={encoding}
            busy={!!busy}
            onEncodingChange={(value) => {
              if (file) void importFile(file, value);
            }}
          />
        )}
        {snapshot?.encodingUncertain && (
          <div className="notice info">
            <AlertCircle size={16} />
            <span>
              当前编码为自动推测的 {snapshot.encoding.toUpperCase()}
              。请检查正文是否乱码，可在上方切换编码。
            </span>
          </div>
        )}
        {dirty && snapshot && (
          <div className="notice info">
            <Settings2 size={16} />
            <span>识别规则尚未应用，当前预览仍使用原规则。</span>
            <button className="text-button" disabled={!!busy} onClick={applyRules}>
              立即应用
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        <section
          className={`workspace ${snapshot ? 'has-document' : ''}`}
          aria-label="小说整理工作台"
        >
          <aside className="sidebar">
            <div className="sidebar-tabs">
              <button
                className={tab === 'outline' ? 'active' : ''}
                onClick={() => setTab('outline')}
              >
                <ListTree size={16} />
                章节目录{snapshot && <span>{snapshot.sections.length}</span>}
              </button>
              <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>
                <Settings2 size={15} />
                识别规则{dirty && <span className="dirty-dot" />}
              </button>
            </div>
            {tab === 'outline' ? (
              <OutlineList
                key={snapshot?.documentId ?? 'empty'}
                sections={snapshot?.sections ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <RulesPanel
                rules={rules}
                onChange={setRules}
                maxLength={maxLength}
                setMaxLength={setMaxLength}
                dirty={dirty}
                disabled={!!busy}
                onApply={applyRules}
              />
            )}
          </aside>

          <div className="reader">
            <div className="reader-toolbar">
              <span>
                <BookOpen size={16} />
                {snapshot ? '正文预览' : '等待一份好故事'}
              </span>
              <div className="reader-tools">
                {snapshot && (
                  <>
                    <button
                      className="icon-button"
                      title="缩小字号"
                      aria-label="缩小字号"
                      disabled={fontSize <= 14}
                      onClick={() => setFontSize((size) => size - 2)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-size">{fontSize}</span>
                    <button
                      className="icon-button"
                      title="放大字号"
                      aria-label="放大字号"
                      disabled={fontSize >= 26}
                      onClick={() => setFontSize((size) => size + 2)}
                    >
                      <Plus size={14} />
                    </button>
                    <span className="tool-divider" />
                    <button
                      className="merge-button"
                      disabled={!emptyCount || !!busy || dirty}
                      onClick={() => deleteEmptySections(true)}
                      title="删除所有没有直属正文的标题，保留子章节；可撤销"
                    >
                      <Trash2 size={14} />
                      清理空章节{emptyCount > 0 && `（${emptyCount}）`}
                    </button>
                    <button
                      className="icon-button"
                      title="撤销纠错（⌘/Ctrl Z）"
                      aria-label="撤销纠错"
                      disabled={!past.length || !!busy}
                      onClick={undo}
                    >
                      <Undo2 size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="重做纠错（⌘/Ctrl Shift Z）"
                      aria-label="重做纠错"
                      disabled={!future.length || !!busy}
                      onClick={redo}
                    >
                      <Redo2 size={17} />
                    </button>
                  </>
                )}
                <span className="preview-label">
                  {snapshot
                    ? removeBlankLines
                      ? '已清理段首空白及正文空行'
                      : '已清理段首和章末空白'
                    : '你的文件，始终在你手中'}
                </span>
              </div>
            </div>

            {!snapshot ? (
              <ImportPanel
                disabled={!!busy}
                onPickFile={() => fileInput.current?.click()}
                onImport={importFile}
              />
            ) : (
              <>
                <div className="formatting-bar">
                  <label>
                    <input
                      type="checkbox"
                      checked={removeBlankLines}
                      disabled={!!busy}
                      onChange={(event) => setRemoveBlankLines(event.target.checked)}
                    />
                    清理段间空行
                  </label>
                  <span>自动应用于预览和导出，保留正常段落分隔</span>
                </div>
                <div className="chapter-bar">
                  <div className="chapter-location">
                    <span>
                      {selected?.lineIndex === null
                        ? '卷首内容'
                        : `原文第 ${(selected?.lineIndex ?? 0) + 1} 行`}
                    </span>
                    <ChevronRight size={13} />
                    <strong>{snapshot.headingCount === 0 ? title : selected?.title}</strong>
                  </div>
                  <div className="chapter-actions">
                    <button
                      className="merge-button"
                      disabled={selected?.lineIndex == null || !selected.empty || !!busy || dirty}
                      onClick={() => deleteEmptySections()}
                      title="删除当前空标题，保留子章节；可撤销"
                    >
                      <Trash2 size={14} />
                      删除空章节
                    </button>
                    <button
                      className="merge-button"
                      disabled={selected?.lineIndex == null || !!busy || dirty}
                      onClick={() => {
                        if (selected?.lineIndex != null)
                          void changeIgnored([...ignored, selected.lineIndex], 'merge');
                      }}
                      title="取消此标题，标题行和正文并入前一节，保留子章节"
                    >
                      <Merge size={14} />
                      并入上一节
                    </button>
                  </div>
                </div>
                <BookPreview
                  selected={selected}
                  selectedIndex={selectedIndex}
                  revision={snapshot.revision}
                  headingCount={snapshot.headingCount}
                  title={title}
                  preview={preview}
                  previewLoading={previewLoading}
                  fontSize={fontSize}
                  removeBlankLines={removeBlankLines}
                  morePreview={morePreview}
                />
                <div className="reader-footer">
                  <button
                    className="text-button"
                    disabled={selectedIndex <= 0}
                    onClick={() => setSelectedId(snapshot.sections[selectedIndex - 1].id)}
                  >
                    <ArrowLeft size={14} />
                    上一节
                  </button>
                  <span>
                    {selectedIndex + 1} / {snapshot.sections.length}
                    {correctionCount > 0 && <em>已纠正 {correctionCount} 处</em>}
                  </span>
                  <button
                    className="text-button"
                    disabled={selectedIndex >= snapshot.sections.length - 1}
                    onClick={() => setSelectedId(snapshot.sections[selectedIndex + 1].id)}
                  >
                    下一节
                    <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="below-workspace">
          {snapshot ? (
            <span>
              <Check size={14} />
              {suspiciousCount ? `${suspiciousCount} 个标题建议检查` : '章节已整理'}
              <i />
              支持多级目录与旧式 NCX 导航
            </span>
          ) : (
            <div className="workflow-steps">
              <span>
                <b>01</b>导入纯文本
              </span>
              <ArrowRight size={13} />
              <span>
                <b>02</b>整理章节
              </span>
              <ArrowRight size={13} />
              <span>
                <b>03</b>带走电子书
              </span>
            </div>
          )}
          <span className="privacy-note">
            <ShieldCheck size={14} />
            无需注册 · 无需上传
          </span>
        </div>
      </main>
      <footer className="site-footer">
        <span>
          拾页 SHIYE<span className="footer-dot">·</span>让阅读，回归文字本身。
        </span>
        <span>MADE FOR YOUR STORIES</span>
      </footer>

      {busy && (
        <div className="progress-overlay" role="status" aria-live="polite">
          <div className="progress-icon">
            <LoaderCircle size={22} className="spin" />
          </div>
          <div className="progress-copy">
            <strong>
              {busy.label}…<span>{Math.round(busy.progress * 100)}%</span>
            </strong>
            <div className="progress-track">
              <div style={{ width: `${busy.progress * 100}%` }} />
            </div>
            <small>文件始终保留在你的设备上</small>
          </div>
          <button className="text-button" onClick={() => cancel()}>
            取消
          </button>
        </div>
      )}
      {toast && !busy && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button className="icon-button" aria-label="关闭消息" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {dialog === 'export' && (
        <ExportDialog
          title={title}
          setTitle={setTitle}
          author={author}
          setAuthor={setAuthor}
          language={language}
          setLanguage={setLanguage}
          sectionCount={snapshot?.sections.length ?? 0}
          removeBlankLines={removeBlankLines}
          setRemoveBlankLines={setRemoveBlankLines}
          onClose={() => setDialog(null)}
          onExport={(cleanInvalidControls) => {
            if (title.trim()) setDialog(null);
            return exportBook(cleanInvalidControls);
          }}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {pendingImport && (
        <Dialog title="重新导入文件？" onClose={() => setPendingImport(null)}>
          <p className="dialog-intro">
            更换文件或编码将重置当前的 {correctionCount} 处标题纠错及撤销记录。原 TXT 文件不会改变。
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setPendingImport(null)}>
              继续整理当前文件
            </button>
            <button
              className="button primary"
              onClick={() => void commitImport(pendingImport.file, pendingImport.encoding)}
            >
              重新导入
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
