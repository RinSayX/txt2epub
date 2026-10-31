import { ShieldCheck } from 'lucide-react';
import Dialog from './Dialog';

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="从纯文本，到一本书" onClose={onClose}>
      <div className="help-content">
        <p>
          <b>1. 导入小说</b>选择 TXT 文件，超过 50 MiB
          时会提示，仍可继续导入。如果预览出现乱码，在文件信息栏切换编码。
        </p>
        <p>
          <b>2. 调整章节</b>
          在“识别规则”配置关键词和层级，数字越小层级越高。点击应用后，目录会重新生成。
        </p>
        <p>
          <b>3. 纠正误判</b>
          选中误识别的标题，点击“并入上一节”。原标题行会保留为正文，子章节也会保留；支持撤销和重做。
          对只有标题、直属正文为空或只有空白的章节，可点击“删除空章节”，或用“清理空章节”一次删除全部；子章节保留并重建层级，支持撤销和重做。
        </p>
        <p>
          <b>4. 导出 EPUB</b>
          如需去除正文段落之间的空行，可勾选“清理段间空行”，预览与导出同步生效，正文各段仍独立。填写书名与可选作者，下载
          EPUB3。附带 NCX 目录，实际兼容性请用目标阅读器确认。若提示 U+001A
          等隐藏控制字符，可重新打开导出窗口，勾选“清理不兼容的隐藏控制字符”后导出；源 TXT 不变。
        </p>
        <div className="help-privacy">
          <ShieldCheck size={20} />
          <span>
            小说不上传，也不会保存到本地持久存储。刷新或关闭页面后需重新导入。仅识别规则会保存在当前浏览器。
          </span>
        </div>
      </div>
    </Dialog>
  );
}
