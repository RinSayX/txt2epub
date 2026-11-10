import { useLanguage } from '../i18n/LanguageProvider';
import { copy, describeError, localize, type Copy } from '../i18n/locale';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Corrections,
  DocumentSnapshot,
  Encoding,
  HeadingRule,
  Preview,
  RegexHeadingRule,
  RegexTestResult,
  ContinuityOptions,
  ContinuityResult,
} from '../core/types';
import { validateRules } from '../core/outline';
import { validateRegexRules } from '../core/regex';
import { DocumentClient } from '../workers/client';
import type { ExportResult, Request } from '../workers/protocol';
import { downloadEpub } from '../lib/download';
import { readPreferences, persistRules } from './preferences';
import { continuityKey, DEFAULT_CONTINUITY_OPTIONS } from '../core/continuity';

export function useDocumentSession() {
  const { locale } = useLanguage();
  const [preferences] = useState(readPreferences);
  const [rules, setRules] = useState<HeadingRule[]>(preferences.rules);
  const [appliedRules, setAppliedRules] = useState<HeadingRule[]>(preferences.rules);
  const [regexRules, setRegexRules] = useState<RegexHeadingRule[]>(preferences.regexRules);
  const [appliedRegexRules, setAppliedRegexRules] = useState<RegexHeadingRule[]>(
    preferences.regexRules,
  );
  const [maxLength, setMaxLength] = useState(preferences.maxLength);
  const [appliedMaxLength, setAppliedMaxLength] = useState(preferences.maxLength);
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importingFile, setImportingFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<Encoding>('auto');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'outline' | 'rules'>('outline');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [removeBlankLines, setRemoveBlankLines] = useState(false);
  const [corrections, setCorrections] = useState<Corrections>({ ignored: [], deleted: [] });
  const { ignored, deleted } = corrections;
  const [past, setPast] = useState<Corrections[]>([]);
  const [future, setFuture] = useState<Corrections[]>([]);
  const [busy, setBusy] = useState<{ label: string; progress: number } | null>(null);
  const [error, setError] = useState<Copy | ''>('');
  const [toast, setToast] = useState<Copy | ''>('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState('zh-CN');
  const [continuityOptions, setContinuityOptions] = useState<ContinuityOptions>(() =>
    structuredClone(DEFAULT_CONTINUITY_OPTIONS),
  );
  const [continuity, setContinuity] = useState<ContinuityResult | null>(null);
  const [confirmedNumbering, setConfirmedNumbering] = useState<Set<string>>(new Set());
  const [pendingImport, setPendingImport] = useState<{ file: File; encoding: Encoding } | null>(
    null,
  );
  const client = useRef<DocumentClient | null>(null);
  const locked = useRef(false);
  const dirty =
    JSON.stringify(rules) !== JSON.stringify(appliedRules) ||
    JSON.stringify(regexRules) !== JSON.stringify(appliedRegexRules) ||
    maxLength !== appliedMaxLength;
  const selected = snapshot?.sections.find((section) => section.id === selectedId);
  const selectedIndex = snapshot?.sections.findIndex((section) => section.id === selectedId) ?? -1;
  const emptySections =
    snapshot?.sections.filter((section) => section.lineIndex !== null && section.empty) ?? [];
  const correctionCount = ignored.length + deleted.length;
  const suspiciousCount = snapshot?.sections.filter((section) => section.suspicious).length ?? 0;

  useEffect(() => {
    const instance = new DocumentClient();
    client.current = instance;
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const perform = useCallback(async <T>(request: Request): Promise<T | null> => {
    if (locked.current || !client.current) return null;
    locked.current = true;
    setError('');
    setBusy({
      label:
        request.type === 'export'
          ? '生成 EPUB'
          : request.type === 'check-numbering'
            ? '检查章节编号'
            : '整理章节',
      progress: 0,
    });
    try {
      return await client.current.call<T>(request, (progress, label) =>
        setBusy({ progress, label }),
      );
    } catch (caught) {
      const message = describeError(caught, ['操作失败，请重试。', 'Operation failed. Try again.']);
      if (message[0] === '操作已取消') setToast(message);
      else setError(message);
      return null;
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    let stale = false;
    setContinuity(null);
    setConfirmedNumbering(new Set());
    if (snapshot)
      void perform<ContinuityResult>({
        type: 'check-numbering',
        documentId: snapshot.documentId,
        revision: snapshot.revision,
        options: continuityOptions,
      }).then((result) => {
        if (!stale && result) setContinuity(result);
      });
    return () => {
      stale = true;
    };
  }, [snapshot, continuityOptions, perform]);

  useEffect(() => {
    if (!snapshot || !selectedId || !client.current) {
      setPreview(null);
      return;
    }
    let stale = false;
    setPreview(null);
    setPreviewLoading(true);
    client.current
      .call<Preview>({ type: 'preview', sectionId: selectedId, offset: 0 })
      .then((result) => {
        if (!stale && result.revision === snapshot.revision) setPreview(result);
      })
      .catch((caught: Error) => {
        if (!stale)
          setError(describeError(caught, ['操作失败，请重试。', 'Operation failed. Try again.']));
      })
      .finally(() => {
        if (!stale) setPreviewLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [snapshot, selectedId]);

  async function importFile(nextFile: File, requestedEncoding: Encoding = encoding) {
    if (locked.current) return;
    if (!/\.txt$/i.test(nextFile.name)) {
      setError(copy('请选择 .txt 格式的小说文件。', 'Choose a .txt novel.'));
      return;
    }
    try {
      validateRules(rules, maxLength);
      validateRegexRules(regexRules);
    } catch (caught) {
      setError(describeError(caught, ['操作失败，请重试。', 'Operation failed. Try again.']));
      setTab('rules');
      return;
    }
    if (correctionCount || past.length || future.length) {
      setPendingImport({ file: nextFile, encoding: requestedEncoding });
      return;
    }
    await commitImport(nextFile, requestedEncoding);
  }
  async function commitImport(nextFile: File, requestedEncoding: Encoding) {
    setPendingImport(null);
    setImportingFile(nextFile);
    const result = await perform<DocumentSnapshot>({
      type: 'load',
      file: nextFile,
      encoding: requestedEncoding,
      rules,
      regexRules,
      maxTitleLength: maxLength,
    });
    setImportingFile(null);
    if (!result) return;
    const sameFile = file === nextFile;
    setFile(nextFile);
    setSnapshot(result);
    setEncoding(requestedEncoding);
    setSelectedId(result.sections[0]?.id ?? null);
    setCorrections({ ignored: [], deleted: [] });
    setPast([]);
    setFuture([]);
    setAppliedRules(structuredClone(rules));
    setAppliedRegexRules(structuredClone(regexRules));
    setAppliedMaxLength(maxLength);
    persistRules(rules, maxLength, regexRules);
    if (!sameFile) {
      setTitle(nextFile.name.replace(/\.txt$/i, ''));
      setAuthor('');
      setLanguage('zh-CN');
    }
    setTab('outline');
    setToast(
      result.headingCount
        ? copy(
            `已识别 ${result.headingCount} 个标题，开始整理你的故事吧。`,
            `Detected headings: ${result.headingCount}.`,
          )
        : copy(
            '未识别到标题，将按整本单章节导出。可在识别规则中调整。',
            'No headings found. Export will use one section unless you adjust the rules.',
          ),
    );
  }
  async function applyRules() {
    try {
      validateRules(rules, maxLength);
      validateRegexRules(regexRules);
    } catch (caught) {
      setError(describeError(caught, ['操作失败，请重试。', 'Operation failed. Try again.']));
      return;
    }
    if (snapshot) {
      const result = await perform<DocumentSnapshot>({
        type: 'analyze',
        rules,
        regexRules,
        ignored,
        deleted,
        maxTitleLength: maxLength,
      });
      if (!result) return;
      setSnapshot(result);
      setSelectedId((id) =>
        result.sections.some((section) => section.id === id)
          ? id
          : (result.sections[0]?.id ?? null),
      );
    } else if (regexRules.length) {
      const checked = await testRegexRules('');
      if (!checked) return;
    }
    setAppliedRules(structuredClone(rules));
    setAppliedRegexRules(structuredClone(regexRules));
    setAppliedMaxLength(maxLength);
    persistRules(rules, maxLength, regexRules);
    setToast(copy('识别规则已应用。', 'Recognition rules applied.'));
  }
  async function testRegexRules(sampleText?: string): Promise<RegexTestResult | null> {
    try {
      validateRules(rules, maxLength);
      validateRegexRules(regexRules);
    } catch (caught) {
      setError(describeError(caught, ['操作失败，请重试。', 'Operation failed. Try again.']));
      return null;
    }
    return perform<RegexTestResult>({
      type: 'test-rules',
      rules,
      regexRules,
      maxTitleLength: maxLength,
      ignored,
      deleted,
      sampleText,
    });
  }
  async function changeCorrections(
    next: Corrections,
    action: 'merge' | 'delete' | 'undo' | 'redo',
  ) {
    const result = await perform<DocumentSnapshot>({
      type: 'analyze',
      rules: appliedRules,
      regexRules: appliedRegexRules,
      ignored: next.ignored,
      deleted: next.deleted,
      maxTitleLength: appliedMaxLength,
    });
    if (!result) return;
    if (action === 'merge' || action === 'delete') {
      setPast((items) => [...items, corrections]);
      setFuture([]);
      const remainingIds = new Set(result.sections.map((section) => section.id));
      const previousId =
        action === 'delete' && selectedId && remainingIds.has(selectedId)
          ? selectedId
          : snapshot?.sections
              .slice(0, selectedIndex)
              .reverse()
              .find((section) => remainingIds.has(section.id))?.id;
      setSelectedId(
        previousId && remainingIds.has(previousId) ? previousId : (result.sections[0]?.id ?? null),
      );
      setToast(
        action === 'merge'
          ? copy(
              '已并入上一节，原标题行保留为正文。可点击撤销还原。',
              'Merged into the previous section. The original heading is now body text. You can undo this.',
            )
          : copy(
              `已删除 ${next.deleted.length - deleted.length} 个空章节，子章节已保留。可点击撤销还原。`,
              `Empty sections removed: ${next.deleted.length - deleted.length}. Subsections were kept. You can undo this.`,
            ),
      );
    } else if (action === 'undo') {
      setPast((items) => items.slice(0, -1));
      setFuture((items) => [...items, corrections]);
      setToast(copy('已撤销上一次纠错。', 'Edit undone.'));
    } else {
      setFuture((items) => items.slice(0, -1));
      setPast((items) => [...items, corrections]);
      setToast(copy('已重做纠错。', 'Edit redone.'));
    }
    setCorrections(next);
    setSnapshot(result);
    if (action === 'undo' || action === 'redo')
      setSelectedId((id) =>
        result.sections.some((section) => section.id === id)
          ? id
          : (result.sections[0]?.id ?? null),
      );
  }
  function changeIgnored(next: number[], action: 'merge') {
    return changeCorrections({ ignored: next, deleted }, action);
  }
  function deleteEmptySections(all = false) {
    if (locked.current || dirty) return;
    const targets = all
      ? emptySections
      : emptySections.filter((section) => section.id === selectedId);
    if (!targets.length) return;
    void changeCorrections(
      { ignored, deleted: [...deleted, ...targets.map((section) => section.lineIndex!)] },
      'delete',
    );
  }
  function undo() {
    if (past.length && !locked.current) void changeCorrections(past[past.length - 1], 'undo');
  }
  function redo() {
    if (future.length && !locked.current) void changeCorrections(future[future.length - 1], 'redo');
  }
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], dialog') || locked.current)
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  async function exportBook(cleanInvalidControls = false, coverPng?: Uint8Array) {
    if (!title.trim()) {
      setError(copy('请先填写书名。', 'Enter a book title first.'));
      return;
    }
    const result = await perform<ExportResult>({
      type: 'export',
      metadata: { title, author, language },
      cleanInvalidControls,
      removeBlankLines,
      coverPng,
    });
    if (!result) return;
    downloadEpub(result.bytes, title);
    setToast(
      copy(
        `《${title.trim()}》已生成，下载已开始。${cleanInvalidControls ? `已从导出内容清理 ${result.cleanedControlCount} 个不兼容控制字符，源 TXT 不变。` : ''}`,
        `“${title.trim()}” is ready. Download started.${cleanInvalidControls ? ` Unsupported control characters removed: ${result.cleanedControlCount}. The source TXT is intact.` : ''}`,
      ),
    );
  }
  async function morePreview() {
    if (!preview || preview.nextOffset === null || !client.current || previewLoading) return;
    const revision = preview.revision;
    const sectionId = preview.sectionId;
    setPreviewLoading(true);
    try {
      const result = await client.current.call<Preview>({
        type: 'preview',
        sectionId,
        offset: preview.nextOffset,
      });
      setPreview((previous) =>
        previous?.sectionId === sectionId &&
        previous.revision === revision &&
        result.revision === revision
          ? { ...result, text: previous.text + result.text }
          : previous,
      );
    } catch (caught) {
      setError(describeError(caught, ['操作失败，请重试。', 'Operation failed. Try again.']));
    } finally {
      setPreviewLoading(false);
    }
  }

  return {
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
    error: localize(error, locale),
    setError,
    toast: localize(toast, locale),
    setToast,
    title,
    setTitle,
    author,
    setAuthor,
    language,
    setLanguage,
    continuity:
      continuity &&
      continuity.documentId === snapshot?.documentId &&
      continuity.revision === snapshot.revision &&
      continuity.optionsKey === continuityKey(continuityOptions)
        ? continuity
        : null,
    continuityOptions,
    setContinuityOptions,
    confirmedNumbering,
    toggleNumberingConfirmation: (id: string) =>
      setConfirmedNumbering((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    pendingImport,
    setPendingImport,
    dirty,
    selected,
    selectedIndex,
    suspiciousCount,
    emptyCount: emptySections.length,
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
    cancel: () => client.current?.cancel(),
  };
}
