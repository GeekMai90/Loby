# 键盘快捷键

Loby 使用一个 typed catalog 同时驱动按键匹配、菜单标签、按钮提示、无障碍信息、CodeMirror binding 与应用内快捷键总览。

## 唯一事实来源

当前快捷键及其分组以 `src/shared/lib/keyboardShortcuts.ts` 的 `APP_SHORTCUTS` 为准。本文不复制完整按键表，避免新增或调整快捷键后形成第二份过时清单。

平台语义：`Mod` 在 macOS 表示 Command，在 Windows/Linux 表示 Control；界面显示和 `aria-keyshortcuts` 由共享 formatter 生成。

## 所有权

- `src/shared/lib/keyboardShortcuts.ts`：目录、严格匹配、平台显示、无障碍标签和 CodeMirror key 转换；
- `src/shared/hooks/useAppShortcuts.ts`：全局 dispatcher 与动作可用性；
- 设置模块的快捷键 Dialog：从目录生成用户可见总览；
- `src-tauri/src/app.rs`：标准文件/应用菜单的原生 accelerator。

禁止在组件中新增孤立 `keydown` listener、手写第二份 shortcut label，或让 CodeMirror 与 App 同时处理同一组合键。

## 新增快捷键

1. 在 `APP_SHORTCUTS` 增加唯一组合键、稳定 action id 和正确分组。
2. App 动作在共享 dispatcher 接入 handler/availability；编辑器动作使用 `codeMirrorShortcutKey` 转换。
3. 有可见按钮时复用共享 title 与 aria helper。
4. 验证输入框、中文 IME、Dialog、CodeMirror 和操作系统保留组合键不会冲突。
5. 运行快捷键针对性测试与 `npm run check`。
