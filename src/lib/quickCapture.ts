const QUICK_CAPTURE_DRAFT_STORAGE_KEY = "loby.quickCaptureDraft.v1";

interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function appStorage(): DraftStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function loadQuickCaptureDraft(storage: DraftStorage | null = appStorage()): string {
  if (!storage) return "";
  try {
    return storage.getItem(QUICK_CAPTURE_DRAFT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveQuickCaptureDraft(body: string, storage: DraftStorage | null = appStorage()): void {
  if (!storage) return;
  try {
    if (body) {
      storage.setItem(QUICK_CAPTURE_DRAFT_STORAGE_KEY, body);
    } else {
      storage.removeItem(QUICK_CAPTURE_DRAFT_STORAGE_KEY);
    }
  } catch {
    // Keep quick capture usable when app storage is temporarily unavailable.
  }
}

export function clearQuickCaptureDraft(storage: DraftStorage | null = appStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(QUICK_CAPTURE_DRAFT_STORAGE_KEY);
  } catch {
    // The in-memory editor can still clear even if app storage is unavailable.
  }
}

export function createQuickCaptureTitle(date = new Date()): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes()),
  ].join("");
}

export function createQuickCaptureDocument(body: string, date = new Date()): { title: string; body: string } {
  const title = createQuickCaptureTitle(date);
  return {
    title,
    body: `# ${title}\n\n${body.trim()}`,
  };
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
