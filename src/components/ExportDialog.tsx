import { ArrowDownToLine, BookOpen } from 'lucide-react';
import Dialog from './Dialog';

interface Props {
  title: string;
  setTitle: (value: string) => void;
  author: string;
  setAuthor: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  sectionCount: number;
  onClose: () => void;
  onExport: () => void | Promise<void>;
}
export default function ExportDialog({
  title,
  setTitle,
  author,
  setAuthor,
  language,
  setLanguage,
  sectionCount,
  onClose,
  onExport,
}: Props) {
  return (
    <Dialog title="为故事，装订成书" onClose={onClose}>
      <p className="dialog-intro">检查书籍信息，导出带有多级目录的 EPUB3 文件。</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onExport();
        }}
      >
        <label className="form-field">
          书名 <span>必填</span>
          <input
            value={title}
            maxLength={200}
            required
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </label>
        <label className="form-field">
          作者 <span>选填</span>
          <input
            value={author}
            maxLength={200}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="填写作者姓名"
          />
        </label>
        <label className="form-field">
          书籍语言
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="zh-Hans">简体中文</option>
            <option value="zh-Hant">繁體中文</option>
            <option value="en">English</option>
          </select>
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
          自动去除段首空白和章末空行，保留段间换行。旧阅读器兼容性取决于具体软件或设备。
        </p>
        <button className="button primary export-confirm" type="submit" disabled={!title.trim()}>
          <ArrowDownToLine size={17} />
          生成并下载 EPUB
        </button>
      </form>
    </Dialog>
  );
}
