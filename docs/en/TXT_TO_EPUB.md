# TXT to EPUB

[English home](../../README.en.md) · [中文](../TXT_TO_EPUB.md) · [Custom regex rules](REGEX_RULES.md) · [Numbering checks](NUMBERING_CHECK.md)

## Import and organize

1. Select **Import TXT**, drop a `.txt` file onto the import area, or choose **Try the sample novel**.
2. Check the encoding and preview. Auto detect looks for UTF-16 BOMs and valid UTF-8 first, then estimates GB18030 or Big5 if needed. You can also select GBK or UTF-16 LE/BE manually.
3. Open **Rules** to adjust keywords and levels. Lower numbers mean higher positions in the hierarchy. Built-in rules recognize Chinese volume, book, chapter and episode headings as well as some unnumbered headings. For `Chapter 12: The Trial`, open **Advanced rules · Custom regex**, select **Add English chapter example**, then **Apply rules**.
4. Search, expand and collapse the contents to check headings against the preview. Use **View numbering check** to locate possible missing, duplicate or out-of-order numbers.
5. Select **Export EPUB**, enter the book details and generate the file.

On narrow screens, choose a heading in **Contents** to open **Preview**. The toolbar switches between **Contents**, **Preview** and **Rules**. Switching between contents and preview keeps the search and expanded state. Locating a numbering issue clears the search and expands the relevant ancestors.

Empty and whitespace-only files produce an error. Files above 50 MiB show a notice and can still be processed. Text before the first recognized heading becomes an introduction. If no headings are found, the export uses one section with the book title.

| Action                                               | Effect                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Merge into previous**                              | Preserves the original heading and its body as text in the preceding section or in the front matter                              |
| **Remove empty section** / **Remove empty sections** | Removes the selected heading or all headings with no body of their own, including parent headings whose subsections contain text |
| **Undo edit** / **Redo edit**                        | Reverses or reapplies a correction. Use Ctrl/⌘ Z and Ctrl/⌘ Shift Z                                                              |

Both corrections preserve subsections and rebuild the hierarchy. Applying rules keeps corrections. Reimporting a file or changing its encoding can reset corrections and prompts for confirmation when there is edit history. The source TXT is never edited.

## Export options

- **Book title, author and language.** Title is required and defaults to the file name without `.txt`. Author is optional. The language defaults to Simplified Chinese (`zh-CN`); Traditional Chinese (`zh-Hant`) and English (`en`) are also available. Choosing English sets the EPUB language and generated labels such as **Contents** and **Introduction**. Original text and headings keep their language.
- **Generate cover.** Optional 600 × 800 PNG with the title in black on white, centered toward the top. It starts at 72 px, wraps to fit and may shrink for long titles. It uses fonts already available on your device.
- **Remove blank lines.** Applies to both preview and export. Each nonblank source line remains a paragraph.
- **Remove unsupported control characters.** Applies to this export only. Use it when an error identifies a character such as U+001A. The app removes unsupported C0 control characters from chapter headings and body text, preserves tabs and line breaks, and reports the number removed. Correct invalid book metadata or damaged Unicode manually.

Preview and export remove leading indentation and blank lines at the end of each chapter. Other spaces in nonblank body lines are retained. The EPUB has no built-in stylesheets, so the reader controls display and spacing.

## XHTML file names

Chapter files and `nav.xhtml` share `OEBPS/Text/`. Chapter files are numbered in output order as `section-000001.xhtml`, `section-000002.xhtml` and so on. The introduction, volumes, chapters and continuation files each take one number. These numbers do not represent the novel's chapter numbers.

Long chapters are split at paragraph boundaries around 250 KiB of UTF-8 body markup. A single long paragraph may exceed that target. NAV and NCX link to the heading in the first part. The OPF spine lists all parts. The optional cover is `OEBPS/cover.xhtml` and does not take a section number.

## Troubleshooting

- If text looks garbled, select the actual source encoding. Successful auto detection can still pick the wrong encoding.
- If a chapter appears to be missing, use the numbering check to verify whether its heading was recognized.
- If export is disabled after a rule edit, apply the changes first. Numbering warnings do not block export.
- For invalid XML characters, use the indicated line and offset to locate the problem. Character offsets are zero-based UTF-16 offsets in the working text after line-ending normalization. Removing empty headings can change offsets from the original file.
- Reader display can differ from preview. Shiye exports EPUB3 with NCX for compatibility, and actual support depends on the reader.
