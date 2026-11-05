# 项目结构与职责

[项目首页](../README.md) · [技术设计](TECHNICAL_DESIGN.md) · [验证与验收](VALIDATION.md)

```text
src/
  app/           页面组合、会话状态、规则偏好
  components/    导入、目录、规则、预览和弹窗
  core/          解码、标题识别、纠错、编号检查、段落处理
    epub/        EPUB 打包、序列化和文本提取
  workers/       Worker 入口、客户端及消息协议
  lib/           下载、Canvas 封面和显示格式
  styles/        页面样式与响应式规则
  examples/      内置合成小说
tests/
  core/          领域逻辑与 EPUB 包结构
  components/    界面输出与提示
  workers/       消息协议、状态提交、取消与超时
  lib/           下载适配器
  helpers/       测试用 EPUB 等数据构造工具
  scale/         大文件和高章节数合成样本
docs/            使用指南、架构和验证记录
```

## 按任务查找源码

| 任务                           | 主要入口                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面布局与入口按钮             | [App.tsx](../src/app/App.tsx)、[ImportPanel.tsx](../src/components/ImportPanel.tsx)                                                                                           |
| TXT 会话、纠错历史和导出调度   | [useDocumentSession.ts](../src/app/useDocumentSession.ts)、[preferences.ts](../src/app/preferences.ts)                                                                        |
| 文件提示与编码                 | [config.ts](../src/config.ts)、[encoding.ts](../src/core/encoding.ts)                                                                                                         |
| 关键词、正则、目录树与预览范围 | [rules.ts](../src/core/rules.ts)、[regex.ts](../src/core/regex.ts)、[outline.ts](../src/core/outline.ts)                                                                      |
| 纠错工作文本及段落清理         | [corrections.ts](../src/core/corrections.ts)、[paragraphs.ts](../src/core/paragraphs.ts)                                                                                      |
| 编号解析、连续性和报告         | [numbering.ts](../src/core/numbering.ts)、[continuity.ts](../src/core/continuity.ts)、[ContinuityDialog.tsx](../src/components/ContinuityDialog.tsx)                          |
| 目录滚动和正文预览             | [OutlineList.tsx](../src/components/OutlineList.tsx)、[BookPreview.tsx](../src/components/BookPreview.tsx)                                                                    |
| EPUB 导出、拆片命名与 XML      | [generate.ts](../src/core/epub/generate.ts)、[templates.ts](../src/core/epub/templates.ts)、[xml.ts](../src/core/epub/xml.ts)                                                 |
| 导出设置、封面和下载           | [ExportDialog.tsx](../src/components/ExportDialog.tsx)、[cover.ts](../src/lib/cover.ts)、[download.ts](../src/lib/download.ts)                                                |
| EPUB 转 TXT                    | [EpubToTxtDialog.tsx](../src/components/EpubToTxtDialog.tsx)、[useEpubConversion.ts](../src/app/useEpubConversion.ts)、[extract.ts](../src/core/epub/extract.ts)              |
| 文档 Worker 通信               | [client.ts](../src/workers/client.ts)、[protocol.ts](../src/workers/protocol.ts)、[document.worker.ts](../src/workers/document.worker.ts)                                     |
| 用户正则隔离                   | [analysis-runner.ts](../src/workers/analysis-runner.ts)、[analysis.worker.ts](../src/workers/analysis.worker.ts)、[analysis-protocol.ts](../src/workers/analysis-protocol.ts) |

## 职责边界

- `core/` 不依赖 React 或 Worker 入口，可在 Node 测试。fflate 负责 ZIP 打包与解包，xmldom 负责 EPUB 输入的 XML／XHTML 解析。
- `workers/` 调用核心逻辑，管理消息、任务取消、进度和数据传输。
- `app/` 管理会话，组合页面和浏览器能力；组件负责显示与输入。EPUB 转 TXT 的弹窗使用独立会话 Hook。
- `lib/` 放置浏览器适配和显示工具，例如 Canvas 绘制与 Blob 下载；小说处理规则在核心模块。

## 页面样式和本地产物

[main.tsx](../src/main.tsx) 载入 [styles/index.css](../src/styles/index.css)，级联顺序为 `base.css` → `workspace.css` → `reader.css` → `panels.css` → `responsive.css`。这些文件只控制网页，导出的 EPUB 不包含它们。

`node_modules/`、`.npm-cache/`、`dist/`、`coverage/` 和 `artifacts/` 均被忽略。源码及 Markdown 由 Prettier 管理，`package-lock.json` 由 npm 管理。构建先运行 `tsc --noEmit`，再由 Vite 输出静态文件；不在根目录保存 TypeScript 构建状态。

修改行为时，同步更新对应使用指南和技术设计；验证记录写明本轮实际运行的检查，历史数据按当时版本保留。
