/**
 * 研发项目列表
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { App, Button, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../components/uni-table/stackedPrimaryColumn';
import { rowActionKind, rowActionOpenWorkbench, rowActionWithdrawProject } from '../../../../components/uni-action';
import { UniBatchMenuButton } from '../../../../components/uni-batch';
import { UniUserSelect } from '../../../../components/uni-user-select';
import { ListPageTemplate, FormModalTemplate } from '../../../../components/layout-templates';
import { UniLifecycle } from '../../../../components/uni-lifecycle';
import { testGenerateCode } from '../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../utils/codeRulePage';
import { resolveUserDisplay, type User } from '../../../../services/user';
import {
  listRdProjects,
  createRdProject,
  deleteRdProject,
  withdrawRdProject,
  getRdProject,
  pushTrialWorkOrder,
  updateRdProject,
  type RdProject,
  type RdProjectMember,
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
import { getKuaiplmGateText } from '../../components/kuaiplmMeta';
import {
  RD_GATE_PROGRESS_REMAINDER_COLUMN_DEFAULTS,
  renderRdGateProgressCell,
} from '../../components/rdGateProgressCell';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import { formatBusinessDateOnly, formatDateTime } from '../../../../utils/format';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
  DocumentPushProgressBar,
} from '../../../kuaizhizao/pages/sales-management/shared/DocumentPushProgressBar';
import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';

const PAGE_CODE_RD = 'kuaiplm-rd-project';
const RESOURCE = 'kuaiplm:project';

const RdProjectsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const projectPerms = useResourcePermissions('kuaiplm.project');
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<RdProject[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<RdProject | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [gateTemplateOptions, setGateTemplateOptions] = useState<{ label: string; value: number }[]>([]);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const formRef = useRef<any>(null);
  const selectedOwnerRef = useRef<{ id: number; name: string } | null>(null);
  const selectedMembersRef = useRef<RdProjectMember[]>([]);

  const activePageCode = PAGE_CODE_RD;
  const lifecycleValueEnum = useMemo(() => buildRdProjectLifecycleValueEnum(t), [t]);

  const loadGateTemplates = useCallback(async () => {
    const res = await listGateTemplates({ project_type: 'RD', is_active: true });
    const options = res.items.map((tpl) => ({
      label: tpl.is_default ? `${tpl.template_name} (${t('app.kuaiplm.gateTemplates.defaultBadge')})` : tpl.template_name,
      value: tpl.id,
    }));
    setGateTemplateOptions(options);
    return res.items;
  }, [t]);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      try {
        if (!isAutoGenerateEnabled(activePageCode)) {
          setPreviewCode(null);
        } else {
          const ruleCode = getPageRuleCode(activePageCode);
          if (!ruleCode) {
            setPreviewCode(null);
          } else {
            const res = await testGenerateCode({ rule_code: ruleCode });
            setPreviewCode(res.code);
            formRef.current?.setFieldsValue({ project_code: res.code });
          }
        }

        const items = await loadGateTemplates();
        const defaultTpl = items.find((tpl) => tpl.is_default) ?? items[0];
        if (defaultTpl) {
          formRef.current?.setFieldsValue({ gate_template_id: defaultTpl.id });
        }
      } catch (error: unknown) {
        messageApi.error((error as Error)?.message || t('common.loadFailed'));
      }
    })();
  }, [createOpen, activePageCode, loadGateTemplates, messageApi, t]);

  const handleCreate = useCallback(() => {
    selectedOwnerRef.current = null;
    selectedMembersRef.current = [];
    formRef.current?.resetFields();
    setCreateOpen(true);
  }, []);
  useNewShortcut(projectPerms.canCreate ? handleCreate : undefined);

  const openDetail = useCallback(
    (id?: number) => {
      if (!id) return;
      navigate(`/apps/kuaiplm/rd-projects/detail/${id}`);
    },
    [navigate],
  );

  const openEdit = useCallback(
    async (record: RdProject) => {
      if (!record.id) return;
      selectedOwnerRef.current = record.owner_id
        ? { id: record.owner_id, name: record.owner_name || '' }
        : null;
      const detail = await getRdProject(record.id);
      setEditingProject(detail);
      selectedMembersRef.current = detail.members ?? [];
      await loadGateTemplates();
      setEditOpen(true);

      let memberUuids: string[] = [];
      const memberIds = (detail.members ?? []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        const resolved = await resolveUserDisplay({ user_ids: memberIds });
        memberUuids = resolved.map((u) => u.uuid).filter(Boolean);
      }

      let ownerUuid: string | undefined;
      if (detail.owner_id) {
        const resolved = await resolveUserDisplay({ user_ids: [detail.owner_id] });
        ownerUuid = resolved[0]?.uuid;
        if (resolved[0]) {
          selectedOwnerRef.current = {
            id: resolved[0].id,
            name: resolved[0].full_name || resolved[0].username || detail.owner_name || '',
          };
        }
      }

      formRef.current?.setFieldsValue({
        project_code: detail.project_code,
        project_name: detail.project_name,
        gate_template_id: detail.gate_template_id,
        owner_uuid: ownerUuid,
        member_uuids: memberUuids,
        planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : undefined,
        planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : undefined,
        notes: detail.notes,
      });
    },
    [loadGateTemplates],
  );

  const toProjectIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const confirmWithdrawRow = useCallback(
    async (record: RdProject) => {
      if (!record.id) return;
      await withdrawRdProject(record.id);
      messageApi.success(t('app.kuaiplm.rdProjects.withdrawSuccess'));
      actionRef.current?.reload();
    },
    [messageApi, t],
  );

  const confirmDeleteRow = useCallback(
    async (record: RdProject) => {
      if (!record.id) return;
      await deleteRdProject(record.id);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    },
    [messageApi, t],
  );

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toProjectIds(keys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.common.messages.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      await deleteRdProject(id);
      successCount += 1;
    }
    if (successCount > 0) {
      messageApi.success(t('app.kuaiplm.common.messages.batchDeleteSuccess', { count: successCount }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    }
  };

  const handleBatchPushTrialWorkOrder = async () => {
    const ids = toProjectIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.common.messages.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      await pushTrialWorkOrder(id);
      successCount += 1;
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
      await updateRdProject(id, { status });
      successCount += 1;
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
        title: t('app.kuaiplm.common.columns.projectName'),
        dataIndex: 'project_name',
        key: 'project_name',
        hideInSearch: true,
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, row) => (
          <UniTableStackedPrimaryCell
            primary={row.project_name}
            secondary={row.project_code}
            secondaryCopyable
          />
        ),
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
        title: t('app.kuaiplm.common.columns.plannedCompletion'),
        dataIndex: 'planned_end_date',
        key: 'plm_rd_planned_end',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => formatBusinessDateOnly(row.planned_end_date),
      },
      {
        title: t('app.kuaiplm.common.columns.currentNode'),
        dataIndex: 'current_gate_name',
        key: 'current_node_name',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_, row) => getKuaiplmGateText(t, row.current_gate_key, row.current_gate_name),
      },
      {
        title: t('app.kuaiplm.common.columns.lifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        hideInTable: true,
        valueEnum: lifecycleValueEnum,
      },
      {
        title: t('app.kuaiplm.common.columns.progress'),
        dataIndex: 'progress',
        key: 'progress_percent',
        search: false,
        ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
        render: (_, row) => {
          const value = Number(row.progress ?? 0);
          const rounded = Math.round(Number.isFinite(value) ? value : 0);
          return (
            <DocumentPushProgressBar
              percent={value}
              status={row.status === 'COMPLETED' ? 'success' : undefined}
              tooltipSummary={t('app.kuaiplm.rdProjects.columns.progressPercent', { percent: rounded })}
            />
          );
        },
      },
      {
        title: t('app.kuaiplm.common.columns.nodeProgress'),
        dataIndex: 'gates',
        key: 'nodes',
        search: false,
        ...RD_GATE_PROGRESS_REMAINDER_COLUMN_DEFAULTS,
        render: (_, row) => renderRdGateProgressCell(t, row.gates),
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
      plmListActionColumn<RdProject>(t, (_, record) => {
        const parts: React.ReactNode[] = [
          <Button
            key="read"
            {...rowActionOpenWorkbench()}
            onClick={(e) => {
              e.stopPropagation();
              openDetail(record.id);
            }}
          />,
        ];
        if (['DRAFT', 'ON_HOLD'].includes(record.status ?? '') && projectPerms.canUpdate) {
          parts.push(
            <Button
              key="edit"
              {...rowActionKind('update')}
              onClick={(e) => {
                e.stopPropagation();
                void openEdit(record);
              }}
            />,
          );
        }
        if (record.status === 'IN_PROGRESS' && record.not_executed && projectPerms.canUpdate) {
          parts.push(
            <Popconfirm
              key="withdraw"
              title={t('app.kuaiplm.rdProjects.withdrawConfirm')}
              description={t('app.kuaiplm.rdProjects.withdrawConfirmContent')}
              onConfirm={(e) => {
                e?.stopPropagation();
                void confirmWithdrawRow(record);
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                {...rowActionWithdrawProject()}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>,
          );
        }
        if (
          (record.status === 'DRAFT' || (record.status === 'IN_PROGRESS' && record.not_executed))
          && projectPerms.canDelete
        ) {
          parts.push(
            <Popconfirm
              key="delete"
              title={t('app.kuaiplm.rdProjects.deleteConfirm')}
              onConfirm={(e) => {
                e?.stopPropagation();
                void confirmDeleteRow(record);
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                {...rowActionKind('delete')}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>,
          );
        }
        return parts;
      }),
    ],
    [
      t,
      lifecycleValueEnum,
      openDetail,
      openEdit,
      confirmWithdrawRow,
      confirmDeleteRow,
      projectPerms.canUpdate,
      projectPerms.canDelete,
    ],
  );

  const resetFormActors = () => {
    selectedOwnerRef.current = null;
    selectedMembersRef.current = [];
  };

  const projectFormFields = (
    <>
      <ProFormSelect
        name="gate_template_id"
        label={t('app.kuaiplm.rdProjects.form.gateTemplate')}
        placeholder={t('app.kuaiplm.rdProjects.form.gateTemplatePlaceholder')}
        colProps={{ span: 24 }}
        options={gateTemplateOptions}
        disabled={editOpen}
        rules={[{ required: gateTemplateOptions.length > 0 }]}
      />
      <ProFormText
        name="project_code"
        label={t('app.kuaiplm.rdProjects.form.projectCode')}
        rules={[{ required: !editOpen && !isAutoGenerateEnabled(activePageCode) }]}
        disabled={editOpen || isAutoGenerateEnabled(activePageCode)}
        extra={
          !editOpen && previewCode ? `${t('app.kuaiplm.rdProjects.form.projectCode')}: ${previewCode}` : undefined
        }
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
        colProps={{ span: 12 }}
        onChange={(_uuid, user) => {
          if (user && !Array.isArray(user)) {
            selectedOwnerRef.current = {
              id: user.id,
              name: user.full_name || user.username || '',
            };
            selectedMembersRef.current = selectedMembersRef.current.filter(
              (m) => m.user_id !== user.id,
            );
          } else {
            selectedOwnerRef.current = null;
          }
        }}
      />
      <UniUserSelect
        name="member_uuids"
        label={t('app.kuaiplm.rdProjects.form.members')}
        mode="multiple"
        colProps={{ span: 12 }}
        onChange={(_uuids, users) => {
          const list = (Array.isArray(users) ? users : users ? [users] : []) as User[];
          selectedMembersRef.current = list
            .filter((u) => u?.id && u.id !== selectedOwnerRef.current?.id)
            .map((u) => ({
              user_id: u.id,
              user_name: u.full_name || u.username || '',
            }));
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
    </>
  );

  return (
    <ListPageTemplate>
      <UniTable<RdProject>
        viewTypes={['table', 'help']}
        helpViewConfig={buildListPageHelpViewConfig('kuaiplm.rdProjects')}
        headerTitle={t('app.kuaiplm.rdProjects.pageTitle')}
        actionRef={actionRef}
        rowKey="id"
        permissionResource={RESOURCE}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.rd-projects.list-v4"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        showCreateButton={projectPerms.canCreate}
        createButtonText={t('app.kuaiplm.rdProjects.createButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
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
        showDeleteButton={projectPerms.canDelete}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaiplm.rdProjects.batchDeleteConfirm', { count })}
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
          const res = await listRdProjects({
            skip: ((current || 1) - 1) * (pageSize || 20),
            limit: pageSize || 20,
            ...listParams,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.modal.createTitle')}
        open={createOpen}
        grid
        onClose={() => {
          setCreateOpen(false);
          resetFormActors();
        }}
        formRef={formRef}
        onFinish={async (values) => {
          await createRdProject({
            project_code: values.project_code,
            project_name: values.project_name,
            project_type: 'RD',
            gate_template_id: values.gate_template_id ? Number(values.gate_template_id) : undefined,
            owner_id: selectedOwnerRef.current?.id,
            owner_name: selectedOwnerRef.current?.name,
            members: selectedMembersRef.current,
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
          resetFormActors();
    actionRef.current?.reload();
        }}
      >
        {projectFormFields}
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.modal.editTitle')}
        open={editOpen}
        grid
        onClose={() => {
          setEditOpen(false);
          setEditingProject(null);
          resetFormActors();
        }}
        formRef={formRef}
        onFinish={async (values) => {
          if (!editingProject?.id) return;
          await updateRdProject(editingProject.id, {
            project_name: values.project_name,
            owner_id: selectedOwnerRef.current?.id,
            owner_name: selectedOwnerRef.current?.name,
            members: selectedMembersRef.current,
            planned_start_date: values.planned_start_date
              ? formatDateTime(values.planned_start_date, 'YYYY-MM-DD')
              : undefined,
            planned_end_date: values.planned_end_date
              ? formatDateTime(values.planned_end_date, 'YYYY-MM-DD')
              : undefined,
            notes: values.notes,
          });
          messageApi.success(t('common.updateSuccess'));
          setEditOpen(false);
          setEditingProject(null);
          resetFormActors();
    actionRef.current?.reload();
        }}
      >
        {projectFormFields}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RdProjectsListPage;
