import { useState, type DragEvent } from 'react';
import { ArrowRight, Leaf, Plus, Sparkles } from 'lucide-react';
import type { Encoding } from '../core/types';
import { DEMO_TEXT } from '../examples/sample-novel';

interface Props {
  disabled: boolean;
  onPickFile: () => void;
  onImport: (file: File, encoding?: Encoding) => void | Promise<void>;
}
export default function ImportPanel({ disabled, onPickFile, onImport }: Props) {
  const [dragging, setDragging] = useState(false);
  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void onImport(file);
  }
  return (
    <div
      className={`welcome ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="paper-art" aria-hidden="true">
        <div className="art-back" />
        <div className="art-page">
          <span className="art-mark">拾</span>
          <div className="art-line long" />
          <div className="art-line" />
          <div className="art-line long" />
          <div className="art-line short" />
          <div className="art-page-number">— 01 —</div>
        </div>
        <span className="art-leaf">
          <Leaf size={29} strokeWidth={1.3} />
        </span>
        <span className="art-badge">
          .txt <ArrowRight size={11} /> .epub
        </span>
      </div>
      <span className="welcome-kicker">每一个故事，都值得好好收藏</span>
      <h2>{dragging ? '松开，故事就从这里开始' : '把你的小说，放在这里'}</h2>
      <p>
        拖入 TXT 文件，或点击选择
        <br />
        自动识别章节，轻松整理成 EPUB 电子书
      </p>
      <button
        className="button primary upload-main"
        disabled={disabled}
        onClick={() => onPickFile()}
      >
        <Plus size={17} />
        选择 TXT 文件
      </button>
      <span className="file-limit">支持 UTF-8、GBK 等编码 · 超过 50 MiB 时提示，仍可导入</span>
      <button
        className="demo-button"
        disabled={disabled}
        onClick={() =>
          void onImport(new File([DEMO_TEXT], '山川来信.txt', { type: 'text/plain' }), 'auto')
        }
      >
        <Sparkles size={14} />
        没有文件？试用示例小说
        <ArrowRight size={13} />
      </button>
    </div>
  );
}
