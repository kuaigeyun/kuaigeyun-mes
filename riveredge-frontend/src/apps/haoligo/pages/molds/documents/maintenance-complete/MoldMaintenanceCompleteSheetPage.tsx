/**
 * 好力 GO — 模具维保完成单（基础信息 + 模具信息；对齐移动端稿）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { rowActionKind } from '../../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDependency,
  ProFormInstance,
  ProFormList,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { App, Alert, Button, Col, Divider, Input, Modal, Row, Space, Spin, Table, Tooltip, Typography, Upload } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import HaoligoDocumentPrintModal from '../../../../components/HaoligoDocumentPrintModal';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { UniTable } from '../../../../../../components/uni-table';
import { UniTableStackedPrimaryCell } from '../../../../../../components/uni-table/stackedPrimaryColumn';
import { useGlobalStore } from '../../../../../../stores/globalStore';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { uploadFile } from '../../../../../../services/file';
import { DictionarySelect } from '../../../../../../components/dictionary-select';
import { MoldUpkeepRecordFields } from '../../../../components/MoldUpkeepRecordFields';
import { ReadonlyAttachmentStrip } from '../../../../components/ReadonlyAttachmentStrip';
import { uuidsToSecureUploadFileList } from '../../../../utils/secureUploadFileList';
import { UniUserIdSelect } from '../../../../../../components/uni-user-id-select';
import { useApplicantUserIdField } from '../../../../hooks/useApplicantUserIdField';
import {
  createMoldMaintenanceCompleteSheet,
  deleteMoldMaintenanceCompleteSheet,
  getMoldMaintenanceCompleteSheet,
  getMoldMaintenanceSheet,
  HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS,
  listHaoligoNotifyUserOptions,
  listMoldMaintenanceCompleteSheets,
  listMoldMaintenanceSheets,
  listMoldUpkeepParamSets,
  updateMoldMaintenanceCompleteSheet,
  type MoldMaintenanceCompleteSheetCreatePayload,
  type MoldMaintenanceCompleteSheetRow,
  type MoldMaintenanceCompleteSheetUpdatePayload,
  type MoldMaintenanceSheetRow,
} from '../../../../services/haoligo';
import {
  inhouseCompleteResourceForServiceType,
  inhouseSheetResourceForServiceType,
  type InhouseMaintenanceServiceType,
} from '../../../../constants/documentPermissionResources';
import { canPrintHaoligoDocument } from '../../../../utils/documentPrintPermission';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';
import { INHOUSE_COMPLETE_SOURCE_MAINTENANCE_PARAM } from '../../../../utils/inhouseCompleteNavigation';
import { resolvePrimaryMoldStacked } from '../../../../utils/moldPicker';

const MAINT_COMPLETE_DOC_NOTIFICATION = 'haoligo_mold_maintenance_complete';
const MAINT_COMPLETE_ACTION_CREATED = 'created';

function parseNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

function normUploadUuids(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const item of val) {
    const anyItem = item as { response?: { uuid?: string }; uid?: string };
    const u =
      anyItem?.response?.uuid ??
      (typeof anyItem?.uid === 'string' && /^[0-9a-f-]{36}$/i.test(anyItem.uid) ? anyItem.uid : null);
    if (u) out.push(u);
  }
  return out;
}

/** 来源单表头 + 模具行「保养前 / 维修前」附件预览 */
type BeforeAttachmentPreview = {
  header: string[];
  byMold: Record<string, string[]>;
};

function formatMaintRowLabel(r: MoldMaintenanceSheetRow): string {
  return [
    r.sheet_no && String(r.sheet_no).trim(),
    (r.source_order_no && String(r.source_order_no).trim()) || `维保单#${r.id}`,
    r.primary_mold_code ? `· ${r.primary_mold_code}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** 选择来源弹窗：与「首件模具」一致，取 primary 或首条有代号的明细 */
function pickerDisplayMold(r: MoldMaintenanceSheetRow): { code: string; name: string } {
  const lines = r.line_items || [];
  const primary = (r.primary_mold_code && String(r.primary_mold_code).trim()) || '';
  if (primary) {
    const hit = lines.find((it) => String(it.mold_code ?? '').trim() === primary);
    const nm = hit?.mold_name != null ? String(hit.mold_name).trim() : '';
    return { code: primary, name: nm || '—' };
  }
  const first = lines.find((it) => String(it.mold_code ?? '').trim());
  if (!first) return { code: '—', name: '—' };
  const code = String(first.mold_code ?? '').trim();
  const nm = first.mold_name != null ? String(first.mold_name).trim() : '';
  return { code, name: nm || '—' };
}

function SourceMaintSheetPickerTrigger({
  value,
  onOpen,
  onClear,
  maintRows,
  disabled,
}: {
  value?: number | string | null;
  onOpen: () => void;
  onClear: () => void;
  maintRows: MoldMaintenanceSheetRow[];
  disabled?: boolean;
}) {
  const n =
    value === '' || value === undefined || value === null
      ? NaN
      : typeof value === 'string'
        ? Number(value)
        : Number(value);
  const r = Number.isFinite(n) ? maintRows.find((x) => x.id === n) : undefined;
  const text = r ? formatMaintRowLabel(r) : '';
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        readOnly
        value={text}
        placeholder="请选择来源维保单"
        style={{ flex: 1, minWidth: 0, cursor: disabled ? 'default' : 'pointer' }}
        onClick={() => {
          if (!disabled) onOpen();
        }}
      />
      <Button type="primary" disabled={disabled} onClick={() => onOpen()}>
        选择
      </Button>
      {!disabled ? (
        <Button htmlType="button" onClick={onClear}>
          清除
        </Button>
      ) : null}
    </Space.Compact>
  );
}

const COMPLETION_SUMMARY_COL_WIDTH = 120;

function renderCompletionSummaryCell(text: string) {
  if (!text || text === '—') return '—';
  return (
    <div
      style={{
        width: COMPLETION_SUMMARY_COL_WIDTH,
        maxWidth: COMPLETION_SUMMARY_COL_WIDTH,
        overflow: 'hidden',
      }}
    >
      <Typography.Text ellipsis={{ tooltip: text }} style={{ width: '100%' }}>
        {text}
      </Typography.Text>
    </div>
  );
}

export type MoldMaintenanceCompleteServiceType = InhouseMaintenanceServiceType;

const COMPLETE_PAGE_META: Record<
  MoldMaintenanceCompleteServiceType,
  {
    headerTitle: string;
    sheetNoTitle: string;
    createModalTitle: string;
    editModalTitle: string;
    detailModalTitle: string;
    persistenceId: string;
    sourceMaintLabel: string;
    sourcePickerTitle: string;
    sourcePickerEmpty: string;
  }
> = {
  保养: {
    headerTitle: '模具保养完成单',
    sheetNoTitle: '保养完成单单号',
    createModalTitle: '新增保养完成单',
    editModalTitle: '编辑保养完成单',
    detailModalTitle: '保养完成单详情',
    persistenceId: 'apps.haoligo.pages.molds.documents.upkeep-complete',
    sourceMaintLabel: '来源保养单',
    sourcePickerTitle: '选择来源保养单',
    sourcePickerEmpty: '暂无待确认完修的保养单',
  },
  维修: {
    headerTitle: '模具维修完成单',
    sheetNoTitle: '维修完成单单号',
    createModalTitle: '新增维修完成单',
    editModalTitle: '编辑维修完成单',
    detailModalTitle: '维修完成单详情',
    persistenceId: 'apps.haoligo.pages.molds.documents.repair-complete',
    sourceMaintLabel: '来源维修单',
    sourcePickerTitle: '选择来源维修单',
    sourcePickerEmpty: '暂无待确认完修的维修单',
  },
};

const defaultMoldLine = () => ({
  mold_code: '',
  mold_name: '',
  repair_reason: '',
  clear_total_production: true,
  upkeep_content: '',
  upkeep_param_set_id: undefined as number | undefined,
  upkeep_record_lines: [] as { param_id: number; record_value?: string }[],
  repair_content: '',
  repair_result: undefined as string | undefined,
  item_attachments: [] as UploadFile[],
});

export function MoldMaintenanceCompleteSheetPage({
  serviceType,
}: {
  serviceType: MoldMaintenanceCompleteServiceType;
}) {
  const pageMeta = COMPLETE_PAGE_META[serviceType];
  const completeResource = inhouseCompleteResourceForServiceType(serviceType);
  const sourceSheetResource = inhouseSheetResourceForServiceType(serviceType);
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { canUpdate: canUpdateComplete, canDelete: canDeleteComplete } = useResourcePermissions(completeResource);
  const canPrintComplete = canPrintHaoligoDocument(currentUser, completeResource);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const {
    applicantPresetUsers,
    leafDeptOptions,
    onApplicantPicked,
    preloadTenantFormOptions,
    getCreateApplicantDefaults,
    resolveInitDepartmentUuid,
    presetFromApplicantRow,
    resetApplicantToCurrentUser,
    searchApplicantUsers,
  } = useApplicantUserIdField(formRef);
  const notifyLabelRef = useRef(new Map<number, string>());

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });
  const completeNotifyRule = useMemo(
    () =>
      findEnabledBusinessNotificationRule(
        businessConfigRes?.parameters?.notifications,
        MAINT_COMPLETE_DOC_NOTIFICATION,
        MAINT_COMPLETE_ACTION_CREATED,
      ),
    [businessConfigRes?.parameters?.notifications],
  );
  const completeNotifyDefaults = useMemo(
    () => getFormNotifyUserDefaultsFromRule(completeNotifyRule),
    [completeNotifyRule],
  );

  const searchCompleteNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const fromArg = (selectedIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      const selIds =
        fromArg.length > 0
          ? fromArg
          : ((formRef.current?.getFieldValue('complete_notify_user_ids') as number[] | undefined) || []);
      const users = await listHaoligoNotifyUserOptions({
        keyword,
        limit: 80,
        selected_user_ids: selIds,
      });
      const opts = users.map((u) => ({ label: u.label, value: u.id }));
      for (const o of opts) {
        notifyLabelRef.current.set(o.value, o.label);
      }
      return opts;
    },
    [],
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printRowId, setPrintRowId] = useState<number | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [maintRows, setMaintRows] = useState<MoldMaintenanceSheetRow[]>([]);
  const [beforeAttachmentPreview, setBeforeAttachmentPreview] = useState<BeforeAttachmentPreview | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [upkeepSetOptions, setUpkeepSetOptions] = useState<{ value: number; label: string }[]>([]);

  const loadUpkeepSetOptions = useCallback(async () => {
    if (serviceType !== '保养') {
      setUpkeepSetOptions([]);
      return;
    }
    try {
      const sets = await listMoldUpkeepParamSets();
      setUpkeepSetOptions(sets.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })));
    } catch {
      setUpkeepSetOptions([]);
    }
  }, [serviceType]);

  const maintRowsForPicker = useMemo(
    () => maintRows.filter((r) => String(r.service_type ?? '').trim() === serviceType),
    [maintRows, serviceType],
  );

  const maintPickerColumns: ColumnsType<MoldMaintenanceSheetRow> = useMemo(
    () => [
      { title: '单号', dataIndex: 'sheet_no', ellipsis: true, width: 120 },
      {
        title: '模具代号',
        key: 'mold_code',
        ellipsis: true,
        width: 120,
        render: (_: unknown, r) => pickerDisplayMold(r).code,
      },
      {
        title: '模具名称',
        key: 'mold_name',
        ellipsis: true,
        width: 160,
        render: (_: unknown, r) => pickerDisplayMold(r).name,
      },
      { title: '申请人', dataIndex: 'applicant_name', width: 90, ellipsis: true },
      { title: '申请部门', dataIndex: 'department_name', width: 100, ellipsis: true },
    ],
    [],
  );

  const applySelectedMaintSheetRow = useCallback(
    async (row: MoldMaintenanceSheetRow) => {
      const n = row.id;
      const srcNo =
        (row.source_order_no && String(row.source_order_no).trim()) ||
        (row.sheet_no && String(row.sheet_no).trim()) ||
        `维保单#${n}`;
      const byMold: Record<string, string[]> = {};
      for (const it of row.line_items || []) {
        const mc = String(it.mold_code ?? '').trim();
        if (mc) byMold[mc] = [...(it.attachment_file_uuids || [])];
      }
      const preset = presetFromApplicantRow(row);
      await preloadTenantFormOptions(preset ? [preset] : undefined);
      setBeforeAttachmentPreview({
        header: [...(row.header_attachment_file_uuids || [])],
        byMold,
      });
      formRef.current?.setFieldsValue({
        source_maintenance_sheet_id: n,
        source_order_no: srcNo,
        service_type: serviceType,
        applicant_user_id: row.applicant_user_id ?? undefined,
        department_uuid: (row.department_uuid || '').trim() || undefined,
        line_items: (row.line_items || []).map((it) => ({
          mold_code: String(it.mold_code ?? '').trim(),
          mold_name: it.mold_name != null ? String(it.mold_name) : '',
          repair_reason: it.repair_reason != null ? String(it.repair_reason) : '',
          clear_total_production: true,
          upkeep_content: '',
          upkeep_param_set_id: undefined,
          upkeep_record_lines: [],
          repair_content: '',
          repair_result: undefined,
          item_attachments: [],
        })),
      });
    },
    [presetFromApplicantRow, preloadTenantFormOptions, serviceType],
  );

  const clearSelectedMaintSheet = useCallback(() => {
    setBeforeAttachmentPreview(null);
    formRef.current?.setFieldsValue({
      source_maintenance_sheet_id: undefined,
      source_order_no: '',
      service_type: serviceType,
      line_items: [defaultMoldLine()],
    });
    resetApplicantToCurrentUser();
  }, [resetApplicantToCurrentUser, serviceType]);

  const openSourceMaintPicker = useCallback(() => {
    setSourcePickerOpen(true);
  }, []);

  const loadMaintenanceSheetsForSource = useCallback(async (openForComplete: boolean) => {
    try {
      const res = await listMoldMaintenanceSheets({
        skip: 0,
        limit: 200,
        service_type: serviceType,
        ...(openForComplete ? { open_for_complete: true } : {}),
      });
      setMaintRows(res.items);
    } catch {
      setMaintRows([]);
    }
  }, [serviceType]);

  const uploadFieldProps = useMemo<UploadProps>(
    () =>
      withMoldPictureCardUploadClass({
      listType: 'picture-card',
      accept: '.jpg,.jpeg,.png,.gif,.webp',
      beforeUpload: (file) => {
        const isLt30M = (file.size ?? 0) / 1024 / 1024 < 30;
        if (!isLt30M) {
          messageApi.error('单个文件需小于 30MB');
          return Upload.LIST_IGNORE;
        }
        return true;
      },
      customRequest: async (options) => {
        try {
          const file = options.file as Parameters<typeof uploadFile>[0];
          const res = await uploadFile(file, { category: 'haoligo_mold_maint_complete' });
          options.onSuccess?.(res, options.file);
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
      }),
    [messageApi],
  );

  const closeSheetModal = useCallback(() => {
    setModalVisible(false);
    setEditId(null);
    setIsDetailView(false);
    setFormOptionsReady(false);
    setBeforeAttachmentPreview(null);
  }, []);

  const handleCreate = async () => {
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormOptionsReady(false);
    setModalVisible(true);
    try {
      await Promise.all([loadMaintenanceSheetsForSource(true), loadUpkeepSetOptions()]);
      await preloadTenantFormOptions(undefined);
      const applicantDefaults = getCreateApplicantDefaults();
      setFormInitialValues({
        service_type: serviceType,
        ...applicantDefaults,
        source_maintenance_sheet_id: undefined,
        source_order_no: '',
        complete_notify_user_ids: [...completeNotifyDefaults],
        line_items: [defaultMoldLine()],
      });
      setBeforeAttachmentPreview(null);
      startTransition(() => setFormOptionsReady(true));
    } catch (e) {
      messageApi.error((e as Error).message || '加载选项失败');
      setModalVisible(false);
      setFormOptionsReady(false);
    }
  };

  const startCreateWithSourceSheet = useCallback(
    async (row: MoldMaintenanceSheetRow) => {
      setIsDetailView(false);
      setIsEdit(false);
      setEditId(null);
      setFormOptionsReady(false);
      setModalVisible(true);
      try {
        const fullRow = row.line_items?.length ? row : await getMoldMaintenanceSheet(row.id);
        if (String(fullRow.service_type ?? '').trim() !== serviceType) {
          messageApi.warning(`该单据为${fullRow.service_type || '—'}类型，请从对应菜单打开`);
          setModalVisible(false);
          return;
        }
        await Promise.all([loadMaintenanceSheetsForSource(true), loadUpkeepSetOptions()]);
        setMaintRows((prev) => {
          if (prev.some((x) => x.id === fullRow.id)) return prev;
          return [fullRow, ...prev];
        });
        const byMold: Record<string, string[]> = {};
        for (const it of fullRow.line_items || []) {
          const mc = String(it.mold_code ?? '').trim();
          if (mc) byMold[mc] = [...(it.attachment_file_uuids || [])];
        }
        const preset = presetFromApplicantRow(fullRow);
        await preloadTenantFormOptions(preset ? [preset] : undefined);
        const srcNo =
          (fullRow.source_order_no && String(fullRow.source_order_no).trim()) ||
          (fullRow.sheet_no && String(fullRow.sheet_no).trim()) ||
          `维保单#${fullRow.id}`;
        setBeforeAttachmentPreview({
          header: [...(fullRow.header_attachment_file_uuids || [])],
          byMold,
        });
        setFormInitialValues({
          service_type: serviceType,
          applicant_user_id: fullRow.applicant_user_id ?? undefined,
          department_uuid: (fullRow.department_uuid || '').trim() || undefined,
          source_maintenance_sheet_id: fullRow.id,
          source_order_no: srcNo,
          complete_notify_user_ids: [...completeNotifyDefaults],
          line_items: (fullRow.line_items || []).map((it) => ({
            mold_code: String(it.mold_code ?? '').trim(),
            mold_name: it.mold_name != null ? String(it.mold_name) : '',
            repair_reason: it.repair_reason != null ? String(it.repair_reason) : '',
            clear_total_production: true,
            upkeep_content: '',
            upkeep_param_set_id: undefined,
            upkeep_record_lines: [],
            repair_content: '',
            repair_result: undefined,
            item_attachments: [],
          })),
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || '无法创建维保完成单');
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    },
    [
      completeNotifyDefaults,
      loadMaintenanceSheetsForSource,
      loadUpkeepSetOptions,
      messageApi,
      presetFromApplicantRow,
      preloadTenantFormOptions,
      serviceType,
    ],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConsumedRef = useRef(false);

  useEffect(() => {
    const raw = searchParams.get(INHOUSE_COMPLETE_SOURCE_MAINTENANCE_PARAM);
    if (!raw || deepLinkConsumedRef.current) return;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    deepLinkConsumedRef.current = true;
    setSearchParams({}, { replace: true });
    void (async () => {
      try {
        const row = await getMoldMaintenanceSheet(id);
        await startCreateWithSourceSheet(row);
      } catch (e) {
        messageApi.error((e as Error).message || '无法根据维保单打开维保完成单');
      }
    })();
  }, [messageApi, searchParams, setSearchParams, startCreateWithSourceSheet]);

  useNewShortcut(handleCreate);

  const openSheetForm = async (record: MoldMaintenanceCompleteSheetRow, detailOnly: boolean) => {
    setFormOptionsReady(false);
    setModalVisible(true);
    setIsDetailView(detailOnly);
    setIsEdit(true);
    setEditId(record.id);
    try {
      const d = await getMoldMaintenanceCompleteSheet(record.id);
      if ((d.service_type || '').trim() !== serviceType) {
        messageApi.error(`该单据为${d.service_type || '—'}类型，请从对应菜单打开`);
        setModalVisible(false);
        setFormOptionsReady(false);
        setIsDetailView(false);
        return;
      }
      let rows: MoldMaintenanceSheetRow[] = [];
      try {
        const res = await listMoldMaintenanceSheets({ skip: 0, limit: 200, service_type: serviceType });
        rows = res.items;
      } catch {
        rows = [];
      }
      const sid = d.source_maintenance_sheet_id;
      if (sid != null && !rows.some((x) => x.id === sid)) {
        try {
          const one = await getMoldMaintenanceSheet(sid);
          rows = [one, ...rows];
        } catch {
          /* 保留列表 */
        }
      }
      setMaintRows(rows);
      setEditId(d.id);
      const preset = presetFromApplicantRow(d);
      await Promise.all([
        preloadTenantFormOptions(preset ? [preset] : undefined),
        loadUpkeepSetOptions(),
      ]);
      const initDept = resolveInitDepartmentUuid(d.applicant_user_id, d.department_uuid);
      const line_items = await Promise.all(
        (d.line_items || []).map(async (it) => ({
          mold_code: it.mold_code,
          mold_name: it.mold_name ?? '',
          repair_reason: it.repair_reason ?? '',
          clear_total_production:
            d.service_type === '保养' ? (it.clear_total_production !== false ? true : false) : false,
          upkeep_content: it.upkeep_content ?? '',
          upkeep_param_set_id: it.upkeep_param_set_id ?? undefined,
          upkeep_record_lines: (it.upkeep_record_lines || []).map((ln) => ({
            param_id: ln.param_id,
            record_value: ln.record_value ?? '',
          })),
          repair_content: it.repair_content ?? '',
          repair_result: it.repair_result ?? undefined,
          item_attachments: await uuidsToSecureUploadFileList(it.attachment_file_uuids),
        })),
      );
      setFormInitialValues({
        source_maintenance_sheet_id: d.source_maintenance_sheet_id ?? undefined,
        source_order_no: d.source_order_no,
        service_type: d.service_type,
        applicant_user_id: d.applicant_user_id ?? undefined,
        department_uuid: initDept,
        complete_notify_user_ids:
          d.complete_notify_user_ids?.length ? d.complete_notify_user_ids : [...completeNotifyDefaults],
        line_items,
      });
      if (d.source_maintenance_sheet_id != null) {
        const byMold: Record<string, string[]> = {};
        for (const it of d.line_items || []) {
          const mc = String(it.mold_code ?? '').trim();
          if (mc) byMold[mc] = [...(it.source_attachment_file_uuids ?? [])];
        }
        setBeforeAttachmentPreview({
          header: [...(d.source_header_attachment_file_uuids || [])],
          byMold,
        });
      } else {
        setBeforeAttachmentPreview(null);
      }
      startTransition(() => setFormOptionsReady(true));
    } catch (e) {
      messageApi.error((e as Error).message || '加载模具维保完成单失败');
      closeSheetModal();
    }
  };

  const handleEdit = (record: MoldMaintenanceCompleteSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldMaintenanceCompleteSheetRow) => void openSheetForm(record, true);

  const handleDeleteOne = (record: MoldMaintenanceCompleteSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除模具维保完成单「${record.source_order_no}」吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldMaintenanceCompleteSheet(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const triggerSubmit = useCallback(() => {
    if (!formOptionsReady) {
      messageApi.warning('表单加载中，请稍候');
      return;
    }
    globalThis.setTimeout(() => {
      const inst = formRef.current;
      if (!inst || typeof inst.submit !== 'function') {
        messageApi.warning('表单未就绪');
        return;
      }
      inst.submit();
    }, 0);
  }, [formOptionsReady, messageApi]);

  useSubmitShortcut(triggerSubmit, modalVisible && !isDetailView);

  const buildUpdatePayload = (values: Record<string, unknown>): MoldMaintenanceCompleteSheetUpdatePayload => {
    const rawLines = values.line_items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const st = serviceType;
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      const base = {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim() || null,
      };
      if (st === '保养') {
        const rawRec = r.upkeep_record_lines;
        const upkeep_record_lines = Array.isArray(rawRec)
          ? rawRec
              .map((ln) => {
                const row = ln as Record<string, unknown>;
                const pid = Number(row.param_id);
                if (!Number.isFinite(pid)) return null;
                const rv = String(row.record_value ?? '').trim();
                return { param_id: pid, record_value: rv || null };
              })
              .filter((x): x is { param_id: number; record_value: string | null } => x != null)
          : undefined;
        const setIdRaw = r.upkeep_param_set_id;
        const upkeep_param_set_id =
          setIdRaw != null && setIdRaw !== '' && Number.isFinite(Number(setIdRaw)) ? Number(setIdRaw) : null;
        return {
          ...base,
          clear_total_production: r.clear_total_production !== false && r.clear_total_production !== 0,
          upkeep_content: String(r.upkeep_content ?? '').trim() || null,
          upkeep_param_set_id,
          upkeep_record_lines: upkeep_record_lines?.length ? upkeep_record_lines : undefined,
          attachment_file_uuids: normUploadUuids(r.item_attachments),
        };
      }
      return {
        ...base,
        clear_total_production: false,
        repair_content: String(r.repair_content ?? '').trim() || null,
        repair_result: (() => {
          const x = r.repair_result;
          if (x === undefined || x === null || x === '') return null;
          return String(x).trim();
        })(),
        attachment_file_uuids: normUploadUuids(r.item_attachments),
      };
    });
    const sid = values.source_maintenance_sheet_id;
    let source_maintenance_sheet_id: number | null | undefined;
    if (sid !== undefined && sid !== null && sid !== '') {
      const n = Number(sid);
      if (Number.isFinite(n)) source_maintenance_sheet_id = n;
    }
    const patch: MoldMaintenanceCompleteSheetUpdatePayload = {
      source_maintenance_sheet_id,
      source_order_no: String(values.source_order_no ?? '').trim(),
      service_type: st,
      header_attachment_file_uuids: [],
      line_items,
    };
    const aidRaw = values.applicant_user_id;
    if (aidRaw != null && aidRaw !== '' && Number.isFinite(Number(aidRaw))) {
      patch.applicant_user_id = Number(aidRaw);
    }
    const deptU = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (deptU) patch.department_uuid = deptU;
    patch.complete_notify_user_ids = parseNotifyUserIds(values.complete_notify_user_ids);
    return patch;
  };

  const buildCreatePayload = (values: Record<string, unknown>): MoldMaintenanceCompleteSheetCreatePayload => {
    const sid = values.source_maintenance_sheet_id;
    const n = typeof sid === 'string' ? Number(sid) : Number(sid);
    const st = serviceType;
    const rawLines = values.line_items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      const base = {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim() || null,
      };
      if (st === '保养') {
        const rawRec = r.upkeep_record_lines;
        const upkeep_record_lines = Array.isArray(rawRec)
          ? rawRec
              .map((ln) => {
                const row = ln as Record<string, unknown>;
                const pid = Number(row.param_id);
                if (!Number.isFinite(pid)) return null;
                const rv = String(row.record_value ?? '').trim();
                return { param_id: pid, record_value: rv || null };
              })
              .filter((x): x is { param_id: number; record_value: string | null } => x != null)
          : undefined;
        const setIdRaw = r.upkeep_param_set_id;
        const upkeep_param_set_id =
          setIdRaw != null && setIdRaw !== '' && Number.isFinite(Number(setIdRaw)) ? Number(setIdRaw) : null;
        return {
          ...base,
          clear_total_production: r.clear_total_production !== false && r.clear_total_production !== 0,
          upkeep_content: String(r.upkeep_content ?? '').trim() || null,
          upkeep_param_set_id,
          upkeep_record_lines: upkeep_record_lines?.length ? upkeep_record_lines : undefined,
          attachment_file_uuids: normUploadUuids(r.item_attachments),
        };
      }
      return {
        ...base,
        clear_total_production: false,
        repair_content: String(r.repair_content ?? '').trim() || null,
        repair_result: (() => {
          const x = r.repair_result;
          if (x === undefined || x === null || x === '') return null;
          return String(x).trim();
        })(),
        attachment_file_uuids: normUploadUuids(r.item_attachments),
      };
    });
    const aid = values.applicant_user_id;
    const applicant_user_id =
      aid != null && aid !== '' && Number.isFinite(Number(aid)) ? Number(aid) : undefined;
    const department_uuid =
      typeof values.department_uuid === 'string' ? values.department_uuid.trim() : undefined;
    return {
      source_maintenance_sheet_id: n,
      applicant_user_id,
      department_uuid,
      line_items,
      header_attachment_file_uuids: [],
      complete_notify_user_ids: parseNotifyUserIds(values.complete_notify_user_ids),
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!isEdit) {
      if (maintRows.length === 0) {
        messageApi.error('暂无可确认完修的厂内维保单');
        return Promise.reject(new Error('validation'));
      }
      const sid = values.source_maintenance_sheet_id;
      if (sid === undefined || sid === null || sid === '') {
        messageApi.error('请选择来源维保单');
        return Promise.reject(new Error('validation'));
      }
      const appAid = values.applicant_user_id;
      if (appAid == null || appAid === '' || !Number.isFinite(Number(appAid))) {
        messageApi.error('请选择申请人');
        return Promise.reject(new Error('validation'));
      }
      const deptU = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
      if (!deptU) {
        messageApi.error('请选择申请部门');
        return Promise.reject(new Error('validation'));
      }
      const payload = buildCreatePayload(values);
      if (!payload.line_items?.length) {
        messageApi.error('请至少填写一条模具明细');
        return Promise.reject(new Error('validation'));
      }
      const st = serviceType;
      for (let i = 0; i < payload.line_items.length; i++) {
        const li = payload.line_items[i];
        if (!li.mold_code) {
          messageApi.error(`模具明细第 ${i + 1} 条：请填写模具代号`);
          return Promise.reject(new Error('validation'));
        }
        if (st === '保养') {
          const rec = li.upkeep_record_lines;
          const hasRec = Array.isArray(rec) && rec.length > 0;
          if (hasRec) {
            for (let j = 0; j < rec.length; j++) {
              const row = rec[j];
              if (!row.record_value?.trim()) {
                messageApi.error(`模具明细第 ${i + 1} 条：请填写全部必填保养记录`);
                return Promise.reject(new Error('validation'));
              }
            }
          } else if (!li.upkeep_content?.trim()) {
            messageApi.error(`模具明细第 ${i + 1} 条：请填写保养内容或保养记录`);
            return Promise.reject(new Error('validation'));
          }
        } else {
          if (!li.repair_content?.trim()) {
            messageApi.error(`模具明细第 ${i + 1} 条：请填写维修内容`);
            return Promise.reject(new Error('validation'));
          }
          if (!li.repair_result?.trim()) {
            messageApi.error(`模具明细第 ${i + 1} 条：请选择维修结果`);
            return Promise.reject(new Error('validation'));
          }
        }
      }
      setFormLoading(true);
      try {
        await createMoldMaintenanceCompleteSheet(payload);
        messageApi.success('已提交');
        closeSheetModal();
        actionRef.current?.reload();
      } catch (e) {
        if ((e as Error).message !== 'validation') {
          messageApi.error((e as Error).message || '保存失败');
        }
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setFormLoading(false);
      }
      return;
    }

    if (maintRows.length > 0) {
      const sid = values.source_maintenance_sheet_id;
      if (sid === undefined || sid === null || sid === '') {
        messageApi.error('请选择来源维保单');
        return Promise.reject(new Error('validation'));
      }
    }
    const appAid = values.applicant_user_id;
    if (appAid == null || appAid === '' || !Number.isFinite(Number(appAid))) {
      messageApi.error('请选择申请人');
      return Promise.reject(new Error('validation'));
    }
    const deptUEdit = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (!deptUEdit) {
      messageApi.error('请选择申请部门');
      return Promise.reject(new Error('validation'));
    }
    const src = String(values.source_order_no ?? '').trim();
    if (!src) {
      messageApi.error('请输入或选择来源单号');
      return Promise.reject(new Error('validation'));
    }
    const payload = buildUpdatePayload(values);
    if (!payload.line_items?.length) {
      messageApi.error('至少保留一条模具信息');
      return Promise.reject(new Error('validation'));
    }
    const st = serviceType;
    for (let i = 0; i < (payload.line_items?.length ?? 0); i++) {
      const li = payload.line_items![i];
      if (!li.mold_code) {
        messageApi.error(`模具信息第 ${i + 1} 条：请填写模具代号`);
        return Promise.reject(new Error('validation'));
      }
      if (st === '保养') {
        const rec = li.upkeep_record_lines;
        const hasRec = Array.isArray(rec) && rec.length > 0;
        if (hasRec) {
          for (const row of rec) {
            if (!row.record_value?.trim()) {
              messageApi.error(`模具信息第 ${i + 1} 条：请填写全部必填保养记录`);
              return Promise.reject(new Error('validation'));
            }
          }
        } else if (!li.upkeep_content?.trim()) {
          messageApi.error(`模具信息第 ${i + 1} 条：请填写保养内容或保养记录`);
          return Promise.reject(new Error('validation'));
        }
      } else {
        if (!li.repair_content?.trim()) {
          messageApi.error(`模具信息第 ${i + 1} 条：请填写维修内容`);
          return Promise.reject(new Error('validation'));
        }
        if (!li.repair_result?.trim()) {
          messageApi.error(`模具信息第 ${i + 1} 条：请选择维修结果`);
          return Promise.reject(new Error('validation'));
        }
      }
    }
    setFormLoading(true);
    try {
      if (editId != null) {
        await updateMoldMaintenanceCompleteSheet(editId, payload);
        messageApi.success('已保存');
      }
      closeSheetModal();
      actionRef.current?.reload();
    } catch (e) {
      if ((e as Error).message !== 'validation') {
        messageApi.error((e as Error).message || '保存失败');
      }
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFormLoading(false);
    }
  };

  const onResetForm = () => {
    if (!formOptionsReady) {
      messageApi.warning('表单加载中，请稍候');
      return;
    }
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      service_type: serviceType,
      source_maintenance_sheet_id: undefined,
      source_order_no: '',
      line_items: [defaultMoldLine()],
    });
    resetApplicantToCurrentUser();
    setBeforeAttachmentPreview(null);
    messageApi.success('已重置');
  };

  const columns: ProColumns<MoldMaintenanceCompleteSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/来源单号/维修保养/申请人/申请部门' },
    },
    {
      title: pageMeta.sheetNoTitle,
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    { title: '来源单号', dataIndex: 'source_order_no', width: 160, ellipsis: true, copyable: true },
    { title: '申请人', dataIndex: 'applicant_name', width: 100, ellipsis: true, hideInSearch: true },
    { title: '申请部门', dataIndex: 'department_name', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: serviceType === '保养' ? '保养内容' : '维修摘要',
      key: 'completion_summary',
      width: COMPLETION_SUMMARY_COL_WIDTH,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: false,
      hideInSearch: true,
      onCell: () => ({
        style: {
          maxWidth: COMPLETION_SUMMARY_COL_WIDTH,
          overflow: 'hidden',
        },
      }),
      render: (_, r) => {
        const items = r.line_items || [];
        if (serviceType === '保养') {
          const parts = items
            .map((it) => (it.upkeep_content && String(it.upkeep_content).trim()) || '')
            .filter(Boolean);
          return renderCompletionSummaryCell(parts.length ? parts.join('；') : '—');
        }
        const parts: string[] = [];
        for (const it of items) {
          const rr = (it.repair_result && String(it.repair_result).trim()) || '';
          const rc = (it.repair_content && String(it.repair_content).trim()) || '';
          if (rr || rc) parts.push([rr, rc].filter(Boolean).join(' · '));
        }
        return renderCompletionSummaryCell(parts.length ? parts.join('；') : '—');
      },
    },
    {
      title: '清空总产量',
      dataIndex: 'clear_total_production',
      width: 110,
      hideInSearch: true,
      render: (_, r) => {
        if (serviceType !== '保养') return '—';
        const items = r.line_items || [];
        if (!items.length) return r.clear_total_production ? '是' : '否';
        const flags = items.map((i) => Boolean(i.clear_total_production));
        if (flags.every(Boolean)) return '是';
        if (!flags.some(Boolean)) return '否';
        return '部分';
      },
    },
    {
      title: '首件模具',
      dataIndex: 'primary_mold_code',
      minWidth: 168,
      width: 168,
      resizable: false,
      ellipsis: false,
      hideInSearch: true,
      render: (_, r) => {
        const { name, code } = resolvePrimaryMoldStacked(r);
        return <UniTableStackedPrimaryCell primary={name} secondary={code} />;
      },
    },
    {
      title: '模具条数',
      key: 'line_count',
      width: 88,
      hideInSearch: true,
      render: (_, r) => r.line_items?.length ?? 0,
    },
    moldDocumentCreatedAtColumn<MoldMaintenanceCompleteSheetRow>(),
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
        <Button key="view" {...rowActionKind('read')} onClick={() => void handleDetail(record)} />,
        ...(canPrintComplete
          ? [
              <Button
                key="print"
                {...rowActionKind('print')}
                onClick={() => {
                  setPrintRowId(record.id);
                  setPrintOpen(true);
                }}
              />,
            ]
          : []),
        <Button
          key="edit"
          {...rowActionKind('update')}
          disabled={!canUpdateComplete}
          onClick={() => void handleEdit(record)}
        />,
        <Button
          key="delete"
          {...rowActionKind('delete')}
          disabled={!canDeleteComplete}
          onClick={() => handleDeleteOne(record)}
        />,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldMaintenanceCompleteSheetRow>
          headerTitle={pageMeta.headerTitle}
          columnPersistenceId={pageMeta.persistenceId}
          completeCreateSourceResource={sourceSheetResource}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新增"
          onCreate={handleCreate}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listMoldMaintenanceCompleteSheets({
                skip,
                limit: pageSize,
                service_type: serviceType,
                keyword:
                  typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                    ? searchFormValues.keyword.trim()
                    : undefined,
              });
              return { data: res.items, success: true, total: res.total };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1548 }}
        />
      </ListPageTemplate>

      <Modal
        title={
          isDetailView
            ? pageMeta.detailModalTitle
            : isEdit
              ? pageMeta.editModalTitle
              : pageMeta.createModalTitle
        }
        open={modalVisible}
        onCancel={closeSheetModal}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView ? (
            <Button onClick={closeSheetModal}>关闭</Button>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Button htmlType="button" disabled={!formOptionsReady} onClick={onResetForm}>
                重置
              </Button>
              <Button
                htmlType="button"
                type="primary"
                disabled={!formOptionsReady}
                loading={formLoading}
                onClick={triggerSubmit}
              >
                提交{SUBMIT_SHORTCUT_HINT}
              </Button>
            </div>
          )
        }
      >
        <div className="form-modal-content-inner">
          {!formOptionsReady ? (
            <div
              style={{
                display: 'flex',
                minHeight: 280,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}
            >
              <Spin tip="加载选项中…" />
            </div>
          ) : (
            <ProForm
            key={modalVisible ? `${isEdit}-${editId ?? 'n'}` : 'closed'}
            formRef={formRef}
            loading={formLoading}
            readonly={isDetailView}
            onFinish={handleSubmit}
            onFinishFailed={({ errorFields }) => {
              const first = errorFields?.[0];
              const text = first?.errors?.filter(Boolean)[0];
              messageApi.error(text || '请检查表单');
            }}
            initialValues={formInitialValues}
            submitter={false}
            layout="vertical"
            scrollToFirstError
          >
            {!isEdit && maintRows.length === 0 ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="暂无可确认完修的厂内维保单"
                description="请先创建维保单且尚未确认完修后，再在此新增模具维保完成单。"
              />
            ) : null}
            <Row gutter={16}>
              <Col span={12}>
                {maintRows.length > 0 ? (
                  <ProForm.Item
                    name="source_maintenance_sheet_id"
                    label={pageMeta.sourceMaintLabel}
                    rules={[{ required: true, message: `请选择${pageMeta.sourceMaintLabel}` }]}
                  >
                    <SourceMaintSheetPickerTrigger
                      maintRows={maintRows}
                      disabled={isEdit}
                      onOpen={openSourceMaintPicker}
                      onClear={clearSelectedMaintSheet}
                    />
                  </ProForm.Item>
                ) : isEdit ? (
                  <ProFormText
                    name="source_order_no"
                    label="来源单号"
                    placeholder="请输入来源单号"
                    rules={[{ required: true, message: '请输入来源单号' }]}
                  />
                ) : null}
              </Col>
              {maintRows.length > 0 ? <ProFormText name="source_order_no" hidden /> : null}
              <ProFormText name="service_type" hidden />
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <UniUserIdSelect
                  name="applicant_user_id"
                  label="申请人"
                  placeholder="请输入姓名或账号搜索"
                  required
                  presetUsers={applicantPresetUsers}
                  onUserPicked={onApplicantPicked}
                  searchUsers={searchApplicantUsers}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="department_uuid"
                  label="申请部门"
                  placeholder="请选择申请部门"
                  rules={[{ required: true, message: '请选择申请部门' }]}
                  options={leafDeptOptions}
                  showSearch
                  fieldProps={{
                    virtual: true,
                    listHeight: 256,
                    optionFilterProp: 'label',
                  }}
                />
              </Col>
            </Row>

            <FormNotifyUsersSelect
              colSpan={12}
              name="complete_notify_user_ids"
              label="完修通知人员"
              placeholder="请选择完修通知人员（抄送）"
              readonly={isDetailView}
              seedUserIds={completeNotifyDefaults}
              searchUsers={searchCompleteNotifyUsers}
            />

            {beforeAttachmentPreview?.header?.length ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                }}
              >
                <div style={{ marginBottom: 6, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
                  {serviceType === '保养' ? '模具图片附件（保养前）' : '模具图片附件（维修前）'}
                </div>
                <ReadonlyAttachmentStrip uuids={beforeAttachmentPreview.header} />
              </div>
            ) : null}

            <Divider titlePlacement="left">模具明细</Divider>
            <ProFormList
              name="line_items"
              min={1}
              copyIconProps={false}
              creatorRecord={() => defaultMoldLine()}
              creatorButtonProps={isEdit && !isDetailView ? { creatorButtonText: '添加模具' } : false}
              itemRender={({ listDom, action }) => (
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  {listDom}
                  {action ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 2,
                        lineHeight: 1,
                      }}
                    >
                      {action}
                    </div>
                  ) : null}
                </div>
              )}
              actionRender={(field, action, _defaultActionDom, count) => {
                if (!isEdit || isDetailView || count <= 1) return [];
                return [
                  <Tooltip {...rowActionKind('delete')} key="remove" title="删除">
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => action.remove(field.name)}
                    />
                  </Tooltip>,
                ];
              }}
            >
              {(meta) => (
                <div
                  key={meta.key}
                  style={{
                    position: 'relative',
                    marginBottom: 12,
                    padding: '10px 40px 4px 12px',
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 6,
                  }}
                >
                  <Row gutter={16}>
                    <Col xs={24} sm={8}>
                      <ProFormText
                        name="mold_code"
                        label="模具代号"
                        placeholder="请输入模具代号"
                        rules={[{ required: true, message: '请填写模具代号' }]}
                        fieldProps={{ readOnly: !isEdit || isDetailView }}
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <ProFormText
                        name="mold_name"
                        label="模具名称"
                        placeholder="请输入模具名称"
                        fieldProps={{ readOnly: !isEdit || isDetailView }}
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <DictionarySelect
                        key={
                          serviceType === '保养'
                            ? 'HAOLIGO_MOLD_MAINTENANCE_REASON'
                            : 'HAOLIGO_MOLD_REPAIR_REASON'
                        }
                        dictionaryCode={
                          serviceType === '保养'
                            ? 'HAOLIGO_MOLD_MAINTENANCE_REASON'
                            : 'HAOLIGO_MOLD_REPAIR_REASON'
                        }
                        hostResource={completeResource}
                        name="repair_reason"
                        setFieldValueNamePath={['line_items', meta.name, 'repair_reason']}
                        label={serviceType === '保养' ? '保养原因' : '维修原因'}
                        placeholder={serviceType === '保养' ? '保养原因' : '维修原因'}
                        formRef={formRef}
                        simpleQuickCreate
                        colProps={{ span: 24 }}
                        readonly={!isEdit || isDetailView}
                      />
                    </Col>
                  </Row>
                  {serviceType === '保养' ? (
                        <>
                          <Row gutter={16} style={{ marginTop: 4 }}>
                            <MoldUpkeepRecordFields
                              fieldNamePrefix={['line_items', meta.name]}
                              readOnly={isDetailView}
                              upkeepSetOptions={upkeepSetOptions}
                            />
                          </Row>
                          <Row gutter={16} style={{ marginTop: 4 }}>
                            <Col span={24}>
                              <ProFormRadio.Group
                                name="clear_total_production"
                                label="是否重置总产量"
                                rules={[{ required: true, message: '请选择是否重置总产量' }]}
                                options={[
                                  { label: '是', value: true },
                                  { label: '否', value: false },
                                ]}
                              />
                            </Col>
                          </Row>
                        </>
                      ) : (
                        <>
                          <Row gutter={16} style={{ marginTop: 4 }}>
                            <Col span={24}>
                              <ProFormTextArea
                                name="repair_content"
                                label="维修内容"
                                placeholder="请填写该模具本次维修内容"
                                rules={[{ required: true, message: '请填写维修内容' }]}
                                fieldProps={{ rows: 3, maxLength: 4000, showCount: true }}
                              />
                            </Col>
                          </Row>
                          <Row gutter={16} style={{ marginTop: 4 }}>
                            <Col xs={24} md={12}>
                              <ProFormSelect
                                name="repair_result"
                                label="维修结果"
                                placeholder="请选择维修结果"
                                rules={[{ required: true, message: '请选择维修结果' }]}
                                options={HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS.map((v) => ({
                                  label: v,
                                  value: v,
                                }))}
                              />
                            </Col>
                          </Row>
                        </>
                      )}
                  <ProFormDependency name={['mold_code']}>
                    {({ mold_code }) => {
                      const isUpkeep = serviceType === '保养';
                      const phaseBefore = isUpkeep ? '保养前' : '维修前';
                      const phaseAfter = isUpkeep ? '保养后' : '维修后';
                      const mc = String(mold_code ?? '').trim();
                      const prevUuids =
                        beforeAttachmentPreview && mc ? beforeAttachmentPreview.byMold[mc] ?? [] : [];
                      return (
                            <Row gutter={16} style={{ marginTop: 4 }}>
                              <Col span={24}>
                                <div
                                  style={{
                                    padding: 10,
                                    background: '#fff',
                                    border: '1px solid #f0f0f0',
                                    borderRadius: 8,
                                  }}
                                >
                                  {beforeAttachmentPreview != null ? (
                                    <>
                                      <div style={{ marginBottom: 6, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
                                        {mc
                                          ? `模具「${mc}」模具图片附件（${phaseBefore}）`
                                          : `模具图片附件（${phaseBefore}）`}
                                      </div>
                                      <ReadonlyAttachmentStrip uuids={prevUuids} />
                                      <Divider dashed style={{ margin: '12px 0' }} />
                                    </>
                                  ) : null}
                                  <ProFormUploadButton
                                    name="item_attachments"
                                    label={`模具图片附件（${phaseAfter}）`}
                                    max={8}
                                    fieldProps={uploadFieldProps}
                                  />
                                </div>
                              </Col>
                            </Row>
                          );
                    }}
                  </ProFormDependency>
                </div>
              )}
            </ProFormList>
          </ProForm>
          )}
        </div>
      </Modal>

      <Modal
        title={pageMeta.sourcePickerTitle}
        open={sourcePickerOpen}
        onCancel={() => setSourcePickerOpen(false)}
        width={820}
        destroyOnHidden
        footer={null}
      >
        <Table<MoldMaintenanceSheetRow>
          size="small"
          rowKey="id"
          columns={maintPickerColumns}
          dataSource={maintRowsForPicker}
          pagination={false}
          scroll={{ y: 380 }}
          locale={{ emptyText: pageMeta.sourcePickerEmpty }}
          onRow={(record) => ({
            onClick: () => {
              void applySelectedMaintSheetRow(record);
              setSourcePickerOpen(false);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Modal>

      <HaoligoDocumentPrintModal
        open={printOpen}
        onClose={() => {
          setPrintOpen(false);
          setPrintRowId(null);
        }}
        documentType="mold_maintenance_complete"
        documentId={printRowId}
        title={serviceType === '保养' ? '模具保养完成报告' : '模具维修完成报告'}
      />
    </>
  );
}

