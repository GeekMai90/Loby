/**
 * [INPUT]: 依赖项目草稿、项目分组、应用级 GitHub 发布目标 registry 与 shadcn Select/Input/Switch
 * [OUTPUT]: 对外提供 ProjectPublishingSettings，把项目绑定到一个发布目标并编辑文档站专属分组映射
 * [POS]: publishing feature 的项目设置投影；只写 target ID 与项目分组映射，不复制仓库、分支或站点参数
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import { resolveProjectPublishingBinding } from "@/features/publishing/model/helpCenter";
import { isPublishingTargetReady, publishingTargetName, type PublishingTargetStore } from "@/features/publishing/model/publishingTargets";
import type { Dispatch, SetStateAction } from "react";
import type { WritingProject } from "@/shared/types";

const NO_TARGET_VALUE = "__none__";

interface ProjectPublishingSettingsProps {
  project: WritingProject;
  projects: WritingProject[];
  targets: PublishingTargetStore;
  targetsReady: boolean;
  draft: NewProjectDraft;
  onDraftChange: Dispatch<SetStateAction<NewProjectDraft>>;
}

export function ProjectPublishingSettings({
  project,
  projects,
  targets,
  targetsReady,
  draft,
  onDraftChange,
}: ProjectPublishingSettingsProps) {
  const selectedTarget = targets.targets.find((target) => target.id === draft.publishingTargetId);
  const boundProjectByTarget = new Map(
    projects
      .filter((item) => item.id !== project.id && item.publishingBinding?.targetId)
      .map((item) => [item.publishingBinding!.targetId, item]),
  );
  const availableTargetCount = targets.targets.filter(
    (target) => isPublishingTargetReady(target) && !boundProjectByTarget.has(target.id),
  ).length;

  function selectTarget(targetId: string) {
    if (targetId === NO_TARGET_VALUE) {
      onDraftChange((current) => ({ ...current, publishingTargetId: "", publishingGroupMappings: [] }));
      return;
    }
    const target = targets.targets.find((item) => item.id === targetId);
    if (!target || boundProjectByTarget.has(target.id)) return;
    if (target.kind === "githubDocsSite") {
      onDraftChange((current) => ({
        ...current,
        publishingTargetId: targetId,
        publishingGroupMappings: resolveProjectPublishingBinding(project, target, {
          targetId: current.publishingTargetId ?? "",
          groupMappings: current.publishingGroupMappings ?? [],
        }).groupMappings,
      }));
      return;
    }
    onDraftChange((current) => ({ ...current, publishingTargetId: targetId, publishingGroupMappings: [] }));
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <p className="text-sm font-medium">发布目标</p>
        <p className="mt-0.5 text-xs text-muted-foreground">当前项目只会发布到这里绑定的 GitHub 目标。</p>
      </div>

      <Select value={draft.publishingTargetId || NO_TARGET_VALUE} disabled={!targetsReady} onValueChange={selectTarget}>
        <SelectTrigger width="full" aria-label="项目发布目标">
          <SelectValue placeholder={targetsReady ? "选择发布目标" : "正在读取发布目标…"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TARGET_VALUE}>不绑定发布目标</SelectItem>
          {targets.targets.map((target) => {
            const boundProject = boundProjectByTarget.get(target.id);
            const unavailable = !isPublishingTargetReady(target);
            return (
              <SelectItem key={target.id} value={target.id} disabled={Boolean(boundProject) || unavailable}>
                {publishingTargetName(target)}
                {boundProject ? ` · 已绑定「${boundProject.title}」` : unavailable ? " · 不可用" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {targetsReady && targets.targets.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">请先前往“设置 → 发布”添加 GitHub 发布目标。</p>
      ) : null}
      {targetsReady && !draft.publishingTargetId && targets.targets.length > 0 && availableTargetCount === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">当前发布目标均已绑定到其他项目。</p>
      ) : null}
      {draft.publishingTargetId && !selectedTarget ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          原发布目标已被移除，请重新选择。
        </p>
      ) : null}
      {selectedTarget && !isPublishingTargetReady(selectedTarget) ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          “{publishingTargetName(selectedTarget)}”已停用或配置不完整，请先在发布设置中修复。
        </p>
      ) : null}

      {selectedTarget?.kind === "githubDocsSite" ? (
        <DocsGroupMappings project={project} draft={draft} onDraftChange={onDraftChange} />
      ) : null}
    </section>
  );
}

function DocsGroupMappings({
  project,
  draft,
  onDraftChange,
}: {
  project: WritingProject;
  draft: NewProjectDraft;
  onDraftChange: Dispatch<SetStateAction<NewProjectDraft>>;
}) {
  const groupsById = new Map((project.groups ?? []).map((group) => [group.id, group]));
  const mappings = draft.publishingGroupMappings ?? [];
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">分组与文件夹</p>
        <p className="mt-0.5 text-xs text-muted-foreground">新分组会自动生成同名文件夹；“待整理”默认不同步。</p>
      </div>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
        {mappings.map((mapping) => {
          const group = groupsById.get(mapping.groupId);
          if (!group) return null;
          return (
            <div
              key={mapping.groupId}
              className="grid grid-cols-[minmax(88px,0.8fr)_minmax(140px,1.2fr)_auto] items-center gap-3 px-3 py-2.5"
            >
              <span className="truncate text-sm">{group.title}</span>
              <Input
                className="h-8"
                value={mapping.directory}
                disabled={!mapping.enabled}
                placeholder={mapping.enabled ? "GitHub 文件夹" : "不同步"}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    publishingGroupMappings: (current.publishingGroupMappings ?? []).map((item) =>
                      item.groupId === mapping.groupId ? { ...item, directory: event.target.value } : item,
                    ),
                  }))
                }
              />
              <Switch
                checked={mapping.enabled}
                disabled={mapping.groupId === "group-default"}
                aria-label={`${group.title}同步`}
                onCheckedChange={(enabled) =>
                  onDraftChange((current) => ({
                    ...current,
                    publishingGroupMappings: (current.publishingGroupMappings ?? []).map((item) =>
                      item.groupId === mapping.groupId ? { ...item, enabled } : item,
                    ),
                  }))
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
