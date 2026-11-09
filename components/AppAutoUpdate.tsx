"use client";
import { useEffect, useState } from "react";
import {
  canApplyRelease,
  emptyRelease,
  observeRelease,
  recentlyAttempted,
  UPDATE_CONFIRM_MS,
  UPDATE_POLL_MS,
} from "@/lib/app-update-policy";
const attemptKey = "mill:auto-update-attempt",
  displayKey = "mill:resume-yard-display";
export function AppAutoUpdate() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const current = process.env.NEXT_PUBLIC_APP_VERSION;
    if (process.env.NODE_ENV !== "production" || !current) return;
    let healthy = false;
    let state = emptyRelease(),
      lastInteraction = Date.now(),
      pointerDown = false,
      inflight = false,
      reloading = false,
      disposed = false;
    let confirmation: ReturnType<typeof setTimeout> | undefined;
    const activeEditor = () => {
      const element = document.activeElement;
      return (
        element instanceof HTMLElement &&
        (element.matches('input,textarea,select,[contenteditable="true"]') ||
          element.isContentEditable)
      );
    };
    function apply() {
      if (
        disposed ||
        reloading ||
        inflight ||
        !healthy ||
        !canApplyRelease(state, {
          now: Date.now(),
          lastInteraction,
          online: navigator.onLine,
          visible: document.visibilityState === "visible",
          focused: document.hasFocus(),
          blocked:
            document.readyState !== "complete" ||
            activeEditor() ||
            !!document.querySelector(
              '[data-app-update-blocked="true"],[aria-busy="true"],dialog[open],[role="dialog"]',
            ),
          pointerDown,
        })
      )
        return;
      if (Date.now() - state.lastSeen > 5000) {
        void check();
        return;
      }
      const target = state.version!;
      try {
        if (
          recentlyAttempted(
            sessionStorage.getItem(attemptKey),
            current!,
            target,
            Date.now(),
          )
        )
          return;
        sessionStorage.setItem(
          attemptKey,
          JSON.stringify({ from: current, to: target, at: Date.now() }),
        );
        if (
          document.fullscreenElement?.classList.contains("yard-screen") ||
          document.querySelector(".yard-resumed-display")
        )
          sessionStorage.setItem(
            displayKey,
            location.pathname + location.search,
          );
      } catch {
        /* Storage may be unavailable; updates still work. */
      }
      reloading = true;
      window.location.reload();
    }
    async function check() {
      if (
        disposed ||
        inflight ||
        !navigator.onLine ||
        document.visibilityState !== "visible"
      )
        return;
      inflight = true;
      healthy = false;
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch("/api/app-version?check=" + Date.now(), {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (
          disposed ||
          typeof data.version !== "string" ||
          !data.version ||
          data.version.length > 128 ||
          !/^[a-zA-Z0-9._-]+$/.test(data.version)
        )
          return;
        healthy = true;
        state = observeRelease(current!, state, data.version, Date.now());
        setPending(!!state.version);
        if (state.version && state.observations === 1) {
          clearTimeout(confirmation);
          confirmation = setTimeout(() => void check(), UPDATE_CONFIRM_MS);
        }
        apply();
      } catch {
        /* Offline and failed checks never interrupt production. */
      } finally {
        clearTimeout(timeout);
        inflight = false;
      }
    }
    const interact = () => {
      lastInteraction = Date.now();
    };
    const down = () => {
      pointerDown = true;
      interact();
    };
    const up = () => {
      pointerDown = false;
      interact();
    };
    const resume = () => {
      interact();
      void check();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("dragend", up, true);
    for (const event of ["keydown", "input", "change", "wheel", "touchmove"])
      window.addEventListener(event, interact, true);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("blur", up);
    document.addEventListener("visibilitychange", resume);
    const poll = setInterval(() => void check(), UPDATE_POLL_MS),
      idle = setInterval(apply, 1000);
    void check();
    return () => {
      disposed = true;
      clearInterval(poll);
      clearInterval(idle);
      clearTimeout(confirmation);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("dragend", up, true);
      for (const event of ["keydown", "input", "change", "wheel", "touchmove"])
        window.removeEventListener(event, interact, true);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("blur", up);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return pending ? (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-md border border-orange-500 bg-[#11100E] p-4 text-[#F7EFE5] shadow-touch"
    >
      An update is ready. It will install automatically after you finish your
      current task.
    </div>
  ) : null;
}
