"use client";
import { useEffect } from "react";

/** Tells the parent page (our embed.js) how tall the widget is, so the iframe never shows inner scrollbars. */
export function AutoHeight({ scrollTop = false }: { scrollTop?: boolean }) {
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.minHeight = "0"; // the app's min-h-dvh would pin the frame to its current height
    const content = () => document.querySelector("main") ?? document.body;
    const send = () => window.parent?.postMessage({ type: "castel-booking:height", height: Math.ceil(content().getBoundingClientRect().height) + 8 }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(content());
    send();
    if (scrollTop) window.parent?.postMessage({ type: "castel-booking:scroll" }, "*");
    return () => ro.disconnect();
  }, [scrollTop]);
  return null;
}
