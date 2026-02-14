"use client";

import { useEffect, useState } from "react";

export default function WidthBadge() {
  const [w, setW] = useState<number | null>(null);
  const [docW, setDocW] = useState<number | null>(null);
  const [minW, setMinW] = useState<string | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [unscaledWidth, setUnscaledWidth] = useState<number | null>(null);
  const [scrollW, setScrollW] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      const vw = window.innerWidth;
      setW(vw);
      setDocW(document.documentElement.clientWidth);
      // min-width on root (if any)
      const sRoot = getComputedStyle(document.documentElement).getPropertyValue("min-width");
      // min-width on the wrapper that enforces design width
      const wrapper = document.querySelector('.app-min-width-wrapper') as HTMLElement | null;
      const sWrapper = wrapper ? getComputedStyle(wrapper).getPropertyValue("min-width") : null;
      setMinW((sWrapper || sRoot) ?? null);

      // compute unscaled content width (the wrapper's layout width)
      const wrapperRect = wrapper ? Math.round(wrapper.getBoundingClientRect().width) : null;
      setUnscaledWidth(wrapperRect || null);
      setScrollW(document.documentElement.scrollWidth || null);

      // report a logical "scale" value for UI diagnostics (not applied to layout)
      const design = 260;
      const logicalScale = Math.min(1, vw / design);
      setScale(logicalScale);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        top: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        color: "white",
        padding: "6px 8px",
        borderRadius: 8,
        fontSize: 12,
        fontFamily: "Inter, ui-sans-serif, system-ui",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <div style={{ fontWeight: 600 }}>viewport: {w ?? "-"} px</div>
      <div>client: {docW ?? "-"} px</div>
      <div>doc min-width: {minW ?? "-"}</div>
      <div>unscaled content: {unscaledWidth ?? "-"} px</div>
      <div>doc scrollWidth: {scrollW ?? "-"} px</div>
      <div>scale: {scale !== null ? scale.toFixed(2) : "-"}</div>
    </div>
  );
}
