# Project structure

[English home](../../README.en.md) · [中文](../STRUCTURE.md) · [Technical design](TECHNICAL_DESIGN.md) · [Validation](VALIDATION.md)

| Location                              | Responsibility                                                         |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `src/main.tsx`, `src/app/App.tsx`     | Entry point, header, workspace and dialogs                             |
| `src/app/useDocumentSession.ts`       | TXT session, correction history, numbering, preview and export         |
| `src/app/useEpubConversion.ts`        | Independent EPUB to TXT conversion session                             |
| `src/app/preferences.ts`, `src/i18n/` | Persisted recognition rules, interface language and localized messages |
| `src/components/`                     | Import, contents, preview, rules, help and conversion forms            |
| `src/core/`                           | Decoding, chapter boundaries, rules, corrections and numbering         |
| `src/core/epub/`                      | EPUB generation, XML handling and plain text extraction                |
| `src/workers/`                        | Document and regex Worker protocols, progress and cancellation         |
| `src/lib/`                            | Download, cover drawing and formatting helpers                         |
| `src/styles/`                         | Workspace layout, responsive styles and component styles               |
| `tests/`                              | Core, component, Worker and scale checks                               |
| `docs/`, `docs/en/`                   | Chinese and English guides                                             |

Keep source text and the committed contents in the document Worker. React components render previews and manage user interaction. The separate analysis Worker runs custom regex rules. Conversion functions in `src/core/` avoid browser UI dependencies.

Styles load through `src/styles/index.css` and apply to the website. Export templates generate EPUB XHTML independently. Local dependencies, build output, test coverage and generated samples are ignored by Git. Prettier formats the source and Markdown. Keep the guides in both languages in sync when behavior changes.
