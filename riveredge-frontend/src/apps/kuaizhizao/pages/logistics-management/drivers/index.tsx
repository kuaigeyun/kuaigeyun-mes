import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
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
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import {
  alignDescriptionColumns,
  alignProColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import { LogisticsMasterDetailDrawer } from '../shared/LogisticsMasterDetailDrawer';
import {
  renderLogisticsEnabledTag,
  renderLogisticsOwnershipTag,
} from '../shared/logisticsListPresentation';
import { createDriver, deleteDriver, listDrivers, updateDriver, type Driver } from '../../../services/logistics';

const DriversPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:driver');
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Driver | null>(null);

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
      if (detail?.id === editing.id) {
        setDetail({ ...detail, ...values });
      }
    } else {
      await createDriver(values);
      message.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  const openDetail = (row: Driver) => {
    setDetail(row);
    setDetailOpen(true);
  };

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns<Driver>(
        [
          { title: t('app.kuaizhizao.logistics.field.code'), dataIndex: 'code' },
          { title: t('app.kuaizhizao.logistics.field.driverName'), dataIndex: 'name' },
          { title: t('app.kuaizhizao.logistics.field.phone'), dataIndex: 'phone' },
          { title: t('app.kuaizhizao.logistics.field.licenseNumber'), dataIndex: 'license_number' },
          {
            title: t('app.kuaizhizao.logistics.field.ownership'),
            dataIndex: 'ownership',
            render: (_, record) => renderLogisticsOwnershipTag(t, record.ownership),
          },
          {
            title: t('app.kuaizhizao.logistics.field.enabled'),
            dataIndex: 'is_enabled',
            render: (_, record) => renderLogisticsEnabledTag(t, record.is_enabled),
          },
          { title: t('common.remark'), dataIndex: 'remark', span: 2 },
        ] as ProDescriptionsItemProps<Driver>[],
        MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
      ),
    [t],
  );

  const columns: ProColumns<Driver>[] = useMemo(
    () =>
      alignProColumns<Driver>([
        {
          title: t('app.kuaizhizao.logistics.field.driverName'),
          key: 'logistics_driver_stacked',
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
          title: t('app.kuaizhizao.logistics.field.phone'),
          dataIndex: 'phone',
          width: 132,
          minWidth: 132,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => row.phone || '-',
        },
        {
          title: t('app.kuaizhizao.logistics.field.ownership'),
          dataIndex: 'ownership',
          width: 96,
          minWidth: 96,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => renderLogisticsOwnershipTag(t, row.ownership),
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
            if (perms.canRead) {
              nodes.push(
                <Button key="detail" {...rowActionKind('read')} type="link" size="small" onClick={() => openDetail(row)}>
                  {t('common.detail')}
                </Button>,
              );
            }
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
                    await deleteDriver(row.id);
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
    [perms.canDelete, perms.canRead, perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<Driver>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.logistics-management.drivers.v1"
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
      <LogisticsMasterDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        record={detail}
        title={`${t('app.kuaizhizao.logistics.detail.driverTitle')}${detail?.name ? ` - ${detail.name}` : ''}`}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (detail) openEdit(detail);
        })}
        basicColumns={basicColumns}
      />
      <Modal
        open={open}
        title={editing ? t('common.edit') : t('common.create')}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        destroyOnHidden
      >
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
