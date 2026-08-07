import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Form, Input, Modal, Select, Switch, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  createCarrier,
  deleteCarrier,
  listCarriers,
  updateCarrier,
  type LogisticsCarrier,
} from '../../../services/logistics';

const CarriersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:logistics-carrier');
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsCarrier | null>(null);

  const columns: ProColumns<LogisticsCarrier>[] = [
    { title: t('app.kuaizhizao.logistics.field.code'), dataIndex: 'code' },
    { title: t('app.kuaizhizao.logistics.field.name'), dataIndex: 'name' },
    { title: t('app.kuaizhizao.logistics.field.carrierType'), dataIndex: 'carrier_type' },
    { title: t('app.kuaizhizao.logistics.field.contactName'), dataIndex: 'contact_name' },
    { title: t('app.kuaizhizao.logistics.field.contactPhone'), dataIndex: 'contact_phone' },
    {
      title: t('app.kuaizhizao.logistics.field.enabled'),
      dataIndex: 'is_enabled',
      render: (_, row) => (row.is_enabled ? t('common.yes') : t('common.no')),
    },
    {
      title: t('common.action'),
      valueType: 'option',
      width: 160,
      render: (_, row) => {
        const nodes: React.ReactNode[] = [];
        if (perms.canUpdate) {
          nodes.push(
            <a key="edit" onClick={() => openEdit(row)}>
              {t('common.edit')}
            </a>,
          );
        }
        if (perms.canDelete) {
          nodes.push(
            <a
              key="delete"
              onClick={async () => {
                await deleteCarrier(row.id);
                message.success(t('common.deleteSuccess'));
                actionRef.current?.reload();
              }}
            >
              {t('common.delete')}
            </a>,
          );
        }
        return nodes;
      },
    },
  ];

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ carrier_type: 'express', is_enabled: true });
    setOpen(true);
  };

  const openEdit = (row: LogisticsCarrier) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateCarrier(editing.id, values);
      message.success(t('common.updateSuccess'));
    } else {
      await createCarrier(values);
      message.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  return (
    <ListPageTemplate>
      <UniTable<LogisticsCarrier>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        request={async (params) => {
          const res = await listCarriers({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.logistics.action.createCarrier')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => deleteCarrier(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />
      <Modal
        open={open}
        title={editing ? t('common.edit') : t('common.create')}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {!editing ? (
            <Form.Item name="code" label={t('app.kuaizhizao.logistics.field.code')}>
              <Input placeholder={t('app.kuaizhizao.logistics.placeholder.autoCode')} />
            </Form.Item>
          ) : null}
          <Form.Item name="name" label={t('app.kuaizhizao.logistics.field.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="carrier_type" label={t('app.kuaizhizao.logistics.field.carrierType')}>
            <Select
              options={[
                { label: t('app.kuaizhizao.logistics.option.carrierType.express'), value: 'express' },
                { label: t('app.kuaizhizao.logistics.option.carrierType.truck'), value: 'truck' },
                { label: t('app.kuaizhizao.logistics.option.carrierType.ltl'), value: 'ltl' },
              ]}
            />
          </Form.Item>
          <Form.Item name="contact_name" label={t('app.kuaizhizao.logistics.field.contactName')}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_phone" label={t('app.kuaizhizao.logistics.field.contactPhone')}>
            <Input />
          </Form.Item>
          <Form.Item name="supplier_id" label={t('app.kuaizhizao.logistics.field.supplierId')}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="settlement_method" label={t('app.kuaizhizao.logistics.field.settlementMethod')}>
            <Input />
          </Form.Item>
          <Form.Item name="remark" label={t('common.remark')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_enabled" label={t('app.kuaizhizao.logistics.field.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </ListPageTemplate>
  );
};

export default CarriersPage;
