/**
 * [INPUT]: 依赖 Tauri 目录选择、Agent Skill IPC、系统路径显示、shadcn/ui 与设置区块组件
 * [OUTPUT]: 对外提供 SkillSettingsSection，管理当前写作库的 Skill 导入预检、安装、启停、删除与目录入口
 * [POS]: settings 的 Skill 管理表面；只展示 native 诊断并发起操作，不复制格式校验或文件写入规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { open } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, CheckCircle2, FolderOpen, Import, Trash2, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  deleteAgentSkill,
  ensureAgentSkillDirectory,
  inspectAgentSkillImport,
  installAgentSkill,
  listAgentSkills,
  setAgentSkillEnabled,
} from "@/features/assistant/model/agentRuntime";
import { SettingsSection } from "@/features/settings/components/SettingsControls";
import type { AgentSkill, AgentSkillImportPreview } from "@/shared/types";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { showAppToast } from "@/shared/lib/appToast";
import { revealLocalPath } from "@/features/library/model/persistence";

interface SkillSettingsSectionProps {
  libraryPath: string;
}

export function SkillSettingsSection({ libraryPath }: SkillSettingsSectionProps) {
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [preview, setPreview] = useState<AgentSkillImportPreview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentSkill | null>(null);

  const refresh = useCallback(async () => {
    if (!libraryPath) return;
    setLoading(true);
    try {
      setSkills(await listAgentSkills(libraryPath));
    } catch (error) {
      showError("Skill 读取失败", error);
    } finally {
      setLoading(false);
    }
  }, [libraryPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function chooseImport(kind: "directory" | "archive") {
    const selected = await open({
      directory: kind === "directory",
      multiple: false,
      title: kind === "directory" ? "选择直接包含 SKILL.md 的目录" : "选择 .skill 或 .zip 文件",
      ...(kind === "archive" ? { filters: [{ name: "Agent Skill", extensions: ["skill", "zip"] }] } : {}),
    });
    if (typeof selected !== "string") return;
    try {
      setPreview(await inspectAgentSkillImport(selected));
    } catch (error) {
      showError("无法读取这个 Skill", error);
    }
  }

  async function installPreview() {
    if (!preview) return;
    setBusyId("install");
    try {
      const installed = await installAgentSkill(libraryPath, preview.sourcePath);
      setPreview(null);
      await refresh();
      notifySkillsChanged();
      showAppToast({
        variant: "success",
        title: `已安装 ${installed.name}`,
        description: installed.enabled ? "现在可以在助手中调用" : "需要适配后再启用",
      });
    } catch (error) {
      showError("Skill 安装失败", error);
    } finally {
      setBusyId("");
    }
  }

  async function toggleSkill(skill: AgentSkill, enabled: boolean) {
    setBusyId(skill.id);
    try {
      const updated = await setAgentSkillEnabled(libraryPath, skill.id, enabled);
      setSkills((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notifySkillsChanged();
    } catch (error) {
      showError("无法更新 Skill", error);
    } finally {
      setBusyId("");
    }
  }

  async function removeSkill() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      setSkills(await deleteAgentSkill(libraryPath, deleteTarget.id));
      notifySkillsChanged();
    } catch (error) {
      showError("Skill 删除失败", error);
    } finally {
      setBusyId("");
      setDeleteTarget(null);
    }
  }

  async function revealDirectory() {
    try {
      await revealLocalPath(await ensureAgentSkillDirectory(libraryPath));
    } catch (error) {
      showError("无法打开 Skill 目录", error);
    }
  }

  return (
    <>
      <SettingsSection title="Skills">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-3 py-2.25">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">当前写作库</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {loading ? "正在读取…" : `${skills.filter((skill) => skill.enabled).length}/${skills.length} 个已启用`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="icon-sm" title="打开 Skill 目录" onClick={() => void revealDirectory()}>
              <FolderOpen />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void chooseImport("directory")}>
              <Import />
              导入目录
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void chooseImport("archive")}>
              <Import />
              导入包
            </Button>
          </div>
        </div>

        {skills.length === 0 && !loading ? (
          <div className="px-3 py-5 text-center text-xs leading-5 text-muted-foreground">
            可导入 Codex、Claude Code 等遵循 Agent Skills 标准的目录、.skill 或 .zip 包。也可以在助手中说“帮我创建一个 Skill”。
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={`${skill.source}:${skill.id}`}
              className="grid min-h-15 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-medium text-foreground">{skill.name}</p>
                  <SkillStatus skill={skill} />
                  <span className="text-[10px] text-muted-foreground">{skill.source === "builtin" ? "内置" : "写作库"}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={skill.description}>
                  {skill.description}
                </p>
                {skill.diagnostics[0] ? (
                  <p
                    className="mt-0.5 truncate text-[10px] text-status-warning"
                    title={skill.diagnostics.map((item) => item.message).join("\n")}
                  >
                    {skill.diagnostics[0].message}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {skill.source === "library" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="删除"
                    disabled={busyId === skill.id}
                    onClick={() => setDeleteTarget(skill)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
                <Switch
                  checked={skill.enabled}
                  disabled={busyId === skill.id || skill.compatibility !== "compatible"}
                  aria-label={`${skill.enabled ? "停用" : "启用"}${skill.name}`}
                  onCheckedChange={(enabled) => void toggleSkill(skill, enabled)}
                />
              </div>
            </div>
          ))
        )}
      </SettingsSection>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>导入 {preview?.name || "Skill"}</DialogTitle>
            <DialogDescription>{preview?.description}</DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-5">
                <p>兼容性：{compatibilityLabel(preview.compatibility)}</p>
                <p>
                  文件：{preview.files.length} 个{preview.hasScripts ? "，包含不会执行的脚本" : ""}
                </p>
              </div>
              {preview.diagnostics.length > 0 ? (
                <div className="grid gap-1.5">
                  {preview.diagnostics.map((diagnostic) => (
                    <div
                      key={`${diagnostic.code}:${diagnostic.message}`}
                      className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
                    >
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-warning" />
                      <span>{diagnostic.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-status-success">
                  <CheckCircle2 className="size-3.5" />
                  可直接安装和使用
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPreview(null)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={busyId === "install" || preview?.compatibility === "unsupported"}
              onClick={() => void installPreview()}
            >
              {busyId === "install" ? "安装中" : preview?.compatibility === "adaptation-required" ? "安装但暂不启用" : "安装"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`删除“${deleteTarget?.name ?? "这个 Skill"}”？`}
        message="这会从当前写作库的 .agents/skills 中删除整个 Skill 包，无法撤销。"
        confirmLabel="删除"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void removeSkill()}
      />
    </>
  );
}

function SkillStatus({ skill }: { skill: AgentSkill }) {
  if (skill.compatibility === "compatible") return <CheckCircle2 className="size-3.5 text-status-success" aria-label="兼容" />;
  if (skill.compatibility === "adaptation-required") return <Wrench className="size-3.5 text-status-warning" aria-label="需要适配" />;
  return <AlertTriangle className="size-3.5 text-destructive" aria-label="不支持" />;
}

function compatibilityLabel(value: AgentSkillImportPreview["compatibility"]) {
  if (value === "compatible") return "可直接使用";
  if (value === "adaptation-required") return "需要适配";
  return "不符合基础规范";
}

function notifySkillsChanged() {
  window.dispatchEvent(new Event("loby:skills-changed"));
}

function showError(title: string, error: unknown) {
  showAppToast({ variant: "error", title, description: error instanceof Error ? error.message : String(error) });
}
