import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { buildOutline } from '../../src/core/outline';
import { generateEpub } from '../../src/core/epub/generate';
import { DEFAULT_RULES } from '../../src/core/rules';

// Opt-in acceptance checks: npm run test:scale.
describe.skipIf(!process.env.RUN_SCALE)('desktop-sized novels', () => {
  const measurements: object[] = [];
  for (const sizeMiB of [1, 10, 20, 51]) {
    it(`processes ${sizeMiB} MiB of UTF-8 text without missing chapters or paragraphs`, async () => {
      const paragraph = '　　山间的风吹过旧日车站，故事从这里继续。<文字> & 符号不会丢失。\n';
      const targetSize = sizeMiB * 1024 * 1024;
      const bytesPerParagraph = new TextEncoder().encode(paragraph).length;
      const paragraphsPerChapter = 200;
      const chapterCount = Math.ceil(targetSize / (bytesPerParagraph * paragraphsPerChapter));
      const source = Array.from(
        { length: chapterCount },
        (_, index) => `第${index + 1}章 山间来信\n${paragraph.repeat(paragraphsPerChapter)}\n`,
      ).join('');
      const start = performance.now();
      const outline = await buildOutline(source, DEFAULT_RULES);
      const analyzed = performance.now();
      const bytes = await generateEpub(source, outline, {
        title: `规模验证 ${sizeMiB} MiB`,
        author: '',
        language: 'zh-Hans',
      });
      const exported = performance.now();
      expect(outline.headingCount).toBe(chapterCount);
      const files = unzipSync(bytes);
      const chapters = Object.entries(files).filter(([path]) => path.startsWith('OEBPS/text/'));
      const paragraphCount = chapters.reduce(
        (sum, [, data]) => sum + (new TextDecoder().decode(data).match(/<p>/g) ?? []).length,
        0,
      );
      expect(paragraphCount).toBe(chapterCount * paragraphsPerChapter);
      const sourceBytes = new TextEncoder().encode(source).length;
      expect(sourceBytes).toBeGreaterThanOrEqual(targetSize);
      measurements.push({
        targetMiB: sizeMiB,
        sourceBytes,
        chapters: chapterCount,
        paragraphs: paragraphCount,
        analyzeMs: Math.round(analyzed - start),
        exportMs: Math.round(exported - analyzed),
        epubBytes: bytes.length,
      });
      mkdirSync('artifacts', { recursive: true });
      writeFileSync(
        'artifacts/scale-results.json',
        JSON.stringify(
          {
            runtime: process.version,
            platform: `${process.platform}/${process.arch}`,
            measurements,
          },
          null,
          2,
        ),
      );
      if (sizeMiB === 20 || sizeMiB === 51)
        writeFileSync(`artifacts/scale-${sizeMiB}MiB.epub`, bytes);
    }, 30000);
  }
  it('handles 16000 headings with a flat directory', async () => {
    const source = Array.from(
      { length: 16000 },
      (_, index) => `第${index + 1}章 章节\n正文\n\n`,
    ).join('');
    const outline = await buildOutline(source, DEFAULT_RULES);
    expect(outline.sections).toHaveLength(16000);
    const bytes = await generateEpub(source, outline, {
      title: '高章节数验证',
      author: '',
      language: 'zh-Hans',
    });
    const files = unzipSync(bytes);
    expect(Object.keys(files).filter((path) => path.startsWith('OEBPS/text/'))).toHaveLength(16000);
  }, 30000);
});
