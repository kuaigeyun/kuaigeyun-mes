import { rowActionKind } from '../../../../components/uni-action';
/**
 * 研发项目列表
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { App, Button, Tag, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../components/uni-table';
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
  spawnDeliveryProject,
  pushTrialWorkOrder,
  updateRdProject,
  type ProjectType,
  type RdProject,
} from '../../services/rd-project';
import {
  buildRdProjectLifecycleValueEnum,
  getRdProjectLifecycle,
  resolveRdProjectListLifecycleParams,
  LIST_LIFECYCLE_STAGE_FIELD,
} from '../../utils/rdProjectLifecycle';
import {
  buildKuaiplmProjectStatusValueEnum,
  getKuaiplmProjectStatusText,
  getKuaiplmProjectTypeText,
} from '../../components/kuaiplmMeta';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import { formatDateTime } from '../../../../utils/format';

const PAGE_CODE_RD = 'kuaiplm-rd-project';
const PAGE_CODE_DELIVERY = 'kuaiplm-delivery-project';

const RdProjectsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createProjectType, setCreateProjectType] = useState<ProjectType>('RD');
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const createFormRef = useRef<any>(null);
  const selectedOwnerRef = useRef<{ id: number; name: string } | null>(null);

  const activePageCode = createProjectType === 'DELIVERY' ? PAGE_CODE_DELIVERY : PAGE_CODE_RD;
  const lifecycleValueEnum = useMemo(() => buildRdProjectLifecycleValueEnum(t), [t]);
  const projectStatusValueEnum = useMemo(() => buildKuaiplmProjectStatusValueEnum(t), [t]);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      if (!isAutoGenerateEnabled(activePageCode)) {
        setPreviewCode(null);
        return;
      }
      try {
        const ruleCode = getPageRuleCode(activePageCode);
        if (!ruleCode) {
          setPreviewCode(null);
          return;
        }
        const res = await testGenerateCode({ rule_code: ruleCode });
        setPreviewCode(res.code);
        createFormRef.current?.setFieldsValue({ project_code: res.code });
      } catch {
        setPreviewCode(null);
      }
    })();
  }, [createOpen, activePageCode]);

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

  const handleBatchSpawnDelivery = async () => {
    const ids = toProjectIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning(t('app.kuaiplm.common.messages.selectFirst'));
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await spawnDeliveryProject(id);
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
    messageApi.error(t('app.kuaiplm.rdProjects.messages.pushDeliveryFailed'));
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
      {
        title: t('app.kuaiplm.common.columns.projectCode'),
        dataIndex: 'project_code',
        width: 160,
        fixed: 'left',
        render: (_, row) => (
          <Typography.Text copyable={{ text: String(row.project_code ?? '') }} ellipsis>
            <a onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${row.id}`)}>{row.project_code}</a>
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaiplm.common.columns.projectType'),
        dataIndex: 'project_type',
        width: 100,
        valueEnum: {
          RD: { text: getKuaiplmProjectTypeText(t, 'RD') },
          DELIVERY: { text: getKuaiplmProjectTypeText(t, 'DELIVERY') },
        },
        render: (_, row) => {
          const type = (row.project_type ?? 'RD') as ProjectType;
          return (
            <Tag color={type === 'DELIVERY' ? 'blue' : 'purple'}>
              {getKuaiplmProjectTypeText(t, type)}
            </Tag>
          );
        },
      },
      {
        title: t('app.kuaiplm.common.columns.projectName'),
        dataIndex: 'project_name',
        width: 200,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.common.columns.productMaterial'),
        dataIndex: 'material_name',
        width: 160,
        hideInSearch: true,
        render: (_, row) => row.material_name || row.material_code || '-',
      },
      {
        title: t('app.kuaiplm.common.columns.owner'),
        dataIndex: 'owner_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.common.columns.currentGate'),
        dataIndex: 'current_gate_name',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.common.columns.status'),
        dataIndex: 'status',
        width: 100,
        hideInSearch: true,
        valueEnum: projectStatusValueEnum,
        render: (_, row) => getKuaiplmProjectStatusText(t, row.status),
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
        width: 120,
        hideInSearch: true,
        render: (_, row) => (row.planned_end_date ? formatDateTime(row.planned_end_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaiplm.common.columns.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, row) => (row.updated_at ? formatDateTime(row.updated_at, 'YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: t('app.kuaiplm.common.columns.lifecycle'),
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
      {
        title: t('app.kuaiplm.common.columns.actions'),
        valueType: 'option',
        fixed: 'right',
        width: 120,
        render: (_, record) => [
          <Button
            {...rowActionKind('read')}
            key="detail"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${record.id}`)}
          >
            {t('app.kuaiplm.common.actions.detail')}
          </Button>,
        ],
      },
    ],
    [t, navigate, lifecycleValueEnum, projectStatusValueEnum],
  );

  return (
    <ListPageTemplate>
      <UniTable<RdProject>
        headerTitle={t('app.kuaiplm.rdProjects.pageTitle')}
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        columnPersistenceId="apps.kuaiplm.pages.rd-projects"
        scroll={{ x: 1400 }}
        showCreateButton
        createButtonText={t('app.kuaiplm.rdProjects.createButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        toolBarActionsAfterCreate={[
          <UniBatchMenuButton
            key="rd-project-push-actions"
            buttonText={t('app.kuaiplm.common.actions.pushDown')}
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'batch-spawn-delivery',
                label: t('app.kuaiplm.rdProjects.batch.pushDelivery'),
                requireConfirm: true,
                confirmTitle: (count) => `${t('app.kuaiplm.rdProjects.batch.pushDelivery')} (${count})`,
                onClick: () => {
                  void handleBatchSpawnDelivery();
                },
              },
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
        deleteConfirmTitle={(count) => `${t('app.kuaiplm.common.actions.delete')} (${count})?`}
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
        request={async (params, _sort, _filter, searchFormValues) => {
          const { current, pageSize } = params;
          const lifecycleParams = resolveRdProjectListLifecycleParams(searchFormValues, params);
          try {
            const res = await listRdProjects({
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              keyword: searchFormValues?.project_name as string | undefined,
              project_type: (searchFormValues?.project_type ?? params?.project_type) as ProjectType | undefined,
              ...lifecycleParams,
            });
            return { data: res.items, total: res.total, success: true };
          } catch (e: any) {
            messageApi.error(e?.message || t('app.kuaiplm.common.messages.loadFailed'));
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
          setCreateProjectType('RD');
          selectedOwnerRef.current = null;
        }}
        formRef={createFormRef}
        onFinish={async (values) => {
          await createRdProject({
            project_code: values.project_code,
            project_name: values.project_name,
            project_type: values.project_type ?? 'RD',
            source_project_id: values.source_project_id ? Number(values.source_project_id) : undefined,
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
          messageApi.success(t('app.kuaiplm.common.messages.createSuccess'));
          setCreateOpen(false);
          setCreateProjectType('RD');
          selectedOwnerRef.current = null;
          actionRef.current?.reload();
        }}
      >
        <ProFormSelect
          name="project_type"
          label={t('app.kuaiplm.rdProjects.form.projectType')}
          initialValue="RD"
          rules={[{ required: true }]}
          colProps={{ span: 24 }}
          options={[
            { label: getKuaiplmProjectTypeText(t, 'RD'), value: 'RD' },
            { label: getKuaiplmProjectTypeText(t, 'DELIVERY'), value: 'DELIVERY' },
          ]}
          fieldProps={{
            onChange: (val: ProjectType) => {
              setCreateProjectType(val);
              createFormRef.current?.setFieldsValue({ project_code: undefined, source_project_id: undefined });
            },
          }}
        />
        {createProjectType === 'DELIVERY' ? (
          <ProFormSelect
            name="source_project_id"
            label={t('app.kuaiplm.rdProjects.form.sourceProject')}
            placeholder={t('app.kuaiplm.rdProjects.form.sourceProjectHint')}
            colProps={{ span: 24 }}
            showSearch
            request={async () => {
              const res = await listRdProjects({ project_type: 'RD', limit: 100 });
              return res.items.map((p) => ({
                label: `${p.project_code} · ${p.project_name}`,
                value: p.id,
              }));
            }}
          />
        ) : null}
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
        <ProFormTextArea name="notes" label={t('app.kuaiplm.rdProjects.form.notes')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RdProjectsListPage;
