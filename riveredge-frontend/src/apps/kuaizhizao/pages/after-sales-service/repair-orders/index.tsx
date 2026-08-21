import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { UniTable } from '../../../../../components/uni-table';
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
  const { message: messageApi, modal } = App.useApp();
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

  const openEdit = async (row: RepairOrder) => {
    setEditing(await repairOrderApi.get(row.id));
    setModalOpen(true);
  };

  const confirmDelete = (row: RepairOrder) => {
    modal.confirm({
      title: t('common.confirmDelete'),
      onOk: async () => {
        await repairOrderApi.delete(row.id);
        messageApi.success(t('common.deleteSuccess'));
        if (detail?.id === row.id) {
          setDetailOpen(false);
          setDetail(null);
        }
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<RepairOrder>[] = useMemo(
    () =>
      alignProColumns<RepairOrder>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.repairOrder.field.orderCode'),
            dataIndex: 'order_code',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            fixed: 'left',
            copyable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName'),
            dataIndex: 'customer_name',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
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
            title: t('common.status'),
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
              perms.canUpdate && row.status !== '已关闭' ? (
                <Button
                  {...rowActionKind('update')}
                  key="edit"
                  onClick={() => void openEdit(row)}
                />
              ) : null,
              perms.canDelete && row.status === '待派工' ? (
                <Button
                  {...rowActionKind('delete')}
                  key="delete"
                  onClick={() => confirmDelete(row)}
                />
              ) : null,
            ],
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [messageApi, modal, perms.canDelete, perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<RepairOrder>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.repair-orders.v3"
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
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
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
            messageApi.success(t('common.saveSuccess'));
          } else {
            await repairOrderApi.create(payload);
            messageApi.success(t('common.createSuccess'));
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
                key: 'edit',
                visible: Boolean(detail && perms.canUpdate && detail.status !== '已关闭'),
                render: (
                  <Button
                    onClick={() => {
                      if (!detail) return;
                      void openEdit(detail);
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                ),
              },
              {
                key: 'close',
                visible: Boolean(detail && perms.canAction?.('close') && detail.status !== '已关闭'),
                render: (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!detail) return;
                      await repairOrderApi.close(detail.id);
                      setDetail(await repairOrderApi.get(detail.id));
                      actionRef.current?.reload();
                      messageApi.success(t('app.kuaizhizao.afterSalesService.repairOrder.closeSuccess'));
                    }}
                  >
                    {t('common.close')}
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
