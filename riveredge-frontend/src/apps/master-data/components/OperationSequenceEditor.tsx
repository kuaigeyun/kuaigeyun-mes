/**
 * 工序序列编辑器
 * 支持拖拽排序、添加工序、替换工序、删除工序
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  theme,
} from 'antd';
import { useSubmitShortcut } from '../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../utils/globalSubmitShortcut';
import { PlusOutlined, HolderOutlined } from '@ant-design/icons';
import { SequenceIndexCell, StepDragHandleContext } from '../../../components/sequence-index-cell';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, DragOverEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { operationApi } from '../services/process';
import type { Operation } from '../types/process';
import { OperationFormModal } from './OperationFormModal';
import {
  MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
} from '../../../components/layout-templates/constants';

const operationPickModalStyles = {
  body: { paddingTop: 8, paddingBottom: 12 },
};

const INSERT_LINE_STYLE: React.CSSProperties = {
  height: 2,
  backgroundColor: '#1890ff',
  margin: 0,
  boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)',
};

function InsertLineRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, height: 0, lineHeight: 0 }}>
        <div style={INSERT_LINE_STYLE} />
      </td>
    </tr>
  );
}

function SortableOperationTableRow({
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string | number }) {
  const { token } = theme.useToken();
  const rowKey = String(props['data-row-key'] ?? '');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: rowKey,
    disabled: !rowKey,
  });
  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: isDragging ? token.colorPrimaryBg : isOver && !isDragging ? token.colorFillSecondary : 'transparent',
    boxShadow: isDragging ? token.boxShadowSecondary : 'none',
    position: 'relative',
  };
  return (
    <StepDragHandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>
      <tr ref={setNodeRef} style={style} {...props}>
        {children}
      </tr>
    </StepDragHandleContext.Provider>
  );
}

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
  onQuickAdd?: () => void;
  quickAddLabel?: string;
};

export const OperationPickPanel: React.FC<OperationPickPanelProps> = ({
  operations,
  loading,
  mode,
  multipleValue = [],
  onMultipleChange,
  singleValue,
  onSingleChange,
  searchPlaceholder,
  onQuickAdd,
  quickAddLabel,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [keyword, setKeyword] = useState('');
  const filtered = useMemo(() => filterOperationList(operations, keyword), [operations, keyword]);
  const filteredIdSet = useMemo(() => new Set(filtered.map((o) => o.uuid)), [filtered]);
  const selectedOperations = useMemo(
    () =>
      multipleValue
        .map((id) => operations.find((o) => o.uuid === id))
        .filter((op): op is Operation => !!op),
    [multipleValue, operations],
  );

  /** Checkbox.Group 仅上报当前可见项；保留不在当前搜索结果中的已选项 */
  const handleMultipleChangeInView = (checkedInView: string[]) => {
    if (!onMultipleChange) return;
    const keptOutsideView = multipleValue.filter((id) => !filteredIdSet.has(id));
    onMultipleChange([...keptOutsideView, ...checkedInView]);
  };

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
        style={{ marginBottom: onQuickAdd ? 4 : 8 }}
      />
      {onQuickAdd ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={onQuickAdd}>
            {quickAddLabel ?? t('app.master-data.operationSequence.quickAddOperation')}
          </Button>
        </div>
      ) : null}
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
      {mode === 'multiple' && selectedOperations.length > 0 ? (
        <div style={{ marginBottom: 8 }}>
          <Space wrap size={[4, 4]}>
            {selectedOperations.map((op) => (
              <Tag
                key={op.uuid}
                closable
                onClose={() => onMultipleChange?.(multipleValue.filter((id) => id !== op.uuid))}
              >
                {op.code} - {op.name}
              </Tag>
            ))}
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
          background: token.colorFillAlter,
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: token.colorTextSecondary }}>
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
            onChange={(v) => handleMultipleChangeInView(v as string[])}
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
  /** 嵌套在 FormModal 内时传入，保证工序选择弹窗叠在父弹窗之上 */
  nestedModalZIndex?: number;
  /** 工序选择弹窗打开/关闭时通知父级（用于 Escape 等快捷键不关闭父弹窗） */
  onPickModalOpenChange?: (open: boolean) => void;
}

export const OperationSequenceEditor: React.FC<OperationSequenceEditorProps> = ({
  value = [],
  onChange,
  showNodeOperationColumn = false,
  showTimeColumns = false,
  nestedModalZIndex,
  onPickModalOpenChange,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const pickModalZIndex =
    nestedModalZIndex ??
    token.zIndexPopupBase + MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET + MODAL_NESTED_ABOVE_PARENT_OFFSET;
  const [operations, setOperations] = useState<OperationItem[]>(value);
  const [allOperations, setAllOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedOperationUuids, setSelectedOperationUuids] = useState<string[]>([]);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [operationFormModalOpen, setOperationFormModalOpen] = useState(false);
  const [replacingOperationUuid, setReplacingOperationUuid] = useState<string | null>(null);
  const [replacementOperationUuid, setReplacementOperationUuid] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    onPickModalOpenChange?.(addModalVisible || replaceModalVisible || operationFormModalOpen);
  }, [addModalVisible, replaceModalVisible, operationFormModalOpen, onPickModalOpenChange]);

  const loadAllOperations = useCallback(async () => {
    try {
      setLoading(true);
      const result = await operationApi.list({ isActive: true, limit: 1000 });
      setAllOperations(Array.isArray(result) ? result : result?.data ?? []);
    } catch (error: any) {
      message.error(error.message || t('app.master-data.operationSequence.loadListFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAllOperations();
  }, [loadAllOperations]);

  const handleOperationQuickCreateSuccess = useCallback(
    (created: Operation) => {
      setAllOperations((prev) => {
        if (prev.some((op) => op.uuid === created.uuid)) return prev;
        return [...prev, created];
      });
      if (addModalVisible && !operations.some((op) => op.uuid === created.uuid)) {
        setSelectedOperationUuids((prev) => [...new Set([...prev, created.uuid])]);
      }
      if (replaceModalVisible) {
        setReplacementOperationUuid(created.uuid);
      }
    },
    [addModalVisible, replaceModalVisible, operations],
  );

  const operationFormModalZIndex = pickModalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET;

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
  const sortableRowIds = useMemo(() => operations.map((op) => op.uuid), [operations]);

  const columns = [
    {
      title: t('app.master-data.operationSequence.index'),
      key: 'index',
      width: 100,
      render: (_: any, __: OperationItem, index: number) => (
        <SequenceIndexCell
          index={index}
          token={token}
          dragSortTitle={t('app.master-data.operationSequence.dragSort')}
        />
      ),
    },
    {
      title: t('app.master-data.operationSequence.operationCodeName'),
      key: 'operation',
      render: (_: any, record: OperationItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.code} - {record.name}</div>
          {record.description && <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>{record.description}</div>}
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
            width: 148,
            render: (_: unknown, record: OperationItem) => (
              <InputNumber
                size="small"
                min={0}
                precision={0}
                step={1}
                style={{ width: '100%' }}
                addonAfter={t('app.master-data.manufacturing.minutePerPieceUnit')}
                placeholder="0"
                value={record.standardTime}
                onChange={(v) => patchTime(record.uuid, { standardTime: v ?? undefined })}
              />
            ),
          },
          {
            title: t('app.master-data.manufacturing.setupTime'),
            key: 'setupTime',
            width: 136,
            render: (_: unknown, record: OperationItem) => (
              <InputNumber
                size="small"
                min={0}
                precision={0}
                step={1}
                style={{ width: '100%' }}
                addonAfter={t('app.master-data.manufacturing.minuteUnit')}
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
          <Button
            type="link"
            htmlType="button"
            size="small"
            style={{ padding: '0 4px', flexShrink: 0 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenReplaceModal(record.uuid);
            }}
          >
            {t('app.master-data.operationSequence.replace')}
          </Button>
          <Button
            type="link"
            danger
            htmlType="button"
            size="small"
            style={{ padding: '0 4px', flexShrink: 0 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteOperation(record.uuid);
            }}
          >
            {t('app.master-data.operationSequence.delete')}
          </Button>
        </div>
      ),
    },
  ];

  const activeOperation = activeId ? operations.find((op) => op.uuid === activeId) : null;

  const pickModals = (
    <>
      <Modal
        title={t('app.master-data.operationSequence.selectOperation')}
        open={addModalVisible}
        centered
        width={520}
        zIndex={pickModalZIndex}
        getContainer={() => document.body}
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
          onQuickAdd={() => setOperationFormModalOpen(true)}
        />
        {availableOperations.length === 0 && !loading && (
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('app.master-data.operationSequence.createOperationFirst')}
          </Typography.Text>
        )}
      </Modal>

      <Modal
        title={t('app.master-data.operationSequence.replaceOperation')}
        open={replaceModalVisible}
        centered
        width={520}
        zIndex={pickModalZIndex}
        getContainer={() => document.body}
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
          onQuickAdd={() => setOperationFormModalOpen(true)}
        />
        {getAvailableForReplace(replacingOperationUuid).length === 0 && !loading && (
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('app.master-data.operationSequence.createOperationFirst')}
          </Typography.Text>
        )}
      </Modal>

      <OperationFormModal
        open={operationFormModalOpen}
        onClose={() => setOperationFormModalOpen(false)}
        editUuid={null}
        onSuccess={handleOperationQuickCreateSuccess}
        zIndex={operationFormModalZIndex}
      />
    </>
  );

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>{t('app.master-data.operationSequence.hint')}</span>
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
                    wrapper: (wrapperProps: React.HTMLAttributes<HTMLTableSectionElement>) => {
                      const activeIndex = activeId ? operations.findIndex((op) => op.uuid === activeId) : -1;
                      const overIndex = overId ? operations.findIndex((op) => op.uuid === overId) : -1;
                      const showInsertLine =
                        activeId && overId && activeId !== overId && activeIndex !== -1 && overIndex !== -1;
                      const insertBefore = showInsertLine && activeIndex < overIndex;
                      const insertAfter = showInsertLine && activeIndex > overIndex;
                      const insertIndex = insertBefore ? overIndex : insertAfter ? overIndex + 1 : -1;
                      const rowChildren = React.Children.toArray(wrapperProps.children);
                      return (
                        <tbody {...wrapperProps}>
                          {rowChildren.map((child, idx) => {
                            const isInsertBefore = showInsertLine && insertIndex === idx && insertBefore;
                            const isInsertAfter = showInsertLine && insertIndex === idx && insertAfter;
                            return (
                              <React.Fragment key={sortableRowIds[idx] ?? idx}>
                                {isInsertBefore ? <InsertLineRow colSpan={tableColSpan} /> : null}
                                {child}
                                {isInsertAfter ? <InsertLineRow colSpan={tableColSpan} /> : null}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      );
                    },
                    row: SortableOperationTableRow,
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
            className="operation-sequence-editor-empty"
            style={{
              padding: 24,
              background: token.colorFillAlter,
              borderRadius: token.borderRadius,
              border: '1px dashed var(--river-border-color)',
              textAlign: 'center',
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
            <div style={{ padding: '12px 16px', background: token.colorBgElevated, border: `1px solid ${token.colorPrimary}`, borderRadius: token.borderRadius, boxShadow: token.boxShadowSecondary, width: '100%', minWidth: 300 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <HolderOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: token.colorText }}>{activeOperation.code} - {activeOperation.name}</div>
                  {activeOperation.description && <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>{activeOperation.description}</div>}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {typeof document !== 'undefined' ? createPortal(pickModals, document.body) : pickModals}
    </div>
  );
};
