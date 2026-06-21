/**
 * 批号记录（按物料维护批次号、数量、效期等；与质量管理「追溯查询」互补）
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProFormText, ProFormSelect, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formatBusinessDateOnly } from '../../../../../utils/format';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { materialBatchApi, materialApi } from '../../../services/material';
import type { MaterialBatch, MaterialBatchCreate, MaterialBatchUpdate } from '../../../types/material';

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

  const batchSortFieldMap: Record<string, string> = {
    batchNo: 'batch_no',
    materialCode: 'material_code',
    materialName: 'material_name',
    materialModel: 'material_model',
    quantity: 'quantity',
    status: 'status',
    productionDate: 'production_date',
    expiryDate: 'expiry_date',
  };

  const columns: ProColumns<MaterialBatch>[] = [
    {
      title: t('app.master-data.batches.batchNo'),
      dataIndex: 'batchNo',
      width: 180,
      ellipsis: true,
      sorter: true,
      copyable: true,
    },
    {
      title: t('app.master-data.batches.materialCode'),
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
      copyable: true,
    },
    {
      title: t('app.master-data.batches.materialName'),
      dataIndex: 'materialName',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.batches.materialModel'),
      dataIndex: 'materialModel',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.batches.quantity'),
      dataIndex: 'quantity',
      width: 100,
      valueType: 'digit',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.batches.status'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      sorter: true,
      valueEnum: batchStatusValueEnum,
    },
    {
      title: t('app.master-data.batches.productionDate'),
      dataIndex: 'productionDate',
      width: 120,
      valueType: 'date',
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatBatchDateCell(r.productionDate),
    },
    {
      title: t('app.master-data.batches.expiryDate'),
      dataIndex: 'expiryDate',
      width: 120,
      valueType: 'date',
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatBatchDateCell(r.expiryDate),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            key="edit"
            {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm
            key="delete"
            {...rowActionKind('delete')}
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<MaterialBatch>
        columnPersistenceId="apps.master-data.pages.materials.batches"
        headerTitle={t('app.master-data.menu.materials.batches')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20, batchNo, status } = params || {};
          const { sortBy: raw, sortOrder } = extractProTableSort(sort);
          const sortBy = raw ? batchSortFieldMap[raw] : undefined;
          const res = await materialBatchApi.list({
            batchNo: batchNo as string | undefined,
            status: status as string | undefined,
            page: current,
            pageSize,
            keyword: searchFormValues?.keyword?.trim() || undefined,
            sortBy,
            sortOrder,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        search={{
          labelWidth: 'auto',
        }}
        showCreateButton
        createButtonText={t('pages.system.create')}
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
          label={t('app.master-data.batches.quantity')}
          initialValue={0}
          min={0}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="status"
          label={t('app.master-data.batches.status')}
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
