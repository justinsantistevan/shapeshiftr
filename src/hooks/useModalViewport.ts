import { useLayoutEffect, useState, type CSSProperties } from "react";

/** Fixed dialogs use layout-viewport coordinates; Safari can expose a smaller,
 * panned visual viewport (keyboard, browser chrome, pinch zoom). dvh alone does
 * not supply that rectangle. Values are already CSS pixels: don't divide by scale.
 * Leave CSS fallbacks in control when VisualViewport is unavailable.
 */
export function useModalViewport(open: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;

    const update = () => setStyle({
      "--modal-viewport-top": `${viewport.offsetTop}px`,
      "--modal-viewport-left": `${viewport.offsetLeft}px`,
      "--modal-viewport-height": `${viewport.height}px`,
      "--modal-viewport-width": `${viewport.width}px`,
    } as CSSProperties);

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return style;
}
