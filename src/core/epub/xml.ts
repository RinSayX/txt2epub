export const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
  );

export const isInvalidXmlControl = (char: string) => {
  const code = char.charCodeAt(0);
  return code < 0x20 && code !== 9 && code !== 10 && code !== 13;
};

export const removeInvalidXmlControls = (text: string) =>
  text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export function assertXmlCharacters(
  text: string,
  label: string,
  { startLine = 1, startOffset = 0, cleanInvalidControls = false } = {},
): { nextLine: number; controlCount: number } {
  let line = startLine;
  let offset = startOffset;
  let controlCount = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code === 10) line++;
    if (cleanInvalidControls && isInvalidXmlControl(char)) {
      controlCount++;
      offset += char.length;
      continue;
    }
    if (!(
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff) ||
      [9, 10, 13].includes(code)
    )) {
      throw new Error(
        `${label}第 ${line} 行（字符偏移 ${offset}）包含 XML 不支持的字符 U+${code.toString(16).toUpperCase().padStart(4, '0')}。${label === '正文' && isInvalidXmlControl(char) ? '可在导出窗口勾选“清理不兼容的隐藏控制字符”后重试，或修正源文件。' : '请修正该字符后重试。'}原文未被自动修改。`,
      );
    }
    offset += char.length;
  }
  return { nextLine: line, controlCount };
}
