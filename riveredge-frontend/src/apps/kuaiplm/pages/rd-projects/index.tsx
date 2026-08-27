/**
 * 研发项目列表
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { App, Button, Typography } from 'antd';
import dayjs from 'dayjs';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import { rowActionKind } from '../../../../components/uni-action';
import { UniBatchMenuButton } from '../../../../components/uni-batch';
import { UniUserSelect } from '../../../../components/uni-user-select';
import { ListPageTemplate, FormModalTemplate } from '../../../../components/layout-templates';
import { UniLifecycle } from '../../../../components/uni-lifecycle';
import { testGenerateCode } from '../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../utils/codeRulePage';
import {
  listRdProjects,
  createRdProject,
  deleteRdProject,
  pushTrialWorkOrder,
  updateRdProject,
  type RdProject,
} from '../../services/rd-project';
import { listGateTemplates } from '../../services/gate-template';
import {
  buildRdProjectLifecycleValueEnum,
  getRdProjectLifecycle,
  LIST_LIFECYCLE_STAGE_FIELD,
} from '../../utils/rdProjectLifecycle';
import {
  plmCodeTitleSearchColumns,
  plmCreatedUpdatedColumns,
  plmListActionColumn,
  resolveRdProjectListParams,
} from '../../utils/plmListCore';
import {
  getKuaiplmProjectTypeText,
  renderKuaiplmCurrentGateMarker,
  renderKuaiplmProjectTypeMarker,
} from '../../components/kuaiplmMeta';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import { formatDateTime } from '../../../../utils/format';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';

const PAGE_CODE_RD = 'kuaiplm-rd-project';

const RdProjectsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const projectPerms = useResourcePermissions('kuaiplm.project');
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [gateTemplateOptions, setGateTemplateOptions] = useState<{ label: string; value: number }[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const createFormRef = useRef<any>(null);
  const selectedOwnerRef = useRef<{ id: number; name: string } | null>(null);

  const activePageCode = PAGE_CODE_RD;
  const lifecycleValueEnum = useMemo(() => buildRdProjectLifecycleValueEnum(t), [t]);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      if (!isAutoGenerateEnabled(activePageCode)) {
        setPreviewCode(null);
      } else {
        try {
          const ruleCode = getPageRuleCode(activePageCode);
          if (!ruleCode) {
            setPreviewCode(null);
          } else {
            const res = await testGenerateCode({ rule_code: ruleCode });
            setPreviewCode(res.code);
            createFormRef.current?.setFieldsValue({ project_code: res.code });
          }
        } catch {
          setPreviewCode(null);
        }
      }

      try {
        const res = await listGateTemplates({ project_type: 'RD', is_active: true });
        const options = res.items.map((tpl) => ({
          label: tpl.is_default ? `${tpl.template_name} (${t('app.kuaiplm.gateTemplates.defaultBadge')})` : tpl.template_name,
          value: tpl.id,
        }));
        setGateTemplateOptions(options);
        const defaultTpl = res.items.find((tpl) => tpl.is_default) ?? res.items[0];
        if (defaultTpl) {
          createFormRef.current?.setFieldsValue({ gate_template_id: defaultTpl.id });
        }
      } catch {
        setGateTemplateOptions([]);
      }
    })();
  }, [createOpen, activePageCode, t]);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  const toProjectIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toProjectIds(keys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.common.messages.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteRdProject(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaiplm.common.messages.batchDeleteSuccess', { count: successCount }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.common.messages.batchDeleteFailed'));
  };

  const handleBatchPushTrialWorkOrder = async () => {
    const ids = toProjectIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.common.messages.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await pushTrialWorkOrder(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaiplm.common.messages.batchExecuteSuccess', { count: successCount }));
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.rdProjects.messages.pushTrialWoFailed'));
  };

  const handleBatchUpdateStatus = async (status: string) => {
    const ids = toProjectIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.common.messages.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateRdProject(id, { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(
        t('app.kuaiplm.common.messages.batchExecuteSuccess', {
          count: successCount,
        }),
      );
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.common.messages.batchUpdateFailed'));
  };

  const columns: ProColumns<RdProject>[] = useMemo(
    () => [
      ...plmCodeTitleSearchColumns({
        codeLabel: t('app.kuaiplm.common.columns.projectCode'),
        titleLabel: t('app.kuaiplm.common.columns.projectName'),
        codeField: 'project_code',
        titleField: 'project_name',
      }),
      {
        // 稀疏：业务列不叠（编码 → 类型 → 名称 → 物料 → 负责人 → 阶段门 → 计划完成）；审计叠列保留
        title: t('app.kuaiplm.common.columns.projectCode'),
        dataIndex: 'project_code',
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        fixed: 'left',
        sorter: true,
        hideInSearch: true,
        render: (_, row) => (
          <Typography.Text copyable={{ text: String(row.project_code ?? '') }} ellipsis>
            <a onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${row.id}`)}>{row.project_code}</a>
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaiplm.common.columns.projectType'),
        dataIndex: 'project_type',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        valueEnum: {
          RD: { text: getKuaiplmProjectTypeText(t, 'RD') },
          DELIVERY: { text: getKuaiplmProjectTypeText(t, 'DELIVERY') },
        },
        render: (_, row) => renderKuaiplmProjectTypeMarker(t, row.project_type ?? 'RD'),
      },
      {
        // 项目名称长短不一：唯一 RemainderFlex
        title: t('app.kuaiplm.common.columns.projectName'),
        dataIndex: 'project_name',
        minWidth: 160,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        sorter: true,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.common.columns.productMaterial'),
        key: 'plm_rd_material_name',
        dataIndex: 'material_name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        ellipsis: true,
        render: (_, row) => row.material_name || row.material_code || '-',
      },
      {
        title: t('app.kuaiplm.common.columns.owner'),
        key: 'plm_rd_owner_name',
        dataIndex: 'owner_name',
        width: 112,
        minWidth: 112,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.common.columns.currentGate'),
        dataIndex: 'current_gate_name',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        render: (_, row) =>
          renderKuaiplmCurrentGateMarker(t, row.current_gate_key, row.current_gate_name),
      },
      {
        title: t('app.kuaiplm.common.columns.lifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        hideInTable: true,
        valueEnum: lifecycleValueEnum,
      },
      {
        title: t('app.kuaiplm.common.columns.plannedCompletion'),
        dataIndex: 'planned_end_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => (row.planned_end_date ? formatDateTime(row.planned_end_date, 'YYYY-MM-DD') : '-'),
      },
      ...plmCreatedUpdatedColumns<RdProject>(t),
      {
        title: t('app.kuaiplm.common.columns.lifecycle'),
        key: 'lifecycle',
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const lc = getRdProjectLifecycle(record as unknown as Record<string, unknown>, t);
          return (
            <UniLifecycle
              percent={lc.percent}
              stageName={lc.stageName}
              status={lc.status}
              showLabel
              size="small"
              showCircleTooltip={false}
            />
          );
        },
      },
      plmListActionColumn<RdProject>(t, (_, record) => [
        <Button
          key="detail"
          {...rowActionKind('read')}
          onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${record.id}`)}
        />,
      ]),
    ],
    [t, navigate, lifecycleValueEnum],
  );

  return (
    <ListPageTemplate>
      <UniTable<RdProject>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaiplm.rdProjects')}
        headerTitle={t('app.kuaiplm.rdProjects.pageTitle')}
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.rd-projects.list-v2"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        showCreateButton={projectPerms.canCreate}
        createButtonText={t('app.kuaiplm.rdProjects.createButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        toolBarActionsAfterCreate={[
          <UniBatchMenuButton
            key="rd-project-push-actions"
            buttonText={t('app.kuaiplm.common.actions.pushDown')}
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'batch-push-trial-work-order',
                label: t('app.kuaiplm.rdProjects.batch.pushTrialWo'),
                requireConfirm: true,
                confirmTitle: (count) => `${t('app.kuaiplm.rdProjects.batch.pushTrialWo')} (${count})`,
                onClick: () => {
                  void handleBatchPushTrialWorkOrder();
                },
              },
            ]}
          />,
        ]}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => `${t('common.delete')} (${count})?`}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="rd-project-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaiplm.common.actions.batchActions')}
            menuItems={[
              {
                key: 'batch-set-in-progress',
                label: t('app.kuaiplm.rdProjects.batch.setInProgress'),
                onClick: () => {
                  void handleBatchUpdateStatus('IN_PROGRESS');
                },
              },
              {
                key: 'batch-set-on-hold',
                label: t('app.kuaiplm.rdProjects.batch.setOnHold'),
                onClick: () => {
                  void handleBatchUpdateStatus('ON_HOLD');
                },
              },
              {
                key: 'batch-set-completed',
                label: t('app.kuaiplm.rdProjects.batch.setCompleted'),
                onClick: () => {
                  void handleBatchUpdateStatus('COMPLETED');
                },
              },
            ]}
          />,
        ]}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current, pageSize } = params;
          const listParams = resolveRdProjectListParams(searchFormValues, sort, params);
          lastListParamsRef.current = listParams;
          try {
            const res = await listRdProjects({
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
      />

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.modal.createTitle')}
        open={createOpen}
        grid
        onClose={() => {
          setCreateOpen(false);
          selectedOwnerRef.current = null;
        }}
        formRef={createFormRef}
        onFinish={async (values) => {
          await createRdProject({
            project_code: values.project_code,
            project_name: values.project_name,
            project_type: 'RD',
            gate_template_id: values.gate_template_id ? Number(values.gate_template_id) : undefined,
            owner_id: selectedOwnerRef.current?.id,
            owner_name: selectedOwnerRef.current?.name,
            planned_start_date: values.planned_start_date
              ? formatDateTime(values.planned_start_date, 'YYYY-MM-DD')
              : undefined,
            planned_end_date: values.planned_end_date
              ? formatDateTime(values.planned_end_date, 'YYYY-MM-DD')
              : undefined,
            notes: values.notes,
          });
          messageApi.success(t('common.createSuccess'));
          setCreateOpen(false);
          selectedOwnerRef.current = null;
          actionRef.current?.reload();
        }}
      >
        <ProFormSelect
          name="gate_template_id"
          label={t('app.kuaiplm.rdProjects.form.gateTemplate')}
          placeholder={t('app.kuaiplm.rdProjects.form.gateTemplatePlaceholder')}
          colProps={{ span: 24 }}
          options={gateTemplateOptions}
          rules={[{ required: gateTemplateOptions.length > 0 }]}
        />
        <ProFormText
          name="project_code"
          label={t('app.kuaiplm.rdProjects.form.projectCode')}
          rules={[{ required: !isAutoGenerateEnabled(activePageCode) }]}
          disabled={isAutoGenerateEnabled(activePageCode)}
          extra={previewCode ? `${t('app.kuaiplm.rdProjects.form.projectCode')}: ${previewCode}` : undefined}
          colProps={{ span: 24 }}
        />
        <ProFormText
          name="project_name"
          label={t('app.kuaiplm.rdProjects.form.projectName')}
          rules={[{ required: true }]}
          colProps={{ span: 24 }}
        />
        <UniUserSelect
          name="owner_uuid"
          label={t('app.kuaiplm.rdProjects.form.owner')}
          placeholder={t('app.kuaiplm.rdProjects.form.ownerPlaceholder')}
          colProps={{ span: 24 }}
          onChange={(_uuid, user) => {
            if (user && !Array.isArray(user)) {
              selectedOwnerRef.current = {
                id: user.id,
                name: user.full_name || user.username || '',
              };
            } else {
              selectedOwnerRef.current = null;
            }
          }}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label={t('app.kuaiplm.rdProjects.form.plannedStart')}
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label={t('app.kuaiplm.rdProjects.form.plannedEnd')}
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormTextArea name="notes" label={t('common.remark')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RdProjectsListPage;
