# media/

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

在线图片能力只负责素材来源与裁剪交互，不拥有编辑器正文或写作库持久化；Unsplash Key 通过 native command 管理，最终图片必须由 editor/library 链路写入 `assets/images`。

<directory>
components/ - 图片来源选择、Unsplash 随机/搜索结果与横版裁剪交互
model/ - Unsplash native command 适配、随机/搜索结果与裁剪契约
</directory>

<member>
components/CropImagePreview.tsx - 横版裁剪画布，使用前景色底面和裁剪专用暗色 scrim 显示未保留区域，提供折角取景框、原图遮罩、九宫格与 Mac 触控板/鼠标滚轮缩放，并把取景手势映射为归一化焦点和缩放值
components/CropImagePreview.test.tsx - 锁定不同原图与裁剪比例下的取景几何和可拖动方向
components/ImageSourceDialog.tsx - 斜线菜单图片入口的本地/在线来源选择、固定高度 Unsplash 随机/搜索浏览、带无感预加载退避的 AI/手动搜索准备态与比例标签明确的底部裁剪流程
components/UnsplashPreparationView.tsx - 完整复用并等比放大主界面 AI Orb，以单一当前进度和共享进度条呈现文章推荐、中文翻译和手动 Unsplash 搜索阶段
components/UnsplashPreparationView.test.tsx - 锁定 AI 入口完整几何复用、等比放大、手动搜索阶段和无重复说明/步骤清单的准备态结构
model/crop.ts - 纯裁剪几何模型，统一预览画布与 native crop 使用的比例、缩放边界、中心放大、遮罩范围和可拖动方向
model/unsplash.ts - 用户 Key 状态、Unsplash 横版随机/搜索/验证、受限尺寸下载裁剪落盘 command 的 renderer 适配
model/searchTranslation.ts - 中文搜索词检测、AI/百度翻译提供商选择、自动兜底与原词回退的 Unsplash 搜索词编排
model/translation.ts - 百度开放平台标准翻译 native command 适配；只接收去敏配置状态与英文翻译结果
</member>

数据流固定为“随机或搜索结果 → 用户确认 → native 下载/裁剪 → editor 插入本地 Markdown”，不向编辑器写入远程 URL；设置页同时保存 AI 推荐偏好，但 Key 仍只调用 native 状态和保存/验证能力。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
