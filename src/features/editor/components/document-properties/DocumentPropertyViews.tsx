/**
 * [INPUT]: 依赖 document-properties 下定义编辑、列表与新建三个独立视图模块
 * [OUTPUT]: 对外提供 FieldDefinitionEditor、FieldListScreen、NewFieldEditor
 * [POS]: editor 文稿属性视图的稳定聚合出口，不新增状态或复制子视图实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export { FieldDefinitionEditor } from "@/features/editor/components/document-properties/DocumentPropertyDefinitionEditor";
export { FieldListScreen } from "@/features/editor/components/document-properties/DocumentPropertyListScreen";
export { NewFieldEditor } from "@/features/editor/components/document-properties/DocumentPropertyNewEditor";
