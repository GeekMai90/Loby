import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openUrl } from "@tauri-apps/plugin-opener";

export interface MarkdownLinkTarget {
  url: string;
  from: number;
  to: number;
  labelFrom: number;
  labelTo: number;
}

export function createEditorLinkNavigationExtension(openLink: (url: string) => void | Promise<void> = openExternalLink) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0 || !hasOpenLinkModifier(event)) return false;

      const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (position == null) return false;

      const target = resolveMarkdownLinkAt(view.state, position);
      const url = target ? normalizeExternalLink(target.url) : null;
      if (!url) return false;

      event.preventDefault();
      event.stopPropagation();
      void Promise.resolve(openLink(url)).catch((error) => {
        console.error("Failed to open editor link", error);
      });
      return true;
    },
  });
}

export function resolveMarkdownLinkAt(state: EditorState, position: number): MarkdownLinkTarget | null {
  const tree = syntaxTree(state);
  const boundedPosition = Math.max(0, Math.min(position, state.doc.length));

  for (const bias of [-1, 1] as const) {
    let node: typeof tree.topNode | null = tree.resolveInner(boundedPosition, bias);
    while (node && node.name !== "Link" && node.name !== "Autolink") node = node.parent;
    if (!node) continue;

    let urlFrom = -1;
    let urlTo = -1;
    let labelFrom = -1;
    let labelTo = -1;
    let child = node.firstChild;

    while (child) {
      if (child.name === "URL") {
        urlFrom = child.from;
        urlTo = child.to;
      } else if (node.name === "Link" && child.name === "LinkMark") {
        const marker = state.sliceDoc(child.from, child.to);
        if (labelFrom < 0 && marker.endsWith("[")) labelFrom = child.to;
        else if (labelTo < 0 && marker === "]") labelTo = child.from;
      }
      child = child.nextSibling;
    }

    if (urlFrom < 0 || urlTo <= urlFrom) continue;
    if (node.name === "Autolink") {
      labelFrom = urlFrom;
      labelTo = urlTo;
    }
    if (labelFrom < 0 || labelTo < labelFrom || boundedPosition < labelFrom || boundedPosition > labelTo) continue;

    return {
      url: state.sliceDoc(urlFrom, urlTo),
      from: node.from,
      to: node.to,
      labelFrom,
      labelTo,
    };
  }

  return null;
}

export function normalizeExternalLink(rawUrl: string): string | null {
  let value = rawUrl.trim();
  if (value.startsWith("<") && value.endsWith(">")) value = value.slice(1, -1).trim();
  value = value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");
  if (!value) return null;

  if (value.startsWith("//")) value = `https:${value}`;
  if (looksLikeDomain(value)) value = `https://${value}`;

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function hasOpenLinkModifier(event: MouseEvent): boolean {
  if (event.metaKey) return true;
  return !isApplePlatform() && event.ctrlKey;
}

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

function looksLikeDomain(value: string) {
  if (/^[./#\\]|\s/.test(value)) return false;
  const hostWithPort = value.split(/[/?#]/, 1)[0];
  if (hostWithPort.includes("@")) return false;
  const host = hostWithPort.replace(/:\d+$/, "");
  return (
    host === "localhost" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,}$/u.test(host)
  );
}

async function openExternalLink(url: string) {
  if (isTauriRuntime()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
