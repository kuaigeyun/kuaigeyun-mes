import React, { useCallback, useMemo, useRef, useState } from 'react';

import { App, Button, Modal } from 'antd';

import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';

import {

  ProFormDatePicker,

  ProFormSelect,

  ProFormText,

  ProFormTextArea,

} from '@ant-design/pro-components';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import dayjs from 'dayjs';

import { UniTable } from '../../../../../components/uni-table';

import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';

import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';

import { rowActionKind, rowActionOpenWorkbench } from '../../../../../components/uni-action';

import { UniUserSelect } from '../../../../../components/uni-user-select';

import { useNewShortcut } from '../../../../../hooks/useNewShortcut';

import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

import { resolveUserDisplay, type User } from '../../../../../services/user';

import {

  deliveryProcessTemplateApi,

  deliveryProjectApi,

  DELIVERY_PROJECT_STATUS,

  type DeliveryMember,

  type DeliveryProcessTemplate,

  type DeliveryProject,

} from '../../../services/delivery-project';

import { formatBusinessDateOnly } from '../../../../../utils/format';

import { DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import { renderDeliveryProgressCell, resolveDeliveryProgressStatus } from '../shared/deliveryProgressColumn';

import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';

import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

import { createDeliveryListExporter } from '../shared/deliveryListExport';
import { DELIVERY_CUSTOMER_COLUMN_DEFAULTS, DELIVERY_NODE_PROGRESS_REMAINDER_COLUMN_DEFAULTS } from '../shared/deliveryTableColumns';
import { renderDeliveryStatusTag } from '../shared/deliveryListPresentation';
import { renderDeliveryNodeProgressCell } from '../shared/deliveryNodeProgressCell';



const RESOURCE = 'kuaizhizao:delivery-project';



const DeliveryProjectsPage: React.FC = () => {

  const { t } = useTranslation();

  const { message } = App.useApp();

  const navigate = useNavigate();

  const actionRef = useRef<ActionType>(null);

  const tableRowsRef = useRef<DeliveryProject[]>([]);
  const lastListParamsRef = useRef<Record<string, unknown>>({});

  const formRef = useRef<ProFormInstance>();

  const selectedOwnerRef = useRef<number | undefined>();
  const selectedMembersRef = useRef<DeliveryMember[]>([]);

  const perms = useResourcePermissions(RESOURCE);

  const [createOpen, setCreateOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  const [editingProject, setEditingProject] = useState<DeliveryProject | null>(null);

  const [templates, setTemplates] = useState<DeliveryProcessTemplate[]>([]);


  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);



  const loadTemplates = useCallback(async () => {

    const res = await deliveryProcessTemplateApi.list({ limit: 100, is_active: true });

    setTemplates(res.items);

  }, []);



  const openCreate = useCallback(() => {

    selectedOwnerRef.current = undefined;
    selectedMembersRef.current = [];

    formRef.current?.resetFields();

    void loadTemplates();

    setCreateOpen(true);

  }, [loadTemplates]);



  useNewShortcut(perms.canCreate ? openCreate : undefined);



  const openWorkbench = useCallback(
    (id: number) => {
      navigate(`/apps/kuaizhizao/delivery-project/projects/${id}`);
    },
    [navigate],
  );



  const openEdit = useCallback(

    async (record: DeliveryProject) => {

      selectedOwnerRef.current = record.owner_id ?? undefined;

      const detail = await deliveryProjectApi.get(record.id);

      setEditingProject(detail);
      selectedMembersRef.current = detail.members ?? [];

      void loadTemplates();

      setEditOpen(true);

      let memberUuids: string[] = [];
      const memberIds = (detail.members ?? []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        try {
          const resolved = await resolveUserDisplay({ user_ids: memberIds });
          memberUuids = resolved.map((u) => u.uuid).filter(Boolean);
        } catch {
          memberUuids = [];
        }
      }

      let ownerUuid: string | undefined;
      if (detail.owner_id) {
        try {
          const resolved = await resolveUserDisplay({ user_ids: [detail.owner_id] });
          ownerUuid = resolved[0]?.uuid;
        } catch {
          ownerUuid = undefined;
        }
      }

      formRef.current?.setFieldsValue({

        project_name: detail.project_name,

        process_template_id: detail.process_template_id,

        delivery_date: detail.delivery_date ? dayjs(detail.delivery_date) : undefined,

        notes: detail.notes,

        owner_uuid: ownerUuid,

        member_uuids: memberUuids,

      });

    },

    [loadTemplates],

  );



  const resolveSelectedRows = useCallback(
    (keys: React.Key[]) =>
      tableRowsRef.current.filter((row) => row.id != null && keys.includes(row.id)),
    [],
  );

  const handleDeleteRow = useCallback(

    (record: DeliveryProject) => {

      Modal.confirm({

        title: t('app.kuaizhizao.deliveryProject.deleteProjectConfirm'),

        onOk: async () => {

          await deliveryProjectApi.delete(record.id);

          message.success(t('common.deleted'));

          actionRef.current?.reload();

        },

      });

    },

    [message, t],

  );

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      const rows = resolveSelectedRows(keys).filter((row) => row.status === 'draft');
      if (rows.length === 0) {
        message.warning(t('app.kuaizhizao.deliveryProject.batchDeleteEmptyDraft'));
        return;
      }
      try {
        for (const row of rows) {
          await deliveryProjectApi.delete(row.id);
        }
        message.success(t('common.batchDeleteSuccess', { count: rows.length }));
        setSelectedRowKeys([]);
        actionRef.current?.reload();
      } catch (error: unknown) {
        message.error((error as Error)?.message || t('common.batchDeleteFailed'));
      }
    },
    [message, resolveSelectedRows, t],
  );



  const handleExport = useCallback(
    createDeliveryListExporter<DeliveryProject>({
      filename: 'delivery-projects',
      columns: [
        { title: t('app.kuaizhizao.deliveryProject.fields.projectCode'), key: 'project_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.projectName'), key: 'project_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.customerName'), key: 'customer_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.salesOrderCode'), key: 'sales_order_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.deliveryDate'), key: 'delivery_date' },
        { title: t('app.kuaizhizao.deliveryProject.fields.status'), key: 'status', getValue: (r) => DELIVERY_PROJECT_STATUS[r.status] ?? r.status },
      ],
      fetchPage: ({ skip, limit, ...params }) =>
        deliveryProjectApi.list({ skip, limit, ...params }).then((res) => res),
      getListParams: () => lastListParamsRef.current,
      tableRowsRef,
      onEmpty: () => message.warning(t('common.exportNoData')),
    }),
    [message, t],
  );

  const templateOptions = useMemo(

    () =>

      templates.map((tpl) => ({

        label: tpl.is_default

          ? `${tpl.template_name} (${t('app.kuaizhizao.deliveryProject.defaultTemplate')})`

          : tpl.template_name,

        value: tpl.id,

      })),

    [templates, t],

  );



  const columns: ProColumns<DeliveryProject>[] = alignProColumns(

    [

      {

        title: t('app.kuaizhizao.deliveryProject.fields.projectName'),

        dataIndex: 'project_name',

        key: 'project_name',

        hideInSearch: true,

        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,

        render: (_, r) => (

          <UniTableStackedPrimaryCell

            primary={r.project_name}

            secondary={r.project_code}

            secondaryCopyable

          />

        ),

      },

      {
        title: t('app.kuaizhizao.deliveryProject.fields.customerName'),
        dataIndex: 'customer_name',
        key: 'delivery_customer_sales_stacked',
        hideInSearch: true,
        ...DELIVERY_CUSTOMER_COLUMN_DEFAULTS,
        ellipsis: false,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={r.customer_name || '-'}
            secondary={r.sales_order_code || '-'}
            secondaryCopyable={Boolean(r.sales_order_code)}
          />
        ),
      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.deliveryDate'),

        dataIndex: 'delivery_date',

        key: 'delivery_project_date',

        width: 110,

        uniTableKeepWidth: true,

        render: (_, r) => formatBusinessDateOnly(r.delivery_date),

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.currentNode'),

        dataIndex: 'current_node_name',

        key: 'current_node_name',

        width: 120,

        uniTableKeepWidth: true,

        hideInSearch: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.progress'),

        dataIndex: 'progress_percent',

        key: 'progress_percent',

        search: false,

        ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,

        render: (_, r) =>
          renderDeliveryProgressCell(r.progress_percent, t, {
            status: resolveDeliveryProgressStatus(r.status, r.progress_percent),
          }),

      },

      {
        title: t('app.kuaizhizao.deliveryProject.followUp.nodeProgress'),
        dataIndex: 'nodes',
        key: 'nodes',
        search: false,
        ...DELIVERY_NODE_PROGRESS_REMAINDER_COLUMN_DEFAULTS,
        render: (_, r) => renderDeliveryNodeProgressCell(r.nodes),
      },

      ...buildDocumentAuditColumns<DeliveryProject>(t),

      {

        title: t('app.kuaizhizao.deliveryProject.fields.status'),

        dataIndex: 'status',

        key: 'lifecycle',

        fixed: 'right',

        valueType: 'select',

        valueEnum: Object.fromEntries(Object.entries(DELIVERY_PROJECT_STATUS).map(([k, v]) => [k, { text: v }])),

        render: (_, r) => renderDeliveryStatusTag(r.status, DELIVERY_PROJECT_STATUS),

      },

      {

        title: t('common.actions'),

        key: 'action',

        fixed: 'right',

        hideInSearch: true,

        render: (_, r) => {

          const parts: React.ReactNode[] = [

            <Button
              {...rowActionOpenWorkbench()}
              key="read"
              onClick={(e) => {
                e.stopPropagation();
                openWorkbench(r.id);
              }}
            />,

          ];

          if (['draft', 'paused'].includes(r.status) && perms.canUpdate) {

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

          if (r.status === 'draft' && perms.canDelete) {

            parts.push(

              <Button

                {...rowActionKind('delete')}

                key="delete"

                onClick={(e) => {

                  e.stopPropagation();

                  handleDeleteRow(r);

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



  const handleCreate = async (values: Record<string, unknown>) => {

    const deliveryDate = values.delivery_date as dayjs.Dayjs | undefined;

    await deliveryProjectApi.create({

      project_name: values.project_name as string,

      process_template_id: values.process_template_id as number,

      delivery_date: deliveryDate?.format('YYYY-MM-DD'),

      owner_id: selectedOwnerRef.current,

      members: selectedMembersRef.current,

      notes: values.notes as string | undefined,

    });

    message.success(t('common.created'));

    setCreateOpen(false);

    actionRef.current?.reload();

  };



  const handleUpdate = async (values: Record<string, unknown>) => {

    if (!editingProject) return;

    const deliveryDate = values.delivery_date as dayjs.Dayjs | undefined;

    await deliveryProjectApi.update(editingProject.id, {

      project_name: values.project_name as string,

      delivery_date: deliveryDate?.format('YYYY-MM-DD'),

      owner_id: selectedOwnerRef.current,

      members: selectedMembersRef.current,

      notes: values.notes as string | undefined,

    });

    message.success(t('common.updated'));

    setEditOpen(false);

    setEditingProject(null);

    actionRef.current?.reload();

  };



  const projectFormFields = (

    <>

      <ProFormText

        name="project_name"

        label={t('app.kuaizhizao.deliveryProject.fields.projectName')}

        rules={[{ required: true }]}

        colProps={{ span: 12 }}

      />

      <ProFormSelect

        name="process_template_id"

        label={t('app.kuaizhizao.deliveryProject.fields.processTemplate')}

        rules={[{ required: true }]}

        colProps={{ span: 12 }}

        options={templateOptions}

        disabled={editOpen}

      />

      <ProFormDatePicker

        name="delivery_date"

        label={t('app.kuaizhizao.deliveryProject.fields.deliveryDate')}

        colProps={{ span: 12 }}

        width="100%"

        fieldProps={{ style: { width: '100%' } }}

      />

      <UniUserSelect

        name="owner_uuid"

        label={t('app.kuaizhizao.deliveryProject.fields.ownerName')}

        colProps={{ span: 12 }}

        onChange={(_value, user) => {

          const picked = Array.isArray(user) ? user[0] : user;

          selectedOwnerRef.current = picked?.id;
          // 负责人变更时从成员中剔除同一人
          if (picked?.id) {
            selectedMembersRef.current = selectedMembersRef.current.filter((m) => m.user_id !== picked.id);
          }

        }}

      />

      <UniUserSelect

        name="member_uuids"

        label={t('app.kuaizhizao.deliveryProject.fields.members')}

        mode="multiple"

        colProps={{ span: 12 }}

        onChange={(_value, users) => {

          const list = (Array.isArray(users) ? users : users ? [users] : []) as User[];
          selectedMembersRef.current = list
            .filter((u) => u?.id && u.id !== selectedOwnerRef.current)
            .map((u) => ({
              user_id: u.id,
              user_name: u.full_name || u.username || '',
            }));

        }}

      />

      <ProFormTextArea

        name="notes"

        label={t('app.kuaizhizao.deliveryProject.fields.notes')}

        colProps={{ span: 24 }}

        fieldProps={{ rows: 2 }}

      />

    </>

  );



  return (

    <>

      <ListPageTemplate>

        <UniTable<DeliveryProject>

          actionRef={actionRef}

          rowKey="id"

          permissionResource={RESOURCE}

          columns={columns}

          columnPersistenceId="kuaizhizao-delivery-projects-v10"

          enableRowSelection

          selectedRowKeys={selectedRowKeys}

          onRowSelectionChange={setSelectedRowKeys}

          showCreateButton={perms.canCreate}

          onCreate={openCreate}

          createButtonText={t('app.kuaizhizao.deliveryProject.createDeliveryProject') + NEW_SHORTCUT_HINT}

          showDeleteButton={perms.canDelete}

          onDelete={handleBatchDelete}

          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.deliveryProject.batchDeleteProjectConfirm', { count })
          }

          deleteConfirmDescription={t('app.kuaizhizao.deliveryProject.deleteProjectConfirm')}

          showExportButton={perms.canExport}

          onExport={handleExport}

          onTableDataChange={(rows) => {

            tableRowsRef.current = rows;

          }}

          request={async (params) => {

            const listParams = {
              keyword: params.keyword,
              status: params.lifecycle,
            };
            lastListParamsRef.current = listParams;

            const res = await deliveryProjectApi.list({

              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),

              limit: params.pageSize ?? 20,

              ...listParams,

            });

            return { data: res.items, success: true, total: res.total };

          }}

        />

      </ListPageTemplate>



      <FormModalTemplate

        title={t('app.kuaizhizao.deliveryProject.createDeliveryProject')}

        open={createOpen}

        width={MODAL_CONFIG.STANDARD_WIDTH}

        onClose={() => setCreateOpen(false)}

        formRef={formRef}

        grid

        onFinish={handleCreate}

      >

        {projectFormFields}

      </FormModalTemplate>



      <FormModalTemplate

        title={t('app.kuaizhizao.deliveryProject.editDeliveryProject')}

        open={editOpen}

        width={MODAL_CONFIG.STANDARD_WIDTH}

        onClose={() => {

          setEditOpen(false);

          setEditingProject(null);

        }}

        formRef={formRef}

        grid

        onFinish={handleUpdate}

      >

        {projectFormFields}

      </FormModalTemplate>
    </>
  );
};



export default DeliveryProjectsPage;


