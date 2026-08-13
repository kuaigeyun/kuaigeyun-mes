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
import { SourceDocumentCode } from '../../../../../components/linked-document-code/SourceDocumentCode';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  AFTER_SALES_DISPATCH_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../shared/afterSalesListPresentation';
import { serviceDispatchApi, type ServiceDispatchOrder } from '../../../services/after-sales-service';
import DispatchOrderFormModal from './DispatchOrderFormModal';
import { DispatchOrderDetailDrawer } from './components/DispatchOrderDetailDrawer';

const RESOURCE = 'kuaizhizao:service-dispatch';

const DispatchOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDispatchOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceDispatchOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await serviceDispatchApi.get(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.afterSalesService.detail.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: ServiceDispatchOrder) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const columns: ProColumns<ServiceDispatchOrder>[] = useMemo(
    () =>
      alignProColumns<ServiceDispatchOrder>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.dispatchCode'),
            dataIndex: 'dispatch_code',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.dispatch_code ?? '').trim() || '-'}
                secondary={String(row.customer_name ?? '').trim() || '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.customerName'),
            dataIndex: 'customer_name',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.sourceCode'),
            dataIndex: 'source_code',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => (
              <SourceDocumentCode
                sourceType={row.source_type}
                sourceId={row.source_id}
                sourceCode={row.source_code}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.engineerName'),
            dataIndex: 'engineer_name',
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => row.engineer_name || '-',
          },
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedStartAt'),
            dataIndex: 'planned_start_at',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => (row.planned_start_at ? formatDateTime(row.planned_start_at) : '-'),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) =>
              renderAfterSalesStatusTag(row.status, AFTER_SALES_DISPATCH_STATUS_COLOR),
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
                    setEditing(await serviceDispatchApi.get(row.id));
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
      <UniTable<ServiceDispatchOrder>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.dispatch-orders.v1"
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.after-sales-service.dispatch-orders')}
        request={async (params) => {
          const res = await serviceDispatchApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
            status: params.status as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.afterSalesService.dispatchOrder.createTitle')}
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => serviceDispatchApi.delete(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <DispatchOrderFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={async (payload) => {
          if (editing) {
            await serviceDispatchApi.update(editing.id, payload);
            message.success(t('common.saveSuccess'));
          } else {
            await serviceDispatchApi.create(payload);
            message.success(t('common.createSuccess'));
          }
          actionRef.current?.reload();
        }}
      />

      <DispatchOrderDetailDrawer
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
                key: 'assign',
                visible: Boolean(detail && perms.canAction?.('assign')),
                render: () => (
                  <Button
                    onClick={async () => {
                      if (!detail) return;
                      await serviceDispatchApi.assign(detail.id, {
                        engineer_name: detail.engineer_name ?? undefined,
                      });
                      setDetail(await serviceDispatchApi.get(detail.id));
                      actionRef.current?.reload();
                    }}
                  >
                    {t('app.kuaizhizao.afterSalesService.dispatchOrder.actionAssign')}
                  </Button>
                ),
              },
              {
                key: 'close',
                visible: Boolean(detail && perms.canAction?.('close') && detail.status !== '已取消'),
                render: () => (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!detail) return;
                      await serviceDispatchApi.close(detail.id);
                      setDetail(await serviceDispatchApi.get(detail.id));
                      actionRef.current?.reload();
                    }}
                  >
                    {t('app.kuaizhizao.afterSalesService.dispatchOrder.actionClose')}
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

export default DispatchOrdersPage;
