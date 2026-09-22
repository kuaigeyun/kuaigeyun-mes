import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Empty, Spin, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type {
  GanttTaskLevel,
  WorkOrderForGantt,
  WorkstationResource,
} from '../../../../components/GanttSchedulingChart/types';
import type { VisualSchedulingBoardScan } from '../../../../services/production';
import type { SchedulingEquipmentResource, SchedulingWorkerResource } from '../schedulingResourceFilters';
import {
  buildCardLaneReorderUpdates,
  buildSchedulingCardResourceRows,
  listSchedulingCardOperations,
  parseCardLaneDroppableId,
  type SchedulingCardOperationDateUpdate,
  type SchedulingCardOperationItem,
  type SchedulingCardResourceMove,
  type SchedulingCardResourceRow,
} from '../schedulingCardViewUtils';
import SchedulingCardLane from './SchedulingCardLane';
import { SortableTaskCard, TaskCardPreview } from './SchedulingCardTask';

interface SchedulingCardBoardProps {
  t: TFunction;
  loading?: boolean;
  workOrders: WorkOrderForGantt[];
  taskLevel: GanttTaskLevel;
  stations: WorkstationResource[];
  equipments: SchedulingEquipmentResource[];
  workers: SchedulingWorkerResource[];
  boardScan: VisualSchedulingBoardScan | null | undefined;
  horizonDays: number;
  materialIssueWorkOrderIds?: number[];
  selectedWorkOrderIds?: number[];
  canUpdate?: boolean;
  onSelectWorkOrder?: (workOrderId: number) => void;
  onOperationUpdate?: (updates: SchedulingCardOperationDateUpdate[]) => void | Promise<void>;
  onOperationResourceMove?: (move: SchedulingCardResourceMove) => void | Promise<void>;
}

function resolveLaneHeadLabel(t: TFunction, taskLevel: GanttTaskLevel): string {
  if (taskLevel === 'station') return t('app.kuaizhizao.scheduling.ganttToolbar.resourceStation');
  if (taskLevel === 'equipment') return t('app.kuaizhizao.scheduling.ganttToolbar.resourceEquipment');
  if (taskLevel === 'worker') return t('app.kuaizhizao.scheduling.ganttToolbar.resourceWorker');
  return t('app.kuaizhizao.scheduling.ganttToolbar.resourceViewLabel');
}

function ResourceSummary({
  t,
  row,
}: {
  t: TFunction;
  row: SchedulingCardResourceRow;
}) {
  return (
    <>
      <Typography.Text strong ellipsis className="scheduling-card-board__resource-name">
        {row.resourceCode ? `${row.resourceCode} ` : ''}
        {row.resourceName}
      </Typography.Text>
      <div className="scheduling-card-board__summary-meta">
        <span>{t('app.kuaizhizao.scheduling.cardBoard.summaryHours', { hours: row.scheduledHours.toFixed(1) })}</span>
        <span>{t('app.kuaizhizao.scheduling.cardBoard.summaryTasks', { count: row.operationCount })}</span>
        <span
          className={
            row.overloaded
              ? 'scheduling-card-board__load-rate scheduling-card-board__load-rate--overloaded'
              : 'scheduling-card-board__load-rate'
          }
        >
          {row.loadRate}%
        </span>
      </div>
    </>
  );
}

function resolveTargetResourceId(
  over: DragEndEvent['over'],
  operationResourceById: Map<number, number>
): number | null {
  if (!over) return null;
  const laneId = parseCardLaneDroppableId(over.id);
  if (laneId != null) return laneId;
  if (typeof over.id === 'number') {
    return operationResourceById.get(over.id) ?? null;
  }
  const dataResourceId = over.data.current?.resourceId;
  if (typeof dataResourceId === 'number') return dataResourceId;
  return null;
}

export default function SchedulingCardBoard({
  t,
  loading = false,
  workOrders,
  taskLevel,
  stations,
  equipments,
  workers,
  boardScan,
  horizonDays,
  materialIssueWorkOrderIds = [],
  selectedWorkOrderIds = [],
  canUpdate = false,
  onSelectWorkOrder,
  onOperationUpdate,
  onOperationResourceMove,
}: SchedulingCardBoardProps) {
  const rows = useMemo(
    () =>
      buildSchedulingCardResourceRows({
        workOrders,
        taskLevel,
        stations,
        equipments,
        workers,
        boardScan,
        horizonDays,
        materialIssueWorkOrderIds,
      }),
    [
      boardScan,
      equipments,
      horizonDays,
      materialIssueWorkOrderIds,
      stations,
      taskLevel,
      workOrders,
      workers,
    ]
  );

  const laneOperations = useMemo(() => {
    const map = new Map<number, SchedulingCardOperationItem[]>();
    for (const row of rows) {
      map.set(row.resourceId, listSchedulingCardOperations(row.items));
    }
    return map;
  }, [rows]);

  const operationResourceById = useMemo(() => {
    const map = new Map<number, number>();
    for (const [resourceId, ops] of laneOperations) {
      for (const op of ops) {
        map.set(op.operationId, resourceId);
      }
    }
    return map;
  }, [laneOperations]);

  const operationById = useMemo(() => {
    const map = new Map<number, SchedulingCardOperationItem>();
    for (const ops of laneOperations.values()) {
      for (const op of ops) {
        map.set(op.operationId, op);
      }
    }
    return map;
  }, [laneOperations]);

  const selectedSet = useMemo(() => new Set(selectedWorkOrderIds), [selectedWorkOrderIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeOperationId, setActiveOperationId] = useState<number | null>(null);
  const [activeDropLaneId, setActiveDropLaneId] = useState<number | null>(null);
  const [lanesExpanded, setLanesExpanded] = useState(false);

  const activeOperation = activeOperationId != null ? operationById.get(activeOperationId) : undefined;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (typeof event.active.id === 'number') {
      setActiveOperationId(event.active.id);
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const targetResourceId = resolveTargetResourceId(event.over, operationResourceById);
      setActiveDropLaneId(targetResourceId);
    },
    [operationResourceById]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveOperationId(null);
      setActiveDropLaneId(null);

      if (!canUpdate) return;
      const { active, over } = event;
      if (!over || typeof active.id !== 'number') return;

      const operationId = active.id;
      const sourceResourceId = operationResourceById.get(operationId);
      const targetResourceId = resolveTargetResourceId(over, operationResourceById);
      if (sourceResourceId == null || targetResourceId == null) return;

      if (sourceResourceId !== targetResourceId) {
        if (targetResourceId <= 0) return;
        void onOperationResourceMove?.({
          operationId,
          fromResourceId: sourceResourceId,
          toResourceId: targetResourceId,
        });
        return;
      }

      if (!onOperationUpdate || typeof over.id !== 'number' || active.id === over.id) return;
      const operations = laneOperations.get(sourceResourceId) ?? [];
      const fromIndex = operations.findIndex((op) => op.operationId === operationId);
      const toIndex = operations.findIndex((op) => op.operationId === over.id);
      if (fromIndex < 0 || toIndex < 0) return;
      const updates = buildCardLaneReorderUpdates(operations, fromIndex, toIndex);
      if (updates.length === 0) return;
      void onOperationUpdate(updates);
    },
    [canUpdate, laneOperations, onOperationResourceMove, onOperationUpdate, operationResourceById]
  );

  const handleDragCancel = useCallback(() => {
    setActiveOperationId(null);
    setActiveDropLaneId(null);
  }, []);

  if (taskLevel === 'work_order' || taskLevel === 'operation') {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('app.kuaizhizao.scheduling.cardBoard.unsupportedLevel')}
        style={{ padding: '48px 0' }}
      />
    );
  }

  if (loading) {
    return (
      <div className="scheduling-card-board scheduling-card-board--loading">
        <Spin size="large" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('app.kuaizhizao.scheduling.cardBoard.empty')}
        style={{ padding: '48px 0' }}
      />
    );
  }

  const boardBody = (
    <div className="scheduling-card-board__grid">
      <div className="scheduling-card-board__header-row">
        <div className="scheduling-card-board__lane-head scheduling-card-board__lane-head--corner">
          <Typography.Text type="secondary">{resolveLaneHeadLabel(t, taskLevel)}</Typography.Text>
        </div>
        <div className="scheduling-card-board__lane-body scheduling-card-board__lane-body--header">
          <Typography.Text type="secondary">{t('app.kuaizhizao.scheduling.cardBoard.taskLane')}</Typography.Text>
          <Button
            type="text"
            size="small"
            className="scheduling-card-board__header-expand"
            icon={lanesExpanded ? <UpOutlined /> : <DownOutlined />}
            aria-expanded={lanesExpanded}
            onClick={() => setLanesExpanded((prev) => !prev)}
          >
            {lanesExpanded
              ? t('app.kuaizhizao.scheduling.cardBoard.collapseLane')
              : t('app.kuaizhizao.scheduling.cardBoard.expandLane')}
          </Button>
        </div>
      </div>

      {rows.map((row) => {
        const operations = laneOperations.get(row.resourceId) ?? [];
        return (
          <div
            key={`${taskLevel}-${row.resourceId}`}
            className={`scheduling-card-board__row${row.overloaded ? ' scheduling-card-board__row--overloaded' : ''}${operations.length > 0 ? '' : ' scheduling-card-board__row--idle'}`}
          >
            <div className="scheduling-card-board__lane-head">
              <ResourceSummary t={t} row={row} />
            </div>
            <div
              className={`scheduling-card-board__lane-body${operations.length > 0 ? '' : ' scheduling-card-board__lane-body--empty'}${activeDropLaneId === row.resourceId ? ' scheduling-card-board__lane-body--drop-target' : ''}`}
            >
              <SchedulingCardLane
                t={t}
                resourceId={row.resourceId}
                operations={operations}
                expanded={lanesExpanded}
                canUpdate={canUpdate}
                dropActive={activeDropLaneId === row.resourceId}
                selectedWorkOrderIds={selectedSet}
                onSelectWorkOrder={onSelectWorkOrder}
                onOperationUpdate={onOperationUpdate}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="scheduling-card-board">
      <div className="scheduling-card-board__scroll">
        {canUpdate ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {boardBody}
            <DragOverlay dropAnimation={null}>
              {activeOperation ? (
                <TaskCardPreview
                  t={t}
                  item={activeOperation}
                  selected={selectedSet.has(activeOperation.workOrderId)}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          boardBody
        )}
      </div>
    </div>
  );
}
