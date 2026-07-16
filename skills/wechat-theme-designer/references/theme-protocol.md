# Nibva WeChat theme protocol

## Output envelope

Return exactly:

```nibva-wechat-theme-change
{"message":"已让整体更简洁，并保留清晰的标题层级。","theme":{}}
```

`theme` must be the full updated manifest supplied in the input context.

## Immutable fields

Copy these values exactly from the current theme:

- `schemaVersion`
- `id`
- `kind`
- `baseThemeId`
- `createdAt`

The app sets `updatedAt`; copy the existing value in the response.

## Editable fields

- `name`: concise Chinese theme name, maximum 80 characters
- `description`: one-sentence usage description
- `swatches`: exactly three representative safe CSS color values
- `tokens`: every key below must be present
- `components`: choose only the enum values below
- `brand`: edit only when the user explicitly asks about author, date, tags, reading stats, or footer copy

## Component enums

```json
{
  "heading": "part | editorial",
  "hero": "product | editorial",
  "quote": "card | editorial",
  "footer": "interactive | signature"
}
```

## Brand object

```json
{
  "author": "麦先生说",
  "footerText": "如果对你有用，欢迎点赞、分享、推荐",
  "showDate": true,
  "showTags": true,
  "showReadingStats": false
}
```

## Token keys

All values are strings. Use ordinary safe CSS values without semicolons, braces, quotes, markup, URLs, or `var()`.

- Palette and surfaces: `accent`, `accentSoft`, `pageBackground`, `pageText`, `surface`, `surfaceAlt`
- Borders: `border`, `borderStrong`
- Typography: `headingTitle`, `headingLabel`, `paragraphText`, `mutedText`, `listText`, `linkText`, `emphasisText`
- Quote: `quoteBackground`, `quoteBorder`, `quoteText`
- Highlight: `markBackground`, `markText`
- Code: `inlineCodeBackground`, `inlineCodeText`
- Table: `tableBackground`, `tableHeadBackground`, `tableBorder`
- Image: `imageBackground`, `imageBorder`
- Effects: `shadow`, `shadowSoft`, `radius`

Allowed value families:

- Colors: hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, or `transparent`
- `quoteBackground`: a color or `linear-gradient()` made only from allowed colors
- `shadow` and `shadowSoft`: `none` or conventional box-shadow values using allowed colors
- `radius`: a non-negative `px`, `rem`, or `%` value

## Complete manifest shape

```json
{
  "schemaVersion": 1,
  "id": "theme-immutable-id",
  "kind": "personal",
  "name": "主题名称",
  "description": "主题描述",
  "baseThemeId": "deep-blue-study",
  "swatches": ["#4F6FFF", "#0B1220", "#F8FAFC"],
  "tokens": {
    "accent": "#4F6FFF",
    "accentSoft": "#7C93FF",
    "pageBackground": "#FFFFFF",
    "pageText": "#334155",
    "surface": "#FFFFFF",
    "surfaceAlt": "#FAFAFA",
    "border": "#E2E8F0",
    "borderStrong": "#CBD5E1",
    "headingTitle": "#0B1220",
    "headingLabel": "#64748B",
    "paragraphText": "#334155",
    "mutedText": "#64748B",
    "quoteBackground": "rgba(79,111,255,0.08)",
    "quoteBorder": "rgba(79,111,255,0.28)",
    "quoteText": "#475569",
    "listText": "#334155",
    "linkText": "#3F5EF5",
    "emphasisText": "#3F5EF5",
    "markBackground": "rgba(79,111,255,0.14)",
    "markText": "#3048C8",
    "inlineCodeBackground": "#EEF2F7",
    "inlineCodeText": "#111827",
    "tableBackground": "#FFFFFF",
    "tableHeadBackground": "#F8FAFC",
    "tableBorder": "#E2E8F0",
    "imageBackground": "#FFFFFF",
    "imageBorder": "#EEF2F7",
    "shadow": "0 4px 20px rgba(11,18,32,0.06)",
    "shadowSoft": "0 8px 20px rgba(11,18,32,0.04)",
    "radius": "20px"
  },
  "components": {
    "heading": "part",
    "hero": "product",
    "quote": "card",
    "footer": "interactive"
  },
  "brand": {
    "author": "麦先生说",
    "footerText": "如果对你有用，欢迎点赞、分享、推荐",
    "showDate": true,
    "showTags": true,
    "showReadingStats": false
  },
  "createdAt": "2026-07-16T00:00:00.000Z",
  "updatedAt": "2026-07-16T00:00:00.000Z"
}
```

## Hard prohibitions

- No partial theme patch.
- No Markdown article edits.
- No arbitrary CSS or HTML.
- No `url()`, remote asset, font import, script, event handler, or selector.
- No field outside the documented manifest.
- No prose outside the protocol block.
