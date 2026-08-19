/**
 * [INPUT]: 依赖 Git tracked/untracked 未忽略文件、Node.js fs/path 与仓库文件长度审查阈值
 * [OUTPUT]: 对外提供 REVIEW_LINE_THRESHOLD、SEVERE_LINE_THRESHOLD、collectHealthReport 纯统计与 renderHealthReport 文本渲染；作为主模块时打印只读报告
 * [POS]: scripts 的工程体检入口；统计与呈现分离，帮助开发者发现需要边界测试的长文件，不把行数机械变成失败门禁
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE_PATTERN = /\.(?:ts|tsx|rs|mjs|css)$/;
const BINARY_PATTERN = /\.(?:png|jpg|jpeg|webp|gif|icns|ico|svg)$/i;
const BUILD_ARTIFACT_DIRECTORIES = ["node_modules", "dist", "src-tauri/target"];

export const REVIEW_LINE_THRESHOLD = 500;
export const SEVERE_LINE_THRESHOLD = 800;

// ── 统计层：只读文件系统，不打印任何东西 ────────────────────────────────
function worktreeFiles(rootDirectory) {
  try {
    return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: rootDirectory,
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean)
      .filter((file) => fs.existsSync(path.join(rootDirectory, file)));
  } catch (error) {
    throw new Error(`无法读取 Git 工作区文件：${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

function categoryFor(file) {
  return file.includes("/") ? file.slice(0, file.indexOf("/")) : "root";
}

function fileRow(rootDirectory, file) {
  const absolutePath = path.join(rootDirectory, file);
  const row = { file, bytes: fs.statSync(absolutePath).size };
  if (SOURCE_PATTERN.test(file)) {
    const lines = fs.readFileSync(absolutePath, "utf8").split(/\r\n|\r|\n/);
    row.lines = lines.length - (lines.at(-1) === "" ? 1 : 0);
  }
  return row;
}

export function collectHealthReport(rootDirectory) {
  const rows = worktreeFiles(rootDirectory).map((file) => fileRow(rootDirectory, file));
  const sourceRows = rows.filter((row) => SOURCE_PATTERN.test(row.file));
  const hotspots = sourceRows.filter((row) => row.lines >= REVIEW_LINE_THRESHOLD).sort((left, right) => right.lines - left.lines);

  const categories = new Map();
  for (const row of rows) {
    const category = categoryFor(row.file);
    const total = categories.get(category) ?? { files: 0, bytes: 0 };
    total.files += 1;
    total.bytes += row.bytes;
    categories.set(category, total);
  }

  return {
    rows,
    totalBytes: rows.reduce((total, row) => total + row.bytes, 0),
    sourceRows,
    sourceBytes: sourceRows.reduce((total, row) => total + row.bytes, 0),
    hotspots,
    severeHotspots: hotspots.filter((row) => row.lines >= SEVERE_LINE_THRESHOLD),
    binaryRows: rows.filter((row) => BINARY_PATTERN.test(row.file)).sort((left, right) => right.bytes - left.bytes),
    categories: [...categories].sort((left, right) => right[1].bytes - left[1].bytes).map(([name, total]) => ({ name, ...total })),
    buildArtifacts: BUILD_ARTIFACT_DIRECTORIES.map((directory) => ({
      directory,
      present: fs.existsSync(path.join(rootDirectory, directory)),
    })),
  };
}

// ── 呈现层：只把统计结果格式化成文本 ─────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

export function renderHealthReport(report) {
  const lines = [
    "工程健康报告（只读）",
    `工作区文件：${report.rows.length} 个，${formatBytes(report.totalBytes)}；源码：${report.sourceRows.length} 个，${formatBytes(report.sourceBytes)}`,
    "",
    "按顶层目录统计：",
    ...report.categories.map((category) => `- ${category.name}: ${category.files} 个，${formatBytes(category.bytes)}`),
    "",
    `源码职责热点：${report.hotspots.length} 个达到或超过 ${REVIEW_LINE_THRESHOLD} 行，其中 ${report.severeHotspots.length} 个达到或超过 ${SEVERE_LINE_THRESHOLD} 行`,
    ...report.hotspots.slice(0, 20).map((row) => `- ${row.lines} 行，${formatBytes(row.bytes)}：${row.file}`),
  ];
  if (report.hotspots.length > 20) lines.push(`- 其余 ${report.hotspots.length - 20} 个热点未展开`);

  lines.push("", "较大的受管二进制：", ...report.binaryRows.slice(0, 8).map((row) => `- ${formatBytes(row.bytes)}：${row.file}`));
  lines.push(
    "",
    "本地产物目录：",
    ...report.buildArtifacts.map(
      ({ directory, present }) => `- ${directory}: ${present ? "存在（未递归扫描，避免把构建缓存当作源码统计）" : "不存在"}`,
    ),
  );
  lines.push("", "说明：文件长度只是职责审查信号；拆分前必须先确认状态所有权、数据流和回归边界。报告不会修改文件，也不会因现有热点失败。");

  return lines.join("\n");
}

const isMainModule = process.argv[1] && realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMainModule) {
  console.log(renderHealthReport(collectHealthReport(process.cwd())));
}
