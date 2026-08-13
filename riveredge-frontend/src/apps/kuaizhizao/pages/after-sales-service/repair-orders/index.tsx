import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  AFTER_SALES_REPAIR_STATUS_COLOR,
  renderAfterSalesStatusTag,
  renderAfterSalesTypeMarker,
} from '../shared/afterSalesListPresentation';
import { repairOrderApi, type RepairOrder } from '../../../services/after-sales-service';
import RepairOrderFormModal from './RepairOrderFormModal';
import { RepairOrderDetailDrawer } from './components/RepairOrderDetailDrawer';

const RESOURCE = 'kuaizhizao:repair-order';

const RepairOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RepairOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<RepairOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await repairOrderApi.get(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.afterSalesService.detail.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: RepairOrder) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const columns: ProColumns<RepairOrder>[] = useMemo(
    () =>
      alignProColumns<RepairOrder>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.repairOrder.field.orderCode'),
            dataIndex: 'order_code',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.order_code ?? '').trim() || '-'}
                secondary={String(row.customer_name ?? '').trim() || '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName'),
            dataIndex: 'customer_name',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.repairOrder.field.repairMode'),
            dataIndex: 'repair_mode',
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => renderAfterSalesTypeMarker(row.repair_mode),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.repairOrder.field.reportedAt'),
            dataIndex: 'reported_at',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => (row.reported_at ? formatDateTime(row.reported_at) : '-'),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.repairOrder.field.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) =>
              renderAfterSalesStatusTag(row.status, AFTER_SALES_REPAIR_STATUS_COLOR),
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
                <Button
                  {...rowActionKind('update')}
                  key="edit"
                  onClick={async () => {
                    setEditing(await repairOrderApi.get(row.id));
                    setModalOpen(true);
                  }}
                />
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
      <UniTable<RepairOrder>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.repair-orders.v1"
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.after-sales-service.repair-orders')}
        request={async (params) => {
          const res = await repairOrderApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
            status: params.status as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.afterSalesService.repairOrder.createTitle')}
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => repairOrderApi.delete(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <RepairOrderFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={async (payload) => {
          if (editing) {
            await repairOrderApi.update(editing.id, payload);
            message.success(t('common.saveSuccess'));
          } else {
            await repairOrderApi.create(payload);
            message.success(t('common.createSuccess'));
          }
          actionRef.current?.reload();
        }}
      />

      <RepairOrderDetailDrawer
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
        extra={
          <DetailDrawerActions
            items={[
              {
                key: 'close',
                visible: Boolean(detail && perms.canAction?.('close') && detail.status !== '已关闭'),
                render: () => (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!detail) return;
                      await repairOrderApi.close(detail.id);
                      setDetail(await repairOrderApi.get(detail.id));
                      actionRef.current?.reload();
                      message.success(t('app.kuaizhizao.afterSalesService.repairOrder.closeSuccess'));
                    }}
                  >
                    {t('app.kuaizhizao.afterSalesService.repairOrder.actionClose')}
                  </Button>
                ),
              },
            ]}
          />
        }
      />
    </ListPageTemplate>
  );
};

export default RepairOrdersPage;
