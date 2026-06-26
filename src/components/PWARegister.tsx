"use client";

import { useEffect } from "react";
import { BUILD_VERSION } from "@/buildVersion";

/**
 * Forces the latest version:
 * 1) Version gate — polls /version.json (never cached). If the deployed version
 *    differs from the bundle this page was built from, this is an OLD version, so
 *    we drop all caches and reload to fetch the newest. A sessionStorage guard
 *    prevents reload loops.
 * 2) Service worker — reload once when a new worker takes control after a deploy.
 */
async function enforceLatestVersion(): Promise<void> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { version?: string };
    const latest = data?.version;
    if (!latest || latest === BUILD_VERSION) return;

    // This running bundle is stale. Only attempt the jump once per target version.
    const tried = sessionStorage.getItem("vgate");
    if (tried === latest) return;
    sessionStorage.setItem("vgate", latest);

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    window.location.reload();
  } catch {
    // network/parse failures are non-fatal
  }
}

export default function PWARegister() {
  useEffect(() => {
    // Capacitor(iOS ネイティブ殻)では資産はバンドル同梱で、SW は capacitor:// で動かず
    // version.json も常に一致するため、バージョンゲート/SW 登録は丸ごとスキップする。
    if (typeof window !== "undefined" && (window as { Capacitor?: unknown }).Capacitor) {
      return;
    }

    void enforceLatestVersion();

    if (!("serviceWorker" in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !hadController) return; // skip the very first install
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {
        // registration failures are non-fatal
      });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
