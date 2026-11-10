import { describeError, localize, type Copy } from '../i18n/locale';
import { useLanguage, useText } from '../i18n/LanguageProvider';
import { ArrowDownToLine, BookOpen } from 'lucide-react';
import Dialog from './Dialog';
import { useEffect, useRef, useState } from 'react';
import CoverPreview from './CoverPreview';
import { createCoverPng } from '../lib/cover';

interface Props {
  title: string;
  setTitle: (value: string) => void;
  author: string;
  setAuthor: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  sectionCount: number;
  removeBlankLines: boolean;
  setRemoveBlankLines: (value: boolean) => void;
  onClose: () => void;
  onExport: (cleanInvalidControls: boolean, coverPng?: Uint8Array) => void | Promise<void>;
}
export default function ExportDialog({
  title,
  setTitle,
  author,
  setAuthor,
  language,
  setLanguage,
  sectionCount,
  removeBlankLines,
  setRemoveBlankLines,
  onClose,
  onExport,
}: Props) {
  const t = useText();
  const { locale } = useLanguage();
  const [cleanInvalidControls, setCleanInvalidControls] = useState(false);
  const [autoCover, setAutoCover] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Copy | ''>('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function submit() {
    if (generating || !title.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const cover = autoCover ? await createCoverPng(title) : undefined;
      if (active.current) await onExport(cleanInvalidControls, cover);
    } catch (caught) {
      if (active.current)
        setError(
          describeError(caught, [
            '封面生成失败，请重试。',
            'Could not generate the cover. Try again.',
          ]),
        );
    } finally {
      if (active.current) setGenerating(false);
    }
  }
  return (
    <Dialog title={t('为故事，装订成书', 'Export EPUB')} onClose={onClose}>
      <p className="dialog-intro">
        {t(
          '检查书籍信息，导出带有多级目录的 EPUB3 文件。',
          'Review book details and export an EPUB3 with nested contents.',
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          {t('书名', 'Book title ')}
          <span>{t('必填', 'Required')}</span>
          <input
            value={title}
            maxLength={200}
            required
            disabled={generating}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="export-cleanup">
          <input
            type="checkbox"
            checked={autoCover}
            disabled={generating}
            onChange={(event) => setAutoCover(event.target.checked)}
          />
          <span>
            {t('自动生成封面', 'Generate cover')}
            <small>
              {t(
                '书名必填。600 × 800 像素 PNG，白底黑字，书名居中偏上，过长自动换行，不额外添加书名号。',
                'Creates a 600 × 800 PNG with the book title in black on white. The title is centered toward the top and wraps as needed.',
              )}
            </small>
          </span>
        </label>
        {autoCover && <CoverPreview title={title} />}
        <label className="form-field">
          {t('作者', 'Author ')}
          <span>{t('选填', 'Optional')}</span>
          <input
            value={author}
            maxLength={200}
            disabled={generating}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder={t('填写作者姓名', 'Enter author name')}
          />
        </label>
        <label className="form-field">
          {t('书籍语言', 'Book language')}
          <select
            value={language}
            disabled={generating}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="zh-CN">{t('简体中文', 'Simplified Chinese')}</option>
            <option value="zh-Hant">{t('繁體中文', 'Traditional Chinese')}</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="export-cleanup">
          <input
            type="checkbox"
            checked={removeBlankLines}
            disabled={generating}
            onChange={(event) => setRemoveBlankLines(event.target.checked)}
          />
          <span>
            {t('清理段间空行', 'Remove blank lines')}
            <small>
              {t(
                '自动略过空白行，保留每个正文段落。与预览同步，源 TXT 不变。',
                'Skips blank lines in the preview and EPUB while keeping paragraphs separate. Your TXT file stays intact.',
              )}
            </small>
          </span>
        </label>
        <label className="export-cleanup">
          <input
            type="checkbox"
            checked={cleanInvalidControls}
            disabled={generating}
            onChange={(event) => setCleanInvalidControls(event.target.checked)}
          />
          <span>
            {t('清理不兼容的隐藏控制字符', 'Remove unsupported control characters')}
            <small>
              {t(
                '遇到 U+001A 等字符报错时可勾选。仅清理导出内容，源 TXT 和预览不变；保留正常文字、换行与制表符，完成后显示清理数量。',
                'Use this if export reports a character such as U+001A. This applies only to the export and preserves ordinary text, line breaks and tabs. The app reports how many characters were removed.',
              )}
            </small>
          </span>
        </label>
        <div className="export-summary">
          <BookOpen size={20} />
          <div>
            <strong>{t('EPUB3 电子书', 'EPUB3 ebook')}</strong>
            <p>
              {sectionCount}
              {t(
                '节内容 · 多级目录 · 附带旧式 NCX 导航',
                ' sections · Nested contents · Legacy NCX',
              )}
            </p>
          </div>
          <span>.epub</span>
        </div>
        <p className="export-note">
          {t(
            '自动去除段首空白和章末空行。',
            'Leading indentation and trailing blank lines are removed from chapters. ',
          )}
          {removeBlankLines
            ? t(
                '已开启段间空行清理，正文每段仍独立。',
                'Blank lines between paragraphs will be removed. ',
              )
            : t('保留段落之间的空行。', 'Blank lines between paragraphs will be kept. ')}
          {t(
            '导出不附带排版样式，字体、行距及段间距由阅读器决定。旧阅读器兼容性取决于具体软件或设备。',
            'Your reader controls the typography and spacing. Compatibility varies with older readers.',
          )}
        </p>
        {error && (
          <p className="export-note" role="alert">
            {localize(error, locale)}
          </p>
        )}
        <button
          className="button primary export-confirm"
          type="submit"
          disabled={!title.trim() || generating}
        >
          <ArrowDownToLine size={17} />
          {generating
            ? t('正在生成…', 'Generating…')
            : t('生成并下载 EPUB', 'Generate and download EPUB')}
        </button>
      </form>
    </Dialog>
  );
}
