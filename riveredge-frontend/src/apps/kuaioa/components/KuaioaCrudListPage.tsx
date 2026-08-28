/**
 * 轻办公通用 CRUD 列表页（unitable-list / kuaioa 样板壳）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Form } from 'antd';
import type { FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ThemedSegmented } from '../../../components/themed-segmented';
import { UniTable } from '../../../components/uni-table';
import { FormModalGridBlock, FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { useResourcePermissions } from '../../../hooks/useResourcePermissions';
import { rowActionKind, rowActionLabelKeep } from '../../../components/uni-action';
import { UniWorkflowActions } from '../../../components/uni-workflow-actions';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../kuaizhizao/pages/shared/documentAuditColumns';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../utils/format';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../utils/uniTableLayoutColumns';
import KuaioaDetailDrawer, { type KuaioaDetailDrawerVariant } from './KuaioaDetailDrawer';
import {
  renderOaActiveTag,
  renderOaApprovalStatusTag,
  renderOaStatusMarker,
  renderOaTypeMarker,
  renderOaYesNoTag,
} from '../utils/oaListPresentation';
import { mapOaFormValuesToPayload, mapOaRecordToFormValues } from '../utils/oaFormDateUtils';
import {
  resolveOaLookupKind,
  shouldSkipOaFormField,
  stripOaLookupPayload,
} from '../utils/oaLookupFields';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { materialApi } from '../../master-data/services/material';
import { searchReferenceDisplay } from '../../../utils/referenceDisplay';
import OaLookupField from './OaLookupField';
import OaSingleFileField from './OaSingleFileField';

export type KuaioaFieldConfig = {
  name: string;
  labelKey: string;
  type?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'switch'
    | 'number'
    | 'date'
    | 'datetime'
    | 'file'
    | 'user'
    | 'customer'
    | 'material'
    | 'department'
    | 'supplier'
    | 'operation';
  options?: Array<{ label: string; value: string | number | boolean }>;
  required?: boolean;
  hideInTable?: boolean;
  hideInForm?: boolean;
  width?: number;
};

export type KuaioaActionConfig = {
  key: string;
  labelKey: string;
  icon?: React.ReactNode;
  onClick: (record: Record<string, unknown>) => Promise<void> | void;
  visible?: (record: Record<string, unknown>) => boolean;
  /** 为 true 时须具备 update 权限才展示 */
  requireUpdate?: boolean;
  /** 为 true 时不弹操作成功、不自动 reload（如打开二次 Modal） */
  deferSuccess?: boolean;
};

export type KuaioaAuditWorkflowConfig = {
  entityType: string;
  resourcePrefix: string;
  auditNodeKey?: string;
  entityNameKey?: string;
};

/** lifecycle：审批流程态右固定 StatusTag；marker：台账/启用类 MarkerTag */
export type KuaioaStatusPresentation = 'lifecycle' | 'marker';

const OA_WORKFLOW_DRAFT = ['draft'];
const OA_WORKFLOW_PENDING = ['pending'];
const OA_WORKFLOW_APPROVED = ['approved'];
const OA_WORKFLOW_REJECTED = ['rejected', 'cancelled'];

type Props = {
  createButtonKey: string;
  resource: string;
  columnPersistenceId?: string;
  rowKey?: string;
  codeField?: string;
  nameField?: string;
  fields: KuaioaFieldConfig[];
  listFn: (params?: Record<string, unknown>) => Promise<{ items: Record<string, unknown>[]; total: number }>;
  createFn?: (data: Record<string, unknown>) => Promise<unknown>;
  updateFn?: (id: number, data: Record<string, unknown>) => Promise<unknown>;
  deleteFn?: (id: number) => Promise<void>;
  extraActions?: KuaioaActionConfig[];
  statusEnum?: Record<string, { text: string; status?: string }>;
  statusPresentation?: KuaioaStatusPresentation;
  autoGenerateCode?: boolean;
  showAuditColumns?: boolean;
  auditWorkflow?: KuaioaAuditWorkflowConfig;
  detailVariant?: KuaioaDetailDrawerVariant;
  getDetailFn?: (id: number) => Promise<Record<string, unknown>>;
  renderDetailExtra?: (record: Record<string, unknown>, reload: () => void) => React.ReactNode;
  /** 自定义 Modal 表单区（替换默认 fields 渲染） */
  renderModalBody?: (form: FormInstance, editing: Record<string, unknown> | null) => React.ReactNode;
  /** 打开编辑时映射表单初值 */
  mapRecordToFormValues?: (record: Record<string, unknown>) => Record<string, unknown>;
  /** 提交前映射 API payload */
  mapFormValuesToPayload?: (values: Record<string, unknown>) => Record<string, unknown>;
  /** 表单值变化（如请假自动算天数） */
  onFormValuesChange?: (
    changed: Record<string, unknown>,
    allValues: Record<string, unknown>,
    form: FormInstance,
  ) => void;
  /** 默认 STANDARD_WIDTH（双栏）。有明细 Table 时传 LARGE_WIDTH */
  modalWidth?: number;
  /**
   * 无明细表默认开 grid 双列。表单模板等含 Table 的 Modal 必须传 false，
   * 并在 renderModalBody 里手写 Row/Col，Table 放在 Row 外。
   */
  modalGrid?: boolean;
  /** 提供时展示「全部 / 即将到期」切换，并调用独立 list API */
  expiringListFn?: (params?: Record<string, unknown>) => Promise<{ items: Record<string, unknown>[]; total: number }>;
  /** 创建成功后回调（须 createFn 返回新建记录） */
  onCreateSuccess?: (record: Record<string, unknown>) => void;
  /** 新建弹窗打开时的默认字段值 */
  createFormDefaults?: Record<string, unknown>;
};

type KuaioaListScope = 'all' | 'expiring';

const TYPE_MARKER_FIELDS = new Set([
  'category',
  'plan_type',
  'license_type',
  'asset_category',
  'leave_type',
  'seal_type',
]);

const KuaioaCrudListPage: React.FC<Props> = ({
  createButtonKey,
  resource,
  columnPersistenceId,
  rowKey = 'id',
  codeField = 'code',
  nameField = 'name',
  fields,
  listFn,
  createFn,
  updateFn,
  deleteFn,
  extraActions = [],
  statusEnum,
  statusPresentation = 'marker',
  autoGenerateCode = false,
  showAuditColumns = true,
  auditWorkflow,
  detailVariant = 'master',
  getDetailFn,
  renderDetailExtra,
  renderModalBody,
  mapRecordToFormValues,
  mapFormValuesToPayload,
  onFormValuesChange,
  modalWidth,
  modalGrid = true,
  expiringListFn,
  onCreateSuccess,
  createFormDefaults,
}) => {
  const { t } = useTranslation();
  const currentUser = useCurrentUser();
  const [searchParams] = useSearchParams();
  const initialScope: KuaioaListScope =
    expiringListFn && searchParams.get('scope') === 'expiring' ? 'expiring' : 'all';
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<Record<string, unknown>[]>([]);
  const perms = useResourcePermissions(resource);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null);
  const [listScope, setListScope] = useState<KuaioaListScope>(initialScope);
  const [form] = Form.useForm();
  const deepLinkHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (expiringListFn && searchParams.get('scope') === 'expiring') {
      setListScope('expiring');
    }
  }, [expiringListFn, searchParams]);

  const persistenceId =
    columnPersistenceId ?? `apps.kuaioa.${resource.replace(':', '.')}.list-v5`;

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const resolveFormValues = useCallback(
    (record: Record<string, unknown>) => {
      const base = mapOaRecordToFormValues(fields, record);
      return mapRecordToFormValues ? mapRecordToFormValues(base) : base;
    },
    [fields, mapRecordToFormValues],
  );

  const hydrateLookupValues = useCallback(
    async (record: Record<string, unknown>, values: Record<string, unknown>) => {
      const next = { ...values };
      const materialCode = record.material_code != null ? String(record.material_code).trim() : '';
      if (materialCode) {
        const res = await materialApi.list({ keyword: materialCode, limit: 8, isActive: true });
        const match = res.items.find(
          (item) => item.mainCode === materialCode || item.code === materialCode,
        );
        if (match?.id != null) next._material_id = match.id;
      }
      const customerName = record.customer_name != null ? String(record.customer_name).trim() : '';
      if (customerName) {
        const res = await searchReferenceDisplay({
          resource: 'master-data:supply-chain:customer',
          hostResource: resource,
          keyword: customerName,
          pageSize: 8,
        });
        const match = res.items.find((item) => item.name === customerName);
        if (match?.id != null) next._customer_id = match.id;
      }
      for (const field of fields) {
        if (resolveOaLookupKind(field) !== 'user') continue;
        const idKey = field.name.endsWith('_name') ? `${field.name.slice(0, -5)}_id` : `${field.name}_id`;
        const id = Number(record[idKey]);
        if (Number.isFinite(id) && id > 0) {
          next[`_pick_${field.name}`] = id;
        }
      }
      return next;
    },
    [fields, resource],
  );

  const openEdit = (record: Record<string, unknown>) => {
    setEditing(record);
    const base = resolveFormValues(record);
    form.setFieldsValue(base);
    setModalOpen(true);
    void hydrateLookupValues(record, base)
      .then((hydrated) => {
        form.setFieldsValue(hydrated);
      })
      .catch((error: { message?: string }) => {
        messageApi.warning(error?.message || t('common.operationFailed'));
      });
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    const defaults: Record<string, unknown> = {};
    const hasApplicant = fields.some((field) => field.name === 'applicant_name');
    const hasDepartment = fields.some((field) => field.name === 'department_name');
    if (hasApplicant && currentUser?.id) {
      const displayName = currentUser.full_name || currentUser.username;
      defaults.applicant_id = currentUser.id;
      defaults.applicant_name = displayName;
      defaults._pick_applicant_name = currentUser.id;
    }
    if (hasDepartment && currentUser?.department?.name) {
      defaults.department_name = currentUser.department.name;
    }
    if (createFormDefaults) {
      Object.assign(defaults, createFormDefaults);
    }
    if (Object.keys(defaults).length) {
      form.setFieldsValue(defaults);
    }
    setModalOpen(true);
  };

  const openDetail = useCallback(
    async (record: Record<string, unknown>) => {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailRecord(record);
      try {
        if (getDetailFn && record.id != null) {
          const fresh = await getDetailFn(Number(record.id));
          setDetailRecord(fresh);
        }
      } catch (error: any) {
        messageApi.error(error?.message || t('common.operationFailed'));
      } finally {
        setDetailLoading(false);
      }
    },
    [getDetailFn, messageApi, t],
  );

  const deepLinkId = searchParams.get('id');

  useEffect(() => {
    if (!deepLinkId || deepLinkHandledRef.current === deepLinkId) return;
    const id = Number(deepLinkId);
    if (!Number.isFinite(id) || id <= 0) return;
    deepLinkHandledRef.current = deepLinkId;
    const cached = tableRowsRef.current.find((row) => Number(row.id) === id);
    void openDetail(cached ?? { id });
  }, [deepLinkId, openDetail]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    const serialized = stripOaLookupPayload(mapOaFormValuesToPayload(fields, values));
    const payload = mapFormValuesToPayload ? mapFormValuesToPayload(serialized) : serialized;
    try {
      if (editing?.id) {
        await updateFn?.(Number(editing.id), payload);
        messageApi.success(t('common.updateSuccess'));
      } else {
        const created = await createFn?.(payload);
        messageApi.success(t('common.createSuccess'));
        if (created && typeof created === 'object') {
          onCreateSuccess?.(created as Record<string, unknown>);
        }
      }
      setModalOpen(false);
      reloadTable();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
    }
  };

  const handleDelete = useCallback(
    (record: Record<string, unknown>) => {
      modal.confirm({
        title: t('app.kuaioa.common.confirmDelete'),
        onOk: async () => {
          try {
            await deleteFn?.(Number(record.id));
            messageApi.success(t('common.deleteSuccess'));
            reloadTable();
          } catch (error: any) {
            messageApi.error(error?.message || t('common.operationFailed'));
          }
        },
      });
    },
    [deleteFn, messageApi, modal, reloadTable, t],
  );

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      try {
        for (const key of keys) {
          await deleteFn?.(Number(key));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        setSelectedRowKeys([]);
        reloadTable();
      } catch (error: any) {
        messageApi.error(error?.message || t('common.operationFailed'));
      }
    },
    [deleteFn, messageApi, reloadTable, t],
  );

  const columns = useMemo<ProColumns<Record<string, unknown>>[]>(() => {
    const keepWidthProps = (width?: number) =>
      width
        ? {
            width,
            minWidth: width,
            uniTableKeepWidth: true as const,
            resizable: false as const,
          }
        : {};

    const statusField = fields.find((f) => !f.hideInTable && f.name === 'status');
    const businessFields = fields.filter((f) => !f.hideInTable && f.name !== 'status');

    const base: ProColumns<Record<string, unknown>>[] = businessFields.map((field) => {
      const isNameRemainder = field.name === nameField;
      const col: ProColumns<Record<string, unknown>> = {
        title: t(field.labelKey),
        dataIndex: field.name,
        ellipsis: true,
      };

      if (isNameRemainder) {
        // 与车辆管理同构：名称/标题唯一 RemainderFlex，禁止全 KeepWidth
        col.minWidth = field.width ?? 140;
        col.uniTableRemainderFlex = true;
        col.uniTablePrimaryFlex = true;
        col.resizable = false;
      } else if (field.type === 'switch') {
        Object.assign(col, UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS);
      } else {
        Object.assign(col, keepWidthProps(field.width));
      }

      if (field.type === 'switch') {
        col.hideInSearch = true;
        col.render = (_, row) =>
          field.name === 'is_active'
            ? renderOaActiveTag(t, Boolean(row[field.name]))
            : renderOaYesNoTag(t, Boolean(row[field.name]));
        return col;
      }

      if (field.type === 'date' || field.name.endsWith('_date')) {
        col.hideInSearch = true;
        col.render = (_, row) => {
          const raw = row[field.name];
          return raw ? formatDateBySiteSetting(String(raw)) : '-';
        };
        return col;
      }

      if (field.type === 'datetime' || field.name.endsWith('_at')) {
        col.hideInSearch = true;
        col.render = (_, row) => {
          const raw = row[field.name];
          return raw ? formatDateTimeBySiteSetting(String(raw)) : '-';
        };
        return col;
      }

      if (TYPE_MARKER_FIELDS.has(field.name)) {
        col.hideInSearch = true;
        col.render = (_, row) => {
          const raw = row[field.name];
          const text = raw == null || raw === '' ? '' : String(raw);
          if (!text) return '-';
          const fromOptions = field.options?.find((o) => String(o.value) === text)?.label;
          const label =
            fromOptions ||
            t(`${field.labelKey}.${text}`, { defaultValue: text });
          return renderOaTypeMarker(label);
        };
        return col;
      }

      if (field.name === codeField) {
        col.hideInSearch = true;
      }

      return col;
    });

    if (showAuditColumns) {
      base.push(...buildDocumentAuditColumns<Record<string, unknown>>(t));
    }

    if (listScope === 'expiring' && expiringListFn) {
      base.push({
        title: t('app.kuaioa.common.daysUntilExpiry'),
        dataIndex: 'days_until_expiry',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => {
          const days = row.days_until_expiry;
          if (days == null || days === '') return '-';
          const n = Number(days);
          if (Number.isNaN(n)) return String(days);
          return (
            <span style={{ color: n <= 7 ? '#cf1322' : n <= 30 ? '#d48806' : undefined }}>
              {t('app.kuaioa.common.daysLeft', { count: n })}
            </span>
          );
        },
      });
    }

    if (statusField) {
      const statusCol: ProColumns<Record<string, unknown>> = {
        title: t(statusField.labelKey),
        dataIndex: 'status',
        valueType: statusEnum ? 'select' : undefined,
        valueEnum: statusEnum,
        render: (_, row) => {
          const value = row.status == null ? null : String(row.status);
          if (statusPresentation === 'lifecycle') {
            return renderOaApprovalStatusTag(statusEnum, value);
          }
          return renderOaStatusMarker(statusEnum, value);
        },
      };
      if (statusPresentation === 'lifecycle') {
        // SystemFixed：禁止页面写 width
        statusCol.key = 'lifecycle';
        statusCol.fixed = 'right';
      } else {
        Object.assign(statusCol, UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS);
      }
      base.push(statusCol);
    }

    base.push({
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const actions: React.ReactNode[] = [];
        actions.push(
          <Button
            {...rowActionKind('read')}
            key="detail"
            onClick={() => void openDetail(record)}
          />,
        );
        if (perms.canUpdate) {
          actions.push(
            <Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(record)} />,
          );
        }
        extraActions.forEach((action) => {
          if (action.requireUpdate && !perms.canUpdate) return;
          if (action.visible && !action.visible(record)) return;
          actions.push(
            <Button
              key={action.key}
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              onClick={async () => {
                try {
                  await action.onClick(record);
                  if (!action.deferSuccess) {
                    messageApi.success(t('app.kuaioa.common.operationSuccess'));
                    reloadTable();
                  }
                } catch (error: any) {
                  messageApi.error(error?.message || t('common.operationFailed'));
                }
              }}
            >
              {t(action.labelKey)}
            </Button>,
          );
        });
        if (auditWorkflow) {
          actions.push(
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="wf"
              record={record}
              entityType={auditWorkflow.entityType}
              unifiedAudit
              resourcePrefix={auditWorkflow.resourcePrefix}
              auditNodeKey={auditWorkflow.auditNodeKey}
              entityName={
                auditWorkflow.entityNameKey
                  ? t(auditWorkflow.entityNameKey)
                  : t(createButtonKey)
              }
              statusField="status"
              draftStatuses={OA_WORKFLOW_DRAFT}
              pendingStatuses={OA_WORKFLOW_PENDING}
              approvedStatuses={OA_WORKFLOW_APPROVED}
              rejectedStatuses={OA_WORKFLOW_REJECTED}
              theme="link"
              size="small"
              onSuccess={() => {
                reloadTable();
                if (detailOpen && detailRecord?.id === record.id) {
                  void openDetail(record);
                }
              }}
            />,
          );
        }
        if (perms.canDelete && deleteFn) {
          actions.push(
            <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDelete(record)} />,
          );
        }
        return actions;
      },
    });

    return alignProColumns(base, GLOBAL_DOC_LIST_FIELD_RANK);
  }, [
    auditWorkflow,
    codeField,
    createButtonKey,
    deleteFn,
    detailOpen,
    detailRecord?.id,
    extraActions,
    expiringListFn,
    fields,
    handleDelete,
    listScope,
    messageApi,
    nameField,
    openDetail,
    perms.canDelete,
    perms.canUpdate,
    reloadTable,
    showAuditColumns,
    statusEnum,
    statusPresentation,
    t,
  ]);

  if (!perms.canRead) {
    return <ListPageTemplate>{t('app.kuaioa.common.noPermission')}</ListPageTemplate>;
  }

  return (
    <ListPageTemplate>
      <UniTable<Record<string, unknown>>
        actionRef={actionRef}
        rowKey={rowKey}
        columnPersistenceId={persistenceId}
        columns={columns}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        permissionResource={resource}
        beforeSearchButtons={
          expiringListFn ? (
            <ThemedSegmented
              key="oa-list-scope"
              surfaceBackground
              size="medium"
              value={listScope}
              onChange={(value) => {
                setListScope(value as KuaioaListScope);
                reloadTable();
              }}
              options={[
                { label: t('app.kuaioa.listScope.all'), value: 'all' },
                { label: t('app.kuaioa.listScope.expiring'), value: 'expiring' },
              ]}
            />
          ) : undefined
        }
        request={async (params) => {
          const fetchFn = listScope === 'expiring' && expiringListFn ? expiringListFn : listFn;
          const res = await fetchFn({
            keyword: params.keyword as string | undefined,
            status: params.status as string | undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        search={{ labelWidth: 'auto' }}
        showCreateButton={!!createFn}
        createButtonText={t(createButtonKey)}
        onCreate={openCreate}
        showDeleteButton={!!deleteFn}
        onDelete={handleBatchDelete}
        deleteButtonText={t('common.batchDelete')}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
      />

      <FormModalTemplate
        open={modalOpen}
        title={editing ? t('common.edit') : t(createButtonKey)}
        onClose={() => setModalOpen(false)}
        onFinish={handleSubmit}
        isEdit={Boolean(editing)}
        form={form}
        grid={modalGrid}
        width={modalWidth ?? MODAL_CONFIG.STANDARD_WIDTH}
        onValuesChange={(changed, allValues) => {
          onFormValuesChange?.(changed, allValues, form);
        }}
      >
        {renderModalBody
          ? renderModalBody(form, editing)
          : fields.map((field) => {
              if (field.name === codeField && autoGenerateCode && !editing) {
                return null;
              }
              if (shouldSkipOaFormField(field, fields)) {
                return null;
              }
              const label = t(field.labelKey);
              const rules = field.required
                ? [{ required: true, message: t('app.kuaioa.common.required') }]
                : [];
              const colProps = modalGrid
                ? { span: field.type === 'textarea' || field.type === 'file' ? 24 : 12 }
                : undefined;
              const lookupKind = resolveOaLookupKind(field);
              if (lookupKind) {
                const lookupField = (
                  <OaLookupField
                    key={field.name}
                    field={field}
                    kind={lookupKind}
                    label={label}
                    required={field.required}
                    colProps={lookupKind === 'user' || lookupKind === 'department' || lookupKind === 'operation' ? colProps : undefined}
                    form={form}
                    resource={resource}
                    editing={editing}
                  />
                );
                /**
                 * UniMaterialSelect / CustomerSelect 不是 ProForm 字段，colProps 不会进 Col。
                 * Skill：非 ProForm 节点必须作为 grid 的直接 children 包 FormModalGridBlock。
                 */
                if (modalGrid && (lookupKind === 'material' || lookupKind === 'customer' || lookupKind === 'supplier')) {
                  return (
                    <FormModalGridBlock key={field.name} span={colProps?.span ?? 12}>
                      {lookupField}
                    </FormModalGridBlock>
                  );
                }
                return lookupField;
              }
              const fieldWidth = { style: { width: '100%' as const } };
              if (field.type === 'date') {
                return (
                  <ProFormDatePicker
                    key={field.name}
                    name={field.name}
                    label={label}
                    rules={rules}
                    colProps={colProps}
                    fieldProps={fieldWidth}
                  />
                );
              }
              if (field.type === 'datetime') {
                return (
                  <ProFormDatePicker
                    key={field.name}
                    name={field.name}
                    label={label}
                    rules={rules}
                    colProps={colProps}
                    fieldProps={{ ...fieldWidth, showTime: true, format: 'YYYY-MM-DD HH:mm:ss' }}
                  />
                );
              }
              if (field.type === 'file') {
                return (
                  <ProForm.Item
                    key={field.name}
                    name={field.name}
                    label={label}
                    rules={rules}
                    colProps={colProps}
                  >
                    <OaSingleFileField />
                  </ProForm.Item>
                );
              }
              if (field.type === 'textarea') {
                return (
                  <ProFormTextArea
                    key={field.name}
                    name={field.name}
                    label={label}
                    rules={rules}
                    colProps={colProps}
                    fieldProps={{ rows: 3 }}
                  />
                );
              }
              if (field.type === 'select') {
                return (
                  <ProFormSelect
                    key={field.name}
                    name={field.name}
                    label={label}
                    rules={rules}
                    colProps={colProps}
                    options={field.options}
                    allowClear
                  />
                );
              }
              if (field.type === 'switch') {
                return (
                  <ProFormSwitch key={field.name} name={field.name} label={label} colProps={colProps} />
                );
              }
              if (field.type === 'number') {
                return (
                  <ProFormDigit
                    key={field.name}
                    name={field.name}
                    label={label}
                    rules={rules}
                    colProps={colProps}
                    fieldProps={fieldWidth}
                  />
                );
              }
              return (
                <ProFormText
                  key={field.name}
                  name={field.name}
                  label={label}
                  rules={rules}
                  colProps={colProps}
                />
              );
            })}
      </FormModalTemplate>

      <KuaioaDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        loading={detailLoading}
        record={detailRecord}
        fields={fields}
        codeField={codeField}
        titleField={nameField}
        variant={detailVariant}
        statusEnum={statusEnum}
        statusPresentation={statusPresentation}
        extra={
          detailRecord ? (
            <>
              {auditWorkflow ? (
                <UniWorkflowActions
                  record={detailRecord}
                  entityType={auditWorkflow.entityType}
                  unifiedAudit
                  resourcePrefix={auditWorkflow.resourcePrefix}
                  auditNodeKey={auditWorkflow.auditNodeKey}
                  entityName={
                    auditWorkflow.entityNameKey
                      ? t(auditWorkflow.entityNameKey)
                      : t(createButtonKey)
                  }
                  statusField="status"
                  draftStatuses={OA_WORKFLOW_DRAFT}
                  pendingStatuses={OA_WORKFLOW_PENDING}
                  approvedStatuses={OA_WORKFLOW_APPROVED}
                  rejectedStatuses={OA_WORKFLOW_REJECTED}
                  onSuccess={() => {
                    reloadTable();
                    void openDetail(detailRecord);
                  }}
                />
              ) : null}
              {renderDetailExtra ? renderDetailExtra(detailRecord, reloadTable) : null}
            </>
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

export default KuaioaCrudListPage;
