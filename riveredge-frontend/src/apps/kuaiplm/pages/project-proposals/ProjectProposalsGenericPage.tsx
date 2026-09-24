/**
 * 项目建议书列表（R-15 #68）— 通用中性壳
 * 销售发起 → 采购填供应商 → 审批 → 下发研发
 * 客户纸质模板 UI 见定制应用 funide-oa/project-proposals
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormDatePicker,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Descriptions, Result } from 'antd';
import { UniTable } from '../../../../components/uni-table';
import { rowActionKind } from '../../../../components/uni-action';
import {
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  detailDrawerBasicColumn,
} from '../../../../components/layout-templates';
import { detailDrawerDescriptionItems } from '../../../../components/layout-templates/detailDrawerDescriptionItems';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { formatDateBySiteSetting, todaySiteDateString } from '../../../../utils/format';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import Phase2ProjectSelect from '../../components/Phase2ProjectSelect';
import {
  projectProposalApi,
  type ProjectProposal,
  type ProjectProposalStatus,
} from '../../services/project-proposal';

const RESOURCE = 'kuaiplm:project-proposal';
const STATUS_KEYS: ProjectProposalStatus[] = [
  'draft',
  'pending',
  'approved',
  'issued',
  'rejected',
];

const PROJECT_PROPOSAL_EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'proposal_code', title: '建议书编号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'project_name', title: '项目名称' },
  { key: 'title', title: '标题' },
  { key: 'customer_name', title: '客户' },
  { key: 'supplier_name', title: '供应商' },
  { key: 'expected_date', title: '期望日期' },
  { key: 'status_label', title: '状态' },
  { key: 'summary', title: '摘要' },
  { key: 'remarks', title: '备注' },
  { key: 'issued_by_name', title: '下发人' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const ProjectProposalsGenericPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<ProjectProposal[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const supplierFormRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectProposal | null>(null);
  const [supplierRow, setSupplierRow] = useState<ProjectProposal | null>(null);
  const [detail, setDetail] = useState<ProjectProposal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const reload = useCallback(() => actionRef.current?.reload(), []);
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.projectProposal.status.${s}`, { defaultValue: s }),
    [t],
  );

  const openDetail = useCallback(async (row: ProjectProposal) => {
    if (!row.id) return;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      const full = await projectProposalApi.get(row.id);
      setDetail(full);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const columns = useMemo<ProColumns<ProjectProposal>[]>(() => {
    const cols: ProColumns<ProjectProposal>[] = [
      {
        title: t('app.kuaiplm.projectProposal.fields.code'),
        dataIndex: 'proposal_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.projectProposal.fields.project'),
        dataIndex: 'project_name',
        key: 'project_name',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        title: t('app.kuaiplm.projectProposal.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.projectProposal.fields.customer'),
        dataIndex: 'customer_name',
        key: 'customer_name',
        width: 140,
        ellipsis: true,
        uniTableKeepWidth: true,
      },
      {
        title: t('app.kuaiplm.projectProposal.fields.supplier'),
        dataIndex: 'supplier_name',
        key: 'supplier_name',
        width: 140,
        ellipsis: true,
        uniTableKeepWidth: true,
        render: (_, r) => r.supplier_name || '—',
      },
      {
        title: t('app.kuaiplm.projectProposal.fields.expectedDate'),
        dataIndex: 'expected_date',
        key: 'business_date',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, r) => formatDateBySiteSetting(r.expected_date) || '—',
      },
      {
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        title: t('common.status'),
        dataIndex: 'status',
        key: 'lifecycle',
        fixed: 'right',
        valueEnum: Object.fromEntries(STATUS_KEYS.map((k) => [k, { text: statusLabel(k) }])),
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      ...buildDocumentAuditColumns(t),
      {
        title: t('common.action'),
        valueType: 'option',
        key: 'option',
        fixed: 'right',
        render: (_, row) => {
          const actions: React.ReactNode[] = [
            <Button
              key="detail"
              type="link"
              size="small"
              {...rowActionKind('read')}
              onClick={() => void openDetail(row)}
            />,
          ];
          if ((row.status === 'draft' || row.status === 'rejected') && perms.canUpdate) {
            actions.push(
              <Button
                key="edit"
                type="link"
                size="small"
                {...rowActionKind('update')}
                onClick={() => {
                  setEditing(row);
                  setModalOpen(true);
                }}
              />,
            );
            actions.push(
              <Button
                key="supplier"
                type="link"
                size="small"
                {...rowActionKind('update')}
                onClick={() => {
                  setSupplierRow(row);
                  setSupplierModalOpen(true);
                }}
              >
                {t('app.kuaiplm.projectProposal.actions.fillSupplier')}
              </Button>,
            );
          }
          if (
            (row.status === 'draft' || row.status === 'rejected') &&
            perms.canAction?.('submit') &&
            row.id
          ) {
            actions.push(
              <Button
                key="submit"
                type="link"
                size="small"
                {...rowActionKind('submit')}
                onClick={async () => {
                  try {
                    await projectProposalApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.projectProposal.messages.submitSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('approve') && row.id) {
            actions.push(
              <Button
                key="approve"
                type="link"
                size="small"
                {...rowActionKind('approve')}
                onClick={async () => {
                  try {
                    await projectProposalApi.approve(row.id);
                    messageApi.success(t('app.kuaiplm.projectProposal.messages.approveSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('reject') && row.id) {
            actions.push(
              <Button
                key="reject"
                type="link"
                size="small"
                {...rowActionKind('reject')}
                onClick={async () => {
                  try {
                    await projectProposalApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.projectProposal.messages.rejectSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'approved' && perms.canAction?.('execute') && row.id) {
            actions.push(
              <Button
                key="issue"
                type="link"
                size="small"
                {...rowActionKind('execute')}
                onClick={async () => {
                  try {
                    await projectProposalApi.issue(row.id);
                    messageApi.success(t('app.kuaiplm.projectProposal.messages.issueSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                {t('app.kuaiplm.projectProposal.actions.issue')}
              </Button>,
            );
          }
          return actions;
        },
      },
    ];
    return cols;
  }, [t, statusLabel, openDetail, perms, messageApi, reload]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<ProjectProposal>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.projectProposal.fields.code'),
        dataIndex: 'proposal_code',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.projectProposal.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        key: 'title',
        title: t('app.kuaiplm.projectProposal.fields.title'),
        dataIndex: 'title',
      },
      {
        key: 'customer_name',
        title: t('app.kuaiplm.projectProposal.fields.customer'),
        dataIndex: 'customer_name',
      },
      {
        key: 'business_date',
        title: t('app.kuaiplm.projectProposal.fields.expectedDate'),
        dataIndex: 'expected_date',
        render: (_, r) => formatDateBySiteSetting(r.expected_date) || '—',
      },
      {
        key: 'supplier_name',
        title: t('app.kuaiplm.projectProposal.fields.supplier'),
        dataIndex: 'supplier_name',
        render: (_, r) => {
          if (!r.supplier_name) return '—';
          const code = r.supplier_code ? ` (${r.supplier_code})` : '';
          return `${r.supplier_name}${code}`;
        },
      },
      {
        key: 'supplier_contact',
        title: t('app.kuaiplm.projectProposal.fields.supplierContact'),
        dataIndex: 'supplier_contact',
      },
      {
        key: 'lifecycle',
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        key: 'summary',
        title: t('app.kuaiplm.projectProposal.fields.summary'),
        dataIndex: 'summary',
      },
      {
        key: 'issued_by_name',
        title: t('app.kuaiplm.projectProposal.fields.issuedBy'),
        dataIndex: 'issued_by_name',
        render: (_, r) => r.issued_by_name || '—',
      },
      {
        key: 'updated_at',
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
      },
    ];
    return alignDescriptionColumns(
      cols as ProDescriptionsItemProps<Record<string, unknown>>[],
      GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
    );
  }, [t, statusLabel]);

  return (
    <ListPageTemplate>
      <UniTable<ProjectProposal>
        headerTitle={t('app.kuaiplm.projectProposal.title')}
        actionRef={actionRef}
        rowKey="uuid"
        permissionResource={RESOURCE}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.project-proposals.width-v4-neutral"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaiplm.projectProposal.createButton') + NEW_SHORTCUT_HINT}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
          const deletable = rows.filter(
            (r) => (r.status === 'draft' || r.status === 'rejected') && r.id,
          );
          if (!deletable.length) {
            messageApi.warning(t('app.kuaiplm.projectProposal.messages.deleteOnlyDraft'));
            return;
          }
          await Promise.all(deletable.map((r) => projectProposalApi.remove(r.id)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async (type, keys, pageData) => {
          try {
            let items =
              type === 'currentPage' && pageData?.length
                ? (pageData as ProjectProposal[])
                : await fetchAllListItems((p) =>
                    projectProposalApi.list({
                      ...p,
                      project_id: filterProjectId,
                    }),
                  );
            if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaiplm.projectProposal.messages.noExportData'));
              return;
            }
            const rows = items.map((r) => ({
              ...r,
              status_label: statusLabel(r.status),
              expected_date: formatDateBySiteSetting(r.expected_date) || '',
            }));
            await downloadRecordsAsXlsx(
              rows as Array<Record<string, unknown>>,
              `project-proposals-${todaySiteDateString()}.xlsx`,
              { columns: PROJECT_PROPOSAL_EXPORT_COLUMNS, sheetName: '项目建议' },
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (err) {
            messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
          }
        }}
        request={async (params) => {
          const res = await projectProposalApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: params.status as string | undefined,
            keyword: (params.keyword || params.title) as string | undefined,
            project_id: filterProjectId,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={
          editing
            ? t('common.edit') + t('app.kuaiplm.projectProposal.title')
            : t('app.kuaiplm.projectProposal.createButton')
        }
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        formRef={formRef}
        grid
        initialValues={
          editing
            ? {
                project_id: editing.project_id,
                title: editing.title,
                summary: editing.summary,
                customer_name: editing.customer_name,
                expected_date: editing.expected_date,
                remarks: editing.remarks,
              }
            : filterProjectId
              ? { project_id: filterProjectId }
              : {}
        }
        onFinish={async (values) => {
          try {
            const payload = {
              project_id: Number(values.project_id),
              title: String(values.title || '').trim(),
              summary: values.summary || null,
              customer_name: values.customer_name || null,
              expected_date: values.expected_date || null,
              remarks: values.remarks || null,
            };
            if (editing?.id) {
              await projectProposalApi.update(editing.id, payload);
            } else {
              await projectProposalApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            setEditing(null);
            reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            throw e;
          }
        }}
      >
        <Phase2ProjectSelect
          name="project_id"
          label={t('app.kuaiplm.projectProposal.fields.project')}
          rules={[{ required: true }]}
          disabled={!!editing}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="expected_date"
          label={t('app.kuaiplm.projectProposal.fields.expectedDate')}
          colProps={{ span: 12 }}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormText
          name="title"
          label={t('app.kuaiplm.projectProposal.fields.title')}
          rules={[{ required: true }]}
          colProps={{ span: 24 }}
        />
        <ProFormText
          name="customer_name"
          label={t('app.kuaiplm.projectProposal.fields.customer')}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="summary"
          label={t('app.kuaiplm.projectProposal.fields.summary')}
          colProps={{ span: 24 }}
        />
        <ProFormTextArea name="remarks" label={t('common.remark')} colProps={{ span: 24 }} />
      </FormModalTemplate>

      <FormModalTemplate
        key={supplierRow?.uuid ?? 'supplier'}
        title={t('app.kuaiplm.projectProposal.actions.fillSupplier')}
        open={supplierModalOpen}
        onClose={() => {
          setSupplierModalOpen(false);
          setSupplierRow(null);
        }}
        formRef={supplierFormRef}
        grid
        initialValues={
          supplierRow
            ? {
                supplier_code: supplierRow.supplier_code,
                supplier_name: supplierRow.supplier_name,
                supplier_contact: supplierRow.supplier_contact,
                supplier_remark: supplierRow.supplier_remark,
              }
            : {}
        }
        onFinish={async (values) => {
          if (!supplierRow?.id) return;
          try {
            await projectProposalApi.fillSupplier(supplierRow.id, {
              supplier_code: values.supplier_code || null,
              supplier_name: String(values.supplier_name || '').trim(),
              supplier_contact: values.supplier_contact || null,
              supplier_remark: values.supplier_remark || null,
            });
            messageApi.success(t('app.kuaiplm.projectProposal.messages.supplierSuccess'));
            setSupplierModalOpen(false);
            setSupplierRow(null);
            reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            throw e;
          }
        }}
      >
        <ProFormText
          name="supplier_name"
          label={t('app.kuaiplm.projectProposal.fields.supplier')}
          rules={[{ required: true }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="supplier_code"
          label={t('app.kuaiplm.projectProposal.fields.supplierCode')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="supplier_contact"
          label={t('app.kuaiplm.projectProposal.fields.supplierContact')}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="supplier_remark"
          label={t('app.kuaiplm.projectProposal.fields.supplierRemark')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.proposal_code || t('app.kuaiplm.projectProposal.title')}
        loading={detailLoading}
        plainBody={
          detailError ? (
            <Result
              status="error"
              title={t('common.loadFailed')}
              subTitle={detailError}
              extra={
                detail?.id ? (
                  <Button type="primary" onClick={() => void openDetail(detail)}>
                    {t('common.retry')}
                  </Button>
                ) : null
              }
            />
          ) : undefined
        }
        basic={
          detail && !detailError ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={detailDrawerDescriptionItems(basicColumns, detail)}
            />
          ) : detailError ? null : (
            <div style={{ minHeight: 80 }} />
          )
        }
      />
    </ListPageTemplate>
  );
};

export default ProjectProposalsGenericPage;
