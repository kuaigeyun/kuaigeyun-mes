import React, { useCallback, useEffect, useRef, useState } from 'react';

import { App, Button, Popconfirm } from 'antd';

import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';

import {

  ProFormDatePicker,

  ProFormSelect,

  ProFormText,

  ProFormTextArea,

} from '@ant-design/pro-components';

import { useTranslation } from 'react-i18next';

import { useSearchParams } from 'react-router-dom';

import dayjs from 'dayjs';

import { UniTable } from '../../../../../components/uni-table';

import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';

import { UniUserSelect } from '../../../../../components/uni-user-select';

import { rowActionKind } from '../../../../../components/uni-action';

import { useNewShortcut } from '../../../../../hooks/useNewShortcut';

import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

import {

  deliveryIssueApi,

  deliveryProjectApi,

  DELIVERY_ISSUE_PRIORITY,

  DELIVERY_ISSUE_STATUS,

  DELIVERY_ISSUE_TYPE,

  type DeliveryIssue,

  type DeliveryProject,

} from '../../../services/delivery-project';

import { formatBusinessDateOnly } from '../../../../../utils/format';

import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';

import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';

import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

import DeliveryIssueDetailDrawer from './components/DeliveryIssueDetailDrawer';

import { createDeliveryListExporter } from '../shared/deliveryListExport';
import { renderDeliveryIssuePriorityTag, renderDeliveryIssueTypeTag, renderDeliveryStatusTag } from '../shared/deliveryListPresentation';



const RESOURCE = 'kuaizhizao:delivery-issue';



const IssuesPage: React.FC = () => {

  const { t } = useTranslation();

  const { message } = App.useApp();

  const [searchParams, setSearchParams] = useSearchParams();

  const actionRef = useRef<ActionType>(null);

  const tableRowsRef = useRef<DeliveryIssue[]>([]);

  const lastListParamsRef = useRef<Record<string, unknown>>({});

  const formRef = useRef<ProFormInstance>();

  const perms = useResourcePermissions(RESOURCE);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingIssue, setEditingIssue] = useState<DeliveryIssue | null>(null);

  const [projects, setProjects] = useState<DeliveryProject[]>([]);

  const [selectedProject, setSelectedProject] = useState<DeliveryProject | null>(null);

  const selectedAssigneeRef = useRef<number | undefined>();

  const [detailOpen, setDetailOpen] = useState(false);

  const [detailId, setDetailId] = useState<number>();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);



  const loadProjects = useCallback(async () => {

    const res = await deliveryProjectApi.list({ limit: 100 });

    setProjects(res.items);

  }, []);



  const openCreate = useCallback(

    (preset?: { projectId?: number; nodeId?: number }) => {

      selectedAssigneeRef.current = undefined;

      setEditingIssue(null);

      setSelectedProject(null);

      formRef.current?.resetFields();

      if (preset?.projectId) {

        formRef.current?.setFieldsValue({

          project_id: preset.projectId,

          node_id: preset.nodeId,

        });

        void deliveryProjectApi.get(preset.projectId).then(setSelectedProject);

      }

      setModalOpen(true);

    },

    [],

  );



  useEffect(() => {

    if (modalOpen) void loadProjects();

  }, [modalOpen, loadProjects]);



  useEffect(() => {

    const action = searchParams.get('action');

    const projectId = Number(searchParams.get('project_id'));

    const nodeId = Number(searchParams.get('node_id'));

    if (action !== 'create' || !Number.isFinite(projectId) || projectId <= 0) return;

    openCreate({ projectId, nodeId: Number.isFinite(nodeId) && nodeId > 0 ? nodeId : undefined });

    const next = new URLSearchParams(searchParams);

    next.delete('action');

    next.delete('project_id');

    next.delete('node_id');

    setSearchParams(next, { replace: true });

  }, [openCreate, searchParams, setSearchParams]);



  useNewShortcut(perms.canCreate ? () => openCreate() : undefined);



  const openDetail = useCallback((id: number) => {

    setDetailId(id);

    setDetailOpen(true);

  }, []);



  const openEdit = useCallback(async (issue: DeliveryIssue) => {

    selectedAssigneeRef.current = issue.assignee_name ? undefined : undefined;

    const detail = await deliveryIssueApi.get(issue.id);

    const project = await deliveryProjectApi.get(detail.project_id);

    setProjects((prev) => (prev.some((item) => item.id === project.id) ? prev : [...prev, project]));

    setSelectedProject(project);

    setEditingIssue(detail);

    formRef.current?.resetFields();

    formRef.current?.setFieldsValue({

      project_id: detail.project_id,

      node_id: detail.node_id,

      title: detail.title,

      issue_type: detail.issue_type,

      priority: detail.priority,

      description: detail.description,

      due_date: detail.due_date ? dayjs(detail.due_date) : undefined,

    });

    setModalOpen(true);

  }, []);



  const resolveSelectedRows = useCallback(
    (keys: React.Key[]) =>
      tableRowsRef.current.filter((row) => row.id != null && keys.includes(row.id)),
    [],
  );

  const confirmDeleteRow = useCallback(

    async (record: DeliveryIssue) => {

      await deliveryIssueApi.delete(record.id);

      message.success(t('common.deleted'));

      actionRef.current?.reload();

    },

    [message, t],

  );

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      const rows = resolveSelectedRows(keys).filter((row) => row.status === 'open');
      if (rows.length === 0) {
        message.warning(t('app.kuaizhizao.deliveryProject.batchDeleteEmptyOpenIssue'));
        return;
      }
      try {
        for (const row of rows) {
          await deliveryIssueApi.delete(row.id);
        }
        message.success(t('common.batchDeleteSuccess', { count: rows.length }));
        setSelectedRowKeys([]);
        if (detailId != null && rows.some((row) => row.id === detailId)) {
          setDetailOpen(false);
          setDetailId(undefined);
        }
    actionRef.current?.reload();
      } catch (error: unknown) {
        message.error((error as Error)?.message || t('common.batchDeleteFailed'));
      }
    },
    [detailId, message, resolveSelectedRows, t],
  );

  const handleExport = useCallback(
    createDeliveryListExporter<DeliveryIssue>({
      filename: 'delivery-issues',
      columns: [
        { title: t('app.kuaizhizao.deliveryProject.fields.issueCode'), key: 'issue_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.title'), key: 'title' },
        { title: t('app.kuaizhizao.deliveryProject.fields.projectCode'), key: 'project_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.issueType'), key: 'issue_type', getValue: (r) => DELIVERY_ISSUE_TYPE[r.issue_type] ?? r.issue_type },
        { title: t('app.kuaizhizao.deliveryProject.fields.priority'), key: 'priority', getValue: (r) => DELIVERY_ISSUE_PRIORITY[r.priority] ?? r.priority },
        { title: t('app.kuaizhizao.deliveryProject.fields.status'), key: 'status', getValue: (r) => DELIVERY_ISSUE_STATUS[r.status] ?? r.status },
        { title: t('app.kuaizhizao.deliveryProject.fields.dueDate'), key: 'due_date' },
      ],
      fetchPage: ({ skip, limit, ...params }) =>
        deliveryIssueApi.list({ skip, limit, ...params }).then((res) => res),
      getListParams: () => lastListParamsRef.current,
      tableRowsRef,
      onEmpty: () => message.warning(t('common.exportNoData')),
    }),
    [message, t],
  );



  const columns: ProColumns<DeliveryIssue>[] = alignProColumns(

    [

      {

        title: t('app.kuaizhizao.deliveryProject.fields.issueCode'),

        dataIndex: 'issue_code',

        key: 'issue_code',

        width: 140,

        uniTableKeepWidth: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.title'),

        dataIndex: 'title',

        key: 'title',

        minWidth: 200,

        uniTableRemainderFlex: true,

        uniTablePrimaryFlex: true,

        resizable: false,

        ellipsis: true,

        hideInSearch: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.projectCode'),

        dataIndex: 'project_code',

        key: 'project_code',

        width: 130,

        uniTableKeepWidth: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.nodeName'),

        dataIndex: 'node_name',

        key: 'node_name',

        width: 120,

        uniTableKeepWidth: true,

        hideInSearch: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.issueType'),

        dataIndex: 'issue_type',

        key: 'issue_type',

        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,

        render: (_, r) => renderDeliveryIssueTypeTag(r.issue_type),

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.priority'),

        dataIndex: 'priority',

        key: 'priority',

        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,

        render: (_, r) => renderDeliveryIssuePriorityTag(r.priority),

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.dueDate'),

        dataIndex: 'due_date',

        key: 'due_date',

        width: 110,

        uniTableKeepWidth: true,

        render: (_, r) => formatBusinessDateOnly(r.due_date),

      },

      ...buildDocumentAuditColumns<DeliveryIssue>(t),

      {

        title: t('app.kuaizhizao.deliveryProject.fields.status'),

        dataIndex: 'status',

        key: 'lifecycle',

        fixed: 'right',

        valueType: 'select',

        valueEnum: Object.fromEntries(Object.entries(DELIVERY_ISSUE_STATUS).map(([k, v]) => [k, { text: v }])),

        render: (_, r) => renderDeliveryStatusTag(r.status, DELIVERY_ISSUE_STATUS),

      },

      {

        title: t('common.actions'),

        key: 'action',

        fixed: 'right',

        hideInSearch: true,

        render: (_, r) => {

          const parts: React.ReactNode[] = [

            <Button

              {...rowActionKind('read')}

              key="read"

              onClick={(e) => {

                e.stopPropagation();

                openDetail(r.id);

              }}

            />,

          ];

          if (r.status === 'open' && perms.canUpdate) {

            parts.push(

              <Button

                {...rowActionKind('update')}

                key="edit"

                onClick={(e) => {

                  e.stopPropagation();

                  void openEdit(r);

                }}

              />,

            );

          }

          if (r.status === 'open' && perms.canDelete) {

            parts.push(
              <Popconfirm
                key="delete"
                title={t('app.kuaizhizao.deliveryProject.deleteIssueConfirm')}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  void confirmDeleteRow(r);
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

          if (r.status === 'open' && perms.canUpdate) {

            parts.push(

              <Button

                {...rowActionKind('submit')}

                key="start"

                onClick={async (e) => {

                  e.stopPropagation();

                  await deliveryIssueApi.update(r.id, { status: 'in_progress' });

                  message.success(t('common.updated'));
    actionRef.current?.reload();

                }}

              />,

            );

          }

          if (['open', 'in_progress'].includes(r.status) && perms.canUpdate) {

            parts.push(

              <Button

                {...rowActionKind('approve')}

                key="resolve"

                onClick={async (e) => {

                  e.stopPropagation();

                  await deliveryIssueApi.update(r.id, { status: 'resolved' });

                  message.success(t('app.kuaizhizao.deliveryProject.issueResolved'));
    actionRef.current?.reload();

                }}

              />,

            );

          }

          if (r.status === 'resolved' && perms.canUpdate) {

            parts.push(

              <Button

                {...rowActionKind('close')}

                key="close"

                onClick={async (e) => {

                  e.stopPropagation();

                  await deliveryIssueApi.update(r.id, { status: 'closed' });

                  message.success(t('app.kuaizhizao.deliveryProject.issueClosed'));
    actionRef.current?.reload();

                }}

              />,

            );

          }

          return parts;

        },

      },

    ],

    GLOBAL_DOC_LIST_FIELD_RANK,

  );



  const handleSave = async (values: Record<string, unknown>) => {

    const dueDate = values.due_date as dayjs.Dayjs | undefined;

    const payload = {

      project_id: values.project_id as number,

      node_id: values.node_id as number | undefined,

      title: values.title as string,

      issue_type: values.issue_type as string,

      priority: values.priority as string,

      description: values.description as string | undefined,

      due_date: dueDate?.format('YYYY-MM-DD'),

      assignee_id: selectedAssigneeRef.current,

    };

    if (editingIssue) {

      await deliveryIssueApi.update(editingIssue.id, {
        title: values.title as string,
        issue_type: values.issue_type as string,
        priority: values.priority as string,
        description: values.description as string | undefined,
        due_date: dueDate?.format('YYYY-MM-DD'),
        assignee_id: selectedAssigneeRef.current,
        node_id: values.node_id as number | undefined,
      });

      message.success(t('common.updated'));

    } else {

      await deliveryIssueApi.create(payload);

      message.success(t('common.created'));

    }

    setModalOpen(false);

    setEditingIssue(null);

    actionRef.current?.reload();

  };



  return (

    <>

      <ListPageTemplate>

        <UniTable<DeliveryIssue>

          actionRef={actionRef}

          rowKey="id"

          permissionResource={RESOURCE}

          columns={columns}

          columnPersistenceId="kuaizhizao-delivery-issues-v8"

          enableRowSelection

          selectedRowKeys={selectedRowKeys}

          onRowSelectionChange={setSelectedRowKeys}

          showCreateButton={perms.canCreate}

          onCreate={() => openCreate()}

          createButtonText={t('app.kuaizhizao.deliveryProject.createIssue') + NEW_SHORTCUT_HINT}

          showDeleteButton={perms.canDelete}

          onDelete={handleBatchDelete}

          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.deliveryProject.batchDeleteIssueConfirm', { count })
          }

          deleteConfirmDescription={t('app.kuaizhizao.deliveryProject.deleteIssueConfirm')}

          showExportButton={perms.canExport}

          onExport={handleExport}

          onTableDataChange={(rows) => {

            tableRowsRef.current = rows;

          }}

          request={async (params) => {

            const listParams = {
              keyword: params.keyword,
              status: params.lifecycle as string | undefined,
            };
            lastListParamsRef.current = listParams;

            const res = await deliveryIssueApi.list({

              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),

              limit: params.pageSize ?? 20,

              ...listParams,

            });

            return { data: res.items, success: true, total: res.total };

          }}

        />

      </ListPageTemplate>



      <FormModalTemplate

        title={

          editingIssue

            ? t('app.kuaizhizao.deliveryProject.editIssue')

            : t('app.kuaizhizao.deliveryProject.createIssue')

        }

        open={modalOpen}

        width={MODAL_CONFIG.STANDARD_WIDTH}

        onClose={() => {

          setModalOpen(false);

          setEditingIssue(null);

        }}

        formRef={formRef}

        grid

        onFinish={handleSave}

      >

        <ProFormSelect

          name="project_id"

          label={t('app.kuaizhizao.deliveryProject.fields.project')}

          rules={[{ required: true }]}

          colProps={{ span: 24 }}

          disabled={Boolean(editingIssue)}

          fieldProps={{

            showSearch: true,

            optionFilterProp: 'label',

            onChange: async (id: number) => {

              const detail = await deliveryProjectApi.get(id);

              setSelectedProject(detail);

              formRef.current?.setFieldValue('node_id', undefined);

            },

          }}

          options={projects.map((p) => ({

            label: `${p.project_code} ${p.project_name}`,

            value: p.id,

          }))}

        />

        <ProFormSelect

          name="node_id"

          label={t('app.kuaizhizao.deliveryProject.fields.nodeName')}

          colProps={{ span: 24 }}

          options={(selectedProject?.nodes ?? []).map((n) => ({ label: n.node_name, value: n.id }))}

        />

        <ProFormText

          name="title"

          label={t('app.kuaizhizao.deliveryProject.fields.title')}

          rules={[{ required: true }]}

          colProps={{ span: 24 }}

        />

        <ProFormSelect

          name="issue_type"

          label={t('app.kuaizhizao.deliveryProject.fields.issueType')}

          initialValue="other"

          colProps={{ span: 12 }}

          options={Object.entries(DELIVERY_ISSUE_TYPE).map(([value, label]) => ({ value, label }))}

        />

        <ProFormSelect

          name="priority"

          label={t('app.kuaizhizao.deliveryProject.fields.priority')}

          initialValue="normal"

          colProps={{ span: 12 }}

          options={Object.entries(DELIVERY_ISSUE_PRIORITY).map(([value, label]) => ({ value, label }))}

        />

        <ProFormDatePicker

          name="due_date"

          label={t('app.kuaizhizao.deliveryProject.fields.dueDate')}

          colProps={{ span: 12 }}

          width="100%"

          fieldProps={{ style: { width: '100%' } }}

        />

        <UniUserSelect

          name="assignee_uuid"

          label={t('app.kuaizhizao.deliveryProject.fields.assigneeName')}

          colProps={{ span: 12 }}

          onChange={(_value, user) => {

            const picked = Array.isArray(user) ? user[0] : user;

            selectedAssigneeRef.current = picked?.id;

          }}

        />

        <ProFormTextArea

          name="description"

          label={t('app.kuaizhizao.deliveryProject.fields.description')}

          colProps={{ span: 24 }}

          fieldProps={{ rows: 3 }}

        />

      </FormModalTemplate>



      <DeliveryIssueDetailDrawer

        open={detailOpen}

        issueId={detailId}

        onClose={() => setDetailOpen(false)}

        canUpdate={perms.canUpdate}

        canDelete={perms.canDelete}

        onEdit={(issue) => void openEdit(issue)}

        onChanged={() => actionRef.current?.reload()}

      />

    </>

  );

};



export default IssuesPage;


