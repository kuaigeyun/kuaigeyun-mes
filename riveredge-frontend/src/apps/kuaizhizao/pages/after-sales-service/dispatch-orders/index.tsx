import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Space, Tag, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTime } from '../../../../../utils/format';
import { serviceDispatchApi, type ServiceDispatchOrder } from '../../../services/after-sales-service';
import DispatchOrderFormModal from './DispatchOrderFormModal';

const RESOURCE = 'kuaizhizao:service-dispatch';

const statusColor: Record<string, string> = {
  待接单: 'default',
  已接单: 'processing',
  到场: 'warning',
  完工: 'success',
  已取消: 'error',
};

const DispatchOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDispatchOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceDispatchOrder | null>(null);

  const columns: ProColumns<ServiceDispatchOrder>[] = [
    { title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.dispatchCode'), dataIndex: 'dispatch_code' },
    { title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.customerName'), dataIndex: 'customer_name' },
    { title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.sourceCode'), dataIndex: 'source_code' },
    { title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.engineerName'), dataIndex: 'engineer_name' },
    {
      title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.status'),
      dataIndex: 'status',
      render: (_, row) => <Tag color={statusColor[row.status ?? ''] || 'default'}>{row.status}</Tag>,
    },
    {
      title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedStartAt'),
      dataIndex: 'planned_start_at',
      render: (_, row) => (row.planned_start_at ? formatDateTime(row.planned_start_at) : '-'),
    },
    {
      title: t('common.action'),
      valueType: 'option',
      width: 180,
      render: (_, row) => [
        <Button {...rowActionKind('read')} key="read" onClick={() => void openDetail(row)} />,
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
  ];

  const openDetail = async (row: ServiceDispatchOrder) => {
    setDetail(await serviceDispatchApi.get(row.id));
    setDetailOpen(true);
  };

  return (
    <ListPageTemplate>
      <UniTable<ServiceDispatchOrder>
        actionRef={actionRef}
        columns={columns}
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

      <Drawer
        open={detailOpen}
        width={720}
        title={detail?.dispatch_code}
        onClose={() => setDetailOpen(false)}
        extra={
          detail ? (
            <Space wrap>
              {perms.canAction?.('assign') ? (
                <Button
                  onClick={async () => {
                    await serviceDispatchApi.assign(detail.id, {
                      engineer_name: detail.engineer_name ?? undefined,
                    });
                    setDetail(await serviceDispatchApi.get(detail.id));
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaizhizao.afterSalesService.dispatchOrder.actionAssign')}
                </Button>
              ) : null}
              {perms.canAction?.('close') && detail.status !== '已取消' ? (
                <Button
                  onClick={async () => {
                    await serviceDispatchApi.close(detail.id);
                    setDetail(await serviceDispatchApi.get(detail.id));
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaizhizao.afterSalesService.dispatchOrder.actionClose')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <p>{t('app.kuaizhizao.afterSalesService.dispatchOrder.field.customerName')}: {detail.customer_name}</p>
            <p>{t('app.kuaizhizao.afterSalesService.dispatchOrder.field.siteAddress')}: {detail.site_address || '-'}</p>
            <p>{t('app.kuaizhizao.afterSalesService.dispatchOrder.field.completionNotes')}: {detail.completion_notes || '-'}</p>
          </>
        ) : null}
      </Drawer>
    </ListPageTemplate>
  );
};

export default DispatchOrdersPage;
