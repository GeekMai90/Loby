import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <div className="flex w-full max-w-90 min-w-0 items-center justify-end gap-2">
          <span className="relative block min-w-0 flex-1">
            <Input
              className="pr-8.5"
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
              <span
                className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-green-600 dark:text-green-500"
                role="img"
                aria-label="API Key 已验证并保存"
                title="API Key 已验证并保存"
              >
                <CheckCircle2 size={17} />
              </span>
            )}
            {validationState === "invalid" && (
              <span
                className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-destructive"
                role="img"
                aria-label="API Key 无效"
                title={validationMessage}
              >
                <CircleX size={17} />
              </span>
            )}
          </span>
          <Button type="button" disabled={!desktopAvailable || validationState === "validating" || !apiKey.trim()} onClick={validateApiKey}>
            {validationState === "validating" ? "验证中…" : "验证"}
          </Button>
          <span className="sr-only" role="status">
            {validationMessage}
          </span>
        </div>
      </SettingsActionRow>
    </SettingsSection>
  );
}
