// @/app/live/[workspace]
'use client';

import Toolbar from '@/components/drawingToolbar/drawingToolbar';
import { useLayoutEffect, useRef } from 'react';

export default function Workspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  return (
    <>
      <Toolbar canvasRef={canvasRef} />
      <canvas ref={canvasRef} />;
    </>
  );
}
