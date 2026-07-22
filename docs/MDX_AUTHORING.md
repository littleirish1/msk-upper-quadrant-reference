# MDX Authoring

Condition and guided-case content remains one MDX file per record. Use `##`
headings for in-page sections; `###` and deeper headings stay inside the current
section.

## Numeric Comparators

Prefer HTML entities for comparator notation in newly authored prose:

```md
Age &lt;45 years, response &gt;90%, and p&lt;0.05.
```

The shared MDX reader also applies a deterministic compatibility transform to
legacy prose. It escapes `<` or `>` only when the next non-space character is a
digit, and only outside fenced code, inline code, and JSX/HTML tags. This covers
numeric clinical notation without phrase-specific replacements or changes to
clinical wording.

Comparator examples and parser behaviour are protected by `npm run test:mdx`.
Do not add one-off replacements for individual clinical phrases.
