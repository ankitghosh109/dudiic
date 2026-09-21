// @/app/live/[workspace]
'use client';

import Toolbar from '@/components/drawingToolbar/drawingToolbar';
import { useEffect, useLayoutEffect, useRef } from 'react';

export default function Workspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);

  const strokes = useRef<
    {
      points: { x: number; y: number }[];
      color: string;
      width: number;
    }[]
  >([]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;

      // Visible size in CSS pixels
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Actual drawing resolution
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      // Visible size
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Make drawing coordinates use CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const savedDrawing = localStorage.getItem('dudiic-drawing');

    if (!savedDrawing) return;

    try {
      const savedStrokes = JSON.parse(savedDrawing);

      if (!Array.isArray(savedStrokes)) return;

      // Restore strokes in memory
      strokes.current = savedStrokes;

      for (const stroke of savedStrokes) {
        const savedPoints = stroke.points;

        if (!savedPoints || savedPoints.length === 0) continue;

        ctx.beginPath();

        ctx.strokeStyle = stroke.color;

        ctx.lineWidth = stroke.width;

        ctx.lineCap = 'round';

        ctx.lineJoin = 'round';

        ctx.moveTo(savedPoints[0].x, savedPoints[0].y);

        for (let i = 1; i < savedPoints.length; i++) {
          const point = savedPoints[i];

          ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();
      }
    } catch (error) {
      console.error('Failed to restore drawing:', error);
    }
  }, []);

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    isDrawing.current = true;

    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    canvas.setPointerCapture(event.pointerId);

    ctx.beginPath();

    points.current = [{ x, y }];

    ctx.moveTo(x, y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log(x, y);

    ctx.lineTo(x, y);
    ctx.strokeStyle = 'black';

    ctx.lineWidth = 2;

    ctx.lineCap = 'round';

    ctx.lineJoin = 'round';

    points.current.push({ x, y });
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;

    const newStroke = {
      points: [...points.current],
      color: 'black',
      width: 2,
    };

    // Add new stroke to existing strokes
    strokes.current.push(newStroke);

    // Save all strokes
    localStorage.setItem('dudiic-drawing', JSON.stringify(strokes.current));

    // Clear current points
    points.current = [];
  };

  return (
    <>
      <Toolbar canvasRef={canvasRef} />
      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
      />
      ;
    </>
  );
}
