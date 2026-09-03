import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 维护保养计划管理页面
 *
 * 提供维护保养计划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持维护保养计划创建、自动生成、提醒预警、执行记录等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Descriptions, Typography, Empty, Spin, theme as AntdTheme, Checkbox, Table, Select, InputNumber, Input } from 'antd';
import { StatusTag } from '../../../../../constants/statusBadges';
import { resolveDocumentStatusTagColor } from '../../../../../constants/documentStatusColors';
import { PlusOutlined } from '@ant-design/icons';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { useEquipmentDetailDrawer } from '../shared/equipmentMasterDataDetail';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { getMaintenancePlanLifecycle } from '../../../utils/equipmentLifecycle';
import { maintenancePlanApi, equipmentApi, sparePartApi } from '../../../services/equipment';
import { maintenanceSchemesApi } from '../../../services/equipmentOps';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formatDateTime, formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { formDateRangeFormItemProps, formDateFormItemProps, toApiDateString, coerceFormDate } from '../../../../../utils/formDate';
import {
  buildMaintenancePlanStatusValueEnum,
  formatMaintenancePlanEquipmentText,
  MAINTENANCE_PLAN_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveMaintenancePlanEquipmentUuids,
  resolveMaintenancePlanListParams,
} from '../../../utils/equipmentListCore';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
const P = 'app.kuaizhizao.maintenancePlan';

function toApiDateTimeString(value: unknown): string | undefined {
  const d = coerceFormDate(value);
  return d ? d.format('YYYY-MM-DD HH:mm:ss') : undefined;
}

const PLAN_STATUS_KEYS: Record<string, string> = {
  草稿: `${P}.status.draft`,
  已发布: `${P}.status.published`,
  执行中: `${P}.status.running`,
  已完成: `${P}.status.completed`,
  已取消: `${P}.status.cancelled`,
};

const EXECUTABLE_PLAN_STATUSES = new Set(['草稿', '已发布', '执行中']);

function buildMaintenancePlanSubmitPayload(values: Record<string, unknown>) {
  const equipmentUuids = Array.isArray(values.equipment_uuids)
    ? values.equipment_uuids.map(String).filter(Boolean)
    : values.equipment_uuid
      ? [String(values.equipment_uuid)]
      : [];
  return {
    plan_name: values.plan_name,
    plan_type: values.plan_type,
    equipment_uuids: equipmentUuids,
    maintenance_type: values.maintenance_type,
    cycle_type: values.cycle_type,
    cycle_value: values.cycle_value,
    cycle_unit: values.cycle_unit,
    planned_start_date: toApiDateString(values.planned_start_date) ?? null,
    planned_end_date: toApiDateString(values.planned_end_date) ?? null,
    responsible_person_id: values.responsible_person_id,
    responsible_person_name: values.responsible_person_name,
    status: values.status,
    remark: values.remark,
    attachments: normalizeDocumentAttachments(values.attachments),
  };
}

interface MaintenancePlan {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  plan_no?: string;
  plan_name?: string;
  plan_type?: string;
  equipment_uuid?: string;
  equipment_uuids?: string[];
  equipment_items?: Array<{ id?: number; uuid?: string; code?: string; name?: string }>;
  equipment_code?: string;
  equipment_name?: string;
  maintenance_type?: string;
  cycle_type?: string;
  cycle_value?: number;
  cycle_unit?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  status?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  spare_parts_used?: { items?: Array<{ spare_part_id?: number; quantity?: number; warehouse_location?: string; part_no?: string; part_name?: string }> };
  created_at?: string;
  updated_at?: string;
}

const MaintenancePlansPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const planDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const urlUuidRef = useRef<string | undefined>(undefined);
  const urlEquipmentUuidRef = useRef<string | undefined>(undefined);
  const deepLinkOpenedRef = useRef(false);

  // Modal 相关状态（创建/编辑维护计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<MaintenancePlan | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<any>(null);

  const { open: detailVisible, loading: detailLoading, detail: planDetail, setDetail: setPlanDetail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<MaintenancePlan>();

  const [planTrackingRefreshKey, setPlanTrackingRefreshKey] = useState(0);

  const planTracking = useDocumentTracking(
    detailVisible && planDetail?.id ? 'maintenance_plan' : undefined,
    planDetail?.id,
    planTrackingRefreshKey,
  );

  // 执行维护保养 Modal 状态
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executePlan, setExecutePlan] = useState<MaintenancePlan | null>(null);
  const [executeFormInitialValues, setExecuteFormInitialValues] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const [executeSubmitting, setExecuteSubmitting] = useState(false);
  const executeFormRef = useRef<any>(null);
  const [schemeOptions, setSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [executedItems, setExecutedItems] = useState<
    Array<{
      item_id?: number;
      item_name?: string;
      done?: boolean;
      attachments?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
    }>
  >([]);
  const [sparePartLines, setSparePartLines] = useState<Array<{ spare_part_id?: number; quantity?: number; warehouse_location?: string }>>([]);
  const [sparePartOptions, setSparePartOptions] = useState<{ label: string; value: number }[]>([]);

  /**
   * 处理新建维护计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlan(null);
    setFormInitialValues({
      planned_start_date: dayjs(),
      cycle_type: '按时间',
      status: '草稿',
    });
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t(`${P}.create`)),
    [t],
  );

  /**
   * 处理编辑维护计划
   */
  const handleEdit = async (record: MaintenancePlan) => {
    try {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }
      const detail = await maintenancePlanApi.get(record.uuid);
      setIsEdit(true);
      setCurrentPlan(detail);
      setFormInitialValues({
        plan_name: detail.plan_name,
        plan_type: detail.plan_type,
        equipment_uuids: resolveMaintenancePlanEquipmentUuids(detail),
        maintenance_type: detail.maintenance_type,
        cycle_type: detail.cycle_type ?? '按时间',
        cycle_value: detail.cycle_value,
        cycle_unit: detail.cycle_unit,
        planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : dayjs(),
        planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : undefined,
        status: detail.status,
        attachments: mapAttachmentsToUploadList(detail.attachments),
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error(t(`${P}.detailFailed`));
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = useCallback(
    (record: MaintenancePlan) => {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }
      setPlanTrackingRefreshKey((k) => k + 1);
      void openDetail(
        () => maintenancePlanApi.get(record.uuid!) as Promise<MaintenancePlan>,
        t(`${P}.detailFailed`),
      );
    },
    [messageApi, openDetail, t],
  );

  useEffect(() => {
    const uuidFromUrl = searchParams.get('uuid')?.trim() || undefined;
    const equipmentUuidFromUrl = searchParams.get('equipment_uuid')?.trim() || undefined;
    urlUuidRef.current = uuidFromUrl;
    urlEquipmentUuidRef.current = equipmentUuidFromUrl;
    if (!uuidFromUrl && !equipmentUuidFromUrl) {
      deepLinkOpenedRef.current = false;
      actionRef.current?.reload();
      return;
    }
    if (uuidFromUrl) {
      if (deepLinkOpenedRef.current) {
    actionRef.current?.reload();
        return;
      }
      deepLinkOpenedRef.current = true;
      void (async () => {
        try {
          const response = await maintenancePlanApi.list({ uuid: uuidFromUrl, skip: 0, limit: 1 });
          const { data } = normalizeEquipmentListResponse(response);
          if (data.length > 0) {
            handleDetail(data[0] as MaintenancePlan);
          }
        } catch {
          messageApi.error(t(`${P}.listFailed`));
        }
    actionRef.current?.reload();
      })();
      return;
    }
    deepLinkOpenedRef.current = true;
    actionRef.current?.reload();
  }, [searchParams, handleDetail, messageApi, t]);

  /**
   * 处理批量删除维护计划（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    try {
          for (const uuid of keys) {
            await maintenancePlanApi.delete(String(uuid));
          }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          if (planDetail?.uuid && keys.map(String).includes(String(planDetail.uuid))) {
            closeDetail();
          }
    actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    setSubmitting(true);
    try {
      const submitData = buildMaintenancePlanSubmitPayload(values);

      const editedUuid = isEdit ? currentPlan?.uuid : undefined;
      if (isEdit && editedUuid) {
        await maintenancePlanApi.update(editedUuid, submitData);
        messageApi.success(t(`${P}.updateSuccess`));
      } else {
        await maintenancePlanApi.create(submitData);
        messageApi.success(t(`${P}.createSuccess`));
      }
      setModalVisible(false);
      setCurrentPlan(null);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
      if (editedUuid && planDetail?.uuid === editedUuid) {
        try {
          const fresh = await maintenancePlanApi.get(editedUuid);
          setPlanDetail(fresh);
          setPlanTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 打开执行维护保养 Modal
   */
  const handleExecute = (record: MaintenancePlan) => {
    const equipmentUuids = resolveMaintenancePlanEquipmentUuids(record);
    if (!record.uuid || equipmentUuids.length === 0) {
      messageApi.error(t(`${P}.incompleteInfo`));
      return;
    }
    setExecutePlan(record);
    setExecutedItems([]);
    setSparePartLines([]);
    setExecuteFormInitialValues({
      equipment_uuid: equipmentUuids[0],
      execution_date: dayjs(),
      execution_result: '正常',
      execution_content: t(`${P}.executionContentTemplate`, { name: record.plan_name }),
    });
    setExecuteModalVisible(true);
    void Promise.all([
      maintenanceSchemesApi.list({ limit: 1000, is_active: true }),
      sparePartApi.list({ limit: 500 }),
    ]).then(([schemeRes, partRes]) => {
      setSchemeOptions(
        (schemeRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
          label: `${s.code} - ${s.name}`,
          value: s.id,
        })),
      );
      setSparePartOptions(
        (partRes.items ?? []).map((p: { id: number; part_no: string; part_name: string }) => ({
          label: `${p.part_no} - ${p.part_name}`,
          value: p.id,
        })),
      );
    });
  };

  const handleSchemeChange = async (schemeId?: number) => {
    if (!schemeId) {
      setExecutedItems([]);
      return;
    }
    try {
      const scheme = await maintenanceSchemesApi.get(schemeId);
      setExecutedItems(
        (scheme.lines ?? []).map((l: { item_id?: number; item_name?: string }) => ({
          item_id: l.item_id,
          item_name: l.item_name,
          done: false,
        })),
      );
    } catch {
      setExecutedItems([]);
    }
  };

  /**
   * 提交执行维护保养
   */
  const handleExecuteSubmit = async (values: any) => {
    const equipmentUuids = executePlan ? resolveMaintenancePlanEquipmentUuids(executePlan) : [];
    const equipmentUuid = values.equipment_uuid ?? equipmentUuids[0];
    if (!executePlan?.uuid || !equipmentUuid) return;
    setExecuteSubmitting(true);
    try {
      const validParts = sparePartLines.filter((l) => l.spare_part_id && l.quantity);
      await maintenancePlanApi.execute({
        equipment_uuid: equipmentUuid,
        maintenance_plan_uuid: executePlan.uuid,
        maintenance_scheme_id: values.maintenance_scheme_id,
        executed_items: executedItems.filter((i) => i.done),
        execution_date:
          toApiDateTimeString(values.execution_date) ??
          formatDateTimeBySiteSetting(new Date()),
        execution_content: values.execution_content,
        execution_result: values.execution_result ?? '正常',
        status: '已确认',
        attachments: normalizeDocumentAttachments(values.attachments),
        spare_parts_used: validParts.length ? { items: validParts } : undefined,
      });
      messageApi.success(t(`${P}.executeSubmitted`));
      setExecuteModalVisible(false);
      setExecutePlan(null);
      setExecutedItems([]);
      setSparePartLines([]);
      setExecuteFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
      throw error;
    } finally {
      setExecuteSubmitting(false);
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<MaintenancePlan>[] = useMemo(
    () => [
    {
      title: t(`${P}.col.planNo`),
      dataIndex: 'plan_no',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.plan_no ?? '') }}>{r.plan_no ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.planName`),
      dataIndex: 'plan_name',
    },
    {
      title: t(`${P}.col.planType`),
      dataIndex: 'plan_type',
    },
    {
      title: t(`${P}.col.equipmentCode`),
      dataIndex: 'equipment_code',
      render: (_, r) => formatMaintenancePlanEquipmentText(r),
    },
    {
      title: t(`${P}.col.equipmentName`),
      dataIndex: 'equipment_name',
      render: (_, r) => formatMaintenancePlanEquipmentText(r),
    },
    {
      title: t(`${P}.col.maintenanceType`),
      dataIndex: 'maintenance_type',
    },
    {
      title: t(`${P}.col.maintenanceCycle`),
      dataIndex: 'cycle_value',
      render: (_, record) =>
        record ? `${record.cycle_value ?? ''} ${record.cycle_unit ?? ''}`.trim() || '-' : '-',
    },
    {
      title: t(`${P}.col.plannedStartDate`),
      dataIndex: 'planned_start_date',
      valueType: 'date',
    },
    {
      title: t(`${P}.col.plannedEndDate`),
      dataIndex: 'planned_end_date',
      valueType: 'date',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const key = status ? PLAN_STATUS_KEYS[status] : undefined;
        const text = key ? t(key) : (status || '-');
        const color = status ? resolveDocumentStatusTagColor(status) : 'default';
        return <StatusTag color={color}>{text}</StatusTag>;
      },
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
    ],
    [t]
  );

  const planSparePartLines = planDetail?.spare_parts_used?.items ?? [];

  const planSparePartLineColumns: ColumnsType<(typeof planSparePartLines)[number]> = useMemo(
    () => [
      {
        title: t(`${P}.form.sparePart`),
        dataIndex: 'part_name',
        render: (_, row) =>
          row.part_no || row.part_name
            ? `${row.part_no ?? ''}${row.part_no && row.part_name ? ' - ' : ''}${row.part_name ?? ''}`.trim() ||
              String(row.spare_part_id ?? '-')
            : String(row.spare_part_id ?? '-'),
      },
      {
        title: t('common.quantity'),
        dataIndex: 'quantity',
        width: 100,
      },
      {
        title: t(`${P}.form.sparePartLocation`),
        dataIndex: 'warehouse_location',
      },
    ],
    [t],
  );

  const renderPlanRowNodes = (record: MaintenancePlan): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [
      <Button {...rowActionKind('read')}
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        {t('common.detail')}
      </Button>,
      <Button {...rowActionKind('update')}
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleEdit(record);
        }}
      >
        {t('common.edit')}
      </Button>,
      <ActionConfirmPopconfirm
        key="del"
        title={t(`${P}.deleteTitle`)}
        description={t(`${P}.deleteContent`, { name: record.plan_name })}
        onConfirm={() => record.uuid && void handleDelete([record.uuid])}
      >
        <Button
          {...rowActionKind('delete')}
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => e.stopPropagation()}
        >
          {t('common.delete')}
        </Button>
      </ActionConfirmPopconfirm>,
    ];
    if (record.status && EXECUTABLE_PLAN_STATUSES.has(record.status)) {
      nodes.push(
        <Button {...rowActionKind('execute')}
          key="exec"
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleExecute(record);
          }}
        >
          {t(`${P}.action.execute`)}
        </Button>
      );
    }
    return nodes;
  };

  /**
   * 表格列定义
   */
  const planStatusValueEnum = useMemo(() => buildMaintenancePlanStatusValueEnum(t), [t]);

  const columns: ProColumns<MaintenancePlan>[] = useMemo(() => alignProColumns<MaintenancePlan>([
    {
      title: t(`${P}.col.plannedStartDate`),
      dataIndex: 'planned_start_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 11 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: planStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t(`${P}.col.planType`),
      dataIndex: 'plan_type',
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
    {
      title: t(`${P}.col.maintenanceType`),
      dataIndex: 'maintenance_type',
      hideInTable: true,
      search: { order: 22 } as ProColumns['search'],
    },
    {
      title: t(`${P}.col.planNo`),
      dataIndex: 'plan_no',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 30 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.plan_no ?? '') }} ellipsis>
          {r.plan_no ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.planName`),
      dataIndex: 'plan_name',
      minWidth: 160,
      uniTablePrimaryFlex: true,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => (r.plan_name != null && r.plan_name !== '' ? String(r.plan_name) : '-'),
    },
    {
      title: t(`${P}.col.planType`),
      dataIndex: 'plan_type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.plan_type != null && r.plan_type !== '' ? String(r.plan_type) : '-'),
    },
    {
      title: t(`${P}.col.equipmentName`),
      dataIndex: 'equipment_name',
      width: 200,
      minWidth: 200,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => {
        const text = formatMaintenancePlanEquipmentText(r);
        return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
      },
    },
    {
      title: t(`${P}.col.maintenanceType`),
      dataIndex: 'maintenance_type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.maintenance_type != null && r.maintenance_type !== '' ? String(r.maintenance_type) : '-',
    },
    {
      title: t(`${P}.col.maintenanceCycle`),
      dataIndex: 'cycle_value',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_, record) =>
        record ? `${record.cycle_value ?? ''} ${record.cycle_unit ?? ''}`.trim() || '-' : '-',
    },
    {
      title: t(`${P}.col.plannedStartDate`),
      dataIndex: 'planned_start_date',
      valueType: 'date',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t(`${P}.col.lifecycle`),
      key: 'lifecycle',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getMaintenancePlanLifecycle(record as Record<string, unknown>, t)} />
      ),
    },
    {
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => renderPlanRowNodes(record),
    },
  ], SALES_DOC_LIST_FIELD_RANK), [t, planStatusValueEnum]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBaseColumns, planDetail,
    'maintenance_plan',
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaintenancePlan>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.maintenancePlans)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-plans-width-v2"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MAINTENANCE_PLAN_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveMaintenancePlanListParams(searchFormValues, sort);
              const response = await maintenancePlanApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...listParams,
                ...(urlUuidRef.current ? { uuid: urlUuidRef.current } : {}),
                ...(urlEquipmentUuidRef.current ? { equipment_uuid: urlEquipmentUuidRef.current } : {}),
              });
              const { data, total } = normalizeEquipmentListResponse(response);
              return {
                data: data as MaintenancePlan[],
                success: true,
                total,
              };
            } catch (error) {
              messageApi.error(t(`${P}.listFailed`));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          showDeleteButton={true}
          deleteConfirmTitle={t(`${P}.batchDeleteTitle`)}
          deleteConfirmDescription={(count) => t(`${P}.batchDeleteContent`, { count: count })}
          
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      {/* 创建/编辑维护计划 Modal */}
      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentPlan(null);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="plan_name"
              label={t(`${P}.form.planName`)}
              placeholder={t(`${P}.form.planNamePlaceholder`)}
              rules={[{ required: true, message: t(`${P}.form.planNamePlaceholder`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="plan_type"
              label={t(`${P}.form.planType`)}
              placeholder={t(`${P}.form.selectPlanType`)}
              options={[
                { label: t(`${P}.planType.regular`), value: '定期维护' },
                { label: t(`${P}.planType.preventive`), value: '预防性维护' },
                { label: t(`${P}.planType.temporary`), value: '临时维护' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectPlanType`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormSelect
              name="equipment_uuids"
              label={t(`${P}.form.equipment`)}
              placeholder={t(`${P}.form.selectEquipment`)}
              mode="multiple"
              showSearch
              fieldProps={{
                maxTagCount: 'responsive',
              }}
              request={async () => {
                try {
                  const response = await equipmentApi.list({ limit: 1000 });
                  return (response.items || []).map((eq: any) => ({
                    label: `${eq.code} - ${eq.name}`,
                    value: eq.uuid,
                  }));
                } catch (error) {
                  return [];
                }
              }}
              rules={[{ required: true, message: t(`${P}.form.selectEquipment`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="maintenance_type"
              label={t(`${P}.form.maintenanceType`)}
              placeholder={t(`${P}.form.selectMaintenanceType`)}
              options={[
                { label: t(`${P}.maintenanceType.daily`), value: '日常保养' },
                { label: t(`${P}.maintenanceType.minor`), value: '小修' },
                { label: t(`${P}.maintenanceType.medium`), value: '中修' },
                { label: t(`${P}.maintenanceType.overhaul`), value: '大修' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectMaintenanceType`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="cycle_type"
              label={t(`${P}.form.cycleType`)}
              placeholder={t(`${P}.form.selectCycleType`)}
              options={[
                { label: t(`${P}.cycleType.byTime`), value: '按时间' },
                { label: t(`${P}.cycleType.byRuntime`), value: '按运行时长' },
                { label: t(`${P}.cycleType.byCount`), value: '按使用次数' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectCycleType`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDigit
              name="cycle_value"
              label={t(`${P}.form.maintenanceCycle`)}
              placeholder={t(`${P}.form.maintenanceCyclePlaceholder`)}
              min={1}
              rules={[{ required: true, message: t(`${P}.form.maintenanceCyclePlaceholder`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="cycle_unit"
              label={t(`${P}.form.cycleUnit`)}
              placeholder={t(`${P}.form.selectCycleUnit`)}
              options={[
                { label: t(`${P}.cycleUnit.day`), value: '天' },
                { label: t(`${P}.cycleUnit.week`), value: '周' },
                { label: t(`${P}.cycleUnit.month`), value: '月' },
                { label: t(`${P}.cycleUnit.year`), value: '年' },
                { label: t(`${P}.cycleUnit.hour`), value: '小时' },
                { label: t(`${P}.cycleUnit.count`), value: '次' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectCycleUnit`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label={t('common.status')}
              placeholder={t(`${P}.form.selectStatus`)}
              options={[
                { label: t(`${P}.status.draft`), value: '草稿' },
                { label: t(`${P}.status.published`), value: '已发布' },
                { label: t(`${P}.status.running`), value: '执行中' },
                { label: t(`${P}.status.completed`), value: '已完成' },
                { label: t(`${P}.status.cancelled`), value: '已取消' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectStatus`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_start_date"
              label={t(`${P}.form.plannedStartDate`)}
              placeholder={t(`${P}.form.selectPlannedStartDate`)}
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_end_date"
              label={t(`${P}.form.plannedEndDate`)}
              placeholder={t(`${P}.form.selectPlannedEndDate`)}
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <DocumentAttachmentsField category="maintenance_plan_attachments" />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 执行维护保养 Modal */}
      <FormModalTemplate
        title={t(`${P}.executeModal`)}
        open={executeModalVisible}
        onClose={() => {
          setExecuteModalVisible(false);
          setExecutePlan(null);
          setExecutedItems([]);
          setSparePartLines([]);
          setExecuteFormInitialValues(undefined);
        }}
        onFinish={handleExecuteSubmit}
        isEdit={false}
        loading={executeSubmitting}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={executeFormRef}
        initialValues={executeFormInitialValues}
        grid={false}
      >
        {executePlan && resolveMaintenancePlanEquipmentUuids(executePlan).length > 1 ? (
          <Row gutter={16}>
            <Col span={24}>
              <ProFormSelect
                name="equipment_uuid"
                label={t(`${P}.form.equipment`)}
                placeholder={t(`${P}.form.selectEquipment`)}
                options={(executePlan.equipment_items ?? [])
                  .filter((item) => item.uuid)
                  .map((item) => ({
                    label: item.code ? `${item.code} - ${item.name}` : String(item.name ?? item.uuid),
                    value: item.uuid!,
                  }))}
                rules={[{ required: true, message: t(`${P}.form.selectEquipment`) }]}
              />
            </Col>
          </Row>
        ) : null}
        <Row gutter={16}>
          <Col span={24}>
            <ProFormSelect
              name="maintenance_scheme_id"
              label={t(`${P}.form.maintenanceScheme`)}
              placeholder={t(`${P}.form.selectMaintenanceScheme`)}
              options={schemeOptions}
              showSearch
              allowClear
              fieldProps={{
                onChange: (val: number) => void handleSchemeChange(val),
              }}
            />
          </Col>
        </Row>
        {executedItems.length > 0 && (
          <Row gutter={16}>
            <Col span={24}>
              <Typography.Text strong>{t(`${P}.form.executedItems`)}</Typography.Text>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {executedItems.map((item, index) => (
                  <div
                    key={item.item_id ?? index}
                    style={{
                      border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <Checkbox
                      checked={item.done}
                      onChange={(e) => {
                        const next = [...executedItems];
                        next[index] = { ...next[index], done: e.target.checked };
                        setExecutedItems(next);
                      }}
                    >
                      {item.item_name ?? `#${item.item_id}`}
                    </Checkbox>
                    <div style={{ marginTop: 8 }}>
                      <LineAttachmentsUpload
                        category="maintenance_execution_item"
                        value={item.attachments}
                        onChange={(next) => {
                          const copy = [...executedItems];
                          copy[index] = { ...copy[index], attachments: next };
                          setExecutedItems(copy);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="execution_date"
              label={t(`${P}.form.executionDate`)}
              placeholder={t(`${P}.form.selectExecutionDate`)}
              rules={[{ required: true, message: t(`${P}.form.selectExecutionDate`) }]}
              formItemProps={formDateFormItemProps}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="execution_result"
              label={t(`${P}.form.executionResult`)}
              placeholder={t(`${P}.form.selectExecutionResult`)}
              options={[
                { label: t(`${P}.executionResult.normal`), value: '正常' },
                { label: t(`${P}.executionResult.abnormal`), value: '异常' },
                { label: t(`${P}.executionResult.pending`), value: '待处理' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectExecutionResult`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <DocumentAttachmentsField category="maintenance_execution_attachments" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <Typography.Text strong>{t(`${P}.form.sparePartsUsed`)}</Typography.Text>
            <Table
              size="small"
              pagination={false}
              style={{ marginTop: 8 }}
              dataSource={sparePartLines.map((l, i) => ({ ...l, key: i }))}
              columns={[
                {
                  title: t(`${P}.form.sparePart`),
                  render: (_, __, index) => (
                    <Select
                      value={sparePartLines[index]?.spare_part_id}
                      options={sparePartOptions}
                      showSearch
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      onChange={(val: number) => {
                        const next = [...sparePartLines];
                        next[index] = { ...next[index], spare_part_id: val };
                        setSparePartLines(next);
                      }}
                    />
                  ),
                },
                {
                  title: t('common.quantity'),
                  width: 100,
                  render: (_, __, index) => (
                    <InputNumber
                      min={1}
                      value={sparePartLines[index]?.quantity}
                      onChange={(val) => {
                        const next = [...sparePartLines];
                        next[index] = { ...next[index], quantity: Number(val) || 1 };
                        setSparePartLines(next);
                      }}
                    />
                  ),
                },
                {
                  title: t(`${P}.form.sparePartLocation`),
                  render: (_, __, index) => (
                    <Input
                      value={sparePartLines[index]?.warehouse_location}
                      onChange={(e) => {
                        const next = [...sparePartLines];
                        next[index] = { ...next[index], warehouse_location: e.target.value };
                        setSparePartLines(next);
                      }}
                    />
                  ),
                },
              ]}
            />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              style={{ marginTop: 8 }}
              onClick={() => setSparePartLines([...sparePartLines, { quantity: 1, warehouse_location: '默认库位' }])}
            >
              {t(`${P}.form.addSparePartLine`)}
            </Button>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="execution_content"
              label={t(`${P}.form.executionContent`)}
              placeholder={t(`${P}.form.executionContentPlaceholder`)}
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 维护计划详情 Drawer */}
      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={detailVisible}
        loading={detailLoading}
        zIndex={planDetailDrawerZIndex}
        onClose={closeDetail}
        size={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          planDetail ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        basicTitle={t(`${P}.section.basicInfo`)}
        collaborationTitle={t(`${P}.section.lifecycle`)}
        collaborationLifecycle={
          planDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const lc = getMaintenancePlanLifecycle(planDetail as Record<string, unknown>, t);
                const mainStages = lc.mainStages ?? [];
                if (mainStages.length === 0) return null;
                return (
                  <UniLifecycleStepper
                    steps={mainStages}
                    showLabels
                    status={lc.status}
                    nextStepSuggestions={lc.nextStepSuggestions}
                    hideNextStepSuggestions
                  />
                );
              })()}
            </div>
          ) : undefined
        }
        traceDocument={
          planDetail?.id != null
            ? {
                documentType: 'maintenance_plan',
                documentId: planDetail.id,
                selfDocumentId: planDetail.id,
                renderBriefActions: (doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={closeDetail}
                  />
                ),
              }
            : null
        }
        lines={
          planSparePartLines.length ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(row, index) => String(row.spare_part_id ?? index)}
              dataSource={planSparePartLines}
              columns={planSparePartLineColumns}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noDetailLines`)} />
          )
        }
        linesTitle={t(`${P}.section.detailInfo`)}
        timeline={
          planTracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : planTracking.error ? (
            <Typography.Text type="danger">{planTracking.error}</Typography.Text>
          ) : planTracking.data ? (
            <DocumentTrackingTimelineBody data={planTracking.data} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noOperationRecords`)} />
          )
        }
        timelineTitle={t(`${P}.section.operationHistory`)}
      />
    </>
  );
};

export default MaintenancePlansPage;

