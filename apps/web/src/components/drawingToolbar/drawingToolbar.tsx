'use client';

import styles from '@/components/drawingToolbar/drawingToolbar.module.css';

import { Brush, Circle, Eraser, Hand, MousePointer2, Pencil, Square, Type } from 'lucide-react';

import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const tools = [
  {
    id: 'select',
    icon: MousePointer2,
    label: 'Select',
    cursor: 'arrowCursor',
    cursorType: 'native',
  },

  {
    id: 'pen',
    icon: Pencil,
    label: 'Pen',
    cursor: 'squareCursor',
    cursorType: 'custom',
  },

  {
    id: 'brush',
    icon: Brush,
    label: 'Brush',
    cursor: 'circleCursor',
    cursorType: 'custom',
  },

  {
    id: 'square',
    icon: Square,
    label: 'Square',
    cursor: 'arrowCursor',
    cursorType: 'native',
  },

  {
    id: 'circle',
    icon: Circle,
    label: 'Circle',
    cursor: 'arrowCursor',
    cursorType: 'native',
  },

  {
    id: 'eraser',
    icon: Eraser,
    label: 'Eraser',
    cursor: 'circleCursor',
    cursorType: 'custom',
  },

  {
    id: 'text',
    icon: Type,
    label: 'Text',
    cursor: 'textCursor',
    cursorType: 'native',
  },

  {
    id: 'hand',
    icon: Hand,
    label: 'Pan',
    cursor: 'grabCursor',
    cursorType: 'native',
  },
];

const nativeCursors = {
  arrowCursor: 'auto',
  grabCursor: 'grab',
  textCursor: 'text',
} as const;

type DrawingToolbarProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export default function DrawingToolbar({ canvasRef }: DrawingToolbarProps) {
  const [currentTool, setCurrentTool] = useState('select');

  const squareCursorRef = useRef<HTMLDivElement>(null);
  const circleCursorRef = useRef<HTMLDivElement>(null);

  const changeTool = (newTool: string) => {
    setCurrentTool(newTool);
  };

  // ------------------------------------------
  // Change cursor when currentTool changes
  // ------------------------------------------

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const current = tools.find((tool) => tool.id === currentTool);

    if (!current) return;

    // Hide all custom cursors first
    if (squareCursorRef.current) {
      squareCursorRef.current.style.display = 'none';
    }

    if (circleCursorRef.current) {
      circleCursorRef.current.style.display = 'none';
    }

    // -----------------------------
    // Custom cursor
    // -----------------------------

    if (current.cursorType === 'custom') {
      document.body.style.cursor = 'none';
      canvas.style.cursor = 'none';

      if (current.cursor === 'squareCursor') {
        squareCursorRef.current?.style.setProperty('display', 'block');
      }

      if (current.cursor === 'circleCursor') {
        circleCursorRef.current?.style.setProperty('display', 'block');
      }

      return;
    }

    // -----------------------------
    // Native cursor
    // -----------------------------

    const nativeCursor = nativeCursors[current.cursor as keyof typeof nativeCursors];
    if (!nativeCursor) return;

    document.body.style.cursor = nativeCursor;
    canvas.style.cursor = nativeCursor;
  }, [currentTool, canvasRef]);

  // ------------------------------------------
  // Move custom cursor
  // ------------------------------------------

  useEffect(() => {
    const current = tools.find((tool) => tool.id === currentTool);

    if (!current || current.cursorType !== 'custom') {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      let cursor: HTMLDivElement | null = null;

      if (current.cursor === 'squareCursor') {
        cursor = squareCursorRef.current;
      }

      if (current.cursor === 'circleCursor') {
        cursor = circleCursorRef.current;
      }

      if (!cursor) return;

      cursor.style.left = `${event.clientX - 5}px`;
      cursor.style.top = `${event.clientY - 5}px`;
    };

    const handlePointerLeave = () => {
      if (squareCursorRef.current) {
        squareCursorRef.current.style.display = 'none';
      }

      if (circleCursorRef.current) {
        circleCursorRef.current.style.display = 'none';
      }
    };

    const handlePointerEnter = () => {
      if (current.cursor === 'squareCursor') {
        squareCursorRef.current?.style.setProperty('display', 'block');
      }

      if (current.cursor === 'circleCursor') {
        circleCursorRef.current?.style.setProperty('display', 'block');
      }
    };

    window.addEventListener('pointermove', handlePointerMove);

    document.documentElement.addEventListener('pointerleave', handlePointerLeave);

    document.documentElement.addEventListener('pointerenter', handlePointerEnter);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);

      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);

      document.documentElement.removeEventListener('pointerenter', handlePointerEnter);
    };
  }, [currentTool]);

  // ------------------------------------------
  // Cleanup
  // ------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      document.body.style.cursor = 'auto';

      if (canvas) {
        canvas.style.cursor = 'auto';
      }
    };
  }, [canvasRef]);

  return (
    <>
      {/* Custom cursors */}

      <div ref={squareCursorRef} className={styles.squareCursor} />

      <div ref={circleCursorRef} className={styles.circleCursor} />

      {/* Toolbar */}

      <div className={styles.toolbar}>
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`${styles.tool} ${currentTool === id ? styles.active : ''}`}
            type="button"
            aria-label={label}
            title={label}
            onPointerDown={(event) => {
              squareCursorRef.current?.style.setProperty('left', `${event.clientX}px`);
              squareCursorRef.current?.style.setProperty('top', `${event.clientY}px`);
              circleCursorRef.current?.style.setProperty('left', `${event.clientX}px`);
              circleCursorRef.current?.style.setProperty('top', `${event.clientY}px`);
              changeTool(id);
            }}
          >
            <Icon size={16} strokeWidth={1.6} />
          </button>
        ))}
      </div>
    </>
  );
}
