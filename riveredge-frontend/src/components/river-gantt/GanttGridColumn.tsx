/**
 * 左侧网格列「行体」：每行单元格（支持自定义 cell 渲染与一层 summary 折叠）。
 * 纵向滚动由父级与时间轴主体联动（表头固定在左上角，不随之滚动）。
 */

import React from 'react';
import type { RiverGanttColumn, RiverGanttTask } from './types';

export interface GridRow {
  task: RiverGanttTask;
  depth: number;
  collapsible: boolean;
  collapsed: boolean;
}

interface GanttGridBodyProps {
  columns: RiverGanttColumn[];
  rows: GridRow[];
  rowHeight: number;
  onToggle: (id: number | string) => void;
}

const GanttGridBody: React.FC<GanttGridBodyProps> = ({ columns, rows, rowHeight, onToggle }) => {
  return (
    <div className="river-gantt-grid__body">
      {rows.map((gridRow) => (
        <div
          className="river-gantt-grid__row"
          key={String(gridRow.task.id)}
          style={{ height: rowHeight }}
          data-row-id={String(gridRow.task.id)}
        >
          {columns.map((col, colIndex) => (
            <div
              className={`river-gantt-grid__cell river-gantt-grid__cell--${col.align ?? 'left'}`}
              key={col.id}
              style={{ width: col.width }}
            >
              {colIndex === 0 && gridRow.depth > 0 ? (
                <span className="river-gantt-grid__indent" style={{ width: gridRow.depth * 12 }} />
              ) : null}
              {colIndex === 0 && gridRow.collapsible ? (
                <span
                  className={`river-gantt-grid__toggle${gridRow.collapsed ? ' is-collapsed' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(gridRow.task.id);
                  }}
                  role="button"
                  aria-label={gridRow.collapsed ? '展开' : '折叠'}
                >
                  {gridRow.collapsed ? '▸' : '▾'}
                </span>
              ) : null}
              {col.cell ? col.cell({ row: gridRow.task }) : <span>{gridRow.task.text}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default GanttGridBody;
