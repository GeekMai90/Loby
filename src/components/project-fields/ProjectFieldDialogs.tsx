import { X } from "lucide-react";
import { fieldTypeLabel } from "../../constants/propertyFields";
import type { PendingDefaultApplication, PendingFieldChange } from "./types";

export function ApplyDefaultDialog({
  application,
  onCancel,
  onConfirm,
}: {
  application: PendingDefaultApplication;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="property-change-backdrop" role="presentation">
      <section className="property-change-dialog" role="alertdialog" aria-modal="true">
        <header>
          <div>
            <h3>应用默认值</h3>
            <p>将影响 {application.count} 篇文稿</p>
          </div>
          <button type="button" className="icon-button" title="取消" onClick={onCancel}>
            <X size={16} />
          </button>
        </header>
        <div className="property-change-content">
          <p>保存字段后，将为已有文稿中“{application.definition.label}”为空的记录填写当前默认值；已有值不会被覆盖。</p>
          <div className="property-change-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              取消
            </button>
            <button type="button" className="primary-button" onClick={onConfirm}>
              确认应用
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DiscardChangesDialog({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
  return (
    <div className="property-change-backdrop" role="presentation">
      <section className="property-change-dialog" role="alertdialog" aria-modal="true">
        <header>
          <div>
            <h3>放弃未保存更改？</h3>
            <p>字段设置尚未保存</p>
          </div>
        </header>
        <div className="property-change-content">
          <p>关闭后，本次对字段、选项和默认值的更改都会丢失。</p>
          <div className="property-change-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              继续编辑
            </button>
            <button type="button" className="secondary-button danger" onClick={onDiscard}>
              放弃更改
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function FieldChangeDialog({
  change,
  replacement,
  onReplacementChange,
  onCancel,
  onRemoveField,
  onRemoveOption,
  onChangeType,
}: {
  change: PendingFieldChange;
  replacement: string;
  onReplacementChange: (value: string) => void;
  onCancel: () => void;
  onRemoveField: (deleteValues: boolean) => void;
  onRemoveOption: (replacement?: string) => void;
  onChangeType: (mode: "convert" | "clear") => void;
}) {
  const replacementOptions =
    change.kind === "removeOption" ? (change.definition.options ?? []).filter((option) => option.id !== change.option.id) : [];
  return (
    <div className="property-change-backdrop" role="presentation">
      <section className="property-change-dialog" role="alertdialog" aria-modal="true">
        <header>
          <div>
            <h3>{change.kind === "removeField" ? "移除字段" : change.kind === "removeOption" ? "删除预设选项" : "更改字段类型"}</h3>
            <p>将影响 {change.usage} 篇文稿</p>
          </div>
          <button type="button" className="icon-button" title="取消" onClick={onCancel}>
            <X size={16} />
          </button>
        </header>

        {change.kind === "removeField" && (
          <div className="property-change-content">
            <p>移除“{change.definition.label}”后，可以保留文稿中的原始 YAML 值，也可以同时删除这些值。</p>
            <div className="property-change-actions stacked">
              <button type="button" className="primary-button" onClick={() => onRemoveField(false)}>
                保留 YAML 值并移除
              </button>
              <button type="button" className="secondary-button danger" onClick={() => onRemoveField(true)}>
                删除字段和值
              </button>
            </div>
          </div>
        )}

        {change.kind === "removeOption" && (
          <div className="property-change-content">
            <p>“{change.option.label}”正在被使用。请选择替代选项，或者清空这些文稿中的该值。</p>
            {replacementOptions.length > 0 && (
              <label>
                <span>替换为</span>
                <select value={replacement} onChange={(event) => onReplacementChange(event.target.value)}>
                  {replacementOptions.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="property-change-actions">
              {replacementOptions.length > 0 && (
                <button type="button" className="primary-button" disabled={!replacement} onClick={() => onRemoveOption(replacement)}>
                  替换并删除
                </button>
              )}
              <button type="button" className="secondary-button danger" onClick={() => onRemoveOption()}>
                清空并删除
              </button>
            </div>
          </div>
        )}

        {change.kind === "changeType" && (
          <div className="property-change-content">
            <p>
              “{change.definition.label}”将从{fieldTypeLabel(change.definition.type)}改为{fieldTypeLabel(change.nextType)}。
            </p>
            <p>
              可兼容转换 {change.usage - change.incompatible} 篇，无法转换 {change.incompatible} 篇。无法转换的值会在转换时清空。
            </p>
            <div className="property-change-actions stacked">
              <button type="button" className="primary-button" onClick={() => onChangeType("convert")}>
                转换可兼容值
              </button>
              <button type="button" className="secondary-button danger" onClick={() => onChangeType("clear")}>
                清空现有值
              </button>
            </div>
          </div>
        )}

        <footer>
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
        </footer>
      </section>
    </div>
  );
}
