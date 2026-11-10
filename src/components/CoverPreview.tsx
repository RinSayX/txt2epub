import { describeError, localize, type Copy } from '../i18n/locale';
import { useLanguage, useText } from '../i18n/LanguageProvider';
import { useEffect, useRef, useState } from 'react';
import { COVER_HEIGHT, COVER_WIDTH, drawCover } from '../lib/cover';

export default function CoverPreview({ title }: { title: string }) {
  const t = useText();
  const { locale } = useLanguage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<Copy | ''>('');
  useEffect(() => {
    let active = true;
    setError('');
    if (title.trim()) {
      void document.fonts.ready.then(() => {
        if (!active) return;
        try {
          drawCover(canvas.current!, title);
        } catch (caught) {
          setError(
            describeError(caught, [
              '封面生成失败，请重试。',
              'Could not generate the cover. Try again.',
            ]),
          );
        }
      });
    }
    return () => {
      active = false;
    };
  }, [title]);
  return (
    <div className="cover-preview">
      {title.trim() ? (
        <canvas
          ref={canvas}
          width={COVER_WIDTH}
          height={COVER_HEIGHT}
          role="img"
          aria-label={t(
            `自动封面预览：${title.trim()}`,
            `Generated cover preview: ${title.trim()}`,
          )}
        />
      ) : (
        <p>{t('请先填写书名以预览封面。', 'Enter a book title to preview the cover.')}</p>
      )}
      {error && <p role="alert">{localize(error, locale)}</p>}
    </div>
  );
}
