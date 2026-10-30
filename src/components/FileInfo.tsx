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
          {snapshot.lineCount.toLocaleString()} 行原文
        </span>
      </div>
      <div className="encoding-field">
        <label htmlFor="encoding">文本编码</label>
        <select
          id="encoding"
          value={encoding}
          disabled={!!busy}
          onChange={(event) => onEncodingChange(event.target.value as Encoding)}
        >
          {ENCODINGS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <span className="encoding-detected">{snapshot.encoding.toUpperCase()}</span>
      </div>
      <div className="file-stats">
        <div>
          <strong>{snapshot.headingCount}</strong>
          <span>个标题</span>
        </div>
        <div>
          <strong>{formatCharacterCount(snapshot.characterCount)}</strong>
          <span>字符</span>
        </div>
        <span className="local-status">
          <Check size={13} />
          本地文件
        </span>
      </div>
    </div>
  );
}
