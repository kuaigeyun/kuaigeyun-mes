import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, DatePicker, Popover, Space, Tag, Typography } from 'antd';
import { EditOutlined, HolderOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import dayjs, { type Dayjs } from 'dayjs';
import type { SchedulingCardOperationDateUpdate, SchedulingCardOperationItem } from '../schedulingCardViewUtils';
import { resolveSchedulingCardBorderScenario } from '../schedulingCardViewUtils';
import { formatDateTime } from '../../../../../../utils/format';
import { toApiDateTimeString } from '../../../../../../utils/formDate';

export type CardOperationUpdateHandler = (
  updates: SchedulingCardOperationDateUpdate[]
) => void | Promise<void>;

function formatCardTimeRange(start?: string, end?: string): string {
  if (!start || !end) return '—';
  return `${formatDateTime(start, 'MM-DD HH:mm')} - ${formatDateTime(end, 'MM-DD HH:mm')}`;
}

function CardTimeEditor({
  t,
  item,
  disabled,
  onSave,
}: {
  t: TFunction;
  item: SchedulingCardOperationItem;
  disabled: boolean;
  onSave: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  const handleOpen = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if (disabled) return;
    setRange([dayjs(item.plannedStart), dayjs(item.plannedEnd)]);
    setOpen(true);
  };

  const handleSave = () => {
    const [start, end] = range;
    if (!start?.isValid() || !end?.isValid() || !end.isAfter(start)) return;
    const planned_start_date = toApiDateTimeString(start);
    const planned_end_date = toApiDateTimeString(end);
    if (!planned_start_date || !planned_end_date) return;
    onSave(planned_start_date, planned_end_date);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      content={
        <Space orientation="vertical" size={8} style={{ width: 320 }}>
          <DatePicker.RangePicker
            showTime
            value={range}
            style={{ width: '100%' }}
            onChange={(values) => setRange(values ?? [null, null])}
          />
          <Space>
            <Button type="primary" size="small" onClick={handleSave}>
              {t('common.save')}
            </Button>
            <Button size="small" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </Space>
        </Space>
      }
    >
      <span
        className={`scheduling-card-board__task-time-btn${disabled ? ' scheduling-card-board__task-time-btn--disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') handleOpen(event);
        }}
      >
        <span className="scheduling-card-board__task-time-text">
          {formatCardTimeRange(item.plannedStart, item.plannedEnd)}
        </span>
        {!disabled ? <EditOutlined className="scheduling-card-board__task-time-edit" /> : null}
      </span>
    </Popover>
  );
}

function TaskCardContent({
  t,
  item,
  selected,
  editable,
  dragHandle,
  onSelectWorkOrder,
  onTimeSave,
}: {
  t: TFunction;
  item: SchedulingCardOperationItem;
  selected: boolean;
  editable: boolean;
  dragHandle?: React.ReactNode;
  onSelectWorkOrder?: (workOrderId: number) => void;
  onTimeSave?: (start: string, end: string) => void;
}) {
  const sessionClass =
    item.machineSessionState === 'on_machine'
      ? ' scheduling-card-board__task--on-machine'
      : item.machineSessionState === 'off_machine'
        ? ' scheduling-card-board__task--off-machine'
        : '';

  const borderScenario = resolveSchedulingCardBorderScenario(item);

  return (
    <div
      className={`scheduling-card-board__task scheduling-card-board__task--scenario-${borderScenario}${sessionClass}${selected ? ' scheduling-card-board__task--selected' : ''}${item.isFrozen ? ' scheduling-card-board__task--locked' : ''}`}
      data-scenario={borderScenario}
    >
      <div
        className="scheduling-card-board__task-body"
        onClick={() => onSelectWorkOrder?.(item.workOrderId)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectWorkOrder?.(item.workOrderId);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="scheduling-card-board__task-head">
          {dragHandle}
          <Typography.Text strong ellipsis className="scheduling-card-board__task-code">
            {item.workOrderCode}
          </Typography.Text>
          <div className="scheduling-card-board__task-tags">
            {item.isFrozen ? (
              <Tag variant="filled">{t('app.kuaizhizao.scheduling.cardBoard.tagFrozen')}</Tag>
            ) : null}
            {String(item.workOrderStatus || '').toLowerCase() === 'draft' ? (
              <Tag variant="filled">{t('app.kuaizhizao.scheduling.cardBoard.tagDraft')}</Tag>
            ) : null}
            {item.hasMaterialIssue ? (
              <Tag color="warning" variant="filled">
                {t('app.kuaizhizao.scheduling.cardBoard.tagMaterial')}
              </Tag>
            ) : null}
            {item.isOverdue ? (
              <Tag color="error" variant="filled">
                {t('app.kuaizhizao.scheduling.cardBoard.tagOverdue')}
              </Tag>
            ) : null}
            {item.machineSessionState === 'on_machine' ? (
              <Tag color="cyan" variant="filled">
                {t('app.kuaizhizao.scheduling.cardBoard.tagOnMachine')}
              </Tag>
            ) : null}
          </div>
        </div>
        <Typography.Text type="secondary" ellipsis className="scheduling-card-board__task-product">
          {item.productName || '—'}
        </Typography.Text>
        <Typography.Text ellipsis className="scheduling-card-board__task-operation">
          {item.operationName || '—'}
        </Typography.Text>
        <CardTimeEditor
          t={t}
          item={item}
          disabled={!editable}
          onSave={(start, end) => onTimeSave?.(start, end)}
        />
        <div className="scheduling-card-board__task-progress">
          <div className="scheduling-card-board__task-progress-bar">
            <span style={{ width: `${item.progress}%` }} />
          </div>
          <span className="scheduling-card-board__task-progress-text">{item.progress}%</span>
        </div>
      </div>
    </div>
  );
}

export function TaskCardPreview({
  t,
  item,
  selected,
}: {
  t: TFunction;
  item: SchedulingCardOperationItem;
  selected: boolean;
}) {
  return (
    <div className="scheduling-card-board__task-wrap scheduling-card-board__task-wrap--overlay">
      <TaskCardContent t={t} item={item} selected={selected} editable={false} />
    </div>
  );
}

export function SortableTaskCard({
  t,
  item,
  resourceId,
  selected,
  canUpdate,
  onSelectWorkOrder,
  onOperationUpdate,
}: {
  t: TFunction;
  item: SchedulingCardOperationItem;
  resourceId: number;
  selected: boolean;
  canUpdate: boolean;
  onSelectWorkOrder?: (workOrderId: number) => void;
  onOperationUpdate?: CardOperationUpdateHandler;
}) {
  const editable = canUpdate && !item.isFrozen;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.operationId,
    data: { type: 'card', resourceId, operationId: item.operationId },
    disabled: !editable,
  });

  const handleTimeSave = (planned_start_date: string, planned_end_date: string) => {
    if (planned_start_date === item.plannedStart && planned_end_date === item.plannedEnd) {
      return;
    }
    void onOperationUpdate?.([
      {
        operation_id: item.operationId,
        planned_start_date,
        planned_end_date,
      },
    ]);
  };

  const dragHandle = editable ? (
    <span
      className="scheduling-card-board__task-drag"
      aria-label={t('app.kuaizhizao.scheduling.cardBoard.dragHandleTip')}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <HolderOutlined />
    </span>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'pan-x',
      }}
      className={`scheduling-card-board__task-wrap${isDragging ? ' scheduling-card-board__task-wrap--dragging' : ''}`}
    >
      <TaskCardContent
        t={t}
        item={item}
        selected={selected}
        editable={editable}
        dragHandle={dragHandle}
        onSelectWorkOrder={onSelectWorkOrder}
        onTimeSave={handleTimeSave}
      />
    </div>
  );
}
