import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Image, Table, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind, rowActionLabelKeep } from '../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { ThemedSegmented } from '../../../../components/themed-segmented';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { formatDateTimeBySiteSetting } from '../../../../utils/format';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { MasterDataDetailDrawer } from '../../../master-data/pages/shared/masterDataDetailDrawer';
import { MarkerTag } from '../../../../constants/statusBadges';
import { VISION_LIST_COL, renderJudgmentMarker } from '../../utils/visionListPresentation';
import {
  completeReview,
  getReview,
  listReviews,
  type ReviewTask,
} from '../../services/kuaivision';

const ReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaivision:review');
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const tableRowsRef = useRef<ReviewTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'done'>('pending');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<ReviewTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState<ReviewTask | null>(null);

  const openDetail = async (row: ReviewTask) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getReview(row.uuid));
    } finally {
      setDetailLoading(false);
    }
  };

  const openReview = (row: ReviewTask) => {
    setReviewing(row);
    setReviewOpen(true);
  };

  const handleComplete = async (values: { reviewed_judgment: string; reason?: string }) => {
    if (!reviewing) return;
    await completeReview(reviewing.uuid, values);
    message.success(t('app.kuaivision.message.reviewDone'));
    setReviewOpen(false);
    setReviewing(null);
    if (detail?.uuid === reviewing.uuid) {
      setDetail(await getReview(reviewing.uuid));
    }
    actionRef.current?.reload();
  };

  const columns: ProColumns<ReviewTask>[] = alignProColumns(
    [
      {
        title: t('app.kuaivision.field.eventId'),
        dataIndex: 'event_id',
        ...VISION_LIST_COL.eventId,
        copyable: true,
      },
      {
        title: t('app.kuaivision.field.occurredAt'),
        dataIndex: 'occurred_at',
        ...VISION_LIST_COL.datetime,
        search: false,
        render: (_, row) => formatDateTimeBySiteSetting(row.occurred_at),
      },
      {
        title: t('app.kuaivision.field.originalJudgment'),
        dataIndex: 'original_judgment',
        ...VISION_LIST_COL.marker,
        search: false,
        render: (_, row) => renderJudgmentMarker(row.original_judgment, t),
      },
      {
        title: t('app.kuaivision.field.reviewedJudgment'),
        dataIndex: 'reviewed_judgment',
        ...VISION_LIST_COL.marker,
        search: false,
        render: (_, row) =>
          row.reviewed_judgment ? renderJudgmentMarker(row.reviewed_judgment, t) : '-',
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        ...VISION_LIST_COL.marker,
        search: false,
        render: (_, row) => (
          <MarkerTag color={row.status === 'pending' ? 'warning' : 'success'}>
            {t(`app.kuaivision.reviewStatus.${row.status}`, { defaultValue: row.status })}
          </MarkerTag>
        ),
      },
      {
        title: t('common.action'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => {
          const nodes: React.ReactNode[] = [];
          if (perms.canRead) {
            nodes.push(
              <Button key="detail" {...rowActionKind('read')} onClick={() => void openDetail(row)} />,
            );
          }
          if (perms.canUpdate && row.status === 'pending') {
            nodes.push(
              <Button
                key="review"
                {...rowActionKind('skip')}
                {...rowActionLabelKeep()}
                onClick={() => openReview(row)}
              >
                {t('app.kuaivision.action.review')}
              </Button>,
            );
          }
          return nodes;
        },
      },
    ],
    GLOBAL_DOC_LIST_FIELD_RANK,
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<ReviewTask>[]>(
    () => [
      { title: t('app.kuaivision.field.eventId'), dataIndex: 'event_id', copyable: true },
      {
        title: t('app.kuaivision.field.occurredAt'),
        dataIndex: 'occurred_at',
        render: (_, row) => formatDateTimeBySiteSetting(row.occurred_at),
      },
      {
        title: t('app.kuaivision.field.originalJudgment'),
        dataIndex: 'original_judgment',
        render: (_, row) => renderJudgmentMarker(row.original_judgment, t),
      },
      {
        title: t('app.kuaivision.field.reviewedJudgment'),
        dataIndex: 'reviewed_judgment',
        render: (_, row) =>
          row.reviewed_judgment ? renderJudgmentMarker(row.reviewed_judgment, t) : '-',
      },
      { title: t('app.kuaivision.field.confidence'), dataIndex: 'confidence' },
      { title: t('app.kuaivision.field.recipe'), dataIndex: 'recipe_code' },
      { title: t('app.kuaivision.field.station'), dataIndex: 'station_code' },
      { title: t('app.kuaivision.field.reviewReason'), dataIndex: 'reason' },
      { title: t('app.kuaivision.field.reviewedBy'), dataIndex: 'reviewed_by_name' },
      {
        title: t('app.kuaivision.field.reviewedAt'),
        dataIndex: 'reviewed_at',
        render: (_, row) => formatDateTimeBySiteSetting(row.reviewed_at),
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ReviewTask>
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        columnPersistenceId="apps.kuaivision.pages.reviews.list-v1"
        permissionResource="kuaivision:review"
        beforeSearchButtons={
          <ThemedSegmented
            size="medium"
            value={statusFilter}
            options={[
              { label: t('app.kuaivision.reviewStatus.pending'), value: 'pending' },
              { label: t('app.kuaivision.reviewStatus.done'), value: 'done' },
            ]}
            onChange={(v) => {
              setStatusFilter(v as 'pending' | 'done');
              actionRef.current?.reload();
            }}
          />
        }
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        params={{ status: statusFilter }}
        request={async (params) => {
          const res = await listReviews({
            page: params.current,
            page_size: params.pageSize,
            status: statusFilter,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <MasterDataDetailDrawer
        title={t('app.kuaivision.menu.reviews')}
        open={drawerOpen}
        loading={detailLoading}
        onClose={() => {
          setDrawerOpen(false);
          setDetail(null);
        }}
        detail={detail}
        detailColumns={detailColumns}
        extra={
          detail?.status === 'pending' && perms.canUpdate ? (
            <Button type="primary" onClick={() => openReview(detail)}>
              {t('app.kuaivision.action.review')}
            </Button>
          ) : null
        }
        linesTitle={t('app.kuaivision.section.measurements')}
        lines={
          detail?.measurements?.length ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => r.name}
              columns={[
                { title: t('app.kuaivision.field.measureName'), dataIndex: 'name' },
                { title: t('app.kuaivision.field.measureValue'), dataIndex: 'value' },
                { title: t('app.kuaivision.field.measureUnit'), dataIndex: 'unit' },
              ]}
              dataSource={detail.measurements}
            />
          ) : null
        }
        afterBasicTitle={detail?.images?.length ? t('app.kuaivision.section.images') : undefined}
        afterBasic={
          detail?.images?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.images.map((img) => (
                <Image key={img.object_key} width={120} src={img.object_key} alt={img.label || ''} />
              ))}
            </div>
          ) : null
        }
      />

      <FormModalTemplate
        key={reviewing?.uuid || 'review'}
        open={reviewOpen}
        title={t('app.kuaivision.modal.completeReview')}
        onClose={() => {
          setReviewOpen(false);
          setReviewing(null);
        }}
        onFinish={handleComplete}
        formRef={formRef as React.RefObject<ProFormInstance>}
        grid
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={{
          reviewed_judgment: reviewing?.original_judgment || 'OK',
        }}
      >
        <ProFormSelect
          name="reviewed_judgment"
          label={t('app.kuaivision.field.reviewedJudgment')}
          colProps={{ span: 12 }}
          options={[
            { value: 'OK', label: t('app.kuaivision.judgment.ok') },
            { value: 'NG', label: t('app.kuaivision.judgment.ng') },
            { value: 'UNKNOWN', label: t('app.kuaivision.judgment.unknown') },
          ]}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <ProFormTextArea
          name="reason"
          label={t('app.kuaivision.field.reviewReason')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ReviewsPage;
