import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Input, Modal, Space, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasReviewPermission } from '../../../../../utils/permissionContract';
import { serviceSettlementApi, type ServiceSettlement } from '../../../services/after-sales-service';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';

const RESOURCE = 'kuaizhizao:service-settlement';

const statusColor: Record<string, string> = {
  草稿: 'default',
  待审核: 'processing',
  已审核: 'success',
  已驳回: 'error',
};

const ServiceSettlementsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const currentUser = useCurrentUser();
  const canReview = hasReviewPermission(currentUser ?? undefined, RESOURCE);
  const actionRef = useRef<ActionType>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceSettlement | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const refreshDetail = async (id: number) => {
    const data = await serviceSettlementApi.get(id);
    setDetail(data);
    actionRef.current?.reload();
  };

  const columns: ProColumns<ServiceSettlement>[] = [
    {
      title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.settlementCode'),
      dataIndex: 'settlement_code',
    },
    {
      title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.customerName'),
      dataIndex: 'customer_name',
    },
    {
      title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.totalAmount'),
      dataIndex: 'total_amount',
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.status'),
      dataIndex: 'status',
      render: (_, row) => <Tag color={statusColor[row.status ?? ''] || 'default'}>{row.status}</Tag>,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      width: 120,
      render: (_, row) => [
        <Button
          {...rowActionKind('read')}
          key="read"
          onClick={async () => {
            setDetail(await serviceSettlementApi.get(row.id));
            setDetailOpen(true);
          }}
        />,
      ],
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ServiceSettlement>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.after-sales-service.service-settlements')}
        request={async (params) => {
          const res = await serviceSettlementApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
            status: params.status as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.afterSalesService.serviceSettlement.createTitle')}
        onCreate={() => message.info(t('app.kuaizhizao.afterSalesService.serviceSettlement.createHint'))}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => serviceSettlementApi.delete(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <Drawer
        open={detailOpen}
        width={720}
        title={detail?.settlement_code}
        onClose={() => setDetailOpen(false)}
        extra={
          detail && detail.status === '待审核' && canReview ? (
            <Space>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={async () => {
                  await serviceSettlementApi.audit(detail.id);
                  await refreshDetail(detail.id);
                  message.success(t('app.kuaizhizao.afterSalesService.serviceSettlement.auditSuccess'));
                }}
              >
                {t('components.uniAction.audit')}
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setRejectRemarks('');
                  setRejectOpen(true);
                }}
              >
                {t('components.uniAction.reject')}
              </Button>
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <p>{t('app.kuaizhizao.afterSalesService.serviceSettlement.field.customerName')}: {detail.customer_name}</p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceSettlement.field.warrantyFreeAmount')}: {detail.warranty_free_amount ?? 0}</p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceSettlement.field.chargeableAmount')}: {detail.chargeable_amount ?? 0}</p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceSettlement.field.totalAmount')}: {detail.total_amount ?? 0}</p>
            <p>{t('app.kuaizhizao.afterSalesService.serviceSettlement.field.notes')}: {detail.notes || '-'}</p>
          </>
        ) : null}
      </Drawer>

      <Modal
        open={rejectOpen}
        title={t('app.kuaizhizao.afterSalesService.serviceSettlement.rejectTitle')}
        onCancel={() => setRejectOpen(false)}
        onOk={async () => {
          if (!detail) return;
          await serviceSettlementApi.reject(detail.id, { review_remarks: rejectRemarks });
          setRejectOpen(false);
          await refreshDetail(detail.id);
          message.success(t('app.kuaizhizao.afterSalesService.serviceSettlement.rejectSuccess'));
        }}
      >
        <Input.TextArea
          rows={3}
          value={rejectRemarks}
          onChange={(e) => setRejectRemarks(e.target.value)}
          placeholder={t('app.kuaizhizao.afterSalesService.serviceSettlement.rejectPlaceholder')}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default ServiceSettlementsPage;
