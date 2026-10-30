export function downloadEpub(bytes: Uint8Array, title: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/epub+zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') || '小说'}.epub`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
