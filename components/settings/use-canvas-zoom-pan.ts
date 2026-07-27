"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { PAGE_W, PAGE_H, clamp } from "@/lib/pdf/canvas-geometry";

type UseCanvasZoomPanOptions = {
  canvasRef: RefObject<HTMLDivElement | null>;
};

export function useCanvasZoomPan({ canvasRef }: UseCanvasZoomPanOptions) {
  const [zoom, setZoom] = useState(0.55);
  const [autoFit, setAutoFit] = useState(true);

  const fitZoom = useCallback(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 32; // spazio interno p-4 * 2
    const availableW = rect.width - padding;
    const availableH = rect.height - padding;
    const scaleW = availableW / PAGE_W;
    const scaleH = availableH / PAGE_H;
    const next = clamp(Math.min(scaleW, scaleH) * 0.95, 0.3, 1.5);
    setZoom(next);
  }, [canvasRef]);

  useEffect(() => {
    if (!autoFit) return;
    fitZoom();

    const el = canvasRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      fitZoom();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoFit, fitZoom, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setAutoFit(false);
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => clamp(z + delta, 0.3, 1.5));
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = canvas.scrollLeft;
      startScrollTop = canvas.scrollTop;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      canvas.scrollLeft = startScrollLeft - dx;
      canvas.scrollTop = startScrollTop - dy;
    };

    const handleMouseUp = () => {
      isPanning = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      handleMouseUp();
    };
  }, [canvasRef]);

  return { zoom, setZoom, autoFit, setAutoFit, fitZoom };
}
