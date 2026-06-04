/**
 * 单条任务条 + 同一行分段（segments）渲染。
 * - 分段：每段独立定位/可拖拽/可拉伸，复用既有 .gantt-delfoi-segment 样式
 * - 单条：进度填充 + taskTemplate/文本标签
 */

import React from 'react';
import type { GanttGeometry } from './geometry';
import { barRect } from './geometry';
import type { RiverGanttTask, RiverGanttSegment, RiverTaskTemplate } from './types';

export type DragMode = 'move' | 'start' | 'end';

export interface BarPointerInfo {
  rowId: number | string;
  mode: DragMode;
  segmentIndex?: number;
}

interface GanttBarProps {
  geometry: GanttGeometry;
  task: RiverGanttTask;
  rowId: number | string;
  splitTasks: boolean;
  readonly: boolean;
  taskTemplate?: RiverTaskTemplate;
  selectedSet: Set<string>;
  onBarPointerDown: (e: React.PointerEvent, info: BarPointerInfo) => void;
}

function joinCss(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function BarLabel({ primary, code, text }: { primary?: string; code?: string; text?: string }) {
  if (!primary && !code) {
    const fallback = (text || '').split('\n');
    return (
      <div className="gantt-task-label">
        <div className="gantt-task-label-primary">{fallback[0] || ''}</div>
        {fallback[1] ? <div className="gantt-task-label-code">{fallback[1]}</div> : null}
      </div>
    );
  }
  return (
    <div className="gantt-task-label">
      <div className="gantt-task-label-primary" title={primary}>
        {primary}
      </div>
      {code && code !== primary ? (
        <div className="gantt-task-label-code" title={code}>
          {code}
        </div>
      ) : null}
    </div>
  );
}

function ResizeHandles({
  readonly,
  rowId,
  segmentIndex,
  onBarPointerDown,
}: {
  readonly: boolean;
  rowId: number | string;
  segmentIndex?: number;
  onBarPointerDown: GanttBarProps['onBarPointerDown'];
}) {
  if (readonly) return null;
  return (
    <>
      <div
        className="river-gantt-handle river-gantt-handle--start"
        onPointerDown={(e) => {
          e.stopPropagation();
          onBarPointerDown(e, { rowId, mode: 'start', segmentIndex });
        }}
      />
      <div
        className="river-gantt-handle river-gantt-handle--end"
        onPointerDown={(e) => {
          e.stopPropagation();
          onBarPointerDown(e, { rowId, mode: 'end', segmentIndex });
        }}
      />
    </>
  );
}

const GanttBar: React.FC<GanttBarProps> = ({
  geometry,
  task,
  rowId,
  splitTasks,
  readonly,
  taskTemplate,
  selectedSet,
  onBarPointerDown,
}) => {
  // 分段行
  if (splitTasks && task.segments && task.segments.length > 0) {
    return (
      <div className="gantt-station-segments">
        {task.segments.map((seg: RiverGanttSegment, index: number) => {
          const rect = barRect(geometry, seg.start, seg.end);
          const isSelected =
            seg.operation_id != null && selectedSet.has(`op-${seg.operation_id}`);
          const className = joinCss(
            'gantt-delfoi-segment',
            seg.css,
            seg.class,
            isSelected ? 'gantt-wo-flow-selected river-selected' : undefined
          );
          return (
            <div
              key={seg.operation_id != null ? `op-${seg.operation_id}` : `seg-${index}`}
              className={className}
              data-segment={index}
              style={{ left: rect.left, width: rect.width }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onBarPointerDown(e, { rowId, mode: 'move', segmentIndex: index });
              }}
            >
              <div className="gantt-delfoi-segment__content">
                <BarLabel
                  primary={seg.gantt_primary_label}
                  code={seg.gantt_work_order_code}
                  text={seg.text}
                />
              </div>
              <ResizeHandles
                readonly={readonly}
                rowId={rowId}
                segmentIndex={index}
                onBarPointerDown={onBarPointerDown}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // 占位/汇总行：不渲染时间条
  if (task.unscheduled || task.type === 'summary') {
    return null;
  }

  // 单条任务条
  const rect = barRect(geometry, task.start, task.end);
  const progress = Math.max(0, Math.min(100, Number(task.progress ?? 0)));
  const isSelected = selectedSet.has(String(task.id));
  const className = joinCss(
    'river-gantt-bar',
    task.css,
    task.class,
    isSelected ? 'gantt-wo-flow-selected river-selected' : undefined
  );

  return (
    <div
      className={className}
      style={{ left: rect.left, width: rect.width }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onBarPointerDown(e, { rowId, mode: 'move' });
      }}
    >
      {progress > 0 ? (
        <div className="river-gantt-bar__progress" style={{ width: `${progress}%` }} />
      ) : null}
      <div className="river-gantt-bar__content">
        {taskTemplate ? (
          taskTemplate({ data: task })
        ) : (
          <BarLabel primary={task.gantt_primary_label} code={task.gantt_work_order_code} text={task.text} />
        )}
      </div>
      <ResizeHandles readonly={readonly} rowId={rowId} onBarPointerDown={onBarPointerDown} />
    </div>
  );
};

export default GanttBar;
