import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Button, Form, Input, InputNumber, Modal, Select, Switch, message } from 'antd';
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
  logisticsVehicleTypeLabel,
  renderLogisticsEnabledTag,
  renderLogisticsOwnershipTag,
  renderVehicleStatusTag,
} from '../shared/logisticsListPresentation';
import { createVehicle, deleteVehicle, listVehicles, updateVehicle, type Vehicle } from '../../../services/logistics';

const VehiclesPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:vehicle');
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Vehicle | null>(null);

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
      if (detail?.id === editing.id) {
        setDetail({ ...detail, ...values });
      }
    } else {
      await createVehicle(values);
      message.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  const openDetail = (row: Vehicle) => {
    setDetail(row);
    setDetailOpen(true);
  };

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns<Vehicle>(
        [
          { title: t('app.kuaizhizao.logistics.field.plateNumber'), dataIndex: 'plate_number' },
          {
            title: t('app.kuaizhizao.logistics.field.vehicleType'),
            dataIndex: 'vehicle_type',
            render: (_, record) => logisticsVehicleTypeLabel(t, record.vehicle_type),
          },
          {
            title: t('app.kuaizhizao.logistics.field.ownership'),
            dataIndex: 'ownership',
            render: (_, record) => renderLogisticsOwnershipTag(t, record.ownership),
          },
          { title: t('app.kuaizhizao.logistics.field.loadCapacity'), dataIndex: 'load_capacity' },
          {
            title: t('app.kuaizhizao.logistics.field.status'),
            dataIndex: 'status',
            render: (_, record) => renderVehicleStatusTag(t, record.status),
          },
          {
            title: t('app.kuaizhizao.logistics.field.enabled'),
            dataIndex: 'is_enabled',
            render: (_, record) => renderLogisticsEnabledTag(t, record.is_enabled),
          },
          { title: t('common.remark'), dataIndex: 'remark', span: 2 },
        ] as ProDescriptionsItemProps<Vehicle>[],
        MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
      ),
    [t],
  );

  const columns: ProColumns<Vehicle>[] = useMemo(
    () =>
      alignProColumns<Vehicle>([
        {
          title: t('app.kuaizhizao.logistics.field.plateNumber'),
          dataIndex: 'plate_number',
          ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
          fixed: 'left',
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.plate_number ?? '').trim() || '-'}
              secondary={String(row.vehicle_type ?? '').trim() || '-'}
              secondaryCopyable={false}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.vehicleType'),
          dataIndex: 'vehicle_type',
          hideInTable: true,
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
          title: t('app.kuaizhizao.logistics.field.status'),
          key: 'lifecycle',
          dataIndex: 'status',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => renderVehicleStatusTag(t, row.status),
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
                    await deleteVehicle(row.id);
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
      <UniTable<Vehicle>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.logistics-management.vehicles.v1"
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
      <LogisticsMasterDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        record={detail}
        title={`${t('app.kuaizhizao.logistics.detail.vehicleTitle')}${
          detail?.plate_number ? ` - ${detail.plate_number}` : ''
        }`}
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
          <Form.Item name="plate_number" label={t('app.kuaizhizao.logistics.field.plateNumber')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="vehicle_type" label={t('app.kuaizhizao.logistics.field.vehicleType')}>
            <Select
              allowClear
              options={[
                { value: 'van', label: t('app.kuaizhizao.logistics.option.vehicleType.van') },
                { value: 'flatbed', label: t('app.kuaizhizao.logistics.option.vehicleType.flatbed') },
                { value: 'refrigerated', label: t('app.kuaizhizao.logistics.option.vehicleType.refrigerated') },
                { value: 'trailer', label: t('app.kuaizhizao.logistics.option.vehicleType.trailer') },
                { value: 'other', label: t('app.kuaizhizao.logistics.option.vehicleType.other') },
              ]}
            />
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
