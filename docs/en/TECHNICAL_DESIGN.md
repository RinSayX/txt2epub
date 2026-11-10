# Technical design

[English home](../../README.en.md) · [中文](../TECHNICAL_DESIGN.md) · [Project structure](STRUCTURE.md) · [Validation](VALIDATION.md)

## Browser sessions

The React app sends document work to a module Worker. The Worker owns decoded text, chapter boundaries and the current document revision. It sends back lightweight snapshots, paged previews and the final export bytes. Regex matching runs in a separate Worker with a timeout and cancellation. A failed match or canceled reanalysis leaves the committed document intact.

EPUB to TXT uses another document Worker with an independent lifetime. Closing that dialog terminates its Worker. Files, edit history and review marks are kept for the page session. Applied rules and the interface language are stored locally. The language switch updates the UI and the document language attribute without replacing either conversion session. Worker errors carry both language variants so they can be displayed after a language change.

## TXT model and analysis

TXT decoding supports UTF-8, GB18030, GBK, Big5 and UTF-16 LE/BE. The app normalizes newlines and uses UTF-16 offsets for source ranges. Each section records a heading line, its body range, parent and level. Text before the first recognized heading becomes an introduction. If there are no headings, the export uses one section.

Enabled full-line regex rules run in priority order before keyword matching. A named `title` capture can change the display title and a named `number` capture can supply the chapter number. Neither capture rewrites the source. Merging a misidentified heading retains its full source line. Deleting an empty heading excludes that line and rebuilds the hierarchy. Both operations preserve subsections. Undo and redo track edits in the active session.

Numbering checks group by numbering type, level and optionally the nearest higher-level volume or book. Gaps come from distinct sorted numbers. Order warnings compare adjacent numbers in source order. Results are tied to the document revision and check options.

## Preview and export

The contents tree renders a window of visible items. Body previews are paginated and prefer line boundaries. Preview and export remove leading indentation and trailing blank chapter lines. Nonblank lines become individual paragraphs. Blank lines within the body use a nonbreaking-space paragraph unless the user removes blank lines.

```text
mimetype
META-INF/container.xml
OEBPS/content.opf
OEBPS/toc.ncx
OEBPS/Text/nav.xhtml
OEBPS/Text/section-000001.xhtml
…
OEBPS/cover.xhtml        (optional)
OEBPS/images/cover.png   (optional)
```

The uncompressed `mimetype` is the first ZIP entry. OPF stores the title, author if supplied, language, UUID and modification time. NAV and NCX link to the first XHTML part of each chapter. NAV and chapter files share a directory, while NCX links include the `Text/` prefix. The spine lists all parts in reading order. A chapter may be split at paragraph boundaries near 250 KiB of body markup.

Book metadata language controls generated headings such as **Contents** and **Introduction** for English exports. User-supplied titles and body text keep their original language. EPUB XHTML, XML, NCX and OPF are indented for editing. The EPUB includes no CSS. Optional PNG cover generation uses Canvas with local fonts and puts the cover page first in the spine.

Export validates XML characters. Optional cleanup removes unsupported C0 control characters in body text and chapter headings while preserving LF, CR and tabs. Invalid metadata or damaged Unicode still produces an error. ZIP output is assembled from compressed chunks. The source and final download still require memory.

## Text extraction

The extractor follows the OPF spine and reads only needed ZIP entries. It resolves links within the package, skips recognized covers and contents, and converts semantic text blocks to lines. EPUB scripts, styles and remote resources are never executed or fetched. Encrypted body text and unreadable required resources produce errors. See [EPUB to TXT](EPUB_TO_TXT.md) for output details.
