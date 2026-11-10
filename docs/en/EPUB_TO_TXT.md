# EPUB to TXT

[English home](../../README.en.md) · [中文](../EPUB_TO_TXT.md) · [TXT to EPUB](TXT_TO_EPUB.md)

Select **EPUB to TXT** in the header, then choose or drop an `.epub` file. Conversion starts automatically in a separate Worker. Canceling or closing the dialog stops that conversion while keeping the main TXT workspace. Files over 50 MiB show a notice and can still be processed.

The result shows book metadata, the number of extracted documents and characters, and a preview of up to 4,000 UTF-16 code units without splitting a surrogate pair. **Download TXT** saves the full result as UTF-8 without a BOM, with LF line endings and a final newline. The book title supplies the download name if present, otherwise the original file name is used. Closing the dialog clears the conversion result.

## How text is extracted

- The converter locates the OPF through `META-INF/container.xml` and follows the OPF spine. It preserves supplementary items marked `linear="no"` in order and extracts repeated references to the same document once.
- Existing body headings, paragraphs and list entries remain. Head titles and navigation labels are not inserted into the output. Book title and author are used for the result display and filename.
- Text blocks occupy separate lines. `br` produces a line break, empty paragraphs become blank lines, and one blank line separates documents. The converter preserves whitespace in `pre` and separates table cells with tabs. Normal HTML whitespace is collapsed according to its text semantics.
- Recognized cover and contents pages are skipped using the OPF guide, EPUB landmarks and `epub:type`. A target identified by a fragment skips only that part of a shared document. A cover or contents page without markup may still yield text.
- Images, SVG, video, scripts and styles are ignored. The converter honors common inline hidden markers without running CSS, JavaScript or fetching remote resources.

## Limits

DRM-protected or encrypted body text, unreadable required XML, missing resources and an invalid spine produce an error. Font obfuscation alone does not prevent extraction. EPUB XML/XHTML can use UTF-8 or UTF-16. Scanned or image-only books need OCR before extraction.

TXT does not carry visual styles, images, hyperlinks or a navigable hierarchy. A TXT → EPUB → TXT round trip reflects the initial whitespace cleanup, generated introduction headings and the text boundaries created by chapter splitting. To check chapter numbers, reimport the extracted TXT and use [numbering checks](NUMBERING_CHECK.md).
