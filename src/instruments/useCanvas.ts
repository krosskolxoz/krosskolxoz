import { useEffect, useRef, useState } from 'react';

export function useCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 400, height: 260 });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(1, width), height: Math.max(1, height) });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

export function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}
