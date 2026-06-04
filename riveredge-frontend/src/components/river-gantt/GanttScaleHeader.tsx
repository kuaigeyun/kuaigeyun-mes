/**
 * 时间刻度表头（多行）。水平滚动由父级与时间轴主体联动。
 */

import React from 'react';
import type { ScaleRow } from './timeScale';

interface GanttScaleHeaderProps {
  rows: ScaleRow[];
  rowHeight: number;
  totalWidth: number;
}

const GanttScaleHeader: React.FC<GanttScaleHeaderProps> = ({ rows, rowHeight, totalWidth }) => {
  return (
    <div className="river-gantt-scale" style={{ width: totalWidth }}>
      {rows.map((row, rowIndex) => (
        <div className="river-gantt-scale__row" key={`${row.unit}-${rowIndex}`} style={{ height: rowHeight }}>
          {row.cells.map((cell, cellIndex) => (
            <div
              className={`river-gantt-scale__cell${cell.css ? ` ${cell.css}` : ''}`}
              key={cellIndex}
              style={{ left: cell.left, width: cell.width }}
              title={cell.label}
            >
              {cell.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default GanttScaleHeader;
