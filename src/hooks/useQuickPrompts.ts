import { useCallback, useEffect, useRef, useState } from "react";
import type { AiQuickPrompt } from "../types";
import { loadQuickPrompts, saveQuickPrompts } from "../lib/persistence";
import { createQuickPrompt, MAX_AI_QUICK_PROMPTS, updateQuickPrompt } from "../lib/quickPrompts";
import { showAppToast } from "../lib/appToast";

interface UseQuickPromptsOptions {
  libraryPath: string;
  persistenceReady: boolean;
}

export function useQuickPrompts({ libraryPath, persistenceReady }: UseQuickPromptsOptions) {
  const [prompts, setPrompts] = useState<AiQuickPrompt[]>([]);
  const [ready, setReady] = useState(false);
  const promptsRef = useRef<AiQuickPrompt[]>([]);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!persistenceReady || !libraryPath) {
      promptsRef.current = [];
      setPrompts([]);
      setReady(false);
      return;
    }

    let cancelled = false;
    setReady(false);
    loadQuickPrompts(libraryPath)
      .then((loadedPrompts) => {
        if (cancelled) return;
        promptsRef.current = loadedPrompts;
        setPrompts(loadedPrompts);
      })
      .catch(() => {
        if (cancelled) return;
        promptsRef.current = [];
        setPrompts([]);
        showAppToast({ variant: "error", title: "快捷提示加载失败", description: "暂时无法读取当前写作库的快捷提示" });
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [libraryPath, persistenceReady]);

  const replacePrompts = useCallback(
    (nextPrompts: AiQuickPrompt[]) => {
      if (!ready) return;
      const boundedPrompts = nextPrompts.slice(0, MAX_AI_QUICK_PROMPTS);
      promptsRef.current = boundedPrompts;
      setPrompts(boundedPrompts);
      const targetPath = libraryPath;
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveQuickPrompts(boundedPrompts, targetPath))
        .then(() => undefined)
        .catch(() => {
          showAppToast({ variant: "error", title: "快捷提示保存失败", description: "请检查写作库后重试" });
        });
    },
    [libraryPath, ready],
  );

  const addPrompt = useCallback(
    (title: string, content: string) => {
      if (promptsRef.current.length >= MAX_AI_QUICK_PROMPTS) return;
      replacePrompts([...promptsRef.current, createQuickPrompt(title, content)]);
    },
    [replacePrompts],
  );

  const editPrompt = useCallback(
    (promptId: string, title: string, content: string) => {
      replacePrompts(promptsRef.current.map((prompt) => (prompt.id === promptId ? updateQuickPrompt(prompt, title, content) : prompt)));
    },
    [replacePrompts],
  );

  const deletePrompt = useCallback(
    (promptId: string) => {
      replacePrompts(promptsRef.current.filter((prompt) => prompt.id !== promptId));
    },
    [replacePrompts],
  );

  const movePrompt = useCallback(
    (promptId: string, direction: -1 | 1) => {
      const current = promptsRef.current;
      const index = current.findIndex((prompt) => prompt.id === promptId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
      const reordered = [...current];
      const [prompt] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, prompt);
      replacePrompts(reordered);
    },
    [replacePrompts],
  );

  return { prompts, ready, addPrompt, editPrompt, deletePrompt, movePrompt };
}
