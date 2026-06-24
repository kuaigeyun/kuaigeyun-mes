/**
 * 好力 GO — 外协维修单（申请人 + 末级申请部门 + 外协单位 + 模具明细；单据类型固定为维修）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounceFn } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDigit,
  ProFormInstance,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormDependency,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { App, Alert, Button, Col, Divider, Form, Input, Modal, Row, Space, Spin, Table, Tag, Tooltip, Typography, Upload, theme } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, ToolOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../../components/uni-table/stackedPrimaryColumn';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateHaoligoMoldLedgerTableCache } from '../../../../utils/moldLedgerTableCache';
import { rowActionKind } from '../../../../../../components/uni-action';
import { useGlobalStore } from '../../../../../../stores';
import {
  canCompleteSourceDocument,
  canInitiateCompleteCreate,
} from '../../../../../../utils/documentWorkflowPermission';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { refreshCurrentUserInStore } from '../../../../../../services/auth';
import { buildOutsourceCompleteCreateFromMaintenanceUrl } from '../../../../utils/outsourceCompleteNavigation';
import {
  HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE,
  HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE,
} from '../../../../constants/documentPermissionResources';
import { DictionarySelect } from '../../../../../../components/dictionary-select';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { uploadFile } from '../../../../../../services/file';
import { MoldAttachmentImagePreview } from '../../../../components/MoldAttachmentImagePreview';
import {
  MOLD_REPAIR_URGENCY_DEFAULT,
  moldRepairUrgencyOptions,
} from '../../../../constants/moldRepairUrgency';
import { uuidsToSecureUploadFileList } from '../../../../utils/secureUploadFileList';
import { UniUserIdSelect, type UniUserIdSelectPreset } from '../../../../../../components/uni-user-id-select';
import { useApplicantUserIdField } from '../../../../hooks/useApplicantUserIdField';
import {
  approveMoldOutsourceMaintenanceSheet,
  createMoldOutsourceMaintenanceSheet,
  deleteMoldOutsourceMaintenanceSheet,
  getMoldOutsourceMaintenanceSheet,
  listHaoligoNotifyUserOptions,
  listMoldOutsourceMaintenanceSheets,
  listOutsourceMaintenanceSupplierOptions,
  rejectMoldOutsourceMaintenanceSheet,
  revokeMoldOutsourceMaintenanceSheetApproval,
  updateMoldOutsourceMaintenanceSheet,
  type MoldOutsourceMaintenanceSheetCreatePayload,
  type MoldOutsourceMaintenanceSheetRow,
  type MoldRow,
} from '../../../../services/haoligo';
import { buildMoldSheetAuditActionElements } from '../../../../components/MoldSheetAuditActions';
import { canAuditMoldSheet } from '../../../../utils/moldSheetStatus';
import { MoldSheetDetailAuditFooter } from '../../../../components/MoldSheetDetailAuditFooter';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { isMoldSheetApproved, moldSheetAuditStatusTag } from '../../../../utils/moldSheetStatus';
import { OUTSOURCE_MAINTENANCE_REPAIR_STATUS_ENUM, outsourceMaintenanceRepairStatusTag } from '../../../../utils/outsourceMaintenanceRepairStatus';
import { pickMoldSheetAuditListFilters } from '../../../../utils/moldSheetListFilters';
import { MOLD_SHEET_TABLE_ACTION_OPTIONS } from '../../../../constants/moldSheetAudit';
import { fetchMoldsForPicker } from '../../../../utils/moldPicker';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';

const OUTSOURCE_MAINT_DOC_NOTIFICATION = 'haoligo_outsource_maintenance';
const OUTSOURCE_MAINT_ACTION_SUBMITTED = 'submitted';

const OUTSOURCE_MAINT_DOC_COPY_ICON_STYLE: React.CSSProperties = { color: '#d48806', fontSize: 11 };

/** 列表堆叠：外协维修单单号 / 外协单位 */
function OutsourceMaintDocStackedCell({ row }: { row: MoldOutsourceMaintenanceSheetRow }) {
  const { token } = theme.useToken();
  const sheetNo = (row.sheet_no || '').trim() || '—';
  const unitName = (row.outsourced_unit_name || '').trim() || '—';
  const subLineStyle: React.CSSProperties = {
    fontSize: token.fontSizeSM,
    lineHeight: 1.2,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      <Space size={2} align="center" style={{ maxWidth: '100%', minWidth: 0 }}>
        <Typography.Text
          strong
          ellipsis
          title={sheetNo}
          style={{ fontSize: token.fontSize, margin: 0, maxWidth: '100%' }}
        >
          {sheetNo}
        </Typography.Text>
        {sheetNo !== '—' ? (
          <Typography.Text
            copyable={{
              text: sheetNo,
              icon: [
                <CopyOutlined key="copy" style={OUTSOURCE_MAINT_DOC_COPY_ICON_STYLE} />,
                <CopyOutlined key="copied" style={{ ...OUTSOURCE_MAINT_DOC_COPY_ICON_STYLE, color: '#52c41a' }} />,
              ],
              tooltips: ['复制', '已复制'],
            }}
            style={{ margin: 0 }}
          />
        ) : null}
      </Space>
      <Typography.Text type="secondary" style={{ ...subLineStyle, marginTop: 1 }} title={unitName}>
        {unitName}
      </Typography.Text>
    </div>
  );
}

function resolvePrimaryMoldName(row: MoldOutsourceMaintenanceSheetRow): string {
  const fromHeader = (row.primary_mold_name || '').trim();
  if (fromHeader) return fromHeader;
  return (row.line_items?.[0]?.mold_name || '').trim();
}

function parseNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

const sheetStatusEnum: Record<string, { text: string }> = {
  待审核: { text: '待审核' },
  已通过: { text: '已通过' },
  已驳回: { text: '已驳回' },
};

type SupplierOpt = { key: string; value: string; label: string; code: string };

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

type DetailAttachmentPreview = {
  byIndex: string[][];
};

const formatMoldWarehouseLabel = (name?: string | null, code?: string | null) => {
  const n = (name || '').trim();
  const c = (code || '').trim();
  if (n && c) return `${c} · ${n}`;
  return n || c || '—';
};

const defaultLineItem = () => ({
  mold_code: '',
  mold_name: '',
  mold_warehouse_name: '',
  repair_reason: undefined as string | undefined,
  repair_cost: undefined as number | undefined,
  item_attachments: [] as UploadFile[],
});

const MoldOutsourceMaintenancePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canInitiateComplete =
    canInitiateCompleteCreate(
      currentUser,
      HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE,
      HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE,
    ) ||
    canCompleteSourceDocument(currentUser, HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE);
  const { canUpdate: canUpdateMaintenance, canDelete: canDeleteMaintenance } = useResourcePermissions(
    HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE,
  );
  const actionRef = useRef<ActionType>(null);
  const queryClient = useQueryClient();
  const reloadTableAndMoldLedger = useCallback(() => {
    invalidateHaoligoMoldLedgerTableCache(queryClient);
    actionRef.current?.reload();
  }, [queryClient]);
  const formRef = useRef<ProFormInstance>(null);
  const {
    applicantPresetUsers,
    leafDeptOptions,
    onApplicantPicked,
    preloadTenantFormOptions: preloadApplicantAndDepartments,
    getCreateApplicantDefaults,
    resolveInitDepartmentUuid,
    presetFromApplicantRow,
    departmentTreeRef,
    searchApplicantUsers,
  } = useApplicantUserIdField(formRef);
  const supplierOptionsRef = useRef<SupplierOpt[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  /** 下拉选项与部门树就绪后再挂载 ProForm，减轻弹窗首帧阻塞 */
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [auditSheetStatus, setAuditSheetStatus] = useState<string>('待审核');
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOpt[]>([]);
  const [moldPickRow, setMoldPickRow] = useState<number | null>(null);
  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  const [moldKw, setMoldKw] = useState('');
  const [moldLoading, setMoldLoading] = useState(false);
  const [outsourcedUnitFallback, setOutsourcedUnitFallback] = useState<{ label: string; value: string } | null>(null);
  const [detailAttachmentPreview, setDetailAttachmentPreview] = useState<DetailAttachmentPreview | null>(null);
  const notifyLabelRef = useRef(new Map<number, string>());

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });
  const outsSubmittedNotifyRule = useMemo(
    () =>
      findEnabledBusinessNotificationRule(
        businessConfigRes?.parameters?.notifications,
        OUTSOURCE_MAINT_DOC_NOTIFICATION,
        OUTSOURCE_MAINT_ACTION_SUBMITTED,
      ),
    [businessConfigRes?.parameters?.notifications],
  );
  const outsSubmittedNotifyDefaults = useMemo(
    () => getFormNotifyUserDefaultsFromRule(outsSubmittedNotifyRule),
    [outsSubmittedNotifyRule],
  );
  useEffect(() => {
    void refreshCurrentUserInStore().catch(() => {});
  }, []);

  const handleCreateCompleteFromRow = useCallback(
    (record: MoldOutsourceMaintenanceSheetRow) => {
      navigate(buildOutsourceCompleteCreateFromMaintenanceUrl(record.id));
    },
    [navigate],
  );

  const loadActiveSuppliers = useCallback(async () => {
    const list = await listOutsourceMaintenanceSupplierOptions({ limit: 1000 });
    const mapped = list.map((s) => ({
      key: s.uuid,
      value: s.name,
      label: s.code ? `${s.code} · ${s.name}` : s.name,
      code: s.code ?? '',
    }));
    supplierOptionsRef.current = mapped;
    setSupplierOptions(mapped);
  }, []);

  const outsourcedSelectOptions = useMemo(() => {
    const base = supplierOptions.map((o) => ({ label: o.label, value: o.value }));
    if (outsourcedUnitFallback && !base.some((b) => b.value === outsourcedUnitFallback.value)) {
      return [outsourcedUnitFallback, ...base];
    }
    return base;
  }, [supplierOptions, outsourcedUnitFallback]);

  const deptLabelByUuid = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of leafDeptOptions) m.set(o.value, o.label);
    return m;
  }, [leafDeptOptions]);

  const preloadFormOptions = useCallback(
    async (applicantPresets?: UniUserIdSelectPreset[]) => {
      await Promise.all([preloadApplicantAndDepartments(applicantPresets), loadActiveSuppliers()]);
    },
    [loadActiveSuppliers, preloadApplicantAndDepartments],
  );

  const loadMoldsForPicker = useCallback(async (keyword?: string) => {
    setMoldLoading(true);
    try {
      const rows = await fetchMoldsForPicker({ status: '待用', keyword });
      setMoldRows(rows);
    } catch {
      setMoldRows([]);
    } finally {
      setMoldLoading(false);
    }
  }, []);

  const { run: debouncedLoadMoldsForPicker } = useDebounceFn(
    (keyword: string) => {
      void loadMoldsForPicker(keyword);
    },
    { wait: 300 },
  );

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> =>
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
      customRequest: async (options, _info) => {
        try {
          const file = options.file as Parameters<typeof uploadFile>[0];
          const res = await uploadFile(file, { category: 'haoligo_mold_outsource_maint' });
          options.onSuccess?.(res, options.file);
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
      }),
    [messageApi],
  );

  const handleCreate = useCallback(() => {
    setOutsourcedUnitFallback(null);
    setDetailAttachmentPreview(null);
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormOptionsReady(false);
    setModalVisible(true);
    void (async () => {
      try {
        await preloadFormOptions(undefined);
        const applicantDefaults = getCreateApplicantDefaults();
        setFormInitialValues({
          outsourced_unit_name: undefined,
          outsourced_unit_code: undefined,
          ...applicantDefaults,
          source_order_no: undefined,
          urgency_level: MOLD_REPAIR_URGENCY_DEFAULT,
          submitted_notify_user_ids: [...outsSubmittedNotifyDefaults],
          line_items: [defaultLineItem()],
        });
        startTransition(() => setFormOptionsReady(true));
      } catch {
        messageApi.error('加载下拉选项失败');
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    })();
  }, [
    getCreateApplicantDefaults,
    messageApi,
    outsSubmittedNotifyDefaults,
    preloadFormOptions,
  ]);

  useNewShortcut(handleCreate);

  const openSheetForm = useCallback(
    async (record: MoldOutsourceMaintenanceSheetRow, detailOnly: boolean) => {
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(record.id);
      setFormOptionsReady(false);
      setModalVisible(true);
      try {
        const d = await getMoldOutsourceMaintenanceSheet(record.id);
        setEditId(d.id);
        setAuditSheetStatus(d.sheet_status);
        const preset = presetFromApplicantRow(d);
        await preloadFormOptions(preset ? [preset] : undefined);
        setOutsourcedUnitFallback(
          d.outsourced_unit_name && !supplierOptionsRef.current.some((o) => o.value === d.outsourced_unit_name)
            ? { label: d.outsourced_unit_name, value: d.outsourced_unit_name }
            : null,
        );
        const initDept = resolveInitDepartmentUuid(d.applicant_user_id, d.department_uuid);
        const rawLineItems = d.line_items || [];
        const formLineItems = detailOnly ? rawLineItems : rawLineItems.slice(0, 1);
        const byIndex = formLineItems.map((it) => [...(it.attachment_file_uuids || [])]);
        setDetailAttachmentPreview(detailOnly ? { byIndex } : null);
        const line_items = detailOnly
          ? formLineItems.map((it) => ({
              mold_code: it.mold_code,
              mold_name: it.mold_name ?? '',
              mold_warehouse_name: formatMoldWarehouseLabel(it.mold_warehouse_name, it.mold_warehouse_code),
              repair_reason: it.repair_reason,
              repair_cost:
                it.repair_cost != null && it.repair_cost !== '' ? Number(it.repair_cost) : undefined,
              item_attachments: [] as UploadFile[],
            }))
          : await Promise.all(
              formLineItems.map(async (it) => ({
                mold_code: it.mold_code,
                mold_name: it.mold_name ?? '',
                mold_warehouse_name: formatMoldWarehouseLabel(it.mold_warehouse_name, it.mold_warehouse_code),
                repair_reason: it.repair_reason,
                repair_cost:
                  it.repair_cost != null && it.repair_cost !== '' ? Number(it.repair_cost) : undefined,
                item_attachments: await uuidsToSecureUploadFileList(it.attachment_file_uuids),
              })),
            );
        setFormInitialValues({
          outsourced_unit_name: d.outsourced_unit_name,
          outsourced_unit_code: d.outsourced_unit_code ?? undefined,
          applicant_user_id: d.applicant_user_id ?? undefined,
          department_uuid: initDept,
          source_order_no: d.source_order_no ?? undefined,
          urgency_level: d.urgency_level ?? MOLD_REPAIR_URGENCY_DEFAULT,
          submitted_notify_user_ids:
            d.submitted_notify_user_ids?.length ? d.submitted_notify_user_ids : [...outsSubmittedNotifyDefaults],
          line_items,
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || '加载外协维修单失败');
        setIsDetailView(false);
        setDetailAttachmentPreview(null);
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    },
    [
      messageApi,
      outsSubmittedNotifyDefaults,
      preloadFormOptions,
      presetFromApplicantRow,
      resolveInitDepartmentUuid,
    ],
  );

  const searchOutsNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const fromArg = (selectedIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      const selIds =
        fromArg.length > 0
          ? fromArg
          : ((formRef.current?.getFieldValue('submitted_notify_user_ids') as number[] | undefined) || []);
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

  const handleEdit = (record: MoldOutsourceMaintenanceSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldOutsourceMaintenanceSheetRow) => void openSheetForm(record, true);

  const handleDeleteOne = (record: MoldOutsourceMaintenanceSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除外协维修单（${record.outsourced_unit_name} / ${record.primary_mold_code ?? '-'}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldOutsourceMaintenanceSheet(record.id);
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

  useSubmitShortcut(triggerSubmit, modalVisible);

  const buildPayload = (
    values: Record<string, unknown>,
    applicantUserId: number,
  ): MoldOutsourceMaintenanceSheetCreatePayload => {
    const rawLines = values.line_items;
    const lines = (Array.isArray(rawLines) ? rawLines : []).slice(0, 1);
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      const costRaw = r.repair_cost;
      let repair_cost: string | number | null = null;
      if (costRaw !== undefined && costRaw !== null && costRaw !== '') {
        const n = Number(costRaw);
        repair_cost = Number.isFinite(n) ? n : null;
      }
      return {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim(),
        repair_cost,
        attachment_file_uuids: normUploadUuids(r.item_attachments),
      };
    });
    const submittedNotifyIds = parseNotifyUserIds(values.submitted_notify_user_ids);
    return {
      outsourced_unit_code: String(values.outsourced_unit_code ?? '').trim() || null,
      outsourced_unit_name: String(values.outsourced_unit_name ?? '').trim(),
      applicant_user_id: applicantUserId,
      department_uuid: typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '',
      service_type: '维修',
      source_order_no: String(values.source_order_no ?? '').trim() || null,
      header_attachment_file_uuids: [],
      submitted_notify_user_ids: submittedNotifyIds,
      urgency_level: String(values.urgency_level ?? MOLD_REPAIR_URGENCY_DEFAULT).trim() || MOLD_REPAIR_URGENCY_DEFAULT,
      line_items,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const unit = String(values.outsourced_unit_name ?? '').trim();
    if (!unit) {
      messageApi.error('请选择或输入外协单位');
      return Promise.reject(new Error('validation'));
    }
    const applicantRaw = values.applicant_user_id;
    const applicantId =
      typeof applicantRaw === 'number'
        ? applicantRaw
        : typeof applicantRaw === 'string'
          ? Number(applicantRaw)
          : NaN;
    if (!Number.isFinite(applicantId)) {
      messageApi.error('请选择申请人');
      return Promise.reject(new Error('validation'));
    }
    const deptUuid = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (!deptUuid) {
      messageApi.error('请选择申请部门');
      return Promise.reject(new Error('validation'));
    }
    if (!deptLabelByUuid.has(deptUuid)) {
      messageApi.error('申请部门无效，请重新选择');
      return Promise.reject(new Error('validation'));
    }
    const payload = buildPayload(values, applicantId);
    if (!payload.line_items.length) {
      messageApi.error('至少保留一条模具明细');
      return Promise.reject(new Error('validation'));
    }
    for (let i = 0; i < payload.line_items.length; i++) {
      const li = payload.line_items[i];
      if (!li.mold_code) {
        messageApi.error(`模具明细第 ${i + 1} 行：请填写模具代号`);
        return Promise.reject(new Error('validation'));
      }
      if (!li.repair_reason) {
        messageApi.error(`模具明细第 ${i + 1} 行：请选择维修原因`);
        return Promise.reject(new Error('validation'));
      }
    }
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateMoldOutsourceMaintenanceSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldOutsourceMaintenanceSheet(payload);
        messageApi.success('已提交');
      }
      setModalVisible(false);
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
    if (!formOptionsReady) return;
    setOutsourcedUnitFallback(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      outsourced_unit_name: undefined,
      outsourced_unit_code: undefined,
      ...getCreateApplicantDefaults(),
      source_order_no: undefined,
      urgency_level: MOLD_REPAIR_URGENCY_DEFAULT,
      submitted_notify_user_ids: [...outsSubmittedNotifyDefaults],
      line_items: [defaultLineItem()],
    });
    messageApi.success('已重置');
  };

  const applyMoldToRow = (rowIndex: number, m: MoldRow) => {
    const inst = formRef.current;
    if (!inst) return;
    const cur = (inst.getFieldValue('line_items') as Record<string, unknown>[]) || [];
    const next = cur.map((row, i) =>
      i === rowIndex
        ? {
            ...row,
            mold_code: m.mold_code,
            mold_name: m.name,
            mold_warehouse_name: formatMoldWarehouseLabel(m.mold_warehouse_name, m.mold_warehouse_code),
          }
        : row,
    );
    inst.setFieldsValue({ line_items: next });
  };

  const columns: ProColumns<MoldOutsourceMaintenanceSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/外协单位/部门/申请人/来源单号' },
    },
    {
      title: '外协维修单单号',
      dataIndex: 'sheet_no',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      hideInSearch: true,
      render: (_, r) => <OutsourceMaintDocStackedCell row={r} />,
    },
    {
      title: '外协单位',
      dataIndex: 'outsourced_unit_name',
      hideInTable: true,
      hideInSearch: true,
    },
    { title: '申请部门', dataIndex: 'department_name', width: 160, ellipsis: true },
    { title: '申请人', dataIndex: 'applicant_name', width: 100, ellipsis: true, hideInSearch: true },
    { title: '来源单号', dataIndex: 'source_order_no', width: 140, ellipsis: true, copyable: true },
    {
      title: '紧急程度',
      dataIndex: 'urgency_level',
      width: 100,
      hideInSearch: true,
      render: (_: unknown, r: MoldOutsourceMaintenanceSheetRow) => (
        <Tag color={r.urgency_level === '紧急' ? 'red' : 'default'}>{r.urgency_level ?? '一般'}</Tag>
      ),
    },
    {
      title: '首件模具',
      dataIndex: 'primary_mold_code',
      minWidth: 168,
      width: 168,
      resizable: false,
      ellipsis: false,
      hideInSearch: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={resolvePrimaryMoldName(r) || '—'}
          secondary={(r.primary_mold_code || '').trim() || '—'}
        />
      ),
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
        return formatMoldWarehouseLabel(first?.mold_warehouse_name, first?.mold_warehouse_code);
      },
    },
    {
      title: '明细条数',
      key: 'line_count',
      width: 88,
      hideInSearch: true,
      render: (_, r) => r.line_items?.length ?? 0,
    },
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
      title: '维修状态',
      dataIndex: 'repair_status',
      width: 100,
      valueType: 'select',
      valueEnum: OUTSOURCE_MAINTENANCE_REPAIR_STATUS_ENUM,
      fieldProps: { allowClear: true },
      render: (_, r) => outsourceMaintenanceRepairStatusTag(r.repair_status),
    },
    moldDocumentCreatedAtColumn<MoldOutsourceMaintenanceSheetRow>(),
    {
      title: '操作',
      valueType: 'option',
      width: 320,
      fixed: 'right',
      uniActionRenderOptions: MOLD_SHEET_TABLE_ACTION_OPTIONS,
      render: (_, record) => {
        const approved = isMoldSheetApproved(record.sheet_status);
        const canRepair = canInitiateComplete && Boolean(record.can_complete);
        const actions: React.ReactNode[] = [
          <Button {...rowActionKind('read')}
            key="detail"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => void handleDetail(record)}
          >
            详情
          </Button>,
        ];
        if (canRepair) {
          actions.push(
            <Button {...rowActionKind('complete')}
              key="complete"
              type="link"
              size="small"
              icon={<ToolOutlined />}
              onClick={() => handleCreateCompleteFromRow(record)}
            >
              维修
            </Button>,
          );
        }
        if (canUpdateMaintenance) {
          actions.push(
            <Button {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={approved}
              onClick={() => void handleEdit(record)}
            >
              编辑
            </Button>,
          );
        }
        if (canDeleteMaintenance) {
          actions.push(
            <Button {...rowActionKind('delete')}
              key="delete"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={approved}
              onClick={() => handleDeleteOne(record)}
            >
              删除
            </Button>,
          );
        }
        actions.push(
          ...buildMoldSheetAuditActionElements({
            canAudit: canAuditMoldSheet(currentUser, HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE),
            sheetStatus: record.sheet_status,
            handlers: {
              onApprove: () => approveMoldOutsourceMaintenanceSheet(record.id),
              onReject: () => rejectMoldOutsourceMaintenanceSheet(record.id),
              onRevoke: () => revokeMoldOutsourceMaintenanceSheetApproval(record.id),
            },
            messageApi,
            reload: reloadTableAndMoldLedger,
          }),
        );
        return actions;
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldOutsourceMaintenanceSheetRow>
          headerTitle="模具外协维修单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.outsource-maintenance"
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
            const filters = pickMoldSheetAuditListFilters(searchFormValues);
            try {
              const res = await listMoldOutsourceMaintenanceSheets({
                skip,
                limit: pageSize,
                sheet_status: filters.sheet_status,
                repair_status: filters.repair_status,
                keyword: filters.keyword,
              });
              return { data: res.items, success: true, total: res.total };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1396 }}
        />
      </ListPageTemplate>

      <Modal
        title={isDetailView ? '外协维修单详情' : isEdit ? '编辑外协维修单' : '外协维修单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
          setMoldPickRow(null);
          setOutsourcedUnitFallback(null);
          setFormOptionsReady(false);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView && editId != null ? (
            <MoldSheetDetailAuditFooter
              resource={HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE}
              sheetStatus={auditSheetStatus}
              onClose={() => {
                setModalVisible(false);
                setEditId(null);
                setIsDetailView(false);
                setDetailAttachmentPreview(null);
                setFormOptionsReady(false);
              }}
              onReload={() => {
                reloadTableAndMoldLedger();
                void getMoldOutsourceMaintenanceSheet(editId).then((d) => setAuditSheetStatus(d.sheet_status));
              }}
              handlers={{
                onApprove: () => approveMoldOutsourceMaintenanceSheet(editId),
                onReject: () => rejectMoldOutsourceMaintenanceSheet(editId),
                onRevoke: () => revokeMoldOutsourceMaintenanceSheetApproval(editId),
              }}
            />
          ) : isDetailView ? (
            <Button
              onClick={() => {
                setModalVisible(false);
                setDetailAttachmentPreview(null);
              }}
            >
              关闭
            </Button>
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
                  fieldProps={{ virtual: true, listHeight: 256, optionFilterProp: 'label' }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="outsourced_unit_name"
                  label="外协单位"
                  placeholder="请选择外协单位"
                  rules={[{ required: true, message: '请选择外协单位' }]}
                  options={outsourcedSelectOptions}
                  showSearch
                  fieldProps={{
                    virtual: true,
                    listHeight: 256,
                    allowClear: true,
                    optionFilterProp: 'label',
                    onChange: (name: string) => {
                      const o = supplierOptions.find((x) => x.value === name);
                      formRef.current?.setFieldsValue({
                        outsourced_unit_code: o?.code || undefined,
                      });
                    },
                  }}
                />
              </Col>
              <ProFormText name="outsourced_unit_code" hidden />
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormText name="source_order_no" label="来源单号" placeholder="可手输来源单号" />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="urgency_level"
                  label="紧急程度"
                  initialValue={MOLD_REPAIR_URGENCY_DEFAULT}
                  rules={[{ required: true, message: '请选择紧急程度' }]}
                  options={moldRepairUrgencyOptions()}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <FormNotifyUsersSelect
                inline
                colSpan={12}
                name="submitted_notify_user_ids"
                label="提交通知人员"
                placeholder="请选择提交通知人员（抄送）"
                readonly={isDetailView}
                seedUserIds={outsSubmittedNotifyDefaults}
                searchUsers={(keyword, selectedIds) =>
                  searchOutsNotifyUsers(keyword, selectedIds)
                }
              />
            </Row>

            <Divider titlePlacement="left">模具明细</Divider>
            <ProFormList
              name="line_items"
              min={1}
              max={1}
              copyIconProps={false}
              creatorButtonProps={false}
              itemRender={({ listDom }) => <div style={{ marginBottom: 16 }}>{listDom}</div>}
              actionRender={() => []}
            >
              {(meta, index) => (
                <div
                  key={meta.key}
                  style={{
                    marginBottom: 12,
                    padding: '10px 12px 4px',
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 6,
                  }}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <ProFormText
                        name="mold_code"
                        label="模具代号"
                        placeholder="请选择模具代号"
                        rules={[{ required: true, message: '请填写模具代号' }]}
                        fieldProps={{
                          addonAfter: isDetailView ? undefined : (
                            <Button
                              type="link"
                              size="small"
                              onClick={() => {
                                setMoldPickRow(index);
                                setMoldKw('');
                                setMoldPickerOpen(true);
                                void loadMoldsForPicker('');
                              }}
                            >
                              选择
                            </Button>
                          ),
                        }}
                      />
                    </Col>
                    <Col span={12}>
                      <ProFormText
                        name="mold_name"
                        label="模具名称"
                        placeholder="根据模具代号自动带出"
                        fieldProps={{ readOnly: true }}
                      />
                    </Col>
                    <Col span={12}>
                      <ProFormText
                        name="mold_warehouse_name"
                        label="所在仓库"
                        placeholder="根据模具代号自动带出"
                        fieldProps={{ readOnly: true }}
                      />
                    </Col>
                    <Col span={12}>
                      <DictionarySelect
                        dictionaryCode="HAOLIGO_MOLD_REPAIR_REASON"
                        hostResource={HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE}
                        name="repair_reason"
                        setFieldValueNamePath={['line_items', meta.name, 'repair_reason']}
                        label="维修原因"
                        placeholder="请选择维修原因"
                        rules={[{ required: true, message: '请选择维修原因' }]}
                        formRef={formRef}
                        simpleQuickCreate
                        colProps={{ span: 24 }}
                      />
                    </Col>
                    <Col span={12}>
                      <ProFormDigit
                        name="repair_cost"
                        label="维修费用（元）"
                        placeholder="请输入维修费用（元）"
                        min={0}
                        fieldProps={{ precision: 2, style: { width: '100%' } }}
                      />
                    </Col>
                    <Col span={24}>
                      {isDetailView ? (
                        <ProFormDependency name={['line_items']}>
                          {() => (
                            <Form.Item label="维修模具图片附件（维修前）">
                              <MoldAttachmentImagePreview
                                uuids={detailAttachmentPreview?.byIndex[index] || []}
                              />
                            </Form.Item>
                          )}
                        </ProFormDependency>
                      ) : (
                        <ProFormUploadButton
                          name="item_attachments"
                          label="维修模具图片附件（维修前）"
                          max={8}
                          fieldProps={uploadFieldProps}
                        />
                      )}
                    </Col>
                  </Row>
                </div>
              )}
            </ProFormList>
          </ProForm>
          )}
        </div>
      </Modal>

      <Modal
        title="选择模具"
        open={moldPickerOpen}
        onCancel={() => {
          setMoldPickerOpen(false);
          setMoldPickRow(null);
        }}
        width={720}
        footer={null}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message="仅列出状态为「待用」的模具"
            description="若模具为「在用」等领用状态，请先办理还入单，待状态变为「待用」后再加入维保明细。"
          />
          <Input
            placeholder="搜索模具代号/名称（支持台账全库模糊查询）"
            value={moldKw}
            onChange={(e) => {
              const v = e.target.value;
              setMoldKw(v);
              debouncedLoadMoldsForPicker(v);
            }}
            allowClear
          />
          <Table<MoldRow>
            size="small"
            rowKey="id"
            loading={moldLoading}
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={moldRows}
            columns={[
              { title: '模具代号', dataIndex: 'mold_code', width: 120 },
              { title: '模具名称', dataIndex: 'name', ellipsis: true },
              { title: '状态', dataIndex: 'status', width: 88 },
              {
                title: '操作',
                key: 'op',
                width: 88,
                render: (_, r) => (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      if (moldPickRow != null) {
                        applyMoldToRow(moldPickRow, r);
                        messageApi.success(`已选择模具 ${r.mold_code}`);
                      }
                      setMoldPickerOpen(false);
                      setMoldPickRow(null);
                    }}
                  >
                    选用
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Modal>
    </>
  );
};

export default MoldOutsourceMaintenancePage;
