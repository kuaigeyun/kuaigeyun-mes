/**
 * 工序序列编辑器
 * 支持手柄拖拽排序（原生 HTML5，仅手柄）、添加工序、替换工序、删除工序
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
import type { ColumnsType } from 'antd/es/table';
import { useSubmitShortcut } from '../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../utils/globalSubmitShortcut';
import { MODAL_ISOLATE_POINTER_PROPS } from '../../../utils/modalEventIsolation';
import { PlusOutlined } from '@ant-design/icons';
import { renderOperationReportingTypeMarker } from '../utils/operationMeta';
import { operationApi } from '../services/process';
import type { Operation } from '../types/process';
import { OperationFormModal } from './OperationFormModal';
import { supplierApi, unwrapSupplyPagedList } from '../services/supply-chain';
import {
  MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
  FILE_PREVIEW_OVERLAY_Z_INDEX,
} from '../../../components/layout-templates/constants';
import { SequenceIndexCell } from '../../../components/sequence-index-cell';

const operationPickModalStyles = {
  body: { paddingTop: 8, paddingBottom: 12 },
};

const OPERATION_ROW_DRAG_MIME = 'application/x-riveredge-operation-uuid';

function moveOperationList(items: OperationItem[], sourceUuid: string, targetUuid: string): OperationItem[] {
  const oldIndex = items.findIndex((op) => op.uuid === sourceUuid);
  const newIndex = items.findIndex((op) => op.uuid === targetUuid);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return items;
  const next = [...items];
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next;
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
        style={{ marginBottom: 8 }}
      />
      {mode === 'multiple' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.master-data.operationSequence.pickSelected', { count: multipleValue.length })}
          </Typography.Text>
          <Space size={0}>
            {onQuickAdd ? (
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={onQuickAdd}>
                {quickAddLabel ?? t('app.master-data.operationSequence.quickAddOperation')}
              </Button>
            ) : null}
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
      ) : onQuickAdd ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={onQuickAdd}>
            {quickAddLabel ?? t('app.master-data.operationSequence.quickAddOperation')}
          </Button>
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
  /** 计划工序委外（写入路线 operation_sequence） */
  isOutsourced?: boolean;
  outsourceLeadTimeDays?: number;
  outsourceSupplierId?: number;
  outsourceSupplierName?: string;
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
  const effectivePickModalZIndex = Math.max(pickModalZIndex, FILE_PREVIEW_OVERLAY_Z_INDEX);
  const operationFormModalZIndex = effectivePickModalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET;
  const selectPopupZIndex = effectivePickModalZIndex;
  const operations = value ?? [];
  const commitOperations = useCallback(
    (next: OperationItem[]) => {
      onChange?.(next);
    },
    [onChange],
  );
  const [allOperations, setAllOperations] = useState<Operation[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Array<{ value: number; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedOperationUuids, setSelectedOperationUuids] = useState<string[]>([]);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [operationFormModalOpen, setOperationFormModalOpen] = useState(false);
  const [replacingOperationUuid, setReplacingOperationUuid] = useState<string | null>(null);
  const [replacementOperationUuid, setReplacementOperationUuid] = useState<string | undefined>(undefined);
  const [draggingUuid, setDraggingUuid] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await supplierApi.list({ limit: 1000, isActive: true });
        const items = unwrapSupplyPagedList(result);
        if (cancelled) return;
        setSupplierOptions(
          items.map((s: { id?: number; code?: string; name?: string }) => ({
            value: Number(s.id),
            label: s.code ? `${s.code} ${s.name ?? ''}` : String(s.name ?? s.id),
          })).filter((o) => Number.isFinite(o.value) && o.value > 0),
        );
      } catch {
        if (!cancelled) setSupplierOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchOutsource = (uuid: string, patch: Partial<OperationItem>) => {
    commitOperations(
      operations.map((op) => (op.uuid === uuid ? { ...op, ...patch } : op)),
    );
  };

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

  const handleNativeDragStart = useCallback((uuid: string, e: React.DragEvent<HTMLSpanElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(OPERATION_ROW_DRAG_MIME, uuid);
    setDraggingUuid(uuid);
  }, []);

  const handleNativeDragEnd = useCallback(() => {
    setDraggingUuid(null);
  }, []);

  const handleNativeRowDragOver = useCallback((e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleNativeRowDrop = useCallback(
    (targetUuid: string, e: React.DragEvent<HTMLTableRowElement>) => {
      e.preventDefault();
      const sourceUuid = e.dataTransfer.getData(OPERATION_ROW_DRAG_MIME);
      if (!sourceUuid) {
        setDraggingUuid(null);
        return;
      }
      commitOperations(moveOperationList(operations, sourceUuid, targetUuid));
      setDraggingUuid(null);
    },
    [commitOperations, operations],
  );

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
    commitOperations([...operations, ...newItems]);
    setAddModalVisible(false);
    setSelectedOperationUuids([]);
    message.success(t('app.master-data.operationSequence.addSuccess', { count: newItems.length }));
  };

  const handleDeleteOperation = (uuid: string) => {
    const next = operations.filter((op) => op.uuid !== uuid);
    if (next.length === operations.length) {
      message.warning(t('app.master-data.operationSequence.replaceNotFound'));
      return;
    }
    commitOperations(next);
  };

  const toggleNodeOperation = (uuid: string, checked: boolean) => {
    commitOperations(operations.map((op) => (op.uuid === uuid ? { ...op, isNodeOperation: checked } : op)));
  };

  const patchOverReport = (uuid: string, patch: Partial<Pick<OperationItem, 'overReportMode' | 'overReportValue'>>) => {
    commitOperations(operations.map((op) => (op.uuid === uuid ? { ...op, ...patch } : op)));
  };

  const patchTime = (uuid: string, patch: Partial<Pick<OperationItem, 'standardTime' | 'setupTime'>>) => {
    commitOperations(operations.map((op) => (op.uuid === uuid ? { ...op, ...patch } : op)));
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
    commitOperations(newOperations);
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

  /** 与昨日布局一致：scroll.x ≥ 列宽之和，避免挤列；弹窗加宽后仍按列宽总和滚动 */
  const tableScrollX = useMemo(() => {
    let w = 100 + 220 + 120 + 88 + 100 + 180 + 320;
    if (showNodeOperationColumn) w += 88;
    if (showTimeColumns) w += 148 + 136;
    return w;
  }, [showNodeOperationColumn, showTimeColumns]);

  const selectPopupProps = useMemo(
    () => ({
      getPopupContainer: () => document.body,
      styles: { popup: { root: { zIndex: selectPopupZIndex } } },
    }),
    [selectPopupZIndex],
  );

  const columns: ColumnsType<OperationItem> = [
      {
        title: t('app.master-data.operationSequence.index'),
        key: 'index',
        width: 100,
        render: (_: unknown, record: OperationItem, index: number) => (
          <SequenceIndexCell
            index={index}
            token={token}
            dragSortTitle={t('app.master-data.operationSequence.dragSort')}
            nativeDragHandle={{
              isDragging: draggingUuid === record.uuid,
              onDragStart: (e) => handleNativeDragStart(record.uuid, e),
              onDragEnd: handleNativeDragEnd,
            }}
          />
        ),
      },
      {
        title: t('app.master-data.operationSequence.operationCodeName'),
        key: 'operation',
        width: 220,
        ellipsis: true,
        render: (_: unknown, record: OperationItem) => (
          <div style={{ whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 500 }}>
              {record.code} - {record.name}
            </div>
            {record.description ? (
              <div
                style={{
                  fontSize: 12,
                  color: token.colorTextSecondary,
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {record.description}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: t('app.master-data.operationSequence.reportingType'),
        key: 'reportingType',
        width: 120,
        render: (_: unknown, record: OperationItem) =>
          renderOperationReportingTypeMarker(t, record.reportingType),
      },
      ...(showNodeOperationColumn
        ? [
            {
              title: t('app.master-data.operationSequence.nodeOperation'),
              key: 'isNodeOperation',
              width: 88,
              render: (_: unknown, record: OperationItem) => (
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
        title: t('app.master-data.operationSequence.plannedOutsource'),
        key: 'isOutsourced',
        width: 88,
        render: (_: unknown, record: OperationItem) => (
          <Switch
            size="small"
            checked={!!record.isOutsourced}
            onChange={(c) =>
              patchOutsource(record.uuid, {
                isOutsourced: c,
                outsourceLeadTimeDays: c ? record.outsourceLeadTimeDays ?? 1 : undefined,
                outsourceSupplierId: c ? record.outsourceSupplierId : undefined,
                outsourceSupplierName: c ? record.outsourceSupplierName : undefined,
              })
            }
          />
        ),
      },
      {
        title: t('app.master-data.operationSequence.outsourceLeadDays'),
        key: 'outsourceLeadTimeDays',
        width: 100,
        render: (_: unknown, record: OperationItem) => (
          <InputNumber
            size="small"
            min={0}
            precision={0}
            style={{ width: '100%' }}
            disabled={!record.isOutsourced}
            value={record.isOutsourced ? record.outsourceLeadTimeDays ?? 1 : undefined}
            onChange={(v) =>
              patchOutsource(record.uuid, {
                outsourceLeadTimeDays: v == null ? 1 : Number(v),
              })
            }
          />
        ),
      },
      {
        title: t('app.master-data.operationSequence.outsourceSupplier'),
        key: 'outsourceSupplierId',
        width: 180,
        render: (_: unknown, record: OperationItem) => (
          <Select
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            disabled={!record.isOutsourced}
            options={supplierOptions}
            value={record.outsourceSupplierId}
            placeholder={t('app.master-data.operationSequence.selectOutsourceSupplier')}
            {...selectPopupProps}
            onChange={(v, opt) => {
              const label = Array.isArray(opt)
                ? undefined
                : (opt as { label?: string } | undefined)?.label;
              patchOutsource(record.uuid, {
                outsourceSupplierId: v == null ? undefined : Number(v),
                outsourceSupplierName: v == null ? undefined : String(label || ''),
              });
            }}
          />
        ),
      },
      {
        title: t('app.master-data.operationSequence.overReportAction'),
        key: 'action',
        width: 320,
        render: (_: unknown, record: OperationItem) => (
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
              value={record.overReportMode ?? 'none'}
              options={[
                { label: t('field.operation.overReportModeNone'), value: 'none' },
                { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
                { label: t('field.operation.overReportModePercent'), value: 'percent' },
              ]}
              {...selectPopupProps}
              onChange={(v) =>
                patchOverReport(record.uuid, { overReportMode: v as OperationItem['overReportMode'] })
              }
            />
            <InputNumber
              size="small"
              min={0}
              style={{ width: 88, flexShrink: 0 }}
              value={record.overReportValue ?? 0}
              onChange={(v) => patchOverReport(record.uuid, { overReportValue: v ?? 0 })}
            />
            <Button type="link" size="small" style={{ paddingInline: 4, flexShrink: 0 }} onClick={() => handleOpenReplaceModal(record.uuid)}>
              {t('app.master-data.operationSequence.replace')}
            </Button>
            <Button type="link" size="small" danger style={{ paddingInline: 4, flexShrink: 0 }} onClick={() => handleDeleteOperation(record.uuid)}>
              {t('app.master-data.operationSequence.delete')}
            </Button>
          </div>
        ),
      },
    ];

  const pickModals = (
    <>
      <Modal
        title={t('app.master-data.operationSequence.selectOperation')}
        open={addModalVisible}
        centered
        width={520}
        zIndex={effectivePickModalZIndex}
        getContainer={() => document.body}
        destroyOnHidden
        styles={operationPickModalStyles}
        maskProps={{ ...MODAL_ISOLATE_POINTER_PROPS }}
        wrapProps={{ ...MODAL_ISOLATE_POINTER_PROPS }}
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
        zIndex={effectivePickModalZIndex}
        getContainer={() => document.body}
        destroyOnHidden
        styles={operationPickModalStyles}
        maskProps={{ ...MODAL_ISOLATE_POINTER_PROPS }}
        wrapProps={{ ...MODAL_ISOLATE_POINTER_PROPS }}
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
        {operations.length > 0 ? (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)} size="small">
            {t('app.master-data.operationSequence.addOperation')}
          </Button>
        ) : null}
      </div>
      {operations.length > 0 ? (
        <div style={{ position: 'relative', width: '100%', margin: 0, padding: 0 }}>
          <Table
            className="operation-sequence-editor-table"
            columns={columns}
            dataSource={operations}
            rowKey="uuid"
            pagination={false}
            size="small"
            style={{ width: '100%' }}
            scroll={{ x: tableScrollX }}
            onRow={(record) => ({
              onDragOver: handleNativeRowDragOver,
              onDrop: (e) => handleNativeRowDrop(record.uuid, e),
            })}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.master-data.operationSequence.noData')} /> }}
          />
        </div>
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

      {typeof document !== 'undefined' ? createPortal(pickModals, document.body) : pickModals}
    </div>
  );
};
