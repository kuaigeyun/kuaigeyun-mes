/**
 * 实验委托列表（R-02）
 * 路由 /apps/kuaiplm/lab-requests ；待检看板 /lab-board
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
  ProForm,
  ProFormDateTimePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Col,
  Descriptions,
  Form as AntForm,
  Input,
  InputNumber,
  Modal,
  Result,
  Row,
  Select,
  Table,
  Upload,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DescriptionsProps } from 'antd';
import { ThemedSegmented } from '../../../../components/themed-segmented';
import { DictionaryLabel } from '../../../../components/dictionary-label';
import { UniMaterialSelect } from '../../../../components/uni-material-select';
import { UniTable } from '../../../../components/uni-table';
import { UniTableDetail } from '../../../../components/uni-table-detail';
import {
  rowActionKind,
  rowActionLabelKeep,
  rowActionCompileLabReport,
  rowActionSubmitLabReport,
  rowActionApproveLabReport,
  rowActionRejectLabReport,
  rowActionViewLabReport,
  rowActionDownloadLabReport,
} from '../../../../components/uni-action';
import {
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  detailDrawerBasicColumn,
} from '../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { getDepartmentTree, type DepartmentTreeItem } from '../../../../services/department';
import { searchUserDisplay } from '../../../../services/user';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { formatDateTimeBySiteSetting } from '../../../../utils/format';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../constants/statusBadges';
import { formatUserDisplayLabel } from '../../../../utils/userDisplay';
import { resolveSystemDictionaryValueLabel } from '../../../../utils/systemDictionaryI18n';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { CustomerSelectDropdown } from '../../../master-data/components/CustomerSelectDropdown';
import {
  buildLabRequestExtensionPayload,
  flattenLabRequestForForm,
  formatLabRequestYesNo,
  getLabRequestExtensionValue,
  resolveLabRequestFieldVisibility,
  stripLabRequestExtensionFormValues,
  type LabRequestOutsourceCertLine,
} from '../../utils/labRequestExtension';
import {
  labRequestApi,
  type LabRequest,
  type LabRequestMeasureItem,
  type LabRequestStatus,
} from '../../services/lab-request';
import { listRdProjects } from '../../services/rd-project';
import { getFileByUuid, getFileDownloadUrlWithToken, uploadFile } from '../../../../services/file';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  getDictionaryOptions,
  getDictionaryOptionsSync,
  supplierApi,
} from '../../../master-data/services/supply-chain';

const LAB_REPORT_FILE_CATEGORY = 'lab-report';

function labReportHasDocument(row: Pick<LabRequest, 'report_url' | 'report_file_uuid'>): boolean {
  return Boolean(
    String(row.report_url || '').trim() || String(row.report_file_uuid || '').trim(),
  );
}

/** 非状态 MarkerTag 色：优先级 */
function labPriorityMarkerColor(priority?: string | null): string {
  return (priority || 'normal') === 'urgent' ? 'error' : 'processing';
}

/** 非状态 MarkerTag 色：委托类型（区分种类，勿抢流程状态 solid） */
function labBusinessTypeMarkerColor(businessType?: string | null): string {
  switch (String(businessType || '').trim()) {
    case 'iqc':
      return 'cyan';
    case 'rd':
      return 'purple';
    case 'project_material':
      return 'blue';
    case 'project_product':
      return 'geekblue';
    case 'outsource':
      return 'orange';
    case 'general':
      return 'lime';
    default:
      return 'default';
  }
}

/** 非状态 MarkerTag 色：报告编制进度 */
function labReportStatusMarkerColor(reportStatus?: string | null): string {
  switch (String(reportStatus || 'none').trim()) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'draft':
      return 'processing';
    case 'rejected':
      return 'error';
    case 'none':
    default:
      return 'default';
  }
}

type DepartmentOption = { label: string; value: string };

function flattenDepartmentOptions(
  items: DepartmentTreeItem[],
  prefix = '',
): DepartmentOption[] {
  const out: DepartmentOption[] = [];
  for (const item of items) {
    if (item.is_active === false) continue;
    const name = String(item.name ?? '').trim();
    if (!name) continue;
    const label = prefix ? `${prefix} / ${name}` : name;
    out.push({ label, value: name });
    if (item.children?.length) {
      out.push(...flattenDepartmentOptions(item.children, label));
    }
  }
  return out;
}

function flattenDepartmentUuidMap(
  items: DepartmentTreeItem[],
  map: Map<string, string> = new Map(),
): Map<string, string> {
  for (const item of items) {
    if (item.is_active === false) continue;
    const name = String(item.name ?? '').trim();
    if (item.uuid && name) map.set(item.uuid, name);
    if (item.children?.length) flattenDepartmentUuidMap(item.children, map);
  }
  return map;
}

/** 与后端 aggregate_header_judgment 一致：ng > fail > pass > na */
function aggregateLabHeaderJudgment(
  items: LabRequestMeasureItem[],
): string | undefined {
  const normalized = items
    .map((i) => String(i.final_judgment || i.auto_judgment || '').trim().toLowerCase())
    .filter(Boolean);
  if (!normalized.length) return undefined;
  if (normalized.some((j) => j === 'ng')) return 'ng';
  if (normalized.some((j) => j === 'fail')) return 'fail';
  if (normalized.some((j) => j === 'pass')) return 'pass';
  return 'na';
}

function buildDefaultReportTitle(
  row: LabRequest,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const existing = String(row.report_title || '').trim();
  if (existing) return existing;
  const parts = [row.code, row.title, row.material_code || row.material_name]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  if (!parts.length) return t('app.kuaiplm.labRequest.report.defaultTitleFallback');
  return t('app.kuaiplm.labRequest.report.defaultTitle', { subject: parts.join(' ') });
}

function buildDefaultResultSummary(
  row: LabRequest,
  judgmentLabel: (v?: string | null) => string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const existing = String(row.result_summary || '').trim();
  if (existing) return existing;
  const lines: string[] = [];
  if (row.judgment) {
    lines.push(
      t('app.kuaiplm.labRequest.report.summaryHeaderJudgment', {
        judgment: judgmentLabel(row.judgment),
      }),
    );
  }
  for (const m of row.measure_items || []) {
    const name = String(m.item_name || '').trim() || '-';
    const measured = String(m.measured_value || '').trim() || '-';
    const fj = judgmentLabel(m.final_judgment || m.auto_judgment || null);
    lines.push(
      t('app.kuaiplm.labRequest.report.summaryMeasureLine', {
        name,
        measured,
        judgment: fj,
      }),
    );
  }
  return lines.join('\n');
}

function resolveDefaultReportUrl(row: LabRequest): string {
  return String(row.report_url || '').trim();
}

function formatMeasureStandardText(row: {
  standard_value?: string | null;
  standard_min?: string | null;
  standard_max?: string | null;
  unit?: string | null;
  compare_type?: string | null;
}): string {
  const free = String(row.standard_value ?? '').trim();
  if (free) return free;
  const lo = String(row.standard_min ?? '').trim();
  const hi = String(row.standard_max ?? '').trim();
  if (!lo && !hi) return '-';
  const unit = String(row.unit ?? '').trim();
  return `${lo} ~ ${hi}${unit ? ` ${unit}` : ''}`.trim();
}

function composeMeasureStandardForForm(m: LabRequestMeasureItem): string {
  const free = String(m.standard_value ?? '').trim();
  if (free) return free;
  const lo = String(m.standard_min ?? '').trim();
  const hi = String(m.standard_max ?? '').trim();
  const unit = String(m.unit ?? '').trim();
  if (!lo && !hi) return '';
  return `${lo} ~ ${hi}${unit ? ` ${unit}` : ''}`.trim();
}

const LAB_JUDGMENT_VALUES = ['pass', 'fail', 'ng', 'na'] as const;

const RESOURCE = 'kuaiplm:lab-request';
const LAB_REQUEST_BUSINESS_TYPE_DICT = 'LAB_REQUEST_BUSINESS_TYPE';
/** 与后端 `LAB_REQUEST_TYPES` / 系统字典项一致；表单首帧用 locale 标签，避免 DictionarySelect 异步未回时只剩默认一项 */
const LAB_REQUEST_BUSINESS_TYPE_CODES = [
  'iqc',
  'rd',
  'project_material',
  'project_product',
  'outsource',
  'general',
] as const;
const STATUS_KEYS: LabRequestStatus[] = [
  'draft',
  'pending_review',
  'pending',
  'in_lab',
  'completed',
  'rejected',
  'revoked',
];
const EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'code', title: '委托单号' },
  { key: 'title', title: '试验名称' },
  { key: 'business_type_label', title: '类型' },
  { key: 'priority_label', title: '优先级' },
  { key: 'status_label', title: '状态' },
  { key: 'project_code', title: '项目代号' },
  { key: 'material_code', title: '物料编码' },
  { key: 'requester_name', title: '委托人' },
  { key: 'started_at', title: '开始时间' },
  { key: 'expected_complete_at', title: '预计完成' },
  { key: 'judgment', title: '判定' },
  { key: 'has_ng', title: '不合格' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const LabRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const location = useLocation();
  const isBoard = location.pathname.includes('/lab-board');
  const currentUser = useCurrentUser();
  const defaultRequesterName = useMemo(
    () => (currentUser ? formatUserDisplayLabel(currentUser) : undefined),
    [currentUser],
  );
  const defaultDelegateDept = currentUser?.department?.name?.trim() || undefined;
  const perms = useResourcePermissions(RESOURCE);
  const canExecute = !!perms.canAction?.('execute');
  const canComplete = !!perms.canAction?.('complete');
  const canApprove = !!perms.canAction?.('approve');
  const canReject = !!perms.canAction?.('reject');
  const canSubmit = !!perms.canAction?.('submit');
  const canRevoke = !!perms.canAction?.('revoke');

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<LabRequest[]>([]);
  const listScopeReadyRef = useRef(false);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LabRequest | null>(null);
  const [detail, setDetail] = useState<LabRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [listScope, setListScope] = useState<'all' | 'mine'>('all');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<LabRequest | null>(null);
  const [completeSummary, setCompleteSummary] = useState('');
  const [completeJudgment, setCompleteJudgment] = useState('pass');
  const [completeMeasureDraft, setCompleteMeasureDraft] = useState<Record<number, string>>({});
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [measureDraft, setMeasureDraft] = useState<Record<number, string>>({});
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideItem, setOverrideItem] = useState<LabRequestMeasureItem | null>(null);
  const [overrideJudgment, setOverrideJudgment] = useState('ng');
  const [overrideReason, setOverrideReason] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<LabRequest | null>(null);
  const reportTargetRef = useRef<LabRequest | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [reportFileUuid, setReportFileUuid] = useState<string | null>(null);
  const [reportFileList, setReportFileList] = useState<UploadFile[]>([]);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [viewReportOpen, setViewReportOpen] = useState(false);
  const [viewReportTarget, setViewReportTarget] = useState<LabRequest | null>(null);
  const [viewReportFileName, setViewReportFileName] = useState('');
  const [viewReportLoading, setViewReportLoading] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<LabRequest | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [reportRejectOpen, setReportRejectOpen] = useState(false);
  const [reportRejectTarget, setReportRejectTarget] = useState<LabRequest | null>(null);
  const [reportRejectReason, setReportRejectReason] = useState('');
  const [reportRejectSubmitting, setReportRejectSubmitting] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceValue, setPriceValue] = useState<number | null>(null);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<
    { label: string; value: string }[]
  >(() => getDictionaryOptionsSync(LAB_REQUEST_BUSINESS_TYPE_DICT) ?? []);
  const businessTypeSelectOptions = useMemo(() => {
    if (businessTypeOptions.length > 0) return businessTypeOptions;
    return LAB_REQUEST_BUSINESS_TYPE_CODES.map((value) => ({
      value,
      label:
        resolveSystemDictionaryValueLabel(LAB_REQUEST_BUSINESS_TYPE_DICT, value, t) ?? value,
    }));
  }, [businessTypeOptions, t]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const departmentByUuidRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    void getDictionaryOptions(LAB_REQUEST_BUSINESS_TYPE_DICT)
      .then(setBusinessTypeOptions)
      .catch(() => setBusinessTypeOptions([]));
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    void getDepartmentTree({ is_active: true })
      .then((res) => {
        const items = res.items ?? [];
        setDepartmentOptions(flattenDepartmentOptions(items));
        departmentByUuidRef.current = flattenDepartmentUuidMap(items);
      })
      .catch(() => {
        setDepartmentOptions([]);
        departmentByUuidRef.current = new Map();
      });
  }, [modalOpen]);

  useEffect(() => {
    if (isBoard) return;
    if (!listScopeReadyRef.current) {
      listScopeReadyRef.current = true;
      return;
    }
    actionRef.current?.reload();
  }, [listScope, isBoard]);

  const typeLabel = useCallback(
    (v?: string) => {
      const code = (v || 'general').trim();
      const hit = businessTypeOptions.find((o) => o.value === code);
      if (hit?.label) return hit.label;
      return t(`app.kuaiplm.labRequest.type.${code}`, { defaultValue: code });
    },
    [businessTypeOptions, t],
  );
  const businessTypeValueEnum = useMemo(
    () =>
      Object.fromEntries(
        businessTypeOptions.map((o) => [o.value, { text: o.label }]),
      ),
    [businessTypeOptions],
  );
  const statusLabel = useCallback(
    (v?: string) => t(`app.kuaiplm.labRequest.status.${v || 'draft'}`),
    [t],
  );
  const judgmentLabel = useCallback(
    (v?: string | null) =>
      v ? t(`app.kuaiplm.labRequest.judgment.${v}`, { defaultValue: v }) : '-',
    [t],
  );
  const reportStatusLabel = useCallback(
    (v?: string | null) =>
      t(`app.kuaiplm.labRequest.reportStatus.${v || 'none'}`, { defaultValue: v || '-' }),
    [t],
  );

  const openDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const row = await labRequestApi.get(id);
      setDetail(row);
      const draft: Record<number, string> = {};
      (row.measure_items || []).forEach((item) => {
        if (item.id != null) draft[item.id] = item.measured_value || '';
      });
      setMeasureDraft(draft);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openEdit = useCallback(async (row: LabRequest) => {
    if (row.id == null) return;
    try {
      const full = await labRequestApi.get(row.id);
      setEditing(full);
      setModalOpen(true);
    } catch (e) {
      messageApi.error(getApiErrorMessage(e));
    }
  }, [messageApi]);

  const openComplete = useCallback(
    async (row: LabRequest) => {
      if (row.id == null) return;
      try {
        const full = await labRequestApi.get(row.id);
        const items = full.measure_items || [];
        const draft: Record<number, string> = {};
        items.forEach((item) => {
          if (item.id != null) draft[item.id] = item.measured_value || '';
        });
        setCompleteTarget(full);
        setCompleteMeasureDraft(draft);
        setCompleteSummary(full.result_summary || '');
        setCompleteJudgment(
          full.judgment ||
            aggregateLabHeaderJudgment(items) ||
            'pass',
        );
        setCompleteOpen(true);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [messageApi],
  );

  const openReport = useCallback(
    async (row: LabRequest) => {
      if (row.id == null) return;
      try {
        const full = await labRequestApi.get(row.id);
        if (full.status !== 'in_lab' && full.status !== 'completed') {
          messageApi.error(t('app.kuaiplm.labRequest.messages.reportNotEditableStatus'));
          return;
        }
        const rs = full.report_status || 'none';
        if (rs === 'pending') {
          messageApi.error(t('app.kuaiplm.labRequest.messages.reportPendingLocked'));
          return;
        }
        if (rs === 'approved' && labReportHasDocument(full)) {
          messageApi.error(t('app.kuaiplm.labRequest.messages.reportApprovedLocked'));
          return;
        }
        setReportTarget(full);
        reportTargetRef.current = full;
        setReportTitle(buildDefaultReportTitle(full, t));
        setReportSummary(buildDefaultResultSummary(full, judgmentLabel, t));
        setReportUrl(resolveDefaultReportUrl(full));
        const fileUuid = String(full.report_file_uuid || '').trim();
        setReportFileUuid(fileUuid || null);
        if (fileUuid) {
          let fileName = t('app.kuaiplm.labRequest.fields.reportAttachment');
          try {
            const meta = await getFileByUuid(fileUuid);
            fileName = meta.original_name || meta.name || fileName;
          } catch {
            /* 列表名失败仍展示占位 */
          }
          setReportFileList([
            {
              uid: fileUuid,
              name: fileName,
              status: 'done',
            },
          ]);
        } else {
          setReportFileList([]);
        }
        setReportOpen(true);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [judgmentLabel, messageApi, t],
  );

  const persistReport = useCallback(
    async (mode: 'draft' | 'submit') => {
      const target = reportTargetRef.current;
      if (target?.id == null) return;
      const hasDoc = Boolean(
        String(reportFileUuid || '').trim() || String(reportUrl || '').trim(),
      );
      // 仅「提交审批」与「已批准补传」需要文件；普通保存草稿可不传，后续再补
      if (mode === 'submit' && !hasDoc) {
        messageApi.error(t('app.kuaiplm.labRequest.messages.reportDocumentRequired'));
        return;
      }
      if (mode === 'draft' && (target.report_status || 'none') === 'approved' && !hasDoc) {
        messageApi.error(t('app.kuaiplm.labRequest.messages.reportDocumentRequiredForPatch'));
        return;
      }
      setReportSubmitting(true);
      try {
        const payload = {
          report_title: reportTitle,
          result_summary: reportSummary,
          report_url: reportUrl || undefined,
          report_file_uuid: reportFileUuid || undefined,
        };
        const updated =
          mode === 'submit'
            ? await labRequestApi.submitReport(target.id, payload)
            : await labRequestApi.saveReport(target.id, payload);
        setReportTarget(updated);
        reportTargetRef.current = updated;
        if (detail?.id === updated.id) {
          setDetail(updated);
        }
        setReportOpen(false);
        setReportTarget(null);
        reportTargetRef.current = null;
        messageApi.success(
          mode === 'submit'
            ? t('app.kuaiplm.labRequest.messages.reportSubmitted')
            : t('app.kuaiplm.labRequest.messages.reportSaved'),
        );
        actionRef.current?.reload();
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      } finally {
        setReportSubmitting(false);
      }
    },
    [detail?.id, messageApi, reportFileUuid, reportSummary, reportTitle, reportUrl, t],
  );

  const openViewReport = useCallback(
    async (row: LabRequest) => {
      if (row.id == null) return;
      setViewReportLoading(true);
      try {
        const full = await labRequestApi.get(row.id);
        if ((full.report_status || 'none') !== 'approved') {
          messageApi.error(t('app.kuaiplm.labRequest.messages.reportNotApprovedYet'));
          return;
        }
        if (!labReportHasDocument(full)) {
          messageApi.error(t('app.kuaiplm.labRequest.messages.reportNoDownloadable'));
          return;
        }
        const fileUuid = String(full.report_file_uuid || '').trim();
        let fileName = '';
        if (fileUuid) {
          try {
            const meta = await getFileByUuid(fileUuid);
            fileName = meta.original_name || meta.name || '';
          } catch {
            fileName = t('app.kuaiplm.labRequest.fields.reportAttachment');
          }
        }
        setViewReportTarget(full);
        setViewReportFileName(fileName);
        setViewReportOpen(true);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      } finally {
        setViewReportLoading(false);
      }
    },
    [messageApi, t],
  );

  const openLabReportDocument = useCallback(
    async (row: LabRequest) => {
      const fileUuid = String(row.report_file_uuid || '').trim();
      if (fileUuid) {
        const url = await getFileDownloadUrlWithToken(fileUuid);
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      const link = String(row.report_url || '').trim();
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
        return;
      }
      messageApi.error(t('app.kuaiplm.labRequest.messages.reportNoDownloadable'));
    },
    [messageApi, t],
  );

  const downloadLabReport = useCallback(
    async (row: LabRequest) => {
      if (row.id == null) return;
      try {
        const full = labReportHasDocument(row) ? row : await labRequestApi.get(row.id);
        if ((full.report_status || 'none') !== 'approved') {
          messageApi.error(t('app.kuaiplm.labRequest.messages.reportNotApprovedYet'));
          return;
        }
        await openLabReportDocument(full);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [messageApi, openLabReportDocument, t],
  );

  const judgmentSelectOptions = useMemo(
    () =>
      LAB_JUDGMENT_VALUES.map((value) => ({
        value,
        label: t(`app.kuaiplm.labRequest.judgment.${value}`),
      })),
    [t],
  );

  const planColumns = useMemo<ColumnsType>(
    () => [
      {
        title: t('app.kuaiplm.labRequest.measure.itemName'),
        dataIndex: 'item_name',
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'item_name']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="small" placeholder={t('app.kuaiplm.labRequest.measure.itemNamePlaceholder')} />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.standard'),
        dataIndex: 'standard_value',
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'standard_value']} style={{ marginBottom: 0 }}>
            <Input size="small" placeholder={t('app.kuaiplm.labRequest.measure.standardPlaceholder')} />
          </AntForm.Item>
        ),
      },
    ],
    [t],
  );

  const certColumns = useMemo<ColumnsType>(
    () => [
      {
        title: t('app.kuaiplm.labRequest.cert.certName'),
        dataIndex: 'cert_name',
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'cert_name']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.cert.fee'),
        dataIndex: 'fee',
        width: 140,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'fee']} style={{ marginBottom: 0 }}>
            <InputNumber size="small" min={0} precision={2} style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
    ],
    [t],
  );

  const payerLabel = useCallback(
    (v?: unknown) => {
      const key = String(v || '').trim();
      if (!key) return '-';
      return t(`app.kuaiplm.labRequest.payer.${key}`, { defaultValue: key });
    },
    [t],
  );

  const columns = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaiplm.labRequest.fields.code'),
            dataIndex: 'code',
            key: 'code',
            copyable: true,
            width: 128,
            minWidth: 128,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.title'),
            dataIndex: 'title',
            key: 'title',
            minWidth: 160,
            uniTablePrimaryFlex: true,
            uniTableRemainderFlex: true,
            ellipsis: true,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.businessType'),
            dataIndex: 'business_type',
            key: 'business_type',
            valueEnum: businessTypeValueEnum,
            render: (_, row) => (
              <MarkerTag variant="filled" color={labBusinessTypeMarkerColor(row.business_type)}>
                <DictionaryLabel
                  dictionaryCode={LAB_REQUEST_BUSINESS_TYPE_DICT}
                  value={row.business_type}
                  notFoundPlaceholder={typeLabel(row.business_type)}
                />
              </MarkerTag>
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.priority'),
            dataIndex: 'priority',
            key: 'priority',
            hideInSearch: !isBoard,
            render: (_, row) => (
              <MarkerTag variant="filled" color={labPriorityMarkerColor(row.priority)}>
                {t(`app.kuaiplm.labRequest.priority.${row.priority || 'normal'}`)}
              </MarkerTag>
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.ngFlag'),
            dataIndex: 'has_ng',
            key: 'has_ng',
            hideInSearch: true,
            render: (_, row) =>
              row.has_ng ? (
                <MarkerTag variant="filled" color="error">
                  {t('app.kuaiplm.labRequest.fields.ngYes')}
                </MarkerTag>
              ) : (
                '-'
              ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.reportStatus'),
            dataIndex: 'report_status',
            key: 'report_status',
            hideInSearch: true,
            render: (_, row) => (
              <MarkerTag
                variant="filled"
                color={labReportStatusMarkerColor(row.report_status)}
              >
                {reportStatusLabel(row.report_status)}
              </MarkerTag>
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.projectCode'),
            dataIndex: 'project_code',
            key: 'project_code',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.materialCode'),
            dataIndex: 'material_code',
            key: 'material_code',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.startedAt'),
            dataIndex: 'started_at',
            key: 'started_at',
            width: 168,
            minWidth: 168,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, row) => formatDateTimeBySiteSetting(row.started_at) || '-',
          },
          {
            title: t('app.kuaiplm.labRequest.fields.expectedCompleteAt'),
            dataIndex: 'expected_complete_at',
            key: 'expected_complete_at',
            width: 168,
            minWidth: 168,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, row) => formatDateTimeBySiteSetting(row.expected_complete_at) || '-',
          },
          ...buildDocumentAuditColumns(t),
          {
            title: t('common.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            valueEnum: Object.fromEntries(STATUS_KEYS.map((k) => [k, { text: statusLabel(k) }])),
            hideInSearch: isBoard,
            render: (_, row) =>
              renderDocumentStatusTag(statusLabel(row.status), row.status || 'draft'),
          },
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              <Button
                key="detail"
                {...rowActionKind('read')}
                onClick={() => row.id != null && void openDetail(row.id)}
              />,
              perms.canUpdate && (row.status === 'draft' || row.status === 'rejected') ? (
                <Button
                  key="edit"
                  {...rowActionKind('update')}
                  onClick={() => void openEdit(row)}
                />
              ) : null,
              canSubmit && (row.status === 'draft' || row.status === 'rejected') ? (
                <Button
                  key="submit"
                  {...rowActionKind('submit')}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.submitSuccess'));
                    actionRef.current?.reload();
                  }}
                />
              ) : null,
              canApprove && row.status === 'pending_review' ? (
                <Button
                  key="approve"
                  {...rowActionKind('approve')}
                  onClick={async () => {
                    if (row.id == null) return;
                    try {
                      await labRequestApi.approve(row.id);
                      messageApi.success(t('app.kuaiplm.labRequest.messages.approveSuccess'));
                      actionRef.current?.reload();
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                />
              ) : null,
              canExecute && row.status === 'pending' ? (
                <Button
                  key="accept"
                  {...rowActionKind('execute')}
                  {...rowActionLabelKeep()}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.accept(row.id);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.acceptSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaiplm.labRequest.actions.accept')}
                </Button>
              ) : null,
              canComplete && row.status === 'in_lab' ? (
                <Button
                  key="complete"
                  {...rowActionKind('complete')}
                  {...rowActionLabelKeep()}
                  onClick={() => void openComplete(row)}
                >
                  {t('app.kuaiplm.labRequest.actions.complete')}
                </Button>
              ) : null,
              canExecute &&
              (row.status === 'in_lab' || row.status === 'completed') &&
              row.report_status !== 'pending' ? (
                <Button
                  key="editReport"
                  {...rowActionCompileLabReport('execute')}
                  {...rowActionLabelKeep()}
                  onClick={() => void openReport(row)}
                >
                  {row.report_status === 'approved'
                    ? t('app.kuaiplm.labRequest.actions.reuploadReport')
                    : t('app.kuaiplm.labRequest.actions.editReport')}
                </Button>
              ) : null,
              canSubmit &&
              (row.status === 'in_lab' || row.status === 'completed') &&
              (row.report_status === 'draft' ||
                row.report_status === 'rejected' ||
                row.report_status === 'none' ||
                !row.report_status) ? (
                <Button
                  key="submitReport"
                  {...rowActionSubmitLabReport('submit')}
                  {...rowActionLabelKeep()}
                  onClick={async () => {
                    if (row.id == null) return;
                    try {
                      const full = await labRequestApi.get(row.id);
                      await labRequestApi.submitReport(full.id!, {
                        report_title: full.report_title || undefined,
                        result_summary: full.result_summary || undefined,
                        report_url: full.report_url || undefined,
                        report_file_uuid: full.report_file_uuid || undefined,
                      });
                      messageApi.success(t('app.kuaiplm.labRequest.messages.reportSubmitted'));
                      actionRef.current?.reload();
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                >
                  {t('app.kuaiplm.labRequest.actions.submitReport')}
                </Button>
              ) : null,
              canApprove && row.report_status === 'pending' ? (
                <Button
                  key="approveReport"
                  {...rowActionApproveLabReport('approve')}
                  {...rowActionLabelKeep()}
                  onClick={async () => {
                    if (row.id == null) return;
                    try {
                      await labRequestApi.approveReport(row.id);
                      messageApi.success(t('app.kuaiplm.labRequest.messages.reportApproved'));
                      actionRef.current?.reload();
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                >
                  {t('app.kuaiplm.labRequest.actions.approveReport')}
                </Button>
              ) : null,
              canReject && row.report_status === 'pending' ? (
                <Button
                  key="rejectReport"
                  {...rowActionRejectLabReport('reject')}
                  {...rowActionLabelKeep()}
                  onClick={() => {
                    if (row.id == null) return;
                    setReportRejectTarget(row);
                    setReportRejectReason('');
                    setReportRejectOpen(true);
                  }}
                >
                  {t('app.kuaiplm.labRequest.actions.rejectReport')}
                </Button>
              ) : null,
              perms.canRead && row.report_status === 'approved' ? (
                <Button
                  key="viewReport"
                  {...rowActionViewLabReport('read')}
                  {...rowActionLabelKeep()}
                  onClick={() => void openViewReport(row)}
                >
                  {t('app.kuaiplm.labRequest.actions.viewReport')}
                </Button>
              ) : null,
              perms.canRead && row.report_status === 'approved' ? (
                <Button
                  key="downloadReport"
                  {...rowActionDownloadLabReport('read')}
                  {...rowActionLabelKeep()}
                  onClick={() => void downloadLabReport(row)}
                >
                  {t('app.kuaiplm.labRequest.actions.downloadReport')}
                </Button>
              ) : null,
              canReject &&
              (row.status === 'pending_review' ||
                row.status === 'pending' ||
                row.status === 'in_lab') ? (
                <Button
                  key="reject"
                  {...rowActionKind('reject')}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.rejectSuccess'));
                    actionRef.current?.reload();
                  }}
                />
              ) : null,
              canRevoke &&
              row.status !== 'completed' &&
              row.status !== 'draft' &&
              row.status !== 'revoked' ? (
                <Button
                  key="revoke"
                  {...rowActionKind('revoke')}
                  onClick={() => {
                    if (row.id == null) return;
                    setRevokeTarget(row);
                    setRevokeReason('');
                    setRevokeOpen(true);
                  }}
                />
              ) : null,
              perms.canDelete &&
              (row.status === 'draft' || row.status === 'rejected' || row.status === 'revoked') ? (
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.delete(row.id);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                />
              ) : null,
            ],
          },
        ] as ProColumns<LabRequest>[],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [
      canApprove,
      canComplete,
      canExecute,
      canReject,
      canRevoke,
      canSubmit,
      isBoard,
      messageApi,
      openDetail,
      openEdit,
      openComplete,
      openReport,
      openViewReport,
      downloadLabReport,
      perms.canDelete,
      perms.canUpdate,
      perms.canRead,
      reportStatusLabel,
      statusLabel,
      businessTypeValueEnum,
      t,
      typeLabel,
    ],
  );

  const detailItems = useMemo(() => {
    if (!detail) return [];
    const vis = resolveLabRequestFieldVisibility(detail.business_type);
    const yes = t('common.yes');
    const no = t('common.no');
    const ext = (key: Parameters<typeof getLabRequestExtensionValue>[1]) =>
      getLabRequestExtensionValue(detail, key);
    const certLines = (ext('outsource_cert_lines') as LabRequestOutsourceCertLine[] | undefined) || [];
    return alignDescriptionColumns(
      [
        { key: 'code', label: t('app.kuaiplm.labRequest.fields.code'), children: detail.code },
        { key: 'title', label: t('app.kuaiplm.labRequest.fields.title'), children: detail.title },
        {
          key: 'business_type',
          label: t('app.kuaiplm.labRequest.fields.businessType'),
          children: (
            <DictionaryLabel
              dictionaryCode={LAB_REQUEST_BUSINESS_TYPE_DICT}
              value={detail.business_type}
              notFoundPlaceholder={typeLabel(detail.business_type)}
            />
          ),
        },
        {
          key: 'status',
          label: t('common.status'),
          children: statusLabel(detail.status),
        },
        {
          key: 'judgment',
          label: t('app.kuaiplm.labRequest.fields.judgment'),
          children: judgmentLabel(detail.judgment),
        },
        {
          key: 'report_status',
          label: t('app.kuaiplm.labRequest.fields.reportStatus'),
          children: reportStatusLabel(detail.report_status),
        },
        {
          key: 'report_title',
          label: t('app.kuaiplm.labRequest.fields.reportTitle'),
          children: detail.report_title || '-',
        },
        {
          key: 'report_url',
          label: t('app.kuaiplm.labRequest.fields.reportUrl'),
          children: detail.report_url || '-',
        },
        ...(vis.project
          ? [
              {
                key: 'project_code',
                label: t('app.kuaiplm.labRequest.fields.projectCode'),
                children: detail.project_code || '-',
              },
            ]
          : []),
        {
          key: 'material_code',
          label: t('app.kuaiplm.labRequest.fields.materialCode'),
          children: detail.material_code || '-',
        },
        {
          key: 'material_name',
          label: t('app.kuaiplm.labRequest.fields.materialName'),
          children: detail.material_name || '-',
        },
        ...(vis.customerSupplier
          ? [
              {
                key: 'customer_name',
                label: t('app.kuaiplm.labRequest.fields.customerName'),
                children: String(ext('customer_name') || '-'),
              },
              {
                key: 'supplier_name',
                label: t('app.kuaiplm.labRequest.fields.supplierName'),
                children: String(ext('supplier_name') || '-'),
              },
            ]
          : []),
        {
          key: 'requester_name',
          label: t('app.kuaiplm.labRequest.fields.requesterName'),
          children: detail.requester_name || '-',
        },
        {
          key: 'delegate_dept',
          label: t('app.kuaiplm.labRequest.fields.delegateDept'),
          children: String(ext('delegate_dept') || '-'),
        },
        {
          key: 'test_dept',
          label: t('app.kuaiplm.labRequest.fields.testDept'),
          children: String(ext('test_dept') || '-'),
        },
        ...(vis.iqcSlip
          ? [
              {
                key: 'inspection_slip_no',
                label: t('app.kuaiplm.labRequest.fields.inspectionSlipNo'),
                children: String(ext('inspection_slip_no') || '-'),
              },
            ]
          : []),
        ...(vis.sampleQty
          ? [
              {
                key: 'sample_qty',
                label: t('app.kuaiplm.labRequest.fields.sampleQty'),
                children:
                  ext('sample_qty') != null && ext('sample_qty') !== ''
                    ? String(ext('sample_qty'))
                    : '-',
              },
            ]
          : []),
        ...(vis.provideSample
          ? [
              {
                key: 'provide_sample',
                label: t('app.kuaiplm.labRequest.fields.provideSample'),
                children: formatLabRequestYesNo(ext('provide_sample'), yes, no),
              },
            ]
          : []),
        ...(vis.reportFeedback
          ? [
              {
                key: 'need_report',
                label: t('app.kuaiplm.labRequest.fields.needReport'),
                children: formatLabRequestYesNo(ext('need_report'), yes, no),
              },
              {
                key: 'need_feedback',
                label: t('app.kuaiplm.labRequest.fields.needFeedback'),
                children: formatLabRequestYesNo(ext('need_feedback'), yes, no),
              },
            ]
          : []),
        ...(vis.charge
          ? [
              {
                key: 'charge_required',
                label: t('app.kuaiplm.labRequest.fields.chargeRequired'),
                children: formatLabRequestYesNo(ext('charge_required'), yes, no),
              },
              {
                key: 'charge_amount',
                label: t('app.kuaiplm.labRequest.fields.chargeAmount'),
                children:
                  ext('charge_amount') != null && ext('charge_amount') !== ''
                    ? String(ext('charge_amount'))
                    : '-',
              },
            ]
          : []),
        ...(vis.payer
          ? [
              {
                key: 'payer',
                label: t('app.kuaiplm.labRequest.fields.payer'),
                children: payerLabel(ext('payer')),
              },
            ]
          : []),
        {
          key: 'sample_desc',
          label: t('app.kuaiplm.labRequest.fields.sampleDesc'),
          children: detail.sample_desc || '-',
        },
        {
          key: 'test_items',
          label: t('app.kuaiplm.labRequest.fields.testItems'),
          children: detail.test_items || '-',
        },
        {
          key: 'test_reason',
          label: t('app.kuaiplm.labRequest.fields.testReason'),
          children: detail.test_reason || '-',
        },
        ...(vis.structureElectronics
          ? [
              {
                key: 'structure_special_test',
                label: t('app.kuaiplm.labRequest.fields.structureSpecialTest'),
                children: String(ext('structure_special_test') || '-'),
              },
              {
                key: 'electronics_special_test',
                label: t('app.kuaiplm.labRequest.fields.electronicsSpecialTest'),
                children: String(ext('electronics_special_test') || '-'),
              },
            ]
          : []),
        ...(detail.business_type === 'outsource'
          ? ([
              {
                key: 'outsource_price',
                label: t('app.kuaiplm.labRequest.fields.outsourcePrice'),
                children:
                  detail.outsource_price != null && detail.outsource_price !== ''
                    ? String(detail.outsource_price)
                    : '-',
              },
              {
                key: 'price_filled_by_name',
                label: t('app.kuaiplm.labRequest.fields.priceFilledBy'),
                children: detail.price_filled_by_name || '-',
              },
              {
                key: 'outsource_cert_lines',
                label: t('app.kuaiplm.labRequest.cert.sectionTitle'),
                children: certLines.length
                  ? certLines
                      .map((line) => {
                        const name = String(line.cert_name || '').trim() || '-';
                        const fee =
                          line.fee != null && line.fee !== '' ? String(line.fee) : '-';
                        return `${name}（${fee}）`;
                      })
                      .join('；')
                  : '-',
              },
            ] as ProDescriptionsItemProps[])
          : []),
        {
          key: 'result_summary',
          label: t('app.kuaiplm.labRequest.fields.resultSummary'),
          children: detail.result_summary || '-',
        },
        {
          key: 'started_at',
          label: t('app.kuaiplm.labRequest.fields.startedAt'),
          children: formatDateTimeBySiteSetting(detail.started_at) || '-',
        },
        {
          key: 'expected_complete_at',
          label: t('app.kuaiplm.labRequest.fields.expectedCompleteAt'),
          children: formatDateTimeBySiteSetting(detail.expected_complete_at) || '-',
        },
        {
          key: 'remarks',
          label: t('common.remark'),
          children: detail.remarks || '-',
        },
      ] as ProDescriptionsItemProps[],
      GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
    );
  }, [detail, judgmentLabel, payerLabel, reportStatusLabel, statusLabel, t, typeLabel]);

  const measureTableColumns: ColumnsType<LabRequestMeasureItem> = [
    {
      title: t('app.kuaiplm.labRequest.measure.itemName'),
      dataIndex: 'item_name',
      width: 160,
    },
    {
      title: t('app.kuaiplm.labRequest.measure.standard'),
      key: 'standard',
      width: 200,
      ellipsis: true,
      render: (_, row) => formatMeasureStandardText(row),
    },
    {
      title: t('app.kuaiplm.labRequest.measure.measuredValue'),
      dataIndex: 'measured_value',
      width: 120,
      render: (_, row) =>
        detail?.status === 'in_lab' && canExecute && row.id != null ? (
          <Input
            size="small"
            value={measureDraft[row.id] ?? ''}
            onChange={(e) =>
              setMeasureDraft((prev) => ({ ...prev, [row.id!]: e.target.value }))
            }
          />
        ) : (
          row.measured_value || '-'
        ),
    },
    {
      title: t('app.kuaiplm.labRequest.measure.finalJudgment'),
      dataIndex: 'final_judgment',
      width: 100,
      render: (v, row) => judgmentLabel((v as string) || (row.auto_judgment as string)),
    },
    {
      title: t('common.actions'),
      key: 'op',
      width: 180,
      render: (_, row) => {
        const fj = (row.final_judgment || row.auto_judgment || '').toLowerCase();
        const canLinkNg =
          canExecute &&
          detail?.status &&
          ['in_lab', 'completed'].includes(detail.status) &&
          row.id != null &&
          (fj === 'ng' || fj === 'fail') &&
          !row.quality_exception_id;
        return (
          <>
            {canExecute &&
            detail?.status &&
            ['in_lab', 'completed'].includes(detail.status) &&
            row.id != null ? (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setOverrideItem(row);
                  setOverrideJudgment(row.manual_judgment || row.final_judgment || 'ng');
                  setOverrideReason(row.manual_reason || '');
                  setOverrideOpen(true);
                }}
              >
                {t('app.kuaiplm.labRequest.actions.override')}
              </Button>
            ) : null}
            {canLinkNg ? (
              <Button
                type="link"
                size="small"
                onClick={async () => {
                  if (detail?.id == null || row.id == null) return;
                  try {
                    const updated = await labRequestApi.linkNgException(detail.id, row.id);
                    setDetail(updated);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.exceptionLinked'));
                    actionRef.current?.reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                {t('app.kuaiplm.labRequest.actions.linkException')}
              </Button>
            ) : null}
            {row.quality_exception_id ? (
              <MarkerTag variant="filled" color="warning">
                {t('app.kuaiplm.labRequest.measure.exceptionLinked')}
              </MarkerTag>
            ) : null}
          </>
        );
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<LabRequest>
        actionRef={actionRef}
        headerTitle={
          isBoard ? t('app.kuaiplm.menu.lab-board') : t('app.kuaiplm.menu.lab-requests')
        }
        permissionResource={RESOURCE}
        columnPersistenceId={
          isBoard ? 'apps.kuaiplm.pages.lab-board-v6' : 'apps.kuaiplm.pages.lab-requests-v6'
        }
        rowKey="id"
        columns={columns}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        beforeSearchButtons={
          !isBoard ? (
            <ThemedSegmented
              surfaceBackground
              size="medium"
              value={listScope}
              onChange={(v) => setListScope(v as 'all' | 'mine')}
              options={[
                { label: t('app.kuaiplm.labRequest.scope.all'), value: 'all' },
                { label: t('app.kuaiplm.labRequest.scope.mine'), value: 'mine' },
              ]}
            />
          ) : undefined
        }
        showCreateButton={!isBoard}
        createButtonText={t('app.kuaiplm.labRequest.createButton')}
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        showExportButton={!!perms.canExport}
        onExport={async () => {
          const items = await fetchAllListItems<LabRequest>(async ({ skip, limit }) => {
            const res = await labRequestApi.list({
              skip,
              limit,
              board: isBoard || undefined,
              mine: !isBoard && listScope === 'mine' ? true : undefined,
            });
            return { items: res.items, total: res.total };
          });
          const rows = items.map((r) => ({
            ...r,
            business_type_label: typeLabel(r.business_type),
            priority_label: t(`app.kuaiplm.labRequest.priority.${r.priority || 'normal'}`),
            status_label: statusLabel(r.status),
            has_ng: r.has_ng ? '是' : '否',
          }));
          downloadRecordsAsXlsx(
            isBoard ? 'lab-board' : 'lab-requests',
            EXPORT_COLUMNS,
            rows as Record<string, unknown>[],
          );
        }}
        request={async (params) => {
          const res = await labRequestApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            keyword: params.keyword,
            status: params.status,
            business_type: params.business_type,
            priority: params.priority,
            board: isBoard || undefined,
            mine: !isBoard && listScope === 'mine' ? true : undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
      />

      <FormModalTemplate
        key={editing?.id ?? 'create'}
        title={
          editing
            ? t('app.kuaiplm.labRequest.editTitle')
            : t('app.kuaiplm.labRequest.createTitle')
        }
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        formRef={formRef}
        grid={false}
        width={MODAL_CONFIG.LARGE_WIDTH}
        modalProps={{ destroyOnHidden: true }}
        initialValues={
          editing
            ? {
                ...flattenLabRequestForForm(editing),
                measure_items: (editing.measure_items || []).map((m, idx) => ({
                  line_no: m.line_no || idx + 1,
                  item_name: m.item_name,
                  standard_value: composeMeasureStandardForForm(m),
                })),
              }
            : {
                business_type: 'general',
                priority: 'normal',
                requester_name: defaultRequesterName,
                ...(defaultDelegateDept ? { delegate_dept: defaultDelegateDept } : {}),
                measure_items: [],
              }
        }
        onFinish={async (values) => {
          try {
            const extension_payload = buildLabRequestExtensionPayload(values);
            const rest = stripLabRequestExtensionFormValues(values);
            const payload = {
              ...rest,
              extension_payload,
              measure_items: (values.measure_items || []).map(
                (row: Record<string, unknown>, idx: number) => ({
                  line_no: idx + 1,
                  item_name: row.item_name,
                  // 纸质申请表：试验标准为自由文本；比较类型用 na，不做自动数值判定
                  standard_value: row.standard_value,
                  compare_type: 'na',
                  item_code: null,
                  unit: null,
                  standard_min: null,
                  standard_max: null,
                  judgment_rule_id: null,
                }),
              ),
            };
            if (editing?.id != null) {
              await labRequestApi.update(editing.id, payload);
            } else {
              await labRequestApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            return false;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.labRequest.fields.title')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="business_type"
              label={t('app.kuaiplm.labRequest.fields.businessType')}
              rules={[{ required: true }]}
              options={businessTypeSelectOptions}
              initialValue="general"
              fieldProps={{
                showSearch: true,
                optionFilterProp: 'label',
                allowClear: false,
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="priority"
              label={t('app.kuaiplm.labRequest.fields.priority')}
              options={[
                { value: 'normal', label: t('app.kuaiplm.labRequest.priority.normal') },
                { value: 'urgent', label: t('app.kuaiplm.labRequest.priority.urgent') },
              ]}
            />
          </Col>
          <ProFormDependency name={['business_type']}>
            {({ business_type }) => {
              const vis = resolveLabRequestFieldVisibility(business_type);
              return (
                <>
                  {/* 项目 / 组织人员 */}
                  {vis.project ? (
                    <Col span={12}>
                      <ProFormSelect
                        name="project_id"
                        label={t('app.kuaiplm.labRequest.fields.projectCode')}
                        showSearch
                        allowClear
                        debounceTime={300}
                        placeholder={t('common.selectField', {
                          field: t('app.kuaiplm.labRequest.fields.projectCode'),
                        })}
                        request={async ({ keyWords }) => {
                          const res = await listRdProjects({
                            keyword: keyWords?.trim() || undefined,
                            limit: 50,
                            project_type: 'RD',
                          });
                          return (res.items ?? []).map((item) => ({
                            value: item.id,
                            label:
                              `${item.project_code ?? item.id} - ${item.project_name ?? ''}`.trim(),
                            project_code: item.project_code,
                          }));
                        }}
                        fieldProps={{
                          optionFilterProp: 'label',
                          onChange: (_value, option) => {
                            const code = (option as { project_code?: string } | undefined)
                              ?.project_code;
                            formRef.current?.setFieldsValue({
                              project_code: code || undefined,
                            });
                          },
                        }}
                      />
                      <ProFormText name="project_code" hidden />
                    </Col>
                  ) : null}
                  <Col span={12}>
                    <ProFormSelect
                      name="requester_name"
                      label={t('app.kuaiplm.labRequest.fields.requesterName')}
                      showSearch
                      allowClear
                      debounceTime={300}
                      placeholder={t('common.selectField', {
                        field: t('app.kuaiplm.labRequest.fields.requesterName'),
                      })}
                      options={
                        defaultRequesterName
                          ? [{ value: defaultRequesterName, label: defaultRequesterName }]
                          : undefined
                      }
                      request={async ({ keyWords }) => {
                        const res = await searchUserDisplay({
                          keyword: keyWords?.trim() || undefined,
                          page_size: 50,
                          host_resource: RESOURCE,
                        });
                        return (res.items ?? []).map((u) => {
                          const label = u.label || formatUserDisplayLabel(u);
                          return {
                            value: label,
                            label,
                            department_uuid: u.department_uuid,
                          };
                        });
                      }}
                      fieldProps={{
                        optionFilterProp: 'label',
                        onChange: (_value, option) => {
                          const deptUuid = (
                            option as { department_uuid?: string | null } | undefined
                          )?.department_uuid;
                          if (!deptUuid) return;
                          const deptName = departmentByUuidRef.current.get(deptUuid);
                          if (deptName) {
                            formRef.current?.setFieldsValue({ delegate_dept: deptName });
                          }
                        },
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormSelect
                      name="delegate_dept"
                      label={t('app.kuaiplm.labRequest.fields.delegateDept')}
                      showSearch
                      allowClear
                      options={departmentOptions}
                      placeholder={t('common.selectField', {
                        field: t('app.kuaiplm.labRequest.fields.delegateDept'),
                      })}
                      fieldProps={{ optionFilterProp: 'label' }}
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormSelect
                      name="test_dept"
                      label={t('app.kuaiplm.labRequest.fields.testDept')}
                      showSearch
                      allowClear
                      options={departmentOptions}
                      placeholder={t('common.selectField', {
                        field: t('app.kuaiplm.labRequest.fields.testDept'),
                      })}
                      fieldProps={{ optionFilterProp: 'label' }}
                    />
                  </Col>
                  {vis.iqcSlip ? (
                    <Col span={12}>
                      <ProFormText
                        name="inspection_slip_no"
                        label={t('app.kuaiplm.labRequest.fields.inspectionSlipNo')}
                      />
                    </Col>
                  ) : null}

                  {/* 物料 / 客商 */}
                  <Col span={12}>
                    <UniMaterialSelect
                      name="material_id"
                      label={t('app.kuaiplm.labRequest.fields.material')}
                      placeholder={t('common.selectField', {
                        field: t('app.kuaiplm.labRequest.fields.material'),
                      })}
                      fillMapping={{
                        material_code: 'mainCode',
                        material_name: 'name',
                      }}
                      fallbackOption={
                        editing?.material_id
                          ? {
                              value: editing.material_id,
                              label:
                                `${editing.material_code ?? ''} - ${editing.material_name ?? ''}`.trim(),
                            }
                          : undefined
                      }
                      showQuickCreate={false}
                      onChange={(value) => {
                        if (value == null) {
                          formRef.current?.setFieldsValue({
                            material_code: undefined,
                            material_name: undefined,
                          });
                        }
                      }}
                    />
                    <ProFormText name="material_code" hidden />
                    <ProFormText name="material_name" hidden />
                  </Col>
                  {vis.customerSupplier ? (
                    <>
                      <Col span={12}>
                        <ProForm.Item
                          name="_customer_id"
                          label={t('app.kuaiplm.labRequest.fields.customerName')}
                          style={{ marginBottom: 24 }}
                        >
                          <CustomerSelectDropdown
                            hostResource={RESOURCE}
                            snapshotNameField="customer_name"
                            style={{ width: '100%' }}
                            onCustomerPick={(customer) => {
                              formRef.current?.setFieldsValue({
                                customer_name: customer?.name ?? undefined,
                              });
                            }}
                          />
                        </ProForm.Item>
                        <ProFormText name="customer_name" hidden />
                      </Col>
                      <Col span={12}>
                        <ProFormSelect
                          name="supplier_name"
                          label={t('app.kuaiplm.labRequest.fields.supplierName')}
                          showSearch
                          allowClear
                          debounceTime={300}
                          placeholder={t('common.selectField', {
                            field: t('app.kuaiplm.labRequest.fields.supplierName'),
                          })}
                          request={async ({ keyWords }) => {
                            const res = await supplierApi.list({
                              keyword: keyWords?.trim() || undefined,
                              limit: 50,
                              isActive: true,
                            });
                            const items = Array.isArray(res)
                              ? res
                              : (res.data ??
                                  (res as { items?: Array<{ name?: string; code?: string }> })
                                    .items ??
                                  []);
                            return items.map((item) => {
                              const name = String(item.name || '').trim();
                              return {
                                value: name,
                                label: `${item.code ?? ''} - ${name}`.trim(),
                              };
                            });
                          }}
                          fieldProps={{ optionFilterProp: 'label' }}
                        />
                      </Col>
                    </>
                  ) : null}
                  {vis.payer ? (
                    <Col span={12}>
                      <ProFormSelect
                        name="payer"
                        label={t('app.kuaiplm.labRequest.fields.payer')}
                        allowClear
                        options={[
                          {
                            value: 'company',
                            label: t('app.kuaiplm.labRequest.payer.company'),
                          },
                          {
                            value: 'supplier',
                            label: t('app.kuaiplm.labRequest.payer.supplier'),
                          },
                          {
                            value: 'customer',
                            label: t('app.kuaiplm.labRequest.payer.customer'),
                          },
                        ]}
                        placeholder={t('common.selectField', {
                          field: t('app.kuaiplm.labRequest.fields.payer'),
                        })}
                      />
                    </Col>
                  ) : null}

                  {/* 计划 / 样品 */}
                  <Col span={12}>
                    <ProFormDateTimePicker
                      name="expected_complete_at"
                      label={t('app.kuaiplm.labRequest.fields.expectedCompleteAt')}
                      fieldProps={{ style: { width: '100%' } }}
                    />
                  </Col>
                  {vis.sampleQty ? (
                    <Col span={12}>
                      <ProFormDigit
                        name="sample_qty"
                        label={t('app.kuaiplm.labRequest.fields.sampleQty')}
                        min={0}
                        fieldProps={{ precision: 0 }}
                      />
                    </Col>
                  ) : null}
                  <Col span={12}>
                    <ProFormTextArea
                      name="sample_desc"
                      label={t('app.kuaiplm.labRequest.fields.sampleDesc')}
                      fieldProps={{ rows: 1 }}
                    />
                  </Col>
                  {vis.provideSample ? (
                    <Col span={12}>
                      <ProFormSwitch
                        name="provide_sample"
                        label={t('app.kuaiplm.labRequest.fields.provideSample')}
                      />
                    </Col>
                  ) : null}

                  {/* 试验说明 */}
                  <Col span={12}>
                    <ProFormTextArea
                      name="test_items"
                      label={t('app.kuaiplm.labRequest.fields.testItems')}
                      fieldProps={{ rows: 1 }}
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormTextArea
                      name="test_reason"
                      label={t('app.kuaiplm.labRequest.fields.testReason')}
                      fieldProps={{ rows: 1 }}
                    />
                  </Col>
                  {vis.structureElectronics ? (
                    <>
                      <Col span={12}>
                        <ProFormTextArea
                          name="structure_special_test"
                          label={t('app.kuaiplm.labRequest.fields.structureSpecialTest')}
                          fieldProps={{ rows: 1 }}
                        />
                      </Col>
                      <Col span={12}>
                        <ProFormTextArea
                          name="electronics_special_test"
                          label={t('app.kuaiplm.labRequest.fields.electronicsSpecialTest')}
                          fieldProps={{ rows: 1 }}
                        />
                      </Col>
                    </>
                  ) : null}

                  {/* 交付要求（紧挨试验项与标准） */}
                  {vis.reportFeedback ? (
                    <>
                      <Col span={12}>
                        <ProFormSwitch
                          name="need_report"
                          label={t('app.kuaiplm.labRequest.fields.needReport')}
                        />
                      </Col>
                      <Col span={12}>
                        <ProFormSwitch
                          name="need_feedback"
                          label={t('app.kuaiplm.labRequest.fields.needFeedback')}
                        />
                      </Col>
                    </>
                  ) : null}
                  {vis.charge ? (
                    <>
                      <Col span={12}>
                        <ProFormSwitch
                          name="charge_required"
                          label={t('app.kuaiplm.labRequest.fields.chargeRequired')}
                        />
                      </Col>
                      <ProFormDependency name={['charge_required']}>
                        {({ charge_required }) =>
                          charge_required ? (
                            <Col span={12}>
                              <ProFormDigit
                                name="charge_amount"
                                label={t('app.kuaiplm.labRequest.fields.chargeAmount')}
                                min={0}
                                fieldProps={{ precision: 2 }}
                              />
                            </Col>
                          ) : null
                        }
                      </ProFormDependency>
                    </>
                  ) : null}
                </>
              );
            }}
          </ProFormDependency>
        </Row>
        <UniTableDetail
          name="measure_items"
          title={t('app.kuaiplm.labRequest.measure.sectionTitle')}
          required={false}
          columns={planColumns}
          addText={t('app.kuaiplm.labRequest.measure.addItem')}
          initialValue={{
            item_name: '',
            standard_value: '',
          }}
          tableProps={{ size: 'small', style: { width: '100%', margin: 0 } }}
        />
        <ProFormDependency name={['business_type']}>
          {({ business_type }) =>
            resolveLabRequestFieldVisibility(business_type).outsourceCert ? (
              <UniTableDetail
                name="outsource_cert_lines"
                title={t('app.kuaiplm.labRequest.cert.sectionTitle')}
                required={false}
                columns={certColumns}
                addText={t('app.kuaiplm.labRequest.cert.addLine')}
                initialValue={{ cert_name: '', fee: undefined }}
                tableProps={{ size: 'small', style: { width: '100%', margin: 0 } }}
              />
            ) : null
          }
        </ProFormDependency>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="remarks"
              label={t('common.remark')}
              fieldProps={{ rows: 2 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail || detailLoading || !!detailError}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.code || t('app.kuaiplm.menu.lab-requests')}
        loading={detailLoading}
        basic={
          detailError ? (
            <Result
              status="error"
              title={detailError}
              extra={
                <Button onClick={() => detail?.id != null && void openDetail(detail.id)}>
                  {t('common.retry')}
                </Button>
              }
            />
          ) : detail ? (
            <Descriptions
              size="small"
              column={detailDrawerBasicColumn(false)}
              items={detailItems as DescriptionsProps['items']}
            />
          ) : null
        }
        lines={
          detail && !detailError ? (
            <>
              {detail.status === 'in_lab' && canExecute ? (
                <div style={{ marginBottom: 8, textAlign: 'right' }}>
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (detail.id == null) return;
                      try {
                        const items = (detail.measure_items || [])
                          .filter((m) => m.id != null)
                          .map((m) => ({
                            id: m.id!,
                            measured_value: measureDraft[m.id!] ?? m.measured_value ?? '',
                          }));
                        const updated = await labRequestApi.saveMeasures(detail.id, items);
                        setDetail(updated);
                        messageApi.success(t('app.kuaiplm.labRequest.messages.measureSaved'));
                        actionRef.current?.reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.saveMeasures')}
                  </Button>
                </div>
              ) : null}
              <Table
                size="small"
                rowKey={(r) => String(r.id ?? r.line_no)}
                pagination={false}
                dataSource={detail.measure_items || []}
                columns={measureTableColumns}
                locale={{ emptyText: t('app.kuaiplm.labRequest.measure.empty') }}
                style={{ width: '100%', margin: 0 }}
              />
            </>
          ) : null
        }
        supplementary={
          detail && !detailError ? (
            <div>
              <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.business_type === 'outsource' &&
                detail.status === 'pending' &&
                perms.canUpdate &&
                (detail.outsource_price == null || detail.outsource_price === '') ? (
                  <Button
                    type="primary"
                    onClick={() => {
                      setPriceValue(null);
                      setPriceOpen(true);
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.fillOutsourcePrice')}
                  </Button>
                ) : null}
                {(detail.status === 'in_lab' || detail.status === 'completed') &&
                canExecute &&
                detail.report_status !== 'pending' ? (
                  <Button onClick={() => void openReport(detail)}>
                    {detail.report_status === 'approved'
                      ? t('app.kuaiplm.labRequest.actions.reuploadReport')
                      : t('app.kuaiplm.labRequest.actions.editReport')}
                  </Button>
                ) : null}
                {(detail.status === 'in_lab' || detail.status === 'completed') &&
                canSubmit &&
                detail.report_status !== 'pending' &&
                detail.report_status !== 'approved' ? (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (detail.id == null) return;
                      try {
                        const updated = await labRequestApi.submitReport(detail.id, {
                          report_title: detail.report_title || undefined,
                          result_summary: detail.result_summary || undefined,
                          report_url: detail.report_url || undefined,
                          report_file_uuid: detail.report_file_uuid || undefined,
                        });
                        setDetail(updated);
                        messageApi.success(t('app.kuaiplm.labRequest.messages.reportSubmitted'));
                        actionRef.current?.reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.submitReport')}
                  </Button>
                ) : null}
                {canApprove && detail.report_status === 'pending' ? (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (detail.id == null) return;
                      try {
                        const updated = await labRequestApi.approveReport(detail.id);
                        setDetail(updated);
                        messageApi.success(t('app.kuaiplm.labRequest.messages.reportApproved'));
                        actionRef.current?.reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.approveReport')}
                  </Button>
                ) : null}
                {canReject && detail.report_status === 'pending' ? (
                  <Button
                    danger
                    onClick={() => {
                      if (detail.id == null) return;
                      setReportRejectTarget(detail);
                      setReportRejectReason('');
                      setReportRejectOpen(true);
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.rejectReport')}
                  </Button>
                ) : null}
                {perms.canRead && detail.report_status === 'approved' ? (
                  <Button onClick={() => void openViewReport(detail)}>
                    {t('app.kuaiplm.labRequest.actions.viewReport')}
                  </Button>
                ) : null}
                {perms.canRead && detail.report_status === 'approved' ? (
                  <Button type="primary" onClick={() => void downloadLabReport(detail)}>
                    {t('app.kuaiplm.labRequest.actions.downloadReport')}
                  </Button>
                ) : null}
              </div>
              <div>
                {t('app.kuaiplm.labRequest.fields.reportStatus')}:{' '}
                {reportStatusLabel(detail.report_status)}
              </div>
              {detail.report_reject_reason ? (
                <div>
                  {t('app.kuaiplm.labRequest.fields.reportRejectReason')}:{' '}
                  {detail.report_reject_reason}
                </div>
              ) : null}
              {detail.report_approved_by_name ? (
                <div>
                  {t('app.kuaiplm.labRequest.fields.reportApprovedBy')}:{' '}
                  {detail.report_approved_by_name}
                </div>
              ) : null}
            </div>
          ) : null
        }
        supplementaryTitle={t('app.kuaiplm.labRequest.report.sectionTitle')}
      />

      <Modal
        title={t('app.kuaiplm.labRequest.actions.fillOutsourcePrice')}
        open={priceOpen}
        onCancel={() => setPriceOpen(false)}
        onOk={async () => {
          if (detail?.id == null || priceValue == null || priceValue <= 0) {
            messageApi.warning(t('app.kuaiplm.labRequest.messages.outsourcePriceRequired'));
            return;
          }
          try {
            const updated = await labRequestApi.fillOutsourcePrice(detail.id, priceValue);
            setDetail(updated);
            messageApi.success(t('common.saveSuccess'));
            setPriceOpen(false);
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
        destroyOnHidden
      >
        <div style={{ marginBottom: 8 }}>{t('app.kuaiplm.labRequest.fields.outsourcePrice')}</div>
        <InputNumber
          style={{ width: '100%' }}
          min={0.0001}
          precision={4}
          value={priceValue}
          onChange={(v) => setPriceValue(typeof v === 'number' ? v : null)}
        />
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.complete')}
        open={completeOpen}
        confirmLoading={completeSubmitting}
        onCancel={() => {
          if (completeSubmitting) return;
          setCompleteOpen(false);
        }}
        onOk={async () => {
          if (completeTarget?.id == null) return;
          const items = completeTarget.measure_items || [];
          const hasMeasures = items.length > 0;
          if (!hasMeasures && !completeJudgment) {
            messageApi.error(t('app.kuaiplm.labRequest.messages.judgmentRequired'));
            return;
          }
          setCompleteSubmitting(true);
          try {
            let headerAfterSave = completeTarget;
            if (hasMeasures) {
              const payload = items
                .filter((m) => m.id != null)
                .map((m) => ({
                  id: m.id!,
                  measured_value: completeMeasureDraft[m.id!] ?? m.measured_value ?? '',
                }));
              headerAfterSave = await labRequestApi.saveMeasures(completeTarget.id, payload);
              setCompleteTarget(headerAfterSave);
              const savedItems = headerAfterSave.measure_items || [];
              const draft: Record<number, string> = {};
              savedItems.forEach((item) => {
                if (item.id != null) draft[item.id] = item.measured_value || '';
              });
              setCompleteMeasureDraft(draft);
              setCompleteJudgment(
                headerAfterSave.judgment ||
                  aggregateLabHeaderJudgment(savedItems) ||
                  completeJudgment,
              );
            }
            await labRequestApi.complete(completeTarget.id, {
              result_summary: completeSummary || undefined,
              // 有试验项时整单判定由后端按行汇总，禁止手填覆盖
              judgment: hasMeasures ? undefined : completeJudgment,
            });
            messageApi.success(t('app.kuaiplm.labRequest.messages.completeSuccess'));
            setCompleteOpen(false);
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          } finally {
            setCompleteSubmitting(false);
          }
        }}
        destroyOnHidden
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        {(() => {
          const items = completeTarget?.measure_items || [];
          const hasMeasures = items.length > 0;
          const headerJudgment =
            completeTarget?.judgment ||
            aggregateLabHeaderJudgment(items) ||
            completeJudgment;
          if (hasMeasures) {
            return (
              <>
                <div
                  style={{
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    borderRadius: 6,
                    background: '#f7f8fa',
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  {t('app.kuaiplm.labRequest.messages.completeByMeasuresHint')}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>
                    {t('app.kuaiplm.labRequest.fields.judgment')}
                  </div>
                  <strong>{judgmentLabel(headerJudgment)}</strong>
                </div>
                <Table
                  size="small"
                  rowKey={(r) => String(r.id ?? r.line_no)}
                  pagination={false}
                  style={{ marginBottom: 12 }}
                  dataSource={items}
                  columns={[
                    {
                      title: t('app.kuaiplm.labRequest.measure.itemName'),
                      dataIndex: 'item_name',
                      ellipsis: true,
                    },
                    {
                      title: t('app.kuaiplm.labRequest.measure.standard'),
                      key: 'standard',
                      width: 160,
                      ellipsis: true,
                      render: (_, row) => formatMeasureStandardText(row),
                    },
                    {
                      title: t('app.kuaiplm.labRequest.measure.measuredValue'),
                      dataIndex: 'measured_value',
                      width: 120,
                      render: (_, row) =>
                        row.id != null ? (
                          <Input
                            size="small"
                            value={completeMeasureDraft[row.id] ?? ''}
                            onChange={(e) =>
                              setCompleteMeasureDraft((prev) => ({
                                ...prev,
                                [row.id!]: e.target.value,
                              }))
                            }
                            disabled={completeSubmitting}
                          />
                        ) : (
                          '-'
                        ),
                    },
                    {
                      title: t('app.kuaiplm.labRequest.measure.finalJudgment'),
                      dataIndex: 'final_judgment',
                      width: 100,
                      render: (v, row) =>
                        judgmentLabel(
                          (v as string) || (row.auto_judgment as string) || null,
                        ),
                    },
                  ]}
                />
              </>
            );
          }
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>
                {t('app.kuaiplm.labRequest.fields.judgment')}
              </div>
              <Select
                style={{ width: '100%' }}
                options={judgmentSelectOptions}
                value={completeJudgment}
                onChange={(v) => setCompleteJudgment(v)}
                placeholder={t('common.selectField', {
                  field: t('app.kuaiplm.labRequest.fields.judgment'),
                })}
                disabled={completeSubmitting}
              />
            </div>
          );
        })()}
        <div>
          <div style={{ marginBottom: 4 }}>
            {t('app.kuaiplm.labRequest.fields.resultSummary')}
          </div>
          <Input.TextArea
            rows={4}
            value={completeSummary}
            onChange={(e) => setCompleteSummary(e.target.value)}
            placeholder={t('app.kuaiplm.labRequest.placeholders.resultSummaryOptional')}
            disabled={completeSubmitting}
          />
        </div>
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.override')}
        open={overrideOpen}
        onCancel={() => setOverrideOpen(false)}
        onOk={async () => {
          if (detail?.id == null || overrideItem?.id == null) return;
          if (!overrideReason.trim()) {
            messageApi.error(t('app.kuaiplm.labRequest.messages.overrideReasonRequired'));
            return;
          }
          try {
            const updated = await labRequestApi.overrideMeasure(detail.id, overrideItem.id, {
              judgment: overrideJudgment,
              reason: overrideReason.trim(),
            });
            setDetail(updated);
            setOverrideOpen(false);
            messageApi.success(t('app.kuaiplm.labRequest.messages.overrideSuccess'));
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12 }}>
          <div>{t('app.kuaiplm.labRequest.fields.judgment')}</div>
          <Input
            value={overrideJudgment}
            onChange={(e) => setOverrideJudgment(e.target.value)}
            placeholder="pass / fail / ng / na"
          />
        </div>
        <div>
          <div>{t('app.kuaiplm.labRequest.measure.manualReason')}</div>
          <Input.TextArea
            rows={3}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.editReport')}
        open={reportOpen}
        confirmLoading={reportSubmitting}
        onCancel={() => {
          if (reportSubmitting) return;
          setReportOpen(false);
          setReportTarget(null);
          reportTargetRef.current = null;
        }}
        footer={[
          <Button
            key="cancel"
            htmlType="button"
            disabled={reportSubmitting}
            onClick={() => {
              setReportOpen(false);
              setReportTarget(null);
              reportTargetRef.current = null;
            }}
          >
            {t('common.cancel')}
          </Button>,
          reportTarget?.report_status === 'approved' ? (
            <Button
              key="saveApproved"
              htmlType="button"
              type="primary"
              disabled={reportSubmitting}
              loading={reportSubmitting}
              onClick={() => void persistReport('draft')}
            >
              {t('app.kuaiplm.labRequest.actions.saveReportFile')}
            </Button>
          ) : (
            <>
              <Button
                key="draft"
                htmlType="button"
                type="primary"
                disabled={reportSubmitting}
                loading={reportSubmitting}
                onClick={() => void persistReport('draft')}
              >
                {t('app.kuaiplm.labRequest.actions.saveReportDraft')}
              </Button>
              {canSubmit ? (
                <Button
                  key="submit"
                  htmlType="button"
                  disabled={reportSubmitting}
                  loading={reportSubmitting}
                  onClick={() => void persistReport('submit')}
                >
                  {t('app.kuaiplm.labRequest.actions.saveAndSubmitReport')}
                </Button>
              ) : null}
            </>
          ),
        ]}
        destroyOnHidden
      >
        <div
          style={{
            border: '1px solid rgba(0, 0, 0, 0.06)',
            borderRadius: 6,
            background: '#f7f8fa',
            padding: '10px 12px',
            marginBottom: 12,
          }}
        >
          {t('app.kuaiplm.labRequest.messages.reportUploadHint')}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>
            {t('app.kuaiplm.labRequest.fields.reportAttachment')}
            {reportTarget?.report_status === 'approved' ? (
              <span style={{ color: 'var(--ant-color-error)', marginLeft: 4 }}>*</span>
            ) : null}
          </div>
          <Upload.Dragger
            disabled={reportSubmitting}
            multiple={false}
            maxCount={1}
            fileList={reportFileList}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
            customRequest={async (options) => {
              try {
                const res = await uploadFile(options.file as File, {
                  category: LAB_REPORT_FILE_CATEGORY,
                });
                setReportFileUuid(res.uuid);
                setReportFileList([
                  {
                    uid: res.uuid,
                    name: res.original_name || res.name,
                    status: 'done',
                  },
                ]);
                options.onSuccess?.(res, options.file as File);
              } catch (err) {
                options.onError?.(err as Error);
              }
            }}
            onRemove={() => {
              setReportFileUuid(null);
              setReportFileList([]);
              return true;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {t('app.kuaiplm.labRequest.messages.reportUploadDrag')}
            </p>
            <p className="ant-upload-hint">
              {t('app.kuaiplm.labRequest.messages.reportUploadFormats')}
            </p>
          </Upload.Dragger>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div>{t('app.kuaiplm.labRequest.fields.reportTitle')}</div>
          <Input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            disabled={reportSubmitting}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div>{t('app.kuaiplm.labRequest.fields.reportUrl')}</div>
          <Input
            value={reportUrl}
            onChange={(e) => setReportUrl(e.target.value)}
            placeholder={t('app.kuaiplm.labRequest.placeholders.reportUrlOptional')}
            disabled={reportSubmitting}
          />
        </div>
        <div>
          <div>{t('app.kuaiplm.labRequest.fields.resultSummary')}</div>
          <Input.TextArea
            rows={4}
            value={reportSummary}
            onChange={(e) => setReportSummary(e.target.value)}
            disabled={reportSubmitting}
            placeholder={t('app.kuaiplm.labRequest.placeholders.resultSummaryOptional')}
          />
        </div>
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.viewReport')}
        open={viewReportOpen}
        confirmLoading={viewReportLoading}
        onCancel={() => {
          setViewReportOpen(false);
          setViewReportTarget(null);
          setViewReportFileName('');
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setViewReportOpen(false);
              setViewReportTarget(null);
              setViewReportFileName('');
            }}
          >
            {t('common.close')}
          </Button>,
          <Button
            key="open"
            type="primary"
            disabled={!viewReportTarget}
            onClick={() => viewReportTarget && void openLabReportDocument(viewReportTarget)}
          >
            {t('app.kuaiplm.labRequest.actions.openReportFile')}
          </Button>,
          <Button
            key="download"
            disabled={!viewReportTarget}
            onClick={() => viewReportTarget && void downloadLabReport(viewReportTarget)}
          >
            {t('app.kuaiplm.labRequest.actions.downloadReport')}
          </Button>,
        ]}
        destroyOnHidden
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        {viewReportTarget ? (
          <div>
            <div
              style={{
                border: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: 6,
                background: '#f7f8fa',
                padding: '16px 12px',
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {viewReportFileName ||
                  viewReportTarget.report_title ||
                  t('app.kuaiplm.labRequest.fields.reportAttachment')}
              </div>
              <div style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 12 }}>
                {viewReportTarget.report_file_uuid
                  ? t('app.kuaiplm.labRequest.messages.reportFileReady')
                  : t('app.kuaiplm.labRequest.messages.reportLinkReady')}
              </div>
              <Button
                type="primary"
                onClick={() => void openLabReportDocument(viewReportTarget)}
              >
                {t('app.kuaiplm.labRequest.actions.openReportFile')}
              </Button>
            </div>
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'judgment',
                  label: t('app.kuaiplm.labRequest.fields.judgment'),
                  children: judgmentLabel(viewReportTarget.judgment),
                },
                {
                  key: 'result_summary',
                  label: t('app.kuaiplm.labRequest.fields.resultSummary'),
                  children: viewReportTarget.result_summary || '-',
                },
              ]}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.revoke')}
        open={revokeOpen}
        confirmLoading={revokeSubmitting}
        destroyOnHidden
        onCancel={() => {
          if (revokeSubmitting) return;
          setRevokeOpen(false);
          setRevokeTarget(null);
          setRevokeReason('');
        }}
        onOk={async () => {
          if (revokeTarget?.id == null) return;
          if (!revokeReason.trim()) {
            messageApi.error(t('app.kuaiplm.labRequest.messages.revokeReasonRequired'));
            return;
          }
          setRevokeSubmitting(true);
          try {
            await labRequestApi.revoke(revokeTarget.id, revokeReason.trim());
            messageApi.success(t('app.kuaiplm.labRequest.messages.revokeSuccess'));
            setRevokeOpen(false);
            setRevokeTarget(null);
            setRevokeReason('');
            if (detail?.id === revokeTarget.id) {
              setDetail(null);
            }
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          } finally {
            setRevokeSubmitting(false);
          }
        }}
      >
        <div style={{ marginBottom: 8 }}>{t('app.kuaiplm.labRequest.messages.revokeReason')}</div>
        <Input.TextArea
          rows={4}
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          placeholder={t('app.kuaiplm.labRequest.placeholders.revokeReason')}
          disabled={revokeSubmitting}
        />
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.rejectReport')}
        open={reportRejectOpen}
        confirmLoading={reportRejectSubmitting}
        destroyOnHidden
        onCancel={() => {
          if (reportRejectSubmitting) return;
          setReportRejectOpen(false);
          setReportRejectTarget(null);
          setReportRejectReason('');
        }}
        onOk={async () => {
          if (reportRejectTarget?.id == null) return;
          if (!reportRejectReason.trim()) {
            messageApi.error(t('app.kuaiplm.labRequest.messages.reportRejectReasonRequired'));
            return;
          }
          setReportRejectSubmitting(true);
          try {
            const updated = await labRequestApi.rejectReport(
              reportRejectTarget.id,
              reportRejectReason.trim(),
            );
            messageApi.success(t('app.kuaiplm.labRequest.messages.reportRejected'));
            setReportRejectOpen(false);
            setReportRejectTarget(null);
            setReportRejectReason('');
            if (detail?.id === updated.id) {
              setDetail(updated);
            }
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          } finally {
            setReportRejectSubmitting(false);
          }
        }}
      >
        <div style={{ marginBottom: 8 }}>
          {t('app.kuaiplm.labRequest.messages.reportRejectReason')}
        </div>
        <Input.TextArea
          rows={4}
          value={reportRejectReason}
          onChange={(e) => setReportRejectReason(e.target.value)}
          placeholder={t('app.kuaiplm.labRequest.placeholders.reportRejectReason')}
          disabled={reportRejectSubmitting}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default LabRequestsPage;
