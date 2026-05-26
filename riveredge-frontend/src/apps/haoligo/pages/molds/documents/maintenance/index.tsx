/**
 * 好力 GO — 厂内维保单（申请人 + 末级申请部门下拉 + 维修/保养 + 多条模具明细；与外协维保单明细结构一致）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDependency,
  ProFormInstance,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { App, Alert, Button, Col, Divider, Input, Modal, Row, Space, Spin, Table, Tooltip, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { DictionarySelect } from '../../../../../../components/dictionary-select';
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
  createMoldMaintenanceSheet,
  deleteMoldMaintenanceSheet,
  getMoldMaintenanceSheet,
  listMoldMaintenanceSheets,
  listMolds,
  updateMoldMaintenanceSheet,
  type MoldMaintenanceSheetCreatePayload,
  type MoldMaintenanceSheetRow,
  type MoldRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';

/** 首屏只拉少量用户，其余靠下拉内搜索（keyword）加载，减轻 JSON 解析与 Select 首帧压力 */
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

/** 取该节点下第一个末级部门（深度优先，先序） */
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

const defaultLineItem = () => ({
  mold_code: '',
  mold_name: '',
  repair_reason: undefined as string | undefined,
  item_attachments: [] as UploadFile[],
});

const MoldMaintenancePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const applicantDeptUuidByUserIdRef = useRef<Map<number, string>>(new Map());
  const applicantLabelByIdRef = useRef<Map<number, string>>(new Map());
  const applicantBootstrapOptionsRef = useRef<{ label: string; value: number }[]>([]);
  const applicantSearchSeqRef = useRef(0);
  const applicantSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentTreeRef = useRef<DepartmentTreeItem[]>([]);
  /** 新建时复用下拉数据，减少重复请求（编辑带 extras 会跳过缓存） */
  const tenantFormOptionsValidUntilRef = useRef(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  /** 下拉选项与部门树就绪后再挂载 ProForm；申请人首屏仅拉部分用户，其余下拉内搜索 */
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [applicantOptions, setApplicantOptions] = useState<{ label: string; value: number }[]>([]);
  const [leafDeptOptions, setLeafDeptOptions] = useState<{ label: string; value: string }[]>([]);
  const [moldPickRow, setMoldPickRow] = useState<number | null>(null);
  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  const [moldKw, setMoldKw] = useState('');
  const [moldLoading, setMoldLoading] = useState(false);

  useEffect(() => {
    if (modalVisible) return;
    if (applicantSearchTimerRef.current) {
      clearTimeout(applicantSearchTimerRef.current);
      applicantSearchTimerRef.current = null;
    }
    applicantSearchSeqRef.current += 1;
  }, [modalVisible]);

  const deptLabelByUuid = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of leafDeptOptions) m.set(o.value, o.label);
    return m;
  }, [leafDeptOptions]);

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

  const loadMoldsForPicker = useCallback(async () => {
    setMoldLoading(true);
    try {
      const res = await listMolds({ limit: 200, skip: 0, status: '待用' });
      setMoldRows(res.items);
    } catch {
      setMoldRows([]);
    } finally {
      setMoldLoading(false);
    }
  }, []);

  const filteredMolds = useMemo(() => {
    const q = moldKw.trim().toLowerCase();
    if (!q) return moldRows;
    return moldRows.filter(
      (r) =>
        r.mold_code.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)),
    );
  }, [moldRows, moldKw]);

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> => ({
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
          const res = await uploadFile(file, { category: 'haoligo_mold_maint' });
          options.onSuccess?.(res, options.file);
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
    }),
    [messageApi],
  );

  const handleCreate = useCallback(() => {
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormOptionsReady(false);
    setModalVisible(true);
    void (async () => {
      try {
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
          service_type: '维修',
          applicant_user_id: uid,
          department_uuid: deptUuid,
          source_order_no: undefined,
          header_attachments: [],
          line_items: [defaultLineItem()],
        });
        startTransition(() => setFormOptionsReady(true));
      } catch {
        messageApi.error('加载下拉选项失败');
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    })();
  }, [messageApi, preloadTenantFormOptions]);

  const handleMainModalCancel = useCallback(() => {
    setModalVisible(false);
    setEditId(null);
    setMoldPickRow(null);
    setFormOptionsReady(false);
    setIsDetailView(false);
  }, []);

  useNewShortcut(handleCreate);

  const openSheetForm = useCallback(
    async (record: MoldMaintenanceSheetRow, detailOnly: boolean) => {
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(record.id);
      setFormOptionsReady(false);
      setModalVisible(true);
      try {
        const d = await getMoldMaintenanceSheet(record.id);
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
          service_type: d.service_type,
          applicant_user_id: d.applicant_user_id ?? undefined,
          department_uuid: initDept || undefined,
          source_order_no: d.source_order_no ?? undefined,
          header_attachments: uuidsToUploadFileList(d.header_attachment_file_uuids),
          line_items: (d.line_items || []).map((it) => ({
            mold_code: it.mold_code,
            mold_name: it.mold_name ?? '',
            repair_reason: it.repair_reason,
            item_attachments: uuidsToUploadFileList(it.attachment_file_uuids),
          })),
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || '加载维保单失败');
        setModalVisible(false);
        setFormOptionsReady(false);
        setIsDetailView(false);
      }
    },
    [messageApi, preloadTenantFormOptions],
  );

  const handleEdit = useCallback(
    (record: MoldMaintenanceSheetRow) => void openSheetForm(record, false),
    [openSheetForm],
  );

  const handleDetail = useCallback(
    (record: MoldMaintenanceSheetRow) => void openSheetForm(record, true),
    [openSheetForm],
  );

  const handleDeleteOne = (record: MoldMaintenanceSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除维保单（${record.department_name ?? '-'} / ${record.primary_mold_code ?? '-'}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldMaintenanceSheet(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const triggerSubmit = useCallback(() => {
    if (isDetailView) return;
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
  }, [formOptionsReady, isDetailView, messageApi]);

  useSubmitShortcut(triggerSubmit, modalVisible && !isDetailView);

  const buildPayload = (
    values: Record<string, unknown>,
    applicantUserId: number,
  ): MoldMaintenanceSheetCreatePayload => {
    const rawLines = values.line_items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim(),
        repair_cost: null,
        attachment_file_uuids: normUploadUuids(r.item_attachments),
      };
    });
    return {
      applicant_user_id: applicantUserId,
      department_uuid: typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '',
      service_type: values.service_type === '保养' ? '保养' : '维修',
      source_order_no: String(values.source_order_no ?? '').trim() || null,
      header_attachment_file_uuids: normUploadUuids(values.header_attachments),
      line_items,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
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
      messageApi.error('申请部门无效，请从末级部门中选择');
      return Promise.reject(new Error('validation'));
    }
    const payload = buildPayload(values, applicantId);
    if (!payload.line_items.length) {
      messageApi.error('至少保留一条模具明细');
      return Promise.reject(new Error('validation'));
    }
    const reasonLabel = values.service_type === '保养' ? '保养原因' : '维修原因';
    for (let i = 0; i < payload.line_items.length; i++) {
      const li = payload.line_items[i];
      if (!li.mold_code) {
        messageApi.error(`模具明细第 ${i + 1} 行：请填写模具代号`);
        return Promise.reject(new Error('validation'));
      }
      if (!li.repair_reason) {
        messageApi.error(`模具明细第 ${i + 1} 行：请选择${reasonLabel}`);
        return Promise.reject(new Error('validation'));
      }
    }
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateMoldMaintenanceSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldMaintenanceSheet(payload);
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
    const tree = departmentTreeRef.current;
    const cu = useGlobalStore.getState().currentUser;
    const uid = cu?.id;
    let deptUuid: string | undefined;
    if (uid != null) {
      const uu = (applicantDeptUuidByUserIdRef.current.get(uid) || cu?.department?.uuid || '').trim();
      deptUuid = resolveDefaultLeafDeptUuid(tree, uu || undefined);
    }
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      service_type: '维修',
      applicant_user_id: uid,
      department_uuid: deptUuid,
      header_attachments: [],
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
        ? { ...row, mold_code: m.mold_code, mold_name: m.name }
        : row,
    );
    inst.setFieldsValue({ line_items: next });
  };

  const columns: ProColumns<MoldMaintenanceSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号(维修WX/保养BY)/部门/申请人/来源单号/类型' },
    },
    {
      title: '维保单单号',
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    { title: '申请部门', dataIndex: 'department_name', width: 180, ellipsis: true },
    { title: '申请人', dataIndex: 'applicant_name', width: 120, ellipsis: true, hideInSearch: true },
    { title: '维修/保养', dataIndex: 'service_type', width: 100 },
    { title: '来源单号', dataIndex: 'source_order_no', width: 140, ellipsis: true, copyable: true },
    { title: '首件模具', dataIndex: 'primary_mold_code', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '明细条数',
      key: 'line_count',
      width: 88,
      hideInSearch: true,
      render: (_, r) => r.line_items?.length ?? 0,
    },
    moldDocumentCreatedAtColumn<MoldMaintenanceSheetRow>(),
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void handleDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => void handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldMaintenanceSheetRow>
          headerTitle="模具维保单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.maintenance"
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
              const res = await listMoldMaintenanceSheets({
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
          scroll={{ x: 1150 }}
        />
      </ListPageTemplate>

      <Modal
        title={isDetailView ? '维保单详情' : isEdit ? '编辑维保单' : '维保单'}
        open={modalVisible}
        onCancel={handleMainModalCancel}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button htmlType="button" onClick={handleMainModalCancel}>
                关闭
              </Button>
            </div>
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
              key={modalVisible ? `${isEdit}-${editId ?? 'n'}-${isDetailView}` : 'closed'}
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
              <Col span={12}>
                <ProFormSelect
                  name="service_type"
                  label="维修/保养"
                  placeholder="请选择维修/保养"
                  rules={[{ required: true, message: '请选择维修/保养' }]}
                  options={[
                    { label: '维修', value: '维修' },
                    { label: '保养', value: '保养' },
                  ]}
                />
              </Col>
              <Col span={12}>
                <ProFormText name="source_order_no" label="来源单号" placeholder="可手输来源单号" />
              </Col>
              <Col span={12}>
                <ProFormDependency name={['service_type']}>
                  {({ service_type }) => (
                    <ProFormUploadButton
                      name="header_attachments"
                      label={service_type === '保养' ? '附件照片（保养前）' : '附件照片（维修前）'}
                      max={10}
                      fieldProps={uploadFieldProps}
                    />
                  )}
                </ProFormDependency>
              </Col>
            </Row>

            <Divider titlePlacement="left">模具明细</Divider>
            <ProFormList
              name="line_items"
              min={1}
              copyIconProps={false}
              creatorButtonProps={{ creatorButtonText: '添加模具' }}
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
                if (count <= 1) return [];
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
              {(meta, index) => (
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
                        placeholder="请选择模具代号"
                        rules={[{ required: true, message: '请填写模具代号' }]}
                        fieldProps={{
                          addonAfter: (
                            <Button
                              type="link"
                              size="small"
                              onClick={() => {
                                setMoldPickRow(index);
                                setMoldPickerOpen(true);
                                void loadMoldsForPicker();
                              }}
                            >
                              选择
                            </Button>
                          ),
                        }}
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <ProFormText
                        name="mold_name"
                        label="模具名称"
                        placeholder="根据模具代号自动带出"
                        fieldProps={{ readOnly: true }}
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <ProFormDependency name={['service_type']} ignoreFormListField>
                        {({ service_type }) => {
                          const isUpkeep = service_type === '保养';
                          const reasonLabel = isUpkeep ? '保养原因' : '维修原因';
                          const dictCode = isUpkeep
                            ? 'HAOLIGO_MOLD_MAINTENANCE_REASON'
                            : 'HAOLIGO_MOLD_REPAIR_REASON';
                          return (
                            <DictionarySelect
                              key={dictCode}
                              dictionaryCode={dictCode}
                              name="repair_reason"
                              setFieldValueNamePath={['line_items', meta.name, 'repair_reason']}
                              label={reasonLabel}
                              placeholder={`请选择${reasonLabel}`}
                              rules={[{ required: true, message: `请选择${reasonLabel}` }]}
                              formRef={formRef}
                              simpleQuickCreate
                              colProps={{ span: 24 }}
                            />
                          );
                        }}
                      </ProFormDependency>
                    </Col>
                    <Col span={24}>
                      <ProFormDependency name={['service_type']} ignoreFormListField>
                        {({ service_type }) => {
                          const isUpkeep = service_type === '保养';
                          const moldImgLabel = isUpkeep
                            ? '保养模具图片附件（保养前）'
                            : '维修模具图片附件（维修前）';
                          return (
                            <ProFormUploadButton
                              name="item_attachments"
                              label={moldImgLabel}
                              max={8}
                              fieldProps={uploadFieldProps}
                            />
                          );
                        }}
                      </ProFormDependency>
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
          <Input placeholder="筛选模具代号/名称" value={moldKw} onChange={(e) => setMoldKw(e.target.value)} allowClear />
          <Table<MoldRow>
            size="small"
            rowKey="id"
            loading={moldLoading}
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={filteredMolds}
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

export default MoldMaintenancePage;
