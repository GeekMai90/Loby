---
name: wechat-theme-designer
description: Design or modify a reusable Loby WeChat Official Account publishing theme from natural-language visual feedback. Use the open theme result protocol, including partial base-style, CSS, and reusable HTML-transform patches.
---

# WeChat Theme Designer

Create the visual result the user asks for without limiting the design to preset component variants. The supplied article is preview context; the article's words and metadata remain unchanged.

## Workflow

1. Read `references/theme-protocol.md` completely.
2. Inspect the current theme and preview article structure supplied by Loby. Continue from the Codex thread instead of asking Loby to repeat prior messages.
3. Make the smallest coherent change that satisfies the user's visual direction.
4. Use `baseStyle` for ordinary typography, color, and layout values.
5. Use free CSS and reusable HTML transforms for structural or decorative design.
6. Return only fields that need to change. Loby merges the patch into the current theme and preserves immutable identity fields.
7. Return exactly one `loby-wechat-theme-result` fenced block and no text outside it.

## Design freedom

- You may write unrestricted presentation CSS in `custom.css`.
- You may add, wrap, replace, prepend, or append presentation HTML through `custom.htmlTransforms`.
- You are not limited to built-in heading, hero, quote, footer, or decoration presets.
- A theme may omit any optional decoration or custom module.
- Prefer CSS variables such as `var(--loby-accent)` and `var(--loby-title-text)` when custom design should follow the user's manual base-style controls.
- Keep the result reusable across different articles. Use placeholders instead of copying text from the preview article.

## Output boundary

- The final design must remain meaningful after Loby compiles it to inline-styled HTML for the WeChat editor.
- Scripts, event handlers, iframes, and executable embeds are not presentation styles and are removed by the compatibility compiler. Unsupported static interaction containers are unwrapped so their readable content remains.
- If a visual idea depends on unsupported interaction, redesign it as static WeChat-compatible presentation.
- Never rewrite article Markdown, title, summary, tags, or other content.
- For an actual visual change, return `themePatch` with only changed fields. Do not repeat unchanged theme values.
- For questions, explanations, or requests that do not require a visual change, omit `themePatch` and return only `message`.
- Write `message` as 2–3 short, natural Chinese sentences. Briefly explain what visibly changed, why this treatment fits the request or WeChat compatibility, and what the user should check in the preview or after pasting into WeChat.
- Keep `message` warm and conversational rather than sounding like a changelog. Avoid long technical implementation details or claiming a pasted result was verified when it was not.

## Failure behavior

If the request concerns article content instead of theme presentation, omit `themePatch` and explain the boundary and a useful next step in `message`.
