// @/app/live/[workspace]/page.tsx
'use client';

import Toolbar from '@/components/drawingToolbar/drawingToolbar';
import RightPanel, { type BlendMode, type Layer } from '@/components/Right-Panel/RightPanel';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Point = { x: number; y: number; opacity?: number };
type StrokeMode =
  | 'segment'
  | 'pixel'
  | 'brush'
  | 'eraser'
  | 'rectangle'
  | 'oval'
  | 'circle'
  | 'text'
  // Replayable strokes: only the path + settings are stored, pixels are rebuilt on redraw.
  | 'pen-path'
  | 'brush-path'
  | 'eraser-path'
  | 'shape-rectangle'
  | 'shape-oval';
type Stroke = {
  points: Point[];
  color: string;
  width: number; // tool size in px
  mode?: StrokeMode;
  text?: string;
  layerId?: string;
  opacity?: number;
  hardness?: number; // 0-1
};

type ShapeMode = 'rectangle' | 'oval';
type Bounds = { left: number; top: number; right: number; bottom: number };
type Run = { y: number; x0: number; x1: number }; // horizontal run of pixels (inclusive)
type ActiveShape = {
  mode: ShapeMode;
  start: Point;
  cursor: Point;
  bounds: Bounds | null;
  runs: Run[];
};

const INITIAL_LAYERS: Layer[] = [
  { id: 'layer-1', name: 'Layer 1', visible: true, blend: 'Normal' },
];

/* ---------- CONFIG ---------- */

const MIN_ZOOM = 0.0001; // 0.01%
const MAX_ZOOM = 1_000_000; // 100,000,000%

// 1px pixel grid appears when zoom >= 600%
const PIXEL_GRID_ZOOM = 6;
const GRID_COLOR = 'rgba(0,0,0,0.2)';

const UNDRAWABLE_BACKGROUND = '#161616';
const DRAWABLE_BACKGROUND = '#ffffff';

// Raster document: 4096x4096 world units, centered on the origin.
// 1 world unit = 1 raster pixel.
const DOC_SIZE = 4096;
const HALF = DOC_SIZE / 2;

const STORAGE_KEY = 'dudiic-drawing';

const clampCell = (v: number) => Math.max(-HALF, Math.min(HALF - 1, v));
const inDoc = (x: number, y: number) => x >= -HALF && x < HALF && y >= -HALF && y < HALF;
const pixelKey = (x: number, y: number) => (x + HALF) * DOC_SIZE + (y + HALF);

/* ---------- BRUSH / PEN ENGINE ---------- */

// Soft round brush: per-pixel alpha with an anti-aliased edge and hardness falloff.
// `radius` = size / 2, `hardness` is 0-1 (1 = hard edge).
function getBrushPixels(cx: number, cy: number, radius: number, hardness: number) {
  const out: { x: number; y: number; alpha: number }[] = [];
  const inner = radius * hardness;
  const span = radius - inner;
  const x0 = Math.floor(cx - radius);
  const x1 = Math.floor(cx + radius);
  const y0 = Math.floor(cy - radius);
  const y1 = Math.floor(cy + radius);

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
      const edge = Math.min(1, radius - d + 0.5);
      if (edge <= 0) continue;
      const falloff = d <= inner || span <= 0 ? 1 : Math.max(0, 1 - (d - inner) / span);
      const alpha = edge * falloff;
      if (alpha > 0) out.push({ x: px, y: py, alpha });
    }
  }
  return out;
}

// Offsets of a filled SQUARE stamp of the given size in pixels (1 = a single pixel).
const stampCache = new Map<number, Point[]>();
function getStampOffsets(size: number): Point[] {
  const s = Math.max(1, Math.round(size));
  const cached = stampCache.get(s);
  if (cached) return cached;
  const offsets: Point[] = [];
  const shift = Math.floor((s - 1) / 2); // centers the square on the pointer cell
  for (let i = 0; i < s; i++) {
    for (let j = 0; j < s; j++) offsets.push({ x: i - shift, y: j - shift });
  }
  stampCache.set(s, offsets);
  return offsets;
}

type PainterOptions = { color: string; size: number; opacity: number; hardness: number };

/*
 * One painter = one stroke. It is used both live (while you draw) and to replay saved strokes,
 * so what you see while drawing is exactly what is restored later.
 * Inside a stroke every pixel keeps the MAX alpha, so overlapping stamps never build up
 * past the chosen opacity.
 */
function createPainter(
  paint: (x: number, y: number, color: string, alpha: number) => void,
  { color, size: rawSize, opacity, hardness }: PainterOptions,
) {
  const alphas = new Map<number, number>();
  let last: Point | null = null;
  const size = Math.max(1, Math.round(rawSize));

  const stamp = (x: number, y: number, alpha: number) => {
    if (!inDoc(x, y) || alpha <= 0) return;
    const key = pixelKey(x, y);
    const prev = alphas.get(key) ?? 0;
    if (alpha <= prev + 0.002) return;
    paint(x, y, color, prev >= 1 ? 0 : (alpha - prev) / (1 - prev));
    alphas.set(key, alpha);
  };

  // Pen: crisp square stamp of `size` x `size` px.
  const stampPen = (x: number, y: number) => {
    for (const o of getStampOffsets(size)) stamp(x + o.x, y + o.y, opacity);
  };
  const penSpacing = Math.max(1, Math.floor(size / 6));

  const penTo = (x: number, y: number) => {
    if (!last) {
      stampPen(x, y);
      last = { x, y };
      return;
    }
    const x0 = last.x;
    const y0 = last.y;
    const dx = Math.abs(x - x0);
    const dy = Math.abs(y - y0);
    const sx = x0 < x ? 1 : -1;
    const sy = y0 < y ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;
    let step = 0;

    while (cx !== x || cy !== y) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
      step++;
      if ((cx === x && cy === y) || step % penSpacing === 0) stampPen(cx, cy);
    }
    last = { x, y };
  };

  // Brush / eraser: soft round stamp, `size` px wide.
  const radius = Math.max(0.5, size / 2);
  const brushSpacing = Math.max(0.5, radius * 0.15);

  const stampBrush = (cx: number, cy: number) => {
    for (const p of getBrushPixels(cx, cy, radius, hardness)) stamp(p.x, p.y, p.alpha * opacity);
  };

  const brushTo = (p: Point) => {
    if (!last) {
      stampBrush(p.x, p.y);
      last = p;
      return;
    }
    const from = last;
    const dist = Math.hypot(p.x - from.x, p.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / brushSpacing));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      stampBrush(from.x + (p.x - from.x) * t, from.y + (p.y - from.y) * t);
    }
    last = p;
  };

  return { penTo, brushTo };
}

type Painter = ReturnType<typeof createPainter>;

/* ---------- SHAPES ---------- */

// Inclusive cell bounds. shift = equal width/height, alt = start is the center.
function getShapeBounds(start: Point, cur: Point, shift: boolean, alt: boolean): Bounds {
  let dx = cur.x - start.x;
  let dy = cur.y - start.y;
  if (shift) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * size;
    dy = (dy < 0 ? -1 : 1) * size;
  }
  const x0 = alt ? start.x - dx : start.x;
  const y0 = alt ? start.y - dy : start.y;
  const x1 = start.x + dx;
  const y1 = start.y + dy;
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
  };
}

/*
 * Outline of a rectangle / oval as horizontal runs of pixels.
 * `size` is the outline thickness in px. It grows INWARD from the dragged bounding box,
 * so the shape always occupies exactly the box you dragged (like an "inside" stroke).
 */
function rasterizeShape(
  mode: ShapeMode,
  { left, top, right, bottom }: Bounds,
  size: number,
): Run[] {
  const runs: Run[] = [];
  const t = Math.max(1, Math.round(size));

  const add = (y: number, x0: number, x1: number) => {
    if (y < -HALF || y >= HALF) return;
    const a = Math.max(x0, -HALF);
    const b = Math.min(x1, HALF - 1);
    if (a <= b) runs.push({ y, x0: a, x1: b });
  };

  if (mode === 'rectangle') {
    for (let y = top; y <= bottom; y++) {
      if (y < top + t || y > bottom - t) {
        add(y, left, right);
      } else {
        add(y, left, Math.min(right, left + t - 1));
        add(y, Math.max(left + t, right - t + 1), right);
      }
    }
    return runs;
  }

  // Oval: per-row span of pixels whose centers are inside the ellipse.
  const W = right - left + 1;
  const H = bottom - top + 1;
  const a = W / 2;
  const b = H / 2;
  const cx = left + a;
  const cy = top + b;
  const L: number[] = new Array(H);
  const R: number[] = new Array(H);

  for (let i = 0; i < H; i++) {
    const k = (top + i + 0.5 - cy) / b;
    const half = a * Math.sqrt(Math.max(0, 1 - k * k));
    let xl = Math.ceil(cx - half - 0.5);
    let xr = Math.floor(cx + half - 0.5);
    if (xl > xr) xl = xr = Math.round(cx - 0.5);
    L[i] = xl;
    R[i] = xr;
  }

  if (t === 1) {
    // Clean 1px outline: keep only the pixels that touch the outside.
    for (let i = 0; i < H; i++) {
      const aL = i > 0 ? L[i - 1] : Infinity;
      const aR = i > 0 ? R[i - 1] : -Infinity;
      const bL = i < H - 1 ? L[i + 1] : Infinity;
      const bR = i < H - 1 ? R[i + 1] : -Infinity;
      const leftEnd = Math.min(R[i], Math.max(L[i], Math.max(aL, bL) - 1));
      const rightStart = Math.max(L[i], Math.min(R[i], Math.min(aR, bR) + 1));
      const y = top + i;
      add(y, L[i], leftEnd);
      add(y, Math.max(rightStart, leftEnd + 1), R[i]);
    }
    return runs;
  }

  // Thick outline: outer ellipse minus an inner ellipse shrunk by `t`.
  const ia = a - t;
  const ib = b - t;
  for (let i = 0; i < H; i++) {
    const y = top + i;
    let hasInner = false;
    let il = 0;
    let ir = -1;
    if (ia > 0 && ib > 0) {
      const k = (y + 0.5 - cy) / ib;
      if (Math.abs(k) <= 1) {
        const half = ia * Math.sqrt(1 - k * k);
        il = Math.ceil(cx - half - 0.5);
        ir = Math.floor(cx + half - 0.5);
        hasInner = il <= ir;
      }
    }
    if (!hasInner) {
      add(y, L[i], R[i]);
    } else {
      add(y, L[i], il - 1);
      add(y, ir + 1, R[i]);
    }
  }
  return runs;
}

export default function Workspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rasterRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);
  const points = useRef<Point[]>([]);
  const strokes = useRef<Stroke[]>([]);
  const painter = useRef<Painter | null>(null);
  const camera = useRef({ x: 0, y: 0, zoom: 1 });

  const isPanning = useRef(false);
  const spacePressed = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const activeShape = useRef<ActiveShape | null>(null);

  const [currentTool, setCurrentTool] = useState('pen');
  const [zoom, setZoom] = useState(1);
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [paintColor, setPaintColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  const [paintOpacityPercent, setPaintOpacityPercent] = useState(100);
  const [paintSize, setPaintSize] = useState(1);
  const [hardness, setHardness] = useState(100);
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState('layer-1');
  const paintOpacity = paintOpacityPercent / 100;

  const colorForTool = currentTool === 'eraser' ? DRAWABLE_BACKGROUND : paintColor;

  // render() and updateShape() read the paint settings from a ref, so they keep a stable identity.
  // (If render changed on every color/size change, the effects below would redraw the whole drawing.)
  const paintRef = useRef({ color: paintColor, opacity: paintOpacity, size: paintSize });
  useEffect(() => {
    paintRef.current = { color: paintColor, opacity: paintOpacity, size: paintSize };
  }, [paintColor, paintOpacity, paintSize]);

  const layersRef = useRef<Layer[]>(INITIAL_LAYERS);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const saveStrokes = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strokes.current));
    } catch (e) {
      console.error('Failed to save drawing (storage may be full):', e);
    }
  };

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

  // Fills horizontal runs of pixels (used by rectangle / oval).
  const drawRuns = useCallback(
    (runs: Run[], color: string, opacity = 1) => {
      const rctx = getRaster().getContext('2d');
      if (!rctx) return;
      rctx.save();
      rctx.translate(HALF, HALF);
      rctx.fillStyle = color;
      rctx.globalAlpha = opacity;
      for (const r of runs) rctx.fillRect(r.x0, r.y, r.x1 - r.x0 + 1, 1);
      rctx.restore();
    },
    [getRaster],
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

  const drawRectangle = useCallback(
    (a: Point, b: Point, color: string, width: number) => {
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const bottom = Math.max(a.y, b.y);
      drawSegment({ x: left, y: top }, { x: right, y: top }, color, width);
      drawSegment({ x: right, y: top }, { x: right, y: bottom }, color, width);
      drawSegment({ x: right, y: bottom }, { x: left, y: bottom }, color, width);
      drawSegment({ x: left, y: bottom }, { x: left, y: top }, color, width);
    },
    [drawSegment],
  );

  const drawCircle = useCallback(
    (a: Point, b: Point, color: string, width: number) => {
      const rctx = getRaster().getContext('2d');
      if (!rctx) return;
      const left = Math.min(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const diameter = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      rctx.save();
      rctx.translate(HALF, HALF);
      rctx.strokeStyle = color;
      rctx.lineWidth = width;
      rctx.beginPath();
      rctx.arc(left + diameter / 2, top + diameter / 2, diameter / 2, 0, Math.PI * 2);
      rctx.stroke();
      rctx.restore();
    },
    [getRaster],
  );

  const drawText = useCallback(
    (point: Point, text: string, color: string) => {
      const rctx = getRaster().getContext('2d');
      if (!rctx) return;
      rctx.save();
      rctx.translate(HALF, HALF);
      rctx.fillStyle = color;
      rctx.font = '16px sans-serif';
      rctx.textBaseline = 'top';
      rctx.fillText(text, point.x, point.y);
      rctx.restore();
    },
    [getRaster],
  );

  const redrawRaster = useCallback(() => {
    const raster = getRaster();
    raster.getContext('2d')?.clearRect(0, 0, DOC_SIZE, DOC_SIZE);
    for (const s of strokes.current) {
      if (s.points.length === 0) continue;
      if (s.layerId && !layersRef.current.some((layer) => layer.id === s.layerId && layer.visible))
        continue;

      // Pen / brush / eraser: replay the stored path with the stored size, opacity and hardness.
      if (s.mode === 'pen-path' || s.mode === 'brush-path' || s.mode === 'eraser-path') {
        const p = createPainter(drawPixel, {
          color: s.color,
          size: s.width,
          opacity: s.opacity ?? 1,
          hardness: s.hardness ?? 1,
        });
        if (s.mode === 'pen-path') for (const pt of s.points) p.penTo(pt.x, pt.y);
        else for (const pt of s.points) p.brushTo(pt);
        continue;
      }

      // Rectangle / oval: rebuild from the stored bounding box and outline thickness.
      if ((s.mode === 'shape-rectangle' || s.mode === 'shape-oval') && s.points.length >= 2) {
        const bounds = {
          left: s.points[0].x,
          top: s.points[0].y,
          right: s.points[1].x,
          bottom: s.points[1].y,
        };
        const runs = rasterizeShape(
          s.mode === 'shape-rectangle' ? 'rectangle' : 'oval',
          bounds,
          s.width,
        );
        drawRuns(runs, s.color, s.points[0].opacity ?? 1);
        continue;
      }

      // Older saved formats
      if (s.mode === 'pixel' || s.mode === 'brush' || s.mode === 'eraser') {
        for (const p of s.points) {
          drawPixel(p.x, p.y, s.color, p.opacity ?? 1);
        }
        continue;
      }
      if (s.mode === 'rectangle' && s.points.length >= 2) {
        drawRectangle(s.points[0], s.points[1], s.color, s.width);
        continue;
      }
      if ((s.mode === 'oval' || s.mode === 'circle') && s.points.length >= 2) {
        drawCircle(s.points[0], s.points[1], s.color, s.width);
        continue;
      }
      if (s.mode === 'text' && s.text) {
        drawText(s.points[0], s.text, s.color);
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
  }, [drawCircle, drawPixel, drawRectangle, drawRuns, drawSegment, drawText, getRaster]);

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
    ctx.fillStyle = UNDRAWABLE_BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    // The raster is transparent so the document can be composited over the
    // undrawable canvas area. Paint the drawable document white first.
    const documentLeft = x - HALF * zoom;
    const documentTop = y - HALF * zoom;
    const documentRight = x + HALF * zoom;
    const documentBottom = y + HALF * zoom;
    const visibleDocumentLeft = Math.max(0, documentLeft);
    const visibleDocumentTop = Math.max(0, documentTop);
    const visibleDocumentRight = Math.min(w, documentRight);
    const visibleDocumentBottom = Math.min(h, documentBottom);

    if (visibleDocumentRight > visibleDocumentLeft && visibleDocumentBottom > visibleDocumentTop) {
      ctx.fillStyle = DRAWABLE_BACKGROUND;
      ctx.fillRect(
        visibleDocumentLeft,
        visibleDocumentTop,
        visibleDocumentRight - visibleDocumentLeft,
        visibleDocumentBottom - visibleDocumentTop,
      );
    }

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

    // Live preview: the exact runs of pixels that will be committed.
    const shape = activeShape.current;
    if (shape && shape.runs.length > 0) {
      const rowH = Math.max(zoom, 1 / dpr);
      ctx.save();
      ctx.fillStyle = paintRef.current.color;
      ctx.globalAlpha = paintRef.current.opacity;
      ctx.beginPath();
      for (const r of shape.runs) {
        ctx.rect(
          x + r.x0 * zoom,
          y + r.y * zoom,
          Math.max((r.x1 - r.x0 + 1) * zoom, 1 / dpr),
          rowH,
        );
      }
      ctx.fill();
      ctx.restore();
    }

    drawPixelGrid(ctx);
  }, [drawPixelGrid, getRaster]);

  const updateShape = useCallback(
    (shift: boolean, alt: boolean, cursor?: Point) => {
      const shape = activeShape.current;
      if (!shape) return;
      if (cursor) shape.cursor = cursor;
      const bounds = getShapeBounds(shape.start, shape.cursor, shift, alt);
      shape.bounds = bounds;
      shape.runs = rasterizeShape(shape.mode, bounds, paintRef.current.size);
      render();
    },
    [render],
  );

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
    const saved = localStorage.getItem(STORAGE_KEY);
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
      // Never hijack keys while typing in the panel (hex field, number boxes, rename...).
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape' && activeShape.current) {
        activeShape.current = null;
        isDrawing.current = false;
        points.current = [];
        render();
        return;
      }
      if ((e.key === 'Shift' || e.key === 'Alt') && activeShape.current) {
        e.preventDefault();
        updateShape(e.shiftKey, e.altKey);
        return;
      }
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
      if ((e.key === 'Shift' || e.key === 'Alt') && activeShape.current) {
        updateShape(e.shiftKey, e.altKey);
      }
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
  }, [render, resetZoom, updateShape, zoomAtCenter]);

  /* ---------- POINTER ---------- */

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  // Brush points are rounded so the live stroke and its saved replay are identical.
  const round2 = (p: Point): Point => ({
    x: Math.round(p.x * 100) / 100,
    y: Math.round(p.y * 100) / 100,
  });

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

    if (currentTool === 'text') {
      isDrawing.current = false;
      if (p.x < -HALF || p.x >= HALF || p.y < -HALF || p.y >= HALF) return;
      const text = window.prompt('Enter text');
      if (text) {
        drawText(p, text, paintColor);
        strokes.current.push({
          points: [p],
          color: paintColor,
          width: paintSize,
          mode: 'text',
          text,
          layerId: activeLayerId,
        });
        saveStrokes();
        render();
      }
      return;
    }

    // Pen / brush / eraser: one painter per stroke, using the current size, opacity and hardness.
    if (currentTool === 'pen' || currentTool === 'brush' || currentTool === 'eraser') {
      painter.current = createPainter(drawPixel, {
        color: colorForTool,
        size: paintSize,
        opacity: paintOpacity,
        hardness: hardness / 100,
      });
      points.current = [];

      if (currentTool === 'pen') {
        const cell = { x: Math.floor(p.x), y: Math.floor(p.y) };
        if (inDoc(cell.x, cell.y)) {
          painter.current.penTo(cell.x, cell.y);
          points.current = [cell];
          render();
        }
      } else {
        const q = round2(p);
        painter.current.brushTo(q);
        points.current = [q];
        render();
      }
      return;
    }

    if (currentTool === 'rectangle' || currentTool === 'oval') {
      const cell = { x: Math.floor(p.x), y: Math.floor(p.y) };
      if (!inDoc(cell.x, cell.y)) {
        isDrawing.current = false;
        return;
      }
      points.current = [cell];
      activeShape.current = {
        mode: currentTool as ShapeMode,
        start: cell,
        cursor: cell,
        bounds: null,
        runs: [],
      };
      updateShape(e.shiftKey, e.altKey);
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
      const cell = { x: Math.floor(p.x), y: Math.floor(p.y) };
      if (!inDoc(cell.x, cell.y) || !painter.current) return;

      const last = points.current[points.current.length - 1];
      if (last && last.x === cell.x && last.y === cell.y) return;

      painter.current.penTo(cell.x, cell.y);
      points.current.push(cell);
      render();
      return;
    }

    if (currentTool === 'brush' || currentTool === 'eraser') {
      if (!painter.current) return;
      const q = round2(p);
      painter.current.brushTo(q);
      points.current.push(q);
      render();
      return;
    }

    if (currentTool === 'rectangle' || currentTool === 'oval') {
      updateShape(e.shiftKey, e.altKey, {
        x: clampCell(Math.floor(p.x)),
        y: clampCell(Math.floor(p.y)),
      });
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
    if (!isDrawing.current) return;
    isDrawing.current = false;

    // Rectangle / oval
    if (activeShape.current) {
      const shape = activeShape.current;
      activeShape.current = null;
      points.current = [];
      if (shape.bounds && shape.runs.length > 0) {
        const b = shape.bounds;
        drawRuns(shape.runs, paintColor, paintOpacity);
        strokes.current.push({
          points: [
            { x: b.left, y: b.top, opacity: paintOpacity < 1 ? paintOpacity : undefined },
            { x: b.right, y: b.bottom },
          ],
          color: paintColor,
          width: paintSize,
          layerId: activeLayerId,
          mode: shape.mode === 'rectangle' ? 'shape-rectangle' : 'shape-oval',
        });
        saveStrokes();
      }
      render();
      return;
    }

    // Pen / brush / eraser
    if (currentTool === 'pen' || currentTool === 'brush' || currentTool === 'eraser') {
      painter.current = null;
      if (points.current.length > 0) {
        strokes.current.push({
          points: [...points.current],
          color: colorForTool,
          width: paintSize,
          opacity: paintOpacity < 1 ? paintOpacity : undefined,
          hardness: currentTool === 'pen' ? undefined : hardness / 100,
          layerId: activeLayerId,
          mode:
            currentTool === 'pen'
              ? 'pen-path'
              : currentTool === 'brush'
                ? 'brush-path'
                : 'eraser-path',
        });
        saveStrokes();
      }
      points.current = [];
      render();
      return;
    }

    // Any other freehand tool
    if (points.current.length > 0) {
      strokes.current.push({
        points: [...points.current],
        color: colorForTool,
        width: paintSize,
        layerId: activeLayerId,
        mode: 'segment',
      });
      saveStrokes();
    }
    points.current = [];
    render();
  };

  const cursor =
    isSpacePressed || currentTool === 'hand'
      ? 'grab'
      : currentTool === 'text'
        ? 'text'
        : currentTool === 'pen' || currentTool === 'brush' || currentTool === 'eraser'
          ? 'none'
          : 'crosshair';

  const addLayer = useCallback(() => {
    const id = `layer-${Date.now()}`;
    setLayers((current) => {
      return [
        { id, name: `Layer ${current.length + 1}`, visible: true, blend: 'Normal' },
        ...current,
      ];
    });
    setActiveLayerId(id);
  }, []);

  const duplicateLayer = useCallback((id: string) => {
    setLayers((current) => {
      const source = current.find((layer) => layer.id === id);
      if (!source) return current;
      const newId = `layer-${Date.now()}`;
      setActiveLayerId(newId);
      return [{ ...source, id: newId, name: `${source.name} copy` }, ...current];
    });
  }, []);

  const deleteLayer = useCallback((id: string) => {
    setLayers((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((layer) => layer.id !== id);
      setActiveLayerId((active) => (active === id ? next[0].id : active));
      return next;
    });
  }, []);

  const updateLayer = useCallback((id: string, update: Partial<Layer>) => {
    setLayers((current) =>
      current.map((layer) => (layer.id === id ? { ...layer, ...update } : layer)),
    );
  }, []);

  // Only redraw the raster when a layer's visibility changes (not on rename, color, size...).
  const visibilityKey = layers.map((layer) => `${layer.id}:${layer.visible ? 1 : 0}`).join('|');
  useEffect(() => {
    redrawRaster();
    render();
  }, [visibilityKey, redrawRaster, render]);

  /* ---------- UI ---------- */

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: UNDRAWABLE_BACKGROUND,
      }}
    >
      <Toolbar
        canvasRef={canvasRef}
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        zoom={zoom}
        brushSize={paintSize}
        isSpacePressed={isSpacePressed}
      />

      <RightPanel
        tool={currentTool}
        color={paintColor}
        onColorChange={setPaintColor}
        secondaryColor={secondaryColor}
        onSecondaryColorChange={setSecondaryColor}
        size={paintSize}
        onSizeChange={setPaintSize}
        opacity={paintOpacityPercent}
        onOpacityChange={setPaintOpacityPercent}
        hardness={hardness}
        onHardnessChange={setHardness}
        layers={layers}
        activeLayerId={activeLayerId}
        onSelectLayer={setActiveLayerId}
        onAddLayer={addLayer}
        onDuplicateLayer={duplicateLayer}
        onDeleteLayer={deleteLayer}
        onToggleLayer={(id) =>
          updateLayer(id, { visible: !layers.find((layer) => layer.id === id)?.visible })
        }
        onRenameLayer={(id, name) => updateLayer(id, { name })}
        onBlendChange={(id, blend: BlendMode) => updateLayer(id, { blend })}
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
