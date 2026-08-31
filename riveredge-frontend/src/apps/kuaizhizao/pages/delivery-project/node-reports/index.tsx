import React, { useCallback, useEffect, useRef, useState } from 'react';

import { App, Button, Modal } from 'antd';

import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';

import {

  ProFormDatePicker,

  ProFormDigit,

  ProFormSelect,

  ProFormTextArea,

} from '@ant-design/pro-components';

import { useTranslation } from 'react-i18next';

import dayjs from 'dayjs';

import { useSearchParams } from 'react-router-dom';

import { UniTable } from '../../../../../components/uni-table';

import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';

import { rowActionKind } from '../../../../../components/uni-action';

import { useNewShortcut } from '../../../../../hooks/useNewShortcut';

import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

import {

  deliveryNodeReportApi,

  deliveryProjectApi,

  DELIVERY_NODE_REPORT_STATUS,

  type DeliveryNodeReport,

  type DeliveryProject,

} from '../../../services/delivery-project';

import { formatBusinessDateOnly } from '../../../../../utils/format';

import { DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import { renderDeliveryProgressCell, resolveDeliveryProgressStatus } from '../shared/deliveryProgressColumn';

import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';

import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

import DeliveryNodeReportDetailDrawer from './components/DeliveryNodeReportDetailDrawer';

import { createDeliveryListExporter } from '../shared/deliveryListExport';
import { renderDeliveryStatusTag } from '../shared/deliveryListPresentation';



const RESOURCE = 'kuaizhizao:delivery-node-report';



const NodeReportsPage: React.FC = () => {

  const { t } = useTranslation();

  const { message } = App.useApp();

  const [searchParams, setSearchParams] = useSearchParams();

  const actionRef = useRef<ActionType>(null);

  const tableRowsRef = useRef<DeliveryNodeReport[]>([]);

  const lastListParamsRef = useRef<Record<string, unknown>>({});

  const formRef = useRef<ProFormInstance>();

  const perms = useResourcePermissions(RESOURCE);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingReport, setEditingReport] = useState<DeliveryNodeReport | null>(null);

  const [projects, setProjects] = useState<DeliveryProject[]>([]);

  const [selectedProject, setSelectedProject] = useState<DeliveryProject | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);

  const [detailId, setDetailId] = useState<number>();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);



  const openCreate = useCallback(async (preset?: { projectId?: number; nodeId?: number }) => {

    const res = await deliveryProjectApi.list({ limit: 100, status: 'in_progress' });

    setProjects(res.items);

    setEditingReport(null);

    formRef.current?.resetFields();

    formRef.current?.setFieldsValue({

      report_date: dayjs(),

      progress_percent: 0,

      project_id: preset?.projectId,

      node_id: preset?.nodeId,

    });

    if (preset?.projectId) {

      const project = res.items.find((item) => item.id === preset.projectId) ?? (await deliveryProjectApi.get(preset.projectId));

      setSelectedProject(project);

    } else {

      setSelectedProject(null);

    }

    setModalOpen(true);

  }, []);



  useNewShortcut(perms.canCreate ? () => void openCreate() : undefined);



  useEffect(() => {

    const action = searchParams.get('action');

    const projectId = Number(searchParams.get('project_id'));

    const nodeId = Number(searchParams.get('node_id'));

    if (action !== 'create' || !Number.isFinite(projectId) || projectId <= 0) return;

    void openCreate({ projectId, nodeId: Number.isFinite(nodeId) && nodeId > 0 ? nodeId : undefined });

    const next = new URLSearchParams(searchParams);

    next.delete('action');

    next.delete('project_id');

    next.delete('node_id');

    setSearchParams(next, { replace: true });

  }, [openCreate, searchParams, setSearchParams]);



  const openDetail = useCallback((id: number) => {

    setDetailId(id);

    setDetailOpen(true);

  }, []);



  const resolveSelectedRows = useCallback(
    (keys: React.Key[]) =>
      tableRowsRef.current.filter((row) => row.id != null && keys.includes(row.id)),
    [],
  );

  const handleDeleteRow = useCallback(
    (record: DeliveryNodeReport) => {
      Modal.confirm({
        title: t('app.kuaizhizao.deliveryProject.deleteReportConfirm'),
        onOk: async () => {
          await deliveryNodeReportApi.delete(record.id);
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
        message.warning(t('app.kuaizhizao.deliveryProject.batchDeleteEmptyDraftReport'));
        return;
      }
      try {
        for (const row of rows) {
          await deliveryNodeReportApi.delete(row.id);
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
    createDeliveryListExporter<DeliveryNodeReport>({
      filename: 'delivery-node-reports',
      columns: [
        { title: t('app.kuaizhizao.deliveryProject.fields.reportCode'), key: 'report_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.projectCode'), key: 'project_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.nodeName'), key: 'node_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.reporterName'), key: 'reporter_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.reportDate'), key: 'report_date' },
        { title: t('app.kuaizhizao.deliveryProject.fields.progress'), key: 'progress_percent' },
        { title: t('app.kuaizhizao.deliveryProject.fields.status'), key: 'status', getValue: (r) => DELIVERY_NODE_REPORT_STATUS[r.status] ?? r.status },
      ],
      fetchPage: ({ skip, limit, ...params }) =>
        deliveryNodeReportApi.list({ skip, limit, ...params }).then((res) => res),
      getListParams: () => lastListParamsRef.current,
      tableRowsRef,
      onEmpty: () => message.warning(t('common.exportNoData')),
    }),
    [message, t],
  );

  const openEdit = useCallback(async (report: DeliveryNodeReport) => {

    const project = await deliveryProjectApi.get(report.project_id);

    setProjects([project]);

    setSelectedProject(project);

    setEditingReport(report);

    formRef.current?.resetFields();

    formRef.current?.setFieldsValue({

      project_id: report.project_id,

      node_id: report.node_id,

      report_date: dayjs(report.report_date),

      progress_percent: Number(report.progress_percent ?? 0),

      content: report.content,

    });

    setModalOpen(true);

  }, []);



  const columns: ProColumns<DeliveryNodeReport>[] = alignProColumns(

    [

      {

        title: t('app.kuaizhizao.deliveryProject.fields.reportCode'),

        dataIndex: 'report_code',

        key: 'report_code',

        width: 140,

        uniTableKeepWidth: true,

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

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.reporterName'),

        dataIndex: 'reporter_name',

        key: 'reporter_name',

        width: 100,

        uniTableKeepWidth: true,

        hideInSearch: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.reportDate'),

        dataIndex: 'report_date',

        key: 'report_date',

        width: 110,

        uniTableKeepWidth: true,

        render: (_, r) => formatBusinessDateOnly(r.report_date),

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

        title: t('app.kuaizhizao.deliveryProject.fields.reportContent'),

        dataIndex: 'content',

        key: 'content',

        minWidth: 160,

        uniTableRemainderFlex: true,

        uniTablePrimaryFlex: true,

        ellipsis: true,

        hideInSearch: true,

      },

      ...buildDocumentAuditColumns<DeliveryNodeReport>(t),

      {

        title: t('app.kuaizhizao.deliveryProject.fields.status'),

        dataIndex: 'status',

        key: 'lifecycle',

        fixed: 'right',

        valueType: 'select',

        valueEnum: Object.fromEntries(

          Object.entries(DELIVERY_NODE_REPORT_STATUS).map(([k, v]) => [k, { text: v }]),

        ),

        render: (_, r) => renderDeliveryStatusTag(r.status, DELIVERY_NODE_REPORT_STATUS),

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

          if (r.status === 'draft' && perms.canUpdate) {

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



  const handleSave = async (values: Record<string, unknown>) => {
    const reportDate = values.report_date as dayjs.Dayjs;
    if (editingReport) {
      await deliveryNodeReportApi.update(editingReport.id, {
        report_date: reportDate.format('YYYY-MM-DD'),
        progress_percent: values.progress_percent as number,
        content: values.content as string | undefined,
      });
      message.success(t('common.updated'));
    } else {
      await deliveryNodeReportApi.create({
        project_id: values.project_id as number,
        node_id: values.node_id as number,
        report_date: reportDate.format('YYYY-MM-DD'),
        progress_percent: values.progress_percent as number,
        content: values.content as string | undefined,
      });
      message.success(t('common.created'));
    }
    setModalOpen(false);

    setEditingReport(null);

    actionRef.current?.reload();

  };



  return (

    <>

      <ListPageTemplate>

        <UniTable<DeliveryNodeReport>

          actionRef={actionRef}

          rowKey="id"

          permissionResource={RESOURCE}

          columns={columns}

          columnPersistenceId="kuaizhizao-delivery-node-reports-v5"

          enableRowSelection

          selectedRowKeys={selectedRowKeys}

          onRowSelectionChange={setSelectedRowKeys}

          showCreateButton={perms.canCreate}

          onCreate={() => void openCreate()}

          createButtonText={t('app.kuaizhizao.deliveryProject.createReport') + NEW_SHORTCUT_HINT}

          showDeleteButton={perms.canDelete}

          onDelete={handleBatchDelete}

          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.deliveryProject.batchDeleteReportConfirm', { count })
          }

          deleteConfirmDescription={t('app.kuaizhizao.deliveryProject.deleteReportConfirm')}

          showExportButton={perms.canExport}

          onExport={handleExport}

          onTableDataChange={(rows) => {

            tableRowsRef.current = rows;

          }}

          request={async (params) => {

            const listParams = {
              status: params.lifecycle as string | undefined,
            };
            lastListParamsRef.current = listParams;

            const res = await deliveryNodeReportApi.list({

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

          editingReport

            ? t('app.kuaizhizao.deliveryProject.editReport')

            : t('app.kuaizhizao.deliveryProject.createReport')

        }

        open={modalOpen}

        width={MODAL_CONFIG.STANDARD_WIDTH}

        onClose={() => {

          setModalOpen(false);

          setEditingReport(null);

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

          options={projects.map((p) => ({ label: `${p.project_code} ${p.project_name}`, value: p.id }))}

          disabled={Boolean(editingReport)}

          fieldProps={{

            onChange: async (id: number) => {

              const p = await deliveryProjectApi.get(id);

              setSelectedProject(p);

              formRef.current?.setFieldValue('node_id', undefined);

            },

          }}

        />

        <ProFormSelect

          name="node_id"

          label={t('app.kuaizhizao.deliveryProject.fields.nodeName')}

          rules={[{ required: true }]}

          colProps={{ span: 24 }}

          disabled={Boolean(editingReport)}

          options={(selectedProject?.nodes ?? []).map((n) => ({ label: n.node_name, value: n.id }))}

        />

        <ProFormDatePicker

          name="report_date"

          label={t('app.kuaizhizao.deliveryProject.fields.reportDate')}

          rules={[{ required: true }]}

          colProps={{ span: 12 }}

          width="100%"

          fieldProps={{ style: { width: '100%' } }}

        />

        <ProFormDigit

          name="progress_percent"

          label={t('app.kuaizhizao.deliveryProject.fields.progress')}

          rules={[{ required: true }]}

          colProps={{ span: 12 }}

          min={0}

          max={100}

          fieldProps={{ style: { width: '100%' }, addonAfter: '%' }}

        />

        <ProFormTextArea

          name="content"

          label={t('app.kuaizhizao.deliveryProject.fields.reportContent')}

          colProps={{ span: 24 }}

          fieldProps={{ rows: 3 }}

        />

      </FormModalTemplate>



      <DeliveryNodeReportDetailDrawer

        open={detailOpen}

        reportId={detailId}

        onClose={() => setDetailOpen(false)}

        canUpdate={perms.canUpdate}

        canDelete={perms.canDelete}

        canApprove={perms.canAction?.('approve') ?? false}

        onEdit={(report) => void openEdit(report)}

        onChanged={() => actionRef.current?.reload()}

      />

    </>

  );

};



export default NodeReportsPage;


