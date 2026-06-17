"use client";

import { useEffect } from "react";

/**
 * Registers the service worker. When a NEW worker takes control (e.g. after a
 * deploy / cache bump), reload ONCE so users immediately drop the old cached
 * version and run the latest — without a manual hard-refresh. New visitors
 * (no prior controller) are not reloaded.
 */
export default function PWARegister() {
  useEffect(() => {
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
