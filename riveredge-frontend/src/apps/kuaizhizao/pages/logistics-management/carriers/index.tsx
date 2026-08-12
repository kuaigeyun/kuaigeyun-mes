import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Form, Input, Modal, Select, Switch, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { SupplierSelectDropdown } from '../../../../master-data/components/SupplierSelectDropdown';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import {
  renderLogisticsCarrierTypeTag,
  renderLogisticsEnabledTag,
} from '../shared/logisticsListPresentation';
import {
  createCarrier,
  deleteCarrier,
  listCarriers,
  updateCarrier,
  type LogisticsCarrier,
} from '../../../services/logistics';

const SETTLEMENT_METHOD_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: 'cash', labelKey: 'field.partner.settlementMethod.cash' },
  { value: 'bank_transfer', labelKey: 'field.partner.settlementMethod.bankTransfer' },
  { value: 'bank_acceptance', labelKey: 'field.partner.settlementMethod.bankAcceptance' },
  { value: 'commercial_acceptance', labelKey: 'field.partner.settlementMethod.commercialAcceptance' },
  { value: 'monthly', labelKey: 'field.partner.settlementMethod.monthly' },
  { value: 'prepaid', labelKey: 'field.partner.settlementMethod.prepaid' },
  { value: 'other', labelKey: 'field.partner.settlementMethod.other' },
];

const CarriersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:logistics-carrier');
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsCarrier | null>(null);

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

  const columns: ProColumns<LogisticsCarrier>[] = useMemo(
    () =>
      alignProColumns<LogisticsCarrier>([
        {
          title: t('app.kuaizhizao.logistics.field.name'),
          key: 'logistics_carrier_stacked',
          dataIndex: 'name',
          ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
          fixed: 'left',
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.name ?? '').trim() || '-'}
              secondary={String(row.code ?? '').trim() || '-'}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.code'),
          dataIndex: 'code',
          hideInTable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.carrierType'),
          dataIndex: 'carrier_type',
          width: 96,
          minWidth: 96,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => renderLogisticsCarrierTypeTag(t, row.carrier_type),
        },
        {
          title: t('app.kuaizhizao.logistics.field.contactName'),
          dataIndex: 'contact_name',
          width: 148,
          minWidth: 148,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.contact_name ?? '').trim() || '-'}
              secondary={String(row.contact_phone ?? '').trim() || '-'}
              secondaryCopyable={Boolean(String(row.contact_phone ?? '').trim())}
              primaryBold={false}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.contactPhone'),
          dataIndex: 'contact_phone',
          hideInTable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.enabled'),
          dataIndex: 'is_enabled',
          width: 88,
          minWidth: 88,
          uniTableKeepWidth: true,
          resizable: false,
          hideInSearch: true,
          render: (_, row) => renderLogisticsEnabledTag(t, row.is_enabled),
        },
        {
          title: t('common.action'),
          key: 'action',
          valueType: 'option',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => {
            const nodes: React.ReactNode[] = [];
            if (perms.canUpdate) {
              nodes.push(
                <Button key="edit" {...rowActionKind('update')} type="link" size="small" onClick={() => openEdit(row)}>
                  {t('common.edit')}
                </Button>,
              );
            }
            if (perms.canDelete) {
              nodes.push(
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  type="link"
                  size="small"
                  onClick={async () => {
                    await deleteCarrier(row.id);
                    message.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('common.delete')}
                </Button>,
              );
            }
            return nodes;
          },
        },
      ]),
    [perms.canDelete, perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<LogisticsCarrier>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.logistics-management.carriers.v1"
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
          <Form.Item name="supplier_id" label={t('app.kuaizhizao.logistics.field.supplier')}>
            <SupplierSelectDropdown
              hostResource="kuaizhizao:logistics-carrier"
              allowClear
              placeholder={t('app.kuaizhizao.logistics.placeholder.selectSupplier')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="settlement_method" label={t('app.kuaizhizao.logistics.field.settlementMethod')}>
            <Select
              allowClear
              options={SETTLEMENT_METHOD_OPTIONS.map((item) => ({
                value: item.value,
                label: t(item.labelKey),
              }))}
            />
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
