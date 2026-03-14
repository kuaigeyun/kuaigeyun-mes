/**
 * 批号记录管理页面
 *
 * 提供物料批号的 CRUD 功能，支持按物料、批号、状态筛选。
 * 新建批号后自动刷新列表。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ProFormText, ProFormSelect, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { materialBatchApi, materialApi } from '../../../services/material';
import type { MaterialBatch, MaterialBatchCreate, MaterialBatchUpdate } from '../../../types/material';

const BATCH_STATUS_OPTIONS = [
  { label: '在库', value: 'in_stock' },
  { label: '已出库', value: 'out_stock' },
  { label: '已过期', value: 'expired' },
  { label: '已报废', value: 'scrapped' },
];

const BatchesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);

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
        materialUuid: detail.materialUuid ?? (detail as any).material_uuid,
        batchNo: detail.batchNo ?? (detail as any).batch_no,
        productionDate: detail.productionDate ?? (detail as any).production_date,
        expiryDate: detail.expiryDate ?? (detail as any).expiry_date,
        supplierBatchNo: detail.supplierBatchNo ?? (detail as any).supplier_batch_no,
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
        await materialBatchApi.update(currentUuid, {
          productionDate: formatDate(values.productionDate),
          expiryDate: formatDate(values.expiryDate),
          supplierBatchNo: values.supplierBatchNo as string | undefined,
          quantity: values.quantity as number | undefined,
          status: values.status as string | undefined,
          remark: values.remark as string | undefined,
        });
        messageApi.success(t('common.updateSuccess'));
      } else {
        await materialBatchApi.create({
          materialUuid: values.materialUuid as string,
          batchNo: values.batchNo as string,
          productionDate: formatDate(values.productionDate),
          expiryDate: formatDate(values.expiryDate),
          supplierBatchNo: values.supplierBatchNo as string | undefined,
          quantity: (values.quantity as number) ?? 0,
          status: (values.status as string) ?? 'in_stock',
          remark: values.remark as string | undefined,
        });
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

  const columns: ProColumns<MaterialBatch>[] = [
    {
      title: t('app.master-data.batches.batchNo') || '批号',
      dataIndex: 'batch_no',
      width: 140,
      ellipsis: true,
      render: (_, r) => r.batchNo ?? (r as any).batch_no,
    },
    {
      title: t('app.master-data.batches.materialName') || '物料名称',
      dataIndex: 'material_name',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.materialName ?? (r as any).material_name ?? '-',
    },
    {
      title: t('app.master-data.batches.quantity') || '数量',
      dataIndex: 'quantity',
      width: 100,
      valueType: 'digit',
      render: (_, r) => r.quantity ?? (r as any).quantity ?? 0,
    },
    {
      title: t('app.master-data.batches.status') || '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        in_stock: { text: '在库', status: 'Success' },
        out_stock: { text: '已出库', status: 'Default' },
        expired: { text: '已过期', status: 'Error' },
        scrapped: { text: '已报废', status: 'Warning' },
      },
      render: (_, r) => r.status ?? (r as any).status ?? '-',
    },
    {
      title: t('app.master-data.batches.productionDate') || '生产日期',
      dataIndex: 'productionDate',
      width: 120,
      valueType: 'date',
      render: (_, r) => r.productionDate ?? (r as any).production_date ?? '-',
    },
    {
      title: t('app.master-data.batches.expiryDate') || '有效期',
      dataIndex: 'expiryDate',
      width: 120,
      valueType: 'date',
      render: (_, r) => r.expiryDate ?? (r as any).expiry_date ?? '-',
    },
    {
      title: t('common.actions'),
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm
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
        headerTitle={t('app.master-data.menu.materials.batches')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, material_uuid, batch_no, status } = params || {};
          const res = await materialBatchApi.list({
            materialUuid: material_uuid,
            batchNo: batch_no,
            status,
            page: current,
            pageSize,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('pages.system.create')}
          </Button>,
        ]}
      />

      <FormModalTemplate
        title={isEdit ? t('field.customField.edit') + '批号' : t('pages.system.create') + '批号'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
      >
        <ProFormSelect
          name="materialUuid"
          label={t('app.master-data.batches.material') || '物料'}
          rules={[{ required: !isEdit, message: t('app.master-data.batches.selectMaterial') }]}
          disabled={isEdit}
          request={async () => {
            const res = await materialApi.list({ limit: 500, isActive: true });
            const items = Array.isArray(res) ? res : (res as any)?.items ?? [];
            return items.map((m: any) => ({
              label: `${m.mainCode ?? m.main_code ?? m.code ?? ''} - ${m.name ?? ''}`.trim() || m.uuid,
              value: m.uuid,
            }));
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="batchNo"
          label={t('app.master-data.batches.batchNo') || '批号'}
          rules={[{ required: true, message: '请输入批号' }]}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="productionDate"
          label={t('app.master-data.batches.productionDate') || '生产日期'}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="expiryDate"
          label={t('app.master-data.batches.expiryDate') || '有效期'}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="supplierBatchNo"
          label={t('app.master-data.batches.supplierBatchNo') || '供应商批号'}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="quantity"
          label={t('app.master-data.batches.quantity') || '数量'}
          initialValue={0}
          min={0}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="status"
          label={t('app.master-data.batches.status') || '状态'}
          options={BATCH_STATUS_OPTIONS}
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
