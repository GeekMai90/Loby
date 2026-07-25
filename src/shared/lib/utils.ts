/**
 * [INPUT]: 依赖 clsx、tailwind-merge 与 styles 定义的语义字号名称
 * [OUTPUT]: 对外提供能正确区分语义字号和文字颜色的 cn
 * [POS]: shared 层的跨功能 class 合并边界，防止 Tailwind 自定义字号被颜色 utility 误删
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeAppClasses = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "app-base", "body", "subtitle", "title", "display"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return mergeAppClasses(clsx(inputs));
}
