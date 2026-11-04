export function downloadEpub(bytes: Uint8Array, title: string): void {
  downloadFile(bytes, title, 'epub', 'application/epub+zip');
}

export function downloadTxt(bytes: Uint8Array, title: string): void {
  downloadFile(bytes, title, 'txt', 'text/plain;charset=utf-8');
}

function downloadFile(bytes: Uint8Array, title: string, extension: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') || '小说'}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
