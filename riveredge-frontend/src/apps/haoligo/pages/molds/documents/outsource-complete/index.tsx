/**
 * 好力 GO — 模具外协维保完成单（维修专用：基础信息 + 模具行；对齐厂内模具维保完成单交互）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { App, Button, Col, Divider, Input, Modal, Row, Space, Spin, Table, Tag, Tooltip, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { getFileDownloadUrl, uploadFile } from '../../../../../../services/file';
import type { DepartmentTreeItem } from '../../../../../../services/department';
import { getDepartmentTree } from '../../../../../../services/department';
import { getUserList } from '../../../../../../services/user';
import { useGlobalStore } from '../../../../../../stores';
import {
  createMoldOutsourceMaintenanceCompleteSheet,
  deleteMoldOutsourceMaintenanceCompleteSheet,
  getMoldOutsourceMaintenanceCompleteSheet,
  getMoldOutsourceMaintenanceSheet,
  HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS,
  listMoldOutsourceMaintenanceCompleteSheets,
  listMoldOutsourceMaintenanceSheets,
  updateMoldOutsourceMaintenanceCompleteSheet,
  type MoldOutsourceMaintenanceCompleteSheetCreatePayload,
  type MoldOutsourceMaintenanceCompleteSheetRow,
  type MoldOutsourceMaintenanceCompleteSheetUpdatePayload,
  type MoldOutsourceMaintenanceSheetRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';

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

function uuidsToUploadFileList(uuids: string[] | undefined): UploadFile[] {
  if (!uuids?.length) return [];
  return uuids.map((uuid) => ({
    uid: uuid,
    name: '附件',
    status: 'done',
    url: getFileDownloadUrl(uuid),
    response: { uuid },
  }));
}

/** 首屏只拉少量用户，其余靠下拉内搜索（keyword）加载 */
const APPLICANT_BOOTSTRAP_PAGE_SIZE = 120;

function collectLeafDepartmentOptions(items: DepartmentTreeItem[]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const n of items) {
    if (n.children?.length) {
      out.push(...collectLeafDepartmentOptions(n.children));
    } else {
      out.push({ label: n.name, value: n.uuid });
    }
  }
  return out;
}

function findDeptNodeByUuid(items: DepartmentTreeItem[], uuid: string): DepartmentTreeItem | null {
  for (const n of items) {
    if (n.uuid === uuid) return n;
    if (n.children?.length) {
      const f = findDeptNodeByUuid(n.children, uuid);
      if (f) return f;
    }
  }
  return null;
}

function firstLeafUuidUnder(node: DepartmentTreeItem): string {
  if (!node.children?.length) return node.uuid;
  for (const c of node.children) {
    return firstLeafUuidUnder(c);
  }
  return node.uuid;
}

function resolveDefaultLeafDeptUuid(
  tree: DepartmentTreeItem[],
  userDeptUuid: string | undefined,
): string | undefined {
  const u = (userDeptUuid || '').trim();
  if (!u || !tree.length) return undefined;
  const node = findDeptNodeByUuid(tree, u);
  if (!node) return undefined;
  return firstLeafUuidUnder(node);
}

/** 外协维保单「维修前 / 维修后」附件预览（表头 + 按模具） */
type BeforeAttachmentPreview = {
  header: string[];
  byMold: Record<string, string[]>;
};

function ReadonlyAttachmentStrip({ uuids }: { uuids: string[] | undefined }) {
  const fl = uuidsToUploadFileList(uuids);
  if (!fl.length) return <span style={{ color: '#999' }}>无</span>;
  return <Upload listType="picture-card" disabled fileList={fl} />;
}

function outsourceCompleteStatusTag(status: string | undefined) {
  const s = (status || '待审核').trim();
  const color = s === '已通过' ? 'success' : s === '已驳回' ? 'error' : 'processing';
  return <Tag color={color}>{s}</Tag>;
}

function formatOutsourceRowLabel(r: MoldOutsourceMaintenanceSheetRow): string {
  return [
    r.sheet_no && String(r.sheet_no).trim(),
    (r.source_order_no && String(r.source_order_no).trim()) || `外协维保单#${r.id}`,
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
        placeholder="请选择来源外协维保单"
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
  repair_reason: '',
  repair_content: '',
  repair_result: undefined as string | undefined,
  repair_cost: undefined as number | undefined,
  item_attachments: [] as UploadFile[],
});

const MoldOutsourceMaintenanceCompletePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const applicantDeptUuidByUserIdRef = useRef<Map<number, string>>(new Map());
  const applicantLabelByIdRef = useRef<Map<number, string>>(new Map());
  const applicantBootstrapOptionsRef = useRef<{ label: string; value: number }[]>([]);
  const applicantSearchSeqRef = useRef(0);
  const applicantSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentTreeRef = useRef<DepartmentTreeItem[]>([]);
  const tenantFormOptionsValidUntilRef = useRef(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [outsourceRows, setOutsourceRows] = useState<MoldOutsourceMaintenanceSheetRow[]>([]);
  const [beforeAttachmentPreview, setBeforeAttachmentPreview] = useState<BeforeAttachmentPreview | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [applicantOptions, setApplicantOptions] = useState<{ label: string; value: number }[]>([]);
  const [leafDeptOptions, setLeafDeptOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (modalVisible) return;
    if (applicantSearchTimerRef.current) {
      clearTimeout(applicantSearchTimerRef.current);
      applicantSearchTimerRef.current = null;
    }
    applicantSearchSeqRef.current += 1;
  }, [modalVisible]);

  const loadLeafDepartments = useCallback(async () => {
    try {
      const tree = await getDepartmentTree({ is_active: true });
      const items = tree.items || [];
      departmentTreeRef.current = items;
      setLeafDeptOptions(collectLeafDepartmentOptions(items));
    } catch {
      departmentTreeRef.current = [];
      setLeafDeptOptions([]);
    }
  }, []);

  const bootstrapApplicantOptions = useCallback(
    async (extras?: { id: number; name: string; deptUuid?: string }[]) => {
      const emptyDept = new Map<number, string>();
      const emptyLabel = new Map<number, string>();
      try {
        const res = await getUserList({
          page: 1,
          page_size: APPLICANT_BOOTSTRAP_PAGE_SIZE,
          is_active: true,
        });
        const deptMap = new Map<number, string>();
        const labelMap = new Map<number, string>();
        const opts: { label: string; value: number }[] = [];
        for (const u of res.items || []) {
          const person = (u.full_name || '').trim() || u.username;
          deptMap.set(u.id, (u.department?.uuid || '').trim());
          labelMap.set(u.id, person);
          opts.push({ value: u.id, label: person });
        }
        const cu = useGlobalStore.getState().currentUser;
        if (cu?.id != null && Number.isFinite(cu.id) && !deptMap.has(cu.id)) {
          const person = (cu.full_name || '').trim() || cu.username || `用户#${cu.id}`;
          deptMap.set(cu.id, (cu.department?.uuid || '').trim());
          labelMap.set(cu.id, person);
          opts.unshift({ value: cu.id, label: person });
        }
        for (const ex of extras || []) {
          if (!deptMap.has(ex.id)) {
            deptMap.set(ex.id, (ex.deptUuid || '').trim());
            labelMap.set(ex.id, ex.name);
            opts.push({ value: ex.id, label: ex.name });
          }
        }
        applicantDeptUuidByUserIdRef.current = deptMap;
        applicantLabelByIdRef.current = labelMap;
        applicantBootstrapOptionsRef.current = opts.slice();
        setApplicantOptions(opts);
      } catch {
        applicantDeptUuidByUserIdRef.current = emptyDept;
        applicantLabelByIdRef.current = emptyLabel;
        applicantBootstrapOptionsRef.current = [];
        setApplicantOptions([]);
      }
    },
    [],
  );

  const flushApplicantSearch = useCallback(async (keyword: string) => {
    const seq = ++applicantSearchSeqRef.current;
    const kw = keyword.trim();
    if (!kw) {
      if (seq !== applicantSearchSeqRef.current) return;
      setApplicantOptions(applicantBootstrapOptionsRef.current.slice());
      return;
    }
    try {
      const res = await getUserList({ page: 1, page_size: 50, is_active: true, keyword: kw });
      if (seq !== applicantSearchSeqRef.current) return;
      const deptMap = applicantDeptUuidByUserIdRef.current;
      const labelMap = applicantLabelByIdRef.current;
      const next: { label: string; value: number }[] = [];
      for (const u of res.items || []) {
        const person = (u.full_name || '').trim() || u.username;
        deptMap.set(u.id, (u.department?.uuid || '').trim());
        labelMap.set(u.id, person);
        next.push({ value: u.id, label: person });
      }
      const inst = formRef.current;
      const selId = inst?.getFieldValue('applicant_user_id') as number | undefined;
      if (selId != null && Number.isFinite(selId) && !next.some((o) => o.value === selId)) {
        const g = useGlobalStore.getState();
        const cu = g.currentUser;
        const lab =
          labelMap.get(selId) ||
          (cu?.id === selId
            ? ((cu.full_name || '').trim() || cu.username || `用户#${selId}`)
            : `用户#${selId}`);
        const du =
          (deptMap.get(selId) || '').trim() ||
          (cu?.id === selId ? (cu.department?.uuid || '').trim() : '');
        deptMap.set(selId, du);
        labelMap.set(selId, lab);
        next.unshift({ value: selId, label: lab });
      }
      setApplicantOptions(next);
    } catch {
      if (seq !== applicantSearchSeqRef.current) return;
      setApplicantOptions(applicantBootstrapOptionsRef.current.slice());
    }
  }, []);

  const scheduleApplicantSearch = useCallback(
    (raw: string) => {
      if (applicantSearchTimerRef.current) clearTimeout(applicantSearchTimerRef.current);
      applicantSearchTimerRef.current = setTimeout(() => {
        applicantSearchTimerRef.current = null;
        void flushApplicantSearch(raw);
      }, 280);
    },
    [flushApplicantSearch],
  );

  const preloadTenantFormOptions = useCallback(
    async (extras?: { id: number; name: string; deptUuid?: string }[]) => {
      const ttlMs = 90_000;
      const now = Date.now();
      const warm =
        !extras &&
        now < tenantFormOptionsValidUntilRef.current &&
        applicantDeptUuidByUserIdRef.current.size > 0 &&
        departmentTreeRef.current.length > 0;
      if (warm) return;
      await Promise.all([bootstrapApplicantOptions(extras), loadLeafDepartments()]);
      tenantFormOptionsValidUntilRef.current = extras ? 0 : Date.now() + ttlMs;
    },
    [bootstrapApplicantOptions, loadLeafDepartments],
  );

  const syncDefaultDepartmentForApplicant = useCallback((userId: number | undefined) => {
    const inst = formRef.current;
    if (!inst) return;
    if (userId == null || !Number.isFinite(userId)) {
      inst.setFieldsValue({ department_uuid: undefined });
      return;
    }
    const tree = departmentTreeRef.current;
    let userDeptUuid = (applicantDeptUuidByUserIdRef.current.get(userId) || '').trim();
    if (!userDeptUuid) {
      const cu = useGlobalStore.getState().currentUser;
      if (cu?.id === userId && cu.department?.uuid) userDeptUuid = cu.department.uuid.trim();
    }
    const leaf = resolveDefaultLeafDeptUuid(tree, userDeptUuid || undefined);
    if (leaf) inst.setFieldsValue({ department_uuid: leaf });
    else inst.setFieldsValue({ department_uuid: undefined });
  }, []);

  const resetApplicantDepartmentToCurrentUserDefaults = useCallback(() => {
    const inst = formRef.current;
    if (!inst) return;
    const tree = departmentTreeRef.current;
    const cu = useGlobalStore.getState().currentUser;
    const uid = cu?.id;
    let deptUuid: string | undefined;
    if (uid != null) {
      const uu = (applicantDeptUuidByUserIdRef.current.get(uid) || cu?.department?.uuid || '').trim();
      deptUuid = resolveDefaultLeafDeptUuid(tree, uu || undefined);
    }
    inst.setFieldsValue({
      applicant_user_id: uid,
      department_uuid: deptUuid,
    });
  }, []);

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
      const n = row.id;
      const srcNo =
        (row.source_order_no && String(row.source_order_no).trim()) ||
        (row.sheet_no && String(row.sheet_no).trim()) ||
        `外协维保单#${n}`;
      const byMold: Record<string, string[]> = {};
      for (const it of row.line_items || []) {
        const mc = String(it.mold_code ?? '').trim();
        if (mc) byMold[mc] = [...(it.attachment_file_uuids || [])];
      }
      if (row.applicant_user_id != null) {
        await bootstrapApplicantOptions([
          {
            id: row.applicant_user_id,
            name: (row.applicant_name || '').trim() || `用户#${row.applicant_user_id}`,
            deptUuid: (row.department_uuid || '').trim(),
          },
        ]);
      }
      setBeforeAttachmentPreview({
        header: [...(row.header_attachment_file_uuids || [])],
        byMold,
      });
      formRef.current?.setFieldsValue({
        source_outsource_maintenance_sheet_id: n,
        source_order_no: srcNo,
        outsourced_unit_name: (row.outsourced_unit_name && String(row.outsourced_unit_name).trim()) || '',
        outsourced_unit_code: row.outsourced_unit_code ?? undefined,
        applicant_user_id: row.applicant_user_id ?? undefined,
        department_uuid: (row.department_uuid || '').trim() || undefined,
        line_items: (row.line_items || []).map((it) => ({
          mold_code: String(it.mold_code ?? '').trim(),
          mold_name: it.mold_name != null ? String(it.mold_name) : '',
          repair_reason: it.repair_reason != null ? String(it.repair_reason) : '',
          repair_content: '',
          repair_result: undefined,
          repair_cost:
            it.repair_cost != null && it.repair_cost !== ''
              ? Number(it.repair_cost)
              : undefined,
          item_attachments: [],
        })),
      });
    },
    [bootstrapApplicantOptions],
  );

  const clearSelectedOutsourceSheet = useCallback(() => {
    setBeforeAttachmentPreview(null);
    formRef.current?.setFieldsValue({
      source_outsource_maintenance_sheet_id: undefined,
      source_order_no: '',
      outsourced_unit_name: undefined,
      outsourced_unit_code: undefined,
      header_attachments: [],
      line_items: [defaultMoldLine()],
    });
    resetApplicantDepartmentToCurrentUserDefaults();
  }, [resetApplicantDepartmentToCurrentUserDefaults]);

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
    () => ({
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
      const tree = departmentTreeRef.current;
      const cu = useGlobalStore.getState().currentUser;
      const uid = cu?.id;
      let deptUuid: string | undefined;
      if (uid != null) {
        const uu = (applicantDeptUuidByUserIdRef.current.get(uid) || cu?.department?.uuid || '').trim();
        deptUuid = resolveDefaultLeafDeptUuid(tree, uu || undefined);
      }
      setFormInitialValues({
        applicant_user_id: uid,
        department_uuid: deptUuid,
        source_outsource_maintenance_sheet_id: undefined,
        source_order_no: '',
        outsourced_unit_name: undefined,
        outsourced_unit_code: undefined,
        header_attachments: [],
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
      const extras =
        d.applicant_user_id != null
          ? [
              {
                id: d.applicant_user_id,
                name: (d.applicant_name || '').trim() || `用户#${d.applicant_user_id}`,
                deptUuid: (d.department_uuid || '').trim(),
              },
            ]
          : undefined;
      await preloadTenantFormOptions(extras);
      let initDept = (d.department_uuid || '').trim();
      if (!initDept && d.applicant_user_id != null) {
        const uu = (applicantDeptUuidByUserIdRef.current.get(d.applicant_user_id) || '').trim();
        initDept = resolveDefaultLeafDeptUuid(departmentTreeRef.current, uu) || '';
      }
      setFormInitialValues({
        source_outsource_maintenance_sheet_id: d.source_outsource_maintenance_sheet_id ?? undefined,
        source_order_no: d.source_order_no,
        applicant_user_id: d.applicant_user_id ?? undefined,
        department_uuid: initDept || undefined,
        outsourced_unit_name: d.outsourced_unit_name,
        outsourced_unit_code: d.outsourced_unit_code ?? undefined,
        header_attachments: uuidsToUploadFileList(d.header_attachment_file_uuids),
        line_items: (d.line_items || []).map((it) => ({
          mold_code: it.mold_code,
          mold_name: it.mold_name ?? '',
          repair_reason: it.repair_reason ?? '',
          repair_content: it.repair_content ?? '',
          repair_result: it.repair_result ?? undefined,
          repair_cost:
            it.repair_cost != null && it.repair_cost !== '' ? Number(it.repair_cost) : undefined,
          item_attachments: uuidsToUploadFileList(it.attachment_file_uuids),
        })),
      });
      if (d.source_outsource_maintenance_sheet_id != null) {
        const byMold: Record<string, string[]> = {};
        for (const it of d.line_items || []) {
          const mc = String(it.mold_code ?? '').trim();
          if (mc) byMold[mc] = [...(it.source_attachment_file_uuids ?? [])];
        }
        setBeforeAttachmentPreview({
          header: [...(d.source_header_attachment_file_uuids ?? [])],
          byMold,
        });
      } else {
        setBeforeAttachmentPreview(null);
      }
      startTransition(() => setFormOptionsReady(true));
    } catch (e) {
      messageApi.error((e as Error).message || '加载模具外协维保完成单失败');
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
      content: `确定删除模具外协维保完成单「${record.source_order_no}」吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldOutsourceMaintenanceCompleteSheet(record.id);
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
      header_attachment_file_uuids: normUploadUuids(values.header_attachments),
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
      header_attachment_file_uuids: normUploadUuids(values.header_attachments),
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
    return patch;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!isEdit) {
      const sid = values.source_outsource_maintenance_sheet_id;
      if (sid === undefined || sid === null || sid === '') {
        messageApi.error('请选择来源外协维保单');
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
        messageApi.error('请选择来源外协维保单');
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
        messageApi.success('已提交，请至「外协维保审核」确认');
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
      return;
    }

    if (outsourceRows.length > 0) {
      const sid = values.source_outsource_maintenance_sheet_id;
      if (sid === undefined || sid === null || sid === '') {
        messageApi.error('请选择来源外协维保单');
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
      source_outsource_maintenance_sheet_id: undefined,
      source_order_no: '',
      outsourced_unit_name: undefined,
      outsourced_unit_code: undefined,
      header_attachments: [],
      line_items: [defaultMoldLine()],
    });
    resetApplicantDepartmentToCurrentUserDefaults();
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
      title: '维保完成单单号',
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
      hideInSearch: true,
      render: (_, r) => outsourceCompleteStatusTag(r.sheet_status),
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
    { title: '首件模具', dataIndex: 'primary_mold_code', width: 120, ellipsis: true, hideInSearch: true },
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
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const approved = (record.sheet_status || '').trim() === '已通过';
        return (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void handleDetail(record)}>
              详情
            </Button>
            <Button type="link" size="small" icon={<EditOutlined />} disabled={approved} onClick={() => void handleEdit(record)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger
              disabled={approved}
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteOne(record)}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldOutsourceMaintenanceCompleteSheetRow>
          headerTitle="模具外协维保完成单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.outsource-complete"
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
        title={isDetailView ? '模具外协维保完成单详情' : isEdit ? '编辑模具外协维保完成单' : '模具外协维保完成单'}
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
          isDetailView ? (
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
                      label="来源外协维保单"
                      rules={[{ required: true, message: '请选择来源外协维保单' }]}
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
                    rules={[{ required: true, message: '请通过来源外协维保单带出外协单位' }]}
                    fieldProps={{ readOnly: true }}
                  />
                  <ProFormText name="outsourced_unit_code" hidden />
                  <ProFormText name="service_type" initialValue="维修" hidden />
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <ProFormSelect
                    name="applicant_user_id"
                    label="申请人"
                    placeholder="可选中后搜索更多用户"
                    rules={[{ required: true, message: '请选择申请人' }]}
                    options={applicantOptions}
                    showSearch
                    fieldProps={{
                      virtual: true,
                      listHeight: 256,
                      optionFilterProp: 'label',
                      filterOption: false,
                      onSearch: scheduleApplicantSearch,
                      onChange: (v: number) => {
                        syncDefaultDepartmentForApplicant(v);
                      },
                    }}
                  />
                </Col>
                <Col span={12}>
                  <ProFormSelect
                    name="department_uuid"
                    label="申请部门"
                    placeholder="请选择末级申请部门"
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

              <Row gutter={16} style={{ marginBottom: 8 }}>
                <Col span={24}>
                  <div
                    style={{
                      padding: 12,
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                    }}
                  >
                    {beforeAttachmentPreview != null ? (
                      <>
                        <div style={{ marginBottom: 6, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
                          附件照片（维修前）
                        </div>
                        <ReadonlyAttachmentStrip uuids={beforeAttachmentPreview.header} />
                        <Divider dashed style={{ margin: '14px 0' }} />
                      </>
                    ) : null}
                    <ProFormUploadButton
                      name="header_attachments"
                      label="附件照片（维修后）"
                      max={10}
                      fieldProps={uploadFieldProps}
                    />
                  </div>
                </Col>
              </Row>

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
                    <Tooltip key="remove" title="删除">
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
                        <ProFormText
                          name="repair_reason"
                          label="维修原因"
                          placeholder="维修原因"
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
        title="选择来源外协维保单"
        open={sourcePickerOpen}
        onCancel={() => setSourcePickerOpen(false)}
        width={900}
        destroyOnClose
        footer={null}
      >
        <Table<MoldOutsourceMaintenanceSheetRow>
          size="small"
          rowKey="id"
          columns={outsourcePickerColumns}
          dataSource={outsourceRowsRepair}
          pagination={false}
          scroll={{ y: 380, x: 900 }}
          locale={{ emptyText: '暂无待确认完修的外协维保单' }}
          onRow={(record) => ({
            onClick: () => {
              void applySelectedOutsourceSheetRow(record);
              setSourcePickerOpen(false);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Modal>
    </>
  );
};

export default MoldOutsourceMaintenanceCompletePage;
