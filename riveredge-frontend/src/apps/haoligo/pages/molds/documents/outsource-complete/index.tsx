/**
 * 好力 GO — 外协维修完成单（维修专用：基础信息 + 模具行；列表/详情自带审核）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormInstance,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { App, Button, Col, Divider, Input, Modal, Row, Space, Spin, Table, Tooltip, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import HaoligoDocumentPrintModal from '../../../../components/HaoligoDocumentPrintModal';
import { UniTable } from '../../../../../../components/uni-table';
import { UniTableStackedPrimaryCell } from '../../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { uploadFile } from '../../../../../../services/file';
import { DictionarySelect } from '../../../../../../components/dictionary-select';
import { ReadonlyAttachmentStrip } from '../../../../components/ReadonlyAttachmentStrip';
import { uuidsToSecureUploadFileList } from '../../../../utils/secureUploadFileList';
import { UniUserIdSelect } from '../../../../../../components/uni-user-id-select';
import { useApplicantUserIdField } from '../../../../hooks/useApplicantUserIdField';
import {
  approveMoldOutsourceMaintenanceCompleteSheet,
  createMoldOutsourceMaintenanceCompleteSheet,
  deleteMoldOutsourceMaintenanceCompleteSheet,
  getMoldOutsourceMaintenanceCompleteSheet,
  getMoldOutsourceMaintenanceSheet,
  HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS,
  listHaoligoNotifyUserOptions,
  listMoldOutsourceMaintenanceCompleteSheets,
  listMoldOutsourceMaintenanceSheets,
  rejectMoldOutsourceMaintenanceCompleteSheet,
  revokeApprovalMoldOutsourceMaintenanceCompleteSheet,
  updateMoldOutsourceMaintenanceCompleteSheet,
  type MoldOutsourceMaintenanceCompleteSheetCreatePayload,
  type MoldOutsourceMaintenanceCompleteSheetRow,
  type MoldOutsourceMaintenanceCompleteSheetUpdatePayload,
  type MoldOutsourceMaintenanceSheetRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { OUTSOURCE_COMPLETE_SOURCE_MAINTENANCE_PARAM } from '../../../../utils/outsourceCompleteNavigation';
import { rowActionKind } from '../../../../../../components/uni-action';
import { useGlobalStore } from '../../../../../../stores/globalStore';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { buildMoldSheetAuditActionElements } from '../../../../components/MoldSheetAuditActions';
import { MoldSheetDetailAuditFooter } from '../../../../components/MoldSheetDetailAuditFooter';
import {
  HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE,
  HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE,
} from '../../../../constants/documentPermissionResources';
import { MOLD_SHEET_TABLE_ACTION_OPTIONS } from '../../../../constants/moldSheetAudit';
import { canPrintHaoligoDocument } from '../../../../utils/documentPrintPermission';
import { invalidateHaoligoMoldLedgerTableCache } from '../../../../utils/moldLedgerTableCache';
import { resolvePrimaryMoldStacked } from '../../../../utils/moldPicker';
import {
  canAuditMoldSheet,
  isMoldSheetApproved,
  moldSheetAuditStatusTag,
} from '../../../../utils/moldSheetStatus';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';

const OUTSOURCE_COMPLETE_DOC_NOTIFICATION = 'haoligo_mold_outsource_maintenance_complete';
const OUTSOURCE_COMPLETE_ACTION_SUBMITTED = 'submitted';

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

/** 外协维修单「维修前 / 维修后」附件预览（表头 + 按模具） */
type BeforeAttachmentPreview = {
  header: string[];
  byMold: Record<string, string[]>;
};

function buildSourceOrderNoFromMaintenance(row: MoldOutsourceMaintenanceSheetRow): string {
  const n = row.id;
  return (
    (row.source_order_no && String(row.source_order_no).trim()) ||
    (row.sheet_no && String(row.sheet_no).trim()) ||
    `外协维修单#${n}`
  );
}

function buildBeforePreviewFromMaintenance(row: MoldOutsourceMaintenanceSheetRow): BeforeAttachmentPreview {
  const byMold: Record<string, string[]> = {};
  for (const it of row.line_items || []) {
    const mc = String(it.mold_code ?? '').trim();
    if (mc) byMold[mc] = [...(it.attachment_file_uuids || [])];
  }
  return {
    header: [...(row.header_attachment_file_uuids || [])],
    byMold,
  };
}

const formatMoldWarehouseLabel = (name?: string | null, code?: string | null) => {
  const n = (name || '').trim();
  const c = (code || '').trim();
  if (n && c) return `${c} · ${n}`;
  return n || c || '';
};

function buildLineItemsFromMaintenanceSource(row: MoldOutsourceMaintenanceSheetRow) {
  return (row.line_items || []).map((it) => ({
    mold_code: String(it.mold_code ?? '').trim(),
    mold_name: it.mold_name != null ? String(it.mold_name) : '',
    mold_warehouse_name: formatMoldWarehouseLabel(it.mold_warehouse_name, it.mold_warehouse_code),
    repair_reason: it.repair_reason != null ? String(it.repair_reason) : '',
    repair_content: '',
    repair_result: undefined as string | undefined,
    repair_cost:
      it.repair_cost != null && it.repair_cost !== '' ? Number(it.repair_cost) : undefined,
    item_attachments: [] as UploadFile[],
  }));
}

function buildFormValuesFromMaintenanceSource(row: MoldOutsourceMaintenanceSheetRow): Record<string, unknown> {
  return {
    source_outsource_maintenance_sheet_id: row.id,
    source_order_no: buildSourceOrderNoFromMaintenance(row),
    outsourced_unit_name: (row.outsourced_unit_name && String(row.outsourced_unit_name).trim()) || '',
    outsourced_unit_code: row.outsourced_unit_code ?? undefined,
    applicant_user_id: row.applicant_user_id ?? undefined,
    department_uuid: (row.department_uuid || '').trim() || undefined,
    line_items: buildLineItemsFromMaintenanceSource(row),
  };
}

function formatOutsourceRowLabel(r: MoldOutsourceMaintenanceSheetRow): string {
  return [
    r.sheet_no && String(r.sheet_no).trim(),
    (r.source_order_no && String(r.source_order_no).trim()) || `外协维修单#${r.id}`,
    r.primary_mold_code ? `· ${r.primary_mold_code}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** 选择来源弹窗：与厂内完修单一致，取 primary 或首条有代号的明细 */
function pickerDisplayMold(r: MoldOutsourceMaintenanceSheetRow): { code: string; name: string } {
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

function SourceOutsourceSheetPickerTrigger({
  value,
  onOpen,
  onClear,
  outsourceRows,
  disabled,
}: {
  value?: number | string | null;
  onOpen: () => void;
  onClear: () => void;
  outsourceRows: MoldOutsourceMaintenanceSheetRow[];
  disabled?: boolean;
}) {
  const n =
    value === '' || value === undefined || value === null
      ? NaN
      : typeof value === 'string'
        ? Number(value)
        : Number(value);
  const r = Number.isFinite(n) ? outsourceRows.find((x) => x.id === n) : undefined;
  const text = r ? formatOutsourceRowLabel(r) : '';
  return (
    <Space.Compact block style={{ display: 'flex', flexWrap: 'nowrap', width: '100%' }}>
      <Input
        readOnly
        value={text}
        placeholder="请选择来源外协维修单"
        style={{ flex: 1, minWidth: 0, width: 0, cursor: disabled ? 'default' : 'pointer' }}
        onClick={() => {
          if (!disabled) onOpen();
        }}
      />
      <Button type="primary" disabled={disabled} onClick={() => onOpen()} style={{ flexShrink: 0 }}>
        选择
      </Button>
      {!disabled ? (
        <Button htmlType="button" onClick={onClear} style={{ flexShrink: 0 }}>
          清除
        </Button>
      ) : null}
    </Space.Compact>
  );
}

const defaultMoldLine = () => ({
  mold_code: '',
  mold_name: '',
  mold_warehouse_name: '',
  repair_reason: '',
  repair_content: '',
  repair_result: undefined as string | undefined,
  repair_cost: undefined as number | undefined,
  item_attachments: [] as UploadFile[],
});

const sheetStatusEnum: Record<string, { text: string }> = {
  待审核: { text: '待审核' },
  已通过: { text: '已通过' },
  已驳回: { text: '已驳回' },
};

const MoldOutsourceMaintenanceCompletePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const queryClient = useQueryClient();
  const completeResource = HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE;
  const { canUpdate: canUpdateComplete, canDelete: canDeleteComplete } = useResourcePermissions(completeResource);
  const canPrintComplete = canPrintHaoligoDocument(currentUser, completeResource);
  const actionRef = useRef<ActionType>(null);
  const reloadTableAndMoldLedger = useCallback(() => {
    invalidateHaoligoMoldLedgerTableCache(queryClient);
    actionRef.current?.reload();
  }, [queryClient]);
  const formRef = useRef<ProFormInstance>(null);
  const {
    applicantPresetUsers,
    leafDeptOptions,
    onApplicantPicked,
    applyApplicantPreset,
    preloadTenantFormOptions,
    getCreateApplicantDefaults,
    resetApplicantToCurrentUser,
    resolveInitDepartmentUuid,
    presetFromApplicantRow,
    enrichApplicantPresetFromRow,
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
        OUTSOURCE_COMPLETE_DOC_NOTIFICATION,
        OUTSOURCE_COMPLETE_ACTION_SUBMITTED,
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
  const [auditSheetStatus, setAuditSheetStatus] = useState<string>('待审核');
  const [formLoading, setFormLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printRowId, setPrintRowId] = useState<number | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [outsourceRows, setOutsourceRows] = useState<MoldOutsourceMaintenanceSheetRow[]>([]);
  const [beforeAttachmentPreview, setBeforeAttachmentPreview] = useState<BeforeAttachmentPreview | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const outsourceRowsRepair = useMemo(
    () => outsourceRows.filter((r) => String(r.service_type ?? '').trim() === '维修'),
    [outsourceRows],
  );

  const outsourcePickerColumns: ColumnsType<MoldOutsourceMaintenanceSheetRow> = useMemo(
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
      { title: '外协单位', dataIndex: 'outsourced_unit_name', width: 120, ellipsis: true },
    ],
    [],
  );

  const applySelectedOutsourceSheetRow = useCallback(
    async (row: MoldOutsourceMaintenanceSheetRow) => {
      const rowPreset = await enrichApplicantPresetFromRow(row);
      if (rowPreset) applyApplicantPreset(rowPreset);
      setBeforeAttachmentPreview(buildBeforePreviewFromMaintenance(row));
      formRef.current?.setFieldsValue(buildFormValuesFromMaintenanceSource(row));
    },
    [applyApplicantPreset, enrichApplicantPresetFromRow],
  );

  const clearSelectedOutsourceSheet = useCallback(() => {
    setBeforeAttachmentPreview(null);
    formRef.current?.setFieldsValue({
      source_outsource_maintenance_sheet_id: undefined,
      source_order_no: '',
      outsourced_unit_name: undefined,
      outsourced_unit_code: undefined,
      line_items: [defaultMoldLine()],
    });
    resetApplicantToCurrentUser();
  }, [resetApplicantToCurrentUser]);

  const openSourceOutsourcePicker = useCallback(() => {
    setSourcePickerOpen(true);
  }, []);

  const loadOutsourceSheetsForSource = useCallback(async (openForComplete: boolean) => {
    try {
      const res = await listMoldOutsourceMaintenanceSheets({
        skip: 0,
        limit: 200,
        ...(openForComplete ? { open_for_complete: true } : {}),
      });
      setOutsourceRows(res.items);
    } catch {
      setOutsourceRows([]);
    }
  }, []);

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
          const res = await uploadFile(file, { category: 'haoligo_mold_outsource_maint_complete' });
          options.onSuccess?.(res, options.file);
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
      }),
    [messageApi],
  );

  const handleCreate = async () => {
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormOptionsReady(false);
    setModalVisible(true);
    try {
      await loadOutsourceSheetsForSource(true);
      await preloadTenantFormOptions(undefined);
      setFormInitialValues({
        ...getCreateApplicantDefaults(),
        source_outsource_maintenance_sheet_id: undefined,
        source_order_no: '',
        outsourced_unit_name: undefined,
        outsourced_unit_code: undefined,
        complete_notify_user_ids: [...completeNotifyDefaults],
        line_items: [defaultMoldLine()],
      });
      setBeforeAttachmentPreview(null);
      startTransition(() => setFormOptionsReady(true));
    } catch {
      messageApi.error('加载选项失败');
      setModalVisible(false);
      setFormOptionsReady(false);
    }
  };

  useNewShortcut(handleCreate);

  const startCreateWithSourceSheet = useCallback(
    async (row: MoldOutsourceMaintenanceSheetRow) => {
      setIsDetailView(false);
      setIsEdit(false);
      setEditId(null);
      setFormOptionsReady(false);
      setModalVisible(true);
      try {
        const fullRow =
          row.line_items?.length && row.outsourced_unit_name
            ? row
            : await getMoldOutsourceMaintenanceSheet(row.id);
        if (String(fullRow.service_type ?? '').trim() !== '维修') {
          messageApi.warning('仅维修类型外协维修单可创建外协维修完成单');
          setModalVisible(false);
          return;
        }
        await loadOutsourceSheetsForSource(true);
        setOutsourceRows((prev) => {
          if (prev.some((x) => x.id === fullRow.id)) return prev;
          return [fullRow, ...prev];
        });
        const rowPreset = await enrichApplicantPresetFromRow(fullRow);
        await preloadTenantFormOptions(rowPreset ? [rowPreset] : undefined);
        if (rowPreset) applyApplicantPreset(rowPreset);
        setBeforeAttachmentPreview(buildBeforePreviewFromMaintenance(fullRow));
        setFormInitialValues({
          ...buildFormValuesFromMaintenanceSource(fullRow),
          complete_notify_user_ids: [...completeNotifyDefaults],
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || '无法创建外协维修完成单');
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    },
    [
      applyApplicantPreset,
      enrichApplicantPresetFromRow,
      loadOutsourceSheetsForSource,
      messageApi,
      preloadTenantFormOptions,
    ],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConsumedRef = useRef(false);

  useEffect(() => {
    const raw = searchParams.get(OUTSOURCE_COMPLETE_SOURCE_MAINTENANCE_PARAM);
    if (!raw || deepLinkConsumedRef.current) return;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    deepLinkConsumedRef.current = true;
    setSearchParams({}, { replace: true });
    void (async () => {
      try {
        const row = await getMoldOutsourceMaintenanceSheet(id);
        await startCreateWithSourceSheet(row);
      } catch (e) {
        messageApi.error((e as Error).message || '无法根据外协维修单打开外协维修完成单');
      }
    })();
  }, [messageApi, searchParams, setSearchParams, startCreateWithSourceSheet]);

  const openSheetForm = async (record: MoldOutsourceMaintenanceCompleteSheetRow, detailOnly: boolean) => {
    setIsDetailView(detailOnly);
    setFormOptionsReady(false);
    setModalVisible(true);
    setIsEdit(true);
    setEditId(record.id);
    try {
      const d = await getMoldOutsourceMaintenanceCompleteSheet(record.id);
      let rows: MoldOutsourceMaintenanceSheetRow[] = [];
      try {
        const res = await listMoldOutsourceMaintenanceSheets({ skip: 0, limit: 200 });
        rows = res.items;
      } catch {
        rows = [];
      }
      const sid = d.source_outsource_maintenance_sheet_id;
      if (sid != null && !rows.some((x) => x.id === sid)) {
        try {
          const one = await getMoldOutsourceMaintenanceSheet(sid);
          rows = [one, ...rows];
        } catch {
          /* 保留列表 */
        }
      }
      setOutsourceRows(rows);
      setEditId(d.id);
      setAuditSheetStatus(d.sheet_status || '待审核');
      const preset = presetFromApplicantRow(d);
      await preloadTenantFormOptions(preset ? [preset] : undefined);
      const line_items = await Promise.all(
        (d.line_items || []).map(async (it) => ({
          mold_code: it.mold_code,
          mold_name: it.mold_name ?? '',
          mold_warehouse_name: formatMoldWarehouseLabel(it.mold_warehouse_name, it.mold_warehouse_code),
          repair_reason: it.repair_reason ?? '',
          repair_content: it.repair_content ?? '',
          repair_result: it.repair_result ?? undefined,
          repair_cost:
            it.repair_cost != null && it.repair_cost !== '' ? Number(it.repair_cost) : undefined,
          item_attachments: await uuidsToSecureUploadFileList(it.attachment_file_uuids),
        })),
      );
      setFormInitialValues({
        source_outsource_maintenance_sheet_id: d.source_outsource_maintenance_sheet_id ?? undefined,
        source_order_no: d.source_order_no,
        applicant_user_id: d.applicant_user_id ?? undefined,
        department_uuid: resolveInitDepartmentUuid(d.applicant_user_id, d.department_uuid),
        outsourced_unit_name: d.outsourced_unit_name,
        outsourced_unit_code: d.outsourced_unit_code ?? undefined,
        complete_notify_user_ids:
          d.complete_notify_user_ids?.length ? d.complete_notify_user_ids : [...completeNotifyDefaults],
        line_items,
      });
      if (d.source_outsource_maintenance_sheet_id != null) {
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
      messageApi.error((e as Error).message || '加载外协维修完成单失败');
      setIsDetailView(false);
      setModalVisible(false);
      setFormOptionsReady(false);
    }
  };

  const handleEdit = (record: MoldOutsourceMaintenanceCompleteSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldOutsourceMaintenanceCompleteSheetRow) => void openSheetForm(record, true);

  const handleDeleteOne = (record: MoldOutsourceMaintenanceCompleteSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除外协维修完成单「${record.source_order_no}」吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldOutsourceMaintenanceCompleteSheet(record.id);
          messageApi.success('已删除');
          reloadTableAndMoldLedger();
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

  useSubmitShortcut(triggerSubmit, modalVisible);

  const buildCreatePayload = (
    values: Record<string, unknown>,
  ): MoldOutsourceMaintenanceCompleteSheetCreatePayload => {
    const sid = values.source_outsource_maintenance_sheet_id;
    const n = typeof sid === 'string' ? Number(sid) : Number(sid);
    const rawLines = values.line_items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim() || null,
        repair_content: String(r.repair_content ?? '').trim() || null,
        repair_result: (() => {
          const x = r.repair_result;
          if (x === undefined || x === null || x === '') return null;
          return String(x).trim();
        })(),
        repair_cost:
          r.repair_cost === undefined || r.repair_cost === null || r.repair_cost === ''
            ? null
            : Number(r.repair_cost),
        attachment_file_uuids: normUploadUuids(r.item_attachments),
      };
    });
    const aid = values.applicant_user_id;
    const applicant_user_id =
      aid != null && aid !== '' && Number.isFinite(Number(aid)) ? Number(aid) : undefined;
    const department_uuid =
      typeof values.department_uuid === 'string' ? values.department_uuid.trim() : undefined;
    return {
      source_outsource_maintenance_sheet_id: n,
      applicant_user_id,
      department_uuid,
      line_items,
      header_attachment_file_uuids: [],
      complete_notify_user_ids: parseNotifyUserIds(values.complete_notify_user_ids),
    };
  };

  const buildUpdatePayload = (
    values: Record<string, unknown>,
  ): MoldOutsourceMaintenanceCompleteSheetUpdatePayload => {
    const rawLines = values.line_items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim() || null,
        repair_content: String(r.repair_content ?? '').trim() || null,
        repair_result: (() => {
          const x = r.repair_result;
          if (x === undefined || x === null || x === '') return null;
          return String(x).trim();
        })(),
        repair_cost:
          r.repair_cost === undefined || r.repair_cost === null || r.repair_cost === ''
            ? null
            : Number(r.repair_cost),
        attachment_file_uuids: normUploadUuids(r.item_attachments),
      };
    });
    const sid = values.source_outsource_maintenance_sheet_id;
    let source_outsource_maintenance_sheet_id: number | null | undefined;
    if (sid !== undefined && sid !== null && sid !== '') {
      const n = Number(sid);
      if (Number.isFinite(n)) source_outsource_maintenance_sheet_id = n;
    }
    const patch: MoldOutsourceMaintenanceCompleteSheetUpdatePayload = {
      source_outsource_maintenance_sheet_id,
      source_order_no: String(values.source_order_no ?? '').trim(),
      header_attachment_file_uuids: [],
      line_items,
    };
    const aidRaw = values.applicant_user_id;
    if (aidRaw != null && aidRaw !== '' && Number.isFinite(Number(aidRaw))) {
      patch.applicant_user_id = Number(aidRaw);
    }
    const deptU = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (deptU) patch.department_uuid = deptU;
    const unitName = String(values.outsourced_unit_name ?? '').trim();
    if (unitName) patch.outsourced_unit_name = unitName;
    const unitCodeRaw = values.outsourced_unit_code;
    if (unitCodeRaw !== undefined && unitCodeRaw !== null && String(unitCodeRaw).trim() !== '') {
      patch.outsourced_unit_code = String(unitCodeRaw).trim();
    } else {
      patch.outsourced_unit_code = null;
    }
    patch.complete_notify_user_ids = parseNotifyUserIds(values.complete_notify_user_ids);
    return patch;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!isEdit) {
      const sid = values.source_outsource_maintenance_sheet_id;
      if (sid === undefined || sid === null || sid === '') {
        messageApi.error('请选择来源外协维修单');
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
      if (!Number.isFinite(payload.source_outsource_maintenance_sheet_id)) {
        messageApi.error('请选择来源外协维修单');
        return Promise.reject(new Error('validation'));
      }
      for (let i = 0; i < payload.line_items.length; i++) {
        const li = payload.line_items[i];
        if (!li.mold_code) {
          messageApi.error(`模具明细第 ${i + 1} 条：请填写模具代号`);
          return Promise.reject(new Error('validation'));
        }
        if (!li.repair_content?.trim()) {
          messageApi.error(`模具明细第 ${i + 1} 条：请填写维修内容`);
          return Promise.reject(new Error('validation'));
        }
        if (!li.repair_result?.trim()) {
          messageApi.error(`模具明细第 ${i + 1} 条：请选择维修结果`);
          return Promise.reject(new Error('validation'));
        }
      }
      setFormLoading(true);
      try {
        await createMoldOutsourceMaintenanceCompleteSheet(payload);
        messageApi.success('已提交，待审核');
        setModalVisible(false);
        reloadTableAndMoldLedger();
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

    if (outsourceRows.length > 0) {
      const sid = values.source_outsource_maintenance_sheet_id;
      if (sid === undefined || sid === null || sid === '') {
        messageApi.error('请选择来源外协维修单');
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
    for (let i = 0; i < (payload.line_items?.length ?? 0); i++) {
      const li = payload.line_items![i];
      if (!li.mold_code) {
        messageApi.error(`模具信息第 ${i + 1} 条：请填写模具代号`);
        return Promise.reject(new Error('validation'));
      }
      if (!li.repair_content?.trim()) {
        messageApi.error(`模具信息第 ${i + 1} 条：请填写维修内容`);
        return Promise.reject(new Error('validation'));
      }
      if (!li.repair_result?.trim()) {
        messageApi.error(`模具信息第 ${i + 1} 条：请选择维修结果`);
        return Promise.reject(new Error('validation'));
      }
    }
    setFormLoading(true);
    try {
      if (editId != null) {
        await updateMoldOutsourceMaintenanceCompleteSheet(editId, payload);
        messageApi.success('已保存');
      }
      setModalVisible(false);
      reloadTableAndMoldLedger();
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
      source_outsource_maintenance_sheet_id: undefined,
      source_order_no: '',
      outsourced_unit_name: undefined,
      outsourced_unit_code: undefined,
      line_items: [defaultMoldLine()],
    });
    resetApplicantToCurrentUser();
    setBeforeAttachmentPreview(null);
    messageApi.success('已重置');
  };

  const columns: ProColumns<MoldOutsourceMaintenanceCompleteSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/来源单号/申请人/申请部门/外协单位' },
    },
    {
      title: '维修完成单单号',
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    { title: '来源单号', dataIndex: 'source_order_no', width: 160, ellipsis: true, copyable: true },
    { title: '申请人', dataIndex: 'applicant_name', width: 100, ellipsis: true, hideInSearch: true },
    { title: '申请部门', dataIndex: 'department_name', width: 120, ellipsis: true, hideInSearch: true },
    { title: '外协单位', dataIndex: 'outsourced_unit_name', width: 140, ellipsis: true },
    {
      title: '审核状态',
      dataIndex: 'sheet_status',
      width: 100,
      valueType: 'select',
      valueEnum: sheetStatusEnum,
      fieldProps: { allowClear: true },
      render: (_, r) => moldSheetAuditStatusTag(r.sheet_status),
    },
    {
      title: '维修摘要',
      key: 'completion_summary',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => {
        const items = r.line_items || [];
        const parts: string[] = [];
        for (const it of items) {
          const rr = (it.repair_result && String(it.repair_result).trim()) || '';
          const rc = (it.repair_content && String(it.repair_content).trim()) || '';
          if (rr || rc) parts.push([rr, rc].filter(Boolean).join(' · '));
        }
        return parts.length ? parts.join('；') : '—';
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
      title: '所在仓库',
      dataIndex: 'primary_mold_warehouse_name',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => {
        const fromHeader = (r.primary_mold_warehouse_name || '').trim();
        if (fromHeader) return fromHeader;
        const first = r.line_items?.[0];
        return formatMoldWarehouseLabel(first?.mold_warehouse_name, first?.mold_warehouse_code) || '—';
      },
    },
    {
      title: '模具条数',
      key: 'line_count',
      width: 88,
      hideInSearch: true,
      render: (_, r) => r.line_items?.length ?? 0,
    },
    moldDocumentCreatedAtColumn<MoldOutsourceMaintenanceCompleteSheetRow>(),
    {
      title: '操作',
      valueType: 'option',
      width: 280,
      fixed: 'right',
      uniActionRenderOptions: MOLD_SHEET_TABLE_ACTION_OPTIONS,
      render: (_, record) => {
        const approved = isMoldSheetApproved(record.sheet_status);
        const auditHandlers = {
          onApprove: () => approveMoldOutsourceMaintenanceCompleteSheet(record.id),
          onReject: () => rejectMoldOutsourceMaintenanceCompleteSheet(record.id),
          onRevoke: () => revokeApprovalMoldOutsourceMaintenanceCompleteSheet(record.id),
        };
        const actions: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="detail" onClick={() => void handleDetail(record)}>
            详情
          </Button>,
          ...(canPrintComplete
            ? [
                <Button {...rowActionKind('print')}
                  key="print"
                  type="link"
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    setPrintRowId(record.id);
                    setPrintOpen(true);
                  }}
                >
                  打印报告
                </Button>,
              ]
            : []),
          <Button {...rowActionKind('update')}
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={approved || !canUpdateComplete}
            onClick={() => void handleEdit(record)}
          >
            编辑
          </Button>,
          <Button {...rowActionKind('delete')}
            key="delete"
            type="link"
            size="small"
            danger
            disabled={approved || !canDeleteComplete}
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteOne(record)}
          >
            删除
          </Button>,
          ...buildMoldSheetAuditActionElements({
            canAudit: canAuditMoldSheet(currentUser, completeResource),
            sheetStatus: record.sheet_status,
            handlers: auditHandlers,
            messageApi,
            reload: reloadTableAndMoldLedger,
          }),
        ];
        return actions;
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldOutsourceMaintenanceCompleteSheetRow>
          headerTitle="外协维修完成单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.outsource-complete"
          completeCreateSourceResource={HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE}
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
              const res = await listMoldOutsourceMaintenanceCompleteSheets({
                skip,
                limit: pageSize,
                sheet_status:
                  typeof searchFormValues?.sheet_status === 'string' && searchFormValues.sheet_status
                    ? searchFormValues.sheet_status
                    : undefined,
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
          scroll={{ x: 1668 }}
        />
      </ListPageTemplate>

      <Modal
        title={isDetailView ? '外协维修完成单详情' : isEdit ? '编辑外协维修完成单' : '外协维修完成单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
          setFormOptionsReady(false);
          setBeforeAttachmentPreview(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView && editId != null ? (
            <MoldSheetDetailAuditFooter
              resource={completeResource}
              sheetStatus={auditSheetStatus}
              onClose={() => {
                setModalVisible(false);
                setEditId(null);
                setIsDetailView(false);
                setFormOptionsReady(false);
                setBeforeAttachmentPreview(null);
              }}
              onReload={() => {
                reloadTableAndMoldLedger();
                void getMoldOutsourceMaintenanceCompleteSheet(editId).then((d) =>
                  setAuditSheetStatus(d.sheet_status),
                );
              }}
              handlers={{
                onApprove: () => approveMoldOutsourceMaintenanceCompleteSheet(editId),
                onReject: () => rejectMoldOutsourceMaintenanceCompleteSheet(editId),
                onRevoke: () => revokeApprovalMoldOutsourceMaintenanceCompleteSheet(editId),
              }}
            />
          ) : isDetailView ? (
            <Button onClick={() => setModalVisible(false)}>关闭</Button>
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
              <Row gutter={16}>
                <Col span={12}>
                  {!isEdit || outsourceRows.length > 0 ? (
                    <ProForm.Item
                      name="source_outsource_maintenance_sheet_id"
                      label="来源外协维修单"
                      rules={[{ required: true, message: '请选择来源外协维修单' }]}
                    >
                      <SourceOutsourceSheetPickerTrigger
                        outsourceRows={outsourceRows}
                        disabled={isEdit || isDetailView}
                        onOpen={openSourceOutsourcePicker}
                        onClear={clearSelectedOutsourceSheet}
                      />
                    </ProForm.Item>
                  ) : (
                    <ProFormText
                      name="source_order_no"
                      label="来源单号"
                      placeholder="请输入来源单号"
                      rules={[{ required: true, message: '请输入来源单号' }]}
                    />
                  )}
                </Col>
                {!isEdit || outsourceRows.length > 0 ? <ProFormText name="source_order_no" hidden /> : null}
                <Col span={12}>
                  <ProFormText
                    name="outsourced_unit_name"
                    label="外协单位"
                    placeholder="选择来源单后自动带出"
                    rules={[{ required: true, message: '请通过来源外协维修单带出外协单位' }]}
                    fieldProps={{ readOnly: true }}
                  />
                  <ProFormText name="outsourced_unit_code" hidden />
                  <ProFormText name="service_type" initialValue="维修" hidden />
                </Col>
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
                    模具图片附件（维修前）
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
                          dictionaryCode="HAOLIGO_MOLD_REPAIR_REASON"
                          hostResource={completeResource}
                          name="repair_reason"
                          setFieldValueNamePath={['line_items', meta.name, 'repair_reason']}
                          label="维修原因"
                          placeholder="维修原因"
                          formRef={formRef}
                          simpleQuickCreate
                          colProps={{ span: 24 }}
                          readonly
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <ProFormText
                          name="mold_warehouse_name"
                          label="所在仓库"
                          placeholder="—"
                          fieldProps={{ readOnly: true }}
                        />
                      </Col>
                    </Row>
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
                          options={HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS.map((v) => ({ label: v, value: v }))}
                        />
                      </Col>
                      <Col xs={24} md={12}>
                        <ProFormDigit
                          name="repair_cost"
                          label="维修费用（元）"
                          placeholder="请输入维修费用（元）"
                          min={0}
                          fieldProps={{ precision: 2, style: { width: '100%' } }}
                        />
                      </Col>
                    </Row>
                    <ProFormDependency name={['mold_code']}>
                      {({ mold_code }) => {
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
                                        ? `模具「${mc}」模具图片附件（维修前）`
                                        : '模具图片附件（维修前）'}
                                    </div>
                                    <ReadonlyAttachmentStrip uuids={prevUuids} />
                                    <Divider dashed style={{ margin: '12px 0' }} />
                                  </>
                                ) : null}
                                <ProFormUploadButton
                                  name="item_attachments"
                                  label="模具图片附件（维修后）"
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
        title="选择来源外协维修单"
        open={sourcePickerOpen}
        onCancel={() => setSourcePickerOpen(false)}
        width={900}
        destroyOnHidden
        footer={null}
      >
        <Table<MoldOutsourceMaintenanceSheetRow>
          size="small"
          rowKey="id"
          columns={outsourcePickerColumns}
          dataSource={outsourceRowsRepair}
          pagination={false}
          scroll={{ y: 380, x: 900 }}
          locale={{ emptyText: '暂无待确认维修完成的外协维修单' }}
          onRow={(record) => ({
            onClick: () => {
              void applySelectedOutsourceSheetRow(record);
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
        documentType="mold_outsource_maintenance_complete"
        documentId={printRowId}
        title="模具外协维修完成报告"
      />
    </>
  );
};

export default MoldOutsourceMaintenanceCompletePage;
