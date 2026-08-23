import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { UniTable } from '../../../../../components/uni-table';
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
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const RESOURCE = 'kuaizhizao:service-dispatch';

const DispatchOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
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

  const openEdit = async (row: ServiceDispatchOrder) => {
    setEditing(await serviceDispatchApi.get(row.id));
    setModalOpen(true);
  };

  const confirmDelete = (row: ServiceDispatchOrder) => {
    modal.confirm({
      title: t('common.confirmDelete'),
      onOk: async () => {
        await serviceDispatchApi.delete(row.id);
        messageApi.success(t('common.deleteSuccess'));
        if (detail?.id === row.id) {
          setDetailOpen(false);
          setDetail(null);
        }
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<ServiceDispatchOrder>[] = useMemo(
    () =>
      alignProColumns<ServiceDispatchOrder>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.dispatchCode'),
            dataIndex: 'dispatch_code',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            fixed: 'left',
            copyable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.customerName'),
            dataIndex: 'customer_name',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
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
            title: t('common.status'),
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
              perms.canUpdate && row.status !== '已取消' ? (
                <Button
                  {...rowActionKind('update')}
                  key="edit"
                  onClick={() => void openEdit(row)}
                />
              ) : null,
              perms.canDelete && (row.status === '待接单' || row.status === '已取消') ? (
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
      <UniTable<ServiceDispatchOrder>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.afterSalesDispatch)}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.dispatch-orders.v3"
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
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
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
            messageApi.success(t('common.saveSuccess'));
          } else {
            await serviceDispatchApi.create(payload);
            messageApi.success(t('common.createSuccess'));
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
                key: 'edit',
                visible: Boolean(detail && perms.canUpdate && detail.status !== '已取消'),
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
                key: 'assign',
                visible: Boolean(detail && perms.canAction?.('assign') && detail.status !== '已取消'),
                render: (
                  <Button
                    onClick={async () => {
                      if (!detail) return;
                      await serviceDispatchApi.assign(detail.id, {
                        engineer_name: detail.engineer_name ?? undefined,
                      });
                      setDetail(await serviceDispatchApi.get(detail.id));
                      actionRef.current?.reload();
                      messageApi.success(t('app.kuaizhizao.afterSalesService.dispatchOrder.assignSuccess'));
                    }}
                  >
                    {t('app.kuaizhizao.afterSalesService.dispatchOrder.actionAssign')}
                  </Button>
                ),
              },
              {
                key: 'close',
                visible: Boolean(detail && perms.canAction?.('close') && detail.status !== '已取消'),
                render: (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!detail) return;
                      await serviceDispatchApi.close(detail.id);
                      setDetail(await serviceDispatchApi.get(detail.id));
                      actionRef.current?.reload();
                      messageApi.success(t('app.kuaizhizao.afterSalesService.dispatchOrder.closeSuccess'));
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

export default DispatchOrdersPage;
