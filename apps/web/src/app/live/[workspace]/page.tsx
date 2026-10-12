// @/app/live/[workspace]/page.tsx
'use client';

import Toolbar from '@/components/drawingToolbar/drawingToolbar';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number };

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
  const hoverCell = useRef<Point | null>(null);

  const [zoomPercentage, setZoomPercentage] = useState(100);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

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

  const drawSegment = useCallback(
    (a: Point, b: Point, color: string, width: number) => {
      const rctx = getRaster().getContext('2d');
      if (!rctx) return;
      rctx.save();
      rctx.translate(HALF, HALF);
      rctx.strokeStyle = color;
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
      if (s.points.length === 1) {
        drawSegment(s.points[0], s.points[0], s.color, s.width);
        continue;
      }
      for (let i = 1; i < s.points.length; i++) {
        drawSegment(s.points[i - 1], s.points[i], s.color, s.width);
      }
    }
  }, [drawSegment, getRaster]);

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

  const drawHoverCell = useCallback((ctx: CanvasRenderingContext2D) => {
    const cell = hoverCell.current;
    const { x, y, zoom } = camera.current;
    if (!cell || zoom < PIXEL_GRID_ZOOM) return;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(cell.x * zoom + x + 0.5, cell.y * zoom + y + 0.5, zoom - 1, zoom - 1);
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
    drawHoverCell(ctx);
  }, [drawHoverCell, drawPixelGrid, getRaster]);

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

    if (spacePressed.current) {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    isDrawing.current = true;
    canvas.setPointerCapture(e.pointerId);

    const p = toWorld(e);
    points.current = [p];
    drawSegment(p, p, 'black', 2); // dot on single click
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

    const p = toWorld(e);

    // Snap hover highlight to the pixel under the cursor
    hoverCell.current = { x: Math.floor(p.x), y: Math.floor(p.y) };

    if (isDrawing.current) {
      const prev = points.current[points.current.length - 1];
      points.current.push(p);
      drawSegment(prev, p, 'black', 2); // paint into raster live
    }

    render();
  };

  const stopDrawing = () => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (points.current.length > 0) {
      strokes.current.push({
        points: [...points.current],
        color: 'black',
        width: 2,
      });
      localStorage.setItem('dudiic-drawing', JSON.stringify(strokes.current));
    }
    points.current = [];
    render();
  };

  const onPointerLeave = () => {
    hoverCell.current = null;
    render();
  };

  const cursor = isSpacePressed ? 'grab' : 'crosshair';

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
      <Toolbar canvasRef={canvasRef} />

      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={onPointerLeave}
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
