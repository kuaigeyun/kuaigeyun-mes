import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { ActionType, ProColumns, ProForm, ProFormDateTimePicker, ProFormDependency, ProFormDigit, ProFormInstance, ProFormRadio, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Divider, Form, Space, Tag, Typography, Upload } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, FORM_LAYOUT, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { uploadFile, type FileUploadResponse } from '../../../../../services/file';
import { getBusinessConfig } from '../../../../../services/businessConfig';
import { FormNotifyUsersSelect } from '../../../components/FormNotifyUsersSelect';
import { SecurePictureCardUpload } from '../../../components/SecurePictureCardUpload';
import {
  getQualityWorkOrderDatasetBinding,
  listEquipments,
  listHaoligoNotifyUserOptions,
  listWorkshops,
  scanQualityWorkOrder,
  type EquipmentRow,
  type QualityWorkOrderDatasetBindingPayload,
  type WorkshopRow,
} from '../../../services/haoligo';
import { withMoldPictureCardUploadClass } from '../../../utils/moldPictureCardUpload';
import { qualityStatusTagColor, qualityStatusText, resolveQualityWorkflowAction, QUALITY_NOTIFICATION_DOCUMENT, QUALITY_ISSUE_RESPONSIBLE_USER_LABEL, QUALITY_ISSUE_NOTIFY_USER_LABEL, QUALITY_COMPLAINT_NOTIFY_USER_LABEL, QUALITY_LINE_STOP_NOTIFY_USER_LABEL, QUALITY_LINE_STOP_RESPONSIBLE_USER_LABEL, QUALITY_ISSUE_KIND_OPTIONS, qualityIssueKindLabel, qualityIssueOverdueNotifyHint, qualityComplaintOverdueNotifyHint, qualityLineStopOverdueNotifyHint, QUALITY_OVERDUE_NOTIFY_HINT, QUALITY_OVERDUE_NOTIFY_SETTING_TOOLBAR_LABEL, calcQualityIssueDefectRate, formatQualityIssueDefectRate } from '../../../utils/qualityMeta';
import { formatQualityMeasureOverdueAt } from '../../../utils/qualityMeasureOverdue';
import {
  resolveQualityComplaintOverdueNotifySeedIds,
  resolveQualityIssueOverdueNotifySeedIds,
  resolveQualityLineStopOverdueNotifySeedIds,
  resolveQualityOverdueNotifySeedIds,
} from '../../../utils/qualityOverdueNotify';
import { formatDateTime } from '../../../../../utils/format';
import { PatrolImagePreview } from '../../patrol/shared/PatrolImagePreview';
import { normUploadUuids, uuidsToSecureUploadFileList } from '../../patrol/shared/uploadHelpers';
import QualityWorkOrderDatasetBindingModal from './QualityWorkOrderDatasetBindingModal';
import { QualityTicketOverdueNotifySettingModal } from './QualityTicketOverdueNotifySettingModal';
import { getQualityComplaintOverdueNotifyIds } from '../../../utils/qualityComplaintOverdueNotifyDefaults';
import { getQualityIssueOverdueNotifyIdsForKind, resolveQualityIssueKindForOverdueNotify } from '../../../utils/qualityIssueOverdueNotifyDefaults';
import { getQualityLineStopOverdueNotifyIdsForKind } from '../../../utils/qualityLineStopOverdueNotifyDefaults';

type WorkflowStep = 'temporary' | 'long_term' | 'close' | 'measures';

const WORKFLOW_STEP_LABEL: Record<WorkflowStep, string> = {
  temporary: '提交临时措施',
  long_term: '提交长期措施',
  measures: '提交处理措施',
  close: '结案确认',
};

function resolveWorkflowStep<T extends { status?: string | null; temporary_submitted_at?: string | null; long_term_submitted_at?: string | null }>(
  row: T,
  combinedHandleMeasures = false,
): 'register' | WorkflowStep | null {
  const status = (row.status || '').trim().toLowerCase();
  if (status === 'completed') return null;
  const action = resolveQualityWorkflowAction(row.status);
  if (action === 'submit') return 'register';
  if (action !== 'complete') return null;
  if (combinedHandleMeasures) {
    if (!row.long_term_submitted_at) return 'measures';
    return 'close';
  }
  if (!row.temporary_submitted_at) return 'temporary';
  if (!row.long_term_submitted_at) return 'long_term';
  return 'close';
}

function resolveQualityAutoTitle(
  values: Record<string, unknown>,
  formProfile: 'default' | 'complaint' | 'line-stop',
): string {
  const truncate = (text: string) => (text.length <= 200 ? text : text.slice(0, 200));
  const explicit = String(values.title ?? '').trim();
  if (explicit) return truncate(explicit);
  if (formProfile === 'line-stop') {
    const stopReason = String(values.stop_reason ?? '').trim();
    if (stopReason) return truncate(stopReason);
  }
  if (formProfile === 'complaint') {
    const parts = [values.customer_name, values.material_code, values.problem_description]
      .map((v) => String(v ?? '').trim())
      .filter(Boolean);
    if (parts.length) return truncate(parts.join(' · '));
  }
  const description = String(values.problem_description ?? '').trim();
  if (description) return truncate(description);
  const workOrder = String(values.work_order_no ?? '').trim();
  if (workOrder) return truncate(`制令单 ${workOrder}`);
  return '品质单据';
}

const HANDLE_UPDATABLE_KEYS = [
  'responsible_user_ids',
  'overdue_notify_user_ids',
  'temporary_overdue_notify_user_ids',
  'long_term_overdue_notify_user_ids',
  'temporary_action',
  'temporary_due_at',
  'temporary_action_image_uuids',
  'long_term_action',
  'long_term_due_at',
  'long_term_action_image_uuids',
  'close_note',
  'recovered_at',
] as const;

function parseNotifyUserIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
}

function pickHandleUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of HANDLE_UPDATABLE_KEYS) {
    if (key in payload && payload[key] !== undefined) {
      out[key] = payload[key];
    }
  }
  return out;
}

function formatEquipmentLabel(row: {
  equipment_asset_code?: string | null;
  equipment_name?: string | null;
}): string {
  const label = `${row.equipment_asset_code ?? ''} ${row.equipment_name ?? ''}`.trim();
  return label || '-';
}

function formatDisplayText(value: unknown): string {
  if (value == null || value === '') return '-';
  return String(value);
}

type BaseRow = {
  id: number;
  sheet_no?: string | null;
  title?: string | null;
  status?: string | null;
  workshop_name?: string | null;
  equipment_asset_code?: string | null;
  equipment_name?: string | null;
  problem_description?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  reported_at?: string | null;
  temporary_action?: string | null;
  temporary_due_at?: string | null;
  temporary_action_image_uuids?: string[] | null;
  temporary_submitted_at?: string | null;
  long_term_action?: string | null;
  long_term_due_at?: string | null;
  long_term_action_image_uuids?: string[] | null;
  long_term_submitted_at?: string | null;
  close_note?: string | null;
  close_confirmed_at?: string | null;
  responsible_user_ids?: number[] | null;
  overdue_notify_user_ids?: number[] | null;
  temporary_overdue_notify_user_ids?: number[] | null;
  long_term_overdue_notify_user_ids?: number[] | null;
  work_order_no?: string | null;
  material_code_snapshot?: string | null;
  model_snapshot?: string | null;
  mold_code_snapshot?: string | null;
  planned_qty?: number | string | null;
  completed_qty?: number | string | null;
  defect_qty?: number | string | null;
  defect_rate?: number | string | null;
  issue_kind?: string | null;
  equipment_id?: number | null;
  recovered_at?: string | null;
  attachment_file_uuids?: string[] | null;
  stop_kind?: string | null;
  stop_reason?: string | null;
  stop_started_at?: string | null;
  customer_name?: string | null;
  material_code?: string | null;
  model?: string | null;
  batch_no?: string | null;
  quantity?: number | string | null;
  claim_amount?: number | string | null;
  responsible_name?: string | null;
};

type QualityTicketPageProps<T extends BaseRow> = {
  title: string;
  persistenceId: string;
  viewMode?: 'all' | 'register' | 'handle';
  listFn: (params: { skip?: number; limit?: number; status?: string; keyword?: string }) => Promise<{ items: T[]; total: number }>;
  getFn: (id: number) => Promise<T>;
  createFn: (body: any) => Promise<T>;
  updateFn: (id: number, body: any) => Promise<T>;
  submitFn: (id: number) => Promise<T>;
  completeFn: (id: number) => Promise<T>;
  registerSubmitFn?: (id: number, body: { responsible_user_ids: number[]; overdue_notify_user_ids: number[] }) => Promise<T>;
  submitTemporaryActionFn?: (id: number, body: {
    responsible_user_ids?: number[];
    overdue_notify_user_ids?: number[];
    temporary_action: string;
    temporary_due_at: string;
    temporary_action_image_uuids: string[];
  }) => Promise<T>;
  submitLongTermActionFn?: (id: number, body: { long_term_action: string; long_term_due_at: string; long_term_action_image_uuids: string[] }) => Promise<T>;
  submitHandleMeasuresFn?: (id: number, body: {
    responsible_user_ids: number[];
    overdue_notify_user_ids: number[];
    temporary_action: string;
    temporary_due_at: string;
    temporary_action_image_uuids: string[];
    long_term_action: string;
    long_term_due_at: string;
    long_term_action_image_uuids: string[];
  }) => Promise<T>;
  /** 品质问题处理：临时措施与长期措施一次提交 */
  combinedHandleMeasures?: boolean;
  confirmCloseFn?: (id: number, body: { close_note?: string; recovered_at?: string }) => Promise<T>;
  deleteFn: (id: number) => Promise<void>;
  buildCreatePayload?: (values: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
  buildUpdatePayload?: (values: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
  mapDetailToForm?: (detail: T) => Record<string, unknown>;
  prepareSaveValues?: (values: Record<string, unknown>) => Promise<Record<string, unknown>>;
  renderExtraFields?: (ctx: { readOnly: boolean }) => React.ReactNode;
  showWorkOrderFields?: boolean;
  /** 客户投诉、停线反馈等专用登记表单布局 */
  formProfile?: 'default' | 'complaint' | 'line-stop';
};

export function QualityTicketPage<T extends BaseRow>({
  title,
  persistenceId,
  viewMode = 'all',
  listFn,
  getFn,
  createFn,
  updateFn,
  submitFn,
  completeFn,
  registerSubmitFn,
  submitTemporaryActionFn,
  submitLongTermActionFn,
  submitHandleMeasuresFn,
  combinedHandleMeasures = false,
  confirmCloseFn,
  deleteFn,
  buildCreatePayload,
  buildUpdatePayload,
  mapDetailToForm,
  prepareSaveValues,
  renderExtraFields,
  showWorkOrderFields = true,
  formProfile = 'default',
}: QualityTicketPageProps<T>) {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [createFormInitialValues, setCreateFormInitialValues] = useState<Record<string, unknown>>({});
  const [createFormKey, setCreateFormKey] = useState(0);
  const [attachmentFiles, setAttachmentFiles] = useState<UploadFile[]>([]);
  const [temporaryActionImageUuids, setTemporaryActionImageUuids] = useState<string[]>([]);
  const [longTermActionImageUuids, setLongTermActionImageUuids] = useState<string[]>([]);
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [workOrderBinding, setWorkOrderBinding] = useState<QualityWorkOrderDatasetBindingPayload | null>(null);
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep | null>(null);
  const [loadedDetail, setLoadedDetail] = useState<T | null>(null);
  const [overdueNotifySettingOpen, setOverdueNotifySettingOpen] = useState(false);
  const [haoligoParameters, setHaoligoParameters] = useState<Record<string, unknown>>({});
  const [measureOverdueNotifySeed, setMeasureOverdueNotifySeed] = useState<{
    temporary: number[];
    long_term: number[];
  }>({ temporary: [], long_term: [] });
  const defaultStatus = 'all';
  const showRegisterAsDetail = viewMode === 'handle' && editingId != null && !detailMode;

  const qualityNotificationDocument = useMemo(() => {
    if (formProfile === 'complaint') return QUALITY_NOTIFICATION_DOCUMENT.complaint;
    if (formProfile === 'line-stop') return QUALITY_NOTIFICATION_DOCUMENT.lineStop;
    return QUALITY_NOTIFICATION_DOCUMENT.issue;
  }, [formProfile]);

  useEffect(() => {
    if (!showWorkOrderFields) return;
    let cancelled = false;
    void (async () => {
      try {
        const b = await getQualityWorkOrderDatasetBinding();
        if (!cancelled) setWorkOrderBinding(b?.dataset_uuid?.trim() ? b : null);
      } catch {
        if (!cancelled) setWorkOrderBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showWorkOrderFields]);

  useEffect(() => {
    if (!combinedHandleMeasures) return;
    let cancelled = false;
    void getBusinessConfig()
      .then((config) => {
        if (!cancelled) setHaoligoParameters(config?.parameters?.haoligo ?? {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [combinedHandleMeasures]);

  const canPrefillFromDataset = useMemo(() => {
    const b = workOrderBinding;
    return Boolean(b?.dataset_uuid?.trim() && b?.work_order_param_key?.trim());
  }, [workOrderBinding]);

  const runWorkOrderPrefill = useCallback(async () => {
    if (!canPrefillFromDataset) {
      messageApi.warning(t('app.haoligo.quality.workOrder.datasetBindingNeedConfig'));
      return;
    }
    const wo = String(formRef.current?.getFieldValue('work_order_no') || '').trim();
    if (!wo) {
      messageApi.warning(t('app.haoligo.equipment.documents.outputWorkOrderRequired'));
      return;
    }
    setPrefillBusy(true);
    try {
      const res = await scanQualityWorkOrder({ work_order_no: wo });
      formRef.current?.setFieldsValue({
        workshop_id: res.workshop_id ?? undefined,
        equipment_id: res.equipment_id ?? undefined,
        production_line: res.production_line ?? undefined,
        material_code_snapshot: res.material_code_snapshot ?? undefined,
        model_snapshot: res.model_snapshot ?? undefined,
        mold_code_snapshot: res.mold_code_snapshot ?? undefined,
      });
      messageApi.success(t('app.haoligo.equipment.documents.outputPrefillOk'));
    } catch (e) {
      messageApi.error((e as Error).message || '带出失败');
    } finally {
      setPrefillBusy(false);
    }
  }, [canPrefillFromDataset, messageApi, t]);

  const statusValueEnum = useMemo(() => {
    if (viewMode === 'handle') {
      return {
        all: { text: '全部' },
        assigned: { text: '待处理' },
        processing: { text: '处理中' },
        completed: { text: '已完成' },
      };
    }
    return {
      all: { text: '全部' },
      registered: { text: '已登记' },
      assigned: { text: '待处理' },
      processing: { text: '处理中' },
      completed: { text: '已完成' },
    };
  }, [viewMode]);

  const columns = useMemo<ProColumns<T>[]>(
    () => {
      const isLineStopList = formProfile === 'line-stop';
      const isComplaintList = formProfile === 'complaint';
      return [
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        valueType: 'select',
        valueEnum: statusValueEnum,
        initialValue: defaultStatus,
        fieldProps: { allowClear: false, optionType: 'button', buttonStyle: 'solid' },
        render: (_, row) => <Tag color={qualityStatusTagColor(row.status)}>{qualityStatusText(row.status)}</Tag>,
      },
      { title: '单号', dataIndex: 'sheet_no', hideInSearch: true, width: 150 },
      ...(isLineStopList
        ? [
            {
              title: '停线类型',
              dataIndex: 'stop_kind',
              hideInSearch: true,
              width: 130,
              render: (_: unknown, row: T) =>
                row.stop_kind === 'quality' ? '品质异常停线' : '设备异常停线',
            } as ProColumns<T>,
          ]
        : []),
      ...(isComplaintList
        ? [
            { title: '客户信息', dataIndex: 'customer_name', hideInSearch: true, width: 140, ellipsis: true },
            { title: '物料号', dataIndex: 'material_code', hideInSearch: true, width: 120 },
          ]
        : []),
      ...(!isComplaintList
        ? [{ title: '车间', dataIndex: 'workshop_name', hideInSearch: true, width: 120 }]
        : []),
      ...(!isComplaintList
        ? [
            {
              title: '设备',
              key: 'equipment_display',
              hideInSearch: true,
              width: 180,
              render: (_: unknown, row: T) => `${row.equipment_asset_code || ''} ${row.equipment_name || ''}`.trim() || '—',
            } as ProColumns<T>,
          ]
        : []),
      isLineStopList
        ? { title: '停线原因', dataIndex: 'stop_reason', hideInSearch: true, ellipsis: true }
        : { title: '问题描述', dataIndex: 'problem_description', hideInSearch: true, ellipsis: true },
      ...(isLineStopList
        ? [{ title: '停线开始', dataIndex: 'stop_started_at', hideInSearch: true, valueType: 'dateTime' as const, width: 170 }]
        : []),
      { title: '反馈时间', dataIndex: 'reported_at', hideInSearch: true, valueType: 'dateTime', width: 170 },
      ...(isLineStopList ? [] : [{ title: '计划完成', dataIndex: 'due_at', hideInSearch: true, valueType: 'dateTime' as const, width: 170 }]),
      {
        title: '操作',
        valueType: 'option',
        width: 230,
        fixed: 'right',
        render: (_, row) => (
          <Space>
            <Button
              key="view"
              {...rowActionKind('read')}
              onClick={() => void openModal(row.id, true)}
            >
              详情
            </Button>
            <Button
              key="edit"
              {...rowActionKind('update')}
              onClick={() => void openModal(row.id, false)}
            >
              编辑
            </Button>
            {(() => {
              const step = resolveWorkflowStep(row, combinedHandleMeasures);
              if (!step) return null;
              if (viewMode === 'register' && step !== 'register') return null;
              if (viewMode === 'handle' && step === 'register') return null;
              const workflowText = step === 'register' ? '登记提交' : WORKFLOW_STEP_LABEL[step];
              return (
              <Button
                key="workflow"
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={() => void beginWorkflowFromRow(row)}
              >
                  {workflowText}
              </Button>
              );
            })()}
            <Button
              key="delete"
              {...rowActionKind('delete')}
              onClick={() => void handleDelete(row.id)}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ];
    },
    [combinedHandleMeasures, defaultStatus, formProfile, statusValueEnum, viewMode],
  );

  const workshopOptionsRequest = async () => {
    const rows: WorkshopRow[] = await listWorkshops();
    return rows.map((w) => ({ label: w.name || w.code || `#${w.id}`, value: w.id }));
  };

  const equipmentOptionsRequest = async ({ keyWords }: { keyWords?: string }) => {
    const res = await listEquipments({ keyword: keyWords, limit: 50 });
    return (res.items as EquipmentRow[]).map((e) => ({ label: `${e.asset_code} ${e.name}`.trim(), value: e.id }));
  };

  const searchUsers = useCallback(async (keyword?: string, selectedIds?: number[]) => {
    const rows = await listHaoligoNotifyUserOptions({
      keyword,
      limit: 80,
      selected_user_ids: selectedIds,
    });
    return rows.map((u) => ({ label: u.label, value: u.id }));
  }, []);

  const normalizePayload = useCallback((values: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...values };
    const toIso = (v: unknown) => {
      if (!v) return undefined;
      if (typeof v === 'string') return v;
      if (v instanceof Date) return v.toISOString();
      if (typeof (v as { toISOString?: () => string }).toISOString === 'function') {
        return (v as { toISOString: () => string }).toISOString();
      }
      return undefined;
    };
    for (const key of ['reported_at', 'due_at', 'completed_at', 'stop_started_at', 'recovered_at', 'temporary_due_at', 'long_term_due_at']) {
      if (key in out) {
        out[key] = toIso(out[key]);
      }
    }
    if ('responsible_user_id' in out) {
      const n = Number(out.responsible_user_id);
      out.responsible_user_id = Number.isFinite(n) && n > 0 ? n : undefined;
    }
    if ('notify_user_ids' in out) {
      out.notify_user_ids = Array.isArray(out.notify_user_ids)
        ? out.notify_user_ids
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x) && x > 0)
        : [];
    }
    if ('responsible_user_ids' in out) {
      out.responsible_user_ids = Array.isArray(out.responsible_user_ids)
        ? out.responsible_user_ids
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x) && x > 0)
        : [];
    }
    if ('overdue_notify_user_ids' in out) {
      out.overdue_notify_user_ids = Array.isArray(out.overdue_notify_user_ids)
        ? out.overdue_notify_user_ids
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x) && x > 0)
        : [];
    }
    if ('temporary_overdue_notify_user_ids' in out) {
      out.temporary_overdue_notify_user_ids = Array.isArray(out.temporary_overdue_notify_user_ids)
        ? out.temporary_overdue_notify_user_ids
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x) && x > 0)
        : [];
    }
    if ('long_term_overdue_notify_user_ids' in out) {
      out.long_term_overdue_notify_user_ids = Array.isArray(out.long_term_overdue_notify_user_ids)
        ? out.long_term_overdue_notify_user_ids
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x) && x > 0)
        : [];
    }
    if ('attachment_file_uuids' in out) {
      out.attachment_file_uuids = Array.isArray(out.attachment_file_uuids)
        ? out.attachment_file_uuids.map((x) => String(x)).filter((x) => x.trim())
        : [];
    }
    return out;
  }, []);

  const buildCreateInitialValues = useCallback((): Record<string, unknown> => {
    const values: Record<string, unknown> = {
      reported_at: dayjs(),
    };
    if (formProfile === 'line-stop') {
      values.stop_kind = 'equipment';
    }
    return values;
  }, [formProfile]);

  const openModal = async (id?: number, readonly = false) => {
    setDetailMode(readonly);
    setEditingId(id ?? null);
    if (!id) {
      setWorkflowStep(null);
      setLoadedDetail(null);
      setMeasureOverdueNotifySeed({ temporary: [], long_term: [] });
      setTemporaryActionImageUuids([]);
      setLongTermActionImageUuids([]);
      setCreateFormInitialValues(buildCreateInitialValues());
      setCreateFormKey((k) => k + 1);
      setAttachmentFiles([]);
      setModalOpen(true);
      return;
    }
    setModalOpen(true);
    setFormLoading(true);
    try {
      const detail = await getFn(id);
      setLoadedDetail(detail);
      const formValues = mapDetailToForm ? mapDetailToForm(detail) : (detail as Record<string, unknown>);
      formRef.current?.setFieldsValue({
        ...formValues,
        reported_at: formValues.reported_at ? dayjs(formValues.reported_at as string) : undefined,
        stop_started_at: formValues.stop_started_at ? dayjs(formValues.stop_started_at as string) : undefined,
        due_at: formValues.due_at ? dayjs(formValues.due_at as string) : undefined,
        temporary_due_at: formValues.temporary_due_at ? dayjs(formValues.temporary_due_at as string) : undefined,
        long_term_due_at: formValues.long_term_due_at ? dayjs(formValues.long_term_due_at as string) : undefined,
        recovered_at: formValues.recovered_at ? dayjs(formValues.recovered_at as string) : undefined,
      });
      const attachUuids = Array.isArray(detail.attachment_file_uuids) ? detail.attachment_file_uuids : [];
      setAttachmentFiles(await uuidsToSecureUploadFileList(attachUuids));
      setTemporaryActionImageUuids(
        Array.isArray(detail.temporary_action_image_uuids)
          ? detail.temporary_action_image_uuids.map((x) => String(x)).filter((x) => x.trim())
          : [],
      );
      setLongTermActionImageUuids(
        Array.isArray(detail.long_term_action_image_uuids)
          ? detail.long_term_action_image_uuids.map((x) => String(x)).filter((x) => x.trim())
          : [],
      );
      if (viewMode === 'handle' && !readonly) {
        try {
          const config = await getBusinessConfig();
          setHaoligoParameters(config?.parameters?.haoligo ?? {});
          if (combinedHandleMeasures) {
            const haoligoParams = config?.parameters?.haoligo;
            const patch: Record<string, number[]> = {};
            let tempSeed: number[] = [];
            let longSeed: number[] = [];
            if (isIssueForm) {
              const issueKind = detail.issue_kind;
              const equipmentId = detail.equipment_id;
              tempSeed = await resolveQualityIssueOverdueNotifySeedIds(
                config?.parameters?.notifications,
                qualityNotificationDocument,
                'temporary_overdue',
                issueKind,
                detail.temporary_overdue_notify_user_ids ?? detail.overdue_notify_user_ids,
                haoligoParams,
                equipmentId,
              );
              longSeed = await resolveQualityIssueOverdueNotifySeedIds(
                config?.parameters?.notifications,
                qualityNotificationDocument,
                'long_term_overdue',
                issueKind,
                detail.long_term_overdue_notify_user_ids ?? detail.overdue_notify_user_ids,
                haoligoParams,
                equipmentId,
              );
            } else if (isLineStopForm) {
              const stopKind = detail.stop_kind;
              tempSeed = await resolveQualityLineStopOverdueNotifySeedIds(
                config?.parameters?.notifications,
                qualityNotificationDocument,
                'temporary_overdue',
                stopKind,
                detail.temporary_overdue_notify_user_ids ?? detail.overdue_notify_user_ids,
                haoligoParams,
              );
              longSeed = await resolveQualityLineStopOverdueNotifySeedIds(
                config?.parameters?.notifications,
                qualityNotificationDocument,
                'long_term_overdue',
                stopKind,
                detail.long_term_overdue_notify_user_ids ?? detail.overdue_notify_user_ids,
                haoligoParams,
              );
            } else if (isComplaintForm) {
              tempSeed = await resolveQualityComplaintOverdueNotifySeedIds(
                config?.parameters?.notifications,
                qualityNotificationDocument,
                'temporary_overdue',
                detail.temporary_overdue_notify_user_ids ?? detail.overdue_notify_user_ids,
                haoligoParams,
              );
              longSeed = await resolveQualityComplaintOverdueNotifySeedIds(
                config?.parameters?.notifications,
                qualityNotificationDocument,
                'long_term_overdue',
                detail.long_term_overdue_notify_user_ids ?? detail.overdue_notify_user_ids,
                haoligoParams,
              );
            }
            if (!parseNotifyUserIds(formRef.current?.getFieldValue('temporary_overdue_notify_user_ids')).length && tempSeed.length) {
              patch.temporary_overdue_notify_user_ids = tempSeed;
            }
            if (!parseNotifyUserIds(formRef.current?.getFieldValue('long_term_overdue_notify_user_ids')).length && longSeed.length) {
              patch.long_term_overdue_notify_user_ids = longSeed;
            }
            if (Object.keys(patch).length) {
              formRef.current?.setFieldsValue(patch);
            }
            setMeasureOverdueNotifySeed({ temporary: tempSeed, long_term: longSeed });
          } else {
            const seedIds = await resolveQualityOverdueNotifySeedIds(
              config?.parameters?.notifications,
              qualityNotificationDocument,
              detail.overdue_notify_user_ids,
            );
            if (seedIds.length) {
              const currentOverdue = parseNotifyUserIds(formRef.current?.getFieldValue('overdue_notify_user_ids'));
              if (!currentOverdue.length) {
                formRef.current?.setFieldsValue({ overdue_notify_user_ids: seedIds });
              }
            }
          }
        } catch {
          // 逾期提醒默认人员加载失败时不阻断打开表单
        }
      }
    } catch (e) {
      messageApi.error((e as Error).message || '加载失败');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      okType: 'danger',
      onOk: async () => {
        await deleteFn(id);
        messageApi.success('删除成功');
        actionRef.current?.reload();
      },
    });
  };

  const handleWorkflow = async (row: T) => {
    const step = resolveWorkflowStep(row, combinedHandleMeasures);
    if (step !== 'register') return;
    try {
      if (registerSubmitFn) {
        const responsibleUserIds = Array.isArray(row.responsible_user_ids)
          ? row.responsible_user_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
          : [];
        await registerSubmitFn(row.id, { responsible_user_ids: responsibleUserIds, overdue_notify_user_ids: [] });
      } else {
        await submitFn(row.id);
      }
      messageApi.success('操作成功');
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '操作失败');
    }
  };

  const beginWorkflowFromRow = (row: T) => {
    const step = resolveWorkflowStep(row, combinedHandleMeasures);
    if (!step) return;
    if (step === 'register') {
      void handleWorkflow(row);
      return;
    }
    setWorkflowStep(step);
    void openModal(row.id, false);
  };

  const submitWorkflowFromModal = async () => {
    if (!editingId || !workflowStep) return;
    const values = formRef.current?.getFieldsValue(true) as Record<string, unknown> | undefined;
    if (!values) return;
    setFormLoading(true);
    try {
      if (workflowStep === 'measures' && submitHandleMeasuresFn) {
        const responsibleUserIds = parseNotifyUserIds(values.responsible_user_ids);
        if (!responsibleUserIds.length) {
          messageApi.warning('请选择责任人');
          return;
        }
        const temporaryAction = String(values.temporary_action ?? '').trim();
        if (!temporaryAction) {
          messageApi.warning('请填写临时措施');
          return;
        }
        if (!values.temporary_due_at) {
          messageApi.warning('请填写临时措施预计完成时间');
          return;
        }
        const longTermAction = String(values.long_term_action ?? '').trim();
        if (!longTermAction) {
          messageApi.warning('请填写长期措施');
          return;
        }
        if (!values.long_term_due_at) {
          messageApi.warning('请填写长期措施预计完成时间');
          return;
        }
        const payload = normalizePayload({
          responsible_user_ids: responsibleUserIds,
          overdue_notify_user_ids: combinedHandleMeasures
            ? parseNotifyUserIds([
                ...parseNotifyUserIds(values.temporary_overdue_notify_user_ids),
                ...parseNotifyUserIds(values.long_term_overdue_notify_user_ids),
              ])
            : parseNotifyUserIds(values.overdue_notify_user_ids),
          ...(combinedHandleMeasures
            ? {
                temporary_overdue_notify_user_ids: parseNotifyUserIds(values.temporary_overdue_notify_user_ids),
                long_term_overdue_notify_user_ids: parseNotifyUserIds(values.long_term_overdue_notify_user_ids),
              }
            : {}),
          temporary_action: temporaryAction,
          temporary_due_at: values.temporary_due_at,
          temporary_action_image_uuids: temporaryActionImageUuids,
          long_term_action: longTermAction,
          long_term_due_at: values.long_term_due_at,
          long_term_action_image_uuids: longTermActionImageUuids,
        });
        await submitHandleMeasuresFn(editingId, payload as {
          responsible_user_ids: number[];
          overdue_notify_user_ids: number[];
          temporary_overdue_notify_user_ids?: number[];
          long_term_overdue_notify_user_ids?: number[];
          temporary_action: string;
          temporary_due_at: string;
          temporary_action_image_uuids: string[];
          long_term_action: string;
          long_term_due_at: string;
          long_term_action_image_uuids: string[];
        });
      } else if (workflowStep === 'temporary' && submitTemporaryActionFn) {
        const responsibleUserIds = parseNotifyUserIds(values.responsible_user_ids);
        if (!responsibleUserIds.length) {
          messageApi.warning('请选择责任人');
          return;
        }
        const temporaryAction = String(values.temporary_action ?? '').trim();
        if (!temporaryAction) {
          messageApi.warning('请填写临时措施');
          return;
        }
        if (!values.temporary_due_at) {
          messageApi.warning('请填写临时措施预计完成时间');
          return;
        }
        const payload = normalizePayload({
          responsible_user_ids: responsibleUserIds,
          overdue_notify_user_ids: parseNotifyUserIds(values.overdue_notify_user_ids),
          temporary_action: temporaryAction,
          temporary_due_at: values.temporary_due_at,
          temporary_action_image_uuids: temporaryActionImageUuids,
        });
        await submitTemporaryActionFn(editingId, payload as {
          responsible_user_ids: number[];
          overdue_notify_user_ids: number[];
          temporary_action: string;
          temporary_due_at: string;
          temporary_action_image_uuids: string[];
        });
      } else if (workflowStep === 'long_term' && submitLongTermActionFn) {
        const longTermAction = String(values.long_term_action ?? '').trim();
        if (!longTermAction) {
          messageApi.warning('请填写长期措施');
          return;
        }
        if (!values.long_term_due_at) {
          messageApi.warning('请填写长期措施预计完成时间');
          return;
        }
        const payload = normalizePayload({
          long_term_action: longTermAction,
          long_term_due_at: values.long_term_due_at,
          long_term_action_image_uuids: longTermActionImageUuids,
        });
        await submitLongTermActionFn(editingId, payload as {
          long_term_action: string;
          long_term_due_at: string;
          long_term_action_image_uuids: string[];
        });
      } else if (workflowStep === 'close' && confirmCloseFn) {
        const payload = normalizePayload({
          close_note: String(values.close_note ?? '').trim() || undefined,
          recovered_at: values.recovered_at,
        });
        await confirmCloseFn(editingId, payload as { close_note?: string; recovered_at?: string });
      } else {
        await completeFn(editingId);
      }
      messageApi.success('操作成功');
      setModalOpen(false);
      setEditingId(null);
      setWorkflowStep(null);
      setLoadedDetail(null);
      setTemporaryActionImageUuids([]);
      setLongTermActionImageUuids([]);
      setAttachmentFiles([]);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  const handleFinish = async (values: Record<string, unknown>) => {
    try {
      const attachmentUuids = normUploadUuids(attachmentFiles);
      let valuesToSave = values;
      if (prepareSaveValues) {
        valuesToSave = await prepareSaveValues(values);
      }
      if (editingId) {
        const rawPayload = buildUpdatePayload ? buildUpdatePayload(valuesToSave) : valuesToSave;
        const payload = normalizePayload({
          ...(await Promise.resolve(rawPayload)),
          ...(showRegisterAsDetail ? {} : { attachment_file_uuids: attachmentUuids }),
        });
        delete payload.title;
        const savePayload = showRegisterAsDetail
          ? pickHandleUpdatePayload({
              ...payload,
              temporary_action_image_uuids: temporaryActionImageUuids,
              long_term_action_image_uuids: longTermActionImageUuids,
            })
          : payload;
        await updateFn(editingId, savePayload);
        messageApi.success('更新成功');
      } else {
        const rawPayload = buildCreatePayload ? buildCreatePayload(valuesToSave) : valuesToSave;
        const payload = normalizePayload({
          ...(await Promise.resolve(rawPayload)),
          attachment_file_uuids: attachmentUuids,
          title: resolveQualityAutoTitle(valuesToSave, formProfile),
        });
        await createFn(payload);
        messageApi.success('创建成功');
      }
      setModalOpen(false);
      setEditingId(null);
      setLoadedDetail(null);
      setTemporaryActionImageUuids([]);
      setLongTermActionImageUuids([]);
      setAttachmentFiles([]);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
    }
  };

  const attachmentUploadProps: UploadProps = {
    ...withMoldPictureCardUploadClass({
      listType: 'picture-card',
      accept: '.jpg,.jpeg,.png,.gif,.webp',
      fileList: attachmentFiles,
      disabled: detailMode,
      onChange: ({ fileList }) => setAttachmentFiles(fileList),
      customRequest: async (options) => {
        try {
          const file = options.file as File;
          const res: FileUploadResponse = await uploadFile(file, { category: 'haoligo_quality_management' });
          options.onSuccess?.(res, options.file);
        } catch (e) {
          options.onError?.(e instanceof Error ? e : new Error(String(e)));
        }
      },
    }),
  };

  const dateTimeFieldProps = useMemo(
    () => ({
      style: { width: '100%' as const },
      format: 'YYYY-MM-DD HH:mm',
    }),
    [],
  );

  const isComplaintForm = formProfile === 'complaint';
  const isLineStopForm = formProfile === 'line-stop';
  const isIssueForm = formProfile === 'default';
  const attachmentLabel = showWorkOrderFields || isComplaintForm ? '上传照片' : '附件';

  const issueKindField = (
    <ProFormRadio.Group
      name="issue_kind"
      label="问题类型"
      initialValue="equipment"
      rules={detailMode ? undefined : [{ required: true, message: '请选择问题类型' }]}
      options={QUALITY_ISSUE_KIND_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
      fieldProps={{ optionType: 'button', buttonStyle: 'solid', disabled: detailMode }}
      colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
    />
  );

  const issueQtyFields = (
    <>
      <ProFormDigit name="planned_qty" label="计划数量" min={0} colProps={{ span: 12 }} />
      <ProFormDigit name="completed_qty" label="完成数量" min={0} colProps={{ span: 12 }} />
      <ProFormDigit name="defect_qty" label="不良数量" min={0} colProps={{ span: 12 }} />
      <ProFormDependency name={['defect_qty', 'completed_qty']}>
        {({ defect_qty: defectQty, completed_qty: completedQty }) => (
          <Col span={12}>
            <Form.Item label="不良率">
              <Typography.Text>
                {formatQualityIssueDefectRate(calcQualityIssueDefectRate(completedQty, defectQty))}
              </Typography.Text>
            </Form.Item>
          </Col>
        )}
      </ProFormDependency>
    </>
  );

  const registerDetailSection = useMemo(() => {
    if (!showRegisterAsDetail || !loadedDetail) return null;
    const d = loadedDetail;
    const items: React.ReactNode[] = [];
    if (d.sheet_no) {
      items.push(
        <Descriptions.Item key="sheet_no" label="单号">
          {d.sheet_no}
        </Descriptions.Item>,
      );
    }
    if (isLineStopForm) {
      items.push(
        <Descriptions.Item key="stop_kind" label="停线类型">
          {d.stop_kind === 'quality' ? '品质异常停线' : '设备异常停线'}
        </Descriptions.Item>,
        <Descriptions.Item key="workshop" label="车间">
          {formatDisplayText(d.workshop_name)}
        </Descriptions.Item>,
        <Descriptions.Item key="production_line" label="产线">
          {formatDisplayText(d.production_line)}
        </Descriptions.Item>,
        <Descriptions.Item key="equipment" label="设备">
          {formatEquipmentLabel(d)}
        </Descriptions.Item>,
        <Descriptions.Item key="stop_reason" label="停线原因描述" span={2}>
          {formatDisplayText(d.stop_reason)}
        </Descriptions.Item>,
        <Descriptions.Item key="stop_started_at" label="停线开始时间">
          {formatDateTime(d.stop_started_at)}
        </Descriptions.Item>,
      );
    } else if (isComplaintForm) {
      items.push(
        <Descriptions.Item key="customer_name" label="客户信息" span={2}>
          {formatDisplayText(d.customer_name)}
        </Descriptions.Item>,
        <Descriptions.Item key="material_code" label="物料号">
          {formatDisplayText(d.material_code)}
        </Descriptions.Item>,
        <Descriptions.Item key="model" label="型号">
          {formatDisplayText(d.model)}
        </Descriptions.Item>,
        <Descriptions.Item key="batch_no" label="批次号">
          {formatDisplayText(d.batch_no)}
        </Descriptions.Item>,
        <Descriptions.Item key="quantity" label="不良数量">
          {formatDisplayText(d.quantity)}
        </Descriptions.Item>,
        <Descriptions.Item key="claim_amount" label="赔偿金额">
          {formatDisplayText(d.claim_amount)}
        </Descriptions.Item>,
        <Descriptions.Item key="problem_description" label="描述不良现象" span={2}>
          {formatDisplayText(d.problem_description)}
        </Descriptions.Item>,
      );
    } else if (showWorkOrderFields) {
      items.push(
        <Descriptions.Item key="work_order_no" label="制令单号">
          {formatDisplayText(d.work_order_no)}
        </Descriptions.Item>,
        <Descriptions.Item key="material_code" label="物料号">
          {formatDisplayText(d.material_code_snapshot)}
        </Descriptions.Item>,
        <Descriptions.Item key="model" label="型号">
          {formatDisplayText(d.model_snapshot)}
        </Descriptions.Item>,
        <Descriptions.Item key="mold_code" label="模具号">
          {formatDisplayText(d.mold_code_snapshot)}
        </Descriptions.Item>,
        <Descriptions.Item key="issue_kind" label="问题类型">
          {qualityIssueKindLabel(d.issue_kind)}
        </Descriptions.Item>,
        <Descriptions.Item key="problem_description" label="问题描述" span={2}>
          {formatDisplayText(d.problem_description)}
        </Descriptions.Item>,
        <Descriptions.Item key="planned_qty" label="计划数量">
          {formatDisplayText(d.planned_qty)}
        </Descriptions.Item>,
        <Descriptions.Item key="completed_qty" label="完成数量">
          {formatDisplayText(d.completed_qty)}
        </Descriptions.Item>,
        <Descriptions.Item key="defect_qty" label="不良数量">
          {formatDisplayText(d.defect_qty)}
        </Descriptions.Item>,
        <Descriptions.Item key="defect_rate" label="不良率">
          {formatQualityIssueDefectRate(
            d.defect_rate != null && d.defect_rate !== ''
              ? Number(d.defect_rate)
              : calcQualityIssueDefectRate(d.completed_qty, d.defect_qty),
          )}
        </Descriptions.Item>,
        <Descriptions.Item key="workshop" label="责任车间">
          {formatDisplayText(d.workshop_name)}
        </Descriptions.Item>,
        <Descriptions.Item key="production_line" label="产线">
          {formatDisplayText(d.production_line)}
        </Descriptions.Item>,
        <Descriptions.Item key="equipment" label="设备">
          {formatEquipmentLabel(d)}
        </Descriptions.Item>,
      );
    } else {
      items.push(
        <Descriptions.Item key="workshop" label="责任车间">
          {formatDisplayText(d.workshop_name)}
        </Descriptions.Item>,
        <Descriptions.Item key="equipment" label="关联设备">
          {formatEquipmentLabel(d)}
        </Descriptions.Item>,
        <Descriptions.Item key="production_line" label="产线">
          {formatDisplayText(d.production_line)}
        </Descriptions.Item>,
        <Descriptions.Item key="issue_kind" label="问题类型">
          {qualityIssueKindLabel(d.issue_kind)}
        </Descriptions.Item>,
        <Descriptions.Item key="problem_description" label="问题描述" span={2}>
          {formatDisplayText(d.problem_description)}
        </Descriptions.Item>,
        <Descriptions.Item key="planned_qty" label="计划数量">
          {formatDisplayText(d.planned_qty)}
        </Descriptions.Item>,
        <Descriptions.Item key="completed_qty" label="完成数量">
          {formatDisplayText(d.completed_qty)}
        </Descriptions.Item>,
        <Descriptions.Item key="defect_qty" label="不良数量">
          {formatDisplayText(d.defect_qty)}
        </Descriptions.Item>,
        <Descriptions.Item key="defect_rate" label="不良率">
          {formatQualityIssueDefectRate(
            d.defect_rate != null && d.defect_rate !== ''
              ? Number(d.defect_rate)
              : calcQualityIssueDefectRate(d.completed_qty, d.defect_qty),
          )}
        </Descriptions.Item>,
      );
    }
    items.push(
      <Descriptions.Item key="reported_at" label="反馈时间">
        {formatDateTime(d.reported_at)}
      </Descriptions.Item>,
    );
    if (d.responsible_name) {
      items.push(
        <Descriptions.Item key="responsible_name" label={isIssueForm ? QUALITY_ISSUE_RESPONSIBLE_USER_LABEL : isLineStopForm ? QUALITY_LINE_STOP_RESPONSIBLE_USER_LABEL : '责任人'}>
          {d.responsible_name}
        </Descriptions.Item>,
      );
    }
    return (
      <Col span={FORM_LAYOUT.FULL_COL_SPAN}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          登记信息
        </Typography.Title>
        <Descriptions column={2} size="small" bordered>
          {items}
        </Descriptions>
        <Descriptions column={1} size="small" bordered style={{ marginTop: 12 }}>
          <Descriptions.Item label={attachmentLabel}>
            {attachmentFiles.length ? <PatrolImagePreview files={attachmentFiles} /> : '-'}
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '16px 0 0' }} />
      </Col>
    );
  }, [attachmentFiles, attachmentLabel, isComplaintForm, isIssueForm, isLineStopForm, loadedDetail, showRegisterAsDetail, showWorkOrderFields]);

  const attachmentField = (
    <Col span={FORM_LAYOUT.FULL_COL_SPAN}>
      <ProForm.Item label={attachmentLabel}>
        {detailMode ? (
          <PatrolImagePreview files={attachmentFiles} />
        ) : (
          <Upload {...attachmentUploadProps}>+</Upload>
        )}
      </ProForm.Item>
    </Col>
  );

  const showMeasureFields = workflowStep == null || workflowStep === 'temporary' || workflowStep === 'long_term' || workflowStep === 'measures';
  const showCloseFields = workflowStep == null || workflowStep === 'close';
  const showHandleResponsibleFields = viewMode === 'handle' && showMeasureFields;
  const showTemporaryMeasureFields = workflowStep == null || workflowStep === 'temporary' || workflowStep === 'measures';
  const showLongTermMeasureFields = workflowStep == null || workflowStep === 'long_term' || workflowStep === 'measures';

  const measureImageUploadField = useCallback(
    (label: string, uuids: string[], onUuidsChange: (next: string[]) => void) => (
      <Col span={FORM_LAYOUT.FULL_COL_SPAN}>
        <ProForm.Item label={label}>
          {detailMode ? (
            <PatrolImagePreview uuids={uuids} emptyText="无" />
          ) : (
            <SecurePictureCardUpload
              uuids={uuids}
              onUuidsChange={onUuidsChange}
              accept=".jpg,.jpeg,.png,.gif,.webp"
              customRequest={async (options) => {
                try {
                  const file = options.file as File;
                  const res: FileUploadResponse = await uploadFile(file, { category: 'haoligo_quality_management' });
                  options.onSuccess?.(res, options.file);
                } catch (e) {
                  options.onError?.(e instanceof Error ? e : new Error(String(e)));
                }
              }}
            />
          )}
        </ProForm.Item>
      </Col>
    ),
    [detailMode],
  );

  const measureOverdueNotifyHintText = useMemo(() => {
    if (isIssueForm) {
      const kind = resolveQualityIssueKindForOverdueNotify({
        issue_kind: loadedDetail?.issue_kind,
        equipment_id: loadedDetail?.equipment_id,
      }) ?? loadedDetail?.issue_kind;
      return qualityIssueOverdueNotifyHint(kind);
    }
    if (isLineStopForm) return qualityLineStopOverdueNotifyHint(loadedDetail?.stop_kind);
    if (isComplaintForm) return qualityComplaintOverdueNotifyHint();
    return QUALITY_OVERDUE_NOTIFY_HINT;
  }, [isComplaintForm, isIssueForm, isLineStopForm, loadedDetail?.equipment_id, loadedDetail?.issue_kind, loadedDetail?.stop_kind]);

  const applyMeasureOverdueNotifyFromConfig = useCallback(() => {
    let ids: number[] = [];
    if (isIssueForm) {
      const resolvedKind = resolveQualityIssueKindForOverdueNotify({
        issue_kind: loadedDetail?.issue_kind ?? formRef.current?.getFieldValue('issue_kind'),
        equipment_id: loadedDetail?.equipment_id ?? formRef.current?.getFieldValue('equipment_id'),
      });
      ids = getQualityIssueOverdueNotifyIdsForKind(haoligoParameters, resolvedKind);
    } else if (isLineStopForm) {
      ids = getQualityLineStopOverdueNotifyIdsForKind(
        haoligoParameters,
        loadedDetail?.stop_kind ?? formRef.current?.getFieldValue('stop_kind'),
      );
    } else if (isComplaintForm) {
      ids = getQualityComplaintOverdueNotifyIds(haoligoParameters);
    }
    if (!ids.length) return;
    formRef.current?.setFieldsValue({
      temporary_overdue_notify_user_ids: ids,
      long_term_overdue_notify_user_ids: ids,
    });
    setMeasureOverdueNotifySeed({ temporary: ids, long_term: ids });
  }, [haoligoParameters, isComplaintForm, isIssueForm, isLineStopForm, loadedDetail?.equipment_id, loadedDetail?.issue_kind, loadedDetail?.stop_kind]);

  const measureOverdueNotifyField = (
    fieldName: 'temporary_overdue_notify_user_ids' | 'long_term_overdue_notify_user_ids',
  ) => (
    <>
      <FormNotifyUsersSelect
        name={fieldName}
        label="逾期提醒人"
        searchUsers={searchUsers}
        readonly={detailMode}
        colSpan={FORM_LAYOUT.FULL_COL_SPAN}
        seedUserIds={
          fieldName === 'temporary_overdue_notify_user_ids'
            ? measureOverdueNotifySeed.temporary
            : measureOverdueNotifySeed.long_term
        }
      />
      <Col span={FORM_LAYOUT.FULL_COL_SPAN}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          {measureOverdueNotifyHintText}
        </Typography.Text>
      </Col>
    </>
  );

  const measureOverdueDateField = (
    dueFieldName: 'temporary_due_at' | 'long_term_due_at',
    label: string,
  ) => (
    <ProFormDependency name={[dueFieldName]}>
      {(values) => (
        <Col span={12}>
          <Form.Item label={label}>
            <Typography.Text>{formatQualityMeasureOverdueAt(values[dueFieldName])}</Typography.Text>
          </Form.Item>
        </Col>
      )}
    </ProFormDependency>
  );

  const handleFields =
    viewMode !== 'register' ? (
      <>
        {showHandleResponsibleFields ? (
          <FormNotifyUsersSelect
            name="responsible_user_ids"
            label="责任人"
            searchUsers={searchUsers}
            readonly={detailMode}
            colSpan={FORM_LAYOUT.FULL_COL_SPAN}
          />
        ) : null}
        {showMeasureFields ? (
          <>
            {showTemporaryMeasureFields ? (
              <>
                <ProFormTextArea name="temporary_action" label="临时措施" colProps={{ span: 24 }} />
                <ProFormDateTimePicker
                  name="temporary_due_at"
                  label="临时措施预计完成时间"
                  colProps={{ span: 12 }}
                  fieldProps={dateTimeFieldProps}
                />
                {combinedHandleMeasures ? (
                  <>
                    {measureOverdueDateField('temporary_due_at', '临时措施逾期时间')}
                    {measureOverdueNotifyField('temporary_overdue_notify_user_ids')}
                  </>
                ) : null}
                {measureImageUploadField('临时措施落实情况', temporaryActionImageUuids, setTemporaryActionImageUuids)}
              </>
            ) : null}
            {showLongTermMeasureFields ? (
              <>
                <ProFormTextArea name="long_term_action" label="长期措施" colProps={{ span: 24 }} />
                <ProFormDateTimePicker
                  name="long_term_due_at"
                  label="长期措施预计完成时间"
                  colProps={{ span: 12 }}
                  fieldProps={dateTimeFieldProps}
                />
                {combinedHandleMeasures ? (
                  <>
                    {measureOverdueDateField('long_term_due_at', '长期措施逾期时间')}
                    {measureOverdueNotifyField('long_term_overdue_notify_user_ids')}
                  </>
                ) : null}
                {measureImageUploadField('长期措施落实情况', longTermActionImageUuids, setLongTermActionImageUuids)}
              </>
            ) : null}
          </>
        ) : null}
        {showCloseFields && !isComplaintForm ? (
          <ProFormDateTimePicker
            name="recovered_at"
            label={isLineStopForm ? '恢复生产时间' : '恢复生产时间（停线）'}
            colProps={{ span: 12 }}
            fieldProps={dateTimeFieldProps}
          />
        ) : null}
        {showCloseFields && !isLineStopForm ? (
          <ProFormTextArea name="close_note" label={isComplaintForm ? '结案确认' : '结案备注'} colProps={{ span: 24 }} />
        ) : null}
      </>
    ) : null;

  const notifyFields = (
    <>
      <FormNotifyUsersSelect
        name="responsible_user_ids"
        label={isComplaintForm ? '提交相应责任人' : isIssueForm ? QUALITY_ISSUE_RESPONSIBLE_USER_LABEL : QUALITY_LINE_STOP_RESPONSIBLE_USER_LABEL}
        searchUsers={searchUsers}
        readonly={detailMode}
        colSpan={FORM_LAYOUT.DEFAULT_COL_SPAN}
      />
      <FormNotifyUsersSelect
        name="notify_user_ids"
        label={
          isIssueForm
            ? QUALITY_ISSUE_NOTIFY_USER_LABEL
            : isComplaintForm
              ? QUALITY_COMPLAINT_NOTIFY_USER_LABEL
              : QUALITY_LINE_STOP_NOTIFY_USER_LABEL
        }
        searchUsers={searchUsers}
        readonly={detailMode}
        colSpan={FORM_LAYOUT.DEFAULT_COL_SPAN}
      />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<T>
          headerTitle={title}
          columnPersistenceId={persistenceId}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton={viewMode !== 'handle'}
          createButtonText={`新建${title}`}
          onCreate={() => void openModal(undefined, false)}
          toolBarActions={
            combinedHandleMeasures
              ? [
                  <Button
                    key="overdue-notify-setting"
                    icon={<SettingOutlined />}
                    onClick={() => setOverdueNotifySettingOpen(true)}
                  >
                    {QUALITY_OVERDUE_NOTIFY_SETTING_TOOLBAR_LABEL}
                  </Button>,
                ]
              : []
          }
          showDatasetConfigButton={showWorkOrderFields}
          onDatasetConfig={showWorkOrderFields ? () => setBindingModalOpen(true) : undefined}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            const statusVal = searchFormValues?.status;
            const explicitStatus = typeof statusVal === 'string' && statusVal && statusVal !== 'all' ? statusVal : undefined;
            // 登记页、处理页：默认展示全部状态（含已提交、已结案单据）；可按状态筛选。
            let status: string | undefined;
            if (viewMode === 'register' || viewMode === 'handle') {
              status = explicitStatus && explicitStatus !== 'all' ? explicitStatus : undefined;
            } else {
              status = explicitStatus ?? (defaultStatus !== 'all' ? defaultStatus : undefined);
            }
            const res = await listFn({ skip, limit: pageSize, status, keyword: params.keyword as string | undefined });
            return { data: res.items || [], total: res.total || 0, success: true };
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        key={editingId != null ? `edit-${editingId}` : `create-${createFormKey}`}
        title={
          detailMode
            ? `${title}详情`
            : workflowStep
              ? title
              : editingId
                ? `编辑${title}`
                : `新建${title}`
        }
        open={modalOpen}
        readOnly={detailMode}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
          setWorkflowStep(null);
          setLoadedDetail(null);
          setTemporaryActionImageUuids([]);
          setLongTermActionImageUuids([]);
          setAttachmentFiles([]);
        }}
        onFinish={handleFinish}
        isEdit={Boolean(editingId)}
        initialValues={editingId == null ? createFormInitialValues : undefined}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        loading={formLoading}
        grid
        submitHidden={Boolean(workflowStep && !detailMode && editingId)}
        extraFooter={
          workflowStep && !detailMode && editingId ? (
            <Button type="primary" loading={formLoading} onClick={() => void submitWorkflowFromModal()}>
              {WORKFLOW_STEP_LABEL[workflowStep]}
            </Button>
          ) : undefined
        }
      >
        {registerDetailSection}
        {!showRegisterAsDetail ? (
        isLineStopForm ? (
          <>
            <ProFormRadio.Group
              name="stop_kind"
              label="停线类型"
              initialValue="equipment"
              rules={detailMode ? undefined : [{ required: true, message: '请选择停线类型' }]}
              options={[
                { label: '设备异常停线', value: 'equipment' },
                { label: '品质异常停线', value: 'quality' },
              ]}
              fieldProps={{ optionType: 'button', buttonStyle: 'solid', disabled: detailMode }}
              colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
            />
            <ProFormSelect name="workshop_id" label="车间" request={workshopOptionsRequest} showSearch colProps={{ span: 12 }} />
            <ProFormText name="production_line" label="产线" colProps={{ span: 12 }} />
            <ProFormDependency name={['workshop_id']}>
              {({ workshop_id: workshopId }) => (
                <ProFormSelect
                  name="equipment_id"
                  label="设备"
                  params={{ workshopId }}
                  request={async ({ keyWords }) => {
                    const res = await listEquipments({
                      workshop_id: workshopId || undefined,
                      keyword: keyWords || undefined,
                      limit: 50,
                    });
                    return (res.items as EquipmentRow[]).map((e) => ({
                      label: `${e.asset_code} ${e.name}`.trim(),
                      value: e.id,
                    }));
                  }}
                  showSearch
                  colProps={{ span: 12 }}
                  fieldProps={{
                    allowClear: true,
                    disabled: detailMode,
                    placeholder: workshopId ? '请选择设备' : '请先选择车间',
                  }}
                />
              )}
            </ProFormDependency>
            <ProFormTextArea name="stop_reason" label="停线原因描述" colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }} />
            <ProFormDateTimePicker name="stop_started_at" label="停线开始时间" colProps={{ span: 12 }} fieldProps={dateTimeFieldProps} />
          </>
        ) : isComplaintForm ? (
          <>
            <ProFormText name="customer_name" label="客户信息" colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }} />
            <ProFormText name="material_code" label="物料号" colProps={{ span: 12 }} />
            <ProFormText name="model" label="型号" colProps={{ span: 12 }} />
            <ProFormText name="batch_no" label="批次号" colProps={{ span: 12 }} />
            <ProFormDigit name="quantity" label="不良数量" min={0} colProps={{ span: 12 }} />
            <ProFormTextArea name="problem_description" label="描述不良现象" colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }} />
            {attachmentField}
            <ProFormDigit name="claim_amount" label="赔偿金额" min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
          </>
        ) : showWorkOrderFields ? (
          <>
            <ProFormText
              name="work_order_no"
              label="制令单号"
              tooltip={t('app.haoligo.quality.workOrder.scanTooltip')}
              colProps={{ span: FORM_LAYOUT.DEFAULT_COL_SPAN }}
              fieldProps={{
                allowClear: true,
                style: { width: '100%' },
                addonAfter: !detailMode ? (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: '0 8px' }}
                    loading={prefillBusy}
                    disabled={!canPrefillFromDataset}
                    onClick={() => void runWorkOrderPrefill()}
                  >
                    {t('app.haoligo.equipment.documents.outputPrefillInlineBtn')}
                  </Button>
                ) : undefined,
              }}
            />
            <ProFormText name="material_code_snapshot" label="物料号" colProps={{ span: 12 }} />
            <ProFormText name="model_snapshot" label="型号" colProps={{ span: 12 }} />
            <ProFormText name="mold_code_snapshot" label="模具号" colProps={{ span: 12 }} />
            {issueKindField}
            <ProFormTextArea name="problem_description" label="问题描述" colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }} />
            {renderExtraFields?.({ readOnly: detailMode })}
            {attachmentField}
            {issueQtyFields}
            <ProFormSelect name="workshop_id" label="责任车间" request={workshopOptionsRequest} showSearch colProps={{ span: 12 }} />
            <ProFormText name="production_line" label="产线" colProps={{ span: 12 }} />
            <ProFormSelect name="equipment_id" label="设备" request={equipmentOptionsRequest} showSearch colProps={{ span: 12 }} />
          </>
        ) : (
          <>
            <ProFormSelect name="workshop_id" label="责任车间" request={workshopOptionsRequest} showSearch colProps={{ span: 12 }} />
            <ProFormSelect name="equipment_id" label="关联设备" request={equipmentOptionsRequest} showSearch colProps={{ span: 12 }} />
            <ProFormText name="production_line" label="产线" colProps={{ span: 12 }} />
            {issueKindField}
            <ProFormTextArea name="problem_description" label="问题描述" colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }} />
            {renderExtraFields?.({ readOnly: detailMode })}
            {attachmentField}
            {issueQtyFields}
          </>
        )
        ) : null}
        {showRegisterAsDetail && viewMode !== 'register' ? (
          <Col span={FORM_LAYOUT.FULL_COL_SPAN}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              处理措施
            </Typography.Title>
          </Col>
        ) : null}
        {handleFields}
        {!showRegisterAsDetail ? (
        isLineStopForm ? (
          <ProFormDependency name={['stop_kind']}>
            {({ stop_kind: stopKind }) => (
              <>
                <FormNotifyUsersSelect
                  name="responsible_user_ids"
                  label={QUALITY_LINE_STOP_RESPONSIBLE_USER_LABEL}
                  searchUsers={searchUsers}
                  readonly={detailMode}
                  colSpan={FORM_LAYOUT.DEFAULT_COL_SPAN}
                />
                <FormNotifyUsersSelect
                  name="notify_user_ids"
                  label={QUALITY_LINE_STOP_NOTIFY_USER_LABEL}
                  searchUsers={searchUsers}
                  readonly={detailMode}
                  colSpan={FORM_LAYOUT.DEFAULT_COL_SPAN}
                />
                <Col span={FORM_LAYOUT.FULL_COL_SPAN}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: -8, marginBottom: 8, fontSize: 12 }}>
                    {stopKind === 'quality'
                      ? '品质异常停线：建议通知生产部长、品质部长'
                      : '设备异常停线：建议通知生产部长、工程部长'}
                  </Typography.Text>
                </Col>
              </>
            )}
          </ProFormDependency>
        ) : (
          notifyFields
        )
        ) : null}
        {viewMode === 'all' ? (
          <ProFormSelect
            name="status"
            label="状态"
            valueEnum={{
              registered: { text: '已登记' },
              assigned: { text: '待处理' },
              processing: { text: '处理中' },
              completed: { text: '已完成' },
            }}
            colProps={{ span: 12 }}
          />
        ) : null}
        {!showRegisterAsDetail ? (
          <>
            <ProFormDateTimePicker name="reported_at" label="反馈时间" colProps={{ span: 12 }} fieldProps={dateTimeFieldProps} />
            {viewMode !== 'register' && !isLineStopForm ? (
              <ProFormDateTimePicker name="due_at" label="计划完成时间" colProps={{ span: 12 }} fieldProps={dateTimeFieldProps} />
            ) : null}
          </>
        ) : null}
      </FormModalTemplate>

      {showWorkOrderFields ? (
        <QualityWorkOrderDatasetBindingModal
          open={bindingModalOpen}
          binding={workOrderBinding}
          onClose={() => setBindingModalOpen(false)}
          onSaved={(saved) => setWorkOrderBinding(saved?.dataset_uuid?.trim() ? saved : null)}
        />
      ) : null}
      {combinedHandleMeasures ? (
        <QualityTicketOverdueNotifySettingModal
          profile={formProfile}
          open={overdueNotifySettingOpen}
          onOpenChange={setOverdueNotifySettingOpen}
          searchUsers={searchUsers}
          onSaved={(haoligoParams) => {
            setHaoligoParameters(haoligoParams);
            applyMeasureOverdueNotifyFromConfig();
          }}
        />
      ) : null}
    </>
  );
}

export default QualityTicketPage;
