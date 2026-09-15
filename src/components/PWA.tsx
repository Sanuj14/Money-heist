"use client";

import { useEffect, useState } from "react";
import { Mask } from "./Brand";

const DISMISS_KEY = "mhh:install-dismissed";

function read(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
}

export function PWA() {
  const [prompt, setPrompt] = useState<any>(null);
  const [iosHint, setIosHint] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // register the service worker — needed for installability
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone || read(DISMISS_KEY) === "1") return;

    // Android / desktop Chrome
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari never fires beforeinstallprompt — show instructions instead
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) {
      const t = setTimeout(() => { setIosHint(true); setOpen(true); }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setOpen(false);
    write(DISMISS_KEY, "1");
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    try { await prompt.userChoice; } catch { /* ignore */ }
    setPrompt(null);
    dismiss();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4">
      <div className="paper mx-auto flex max-w-md items-start gap-3 p-4 animate-rise">
        <Mask className="mt-0.5 h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="display text-[15px] text-bone">Put this on your home screen</p>
          {iosHint ? (
            <p className="mt-1 text-[12px] leading-relaxed text-bone/55">
              Tap <span className="text-gold">Share</span> at the bottom of Safari,
              then <span className="text-gold">Add to Home Screen</span>. It opens
              fullscreen, with no address bar eating your clue.
            </p>
          ) : (
            <p className="mt-1 text-[12px] leading-relaxed text-bone/55">
              Runs fullscreen like an app, and the scanner opens in one tap.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {!iosHint && (
              <button onClick={install} className="pill-red !px-4 !py-2">Install</button>
            )}
            <button onClick={dismiss} className="pill-ghost !px-4 !py-2">
              {iosHint ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
