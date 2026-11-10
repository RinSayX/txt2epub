import { useText } from '../i18n/LanguageProvider';
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
  const t = useText();
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
          <span className="art-mark">{t('拾', 'S')}</span>
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
      <span className="welcome-kicker">
        {t('每一个故事，都值得好好收藏', 'Give your story a place to stay')}
      </span>
      <h2>
        {dragging
          ? t('松开，故事就从这里开始', 'Drop to import your novel')
          : t('把你的小说，放在这里', 'Import a text novel')}
      </h2>
      <p>
        {t('拖入 TXT 文件，或点击选择', 'Drop a TXT file here or choose one')}
        <br />
        {t('自动识别章节，轻松整理成 EPUB 电子书', 'Recognize chapters and turn them into an EPUB')}
      </p>
      <button
        className="button primary upload-main"
        disabled={disabled}
        onClick={() => onPickFile()}
      >
        <Plus size={17} />
        {t('选择 TXT 文件', 'Choose TXT file')}
      </button>
      <span className="file-limit">
        {t(
          '支持 UTF-8、GBK 等编码 · 超过 50 MiB 时提示，仍可导入',
          'Supports UTF-8, GBK and more · A notice appears above 50 MiB',
        )}
      </span>
      <button
        className="demo-button"
        disabled={disabled}
        onClick={() =>
          void onImport(
            new File([DEMO_TEXT], t('山川来信.txt', 'Letters from the Mountains.txt'), {
              type: 'text/plain',
            }),
            'auto',
          )
        }
      >
        <Sparkles size={14} />
        {t('没有文件？试用示例小说', 'Try the sample novel')}
        <ArrowRight size={13} />
      </button>
    </div>
  );
}
