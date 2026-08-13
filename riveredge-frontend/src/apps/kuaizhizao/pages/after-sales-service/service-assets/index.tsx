import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import {
  AFTER_SALES_ASSET_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../shared/afterSalesListPresentation';
import { serviceAssetApi, type ServiceAsset } from '../../../services/after-sales-service';
import ServiceAssetFormModal from './ServiceAssetFormModal';
import { ServiceAssetDetailDrawer } from './components/ServiceAssetDetailDrawer';

const RESOURCE = 'kuaizhizao:service-asset';

const ServiceAssetsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceAsset | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceAsset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = async (row: ServiceAsset) => {
    const full = await serviceAssetApi.get(row.id);
    setEditing(full);
    setModalOpen(true);
  };

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await serviceAssetApi.get(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.afterSalesService.detail.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: ServiceAsset) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const columns: ProColumns<ServiceAsset>[] = useMemo(
    () =>
      alignProColumns<ServiceAsset>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.assetCode'),
            key: 'after_sales_asset_stacked',
            dataIndex: 'asset_code',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.asset_code ?? '').trim() || '-'}
                secondary={String(row.customer_name ?? '').trim() || '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.customerName'),
            dataIndex: 'customer_name',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialName'),
            dataIndex: 'material_name',
            width: 168,
            minWidth: 168,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.material_name ?? '').trim() || '-'}
                secondary={String(row.serial_number ?? '').trim() || '-'}
                secondaryCopyable={Boolean(String(row.serial_number ?? '').trim())}
                primaryBold={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.serialNumber'),
            dataIndex: 'serial_number',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) =>
              renderAfterSalesStatusTag(row.status, AFTER_SALES_ASSET_STATUS_COLOR),
          },
          {
            title: t('common.action'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              <Button {...rowActionKind('read')} key="read" onClick={() => openDetail(row)} />,
              perms.canUpdate ? (
                <Button {...rowActionKind('update')} key="edit" onClick={() => void openEdit(row)} />
              ) : null,
            ],
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ServiceAsset>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.service-assets.v1"
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

      <ServiceAssetDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError(null);
        }}
        record={detail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (!detail) return;
          void openEdit(detail);
        })}
      />
    </ListPageTemplate>
  );
};

export default ServiceAssetsPage;
