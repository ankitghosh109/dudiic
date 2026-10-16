// @/app/live/[workspace]/page.tsx
'use client';

import Toolbar from '@/components/drawingToolbar/drawingToolbar';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Point = { x: number; y: number; opacity?: number };
type Stroke = {
  points: Point[];
  color: string;
  width: number;
  mode?: 'segment' | 'pixel' | 'brush';
};

/* ---------- CONFIG ---------- */

const MIN_ZOOM = 0.0001; // 0.01%
const MAX_ZOOM = 1_000_000; // 100,000,000%

// 1px pixel grid appears when zoom >= 600%
const PIXEL_GRID_ZOOM = 6;
const GRID_COLOR = 'rgba(0,0,0,0.2)';

const BACKGROUND = '#ffffff';

// Raster document: 4096x4096 world units, centered on the origin.
// 1 world unit = 1 raster pixel.
const DOC_SIZE = 4096;
const HALF = DOC_SIZE / 2;

function getCirclePixelCoverages(cx: number, cy: number, radius = 0.5) {
  const SAMPLES = 20;
  const step = (radius * 2) / SAMPLES;
  const start = -radius + step / 2;
  const r2 = radius * radius;

  const counts: Record<string, { x: number; y: number; count: number }> = {};
  let totalInside = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const u = start + i * step;
    for (let j = 0; j < SAMPLES; j++) {
      const v = start + j * step;
      if (u * u + v * v <= r2) {
        totalInside++;
        const px = Math.floor(cx + u);
        const py = Math.floor(cy + v);
        const key = `${px},${py}`;
        if (!counts[key]) {
          counts[key] = { x: px, y: py, count: 0 };
        }
        counts[key].count++;
      }
    }
  }

  if (totalInside === 0) return [];

  return Object.values(counts).map((c) => ({
    x: c.x,
    y: c.y,
    opacity: c.count / totalInside,
  }));
}

export default function Workspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rasterRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);
  const points = useRef<Point[]>([]);
  const strokes = useRef<Stroke[]>([]);
  const camera = useRef({ x: 0, y: 0, zoom: 1 });

  const isPanning = useRef(false);
  const spacePressed = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const lastBrushPoint = useRef<Point | null>(null);

  const [currentTool, setCurrentTool] = useState('pen');
  const [zoom, setZoom] = useState(1);
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const paintColor = '#000000';
  const paintOpacity = 1;
  const paintSize = 2;

  /* ---------- RASTER LAYER ---------- */

  const getRaster = useCallback(() => {
    if (!rasterRef.current) {
      const c = document.createElement('canvas');
      c.width = DOC_SIZE;
      c.height = DOC_SIZE;
      rasterRef.current = c;
    }
    return rasterRef.current;
  }, []);

  const drawPixel = useCallback(
    (px: number, py: number, color: string, opacity = 1) => {
      if (px < -HALF || px >= HALF || py < -HALF || py >= HALF) return;
      const rctx = getRaster().getContext('2d');
      if (!rctx) return;
      rctx.save();
      rctx.translate(HALF, HALF);
      rctx.fillStyle = color;
      rctx.globalAlpha = opacity;
      rctx.fillRect(px, py, 1, 1);
      rctx.restore();
    },
    [getRaster],
  );

  const drawCircleBrush = useCallback(
    (cx: number, cy: number, color: string, radius: number, opacity: number) => {
      const coverages = getCirclePixelCoverages(cx, cy, radius);
      for (const cov of coverages) {
        const pixelOpacity = cov.opacity * opacity;
        drawPixel(cov.x, cov.y, color, pixelOpacity);
        points.current.push({ x: cov.x, y: cov.y, opacity: pixelOpacity });
      }
    },
    [drawPixel],
  );

  const drawLinePixels = useCallback(
    (x0: number, y0: number, x1: number, y1: number, color: string, opacity: number) => {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      let curX = x0;
      let curY = y0;

      while (true) {
        drawPixel(curX, curY, color, opacity);
        const last = points.current[points.current.length - 1];
        if (!last || last.x !== curX || last.y !== curY) {
          points.current.push({ x: curX, y: curY });
        }

        if (curX === x1 && curY === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          curX += sx;
        }
        if (e2 < dx) {
          err += dx;
          curY += sy;
        }
      }
    },
    [drawPixel],
  );

  const drawSegment = useCallback(
    (a: Point, b: Point, color: string, width: number, opacity = 1) => {
      const rctx = getRaster().getContext('2d');
      if (!rctx) return;
      rctx.save();
      rctx.translate(HALF, HALF);
      rctx.strokeStyle = color;
      rctx.globalAlpha = opacity;
      rctx.lineWidth = width;
      rctx.lineCap = 'round';
      rctx.lineJoin = 'round';
      rctx.beginPath();
      rctx.moveTo(a.x, a.y);
      rctx.lineTo(b.x, b.y);
      rctx.stroke();
      rctx.restore();
    },
    [getRaster],
  );

  const redrawRaster = useCallback(() => {
    const raster = getRaster();
    raster.getContext('2d')?.clearRect(0, 0, DOC_SIZE, DOC_SIZE);
    for (const s of strokes.current) {
      if (s.points.length === 0) continue;
      if (s.mode === 'pixel' || s.mode === 'brush') {
        for (const p of s.points) {
          drawPixel(p.x, p.y, s.color, p.opacity ?? 1);
        }
        continue;
      }
      if (s.points.length === 1) {
        drawSegment(s.points[0], s.points[0], s.color, s.width);
        continue;
      }
      for (let i = 1; i < s.points.length; i++) {
        drawSegment(s.points[i - 1], s.points[i], s.color, s.width);
      }
    }
  }, [drawPixel, drawSegment, getRaster]);

  /* ---------- COORDS ---------- */

  const screenToWorld = useCallback((sx: number, sy: number): Point => {
    const { x, y, zoom } = camera.current;
    return { x: (sx - x) / zoom, y: (sy - y) / zoom };
  }, []);

  /* ---------- PIXEL GRID (1px lines, only above 600%) ---------- */

  const drawPixelGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x: cx, y: cy, zoom } = camera.current;
    if (zoom < PIXEL_GRID_ZOOM) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const firstX = Math.floor(-cx / zoom);
    const lastX = Math.ceil((w - cx) / zoom);
    const firstY = Math.floor(-cy / zoom);
    const lastY = Math.ceil((h - cy) / zoom);

    // Snap to device pixels so every line is exactly 1px
    const snap = (v: number) => (Math.round(v * dpr) + 0.5) / dpr;

    ctx.beginPath();
    ctx.lineWidth = 1 / dpr;
    ctx.strokeStyle = GRID_COLOR;

    for (let i = firstX; i <= lastX; i++) {
      const sx = snap(i * zoom + cx);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let i = firstY; i <= lastY; i++) {
      const sy = snap(i * zoom + cy);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();
  }, []);

  /* ---------- RENDER ---------- */

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { x, y, zoom } = camera.current;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Everything is drawn in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    /*
     * Draw ONLY the visible part of the raster.
     * Scaling the whole image by up to 1,000,000x would break the canvas,
     * so we crop the source to the screen and keep destination numbers small.
     */
    const left = -x / zoom + HALF;
    const top = -y / zoom + HALF;
    const right = (w - x) / zoom + HALF;
    const bottom = (h - y) / zoom + HALF;

    const srcL = Math.max(0, left);
    const srcT = Math.max(0, top);
    const srcR = Math.min(DOC_SIZE, right);
    const srcB = Math.min(DOC_SIZE, bottom);

    if (srcR > srcL && srcB > srcT) {
      ctx.imageSmoothingEnabled = zoom < 1; // hard square pixels when zoomed in
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        getRaster(),
        srcL,
        srcT,
        srcR - srcL,
        srcB - srcT,
        (srcL - HALF) * zoom + x,
        (srcT - HALF) * zoom + y,
        (srcR - srcL) * zoom,
        (srcB - srcT) * zoom,
      );
    }

    drawPixelGrid(ctx);
  }, [drawPixelGrid, getRaster]);

  /* ---------- RESIZE ---------- */

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      render();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [render]);

  /* ---------- RESTORE ---------- */

  useEffect(() => {
    const saved = localStorage.getItem('dudiic-drawing');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      strokes.current = parsed;
      redrawRaster();
      render();
    } catch (e) {
      console.error('Failed to restore drawing:', e);
    }
  }, [redrawRaster, render]);

  /* ---------- ZOOM ---------- */

  const zoomAtPoint = useCallback(
    (sx: number, sy: number, factor: number) => {
      const oldZoom = camera.current.zoom;
      const world = screenToWorld(sx, sy);
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;

      camera.current.zoom = newZoom;
      camera.current.x = sx - world.x * newZoom;
      camera.current.y = sy - world.y * newZoom;

      setZoom(newZoom);
      setZoomPercentage(newZoom * 100);
      render();
    },
    [render, screenToWorld],
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const c = canvasRef.current;
      if (!c) return;
      zoomAtPoint(c.clientWidth / 2, c.clientHeight / 2, factor);
    },
    [zoomAtPoint],
  );

  const resetZoom = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const cx = c.clientWidth / 2;
    const cy = c.clientHeight / 2;
    const w = screenToWorld(cx, cy);
    camera.current.zoom = 1;
    camera.current.x = cx - w.x;
    camera.current.y = cy - w.y;
    setZoom(1);
    setZoomPercentage(100);
    render();
  }, [render, screenToWorld]);

  // Native wheel listener: React's onWheel is passive, so preventDefault fails there.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isPanning.current) return;
      const rect = canvas.getBoundingClientRect();
      zoomAtPoint(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0025));
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint]);

  /* ---------- KEYBOARD ---------- */

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!e.repeat) {
          spacePressed.current = true;
          setIsSpacePressed(true);
        }
        e.preventDefault();
      } else if (e.key === '+' || e.key === '=') {
        zoomAtCenter(1.5);
        e.preventDefault();
      } else if (e.key === '-') {
        zoomAtCenter(1 / 1.5);
        e.preventDefault();
      } else if (e.key === '0') {
        resetZoom();
        e.preventDefault();
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed.current = false;
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [resetZoom, zoomAtCenter]);

  /* ---------- POINTER ---------- */

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (spacePressed.current || currentTool === 'hand') {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    isDrawing.current = true;
    canvas.setPointerCapture(e.pointerId);

    const p = toWorld(e);

    if (currentTool === 'pen') {
      const pixelX = Math.floor(p.x);
      const pixelY = Math.floor(p.y);
      if (pixelX >= -HALF && pixelX < HALF && pixelY >= -HALF && pixelY < HALF) {
        drawPixel(pixelX, pixelY, paintColor, paintOpacity);
        points.current = [{ x: pixelX, y: pixelY }];
        render();
      } else {
        points.current = [];
      }
      return;
    }

    if (currentTool === 'brush') {
      lastBrushPoint.current = p;
      drawCircleBrush(p.x, p.y, paintColor, Math.max(0.5, paintSize / 2), paintOpacity);
      render();
      return;
    }

    points.current = [p];
    drawSegment(p, p, paintColor, paintSize, paintOpacity); // dot on single click
    render();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      camera.current.x += e.clientX - lastPanPoint.current.x;
      camera.current.y += e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      render();
      return;
    }

    if (!isDrawing.current) return;

    const p = toWorld(e);

    if (currentTool === 'pen') {
      const pixelX = Math.floor(p.x);
      const pixelY = Math.floor(p.y);
      if (pixelX < -HALF || pixelX >= HALF || pixelY < -HALF || pixelY >= HALF) return;

      const last = points.current[points.current.length - 1];
      if (last && last.x === pixelX && last.y === pixelY) {
        return;
      }

      if (last) {
        drawLinePixels(last.x, last.y, pixelX, pixelY, paintColor, paintOpacity);
      } else {
        drawPixel(pixelX, pixelY, paintColor, paintOpacity);
        points.current.push({ x: pixelX, y: pixelY });
      }
      render();
      return;
    }

    if (currentTool === 'brush') {
      const lastP = lastBrushPoint.current ?? p;
      const dist = Math.hypot(p.x - lastP.x, p.y - lastP.y);

      const stepDist = 0.5;
      const steps = Math.max(1, Math.ceil(dist / stepDist));

      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const curX = lastP.x + (p.x - lastP.x) * t;
        const curY = lastP.y + (p.y - lastP.y) * t;
        drawCircleBrush(curX, curY, paintColor, Math.max(0.5, paintSize / 2), paintOpacity);
      }

      lastBrushPoint.current = p;
      render();
      return;
    }

    const prev = points.current[points.current.length - 1];
    points.current.push(p);
    drawSegment(prev, p, paintColor, paintSize, paintOpacity); // paint into raster live
    render();
  };

  const stopDrawing = () => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    lastBrushPoint.current = null;
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (points.current.length > 0) {
      strokes.current.push({
        points: [...points.current],
        color: paintColor,
        width: paintSize,
        mode: currentTool === 'pen' ? 'pixel' : currentTool === 'brush' ? 'brush' : 'segment',
      });
      localStorage.setItem('dudiic-drawing', JSON.stringify(strokes.current));
    }
    points.current = [];
    render();
  };

  const cursor =
    isSpacePressed || currentTool === 'hand'
      ? 'grab'
      : currentTool === 'pen' || currentTool === 'brush' || currentTool === 'eraser'
        ? 'none'
        : 'crosshair';

  /* ---------- UI ---------- */

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Toolbar
        canvasRef={canvasRef}
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        zoom={zoom}
        isSpacePressed={isSpacePressed}
      />

      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          touchAction: 'none',
          cursor,
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: 10,
          bottom: 10,
          padding: '6px 10px',
          borderRadius: 7,
          background: 'rgba(20,20,20,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      >
        {formatZoom(zoomPercentage)}
      </div>
    </div>
  );
}

function formatZoom(zoom: number) {
  if (zoom < 1) return `${zoom.toFixed(2)}%`;
  if (zoom < 1000) return `${zoom.toFixed(0)}%`;
  return `${Math.round(zoom).toLocaleString()}%`;
}
