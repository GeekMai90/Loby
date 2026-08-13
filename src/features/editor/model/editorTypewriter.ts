/**
 * [INPUT]: 依赖 CodeMirror EditorView/ViewPlugin 的视口几何、选区更新与 scrollIntoView 效果
 * [OUTPUT]: 对外提供 typewriterContentPadding 几何计算与 typewriterScrollExtension
 * [POS]: editor model 的打字机滚动边界，为文稿首尾补齐可居中空间，连续输入只执行最后一次光标居中，并在 IME 组合期完全让出滚动权
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

const DEFAULT_CONTENT_BOTTOM_PADDING = 128;

export interface TypewriterContentPadding {
  top: number;
  bottom: number;
}

export function typewriterContentPadding(viewportHeight: number, scrollerPaddingTop: number, lineHeight: number): TypewriterContentPadding {
  const cursorCenterOffset = Math.max(0, (viewportHeight - lineHeight) / 2);
  return {
    top: Math.max(0, Math.round(cursorCenterOffset - scrollerPaddingTop)),
    bottom: Math.max(DEFAULT_CONTENT_BOTTOM_PADDING, Math.round(cursorCenterOffset)),
  };
}

function numericCssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const typewriterViewPlugin = ViewPlugin.fromClass(
  class {
    private animationFrame: number | null = null;
    private readonly initialPaddingTop: string;
    private readonly initialPaddingBottom: string;

    constructor(private readonly view: EditorView) {
      this.initialPaddingTop = view.contentDOM.style.paddingTop;
      this.initialPaddingBottom = view.contentDOM.style.paddingBottom;
      this.updateContentPadding();
      this.scheduleCursorCenter();
    }

    update(update: ViewUpdate) {
      if (update.geometryChanged || update.viewportChanged) this.updateContentPadding();
      // 组合期每次 preedit 变化都算 docChanged，此时再抢一次居中，
      // 只会与输入事务自带的 scrollIntoView 相互顶，让正文与候选窗一起抖。
      // 组合结束后的提交事务会照常触发居中，不会漏。
      if (update.view.composing) return;
      if (update.docChanged || update.selectionSet || (update.focusChanged && update.view.hasFocus)) {
        this.scheduleCursorCenter();
      }
    }

    destroy() {
      if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
      this.view.contentDOM.style.paddingTop = this.initialPaddingTop;
      this.view.contentDOM.style.paddingBottom = this.initialPaddingBottom;
    }

    private updateContentPadding() {
      const scrollerStyle = window.getComputedStyle(this.view.scrollDOM);
      const padding = typewriterContentPadding(
        this.view.scrollDOM.clientHeight,
        numericCssPixels(scrollerStyle.paddingTop),
        this.view.defaultLineHeight,
      );
      const nextPaddingTop = `${padding.top}px`;
      const nextPaddingBottom = `${padding.bottom}px`;
      if (this.view.contentDOM.style.paddingTop !== nextPaddingTop) this.view.contentDOM.style.paddingTop = nextPaddingTop;
      if (this.view.contentDOM.style.paddingBottom !== nextPaddingBottom) this.view.contentDOM.style.paddingBottom = nextPaddingBottom;
    }

    private scheduleCursorCenter() {
      if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = window.requestAnimationFrame(() => {
        this.animationFrame = null;
        if (!this.view.hasFocus || this.view.composing) return;
        this.view.dispatch({
          effects: EditorView.scrollIntoView(this.view.state.selection.main.head, { y: "center" }),
        });
      });
    }
  },
);

export const typewriterScrollExtension: Extension = typewriterViewPlugin;
