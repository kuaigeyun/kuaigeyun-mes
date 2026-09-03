import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 研发需求（Phase2）
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormDigit,
  ProFormDependency,
} from '@ant-design/pro-components';
import { App, Button, Alert } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listRequirements,
  createRequirement,
  deleteRequirement,
  updateRequirement,
  type RdRequirement,
} from '../../../services/phase2';
import { buildPurchaseInquiryUrl } from '../../../services/master-data-links';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  plmCodeTitleSearchColumns,
  plmCreatedUpdatedColumns,
  plmListActionColumn,
  PLM_PHASE2_PINNED_STATUS_FIELD,
  resolvePhase2RequirementListParams,
} from '../../../utils/plmListCore';
import Phase2ProjectSelect from '../../../components/Phase2ProjectSelect';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  buildPhase2PriorityValueEnum,
  buildPhase2RequirementStatusValueEnum,
  getPhase2RequirementStatusOptions,
  renderPhase2PriorityMarker,
  renderPhase2RequirementStatusTag,
} from '../../../components/phase2Meta';

const validateRequirementPayload = (
  values: Record<string, unknown>,
  messageApi: { warning: (msg: string) => void },
  t: (key: string) => string,
) => {
  if (values.source_type === 'purchase_inquiry') {
    const sourceId = Number(values.source_id);
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      messageApi.warning(t('app.kuaiplm.phase2.requirements.form.purchaseInquiryIdRequired'));
      return false;
    }
  }
  return true;
};

const PAGE_CODE = 'kuaiplm-rd-requirement';

const RequirementsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions('kuaiplm.requirement');
  const [searchParams] = useSearchParams();
  const projectIdFilter = searchParams.get('project_id');
  const filterProjectId = projectIdFilter ? Number(projectIdFilter) : undefined;
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<ProFormInstance>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<RdRequirement | null>(null);
  const [detailRecord, setDetailRecord] = useState<RdRequirement | null>(null);

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
          messageApi.warning(t('app.kuaiplm.phase2.requirements.codeRuleMissing'));
          return;
        }
        const res = await testGenerateCode({ rule_code: ruleCode });
        setPreviewCode(res.code);
        createFormRef.current?.setFieldsValue({ requirement_code: res.code });
      } catch {
        setPreviewCode(null);
        messageApi.warning(t('app.kuaiplm.phase2.requirements.codePreviewFailed'));
      }
    })();
  }, [createOpen, messageApi, t]);

  const toRequirementIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toRequirementIds(keys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.requirements.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteRequirement(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.phase2.requirements.batchDeleteSuccess', { count: successCount }),
      );
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.requirements.batchDeleteFailed'));
  };

  const handleBatchSetStatus = async (status: string, label: string) => {
    const ids = toRequirementIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.phase2.requirements.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateRequirement(id, { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.phase2.requirements.batchStatusSuccess', { count: successCount, label }),
      );
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.phase2.requirements.batchStatusFailed'));
  };

  const requirementStatusValueEnum = useMemo(() => buildPhase2RequirementStatusValueEnum(t), [t]);
  const priorityValueEnum = useMemo(() => buildPhase2PriorityValueEnum(t), [t]);
  const requirementStatusOptions = useMemo(() => getPhase2RequirementStatusOptions(t), [t]);
  const sourceTypeLabelMap: Record<string, string> = {
    customer: t('app.kuaiplm.phase2.common.source.customer'),
    purchase_inquiry: t('app.kuaiplm.phase2.common.source.purchaseInquiry'),
    internal: t('app.kuaiplm.phase2.common.source.internal'),
  };

  const columns: ProColumns<RdRequirement>[] = useMemo(
    () => [
      ...plmCodeTitleSearchColumns({
        codeLabel: t('app.kuaiplm.phase2.requirements.columns.code'),
        titleLabel: t('app.kuaiplm.phase2.requirements.columns.title'),
        codeField: 'requirement_code',
        titleField: 'title',
      }),
      {
        // 稀疏：编号 → 标题 → 项目 → 优先级 → 来源；审计叠列保留；状态 StatusTag
        title: t('app.kuaiplm.phase2.requirements.columns.code'),
        dataIndex: 'requirement_code',
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
        title: t('app.kuaiplm.phase2.requirements.columns.title'),
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
        title: t('app.kuaiplm.phase2.requirements.columns.priority'),
        dataIndex: 'priority',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        valueEnum: priorityValueEnum,
        render: (_, row) => renderPhase2PriorityMarker(t, row.priority),
      },
      {
        title: t('app.kuaiplm.phase2.requirements.columns.source'),
        key: 'requirement_source_type',
        dataIndex: 'source_type',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        ellipsis: true,
        render: (_, row) => {
          if (row.source_type === 'purchase_inquiry' && row.source_id) {
            return (
              <Button
                type="link"
                size="small"
                onClick={() => window.open(buildPurchaseInquiryUrl(row.source_id!), '_blank')}
              >
                {t('app.kuaiplm.phase2.common.source.purchaseInquiry')} #{row.source_id}
              </Button>
            );
          }
          return sourceTypeLabelMap[row.source_type || ''] || row.source_type || '-';
        },
      },
      ...plmCreatedUpdatedColumns<RdRequirement>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        fixed: 'right',
        valueEnum: requirementStatusValueEnum,
        render: (_, row) => renderPhase2RequirementStatusTag(t, row.status),
      },
      plmListActionColumn<RdRequirement>(t, (_, row) => [
        <Button
          key="detail"
          {...rowActionKind('read')}
          onClick={() => {
            setDetailRecord(row);
          }}
        />,
        <Button
          key="edit"
          {...rowActionKind('update')}
          onClick={() => {
            setEditingRecord(row);
          }}
        />,
        <ActionConfirmPopconfirm
          key="del"
          title={t('app.kuaiplm.phase2.requirements.deleteOneTitle')}
          onConfirm={async () => {
            await deleteRequirement(row.id!);
            messageApi.success(t('common.deleteSuccess'));
            actionRef.current?.reload();
          }}
        >
          <Button {...rowActionKind('delete')} onClick={(e) => e.stopPropagation()} />
        </ActionConfirmPopconfirm>,
      ]),
    ],
    [messageApi, priorityValueEnum, requirementStatusValueEnum, sourceTypeLabelMap, t],
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
      <UniTable<RdRequirement>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaiplm.requirements')}
        headerTitle={t('app.kuaiplm.menu.phase2.requirements')}
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.phase2.requirements.list-v2"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={PLM_PHASE2_PINNED_STATUS_FIELD}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current, pageSize } = params;
          const listParams = resolvePhase2RequirementListParams(searchFormValues, sort, {
            projectId: filterProjectId,
          });
          lastListParamsRef.current = listParams;
          try {
            const res = await listRequirements({
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
        createButtonText={t('app.kuaiplm.phase2.requirements.createButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) =>
          t('app.kuaiplm.phase2.requirements.deleteConfirmTitle', { count })
        }
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="requirements-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaiplm.phase2.common.batchActions')}
            menuItems={[
              {
                key: 'batch-set-in-progress',
                label: t('app.kuaiplm.phase2.requirements.batchSetInProgress'),
                onClick: () => {
                  void handleBatchSetStatus('IN_PROGRESS', t('app.kuaiplm.phase2.common.status.inProgress'));
                },
              },
              {
                key: 'batch-set-done',
                label: t('app.kuaiplm.phase2.requirements.batchSetDone'),
                onClick: () => {
                  void handleBatchSetStatus('DONE', t('app.kuaiplm.phase2.common.status.done'));
                },
              },
            ]}
          />,
        ]}
      />

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.requirements.createTitle')}
        open={createOpen}
        formRef={createFormRef}
        onClose={() => {
          setCreateOpen(false);
          setPreviewCode(null);
        }}
        initialValues={{ project_id: filterProjectId, priority: 'normal' }}
        onFinish={async (values) => {
          if (!validateRequirementPayload(values, messageApi, t)) return;
          const { requirement_code: formCode, ...rest } = values as Record<string, unknown>;
          const manualCode = String(formCode || '').trim();
          await createRequirement({
            ...rest,
            ...(isAutoGenerateEnabled(PAGE_CODE)
              ? {}
              : manualCode
                ? { requirement_code: manualCode }
                : {}),
            project_id: (rest.project_id as number | undefined) ?? filterProjectId,
          });
          messageApi.success(t('common.createSuccess'));
          setCreateOpen(false);
          setPreviewCode(null);
    actionRef.current?.reload();
        }}
      >
        <ProFormText
          name="requirement_code"
          label={t('app.kuaiplm.phase2.requirements.columns.code')}
          rules={[{ required: !isAutoGenerateEnabled(PAGE_CODE) }]}
          disabled={isAutoGenerateEnabled(PAGE_CODE)}
          extra={
            previewCode
              ? `${t('app.kuaiplm.phase2.requirements.columns.code')}: ${previewCode}`
              : undefined
          }
        />
        <ProFormText
          name="title"
          label={t('app.kuaiplm.phase2.requirements.form.title')}
          rules={[{ required: true }]}
        />
        <Phase2ProjectSelect initialValue={filterProjectId} />
        <ProFormSelect
          name="priority"
          label={t('app.kuaiplm.phase2.requirements.form.priority')}
          options={[
            { value: 'high', label: t('app.kuaiplm.phase2.common.priority.high') },
            { value: 'normal', label: t('app.kuaiplm.phase2.common.priority.normal') },
            { value: 'low', label: t('app.kuaiplm.phase2.common.priority.low') },
          ]}
        />
        <ProFormSelect
          name="source_type"
          label={t('app.kuaiplm.phase2.requirements.form.sourceType')}
          options={[
            { value: 'customer', label: t('app.kuaiplm.phase2.common.source.customer') },
            { value: 'purchase_inquiry', label: t('app.kuaiplm.phase2.common.source.purchaseInquiry') },
            { value: 'internal', label: t('app.kuaiplm.phase2.common.source.internal') },
          ]}
        />
        <ProFormDependency name={['source_type']}>
          {({ source_type }) =>
            source_type === 'purchase_inquiry' ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                title={t('app.kuaiplm.phase2.requirements.form.purchaseInquiryHint')}
              />
            ) : null
          }
        </ProFormDependency>
        <ProFormDigit
          name="source_id"
          label={t('app.kuaiplm.phase2.requirements.form.sourceId')}
          min={1}
          fieldProps={{ precision: 0 }}
        />
        <ProFormTextArea name="description" label={t('common.remark')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.requirements.editTitle')}
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        isEdit
        initialValues={editingRecord || {}}
        onFinish={async (values) => {
          if (!editingRecord?.id) return;
          if (!validateRequirementPayload(values, messageApi, t)) return;
          await updateRequirement(editingRecord.id, values);
          messageApi.success(t('common.updateSuccess'));
          setEditingRecord(null);
    actionRef.current?.reload();
        }}
      >
        <ProFormText
          name="title"
          label={t('app.kuaiplm.phase2.requirements.form.title')}
          rules={[{ required: true }]}
        />
        <Phase2ProjectSelect />
        <ProFormSelect
          name="priority"
          label={t('app.kuaiplm.phase2.requirements.form.priority')}
          options={[
            { value: 'high', label: t('app.kuaiplm.phase2.common.priority.high') },
            { value: 'normal', label: t('app.kuaiplm.phase2.common.priority.normal') },
            { value: 'low', label: t('app.kuaiplm.phase2.common.priority.low') },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('common.status')}
          options={requirementStatusOptions}
        />
        <ProFormSelect
          name="source_type"
          label={t('app.kuaiplm.phase2.requirements.form.sourceType')}
          options={[
            { value: 'customer', label: t('app.kuaiplm.phase2.common.source.customer') },
            { value: 'purchase_inquiry', label: t('app.kuaiplm.phase2.common.source.purchaseInquiry') },
            { value: 'internal', label: t('app.kuaiplm.phase2.common.source.internal') },
          ]}
        />
        <ProFormDigit
          name="source_id"
          label={t('app.kuaiplm.phase2.requirements.form.sourceId')}
          min={1}
          fieldProps={{ precision: 0 }}
        />
        <ProFormTextArea name="description" label={t('common.remark')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.phase2.requirements.detailTitle')}
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        readOnly
        initialValues={detailRecord || {}}
        onFinish={async () => {}}
      >
        <ProFormText name="requirement_code" label={t('app.kuaiplm.phase2.requirements.columns.code')} />
        <ProFormText name="title" label={t('app.kuaiplm.phase2.requirements.form.title')} />
        <ProFormSelect
          name="priority"
          label={t('app.kuaiplm.phase2.requirements.form.priority')}
          options={[
            { value: 'high', label: t('app.kuaiplm.phase2.common.priority.high') },
            { value: 'normal', label: t('app.kuaiplm.phase2.common.priority.normal') },
            { value: 'low', label: t('app.kuaiplm.phase2.common.priority.low') },
          ]}
        />
        <ProFormSelect
          name="status"
          label={t('common.status')}
          options={requirementStatusOptions}
        />
        <ProFormSelect
          name="source_type"
          label={t('app.kuaiplm.phase2.requirements.form.sourceType')}
          options={[
            { value: 'customer', label: t('app.kuaiplm.phase2.common.source.customer') },
            { value: 'purchase_inquiry', label: t('app.kuaiplm.phase2.common.source.purchaseInquiry') },
            { value: 'internal', label: t('app.kuaiplm.phase2.common.source.internal') },
          ]}
        />
        <ProFormDigit name="source_id" label={t('app.kuaiplm.phase2.requirements.form.sourceId')} />
        <ProFormTextArea name="description" label={t('common.remark')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RequirementsPage;
