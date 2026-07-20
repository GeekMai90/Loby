import { describe, expect, it } from "vitest";
import {
  analyzeImageDependencies,
  buildImageExportBundle,
  createImageReference,
  parseImageReferences,
  renderObsidianImagesAsMarkdown,
  resolveInsertedImagePath,
  resolveProjectImageSourcePath,
  resolveSheetImageSourcePath,
  rewriteProjectsForCentralImageLibrary,
  rewriteSheetImageReferencesForLocationChange,
  rewriteSheetImageReferencesForBundle,
} from "./imageAssets";
import type { WritingProject, WritingSheet } from "../types";
import { createDefaultInboxProject, INBOX_GROUP_ID } from "./projectModel";

const project: WritingProject = {
  id: "project-1",
  title: "项目",
  description: "",
  status: "构思",
  targetPlatform: "公众号",
  targetWords: 1000,
  tags: [],
  groups: [{ id: "group-main", title: "正文", icon: "article", iconColor: "#007aff", description: "" }],
  sheets: [],
  updatedAt: "2026-07-09",
};

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "第一篇",
  groupId: "group-main",
  status: "构思",
  targetWords: 1000,
  summary: "",
  body: "",
  updatedAt: "2026-07-09",
};

describe("imageAssets", () => {
  it("creates and parses markdown and obsidian image references", () => {
    const markdown = [
      createImageReference("assets/images/cover image.png", "封面[图]", "markdown"),
      createImageReference("assets/images/body.png", "正文图", "obsidian"),
      "![remote](https://example.com/image.jpg)",
      "![[note.md]]",
    ].join("\n");

    expect(parseImageReferences(markdown)).toMatchObject([
      {
        path: "assets/images/cover image.png",
        alt: "封面 图",
        format: "markdown",
      },
      {
        path: "assets/images/body.png",
        alt: "正文图",
        format: "obsidian",
      },
      {
        path: "https://example.com/image.jpg",
        alt: "remote",
        format: "markdown",
      },
    ]);
  });

  it("parses markdown image paths with angle brackets and titles", () => {
    const references = parseImageReferences('![alt](<assets/images/cover image.png> "title")\n![x](assets/images/x.png "title")');

    expect(references.map((reference) => reference.path)).toEqual(["assets/images/cover image.png", "assets/images/x.png"]);
  });

  it("renders obsidian images as regular markdown for portable export", () => {
    expect(renderObsidianImagesAsMarkdown("![[assets/images/body.png|正文图]]")).toBe("![正文图](assets/images/body.png)");
    expect(renderObsidianImagesAsMarkdown("![[note.md]]")).toBe("![[note.md]]");
  });

  it("builds an export bundle from local sheet image references", () => {
    const libraryPath = "/Users/example/Loby";
    const body = ["![local](image.png)", "![asset](assets/images/cover.png)", "![remote](https://example.com/remote.png)"].join("\n");
    const activeSheet = { ...sheet, body };
    const knownResourcePaths = ["/Users/example/Loby/assets/images/image.png", "/Users/example/Loby/assets/images/cover.png"];

    const bundle = buildImageExportBundle(libraryPath, project, [activeSheet], { knownResourcePaths });

    expect(bundle.missing).toEqual([]);
    expect(bundle.assets).toEqual([
      {
        sourcePath: "/Users/example/Loby/assets/images/image.png",
        relativePath: "assets/images/image.png",
      },
      {
        sourcePath: "/Users/example/Loby/assets/images/cover.png",
        relativePath: "assets/images/cover.png",
      },
    ]);
  });

  it("reports missing local images that are not known project resources", () => {
    const libraryPath = "/Users/example/Loby";
    const activeSheet = { ...sheet, body: "![missing](missing.png)\n![remote](https://example.com/remote.png)" };

    expect(analyzeImageDependencies(libraryPath, project, [activeSheet], [])).toEqual({
      total: 2,
      local: 1,
      external: 1,
      bundled: 1,
      missing: [],
    });

    expect(analyzeImageDependencies(libraryPath, project, [activeSheet], ["/other/image.png"]).missing).toEqual(["missing.png"]);
  });

  it("rewrites sheet image references to bundled paths", () => {
    const libraryPath = "/Users/example/Loby";
    const activeSheet = { ...sheet, body: "![local](image.png)\n![[assets/images/cover.png|封面]]" };
    const assets = [
      {
        sourcePath: "/Users/example/Loby/assets/images/image.png",
        relativePath: "assets/images/image.png",
      },
      {
        sourcePath: "/Users/example/Loby/assets/images/cover.png",
        relativePath: "assets/images/cover.png",
      },
    ];

    expect(rewriteSheetImageReferencesForBundle(activeSheet.body, libraryPath, project, activeSheet, assets, "markdown")).toBe(
      "![local](assets/images/image.png)\n![封面](assets/images/cover.png)",
    );
    expect(rewriteSheetImageReferencesForBundle(activeSheet.body, libraryPath, project, activeSheet, assets, "obsidian")).toBe(
      "![[assets/images/image.png|local]]\n![[assets/images/cover.png|封面]]",
    );
  });

  it("resolves inserted and referenced image paths relative to project or sheet", () => {
    const libraryPath = "/Users/example/Loby";
    const imagePath = "/Users/example/Loby/assets/images/new.png";

    expect(resolveInsertedImagePath(imagePath, libraryPath, project, sheet, "obsidian")).toBe("assets/images/new.png");
    expect(resolveInsertedImagePath(imagePath, libraryPath, project, sheet, "markdown")).toBe("../../../assets/images/new.png");
    expect(resolveSheetImageSourcePath(libraryPath, project, sheet, "../../../assets/images/new.png")).toBe(imagePath);
    expect(resolveProjectImageSourcePath("/Users/example/Loby/projects/项目", "../../../assets/images/new.png")).toBe(imagePath);
    expect(resolveProjectImageSourcePath("/Users/example/Loby/projects/项目", "new.png")).toBe(imagePath);
  });

  it("resolves image paths for sheets in the system inbox", () => {
    const inbox = createDefaultInboxProject();
    const inboxSheet = { ...sheet, groupId: INBOX_GROUP_ID };

    expect(resolveSheetImageSourcePath("/Users/example/Loby", inbox, inboxSheet, "../assets/images/cover.png")).toBe(
      "/Users/example/Loby/assets/images/cover.png",
    );
    expect(resolveSheetImageSourcePath("/Users/example/Loby", inbox, inboxSheet, "assets/images/cover.png")).toBe(
      "/Users/example/Loby/assets/images/cover.png",
    );
  });

  it("rewrites central image references when a sheet changes location", () => {
    const libraryPath = "/Users/example/Loby";
    const inbox = createDefaultInboxProject();
    const inboxSheet = { ...sheet, groupId: INBOX_GROUP_ID, body: "![封面](../assets/images/cover.png)" };
    const targetSheet = { ...inboxSheet, groupId: "group-main" };

    expect(rewriteSheetImageReferencesForLocationChange(inboxSheet.body, libraryPath, inbox, inboxSheet, project, targetSheet)).toBe(
      "![封面](../../../assets/images/cover.png)",
    );
  });

  it("rewrites legacy project images after centralization", () => {
    const libraryPath = "/Users/example/Loby";
    const legacySheet = {
      ...sheet,
      body: "![旧图](../assets/images/legacy.png)\n![[assets/images/detail.png|细节图]]",
    };
    const legacyProject = { ...project, sheets: [legacySheet] };
    const migration = rewriteProjectsForCentralImageLibrary(
      libraryPath,
      [legacyProject],
      [
        {
          sourcePath: "/Users/example/Loby/projects/项目/assets/images/legacy.png",
          destinationPath: "/Users/example/Loby/assets/images/legacy.png",
          status: "transferred",
        },
        {
          sourcePath: "/Users/example/Loby/projects/项目/assets/images/detail.png",
          destinationPath: "/Users/example/Loby/assets/images/detail.png",
          status: "transferred",
        },
      ],
    );

    expect(migration.changed).toBe(true);
    expect(migration.projects[0].sheets[0].body).toBe("![旧图](../../../assets/images/legacy.png)\n![[assets/images/detail.png|细节图]]");
    expect(migration.removableSourcePaths).toHaveLength(2);
  });

  it("normalizes an existing central image reference without a file transfer", () => {
    const libraryPath = "/Users/example/Loby";
    const existingSheet = { ...sheet, body: "![封面](../assets/images/cover.png)" };
    const existingProject = { ...project, sheets: [existingSheet] };

    const migration = rewriteProjectsForCentralImageLibrary(libraryPath, [existingProject], []);

    expect(migration.changed).toBe(true);
    expect(migration.projects[0].sheets[0].body).toBe("![封面](../../../assets/images/cover.png)");
    expect(migration.removableSourcePaths).toEqual([]);
  });
});
