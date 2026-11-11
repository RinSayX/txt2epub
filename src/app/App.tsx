import { progressText } from '../i18n/locale';
import { useLanguage, useText } from '../i18n/LanguageProvider';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Github,
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
import EpubToTxtDialog from '../components/EpubToTxtDialog';
import ContinuityDialog from '../components/ContinuityDialog';
import { useDocumentSession } from './useDocumentSession';

const MOBILE_WORKSPACE = '(max-width: 760px)';

export default function App() {
  const t = useText();
  const { locale, setLocale } = useLanguage();
  const {
    rules,
    setRules,
    regexRules,
    setRegexRules,
    testRegexRules,
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
    continuity,
    continuityOptions,
    setContinuityOptions,
    confirmedNumbering,
    toggleNumberingConfirmation,
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
  const [dialog, setDialog] = useState<'export' | 'help' | 'epub-to-txt' | 'numbering' | null>(
    null,
  );
  const [revealTarget, setRevealTarget] = useState<{ id: string; token: number } | null>(null);
  const [mobileReaderDocumentId, setMobileReaderDocumentId] = useState<string | null>(null);
  const [mobileJump, setMobileJump] = useState<{ focusReader: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const readerTitleRef = useRef<HTMLSpanElement>(null);
  const mobilePanel =
    tab === 'rules'
      ? 'rules'
      : !snapshot || mobileReaderDocumentId === snapshot.documentId
        ? 'reader'
        : 'outline';

  useEffect(() => {
    if (!mobileJump) return;
    workspaceRef.current?.scrollIntoView({ block: 'start' });
    if (mobileJump.focusReader) readerTitleRef.current?.focus({ preventScroll: true });
  }, [mobileJump]);

  function openReader(id: string | null, focusReader = true) {
    if (id !== null) setSelectedId(id);
    if (!window.matchMedia(MOBILE_WORKSPACE).matches) return;
    setTab('outline');
    setMobileReaderDocumentId(snapshot?.documentId ?? null);
    setMobileJump({ focusReader });
  }

  function openMobileSidebar(panel: 'outline' | 'rules') {
    setTab(panel);
    setMobileReaderDocumentId(null);
    setMobileJump({ focusReader: false });
  }

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
          aria-label={t('拾页首页', 'Shiye home')}
          onClick={(event) => event.preventDefault()}
        >
          <span className="brand-icon">
            <BookOpen size={24} strokeWidth={1.6} />
          </span>
          <span>
            {t('拾页', 'Shiye')}
            {locale === 'zh-CN' && <span className="brand-en">SHIYE</span>}
          </span>
        </a>
        <div className="topbar-divider" />
        <span className="topbar-description">
          {t('小说格式转换工作台', 'Ebook conversion workspace')}
        </span>
        <div className="topbar-right">
          <button
            className="language-switch"
            onClick={() => setLocale(locale === 'en' ? 'zh-CN' : 'en')}
            aria-label={t('切换至英文界面', 'Switch interface to Chinese')}
          >
            <span lang={locale === 'en' ? 'zh-CN' : 'en'}>{locale === 'en' ? '中文' : 'EN'}</span>
          </button>
          <span className="privacy">
            <ShieldCheck size={15} />
            {t('文件仅在本地处理', 'Files stay on your device')}
          </span>
          <a
            className="github-link"
            href="https://github.com/RinSayX/txt2epub"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t(
              '在 GitHub 上为拾页点 Star（新标签页）',
              'Star Shiye on GitHub (opens in a new tab)',
            )}
          >
            <Github size={20} aria-hidden="true" />
          </a>
          <button
            className="help-button"
            aria-label={t('使用帮助', 'Help')}
            onClick={() => setDialog('help')}
          >
            <HelpCircle size={17} />
            <span>{t('使用帮助', 'Help')}</span>
          </button>
        </div>
      </header>

      <main className="main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="tiny-dot" />
              {t('TXT ↔ EPUB · 让文字自由流转', 'TXT ↔ EPUB · Convert locally')}
            </div>
            <h1>
              {snapshot
                ? t('故事已就绪，整理每一页。', 'Your book is ready to organize.')
                : t('让故事，成册。', 'Turn your text into an ebook.')}
            </h1>
            <p>
              {snapshot
                ? t(
                    '检查章节脉络，保留原文，然后带走一本属于你的电子书。',
                    'Review the chapters, then export your ebook.',
                  )
                : t(
                    '从一份纯文本，到一本有序的电子书。每一章，都恰到好处。',
                    'Organize a plain text novel and export it as an EPUB.',
                  )}
            </p>
          </div>
          <div className="page-actions">
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() => setDialog('epub-to-txt')}
            >
              <ArrowLeftRight size={16} />
              {t('EPUB 转 TXT', 'EPUB to TXT')}
            </button>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} />
              {snapshot ? t('更换 TXT', 'Replace TXT') : t('导入 TXT', 'Import TXT')}
            </button>
            <button
              className="button primary"
              disabled={!snapshot || !!busy || dirty}
              title={
                dirty
                  ? t('请先应用修改后的识别规则', 'Apply your rule changes first')
                  : t('导出 EPUB3 电子书', 'Export an EPUB3 ebook')
              }
              onClick={() => {
                setError('');
                setDialog('export');
              }}
            >
              <ArrowDownToLine size={17} />
              {t('导出 EPUB', 'Export EPUB')}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <input
          className="sr-only"
          type="file"
          accept=".txt,text/plain"
          ref={fileInput}
          aria-label={t('选择 TXT 小说', 'Select a TXT novel')}
          onChange={onFiles}
          disabled={!!busy}
        />

        {error && (
          <div className="notice error" role="alert">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label={t('关闭错误提示', 'Dismiss error')}
              onClick={() => setError('')}
            >
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
        {snapshot && (
          <div className="numbering-summary">
            <span>
              {continuity
                ? t(
                    `编号检查：${continuity.issues.filter((issue) => !confirmedNumbering.has(issue.id)).length} 个待确认问题 · ${continuity.unparsed.length} 个未解析标题`,
                    `Numbering: ${continuity.issues.filter((issue) => !confirmedNumbering.has(issue.id)).length} to review · ${continuity.unparsed.length} unparsed`,
                  )
                : t('编号检查尚未完成', 'Numbering check pending')}
            </span>
            <button
              className="text-button"
              disabled={!!busy && busy.label !== '检查章节编号'}
              onClick={() => setDialog('numbering')}
            >
              {t('查看编号检查', 'View numbering check')}
            </button>
          </div>
        )}
        {snapshot?.encodingUncertain && (
          <div className="notice info">
            <AlertCircle size={16} />
            <span>
              {t('当前编码为自动推测的', 'Detected encoding: ')}
              {snapshot.encoding.toUpperCase()}
              {t(
                '。请检查正文是否乱码，可在上方切换编码。',
                '. If the text looks garbled, try another encoding above.',
              )}
            </span>
          </div>
        )}
        {dirty && snapshot && (
          <div className="notice info">
            <Settings2 size={16} />
            <span>
              {t(
                '识别规则尚未应用，当前预览仍使用原规则。',
                'The preview still uses the previous rules. Apply your changes to update it.',
              )}
            </span>
            <button className="text-button" disabled={!!busy} onClick={applyRules}>
              {t('立即应用', 'Apply now')}
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        <section
          ref={workspaceRef}
          className={`workspace ${snapshot ? 'has-document' : ''}`}
          data-mobile-panel={mobilePanel}
          aria-label={t('小说整理工作台', 'Novel workspace')}
        >
          <div
            className="mobile-workspace-nav"
            role="group"
            aria-label={t('工作台视图', 'Workspace views')}
          >
            <button
              aria-pressed={snapshot ? mobilePanel === 'outline' : mobilePanel === 'reader'}
              onClick={() => openMobileSidebar('outline')}
            >
              {snapshot ? <ListTree size={17} /> : <Upload size={17} />}
              {snapshot ? t('章节目录', 'Contents') : t('导入文件', 'Import file')}
            </button>
            {snapshot && (
              <button
                aria-pressed={mobilePanel === 'reader'}
                onClick={() => openReader(selectedId, false)}
              >
                <BookOpen size={17} />
                {t('正文预览', 'Preview')}
              </button>
            )}
            <button
              aria-pressed={mobilePanel === 'rules'}
              onClick={() => openMobileSidebar('rules')}
            >
              <Settings2 size={17} />
              {t('识别规则', 'Rules')}
              {dirty && <span className="dirty-dot" />}
            </button>
          </div>
          <aside className="sidebar">
            <div className="sidebar-tabs">
              <button
                className={tab === 'outline' ? 'active' : ''}
                onClick={() => setTab('outline')}
              >
                <ListTree size={16} />
                {t('章节目录', 'Contents')}
                {snapshot && <span>{snapshot.sections.length}</span>}
              </button>
              <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>
                <Settings2 size={15} />
                {t('识别规则', 'Rules')}
                {dirty && <span className="dirty-dot" />}
              </button>
            </div>
            {tab === 'outline' ? (
              <OutlineList
                key={snapshot?.documentId ?? 'empty'}
                sections={snapshot?.sections ?? []}
                selectedId={selectedId}
                onSelect={openReader}
                revealTarget={revealTarget}
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
                regexRules={regexRules}
                onRegexChange={setRegexRules}
                onTestRegex={testRegexRules}
                hasDocument={!!snapshot}
                contextKey={JSON.stringify([
                  rules,
                  maxLength,
                  snapshot?.documentId,
                  snapshot?.revision,
                ])}
              />
            )}
          </aside>

          <div className="reader">
            <div className="reader-toolbar">
              <span ref={readerTitleRef} tabIndex={-1}>
                <BookOpen size={16} />
                {snapshot ? t('正文预览', 'Preview') : t('等待一份好故事', 'Waiting for a novel')}
              </span>
              <div className="reader-tools">
                {snapshot && (
                  <>
                    <button
                      className="icon-button"
                      title={t('缩小字号', 'Decrease font size')}
                      aria-label={t('缩小字号', 'Decrease font size')}
                      disabled={fontSize <= 14}
                      onClick={() => setFontSize((size) => size - 2)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-size">{fontSize}</span>
                    <button
                      className="icon-button"
                      title={t('放大字号', 'Increase font size')}
                      aria-label={t('放大字号', 'Increase font size')}
                      disabled={fontSize >= 26}
                      onClick={() => setFontSize((size) => size + 2)}
                    >
                      <Plus size={14} />
                    </button>
                    <span className="tool-divider" />
                    <button
                      className="icon-button"
                      title={t('撤销纠错（⌘/Ctrl Z）', 'Undo edit (⌘/Ctrl Z)')}
                      aria-label={t('撤销纠错', 'Undo edit')}
                      disabled={!past.length || !!busy}
                      onClick={undo}
                    >
                      <Undo2 size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title={t('重做纠错（⌘/Ctrl Shift Z）', 'Redo edit (⌘/Ctrl Shift Z)')}
                      aria-label={t('重做纠错', 'Redo edit')}
                      disabled={!future.length || !!busy}
                      onClick={redo}
                    >
                      <Redo2 size={17} />
                    </button>
                    <button
                      className="merge-button"
                      disabled={!emptyCount || !!busy || dirty}
                      onClick={() => deleteEmptySections(true)}
                      title={t(
                        '删除所有没有直属正文的标题，保留子章节；可撤销',
                        'Remove all headings with no body text. Subsections are kept. You can undo this.',
                      )}
                    >
                      <Trash2 size={14} />
                      {t('清理空章节', 'Remove empty sections')}
                      {emptyCount > 0 && `（${emptyCount}）`}
                    </button>
                  </>
                )}
                <span className="preview-label">
                  {snapshot
                    ? removeBlankLines
                      ? t('已清理段首空白及正文空行', 'Indentation and blank lines removed')
                      : t('已清理段首和章末空白', 'Leading and trailing whitespace cleaned')
                    : t('你的文件，始终在你手中', 'Your files stay on your device')}
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
                    {t('清理段间空行', 'Remove blank lines')}
                  </label>
                  <span>
                    {t(
                      '自动应用于预览和导出，保留正常段落分隔',
                      'Applies to preview and export. Paragraphs stay separate.',
                    )}
                  </span>
                </div>
                <div className="chapter-bar">
                  <div className="chapter-location">
                    <span>
                      {selected?.lineIndex === null
                        ? t('卷首内容', 'Front matter')
                        : t(
                            `原文第 ${(selected?.lineIndex ?? 0) + 1} 行`,
                            `Source line ${(selected?.lineIndex ?? 0) + 1}`,
                          )}
                    </span>
                    <ChevronRight size={13} />
                    <strong>
                      {snapshot.headingCount === 0
                        ? title
                        : selected?.lineIndex === null
                          ? t('简介', 'Introduction')
                          : selected?.title}
                    </strong>
                  </div>
                  <div className="chapter-actions">
                    <button
                      className="merge-button"
                      disabled={selected?.lineIndex == null || !selected.empty || !!busy || dirty}
                      onClick={() => deleteEmptySections()}
                      title={t(
                        '删除当前空标题，保留子章节；可撤销',
                        'Remove this empty heading. Subsections are kept. You can undo this.',
                      )}
                    >
                      <Trash2 size={14} />
                      {t('删除空章节', 'Remove empty section')}
                    </button>
                    <button
                      className="merge-button"
                      disabled={selected?.lineIndex == null || !!busy || dirty}
                      onClick={() => {
                        if (selected?.lineIndex != null)
                          void changeIgnored([...ignored, selected.lineIndex], 'merge');
                      }}
                      title={t(
                        '取消此标题，标题行和正文并入前一节，保留子章节',
                        'Merge this heading and its text into the previous section. Subsections are kept.',
                      )}
                    >
                      <Merge size={14} />
                      {t('并入上一节', 'Merge into previous')}
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
                    onClick={() => openReader(snapshot.sections[selectedIndex - 1].id)}
                  >
                    <ArrowLeft size={14} />
                    {t('上一节', 'Previous')}
                  </button>
                  <span>
                    {selectedIndex + 1} / {snapshot.sections.length}
                    {correctionCount > 0 && (
                      <em>{t(`已纠正 ${correctionCount} 处`, `Edits: ${correctionCount}`)}</em>
                    )}
                  </span>
                  <button
                    className="text-button"
                    disabled={selectedIndex >= snapshot.sections.length - 1}
                    onClick={() => openReader(snapshot.sections[selectedIndex + 1].id)}
                  >
                    {t('下一节', 'Next')}
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
              {suspiciousCount
                ? t(`${suspiciousCount} 个标题建议检查`, `Titles to review: ${suspiciousCount}`)
                : t('章节已整理', 'Chapters organized')}
              <i />
              {t('支持多级目录与旧式 NCX 导航', 'Nested contents and legacy NCX navigation')}
            </span>
          ) : (
            <div className="workflow-steps">
              <span>
                <b>01</b>
                {t('导入纯文本', 'Import text')}
              </span>
              <ArrowRight size={13} />
              <span>
                <b>02</b>
                {t('整理章节', 'Organize chapters')}
              </span>
              <ArrowRight size={13} />
              <span>
                <b>03</b>
                {t('导出电子书', 'Export ebook')}
              </span>
            </div>
          )}
          <span className="privacy-note">
            <ShieldCheck size={14} />
            {t('无需注册 · 无需上传', 'No account or uploads')}
          </span>
        </div>
      </main>
      <footer className="site-footer">
        <span>
          {t('拾页 SHIYE', 'Shiye')}
          <span className="footer-dot">·</span>
          {t('让阅读，回归文字本身。', 'Local ebook converter')}
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
              {progressText(busy.label, locale)}…<span>{Math.round(busy.progress * 100)}%</span>
            </strong>
            <div className="progress-track">
              <div style={{ width: `${busy.progress * 100}%` }} />
            </div>
            <small>{t('文件始终保留在你的设备上', 'Your files stay on your device')}</small>
          </div>
          <button className="text-button" onClick={() => cancel()}>
            {t('取消', 'Cancel')}
          </button>
        </div>
      )}
      {toast && !busy && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label={t('关闭消息', 'Dismiss notification')}
            onClick={() => setToast('')}
          >
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
          onExport={(cleanInvalidControls, coverPng) => {
            if (title.trim()) setDialog(null);
            return exportBook(cleanInvalidControls, coverPng);
          }}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'epub-to-txt' && <EpubToTxtDialog onClose={() => setDialog(null)} />}
      {dialog === 'numbering' && snapshot && (
        <ContinuityDialog
          snapshot={snapshot}
          result={continuity}
          options={continuityOptions}
          onOptions={setContinuityOptions}
          confirmed={confirmedNumbering}
          error={error}
          onConfirm={toggleNumberingConfirmation}
          busy={!!busy}
          onCancel={cancel}
          onClose={() => setDialog(null)}
          onNavigate={(id) => {
            openReader(id);
            setTab('outline');
            setRevealTarget((previous) => ({ id, token: (previous?.token ?? 0) + 1 }));
            setDialog(null);
          }}
        />
      )}
      {pendingImport && (
        <Dialog
          title={t('重新导入文件？', 'Reimport the file?')}
          onClose={() => setPendingImport(null)}
        >
          <p className="dialog-intro">
            {t(
              `更换文件或编码将重置当前的 ${correctionCount} 处标题纠错及撤销记录。原 TXT 文件不会改变。`,
              `Changing the file or encoding resets your heading edits (${correctionCount}) and undo history. The source TXT stays intact.`,
            )}
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setPendingImport(null)}>
              {t('继续整理当前文件', 'Keep editing')}
            </button>
            <button
              className="button primary"
              onClick={() => void commitImport(pendingImport.file, pendingImport.encoding)}
            >
              {t('重新导入', 'Reimport')}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
