# WeChat Theme Studio

## Goal

The WeChat theme studio gives writers two complementary ways to design reusable publishing themes:

- direct controls for universal typography, color, and layout values;
- an open AI design surface for structural and decorative HTML/CSS.

The writer should not need an AI round trip to change a font size. The AI should not be constrained to a small catalog of heading, quote, hero, or footer presets.

## Product Boundary

### Manual base controls

Every theme has these values, so the left rail may expose them directly:

- Typography: article title, H2, H3, H4, and body sizes; body line height; paragraph spacing.
- Color: accent, page background, title, body, emphasis, link, and mark color.
- Layout: horizontal content padding, section spacing, general radius, image radius, and shadow strength.

The left rail switches between `文章` and `样式`. It must not expose optional brand, footer, hero, quote, or decoration modules as universal form fields.

Changing a built-in theme creates a personal copy. Slider movement updates the preview immediately; one completed gesture creates one persisted revision.

### Open AI design

AI may author presentation CSS and reusable HTML transformations without choosing from preset visual variants. It may create or remove optional headers, title decorations, quote treatments, dividers, signatures, metadata blocks, and other theme-specific structures.

The only visual acceptance boundary is that Loby can compile the result into HTML that remains meaningful in the WeChat editor.

Scripts, event handlers, iframes, and executable embeds are not presentation styles. The compatibility compiler removes executable or embedded content and unwraps unsupported static interaction containers while preserving their readable content.

AI changes presentation only. Article Markdown, title, summary, tags, and other writing content remain read-only preview inputs.
Each HTML transformation is applied to an isolated candidate DOM. If it removes, duplicates, reorders, or rewrites protected article text, links, or images, Loby ignores that transformation and reports a compatibility warning; surrounding and decorating the protected content remains unrestricted.

## Theme Manifest V2

```ts
interface WechatThemeManifest {
  schemaVersion: 2;
  id: string;
  kind: "built-in" | "personal";
  name: string;
  description: string;
  baseThemeId?: string;
  swatches: [string, string, string];
  baseStyle: {
    typography: {
      articleTitleSize: number;
      h2Size: number;
      h3Size: number;
      h4Size: number;
      bodySize: number;
      bodyLineHeight: number;
      paragraphSpacing: number;
    };
    colors: {
      accent: string;
      pageBackground: string;
      titleText: string;
      bodyText: string;
      emphasisText: string;
      linkText: string;
      markColor: string;
    };
    layout: {
      contentPadding: number;
      sectionSpacing: number;
      radius: number;
      imageRadius: number;
      shadowStrength: number;
    };
  };
  custom?: {
    css: string;
    htmlTransforms: Array<{
      selector: string;
      operation: "prepend" | "append" | "replace-inner" | "replace";
      html: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}
```

`baseStyle` is required and powers the manual controls. `custom` is optional and AI-owned. There are no required hero, quote, footer, brand, or heading component enums.

Persisted v1 personal themes are migrated to v2 when loaded. Identity, representative colors, and base-theme lineage are preserved; legacy visual structure starts from the corresponding built-in open theme.

## Reusable HTML Transformations

An AI theme is reusable across articles, so it does not store one article's completed HTML. Instead, it may transform the canonical article DOM with arbitrary selectors and presentation HTML.

Supported generic operations:

- `prepend`
- `append`
- `replace-inner`
- `replace`

Templates may use article and match placeholders such as `{{title}}`, `{{summary}}`, `{{date}}`, `{{tagsHtml}}`, `{{content}}`, `{{text}}`, `{{index}}`, and `{{index2}}`.

This is a transport mechanism rather than a visual component catalog: AI remains free to create any static structure the WeChat output can preserve.

## Compatibility Compilation

The renderer owns compatibility. A theme does not write directly to the clipboard.

1. Render Markdown into the canonical article DOM.
2. Apply each reusable HTML transformation to an isolated candidate.
3. Remove executable content and downgrade unsupported interaction containers in that candidate.
4. Reject the candidate if compatibility cleanup or the transformation changes protected article content.
5. Resolve manual and AI-authored CSS variables.
6. Apply CSS rules with cascade order and selector specificity to the canonical DOM.
7. Materialize text `::before` and `::after` decorations as real spans when possible.
8. Serialize the result with inline styles.
9. Report ignored or downgraded rules as compatibility warnings.

The preview runs in a sandboxed iframe. Publishing copies the compiled inline HTML, not the raw theme source.

Local preview proves Loby rendering and compilation, not complete platform fidelity. Release verification still requires pasting representative output into the real WeChat editor.

## AI Protocol

The bundled `wechat-theme-designer` skill receives:

- the complete current v2 manifest;
- previous theme revision when available;
- preview article structure;
- recent theme conversation;
- canonical selectors, CSS variables, HTML operations, and placeholders.

The assistant returns one complete `loby-wechat-theme-change` manifest. Loby validates identity and base controls, accepts open CSS/HTML source, rejects stale responses, records one whole-theme revision, refreshes the preview, and auto-saves.

The theme assistant uses the same panel header, conversation-history menu, new-chat action, message surfaces, pending state, composer shell, attachment control, model menu, and send control as the main Loby assistant. Each theme can retain multiple named conversations; switching conversations restores its messages and independent Codex thread, while legacy single-history data migrates into the first conversation. Only the theme-specific suggestions, conversation storage, prompt construction, manifest validation, and theme-application controller remain feature-specific.

Theme requests run through the same Codex event stream as the main assistant. The assistant message shows live reasoning and tool steps, usage after completion, and a cancel action while running. Theme runs do not ask for step-by-step approval: they use an autonomous read-only sandbox, so the assistant can inspect user-provided local projects and reference files but cannot directly modify them. The raw manifest remains internal; only the validated change summary is shown as the final assistant message, and the completed run details are stored with that theme conversation.

The theme assistant also accepts pasted, dropped, or file-picked images as temporary visual references. They are sent through Codex `--image`, remain available only for the current Loby process, and are never stored in the theme conversation file or writing library.

## State And Persistence

- Built-in themes ship with the application and remain immutable.
- Personal themes live in the current writing library's visible `themes/` directory, with one readable `.lobywechat` JSON file per theme.
- Theme files contain only the final reusable manifest. They never contain AI conversations, revisions, redo history, favorites, or the default-theme preference.
- Theme AI conversations, undo/redo history, favorites, and the default-theme preference live in `.loby/publishing/wechat-theme-state.json` inside the writing library.
- Existing platform application theme state is copied into that library-local file on first load, so upgrades preserve current work without continuing to depend on the old device path.
- Theme-conversation image attachments are intentionally excluded from that persistent data.
- Browser development keeps the existing namespaced local-storage fallback.
- A personal theme can be reused in another writing library by copying or importing its `.lobywechat` file.
- Manual and AI changes share the same revision history.
- A user manual change made during an AI request updates `updatedAt`; a late AI response is rejected as stale, so the user's direct adjustment wins.

## Standalone Theme Files

Theme studio imports and exports `.lobywechat` files through the native open and save dialogs. The file is readable JSON with a versioned `loby-wechat-theme` envelope containing one complete theme manifest. It includes base styles, custom CSS, HTML transformations, and source attribution, but excludes conversations, revision history, favorites, and the default-theme preference. The channel-specific extension leaves `.lobyeditor` available for future editor themes.

Every imported theme receives a new ID and is saved into the current writing library's `themes/` directory, even when the file was exported from a built-in theme. Import never overwrites a built-in or existing personal theme. File reads and writes are limited to the `.lobywechat` extension and bounded in size.

## Verification

Required automated coverage:

- v2 validation and deep cloning;
- v1-to-v2 personal-theme migration;
- unrestricted presentation CSS and HTML transform acceptance;
- executable markup removal;
- CSS variable resolution and inline compilation;
- pseudo-element materialization where possible;
- stale AI-response rejection;
- built-in copy-on-first-manual-edit;
- left-rail article/style separation;
- personal-theme persistence and undo/redo.

Required release checks:

- `npm run check` passes;
- phone and desktop previews render both bundled themes;
- manual controls update the preview and persist after restart;
- an AI-created title decoration survives compilation;
- supported output is pasted into the real WeChat editor and visually checked.

## Non-Goals

- Editing article content from the theme studio.
- Executing AI-authored JavaScript.
- Treating the local preview as proof of every future WeChat rendering behavior.
- Exposing raw theme source as the ordinary manual editing workflow.
