import type { ProjectPropertyDefinition, PropertyFieldType, PropertyOption } from "../../types";

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
