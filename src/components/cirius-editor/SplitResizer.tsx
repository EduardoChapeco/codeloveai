import { useCallback, useRef, useEffect } from "react";

interface Props {
  onResize: (width: number) => void;
  currentWidth: number;
}

export default function SplitResizer({ onResize, currentWidth }: Props) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = currentWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [currentWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      const newW = Math.min(Math.max(startW.current + delta, 280), 600);
      onResize(newW);
    };
    const onUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [onResize]);

  return (
    <div
      className="sp-resizer"
      onMouseDown={onMouseDown}
    />
  );
}
