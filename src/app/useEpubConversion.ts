import { useLanguage } from '../i18n/LanguageProvider';
import { copy, describeError, localize, type Copy } from '../i18n/locale';
import { useEffect, useRef, useState } from 'react';
import { DocumentClient } from '../workers/client';
import type { EpubToTxtResult } from '../workers/protocol';

/** A separate Worker keeps conversion and cancellation independent of the TXT session. */
export function useEpubConversion() {
  const { locale } = useLanguage();
  const client = useRef<DocumentClient | null>(null);
  const sequence = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<{ progress: number; label: string } | null>(null);
  const [result, setResult] = useState<EpubToTxtResult | null>(null);
  const [error, setError] = useState<Copy | ''>('');
  const [downloaded, setDownloaded] = useState(false);
  useEffect(
    () => () => {
      sequence.current++;
      client.current?.dispose();
    },
    [],
  );

  async function convert(nextFile: File) {
    if (client.current) return;
    if (!/\.epub$/i.test(nextFile.name)) {
      setError(copy('请选择 .epub 格式的电子书。', 'Choose an .epub ebook.'));
      return;
    }
    const job = ++sequence.current;
    const instance = new DocumentClient();
    client.current = instance;
    setFile(nextFile);
    setResult(null);
    setError('');
    setDownloaded(false);
    setBusy({ progress: 0, label: '读取 EPUB' });
    try {
      const converted = await instance.call<EpubToTxtResult>(
        { type: 'epub-to-txt', file: nextFile },
        (progress, label) => {
          if (job === sequence.current) setBusy({ progress, label });
        },
      );
      if (job === sequence.current) setResult(converted);
    } catch (caught) {
      if (job === sequence.current)
        setError(describeError(caught, ['转换失败，请重试。', 'Conversion failed. Try again.']));
    } finally {
      instance.dispose();
      if (job === sequence.current) {
        client.current = null;
        setBusy(null);
      }
    }
  }
  function cancel() {
    sequence.current++;
    client.current?.dispose();
    client.current = null;
    setBusy(null);
    setError(
      copy('转换已取消，可重新选择 EPUB。', 'Conversion canceled. You can choose another EPUB.'),
    );
  }
  return {
    file,
    busy,
    result,
    error: localize(error, locale),
    downloaded,
    setDownloaded,
    convert,
    cancel,
  };
}
