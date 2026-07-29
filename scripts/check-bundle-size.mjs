/**
 * [INPUT]: 依赖 Node.js zlib/fs/path、Vite 生成的 dist/index.html 与 dist/assets JavaScript chunks
 * [OUTPUT]: 以日志和退出状态提供首屏初始 JavaScript 总量及最大动态 chunk 的 raw/gzip 体积预算检查
 * [POS]: scripts 的 renderer 启动载荷门禁，被 build:web 与仓库级 check 串行消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const assetsDirectory = path.resolve("dist/assets");
const indexPath = path.resolve("dist/index.html");
const maxInitialJavaScriptBytes = 1_250_000;
const maxInitialJavaScriptGzipBytes = 425_000;
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
const indexHtml = await readFile(indexPath, "utf8");
const initialAssetNames = new Set([...indexHtml.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((match) => match[1]));
const initialAssets = javascriptAssets.filter((asset) => initialAssetNames.has(asset.name));
const initialBytes = initialAssets.reduce((total, asset) => total + asset.bytes, 0);
const initialGzipBytes = initialAssets.reduce((total, asset) => total + asset.gzipBytes, 0);

if (initialAssets.length === 0) {
  throw new Error(`No initial JavaScript assets found in ${indexPath}.`);
}

process.stdout.write(
  `Initial JavaScript: ${initialAssets.length} chunks (${formatKiB(initialBytes)}, ${formatKiB(initialGzipBytes)} gzip)\n` +
    `Largest JavaScript chunk: ${entryAsset.name} (${formatKiB(entryAsset.bytes)}, ${formatKiB(entryAsset.gzipBytes)} gzip)\n`,
);

if (initialBytes > maxInitialJavaScriptBytes || initialGzipBytes > maxInitialJavaScriptGzipBytes) {
  throw new Error(
    `Initial bundle budget exceeded. Maximum: ${formatKiB(maxInitialJavaScriptBytes)} raw / ${formatKiB(maxInitialJavaScriptGzipBytes)} gzip.`,
  );
}

if (entryAsset.bytes > maxEntryJavaScriptBytes || entryAsset.gzipBytes > maxEntryJavaScriptGzipBytes) {
  throw new Error(
    `Bundle budget exceeded. Maximum: ${formatKiB(maxEntryJavaScriptBytes)} raw / ${formatKiB(maxEntryJavaScriptGzipBytes)} gzip.`,
  );
}
