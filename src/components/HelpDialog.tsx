import { useText } from '../i18n/LanguageProvider';
import { ShieldCheck } from 'lucide-react';
import Dialog from './Dialog';

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const t = useText();
  return (
    <Dialog title={t('TXT 与 EPUB，本地互转', 'TXT and EPUB conversion')} onClose={onClose}>
      <div className="help-content">
        <p>
          <b>{t('1. 导入小说', '1. Import a novel')}</b>
          {t(
            '选择 TXT 文件，超过 50 MiB 时会提示，仍可继续导入。如果预览出现乱码，在文件信息栏切换编码。',
            'Choose a TXT file. Files over 50 MiB display a notice and can still be imported. If the preview looks garbled, change the encoding in the file information bar.',
          )}
        </p>
        <p>
          <b>{t('2. 调整章节', '2. Adjust chapter recognition')}</b>
          {t(
            '在“识别规则”配置关键词和层级，数字越小层级越高。点击应用后，目录会重新生成。特殊格式可展开“高级规则 · 自定义正则”，添加前置序号示例或自定义表达式；使用 title 命名捕获组提取显示标题。可先测试文本或当前文件，确认后再应用。',
            'Use Rules to configure keywords and levels. Lower numbers mean higher levels. Apply your changes to rebuild the contents. Open Advanced rules · Custom regex for special formats, including the English chapter example. Test your rules before applying them. A named group called title can extract the display title.',
          )}
        </p>
        <p>
          <b>{t('3. 纠正误判', '3. Correct the contents')}</b>
          {t(
            '选中误识别的标题，点击“并入上一节”。原标题行会保留为正文，子章节也会保留；支持撤销和重做。 对只有标题、直属正文为空或只有空白的章节，可点击“删除空章节”，或用“清理空章节”一次删除全部；子章节保留并重建层级，支持撤销和重做。',
            'Use Merge into previous to turn a misidentified heading back into body text. Use Remove empty section or Remove empty sections for headings with no body text. These actions preserve subsections and can be undone or redone.',
          )}
        </p>
        <p>
          <b>{t('4. 检查编号', '4. Check chapter numbers')}</b>
          {t(
            '导入后会自动检查章节编号。点击“查看编号检查”可筛选缺号、重复和顺序异常，点击原文行号定位。 默认检查章、回的全书连续编号，也可按卷／册分别检查，或勾选其他编号类型。默认允许明确的上、中、下分篇共用编号，严格模式会列为重复。 问题可标记已确认；修改目录或检查设置后会重新检测并清除确认。检查保持正文和标题原样，仍可导出。',
            'The check runs after import. Open View numbering check to review possible gaps, duplicates and out-of-order numbers. Click a source line to jump to that section. Change the scope or numbering types as needed. Explicit split parts may share a number unless you enable strict checking.',
          )}
        </p>
        <p>
          <b>{t('5. 导出 EPUB', '5. Export EPUB')}</b>
          {t(
            '如需去除正文段落之间的空行，可勾选“清理段间空行”，预览与导出同步生效，正文各段仍独立。填写书名与可选作者，下载 EPUB3。导出不附带排版样式，字体、行距和段间距由阅读器决定。附带 NCX 目录，实际兼容性请用目标阅读器确认。若提示 U+001A 等隐藏控制字符，可重新打开导出窗口，勾选“清理不兼容的隐藏控制字符”后导出；源 TXT 不变。',
            'Set the book title and optional author, then generate the EPUB3. You can remove blank lines or generate a cover. If export reports U+001A or a similar control character, select Remove unsupported control characters and retry. The EPUB includes legacy NCX navigation and lets your reader choose the typography.',
          )}
        </p>
        <p>
          <b>{t('6. EPUB 转 TXT', '6. Convert EPUB to TXT')}</b>
          {t(
            '点击页面上方“EPUB 转 TXT”，选择或拖入未加密的 EPUB，按书内阅读顺序提取文字，检查预览后下载 UTF-8 TXT。 标题和正文段落保留，封面、目录页、图片和样式略过；不进行图片文字识别，不支持 DRM 加密正文。 此转换窗口独立运行，不覆盖当前正在整理的 TXT。',
            'Choose EPUB to TXT, then open an unencrypted EPUB. Review the extracted text and download UTF-8 TXT. The converter keeps text in reading order and skips covers, contents pages, images and styles. It does not extract DRM-protected text or perform OCR. The open TXT workspace stays in place.',
          )}
        </p>
        <div className="help-privacy">
          <ShieldCheck size={20} />
          <span>
            {t(
              '小说不上传，也不会保存到本地持久存储。刷新或关闭页面后需重新导入。当前浏览器会保存界面语言和已应用的识别规则。',
              'Books stay on your device and are cleared when you close or reload the page. The browser remembers your interface language and applied recognition rules.',
            )}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
