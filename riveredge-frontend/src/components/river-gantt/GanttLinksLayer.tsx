/**
 * 依赖连线层（SVG 贝塞尔）。端点几何由父级解析（支持顶层任务与按 operation_id 命中的分段）。
 */

import React from 'react';

export interface LinkPath {
  id: number | string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface GanttLinksLayerProps {
  paths: LinkPath[];
  width: number;
  height: number;
}

function bezier(p: LinkPath): string {
  const dx = Math.max(24, Math.abs(p.x2 - p.x1) / 2);
  return `M ${p.x1} ${p.y1} C ${p.x1 + dx} ${p.y1}, ${p.x2 - dx} ${p.y2}, ${p.x2} ${p.y2}`;
}

const GanttLinksLayer: React.FC<GanttLinksLayerProps> = ({ paths, width, height }) => {
  if (paths.length === 0) return null;
  return (
    <svg className="river-gantt-links" width={width} height={height}>
      {paths.map((p) => (
        <path key={p.id} className="river-gantt-link-line" d={bezier(p)} />
      ))}
    </svg>
  );
};

export default GanttLinksLayer;
