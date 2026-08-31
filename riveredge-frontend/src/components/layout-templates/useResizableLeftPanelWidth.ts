import { useCallback, useEffect, useRef, useState } from 'react';
import { TWO_COLUMN_LAYOUT, twoColumnLeftPanelWidthStorageKey } from './constants';

export function parsePanelWidthPx(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) return fallback;
    const parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function resolvePercentPanelWidth(value: number | string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.endsWith('%')) return null;
  const parsed = parseFloat(trimmed.slice(0, -1));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return `${parsed}%`;
}

export function clampPanelWidth(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width));
}

export function readStoredPanelWidth(storageKey: string | undefined, fallback: number): number {
  if (!storageKey || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export interface UseResizableLeftPanelWidthOptions {
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  widthStorageKey?: string;
  layoutPersistenceId?: string;
  resizable?: boolean;
  collapsed?: boolean;
}

export function useResizableLeftPanelWidth({
  width = TWO_COLUMN_LAYOUT.LEFT_PANEL_WIDTH,
  minWidth = TWO_COLUMN_LAYOUT.LEFT_PANEL_MIN_WIDTH,
  maxWidth = TWO_COLUMN_LAYOUT.LEFT_PANEL_MAX_WIDTH,
  widthStorageKey: widthStorageKeyProp,
  layoutPersistenceId,
  resizable = true,
  collapsed = false,
}: UseResizableLeftPanelWidthOptions) {
  const percentWidth = resolvePercentPanelWidth(width);
  const usePercentWidth = percentWidth != null;
  const widthStorageKey =
    widthStorageKeyProp ??
    (layoutPersistenceId ? twoColumnLeftPanelWidthStorageKey(layoutPersistenceId) : undefined);

  const initialWidth = parsePanelWidthPx(width, TWO_COLUMN_LAYOUT.LEFT_PANEL_WIDTH);
  const minWidthPx = parsePanelWidthPx(minWidth, TWO_COLUMN_LAYOUT.LEFT_PANEL_MIN_WIDTH);
  const maxWidthPx = parsePanelWidthPx(maxWidth, TWO_COLUMN_LAYOUT.LEFT_PANEL_MAX_WIDTH);

  const [panelWidth, setPanelWidth] = useState(() =>
    clampPanelWidth(readStoredPanelWidth(widthStorageKey, initialWidth), minWidthPx, maxWidthPx),
  );
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  useEffect(() => {
    if (usePercentWidth) return;
    const next = clampPanelWidth(
      readStoredPanelWidth(widthStorageKey, parsePanelWidthPx(width, TWO_COLUMN_LAYOUT.LEFT_PANEL_WIDTH)),
      minWidthPx,
      maxWidthPx,
    );
    setPanelWidth(next);
  }, [width, minWidthPx, maxWidthPx, widthStorageKey, usePercentWidth]);

  const persistPanelWidth = useCallback(
    (nextWidth: number) => {
      if (!widthStorageKey || typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(widthStorageKey, String(nextWidth));
      } catch {
        /* ignore quota / private mode */
      }
    },
    [widthStorageKey],
  );

  const effectiveResizable = usePercentWidth ? false : resizable;

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (collapsed || !effectiveResizable || usePercentWidth) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = panelWidthRef.current;

      const handleMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = clampPanelWidth(startWidth + delta, minWidthPx, maxWidthPx);
        setPanelWidth(next);
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        persistPanelWidth(panelWidthRef.current);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [collapsed, effectiveResizable, maxWidthPx, minWidthPx, persistPanelWidth, usePercentWidth],
  );

  const resolvedWidth = collapsed ? 0 : usePercentWidth ? percentWidth : panelWidth;

  return {
    panelWidth,
    minWidthPx,
    maxWidthPx,
    usePercentWidth,
    percentWidth,
    resizable: effectiveResizable,
    handleResizeStart,
    resolvedWidth,
    widthStorageKey,
  };
}
