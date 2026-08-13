import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Input, Modal, message } from 'antd';
import { CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';
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

const RESOURCE = 'kuaizhizao:after-sales-spare-part-requisition';

const AfterSalesSparePartRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const currentUser = useCurrentUser();
  const canReview = hasReviewPermission(currentUser ?? undefined, RESOURCE);
  const actionRef = useRef<ActionType>();
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

  const columns: ProColumns<AfterSalesSparePartRequisition>[] = useMemo(
    () =>
      alignProColumns<AfterSalesSparePartRequisition>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.requisitionCode'),
            dataIndex: 'requisition_code',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.requisition_code ?? '').trim() || '-'}
                secondary={String(row.warehouse_name ?? '').trim() || '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.warehouseName'),
            dataIndex: 'warehouse_name',
            hideInTable: true,
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
            title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.status'),
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
                onClick={() => openDetail(row)}
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
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [perms, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<AfterSalesSparePartRequisition>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.spare-part-requisitions.v1"
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
                key: 'audit',
                visible: Boolean(detail && detail.status === '待审核' && canReview),
                render: () => (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={async () => {
                      if (!detail) return;
                      await afterSalesSparePartRequisitionApi.audit(detail.id);
                      await refreshDetail(detail.id);
                      message.success(t('app.kuaizhizao.afterSalesService.sparePartRequisition.auditSuccess'));
                    }}
                  >
                    {t('components.uniAction.audit')}
                  </Button>
                ),
              },
              {
                key: 'reject',
                visible: Boolean(detail && detail.status === '待审核' && canReview),
                render: () => (
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
