/**
 * RiverGantt：自建、可控的甘特图引擎。
 *
 * 四象限布局：左上网格表头 / 右上时间刻度 / 左下网格列 / 右下时间轴主体。
 * 原生支持：同一行分段(segments)、横向拖拽/拉伸(含按段)、分段竖直拖到另一行改派(move-task)、
 * 选中/冲突高亮、依赖连线(解析分段端点)、今日线/冻结带、缩放、横纵滚动联动、只读。
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import './river-gantt.less';
import type {
  RiverGanttApi,
  RiverGanttColumn,
  RiverGanttLink,
  RiverGanttScale,
  RiverGanttTask,
  RiverMoveTaskEvent,
  RiverSelectTaskEvent,
  RiverTaskTemplate,
  RiverUpdateTaskEvent,
} from './types';
import { buildScaleRows, getMinUnit, getUnitMs } from './timeScale';
import { createGeometry, dateToX, pxToMs, snapDeltaMs } from './geometry';
import type { GanttGeometry } from './geometry';
import GanttScaleHeader from './GanttScaleHeader';
import GanttGridBody, { type GridRow } from './GanttGridColumn';
import GanttBar, { type BarPointerInfo, type DragMode } from './GanttBar';
import GanttLinksLayer, { type LinkPath } from './GanttLinksLayer';

const SCALE_ROW_HEIGHT = 24;
const CLICK_THRESHOLD_PX = 4;
const DEFAULT_GRID_WIDTH = 168;
const ZOOM_MIN = 12;
const ZOOM_MAX = 320;

const DEFAULT_CELL_WIDTH: Record<string, number> = {
  hour: 24,
  day: 40,
  week: 64,
  month: 90,
  year: 120,
};

interface SegmentOverride {
  start: Date;
  end: Date;
}
interface TaskOverride {
  start?: Date;
  end?: Date;
  segments?: SegmentOverride[];
}

interface ActiveDrag {
  rowId: number | string;
  mode: DragMode;
  segmentIndex?: number;
  operationId?: number;
  isStationSegment: boolean;
  origStart: Date;
  origEnd: Date;
  startClientX: number;
  startClientY: number;
  previewStart: Date;
  previewEnd: Date;
  moved: boolean;
  lockedAttempted: boolean;
  dropTargetRowId: number | string | null;
}

function resolveTaskWith(
  task: RiverGanttTask,
  override: TaskOverride | undefined,
  drag: ActiveDrag | null
): RiverGanttTask {
  let start = task.start;
  let end = task.end;
  let segments = task.segments;

  if (override) {
    if (override.start) start = override.start;
    if (override.end) end = override.end;
    if (override.segments && segments) {
      segments = segments.map((s, i) =>
        override.segments && override.segments[i]
          ? { ...s, start: override.segments[i].start, end: override.segments[i].end }
          : s
      );
    }
  }

  if (drag && String(drag.rowId) === String(task.id)) {
    if (drag.segmentIndex != null && segments) {
      segments = segments.map((s, i) =>
        i === drag.segmentIndex ? { ...s, start: drag.previewStart, end: drag.previewEnd } : s
      );
    } else if (drag.segmentIndex == null) {
      start = drag.previewStart;
      end = drag.previewEnd;
    }
  }

  if (start === task.start && end === task.end && segments === task.segments) return task;
  return { ...task, start, end, segments };
}

export interface RiverGanttProps {
  tasks: RiverGanttTask[];
  links?: RiverGanttLink[];
  scales: RiverGanttScale[];
  start: Date;
  end: Date;
  columns: RiverGanttColumn[];
  selected?: Array<number | string>;
  cellHeight?: number;
  cellWidth?: number;
  zoom?: boolean;
  splitTasks?: boolean;
  readonly?: boolean;
  maxHeight?: number;
  taskTemplate?: RiverTaskTemplate;
  /** 今日竖线 */
  todayMarker?: boolean;
  /** 冻结带：从时间轴起点至该日期 */
  freezeUntil?: Date | null;
  nonDraggableTaskIds?: Array<number | string>;
  onUpdateTask?: (ev: RiverUpdateTaskEvent) => void;
  onSelectTask?: (ev: RiverSelectTaskEvent) => void;
  onBlockedDragAttempt?: (id: number | string) => void;
  init?: (api: RiverGanttApi) => void;
}

const RiverGantt: React.FC<RiverGanttProps> = ({
  tasks,
  links = [],
  scales,
  start,
  end,
  columns,
  selected = [],
  cellHeight = 36,
  cellWidth: cellWidthProp,
  zoom = false,
  splitTasks = false,
  readonly = false,
  maxHeight,
  taskTemplate,
  todayMarker = false,
  freezeUntil = null,
  nonDraggableTaskIds = [],
  onUpdateTask,
  onSelectTask,
  onBlockedDragAttempt,
  init,
}) => {
  const minUnit = useMemo(() => getMinUnit(scales), [scales]);
  const unitMs = useMemo(() => getUnitMs(minUnit), [minUnit]);

  const [cellWidth, setCellWidth] = useState<number>(
    () => cellWidthProp ?? DEFAULT_CELL_WIDTH[minUnit] ?? 40
  );
  useEffect(() => {
    setCellWidth(cellWidthProp ?? DEFAULT_CELL_WIDTH[minUnit] ?? 40);
  }, [minUnit, cellWidthProp]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dropTargetRowId, setDropTargetRowId] = useState<number | string | null>(null);
  const [panning, setPanning] = useState(false);
  // dragTick：拖拽/提交叠加时强制重算 resolvedTasks（叠加值存于 ref）
  const [dragTick, force] = useReducer((c: number) => c + 1, 0);

  // —— refs（供 window 指针监听与 api 读取最新值）——
  const tasksRef = useRef<RiverGanttTask[]>(tasks);
  tasksRef.current = tasks;
  const committedOverridesRef = useRef<Map<string, TaskOverride>>(new Map());
  const dragRef = useRef<ActiveDrag | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const scaleScrollRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const moveListenersRef = useRef<Array<(ev: RiverMoveTaskEvent) => void>>([]);
  const apiRef = useRef<RiverGanttApi | null>(null);
  const panRef = useRef<{
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const detachPanListeners = useRef<() => void>(() => {});
  const geometryRef = useRef<GanttGeometry | null>(null);
  const rowHeightRef = useRef<number>(cellHeight);
  rowHeightRef.current = cellHeight;
  const cellWidthRef = useRef<number>(cellWidth);
  cellWidthRef.current = cellWidth;
  const readonlyRef = useRef<boolean>(readonly);
  readonlyRef.current = readonly;

  const nonDraggableSet = useMemo(
    () => new Set(nonDraggableTaskIds.map((id) => String(id))),
    [nonDraggableTaskIds]
  );
  const nonDraggableRef = useRef<Set<string>>(nonDraggableSet);
  nonDraggableRef.current = nonDraggableSet;

  const onUpdateTaskRef = useRef<RiverGanttProps['onUpdateTask']>(onUpdateTask);
  onUpdateTaskRef.current = onUpdateTask;
  const onSelectTaskRef = useRef<RiverGanttProps['onSelectTask']>(onSelectTask);
  onSelectTaskRef.current = onSelectTask;
  const onBlockedDragAttemptRef = useRef<RiverGanttProps['onBlockedDragAttempt']>(onBlockedDragAttempt);
  onBlockedDragAttemptRef.current = onBlockedDragAttempt;

  // 新数据到达时清空本地拖拽叠加（避免脏预览残留）
  useEffect(() => {
    committedOverridesRef.current.clear();
    dragRef.current = null;
    setDropTargetRowId(null);
  }, [tasks]);

  const geometry = useMemo(
    () => createGeometry(start, end, cellWidth, unitMs),
    [start, end, cellWidth, unitMs]
  );
  geometryRef.current = geometry;

  const scaleRows = useMemo(
    () => buildScaleRows(scales, start, end, geometry.pxPerMs),
    [scales, start, end, geometry.pxPerMs]
  );

  const selectedSet = useMemo(() => new Set(selected.map((id) => String(id))), [selected]);

  // 解析任务（叠加 committed override 与实时 drag）
  const resolvedTasks = useMemo(
    () => tasks.map((t) => resolveTaskWith(t, committedOverridesRef.current.get(String(t.id)), dragRef.current)),
    // committedOverrides/drag 存于 ref，通过 dragTick 强制重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, dragTick]
  );

  // 扁平化可见行（一层 summary 折叠）
  const visibleRows = useMemo<GridRow[]>(() => {
    const childrenCount = new Map<string, number>();
    const summaryIds = new Set<string>();
    for (const t of resolvedTasks) {
      if (t.type === 'summary') summaryIds.add(String(t.id));
    }
    for (const t of resolvedTasks) {
      const p = t.parent;
      if (p != null && String(p) !== '0') {
        childrenCount.set(String(p), (childrenCount.get(String(p)) ?? 0) + 1);
      }
    }
    const rows: GridRow[] = [];
    for (const t of resolvedTasks) {
      const parentKey = t.parent != null ? String(t.parent) : '';
      const parentIsSummary = summaryIds.has(parentKey);
      if (parentIsSummary && collapsed.has(parentKey)) continue;
      const isSummary = t.type === 'summary';
      rows.push({
        task: t,
        depth: parentIsSummary ? 1 : 0,
        collapsible: isSummary && (childrenCount.get(String(t.id)) ?? 0) > 0,
        collapsed: collapsed.has(String(t.id)),
      });
    }
    return rows;
  }, [resolvedTasks, collapsed]);

  const visibleRowsRef = useRef<GridRow[]>(visibleRows);
  visibleRowsRef.current = visibleRows;

  // 依赖连线端点索引（顶层任务 + 按 operation_id 命中的分段）
  const linkPaths = useMemo<LinkPath[]>(() => {
    if (links.length === 0) return [];
    const index = new Map<string, { x1: number; x2: number; y: number }>();
    visibleRows.forEach((row, rowIndex) => {
      const y = rowIndex * cellHeight + cellHeight / 2;
      const t = row.task;
      index.set(String(t.id), { x1: dateToX(geometry, t.start), x2: dateToX(geometry, t.end), y });
      if (t.segments) {
        for (const seg of t.segments) {
          if (seg.operation_id != null) {
            index.set(`op-${seg.operation_id}`, {
              x1: dateToX(geometry, seg.start),
              x2: dateToX(geometry, seg.end),
              y,
            });
          }
        }
      }
    });
    const paths: LinkPath[] = [];
    for (const link of links) {
      const s = index.get(String(link.source));
      const t = index.get(String(link.target));
      if (!s || !t) continue;
      // e2s（默认）：源结束 → 目标开始；其余类型回退到端点近似
      const x1 = link.type === 's2s' || link.type === 's2e' ? s.x1 : s.x2;
      const x2 = link.type === 'e2e' || link.type === 's2e' ? t.x2 : t.x1;
      paths.push({ id: link.id, x1, y1: s.y, x2, y2: t.y });
    }
    return paths;
  }, [links, visibleRows, geometry, cellHeight]);

  // —— 布局尺寸 ——
  const headerHeight = Math.max(SCALE_ROW_HEIGHT, scaleRows.length * SCALE_ROW_HEIGHT);
  const gridWidth = columns.reduce((sum, c) => sum + (c.width ?? DEFAULT_GRID_WIDTH), 0) || DEFAULT_GRID_WIDTH;
  const contentHeight = visibleRows.length * cellHeight;
  const rootHeight = headerHeight + contentHeight + 10;

  // —— 实时解析（refs，供 window 监听与 api）——
  const resolveLive = useCallback((task: RiverGanttTask) => {
    return resolveTaskWith(task, committedOverridesRef.current.get(String(task.id)), dragRef.current);
  }, []);

  const findTaskById = useCallback((id: number | string): RiverGanttTask | undefined => {
    return tasksRef.current.find((t) => String(t.id) === String(id));
  }, []);

  const rowIdAtClientY = useCallback((clientY: number): number | string | null => {
    const body = bodyScrollRef.current;
    if (!body) return null;
    const rect = body.getBoundingClientRect();
    const y = clientY - rect.top + body.scrollTop;
    const idx = Math.floor(y / rowHeightRef.current);
    const row = visibleRowsRef.current[idx];
    return row ? row.task.id : null;
  }, []);

  const emitMoveTask = useCallback((ev: RiverMoveTaskEvent) => {
    for (const cb of moveListenersRef.current) cb(ev);
  }, []);

  // —— 指针拖拽 ——
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const g = geometryRef.current;
      if (!g) return;
      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;
      if (!d.moved && Math.abs(dx) < CLICK_THRESHOLD_PX && Math.abs(dy) < CLICK_THRESHOLD_PX) return;
      d.moved = true;
      if (readonlyRef.current) return;

      const lockedId = d.operationId != null ? `op-${d.operationId}` : String(d.rowId);
      if (nonDraggableRef.current.has(lockedId)) {
        d.lockedAttempted = true;
        return;
      }

      const deltaMs = snapDeltaMs(g, pxToMs(g, dx));
      let ns = d.origStart;
      let ne = d.origEnd;
      if (d.mode === 'move') {
        ns = new Date(d.origStart.getTime() + deltaMs);
        ne = new Date(d.origEnd.getTime() + deltaMs);
      } else if (d.mode === 'start') {
        ns = new Date(Math.min(d.origStart.getTime() + deltaMs, d.origEnd.getTime() - g.unitMs));
      } else if (d.mode === 'end') {
        ne = new Date(Math.max(d.origEnd.getTime() + deltaMs, d.origStart.getTime() + g.unitMs));
      }
      d.previewStart = ns;
      d.previewEnd = ne;

      let target: number | string | null = null;
      if (d.mode === 'move' && d.isStationSegment) {
        const candidate = rowIdAtClientY(e.clientY);
        if (
          candidate != null &&
          String(candidate) !== String(d.rowId) &&
          String(candidate).startsWith('st-')
        ) {
          target = candidate;
        }
      }
      d.dropTargetRowId = target;
      setDropTargetRowId(target);
      force();
    },
    [rowIdAtClientY]
  );

  const detachWindowListeners = useRef<() => void>(() => {});

  const handlePointerUp = useCallback(() => {
    const d = dragRef.current;
    detachWindowListeners.current();
    dragRef.current = null;
    setDropTargetRowId(null);
    if (!d) return;

    if (!d.moved) {
      // 点击 → 选中
      let id: number | string = d.rowId;
      if (d.segmentIndex != null && d.operationId != null) id = `op-${d.operationId}`;
      onSelectTaskRef.current?.({ id, segmentIndex: d.segmentIndex, toggle: true });
      force();
      return;
    }
    if (readonlyRef.current) {
      force();
      return;
    }

    const lockedId = d.operationId != null ? `op-${d.operationId}` : String(d.rowId);
    if (d.lockedAttempted || nonDraggableRef.current.has(lockedId)) {
      onBlockedDragAttemptRef.current?.(d.rowId);
      force();
      return;
    }

    // 提交本地叠加（保证随后 getTask 读到拖拽后位置）
    const key = String(d.rowId);
    const prev = committedOverridesRef.current.get(key) ?? {};
    if (d.segmentIndex != null) {
      const segs = (prev.segments ?? []).slice();
      segs[d.segmentIndex] = { start: d.previewStart, end: d.previewEnd };
      committedOverridesRef.current.set(key, { ...prev, segments: segs });
    } else {
      committedOverridesRef.current.set(key, { ...prev, start: d.previewStart, end: d.previewEnd });
    }
    force();

    // 跨行改派
    if (d.dropTargetRowId != null && d.operationId != null) {
      emitMoveTask({
        id: `op-${d.operationId}`,
        target: d.dropTargetRowId,
        mode: 'child',
        inProgress: false,
      });
    }
    // 改期
    onUpdateTaskRef.current?.({
      id: d.rowId,
      segmentIndex: d.segmentIndex,
      task: { start: d.previewStart, end: d.previewEnd },
    });
  }, [emitMoveTask]);

  const handleBarPointerDown = useCallback(
    (e: React.PointerEvent, info: BarPointerInfo) => {
      // 主键左键
      if (e.button !== 0) return;
      const live = findTaskById(info.rowId);
      if (!live) return;
      const resolved = resolveLive(live);
      let origStart: Date;
      let origEnd: Date;
      let operationId: number | undefined;
      let isStationSegment = false;
      if (info.segmentIndex != null && resolved.segments) {
        const seg = resolved.segments[info.segmentIndex];
        if (!seg) return;
        origStart = seg.start;
        origEnd = seg.end;
        operationId = seg.operation_id;
        isStationSegment = String(info.rowId).startsWith('st-');
      } else {
        origStart = resolved.start;
        origEnd = resolved.end;
      }
      dragRef.current = {
        rowId: info.rowId,
        mode: info.mode,
        segmentIndex: info.segmentIndex,
        operationId,
        isStationSegment,
        origStart,
        origEnd,
        startClientX: e.clientX,
        startClientY: e.clientY,
        previewStart: origStart,
        previewEnd: origEnd,
        moved: false,
        lockedAttempted: false,
        dropTargetRowId: null,
      };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      detachWindowListeners.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    },
    [findTaskById, handlePointerMove, handlePointerUp, resolveLive]
  );

  useEffect(() => () => detachWindowListeners.current(), []);

  // —— 滚动联动 ——
  const handleBodyScroll = useCallback(() => {
    const body = bodyScrollRef.current;
    if (!body) return;
    if (scaleScrollRef.current) scaleScrollRef.current.scrollLeft = body.scrollLeft;
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = body.scrollTop;
  }, []);

  // —— 鼠标拖动平移时间轴（空白处按住拖拽） ——
  const handlePanMove = useCallback(
    (e: PointerEvent) => {
      const p = panRef.current;
      const body = bodyScrollRef.current;
      if (!p || !body) return;
      body.scrollLeft = p.startScrollLeft - (e.clientX - p.startClientX);
      body.scrollTop = p.startScrollTop - (e.clientY - p.startClientY);
      handleBodyScroll();
    },
    [handleBodyScroll]
  );

  const handlePanUp = useCallback(() => {
    panRef.current = null;
    detachPanListeners.current();
    setPanning(false);
  }, []);

  const handleTimelinePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 仅左键，且落点在空白区（任务条/分段/手柄会 stopPropagation，不会触发平移）
      if (e.button !== 0) return;
      const body = bodyScrollRef.current;
      if (!body) return;
      panRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startScrollLeft: body.scrollLeft,
        startScrollTop: body.scrollTop,
      };
      setPanning(true);
      window.addEventListener('pointermove', handlePanMove);
      window.addEventListener('pointerup', handlePanUp);
      detachPanListeners.current = () => {
        window.removeEventListener('pointermove', handlePanMove);
        window.removeEventListener('pointerup', handlePanUp);
      };
    },
    [handlePanMove, handlePanUp]
  );

  useEffect(() => () => detachPanListeners.current(), []);

  // —— 缩放（ctrl + 滚轮）——
  useEffect(() => {
    const body = bodyScrollRef.current;
    if (!body || !zoom) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setCellWidth((prev) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev * factor));
      });
    };
    body.addEventListener('wheel', onWheel, { passive: false });
    return () => body.removeEventListener('wheel', onWheel);
  }, [zoom]);

  // —— 行滚动入视野 ——
  const scrollRowIntoView = useCallback((id: number | string) => {
    const body = bodyScrollRef.current;
    const g = geometryRef.current;
    if (!body || !g) return;
    const idx = visibleRowsRef.current.findIndex((r) => String(r.task.id) === String(id));
    if (idx < 0) return;
    const rowH = rowHeightRef.current;
    const y = idx * rowH;
    if (y < body.scrollTop || y > body.scrollTop + body.clientHeight - rowH) {
      body.scrollTop = Math.max(0, y - body.clientHeight / 2);
    }
    const t = resolveTaskWith(
      visibleRowsRef.current[idx].task,
      committedOverridesRef.current.get(String(id)),
      null
    );
    const x = dateToX(g, t.start);
    if (x < body.scrollLeft || x > body.scrollLeft + body.clientWidth) {
      body.scrollLeft = Math.max(0, x - body.clientWidth / 3);
    }
    handleBodyScroll();
  }, [handleBodyScroll]);

  // —— api ——
  useLayoutEffect(() => {
    const api: RiverGanttApi = {
      getTask: (id) => {
        const t = findTaskById(id);
        return t ? resolveLive(t) : undefined;
      },
      getState: () => {
        const g = geometryRef.current!;
        const body = bodyScrollRef.current;
        return {
          start,
          end,
          cellWidth: cellWidthRef.current,
          pxPerMs: g.pxPerMs,
          unitMs: g.unitMs,
          scrollLeft: body?.scrollLeft ?? 0,
          scrollTop: body?.scrollTop ?? 0,
        };
      },
      selectTask: ({ id, show }) => {
        if (show) scrollRowIntoView(id);
      },
      scrollChart: ({ left, top }) => {
        const body = bodyScrollRef.current;
        if (!body) return;
        if (left != null) body.scrollLeft = left;
        if (top != null) body.scrollTop = top;
        handleBodyScroll();
      },
      exec: (action, params) => {
        if (action === 'select-task') api.selectTask(params as { id: number | string; show?: boolean });
        else if (action === 'scroll-chart') api.scrollChart(params as { left?: number; top?: number });
        return Promise.resolve(undefined);
      },
      on: (event, cb) => {
        if (event === 'move-task') moveListenersRef.current.push(cb);
      },
    };
    apiRef.current = api;
    init?.(api);
    // init 只在挂载时对外暴露一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = useCallback((id: number | string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const todayX = todayMarker ? dateToX(geometry, new Date()) : null;
  const freezeWidth = freezeUntil ? Math.max(0, dateToX(geometry, freezeUntil)) : 0;

  return (
    <div className="river-gantt" style={{ height: rootHeight }}>
      <div className="river-gantt__header-row" style={{ height: headerHeight }}>
        <div className="river-gantt__corner" style={{ width: gridWidth, height: headerHeight }}>
          {columns.map((col) => {
            const header = col.header;
            const text = typeof header === 'string' ? header : header?.text ?? '';
            const css = typeof header === 'object' && header ? header.css : undefined;
            return (
              <div
                className={`river-gantt__corner-cell${css ? ` ${css}` : ''}`}
                key={col.id}
                style={{ width: col.width }}
              >
                {text}
              </div>
            );
          })}
        </div>
        <div className="river-gantt__scale-scroll" ref={scaleScrollRef}>
          <GanttScaleHeader rows={scaleRows} rowHeight={SCALE_ROW_HEIGHT} totalWidth={geometry.totalWidth} />
        </div>
      </div>

      <div className="river-gantt__body-row">
        <div className="river-gantt__grid-scroll" ref={gridScrollRef} style={{ width: gridWidth }}>
          <GanttGridBody columns={columns} rows={visibleRows} rowHeight={cellHeight} onToggle={handleToggle} />
        </div>
        <div
          className={`river-gantt__timeline${panning ? ' is-panning' : ''}`}
          ref={bodyScrollRef}
          onScroll={handleBodyScroll}
          onPointerDown={handleTimelinePointerDown}
        >
          <div
            className="river-gantt__content"
            style={{ width: geometry.totalWidth, height: contentHeight }}
          >
            {freezeWidth > 0 ? (
              <div className="gantt-freeze-band" style={{ width: freezeWidth }} title="冻结窗" />
            ) : null}
            {todayX != null ? (
              <div className="gantt-today-line" style={{ left: todayX }} title="今日" />
            ) : null}
            <GanttLinksLayer paths={linkPaths} width={geometry.totalWidth} height={contentHeight} />
            {visibleRows.map((row, rowIndex) => (
              <div
                key={String(row.task.id)}
                className={`river-gantt__row${
                  dropTargetRowId != null && String(dropTargetRowId) === String(row.task.id)
                    ? ' river-gantt__row--drop-target'
                    : ''
                }`}
                style={{ top: rowIndex * cellHeight, height: cellHeight }}
              >
                <GanttBar
                  geometry={geometry}
                  task={row.task}
                  rowId={row.task.id}
                  splitTasks={splitTasks}
                  readonly={readonly}
                  taskTemplate={taskTemplate}
                  selectedSet={selectedSet}
                  onBarPointerDown={handleBarPointerDown}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiverGantt;
