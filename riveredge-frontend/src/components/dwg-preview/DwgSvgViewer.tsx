/**
 * CAD 2D SVG / 缩略图预览（平移 / 缩放）
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { normalizeCadSvg } from '../../utils/cad2dFileLoader';

export type DwgSvgViewerRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
};

export interface DwgSvgViewerProps {
  svg?: string;
  imageDataUrl?: string;
  height?: number | string;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 40;
const ZOOM_FACTOR = 1.2;

function getSvgIntrinsicSize(svg: string): { width: number; height: number } | null {
  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const widthMatch = svg.match(/\bwidth=["']([\d.]+)/i);
  const heightMatch = svg.match(/\bheight=["']([\d.]+)/i);
  if (widthMatch && heightMatch) {
    const width = Number(widthMatch[1]);
    const height = Number(heightMatch[1]);
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

export const DwgSvgViewer = forwardRef<DwgSvgViewerRef, DwgSvgViewerProps>(function DwgSvgViewer(
  { svg, imageDataUrl, height = '100%' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const fitToView = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const cRect = container.getBoundingClientRect();
    if (cRect.width <= 0 || cRect.height <= 0) return;

    const contentRect = content.getBoundingClientRect();
    const contentWidth = content.scrollWidth || contentRect.width;
    const contentHeight = content.scrollHeight || contentRect.height;
    if (!contentWidth || !contentHeight) return;

    const padding = 24;
    const sx = (cRect.width - padding * 2) / contentWidth;
    const sy = (cRect.height - padding * 2) / contentHeight;
    const nextScale = Math.min(sx, sy, MAX_SCALE);
    setScale(nextScale);
    setOffset({
      x: (cRect.width - contentWidth * nextScale) / 2,
      y: (cRect.height - contentHeight * nextScale) / 2,
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
      setOffset((o) => ({
        x: mx - ((mx - o.x) * next) / prev,
        y: my - ((my - o.y) * next) / prev,
      }));
      return next;
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomBy(ZOOM_FACTOR),
      zoomOut: () => zoomBy(1 / ZOOM_FACTOR),
      fitToView,
    }),
    [fitToView, zoomBy],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const runFit = () => {
      requestAnimationFrame(() => {
        fitToView();
      });
    };

    runFit();
    const observer = new ResizeObserver(runFit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [svg, imageDataUrl, fitToView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        setOffset((o) => ({
          x: mx - ((mx - o.x) * next) / prev,
          y: my - ((my - o.y) * next) / prev,
        }));
        return next;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const normalizedSvg = svg ? normalizeCadSvg(svg) : '';
  const svgSize = normalizedSvg ? getSvgIntrinsicSize(normalizedSvg) : null;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height,
        minHeight: 280,
        overflow: 'hidden',
        background: '#fffef5',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        position: 'relative',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={fitToView}
    >
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {imageDataUrl ? (
          <img
            src={imageDataUrl}
            alt="cad preview"
            draggable={false}
            style={{ display: 'block', maxWidth: 'none' }}
          />
        ) : (
          <div
            className="cad2d-svg-host"
            style={{
              display: 'block',
              lineHeight: 0,
              width: svgSize?.width,
              height: svgSize?.height,
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: normalizedSvg }}
          />
        )}
      </div>
    </div>
  );
});
