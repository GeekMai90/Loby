/**
 * [INPUT]: 依赖 写作库模块
 * [OUTPUT]: 对外提供 FieldDefinitionEditor、FieldListScreen、NewFieldEditor
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export { FieldDefinitionEditor } from "@/features/editor/components/document-properties/DocumentPropertyDefinitionEditor";
export { FieldListScreen } from "@/features/editor/components/document-properties/DocumentPropertyListScreen";
export { NewFieldEditor } from "@/features/editor/components/document-properties/DocumentPropertyNewEditor";
