import { describe, expect, it, vi, afterEach } from 'vitest';
import { createCoverPng, drawCover } from '../../src/lib/cover';

function surface() {
  const painted: { text: string; x: number; y: number; size: number }[] = [];
  const context = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    fillRect: vi.fn(function (this: { fillStyle: string }) {
      expect(this.fillStyle).toBe('#ffffff');
    }),
    measureText(text: string) {
      return { width: Array.from(text).length * parseFloat(this.font) };
    },
    fillText(text: string, x: number, y: number) {
      painted.push({ text, x, y, size: parseFloat(this.font) });
    },
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, context, painted };
}

afterEach(() => vi.unstubAllGlobals());

describe('automatic cover', () => {
  it('paints an opaque white 600 × 800 cover with only the supplied title centered above the midpoint', () => {
    const { canvas, context, painted } = surface();
    drawCover(canvas, '  山河有归处  ');
    expect([canvas.width, canvas.height]).toEqual([600, 800]);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 600, 800);
    expect(context.fillStyle).toBe('#000000');
    expect(context.textAlign).toBe('center');
    expect(painted).toHaveLength(1);
    expect(painted[0].text).toBe('山河有归处');
    expect(painted[0].x).toBe(300);
    expect(painted[0].y).toBeLessThan(400);
  });

  it('wraps a 200-character title without losing text or overflowing the cover', () => {
    const title = '山河风雨'.repeat(50);
    const { canvas, painted } = surface();
    drawCover(canvas, title);
    expect(painted.length).toBeGreaterThan(1);
    expect(painted.map(({ text }) => text).join('')).toBe(title);
    for (const line of painted) {
      expect(line.text.length * line.size).toBeLessThanOrEqual(480);
      expect(line.x).toBe(300);
      expect(line.y - line.size / 2).toBeGreaterThan(0);
      expect(line.y + line.size / 2).toBeLessThan(400);
    }
  });

  it('does not break a grapheme or add book-title brackets', () => {
    const title = '山'.repeat(9) + '👨‍👩‍👧‍👦' + '河';
    const { canvas, painted } = surface();
    drawCover(canvas, title);
    expect(painted.map(({ text }) => text).join('')).toBe(title);
    expect(painted.some(({ text }) => text.includes('👨‍👩‍👧‍👦'))).toBe(true);
  });

  it('rejects blank titles and unavailable canvas rendering', async () => {
    expect(() => drawCover(surface().canvas, '  ')).toThrow('书名');
    await expect(createCoverPng('  ')).rejects.toThrow('书名');
    expect(() =>
      drawCover({ getContext: () => null } as unknown as HTMLCanvasElement, '书名'),
    ).toThrow('浏览器');
  });

  it('encodes PNG bytes and reports encoding failures instead of exporting without a requested cover', async () => {
    const { canvas } = surface();
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const toBlob = vi.fn((done: BlobCallback) => done(new Blob([bytes], { type: 'image/png' })));
    Object.assign(canvas, { toBlob });
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve() }, createElement: () => canvas });
    expect(await createCoverPng('书名')).toEqual(bytes);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    toBlob.mockImplementation((done) => done(null));
    await expect(createCoverPng('书名')).rejects.toThrow('PNG');
  });
});
