export function extractFirstHeadingTitle(markdown: string) {
  const heading = markdown.match(/^#\s+(.+?)\s*#*\s*$/m);
  return heading?.[1]?.trim() ?? "";
}
