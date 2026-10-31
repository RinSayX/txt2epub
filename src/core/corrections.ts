import { buildOutline } from './outline';
import type { Checkpoint, Corrections, HeadingRule } from './types';

// Keep every line separator so heading IDs and original line numbers stay stable.
// The source is immutable: undo/redo rebuilds this working copy from the source.
export async function buildCorrectedOutline(
  source: string,
  rules: HeadingRule[],
  corrections: Corrections,
  maxTitleLength: number,
  checkpoint: Checkpoint = async () => {},
) {
  let text = source;
  let sourceLineCount: number | undefined;
  if (corrections.deleted.length) {
    const deleted = new Set(corrections.deleted);
    const parts: string[] = [];
    let offset = 0;
    let keptStart = 0;
    let lineIndex = 0;
    while (offset < source.length) {
      const newline = source.indexOf('\n', offset);
      const end = newline === -1 ? source.length : newline;
      if (deleted.has(lineIndex)) {
        parts.push(source.slice(keptStart, offset));
        keptStart = end;
      }
      offset = newline === -1 ? source.length : newline + 1;
      if (++lineIndex % 4000 === 0) await checkpoint((0.2 * offset) / source.length);
    }
    parts.push(source.slice(keptStart));
    text = parts.join('');
    sourceLineCount = lineIndex;
  }
  const outline = await buildOutline(
    text,
    rules,
    new Set(corrections.ignored),
    maxTitleLength,
    (value) => checkpoint(0.2 + value * 0.8),
  );
  // Deleted opening titles must not create a new empty preface in the EPUB.
  if (
    corrections.deleted.length &&
    outline.sections.length > 1 &&
    outline.sections[0].lineIndex === null &&
    outline.sections[0].empty
  ) {
    outline.sections.shift();
  }
  outline.characterCount = source.length;
  if (sourceLineCount !== undefined) outline.lineCount = sourceLineCount;
  return { text, outline };
}
