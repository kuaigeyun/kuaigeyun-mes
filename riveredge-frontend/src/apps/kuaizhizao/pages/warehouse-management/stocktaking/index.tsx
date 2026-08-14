/**
 * 库存盘点管理页面
 *
 * 提供库存盘点单的管理功能，包括创建盘点单、执行盘点、处理差异等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Row, Col, InputNumber, Descriptions, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, PlayCircleOutlined, CheckCircleOutlined, DatabaseOutlined, RollbackOutlined } from '@ant-design/icons';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, detailDrawerDescriptionItems, detailDrawerBasicColumn, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { stocktakingApi, inventoryReportApi } from '../../../services/stocktaking';
import { getStocktakingLifecycle } from '../../../utils/stocktakingLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import dayjs from 'dayjs';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import { formDateRangeFormItemProps, toApiDateTimeString, nowSiteDateTimeString } from '../../../../../utils/formDate';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { renderStocktakingTypeMarkerTag } from '../shared/warehouseMarkerTags';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildStocktakingTypeValueEnum,
  buildWarehouseWorkflowStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveStocktakingListParams,
} from '../../../utils/warehouseListCore';
import { getAntdModal } from '../../../../../utils/antdAppApis';

interface Stocktaking {
  id?: number;
  uuid?: string;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  stocktaking_date?: string;
  status?: string;
  stocktaking_type?: string;
  line_granularity?: string;
  include_zero_stock?: boolean;
  total_items?: number;
  counted_items?: number;
  total_differences?: number;
  total_difference_amount?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  items?: StocktakingItem[];
}

interface StocktakingItem {
  id?: number;
  uuid?: string;
  stocktaking_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  warehouse_id?: number;
  location_id?: number;
  location_code?: string;
  batch_no?: string;
  book_quantity?: number;
  actual_quantity?: number;
  difference_quantity?: number;
  unit_price?: number;
  difference_amount?: number;
  counted_by?: number;
  counted_by_name?: string;
  counted_at?: string;
  status?: string;
  remarks?: string;
}

const STOCKTAKING_RESOURCE = 'kuaizhizao:warehouse-management-stocktaking';

const granularityLabel = (value: string | undefined, t: (key: string) => string) =>
  value === 'material' ? t('app.kuaizhizao.stocktaking.granularityMaterial') : t('app.kuaizhizao.stocktaking.granularityBatch');

const StocktakingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { canCreate, canUpdate, canDelete, canAction } = useResourcePermissions(STOCKTAKING_RESOURCE);
  const canRevoke = canAction?.('revoke') ?? false;

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [inventoryPickerVisible, setInventoryPickerVisible] = useState(false);
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentStocktaking, setCurrentStocktaking] = useState<Stocktaking | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [editingActualQty, setEditingActualQty] = useState<Record<number, number>>({});

  const [currentStocktakingForItem, setCurrentStocktakingForItem] = useState<Stocktaking | null>(null);
  const [inventoryRows, setInventoryRows] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedInventoryKeys, setSelectedInventoryKeys] = useState<React.Key[]>([]);

  /**
   * 处理创建盘点单
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        stocktaking_date: dayjs(),
        stocktaking_type: 'full',
        line_granularity: 'batch',
        include_zero_stock: false,
      });
    }, 0);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.stocktaking.createButton')),
    [t],
  );

  /**
   * 处理提交创建盘点单
   */
  const handleCreateSubmit = async (values: any) => {
    try {
      await stocktakingApi.create({
        warehouse_id: values.warehouse_id,
        // 名称以后端按 warehouse_id 解析为准；有值时一并提交作首选
        ...(values._warehouse_name ? { warehouse_name: values._warehouse_name } : {}),
        stocktaking_date: toApiDateTimeString(values.stocktaking_date) ?? nowSiteDateTimeString(),
        stocktaking_type: values.stocktaking_type || 'full',
        line_granularity: values.line_granularity || 'batch',
        include_zero_stock: Boolean(values.include_zero_stock),
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.stocktaking.msgCreateSuccess'));
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgCreateFailed'));
      throw error;
    }
  };

  const refreshCurrentDetail = useCallback(async (stocktakingId: number) => {
    const detail = await stocktakingApi.get(stocktakingId.toString());
    setCurrentStocktaking(detail);
    return detail;
  }, []);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Stocktaking) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setCurrentStocktaking(null);
    try {
      await refreshCurrentDetail(record.id!);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgGetDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理开始盘点
   */
  const handleStart = async (record: Stocktaking) => {
    const isFull = record.stocktaking_type === 'full';
    const content = isFull
      ? t('app.kuaizhizao.stocktaking.msgStartFullContent', {
          granularity: granularityLabel(record.line_granularity, t),
          warehouse: record.warehouse_name || '',
        })
      : t('app.kuaizhizao.stocktaking.msgStartPartialContent', { code: record.code });

    getAntdModal().confirm({
      title: t('app.kuaizhizao.stocktaking.msgStartTitle'),
      content,
      onOk: async () => {
        try {
          await stocktakingApi.start(record.id!.toString(), {
            line_granularity: record.line_granularity,
            include_zero_stock: record.include_zero_stock,
          });
          messageApi.success(t('app.kuaizhizao.stocktaking.msgStartSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          await refreshCurrentDetail(record.id!);
          setDetailDrawerVisible(true);
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgStartFailed'));
        }
      },
    });
  };

  const isPartialType = (record?: Stocktaking | null) =>
    record?.stocktaking_type === 'partial' || record?.stocktaking_type === 'cycle';

  /**
   * 处理添加盘点明细（抽盘手工加行）
   */
  const handleAddItem = (record: Stocktaking) => {
    setCurrentStocktakingForItem(record);
    setItemModalVisible(true);
    itemFormRef.current?.resetFields();
  };

  const loadInventoryPicker = async (record: Stocktaking) => {
    if (!record.warehouse_id) {
      messageApi.error(t('app.kuaizhizao.stocktaking.msgNoWarehouse'));
      return;
    }
    setInventoryLoading(true);
    try {
      const params = {
        warehouse_id: record.warehouse_id,
        include_zero_stock: false,
        current: 1,
        page_size: 500,
      };
      const result = record.line_granularity === 'material'
        ? await inventoryReportApi.materialBalances(params)
        : await inventoryReportApi.batchLines(params);
      setInventoryRows(result.items || result.data || []);
      setSelectedInventoryKeys([]);
      setInventoryPickerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgLoadInventoryFailed'));
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleInventoryPickerSubmit = async () => {
    if (!currentStocktaking?.id) return;
    const selected = inventoryRows.filter((row) => selectedInventoryKeys.includes(row.id));
    if (!selected.length) {
      messageApi.warning(t('app.kuaizhizao.stocktaking.msgSelectInventory'));
      return;
    }
    try {
      await stocktakingApi.bulkCreateItems(
        currentStocktaking.id.toString(),
        selected.map((row) => ({
          stocktaking_id: currentStocktaking.id,
          material_id: row.material_id,
          material_code: row.material_code,
          material_name: row.material_name,
          batch_no: row.batch_no,
          unit_price: 0,
        })),
      );
      messageApi.success(t('app.kuaizhizao.stocktaking.msgBulkAddSuccess', { count: selected.length }));
      setInventoryPickerVisible(false);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      await refreshCurrentDetail(currentStocktaking.id);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgBulkAddFailed'));
    }
  };

  /**
   * 处理提交添加盘点明细
   */
  const handleAddItemSubmit = async (values: any) => {
    try {
      if (!currentStocktakingForItem?.id) {
        messageApi.error(t('app.kuaizhizao.stocktaking.msgStocktakingIdNotFound'));
        return;
      }

      const materialCode = String(values.material_code || '').trim();
      const materialName = String(values.material_name || '').trim();
      if (!values.material_id || !materialCode) {
        messageApi.error(t('app.kuaizhizao.warehouseCommon.materialNotFound'));
        return;
      }

      await stocktakingApi.createItem(currentStocktakingForItem.id.toString(), {
        stocktaking_id: currentStocktakingForItem.id,
        material_id: values.material_id,
        material_code: materialCode,
        material_name: materialName,
        material_unit: String(values.material_unit || '').trim(),
        warehouse_id: currentStocktakingForItem.warehouse_id,
        location_code: values.location_code,
        batch_no: values.batch_no,
        unit_price: values.unit_price || 0,
        remarks: values.remarks,
      });
      const stocktakingId = currentStocktakingForItem.id;
      messageApi.success(t('app.kuaizhizao.stocktaking.msgAddItemSuccess'));
      setItemModalVisible(false);
      setCurrentStocktakingForItem(null);
      itemFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      if (currentStocktaking?.id === stocktakingId) {
        await refreshCurrentDetail(stocktakingId);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgAddItemFailed'));
      throw error;
    }
  };

  const handleSaveActualQuantity = async (item: StocktakingItem) => {
    if (!currentStocktaking?.id || !item.id) return;
    const actualQty = editingActualQty[item.id] ?? item.actual_quantity ?? item.book_quantity ?? 0;
    setSavingItemId(item.id);
    try {
      await stocktakingApi.executeItem(
        currentStocktaking.id.toString(),
        item.id.toString(),
        Number(actualQty),
        item.remarks,
      );
      messageApi.success(t('app.kuaizhizao.stocktaking.msgSaveActualSuccess'));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      await refreshCurrentDetail(currentStocktaking.id);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgSaveActualFailed'));
    } finally {
      setSavingItemId(null);
    }
  };

  const canComplete = (record?: Stocktaking | null) =>
    record?.status === 'in_progress'
    && (record.total_items ?? 0) > 0
    && record.counted_items === record.total_items;

  const handleComplete = async (record: Stocktaking) => {
    const hasDiff = (record.total_differences ?? 0) > 0;
    getAntdModal().confirm({
      title: t('app.kuaizhizao.stocktaking.msgCompleteTitle'),
      content: hasDiff
        ? t('app.kuaizhizao.stocktaking.msgCompleteWithDiff', {
            code: record.code,
            count: record.total_differences,
          })
        : t('app.kuaizhizao.stocktaking.msgCompleteNoDiff', { code: record.code }),
      onOk: async () => {
        try {
          await stocktakingApi.complete(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.stocktaking.msgCompleteSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (detailDrawerVisible && currentStocktaking?.id === record.id) {
            await refreshCurrentDetail(record.id!);
          }
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgCompleteFailed'));
        }
      },
    });
  };

  const handleWithdraw = (record: Stocktaking) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.stocktaking.msgWithdrawTitle'),
      content: t('app.kuaizhizao.stocktaking.msgWithdrawContent', { code: record.code }),
      okText: t('app.kuaizhizao.stocktaking.actionWithdraw'),
      onOk: async () => {
        try {
          await stocktakingApi.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.stocktaking.msgWithdrawSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (detailDrawerVisible && currentStocktaking?.id === record.id) {
            await refreshCurrentDetail(record.id!);
          }
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.stocktaking.msgWithdrawFailed'));
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const workflowStatusValueEnum = useMemo(() => buildWarehouseWorkflowStatusValueEnum(t), [t]);
  const stocktakingTypeValueEnum = useMemo(() => buildStocktakingTypeValueEnum(t), [t]);

  const columns: ProColumns<Stocktaking>[] = useMemo(() => alignProColumns<Stocktaking>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: workflowStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.stocktaking.colStocktakingType'),
      dataIndex: 'stocktaking_type',
      valueType: 'select',
      valueEnum: stocktakingTypeValueEnum,
      hideInTable: true,
      search: { order: 30 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.stocktaking.colStocktakingDate'),
      dataIndex: 'stocktaking_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 40 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.stocktaking.colWarehouseAndCode'),
      key: 'code',
      dataIndex: 'code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      search: { order: 50 } as ProColumns['search'],
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.warehouse_name ?? '')}
          secondary={String(r.code ?? '')}
        />
      ),
    },
    { title: t('app.kuaizhizao.warehouseReports.colStocktakingCode'), dataIndex: 'code', hideInTable: true, hideInSearch: true },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
      hideInTable: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.stocktaking.colStocktakingDate'),
      dataIndex: 'stocktaking_date',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.stocktaking.colStocktakingType'),
      dataIndex: 'stocktaking_type',
      width: 100,
      sorter: true,
      hideInSearch: true,
      valueEnum: stocktakingTypeValueEnum,
      render: (_, record) => renderStocktakingTypeMarkerTag(t, record.stocktaking_type),
    },
    {
      title: t('app.kuaizhizao.stocktaking.colTotalItems'),
      dataIndex: 'total_items',
      width: 120,
      align: 'right',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.stocktaking.colCountedItems'),
      dataIndex: 'counted_items',
      width: 120,
      align: 'right',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.stocktaking.colTotalDiff'),
      dataIndex: 'total_differences',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <span style={{ color: record.total_differences! > 0 ? '#ff4d4f' : '#52c41a' }}>
          {record.total_differences || 0}
        </span>
      ),
    },
    {
      title: t('app.kuaizhizao.stocktaking.colTotalDiffAmount'),
      dataIndex: 'total_difference_amount',
      width: 120,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => {
        const amount = Number(record.total_difference_amount ?? 0);
        return (
          <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a' }}>
            ¥{amount.toFixed(2)}
          </span>
        );
      },
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getStocktakingLifecycle(record as Record<string, unknown>, t);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'draft' && canUpdate && (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleStart(record)}>
              {t('app.kuaizhizao.stocktaking.actionStart')}
            </Button>
          )}
          {record.status === 'draft' && isPartialType(record) && canCreate && (
            <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
              {t('app.kuaizhizao.stocktaking.actionAddItem')}
            </Button>
          )}
          {record.status === 'in_progress' && isPartialType(record) && canCreate && (
            <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
              {t('app.kuaizhizao.stocktaking.actionAddItem')}
            </Button>
          )}
          {record.status === 'in_progress' && canComplete(record) && canUpdate && (
            <Button {...rowActionKind('complete')} {...rowActionLabelKeep()} onClick={() => handleComplete(record)}>
              {t('app.kuaizhizao.stocktaking.actionComplete')}
            </Button>
          )}
          {record.status === 'in_progress' && canRevoke && (
            <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()} onClick={() => handleWithdraw(record)}>
              {t('app.kuaizhizao.stocktaking.actionWithdraw')}
            </Button>
          )}
        </Space>
      ),
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK), [t, canUpdate, canCreate, canRevoke, workflowStatusValueEnum, stocktakingTypeValueEnum]);

  const detailColumns = useMemo(() => alignDescriptionColumns([
    {
      title: t('app.kuaizhizao.warehouseReports.colStocktakingCode'),
      dataIndex: 'code',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
    },
    {
      title: t('app.kuaizhizao.stocktaking.colStocktakingDate'),
      dataIndex: 'stocktaking_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.stocktaking.colStocktakingType'),
      dataIndex: 'stocktaking_type',
      render: (_: unknown, entity: Stocktaking) =>
        renderStocktakingTypeMarkerTag(t, entity.stocktaking_type),
    },
    {
      title: t('app.kuaizhizao.stocktaking.formLineGranularity'),
      dataIndex: 'line_granularity',
      render: (_: unknown, entity: Stocktaking) => granularityLabel(entity.line_granularity, t),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      valueEnum: {
        draft: { text: t('app.kuaizhizao.warehouseCommon.statusDraft'), status: 'default' },
        in_progress: { text: t('app.kuaizhizao.stocktaking.statusInProgress'), status: 'processing' },
        completed: { text: t('app.kuaizhizao.warehouseCommon.statusCompleted'), status: 'success' },
        cancelled: { text: t('app.kuaizhizao.warehouseCommon.statusCancelled'), status: 'error' },
      },
    },
    {
      title: t('app.kuaizhizao.stocktaking.colTotalItems'),
      dataIndex: 'total_items',
    },
    {
      title: t('app.kuaizhizao.stocktaking.colCountedItems'),
      dataIndex: 'counted_items',
    },
    {
      title: t('app.kuaizhizao.stocktaking.colTotalDiff'),
      dataIndex: 'total_differences',
    },
    {
      title: t('app.kuaizhizao.stocktaking.colTotalDiffAmount'),
      dataIndex: 'total_difference_amount',
      render: (dom: React.ReactNode, entity: Stocktaking) => `¥${Number(entity.total_difference_amount ?? 0).toFixed(2)}`,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colRemarks'),
      dataIndex: 'remarks',
      span: 3,
    },
  ]), [t]);

  const inventoryPickerColumns = useMemo(() => [
    { title: t('app.kuaizhizao.warehouseReports.colMaterialCode'), dataIndex: 'material_code', width: 120 },
    { title: t('app.kuaizhizao.warehouseReports.colMaterialName'), dataIndex: 'material_name', width: 160 },
    { title: t('app.kuaizhizao.warehouseReports.colBatchNo'), dataIndex: 'batch_no', width: 120, render: (v: string) => v || '-' },
    {
      title: t('app.kuaizhizao.warehouseReports.colBookQty'),
      dataIndex: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (v: number) => formatQuantity(v),
    },
  ], [t]);

  const detailItemColumns = useMemo(() => [
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
      dataIndex: 'material_code',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
      dataIndex: 'material_name',
      width: 150,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
      dataIndex: 'material_unit',
      width: 72,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colBatchNo'),
      dataIndex: 'batch_no',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colBookQty'),
      dataIndex: 'book_quantity',
      width: 120,
      align: 'right' as const,
      render: (v: number, item: StocktakingItem) => formatQuantityWithUnit(v, item.material_unit),
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colActualQty'),
      dataIndex: 'actual_quantity',
      width: 140,
      align: 'right' as const,
      render: (_: unknown, item: StocktakingItem) => {
        if (currentStocktaking?.status !== 'in_progress' || item.status !== 'pending') {
          return formatQuantityWithUnit(item.actual_quantity, item.material_unit);
        }
        const itemId = item.id!;
        return (
          <InputNumber
            size="small"
            min={0}
            precision={2}
            style={{ width: '100%' }}
            value={editingActualQty[itemId] ?? item.actual_quantity ?? item.book_quantity ?? 0}
            onChange={(val) => {
              setEditingActualQty((prev) => ({ ...prev, [itemId]: Number(val ?? 0) }));
            }}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colDiffQty'),
      dataIndex: 'difference_quantity',
      width: 100,
      align: 'right' as const,
      render: (value: number) => {
        const qty = Number(value ?? 0);
        return (
          <span style={{ color: qty > 0 ? '#ff4d4f' : qty < 0 ? '#1890ff' : '#52c41a' }}>
            {qty > 0 ? '+' : ''}{formatQuantity(qty)}
          </span>
        );
      },
    },
    {
      title: t('app.kuaizhizao.stocktaking.colDiffAmount'),
      dataIndex: 'difference_amount',
      width: 100,
      align: 'right' as const,
      render: (value: number) => {
        const amount = Number(value ?? 0);
        return (
          <span style={{ color: amount > 0 ? '#ff4d4f' : amount < 0 ? '#1890ff' : '#52c41a' }}>
            ¥{amount.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          pending: { text: t('app.kuaizhizao.stocktaking.statusItemPending'), color: 'default' },
          counted: { text: t('app.kuaizhizao.stocktaking.statusItemCounted'), color: 'processing' },
          adjusted: { text: t('app.kuaizhizao.stocktaking.statusItemAdjusted'), color: 'success' },
        };
        const statusInfo = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 100,
      render: (_: unknown, item: StocktakingItem) => (
        currentStocktaking?.status === 'in_progress' && item.status === 'pending' && canUpdate ? (
          <Button
            type="link"
            size="small"
            loading={savingItemId === item.id}
            onClick={() => handleSaveActualQuantity(item)}
          >
            {t('app.kuaizhizao.warehouseCommon.save')}
          </Button>
        ) : null
      ),
    },
  ], [t, currentStocktaking, editingActualQty, savingItemId, canUpdate]);

  const detailCollaboration = useMemo(() => {
    if (!currentStocktaking) return undefined;
    const lifecycle = getStocktakingLifecycle(currentStocktaking as Record<string, unknown>, t);
    const mainStages = lifecycle.mainStages ?? [];
    if (!mainStages.length) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={lifecycle.status}
        showLabels
        nextStepSuggestions={lifecycle.nextStepSuggestions}
      />
    );
  }, [currentStocktaking, t]);

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaizhizao.stocktaking.headerTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.stocktaking.v2"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        showCreateButton={canCreate}
        createButtonText={createButtonLabel}
        onCreate={canCreate ? handleCreate : undefined}
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
            const listParams = resolveStocktakingListParams(searchFormValues, sort);
            const result = await stocktakingApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              ...listParams,
              status: lifecycleStage ?? listParams.status,
            });
            const { data, total } = normalizeWarehouseListResponse(result);
            return { data, success: true, total };
          } catch {
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={canDelete}
        showDeleteButton={canDelete}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await stocktakingApi.delete(String(id));
            }
            messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: keys.length }));
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || t('app.kuaizhizao.warehouseCommon.deleteFailed'));
          }
        }}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.stocktaking.deleteConfirm', { count })}
      />

      {/* 创建盘点单Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.stocktaking.modalCreate')}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        grid={false}
        {...MODAL_CONFIG}
      >
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseReports.colWarehouse')}
              placeholder={t('app.kuaizhizao.stocktaking.formWarehousePlaceholder')}
              required
              onChange={(_value, warehouse) => {
                const name =
                  (warehouse as { name?: string; warehouse_name?: string } | undefined)?.name
                  || (warehouse as { name?: string; warehouse_name?: string } | undefined)?.warehouse_name
                  || '';
                formRef.current?.setFieldsValue({ _warehouse_name: name });
              }}
            />
            <ProFormText name="_warehouse_name" hidden />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="stocktaking_date"
              label={t('app.kuaizhizao.stocktaking.colStocktakingDate')}
              rules={[{ required: true, message: t('app.kuaizhizao.stocktaking.formStocktakingDateRequired') }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="stocktaking_type"
              label={t('app.kuaizhizao.stocktaking.formStocktakingType')}
              rules={[{ required: true, message: t('app.kuaizhizao.stocktaking.formStocktakingTypeRequired') }]}
              options={[
                { label: t('app.kuaizhizao.stocktaking.typeFull'), value: 'full' },
                { label: t('app.kuaizhizao.stocktaking.typePartial'), value: 'partial' },
                { label: t('app.kuaizhizao.stocktaking.typeCycle'), value: 'cycle' },
              ]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="line_granularity"
              label={t('app.kuaizhizao.stocktaking.formLineGranularity')}
              rules={[{ required: true, message: t('app.kuaizhizao.stocktaking.formLineGranularityRequired') }]}
              options={[
                { label: t('app.kuaizhizao.stocktaking.granularityBatch'), value: 'batch' },
                { label: t('app.kuaizhizao.stocktaking.granularityMaterial'), value: 'material' },
              ]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSwitch name="include_zero_stock" label={t('app.kuaizhizao.stocktaking.formIncludeZeroStock')} />
          </Col>
          <Col span={12} />
        </Row>
        <DocumentAttachmentsField category="stocktaking_attachments" />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 添加盘点明细Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.stocktaking.modalAddItem')}
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentStocktakingForItem(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={handleAddItemSubmit}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <UniMaterialSelect
          name="material_id"
          label={t('app.kuaizhizao.warehouseCommon.colMaterial')}
          placeholder={t('app.kuaizhizao.warehouseCommon.selectMaterial')}
          required
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
            material_unit: 'baseUnit',
          }}
          showQuickCreate
          showAdvancedSearch
        />
        <ProFormDigit
          name="unit_price"
          label={t('app.kuaizhizao.warehouseCommon.colUnitPrice')}
          placeholder={t('app.kuaizhizao.warehouseCommon.colUnitPrice')}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="location_code"
          label={t('app.kuaizhizao.stocktaking.formLocationCodeOptional')}
          placeholder={t('app.kuaizhizao.stocktaking.formLocationCodePlaceholder')}
        />
        <ProFormText
          name="batch_no"
          label={t('app.kuaizhizao.stocktaking.formBatchNoOptional')}
          placeholder={t('app.kuaizhizao.stocktaking.formBatchNoPlaceholder')}
        />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <Modal
        title={t('app.kuaizhizao.stocktaking.modalInventoryPicker')}
        open={inventoryPickerVisible}
        onCancel={() => setInventoryPickerVisible(false)}
        onOk={handleInventoryPickerSubmit}
        width={900}
        okText={t('app.kuaizhizao.stocktaking.modalInventoryPickerOk')}
      >
        <Table
          rowKey="id"
          loading={inventoryLoading}
          dataSource={inventoryRows}
          rowSelection={{
            selectedRowKeys: selectedInventoryKeys,
            onChange: setSelectedInventoryKeys,
          }}
          pagination={false}
          scroll={{ y: 400 }}
          size="small"
          columns={inventoryPickerColumns}
        />
      </Modal>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.stocktaking.detailTitle')}${currentStocktaking?.code ? ` - ${currentStocktaking.code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentStocktaking(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentStocktaking?.status === 'in_progress' ? (
            <Space>
              {isPartialType(currentStocktaking) && canCreate && (
                <>
                  <Button
                    icon={<DatabaseOutlined />}
                    onClick={() => loadInventoryPicker(currentStocktaking)}
                  >
                    {t('app.kuaizhizao.stocktaking.actionPickFromInventory')}
                  </Button>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => handleAddItem(currentStocktaking)}
                  >
                    {t('app.kuaizhizao.stocktaking.actionManualAddItem')}
                  </Button>
                </>
              )}
              {canComplete(currentStocktaking) && canUpdate && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleComplete(currentStocktaking)}
                >
                  {t('app.kuaizhizao.stocktaking.actionComplete')}
                </Button>
              )}
              {canRevoke && (
                <Button icon={<RollbackOutlined />} onClick={() => handleWithdraw(currentStocktaking)}>
                  {t('app.kuaizhizao.stocktaking.actionWithdraw')}
                </Button>
              )}
            </Space>
          ) : null
        }
        basic={
          currentStocktaking ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={detailDrawerDescriptionItems(detailColumns, currentStocktaking)}
            />
          ) : undefined
        }
        collaboration={detailCollaboration}
        linesTitle={t('app.kuaizhizao.stocktaking.detailItemsTitle')}
        lines={
          currentStocktaking ? (
            currentStocktaking.items && currentStocktaking.items.length > 0 ? (
              <>
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <Table
                  className="warehouse-detail-table"
                  columns={detailItemColumns}
                  dataSource={currentStocktaking.items}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 1000 }}
                />
              </>
            ) : (
              <Typography.Text type="secondary">
                {currentStocktaking.status === 'draft'
                  ? t('app.kuaizhizao.stocktaking.emptyDraftHint')
                  : t('app.kuaizhizao.stocktaking.emptyNoItems')}
              </Typography.Text>
            )
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

export default StocktakingPage;
