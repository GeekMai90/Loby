/**
 * [INPUT]: 依赖 Node.js zlib/fs/path 与 Vite 生成的 dist/assets JavaScript chunks
 * [OUTPUT]: 以日志和退出状态提供最大 JavaScript chunk 的 raw/gzip 体积预算检查
 * [POS]: scripts 的 renderer bundle 门禁，被 build:web 与仓库级 check 串行消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const assetsDirectory = path.resolve("dist/assets");
const maxEntryJavaScriptBytes = 1_500_000;
const maxEntryJavaScriptGzipBytes = 500_000;

const assetNames = await readdir(assetsDirectory);
const javascriptAssets = await Promise.all(
  assetNames
    .filter((name) => name.endsWith(".js"))
    .map(async (name) => {
      const content = await readFile(path.join(assetsDirectory, name));
      return { name, bytes: content.byteLength, gzipBytes: gzipSync(content).byteLength };
    }),
);

if (javascriptAssets.length === 0) {
  throw new Error(`No JavaScript assets found in ${assetsDirectory}. Run the web build first.`);
}

const entryAsset = javascriptAssets.toSorted((left, right) => right.bytes - left.bytes)[0];
const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

process.stdout.write(
  `Largest JavaScript chunk: ${entryAsset.name} (${formatKiB(entryAsset.bytes)}, ${formatKiB(entryAsset.gzipBytes)} gzip)\n`,
);

if (entryAsset.bytes > maxEntryJavaScriptBytes || entryAsset.gzipBytes > maxEntryJavaScriptGzipBytes) {
  throw new Error(
    `Bundle budget exceeded. Maximum: ${formatKiB(maxEntryJavaScriptBytes)} raw / ${formatKiB(maxEntryJavaScriptGzipBytes)} gzip.`,
  );
}
