# Chapter numbering checks

[English home](../../README.en.md) · [中文](../NUMBERING_CHECK.md) · [TXT to EPUB](TXT_TO_EPUB.md) · [Custom regex rules](REGEX_RULES.md)

Select **View numbering check** after importing TXT. The check follows the active contents, including changes after applying rules, merging headings, removing empty sections, undoing or redoing edits. To check an EPUB, extract its TXT and import that into the workspace.

## Scope

- **Whole book** is the default. The Chapter (`章`) and Episode (`回`) types are selected initially. Each numbering type and level has its own sequence.
- **Check each volume or book separately** starts a new sequence at the nearest recognized higher-level volume or book. A volume at the same level as a chapter does not reset that chapter sequence.
- Select the other numbered types or regex series you want to check. Unselected types count as out of scope. Unnumbered headings such as prologues do not interrupt a sequence.
- A gap is inferred only between numbers present in the same sequence. An excerpt can start at any number. The check cannot infer missing first or last chapters.

| Result              | Example                        | Meaning                                                               |
| ------------------- | ------------------------------ | --------------------------------------------------------------------- |
| Possible gap        | 10, 13                         | Numbers 11–12 are absent from the recognized sequence                 |
| Duplicate           | 10, 11, 10                     | A number occurs more than once, even when the entries are separated   |
| Out of order        | 10, 12, 11                     | 11 appears after 12 in source order                                   |
| Unparsed            | `第一百百章`                   | The heading was recognized, but its number could not be read reliably |
| Allowed split parts | `第10章（上）`, `第10章（下）` | Explicit distinct parts can share the same number                     |

A sequence such as 1, 3, 2, 4 is out of order and has no gap. Gaps are shown as ranges. Duplicate and order issues may coexist. Check the source before interpreting a warning as missing or duplicated text. Export remains available.

The checker accepts Arabic and fullwidth digits, common Chinese numerals and Chinese financial forms. It leaves original headings as written. Explicit first, middle and last markers `（上）`, `（中）`, `（下）` can share a number. Repeating the same part remains a duplicate. Enable **Treat all repeated numbers as duplicates** for strict checking.

## Custom regex numbering

The English chapter example includes a named `number` capture. After applying it, select **Regex: English chapters** under **Numbering types**. The same approach works for a custom format.

```regex
^(?<number>[0-9０-９]+)[.．]\s*(?<title>.+)$
```

This captures 233 as the number in `233. The Trial` and uses **The Trial** as the display title. Explicit `number` takes precedence. Without it, the checker tries a standard Chinese chapter number in the display title and then the source heading. Regex patterns without a recognizable standard type form their own series. A missing or invalid number does not undo a successful title match.

## Review results

Filter by problem type or review status. Select a source line to jump to the matching section. This clears the contents search and expands its parent headings. Review marks last for the current session and reset when the directory or check settings change. Cancel a running check and use **Run check again** to restart it.
