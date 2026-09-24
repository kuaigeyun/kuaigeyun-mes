/**
 * 开模合同 / 打样订单列表（R-15 #71）
 * 文员上传 → 审批 → 用印 → 存档。菜单待 DoD 后挂入。
 * 路由 /apps/kuaiplm/mold-sample-orders
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormUploadDragger,
} from '@ant-design/pro-components';
import { App, Button, Descriptions, Result } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
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
import { todaySiteDateString } from '../../../../utils/format';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../constants/statusBadges';
import { uploadMultipleFiles } from '../../../../services/file';
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
  moldSampleOrderApi,
  type MoldSampleDocKind,
  type MoldSampleOrder,
  type MoldSampleStatus,
} from '../../services/mold-sample-order';

const RESOURCE = 'kuaiplm:mold-sample';
const FILE_CATEGORY = 'mold_sample_order';
const STATUS_KEYS: MoldSampleStatus[] = [
  'draft',
  'pending',
  'approved',
  'sealed',
  'archived',
  'rejected',
];
const KIND_KEYS: MoldSampleDocKind[] = ['mold_contract', 'sample_order'];

const MOLD_SAMPLE_EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'order_code', title: '单据编号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'project_name', title: '项目名称' },
  { key: 'doc_kind_label', title: '单据类型' },
  { key: 'title', title: '标题' },
  { key: 'contract_no', title: '合同号' },
  { key: 'party_name', title: '对方单位' },
  { key: 'file_name', title: '附件' },
  { key: 'status_label', title: '状态' },
  { key: 'remarks', title: '备注' },
  { key: 'sealed_by_name', title: '用印人' },
  { key: 'archived_by_name', title: '存档人' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const MoldSampleOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<MoldSampleOrder[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MoldSampleOrder | null>(null);
  const [detail, setDetail] = useState<MoldSampleOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const reload = useCallback(() => actionRef.current?.reload(), []);
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.moldSample.status.${s}`, { defaultValue: s }),
    [t],
  );
  const kindLabel = useCallback(
    (s: string) => t(`app.kuaiplm.moldSample.kind.${s}`, { defaultValue: s }),
    [t],
  );

  const openDetail = useCallback(async (row: MoldSampleOrder) => {
    if (!row.id) return;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      const full = await moldSampleOrderApi.get(row.id);
      setDetail(full);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const columns = useMemo<ProColumns<MoldSampleOrder>[]>(() => {
    const cols: ProColumns<MoldSampleOrder>[] = [
      {
        title: t('app.kuaiplm.moldSample.fields.code'),
        dataIndex: 'order_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.moldSample.fields.project'),
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
        title: t('app.kuaiplm.moldSample.fields.docKind'),
        dataIndex: 'doc_kind',
        key: 'document_type',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        valueEnum: Object.fromEntries(KIND_KEYS.map((k) => [k, { text: kindLabel(k) }])),
        render: (_, r) => <MarkerTag>{kindLabel(r.doc_kind)}</MarkerTag>,
      },
      {
        title: t('app.kuaiplm.moldSample.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.moldSample.fields.contractNo'),
        dataIndex: 'contract_no',
        key: 'contract_no',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        uniTableKeepWidth: true,
        render: (_, r) => r.contract_no || '—',
      },
      {
        title: t('app.kuaiplm.moldSample.fields.party'),
        dataIndex: 'party_name',
        key: 'customer_name',
        width: 140,
        ellipsis: true,
        uniTableKeepWidth: true,
        render: (_, r) => r.party_name || '—',
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
                    await moldSampleOrderApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.moldSample.messages.submitSuccess'));
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
                    await moldSampleOrderApi.approve(row.id);
                    messageApi.success(t('app.kuaiplm.moldSample.messages.approveSuccess'));
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
                    await moldSampleOrderApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.moldSample.messages.rejectSuccess'));
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
                key="seal"
                type="link"
                size="small"
                {...rowActionKind('execute')}
                onClick={async () => {
                  try {
                    await moldSampleOrderApi.seal(row.id);
                    messageApi.success(t('app.kuaiplm.moldSample.messages.sealSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                {t('app.kuaiplm.moldSample.actions.seal')}
              </Button>,
            );
          }
          if (row.status === 'sealed' && perms.canAction?.('complete') && row.id) {
            actions.push(
              <Button
                key="archive"
                type="link"
                size="small"
                {...rowActionKind('complete')}
                onClick={async () => {
                  try {
                    await moldSampleOrderApi.archive(row.id);
                    messageApi.success(t('app.kuaiplm.moldSample.messages.archiveSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                {t('app.kuaiplm.moldSample.actions.archive')}
              </Button>,
            );
          }
          return actions;
        },
      },
    ];
    return cols;
  }, [t, statusLabel, kindLabel, openDetail, perms, messageApi, reload]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<MoldSampleOrder>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.moldSample.fields.code'),
        dataIndex: 'order_code',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.moldSample.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        key: 'document_type',
        title: t('app.kuaiplm.moldSample.fields.docKind'),
        dataIndex: 'doc_kind',
        render: (_, r) => <MarkerTag>{kindLabel(r.doc_kind)}</MarkerTag>,
      },
      {
        key: 'title',
        title: t('app.kuaiplm.moldSample.fields.title'),
        dataIndex: 'title',
      },
      {
        key: 'contract_no',
        title: t('app.kuaiplm.moldSample.fields.contractNo'),
        dataIndex: 'contract_no',
      },
      {
        key: 'customer_name',
        title: t('app.kuaiplm.moldSample.fields.party'),
        dataIndex: 'party_name',
      },
      {
        key: 'lifecycle',
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        key: 'file_name',
        title: t('app.kuaiplm.moldSample.fields.file'),
        dataIndex: 'file_name',
        render: (_, r) => r.file_name || r.file_uuid || '—',
      },
      {
        key: 'sealed_by_name',
        title: t('app.kuaiplm.moldSample.fields.sealedBy'),
        dataIndex: 'sealed_by_name',
        render: (_, r) => r.sealed_by_name || '—',
      },
      {
        key: 'archived_by_name',
        title: t('app.kuaiplm.moldSample.fields.archivedBy'),
        dataIndex: 'archived_by_name',
        render: (_, r) => r.archived_by_name || '—',
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
  }, [t, statusLabel, kindLabel]);

  return (
    <ListPageTemplate>
      <UniTable<MoldSampleOrder>
        headerTitle={t('app.kuaiplm.moldSample.title')}
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
        columnPersistenceId="apps.kuaiplm.pages.mold-sample-orders.width-v3"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaiplm.moldSample.createButton') + NEW_SHORTCUT_HINT}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
          const deletable = rows.filter(
            (r) => (r.status === 'draft' || r.status === 'rejected') && r.id,
          );
          if (!deletable.length) {
            messageApi.warning(t('app.kuaiplm.moldSample.messages.deleteOnlyDraft'));
            return;
          }
          await Promise.all(deletable.map((r) => moldSampleOrderApi.remove(r.id)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async (type, keys, pageData) => {
          try {
            let items =
              type === 'currentPage' && pageData?.length
                ? (pageData as MoldSampleOrder[])
                : await fetchAllListItems((p) =>
                    moldSampleOrderApi.list({
                      ...p,
                      project_id: filterProjectId,
                    }),
                  );
            if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaiplm.moldSample.messages.noExportData'));
              return;
            }
            const rows = items.map((r) => ({
              ...r,
              status_label: statusLabel(r.status),
              doc_kind_label: kindLabel(r.doc_kind),
            }));
            await downloadRecordsAsXlsx(
              rows as Array<Record<string, unknown>>,
              `mold-sample-orders-${todaySiteDateString()}.xlsx`,
              { columns: MOLD_SAMPLE_EXPORT_COLUMNS, sheetName: '开模打样' },
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (err) {
            messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
          }
        }}
        request={async (params) => {
          const res = await moldSampleOrderApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: params.status as string | undefined,
            doc_kind: params.doc_kind as string | undefined,
            keyword: (params.keyword || params.title) as string | undefined,
            project_id: filterProjectId,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={editing ? t('common.edit') : t('common.create')}
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
                doc_kind: editing.doc_kind,
                title: editing.title,
                contract_no: editing.contract_no,
                party_name: editing.party_name,
                file_uuid: editing.file_uuid,
                file_name: editing.file_name,
                file_upload: editing.file_uuid
                  ? [
                      {
                        uid: editing.file_uuid,
                        name: editing.file_name || editing.file_uuid,
                        status: 'done',
                        response: {
                          uuid: editing.file_uuid,
                          original_name: editing.file_name || editing.file_uuid,
                        },
                      },
                    ]
                  : [],
                remarks: editing.remarks,
              }
            : filterProjectId
              ? { project_id: filterProjectId, doc_kind: 'mold_contract', file_upload: [] }
              : { doc_kind: 'mold_contract', file_upload: [] }
        }
        onFinish={async (values) => {
          try {
            const uploadList = Array.isArray(values.file_upload) ? values.file_upload : [];
            const done = uploadList.find(
              (f: { status?: string }) => f.status === 'done' || !f.status,
            );
            const response = done?.response;
            const fileUuid =
              (typeof response === 'object' && response?.uuid) ||
              done?.uid ||
              values.file_uuid ||
              null;
            const fileName =
              (typeof response === 'object' && (response.original_name || response.name)) ||
              done?.name ||
              values.file_name ||
              null;
            const payload = {
              project_id: Number(values.project_id),
              doc_kind: values.doc_kind as MoldSampleDocKind,
              title: String(values.title || '').trim(),
              contract_no: values.contract_no || null,
              party_name: values.party_name || null,
              file_uuid: fileUuid,
              file_name: fileName,
              remarks: values.remarks || null,
            };
            if (editing?.id) {
              await moldSampleOrderApi.update(editing.id, {
                doc_kind: payload.doc_kind,
                title: payload.title,
                contract_no: payload.contract_no,
                party_name: payload.party_name,
                file_uuid: payload.file_uuid,
                file_name: payload.file_name,
                remarks: payload.remarks,
              });
            } else {
              await moldSampleOrderApi.create(payload);
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
          label={t('app.kuaiplm.moldSample.fields.project')}
          rules={[{ required: true }]}
          disabled={!!editing}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="doc_kind"
          label={t('app.kuaiplm.moldSample.fields.docKind')}
          rules={[{ required: true }]}
          options={KIND_KEYS.map((k) => ({ value: k, label: kindLabel(k) }))}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="title"
          label={t('app.kuaiplm.moldSample.fields.title')}
          rules={[{ required: true }]}
          colProps={{ span: 24 }}
        />
        <ProFormText
          name="contract_no"
          label={t('app.kuaiplm.moldSample.fields.contractNo')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="party_name"
          label={t('app.kuaiplm.moldSample.fields.party')}
          colProps={{ span: 12 }}
        />
        <ProFormUploadDragger
          name="file_upload"
          label={t('app.kuaiplm.moldSample.fields.file')}
          max={1}
          colProps={{ span: 24 }}
          icon={<InboxOutlined />}
          title={t('app.kuaiplm.moldSample.fields.fileUploadHint')}
          description={t('app.kuaiplm.moldSample.fields.fileUploadSubHint')}
          fieldProps={{
            multiple: false,
            maxCount: 1,
            style: { width: '100%' },
            customRequest: async (options) => {
              try {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: FILE_CATEGORY,
                });
                options.onSuccess?.(res[0], options.file as any);
              } catch (err) {
                options.onError?.(err as Error);
              }
            },
          }}
        />
        <ProFormTextArea name="remarks" label={t('common.remark')} colProps={{ span: 24 }} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.order_code || t('app.kuaiplm.moldSample.title')}
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

export default MoldSampleOrdersPage;
