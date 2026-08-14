/**
 * [INPUT]: 依赖已成功 dry-run 的 Actions Run ID、同版本 Git tag、GitHub CLI 登录态与本机 Gitee 凭证
 * [OUTPUT]: 对外提供从 GitHub verified artifact 下载资产、调用正式发布汇总器完成 Gitee 镜像与 GitHub Release 公开的一键本机入口
 * [POS]: scripts 发布链路的本机接管器；不构建、不重新签名，只把 GitHub-hosted 发布后的 Gitee 阶段迁移到本机网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASE_PLATFORM_IDS, RELEASE_REPOSITORY } from "./release-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publishScriptPath = path.join(repoRoot, "scripts", "publish-release.mjs");
const giteeKeychainService = "com.geekmai.loby-release-token";

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: options.env ?? process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
      if (status === 0) {
        resolve();
        return;
      }
      reject(new Error(`命令失败（${status ?? `signal ${signal}`}）：${command} ${args.join(" ")}`));
    });
  });

const parseArguments = (args) => {
  const options = { version: null, sourceRunId: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--version" && args[index + 1]) {
      options.version = args[++index];
    } else if (argument === "--source-run-id" && args[index + 1]) {
      options.sourceRunId = args[++index];
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
};

const printUsage = () => {
  console.log("用法：npm run release:mirror -- --version <version> --source-run-id <dry-run-id>");
  console.log("说明：本机只接管 Gitee 镜像与最终公开，不重复构建或签名。");
};

const getGiteeToken = () => {
  if (process.env.GITEE_RELEASE_TOKEN?.trim()) return process.env.GITEE_RELEASE_TOKEN.trim();
  if (process.platform !== "darwin") {
    throw new Error("缺少 GITEE_RELEASE_TOKEN；自动读取本机 Keychain 仅支持 macOS。");
  }
  const result = spawnSync("security", ["find-generic-password", "-s", giteeKeychainService, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const token = result.status === 0 ? result.stdout.trim() : "";
  if (!token) {
    throw new Error(`缺少 GITEE_RELEASE_TOKEN，且 Keychain 中没有 ${giteeKeychainService}。`);
  }
  return token;
};

const downloadVerifiedArtifacts = async (sourceRunId, outputDirectory) => {
  await Promise.all(
    RELEASE_PLATFORM_IDS.map(async (platformId) => {
      const platformDirectory = path.join(outputDirectory, platformId);
      await mkdir(platformDirectory);
      await run("gh", [
        "run",
        "download",
        sourceRunId,
        "--repo",
        RELEASE_REPOSITORY,
        "--name",
        `loby-release-${platformId}`,
        "--dir",
        platformDirectory,
      ]);
    }),
  );
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printUsage();
  if (!options.version || !/^\d+\.\d+\.\d+$/.test(options.version)) {
    throw new Error("必须传入有效的 --version <三段式版本号>。");
  }
  if (!options.sourceRunId || !/^\d+$/.test(options.sourceRunId)) {
    throw new Error("必须传入有效的 --source-run-id <dry-run-id>。");
  }

  const giteeToken = getGiteeToken();
  const artifactsDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-local-release-"));
  try {
    console.log(`开始从 dry-run ${options.sourceRunId} 下载三平台已验证资产。`);
    await downloadVerifiedArtifacts(options.sourceRunId, artifactsDirectory);
    await run(
      process.execPath,
      [
        publishScriptPath,
        "--version",
        options.version,
        "--artifacts-dir",
        artifactsDirectory,
        "--source-run-id",
        options.sourceRunId,
        "--mirror-gitee",
      ],
      { env: { ...process.env, GITEE_RELEASE_TOKEN: giteeToken } },
    );
  } finally {
    await rm(artifactsDirectory, { recursive: true, force: true });
  }
};

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error(`本机接管发布失败：${error.message}`);
    process.exitCode = 1;
  });
}

export { parseArguments };
