import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Input, Modal } from 'antd';
import { CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { hasReviewPermission } from '../../../../../utils/permissionContract';
import { serviceSettlementApi, type ServiceSettlement } from '../../../services/after-sales-service';
import { ServiceSettlementDetailDrawer } from './components/ServiceSettlementDetailDrawer';
import ServiceSettlementFormModal from './ServiceSettlementFormModal';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  AFTER_SALES_REVIEW_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../shared/afterSalesListPresentation';

const RESOURCE = 'kuaizhizao:service-settlement';

const ServiceSettlementsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const currentUser = useCurrentUser();
  const canReview = hasReviewPermission(currentUser ?? undefined, RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceSettlement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceSettlement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await serviceSettlementApi.get(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.afterSalesService.detail.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: ServiceSettlement) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const refreshDetail = async (id: number) => {
    setDetail(await serviceSettlementApi.get(id));
    actionRef.current?.reload();
  };

  const openEdit = async (row: ServiceSettlement) => {
    setEditing(await serviceSettlementApi.get(row.id));
    setModalOpen(true);
  };

  const confirmDelete = (row: ServiceSettlement) => {
    modal.confirm({
      title: t('common.confirmDelete'),
      onOk: async () => {
        await serviceSettlementApi.delete(row.id);
        messageApi.success(t('common.deleteSuccess'));
        if (detail?.id === row.id) {
          setDetailOpen(false);
          setDetail(null);
        }
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<ServiceSettlement>[] = useMemo(
    () =>
      alignProColumns<ServiceSettlement>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.settlementCode'),
            dataIndex: 'settlement_code',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            fixed: 'left',
            copyable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.customerName'),
            dataIndex: 'customer_name',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
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
            title: t('common.status'),
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
              <Button {...rowActionKind('read')} key="read" onClick={() => openDetail(row)} />,
              perms.canUpdate && row.status === '草稿' ? (
                <Button
                  {...rowActionKind('update')}
                  key="edit"
                  onClick={() => void openEdit(row)}
                />
              ) : null,
              perms.canAction?.('submit') && row.status === '草稿' ? (
                <Button
                  key="submit"
                  type="link"
                  icon={<SendOutlined />}
                  onClick={async () => {
                    await serviceSettlementApi.submit(row.id);
                    messageApi.success(t('app.kuaizhizao.afterSalesService.serviceSettlement.submitSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('components.uniAction.submit')}
                </Button>
              ) : null,
              perms.canDelete && row.status === '草稿' ? (
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
    [messageApi, modal, perms, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ServiceSettlement>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.service-settlements.v3"
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
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => serviceSettlementApi.delete(Number(key))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <ServiceSettlementFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
          if (editing && detail?.id === editing.id) {
            void refreshDetail(editing.id);
          }
        }}
      />

      <ServiceSettlementDetailDrawer
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
                visible: Boolean(detail && perms.canUpdate && detail.status === '草稿'),
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
                key: 'submit',
                visible: Boolean(detail && perms.canAction?.('submit') && detail.status === '草稿'),
                render: (
                  <Button
                    icon={<SendOutlined />}
                    onClick={async () => {
                      if (!detail) return;
                      await serviceSettlementApi.submit(detail.id);
                      await refreshDetail(detail.id);
                      messageApi.success(
                        t('app.kuaizhizao.afterSalesService.serviceSettlement.submitSuccess'),
                      );
                    }}
                  >
                    {t('components.uniAction.submit')}
                  </Button>
                ),
              },
              {
                key: 'audit',
                visible: Boolean(detail && detail.status === '待审核' && canReview),
                render: (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={async () => {
                      if (!detail) return;
                      await serviceSettlementApi.audit(detail.id);
                      await refreshDetail(detail.id);
                      messageApi.success(
                        t('app.kuaizhizao.afterSalesService.serviceSettlement.auditSuccess'),
                      );
                    }}
                  >
                    {t('components.uniAction.audit')}
                  </Button>
                ),
              },
              {
                key: 'reject',
                visible: Boolean(detail && detail.status === '待审核' && canReview),
                render: (
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
                ),
              },
            ]}
          />
        }
      />

      <Modal
        open={rejectOpen}
        title={t('app.kuaizhizao.afterSalesService.serviceSettlement.rejectTitle')}
        onCancel={() => setRejectOpen(false)}
        destroyOnHidden
        onOk={async () => {
          if (!detail) return;
          if (!rejectRemarks.trim()) {
            messageApi.warning(t('app.kuaizhizao.afterSalesService.serviceSettlement.rejectPlaceholder'));
            return;
          }
          await serviceSettlementApi.reject(detail.id, { review_remarks: rejectRemarks });
          setRejectOpen(false);
          await refreshDetail(detail.id);
          messageApi.success(t('app.kuaizhizao.afterSalesService.serviceSettlement.rejectSuccess'));
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
