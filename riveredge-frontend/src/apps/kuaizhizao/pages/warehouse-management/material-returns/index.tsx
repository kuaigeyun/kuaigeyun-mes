/**
 * 还料单管理页面
 *
 * 提供还料单的创建、查看、确认和管理功能（必须关联借料单）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form, InputNumber, Modal, Row, Table, Tag, Typography } from 'antd';
import { EyeOutlined, CheckCircleOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import CodeField from '../../../../../components/code-field';
import {   useDetailDrawerDescriptionItems, detailDrawerBasicColumn, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getMaterialReturnLifecycle } from '../../../utils/materialReturnLifecycle';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import {formatDateTime, formatQuantity} from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildMaterialReturnStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveWarehouseDocListParams,
} from '../../../utils/warehouseListCore';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { ROUTES } from '../../../constants/routes';
interface MaterialReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  borrow_id?: number;
  borrow_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  returner_id?: number;
  returner_name?: string;
  return_time?: string;
  status?: string;
  total_quantity?: number;
  total_items?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface MaterialReturnDetail extends MaterialReturn {
  items?: MaterialReturnItem[];
}

interface MaterialReturnItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  return_quantity?: number;
  status?: string;
}

interface BorrowItemForReturn {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_unit: string;
  borrow_quantity: number;
  returned_quantity: number;
  warehouse_id: number;
  warehouse_name: string;
}

const MaterialReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [returnDetail, setReturnDetail] = useState<MaterialReturnDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const formRef = useRef<any>(null);
  const [borrowList, setBorrowList] = useState<any[]>([]);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [selectedBorrowDetail, setSelectedBorrowDetail] = useState<{ borrow_id: number; borrow_code: string; warehouse_id: number; warehouse_name: string; items: BorrowItemForReturn[] } | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    const load = async () => {
      if (!createModalVisible) return;
      setBorrowLoading(true);
      try {
        const chunkSize = 100;
        const maxRows = 500;
        const rows: any[] = [];
        let skip = 0;
        while (rows.length < maxRows) {
          const res = await warehouseApi.materialBorrow.list({ status: '已借出', skip, limit: chunkSize });
          const chunk = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data || [];
          if (!Array.isArray(chunk) || chunk.length === 0) break;
          rows.push(...chunk);
          if (chunk.length < chunkSize) break;
          skip += chunkSize;
        }
        setBorrowList(rows.slice(0, maxRows));
      } catch {
        setBorrowList([]);
      } finally {
        setBorrowLoading(false);
      }
    };
    load();
  }, [createModalVisible]);

  const onBorrowSelect = async (borrowId: number) => {
    if (!borrowId) {
      setSelectedBorrowDetail(null);
      setReturnQuantities({});
      return;
    }
    try {
      const detail = await warehouseApi.materialBorrow.get(borrowId.toString());
      const items = (detail as any).items || [];
      const borrowItems: BorrowItemForReturn[] = items.map((it: any) => ({
        id: it.id,
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_unit: it.material_unit,
        borrow_quantity: it.borrow_quantity ?? 0,
        returned_quantity: it.returned_quantity ?? 0,
        warehouse_id: it.warehouse_id ?? (detail as any).warehouse_id,
        warehouse_name: it.warehouse_name ?? (detail as any).warehouse_name,
      }));
      setSelectedBorrowDetail({
        borrow_id: (detail as any).id,
        borrow_code: (detail as any).borrow_code,
        warehouse_id: (detail as any).warehouse_id,
        warehouse_name: (detail as any).warehouse_name,
        items: borrowItems,
      });
      const qtyMap: Record<number, number> = {};
      borrowItems.forEach((it) => {
        const maxRet = Math.max(0, it.borrow_quantity - it.returned_quantity);
        qtyMap[it.id] = maxRet > 0 ? maxRet : 0;
      });
      setReturnQuantities(qtyMap);
    } catch {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.loadBorrowDetailFailed'));
      setSelectedBorrowDetail(null);
    }
  };

  const handleDetail = async (record: MaterialReturn) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setReturnDetail(null);
    try {
      const detail = await warehouseApi.materialReturn.get(record.id!.toString());
      setReturnDetail(detail as MaterialReturnDetail);
    } catch {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.loadDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirm = async (record: MaterialReturn) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.warehouseMaterialReturn.confirm.title'),
      content: t('app.kuaizhizao.warehouseMaterialReturn.confirm.content', { code: record.return_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialReturn.confirm(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.warehouseMaterialReturn.msg.confirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.warehouseMaterialReturn.msg.confirmFailed'));
        }
      },
    });
  };

  const handleDelete = async (record: MaterialReturn) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.warehouseMaterialReturn.confirm.deleteTitle'),
      content: t('app.kuaizhizao.warehouseMaterialReturn.confirm.deleteContent', { code: record.return_code }),
      onOk: async () => {
        try {
          await warehouseApi.materialReturn.delete(record.id!.toString());
          messageApi.success(t('common.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const listRowsRef = useRef<Map<string, MaterialReturn>>(new Map());
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const isMaterialReturnDeletable = (record: MaterialReturn) => record.status === '待归还' && !!record.id;
  const isMaterialReturnPrintable = (record: MaterialReturn) =>
    (record.status === '待归还' || record.status === '已归还') && !!record.id;

  const selectedMaterialReturnForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => listRowsRef.current.get(String(key)))
        .filter((row): row is MaterialReturn => row != null),
    [selectedRowKeys],
  );

  const canToolbarPrint =
    selectedRowKeys.length === 1 &&
    !!selectedMaterialReturnForBatch[0] &&
    isMaterialReturnPrintable(selectedMaterialReturnForBatch[0]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const rows = keys
      .map((k) => listRowsRef.current.get(String(k)))
      .filter((r): r is MaterialReturn => !!r && isMaterialReturnDeletable(r));
    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.batchDeleteNoneDeletable'));
      return;
    }
    try {
      for (const row of rows) {
        await warehouseApi.materialReturn.delete(String(row.id));
      }
      messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: rows.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    }
  };

  const handlePrint = (record: MaterialReturn) => {
    if (!record.id) return;
    openPrint({ documentType: 'material_return', documentId: record.id });
  };

  const handleCreate = () => {
    setCreateModalVisible(true);
    setSelectedBorrowDetail(null);
    setReturnQuantities({});
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.warehouseMaterialReturn.create')),
    [t],
  );

  const createMaterialReturn = async (values: any, andConfirm: boolean) => {
    if (!selectedBorrowDetail) {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.selectBorrow'));
      throw new Error(t('app.kuaizhizao.warehouseMaterialReturn.msg.selectBorrow'));
    }
    const validItems = selectedBorrowDetail.items
      .filter((it) => (returnQuantities[it.id] ?? 0) > 0)
      .map((it) => ({
        borrow_item_id: it.id,
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_unit: it.material_unit,
        return_quantity: returnQuantities[it.id],
        warehouse_id: selectedBorrowDetail.warehouse_id,
        warehouse_name: selectedBorrowDetail.warehouse_name,
      }));
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.needValidReturnQty'));
      throw new Error(t('app.kuaizhizao.warehouseMaterialReturn.msg.needValidReturnQty'));
    }
    setCreateSubmitting(true);
    try {
      const created = await warehouseApi.materialReturn.create({
        return_code: values.return_code,
        borrow_id: selectedBorrowDetail.borrow_id,
        borrow_code: selectedBorrowDetail.borrow_code,
        warehouse_id: selectedBorrowDetail.warehouse_id,
        warehouse_name: selectedBorrowDetail.warehouse_name,
        returner_id: values.returner_id != null ? Number(values.returner_id) : undefined,
        returner_name: values.returner_name,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems,
      });
      const createdId = (created as any)?.id;
      if (andConfirm) {
        if (!createdId) {
          throw new Error(t('app.kuaizhizao.warehouseMaterialReturn.msg.createMissingId'));
        }
        await warehouseApi.materialReturn.confirm(String(createdId));
        messageApi.success(t('app.kuaizhizao.warehouseMaterialReturn.msg.createAndConfirmSuccess'));
      } else {
        messageApi.success(t('app.kuaizhizao.warehouseMaterialReturn.msg.createSuccess'));
      }
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(
        error.message
          || (andConfirm
            ? t('app.kuaizhizao.warehouseMaterialReturn.msg.createAndConfirmFailed')
            : t('common.createFailed')),
      );
      throw error;
    } finally {
      setCreateSubmitting(false);
    }
  };

  /** Ctrl+S / 主按钮：仅保存为待归还 */
  const handleCreateSubmit = async (values: any) => {
    await createMaterialReturn(values, false);
  };

  /** 保存并确认归还（正式入库） */
  const handleCreateAndConfirm = async () => {
    const inst = formRef.current;
    if (!inst || typeof inst.validateFields !== 'function') {
      messageApi.warning(t('components.layoutTemplates.formModal.formNotReady'));
      return;
    }
    try {
      const values = await inst.validateFields();
      await createMaterialReturn(values, true);
    } catch (error: any) {
      if (error?.errorFields) {
        const first = error.errorFields?.[0];
        const text = first?.errors?.filter(Boolean)[0];
        messageApi.error(text || t('components.layoutTemplates.formModal.checkFormHint'));
        return;
      }
      // createMaterialReturn 已提示业务错误
    }
  };

  const materialReturnStatusValueEnum = useMemo(() => buildMaterialReturnStatusValueEnum(t), [t]);

  const columns: ProColumns<MaterialReturn>[] = useMemo(
    () => alignProColumns<MaterialReturn>([
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
        valueEnum: materialReturnStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnTime'),
        dataIndex: 'doc_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnCode'),
        dataIndex: 'return_code',
        width: 140,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 40 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.return_code ?? '') }} ellipsis>
            {r.return_code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.borrowCode'),
        dataIndex: 'borrow_code',
        width: 140,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.borrow_id ? (
            <Typography.Link
              ellipsis
              onClick={() => navigate(`${ROUTES.WM_MATERIAL_BORROWS}?id=${r.borrow_id}`)}
            >
              {r.borrow_code ?? '-'}
            </Typography.Link>
          ) : (
            <Typography.Text copyable={{ text: String(r.borrow_code ?? '') }} ellipsis>
              {r.borrow_code ?? '-'}
            </Typography.Text>
          ),
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.warehouse'),
        dataIndex: 'warehouse_name',
        width: 120,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colTotalQuantity'),
        dataIndex: 'total_quantity',
        width: 100,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: formatQuantity,
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colMaterialKindCount'),
        dataIndex: 'total_items',
        width: 90,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: (v: number | null | undefined) => (v != null ? v : '-'),
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.returner'),
        dataIndex: 'returner_name',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnTime'),
        dataIndex: 'return_time',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.return_time ? formatDateTime(r.return_time) : '-'),
      },
      ...buildDocumentAuditColumns<Record<string, unknown>>(t),
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getMaterialReturnLifecycle(record as Record<string, unknown>, t);
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
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        uniActionRenderOptions: { directMax: 4 },
        render: (_, record) => {
          const actions: React.ReactNode[] = [
            <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)} />,
          ];
          if (record.status === '待归还') {
            actions.push(
              <Button
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                key="confirm"
                onClick={() => handleConfirm(record)}
              >
                {t('app.kuaizhizao.warehouseMaterialReturn.action.confirmInbound')}
              </Button>,
              <Button {...rowActionKind('delete')} key="delete" onClick={() => handleDelete(record)} />,
            );
          }
          return actions;
        },
      },
    ], WAREHOUSE_DOC_LIST_FIELD_RANK),
    [t, materialReturnStatusValueEnum],
  );

  const detailColumns = useMemo(
    () => alignDescriptionColumns([
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnCode'), dataIndex: 'return_code' },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.borrowCode'), dataIndex: 'borrow_code' },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.warehouse'), dataIndex: 'warehouse_name' },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returner'), dataIndex: 'returner_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (s) => {
          const map: Record<string, { textKey: string; color: string }> = {
            待归还: { textKey: 'app.kuaizhizao.warehouseMaterialReturn.status.pending', color: 'default' },
            已归还: { textKey: 'app.kuaizhizao.warehouseMaterialReturn.status.returned', color: 'success' },
            已取消: { textKey: 'app.kuaizhizao.warehouseMaterialReturn.status.cancelled', color: 'error' },
          };
          const c = map[(s as string) || ''] || { textKey: '', color: 'default' };
          return <Tag color={c.color}>{c.textKey ? t(c.textKey) : (s as string) || '-'}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnTime'), dataIndex: 'return_time', valueType: 'dateTime' },
      { title: t('common.remark'), dataIndex: 'notes', span: 3 },
    ]),
    [t],
  );

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('common.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnQty'), dataIndex: 'return_quantity', width: 100, align: 'right' as const , render: formatQuantity },
      { title: t('common.status'), dataIndex: 'status', width: 80 },
    ],
    [t],
  );

  const detailCollaboration = useMemo(() => {
    if (!returnDetail) return undefined;
    const lifecycle = getMaterialReturnLifecycle(returnDetail as unknown as Record<string, unknown>, t);
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
  }, [returnDetail, t]);

  const createFormItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('common.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.borrowQty'), dataIndex: 'borrow_quantity', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseMaterialReturn.col.returnedQty'), dataIndex: 'returned_quantity', width: 90, align: 'right' as const },
      {
        title: t('app.kuaizhizao.warehouseMaterialReturn.col.thisReturnQty'),
        width: 120,
        render: (_: unknown, record: BorrowItemForReturn) => {
          const maxRet = Math.max(0, record.borrow_quantity - record.returned_quantity);
          return (
            <InputNumber
              min={0}
              max={maxRet}
              value={returnQuantities[record.id] ?? 0}
              onChange={(v) => setReturnQuantities((prev) => ({ ...prev, [record.id]: v ?? 0 }))}
              style={{ width: '100%' }}
            />
          );
        },
      },
    ],
    [t, returnQuantities],
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns, returnDetail,
    'material_return',
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.warehouseMaterialReturn.title')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.material-returns.v2"
          showAdvancedSearch
          pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          showCreateButton
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          enableRowSelection
          onTableDataChange={(rows) => {
            const next = new Map<string, MaterialReturn>();
            for (const row of rows) {
              if (row.id != null) next.set(String(row.id), row);
            }
            listRowsRef.current = next;
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          rowSelectionGetCheckboxProps={(record) => ({
            disabled: !isMaterialReturnDeletable(record) && !isMaterialReturnPrintable(record),
          })}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', {
              count,
              noun: t('app.kuaizhizao.warehouseMaterialReturn.title'),
            })
          }
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveWarehouseDocListParams(searchFormValues, sort, {
                docDateParamPrefix: 'return',
              });
              const response = await warehouseApi.materialReturn.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...listParams,
              });
              const { data, total } = normalizeWarehouseListResponse(response);
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.warehouseMaterialReturn.msg.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          toolBarActionsAfterBatch={[
            <Button
              key="material-return-toolbar-print"
              icon={<PrinterOutlined />}
              disabled={!canToolbarPrint}
              onClick={() => {
                const row = selectedMaterialReturnForBatch[0];
                if (row) handlePrint(row);
              }}
            >
              {t('components.uniAction.print')}
            </Button>,
          ]}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.warehouseMaterialReturn.detailTitle')}${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => { setDetailDrawerVisible(false); setReturnDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          returnDetail ? (
            <Descriptions column={detailDrawerBasicColumn(false)} size="small" items={timeconfigBasicItems} />
          ) : undefined
        }
        collaboration={detailCollaboration}
        linesTitle={t('app.kuaizhizao.warehouseMaterialReturn.field.returnDetails')}
        lines={
          returnDetail?.items && returnDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={detailItemColumns}
                dataSource={returnDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.warehouseMaterialReturn.createModal')}
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        loading={createSubmitting}
        submitHidden
        extraFooter={
          <Button
            loading={createSubmitting}
            onClick={() => {
              const inst = formRef.current;
              if (!inst || typeof inst.submit !== 'function') {
                messageApi.warning(t('components.layoutTemplates.formModal.formNotReady'));
                return;
              }
              inst.submit();
            }}
          >
            {t('common.save') + SUBMIT_SHORTCUT_HINT}
          </Button>
        }
        extraFooterAfter={
          <Button type="primary" loading={createSubmitting} onClick={() => void handleCreateAndConfirm()}>
            {t('app.kuaizhizao.warehouseMaterialReturn.action.saveAndConfirm')}
          </Button>
        }
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-material-return"
              name="return_code"
              label={t('app.kuaizhizao.warehouseMaterialReturn.field.returnCode')}
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <ProFormItem
              name="borrow_id"
              label={t('app.kuaizhizao.warehouseMaterialReturn.field.borrow')}
              rules={[{ required: true, message: t('app.kuaizhizao.warehouseMaterialReturn.field.selectBorrowRequired') }]}
            >
              <UniDropdown
                placeholder={t('app.kuaizhizao.warehouseMaterialReturn.field.selectBorrowPlaceholder')}
                showSearch
                allowClear
                loading={borrowLoading}
                style={{ width: '100%' }}
                options={borrowList.map((b: any) => ({
                  value: b.id,
                  label: `${b.borrow_code ?? b.borrowCode ?? ''} - ${b.warehouse_name ?? b.warehouseName ?? ''}`.trim() || String(b.id),
                }))}
                onChange={(v) => onBorrowSelect(v as number)}
              />
            </ProFormItem>
          </Col>
        </Row>
        {selectedBorrowDetail && (
          <>
            <div className="uni-table-detail" style={{ width: '100%' }}>
              <UniTableDetailHeader title={t('app.kuaizhizao.warehouseMaterialReturn.field.returnDetails')} />
              <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <Table
                  className="warehouse-detail-table"
                  size="small"
                  rowKey="id"
                  pagination={false}
                  columns={createFormItemColumns}
                  dataSource={selectedBorrowDetail.items}
                />
              </div>
            </div>
          </>
        )}
        <Form.Item name="returner_id" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <UniUserSelect
              name="returner_uuid"
              label={t('app.kuaizhizao.warehouseMaterialReturn.field.returner')}
              placeholder={t('app.kuaizhizao.warehouseMaterialReturn.field.selectReturner')}
              onChange={(_value: any, user: any) => {
                const picked = Array.isArray(user) ? user[0] : user;
                formRef.current?.setFieldsValue({
                  returner_id: picked?.id,
                  returner_name: picked?.full_name || picked?.username || undefined,
                });
              }}
            />
            <Form.Item name="returner_name" hidden />
          </Col>
          <Col span={12} />
        </Row>
        <DocumentAttachmentsField category="material_return_attachments" />
        <ProFormTextArea
          name="notes"
          label={t('common.remark')}
          placeholder={t('app.kuaizhizao.warehouseMaterialReturn.field.optional')}
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>
      {PrintModal}
    </>
  );
};

export default MaterialReturnsPage;
