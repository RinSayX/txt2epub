import { describe, expect, it } from 'vitest';
import { decodeText } from '../../src/core/encoding';

describe('TXT decoding', () => {
  it('detects UTF-8, removes BOM and normalizes only line endings', () => {
    const bytes = new TextEncoder().encode('\uFEFF第一章 风\r\n　正文\r下一行\n');
    expect(decodeText(bytes)).toEqual({
      text: '第一章 风\n　正文\n下一行\n',
      encoding: 'utf-8',
      uncertain: false,
    });
  });
  it('decodes GB18030 and allows an explicit encoding override', () => {
    const bytes = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);
    expect(decodeText(bytes, 'gbk').text).toBe('中文');
    expect(decodeText(bytes).encoding).toBe('gb18030');
    expect(decodeText(bytes).uncertain).toBe(true);
  });
  it('decodes Big5 without losing characters', () => {
    expect(decodeText(new Uint8Array([0xa4, 0xa4, 0xa4, 0xe5]), 'big5').text).toBe('中文');
  });
  it('detects both UTF-16 byte orders from BOM', () => {
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x2d, 0x4e])).text).toBe('中');
    expect(decodeText(new Uint8Array([0xfe, 0xff, 0x4e, 0x2d])).text).toBe('中');
  });
  it('rejects empty, whitespace-only and malformed explicitly encoded input', () => {
    expect(() => decodeText(new Uint8Array())).toThrow('空');
    expect(() => decodeText(new TextEncoder().encode(' \n\t'))).toThrow('空白');
    expect(() => decodeText(new Uint8Array([0xff]), 'utf-8')).toThrow('完整解码');
  });
});
