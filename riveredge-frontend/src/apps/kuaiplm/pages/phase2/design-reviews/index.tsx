import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设计评审（Phase2）
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import dayjs from 'dayjs';
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
import { materialApi } from '../../../../master-data/services/material';
import Phase2ProjectSelect from '../../../components/Phase2ProjectSelect';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  plmCodeTitleSearchColumns,
  plmCreatedUpdatedColumns,
  plmListActionColumn,
  PLM_PHASE2_PINNED_STATUS_FIELD,
  resolvePhase2DesignReviewListParams,
} from '../../../utils/plmListCore';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  buildPhase2DesignReviewStatusValueEnum,
  getPhase2DesignReviewStatusOptions,
  renderPhase2DesignReviewStatusTag,
  renderPhase2ReviewTypeMarker,
} from '../../../components/phase2Meta';

const PAGE_CODE = 'kuaiplm-design-review';

const reviewTypeOptions = (t: (key: string) => string) => [
  { value: 'preliminary', label: t('app.kuaiplm.phase2.designReviews.type.preliminary') },
  { value: 'detailed', label: t('app.kuaiplm.phase2.designReviews.type.detailed') },
  { value: 'trial', label: t('app.kuaiplm.phase2.designReviews.type.trial') },
];

const DesignReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const perms = useResourcePermissions('kuaiplm.design-review');
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<ProFormInstance>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<RdDesignReview | null>(null);
  const [detailRecord, setDetailRecord] = useState<RdDesignReview | null>(null);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      if (!isAutoGenerateEnabled(PAGE_CODE)) {
        setPreviewCode(null);
        return;
      }
      try {
        const ruleCode = getPageRuleCode(PAGE_CODE);
        if (!ruleCode) {
          setPreviewCode(null);
          messageApi.warning(t('app.kuaiplm.phase2.designReviews.codeRuleMissing'));
          return;
        }
        const res = await testGenerateCode({ rule_code: ruleCode });
        setPreviewCode(res.code);
        createFormRef.current?.setFieldsValue({ review_code: res.code });
      } catch {
        setPreviewCode(null);
        messageApi.warning(t('app.kuaiplm.phase2.designReviews.codePreviewFailed'));
      }
    })();
  }, [createOpen, messageApi, t]);

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

  const designReviewStatusValueEnum = useMemo(() => buildPhase2DesignReviewStatusValueEnum(t), [t]);
  const designReviewStatusOptions = useMemo(() => getPhase2DesignReviewStatusOptions(t), [t]);

  const columns: ProColumns<RdDesignReview>[] = useMemo(
    () => [
      ...plmCodeTitleSearchColumns({
        codeLabel: t('app.kuaiplm.phase2.designReviews.columns.code'),
        titleLabel: t('app.kuaiplm.phase2.designReviews.columns.title'),
        codeField: 'review_code',
        titleField: 'title',
      }),
      {
        // 稀疏：编号 → 标题 → 项目 → 类型 → 评审人 → 计划时间；审计叠列保留；状态 StatusTag
        title: t('app.kuaiplm.phase2.designReviews.columns.code'),
        dataIndex: 'review_code',
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        // 标题长短不一：唯一 RemainderFlex
        title: t('app.kuaiplm.phase2.designReviews.columns.title'),
        dataIndex: 'title',
        minWidth: 160,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        sorter: true,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.phase2.requirements.columns.project'),
        dataIndex: 'project_name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.type'),
        dataIndex: 'review_type',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderPhase2ReviewTypeMarker(t, row.review_type),
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.reviewer'),
        dataIndex: 'reviewer_name',
        width: 112,
        minWidth: 112,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.phase2.designReviews.columns.scheduledAt'),
        dataIndex: 'review_date',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) =>
          row.review_date ? formatDateTimeBySiteSetting(row.review_date) : '-',
      },
      ...plmCreatedUpdatedColumns<RdDesignReview>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        fixed: 'right',
        valueEnum: designReviewStatusValueEnum,
        render: (_, row) => renderPhase2DesignReviewStatusTag(t, row.status),
      },
      plmListActionColumn<RdDesignReview>(t, (_, row) => [
        <Button
          key="detail"
          {...rowActionKind('read')}
          onClick={() => setDetailRecord(row)}
        />,
        <Button
          key="edit"
          {...rowActionKind('update')}
          onClick={() => setEditingRecord(row)}
        />,
        <Button
          key="del"
          {...rowActionKind('delete')}
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
        />,
      ]),
    ],
    [designReviewStatusValueEnum, modalApi, messageApi, t],
  );

  return (
    <ListPageTemplate>
      {filterProjectId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('app.kuaiplm.phase2.common.projectFilterHint', { id: filterProjectId })}
        />
      ) : null}
      <UniTable<RdDesignReview>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaiplm.designReviews')}
        headerTitle={t('app.kuaiplm.menu.phase2.design-reviews')}
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.phase2.design-reviews.list-v2"
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
        showCreateButton={perms.canCreate}
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
                  void handleBatchSetStatus('IN_REVIEW', t('app.kuaiplm.phase2.common.status.inReview'));
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
        formRef={createFormRef}
        onClose={() => {
          setCreateOpen(false);
          setPreviewCode(null);
        }}
        onFinish={async (values) => {
          const { review_date: reviewDate, _material_pick, review_code: formCode, ...rest } =
            values as Record<string, unknown>;
          const manualCode = String(formCode || '').trim();
          await createDesignReview({
            ...rest,
            // 自动编号：不传预览码，由后端 generate_code 正式占号
            ...(isAutoGenerateEnabled(PAGE_CODE)
              ? {}
              : manualCode
                ? { review_code: manualCode }
                : {}),
            project_id: (rest.project_id as number | undefined) ?? filterProjectId,
            review_date: reviewDate ? dayjs(reviewDate as string).format('YYYY-MM-DD') : undefined,
          });
          messageApi.success(t('common.createSuccess'));
          setCreateOpen(false);
          setPreviewCode(null);
          actionRef.current?.reload();
        }}
      >
        <ProFormText
          name="review_code"
          label={t('app.kuaiplm.phase2.designReviews.columns.code')}
          rules={[{ required: !isAutoGenerateEnabled(PAGE_CODE) }]}
          disabled={isAutoGenerateEnabled(PAGE_CODE)}
          extra={
            previewCode
              ? `${t('app.kuaiplm.phase2.designReviews.columns.code')}: ${previewCode}`
              : undefined
          }
        />
        <ProFormText name="title" label={t('app.kuaiplm.phase2.designReviews.form.title')} rules={[{ required: true }]} />
        <Phase2ProjectSelect initialValue={filterProjectId} />
        <ProFormSelect
          name="review_type"
          label={t('app.kuaiplm.phase2.designReviews.form.reviewType')}
          options={reviewTypeOptions(t)}
        />
        <ProFormSelect
          name="_material_pick"
          label={t('app.kuaiplm.phase2.designReviews.form.material')}
          showSearch
          debounceTime={300}
          request={async ({ keyWords }) => {
            const res = await materialApi.list({
              keyword: keyWords?.trim() || undefined,
              limit: 50,
              isActive: true,
            });
            const items = Array.isArray(res) ? res : (res as { items?: unknown[] }).items ?? [];
            return items.map((item: any) => ({
              value: item.id,
              label: `${item.main_code ?? item.code ?? item.id} - ${item.name ?? ''}`.trim(),
              material: item,
            }));
          }}
          fieldProps={{
            onChange: (_value, option) => {
              const material = (option as { material?: { id?: number; main_code?: string; name?: string } })
                ?.material;
              if (!material) return;
              createFormRef.current?.setFieldsValue({
                material_id: material.id,
                material_code: material.main_code,
                material_name: material.name,
              });
            },
          }}
        />
        <ProFormText name="material_id" hidden />
        <ProFormText name="material_code" hidden />
        <ProFormText name="material_name" hidden />
        <ProFormText name="reviewer_name" label={t('app.kuaiplm.phase2.designReviews.form.reviewer')} />
        <ProFormDatePicker
          name="review_date"
          label={t('app.kuaiplm.phase2.designReviews.columns.scheduledAt')}
          width="md"
        />
        <ProFormTextArea name="review_notes" label={t('app.kuaiplm.phase2.designReviews.form.conclusion')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.designReviews.editTitle')}
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        isEdit
        initialValues={
          editingRecord
            ? {
                ...editingRecord,
                review_date: editingRecord.review_date ? dayjs(editingRecord.review_date) : undefined,
              }
            : {}
        }
        onFinish={async (values) => {
          if (!editingRecord?.id) return;
          const { review_date: reviewDate, _material_pick, ...rest } = values as Record<string, unknown>;
          await updateDesignReview(editingRecord.id, {
            ...rest,
            review_date: reviewDate ? dayjs(reviewDate as string).format('YYYY-MM-DD') : undefined,
          });
          messageApi.success(t('common.updateSuccess'));
          setEditingRecord(null);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label={t('app.kuaiplm.phase2.designReviews.form.title')} rules={[{ required: true }]} />
        <Phase2ProjectSelect />
        <ProFormSelect
          name="review_type"
          label={t('app.kuaiplm.phase2.designReviews.form.reviewType')}
          options={reviewTypeOptions(t)}
        />
        <ProFormSelect
          name="status"
          label={t('common.status')}
          options={designReviewStatusOptions}
        />
        <ProFormText name="material_code" label={t('app.kuaiplm.phase2.designReviews.form.materialCode')} />
        <ProFormText name="material_name" label={t('app.kuaiplm.phase2.designReviews.form.materialName')} />
        <ProFormText name="reviewer_name" label={t('app.kuaiplm.phase2.designReviews.form.reviewer')} />
        <ProFormDatePicker
          name="review_date"
          label={t('app.kuaiplm.phase2.designReviews.columns.scheduledAt')}
          width="md"
        />
        <ProFormTextArea name="review_notes" label={t('app.kuaiplm.phase2.designReviews.form.conclusion')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.designReviews.detailTitle')}
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        readOnly
        initialValues={
          detailRecord
            ? {
                ...detailRecord,
                review_date: detailRecord.review_date ? dayjs(detailRecord.review_date) : undefined,
              }
            : {}
        }
        onFinish={async () => {}}
      >
        <ProFormText name="review_code" label={t('app.kuaiplm.phase2.designReviews.columns.code')} />
        <ProFormText name="title" label={t('app.kuaiplm.phase2.designReviews.form.title')} />
        <ProFormSelect
          name="review_type"
          label={t('app.kuaiplm.phase2.designReviews.form.reviewType')}
          options={reviewTypeOptions(t)}
        />
        <ProFormSelect
          name="status"
          label={t('common.status')}
          options={designReviewStatusOptions}
        />
        <ProFormText name="reviewer_name" label={t('app.kuaiplm.phase2.designReviews.form.reviewer')} />
        <ProFormDatePicker
          name="review_date"
          label={t('app.kuaiplm.phase2.designReviews.columns.scheduledAt')}
          width="md"
        />
        <ProFormTextArea name="review_notes" label={t('app.kuaiplm.phase2.designReviews.form.conclusion')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default DesignReviewsPage;
