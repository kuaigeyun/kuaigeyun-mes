import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Form, Input, Modal, Select, Switch, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { createDriver, deleteDriver, listDrivers, updateDriver, type Driver } from '../../../services/logistics';

const DriversPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:driver');
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);

  const columns: ProColumns<Driver>[] = [
    { title: t('app.kuaizhizao.logistics.field.code'), dataIndex: 'code' },
    { title: t('app.kuaizhizao.logistics.field.driverName'), dataIndex: 'name' },
    { title: t('app.kuaizhizao.logistics.field.phone'), dataIndex: 'phone' },
    {
      title: t('app.kuaizhizao.logistics.field.ownership'),
      dataIndex: 'ownership',
      render: (_, row) =>
        row.ownership === 'internal'
          ? t('app.kuaizhizao.logistics.option.ownership.internal')
          : t('app.kuaizhizao.logistics.option.ownership.external'),
    },
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
              await deleteDriver(row.id);
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
    form.setFieldsValue({ ownership: 'internal', is_enabled: true });
    setOpen(true);
  };

  const openEdit = (row: Driver) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateDriver(editing.id, values);
      message.success(t('common.updateSuccess'));
    } else {
      await createDriver(values);
      message.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  return (
    <ListPageTemplate>
      <UniTable<Driver>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        request={async (params) => {
          const res = await listDrivers({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.logistics.action.createDriver')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => deleteDriver(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />
      <Modal open={open} title={editing ? t('common.edit') : t('common.create')} onCancel={() => setOpen(false)} onOk={handleSubmit} destroyOnClose>
        <Form form={form} layout="vertical">
          {!editing ? (
            <Form.Item name="code" label={t('app.kuaizhizao.logistics.field.code')}>
              <Input placeholder={t('app.kuaizhizao.logistics.placeholder.autoCode')} />
            </Form.Item>
          ) : null}
          <Form.Item name="name" label={t('app.kuaizhizao.logistics.field.driverName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('app.kuaizhizao.logistics.field.phone')}>
            <Input />
          </Form.Item>
          <Form.Item name="license_number" label={t('app.kuaizhizao.logistics.field.licenseNumber')}>
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
          <Form.Item name="is_enabled" label={t('app.kuaizhizao.logistics.field.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </ListPageTemplate>
  );
};

export default DriversPage;
