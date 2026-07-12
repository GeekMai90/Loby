import { CheckCircle2, CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import { hasPublishingSecret, isDesktopPublishingAvailable, savePublishingSecret, validateMowenApiKey } from "../../lib/publishing/api";
import { SettingsActionRow, SettingsSection } from "./SettingsControls";

const MOWEN_ACCOUNT = "default";

export function PublishingSettingsPanel() {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [apiKey, setApiKey] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [validationState, setValidationState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    if (!desktopAvailable) return;
    let cancelled = false;
    void hasPublishingSecret("mowen", MOWEN_ACCOUNT)
      .then((hasSecret) => {
        if (cancelled || !hasSecret) return;
        setHasSavedApiKey(true);
        setValidationMessage("API Key 已验证并保存");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [desktopAvailable]);

  async function validateApiKey() {
    const value = apiKey.trim();
    if (!value || !desktopAvailable) return;
    setValidationState("validating");
    setValidationMessage("");
    try {
      await validateMowenApiKey(value);
      await savePublishingSecret("mowen", MOWEN_ACCOUNT, value);
      setApiKey("");
      setHasSavedApiKey(true);
      setValidationState("valid");
      setValidationMessage("API Key 已验证并保存");
    } catch (cause) {
      setValidationState("invalid");
      setValidationMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const showsSavedApiKey = hasSavedApiKey && !apiKey && validationState !== "invalid";
  const showsValidState = validationState === "valid" || (validationState === "idle" && showsSavedApiKey);

  return (
    <SettingsSection title="墨问笔记">
      <SettingsActionRow label="API Key">
        <div className="publishing-api-key-control">
          <span className="publishing-api-key-field">
            <input
              className="settings-text-input"
              type="password"
              value={apiKey}
              autoComplete="new-password"
              placeholder={showsSavedApiKey ? "••••••••••••••••" : "输入墨问 API Key"}
              disabled={!desktopAvailable || validationState === "validating"}
              onChange={(event) => {
                setApiKey(event.target.value);
                setValidationState("idle");
                setValidationMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void validateApiKey();
              }}
            />
            {showsValidState && (
              <span className="publishing-validation-icon valid" role="img" aria-label="API Key 已验证并保存" title="API Key 已验证并保存">
                <CheckCircle2 size={17} />
              </span>
            )}
            {validationState === "invalid" && (
              <span className="publishing-validation-icon invalid" role="img" aria-label="API Key 无效" title={validationMessage}>
                <CircleX size={17} />
              </span>
            )}
          </span>
          <button
            type="button"
            className="primary-button"
            disabled={!desktopAvailable || validationState === "validating" || !apiKey.trim()}
            onClick={validateApiKey}
          >
            {validationState === "validating" ? "验证中…" : "验证"}
          </button>
          <span className="visually-hidden" role="status">
            {validationMessage}
          </span>
        </div>
      </SettingsActionRow>
    </SettingsSection>
  );
}
