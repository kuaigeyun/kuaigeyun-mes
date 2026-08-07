import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Input, Modal, Space, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasReviewPermission } from '../../../../../utils/permissionContract';
import {
  afterSalesSparePartRequisitionApi,
  type AfterSalesSparePartRequisition,
} from '../../../services/after-sales-service';

const RESOURCE = 'kuaizhizao:after-sales-spare-part-requisition';

const statusColor: Record<string, string> = {
  草稿: 'default',
  待审核: 'processing',
  已审核: 'success',
  已驳回: 'error',
};

const AfterSalesSparePartRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canReview = hasReviewPermission(currentUser ?? undefined, RESOURCE);
  const actionRef = useRef<ActionType>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AfterSalesSparePartRequisition | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const refreshDetail = async (id: number) => {
    const data = await afterSalesSparePartRequisitionApi.get(id);
    setDetail(data);
    actionRef.current?.reload();
  };

  const columns: ProColumns<AfterSalesSparePartRequisition>[] = [
    {
      title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.requisitionCode'),
      dataIndex: 'requisition_code',
    },
    {
      title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.sourceCode'),
      dataIndex: 'source_code',
    },
    {
      title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.warehouseName'),
      dataIndex: 'warehouse_name',
    },
    {
      title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.status'),
      dataIndex: 'status',
      render: (_, row) => <Tag color={statusColor[row.status ?? ''] || 'default'}>{row.status}</Tag>,
    },
    {
      title: t('common.action'),
      valueType: 'option',
      width: 220,
      render: (_, row) => [
        <Button
          {...rowActionKind('read')}
          key="read"
          onClick={async () => {
            setDetail(await afterSalesSparePartRequisitionApi.get(row.id));
            setDetailOpen(true);
          }}
        />,
        perms.canAction?.('submit') && row.status === '草稿' ? (
          <Button
            key="submit"
            type="link"
            icon={<SendOutlined />}
            onClick={async () => {
              await afterSalesSparePartRequisitionApi.submit(row.id);
              message.success(t('app.kuaizhizao.afterSalesService.sparePartRequisition.submitSuccess'));
              actionRef.current?.reload();
            }}
          >
            {t('components.uniAction.submit')}
          </Button>
        ) : null,
      ],
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<AfterSalesSparePartRequisition>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.after-sales-service.spare-part-requisitions')}
        request={async (params) => {
          const res = await afterSalesSparePartRequisitionApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
            status: params.status as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => afterSalesSparePartRequisitionApi.delete(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <Drawer
        open={detailOpen}
        width={720}
        title={detail?.requisition_code}
        onClose={() => setDetailOpen(false)}
        extra={
          detail && detail.status === '待审核' && canReview ? (
            <Space>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={async () => {
                  await afterSalesSparePartRequisitionApi.audit(detail.id);
                  await refreshDetail(detail.id);
                  message.success(t('app.kuaizhizao.afterSalesService.sparePartRequisition.auditSuccess'));
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
            <p>{t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.sourceCode')}: {detail.source_code}</p>
            <p>{t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.warehouseName')}: {detail.warehouse_name || '-'}</p>
            <p>{t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.status')}: {detail.status}</p>
            <p>{t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.notes')}: {detail.notes || '-'}</p>
          </>
        ) : null}
      </Drawer>

      <Modal
        open={rejectOpen}
        title={t('app.kuaizhizao.afterSalesService.sparePartRequisition.rejectTitle')}
        onCancel={() => setRejectOpen(false)}
        onOk={async () => {
          if (!detail) return;
          await afterSalesSparePartRequisitionApi.reject(detail.id, { review_remarks: rejectRemarks });
          setRejectOpen(false);
          await refreshDetail(detail.id);
          message.success(t('app.kuaizhizao.afterSalesService.sparePartRequisition.rejectSuccess'));
        }}
      >
        <Input.TextArea
          rows={3}
          value={rejectRemarks}
          onChange={(e) => setRejectRemarks(e.target.value)}
          placeholder={t('app.kuaizhizao.afterSalesService.sparePartRequisition.rejectPlaceholder')}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default AfterSalesSparePartRequisitionsPage;
