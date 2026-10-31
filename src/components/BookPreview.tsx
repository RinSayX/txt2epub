import { useEffect, useRef } from 'react';
import { AlertCircle, ArrowDownToLine, LoaderCircle } from 'lucide-react';
import type { Preview, Section } from '../core/types';

interface Props {
  selected?: Section;
  selectedIndex: number;
  revision: number;
  headingCount: number;
  title: string;
  preview: Preview | null;
  previewLoading: boolean;
  fontSize: number;
  morePreview: () => void | Promise<void>;
}
export default function BookPreview({
  selected,
  selectedIndex,
  revision,
  headingCount,
  title,
  preview,
  previewLoading,
  fontSize,
  morePreview,
}: Props) {
  const paper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    paper.current?.scrollTo({ top: 0 });
  }, [selected?.id, revision]);
  return (
    <div className="paper-scroll" ref={paper}>
      {selected?.suspicious && (
        <div className="chapter-warning">
          <AlertCircle size={15} />
          <span>这个标题可能是正文引用。若识别有误，可将它并入上一节。</span>
        </div>
      )}
      <article className="book-page" style={{ fontSize }}>
        <div className="chapter-ornament">
          {String(Math.max(0, selectedIndex) + 1).padStart(2, '0')}
          <span />
        </div>
        <h2>{headingCount === 0 ? title : selected?.title}</h2>
        <div className="book-divider" />
        <div className="prose">
          {(preview?.text ? preview.text.split('\n') : []).map((line, index) => (
            <p className={!line ? 'blank-line' : ''} key={index}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>
        {previewLoading && (
          <div className="preview-loading">
            <LoaderCircle className="spin" size={18} />
            加载正文…
          </div>
        )}
        {preview && !preview.text && !previewLoading && (
          <p className="no-body">
            {selected?.lineIndex != null ? (
              <>
                本节没有直属正文，可点击“删除空章节”。
                <br />
                删除后仍会保留子章节，也可从目录选择后续章节。
              </>
            ) : (
              '当前文档没有正文可预览。'
            )}
          </p>
        )}
        {preview?.nextOffset !== null && preview && (
          <button
            className="button secondary load-more"
            disabled={previewLoading}
            onClick={morePreview}
          >
            继续加载本节正文
            <ArrowDownToLine size={14} />
          </button>
        )}
        <div className="page-end">· · ·</div>
      </article>
    </div>
  );
}
