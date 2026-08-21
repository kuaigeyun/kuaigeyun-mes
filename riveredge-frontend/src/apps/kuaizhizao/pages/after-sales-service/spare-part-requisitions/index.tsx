import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Input, Modal } from 'antd';
import { CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { UniTable } from '../../../../../components/uni-table';
import { SourceDocumentCode } from '../../../../../components/linked-document-code/SourceDocumentCode';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { hasReviewPermission } from '../../../../../utils/permissionContract';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  AFTER_SALES_REVIEW_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../shared/afterSalesListPresentation';
import {
  afterSalesSparePartRequisitionApi,
  type AfterSalesSparePartRequisition,
} from '../../../services/after-sales-service';
import { SparePartRequisitionDetailDrawer } from './components/SparePartRequisitionDetailDrawer';
import SparePartRequisitionFormModal from './SparePartRequisitionFormModal';

const RESOURCE = 'kuaizhizao:after-sales-spare-part-requisition';

const AfterSalesSparePartRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const currentUser = useCurrentUser();
  const canReview = hasReviewPermission(currentUser ?? undefined, RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AfterSalesSparePartRequisition | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AfterSalesSparePartRequisition | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await afterSalesSparePartRequisitionApi.get(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.afterSalesService.detail.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: AfterSalesSparePartRequisition) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const refreshDetail = async (id: number) => {
    setDetail(await afterSalesSparePartRequisitionApi.get(id));
    actionRef.current?.reload();
  };

  const openEdit = async (row: AfterSalesSparePartRequisition) => {
    setEditing(await afterSalesSparePartRequisitionApi.get(row.id));
    setModalOpen(true);
  };

  const confirmDelete = (row: AfterSalesSparePartRequisition) => {
    modal.confirm({
      title: t('common.confirmDelete'),
      onOk: async () => {
        await afterSalesSparePartRequisitionApi.delete(row.id);
        messageApi.success(t('common.deleteSuccess'));
        if (detail?.id === row.id) {
          setDetailOpen(false);
          setDetail(null);
        }
        actionRef.current?.reload();
      },
    });
  };

  const canEditRow = (status?: string) => status === '草稿' || status === '已驳回';

  const columns: ProColumns<AfterSalesSparePartRequisition>[] = useMemo(
    () =>
      alignProColumns<AfterSalesSparePartRequisition>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.requisitionCode'),
            dataIndex: 'requisition_code',
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            fixed: 'left',
            copyable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.warehouseName'),
            dataIndex: 'warehouse_name',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.sourceCode'),
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
              perms.canUpdate && canEditRow(row.status) ? (
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
                    await afterSalesSparePartRequisitionApi.submit(row.id);
                    messageApi.success(
                      t('app.kuaizhizao.afterSalesService.sparePartRequisition.submitSuccess'),
                    );
                    actionRef.current?.reload();
                  }}
                >
                  {t('components.uniAction.submit')}
                </Button>
              ) : null,
              perms.canDelete && canEditRow(row.status) ? (
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
      <UniTable<AfterSalesSparePartRequisition>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.spare-part-requisitions.v3"
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
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.afterSalesService.sparePartRequisition.createTitle')}
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => afterSalesSparePartRequisitionApi.delete(Number(key))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <SparePartRequisitionFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      <SparePartRequisitionDetailDrawer
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
                visible: Boolean(detail && perms.canUpdate && canEditRow(detail.status)),
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
                      await afterSalesSparePartRequisitionApi.submit(detail.id);
                      await refreshDetail(detail.id);
                      messageApi.success(
                        t('app.kuaizhizao.afterSalesService.sparePartRequisition.submitSuccess'),
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
                      await afterSalesSparePartRequisitionApi.audit(detail.id);
                      await refreshDetail(detail.id);
                      messageApi.success(
                        t('app.kuaizhizao.afterSalesService.sparePartRequisition.auditSuccess'),
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
        title={t('app.kuaizhizao.afterSalesService.sparePartRequisition.rejectTitle')}
        onCancel={() => setRejectOpen(false)}
        destroyOnHidden
        onOk={async () => {
          if (!detail) return;
          await afterSalesSparePartRequisitionApi.reject(detail.id, { review_remarks: rejectRemarks });
          setRejectOpen(false);
          await refreshDetail(detail.id);
          messageApi.success(t('app.kuaizhizao.afterSalesService.sparePartRequisition.rejectSuccess'));
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
