import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设计评审（Phase2）
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listDesignReviews,
  createDesignReview,
  deleteDesignReview,
  updateDesignReview,
  type RdDesignReview,
} from '../../../services/phase2';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  plmCodeTitleSearchColumns,
  plmCreatedUpdatedColumns,
  PLM_PHASE2_PINNED_STATUS_FIELD,
  resolvePhase2DesignReviewListParams,
} from '../../../utils/plmListCore';

const DesignReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RdDesignReview | null>(null);
  const [detailRecord, setDetailRecord] = useState<RdDesignReview | null>(null);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  const toReviewIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toReviewIds(keys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.designReviews.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteDesignReview(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.phase2.designReviews.batchDeleteSuccess', { count: successCount }),
      );
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.designReviews.batchDeleteFailed'));
  };

  const handleBatchSetStatus = async (status: string, label: string) => {
    const ids = toReviewIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.designReviews.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateDesignReview(id, { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.phase2.designReviews.batchStatusSuccess', { count: successCount, label }),
      );
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.designReviews.batchStatusFailed'));
  };

  const reviewStatusLabelMap: Record<string, string> = {
    DRAFT: t('app.kuaiplm.phase2.common.status.draft'),
    IN_PROGRESS: t('app.kuaiplm.phase2.common.status.inProgress'),
    COMPLETED: t('app.kuaiplm.phase2.common.status.completed'),
    ARCHIVED: t('app.kuaiplm.phase2.common.status.archived'),
  };

  const columns: ProColumns<RdDesignReview>[] = useMemo(
    () => [
      ...plmCodeTitleSearchColumns({
        codeLabel: t('app.kuaiplm.phase2.designReviews.columns.code'),
        titleLabel: t('app.kuaiplm.phase2.designReviews.columns.title'),
        codeField: 'review_code',
        titleField: 'title',
      }),
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.code'),
        dataIndex: 'review_code',
        width: 140,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.title'),
        dataIndex: 'title',
        sorter: true,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.type'),
        dataIndex: 'review_type',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.status'),
        dataIndex: 'status',
        width: 90,
        valueEnum: Object.fromEntries(
          Object.entries(reviewStatusLabelMap).map(([value, label]) => [value, { text: label }]),
        ),
        render: (_, row) => reviewStatusLabelMap[row.status || ''] || row.status || '-',
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.reviewer'),
        dataIndex: 'reviewer_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.scheduledAt'),
        dataIndex: 'scheduled_at',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_, row) =>
          row.scheduled_at || (row as { review_date?: string }).review_date
            ? formatDateTime(row.scheduled_at || (row as { review_date?: string }).review_date!, 'YYYY-MM-DD HH:mm')
            : '-',
      },
      ...plmCreatedUpdatedColumns<RdDesignReview>(t),
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 180,
      render: (_, row) => [
            <Button
              {...rowActionKind('read')}
              key="detail"
              type="link"
              size="small"
              onClick={() => setDetailRecord(row)}
            >
              {t('common.detail')}
            </Button>,
            <Button
              {...rowActionKind('edit')}
              key="edit"
              type="link"
              size="small"
              onClick={() => setEditingRecord(row)}
            >
              {t('common.edit')}
            </Button>,
            <Button {...rowActionKind('delete')}
              key="del"
              type="link"
              size="small"
              danger
              onClick={() => {
                modalApi.confirm({
                  title: t('app.kuaiplm.phase2.designReviews.deleteOneTitle'),
                  onOk: async () => {
                    await deleteDesignReview(row.id!);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>,
          ],
    },
    ],
    [modalApi, messageApi, reviewStatusLabelMap, t],
  );

  return (
    <ListPageTemplate>
      {filterProjectId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('app.kuaiplm.phase2.common.projectFilterHint', { id: filterProjectId })}
        />
      ) : null}
      <UniTable<RdDesignReview>
        headerTitle={t('app.kuaiplm.menu.phase2.design-reviews')}
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.phase2.design-reviews"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={PLM_PHASE2_PINNED_STATUS_FIELD}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current, pageSize } = params;
          const listParams = resolvePhase2DesignReviewListParams(searchFormValues, sort, {
            projectId: filterProjectId,
          });
          lastListParamsRef.current = listParams;
          try {
            const res = await listDesignReviews({
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              ...listParams,
            });
            return { data: res.items, total: res.total, success: true };
          } catch (e: any) {
            messageApi.error(e?.message || t('common.loadFailed'));
            return { data: [], total: 0, success: false };
          }
        }}
        showCreateButton
        createButtonText={t('app.kuaiplm.phase2.designReviews.createButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) =>
          t('app.kuaiplm.phase2.designReviews.deleteConfirmTitle', { count })
        }
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="design-review-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaiplm.phase2.common.batchActions')}
            menuItems={[
              {
                key: 'batch-set-in-progress',
                label: t('app.kuaiplm.phase2.designReviews.batchSetInProgress'),
                onClick: () => {
                  void handleBatchSetStatus('IN_PROGRESS', t('app.kuaiplm.phase2.common.status.inProgress'));
                },
              },
              {
                key: 'batch-set-completed',
                label: t('app.kuaiplm.phase2.designReviews.batchSetCompleted'),
                onClick: () => {
                  void handleBatchSetStatus('COMPLETED', t('app.kuaiplm.phase2.common.status.completed'));
                },
              },
            ]}
          />,
        ]}
      />

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.designReviews.createTitle')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onFinish={async (values) => {
          await createDesignReview(values);
          messageApi.success(t('common.createSuccess'));
          setCreateOpen(false);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label={t('app.kuaiplm.phase2.designReviews.form.title')} rules={[{ required: true }]} />
        <ProFormSelect
          name="review_type"
          label={t('app.kuaiplm.phase2.designReviews.form.reviewType')}
          options={[
            { value: '初步设计', label: t('app.kuaiplm.phase2.designReviews.type.preliminary') },
            { value: '详细设计', label: t('app.kuaiplm.phase2.designReviews.type.detailed') },
            { value: '试制评审', label: t('app.kuaiplm.phase2.designReviews.type.trial') },
          ]}
        />
        <ProFormText name="reviewer_name" label={t('app.kuaiplm.phase2.designReviews.form.reviewer')} />
        <ProFormTextArea name="conclusion" label={t('app.kuaiplm.phase2.designReviews.form.conclusion')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.designReviews.editTitle')}
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        isEdit
        initialValues={editingRecord || {}}
        onFinish={async (values) => {
          if (!editingRecord?.id) return;
          await updateDesignReview(editingRecord.id, values);
          messageApi.success(t('common.updateSuccess'));
          setEditingRecord(null);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label={t('app.kuaiplm.phase2.designReviews.form.title')} rules={[{ required: true }]} />
        <ProFormSelect
          name="review_type"
          label={t('app.kuaiplm.phase2.designReviews.form.reviewType')}
          options={[
            { value: '初步设计', label: t('app.kuaiplm.phase2.designReviews.type.preliminary') },
            { value: '详细设计', label: t('app.kuaiplm.phase2.designReviews.type.detailed') },
            { value: '试制评审', label: t('app.kuaiplm.phase2.designReviews.type.trial') },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.phase2.designReviews.form.status')}
          options={[
            { value: 'DRAFT', label: t('app.kuaiplm.phase2.common.status.draft') },
            { value: 'IN_PROGRESS', label: t('app.kuaiplm.phase2.common.status.inProgress') },
            { value: 'COMPLETED', label: t('app.kuaiplm.phase2.common.status.completed') },
            { value: 'ARCHIVED', label: t('app.kuaiplm.phase2.common.status.archived') },
          ]}
        />
        <ProFormText name="reviewer_name" label={t('app.kuaiplm.phase2.designReviews.form.reviewer')} />
        <ProFormTextArea name="conclusion" label={t('app.kuaiplm.phase2.designReviews.form.conclusion')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.designReviews.detailTitle')}
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        readOnly
        initialValues={detailRecord || {}}
        onFinish={async () => {}}
      >
        <ProFormText name="review_code" label={t('app.kuaiplm.phase2.designReviews.columns.code')} />
        <ProFormText name="title" label={t('app.kuaiplm.phase2.designReviews.form.title')} />
        <ProFormSelect
          name="review_type"
          label={t('app.kuaiplm.phase2.designReviews.form.reviewType')}
          options={[
            { value: '初步设计', label: t('app.kuaiplm.phase2.designReviews.type.preliminary') },
            { value: '详细设计', label: t('app.kuaiplm.phase2.designReviews.type.detailed') },
            { value: '试制评审', label: t('app.kuaiplm.phase2.designReviews.type.trial') },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.phase2.designReviews.form.status')}
          options={[
            { value: 'DRAFT', label: t('app.kuaiplm.phase2.common.status.draft') },
            { value: 'IN_PROGRESS', label: t('app.kuaiplm.phase2.common.status.inProgress') },
            { value: 'COMPLETED', label: t('app.kuaiplm.phase2.common.status.completed') },
            { value: 'ARCHIVED', label: t('app.kuaiplm.phase2.common.status.archived') },
          ]}
        />
        <ProFormText name="reviewer_name" label={t('app.kuaiplm.phase2.designReviews.form.reviewer')} />
        <ProFormTextArea name="conclusion" label={t('app.kuaiplm.phase2.designReviews.form.conclusion')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default DesignReviewsPage;
