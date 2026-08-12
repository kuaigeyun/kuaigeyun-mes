import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Input, Modal, Space, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { hasReviewPermission } from '../../../../../utils/permissionContract';
import { serviceSettlementApi, type ServiceSettlement } from '../../../services/after-sales-service';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  AFTER_SALES_REVIEW_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../shared/afterSalesListPresentation';

const RESOURCE = 'kuaizhizao:service-settlement';

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

  const columns: ProColumns<ServiceSettlement>[] = useMemo(
    () =>
      alignProColumns<ServiceSettlement>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.settlementCode'),
            dataIndex: 'settlement_code',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.settlement_code ?? '').trim() || '-'}
                secondary={String(row.customer_name ?? '').trim() || '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.customerName'),
            dataIndex: 'customer_name',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.totalAmount'),
            dataIndex: 'total_amount',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            render: (_, row) => (row.total_amount != null ? row.total_amount : '-'),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) =>
              renderAfterSalesStatusTag(row.status, AFTER_SALES_REVIEW_STATUS_COLOR),
          },
          {
            title: t('common.action'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            hideInSearch: true,
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
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ServiceSettlement>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.service-settlements.v1"
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
