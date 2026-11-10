import { LocalizedError } from '../i18n/locale';
export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 800;
const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const TITLE_WIDTH = 480;
const TITLE_HEIGHT = 320;
const TITLE_CENTER_Y = 240;

export function drawCover(canvas: HTMLCanvasElement, title: string): void {
  const name = title.trim();
  if (!name)
    throw new LocalizedError(
      '请填写书名后再生成封面。',
      'Enter the book title before generating a cover.',
    );
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context)
    throw new LocalizedError(
      '当前浏览器无法生成封面，请更换浏览器后重试。',
      'This browser cannot generate a cover. Try another browser.',
    );
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  context.fillStyle = '#000000';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const characters = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name),
    ({ segment }) => segment,
  );
  let fontSize = 72;
  let lines: string[];
  // Measure the actual browser font; reduce its size until the entire title fits.
  for (;;) {
    context.font = `${fontSize}px ${FONT_FAMILY}`;
    lines = [];
    let line = '';
    for (const character of characters) {
      if (line && context.measureText(line + character).width > TITLE_WIDTH) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
    if (line) lines.push(line);
    if (
      lines.length * fontSize * 1.4 <= TITLE_HEIGHT &&
      lines.every((value) => context.measureText(value).width <= TITLE_WIDTH)
    )
      break;
    if (fontSize <= 1)
      throw new LocalizedError(
        '书名过长，无法完整绘制封面，请缩短书名。',
        'The title is too long to fit on the cover. Shorten it and try again.',
      );
    fontSize--;
  }
  const lineHeight = fontSize * 1.4;
  lines.forEach((line, index) => {
    context.fillText(
      line,
      COVER_WIDTH / 2,
      TITLE_CENTER_Y + (index - (lines.length - 1) / 2) * lineHeight,
    );
  });
}

export async function createCoverPng(title: string): Promise<Uint8Array> {
  if (!title.trim())
    throw new LocalizedError(
      '请填写书名后再生成封面。',
      'Enter the book title before generating a cover.',
    );
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  drawCover(canvas, title);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else
        reject(
          new LocalizedError(
            'PNG 封面生成失败，请重试。',
            'Could not generate the PNG cover. Try again.',
          ),
        );
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}
