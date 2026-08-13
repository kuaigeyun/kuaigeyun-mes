/**
 * CAD 2D SVG / 缩略图预览（平移 / 缩放）
 *
 * SVG 铺满容器，由 viewBox 映射图纸坐标；禁止把 viewBox 当 CSS 像素再 scale，
 * 否则 libredwg 的百分线宽/用户单位线宽会变成实心图框。
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { parseSvgViewBox } from '../../utils/previewMarkupTypes';
import { mountCadPreviewSvg } from '../../utils/cad2dPreviewSvg';
import { usePreviewMarkup } from '../preview-markup/PreviewMarkupContext';
import { PreviewMarkupLayer } from '../preview-markup/PreviewMarkupLayer';
import './cad2dPreview.css';

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
const IMAGE_FIT_PADDING = 24;

export const DwgSvgViewer = forwardRef<DwgSvgViewerRef, DwgSvgViewerProps>(function DwgSvgViewer(
  { svg, imageDataUrl, height = '100%' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const markup = usePreviewMarkup();
  const panMode = !markup || markup.tool === 'pan';
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [imageNatural, setImageNatural] = useState({ width: 0, height: 0 });

  const fitImageToView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    if (cRect.width <= 0 || cRect.height <= 0) return;
    if (!imageNatural.width || !imageNatural.height) return;

    const sx = (cRect.width - IMAGE_FIT_PADDING * 2) / imageNatural.width;
    const sy = (cRect.height - IMAGE_FIT_PADDING * 2) / imageNatural.height;
    const nextScale = Math.min(sx, sy, MAX_SCALE);
    setScale(nextScale);
    setOffset({
      x: (cRect.width - imageNatural.width * nextScale) / 2,
      y: (cRect.height - imageNatural.height * nextScale) / 2,
    });
  }, [imageNatural.height, imageNatural.width]);

  const fitToView = useCallback(() => {
    if (imageDataUrl) {
      fitImageToView();
      return;
    }
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [fitImageToView, imageDataUrl]);

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

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const r = container.getBoundingClientRect();
      setViewport({ width: r.width, height: r.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [svg, imageDataUrl]);

  useLayoutEffect(() => {
    if (imageDataUrl) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [svg, imageDataUrl]);

  useLayoutEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    if (!svg || imageDataUrl) {
      host.replaceChildren();
      return;
    }
    mountCadPreviewSvg(host, svg);
    return () => {
      host.replaceChildren();
    };
  }, [svg, imageDataUrl]);

  useLayoutEffect(() => {
    if (!imageDataUrl) return;
    fitImageToView();
  }, [fitImageToView, imageDataUrl, viewport.height, viewport.width]);

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

  useEffect(() => {
    if (!svg || imageDataUrl) return;
    const parsed = parseSvgViewBox(svg);
    markup?.setViewBox(parsed?.viewBox ?? null);
  }, [svg, imageDataUrl, markup]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!panMode) return;
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!panMode || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const parsedSvg = svg && !imageDataUrl ? parseSvgViewBox(svg) : null;

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
        cursor: panMode ? (dragging ? 'grabbing' : 'grab') : 'default',
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
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: imageDataUrl ? undefined : '100%',
          height: imageDataUrl ? undefined : '100%',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {imageDataUrl ? (
          <img
            src={imageDataUrl}
            alt="cad preview"
            draggable={false}
            onLoad={(e) => {
              setImageNatural({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              });
            }}
            style={{ display: 'block', maxWidth: 'none' }}
          />
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={svgHostRef} className="cad2d-svg-host" />
            {parsedSvg && viewport.width > 0 && viewport.height > 0 ? (
              <PreviewMarkupLayer
                viewBox={parsedSvg.viewBox}
                width={viewport.width}
                height={viewport.height}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});
