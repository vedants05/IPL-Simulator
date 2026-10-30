"use client";
import { useEffect } from "react";
import { create } from "zustand";

interface EditorAccess {
  enabled: boolean;
  configured: boolean;
  granted: boolean;
}

// Access never lives in a game save or localStorage. Reloads verify the server cookie.
const useEditorAccessStore = create<EditorAccess>(() => ({ enabled: false, configured: false, granted: false }));
let generation = 0;
let pendingRefresh: { generation: number; promise: Promise<boolean> } | null = null;

function acceptStatus(body: Partial<EditorAccess>) {
  const granted = body.granted === true && body.configured === true;
  const enabled = granted && body.enabled === true;
  useEditorAccessStore.setState({ enabled, configured: body.configured === true, granted });
  return enabled;
}

export function hasEditorAccess() {
  const state = useEditorAccessStore.getState();
  return state.enabled && state.granted;
}

export function refreshEditorAccess(): Promise<boolean> {
  if (pendingRefresh?.generation === generation) return pendingRefresh.promise;
  const requestedGeneration = generation;
  const promise = (async () => {
    try {
      const response = await fetch("/api/editor-access", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Access check failed");
      const body = await response.json();
      if (generation !== requestedGeneration) return false;
      return acceptStatus(body);
    } catch {
      if (generation === requestedGeneration) acceptStatus({});
      return false;
    } finally {
      if (pendingRefresh?.generation === requestedGeneration) pendingRefresh = null;
    }
  })();
  pendingRefresh = { generation: requestedGeneration, promise };
  return promise;
}

export async function unlockEditor(password: string) {
  const requestedGeneration = ++generation;
  const response = await fetch("/api/editor-access", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not unlock the editor.");
  if (generation === requestedGeneration) acceptStatus(body);
  notifyOtherTabs();
}

export async function lockEditor() {
  ++generation;
  const current = useEditorAccessStore.getState();
  acceptStatus({ configured: current.configured, granted: current.granted, enabled: false });
  const response = await fetch("/api/editor-access", { method: "DELETE", credentials: "same-origin" });
  if (!response.ok) throw new Error("Could not disable the editor. Please try again.");
  acceptStatus(await response.json());
  notifyOtherTabs();
}

export async function enableEditor() {
  const requestedGeneration = ++generation;
  const response = await fetch("/api/editor-access", { method: "PATCH", credentials: "same-origin", cache: "no-store" });
  const body = await response.json();
  if (!response.ok) {
    if (generation === requestedGeneration && response.status === 401) acceptStatus({ configured: true });
    throw new Error(body.error || "Could not enable the editor.");
  }
  if (generation === requestedGeneration) acceptStatus(body);
  notifyOtherTabs();
}

function notifyOtherTabs() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("ipl-editor-access");
  channel.postMessage("changed");
  channel.close();
}

export function useEditorAccess() {
  const state = useEditorAccessStore();
  useEffect(() => {
    void refreshEditorAccess();
    const interval = window.setInterval(() => { void refreshEditorAccess(); }, 30_000);
    const onFocus = () => { void refreshEditorAccess(); };
    window.addEventListener("focus", onFocus);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ipl-editor-access") : null;
    if (channel) channel.onmessage = () => { void refreshEditorAccess(); };
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); channel?.close(); };
  }, []);
  return state;
}
