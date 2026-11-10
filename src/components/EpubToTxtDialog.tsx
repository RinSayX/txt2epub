import { progressText } from '../i18n/locale';
import { useLanguage, useText } from '../i18n/LanguageProvider';
import { useRef, useState, type DragEvent } from 'react';
import { ArrowDownToLine, FileText, Upload } from 'lucide-react';
import Dialog from './Dialog';
import LargeFileNotice from './LargeFileNotice';
import { useEpubConversion } from '../app/useEpubConversion';
import { downloadTxt } from '../lib/download';
import { formatBytes } from '../lib/format';

export default function EpubToTxtDialog({ onClose }: { onClose: () => void }) {
  const t = useText();
  const { locale } = useLanguage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { file, busy, result, error, downloaded, setDownloaded, convert, cancel } =
    useEpubConversion();
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files[0];
    if (selected) void convert(selected);
  }
  return (
    <Dialog title={t('EPUB 转 TXT', 'EPUB to TXT')} onClose={onClose}>
      <p className="dialog-intro">
        {t(
          '按电子书的阅读顺序提取标题和正文，在本地生成 UTF-8 文本。当前 TXT 工作台内容不受影响。',
          'Extract headings and text in reading order and create a UTF-8 file on this device. This runs separately from the TXT workspace.',
        )}
      </p>
      <div
        className={`epub-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={drop}
      >
        <FileText size={24} />
        <p>
          {file
            ? file.name
            : t('拖入 EPUB 电子书，或点击选择', 'Drop an EPUB here or choose a file')}
        </p>
        {file && <small>{formatBytes(file.size)}</small>}
        <button
          className="button secondary"
          disabled={!!busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} />
          {file
            ? t('重新选择 EPUB', 'Choose another EPUB')
            : t('选择 EPUB 文件', 'Choose EPUB file')}
        </button>
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept=".epub,application/epub+zip"
          aria-label={t('选择要转换的 EPUB', 'Select an EPUB to convert')}
          disabled={!!busy}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            event.target.value = '';
            if (selected) void convert(selected);
          }}
        />
      </div>
      <LargeFileNotice size={file?.size ?? 0} />
      {busy && (
        <div className="epub-progress" role="status" aria-live="polite">
          <p>
            {progressText(busy.label, locale)}… {Math.round(busy.progress * 100)}%
          </p>
          <progress
            aria-label={t('EPUB 转 TXT 进度', 'EPUB to TXT progress')}
            max={1}
            value={busy.progress}
          />
          <button className="text-button" onClick={cancel}>
            {t('取消转换', 'Cancel conversion')}
          </button>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="epub-result">
            <strong>{result.title}</strong>
            {result.author && (
              <p>
                {t('作者：', 'Author: ')}
                {result.author}
              </p>
            )}
            <p>
              {t(
                `已提取 ${result.documentCount} 个正文文档 · ${result.characterCount.toLocaleString('zh-CN')} 字符 · ${formatBytes(result.bytes.length)}`,
                `Documents: ${result.documentCount} · Characters: ${result.characterCount.toLocaleString('en')} · ${formatBytes(result.bytes.length)}`,
              )}
            </p>
            {result.skippedCount > 0 && (
              <small>
                {t(
                  `已略过 ${result.skippedCount} 个封面、目录、重复、非文字或空内容条目。`,
                  `Skipped entries: ${result.skippedCount} (covers, contents, duplicates, or entries without text).`,
                )}
              </small>
            )}
          </div>
          <label className="form-field">
            {t('文本预览（前 4,000 字符）', 'Text preview (first 4,000 characters)')}
            <textarea className="epub-text-preview" readOnly value={result.preview} rows={8} />
          </label>
          <button
            className="button primary export-confirm"
            onClick={() => {
              downloadTxt(result.bytes, result.title);
              setDownloaded(true);
            }}
          >
            <ArrowDownToLine size={17} />
            {t('下载 TXT', 'Download TXT')}
          </button>
          {downloaded && (
            <p className="epub-download-status" role="status">
              {t('TXT 已生成，下载已开始。', 'TXT is ready. Download started.')}
            </p>
          )}
        </>
      )}
      <p className="export-note">
        {t(
          '保留正文中已有的标题、段落和换行，不重复添加目录标题。略过封面、目录页、图片、脚本和样式，不加载外部资源；不保留视觉排版，也不进行图片文字识别。不支持 DRM 加密正文。',
          'Keeps existing headings, paragraphs and line breaks in the reading order. Skips covers, contents pages, images, scripts and styles. Does not load external resources, preserve visual layout, perform OCR or extract DRM-protected text.',
        )}
      </p>
    </Dialog>
  );
}
