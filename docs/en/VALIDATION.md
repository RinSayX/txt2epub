# Validation

[English home](../../README.en.md) · [中文](../VALIDATION.md) · [Technical design](TECHNICAL_DESIGN.md)

| Command                                       | What it checks                                     |
| --------------------------------------------- | -------------------------------------------------- |
| `npm test`                                    | Core behavior, components, Workers and downloads   |
| `npm run test:scale`                          | Opt-in large file, 16,000-heading and Worker cases |
| `RUN_SCALE=1 npm test`                        | Regular and scale tests in one run                 |
| `npm run build`                               | TypeScript and production bundle                   |
| `npm run preview`                             | Serves the production bundle for browser checks    |
| `npm run format:check` and `git diff --check` | Formatting and whitespace                          |

Automated checks cover encoding, chapter ranges, correction history, regex isolation, numbering, export formatting, invalid XML controls, ZIP/OPF/NAV/NCX references, covers and EPUB text extraction. Scale tests exercise synthetic files around 1, 10, 20 and 51 MiB and a separate 16,000-heading case. The 20 and 51 MiB EPUB samples and measurements are written to the ignored `artifacts/` directory.

For browser acceptance, import the demo, open a chapter, apply a rule, check numbering, and export with and without a cover. Open an unencrypted EPUB, verify the preview and download TXT. On narrow screens, verify the three workspace views, form controls and dialog scrolling. In English, also verify `?lang=en`, live switching after import, error messages, and the English chapter example. Use the English book language to check generated EPUB labels.

Earlier checks used a desktop browser at 320, 360 and 390 px portrait and 667 × 375 px landscape to verify layout and conversion controls. These checks did not cover mobile OS keyboards or file saving. Earlier local runs of [EPUBCheck 5.4.0](https://github.com/w3c/epubcheck/releases/tag/v5.4.0) reported no errors or warnings for the recorded demo and scale samples. These are historical results for specific builds and inputs.

To check a new EPUB, run EPUBCheck on representative plain, covered and split-chapter exports.

```sh
java -jar /path/to/epubcheck.jar /path/to/book.epub
```

Record the converter revision, input, validator version and messages. Test the exact reader or editor version separately when compatibility matters. See the [Chinese validation record](../VALIDATION.md) for more historical detail.
