/**
 * 生产文件（R-06）
 * PE：工序→型号，生产方仅最新生产版；研发：项目→发布日，保留历史。
 * 不替代产品固件（R-15）与 R-16 扫码打印。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Alert, App, Button, Col, Descriptions, Input, Modal, Result, Row, Table } from 'antd';
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
  MultiTabListPageTemplate,
  detailDrawerBasicColumn,
} from '../../../../components/layout-templates';
import { detailDrawerDescriptionItems } from '../../../../components/layout-templates/detailDrawerDescriptionItems';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import {
  formatDateBySiteSetting,
  formatDateTimeBySiteSetting,
  todaySiteDateString,
} from '../../../../utils/format';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../constants/statusBadges';
import { normalizeFilePreviewUrl, uploadMultipleFiles } from '../../../../services/file';
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
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { formDateFormItemProps, toApiDateString } from '../../../../utils/formDate';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import Phase2ProjectSelect, {
  formatProjectRefLabel,
  resolveProjectRefPick,
} from '../../components/Phase2ProjectSelect';
import {
  productionFileApi,
  type ProductionFile,
  type ProductionFileAccessLog,
  type ProductionFileCatalogKind,
  type ProductionFilePayload,
  type ProductionFileStatus,
  type ProductionFileVersion,
} from '../../services/production-file';

const RESOURCE = 'kuaiplm:production-file';
const FILE_CATEGORY = 'production_file';

/** PE 签不含 burn：烧录工具已在「烧录工具」研发 Tab（rd_burn_tool） */
const PE_TYPES = ['laser', 'bluetooth_ir', 'aoi', 'label_template', 'other_pe'] as const;
const RD_TYPES = ['rd_burn_tool', 'rd_prod_test', 'other_rd'] as const;
const STATUS_KEYS: ProductionFileStatus[] = [
  'draft',
  'pending',
  'effective',
  'obsolete',
  'rejected',
];

const EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'file_code', title: '文件单号' },
  { key: 'catalog_kind_label', title: '目录策略' },
  { key: 'file_type_label', title: '文件类型' },
  { key: 'title', title: '标题' },
  { key: 'process_name', title: '工序' },
  { key: 'product_model', title: '产品型号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'version', title: '版本' },
  { key: 'release_date', title: '发布日期' },
  { key: 'status_label', title: '状态' },
  { key: 'file_name', title: '文件名' },
  { key: 'issued_by_name', title: '发放人' },
  { key: 'receiver_names', title: '接收人' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const DOWNLOADABLE_STATUSES: ProductionFileStatus[] = ['effective'];

function sanitizeOptionalProjectId(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 页顶 Tab：与客户样例文件夹「烧录工具 / 产测文件」对齐；PE 仍保留第三签 */
type ProductionFilePageTab = 'rd_burn_tool' | 'rd_prod_test' | 'pe_production';

const PRODUCTION_FILE_PAGE_TABS: ProductionFilePageTab[] = [
  'rd_burn_tool',
  'rd_prod_test',
  'pe_production',
];

function pageTabCatalogKind(tab: ProductionFilePageTab): ProductionFileCatalogKind {
  return tab === 'pe_production' ? 'pe_production' : 'rd_tool';
}

function pageTabFixedFileType(tab: ProductionFilePageTab): string | undefined {
  if (tab === 'rd_burn_tool' || tab === 'rd_prod_test') {
    return tab;
  }
  return undefined;
}

function pageTabIsRd(tab: ProductionFilePageTab): boolean {
  return tab !== 'pe_production';
}

function defaultFileTypeForPageTab(tab: ProductionFilePageTab): string {
  if (tab === 'rd_prod_test') return 'rd_prod_test';
  if (tab === 'pe_production') return 'laser';
  return 'rd_burn_tool';
}

function pageTabLabel(
  tab: ProductionFilePageTab,
  typeLabel: (code: string) => string,
  catalogLabel: (code: string) => string,
): string {
  if (tab === 'pe_production') {
    return catalogLabel('pe_production');
  }
  return typeLabel(tab);
}

function stripFileExtension(name: string): string {
  return String(name || '').replace(/\.[^.\\/]+$/, '').trim();
}

/** 上传区标签与提示：与客户提供样例文件夹名（烧录工具 / 产测文件等）一致 */
function resolveProductionFileUploadFieldMeta(
  fileType: string | undefined,
  typeLabel: (code: string) => string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const code = String(fileType || '').trim();
  if (!code) {
    return {
      label: t('app.kuaiplm.productionFile.fields.file'),
      hint: t('app.kuaiplm.productionFile.fields.fileUploadHint'),
      subHint: t('app.kuaiplm.productionFile.fields.fileUploadSubHint'),
    };
  }
  const folderLabel = typeLabel(code);
  return {
    label: folderLabel,
    hint: t('app.kuaiplm.productionFile.fields.fileUploadHintByType', { folder: folderLabel }),
    subHint: t('app.kuaiplm.productionFile.fields.fileUploadSubHintByType', {
      folder: folderLabel,
    }),
  };
}

function suggestTitleAndVersionFromFileName(
  fileName: string,
  defaults: { title?: string; version?: string },
): { title?: string; version?: string } {
  const baseName = stripFileExtension(fileName);
  if (!baseName) {
    return {};
  }
  const next: { title?: string; version?: string } = {};
  if (!String(defaults.title || '').trim()) {
    next.title = baseName;
  }
  const versionMatch = baseName.match(/[Vv](\d+(?:\.\d+)?)/);
  if (versionMatch && !String(defaults.version || '').trim()) {
    next.version = `V${versionMatch[1]}`;
  }
  return next;
}

const ProductionFilesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const currentUser = useCurrentUser();
  const canViewHistory = canViewDocumentHistory(currentUser);

  const [activePageTab, setActivePageTab] = useState<ProductionFilePageTab>('rd_burn_tool');
  const [rdListViewScope, setRdListViewScope] = useState<'all' | 'production'>('all');
  const listScopeReadyRef = useRef(false);
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<ProductionFile[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const projectRefIdMapRef = useRef(new Map<string, number>());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionFile | null>(null);
  const [detail, setDetail] = useState<ProductionFile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [versions, setVersions] = useState<ProductionFileVersion[]>([]);
  const [accessLogs, setAccessLogs] = useState<ProductionFileAccessLog[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueRow, setIssueRow] = useState<ProductionFile | null>(null);
  const [receiverNames, setReceiverNames] = useState('');

  const reload = useCallback(() => actionRef.current?.reload(), []);

  /** 新建首版不展示更改明细；编辑或升版草稿时展示 */
  const showChangeSummary = useMemo(() => Boolean(editing), [editing, modalOpen]);

  const catalogKind = pageTabCatalogKind(activePageTab);
  const fixedFileType = pageTabFixedFileType(activePageTab);
  const isPe = activePageTab === 'pe_production';
  const isRdTab = pageTabIsRd(activePageTab);
  const rdProductionView = rdListViewScope === 'production';

  useEffect(() => {
    if (!isRdTab) return;
    if (!listScopeReadyRef.current) {
      listScopeReadyRef.current = true;
      return;
    }
    reload();
  }, [activePageTab, isRdTab, rdListViewScope, reload]);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.productionFile.status.${s}`, { defaultValue: s }),
    [t],
  );
  const typeLabel = useCallback(
    (s: string) => t(`app.kuaiplm.productionFile.fileType.${s}`, { defaultValue: s }),
    [t],
  );
  const catalogLabel = useCallback(
    (s: string) => t(`app.kuaiplm.productionFile.catalog.${s}`, { defaultValue: s }),
    [t],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const loadDetailExtras = useCallback(
    async (id: number, productionView = false) => {
      const [verRes, logRes] = await Promise.all([
        productionFileApi.listVersions(id, productionView),
        productionFileApi.listAccessLogs(id, { limit: 50 }),
      ]);
      setVersions(verRes.items);
      setAccessLogs(logRes.items);
    },
    [],
  );

  const downloadProductionFile = useCallback(
    async (row: ProductionFile, versionId?: number) => {
      if (!row.id) return;
      const productionView = row.catalog_kind === 'rd_tool' && rdProductionView;
      try {
        const { preview_url } = await productionFileApi.getDownloadUrl(row.id, {
          version_id: versionId,
          production_view: productionView,
        });
        window.open(normalizeFilePreviewUrl(preview_url), '_blank', 'noopener,noreferrer');
        if (detail?.id === row.id) {
          await loadDetailExtras(row.id, productionView);
        }
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [detail?.id, loadDetailExtras, messageApi, rdProductionView],
  );

  const canDownloadRow = useCallback((row: ProductionFile) => {
    return DOWNLOADABLE_STATUSES.includes(row.status);
  }, []);

  const openDetail = useCallback(
    async (row: ProductionFile) => {
      if (!row.id) return;
      setDetailLoading(true);
      setDetailError(null);
      setDetail(row);
      setVersions([]);
      setAccessLogs([]);
      try {
        const full = await productionFileApi.get(row.id);
        setDetail(full);
        const productionView = row.catalog_kind === 'rd_tool' && rdProductionView;
        await loadDetailExtras(row.id, productionView);
      } catch (e) {
        setDetailError(getApiErrorMessage(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [loadDetailExtras, rdProductionView],
  );

  const columns = useMemo<ProColumns<ProductionFile>[]>(() => {
    const cols: ProColumns<ProductionFile>[] = [
      {
        title: t('app.kuaiplm.productionFile.fields.code'),
        dataIndex: 'file_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.productionFile.fields.fileType'),
        dataIndex: 'file_type',
        key: 'doc_type',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, r) => (
          <MarkerTag>{typeLabel(r.file_type)}</MarkerTag>
        ),
      },
      {
        title: t('app.kuaiplm.productionFile.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
    ];
    if (isPe) {
      cols.push(
        {
          title: t('app.kuaiplm.productionFile.fields.process'),
          dataIndex: 'process_name',
          key: 'process_name',
          width: 140,
          minWidth: 140,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
          render: (_, r) => r.process_name || r.process_code || '—',
        },
        {
          title: t('app.kuaiplm.productionFile.fields.productModel'),
          dataIndex: 'product_model',
          key: 'product_model',
          width: 140,
          minWidth: 140,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
        },
      );
    } else {
      cols.push(
        {
          title: t('app.kuaiplm.productionFile.fields.project'),
          dataIndex: 'project_name',
          key: 'project_name',
          width: 180,
          minWidth: 180,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
          render: (_, r) =>
            r.project_name ? `${r.project_name} (${r.project_code || ''})` : r.project_code || '—',
        },
        {
          title: t('app.kuaiplm.productionFile.fields.releaseDate'),
          dataIndex: 'release_date',
          key: 'business_date',
          width: 120,
          minWidth: 120,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, r) => formatDateBySiteSetting(r.release_date) || '—',
        },
      );
    }
    cols.push(
      {
        title: t('app.kuaiplm.productionFile.fields.version'),
        dataIndex: 'version',
        key: 'version',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
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
            perms.canAction?.('submit')
          ) {
            actions.push(
              <Button
                key="submit"
                type="link"
                size="small"
                {...rowActionKind('submit')}
                onClick={async () => {
                  try {
                    await productionFileApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.productionFile.messages.submitSuccess'));
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
                type="link"
                size="small"
                {...rowActionKind('approve')}
                onClick={async () => {
                  try {
                    await productionFileApi.approve(row.id);
                    messageApi.success(t('app.kuaiplm.productionFile.messages.approveSuccess'));
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
                type="link"
                size="small"
                {...rowActionKind('reject')}
                onClick={async () => {
                  try {
                    await productionFileApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.productionFile.messages.rejectSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (canDownloadRow(row) && perms.canRead) {
            actions.push(
              <Button
                key="download"
                type="link"
                size="small"
                {...rowActionDownloadFirmware('read')}
                onClick={() => void downloadProductionFile(row)}
              />,
            );
          }
          if (row.status === 'effective' && perms.canUpdate) {
            actions.push(
              <ActionConfirmPopconfirm
                key="revise"
                title={t('app.kuaiplm.productionFile.messages.reviseConfirm')}
                onConfirm={async () => {
                  try {
                    const draft = await productionFileApi.revise(row.id, {});
                    messageApi.success(t('app.kuaiplm.productionFile.messages.reviseSuccess'));
                    reload();
                    setEditing(draft);
                    setModalOpen(true);
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                <Button
                  type="link"
                  size="small"
                  {...rowActionKind('update')}
                  {...rowActionLabelKeep()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('app.kuaiplm.productionFile.actions.revise')}
                </Button>
              </ActionConfirmPopconfirm>,
            );
          }
          if (row.status === 'effective' && perms.canAction?.('execute')) {
            actions.push(
              <Button
                key="issue"
                type="link"
                size="small"
                {...rowActionKind('execute')}
                onClick={() => {
                  setIssueRow(row);
                  setReceiverNames('');
                  setIssueOpen(true);
                }}
              >
                {t('app.kuaiplm.productionFile.actions.issue')}
              </Button>,
            );
          }
          if (row.status === 'effective' && perms.canAction?.('obsolete')) {
            actions.push(
              <Button
                key="obsolete"
                type="link"
                size="small"
                danger
                {...rowActionKind('obsolete')}
                onClick={() => {
                  modal.confirm({
                    title: t('app.kuaiplm.productionFile.messages.obsoleteConfirm'),
                    onOk: async () => {
                      try {
                        await productionFileApi.obsolete(row.id);
                        messageApi.success(
                          t('app.kuaiplm.productionFile.messages.obsoleteSuccess'),
                        );
                        reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    },
                  });
                }}
              />,
            );
          }
          return actions;
        },
      },
    );
    return alignProColumns(cols, GLOBAL_DOC_LIST_FIELD_RANK);
  }, [
    t,
    isPe,
    typeLabel,
    statusLabel,
    openDetail,
    perms,
    messageApi,
    reload,
    modal,
    canDownloadRow,
    downloadProductionFile,
  ]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<ProductionFile>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.productionFile.fields.code'),
        dataIndex: 'file_code',
      },
      {
        key: 'doc_type',
        title: t('app.kuaiplm.productionFile.fields.fileType'),
        dataIndex: 'file_type',
        render: (_, r) => typeLabel(r.file_type),
      },
      {
        key: 'title',
        title: t('app.kuaiplm.productionFile.fields.title'),
        dataIndex: 'title',
      },
      {
        key: 'version',
        title: t('app.kuaiplm.productionFile.fields.version'),
        dataIndex: 'version',
      },
      {
        key: 'lifecycle',
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        key: 'process_name',
        title: t('app.kuaiplm.productionFile.fields.process'),
        dataIndex: 'process_name',
        render: (_, r) => r.process_name || r.process_code || '—',
      },
      {
        key: 'product_model',
        title: t('app.kuaiplm.productionFile.fields.productModel'),
        dataIndex: 'product_model',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.productionFile.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) =>
          r.project_name ? `${r.project_name} (${r.project_code || ''})` : r.project_code || '—',
      },
      {
        key: 'business_date',
        title: t('app.kuaiplm.productionFile.fields.releaseDate'),
        dataIndex: 'release_date',
        render: (_, r) => formatDateBySiteSetting(r.release_date) || '—',
      },
      {
        key: 'file_name',
        title: t('app.kuaiplm.productionFile.fields.file'),
        dataIndex: 'file_name',
      },
      {
        key: 'change_summary',
        title: t('app.kuaiplm.productionFile.fields.changeSummary'),
        dataIndex: 'change_summary',
      },
      {
        key: 'issued_by_name',
        title: t('app.kuaiplm.productionFile.fields.issuedBy'),
        dataIndex: 'issued_by_name',
      },
      {
        key: 'receiver_names',
        title: t('app.kuaiplm.productionFile.fields.receivers'),
        dataIndex: 'receiver_names',
      },
      {
        key: 'remarks',
        title: t('common.remarks'),
        dataIndex: 'remarks',
      },
    ];
    return alignDescriptionColumns(cols, GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK);
  }, [t, typeLabel, statusLabel]);

  const typeOptions = useMemo(() => {
    const keys = isPe ? PE_TYPES : RD_TYPES;
    return keys.map((k) => ({ label: typeLabel(k), value: k }));
  }, [isPe, typeLabel]);

  const renderCatalogTable = (pageTab: ProductionFilePageTab) => {
    const kind = pageTabCatalogKind(pageTab);
    const fileTypeFilter = pageTabFixedFileType(pageTab);
    return (
    <>
      {pageTabIsRd(pageTab) && !canViewHistory && rdListViewScope === 'all' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaiplm.productionFile.messages.latestVersionOnlyHint')}
        />
      ) : null}
      <UniTable<ProductionFile>
      key={`${pageTab}-${pageTabIsRd(pageTab) ? rdListViewScope : 'default'}`}
      actionRef={actionRef}
      rowKey="id"
      columns={columns}
      permissionResource={RESOURCE}
      columnPersistenceId={`apps.kuaiplm.pages.production-files.${pageTab}.width-v5`}
      enableRowSelection
      selectedRowKeys={selectedRowKeys}
      onSelectedRowKeysChange={setSelectedRowKeys}
      onTableDataChange={(rows) => {
        tableRowsRef.current = rows;
      }}
      showCreateButton={perms.canCreate}
      createButtonText={t('app.kuaiplm.productionFile.createButton')}
      onCreate={openCreate}
      showExportButton={perms.canAction?.('export')}
      onExport={async () => {
        const items = await fetchAllListItems((skip, limit) =>
          productionFileApi.list({
            skip,
            limit,
            catalog_kind: kind,
            file_type: fileTypeFilter,
          }),
        );
        if (!items.length) {
          messageApi.warning(t('app.kuaiplm.productionFile.messages.noExportData'));
          return;
        }
        await downloadRecordsAsXlsx(
          items.map((r) => ({
            ...r,
            catalog_kind_label: catalogLabel(r.catalog_kind),
            file_type_label: typeLabel(r.file_type),
            status_label: statusLabel(r.status),
          })),
          EXPORT_COLUMNS,
          `production-files-${kind}-${todaySiteDateString()}.xlsx`,
        );
      }}
      beforeSearchButtons={
        pageTabIsRd(pageTab) ? (
          <ThemedSegmented
            surfaceBackground
            size="medium"
            value={rdListViewScope}
            onChange={(v) => setRdListViewScope(v as 'all' | 'production')}
            options={[
              { label: t('app.kuaiplm.productionFile.viewScope.all'), value: 'all' },
              {
                label: t('app.kuaiplm.productionFile.viewScope.production'),
                value: 'production',
              },
            ]}
          />
        ) : undefined
      }
      toolBarRender={() => []}
      headerTitle={t('app.kuaiplm.productionFile.title')}
      request={async (params) => {
        const res = await productionFileApi.list({
          skip: ((params.current || 1) - 1) * (params.pageSize || 20),
          limit: params.pageSize || 20,
          keyword: params.keyword as string | undefined,
          status: params.status as string | undefined,
          catalog_kind: kind,
          file_type: fileTypeFilter,
          production_view: pageTabIsRd(pageTab) && rdListViewScope === 'production',
        });
        return { data: res.items, success: true, total: res.total };
      }}
      search={{ labelWidth: 'auto' }}
    />
    </>
  );
  };

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activePageTab}
        onTabChange={(key) => {
          setActivePageTab(key as ProductionFilePageTab);
          setSelectedRowKeys([]);
        }}
        tabs={PRODUCTION_FILE_PAGE_TABS.map((tab) => ({
          key: tab,
          label: pageTabLabel(tab, typeLabel, catalogLabel),
          children: renderCatalogTable(tab),
        }))}
      />

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={
          editing
            ? t('app.kuaiplm.productionFile.editTitle')
            : t('app.kuaiplm.productionFile.createTitle')
        }
        open={modalOpen}
        onOpenChange={setModalOpen}
        formRef={formRef}
        grid={false}
        width={960}
        initialValues={
          editing
            ? {
                ...editing,
                catalog_kind: editing.catalog_kind,
                project_ref:
                  editing.catalog_kind === 'rd_tool'
                    ? editing.project_id
                      ? formatProjectRefLabel(editing.project_code, editing.project_name)
                      : editing.project_code || ''
                    : undefined,
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
              }
            : {
                catalog_kind: catalogKind,
                version: 'A0',
                file_type: fixedFileType ?? defaultFileTypeForPageTab(activePageTab),
                file_upload: [],
              }
        }
        onFinish={async (values) => {
          try {
            const uploadList = normalizeUploadFileList(values.file_upload);
            const uploadedUuids = extractUploadFileUuids(uploadList);
            const fileUuid =
              uploadedUuids[0] ?? normalizeCustomFieldFileUuids(values.file_uuid)[0] ?? null;
            const done = uploadList.find((f) => f.status === 'done' || !f.status);
            const response = done?.response as
              | { uuid?: string; original_name?: string; name?: string }
              | undefined;
            const fileName =
              response?.original_name ||
              response?.name ||
              done?.name ||
              (typeof values.file_name === 'string' ? values.file_name : null) ||
              null;
            const payload: ProductionFilePayload = {
              catalog_kind: catalogKind,
              file_type: fixedFileType ?? values.file_type,
              title: values.title,
              version: values.version,
              process_code: values.process_code,
              process_name: values.process_name,
              product_model: values.product_model,
              release_date: toApiDateString(values.release_date) ?? null,
              file_uuid: fileUuid,
              file_name: fileName,
              change_summary: showChangeSummary
                ? String(values.change_summary || '').trim() || null
                : null,
              remarks: values.remarks,
            };
            if (!isPe) {
              const projectFields = resolveProjectRefPick(
                values.project_ref,
                projectRefIdMapRef.current,
              );
              const projectId = sanitizeOptionalProjectId(projectFields.project_id);
              const projectCode = String(projectFields.project_code ?? '').trim() || undefined;
              if (projectId !== undefined) {
                payload.project_id = projectId;
              } else if (projectCode) {
                payload.project_code = projectCode;
              }
            }
            if (!payload.file_uuid) {
              messageApi.error(t('app.kuaiplm.productionFile.messages.fileRequired'));
              return false;
            }
            if (editing?.id) {
              await productionFileApi.update(editing.id, payload);
            } else {
              await productionFileApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            reload();
            return true;
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            return false;
          }
        }}
      >
        <ProFormText name="catalog_kind" hidden />
        <ProFormText name="file_uuid" hidden />
        <ProFormText name="file_name" hidden />
        {fixedFileType ? <ProFormText name="file_type" hidden /> : null}
        <Row gutter={16}>
          {!fixedFileType ? (
            <Col span={12}>
              <ProFormSelect
                name="file_type"
                label={t('app.kuaiplm.productionFile.fields.fileType')}
                options={typeOptions}
                rules={[{ required: true }]}
              />
            </Col>
          ) : null}
          <Col span={12}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.productionFile.fields.title')}
              rules={[{ required: true }]}
              fieldProps={{ placeholder: NEW_SHORTCUT_HINT }}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="version"
              label={t('app.kuaiplm.productionFile.fields.version')}
              rules={[{ required: true }]}
              disabled={Boolean(editing)}
            />
          </Col>
          {isPe ? (
            <>
              <Col span={12}>
                <ProFormText
                  name="process_code"
                  label={t('app.kuaiplm.productionFile.fields.processCode')}
                  rules={[{ required: true }]}
                />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="process_name"
                  label={t('app.kuaiplm.productionFile.fields.process')}
                />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="product_model"
                  label={t('app.kuaiplm.productionFile.fields.productModel')}
                  rules={[{ required: true }]}
                />
              </Col>
            </>
          ) : (
            <>
              <Col span={12}>
                <Phase2ProjectSelect
                  allowManualProjectCode
                  idByLabelRef={projectRefIdMapRef}
                  label={t('app.kuaiplm.productionFile.fields.project')}
                  disabled={!!editing}
                />
              </Col>
              <Col span={12}>
                <ProFormDatePicker
                  name="release_date"
                  label={t('app.kuaiplm.productionFile.fields.releaseDate')}
                  formItemProps={formDateFormItemProps}
                  fieldProps={{ style: { width: '100%' }, format: 'YYYY-MM-DD' }}
                />
              </Col>
            </>
          )}
        </Row>
        <ProFormDependency name={['file_type']}>
          {({ file_type: selectedFileType }) => {
            const effectiveFileType = fixedFileType ?? selectedFileType;
            const uploadMeta = resolveProductionFileUploadFieldMeta(
              effectiveFileType,
              typeLabel,
              t,
            );
            return (
              <ProFormUploadDragger
                name="file_upload"
                label={uploadMeta.label}
                max={1}
                icon={<InboxOutlined />}
                title={uploadMeta.hint}
                description={uploadMeta.subHint}
                fieldProps={{
                  multiple: false,
                  maxCount: 1,
                  style: { width: '100%' },
                  customRequest: async (options) => {
                    try {
                      const raw = options.file as File;
                      const res = await uploadMultipleFiles([raw], {
                        category: FILE_CATEGORY,
                      });
                      const uuid = String(res[0]?.uuid || '').trim();
                      const uploadedName =
                        res[0]?.original_name || res[0]?.name || raw.name || '';
                      if (uuid) {
                        const curTitle = formRef.current?.getFieldValue?.('title');
                        const curVersion = String(
                          formRef.current?.getFieldValue?.('version') || '',
                        ).trim();
                        const versionUnset =
                          !curVersion || (!editing && curVersion === 'A0');
                        const suggested = suggestTitleAndVersionFromFileName(uploadedName, {
                          title: curTitle,
                          version: versionUnset ? '' : curVersion,
                        });
                        formRef.current?.setFieldsValue?.({
                          file_uuid: uuid,
                          file_name: uploadedName,
                          ...suggested,
                        });
                      }
                      options.onSuccess?.(res[0], raw);
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
            );
          }}
        </ProFormDependency>
        <Row gutter={16}>
          {showChangeSummary ? (
            <Col span={24}>
              <ProFormTextArea
                name="change_summary"
                label={t('app.kuaiplm.productionFile.fields.changeSummary')}
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
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.file_code || t('app.kuaiplm.productionFile.title')}
        loading={detailLoading}
        extra={
          detail && !detailError && canDownloadRow(detail) && perms.canRead ? (
            <Button type="primary" onClick={() => void downloadProductionFile(detail)}>
              {t('app.kuaiplm.productionFile.actions.download')}
            </Button>
          ) : null
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
        lines={
          detail && !detailError ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {t('app.kuaiplm.productionFile.sections.versions')}
                </div>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={versions}
                  columns={[
                    {
                      title: t('app.kuaiplm.productionFile.fields.version'),
                      dataIndex: 'version',
                      width: 90,
                    },
                    {
                      title: t('common.status'),
                      dataIndex: 'status',
                      width: 100,
                      render: (s: string) => renderDocumentStatusTag(statusLabel(s), s),
                    },
                    {
                      title: t('app.kuaiplm.productionFile.fields.releaseDate'),
                      dataIndex: 'release_date',
                      width: 120,
                      render: (v) => formatDateBySiteSetting(v) || '—',
                    },
                    {
                      title: t('app.kuaiplm.productionFile.fields.file'),
                      dataIndex: 'file_name',
                      ellipsis: true,
                    },
                    {
                      title: t('app.kuaiplm.productionFile.fields.changeSummary'),
                      dataIndex: 'change_summary',
                      ellipsis: true,
                    },
                    {
                      title: t('common.action'),
                      width: 100,
                      render: (_, ver: ProductionFileVersion) =>
                        ver.file_uuid ? (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => void downloadProductionFile(detail, ver.id)}
                          >
                            {t('app.kuaiplm.productionFile.actions.download')}
                          </Button>
                        ) : (
                          '—'
                        ),
                    },
                  ]}
                />
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {t('app.kuaiplm.productionFile.sections.accessLogs')}
                </div>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={accessLogs}
                  columns={[
                    {
                      title: t('app.kuaiplm.productionFile.fields.action'),
                      dataIndex: 'action',
                      width: 90,
                      render: (a: string) =>
                        t(`app.kuaiplm.productionFile.accessAction.${a}`, { defaultValue: a }),
                    },
                    {
                      title: t('app.kuaiplm.productionFile.fields.version'),
                      dataIndex: 'version',
                      width: 90,
                    },
                    {
                      title: t('app.kuaiplm.productionFile.fields.actor'),
                      dataIndex: 'actor_name',
                      width: 120,
                    },
                    {
                      title: t('app.kuaiplm.productionFile.fields.receivers'),
                      dataIndex: 'receiver_names',
                      ellipsis: true,
                    },
                    {
                      title: t('common.time'),
                      dataIndex: 'created_at',
                      width: 160,
                      render: (v) => formatDateTimeBySiteSetting(v) || '—',
                    },
                  ]}
                />
              </div>
            </>
          ) : null
        }
      />

      <Modal
        title={t('app.kuaiplm.productionFile.actions.issue')}
        open={issueOpen}
        destroyOnHidden
        onCancel={() => setIssueOpen(false)}
        onOk={async () => {
          if (!issueRow || !receiverNames.trim()) {
            messageApi.error(t('app.kuaiplm.productionFile.messages.receiverRequired'));
            return;
          }
          try {
            await productionFileApi.issue(issueRow.id, {
              receiver_names: receiverNames.trim(),
            });
            messageApi.success(t('app.kuaiplm.productionFile.messages.issueSuccess'));
            setIssueOpen(false);
            reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <Input.TextArea
          rows={3}
          value={receiverNames}
          onChange={(e) => setReceiverNames(e.target.value)}
          placeholder={t('app.kuaiplm.productionFile.fields.receiversPlaceholder')}
        />
      </Modal>
    </>
  );
};

export default ProductionFilesPage;
