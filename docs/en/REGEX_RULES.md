# Custom regex recognition

[English home](../../README.en.md) · [中文](../REGEX_RULES.md) · [Numbering checks](NUMBERING_CHECK.md)

Open **Rules → Advanced rules · Custom regex**. Use **Add English chapter example** to recognize `Chapter 12`, `CHAPTER 12 The Trial` or `Chapter 12: The Trial`. The sample rule extracts the number for the numbering check and keeps the full line as the chapter title. Select **Apply rules** to use it.

**Add leading-number example** recognizes lines like `233.第233章 比试` and displays `第233章 比试`. It also supports fullwidth digits and punctuation and common Chinese numerals. It matches the heading at the beginning of the line rather than a mention in body text.

## Write a rule

Each nonblank line is trimmed and matched in list order. The first enabled regex that matches the whole line wins. Keyword rules are tried only when no regex matches. Move a regex up or down to change priority. Choose a level from 1 to 10 to control the heading hierarchy. The rule name can contain up to 40 characters and a pattern up to 1,000. You can keep up to 20 rules.

Write the JavaScript pattern without enclosing slashes or flags. Unicode mode is enabled. Matching is case sensitive. The maximum heading length applies to the complete trimmed source line. It defaults to 60 and can be set from 4 to 500.

A named `title` group supplies the display and export title. Without it, the full matched line is used. A defined `title` group must capture nonblank text in every matching branch. A named `number` group supplies a number for the [numbering check](NUMBERING_CHECK.md#custom-regex-numbering).

| Source                              | Pattern                                                              |
| ----------------------------------- | -------------------------------------------------------------------- |
| `Chapter 12: The Trial`             | `^(?:[Cc]hapter\|CHAPTER)[ \t]+(?<number>[0-9]+)(?:[ \t:.–—-]+.*)?$` |
| `233.第233章 比试` → `第233章 比试` | `^[0-9]+\.[ \t]*(?<title>第[0-9]+章.*)$`                             |
| `233. The Trial` → `The Trial`      | `^(?<number>[0-9]+)\.[ \t]*(?<title>.+)$`                            |
| `卷12 远行` with level 1            | `^卷(?<number>[0-9０-９一二三四五六七八九十]+)[ \t　]+.+$`           |

When copying the English example, use the following literal pattern in the field.

```regex
^(?:[Cc]hapter|CHAPTER)[ \t]+(?<number>[0-9]+)(?:[ \t:.–—-]+.*)?$
```

## Test and apply

- **Test text** runs the draft rules against up to 20,000 characters you paste into the test field. **Test current file** uses the imported TXT and its corrections.
- The result counts all recognized headings and regex matches, then shows the first 20 matches with source lines, rules, levels and display titles. Testing leaves the current contents intact. Select **Apply rules** when satisfied.
- A timeout leaves the previous contents in place. Simplify expensive patterns, especially nested repetitions, and start with a few representative lines.
- Applying rules saves them in the browser. **Restore defaults**, then **Apply rules**, removes custom regex rules. Your book and the test text are session data.
- Merging a regex heading into the previous section keeps the complete original line, including text left out of the display title.
