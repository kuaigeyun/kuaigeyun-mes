/**
 * 好力 GO — 厂内维保单（申请人 + 末级申请部门下拉 + 维修/保养 + 多条模具明细；与外协维保单明细结构一致）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounceFn } from 'ahooks';
import { useNavigate } from 'react-router-dom';
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
import { App, Alert, Button, Col, Divider, Form, Input, Modal, Row, Space, Spin, Table, Tag, Tooltip, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, ToolOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { UniTableStackedPrimaryCell } from '../../../../../../components/uni-table/stackedPrimaryColumn';
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
import { UniUserIdSelect } from '../../../../../../components/uni-user-id-select';
import { useApplicantUserIdField } from '../../../../hooks/useApplicantUserIdField';
import {
  approveMoldMaintenanceSheet,
  createMoldMaintenanceSheet,
  deleteMoldMaintenanceSheet,
  getMoldMaintenanceSheet,
  listHaoligoNotifyUserOptions,
  listMoldMaintenanceSheets,
  rejectMoldMaintenanceSheet,
  revokeMoldMaintenanceSheetApproval,
  updateMoldMaintenanceSheet,
  type MoldMaintenanceSheetCreatePayload,
  type MoldMaintenanceSheetRow,
  type MoldRow,
} from '../../../../services/haoligo';
import { buildMoldSheetAuditActionElements } from '../../../../components/MoldSheetAuditActions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { useGlobalStore } from '../../../../../../stores/globalStore';
import { canAuditMoldSheet } from '../../../../utils/moldSheetStatus';
import { MoldSheetDetailAuditFooter } from '../../../../components/MoldSheetDetailAuditFooter';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { isMoldSheetApproved, moldSheetAuditStatusTag } from '../../../../utils/moldSheetStatus';
import { MOLD_SHEET_TABLE_ACTION_OPTIONS } from '../../../../constants/moldSheetAudit';
import {
  inhouseCompleteResourceForServiceType,
  inhouseSheetResourceForServiceType,
  type InhouseMaintenanceServiceType,
} from '../../../../constants/documentPermissionResources';
import {
  canCompleteSourceDocument,
  canInitiateCompleteCreate,
} from '../../../../../../utils/documentWorkflowPermission';
import { buildInhouseCompleteCreateFromMaintenanceUrl } from '../../../../utils/inhouseCompleteNavigation';
import { fetchMoldsForPicker } from '../../../../utils/moldPicker';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';

export type MoldMaintenanceSheetServiceType = InhouseMaintenanceServiceType;

const PAGE_META: Record<
  MoldMaintenanceSheetServiceType,
  {
    headerTitle: string;
    sheetNoTitle: string;
    createModalTitle: string;
    editModalTitle: string;
    detailModalTitle: string;
    persistenceId: string;
  }
> = {
  保养: {
    headerTitle: '模具保养单',
    sheetNoTitle: '保养单单号',
    createModalTitle: '新增保养单',
    editModalTitle: '编辑保养单',
    detailModalTitle: '保养单详情',
    persistenceId: 'apps.haoligo.pages.molds.documents.upkeep',
  },
  维修: {
    headerTitle: '模具维修单',
    sheetNoTitle: '维修单单号',
    createModalTitle: '新增维修单',
    editModalTitle: '编辑维修单',
    detailModalTitle: '维修单详情',
    persistenceId: 'apps.haoligo.pages.molds.documents.repair',
  },
};

const sheetStatusEnum: Record<string, { text: string }> = {
  待审核: { text: '待审核' },
  已通过: { text: '已通过' },
  已驳回: { text: '已驳回' },
};

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
  byMold: Record<string, string[]>;
};

const defaultLineItem = () => ({
  mold_code: '',
  mold_name: '',
  repair_reason: undefined as string | undefined,
  item_attachments: [] as UploadFile[],
});

const MAINT_DOC_NOTIFICATION = 'haoligo_mold_maintenance';
const MAINT_ACTION_SUBMITTED = 'submitted';

function parseNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

function resolvePrimaryMoldName(row: MoldMaintenanceSheetRow): string {
  const fromHeader = (row.primary_mold_name || '').trim();
  if (fromHeader) return fromHeader;
  return (row.line_items?.[0]?.mold_name || '').trim();
}

export function MoldMaintenanceSheetPage({
  serviceType,
}: {
  serviceType: MoldMaintenanceSheetServiceType;
}) {
  const pageMeta = PAGE_META[serviceType];
  const sheetResource = inhouseSheetResourceForServiceType(serviceType);
  const completeResource = inhouseCompleteResourceForServiceType(serviceType);
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canInitiateComplete =
    canInitiateCompleteCreate(currentUser, sheetResource, completeResource) ||
    canCompleteSourceDocument(currentUser, sheetResource);
  const completeActionLabel = serviceType === '保养' ? '完成保养' : '完修';
  const { canUpdate: canUpdateSheet, canDelete: canDeleteSheet } = useResourcePermissions(sheetResource);
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
    searchApplicantUsers,
  } = useApplicantUserIdField(formRef);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  /** 下拉选项与部门树就绪后再挂载 ProForm；申请人首屏仅拉部分用户，其余下拉内搜索 */
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [auditSheetStatus, setAuditSheetStatus] = useState<string>('待审核');
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [moldPickRow, setMoldPickRow] = useState<number | null>(null);
  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  const [moldKw, setMoldKw] = useState('');
  const [moldLoading, setMoldLoading] = useState(false);
  const [detailAttachmentPreview, setDetailAttachmentPreview] = useState<DetailAttachmentPreview | null>(null);
  const notifyLabelRef = useRef(new Map<number, string>());

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });
  const maintSubmittedNotifyRule = useMemo(
    () =>
      findEnabledBusinessNotificationRule(
        businessConfigRes?.parameters?.notifications,
        MAINT_DOC_NOTIFICATION,
        MAINT_ACTION_SUBMITTED,
      ),
    [businessConfigRes?.parameters?.notifications],
  );
  const maintSubmittedNotifyDefaults = useMemo(
    () => getFormNotifyUserDefaultsFromRule(maintSubmittedNotifyRule),
    [maintSubmittedNotifyRule],
  );

  const handleCreateCompleteFromRow = useCallback(
    (record: MoldMaintenanceSheetRow) => {
      navigate(buildInhouseCompleteCreateFromMaintenanceUrl(record.id, serviceType));
    },
    [navigate, serviceType],
  );

  const deptLabelByUuid = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of leafDeptOptions) m.set(o.value, o.label);
    return m;
  }, [leafDeptOptions]);

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
    setDetailAttachmentPreview(null);
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormOptionsReady(false);
    setModalVisible(true);
    void (async () => {
      try {
        await preloadTenantFormOptions(undefined);
        const applicantDefaults = getCreateApplicantDefaults();
        setFormInitialValues({
          service_type: serviceType,
          ...applicantDefaults,
          source_order_no: undefined,
          submitted_notify_user_ids: [...maintSubmittedNotifyDefaults],
          ...(serviceType === '维修' ? { urgency_level: MOLD_REPAIR_URGENCY_DEFAULT } : {}),
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
    maintSubmittedNotifyDefaults,
    messageApi,
    preloadTenantFormOptions,
    getCreateApplicantDefaults,
    serviceType,
  ]);

  const handleMainModalCancel = useCallback(() => {
    setModalVisible(false);
    setEditId(null);
    setMoldPickRow(null);
    setFormOptionsReady(false);
    setIsDetailView(false);
    setDetailAttachmentPreview(null);
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
        if ((d.service_type || '').trim() !== serviceType) {
          messageApi.error(`该单据为${d.service_type || '—'}类型，请从对应菜单打开`);
          setModalVisible(false);
          setFormOptionsReady(false);
          setIsDetailView(false);
          return;
        }
        setEditId(d.id);
        setAuditSheetStatus(d.sheet_status);
        const preset = presetFromApplicantRow(d);
        await preloadTenantFormOptions(preset ? [preset] : undefined);
        const initDept = resolveInitDepartmentUuid(d.applicant_user_id, d.department_uuid);
        const rawLineItems = d.line_items || [];
        const formLineItems = detailOnly ? rawLineItems : rawLineItems.slice(0, 1);
        const byMold: Record<string, string[]> = {};
        for (const it of formLineItems) {
          const mc = String(it.mold_code ?? '').trim();
          if (mc) byMold[mc] = [...(it.attachment_file_uuids || [])];
        }
        setDetailAttachmentPreview(detailOnly ? { byMold } : null);
        const line_items = detailOnly
          ? formLineItems.map((it) => ({
              mold_code: it.mold_code,
              mold_name: it.mold_name ?? '',
              repair_reason: it.repair_reason,
              item_attachments: [] as UploadFile[],
            }))
          : await Promise.all(
              formLineItems.map(async (it) => ({
                mold_code: it.mold_code,
                mold_name: it.mold_name ?? '',
                repair_reason: it.repair_reason,
                item_attachments: await uuidsToSecureUploadFileList(it.attachment_file_uuids),
              })),
            );
        setFormInitialValues({
          service_type: d.service_type,
          applicant_user_id: d.applicant_user_id ?? undefined,
          department_uuid: initDept,
          source_order_no: d.source_order_no ?? undefined,
          ...(serviceType === '维修'
            ? { urgency_level: d.urgency_level ?? MOLD_REPAIR_URGENCY_DEFAULT }
            : {}),
          submitted_notify_user_ids:
            d.submitted_notify_user_ids?.length ? d.submitted_notify_user_ids : [...maintSubmittedNotifyDefaults],
          line_items,
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || '加载维保单失败');
        setModalVisible(false);
        setFormOptionsReady(false);
        setIsDetailView(false);
        setDetailAttachmentPreview(null);
      }
    },
    [
      maintSubmittedNotifyDefaults,
      messageApi,
      preloadTenantFormOptions,
      presetFromApplicantRow,
      resolveInitDepartmentUuid,
      serviceType,
    ],
  );

  const searchMaintNotifyUsers = useCallback(
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
      content: `确定删除${serviceType === '保养' ? '保养单' : '维修单'}（${record.department_name ?? '-'} / ${record.primary_mold_code ?? '-'}）吗？`,
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
    const lines = (Array.isArray(rawLines) ? rawLines : []).slice(0, 1);
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
    const submittedNotifyIds = parseNotifyUserIds(values.submitted_notify_user_ids);
    return {
      applicant_user_id: applicantUserId,
      department_uuid: typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '',
      service_type: serviceType,
      source_order_no: String(values.source_order_no ?? '').trim() || null,
      header_attachment_file_uuids: [],
      submitted_notify_user_ids: submittedNotifyIds,
      ...(serviceType === '维修'
        ? { urgency_level: String(values.urgency_level ?? MOLD_REPAIR_URGENCY_DEFAULT).trim() || MOLD_REPAIR_URGENCY_DEFAULT }
        : {}),
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
      messageApi.error('申请部门无效，请重新选择');
      return Promise.reject(new Error('validation'));
    }
    const payload = buildPayload(values, applicantId);
    if (!payload.line_items.length) {
      messageApi.error('至少保留一条模具明细');
      return Promise.reject(new Error('validation'));
    }
    const reasonLabel = serviceType === '保养' ? '保养原因' : '维修原因';
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
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      service_type: serviceType,
      ...getCreateApplicantDefaults(),
      submitted_notify_user_ids: [...maintSubmittedNotifyDefaults],
      line_items: [defaultLineItem()],
      ...(serviceType === '维修' ? { urgency_level: MOLD_REPAIR_URGENCY_DEFAULT } : {}),
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
      fieldProps: {
        placeholder: serviceType === '保养' ? '单号(BY)/部门/申请人/来源单号' : '单号(WX)/部门/申请人/来源单号',
      },
    },
    {
      title: pageMeta.sheetNoTitle,
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    { title: '申请部门', dataIndex: 'department_name', width: 180, ellipsis: true },
    { title: '申请人', dataIndex: 'applicant_name', width: 120, ellipsis: true, hideInSearch: true },
    { title: '来源单号', dataIndex: 'source_order_no', width: 140, ellipsis: true, copyable: true },
    ...(serviceType === '维修'
      ? [
          {
            title: '紧急程度',
            dataIndex: 'urgency_level',
            width: 100,
            hideInSearch: true,
            render: (_: unknown, r: MoldMaintenanceSheetRow) => (
              <Tag color={r.urgency_level === '紧急' ? 'red' : 'default'}>{r.urgency_level ?? '一般'}</Tag>
            ),
          } as ProColumns<MoldMaintenanceSheetRow>,
        ]
      : []),
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
    moldDocumentCreatedAtColumn<MoldMaintenanceSheetRow>(),
    {
      title: '操作',
      valueType: 'option',
      width: 320,
      fixed: 'right',
      uniActionRenderOptions: MOLD_SHEET_TABLE_ACTION_OPTIONS,
      render: (_, record) => {
        const approved = isMoldSheetApproved(record.sheet_status);
        const canComplete = canInitiateComplete && Boolean(record.can_complete);
        const auditHandlers = {
          onApprove: () => approveMoldMaintenanceSheet(record.id),
          onReject: () => rejectMoldMaintenanceSheet(record.id),
          onRevoke: () => revokeMoldMaintenanceSheetApproval(record.id),
        };
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
        if (canComplete) {
          actions.push(
            <Button {...rowActionKind('complete')}
              key="complete"
              type="link"
              size="small"
              icon={<ToolOutlined />}
              onClick={() => handleCreateCompleteFromRow(record)}
            >
              {completeActionLabel}
            </Button>,
          );
        }
        actions.push(
          <Button {...rowActionKind('update')}
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={approved || !canUpdateSheet}
            onClick={() => void handleEdit(record)}
          >
            编辑
          </Button>,
          <Button {...rowActionKind('delete')}
            key="delete"
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={approved || !canDeleteSheet}
            onClick={() => handleDeleteOne(record)}
          >
            删除
          </Button>,
          ...buildMoldSheetAuditActionElements({
            canAudit: canAuditMoldSheet(currentUser, sheetResource),
            sheetStatus: record.sheet_status,
            handlers: auditHandlers,
            messageApi,
            reload: () => actionRef.current?.reload(),
          }),
        );
        return actions;
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldMaintenanceSheetRow>
          headerTitle={pageMeta.headerTitle}
          columnPersistenceId={pageMeta.persistenceId}
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
                service_type: serviceType,
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
          scroll={{ x: 1150 }}
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
        onCancel={handleMainModalCancel}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView && editId != null ? (
            <MoldSheetDetailAuditFooter
              resource={sheetResource}
              sheetStatus={auditSheetStatus}
              onClose={handleMainModalCancel}
              onReload={() => {
                actionRef.current?.reload();
                if (editId != null) {
                  void getMoldMaintenanceSheet(editId).then((d) => setAuditSheetStatus(d.sheet_status));
                }
              }}
              handlers={{
                onApprove: async () => {
                  await approveMoldMaintenanceSheet(editId);
                },
                onReject: async () => {
                  await rejectMoldMaintenanceSheet(editId);
                },
                onRevoke: async () => {
                  await revokeMoldMaintenanceSheetApproval(editId);
                },
              }}
            />
          ) : isDetailView ? (
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
              <ProFormText name="service_type" hidden />
              <Col span={12}>
                <ProFormText name="source_order_no" label="来源单号" placeholder="可手输来源单号" />
              </Col>
              {serviceType === '维修' ? (
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
              ) : null}
              <FormNotifyUsersSelect
                inline
                colSpan={12}
                name="submitted_notify_user_ids"
                label="提交通知人员"
                placeholder="请选择提交通知人员（抄送）"
                readonly={isDetailView}
                seedUserIds={maintSubmittedNotifyDefaults}
                searchUsers={(keyword, selectedIds) =>
                  searchMaintNotifyUsers(keyword, selectedIds)
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
                    <Col xs={24} sm={8}>
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
                        {() => {
                          const isUpkeep = serviceType === '保养';
                          const reasonLabel = isUpkeep ? '保养原因' : '维修原因';
                          const dictCode = isUpkeep
                            ? 'HAOLIGO_MOLD_MAINTENANCE_REASON'
                            : 'HAOLIGO_MOLD_REPAIR_REASON';
                          return (
                            <DictionarySelect
                              key={dictCode}
                              dictionaryCode={dictCode}
                              hostResource={sheetResource}
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
                      <ProFormDependency name={['service_type', 'line_items']} ignoreFormListField>
                        {({ line_items }) => {
                          const isUpkeep = serviceType === '保养';
                          const moldImgLabel = isUpkeep
                            ? '保养模具图片附件（保养前）'
                            : '维修模具图片附件（维修前）';
                          if (isDetailView) {
                            const rows = (line_items as { mold_code?: string }[] | undefined) ?? [];
                            const mc = String(rows[index]?.mold_code ?? '').trim();
                            return (
                              <Form.Item label={moldImgLabel}>
                                <MoldAttachmentImagePreview
                                  uuids={mc ? detailAttachmentPreview?.byMold[mc] : []}
                                />
                              </Form.Item>
                            );
                          }
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
}
