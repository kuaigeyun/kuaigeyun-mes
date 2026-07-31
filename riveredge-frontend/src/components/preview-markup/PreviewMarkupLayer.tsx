/**
 * SVG 批注绘图层（与底图同 transform，坐标系为 viewBox）
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  createMarkupShapeId,
  type PreviewMarkupArrowShape,
  type PreviewMarkupRectShape,
  type PreviewMarkupShape,
} from '../../utils/previewMarkupTypes';
import { usePreviewMarkup } from './PreviewMarkupContext';

const MARKUP_STROKE = '#e53935';
const MARKUP_STROKE_WIDTH = 2;

type DraftRect = PreviewMarkupRectShape;
type DraftArrow = PreviewMarkupArrowShape;

function normalizeRect(x1: number, y1: number, x2: number, y2: number): DraftRect {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return {
    id: 'draft',
    type: 'rect',
    x,
    y,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    stroke: MARKUP_STROKE,
    strokeWidth: MARKUP_STROKE_WIDTH,
  };
}

function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

function renderShape(shape: PreviewMarkupShape) {
  if (shape.type === 'rect' && shape.width > 0 && shape.height > 0) {
    return (
      <rect
        key={shape.id}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        fill="none"
        stroke={shape.stroke ?? MARKUP_STROKE}
        strokeWidth={shape.strokeWidth ?? MARKUP_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (shape.type === 'arrow') {
    return (
      <line
        key={shape.id}
        x1={shape.x1}
        y1={shape.y1}
        x2={shape.x2}
        y2={shape.y2}
        stroke={shape.stroke ?? MARKUP_STROKE}
        strokeWidth={shape.strokeWidth ?? MARKUP_STROKE_WIDTH}
        markerEnd="url(#preview-markup-arrowhead)"
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (shape.type === 'text') {
    return (
      <text
        key={shape.id}
        x={shape.x}
        y={shape.y}
        fill={shape.fill ?? MARKUP_STROKE}
        fontSize={shape.fontSize ?? 14}
        fontFamily="sans-serif"
        dominantBaseline="hanging"
      >
        {shape.text}
      </text>
    );
  }
  return null;
}

export interface PreviewMarkupLayerProps {
  viewBox: string;
  width: number;
  height: number;
}

export const PreviewMarkupLayer: React.FC<PreviewMarkupLayerProps> = ({ viewBox, width, height }) => {
  const markup = usePreviewMarkup();
  const svgRef = useRef<SVGSVGElement>(null);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [draftArrow, setDraftArrow] = useState<DraftArrow | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const tool = markup?.tool ?? 'pan';
  const active = markup?.enabled && tool !== 'pan';

  const resetDraft = useCallback(() => {
    dragStartRef.current = null;
    setDraftRect(null);
    setDraftArrow(null);
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!markup || !active || !svgRef.current) return;
    e.stopPropagation();
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    const point = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    dragStartRef.current = point;

    if (tool === 'text') {
      markup.beginTextAt(point);
      resetDraft();
      return;
    }

    if (tool === 'rect') {
      setDraftRect({
        id: 'draft',
        type: 'rect',
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        stroke: MARKUP_STROKE,
        strokeWidth: MARKUP_STROKE_WIDTH,
      });
    }
    if (tool === 'arrow') {
      setDraftArrow({
        id: 'draft',
        type: 'arrow',
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        stroke: MARKUP_STROKE,
        strokeWidth: MARKUP_STROKE_WIDTH,
      });
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!markup || !active || !svgRef.current || !dragStartRef.current) return;
    if (tool === 'text') return;
    e.stopPropagation();
    const point = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    const start = dragStartRef.current;

    if (tool === 'rect') {
      setDraftRect(normalizeRect(start.x, start.y, point.x, point.y));
    }
    if (tool === 'arrow') {
      setDraftArrow({
        id: 'draft',
        type: 'arrow',
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: point.y,
        stroke: MARKUP_STROKE,
        strokeWidth: MARKUP_STROKE_WIDTH,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!markup || !active) return;
    e.stopPropagation();
    if (tool === 'text') return;

    if (tool === 'rect' && draftRect && draftRect.width > 1 && draftRect.height > 1) {
      markup.addShape({ ...draftRect, id: createMarkupShapeId() });
      markup.setTool('pan');
    }
    if (tool === 'arrow' && draftArrow) {
      const dx = draftArrow.x2 - draftArrow.x1;
      const dy = draftArrow.y2 - draftArrow.y1;
      if (Math.hypot(dx, dy) > 2) {
        markup.addShape({ ...draftArrow, id: createMarkupShapeId() });
      }
      markup.setTool('pan');
    }
    resetDraft();
  };

  if (!markup?.enabled) return null;

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'crosshair' : 'default',
        zIndex: 2,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <marker
          id="preview-markup-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8 z" fill={MARKUP_STROKE} />
        </marker>
      </defs>
      {markup.shapes.map((shape) => renderShape(shape))}
      {draftRect ? renderShape(draftRect) : null}
      {draftArrow ? renderShape(draftArrow) : null}
    </svg>
  );
};
