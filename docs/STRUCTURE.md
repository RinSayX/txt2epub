# 项目结构与职责

本次整理日期：2026-10-31。目标是让功能入口清楚、修改位置容易定位，并维持现有转换行为。

## 检查结论与已完成调整

| 原有问题                                                           | 调整                                                                                                                      | 作用                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| App 同时负责文件读取调度、解析状态、纠错历史、存储、下载及全部页面 | 会话流程放到 `app/useDocumentSession.ts`，偏好存储放到 `app/preferences.ts`；导入、预览、文件信息、导出及帮助弹窗各有组件 | 页面负责组合界面，流程有固定入口             |
| 数据模型、默认规则、界面配置、Worker 协议混在 `core/types.ts`      | 分为 `core/types.ts`、`core/rules.ts`、`config.ts` 和 `workers/protocol.ts`                                               | 类型文件不再包含业务配置和传输命令           |
| Worker 客户端在源码根目录，Worker 入口在另一个目录                 | 客户端、协议和入口集中到 `workers/`                                                                                       | 通信两端和协议可一起检查                     |
| `text.ts` 同时包含编码逻辑与 UI 文件大小显示                       | 编码放到 `core/encoding.ts`，显示放到 `lib/format.ts`                                                                     | 纯转换逻辑与 UI 工具分离                     |
| EPUB 生成函数同时包含所有 XML/CSS 模板                             | 分为 `generate.ts`、`templates.ts`、`xml.ts`                                                                              | 分别负责打包编排、文档序列化、字符校验及转义 |
| TSX、CSS 存在大量超长单行，CSS 全部挤在 7 行里                     | 添加 Prettier 及 EditorConfig，按区域拆分 CSS 并统一格式                                                                  | 降低阅读、定位和审查改动的成本               |
| 测试全部平铺，编码和目录测试混在同一文件                           | 按 `core/`、`components/`、`workers/`、`scale/` 分类                                                                      | 与被测模块一一对应                           |
| 技术设计和不断追加的验收记录占据项目根目录                         | 移到 `docs/`，根目录保留 README、入口和工具配置                                                                           | 运行入口更清晰，详细说明集中查阅             |
| 单项目构建使用 `tsc -b`，在根目录产生构建状态文件                  | 改为 `tsc --noEmit`，移除已有生成状态文件                                                                                 | 避免不必要的构建缓存出现在根目录             |

## 修改功能时从哪里入手

| 工作内容                                        | 入口                                                         |
| ----------------------------------------------- | ------------------------------------------------------------ |
| 页面结构、按钮及区域组合                        | `src/app/App.tsx`                                            |
| 导入、重算、纠错、撤销/重做、预览请求和导出流程 | `src/app/useDocumentSession.ts`                              |
| 规则偏好在浏览器中的读写                        | `src/app/preferences.ts`                                     |
| 标题匹配、层级及原文边界                        | `src/core/outline.ts`                                        |
| 编码自动判断及手动解码                          | `src/core/encoding.ts`                                       |
| 段首空白和章末空行处理                          | `src/core/paragraphs.ts`                                     |
| 默认关键词和层级                                | `src/core/rules.ts`                                          |
| 文件大小提示阈值及编码选项                      | `src/config.ts`                                              |
| XHTML 拆片及 ZIP 条目顺序                       | `src/core/epub/generate.ts`                                  |
| XHTML、NAV、NCX、OPF、container.xml 和书内 CSS  | `src/core/epub/templates.ts`                                 |
| XML 转义和合法字符检查                          | `src/core/epub/xml.ts`                                       |
| Worker 生命周期及请求响应                       | `src/workers/client.ts`、`protocol.ts`、`document.worker.ts` |
| 下载文件名与 Blob 生命周期                      | `src/lib/download.ts`                                        |

## 依赖边界

- `core/` 负责文本及电子书领域逻辑，不依赖 React、页面组件或 Worker 入口。EPUB 唯一外部运行依赖仍为 fflate；唯一标识通过浏览器和 Node 均支持的 crypto API 生成。
- `workers/` 调用核心模块，负责后台任务、进度、取消和传输。
- `app/` 管理会话及浏览器交互，组合 `components/`。
- `components/` 接收数据和回调，不直接管理 Worker 或生成 EPUB。
- `lib/` 放置小型平台和显示工具，避免形成职责模糊的通用业务模块。
- `examples/` 是页面示例数据。测试输入继续在测试中构造，应用示例和测试预期互不依赖。

## 样式加载顺序

`src/main.tsx` 仅引入 `styles/index.css`，由入口依次加载：

1. `base.css`：颜色、字体、基础重置。
2. `workspace.css`：页头、工作台、目录、导入和文件信息。
3. `reader.css`：章节工具栏、正文和预览页脚。
4. `panels.css`：规则面板、弹窗、进度及消息。
5. `responsive.css`：断点覆盖及减少动画偏好。

保持原有级联顺序。修改响应式样式时在 `responsive.css` 查找对应断点。

## 生成目录与格式检查

依赖目录 `node_modules/`、项目缓存 `.npm-cache/`、生产构建 `dist/`、测试产物 `artifacts/` 均已忽略。它们存在于本地工作目录是正常的，不应移动到源码中或提交到 Git。

`npm run format` 整理源码及文档，`npm run format:check` 检查格式。Prettier 排除依赖、缓存、构建、测试产物和锁文件；依赖锁文件由 npm 管理。

## 保留的取舍

- 会话 Hook 仍是单一工作台流程入口。当前各操作共享同一文档和纠错历史，保留统一管理；出现独立书架、多文档或并发会话时再拆分，不为目前规模引入状态管理框架。
- 文本仍整文件解码，ZIP 输出仍需要汇总字节缓冲。模块拆分不会消除大文件内存峰值，超过 50 MiB 的提示继续保留。
- 旧阅读器实机兼容验证仍需具体设备和版本信息；本次结构调整不会扩大已验证的兼容范围。
- 规模测试仍使用合成文本，运行记录是验收证据，不作为所有设备的性能承诺。

运行及功能说明见 [README](../README.md)，历史验证结果见 [验收记录](VALIDATION.md)。
