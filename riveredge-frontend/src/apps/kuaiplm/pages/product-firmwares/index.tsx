/**
 * 产品固件列表（R-15 #28）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormDatePicker,
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
  ProFormUploadDragger,
} from '@ant-design/pro-components';
import { App, Alert, Button, Col, Descriptions, Result, Row } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { ActionConfirmPopconfirm } from '../../../../components/action-confirm';
import { UniTable } from '../../../../components/uni-table';
import {
  rowActionDownloadFirmware,
  rowActionKind,
  rowActionLabelKeep,
} from '../../../../components/uni-action';
import { ThemedSegmented } from '../../../../components/themed-segmented';
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
import { formDateFormItemProps, toApiDateString } from '../../../../utils/formDate';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { normalizeFilePreviewUrl, uploadFile } from '../../../../services/file';
import {
  extractUploadFileUuids,
  normalizeCustomFieldFileUuids,
  normalizeUploadFileList,
} from '../../../../components/custom-fields/customFieldFileUtils';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { canViewDocumentHistory } from '../../../../utils/permissionContract';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import Phase2ProjectSelect, {
  formatProjectRefLabel,
  resolveProjectRefPick,
} from '../../components/Phase2ProjectSelect';
import {
  productFirmwareApi,
  type ProductFirmware,
  type ProductFirmwarePayload,
  type ProductFirmwareStatus,
} from '../../services/product-firmware';

const RESOURCE = 'kuaiplm:product-firmware';
const FIRMWARE_FILE_CATEGORY = 'product_firmware';

const FIRMWARE_EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'firmware_code', title: '固件单号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'project_name', title: '项目名称' },
  { key: 'version', title: '版本' },
  { key: 'title', title: '标题' },
  { key: 'release_date', title: '发布日期' },
  { key: 'status_label', title: '状态' },
  { key: 'file_name', title: '文件名' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];
const STATUS_KEYS: ProductFirmwareStatus[] = [
  'draft',
  'pending',
  'approved',
  'released',
  'obsolete',
];

const DOWNLOADABLE_STATUSES: ProductFirmwareStatus[] = ['approved', 'released'];

function sanitizeOptionalProjectId(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 升版草稿：同项目下已有已发布固件，新建首版时不展示变更说明 */
function isProductFirmwareReviseContext(
  row: ProductFirmware | null,
  listRows: ProductFirmware[],
): boolean {
  if (!row || row.status !== 'draft') {
    return false;
  }
  const projectId = row.project_id;
  const projectCode = String(row.project_code ?? '').trim();
  return listRows.some((other) => {
    if (other.id === row.id || other.status !== 'released') {
      return false;
    }
    if (projectId != null) {
      return other.project_id === projectId;
    }
    return projectCode !== '' && String(other.project_code ?? '').trim() === projectCode;
  });
}

const ProductFirmwaresPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useCurrentUser();
  const canViewHistory = canViewDocumentHistory(currentUser);
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<ProductFirmware[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const projectRefIdMapRef = useRef(new Map<string, number>());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductFirmware | null>(null);
  const [detail, setDetail] = useState<ProductFirmware | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [listViewScope, setListViewScope] = useState<'all' | 'production'>('all');
  const listScopeReadyRef = useRef(false);

  const reload = useCallback(() => actionRef.current?.reload(), []);

  const showChangeSummary = useMemo(
    () => isProductFirmwareReviseContext(editing, tableRowsRef.current),
    [editing, modalOpen],
  );

  useEffect(() => {
    if (!listScopeReadyRef.current) {
      listScopeReadyRef.current = true;
      return;
    }
    reload();
  }, [listViewScope, reload]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.productFirmware.status.${s}`, { defaultValue: s }),
    [t],
  );

  const resolveStoredFileUuid = useCallback((fileUuid: unknown) => {
    return normalizeCustomFieldFileUuids(fileUuid)[0] ?? null;
  }, []);

  const downloadFirmwareFile = useCallback(
    async (row: ProductFirmware) => {
      if (!row.id) return;
      try {
        const { preview_url } = await productFirmwareApi.getDownloadUrl(row.id, {
          production_view: listViewScope === 'production',
        });
        window.open(normalizeFilePreviewUrl(preview_url), '_blank', 'noopener,noreferrer');
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [listViewScope, messageApi],
  );

  const openDetail = useCallback(
    async (row: ProductFirmware) => {
      if (!row.id) return;
      setDetailLoading(true);
      setDetailError(null);
      setDetail(row);
      try {
        const full = await productFirmwareApi.get(row.id, {
          production_view: listViewScope === 'production',
        });
        setDetail(full);
      } catch (e) {
        setDetailError(getApiErrorMessage(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [listViewScope],
  );

  const canDownloadRow = useCallback((row: ProductFirmware) => {
    return DOWNLOADABLE_STATUSES.includes(row.status);
  }, []);

  const columns = useMemo<ProColumns<ProductFirmware>[]>(() => {
    const cols: ProColumns<ProductFirmware>[] = [
      {
        title: t('app.kuaiplm.productFirmware.fields.code'),
        dataIndex: 'firmware_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.productFirmware.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.productFirmware.fields.project'),
        dataIndex: 'project_name',
        key: 'project_name',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => {
          const code = r.project_code || '';
          const name = r.project_name || '';
          if (code && name && name !== code) {
            return `${name} (${code})`;
          }
          return code || name || '—';
        },
      },
      {
        title: t('app.kuaiplm.productFirmware.fields.version'),
        dataIndex: 'version',
        key: 'version',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.productFirmware.fields.releaseDate'),
        dataIndex: 'release_date',
        key: 'business_date',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, r) => formatDateBySiteSetting(r.release_date) || '—',
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        key: 'lifecycle',
        fixed: 'right',
        valueEnum: Object.fromEntries(
          STATUS_KEYS.map((k) => [k, { text: statusLabel(k) }]),
        ),
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      ...buildDocumentAuditColumns(t),
      {
        title: t('common.action'),
        valueType: 'option',
        key: 'option',
        fixed: 'right',
        render: (_, row) => {
          if (row.id == null) return [];
          const actions: React.ReactNode[] = [
            <Button
              key="detail"
              {...rowActionKind('read')}
              onClick={() => void openDetail(row)}
            />,
          ];
          if (row.status === 'draft' && perms.canUpdate) {
            actions.push(
              <Button
                key="edit"
                {...rowActionKind('update')}
                onClick={() => {
                  setEditing(row);
                  setModalOpen(true);
                }}
              />,
            );
          }
          if (row.status === 'draft' && perms.canDelete) {
            actions.push(
              <Button
                key="delete"
                {...rowActionKind('delete')}
                onClick={async () => {
                  try {
                    await productFirmwareApi.remove(row.id!);
                    messageApi.success(t('common.deleteSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'draft' && perms.canAction?.('submit')) {
            actions.push(
              <Button
                key="submit"
                {...rowActionKind('submit')}
                onClick={async () => {
                  try {
                    await productFirmwareApi.submit(row.id!);
                    messageApi.success(t('app.kuaiplm.productFirmware.messages.submitSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('approve')) {
            actions.push(
              <Button
                key="approve"
                {...rowActionKind('approve')}
                onClick={async () => {
                  try {
                    await productFirmwareApi.approve(row.id!);
                    messageApi.success(t('app.kuaiplm.productFirmware.messages.approveSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('reject')) {
            actions.push(
              <Button
                key="reject"
                {...rowActionKind('reject')}
                onClick={async () => {
                  try {
                    await productFirmwareApi.reject(row.id!);
                    messageApi.success(t('app.kuaiplm.productFirmware.messages.rejectSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'approved' && perms.canAction?.('execute')) {
            actions.push(
              <Button
                key="release"
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={async () => {
                  try {
                    await productFirmwareApi.release(row.id!);
                    messageApi.success(t('app.kuaiplm.productFirmware.messages.releaseSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                {t('app.kuaiplm.productFirmware.actions.release')}
              </Button>,
            );
          }
          if (canDownloadRow(row) && perms.canRead) {
            actions.push(
              <Button
                key="download"
                {...rowActionDownloadFirmware('read')}
                onClick={() => void downloadFirmwareFile(row)}
              />,
            );
          }
          if (row.status === 'released' && perms.canUpdate) {
            actions.push(
              <ActionConfirmPopconfirm
                key="revise"
                title={t('app.kuaiplm.productFirmware.messages.reviseConfirm')}
                onConfirm={async () => {
                  try {
                    const draft = await productFirmwareApi.revise(row.id!, {});
                    messageApi.success(t('app.kuaiplm.productFirmware.messages.reviseSuccess'));
                    reload();
                    setEditing(draft);
                    setModalOpen(true);
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                <Button
                  {...rowActionKind('update')}
                  {...rowActionLabelKeep()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('app.kuaiplm.productFirmware.actions.revise')}
                </Button>
              </ActionConfirmPopconfirm>,
            );
          }
          return actions;
        },
      },
    ];
    return cols;
  }, [
    t,
    statusLabel,
    openDetail,
    perms,
    messageApi,
    reload,
    canDownloadRow,
    downloadFirmwareFile,
  ]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<ProductFirmware>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.productFirmware.fields.code'),
        dataIndex: 'firmware_code',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.productFirmware.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) => {
          const code = r.project_code || '';
          const name = r.project_name || '';
          if (code && name && name !== code) {
            return `${name} (${code})`;
          }
          return code || name || '—';
        },
      },
      {
        key: 'version',
        title: t('app.kuaiplm.productFirmware.fields.version'),
        dataIndex: 'version',
      },
      {
        key: 'title',
        title: t('app.kuaiplm.productFirmware.fields.title'),
        dataIndex: 'title',
      },
      {
        key: 'business_date',
        title: t('app.kuaiplm.productFirmware.fields.releaseDate'),
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
        key: 'file_name',
        title: t('app.kuaiplm.productFirmware.fields.file'),
        dataIndex: 'file_name',
        render: (_, r) => r.file_name || r.file_uuid || '—',
      },
      {
        key: 'change_summary',
        title: t('app.kuaiplm.productFirmware.fields.changeSummary'),
        dataIndex: 'change_summary',
      },
      {
        key: 'updated_at',
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
      },
    ];
    return alignDescriptionColumns(cols as ProDescriptionsItemProps<Record<string, unknown>>[], GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK);
  }, [t, statusLabel]);

  return (
    <ListPageTemplate>
      {filterProjectId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaiplm.phase2.common.projectFilterHint', { id: filterProjectId })}
        />
      ) : null}
      {!canViewHistory && listViewScope === 'all' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaiplm.productFirmware.messages.latestVersionOnlyHint')}
        />
      ) : null}
      <UniTable<ProductFirmware>
        headerTitle={t('app.kuaiplm.productFirmware.title')}
        actionRef={actionRef}
        rowKey="uuid"
        permissionResource={RESOURCE}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        beforeSearchButtons={
          <ThemedSegmented
            surfaceBackground
            size="medium"
            value={listViewScope}
            onChange={(v) => setListViewScope(v as 'all' | 'production')}
            options={[
              { label: t('app.kuaiplm.productFirmware.viewScope.all'), value: 'all' },
              {
                label: t('app.kuaiplm.productFirmware.viewScope.production'),
                value: 'production',
              },
            ]}
          />
        }
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.product-firmwares.width-v3"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaiplm.productFirmware.createButton') + NEW_SHORTCUT_HINT}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
          const drafts = rows.filter((r) => r.status === 'draft' && r.id);
          if (!drafts.length) {
            messageApi.warning(t('app.kuaiplm.productFirmware.messages.deleteOnlyDraft'));
            return;
          }
          await Promise.all(drafts.map((r) => productFirmwareApi.remove(r.id!)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async (type, keys, pageData) => {
          try {
            let items =
              type === 'currentPage' && pageData?.length
                ? (pageData as ProductFirmware[])
                : await fetchAllListItems((p) =>
                    productFirmwareApi.list({
                      ...p,
                      project_id: filterProjectId,
                      production_download_only: listViewScope === 'production',
                    }),
                  );
            if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaiplm.productFirmware.messages.noExportData'));
              return;
            }
            const rows = items.map((r) => ({
              ...r,
              status_label: statusLabel(r.status),
            }));
            await downloadRecordsAsXlsx(
              rows as Array<Record<string, unknown>>,
              `product-firmwares-${todaySiteDateString()}.xlsx`,
              { columns: FIRMWARE_EXPORT_COLUMNS, sheetName: '产品固件' },
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (err) {
            messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
          }
        }}
        request={async (params) => {
          const res = await productFirmwareApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: params.status as string | undefined,
            keyword: (params.keyword || params.title) as string | undefined,
            project_id: filterProjectId,
            production_download_only: listViewScope === 'production',
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={
          editing
            ? t('app.kuaiplm.productFirmware.modal.editTitle')
            : t('app.kuaiplm.productFirmware.modal.createTitle')
        }
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        formRef={formRef}
        grid={false}
        width={960}
        initialValues={
          editing
            ? {
                project_ref: editing.project_id
                  ? formatProjectRefLabel(editing.project_code, editing.project_name)
                  : editing.project_code || '',
                version: editing.version,
                title: editing.title,
                release_date: editing.release_date,
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
                change_summary: editing.change_summary,
                remarks: editing.remarks,
              }
            : { file_upload: [] }
        }
        onFinish={async (values) => {
          try {
            // Upload 字段以 form 真源为准（validateFields 偶发与 fileList 不同步）
            const formUpload = formRef.current?.getFieldValue?.('file_upload');
            const formFileUuid = formRef.current?.getFieldValue?.('file_uuid');
            const formFileName = formRef.current?.getFieldValue?.('file_name');
            const uploadList = normalizeUploadFileList(formUpload ?? values.file_upload);
            const uploadedUuids = extractUploadFileUuids(uploadList);
            const fileUuid =
              uploadedUuids[0] ??
              normalizeCustomFieldFileUuids(formFileUuid ?? values.file_uuid)[0] ??
              normalizeCustomFieldFileUuids(editing?.file_uuid)[0] ??
              null;
            const done = uploadList.find((f) => f.status === 'done' || !f.status);
            const response = done?.response as
              | { uuid?: string; original_name?: string; name?: string }
              | Array<{ uuid?: string; original_name?: string; name?: string }>
              | undefined;
            const responseMeta = Array.isArray(response) ? response[0] : response;
            const fileName =
              responseMeta?.original_name ||
              responseMeta?.name ||
              done?.name ||
              (typeof formFileName === 'string' ? formFileName : null) ||
              (typeof values.file_name === 'string' ? values.file_name : null) ||
              editing?.file_name ||
              null;
            if (!fileUuid) {
              messageApi.error(t('app.kuaiplm.productFirmware.messages.fileRequired'));
              return false;
            }
            const projectFields = resolveProjectRefPick(
              values.project_ref,
              projectRefIdMapRef.current,
            );
            const projectId = sanitizeOptionalProjectId(projectFields.project_id);
            const projectCode = String(projectFields.project_code ?? '').trim() || undefined;
            const payload: ProductFirmwarePayload = {
              version: String(values.version || '').trim(),
              title: String(values.title || '').trim(),
              release_date: toApiDateString(values.release_date) ?? null,
              file_uuid: fileUuid,
              file_name: fileName,
              change_summary: showChangeSummary
                ? String(values.change_summary || '').trim() || null
                : null,
              remarks: values.remarks || null,
            };
            if (projectId !== undefined) {
              payload.project_id = projectId;
            } else if (projectCode) {
              payload.project_code = projectCode;
            }
            if (editing?.id) {
              await productFirmwareApi.update(editing.id, payload);
            } else {
              await productFirmwareApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            setEditing(null);
            reload();
            return true;
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            return false;
          }
        }}
      >
        <ProFormText name="file_uuid" hidden />
        <ProFormText name="file_name" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.productFirmware.fields.title')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="version"
              label={t('app.kuaiplm.productFirmware.fields.version')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <Phase2ProjectSelect
              allowManualProjectCode
              idByLabelRef={projectRefIdMapRef}
              label={t('app.kuaiplm.productFirmware.fields.project')}
              disabled={!!editing}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="release_date"
              label={t('app.kuaiplm.productFirmware.fields.releaseDate')}
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' }, format: 'YYYY-MM-DD' }}
            />
          </Col>
        </Row>
        <ProFormUploadDragger
          name="file_upload"
          label={t('app.kuaiplm.productFirmware.fields.file')}
          max={1}
          icon={<InboxOutlined />}
          title={t('app.kuaiplm.productFirmware.fields.fileUploadHint')}
          description={t('app.kuaiplm.productFirmware.fields.fileUploadSubHint')}
          rules={[]}
          fieldProps={{
            multiple: false,
            maxCount: 1,
            style: { width: '100%' },
            customRequest: async (options) => {
              try {
                const raw = options.file as File;
                const res = await uploadFile(raw, {
                  category: FIRMWARE_FILE_CATEGORY,
                });
                const uuid = String(res?.uuid || '').trim();
                if (!uuid) {
                  throw new Error(t('app.kuaiplm.productFirmware.messages.fileRequired'));
                }
                const fileName = res.original_name || res.name || raw.name;
                // 同步隐藏字段，避免仅靠 Upload.response 在提交时丢失 UUID
                formRef.current?.setFieldsValue?.({
                  file_uuid: uuid,
                  file_name: fileName,
                });
                options.onSuccess?.(
                  { uuid, original_name: fileName, name: res.name || fileName },
                  raw as never,
                );
              } catch (err) {
                options.onError?.(err as Error);
              }
            },
            onRemove: () => {
              formRef.current?.setFieldsValue?.({
                file_uuid: undefined,
                file_name: undefined,
              });
              return true;
            },
          }}
        />
        <Row gutter={16}>
          {showChangeSummary ? (
            <Col span={24}>
              <ProFormTextArea
                name="change_summary"
                label={t('app.kuaiplm.productFirmware.fields.changeSummary')}
                rules={[{ required: true, message: t('common.required') }]}
              />
            </Col>
          ) : null}
          <Col span={24}>
            <ProFormTextArea name="remarks" label={t('common.remark')} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.firmware_code || t('app.kuaiplm.productFirmware.title')}
        loading={detailLoading}
        extra={
          detail && !detailError && canDownloadRow(detail) && perms.canRead ? (
            <Button type="primary" onClick={() => void downloadFirmwareFile(detail)}>
              {t('app.kuaiplm.productFirmware.actions.downloadFirmware')}
            </Button>
          ) : undefined
        }
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

export default ProductFirmwaresPage;
