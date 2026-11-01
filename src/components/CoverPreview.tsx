import { useEffect, useRef, useState } from 'react';
import { COVER_HEIGHT, COVER_WIDTH, drawCover } from '../lib/cover';

export default function CoverPreview({ title }: { title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    if (title.trim()) {
      void document.fonts.ready.then(() => {
        if (!active) return;
        try {
          drawCover(canvas.current!, title);
        } catch (caught) {
          setError((caught as Error).message);
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
          aria-label={`自动封面预览：${title.trim()}`}
        />
      ) : (
        <p>请先填写书名以预览封面。</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
