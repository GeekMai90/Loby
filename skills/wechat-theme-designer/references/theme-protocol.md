# Loby 微信开放主题协议

## 输出 envelope

严格返回：

```loby-wechat-theme-result
{"message":"我已经为二级标题加入更清晰的序号结构，并保留了长标题的换行空间。这样在手机端会更容易扫读，你可以重点看看长标题换行时序号和文字是否仍然对齐。","themePatch":{"baseStyle":{"typography":{"h2Size":24}}}}
```

`themePatch` 是可选字段，只在主题确实需要变化时提供。问题或解释只返回 message：

```loby-wechat-theme-result
{"message":"这轮只是在说明标题的兼容性，没有修改当前主题。"}
```

`message` 是用户可见回复。使用 2–3 句简洁自然的中文，覆盖：

- 有哪些可见变化；
- 为什么这种处理符合用户要求或微信兼容性；
- 用户应在预览或粘贴到微信后检查什么。

不要写成简短 changelog。除非用户明确询问，不提供原始 CSS/HTML 实现细节；除非确实完成验证，不声称微信粘贴结果已通过验证。

## Patch 边界

允许的顶级 patch 字段：

- `name`
- `description`
- `swatches`
- `baseStyle`
- `custom`

不得返回 `schemaVersion`、`id`、`kind`、`baseThemeId`、`createdAt` 或 `updatedAt`。这些字段由 Loby 管理；Loby 在本地合并 patch、验证完整结果并设置 `updatedAt`。

## 必需 base style

只提供变化的 base-style 字段，Loby 保留所有省略值。

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

## 自由 CSS

`custom.css` 接受普通 presentation CSS。复制到微信前，Loby 解析基础变量并把受支持规则编译为 inline style。

可用基础变量：

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

标准文章 selector 包括：

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

可以在 HTML transforms 中添加 class，并自由设置这些 class 的样式。

旧 `data-nibva-*`、`--nibva-*` 和 `.nibva-*` 不属于当前协议。旧主题中继承的这些名称必须替换为对应 `loby-*`，不得继续保留。

## 可复用 HTML transforms

`custom.htmlTransforms` 是通用转换数组，不是视觉 preset 列表。

```json
{
  "selector": "[data-loby-role=\"article-body\"] h2",
  "operation": "replace-inner",
  "html": "<span class=\"section-number\">{{index2}}</span><span class=\"section-title\">{{content}}</span>"
}
```

操作：

- `prepend`：在每个匹配项开头插入 HTML；
- `append`：在每个匹配项末尾插入 HTML；
- `replace-inner`：替换匹配元素的 children；
- `replace`：替换完整匹配元素。

占位符：

- `{{title}}`
- `{{summary}}`
- `{{date}}`
- `{{author}}`
- `{{tagsHtml}}`
- `{{textCount}}`
- `{{readingMinutes}}`
- `{{content}}`：当前匹配元素 HTML；
- `{{text}}`：当前匹配元素纯文本；
- `{{index}}`：从 1 开始的匹配序号；
- `{{index2}}`：补零的匹配序号。

## Patch 结构

```json
{
  "name": "可选的新名称",
  "baseStyle": {
    "typography": { "h2Size": 24 },
    "colors": { "accent": "#4F6FFF" },
    "layout": { "sectionSpacing": 36 }
  },
  "custom": {
    "css": "完整的新 CSS，仅在 CSS 变化时提供",
    "htmlTransforms": []
  }
}
```

`baseStyle` 只返回变化的叶子字段。`custom` 中省略的 `css` 或 `htmlTransforms` 会被保留；提供数组时会替换当前 transform 数组。只有需要删除全部 custom CSS 与 transforms 时才把 `custom` 设为 `null`。

## 兼容行为

- Loby 在隔离 preview 中渲染 custom HTML。
- CSS 编译为微信输出的 inline declarations。
- `::before` 与 `::after` 文本装饰在可行时物化为真实 span。
- script、事件处理器、iframe 与可执行 embed 会被删除；不支持的静态交互容器会被 unwrap，同时保留可读内容。
- 不支持的规则产生兼容 warning，而不是静默改变文章内容。
- transform 可以包裹或装饰受保护文章内容；若删除、复制、重排或重写文章文字、链接或图片，则整条 transform 被忽略。替换含内容的匹配项时使用 `{{content}}`。

## 硬边界

- 不编辑文章内容。
- `themePatch` 不包含不可变 theme identity 字段。
- 协议块外没有 prose。
- 粘贴到微信后不依赖 JavaScript 交互。
