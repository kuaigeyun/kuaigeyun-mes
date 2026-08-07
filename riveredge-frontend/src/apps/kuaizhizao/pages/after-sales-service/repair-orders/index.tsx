import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Space, Tag, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTime } from '../../../../../utils/format';
import { repairOrderApi, type RepairOrder } from '../../../services/after-sales-service';
import RepairOrderFormModal from './RepairOrderFormModal';

const RESOURCE = 'kuaizhizao:repair-order';

const statusColor: Record<string, string> = {
  待派工: 'default',
  维修中: 'processing',
  待验收: 'warning',
  已关闭: 'success',
};

const RepairOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RepairOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<RepairOrder | null>(null);

  const columns: ProColumns<RepairOrder>[] = [
    { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.orderCode'), dataIndex: 'order_code' },
    { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName'), dataIndex: 'customer_name' },
    { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.repairMode'), dataIndex: 'repair_mode' },
    {
      title: t('app.kuaizhizao.afterSalesService.repairOrder.field.status'),
      dataIndex: 'status',
      render: (_, row) => <Tag color={statusColor[row.status ?? ''] || 'default'}>{row.status}</Tag>,
    },
    {
      title: t('app.kuaizhizao.afterSalesService.repairOrder.field.reportedAt'),
      dataIndex: 'reported_at',
      render: (_, row) => (row.reported_at ? formatDateTime(row.reported_at) : '-'),
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
              setEditing(await repairOrderApi.get(row.id));
              setModalOpen(true);
            }}
          />
        ) : null,
      ],
    },
  ];

  const openDetail = async (row: RepairOrder) => {
    setDetail(await repairOrderApi.get(row.id));
    setDetailOpen(true);
  };

  return (
    <ListPageTemplate>
      <UniTable<RepairOrder>
        actionRef={actionRef}
        columns={columns}
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

      <Drawer
        open={detailOpen}
        width={720}
        title={detail?.order_code}
        onClose={() => setDetailOpen(false)}
        extra={
          detail && perms.canAction?.('close') && detail.status !== '已关闭' ? (
            <Space>
              <Button
                onClick={async () => {
                  await repairOrderApi.close(detail.id);
                  setDetail(await repairOrderApi.get(detail.id));
                  actionRef.current?.reload();
                  message.success(t('app.kuaizhizao.afterSalesService.repairOrder.closeSuccess'));
                }}
              >
                {t('app.kuaizhizao.afterSalesService.repairOrder.actionClose')}
              </Button>
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <p>{t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName')}: {detail.customer_name}</p>
            <p>{t('app.kuaizhizao.afterSalesService.repairOrder.field.faultDescription')}: {detail.fault_description}</p>
            <p>{t('app.kuaizhizao.afterSalesService.repairOrder.field.diagnosisResult')}: {detail.diagnosis_result || '-'}</p>
            <p>{t('app.kuaizhizao.afterSalesService.repairOrder.field.resolution')}: {detail.resolution || '-'}</p>
            <p>{t('app.kuaizhizao.afterSalesService.repairOrder.field.totalCost')}: {detail.total_cost ?? '-'}</p>
          </>
        ) : null}
      </Drawer>
    </ListPageTemplate>
  );
};

export default RepairOrdersPage;
