/**
 * 借料单管理页面
 *
 * 提供借料单的创建、查看、确认和管理功能（无工单借料：工具间、研发等）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, DatePicker, Descriptions, Form as AntForm, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import CodeField from '../../../../../components/code-field';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import {   useDetailDrawerDescriptionItems, detailDrawerBasicColumn, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getMaterialBorrowLifecycle } from '../../../utils/materialBorrowLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { DocumentLineUnitSelect } from '../../../../../components/quantity-with-unit';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { useTranslation } from 'react-i18next';
import { useNumericPrecisionPlaces } from '../../../../../hooks/useNumericPrecision';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import { getDepartmentTree } from '../../../../../services/department';
import { FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { formatDateTime, formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
  renderDocumentLineMaterialsPreview,
} from '../../sales-management/shared/documentLineMaterialsPreview';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildMaterialBorrowStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveWarehouseDocListParams,
} from '../../../utils/warehouseListCore';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
interface MaterialBorrow {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  borrow_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  borrower_id?: number;
  borrower_name?: string;
  department?: string;
  expected_return_date?: string;
  borrow_time?: string;
  status?: string;
  total_quantity?: number;
  total_items?: number;
  /** 列表「明细」列预览（仅 material_name） */
  items?: { material_name?: string }[];
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface MaterialBorrowDetail extends MaterialBorrow {
  items?: MaterialBorrowItem[];
}

interface MaterialBorrowItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  borrow_quantity?: number;
  returned_quantity?: number;
  status?: string;
}

const MATERIAL_BORROW_STATUS_I18N: Record<string, string> = {
  '待借出': 'app.kuaizhizao.materialBorrow.status.pending',
  '已借出': 'app.kuaizhizao.materialBorrow.status.borrowed',
  '已取消': 'app.kuaizhizao.materialBorrow.status.cancelled',
};

function translateMaterialBorrowStatus(t: (key: string) => string, status?: string): string {
  if (!status) return '-';
  const key = MATERIAL_BORROW_STATUS_I18N[status];
  return key ? t(key) : status;
}

const MaterialBorrowsPage: React.FC = () => {
  const { t } = useTranslation();
  const quantityDecimals = useNumericPrecisionPlaces('quantity');
  const [searchParams] = useSearchParams();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const deepLinkOpenedRef = useRef(false);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [borrowDetail, setBorrowDetail] = useState<MaterialBorrowDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ label: string; value: string }>>([]);
  const {
    selectedWarehouseId,
    locationOptions,
    updateSelectedWarehouseId,
    resetSelectedWarehouseId,
  } = useWarehouseLocationOptions();
  const defaultBorrowItem = {
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_unit: '',
    location_code: undefined,
    borrow_quantity: 1,
  };

  useEffect(() => {
    const load = async () => {
      try {
        const wh = await masterDataWarehouseApi.list({ limit: 1000, is_active: true });
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.items || []);
      } catch (e) {
        console.error('加载仓库失败', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const flatten = (items: any[] | undefined): Array<{ label: string; value: string }> => {
      if (!Array.isArray(items)) return [];
      const out: Array<{ label: string; value: string }> = [];
      const walk = (nodes: any[], prefix = '') => {
        nodes.forEach((node) => {
          const name = String(node?.name ?? '').trim();
          const uuid = String(node?.uuid ?? '').trim();
          if (name && uuid) {
            out.push({ label: prefix ? `${prefix} / ${name}` : name, value: uuid });
          }
          if (Array.isArray(node?.children) && node.children.length > 0) {
            walk(node.children, prefix ? `${prefix} / ${name}` : name);
          }
        });
      };
      walk(items);
      return out;
    };
    const loadDepartments = async () => {
      try {
        const res = await getDepartmentTree({ is_active: true });
        setDepartmentOptions(flatten(res?.items));
      } catch (e) {
        console.error('加载部门失败', e);
        setDepartmentOptions([]);
      }
    };
    void loadDepartments();
  }, []);

  const materialBorrowStatusValueEnum = useMemo(() => buildMaterialBorrowStatusValueEnum(t), [t]);

  const columns: ProColumns<MaterialBorrow>[] = useMemo(() => alignProColumns<MaterialBorrow>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: materialBorrowStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.materialBorrow.col.borrowTime'),
      dataIndex: 'doc_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 30 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.materialBorrow.col.borrowCode'),
      dataIndex: 'borrow_code',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 40 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.borrow_code ?? '') }} ellipsis>
          {r.borrow_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.warehouse_name != null && r.warehouse_name !== '' ? String(r.warehouse_name) : '-',
    },
    {
      title: t('app.kuaizhizao.common.colLineMaterials'),
      ...DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
      render: (_, r) => renderDocumentLineMaterialsPreview(r.items, t),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colTotalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatQuantity(r.total_quantity),
    },
    {
      title: t('app.kuaizhizao.materialBorrow.col.borrower'),
      dataIndex: 'borrower_name',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.borrower_name != null && r.borrower_name !== '' ? String(r.borrower_name) : '-',
    },
    {
      title: t('app.kuaizhizao.materialBorrow.col.department'),
      dataIndex: 'department',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.department != null && r.department !== '' ? String(r.department) : '-',
    },
    {
      title: t('app.kuaizhizao.materialBorrow.col.expectedReturnDate'),
      dataIndex: 'expected_return_date',
      valueType: 'date',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.materialBorrow.col.borrowTime'),
      dataIndex: 'borrow_time',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.borrow_time ? formatDateTime(r.borrow_time) : '-'),
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMaterialBorrowLifecycle(record as Record<string, unknown>, t);
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
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        return (
          <Space size="small" wrap>
            <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
            {record.status === '待借出' && (
              <>
                <Button
                  {...rowActionKind('execute')}
                  {...rowActionLabelKeep()}
                  onClick={() => handleConfirm(record)}
                >
                  {t('app.kuaizhizao.materialBorrow.action.confirmBorrow')}
                </Button>
                <Button {...rowActionKind('delete')} onClick={() => handleDelete(record)} />
              </>
            )}
            {record.status === '已借出' && (
              <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()} onClick={() => handleWithdraw(record)}>
                {t('app.kuaizhizao.materialBorrow.action.withdrawBorrow')}
              </Button>
            )}
          </Space>
        );
      },
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK), [t, materialBorrowStatusValueEnum]);

  const handleDetail = useCallback(async (record: MaterialBorrow) => {
    if (record.id == null) return;
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setBorrowDetail(null);
    try {
      const detail = await warehouseApi.materialBorrow.get(record.id.toString());
      setBorrowDetail(detail as MaterialBorrowDetail);
    } catch {
      messageApi.error(t('app.kuaizhizao.materialBorrow.msg.loadDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    const idRaw = searchParams.get('id')?.trim();
    const uuidRaw = searchParams.get('uuid')?.trim();
    if (!idRaw && !uuidRaw) {
      deepLinkOpenedRef.current = false;
      actionRef.current?.reload();
      return;
    }
    if (deepLinkOpenedRef.current) {
      actionRef.current?.reload();
      return;
    }
    deepLinkOpenedRef.current = true;
    void (async () => {
      try {
        if (idRaw) {
          const id = Number(idRaw);
          if (Number.isFinite(id) && id > 0) {
            await handleDetail({ id });
            return;
          }
        }
        if (uuidRaw) {
          const res = await warehouseApi.materialBorrow.list({ keyword: uuidRaw, limit: 100 });
          const items = (res as { items?: MaterialBorrow[] }).items ?? [];
          const hit = items.find((row) => String(row.uuid) === uuidRaw);
          if (hit) {
            await handleDetail(hit);
          }
        }
      } catch {
        messageApi.error(t('app.kuaizhizao.materialBorrow.msg.loadDetailFailed'));
      } finally {
        actionRef.current?.reload();
      }
    })();
  }, [searchParams, handleDetail, messageApi, t]);

  const handleConfirm = async (record: MaterialBorrow) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.materialBorrow.msg.confirmTitle'),
      content: t('app.kuaizhizao.materialBorrow.msg.confirmContent', { code: record.borrow_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.confirm(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.materialBorrow.msg.confirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.materialBorrow.msg.confirmFailed'));
        }
      },
    });
  };

  const handleWithdraw = async (record: MaterialBorrow) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.materialBorrow.msg.withdrawTitle'),
      content: t('app.kuaizhizao.materialBorrow.msg.withdrawContent', { code: record.borrow_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.materialBorrow.msg.withdrawSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.materialBorrow.msg.withdrawFailed'));
        }
      },
    });
  };

  const handleDelete = async (record: MaterialBorrow) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.materialBorrow.msg.deleteTitle'),
      content: t('app.kuaizhizao.materialBorrow.msg.deleteContent', { code: record.borrow_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.delete(record.id!.toString());
          messageApi.success(t('common.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const listRowsRef = useRef<Map<string, MaterialBorrow>>(new Map());
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const isMaterialBorrowDeletable = (record: MaterialBorrow) => record.status === '待借出' && !!record.id;
  const isMaterialBorrowPrintable = (record: MaterialBorrow) =>
    (record.status === '待借出' || record.status === '已借出') && !!record.id;

  const selectedMaterialBorrowForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => listRowsRef.current.get(String(key)))
        .filter((row): row is MaterialBorrow => row != null),
    [selectedRowKeys],
  );

  const canToolbarPrint =
    selectedRowKeys.length === 1 &&
    !!selectedMaterialBorrowForBatch[0] &&
    isMaterialBorrowPrintable(selectedMaterialBorrowForBatch[0]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const rows = keys
      .map((k) => listRowsRef.current.get(String(k)))
      .filter((r): r is MaterialBorrow => !!r && isMaterialBorrowDeletable(r));
    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.batchDeleteNoneDeletable'));
      return;
    }
    try {
      for (const row of rows) {
        await warehouseApi.materialBorrow.delete(String(row.id));
      }
      messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: rows.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    }
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload = {
          warehouse_id: row.warehouse_id ?? row.warehouseId,
          warehouse_name: row.warehouse_name || row.warehouseName,
          borrower_name: row.borrower_name || row.borrowerName,
          status: row.status || '待借出',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await warehouseApi.materialBorrow.create(payload);
        successCount += 1;
      }
      messageApi.success(t('app.kuaizhizao.materialBorrow.msg.syncSuccess', { count: successCount }));
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.materialBorrow.msg.syncFailed'));
    }
  };

  const handlePrint = (record: MaterialBorrow) => {
    if (!record.id) return;
    openPrint({ documentType: 'material_borrow', documentId: record.id });
  };

  const appendBorrowItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultBorrowItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    resetSelectedWarehouseId();
    setCreateModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.materialBorrow.create')),
    [t],
  );

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.borrow_quantity) || 0) > 0);
      if (!validItems.length) {
        messageApi.error(t('app.kuaizhizao.materialBorrow.msg.needValidLines'));
        throw new Error(t('app.kuaizhizao.materialBorrow.msg.needValidLinesRule'));
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = values.warehouse_name ?? wh?.name ?? wh?.warehouse_name ?? '';
      await warehouseApi.materialBorrow.create({
        borrow_code: values.borrow_code,
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
        borrower_id: values.borrower_id != null ? Number(values.borrower_id) : undefined,
        borrower_name: values.borrower_name,
        department: values.department,
        expected_return_date: values.expected_return_date ? formatDateTime(values.expected_return_date, 'YYYY-MM-DD') : undefined,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          location_code: it.location_code || undefined,
          borrow_quantity: Number(it.borrow_quantity) || 0,
          warehouse_id: values.warehouse_id,
          warehouse_name: warehouseName,
        })),
      });
      messageApi.success(t('common.createSuccess'));
      resetSelectedWarehouseId();
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== t('app.kuaizhizao.materialBorrow.msg.needValidLinesRule')) messageApi.error(error.message || t('common.createFailed'));
      throw error;
    }
  };

  const detailColumns = useMemo(() => alignDescriptionColumns([
    { title: t('app.kuaizhizao.materialBorrow.col.borrowCode'), dataIndex: 'borrow_code' },
    { title: t('app.kuaizhizao.warehouseReports.colWarehouse'), dataIndex: 'warehouse_name' },
    { title: t('app.kuaizhizao.materialBorrow.col.borrower'), dataIndex: 'borrower_name' },
    { title: t('app.kuaizhizao.materialBorrow.col.department'), dataIndex: 'department' },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (s) => {
        const status = (s as string) || '';
        const colorMap: Record<string, string> = {
          '待借出': 'default',
          '已借出': 'success',
          '已取消': 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{translateMaterialBorrowStatus(t, status)}</Tag>;
      },
    },
    { title: t('app.kuaizhizao.materialBorrow.col.expectedReturnDate'), dataIndex: 'expected_return_date', valueType: 'date' },
    { title: t('app.kuaizhizao.materialBorrow.col.borrowTime'), dataIndex: 'borrow_time', valueType: 'dateTime' },
    { title: t('common.remark'), dataIndex: 'notes', span: 3 },
  ]), [t]);

  const detailCollaboration = useMemo(() => {
    if (!borrowDetail) return undefined;
    const lifecycle = getMaterialBorrowLifecycle(borrowDetail as unknown as Record<string, unknown>, t);
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
  }, [borrowDetail, t]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns, borrowDetail,
    'material_borrow',
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.materialBorrow.title')}
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.materialBorrow)}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.material-borrows-width-v3"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          showCreateButton
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          enableRowSelection
          onTableDataChange={(rows) => {
            const next = new Map<string, MaterialBorrow>();
            for (const row of rows) {
              if (row.id != null) next.set(String(row.id), row);
            }
            listRowsRef.current = next;
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          rowSelectionGetCheckboxProps={(record) => ({
            disabled: !isMaterialBorrowDeletable(record) && !isMaterialBorrowPrintable(record),
          })}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', {
              count,
              noun: t('app.kuaizhizao.materialBorrow.title'),
            })
          }
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items = await fetchAllListItems((p) => warehouseApi.materialBorrow.list(p));
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: MaterialBorrow) => d.id != null && keys.map(String).includes(String(d.id)));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `material-borrows-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('app.kuaizhizao.materialBorrow.msg.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveWarehouseDocListParams(searchFormValues, sort, {
                docDateParamPrefix: 'borrow',
              });
              const response = await warehouseApi.materialBorrow.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...listParams,
              });
              const { data, total } = normalizeWarehouseListResponse(response);
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.materialBorrow.msg.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          showPrintButton
          printButtonDisabled={!canToolbarPrint}
          printButtonText={t('components.uniAction.print')}
          onPrint={() => {
            const row = selectedMaterialBorrowForBatch[0];
            if (row) handlePrint(row);
          }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.materialBorrow.detailTitle')}${borrowDetail?.borrow_code ? ` - ${borrowDetail.borrow_code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => { setDetailDrawerVisible(false); setBorrowDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          borrowDetail ? (
            <Descriptions column={detailDrawerBasicColumn(false)} size="small" items={timeconfigBasicItems} />
          ) : undefined
        }
        collaboration={detailCollaboration}
        linesTitle={t('app.kuaizhizao.warehouseOutbound.section.lines')}
        lines={
          borrowDetail?.items && borrowDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={[
                  { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
                  { title: t('common.unit'), dataIndex: 'material_unit', width: 60 },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.location'), dataIndex: 'location_code', width: 120, render: (v) => v || '-' },
                  { title: t('app.kuaizhizao.materialBorrow.col.borrowQty'), dataIndex: 'borrow_quantity', width: 100, align: 'right' },
                  { title: t('app.kuaizhizao.materialBorrow.col.returnedQty'), dataIndex: 'returned_quantity', width: 100, align: 'right' },
                  { title: t('common.status'), dataIndex: 'status', width: 80 },
                ]}
                dataSource={borrowDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.materialBorrow.createModal')}
        open={createModalVisible}
        onClose={() => {
          resetSelectedWarehouseId();
          setCreateModalVisible(false);
        }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-material-borrow"
              name="borrow_code"
              label={t('app.kuaizhizao.materialBorrow.field.borrowCode')}
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseReports.colWarehouse')}
              placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectWarehouse')}
              required
              onChange={(val, wh) => {
                updateSelectedWarehouseId(val);
                formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' });
              }}
            />
          </Col>
        </Row>
        <AntForm.Item name="warehouse_name" hidden />
        <AntForm.Item name="borrower_id" hidden />
        <AntForm.Item name="department_uuid" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <UniUserSelect
              name="borrower_uuid"
              label={t('app.kuaizhizao.materialBorrow.field.borrower')}
              placeholder={t('app.kuaizhizao.materialBorrow.field.selectBorrower')}
              onChange={(_value: any, user: any) => {
                const picked = Array.isArray(user) ? user[0] : user;
                formRef.current?.setFieldsValue({
                  borrower_id: picked?.id,
                  borrower_name: picked?.full_name || picked?.username || undefined,
                });
              }}
            />
            <AntForm.Item name="borrower_name" hidden>
              <Input />
            </AntForm.Item>
          </Col>
          <Col span={12}>
            <ProFormItem name="department_uuid" label={t('app.kuaizhizao.materialBorrow.col.department')}>
              <UniDropdown
                placeholder={t('app.kuaizhizao.materialBorrow.field.selectDepartment')}
                options={departmentOptions}
                showSearch
                optionFilterProp="label"
                onChange={(value) => {
                  const selected = departmentOptions.find((d) => d.value === value);
                  const label = selected?.label;
                  const deptName = label ? String(label).split(' / ').pop() || label : undefined;
                  formRef.current?.setFieldsValue({ department: deptName });
                }}
              />
            </ProFormItem>
            <AntForm.Item name="department" hidden>
              <Input />
            </AntForm.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="expected_return_date" label={t('app.kuaizhizao.materialBorrow.field.expectedReturnDate')}>
              <FutureDatePicker getForm={() => formRef.current} t={t} style={{ width: '100%' }} />
            </ProFormItem>
          </Col>
          <Col span={12} />
        </Row>
        <div className="uni-table-detail" style={{ width: '100%' }}>
          <UniTableDetailHeader title={t('app.kuaizhizao.warehouseOutbound.section.lines')} required />
          <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.materialBorrow.msg.needValidLinesRule') }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const cols = [
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.field.material'),
                    dataIndex: 'material_id',
                    width: 260,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
                            <div className="warehouse-detail-material-cell">
                              <UniMaterialSelect
                                name={[index, 'material_id']}
                                label=""
                                placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectMaterial')}
                                required
                                size="small"
                                listFieldKey={index}
                                listFieldName="items"
                                fillMapping={{
                                  material_code: 'mainCode',
                                  material_name: 'name',
                                  material_unit: 'baseUnit',
                                }}
                                fallbackOption={fallback}
                                formItemProps={{ style: { margin: 0 } }}
                                showQuickCreate
                                showAdvancedSearch
                              />
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.unit'),
                    dataIndex: 'material_unit',
                    width: 80,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                        {({ getFieldValue }: any) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          if (!formRef.current) return null;
                          return (
                            <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                              <DocumentLineUnitSelect
                                form={formRef.current}
                                listName="items"
                                rowIndex={index}
                                fields={{ quantity: 'borrow_quantity', unit: 'material_unit' }}
                                materialId={materialId}
                                size="small"
                                noStyle
                              />
                            </AntForm.Item>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.location'),
                    dataIndex: 'location_code',
                    width: 180,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'location_code']} style={{ margin: 0 }}>
                        <Select
                          options={locationOptions}
                          placeholder={selectedWarehouseId ? t('app.kuaizhizao.warehouseOutbound.field.selectLocation') : t('app.kuaizhizao.warehouseOutbound.field.selectWarehouseFirst')}
                          style={{ width: '100%' }}
                          size="small"
                          showSearch
                          optionFilterProp="label"
                          allowClear
                          disabled={!selectedWarehouseId}
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.quantity'),
                    dataIndex: 'borrow_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'borrow_quantity']} rules={[{ required: true, message: t('app.kuaizhizao.warehouseOutbound.field.required') }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder={t('common.quantity')} min={0} precision={quantityDecimals} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.actions'),
                    width: 60,
                    render: (_: any, __: any, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                    ),
                  },
                ];
                const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="warehouse-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={cols}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                            <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultBorrowItem)}>
                              {t('app.kuaizhizao.warehouseOutbound.action.addLine')}
                            </Button>
                            <Button
                              type="default"
                              icon={<ShoppingOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => setMaterialPickerOpen(true)}
                            >
                              {t('app.kuaizhizao.common.materialBatchSelect')}
                            </Button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
          </AntForm.Item>
        </div>
        <DocumentAttachmentsField category="material_borrow_attachments" />
        <ProFormTextArea name="notes" label={t('common.remark')} placeholder={t('app.kuaizhizao.warehouseOutbound.field.optional')} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.materialBorrow.syncTitle')}
      />

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendBorrowItemsFromMaterials}
      />
      {PrintModal}
    </>
  );
};

export default MaterialBorrowsPage;
