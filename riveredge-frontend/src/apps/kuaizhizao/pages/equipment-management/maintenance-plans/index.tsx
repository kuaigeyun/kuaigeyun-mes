import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
/**
 * 维护保养计划管理页面
 *
 * 提供维护保养计划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持维护保养计划创建、自动生成、提醒预警、执行记录等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DescriptionsProps } from 'antd';
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
import { App, Button, Tag, Modal, Row, Col, Descriptions, Typography, Empty, Spin, theme as AntdTheme, Checkbox, Table, Select, InputNumber, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { getMaintenancePlanLifecycle } from '../../../utils/equipmentLifecycle';
import { maintenancePlanApi, equipmentApi, sparePartApi } from '../../../services/equipment';
import { maintenanceSchemesApi } from '../../../services/equipmentOps';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { formDateRangeFormItemProps, formDateFormItemProps, toApiDateString, coerceFormDate } from '../../../../../utils/formDate';
import {
  buildMaintenancePlanStatusValueEnum,
  MAINTENANCE_PLAN_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveMaintenancePlanListParams,
} from '../../../utils/equipmentListCore';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

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

const PLAN_STATUS_COLORS: Record<string, string> = {
  草稿: 'default',
  已发布: 'blue',
  执行中: 'processing',
  已完成: 'success',
  已取消: 'error',
};

const EXECUTABLE_PLAN_STATUSES = new Set(['草稿', '已发布', '执行中']);

function buildMaintenancePlanSubmitPayload(values: Record<string, unknown>) {
  return {
    plan_name: values.plan_name,
    plan_type: values.plan_type,
    equipment_uuid: values.equipment_uuid,
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

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
    }
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderPlanRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

interface MaintenancePlan {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  plan_no?: string;
  plan_name?: string;
  plan_type?: string;
  equipment_uuid?: string;
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
  created_at?: string;
  updated_at?: string;
}

const MaintenancePlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const planDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑维护计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<MaintenancePlan | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [planDetail, setPlanDetail] = useState<MaintenancePlan | null>(null);

  const [planTrackingRefreshKey, setPlanTrackingRefreshKey] = useState(0);

  const planTracking = useDocumentTracking(
    drawerVisible && planDetail?.id ? 'maintenance_plan' : undefined,
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
  const [executedItems, setExecutedItems] = useState<Array<{ item_id?: number; item_name?: string; done?: boolean }>>([]);
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
        equipment_uuid: detail.equipment_uuid,
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
  const handleDetail = async (record: MaintenancePlan) => {
    try {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }
      const detail = await maintenancePlanApi.get(record.uuid);
      setPlanDetail(detail);
      setDrawerVisible(true);
      setPlanTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error(t(`${P}.detailFailed`));
    }
  };

  /**
   * 处理批量删除维护计划（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t(`${P}.batchDeleteTitle`),
      content: t(`${P}.batchDeleteContent`, { count: keys.length }),
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await maintenancePlanApi.delete(String(uuid));
          }
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          if (planDetail?.uuid && keys.map(String).includes(String(planDetail.uuid))) {
            setDrawerVisible(false);
            setPlanDetail(null);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
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
    if (!record.uuid || !record.equipment_uuid) {
      messageApi.error(t(`${P}.incompleteInfo`));
      return;
    }
    setExecutePlan(record);
    setExecutedItems([]);
    setSparePartLines([]);
    setExecuteFormInitialValues({
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
    if (!executePlan?.uuid || !executePlan?.equipment_uuid) return;
    setExecuteSubmitting(true);
    try {
      const validParts = sparePartLines.filter((l) => l.spare_part_id && l.quantity);
      await maintenancePlanApi.execute({
        equipment_uuid: executePlan.equipment_uuid,
        maintenance_plan_uuid: executePlan.uuid,
        maintenance_scheme_id: values.maintenance_scheme_id,
        executed_items: executedItems.filter((i) => i.done),
        execution_date:
          toApiDateTimeString(values.execution_date) ??
          new Date().toISOString().slice(0, 19).replace('T', ' '),
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
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }}>{r.equipment_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentName`),
      dataIndex: 'equipment_name',
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
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const key = status ? PLAN_STATUS_KEYS[status] : undefined;
        const text = key ? t(key) : (status || '-');
        const color = status ? (PLAN_STATUS_COLORS[status] || 'default') : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: t(`${P}.col.createdAt`),
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
      <Button {...rowActionKind('delete')}
        key="del"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          Modal.confirm({
            title: t(`${P}.deleteTitle`),
            content: t(`${P}.deleteContent`, { name: record.plan_name }),
            onOk: () => record.uuid && handleDelete([record.uuid]),
          });
        }}
      >
        {t('common.delete')}
      </Button>,
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
      title: t(`${P}.col.status`),
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
      width: 140,
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
      width: 200,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${P}.col.planType`),
      dataIndex: 'plan_type',
      width: 120,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${P}.col.equipmentCode`),
      dataIndex: 'equipment_code',
      width: 140,
      hideInSearch: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }} ellipsis>
          {r.equipment_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentName`),
      dataIndex: 'equipment_name',
      width: 200,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${P}.col.maintenanceType`),
      dataIndex: 'maintenance_type',
      width: 120,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${P}.col.maintenanceCycle`),
      dataIndex: 'cycle_value',
      width: 120,
      hideInSearch: true,
      render: (_, record) =>
        record ? `${record.cycle_value ?? ''} ${record.cycle_unit ?? ''}`.trim() || '-' : '-',
    },
    {
      title: t(`${P}.col.plannedStartDate`),
      dataIndex: 'planned_start_date',
      valueType: 'date',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t(`${P}.col.lifecycle`),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getMaintenancePlanLifecycle(record as Record<string, unknown>, t)} />
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderPlanRowActions(renderPlanRowNodes(record), `mpl-${record.uuid ?? 'row'}`),
    },
  ], SALES_DOC_LIST_FIELD_RANK), [t, planStatusValueEnum]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaintenancePlan>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-plans"
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
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          scroll={{ x: 1900 }}
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
          <Col span={12}>
            <ProFormSelect
              name="equipment_uuid"
              label={t(`${P}.form.equipment`)}
              placeholder={t(`${P}.form.selectEquipment`)}
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
        </Row>
        <Row gutter={16}>
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
              label={t(`${P}.col.status`)}
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
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {executedItems.map((item, index) => (
                  <Checkbox
                    key={item.item_id ?? index}
                    checked={item.done}
                    onChange={(e) => {
                      const next = [...executedItems];
                      next[index] = { ...next[index], done: e.target.checked };
                      setExecutedItems(next);
                    }}
                  >
                    {item.item_name ?? `#${item.item_id}`}
                  </Checkbox>
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
                  title: t(`${P}.form.sparePartQty`),
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
        open={drawerVisible}
        zIndex={planDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setPlanDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={planDetail || undefined}
        customContent={
          planDetail ? (
            <>
              <DetailDrawerSection title={t(`${P}.section.basicInfo`)}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(planDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.lifecycle`)}>
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
                  {planDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='maintenance_plan'
                      documentId={planDetail.id}
                      active={drawerVisible}
                      selfDocumentId={planDetail.id}
                      renderBriefActions={(doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false);
                      setPlanDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.detailInfo`)}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noDetailLines`)} />
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.operationHistory`)}>
                {planTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {planTracking.error && !planTracking.loading && (
                  <Typography.Text type="danger">{planTracking.error}</Typography.Text>
                )}
                {planTracking.data && !planTracking.loading && (
                  <DocumentTrackingTimelineBody data={planTracking.data} />
                )}
                {!planTracking.loading && !planTracking.data && !planTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noOperationRecords`)} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </>
  );
};

export default MaintenancePlansPage;

