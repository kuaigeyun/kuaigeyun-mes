/**
 * 物料序列号台账（唯一序列号、状态与日期；与「序列号规则」配置、质量管理追溯互补）
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProFormText, ProFormSelect, ProFormDatePicker } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formatBusinessDateOnly } from '../../../../../utils/format';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { materialSerialApi, materialApi } from '../../../services/material';
import type { MaterialSerial, MaterialSerialCreate, MaterialSerialUpdate } from '../../../types/material';

const SerialsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const serialStatusOptions = useMemo(
    () => [
      { label: t('app.master-data.inventoryStatus.inStock'), value: 'in_stock' },
      { label: t('app.master-data.inventoryStatus.outStock'), value: 'out_stock' },
      { label: t('app.master-data.inventoryStatus.sold'), value: 'sold' },
      { label: t('app.master-data.inventoryStatus.scrapped'), value: 'scrapped' },
      { label: t('app.master-data.inventoryStatus.returned'), value: 'returned' },
    ],
    [t],
  );

  const serialStatusValueEnum = useMemo(
    () => ({
      in_stock: { text: t('app.master-data.inventoryStatus.inStock'), status: 'Success' as const },
      out_stock: { text: t('app.master-data.inventoryStatus.outStock'), status: 'Default' as const },
      sold: { text: t('app.master-data.inventoryStatus.sold'), status: 'Processing' as const },
      scrapped: { text: t('app.master-data.inventoryStatus.scrapped'), status: 'Warning' as const },
      returned: { text: t('app.master-data.inventoryStatus.returned'), status: 'Error' as const },
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

  const handleEdit = async (record: MaterialSerial) => {
    setIsEdit(true);
    setCurrentUuid(record.uuid);
    setModalVisible(true);
    try {
      const detail = await materialSerialApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        materialUuid: detail.materialUuid,
        serialNo: detail.serialNo,
        productionDate: detail.productionDate,
        factoryDate: detail.factoryDate,
        supplierSerialNo: detail.supplierSerialNo,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.serials.getDetailFailed'));
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
        const upd: MaterialSerialUpdate = {
          productionDate: formatDate(values.productionDate),
          factoryDate: formatDate(values.factoryDate),
          supplierSerialNo: values.supplierSerialNo as string | undefined,
          status: values.status as string | undefined,
          remark: values.remark as string | undefined,
        };
        await materialSerialApi.update(currentUuid, upd);
        messageApi.success(t('common.updateSuccess'));
      } else {
        const crt: MaterialSerialCreate = {
          materialUuid: values.materialUuid as string,
          serialNo: values.serialNo as string,
          productionDate: formatDate(values.productionDate),
          factoryDate: formatDate(values.factoryDate),
          supplierSerialNo: values.supplierSerialNo as string | undefined,
          status: (values.status as string) ?? 'in_stock',
          remark: values.remark as string | undefined,
        };
        await materialSerialApi.create(crt);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.operationFailed'));
      throw e;
    }
  };

  const handleDelete = async (record: MaterialSerial) => {
    try {
      await materialSerialApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await materialSerialApi.delete(String(key));
    }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const formatSerialDateCell = (value: unknown) => {
    if (value == null || value === '') return '-';
    return formatBusinessDateOnly(String(value));
  };

  const serialSortFieldMap: Record<string, string> = {
    serialNo: 'serial_no',
    materialCode: 'material_code',
    materialName: 'material_name',
    materialModel: 'material_model',
    status: 'status',
    productionDate: 'production_date',
    factoryDate: 'factory_date',
  };

  const columns: ProColumns<MaterialSerial>[] = [
    {
      title: t('app.master-data.serials.serialNo'),
      dataIndex: 'serialNo',
      width: 220,
      ellipsis: true,
      sorter: true,
      copyable: true,
    },
    {
      title: t('app.master-data.serials.materialCode'),
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
      copyable: true,
    },
    {
      title: t('app.master-data.serials.materialName'),
      dataIndex: 'materialName',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.serials.materialModel'),
      dataIndex: 'materialModel',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.serials.status'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      sorter: true,
      valueEnum: serialStatusValueEnum,
    },
    {
      title: t('app.master-data.serials.productionDate'),
      dataIndex: 'productionDate',
      width: 120,
      valueType: 'date',
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatSerialDateCell(r.productionDate),
    },
    {
      title: t('app.master-data.serials.factoryDate'),
      dataIndex: 'factoryDate',
      width: 120,
      valueType: 'date',
      sorter: true,
      hideInSearch: true,
      render: (_, r) => formatSerialDateCell(r.factoryDate),
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
      <UniTable<MaterialSerial>
        columnPersistenceId="apps.master-data.pages.materials.serials"
        headerTitle={t('app.master-data.menu.materials.serials')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20, serialNo, status } = params || {};
          const { sortBy: raw, sortOrder } = extractProTableSort(sort);
          const sortBy = raw ? serialSortFieldMap[raw] : undefined;
          const res = await materialSerialApi.list({
            serialNo: serialNo as string | undefined,
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
        title={
          isEdit
            ? `${t('field.customField.edit')}${t('app.master-data.serials.serialNo')}`
            : `${t('pages.system.create')}${t('app.master-data.serials.serialNo')}`
        }
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
      >
        <ProFormSelect
          name="materialUuid"
          label={t('app.master-data.serials.material')}
          rules={[{ required: !isEdit, message: t('app.master-data.serials.selectMaterial') }]}
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
          name="serialNo"
          label={t('app.master-data.serials.serialNo')}
          rules={[{ required: true, message: t('app.master-data.serials.enterSerialNo') }]}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="productionDate"
          label={t('app.master-data.serials.productionDate')}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="factoryDate"
          label={t('app.master-data.serials.factoryDate')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="supplierSerialNo"
          label={t('app.master-data.serials.supplierSerialNo')}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="status"
          label={t('app.master-data.serials.status')}
          options={serialStatusOptions}
          initialValue="in_stock"
          colProps={{ span: 12 }}
        />
        <ProFormText name="remark" label={t('common.remark')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SerialsPage;
