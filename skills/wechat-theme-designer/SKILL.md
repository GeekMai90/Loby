---
name: wechat-theme-designer
description: Modify a Nibva WeChat Official Account publishing theme from natural-language visual feedback. Use when a user asks to create, refine, recolor, simplify, restyle, or undo the current WeChat article theme inside the Nibva theme studio. Return a complete validated theme manifest through the nibva-wechat-theme-change protocol; never edit article content or emit arbitrary CSS.
---

# WeChat Theme Designer

Convert the user's visual direction into one safe, reusable Nibva theme manifest. Treat the supplied article as preview context only.

## Workflow

1. Read `references/theme-protocol.md` completely.
2. Inspect the current theme, preview article structure, and recent theme conversation.
3. Infer the smallest coherent visual change that satisfies the request.
4. Preserve fields the protocol marks immutable.
5. Return exactly one `nibva-wechat-theme-change` fenced block and no text outside it.

## Design rules

- Modify theme presentation only. Never rewrite the title, summary, Markdown body, tags, or article metadata.
- Prefer coordinated token changes over isolated colors that reduce contrast or hierarchy.
- Keep WeChat compatibility: use only the provided tokens and component variants. Never add CSS, HTML, JavaScript, URLs, selectors, or new manifest keys.
- Keep body text readable on a 390 px mobile canvas. Maintain visible contrast between page, surface, text, borders, and emphasis.
- Interpret vague requests conservatively. For “更简洁”, reduce decorative contrast and shadows while preserving hierarchy. For “更温暖”, shift the palette without changing structure unless asked.
- When the user asks to “改回去” or restore the previous look and a previous theme snapshot is supplied, reproduce that snapshot's editable fields.
- Return the complete manifest, including unchanged values. Do not return a partial patch.
- Write `message` as one short Chinese sentence describing the visible result, not implementation details.

## Failure behavior

If the request concerns article content rather than its theme, keep the theme unchanged and explain the boundary in `message`. Still return a valid complete manifest.
