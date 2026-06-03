/**
 * 工序序列编辑器
 * 支持拖拽排序、添加工序、替换工序、删除工序
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Tag,
  Space,
  Modal,
  message,
  Select,
  Table,
  Empty,
  Typography,
  Switch,
  InputNumber,
  Input,
  Checkbox,
  Radio,
} from 'antd';
import { useSubmitShortcut } from '../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../utils/globalSubmitShortcut';
import { PlusOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, DragOverEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { operationApi } from '../services/process';
import type { Operation } from '../types/process';

const operationPickModalStyles = {
  body: { paddingTop: 8, paddingBottom: 12 },
};

function filterOperationList(ops: Operation[], keyword: string): Operation[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return ops;
  return ops.filter((op) =>
    `${op.code ?? ''} ${op.name ?? ''} ${op.description ?? ''}`.toLowerCase().includes(q),
  );
}

type OperationPickPanelProps = {
  operations: Operation[];
  loading: boolean;
  mode: 'multiple' | 'single';
  multipleValue?: string[];
  onMultipleChange?: (uuids: string[]) => void;
  singleValue?: string;
  onSingleChange?: (uuid: string | undefined) => void;
  searchPlaceholder: string;
};

const OperationPickPanel: React.FC<OperationPickPanelProps> = ({
  operations,
  loading,
  mode,
  multipleValue = [],
  onMultipleChange,
  singleValue,
  onSingleChange,
  searchPlaceholder,
}) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const filtered = useMemo(() => filterOperationList(operations, keyword), [operations, keyword]);

  const handleSelectAllFiltered = () => {
    if (mode !== 'multiple' || !onMultipleChange) return;
    const ids = filtered.map((o) => o.uuid);
    const allOn = ids.length > 0 && ids.every((id) => multipleValue.includes(id));
    if (allOn) {
      onMultipleChange(multipleValue.filter((id) => !ids.includes(id)));
    } else {
      onMultipleChange([...new Set([...multipleValue, ...ids])]);
    }
  };

  const listBorder = '1px solid var(--river-border-color, #f0f0f0)';

  return (
    <div>
      <Input.Search
        allowClear
        placeholder={searchPlaceholder}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      {mode === 'multiple' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.master-data.operationSequence.pickSelected', { count: multipleValue.length })}
          </Typography.Text>
          <Space size={0}>
            <Button type="link" size="small" disabled={!filtered.length} onClick={handleSelectAllFiltered}>
              {t('app.master-data.operationSequence.pickSelectAll')}
            </Button>
            <Button
              type="link"
              size="small"
              disabled={!multipleValue.length}
              onClick={() => onMultipleChange?.([])}
            >
              {t('app.master-data.operationSequence.pickClear')}
            </Button>
          </Space>
        </div>
      ) : null}
      <div
        style={{
          maxHeight: 280,
          overflow: 'auto',
          border: listBorder,
          borderRadius: 6,
          padding: '8px 12px',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
            {t('app.master-data.operationSequence.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('app.master-data.operationSequence.noAvailableOperations')}
          />
        ) : mode === 'multiple' ? (
          <Checkbox.Group
            value={multipleValue}
            onChange={(v) => onMultipleChange?.(v as string[])}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {filtered.map((op) => (
                <Checkbox key={op.uuid} value={op.uuid} style={{ width: '100%', marginInlineStart: 0 }}>
                  <span style={{ fontWeight: 500 }}>
                    {op.code} - {op.name}
                  </span>
                  {op.description ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      {op.description}
                    </Typography.Text>
                  ) : null}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        ) : (
          <Radio.Group
            value={singleValue}
            onChange={(e) => onSingleChange?.(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {filtered.map((op) => (
                <Radio key={op.uuid} value={op.uuid} style={{ width: '100%', marginInlineStart: 0 }}>
                  <span style={{ fontWeight: 500 }}>
                    {op.code} - {op.name}
                  </span>
                  {op.description ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      {op.description}
                    </Typography.Text>
                  ) : null}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        )}
      </div>
    </div>
  );
};

export interface OperationItem {
  uuid: string;
  code: string;
  name: string;
  description?: string;
  reportingType?: 'quantity' | 'status';
  /** 节点工序：仅在路线允许工序跳转时生效 */
  isNodeOperation?: boolean;
  /** 工序级超报（写入路线 JSON；none+0 可不提交键以继承路线默认） */
  overReportMode?: 'none' | 'fixed' | 'percent';
  overReportValue?: number;
  /** 标准工时（小时/件），写入路线 operation_sequence */
  standardTime?: number;
  /** 准备时间（小时） */
  setupTime?: number;
}

export interface OperationSequenceEditorProps {
  value?: OperationItem[];
  onChange?: (operations: OperationItem[]) => void;
  /** 为 true 时显示「节点工序」列（与路线「允许工序跳转」联动） */
  showNodeOperationColumn?: boolean;
  /** 产品工艺 Tab：显示标准工时、准备时间列 */
  showTimeColumns?: boolean;
}

export const OperationSequenceEditor: React.FC<OperationSequenceEditorProps> = ({
  value = [],
  onChange,
  showNodeOperationColumn = false,
  showTimeColumns = false,
}) => {
  const { t } = useTranslation();
  const [operations, setOperations] = useState<OperationItem[]>(value);
  const [allOperations, setAllOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedOperationUuids, setSelectedOperationUuids] = useState<string[]>([]);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [replacingOperationUuid, setReplacingOperationUuid] = useState<string | null>(null);
  const [replacementOperationUuid, setReplacementOperationUuid] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const loadOperations = async () => {
      try {
        setLoading(true);
        const result = await operationApi.list({ isActive: true, limit: 1000 });
        setAllOperations(Array.isArray(result) ? result : result?.data ?? []);
      } catch (error: any) {
        message.error(error.message || t('app.master-data.operationSequence.loadListFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadOperations();
  }, []);

  useEffect(() => {
    setOperations(value);
  }, [value]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? (event.over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (over && active.id !== over.id) {
      const oldIndex = operations.findIndex((op) => op.uuid === active.id);
      const newIndex = operations.findIndex((op) => op.uuid === over.id);
      const newOperations = arrayMove(operations, oldIndex, newIndex);
      setOperations(newOperations);
      onChange?.(newOperations);
    }
  };

  const handleAddOperation = () => {
    if (!selectedOperationUuids?.length) {
      message.warning(t('app.master-data.operationSequence.selectToAdd'));
      return;
    }
    const newOperations = selectedOperationUuids
      .map((uuid) => allOperations.find((op) => op.uuid === uuid))
      .filter((op): op is Operation => !!op && !operations.some((e) => e.uuid === op.uuid));
    if (newOperations.length === 0) {
      message.warning(t('app.master-data.operationSequence.allAddedOrNotFound'));
      return;
    }
    const newItems: OperationItem[] = newOperations.map((op) => ({
      uuid: op.uuid,
      code: op.code,
      name: op.name,
      description: op.description,
      reportingType: (op.reportingType ?? (op as any).reporting_type ?? 'quantity') as 'quantity' | 'status',
      isNodeOperation: false,
      overReportMode: (op as any).overReportMode ?? (op as any).over_report_mode ?? 'none',
      overReportValue: Number((op as any).overReportValue ?? (op as any).over_report_value ?? 0) || 0,
    }));
    const updated = [...operations, ...newItems];
    setOperations(updated);
    onChange?.(updated);
    setAddModalVisible(false);
    setSelectedOperationUuids([]);
    message.success(t('app.master-data.operationSequence.addSuccess', { count: newItems.length }));
  };

  const handleDeleteOperation = (uuid: string) => {
    const newOperations = operations.filter((op) => op.uuid !== uuid);
    setOperations(newOperations);
    onChange?.(newOperations);
  };

  const toggleNodeOperation = (uuid: string, checked: boolean) => {
    const newOperations = operations.map((op) => (op.uuid === uuid ? { ...op, isNodeOperation: checked } : op));
    setOperations(newOperations);
    onChange?.(newOperations);
  };

  const patchOverReport = (uuid: string, patch: Partial<Pick<OperationItem, 'overReportMode' | 'overReportValue'>>) => {
    const newOperations = operations.map((op) => (op.uuid === uuid ? { ...op, ...patch } : op));
    setOperations(newOperations);
    onChange?.(newOperations);
  };

  const patchTime = (uuid: string, patch: Partial<Pick<OperationItem, 'standardTime' | 'setupTime'>>) => {
    const newOperations = operations.map((op) => (op.uuid === uuid ? { ...op, ...patch } : op));
    setOperations(newOperations);
    onChange?.(newOperations);
  };

  const handleOpenReplaceModal = (uuid: string) => {
    setReplacingOperationUuid(uuid);
    setReplacementOperationUuid(undefined);
    setReplaceModalVisible(true);
  };

  const handleReplaceOperation = () => {
    if (!replacingOperationUuid || !replacementOperationUuid) {
      message.warning(t('app.master-data.operationSequence.selectToReplace'));
      return;
    }
    if (replacingOperationUuid === replacementOperationUuid) {
      message.warning(t('app.master-data.operationSequence.cannotReplaceSame'));
      return;
    }
    if (operations.some((op) => op.uuid === replacementOperationUuid && op.uuid !== replacingOperationUuid)) {
      message.warning(t('app.master-data.operationSequence.alreadyInList'));
      return;
    }
    const replacingIndex = operations.findIndex((op) => op.uuid === replacingOperationUuid);
    const replacement = allOperations.find((op) => op.uuid === replacementOperationUuid);
    if (replacingIndex === -1 || !replacement) {
      message.error(t('app.master-data.operationSequence.replaceNotFound'));
      return;
    }
    const newOperations = [...operations];
    newOperations[replacingIndex] = {
      uuid: replacement.uuid,
      code: replacement.code,
      name: replacement.name,
      description: replacement.description,
      reportingType: (replacement.reportingType ?? (replacement as any).reporting_type ?? 'quantity') as 'quantity' | 'status',
      isNodeOperation: false,
      overReportMode: (replacement as any).overReportMode ?? (replacement as any).over_report_mode ?? 'none',
      overReportValue: Number((replacement as any).overReportValue ?? (replacement as any).over_report_value ?? 0) || 0,
    };
    setOperations(newOperations);
    onChange?.(newOperations);
    setReplaceModalVisible(false);
    setReplacingOperationUuid(null);
    setReplacementOperationUuid(undefined);
    message.success(t('app.master-data.operationSequence.replaceSuccess'));
  };

  useSubmitShortcut(
    addModalVisible ? handleAddOperation : replaceModalVisible ? handleReplaceOperation : undefined,
    addModalVisible || replaceModalVisible,
  );

  const availableOperations = allOperations.filter((op) => !operations.some((a) => a.uuid === op.uuid));
  const getAvailableForReplace = (excludeUuid: string | null) => {
    if (!excludeUuid) return availableOperations;
    return allOperations.filter((op) => op.uuid === excludeUuid || !operations.some((a) => a.uuid === op.uuid));
  };

  const tableColSpan =
    4 + (showNodeOperationColumn ? 1 : 0) + (showTimeColumns ? 2 : 0);
  const actionTdIndex = tableColSpan - 1;

  const columns = [
    {
      title: t('app.master-data.operationSequence.index'),
      key: 'index',
      width: 100,
      render: (_: any, __: OperationItem, index: number) => (
        <Space>
          <span className="drag-handle" style={{ color: '#1890ff', cursor: 'move', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, padding: 4, minWidth: 24, minHeight: 24 }} title={t('app.master-data.operationSequence.dragSort')}>
            <HolderOutlined style={{ fontSize: 16 }} />
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 8px', backgroundColor: '#f0f9ff', border: '1px solid #91d5ff', borderRadius: 6, color: '#1890ff', fontWeight: 600, fontSize: 13 }}>
            {index + 1}
          </span>
        </Space>
      ),
    },
    {
      title: t('app.master-data.operationSequence.operationCodeName'),
      key: 'operation',
      render: (_: any, record: OperationItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.code} - {record.name}</div>
          {record.description && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{record.description}</div>}
        </div>
      ),
    },
    {
      title: t('app.master-data.operationSequence.reportingType'),
      key: 'reportingType',
      width: 120,
      render: (_: any, record: OperationItem) => (
        <Tag color={record.reportingType === 'quantity' ? 'blue' : 'green'}>
          {record.reportingType === 'quantity' ? t('app.master-data.operationSequence.reportingByQuantity') : record.reportingType === 'status' ? t('app.master-data.operationSequence.reportingByStatus') : '-'}
        </Tag>
      ),
    },
    ...(showNodeOperationColumn
      ? [
          {
            title: t('app.master-data.operationSequence.nodeOperation'),
            key: 'isNodeOperation',
            width: 88,
            render: (_: any, record: OperationItem) => (
              <Switch
                size="small"
                checked={!!record.isNodeOperation}
                onChange={(c) => toggleNodeOperation(record.uuid, c)}
              />
            ),
          },
        ]
      : []),
    ...(showTimeColumns
      ? [
          {
            title: t('app.master-data.manufacturing.standardTime'),
            key: 'standardTime',
            width: 120,
            render: (_: unknown, record: OperationItem) => (
              <InputNumber
                size="small"
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0"
                value={record.standardTime}
                onChange={(v) => patchTime(record.uuid, { standardTime: v ?? undefined })}
              />
            ),
          },
          {
            title: t('app.master-data.manufacturing.setupTime'),
            key: 'setupTime',
            width: 120,
            render: (_: unknown, record: OperationItem) => (
              <InputNumber
                size="small"
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0"
                value={record.setupTime}
                onChange={(v) => patchTime(record.uuid, { setupTime: v ?? undefined })}
              />
            ),
          },
        ]
      : []),
    {
      title: t('app.master-data.operationSequence.overReportAction'),
      key: 'action',
      width: 320,
      render: (_: any, record: OperationItem) => (
        <div
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Select
            size="small"
            style={{ width: 100, flexShrink: 0 }}
            value={record.overReportMode ?? 'none'}
            options={[
              { label: t('field.operation.overReportModeNone'), value: 'none' },
              { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
              { label: t('field.operation.overReportModePercent'), value: 'percent' },
            ]}
            onChange={(v) => patchOverReport(record.uuid, { overReportMode: v as OperationItem['overReportMode'] })}
          />
          <InputNumber
            size="small"
            min={0}
            style={{ width: 88, flexShrink: 0 }}
            value={record.overReportValue ?? 0}
            onChange={(v) => patchOverReport(record.uuid, { overReportValue: v ?? 0 })}
          />
          <Button type="link" size="small" style={{ padding: '0 4px', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleOpenReplaceModal(record.uuid); }}>
            {t('app.master-data.operationSequence.replace')}
          </Button>
          <Button type="link" danger size="small" style={{ padding: '0 4px', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleDeleteOperation(record.uuid); }}>
            {t('app.master-data.operationSequence.delete')}
          </Button>
        </div>
      ),
    },
  ];

  const DraggableRow = ({ children, ...props }: any) => {
    const index = operations.findIndex((op) => op.uuid === props['data-row-key']);
    const operation = operations[index];
    if (!operation) return <tr {...props}>{children}</tr>;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: operation.uuid });
    const isActiveOver = activeId && overId === operation.uuid && activeId !== operation.uuid;
    const activeIndex = activeId ? operations.findIndex((op) => op.uuid === activeId) : -1;
    const currentIndex = operations.findIndex((op) => op.uuid === operation.uuid);
    const showInsertBefore = isActiveOver && activeIndex < currentIndex;
    const showInsertAfter = isActiveOver && activeIndex > currentIndex;
    const style = {
      ...props.style,
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition,
      opacity: isDragging ? 0.4 : 1,
      backgroundColor: isDragging ? '#f0f9ff' : isOver && !isDragging ? '#e6f7ff' : 'transparent',
      boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
      position: 'relative' as const,
    };
    return (
      <tr ref={setNodeRef} style={style} {...props}>
        {React.Children.map(children, (child, idx: number) => {
          if (idx === 0 && React.isValidElement(child)) {
            const rowEl = child as React.ReactElement<{ children?: React.ReactNode }>;
            return React.cloneElement(rowEl, {
              children: React.Children.map(rowEl.props.children, (cellContent) => {
                if (React.isValidElement(cellContent) && cellContent.type === Space) {
                  const spaceEl = cellContent as React.ReactElement<{ children?: React.ReactNode }>;
                  return React.cloneElement(spaceEl, {
                    children: React.Children.map(spaceEl.props.children, (item) => {
                      const itemProps = React.isValidElement(item)
                        ? (item.props as { className?: string })
                        : undefined;
                      if (React.isValidElement(item) && itemProps?.className === 'drag-handle') {
                        return React.cloneElement(item, { ...attributes, ...listeners } as never);
                      }
                      return item;
                    }),
                  });
                }
                return cellContent;
              }),
            });
          }
          if (idx === actionTdIndex && React.isValidElement(child)) {
            return React.cloneElement(
              child as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
              {
                onClick: (e: React.MouseEvent) => e.stopPropagation(),
              },
            );
          }
          return child;
        })}
      </tr>
    );
  };

  const activeOperation = activeId ? operations.find((op) => op.uuid === activeId) : null;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#666', fontSize: 12 }}>{t('app.master-data.operationSequence.hint')}</span>
        {operations.length > 0 && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} size="small">
            {t('app.master-data.operationSequence.addOperation')}
          </Button>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        {operations.length > 0 ? (
          <SortableContext items={operations.map((op) => op.uuid)} strategy={verticalListSortingStrategy}>
            <div style={{ position: 'relative', width: '100%', margin: 0, padding: 0 }}>
              <Table
                columns={columns}
                dataSource={operations}
                rowKey="uuid"
                pagination={false}
                size="small"
                components={{
                  body: {
                    wrapper: (props: any) => {
                      const activeIndex = activeId ? operations.findIndex((op) => op.uuid === activeId) : -1;
                      const overIndex = overId ? operations.findIndex((op) => op.uuid === overId) : -1;
                      const showInsertLine = activeId && overId && activeId !== overId && activeIndex !== -1 && overIndex !== -1;
                      const insertBefore = showInsertLine && activeIndex < overIndex;
                      const insertAfter = showInsertLine && activeIndex > overIndex;
                      const insertIndex = insertBefore ? overIndex : insertAfter ? overIndex + 1 : -1;
                      return (
                        <tbody {...props}>
                          {operations.map((op, idx) => {
                            const isInsertBefore = showInsertLine && insertIndex === idx && insertBefore;
                            const isInsertAfter = showInsertLine && insertIndex === idx && insertAfter;
                            return (
                              <React.Fragment key={op.uuid}>
                                {isInsertBefore && (
                                  <tr>
                                    <td colSpan={tableColSpan} style={{ padding: 0, height: 0, lineHeight: 0 }}>
                                      <div style={{ height: 2, backgroundColor: '#1890ff', margin: 0, boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)' }} />
                                    </td>
                                  </tr>
                                )}
                                <DraggableRow data-row-key={op.uuid}>
                                  <td>
                                    <Space>
                                      <span className="drag-handle" style={{ color: '#1890ff', cursor: 'move', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, padding: 4, minWidth: 24, minHeight: 24 }} title={t('app.master-data.operationSequence.dragSort')}>
                                        <HolderOutlined style={{ fontSize: 16 }} />
                                      </span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 8px', backgroundColor: '#f0f9ff', border: '1px solid #91d5ff', borderRadius: 6, color: '#1890ff', fontWeight: 600, fontSize: 13 }}>
                                        {idx + 1}
                                      </span>
                                    </Space>
                                  </td>
                                  <td>
                                    <div>
                                      <div style={{ fontWeight: 500 }}>{op.code} - {op.name}</div>
                                      {op.description && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{op.description}</div>}
                                    </div>
                                  </td>
                                  <td>
                                    <Tag color={op.reportingType === 'quantity' ? 'blue' : 'green'}>
                                      {op.reportingType === 'quantity' ? t('app.master-data.operationSequence.reportingByQuantity') : op.reportingType === 'status' ? t('app.master-data.operationSequence.reportingByStatus') : '-'}
                                    </Tag>
                                  </td>
                                  {showNodeOperationColumn && (
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <Switch
                                        size="small"
                                        checked={!!op.isNodeOperation}
                                        onChange={(c) => toggleNodeOperation(op.uuid, c)}
                                      />
                                    </td>
                                  )}
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'nowrap',
                                        alignItems: 'center',
                                        gap: 8,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <Select
                                        size="small"
                                        style={{ width: 100, flexShrink: 0 }}
                                        value={op.overReportMode ?? 'none'}
                                        options={[
                                          { label: t('field.operation.overReportModeNone'), value: 'none' },
                                          { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
                                          { label: t('field.operation.overReportModePercent'), value: 'percent' },
                                        ]}
                                        onChange={(v) => patchOverReport(op.uuid, { overReportMode: v as OperationItem['overReportMode'] })}
                                      />
                                      <InputNumber
                                        size="small"
                                        min={0}
                                        style={{ width: 88, flexShrink: 0 }}
                                        value={op.overReportValue ?? 0}
                                        onChange={(v) => patchOverReport(op.uuid, { overReportValue: v ?? 0 })}
                                      />
                                      <Button type="link" size="small" style={{ padding: '0 4px', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleOpenReplaceModal(op.uuid); }}>
                                        {t('app.master-data.operationSequence.replace')}
                                      </Button>
                                      <Button type="link" danger size="small" style={{ padding: '0 4px', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleDeleteOperation(op.uuid); }}>
                                        {t('app.master-data.operationSequence.delete')}
                                      </Button>
                                    </div>
                                  </td>
                                </DraggableRow>
                                {isInsertAfter && (
                                  <tr>
                                    <td colSpan={tableColSpan} style={{ padding: 0, height: 0, lineHeight: 0 }}>
                                      <div style={{ height: 2, backgroundColor: '#1890ff', margin: 0, boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)' }} />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      );
                    },
                  },
                }}
                style={{ width: '100%' }}
                scroll={{ x: showNodeOperationColumn ? 820 : 732 }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.master-data.operationSequence.noData')} /> }}
              />
            </div>
          </SortableContext>
        ) : (
          <div
            style={{
              padding: 24,
              background: '#fafafa',
              borderRadius: 4,
              border: '1px dashed var(--river-border-color)',
              textAlign: 'center',
              color: '#999',
            }}
          >
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.master-data.operationSequence.noDataAddHint')} />
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} style={{ marginTop: 12 }}>
              {t('app.master-data.operationSequence.addOperation')}
            </Button>
          </div>
        )}
        <DragOverlay>
          {activeOperation ? (
            <div style={{ padding: '12px 16px', background: '#fff', border: '1px solid #1890ff', borderRadius: 4, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)', width: '100%', minWidth: 300 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <HolderOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#262626' }}>{activeOperation.code} - {activeOperation.name}</div>
                  {activeOperation.description && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{activeOperation.description}</div>}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal
        title={t('app.master-data.operationSequence.selectOperation')}
        open={addModalVisible}
        centered
        width={520}
        destroyOnHidden
        styles={operationPickModalStyles}
        onOk={handleAddOperation}
        onCancel={() => {
          setAddModalVisible(false);
          setSelectedOperationUuids([]);
        }}
        okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !selectedOperationUuids?.length || loading }}
      >
        <OperationPickPanel
          key={addModalVisible ? 'add-open' : 'add-closed'}
          mode="multiple"
          operations={availableOperations}
          loading={loading}
          multipleValue={selectedOperationUuids}
          onMultipleChange={setSelectedOperationUuids}
          searchPlaceholder={t('app.master-data.operationSequence.pickSearchPlaceholder')}
        />
        {availableOperations.length === 0 && !loading && (
          <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
            {t('app.master-data.operationSequence.createOperationFirst')}
          </Typography.Text>
        )}
      </Modal>

      <Modal
        title={t('app.master-data.operationSequence.replaceOperation')}
        open={replaceModalVisible}
        centered
        width={520}
        destroyOnHidden
        styles={operationPickModalStyles}
        onOk={handleReplaceOperation}
        onCancel={() => {
          setReplaceModalVisible(false);
          setReplacingOperationUuid(null);
          setReplacementOperationUuid(undefined);
        }}
        okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !replacementOperationUuid || loading }}
      >
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.master-data.operationSequence.currentOperation')}
          </Typography.Text>
          <div style={{ marginTop: 4 }}>
            {replacingOperationUuid &&
              (() => {
                const currentOp = operations.find((op) => op.uuid === replacingOperationUuid);
                return currentOp ? (
                  <Tag color="blue">
                    {currentOp.code} - {currentOp.name}
                  </Tag>
                ) : null;
              })()}
          </div>
        </div>
        <OperationPickPanel
          key={replaceModalVisible ? 'replace-open' : 'replace-closed'}
          mode="single"
          operations={getAvailableForReplace(replacingOperationUuid)}
          loading={loading}
          singleValue={replacementOperationUuid}
          onSingleChange={setReplacementOperationUuid}
          searchPlaceholder={t('app.master-data.operationSequence.pickSearchPlaceholder')}
        />
        {getAvailableForReplace(replacingOperationUuid).length === 0 && !loading && (
          <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
            {t('app.master-data.operationSequence.createOperationFirst')}
          </Typography.Text>
        )}
      </Modal>
    </div>
  );
};
