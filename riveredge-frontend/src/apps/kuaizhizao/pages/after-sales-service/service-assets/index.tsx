import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Tag, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTime } from '../../../../../utils/format';
import { serviceAssetApi, type ServiceAsset } from '../../../services/after-sales-service';
import ServiceAssetFormModal from './ServiceAssetFormModal';

const RESOURCE = 'kuaizhizao:service-asset';

const statusColor: Record<string, string> = {
  在用: 'success',
  停用: 'default',
  报废: 'error',
};

const ServiceAssetsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceAsset | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceAsset | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = async (row: ServiceAsset) => {
    const full = await serviceAssetApi.get(row.id);
    setEditing(full);
    setModalOpen(true);
  };

  const openDetail = async (row: ServiceAsset) => {
    const full = await serviceAssetApi.get(row.id);
    setDetail(full);
    setDetailOpen(true);
  };

  const columns: ProColumns<ServiceAsset>[] = [
    { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.assetCode'), dataIndex: 'asset_code' },
    { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.customerName'), dataIndex: 'customer_name' },
    { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialName'), dataIndex: 'material_name' },
    { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.serialNumber'), dataIndex: 'serial_number' },
    {
      title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.status'),
      dataIndex: 'status',
      render: (_, row) => <Tag color={statusColor[row.status ?? ''] || 'default'}>{row.status}</Tag>,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      width: 160,
      render: (_, row) => [
        <Button {...rowActionKind('read')} key="read" onClick={() => void openDetail(row)} />,
        perms.canUpdate ? (
          <Button {...rowActionKind('update')} key="edit" onClick={() => void openEdit(row)} />
        ) : null,
      ],
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ServiceAsset>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.after-sales-service.service-assets')}
        request={async (params) => {
          const res = await serviceAssetApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
            status: params.status as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.afterSalesService.serviceAsset.createTitle')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => serviceAssetApi.delete(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <ServiceAssetFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={async (payload) => {
          if (editing) {
            await serviceAssetApi.update(editing.id, payload);
            message.success(t('common.saveSuccess'));
          } else {
            await serviceAssetApi.create(payload);
            message.success(t('common.createSuccess'));
          }
          actionRef.current?.reload();
        }}
      />

      <Drawer
        open={detailOpen}
        width={640}
        title={detail?.asset_code}
        onClose={() => setDetailOpen(false)}
      >
        {detail ? (
          <>
            <p>{t('app.kuaizhizao.afterSalesService.serviceAsset.field.customerName')}: {detail.customer_name}</p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialName')}: {detail.material_name || '-'}</p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceAsset.field.serialNumber')}: {detail.serial_number || '-'}</p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceAsset.field.installAddress')}: {detail.install_address || '-'}</p>
            <p>
              {t('app.kuaizhizao.afterSalesService.serviceAsset.field.warrantyEndAt')}:{' '}
              {detail.warranty_end_at ? formatDateTime(detail.warranty_end_at) : '-'}
            </p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceAsset.field.notes')}: {detail.notes || '-'}</p>
          </>
        ) : null}
      </Drawer>
    </ListPageTemplate>
  );
};

export default ServiceAssetsPage;
