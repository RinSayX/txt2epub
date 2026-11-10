# Shiye · TXT ↔ EPUB Converter

[简体中文](README.md) · English

Shiye is a browser-based tool for organizing novels and converting between TXT and EPUB. It exports EPUB3 with nested contents and extracts UTF-8 text from unencrypted EPUB2 and EPUB3 books. All conversion happens on your device.

[Use Shiye online](https://rinsay.com) · [Open the English interface](https://rinsay.com/?lang=en)

## Get started

Select **EN** in the header or add `?lang=en` to the page URL. The browser remembers your choice. Interface language and the book language in EPUB metadata are separate settings.

For local development, use Node.js 24. Installing dependencies requires internet access.

```sh
npm ci
npm run dev
```

Open the address printed in the terminal, usually `http://127.0.0.1:5173/?lang=en`. Use **Try the sample novel** if you do not have a file handy. The sample novel is in Chinese.

| Task                                           | Where to start                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Convert TXT to EPUB                            | Import a TXT file, review the encoding and contents, then select **Export EPUB**                   |
| Recognize English headings                     | Open **Rules → Advanced rules · Custom regex → Add English chapter example**, then apply the rules |
| Check for chapter numbering gaps or duplicates | Select **View numbering check** and follow a source line to the relevant chapter                   |
| Extract text from EPUB                         | Select **EPUB to TXT**, choose a file, review the preview and select **Download TXT**              |

## Features and limits

- **TXT organization.** Supports UTF-8, GBK, GB18030, Big5 and UTF-16 LE/BE. Search a nested chapter tree, preview text, merge misidentified headings and remove empty sections with undo and redo.
- **Chapter detection.** Built-in keyword rules cover common Chinese headings. Use regex examples or write your own for formats such as `Chapter 12: The Trial`. Numbering checks flag possible gaps, duplicates and ordering problems without editing the book.
- **EPUB3 export.** Set the title, author and book language. Optionally generate a 600 × 800 PNG cover or remove blank lines and unsupported control characters. Exports contain EPUB3 navigation and legacy NCX without embedded CSS.
- **EPUB text extraction.** Extracts readable text in spine order. Plain text does not carry images or visual layout. DRM-protected text and OCR are outside the feature's scope.
- **Privacy and large files.** Files over 50 MiB trigger a notice. Capacity depends on browser memory. Books and edits remain in the current tab session. The browser stores applied rules and the interface language.

## Documentation

| Guide                                                  | Covers                                           |
| ------------------------------------------------------ | ------------------------------------------------ |
| [TXT to EPUB](docs/en/TXT_TO_EPUB.md)                  | Import, corrections, export and XHTML file names |
| [EPUB to TXT](docs/en/EPUB_TO_TXT.md)                  | Reading order, whitespace, limits and errors     |
| [Custom regex rules](docs/en/REGEX_RULES.md)           | Ready-to-use examples, captures and testing      |
| [Chapter numbering checks](docs/en/NUMBERING_CHECK.md) | Scope, results, split parts and review           |
| [Project structure](docs/en/STRUCTURE.md)              | Source locations and responsibilities            |
| [Technical design](docs/en/TECHNICAL_DESIGN.md)        | Worker model, text processing and EPUB packaging |
| [Validation](docs/en/VALIDATION.md)                    | Test commands, coverage and observed results     |

## Build and test

```sh
npm run build
npm run preview
npm test
npm run test:scale
npm run format:check
```

Deploy the `dist/` directory to a static host over HTTP(S). Loading the page via `file://` does not support the modules and Workers. Once the page and its assets are loaded, conversion needs no network connection. The app uses React, TypeScript, Vite, fflate and xmldom.

`npm ci` uses the project-local `.npm-cache/`. If a cache permission error persists, confirm that directory is writable and run `npm ci --cache ./.npm-cache`.
