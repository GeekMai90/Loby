# Loby WeChat open theme protocol

## Output envelope

Return exactly:

```loby-wechat-theme-change
{"message":"我已经为二级标题加入更清晰的序号结构，并保留了长标题的换行空间。这样在手机端会更容易扫读，你可以重点看看长标题换行时序号和文字是否仍然对齐。","theme":{}}
```

`theme` must be the full updated manifest supplied in the input context.

`message` is the assistant's visible reply. Write 2–3 concise, natural Chinese sentences that cover:

- what visibly changed;
- why the treatment fits the user's request or WeChat compatibility;
- what the user should check in the preview or after pasting into WeChat.

Do not write it as a terse changelog entry. Do not include raw CSS/HTML implementation details unless the user explicitly asks, and do not claim the pasted WeChat result was verified unless it actually was.

## Immutable fields

Copy these values exactly from the current theme:

- `schemaVersion`
- `id`
- `kind`
- `baseThemeId`
- `createdAt`

The app sets `updatedAt`; copy the existing value in the response.

## Required base style

Every theme has manual base controls. Keep every field present.

```json
{
  "typography": {
    "articleTitleSize": 28,
    "h2Size": 24,
    "h3Size": 18,
    "h4Size": 15,
    "bodySize": 15,
    "bodyLineHeight": 1.9,
    "paragraphSpacing": 18
  },
  "colors": {
    "accent": "#4F6FFF",
    "pageBackground": "#FFFFFF",
    "titleText": "#0B1220",
    "bodyText": "#334155",
    "emphasisText": "#3F5EF5",
    "linkText": "#3F5EF5",
    "markColor": "rgba(79,111,255,0.14)"
  },
  "layout": {
    "contentPadding": 8,
    "sectionSpacing": 36,
    "radius": 20,
    "imageRadius": 14,
    "shadowStrength": 1
  }
}
```

## Free CSS

`custom.css` accepts ordinary presentation CSS. Loby resolves the base variables and compiles supported rules to inline styles before copying to WeChat.

Available base variables:

- `--loby-accent`
- `--loby-page-background`
- `--loby-title-text`
- `--loby-body-text`
- `--loby-emphasis-text`
- `--loby-link-text`
- `--loby-mark-color`
- `--loby-radius`
- `--loby-image-radius`
- `--loby-shadow-strength`

Canonical article selectors include:

```css
[data-loby-publish="wechat"]
[data-loby-role="article-header"]
[data-loby-role="article-title"]
[data-loby-role="article-summary"]
[data-loby-role="article-body"]
[data-loby-role="article-body"] h2
[data-loby-role="article-body"] h3
[data-loby-role="article-body"] h4
blockquote
ul
ol
img
pre
table
hr
```

You may add classes in HTML transforms and style those classes freely.

Legacy `data-nibva-*`, `--nibva-*`, and `.nibva-*` names are not part of the current protocol. Replace any such names inherited from an older theme with their `loby-*` equivalents instead of preserving them.

## Reusable HTML transforms

`custom.htmlTransforms` is an array of generic transformations. It is not a list of visual presets.

```json
{
  "selector": "[data-loby-role=\"article-body\"] h2",
  "operation": "replace-inner",
  "html": "<span class=\"section-number\">{{index2}}</span><span class=\"section-title\">{{content}}</span>"
}
```

Operations:

- `prepend`: insert HTML at the beginning of every match
- `append`: insert HTML at the end of every match
- `replace-inner`: replace the matched element's children
- `replace`: replace the complete matched element

Placeholders:

- `{{title}}`
- `{{summary}}`
- `{{date}}`
- `{{author}}`
- `{{tagsHtml}}`
- `{{textCount}}`
- `{{readingMinutes}}`
- `{{content}}`: current matched element HTML
- `{{text}}`: current matched element plain text
- `{{index}}`: one-based match index
- `{{index2}}`: zero-padded match index

## Complete manifest shape

```json
{
  "schemaVersion": 2,
  "id": "theme-immutable-id",
  "kind": "personal",
  "name": "主题名称",
  "description": "主题描述",
  "baseThemeId": "deep-blue-study",
  "swatches": ["#4F6FFF", "#0B1220", "#F8FAFC"],
  "baseStyle": {},
  "custom": {
    "css": "",
    "htmlTransforms": []
  },
  "createdAt": "2026-07-16T00:00:00.000Z",
  "updatedAt": "2026-07-16T00:00:00.000Z"
}
```

## Compatibility behavior

- Loby renders custom HTML in an isolated preview.
- CSS is compiled to inline declarations for WeChat output.
- `::before` and `::after` text decorations are materialized as real spans when possible.
- Scripts, event handlers, iframes, and executable embeds are removed. Unsupported static interaction containers are unwrapped while preserving readable content.
- Unsupported rules produce compatibility warnings instead of silently changing article content.
- A transform may wrap or decorate protected article content, but it is ignored if it deletes, duplicates, reorders, or rewrites article text, links, or images. Use `{{content}}` when replacing a content-bearing match.

## Hard boundaries

- No article-content edits.
- No changes to immutable theme identity fields.
- No prose outside the protocol block.
- No interaction that depends on JavaScript after paste into WeChat.
