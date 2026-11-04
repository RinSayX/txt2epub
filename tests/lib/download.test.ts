import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadEpub, downloadTxt } from '../../src/lib/download';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function browserDownload() {
  vi.useFakeTimers();
  let blob: Blob;
  const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal('document', { createElement: () => link, body: { append: vi.fn() } });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
    blob = value as Blob;
    return 'blob:local-file';
  });
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return { link, revoke, blob: () => blob };
}

describe('local downloads', () => {
  it('downloads the exact UTF-8 TXT bytes with a safe Unicode filename and releases the object URL later', async () => {
    const browser = browserDownload();
    const text = '第一章\n正文😀 & 雨\n';
    const encoded = new TextEncoder().encode(text);
    const backing = new Uint8Array(encoded.length + 4);
    backing.set(encoded, 2);
    downloadTxt(backing.subarray(2, 2 + encoded.length), ' 山:海/书名 ');
    expect(browser.blob().type).toBe('text/plain;charset=utf-8');
    expect(new Uint8Array(await browser.blob().arrayBuffer())).toEqual(encoded);
    expect(browser.link.download).toBe('山_海_书名.txt');
    expect(browser.link.href).toBe('blob:local-file');
    expect(browser.link.click).toHaveBeenCalledOnce();
    expect(browser.revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60000);
    expect(browser.revoke).toHaveBeenCalledWith('blob:local-file');
  });

  it('keeps EPUB MIME type and filename behavior when sharing the download helper', () => {
    const browser = browserDownload();
    downloadEpub(new Uint8Array([1, 2, 3]), ' ');
    expect(browser.blob().type).toBe('application/epub+zip');
    expect(browser.link.download).toBe('小说.epub');
    expect(browser.link.click).toHaveBeenCalledOnce();
  });
});
