/**
 * 样品加工申请列表（R-15 #33）
 * 菜单待 DoD 后挂入；路由可直接访问 /apps/kuaiplm/sample-process-applications
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormDatePicker,
  ProFormDependency,
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
import { formatDateBySiteSetting, todaySiteDateString } from '../../../../utils/format';
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
import { isIndustryFormProfileActive } from '../../../../utils/industryFormProfile';
import {
  isFieldRequiredForKind,
  validationMessageForKind,
} from '../../utils/sampleProcessFormProfile';
import {
  sampleProcessApi,
  type SampleProcessApplication,
  type SampleProcessAttachment,
  type SampleProcessFormProfile,
  type SampleProcessStatus,
} from '../../services/sample-process';

const RESOURCE = 'kuaiplm:sample-process';

const SAMPLE_PROCESS_EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'application_code', title: '申请单号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'project_name', title: '项目名称' },
  { key: 'request_kind_label', title: '申请种类' },
  { key: 'title', title: '标题' },
  { key: 'material_code', title: '物料编码' },
  { key: 'material_version', title: '物料版本' },
  { key: 'release_date', title: '资料发布日期' },
  { key: 'status_label', title: '状态' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];
const FILE_CATEGORY = 'sample_process';
const STATUS_KEYS: SampleProcessStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'closed',
];

type UploadFileLike = {
  uid?: string;
  name?: string;
  status?: string;
  response?: { uuid?: string; original_name?: string; name?: string };
};

function attachmentsFromUpload(
  uploadList: UploadFileLike[],
  attachmentType: string,
): SampleProcessAttachment[] {
  return uploadList
    .filter((f) => f.status === 'done' || !f.status)
    .map((f) => {
      const response = f.response;
      const fileUuid =
        (typeof response === 'object' && response?.uuid) || f.uid || '';
      const fileName =
        (typeof response === 'object' && (response.original_name || response.name)) ||
        f.name ||
        null;
      return {
        attachment_type: attachmentType || 'other',
        file_uuid: String(fileUuid),
        file_name: fileName,
      };
    })
    .filter((a) => a.file_uuid);
}

function activeProfileItems(profile: SampleProcessFormProfile | null, key: 'request_kinds' | 'attachment_types') {
  const items = profile?.[key] || [];
  return items
    .filter((x) => x && x.active !== false && x.code)
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

function genericSampleProfileItems(
  t: (key: string) => string,
  key: 'request_kinds' | 'attachment_types',
) {
  if (key === 'request_kinds') {
    return [{ code: 'general', label: t('app.kuaiplm.sampleProcess.kind.general'), sort: 10, active: true }];
  }
  return [{ code: 'other', label: t('app.kuaiplm.sampleProcess.attachmentType.other'), sort: 10, active: true }];
}

const SampleProcessApplicationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<SampleProcessApplication[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SampleProcessApplication | null>(null);
  const [detail, setDetail] = useState<SampleProcessApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [formProfile, setFormProfile] = useState<SampleProcessFormProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void sampleProcessApi
      .formProfile()
      .then((p) => {
        if (!cancelled) setFormProfile(p);
      })
      .catch((e) => {
        if (!cancelled) messageApi.error(getApiErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  const industryProfileActive = isIndustryFormProfileActive(formProfile);
  const kindOptions = useMemo(
    () =>
      industryProfileActive
        ? activeProfileItems(formProfile, 'request_kinds')
        : genericSampleProfileItems(t, 'request_kinds'),
    [formProfile, industryProfileActive, t],
  );
  const attachmentOptions = useMemo(
    () =>
      industryProfileActive
        ? activeProfileItems(formProfile, 'attachment_types')
        : genericSampleProfileItems(t, 'attachment_types'),
    [formProfile, industryProfileActive, t],
  );
  const materialCodeLabel =
    (industryProfileActive && formProfile?.field_labels?.material_code) ||
    t('app.kuaiplm.sampleProcess.fields.materialCode');
  const materialVersionLabel =
    (industryProfileActive && formProfile?.field_labels?.material_version) ||
    t('app.kuaiplm.sampleProcess.fields.materialVersion');
  const defaultKind = kindOptions[0]?.code || 'general';
  const defaultAttachment = attachmentOptions[0]?.code || 'other';

  const reload = useCallback(() => actionRef.current?.reload(), []);
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.sampleProcess.status.${s}`, { defaultValue: s }),
    [t],
  );
  const kindLabel = useCallback(
    (s: string) => {
      const hit = kindOptions.find((x) => x.code === s);
      if (hit?.label) return hit.label;
      return t(`app.kuaiplm.sampleProcess.kind.${s}`, { defaultValue: s });
    },
    [t, kindOptions],
  );
  const attachmentTypeLabel = useCallback(
    (s: string) => {
      const hit = attachmentOptions.find((x) => x.code === s);
      if (hit?.label) return hit.label;
      return t(`app.kuaiplm.sampleProcess.attachmentType.${s}`, { defaultValue: s });
    },
    [t, attachmentOptions],
  );

  const openDetail = useCallback(async (row: SampleProcessApplication) => {
    if (!row.id) return;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      const full = await sampleProcessApi.get(row.id);
      setDetail(full);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const columns = useMemo<ProColumns<SampleProcessApplication>[]>(() => {
    const cols: ProColumns<SampleProcessApplication>[] = [
      {
        title: t('app.kuaiplm.sampleProcess.fields.code'),
        dataIndex: 'application_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.sampleProcess.fields.project'),
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
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        title: t('app.kuaiplm.sampleProcess.fields.requestKind'),
        dataIndex: 'request_kind',
        key: 'document_type',
        valueEnum: Object.fromEntries(kindOptions.map((k) => [k.code, { text: k.label }])),
        render: (_, r) => <MarkerTag>{kindLabel(r.request_kind)}</MarkerTag>,
      },
      {
        title: t('app.kuaiplm.sampleProcess.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        title: materialCodeLabel,
        dataIndex: 'material_code',
        key: 'material_code',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.sampleProcess.fields.releaseDate'),
        dataIndex: 'release_date',
        key: 'business_date',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, r) => formatDateBySiteSetting(r.release_date) || '—',
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
                    await sampleProcessApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.sampleProcess.messages.submitSuccess'));
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
                    await sampleProcessApi.approve(row.id);
                    messageApi.success(t('app.kuaiplm.sampleProcess.messages.approveSuccess'));
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
                    await sampleProcessApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.sampleProcess.messages.rejectSuccess'));
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
                key="close"
                type="link"
                size="small"
                {...rowActionKind('execute')}
                onClick={async () => {
                  try {
                    await sampleProcessApi.close(row.id);
                    messageApi.success(t('app.kuaiplm.sampleProcess.messages.closeSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          return actions;
        },
      },
    ];
    return cols;
  }, [t, statusLabel, kindLabel, kindOptions, materialCodeLabel, openDetail, perms, messageApi, reload]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<SampleProcessApplication>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.sampleProcess.fields.code'),
        dataIndex: 'application_code',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.sampleProcess.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        key: 'document_type',
        title: t('app.kuaiplm.sampleProcess.fields.requestKind'),
        dataIndex: 'request_kind',
        render: (_, r) => <MarkerTag>{kindLabel(r.request_kind)}</MarkerTag>,
      },
      {
        key: 'title',
        title: t('app.kuaiplm.sampleProcess.fields.title'),
        dataIndex: 'title',
      },
      {
        key: 'material_code',
        title: materialCodeLabel,
        dataIndex: 'material_code',
      },
      {
        key: 'version',
        title: materialVersionLabel,
        dataIndex: 'material_version',
      },
      {
        key: 'business_date',
        title: t('app.kuaiplm.sampleProcess.fields.releaseDate'),
        dataIndex: 'release_date',
        render: (_, r) => formatDateBySiteSetting(r.release_date) || '—',
      },
      {
        key: 'lifecycle',
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        key: 'purpose',
        title: t('app.kuaiplm.sampleProcess.fields.purpose'),
        dataIndex: 'purpose',
      },
      {
        key: 'attachments',
        title: t('app.kuaiplm.sampleProcess.fields.attachments'),
        dataIndex: 'attachments',
        render: (_, r) => {
          const list = r.attachments || [];
          if (!list.length) return '—';
          return list
            .map(
              (a) =>
                `${attachmentTypeLabel(String(a.attachment_type))}: ${a.file_name || a.file_uuid}`,
            )
            .join('；');
        },
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
  }, [t, statusLabel, kindLabel, attachmentTypeLabel, materialCodeLabel, materialVersionLabel]);

  return (
    <ListPageTemplate>
      <UniTable<SampleProcessApplication>
        headerTitle={t('app.kuaiplm.sampleProcess.title')}
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
        columnPersistenceId="apps.kuaiplm.pages.sample-process-applications.width-v3"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaiplm.sampleProcess.createButton') + NEW_SHORTCUT_HINT}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
          const deletable = rows.filter(
            (r) => (r.status === 'draft' || r.status === 'rejected') && r.id,
          );
          if (!deletable.length) {
            messageApi.warning(t('app.kuaiplm.sampleProcess.messages.deleteOnlyDraft'));
            return;
          }
          await Promise.all(deletable.map((r) => sampleProcessApi.remove(r.id)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async (type, keys, pageData) => {
          try {
            let items =
              type === 'currentPage' && pageData?.length
                ? (pageData as SampleProcessApplication[])
                : await fetchAllListItems((p) =>
                    sampleProcessApi.list({
                      ...p,
                      project_id: filterProjectId,
                    }),
                  );
            if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaiplm.sampleProcess.messages.noExportData'));
              return;
            }
            const rows = items.map((r) => ({
              ...r,
              status_label: statusLabel(r.status),
              request_kind_label: kindLabel(r.request_kind),
            }));
            await downloadRecordsAsXlsx(
              rows as Array<Record<string, unknown>>,
              `sample-process-${todaySiteDateString()}.xlsx`,
              { columns: SAMPLE_PROCESS_EXPORT_COLUMNS, sheetName: '样品加工' },
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (err) {
            messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
          }
        }}
        request={async (params) => {
          const res = await sampleProcessApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: params.status as string | undefined,
            request_kind: params.request_kind as string | undefined,
            keyword: (params.keyword || params.title) as string | undefined,
            project_id: filterProjectId,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <FormModalTemplate
        key={editing?.uuid ?? `create-${defaultKind}-${defaultAttachment}`}
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
                request_kind: editing.request_kind,
                title: editing.title,
                material_code: editing.material_code,
                material_version: editing.material_version,
                release_date: editing.release_date,
                purpose: editing.purpose,
                remarks: editing.remarks,
                attachment_type:
                  editing.attachments?.[0]?.attachment_type || defaultAttachment,
                file_upload: (editing.attachments || []).map((a) => ({
                  uid: a.file_uuid,
                  name: a.file_name || a.file_uuid,
                  status: 'done',
                  response: {
                    uuid: a.file_uuid,
                    original_name: a.file_name || a.file_uuid,
                  },
                })),
              }
            : {
                request_kind: defaultKind,
                attachment_type: defaultAttachment,
                file_upload: [],
                ...(filterProjectId ? { project_id: filterProjectId } : {}),
              }
        }
        onFinish={async (values) => {
          try {
            const uploadList = Array.isArray(values.file_upload) ? values.file_upload : [];
            const attachments = attachmentsFromUpload(
              uploadList,
              String(values.attachment_type || defaultAttachment),
            );
            const payload = {
              project_id: Number(values.project_id),
              request_kind: String(values.request_kind || defaultKind),
              title: String(values.title || '').trim(),
              material_code: values.material_code || null,
              material_version: values.material_version || null,
              release_date: values.release_date || null,
              purpose: values.purpose || null,
              remarks: values.remarks || null,
              attachments,
            };
            if (editing?.id) {
              await sampleProcessApi.update(editing.id, payload);
            } else {
              await sampleProcessApi.create(payload);
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
          label={t('app.kuaiplm.sampleProcess.fields.project')}
          rules={[{ required: true }]}
          disabled={!!editing}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="request_kind"
          label={t('app.kuaiplm.sampleProcess.fields.requestKind')}
          rules={[{ required: true }]}
          colProps={{ span: 12 }}
          options={kindOptions.map((k) => ({ value: k.code, label: k.label }))}
        />
        <ProFormText
          name="title"
          label={t('app.kuaiplm.sampleProcess.fields.title')}
          rules={[{ required: true }]}
          colProps={{ span: 24 }}
        />
        <ProFormDependency name={['request_kind']}>
          {({ request_kind }) => {
            const materialRequired = isFieldRequiredForKind(
              formProfile,
              String(request_kind || ''),
              'material_code',
              industryProfileActive,
            );
            const materialRuleMessage =
              validationMessageForKind(
                formProfile,
                String(request_kind || ''),
                industryProfileActive,
              ) || t('common.required');
            return (
              <>
                <ProFormText
                  name="material_code"
                  label={materialCodeLabel}
                  colProps={{ span: 12 }}
                  rules={
                    materialRequired
                      ? [{ required: true, message: materialRuleMessage }]
                      : undefined
                  }
                />
                <ProFormText
                  name="material_version"
                  label={materialVersionLabel}
                  colProps={{ span: 12 }}
                />
              </>
            );
          }}
        </ProFormDependency>
        <ProFormDatePicker
          name="release_date"
          label={t('app.kuaiplm.sampleProcess.fields.releaseDate')}
          colProps={{ span: 12 }}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormSelect
          name="attachment_type"
          label={t('app.kuaiplm.sampleProcess.fields.attachmentType')}
          colProps={{ span: 12 }}
          options={attachmentOptions.map((k) => ({
            value: k.code,
            label: k.label,
          }))}
        />
        <ProFormUploadDragger
          name="file_upload"
          label={t('app.kuaiplm.sampleProcess.fields.attachments')}
          colProps={{ span: 24 }}
          icon={<InboxOutlined />}
          title={t('app.kuaiplm.sampleProcess.fields.fileUploadHint')}
          description={t('app.kuaiplm.sampleProcess.fields.fileUploadSubHint')}
          fieldProps={{
            multiple: true,
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
        <ProFormTextArea
          name="purpose"
          label={t('app.kuaiplm.sampleProcess.fields.purpose')}
          colProps={{ span: 24 }}
        />
        <ProFormTextArea name="remarks" label={t('common.remark')} colProps={{ span: 24 }} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.application_code || t('app.kuaiplm.sampleProcess.title')}
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

export default SampleProcessApplicationsPage;
