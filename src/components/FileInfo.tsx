import { useLanguage, useText } from '../i18n/LanguageProvider';
import { Check, FileText } from 'lucide-react';
import type { DocumentSnapshot, Encoding } from '../core/types';
import { ENCODINGS } from '../config';
import { formatBytes, formatCharacterCount } from '../lib/format';

interface Props {
  snapshot: DocumentSnapshot;
  encoding: Encoding;
  busy: boolean;
  onEncodingChange: (encoding: Encoding) => void;
}
export default function FileInfo({ snapshot, encoding, busy, onEncodingChange }: Props) {
  const t = useText();
  const { locale } = useLanguage();
  return (
    <div className="file-strip">
      <div className="file-symbol">
        <FileText size={20} />
      </div>
      <div className="file-info">
        <strong title={snapshot.filename}>{snapshot.filename}</strong>
        <span>
          {formatBytes(snapshot.size)}
          <i />
          {snapshot.lineCount.toLocaleString(locale)}
          {t('行原文', ' source lines')}
        </span>
      </div>
      <div className="encoding-field">
        <label htmlFor="encoding">{t('文本编码', 'Text encoding')}</label>
        <select
          id="encoding"
          value={encoding}
          disabled={!!busy}
          onChange={(event) => onEncodingChange(event.target.value as Encoding)}
        >
          {ENCODINGS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value === 'auto' ? t(item.label, 'Auto detect') : item.label}
            </option>
          ))}
        </select>
        <span className="encoding-detected">{snapshot.encoding.toUpperCase()}</span>
      </div>
      <div className="file-stats">
        <div>
          <strong>{snapshot.headingCount}</strong>
          <span>{t('个标题', 'headings')}</span>
        </div>
        <div>
          <strong>{formatCharacterCount(snapshot.characterCount, locale)}</strong>
          <span>{t('字符', 'characters')}</span>
        </div>
        <span className="local-status">
          <Check size={13} />
          {t('本地文件', 'Local file')}
        </span>
      </div>
    </div>
  );
}
