/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 PendingFieldChange
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ProjectPropertyDefinition, PropertyFieldType, PropertyOption } from "@/shared/types";

export type PendingFieldChange =
  | { kind: "removeField"; definition: ProjectPropertyDefinition; usage: number }
  | { kind: "removeOption"; definition: ProjectPropertyDefinition; option: PropertyOption; usage: number }
  | {
      kind: "changeType";
      definition: ProjectPropertyDefinition;
      nextType: PropertyFieldType;
      usage: number;
      incompatible: number;
    };
