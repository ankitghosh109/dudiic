'use client';

// @/components/rightPanel/RightPanel.tsx
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './RightPanel.module.css';

/* ---------- TYPES ---------- */

export type BlendMode = 'Normal' | 'Multiply' | 'Screen' | 'Overlay' | 'Darken' | 'Lighten';
export const BLEND_MODES: BlendMode[] = [
  'Normal',
  'Multiply',
  'Screen',
  'Overlay',
  'Darken',
  'Lighten',
];

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  blend: BlendMode;
  thumbnail?: string; // optional data URL
};

export type RightPanelProps = {
  tool: string;

  color: string;
  onColorChange: (hex: string) => void;
  secondaryColor: string;
  onSecondaryColorChange: (hex: string) => void;

  size: number;
  onSizeChange: (v: number) => void;
  opacity: number; // 0-100
  onOpacityChange: (v: number) => void;
  hardness: number; // 0-100
  onHardnessChange: (v: number) => void;

  layers: Layer[]; // top layer first
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onToggleLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onBlendChange: (id: string, blend: BlendMode) => void;
};

type Prop = 'size' | 'opacity' | 'hardness';

// Which properties each tool exposes. Unlisted tools show every property.
const TOOL_PROPS: Record<string, Prop[]> = {
  pen: ['size', 'opacity'],
  brush: ['size', 'opacity', 'hardness'],
  eraser: ['size', 'opacity', 'hardness'],
  rectangle: ['size', 'opacity'],
  oval: ['size', 'opacity'],
  text: ['size', 'opacity'],
  hand: [],
};

/* ---------- COLOR HELPERS ---------- */

type HSV = { h: number; s: number; v: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/* ---------- ICONS ---------- */

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ChevronIcon = () => (
  <Icon>
    <polyline points="6 15 12 9 18 15" />
  </Icon>
);
const SwapIcon = () => (
  <Icon>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Icon>
);
const PlusIcon = () => (
  <Icon>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
);
const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);
const TrashIcon = () => (
  <Icon>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Icon>
);
const EyeIcon = ({ off }: { off?: boolean }) => (
  <Icon>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="3" y1="3" x2="21" y2="21" />}
  </Icon>
);
const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);

/* ---------- SECTION ---------- */

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <div className={styles.sectionActions}>
          {actions}
          <button
            type="button"
            className={`${styles.iconButton} ${open ? '' : styles.chevronClosed}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            aria-expanded={open}
          >
            <ChevronIcon />
          </button>
        </div>
      </header>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

/* ---------- COLOR PICKER ---------- */

const WHEEL = 200;
const RING_MID = 90;
const RING_INNER = 80;
const SV_SIZE = 100;

/*
 * Dragging is fully imperative: while the pointer is down we write straight to the DOM
 * (handle transforms, square color, hex text, swatch) once per animation frame and do NOT
 * touch React state at all, so nothing re-renders. React (and the app) only hear about the
 * final color once, when the pointer is released.
 */
function ColorPicker({
  value,
  onChange,
  onPreview,
}: {
  value: string;
  onChange: (hex: string) => void;
  onPreview?: (hex: string) => void;
}) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [emitted, setEmitted] = useState(value.toLowerCase()); // last color we sent to the app
  const [prevValue, setPrevValue] = useState(value);

  // Only re-sync from the outside when the color really changed from outside
  // (swap button, switching swatch...). Our own updates echo back and are ignored.
  // Adjusting state while rendering (instead of in an effect) avoids cascading renders.
  if (value !== prevValue) {
    setPrevValue(value);
    const incoming = value.toLowerCase();
    if (incoming !== emitted && hsvToHex(hsv).toLowerCase() !== incoming) {
      setHsv(hexToHsv(value));
      setEmitted(incoming);
    }
  }

  const ringRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const ringHandleRef = useRef<HTMLSpanElement>(null);
  const svHandleRef = useRef<HTMLSpanElement>(null);
  const hexRef = useRef<HTMLInputElement>(null);

  const latest = useRef<HSV>(hsv); // the color being dragged (source of truth during a drag)
  const drag = useRef<'ring' | 'sv' | null>(null);
  const ringRect = useRef<DOMRect | null>(null); // measured once per drag, not per move
  const svRect = useRef<DOMRect | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const emit = (c: HSV) => {
    const hex = hsvToHex(c);
    setEmitted(hex.toLowerCase());
    onChange(hex);
  };

  // Writes the color to the DOM directly (no React render).
  const paint = (c: HSV) => {
    const rad = (c.h * Math.PI) / 180;
    const hx = WHEEL / 2 + RING_MID * Math.sin(rad);
    const hy = WHEEL / 2 - RING_MID * Math.cos(rad);
    const pure = hsvToHex({ h: c.h, s: 1, v: 1 });
    const hex = hsvToHex(c);

    const rh = ringHandleRef.current;
    if (rh) {
      rh.style.transform = `translate(${hx}px, ${hy}px) translate(-50%, -50%)`;
      rh.style.background = pure;
    }
    if (svRef.current) svRef.current.style.backgroundColor = pure;
    const sh = svHandleRef.current;
    if (sh) {
      sh.style.transform = `translate(${c.s * SV_SIZE}px, ${(1 - c.v) * SV_SIZE}px) translate(-50%, -50%)`;
      sh.style.background = hex;
    }
    if (hexRef.current && document.activeElement !== hexRef.current)
      hexRef.current.value = hex.toUpperCase();
    onPreview?.(hex);
  };

  const fromPointer = (): HSV => {
    const base = latest.current;
    const { x, y } = pointer.current;

    if (drag.current === 'ring' && ringRect.current) {
      const r = ringRect.current;
      let deg =
        (Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2))) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      return { ...base, h: Math.min(deg, 359.999) };
    }
    if (drag.current === 'sv' && svRect.current) {
      const r = svRect.current;
      return {
        ...base,
        s: clamp((x - r.left) / r.width, 0, 1),
        v: 1 - clamp((y - r.top) / r.height, 0, 1),
      };
    }
    return base;
  };

  const update = () => {
    frame.current = null;
    const c = fromPointer();
    latest.current = c;
    paint(c);
  };

  // Coalesce pointer events: at most one DOM update per animation frame.
  const queue = (e: React.PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
    if (frame.current === null) frame.current = requestAnimationFrame(update);
  };

  const begin = (e: React.PointerEvent<HTMLDivElement>, kind: 'ring' | 'sv') => {
    latest.current = hsv;
    drag.current = kind;
    pointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    update();
  };

  const endDrag = () => {
    if (!drag.current) return;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      update(); // apply the very last pointer position
    }
    drag.current = null;
    const c = latest.current;
    setHsv(c); // sync React with what is on screen
    emit(c); // tell the app once
  };

  const onRingDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (dist < RING_INNER - 2) return; // clicked in the hole
    ringRect.current = r;
    begin(e, 'ring');
  };

  const onSvDown = (e: React.PointerEvent<HTMLDivElement>) => {
    svRect.current = e.currentTarget.getBoundingClientRect();
    begin(e, 'sv');
  };

  const hueRad = (hsv.h * Math.PI) / 180;
  const hueX = WHEEL / 2 + RING_MID * Math.sin(hueRad);
  const hueY = WHEEL / 2 - RING_MID * Math.cos(hueRad);
  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);

  const commitHex = (text: string) => {
    setHexDraft(text);
    const rgb = hexToRgb(text);
    if (rgb && text.replace('#', '').length >= 6) {
      const c = hexToHsv(text);
      latest.current = c;
      setHsv(c);
      onPreview?.(hsvToHex(c));
      emit(c);
    }
  };

  return (
    <div className={styles.picker}>
      <div className={styles.hexRow}>
        <input
          ref={hexRef}
          className={styles.hexInput}
          value={hexDraft ?? current.toUpperCase()}
          onChange={(e) => commitHex(e.target.value)}
          onBlur={() => setHexDraft(null)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          spellCheck={false}
          maxLength={7}
          aria-label="Hex color"
        />
      </div>

      <div className={styles.wheel} style={{ width: WHEEL, height: WHEEL }}>
        <div
          ref={ringRef}
          className={styles.ring}
          style={{ transform: 'translateZ(0)' }}
          onPointerDown={onRingDown}
          onPointerMove={(e) => drag.current === 'ring' && queue(e)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        {/* Handles move with transform (GPU) instead of left/top (layout). */}
        <span
          ref={ringHandleRef}
          className={styles.ringHandle}
          style={{
            left: 0,
            top: 0,
            transform: `translate(${hueX}px, ${hueY}px) translate(-50%, -50%)`,
            background: pureHue,
            willChange: 'transform',
          }}
        />

        <div
          ref={svRef}
          className={styles.sv}
          style={{ width: SV_SIZE, height: SV_SIZE, backgroundColor: pureHue }}
          onPointerDown={onSvDown}
          onPointerMove={(e) => drag.current === 'sv' && queue(e)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span
            ref={svHandleRef}
            className={styles.svHandle}
            style={{
              left: 0,
              top: 0,
              transform: `translate(${hsv.s * SV_SIZE}px, ${(1 - hsv.v) * SV_SIZE}px) translate(-50%, -50%)`,
              background: current,
              willChange: 'transform',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- SLIDER ROW ---------- */

function NumberField({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const finish = () => {
    if (draft !== null) {
      const n = parseFloat(draft);
      if (!Number.isNaN(n)) onChange(clamp(Math.round(n), min, max));
    }
    setDraft(null);
  };

  return (
    <input
      className={styles.numberField}
      value={draft ?? `${Math.round(value)} ${suffix}`}
      onFocus={(e) => {
        setDraft(String(Math.round(value)));
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
      onBlur={finish}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      inputMode="numeric"
    />
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  const pct = ((clamp(value, min, max) - min) / (max - min)) * 100;
  return (
    <div className={styles.sliderRow}>
      <label className={styles.sliderLabel}>{label}</label>
      <input
        type="range"
        className={styles.range}
        min={min}
        max={max}
        value={value}
        style={{ ['--fill' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <NumberField value={value} min={min} max={max} suffix={suffix} onChange={onChange} />
    </div>
  );
}

/* ---------- LAYER ROW ---------- */

function LayerRow({
  layer,
  active,
  menuOpen,
  onSelect,
  onToggle,
  onMenu,
  onRename,
  onBlend,
  onDuplicate,
  onDelete,
}: {
  layer: Layer;
  active: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onMenu: () => void;
  onRename: (name: string) => void;
  onBlend: (b: BlendMode) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const finishRename = (value: string) => {
    setEditing(false);
    const name = value.trim();
    if (name && name !== layer.name) onRename(name);
  };

  return (
    <div
      className={`${styles.layer} ${active ? styles.layerActive : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <button
        type="button"
        className={`${styles.eye} ${layer.visible ? '' : styles.eyeOff}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
      >
        <EyeIcon off={!layer.visible} />
      </button>

      <div className={styles.thumb}>
        {layer.thumbnail && (
          <div className={styles.thumbImg} style={{ backgroundImage: `url(${layer.thumbnail})` }} />
        )}
      </div>

      <div className={styles.layerInfo} onDoubleClick={() => setEditing(true)}>
        {editing ? (
          <input
            className={styles.renameInput}
            defaultValue={layer.name}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => finishRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishRename((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span className={styles.layerName}>{layer.name}</span>
        )}
        <span className={styles.layerBlend}>{layer.blend}</span>
      </div>

      <div className={styles.menuWrap} data-layer-menu>
        <button
          type="button"
          className={styles.iconButton}
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          aria-label="Layer options"
        >
          <DotsIcon />
        </button>

        {menuOpen && (
          <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.menuItem} onClick={() => setEditing(true)}>
              Rename
            </button>
            <button type="button" className={styles.menuItem} onClick={onDuplicate}>
              Duplicate
            </button>
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuDanger}`}
              onClick={onDelete}
            >
              Delete
            </button>
            <div className={styles.menuLabel}>Blend mode</div>
            {BLEND_MODES.map((b) => (
              <button
                key={b}
                type="button"
                className={`${styles.menuItem} ${b === layer.blend ? styles.menuItemOn : ''}`}
                onClick={() => onBlend(b)}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- PANEL ---------- */

export default function RightPanel(props: RightPanelProps) {
  const {
    tool,
    color,
    onColorChange,
    secondaryColor,
    onSecondaryColorChange,
    size,
    onSizeChange,
    opacity,
    onOpacityChange,
    hardness,
    onHardnessChange,
    layers,
    activeLayerId,
    onSelectLayer,
    onAddLayer,
    onDuplicateLayer,
    onDeleteLayer,
    onToggleLayer,
    onRenameLayer,
    onBlendChange,
  } = props;

  const [target, setTarget] = useState<'primary' | 'secondary'>('primary');
  const [menuId, setMenuId] = useState<string | null>(null);
  const primarySwatch = useRef<HTMLButtonElement>(null);
  const secondarySwatch = useRef<HTMLButtonElement>(null);

  // Close the layer menu when clicking anywhere else.
  useEffect(() => {
    if (!menuId) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-layer-menu]')) setMenuId(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuId]);

  const visibleProps = TOOL_PROPS[tool] ?? ['size', 'opacity', 'hardness'];
  const editing = target === 'primary' ? color : secondaryColor;
  const setEditing = target === 'primary' ? onColorChange : onSecondaryColorChange;

  // Live swatch color while dragging the wheel (direct DOM write, no re-render).
  const previewColor = (hex: string) => {
    const el = target === 'primary' ? primarySwatch.current : secondarySwatch.current;
    if (el) el.style.background = hex;
  };

  const swap = () => {
    onColorChange(secondaryColor);
    onSecondaryColorChange(color);
  };

  return (
    <aside className={styles.panel} onPointerDown={(e) => e.stopPropagation()}>
      {/* COLOR */}
      <Section title="Color">
        <div className={styles.swatches}>
          <button
            ref={primarySwatch}
            type="button"
            className={`${styles.swatch} ${styles.swatchPrimary} ${target === 'primary' ? styles.swatchOn : ''}`}
            style={{ background: color }}
            onClick={() => setTarget('primary')}
            aria-label="Primary color"
          />
          <button
            ref={secondarySwatch}
            type="button"
            className={`${styles.swatch} ${styles.swatchSecondary} ${target === 'secondary' ? styles.swatchOn : ''}`}
            style={{ background: secondaryColor }}
            onClick={() => setTarget('secondary')}
            aria-label="Secondary color"
          />
          <button type="button" className={styles.swap} onClick={swap} aria-label="Swap colors">
            <SwapIcon />
          </button>
        </div>
        <ColorPicker value={editing} onChange={setEditing} onPreview={previewColor} />
      </Section>

      {/* TOOL PROPERTIES */}
      <Section title="Tool Properties">
        {visibleProps.length === 0 && (
          <p className={styles.empty}>This tool has no adjustable properties.</p>
        )}
        {visibleProps.includes('size') && (
          <SliderRow
            label="Size"
            value={size}
            min={1}
            max={200}
            suffix="px"
            onChange={onSizeChange}
          />
        )}
        {visibleProps.includes('opacity') && (
          <SliderRow
            label="Opacity"
            value={opacity}
            min={0}
            max={100}
            suffix="%"
            onChange={onOpacityChange}
          />
        )}
        {visibleProps.includes('hardness') && (
          <SliderRow
            label="Hardness"
            value={hardness}
            min={0}
            max={100}
            suffix="%"
            onChange={onHardnessChange}
          />
        )}
      </Section>

      {/* LAYERS */}
      <Section
        title="Layers"
        actions={
          <>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onAddLayer}
              aria-label="Add layer"
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => onDuplicateLayer(activeLayerId)}
              aria-label="Duplicate layer"
            >
              <CopyIcon />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => onDeleteLayer(activeLayerId)}
              disabled={layers.length <= 1}
              aria-label="Delete layer"
            >
              <TrashIcon />
            </button>
          </>
        }
      >
        <div className={styles.layerList}>
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              active={layer.id === activeLayerId}
              menuOpen={menuId === layer.id}
              onSelect={() => onSelectLayer(layer.id)}
              onToggle={() => onToggleLayer(layer.id)}
              onMenu={() => setMenuId((m) => (m === layer.id ? null : layer.id))}
              onRename={(name) => {
                onRenameLayer(layer.id, name);
                setMenuId(null);
              }}
              onBlend={(b) => {
                onBlendChange(layer.id, b);
                setMenuId(null);
              }}
              onDuplicate={() => {
                onDuplicateLayer(layer.id);
                setMenuId(null);
              }}
              onDelete={() => {
                if (layers.length > 1) onDeleteLayer(layer.id);
                setMenuId(null);
              }}
            />
          ))}
        </div>
      </Section>
    </aside>
  );
}
