import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Form, Input, InputNumber, Modal, Select, Switch, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { createVehicle, deleteVehicle, listVehicles, updateVehicle, type Vehicle } from '../../../services/logistics';

const VehiclesPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:vehicle');
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const columns: ProColumns<Vehicle>[] = [
    { title: t('app.kuaizhizao.logistics.field.plateNumber'), dataIndex: 'plate_number' },
    { title: t('app.kuaizhizao.logistics.field.vehicleType'), dataIndex: 'vehicle_type' },
    {
      title: t('app.kuaizhizao.logistics.field.ownership'),
      dataIndex: 'ownership',
      render: (_, row) =>
        row.ownership === 'internal'
          ? t('app.kuaizhizao.logistics.option.ownership.internal')
          : t('app.kuaizhizao.logistics.option.ownership.external'),
    },
    { title: t('app.kuaizhizao.logistics.field.status'), dataIndex: 'status' },
    {
      title: t('common.action'),
      valueType: 'option',
      width: 160,
      render: (_, row) => [
        perms.canUpdate ? <a key="edit" onClick={() => openEdit(row)}>{t('common.edit')}</a> : null,
        perms.canDelete ? (
          <a
            key="delete"
            onClick={async () => {
              await deleteVehicle(row.id);
              message.success(t('common.deleteSuccess'));
              actionRef.current?.reload();
            }}
          >
            {t('common.delete')}
          </a>
        ) : null,
      ],
    },
  ];

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ ownership: 'internal', status: 'idle', is_enabled: true });
    setOpen(true);
  };

  const openEdit = (row: Vehicle) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateVehicle(editing.id, values);
      message.success(t('common.updateSuccess'));
    } else {
      await createVehicle(values);
      message.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  return (
    <ListPageTemplate>
      <UniTable<Vehicle>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        request={async (params) => {
          const res = await listVehicles({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.logistics.action.createVehicle')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => deleteVehicle(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />
      <Modal open={open} title={editing ? t('common.edit') : t('common.create')} onCancel={() => setOpen(false)} onOk={handleSubmit} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="plate_number" label={t('app.kuaizhizao.logistics.field.plateNumber')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="vehicle_type" label={t('app.kuaizhizao.logistics.field.vehicleType')}>
            <Input />
          </Form.Item>
          <Form.Item name="ownership" label={t('app.kuaizhizao.logistics.field.ownership')}>
            <Select
              options={[
                { label: t('app.kuaizhizao.logistics.option.ownership.internal'), value: 'internal' },
                { label: t('app.kuaizhizao.logistics.option.ownership.external'), value: 'external' },
              ]}
            />
          </Form.Item>
          <Form.Item name="load_capacity" label={t('app.kuaizhizao.logistics.field.loadCapacity')}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label={t('app.kuaizhizao.logistics.field.status')}>
            <Select
              options={[
                { label: t('app.kuaizhizao.logistics.option.vehicleStatus.idle'), value: 'idle' },
                { label: t('app.kuaizhizao.logistics.option.vehicleStatus.inTransit'), value: 'in_transit' },
                { label: t('app.kuaizhizao.logistics.option.vehicleStatus.maintenance'), value: 'maintenance' },
                { label: t('app.kuaizhizao.logistics.option.vehicleStatus.disabled'), value: 'disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item name="is_enabled" label={t('app.kuaizhizao.logistics.field.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </ListPageTemplate>
  );
};

export default VehiclesPage;
