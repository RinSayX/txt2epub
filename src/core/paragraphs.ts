const horizontalWhitespace = /[\t\p{Zs}]/u;

export function stripParagraphIndent(text: string): string {
  return text.replace(/^[\t\p{Zs}]+/u, '');
}

// Keep trailing spaces on the final nonblank line, but omit every following
// line separator and whitespace-only line. Source offsets remain unchanged.
export function chapterContentEnd(
  text: string,
  start: number,
  end: number,
  isIgnoredCharacter?: (char: string) => boolean,
): number {
  let contentEnd = end;
  for (let cursor = end - 1; cursor >= start; cursor--) {
    const char = text[cursor];
    if (char === '\n') contentEnd = cursor;
    else if (!horizontalWhitespace.test(char) && !isIgnoredCharacter?.(char)) return contentEnd;
  }
  return start;
}

export function previewParagraphs(
  text: string,
  bodyStart: number,
  start: number,
  end: number,
): string {
  // A preview can start mid-paragraph. Only strip its prefix when the original
  // characters before it are indentation, never when they are interior spaces.
  let previous = start - 1;
  while (previous >= bodyStart && horizontalWhitespace.test(text[previous])) previous--;
  const atParagraphStart = previous < bodyStart || text[previous] === '\n';
  const chunk = text.slice(start, end).replace(/\n[\t\p{Zs}]+/gu, '\n');
  return atParagraphStart ? stripParagraphIndent(chunk) : chunk;
}
