export const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
  );

export function assertXmlCharacters(text: string, label: string): void {
  let line = 1;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code === 10) line++;
    if (!(
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff) ||
      [9, 10, 13].includes(code)
    )) {
      throw new Error(
        `${label}第 ${line} 行包含 XML 不支持的字符 U+${code.toString(16).toUpperCase().padStart(4, '0')}。请修正源文件后重试，正文未被自动删除。`,
      );
    }
  }
}
