export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 800;
const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const TITLE_WIDTH = 480;
const TITLE_HEIGHT = 320;
const TITLE_CENTER_Y = 240;

export function drawCover(canvas: HTMLCanvasElement, title: string): void {
  const name = title.trim();
  if (!name) throw new Error('请填写书名后再生成封面。');
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法生成封面，请更换浏览器后重试。');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  context.fillStyle = '#000000';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const characters = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name),
    ({ segment }) => segment,
  );
  let fontSize = 60;
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
    if (fontSize <= 1) throw new Error('书名过长，无法完整绘制封面，请缩短书名。');
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
  if (!title.trim()) throw new Error('请填写书名后再生成封面。');
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  drawCover(canvas, title);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('PNG 封面生成失败，请重试。'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}
