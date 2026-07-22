/**
 * [INPUT]: 依赖 clsx、tailwind-merge
 * [OUTPUT]: 对外提供 cn
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
