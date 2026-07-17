export function downloadText(filename: string, text: string, type = "text/plain;charset=utf-8"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("当前环境不允许写入剪贴板");
}

export function openPrintPreview(title: string, html: string): boolean {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!printWindow) return false;

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const body = parsed.body.innerHTML || html;
  const escapedTitle = escapeHtml(title || "Nibva Export");
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapedTitle}</title>
  <style>
    @page { margin: 22mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1d1d1f;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 16px;
      line-height: 1.78;
      -webkit-font-smoothing: antialiased;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 0 80px;
    }
    h1 { margin: 0 0 20px; font-size: 28px; line-height: 1.35; }
    h2 { margin: 34px 0 14px; font-size: 22px; line-height: 1.4; }
    h3 { margin: 28px 0 12px; font-size: 18px; line-height: 1.45; }
    p, li { margin: 0 0 14px; }
    mark, .nibva-highlight { border-radius: 5px; padding: 0 3px; color: #1d1d1f; background: hsl(89 99% 82%); }
    sup, .nibva-footnote-reference { color: #005bb8; font-size: 0.68em; font-weight: 800; line-height: 0; vertical-align: super; }
    blockquote { margin: 0 0 18px; border-radius: 0; padding: 10px 14px; border-left: 3px solid #d7d7dd; color: #5f6068; background: #f7f7f9; }
    code { border-radius: 5px; padding: 2px 5px; background: #f5f5f7; font-family: "SF Mono", "SFMono-Regular", Consolas, monospace; font-size: 0.9em; }
    pre { overflow: auto; margin: 0 0 18px; border-radius: 8px; padding: 12px; background: #f5f5f7; }
    pre code { padding: 0; background: transparent; }
    hr { margin: 28px 0; border: 0; border-top: 1px solid #ececf0; }
    a { color: #005bb8; }
  </style>
</head>
<body>
  <main>${body}</main>
  <script>
    window.addEventListener("load", () => {
      window.focus();
      setTimeout(() => window.print(), 150);
    });
  </script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
