'use client';

import styles from '@/components/drawingToolbar/drawingToolbar.module.css';

import { Brush, Circle, Eraser, Hand, MousePointer2, Pencil, Square, Type } from 'lucide-react';

import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  currentTool?: string;
  onToolChange?: (tool: string) => void;
  zoom?: number;
  isSpacePressed?: boolean;
};

export default function DrawingToolbar({
  canvasRef,
  currentTool: currentToolProp,
  onToolChange,
  zoom = 1,
  isSpacePressed = false,
}: DrawingToolbarProps) {
  const [internalTool, setInternalTool] = useState('pen');
  const currentTool = currentToolProp ?? internalTool;

  const squareCursorRef = useRef<HTMLDivElement>(null);
  const circleCursorRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: -100, y: -100 });

  const changeTool = (newTool: string) => {
    if (onToolChange) {
      onToolChange(newTool);
    } else {
      setInternalTool(newTool);
    }
  };

  const updateSquareCursorSize = useCallback(() => {
    if (!squareCursorRef.current) return;
    const size = Math.max(1, zoom);
    squareCursorRef.current.style.width = `${size}px`;
    squareCursorRef.current.style.height = `${size}px`;
    squareCursorRef.current.style.left = `${lastMousePos.current.x - size / 2}px`;
    squareCursorRef.current.style.top = `${lastMousePos.current.y - size / 2}px`;
  }, [zoom]);

  const updateCircleCursorSize = useCallback(() => {
    if (!circleCursorRef.current) return;
    const size = Math.max(1, zoom);
    circleCursorRef.current.style.width = `${size}px`;
    circleCursorRef.current.style.height = `${size}px`;
    circleCursorRef.current.style.left = `${lastMousePos.current.x - size / 2}px`;
    circleCursorRef.current.style.top = `${lastMousePos.current.y - size / 2}px`;
  }, [zoom]);

  // ------------------------------------------
  // Change cursor when currentTool changes
  // ------------------------------------------

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    if (isSpacePressed) {
      if (squareCursorRef.current) {
        squareCursorRef.current.style.display = 'none';
      }
      if (circleCursorRef.current) {
        circleCursorRef.current.style.display = 'none';
      }
      document.body.style.cursor = 'grab';
      canvas.style.cursor = 'grab';
      return;
    }

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
        updateSquareCursorSize();
        squareCursorRef.current?.style.setProperty('display', 'block');
      }

      if (current.cursor === 'circleCursor') {
        updateCircleCursorSize();
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
  }, [currentTool, canvasRef, isSpacePressed, updateCircleCursorSize, updateSquareCursorSize]);

  // ------------------------------------------
  // Move custom cursor
  // ------------------------------------------

  useEffect(() => {
    if (isSpacePressed) return;

    const current = tools.find((tool) => tool.id === currentTool);

    if (!current || current.cursorType !== 'custom') {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      lastMousePos.current = { x: event.clientX, y: event.clientY };

      if (current.cursor === 'squareCursor' && squareCursorRef.current) {
        const size = Math.max(1, zoom);
        squareCursorRef.current.style.left = `${event.clientX - size / 2}px`;
        squareCursorRef.current.style.top = `${event.clientY - size / 2}px`;
      }

      if (current.cursor === 'circleCursor' && circleCursorRef.current) {
        const size = Math.max(1, zoom);
        circleCursorRef.current.style.left = `${event.clientX - size / 2}px`;
        circleCursorRef.current.style.top = `${event.clientY - size / 2}px`;
      }
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
        updateSquareCursorSize();
        squareCursorRef.current?.style.setProperty('display', 'block');
      }

      if (current.cursor === 'circleCursor') {
        updateCircleCursorSize();
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
  }, [currentTool, isSpacePressed, zoom, updateCircleCursorSize, updateSquareCursorSize]);

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
              lastMousePos.current = { x: event.clientX, y: event.clientY };
              const size = Math.max(1, zoom);
              squareCursorRef.current?.style.setProperty('left', `${event.clientX - size / 2}px`);
              squareCursorRef.current?.style.setProperty('top', `${event.clientY - size / 2}px`);
              circleCursorRef.current?.style.setProperty('left', `${event.clientX - size / 2}px`);
              circleCursorRef.current?.style.setProperty('top', `${event.clientY - size / 2}px`);
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
