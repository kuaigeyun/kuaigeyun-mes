/**
 * 产品工艺工序行表（序列 / 工时 / 资源 / 计件单价合一，支持拖拽排序）
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InputNumber, Select, Space, Switch, Table, Typography } from 'antd';
import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
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
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProductProcessLine } from '../types/productProcess';
import type { Operation } from '../types/process';
import { workshopApi, workGroupApi, factoryListItems } from '../services/factory';
import { equipmentApi } from '../../kuaizhizao/services/equipment';
import { searchUserDisplay } from '../../../services/user';
import { operationApi, unwrapProcessPagedList } from '../services/process';
import {
  enrichLineFromOperation,
  lineToPersonnelConfigs,
  parsePersonnelConfigs,
  resourcesFromOperation,
} from '../utils/productProcessLineUtils';

export type ProductProcessLinesTableProps = {
  lines: ProductProcessLine[];
  onChange: (lines: ProductProcessLine[]) => void;
  allowOperationJump: boolean;
  onAllowOperationJumpChange: (v: boolean) => void;
  disabled?: boolean;
};

type ProductProcessLinesDndContextValue = {
  lines: ProductProcessLine[];
  actionColIndex: number;
  dragDisabled: boolean;
  dragSortTitle: string;
};

const ProductProcessLinesDndContext = createContext<ProductProcessLinesDndContextValue | null>(
  null,
);

const indexBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 28,
  height: 28,
  padding: '0 8px',
  backgroundColor: '#f0f9ff',
  border: '1px solid #91d5ff',
  borderRadius: 6,
  color: '#1890ff',
  fontWeight: 600,
  fontSize: 13,
};

function DraggableBodyRow({
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string | number }) {
  const ctx = useContext(ProductProcessLinesDndContext);
  const rowKey = String(props['data-row-key'] ?? '');
  const dragDisabled = ctx?.dragDisabled ?? true;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: rowKey,
    disabled: dragDisabled || !rowKey,
  });

  const index = ctx ? ctx.lines.findIndex((l) => l.operationUuid === rowKey) : -1;
  const actionColIndex = ctx?.actionColIndex ?? -1;

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.45 : 1,
    backgroundColor: isDragging ? '#f0f9ff' : undefined,
  };

  return (
    <tr {...props} ref={setNodeRef} style={style}>
      {React.Children.map(children, (child, cellIndex) => {
        if (cellIndex === 0 && React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement, {
            children: (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                {!dragDisabled ? (
                  <span
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    title={ctx?.dragSortTitle}
                    style={{
                      color: '#1890ff',
                      cursor: 'grab',
                      touchAction: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: 4,
                    }}
                  >
                    <HolderOutlined style={{ fontSize: 16 }} />
                  </span>
                ) : null}
                <span style={indexBadgeStyle}>{index >= 0 ? index + 1 : ''}</span>
              </Space>
            ),
          });
        }
        if (cellIndex === actionColIndex && React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          });
        }
        return child;
      })}
    </tr>
  );
}

export const ProductProcessLinesTable: React.FC<ProductProcessLinesTableProps> = ({
  lines,
  onChange,
  allowOperationJump,
  onAllowOperationJumpChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [workshopOptions, setWorkshopOptions] = useState<{ label: string; value: number }[]>([]);
  const [personnelOptions, setPersonnelOptions] = useState<{ label: string; value: string }[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [operationOptions, setOperationOptions] = useState<{ label: string; value: string }[]>([]);
  const [operationByUuid, setOperationByUuid] = useState<Record<string, Operation>>({});
  const [userIdToUuid, setUserIdToUuid] = useState<Map<number, string>>(new Map());
  const [userUuidToId, setUserUuidToId] = useState<Map<string, number>>(new Map());
  const [addOpUuid, setAddOpUuid] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const enrichedRef = useRef('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(() => lines.map((l) => l.operationUuid), [lines]);

  useEffect(() => {
    void (async () => {
      try {
        const [workshopsRes, usersRes, teamsRes, equipmentRes, opsRes] = await Promise.all([
          workshopApi.list({ limit: 500, is_active: true }),
          searchUserDisplay({ page: 1, page_size: 200 }),
          workGroupApi.list({ limit: 500, is_active: true }),
          equipmentApi.list({ is_active: true, limit: 500 }),
          operationApi.list({ limit: 1000, is_active: true }),
        ]);
        setWorkshopOptions(
          factoryListItems(workshopsRes as Parameters<typeof factoryListItems>[0]).map((w) => ({
            label: `${w.code ?? ''} ${w.name ?? ''}`.trim() || String(w.id),
            value: w.id as number,
          })),
        );
        const idToUuid = new Map<number, string>();
        const uuidToId = new Map<string, number>();
        const pOpts: { label: string; value: string }[] = [];
        (usersRes?.items ?? []).forEach((u) => {
          idToUuid.set(u.id, u.uuid);
          uuidToId.set(u.uuid, u.id);
          pOpts.push({ label: `[人员] ${u.label || u.full_name || u.username}`, value: `U_${u.uuid}` });
        });
        factoryListItems(teamsRes as Parameters<typeof factoryListItems>[0]).forEach((team) => {
          pOpts.push({
            label: `[小组] ${team.name ?? ''}`.trim() || String(team.id),
            value: `T_${team.id}`,
          });
        });
        setUserIdToUuid(idToUuid);
        setUserUuidToId(uuidToId);
        setPersonnelOptions(pOpts);
        const eqItems = equipmentRes?.items ?? (Array.isArray(equipmentRes) ? equipmentRes : []);
        setEquipmentOptions(
          (Array.isArray(eqItems) ? eqItems : []).map((e: { id: number; code?: string; name?: string }) => ({
            label: `${e.code ?? ''} ${e.name ?? ''}`.trim() || String(e.id),
            value: e.id,
          })),
        );
        const ops = unwrapProcessPagedList(opsRes);
        const byUuid: Record<string, Operation> = {};
        for (const o of ops) byUuid[o.uuid] = o;
        setOperationByUuid(byUuid);
        setOperationOptions(
          ops.map((o: Operation) => ({
            label: `${o.code} - ${o.name}`,
            value: o.uuid,
          })),
        );
      } catch {
        setWorkshopOptions([]);
        setPersonnelOptions([]);
        setEquipmentOptions([]);
        setOperationOptions([]);
        setOperationByUuid({});
      }
    })();
  }, []);

  useEffect(() => {
    if (!Object.keys(operationByUuid).length || !userIdToUuid.size) return;
    const key = JSON.stringify(lines.map((l) => l.operationUuid));
    if (enrichedRef.current === key) return;
    let changed = false;
    const next = lines.map((ln) => {
      const op = operationByUuid[ln.operationUuid];
      const enriched = enrichLineFromOperation(ln, op, userIdToUuid);
      if (JSON.stringify(enriched) !== JSON.stringify(ln)) changed = true;
      return enriched;
    });
    enrichedRef.current = key;
    if (changed) onChange(next);
  }, [lines, operationByUuid, userIdToUuid, onChange]);

  const usedUuids = useMemo(() => new Set(lines.map((l) => l.operationUuid)), [lines]);

  const addableOperations = useMemo(
    () => operationOptions.filter((o) => !usedUuids.has(o.value)),
    [operationOptions, usedUuids],
  );

  const patchLine = (index: number, patch: Partial<ProductProcessLine>) => {
    onChange(lines.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  const handleAddOperation = () => {
    if (!addOpUuid) return;
    const op = operationByUuid[addOpUuid];
    if (!op) return;
    const res = resourcesFromOperation(op, userIdToUuid);
    onChange([
      ...lines,
      {
        operationUuid: op.uuid,
        operationId: op.id,
        code: op.code,
        name: op.name,
        ...res,
        reportingType: op.reportingType ?? (op as { reporting_type?: string }).reporting_type ?? 'quantity',
      },
    ]);
    setAddOpUuid(undefined);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = lines.findIndex((l) => l.operationUuid === active.id);
    const newIndex = lines.findIndex((l) => l.operationUuid === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(lines, oldIndex, newIndex));
  };

  const columns = useMemo(() => {
    const cols = [
      {
        title: t('app.master-data.operationSequence.index'),
        key: 'index',
        width: 88,
        render: (_: unknown, __: ProductProcessLine, index: number) => (
          <Space size={4}>
            {!disabled ? (
              <span
                className="drag-handle"
                title={t('app.master-data.operationSequence.dragSort')}
                style={{
                  color: '#1890ff',
                  cursor: 'move',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 4,
                }}
              >
                <HolderOutlined style={{ fontSize: 16 }} />
              </span>
            ) : null}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 28,
                height: 28,
                padding: '0 8px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #91d5ff',
                borderRadius: 6,
                color: '#1890ff',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {index + 1}
            </span>
          </Space>
        ),
      },
      {
        title: t('field.operation.code'),
        dataIndex: 'code',
        width: 100,
        ellipsis: true,
      },
      {
        title: t('field.operation.name'),
        dataIndex: 'name',
        width: 120,
        ellipsis: true,
      },
      {
        title: t('app.master-data.manufacturing.standardTime'),
        width: 110,
        render: (_: unknown, row: ProductProcessLine, index: number) => (
          <InputNumber
            min={0}
            step={0.1}
            style={{ width: '100%' }}
            disabled={disabled}
            value={row.standardTime}
            onChange={(v) => patchLine(index, { standardTime: v ?? undefined })}
          />
        ),
      },
      {
        title: t('app.master-data.manufacturing.setupTime'),
        width: 110,
        render: (_: unknown, row: ProductProcessLine, index: number) => (
          <InputNumber
            min={0}
            step={0.1}
            style={{ width: '100%' }}
            disabled={disabled}
            value={row.setupTime}
            onChange={(v) => patchLine(index, { setupTime: v ?? undefined })}
          />
        ),
      },
      {
        title: t('field.operation.defaultWorkshopIds'),
        width: 160,
        render: (_: unknown, row: ProductProcessLine, index: number) => (
          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%' }}
            disabled={disabled}
            placeholder={t('field.operation.defaultWorkshopIdsPlaceholder')}
            options={workshopOptions}
            value={row.workshopIds ?? []}
            onChange={(v) => patchLine(index, { workshopIds: v })}
          />
        ),
      },
      {
        title: t('field.operation.defaultPersonnelConfigs'),
        width: 200,
        render: (_: unknown, row: ProductProcessLine, index: number) => (
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            disabled={disabled}
            placeholder={t('field.operation.defaultPersonnelConfigsPlaceholder')}
            options={personnelOptions}
            value={lineToPersonnelConfigs(row, userIdToUuid)}
            onChange={(configs) => {
              const { operatorIds, teamIds } = parsePersonnelConfigs(configs, userUuidToId);
              patchLine(index, { operatorIds, teamIds });
            }}
          />
        ),
      },
      {
        title: t('field.operation.defaultEquipmentIds'),
        width: 160,
        render: (_: unknown, row: ProductProcessLine, index: number) => (
          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%' }}
            disabled={disabled}
            placeholder={t('field.operation.defaultEquipmentIdsPlaceholder')}
            options={equipmentOptions}
            value={row.equipmentIds ?? []}
            onChange={(v) => patchLine(index, { equipmentIds: v })}
          />
        ),
      },
      {
        title: t('app.master-data.manufacturing.pieceRateUnit'),
        width: 110,
        render: (_: unknown, row: ProductProcessLine, index: number) => (
          <InputNumber
            min={0}
            step={0.01}
            style={{ width: '100%' }}
            disabled={disabled}
            value={row.pieceRate}
            onChange={(v) => patchLine(index, { pieceRate: v ?? undefined })}
          />
        ),
      },
      ...(allowOperationJump
        ? [
            {
              title: t('field.operation.isNodeOperation'),
              width: 88,
              render: (_: unknown, row: ProductProcessLine, index: number) => (
                <Switch
                  size="small"
                  disabled={disabled}
                  checked={Boolean(row.isNodeOperation)}
                  onChange={(v) => patchLine(index, { isNodeOperation: v })}
                />
              ),
            },
          ]
        : []),
      {
        title: t('common.actions'),
        key: 'actions',
        width: 72,
        fixed: 'right' as const,
        render: (_: unknown, __: ProductProcessLine, index: number) => (
          <Button
            type="link"
            size="small"
            danger
            disabled={disabled}
            icon={<DeleteOutlined />}
            onClick={() => removeLine(index)}
          >
            {t('app.master-data.operationSequence.delete')}
          </Button>
        ),
      },
    ];
    return cols;
  }, [
    t,
    disabled,
    allowOperationJump,
    workshopOptions,
    personnelOptions,
    equipmentOptions,
    userIdToUuid,
    userUuidToId,
    lines,
  ]);

  const actionColIndex = columns.length - 1;
  const dragSortTitle = t('app.master-data.operationSequence.dragSort');

  const dndContextValue = useMemo<ProductProcessLinesDndContextValue>(
    () => ({
      lines,
      actionColIndex,
      dragDisabled: disabled,
      dragSortTitle,
    }),
    [lines, actionColIndex, disabled, dragSortTitle],
  );

  const tableComponents = useMemo(
    () => (disabled ? undefined : { body: { row: DraggableBodyRow } }),
    [disabled],
  );

  const activeLine = activeId ? lines.find((l) => l.operationUuid === activeId) : null;

  const tableEl = (
    <Table<ProductProcessLine>
      size="small"
      rowKey="operationUuid"
      pagination={false}
      scroll={{ x: 1280 }}
      locale={{ emptyText: t('app.master-data.productProcess.noLines') }}
      dataSource={lines}
      columns={columns}
      components={tableComponents}
    />
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>{t('field.route.allowOperationJump')}</span>
        <Switch
          checked={allowOperationJump}
          disabled={disabled}
          onChange={onAllowOperationJumpChange}
        />
      </div>
      <Space wrap>
        <Select
          style={{ minWidth: 260 }}
          placeholder={t('app.master-data.productProcess.addOperation')}
          disabled={disabled || !addableOperations.length}
          options={addableOperations}
          value={addOpUuid}
          onChange={setAddOpUuid}
          allowClear
          showSearch
          optionFilterProp="label"
        />
        <Button
          icon={<PlusOutlined />}
          disabled={disabled || !addOpUuid}
          onClick={handleAddOperation}
        >
          {t('app.master-data.productProcess.addOperation')}
        </Button>
      </Space>
      {disabled ? (
        tableEl
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={(_e: DragOverEvent) => undefined}
          onDragEnd={handleDragEnd}
        >
          <ProductProcessLinesDndContext.Provider value={dndContextValue}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {tableEl}
            </SortableContext>
          </ProductProcessLinesDndContext.Provider>
          <DragOverlay>
            {activeLine ? (
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fff',
                  border: '1px solid #1890ff',
                  borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.25)',
                }}
              >
                <Space>
                  <HolderOutlined style={{ color: '#1890ff' }} />
                  <span>
                    {activeLine.code} — {activeLine.name}
                  </span>
                </Space>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
        {t('app.master-data.productProcess.linesTableHint')}
      </Typography.Paragraph>
    </Space>
  );
};
