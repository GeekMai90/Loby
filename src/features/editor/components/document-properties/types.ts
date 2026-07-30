/**
 * [INPUT]: 依赖 shared/types 的文稿属性定义、字段类型与选项契约
 * [OUTPUT]: 对外提供 PendingFieldChange
 * [POS]: editor 文稿属性破坏性修改的待确认联合类型，连接定义编辑视图与迁移协调层
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { DocumentPropertyDefinition, PropertyFieldType, PropertyOption } from "@/shared/types";

export type PendingFieldChange =
  | { kind: "removeField"; definition: DocumentPropertyDefinition; usage: number }
  | { kind: "removeOption"; definition: DocumentPropertyDefinition; option: PropertyOption; usage: number }
  | {
      kind: "changeType";
      definition: DocumentPropertyDefinition;
      nextType: PropertyFieldType;
      usage: number;
      incompatible: number;
    };
