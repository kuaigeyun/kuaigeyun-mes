import { rowActionKind } from '../../../../components/uni-action';
/**
 * 研发项目列表
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { App, Button, Tag, Typography } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import { UniUserSelect } from '../../../../components/uni-user-select';
import { ListPageTemplate, FormModalTemplate } from '../../../../components/layout-templates';
import { UniLifecycle } from '../../../../components/uni-lifecycle';
import { testGenerateCode } from '../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../utils/codeRulePage';
import {
  listRdProjects,
  createRdProject,
  buildProjectStatusValueEnum,
  PROJECT_TYPE_LABELS,
  type ProjectType,
  type RdProject,
} from '../../services/rd-project';
import {
  buildRdProjectLifecycleValueEnum,
  getRdProjectLifecycle,
  resolveRdProjectListLifecycleParams,
  LIST_LIFECYCLE_STAGE_FIELD,
} from '../../utils/rdProjectLifecycle';
import { renderRowActionsOverflow } from '../../../../utils/renderRowActionsOverflow';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';

const PAGE_CODE_RD = 'kuaiplm-rd-project';
const PAGE_CODE_DELIVERY = 'kuaiplm-delivery-project';

const RdProjectsListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<ProjectType>('RD');
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const createFormRef = useRef<any>(null);
  const selectedOwnerRef = useRef<{ id: number; name: string } | null>(null);

  const activePageCode = createProjectType === 'DELIVERY' ? PAGE_CODE_DELIVERY : PAGE_CODE_RD;

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

  const columns: ProColumns<RdProject>[] = [
    {
      title: '项目编号',
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
      title: '项目类型',
      dataIndex: 'project_type',
      width: 100,
      valueEnum: {
        RD: { text: PROJECT_TYPE_LABELS.RD },
        DELIVERY: { text: PROJECT_TYPE_LABELS.DELIVERY },
      },
      render: (_, row) => {
        const type = (row.project_type ?? 'RD') as ProjectType;
        return (
          <Tag color={type === 'DELIVERY' ? 'blue' : 'purple'}>
            {PROJECT_TYPE_LABELS[type] ?? type}
          </Tag>
        );
      },
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '产品物料',
      dataIndex: 'material_name',
      width: 160,
      hideInSearch: true,
      render: (_, row) => row.material_name || row.material_code || '-',
    },
    {
      title: '负责人',
      dataIndex: 'owner_name',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '当前阶段门',
      dataIndex: 'current_gate_name',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      valueEnum: buildProjectStatusValueEnum(),
    },
    {
      title: LIST_LIFECYCLE_STAGE_FIELD,
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      hideInTable: true,
      valueEnum: buildRdProjectLifecycleValueEnum(),
    },
    {
      title: '计划完成',
      dataIndex: 'planned_end_date',
      width: 120,
      hideInSearch: true,
      render: (_, row) => (row.planned_end_date ? dayjs(row.planned_end_date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, row) => (row.updated_at ? dayjs(row.updated_at).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lc = getRdProjectLifecycle(record as unknown as Record<string, unknown>);
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
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 120,
      render: (_, record) =>
        renderRowActionsOverflow(
          [
            <Button {...rowActionKind('read')}
              key="detail"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${record.id}`)}
            >
              工作台
            </Button>,
          ],
          `rd-${record.id}`,
        ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<RdProject>
        headerTitle="项目管理"
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaiplm.pages.rd-projects"
        scroll={{ x: 1400 }}
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
            messageApi.error(e?.message || '加载失败');
            return { data: [], total: 0, success: false };
          }
        }}
        toolBarRender={() => [
          <Button {...rowActionKind('create')} key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {'新建项目' + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="新建项目"
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
              ? dayjs(values.planned_start_date).format('YYYY-MM-DD')
              : undefined,
            planned_end_date: values.planned_end_date
              ? dayjs(values.planned_end_date).format('YYYY-MM-DD')
              : undefined,
            notes: values.notes,
          });
          messageApi.success('创建成功');
          setCreateOpen(false);
          setCreateProjectType('RD');
          selectedOwnerRef.current = null;
          actionRef.current?.reload();
        }}
      >
        <ProFormSelect
          name="project_type"
          label="项目类型"
          initialValue="RD"
          rules={[{ required: true }]}
          colProps={{ span: 24 }}
          options={[
            { label: PROJECT_TYPE_LABELS.RD, value: 'RD' },
            { label: PROJECT_TYPE_LABELS.DELIVERY, value: 'DELIVERY' },
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
            label="来源研发项目"
            placeholder="可选，选择后将继承物料与工程关联"
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
          label="项目编号"
          rules={[{ required: !isAutoGenerateEnabled(activePageCode) }]}
          disabled={isAutoGenerateEnabled(activePageCode)}
          extra={previewCode ? `预览编号：${previewCode}` : undefined}
          colProps={{ span: 24 }}
        />
        <ProFormText
          name="project_name"
          label="项目名称"
          rules={[{ required: true }]}
          colProps={{ span: 24 }}
        />
        <UniUserSelect
          name="owner_uuid"
          label="项目负责人"
          placeholder="请选择项目负责人"
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
          label="计划开始"
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划完成"
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormTextArea name="notes" label="备注" colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RdProjectsListPage;
