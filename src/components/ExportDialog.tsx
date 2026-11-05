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
  const [cleanInvalidControls, setCleanInvalidControls] = useState(false);
  const [autoCover, setAutoCover] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
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
      if (active.current) setError((caught as Error).message);
    } finally {
      if (active.current) setGenerating(false);
    }
  }
  return (
    <Dialog title="为故事，装订成书" onClose={onClose}>
      <p className="dialog-intro">检查书籍信息，导出带有多级目录的 EPUB3 文件。</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          书名 <span>必填</span>
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
            自动生成封面
            <small>
              书名必填。600 × 800 像素 PNG，白底黑字，书名居中偏上，过长自动换行，不额外添加书名号。
            </small>
          </span>
        </label>
        {autoCover && <CoverPreview title={title} />}
        <label className="form-field">
          作者 <span>选填</span>
          <input
            value={author}
            maxLength={200}
            disabled={generating}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="填写作者姓名"
          />
        </label>
        <label className="form-field">
          书籍语言
          <select
            value={language}
            disabled={generating}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="zh-CN">简体中文</option>
            <option value="zh-Hant">繁體中文</option>
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
            清理段间空行
            <small>自动略过空白行，保留每个正文段落。与预览同步，源 TXT 不变。</small>
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
            清理不兼容的隐藏控制字符
            <small>
              遇到 U+001A 等字符报错时可勾选。仅清理导出内容，源 TXT
              和预览不变；保留正常文字、换行与制表符，完成后显示清理数量。
            </small>
          </span>
        </label>
        <div className="export-summary">
          <BookOpen size={20} />
          <div>
            <strong>EPUB3 电子书</strong>
            <p>{sectionCount} 节内容 · 多级目录 · 附带旧式 NCX 导航</p>
          </div>
          <span>.epub</span>
        </div>
        <p className="export-note">
          自动去除段首空白和章末空行。
          {removeBlankLines ? '已开启段间空行清理，正文每段仍独立。' : '保留段落之间的空行。'}
          导出不附带排版样式，字体、行距及段间距由阅读器决定。旧阅读器兼容性取决于具体软件或设备。
        </p>
        {error && (
          <p className="export-note" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary export-confirm"
          type="submit"
          disabled={!title.trim() || generating}
        >
          <ArrowDownToLine size={17} />
          {generating ? '正在生成…' : '生成并下载 EPUB'}
        </button>
      </form>
    </Dialog>
  );
}
