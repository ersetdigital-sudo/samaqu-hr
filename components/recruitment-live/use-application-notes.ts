"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobApplication } from "@/lib/recruitment/live/types";
import { api } from "./ui";

type Draft = { value: string; saved: string };

const storageKey = (id: string) => `samaqu:recruitment:note:${id}`;
function readDraft(id: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(id));
  } catch {
    return null;
  }
}
function writeDraft(id: string, value: string) {
  try {
    sessionStorage.setItem(storageKey(id), value);
  } catch {
    /* Browser storage can be unavailable. */
  }
}
function clearDraft(id: string) {
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    /* Browser storage can be unavailable. */
  }
}

/** One serialized queue: a newer note can never be overwritten by an older request. */
export function useApplicationNotes(
  onSaved: (id: string, note: string) => void,
) {
  const drafts = useRef(new Map<string, Draft>());
  const pending = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onSaved);
  callback.current = onSaved;
  const [state, setState] = useState<{
    status: "saved" | "dirty" | "saving" | "error";
    error: string;
  }>({ status: "saved", error: "" });
  const [, render] = useState(0);
  const hasUnsaved = useCallback(
    () =>
      [...drafts.current.values()].some((item) => item.value !== item.saved),
    [],
  );
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) return pending.current;
    if (!hasUnsaved()) return Promise.resolve(true);
    setState({ status: "saving", error: "" });
    const task = (async () => {
      try {
        for (;;) {
          const entry = [...drafts.current.entries()].find(
            ([, value]) => value.value !== value.saved,
          );
          if (!entry) break;
          const [id, draft] = entry;
          const value = draft.value;
          await api<{ application: JobApplication }>(
            `/api/recruitment/applications/${id}`,
            {
              method: "PATCH",
              body: JSON.stringify({ internal_note: value }),
              keepalive: true,
            },
          );
          // Preserve edits typed during the request, then drain again if necessary.
          draft.saved = value;
          if (draft.value === value) clearDraft(id);
          callback.current(id, value);
        }
        setState({ status: "saved", error: "" });
        return true;
      } catch (cause) {
        setState({
          status: "error",
          error:
            cause instanceof Error
              ? cause.message
              : "Catatan belum tersimpan. Coba lagi sebelum berpindah pelamar.",
        });
        return false;
      } finally {
        pending.current = null;
      }
    })();
    pending.current = task;
    return task;
  }, [hasUnsaved]);
  const edit = (application: JobApplication, value: string) => {
    const current = drafts.current.get(application.id) ?? {
      value: application.internal_note || "",
      saved: application.internal_note || "",
    };
    current.value = value;
    drafts.current.set(application.id, current);
    if (value === current.saved) clearDraft(application.id);
    else writeDraft(application.id, value);
    render((count) => count + 1);
    setState({ status: pending.current ? "saving" : "dirty", error: "" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 650);
  };
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsaved()) {
        event.preventDefault();
        event.returnValue = "";
        void flush();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush, hasUnsaved]);
  return {
    ...state,
    edit,
    flush,
    hasUnsaved,
    value: (application: JobApplication) => {
      const current = drafts.current.get(application.id);
      if (current) return current.value;
      const saved = readDraft(application.id);
      if (saved === null) return application.internal_note ?? "";
      if (saved === (application.internal_note ?? "")) {
        clearDraft(application.id);
        return saved;
      }
      drafts.current.set(application.id, {
        value: saved,
        saved: application.internal_note ?? "",
      });
      return saved;
    },
  };
}
