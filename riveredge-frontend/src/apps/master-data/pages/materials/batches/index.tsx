/**
 * 批号记录（按物料维护批次号、数量、效期等；与质量管理「追溯查询」互补）
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button } from 'antd';
import { ProFormText, ProFormSelect, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { formatBusinessDateOnly } from '../../../../../utils/format';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  GLOBAL_DOC_LIST_FIELD_RANK,
  batchSerialLedgerNoSearchColumn,
  masterCrudCreatedUpdatedColumns,
  resolveBatchSerialLedgerListParams,
} from '../../../utils/materialListCore';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { materialBatchApi, materialApi } from '../../../services/material';
import type { MaterialBatch, MaterialBatchCreate, MaterialBatchUpdate } from '../../../types/material';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  renderMasterActiveTag,
  renderMasterYesNoTag,
  renderMasterTypeMarker,
} from '../../../utils/masterListPresentation';

const BATCH_STATUS_PINNED_FIELD = 'status';

const BatchesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const batchStatusOptions = useMemo(
    () => [
      { label: t('app.master-data.inventoryStatus.inStock'), value: 'in_stock' },
      { label: t('app.master-data.inventoryStatus.outStock'), value: 'out_stock' },
      { label: t('app.master-data.inventoryStatus.expired'), value: 'expired' },
      { label: t('app.master-data.inventoryStatus.scrapped'), value: 'scrapped' },
    ],
    [t],
  );

  const batchStatusValueEnum = useMemo(
    () => ({
      in_stock: { text: t('app.master-data.inventoryStatus.inStock'), status: 'Success' as const },
      out_stock: { text: t('app.master-data.inventoryStatus.outStock'), status: 'Default' as const },
      expired: { text: t('app.master-data.inventoryStatus.expired'), status: 'Error' as const },
      scrapped: { text: t('app.master-data.inventoryStatus.scrapped'), status: 'Warning' as const },
    }),
    [t],
  );
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>();
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  const handleEdit = async (record: MaterialBatch) => {
    setIsEdit(true);
    setCurrentUuid(record.uuid);
    setModalVisible(true);
    try {
      const detail = await materialBatchApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        materialUuid: detail.materialUuid,
        batchNo: detail.batchNo,
        productionDate: detail.productionDate,
        expiryDate: detail.expiryDate,
        supplierBatchNo: detail.supplierBatchNo,
        quantity: detail.quantity,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.batches.getDetailFailed'));
    }
  };

  const formatDate = (v: unknown): string | undefined => {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && 'format' in v && typeof (v as any).format === 'function') {
      return (v as any).format('YYYY-MM-DD');
    }
    return String(v);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      if (isEdit && currentUuid) {
        const upd: MaterialBatchUpdate = {
          productionDate: formatDate(values.productionDate),
          expiryDate: formatDate(values.expiryDate),
          supplierBatchNo: values.supplierBatchNo as string | undefined,
          quantity: values.quantity as number | undefined,
          status: values.status as string | undefined,
          remark: values.remark as string | undefined,
        };
        await materialBatchApi.update(currentUuid, upd);
        messageApi.success(t('common.updateSuccess'));
      } else {
        const crt: MaterialBatchCreate = {
          materialUuid: values.materialUuid as string,
          batchNo: values.batchNo as string,
          productionDate: formatDate(values.productionDate),
          expiryDate: formatDate(values.expiryDate),
          supplierBatchNo: values.supplierBatchNo as string | undefined,
          quantity: (values.quantity as number) ?? 0,
          status: (values.status as string) ?? 'in_stock',
          remark: values.remark as string | undefined,
        };
        await materialBatchApi.create(crt);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.operationFailed'));
      throw e;
    }
  };

  const handleDelete = async (record: MaterialBatch) => {
    try {
      await materialBatchApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await materialBatchApi.delete(String(key));
    }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const formatBatchDateCell = (value: unknown) => {
    if (value == null || value === '') return '-';
    return formatBusinessDateOnly(String(value));
  };

  const readBatchDateField = (record: MaterialBatch, field: 'productionDate' | 'expiryDate') => {
    const camel = record[field];
    if (camel != null && camel !== '') return camel;
    const snake = field === 'productionDate' ? 'production_date' : 'expiry_date';
    return (record as Record<string, unknown>)[snake];
  };

  const columns: ProColumns<MaterialBatch>[] = useMemo(() => [
    batchSerialLedgerNoSearchColumn(t('app.master-data.batches.batchNo'), 'batchNo'),
    {
      title: t('app.master-data.batches.batchNo'),
      dataIndex: 'batchNo',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.batches.materialCode'),
      dataIndex: 'materialCode',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
      copyable: true,
    },
    {
      // 物料名称长短不一：唯一 RemainderFlex（台账无备注列）
      title: t('app.master-data.batches.materialName'),
      dataIndex: 'materialName',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.batches.materialModel'),
      dataIndex: 'materialModel',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      hideInTable: true,
      order: 20,
      valueType: 'select',
      valueEnum: batchStatusValueEnum,
      fieldProps: { allowClear: true },
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      valueEnum: batchStatusValueEnum,
      render: (_, r) => {
        const color =
          r.status === 'in_stock'
            ? 'success'
            : r.status === 'expired'
              ? 'error'
              : r.status === 'scrapped'
                ? 'warning'
                : 'default';
        const text =
          batchStatusValueEnum[r.status as keyof typeof batchStatusValueEnum]?.text || r.status || '—';
        return renderMasterTypeMarker(text, color);
      },
    },
    {
      title: t('common.quantity'),
      dataIndex: 'quantity',
      width: 90,
      minWidth: 90,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'digit',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.batches.productionDate'),
      dataIndex: 'productionDate',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'date',
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatBatchDateCell(readBatchDateField(r, 'productionDate')),
    },
    {
      title: t('app.master-data.batches.expiryDate'),
      dataIndex: 'expiryDate',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'date',
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatBatchDateCell(readBatchDateField(r, 'expiryDate')),
    },
    ...masterCrudCreatedUpdatedColumns<MaterialBatch>(t),
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          {...rowActionKind('update')}
          onClick={() => handleEdit(record)}
        />,
        <Popconfirm
          key="delete"
          title={t('common.confirmDelete')}
          onConfirm={() => handleDelete(record)}
        >
          <Button type="link" size="small" {...rowActionKind('delete')} />
        </Popconfirm>,
      ],
    },
  ], [t, batchStatusValueEnum]);

  return (
    <ListPageTemplate>
      <UniTable<MaterialBatch>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.batches')}
        columnPersistenceId="apps.master-data.pages.materials.batches.list-v2"
        headerTitle={t('app.master-data.menu.materials.batches')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20 } = params;
          const listParams = resolveBatchSerialLedgerListParams(searchFormValues, sort, {
            batchNoField: 'batchNo',
          });
          lastListParamsRef.current = listParams;
          const res = await materialBatchApi.list({
            page: current,
            pageSize,
            batchNo: listParams.batch_no as string | undefined,
            status: listParams.status as string | undefined,
            keyword: listParams.keyword as string | undefined,
            created_start_date: listParams.created_start_date as string | undefined,
            created_end_date: listParams.created_end_date as string | undefined,
            sortBy: listParams.sort_by as string | undefined,
            sortOrder: listParams.sort_order as 'asc' | 'desc' | undefined,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={BATCH_STATUS_PINNED_FIELD}
        search={{
          labelWidth: 'auto',
        }}
        showCreateButton
        createButtonText={t('common.create')}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
      />

      <FormModalTemplate
        title={isEdit ? t('app.master-data.batches.editTitle') : t('app.master-data.batches.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
      >
        <ProFormSelect
          name="materialUuid"
          label={t('app.master-data.batches.material')}
          rules={[{ required: !isEdit, message: t('app.master-data.batches.selectMaterial') }]}
          disabled={isEdit}
          request={async () => {
            const res = await materialApi.list({ limit: 500, isActive: true });
            const items = Array.isArray(res) ? res : (res as any)?.items ?? [];
            return items.map((m: any) => ({
              label: `${m.mainCode ?? ''} - ${m.name ?? ''}`.trim() || m.uuid,
              value: m.uuid,
            }));
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="batchNo"
          label={t('app.master-data.batches.batchNo')}
          rules={[{ required: true, message: t('app.master-data.batches.enterBatchNo') }]}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="productionDate"
          label={t('app.master-data.batches.productionDate')}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="expiryDate"
          label={t('app.master-data.batches.expiryDate')}
          colProps={{ span: 12 }}
          fieldProps={buildFutureDateShortcutFieldProps({
            getForm: () => formRef.current,
            fieldName: 'expiryDate',
            baseFieldName: 'productionDate',
            t,
          })}
        />
        <ProFormText
          name="supplierBatchNo"
          label={t('app.master-data.batches.supplierBatchNo')}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="quantity"
          label={t('common.quantity')}
          initialValue={0}
          min={0}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="status"
          label={t('common.status')}
          options={batchStatusOptions}
          initialValue="in_stock"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="remark"
          label={t('common.remark')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default BatchesPage;
