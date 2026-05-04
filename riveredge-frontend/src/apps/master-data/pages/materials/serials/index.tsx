/**
 * 物料序列号台账（唯一序列号、状态与日期；与「序列号规则」配置、质量管理追溯互补）
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ProFormText, ProFormSelect, ProFormDatePicker } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { materialSerialApi, materialApi } from '../../../services/material';
import type { MaterialSerial, MaterialSerialCreate, MaterialSerialUpdate } from '../../../types/material';

const SERIAL_STATUS_OPTIONS = [
  { label: '在库', value: 'in_stock' },
  { label: '已出库', value: 'out_stock' },
  { label: '已销售', value: 'sold' },
  { label: '已报废', value: 'scrapped' },
  { label: '已退货', value: 'returned' },
];

const SerialsPage: React.FC = () => {
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

  const handleEdit = async (record: MaterialSerial) => {
    setIsEdit(true);
    setCurrentUuid(record.uuid);
    setModalVisible(true);
    try {
      const detail = await materialSerialApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        materialUuid: detail.materialUuid ?? (detail as any).material_uuid,
        serialNo: detail.serialNo ?? (detail as any).serial_no,
        productionDate: detail.productionDate ?? (detail as any).production_date,
        factoryDate: detail.factoryDate ?? (detail as any).factory_date,
        supplierSerialNo: detail.supplierSerialNo ?? (detail as any).supplier_serial_no,
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

  const serialSortFieldMap: Record<string, string> = {
    serial_no: 'serial_no',
    material_name: 'material_name',
    status: 'status',
    productionDate: 'production_date',
    factoryDate: 'factory_date',
  };

  const columns: ProColumns<MaterialSerial>[] = [
    {
      title: t('app.master-data.serials.serialNo'),
      dataIndex: 'serial_no',
      width: 160,
      ellipsis: true,
      sorter: true,
      render: (_, r) => r.serialNo ?? (r as any).serial_no,
    },
    {
      title: t('app.master-data.serials.materialName'),
      dataIndex: 'material_name',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => r.materialName ?? (r as any).material_name ?? '-',
    },
    {
      title: t('app.master-data.serials.status'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      sorter: true,
      valueEnum: {
        in_stock: { text: '在库', status: 'Success' },
        out_stock: { text: '已出库', status: 'Default' },
        sold: { text: '已销售', status: 'Processing' },
        scrapped: { text: '已报废', status: 'Warning' },
        returned: { text: '已退货', status: 'Error' },
      },
      render: (_, r) => r.status ?? (r as any).status ?? '-',
    },
    {
      title: t('app.master-data.serials.productionDate'),
      dataIndex: 'productionDate',
      width: 120,
      valueType: 'date',
      sorter: true,
      render: (_, r) => r.productionDate ?? (r as any).production_date ?? '-',
    },
    {
      title: t('app.master-data.serials.factoryDate'),
      dataIndex: 'factoryDate',
      width: 120,
      valueType: 'date',
      sorter: true,
      render: (_, r) => r.factoryDate ?? (r as any).factory_date ?? '-',
    },
    {
      title: t('common.actions'),
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('field.customField.edit')}
          </Button>
          <Popconfirm title={t('common.confirmDelete')} onConfirm={() => handleDelete(record)}>
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
        headerTitle={t('app.master-data.menu.materials.serials')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20, serial_no, status } = params || {};
          const { sortBy: raw, sortOrder } = extractProTableSort(sort);
          const sortBy = raw ? serialSortFieldMap[raw] : undefined;
          const res = await materialSerialApi.list({
            serialNo: serial_no as string | undefined,
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
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('pages.system.create')}
          </Button>,
        ]}
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
              label: `${m.mainCode ?? m.main_code ?? m.code ?? ''} - ${m.name ?? ''}`.trim() || m.uuid,
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
          options={SERIAL_STATUS_OPTIONS}
          initialValue="in_stock"
          colProps={{ span: 12 }}
        />
        <ProFormText name="remark" label={t('common.remark')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SerialsPage;
