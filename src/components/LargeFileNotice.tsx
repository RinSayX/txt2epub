import { AlertCircle } from 'lucide-react';
import { LARGE_FILE_WARNING_SIZE } from '../config';
import { formatBytes } from '../lib/format';

export default function LargeFileNotice({ size }: { size: number }) {
  if (size <= LARGE_FILE_WARNING_SIZE) return null;
  return (
    <div className="notice info" role="status">
      <AlertCircle size={16} />
      <span>
        当前文件为 {formatBytes(size)}，超过 50
        MiB。解析和导出可能需要更长时间及更多内存，仍可继续处理，也可通过进度提示取消。
      </span>
    </div>
  );
}
