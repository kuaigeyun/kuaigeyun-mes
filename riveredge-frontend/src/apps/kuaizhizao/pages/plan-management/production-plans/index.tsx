/**
 * 生产计划页面
 *
 * 提供生产计划的管理、查看和执行功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ModalForm, ProFormText, ProFormDateRangePicker, ProFormList, ProFormGroup, ProFormDigit, ProFormDatePicker, ProFormItem, ProFormInstance } from '@ant-design/pro-components';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Table, theme } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DetailDrawerActions,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { planningApi } from '../../../services/production';
import { getProductionPlanLifecycle } from '../../../utils/productionPlanLifecycle';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { DetailLifecycleCollaborationBlock } from '../../../../../components/uni-audit/DetailAuditPhaseRow';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { apiRequest } from '../../../../../services/api';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { materialApi } from '../../../../master-data/services/material';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import ProductionControlTower from './ProductionControlTower';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { batchImport } from '../../../../../utils/batchOperations';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import {
  productionPlanBatchExecuteAllowed,
  productionPlanBatchPushWorkOrderAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

const PRODUCTION_PLAN_RESOURCE = 'production-plan';

// 生产计划接口定义
interface ProductionPlan {
  id?: number;
  tenant_id?: number;
  plan_code?: string;
  plan_name?: string;
  plan_type?: string; // 统一为 MRP；MTS/MTO 见来源需求计算或销售订单
  status?: string;
  execution_status?: string;
  plan_start_date?: string;
  plan_end_date?: string;
  total_work_orders?: number;
  total_purchase_orders?: number;
  reviewer_name?: string;
  review_time?: string;
  created_by_name?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: ProductionPlanItem[];
  source_type?: string;
  source_id?: number;
  source_code?: string;
  plan_status?: string;
  needs_recompute?: boolean;
  total_cost?: number;
  reviewer_id?: number;
  review_status?: string;
  review_remarks?: string;
  capabilities?: {
    update?: { allowed: boolean; reason?: string | null };
    delete?: { allowed: boolean; reason?: string | null };
    submit?: { allowed: boolean; reason?: string | null };
    withdraw_submit?: { allowed: boolean; reason?: string | null };
    approve?: { allowed: boolean; reason?: string | null };
    revoke_approval?: { allowed: boolean; reason?: string | null };
    execute?: { allowed: boolean; reason?: string | null };
    push_work_order?: { allowed: boolean; reason?: string | null };
  };
}

const PRODUCTION_PLAN_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_production_plans';

interface ProductionPlanItem {
  id?: number;
  tenant_id?: number;
  plan_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  planned_quantity?: number;
  unit?: string;
  planned_date?: string;
  suggested_action?: string; // 生产/采购
  available_inventory?: number;
  gross_requirement?: number;
  net_requirement?: number;
  work_order_quantity?: number;
  purchase_order_quantity?: number;
  lead_time?: number;
  execution_status?: string;
  work_order_id?: number;
  work_order_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  notes?: string;
}

const { useToken } = theme;

const ProductionPlansPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const pushToWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'work_order.pull_from_production_plan');

  const planTypeFallback = useMemo(
    () => [
      { label: t('app.kuaizhizao.productionPlan.planType.mrp'), value: 'MRP' },
      { label: t('app.kuaizhizao.productionPlan.planType.lrp'), value: 'LRP' },
      { label: t('app.kuaizhizao.productionPlan.planType.manual'), value: 'MANUAL' },
    ],
    [t],
  );

  const productionPlanStatusLabels = useMemo(
    () => ({
      草稿: t('app.kuaizhizao.productionPlan.statusDraft'),
      已审核: t('app.kuaizhizao.productionPlan.statusApproved'),
      已执行: t('app.kuaizhizao.productionPlan.statusExecuted'),
      已取消: t('app.kuaizhizao.productionPlan.statusCancelled'),
      已驳回: t('app.kuaizhizao.productionPlan.statusRejected'),
    }),
    [t],
  );

  const resolveProductionPlanStatusLabel = useCallback(
    (status: string | undefined, fallbackKey: 'statusDraft' | 'executionNotExecuted' = 'statusDraft') =>
      (status && productionPlanStatusLabels[status as keyof typeof productionPlanStatusLabels]) ||
      status ||
      t(`app.kuaizhizao.productionPlan.${fallbackKey}`),
    [productionPlanStatusLabels, t],
  );

  const productionPlanImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'plan_code', labelKey: 'app.kuaizhizao.productionPlan.import.planCode', aliases: ['计划编号'] },
          { field: 'plan_name', required: true, labelKey: 'app.kuaizhizao.productionPlan.import.planName', aliases: ['计划名称'] },
          { field: 'plan_type', labelKey: 'app.kuaizhizao.productionPlan.import.planType', aliases: ['计划类型'] },
          { field: 'start', labelKey: 'app.kuaizhizao.productionPlan.import.startDate', aliases: ['开始日期'] },
          { field: 'end', labelKey: 'app.kuaizhizao.productionPlan.import.endDate', aliases: ['结束日期'] },
          {
            field: 'material_code',
            required: true,
            labelKey: 'app.kuaizhizao.productionPlan.import.materialCode',
            aliases: ['物料编号', '物料'],
          },
          { field: 'quantity', required: true, labelKey: 'app.kuaizhizao.productionPlan.import.quantity', aliases: ['数量'] },
          { field: 'unit', labelKey: 'app.kuaizhizao.productionPlan.import.unit', aliases: ['单位'] },
        ],
        [
          t('app.kuaizhizao.productionPlan.importExample.planCode'),
          t('app.kuaizhizao.productionPlan.importExample.planName'),
          t('app.kuaizhizao.productionPlan.importExample.planType'),
          t('app.kuaizhizao.productionPlan.importExample.startDate'),
          t('app.kuaizhizao.productionPlan.importExample.endDate'),
          t('app.kuaizhizao.productionPlan.importExample.materialCode'),
          t('app.kuaizhizao.productionPlan.importExample.quantity'),
          t('app.kuaizhizao.productionPlan.importExample.unit'),
        ],
      ),
    [t, i18n.language],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const productionPlanPerms = useResourcePermissions(PRODUCTION_PLAN_RESOURCE);
  const productionPlanAuditRequired = useAuditRequired('production_plan', false);
  const productionPlanAuditColumn = useMemo(
    () => createListAuditPhaseColumn<ProductionPlan>({ t, auditEnabled: productionPlanAuditRequired }),
    [t, productionPlanAuditRequired],
  );
  const tableRowsRef = useRef<ProductionPlan[]>([]);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const invalidatePlanStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['productionPlanStatistics'] });
  };

  const selectedPlansForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ProductionPlan => row != null),
    [selectedRowKeys],
  );

  const productionPlanAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => planningApi.productionPlan.submit(String(id)),
      withdraw: (id: number) => planningApi.productionPlan.withdraw(String(id)),
      approve: (id: number) => planningApi.productionPlan.approve(String(id)),
    }),
    [],
  );

  const handleProductionPlanAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidatePlanStatistics();
    actionRef.current?.reload();
  }, [queryClient]);

  const [planTypeOptions, setPlanTypeOptions] = useState<Array<{ label: string; value: string }>>(planTypeFallback);
  const [planTypeLoading, setPlanTypeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setPlanTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('PRODUCTION_PLAN_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPlanTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setPlanTypeOptions(planTypeFallback);
      } finally {
        setPlanTypeLoading(false);
      }
    };
    load();
  }, [planTypeFallback]);

  const { data: planStatistics } = useQuery({
    queryKey: ['productionPlanStatistics'],
    queryFn: () =>
      planningApi.productionPlan.getStatistics() as Promise<{
        total_count?: number;
        pending_execution_count?: number;
        executed_count?: number;
        overdue_plans_count?: number;
        pending_review_count?: number;
      }>,
  });

  const statCards: StatCard[] = useMemo(() => {
    const s = planStatistics;
    return [
      {
        title: t('app.kuaizhizao.productionPlan.statTotal'),
        value: s?.total_count ?? 0,
        prefix: <AppstoreOutlined />,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: t('app.kuaizhizao.productionPlan.statPendingExecution'),
        value: s?.pending_execution_count ?? 0,
        prefix: <ClockCircleOutlined />,
        valueStyle: { color: '#faad14' },
      },
      {
        title: t('app.kuaizhizao.productionPlan.statExecuted'),
        value: s?.executed_count ?? 0,
        prefix: <CheckCircleOutlined />,
        valueStyle: { color: '#52c41a' },
      },
      {
        title: t('app.kuaizhizao.productionPlan.statOverdue'),
        value: s?.overdue_plans_count ?? 0,
        prefix: <ExclamationCircleOutlined />,
        valueStyle: { color: '#ff4d4f' },
      },
    ];
  }, [planStatistics, t]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editingPlanSnapshot, setEditingPlanSnapshot] = useState<ProductionPlan | null>(null);
  const [currentPlan, setCurrentPlan] = useState<ProductionPlan | null>(null);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const createPlanFormRef = useRef<ProFormInstance>(null);

  const {
    customFields: productionPlanFormCustomFields,
    customFieldValues: productionPlanFormCustomFieldValues,
    extractFormValues: extractProductionPlanFormValues,
    saveCustomFieldValues: saveProductionPlanCustomFieldValues,
    loadFieldValues: loadProductionPlanFormFieldValues,
    resetFieldValues: resetProductionPlanFormFieldValues,
  } = useCustomFields({
    tableName: PRODUCTION_PLAN_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open: createModalVisible,
  });

  const {
    customFields: productionPlanListCustomFields,
    generateCustomFieldColumns: generateProductionPlanCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichProductionPlanRecordsWithCustomFields,
    customFieldValues: productionPlanDetailCustomFieldValues,
    loadFieldValuesForDetail: loadProductionPlanFieldValuesForDetail,
    resetDetailFieldValues: resetProductionPlanDetailFieldValues,
  } = useCustomFieldsForList<ProductionPlan>({ tableName: PRODUCTION_PLAN_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (productionPlanListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [productionPlanListCustomFields.length]);

  const productionPlanCustomFieldColumns = generateProductionPlanCustomFieldColumns();

  const appendProductionPlanItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = createPlanFormRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        planned_quantity: 1,
        planned_date: dayjs(),
      }));
      createPlanFormRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  // 表格列定义
  const columns: ProColumns<ProductionPlan>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.productionPlan.colPlanPrimary'),
      key: 'plan_code',
      dataIndex: 'plan_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.plan_name ?? '')}
          secondary={String(record.plan_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.productionPlan.import.planCode'),
      dataIndex: 'plan_code',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.productionPlan.import.planName'),
      dataIndex: 'plan_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.productionPlan.import.planType'),
      dataIndex: 'plan_type',
      width: 100,
      render: (type) => {
        const typeMap = {
          MRP: { text: t('app.kuaizhizao.productionPlan.planTypeForecast'), color: 'processing' },
          LRP: { text: t('app.kuaizhizao.productionPlan.planTypeLegacyOrder'), color: 'success' },
        };
        const config = typeMap[type as keyof typeof typeMap] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.productionPlan.colPlanPeriod'),
      dataIndex: 'plan_duration',
      width: 200,
      hideInSearch: true,
      render: (_, record) => `${record.plan_start_date} ~ ${record.plan_end_date}`,
    },
    ...(productionPlanAuditColumn ? [productionPlanAuditColumn] : []),
    {
      title: t('app.kuaizhizao.productionPlan.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      valueType: 'select',
      valueEnum: {
        草稿: { text: t('app.kuaizhizao.productionPlan.statusDraft') },
        已执行: { text: t('app.kuaizhizao.productionPlan.statusExecuted') },
        已取消: { text: t('app.kuaizhizao.productionPlan.statusCancelled') },
        已驳回: { text: t('app.kuaizhizao.productionPlan.statusRejected') },
      },
      render: (_: unknown, record: ProductionPlan) => {
        const lifecycle = getProductionPlanLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? t('app.kuaizhizao.productionPlan.statusDraft');
        const displayName = resolveProductionPlanStatusLabel(stageName);
        return <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{displayName}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.productionPlan.colCreatedBy'),
      dataIndex: 'created_by_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    ...productionPlanCustomFieldColumns,
    {
      title: t('common.actions'),
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            {t('common.detail')}
          </Button>
          <UniWorkflowActions
            record={record}
            entityName={t('app.kuaizhizao.productionPlan.entityName')}
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[]}
            pendingStatuses={['草稿']}
            approvedStatuses={['已审核']}
            rejectedStatuses={['已驳回']}
            theme="link"
            size="small"
            onSuccess={() => {
              invalidatePlanStatistics();
              actionRef.current?.reload();
              if (currentPlan?.id === record.id) {
                planningApi.productionPlan.get(record.id!.toString()).then(setCurrentPlan).catch(() => {});
              }
            }}
          />
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.execution_status === '已执行'}
          >
            {t('common.edit')}
          </Button>
          {record.execution_status !== '已执行' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
              style={{ color: '#1890ff' }}
            >
              {t('app.kuaizhizao.productionPlan.execute')}
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleDelete(record)}
            disabled={record.execution_status === '已执行'}
          >
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ], [t, productionPlanAuditColumn, productionPlanCustomFieldColumns, currentPlan?.id, resolveProductionPlanStatusLabel]);

  // 处理详情查看
  const handleDetail = async (record: ProductionPlan) => {
    try {
      const planDetail = await planningApi.productionPlan.get(record.id!.toString());
      const planItems = await planningApi.productionPlan.getItems(record.id!.toString());
      setCurrentPlan({ ...planDetail, items: planItems });
      setDetailDrawerVisible(true);
      if (record.id != null) {
        await loadProductionPlanFieldValuesForDetail(record.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.productionPlan.detailFailed'));
    }
  };

  // 处理执行
  const handleExecute = async (record: ProductionPlan) => {
    Modal.confirm({
      title: t('app.kuaizhizao.productionPlan.executeConfirmTitle'),
      content: t('app.kuaizhizao.productionPlan.executeConfirmContent', { name: record.plan_name }),
      onOk: async () => {
        try {
          await planningApi.productionPlan.execute(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.productionPlan.executeSuccess'));
          invalidatePlanStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.productionPlan.executeFailed'));
        }
      },
    });
  };

  // 处理编辑（表头与计划期间；明细行以下游工单/需求计算为准）
  const handleEdit = async (record: ProductionPlan) => {
    if (record.execution_status === '已执行') {
      messageApi.warning(t('app.kuaizhizao.productionPlan.cannotEditExecuted'));
      return;
    }
    try {
      const planDetail = await planningApi.productionPlan.get(record.id!.toString());
      const planItems = await planningApi.productionPlan.getItems(record.id!.toString());
      setEditingPlanId(record.id!);
      setEditingPlanSnapshot({ ...planDetail, items: planItems });
      setCreateModalVisible(true);
      setTimeout(async () => {
        const baseValues = {
          plan_name: planDetail.plan_name,
          plan_type: planDetail.plan_type,
          dateRange: [dayjs(planDetail.plan_start_date), dayjs(planDetail.plan_end_date)],
          items: (planItems || []).map((it: ProductionPlanItem) => ({
            material_code: it.material_code,
            material_name: it.material_name,
            planned_quantity: it.planned_quantity,
            planned_date: it.planned_date ? dayjs(it.planned_date) : undefined,
          })),
        };
        if (record.id != null) {
          const customFormValues = await loadProductionPlanFormFieldValues(record.id);
          createPlanFormRef.current?.setFieldsValue({ ...baseValues, ...customFormValues });
        } else {
          createPlanFormRef.current?.setFieldsValue(baseValues);
        }
      }, 0);
    } catch {
      messageApi.error(t('app.kuaizhizao.productionPlan.loadFailed'));
    }
  };

  // 处理删除
  const handleDelete = async (record: ProductionPlan) => {
    Modal.confirm({
      title: t('app.kuaizhizao.productionPlan.deleteConfirmTitle'),
      content: t('app.kuaizhizao.productionPlan.deleteConfirmContent', { code: record.plan_code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await planningApi.productionPlan.delete(record.id!.toString());
          messageApi.success(t('common.deleteSuccess'));
          invalidatePlanStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || t('common.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const k of keys) {
        await planningApi.productionPlan.delete(String(k));
      }
      messageApi.success(t('app.kuaizhizao.productionPlan.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      invalidatePlanStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || t('common.batchDeleteFailed'));
    }
  };

  const handleListImport = async (data: any[][]) => {
    const defaultUnit = t('app.kuaizhizao.productionPlan.defaultUnit');
    if (!data || data.length < 2) {
      messageApi.warning(t('app.kuaizhizao.productionPlan.importDataInvalid'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      productionPlanImportTemplate.importHeaderMap,
    );
    if (headerIndexMap.plan_name === undefined) {
      messageApi.error(t('app.kuaizhizao.productionPlan.importHeaderPlanNameRequired'));
      return;
    }
    if (headerIndexMap.material_code === undefined || headerIndexMap.quantity === undefined) {
      messageApi.error(t('app.kuaizhizao.productionPlan.importHeaderMaterialQtyRequired'));
      return;
    }
    const getVal = (row: any[], key: string) => {
      const idx = headerIndexMap[key];
      if (idx === undefined) return '';
      const v = row[idx];
      return v != null ? String(v).trim() : '';
    };
    const grouped = new Map<string, { plan_name: string; plan_type: string; start: string; end: string; items: { material_code: string; quantity: number; unit: string }[] }>();
    const importRows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));
    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      if (!row || row.every((c: any) => (c == null || String(c).trim() === ''))) continue;
      const planCode = getVal(row, 'plan_code') || `PLAN-IMPORT-${i + 3}`;
      const planName = getVal(row, 'plan_name');
      const materialCode = getVal(row, 'material_code');
      const qty = Number(getVal(row, 'quantity')) || 0;
      if (!planName || !materialCode || qty <= 0) continue;
      const entry = grouped.get(planCode);
      const item = { material_code: materialCode, quantity: qty, unit: getVal(row, 'unit') || defaultUnit };
      if (!entry) {
        grouped.set(planCode, {
          plan_name: planName,
          plan_type: getVal(row, 'plan_type') || 'MANUAL',
          start: getVal(row, 'start'),
          end: getVal(row, 'end'),
          items: [item],
        });
      } else {
        entry.items.push(item);
      }
    }
    const toImport = Array.from(grouped.entries()).map(([code, v]) => ({
      plan_code: code,
      plan_name: v.plan_name,
      plan_type: v.plan_type,
      plan_start_date: v.start || undefined,
      plan_end_date: v.end || undefined,
      items: v.items,
    }));
    if (toImport.length === 0) {
      messageApi.warning(t('app.kuaizhizao.productionPlan.noValidImportData'));
      return;
    }
    const matRes = await materialApi.list({ limit: 5000, isActive: true });
    const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.items ?? [];
    const items = toImport.map((t) => ({
      ...t,
      items: t.items.map((it) => {
        const mat = matList.find((m: any) => (m.code || m.material_code || '').toString().trim() === (it.material_code || '').trim());
        return {
          material_id: mat?.id ?? mat?.material_id,
          material_code: it.material_code,
          material_name: mat?.name || mat?.material_name || '',
          planned_quantity: it.quantity,
          unit: it.unit || mat?.unit || mat?.material_unit || defaultUnit,
          suggested_action: '生产',
        };
      }).filter((it) => it.material_id || it.material_code),
    })).filter((t) => t.items.length > 0);
    if (items.length === 0) {
      messageApi.warning(t('app.kuaizhizao.productionPlan.noMatchedMaterialData'));
      return;
    }
    const result = await batchImport({
      items,
      importFn: async (item: any) =>
        planningApi.productionPlan.create({
          plan_code: item.plan_code,
          plan_name: item.plan_name,
          plan_type: item.plan_type || 'MANUAL',
          plan_start_date: item.plan_start_date,
          plan_end_date: item.plan_end_date,
          source_type: 'Manual',
          items: item.items,
        }),
      title: t('app.kuaizhizao.productionPlan.importTitle'),
      concurrency: 5,
    });
    if (result.successCount > 0) {
      messageApi.success(t('app.kuaizhizao.productionPlan.importSuccess', { count: result.successCount }));
      invalidatePlanStatistics();
      actionRef.current?.reload();
    }
    if (result.failureCount > 0) {
      messageApi.warning(t('app.kuaizhizao.productionPlan.importPartialFailed', { count: result.failureCount }));
    }
  };

  const planItemDetailColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.productionPlan.import.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.productionPlan.import.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.productionPlan.plannedQuantity'), dataIndex: 'planned_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.productionPlan.import.unit'), dataIndex: 'unit', width: 60 },
      {
        title: t('app.kuaizhizao.productionPlan.colSchedulingSuggestion'),
        dataIndex: 'planned_date',
        width: 140,
        render: (date: string, record: ProductionPlanItem) => (
          <div>
            <div>{date}</div>
            {record.planned_quantity && record.planned_quantity > 150 && (
              <div style={{ color: '#ff4d4f', fontSize: 12 }}>
                {t('app.kuaizhizao.productionPlan.suggestPostpone', { date: '02-16' })}
              </div>
            )}
          </div>
        ),
      },
      {
        title: t('app.kuaizhizao.productionPlan.colExecutionStatus'),
        dataIndex: 'execution_status',
        width: 100,
        render: (status: string) => (
          <Tag color={status === '已执行' ? 'green' : 'default'}>
            {resolveProductionPlanStatusLabel(status, 'executionNotExecuted')}
          </Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.productionPlan.colRelatedDoc'),
        dataIndex: 'work_order_id',
        width: 150,
        render: (woId: number, record: ProductionPlanItem) => {
          if (record.suggested_action === '生产' && woId) {
            return (
              <a onClick={() => messageApi.info(t('app.kuaizhizao.productionPlan.navigateWorkOrder', { id: woId }))}>
                {record.work_order_code || t('app.kuaizhizao.productionPlan.workOrderPrefix', { id: woId })}
              </a>
            );
          }
          return '-';
        },
      },
    ],
    [t, messageApi, resolveProductionPlanStatusLabel],
  );

  return (
    <ListPageTemplate statCards={statCards}>
      <div style={{ marginBottom: 16 }}>
        <ProductionControlTower />
      </div>
      <UniTable
          columnPersistenceId="apps.kuaizhizao.pages.plan-management.production-plans"
          headerTitle={t('app.kuaizhizao.productionPlan.title')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('app.kuaizhizao.productionPlan.create')}
          onCreate={() => {
            setEditingPlanId(null);
            setEditingPlanSnapshot(null);
            setCreateModalVisible(true);
          }}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.productionPlan.confirmBatchDelete', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="production-plan-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedPlansForBatch}
              auditEnabled={productionPlanAuditRequired}
              permGates={productionPlanPerms}
              handlers={productionPlanAuditBatchHandlers}
              onSuccess={handleProductionPlanAuditBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="production-plan-batch-execute"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedPlansForBatch}
              capabilityKey="execute"
              permAllowed={productionPlanPerms.canAction?.('execute') ?? false}
              batchAllowed={(recs, perm) => productionPlanBatchExecuteAllowed(recs, perm)}
              onRun={(id) => planningApi.productionPlan.execute(String(id))}
              labels={{
                single: t('app.kuaizhizao.productionPlan.batchExecute'),
                batch: t('app.kuaizhizao.productionPlan.batchExecute'),
              }}
              icon={<PlayCircleOutlined />}
              size="middle"
              onSuccess={handleProductionPlanAuditBatchSuccess}
            />,
            <UniCapabilityBatchButton
              key="production-plan-batch-push-wo"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedPlansForBatch}
              capabilityKey="push_work_order"
              permAllowed={productionPlanPerms.canAction?.('execute') ?? false}
              batchAllowed={(recs, perm) => productionPlanBatchPushWorkOrderAllowed(recs, perm)}
              onRun={(id) => planningApi.productionPlan.pushToWorkOrders(id)}
              labels={{
                single: pushToWorkOrderAction.label,
                batch: pushToWorkOrderAction.label,
              }}
              icon={<AppstoreOutlined />}
              size="middle"
              onSuccess={handleProductionPlanAuditBatchSuccess}
            />,
          ]}
          showImportButton
          onImport={handleListImport}
          importHeaders={productionPlanImportTemplate.importHeaders}
          importExampleRow={productionPlanImportTemplate.importExampleRow}
          importFieldMap={productionPlanImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await planningApi.productionPlan.list({ skip: 0, limit: 10000 });
              let items = Array.isArray(res) ? res : ((res as any)?.data || []);
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: ProductionPlan) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `production-plans-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            const list = await planningApi.productionPlan.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              plan_type: params.plan_type,
              status: params.status,
              plan_code: params.plan_code,
            });
            const raw = Array.isArray(list) ? list : ((list as any)?.data || []);
            const data = await enrichProductionPlanRecordsWithCustomFields(raw);
            tableRowsRef.current = data;
            const total = (list as any)?.total ?? (Array.isArray(list) && list.length >= params.pageSize! ? (params.current! * params.pageSize! + 1) : (params.current! - 1) * params.pageSize! + data.length);
            return { data, success: true, total };
          }}
          scroll={{ x: 1200 }}
        />

      <ModalForm
        title={editingPlanId ? t('app.kuaizhizao.productionPlan.editTitle') : t('app.kuaizhizao.productionPlan.createTitle')}
        open={createModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPlanId(null);
            setEditingPlanSnapshot(null);
            resetProductionPlanFormFieldValues();
          }
          setCreateModalVisible(open);
        }}
        formRef={createPlanFormRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
        onFinish={async (values) => {
          try {
            const { standardValues, customData } = extractProductionPlanFormValues(values);
            const [start, end] = standardValues.dateRange || [];
            const plan_start_date = start?.format ? start.format('YYYY-MM-DD') : start;
            const plan_end_date = end?.format ? end.format('YYYY-MM-DD') : end;
            if (editingPlanId != null && editingPlanSnapshot) {
              const snap = editingPlanSnapshot;
              await planningApi.productionPlan.update(editingPlanId.toString(), {
                plan_name: standardValues.plan_name,
                plan_type: standardValues.plan_type ?? snap.plan_type,
                plan_start_date,
                plan_end_date,
                source_type: snap.source_type ?? 'Manual',
                source_id: snap.source_id ?? undefined,
                source_code: snap.source_code ?? undefined,
                status: snap.status ?? '草稿',
                execution_status: snap.execution_status ?? '未执行',
                plan_status: snap.plan_status ?? 'draft',
                needs_recompute: snap.needs_recompute ?? false,
                total_work_orders: snap.total_work_orders ?? 0,
                total_purchase_orders: snap.total_purchase_orders ?? 0,
                total_cost: snap.total_cost ?? 0,
                reviewer_id: snap.reviewer_id ?? undefined,
                reviewer_name: snap.reviewer_name ?? undefined,
                review_time: snap.review_time ?? undefined,
                review_status: snap.review_status ?? '待审核',
                review_remarks: snap.review_remarks ?? undefined,
                notes: snap.notes ?? undefined,
              });
              if (Object.keys(customData).length > 0) {
                await saveProductionPlanCustomFieldValues(editingPlanId, customData);
              }
              messageApi.success(t('app.kuaizhizao.productionPlan.updateSuccess'));
            } else {
              const payload = {
                ...standardValues,
                plan_start_date,
                plan_end_date,
                source_type: 'Manual',
                items:
                  standardValues.items?.map((item: any) => ({
                    ...item,
                    suggested_action: '生产',
                  })) || [],
              };
              const created = await planningApi.productionPlan.create(payload);
              const recordId = Number((created as { id?: number })?.id ?? 0);
              if (recordId > 0 && Object.keys(customData).length > 0) {
                await saveProductionPlanCustomFieldValues(recordId, customData);
              }
              messageApi.success(t('app.kuaizhizao.productionPlan.createSuccess'));
            }
            resetProductionPlanFormFieldValues();
            invalidatePlanStatistics();
            actionRef.current?.reload();
            return true;
          } catch (error) {
            messageApi.error(editingPlanId ? t('app.kuaizhizao.productionPlan.updateFailed') : t('app.kuaizhizao.productionPlan.createFailed'));
            return false;
          }
        }}
      >
        <ProFormGroup title={t('app.kuaizhizao.productionPlan.basicInfo')}>
          <ProFormText name="plan_name" label={t('app.kuaizhizao.productionPlan.import.planName')} rules={[{ required: true }]} />
          <ProFormItem name="plan_type" label={t('app.kuaizhizao.productionPlan.import.planType')} initialValue="MANUAL">
            <UniDropdown
              placeholder={t('app.kuaizhizao.productionPlan.planTypePlaceholder')}
              showSearch
              allowClear
              loading={planTypeLoading}
              options={planTypeOptions}
              quickCreate={{ label: t('app.kuaizhizao.productionPlan.dataDictionaryManage'), onClick: () => navigate('/system/data-dictionaries') }}
            />
          </ProFormItem>
          <ProFormDateRangePicker name="dateRange" label={t('app.kuaizhizao.productionPlan.colPlanPeriod')} rules={[{ required: true }]} />
        </ProFormGroup>
        <CustomFieldsFormSection
          customFields={productionPlanFormCustomFields}
          customFieldValues={productionPlanFormCustomFieldValues}
          gridColumns={2}
        />
        <div className="uni-table-detail">
          <UniTableDetailHeader title={t('app.kuaizhizao.productionPlan.planItems')} />
          <ProFormList
            name="items"
            copyIconProps={false}
            creatorButtonProps={{
              creatorButtonText: t('app.kuaizhizao.productionPlan.addMaterial'),
            }}
          >
            <ProFormGroup>
              <ProFormText name="material_code" label={t('app.kuaizhizao.productionPlan.import.materialCode')} width="sm" rules={[{ required: true }]} />
              <ProFormText name="material_name" label={t('app.kuaizhizao.productionPlan.import.materialName')} width="sm" rules={[{ required: true }]} />
              <ProFormDigit name="planned_quantity" label={t('app.kuaizhizao.productionPlan.plannedQuantity')} width="xs" rules={[{ required: true }]} />
              <ProFormItem name="planned_date" label={t('app.kuaizhizao.productionPlan.plannedDate')} rules={[{ required: true }]}>
                <FutureDatePicker getForm={() => createPlanFormRef.current} t={t} format="YYYY-MM-DD" />
              </ProFormItem>
            </ProFormGroup>
          </ProFormList>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
          <Button type="default" icon={<ShoppingOutlined />} onClick={() => setMaterialPickerOpen(true)}>
            {t('app.kuaizhizao.common.materialBatchSelect')}
          </Button>
        </div>
      </ModalForm>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendProductionPlanItemsFromMaterials}
      />

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.productionPlan.detailTitle', { code: currentPlan?.plan_code || '' })}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentPlan(null);
          resetProductionPlanDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        extra={
          currentPlan && currentPlan.execution_status !== '已执行' && (
            <Space>
              <UniWorkflowActions
                record={currentPlan}
                entityName={t('app.kuaizhizao.productionPlan.entityName')}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={[]}
                pendingStatuses={['草稿']}
                approvedStatuses={['已审核']}
                rejectedStatuses={['已驳回']}
                theme="default"
                size="small"
                onSuccess={() => {
                  invalidatePlanStatistics();
                  actionRef.current?.reload();
                  if (currentPlan?.id) {
                    planningApi.productionPlan
                      .get(currentPlan.id.toString())
                      .then(async (plan) => {
                        setCurrentPlan(plan);
                        await loadProductionPlanFieldValuesForDetail(currentPlan.id!);
                      })
                      .catch(() => {});
                  }
                }}
              />
              <DetailDrawerActions
                items={[
                  { key: 'edit', visible: currentPlan.status !== '已执行', render: () => <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setDetailDrawerVisible(false); handleEdit(currentPlan); }}>{t('common.edit')}</Button> },
                  { key: 'execute', visible: currentPlan.status === '已审核', render: () => <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(currentPlan)}>{t('app.kuaizhizao.productionPlan.executePlan')}</Button> },
                  { key: 'delete', visible: currentPlan.status !== '已执行', render: () => <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(currentPlan)}>{t('common.delete')}</Button> },
                ]}
              />
            </Space>
          )
        }
        customContent={
          currentPlan ? (
            <div style={{ padding: '16px 0' }}>
              <DetailDrawerSection title={t('app.kuaizhizao.productionPlan.basicInfo')}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>{t('app.kuaizhizao.productionPlan.labelPlanCode')}</strong>{currentPlan.plan_code}
                  </Col>
                  <Col span={12}>
                    <strong>{t('app.kuaizhizao.productionPlan.labelPlanName')}</strong>{currentPlan.plan_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}>
                    <strong>{t('app.kuaizhizao.productionPlan.labelPlanType')}</strong>
                    <Tag color={currentPlan.plan_type === 'MRP' ? 'processing' : 'success'}>
                      {currentPlan.plan_type === 'MRP'
                        ? t('app.kuaizhizao.productionPlan.planTypeForecast')
                        : t('app.kuaizhizao.productionPlan.planTypeOrder')}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <strong>{t('app.kuaizhizao.productionPlan.labelStatus')}</strong>
                    <Tag color={currentPlan.status === '已执行' ? 'success' : 'default'}>
                      {resolveProductionPlanStatusLabel(currentPlan.status)}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <strong>{t('app.kuaizhizao.productionPlan.labelCreatedBy')}</strong>{currentPlan.created_by_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>{t('app.kuaizhizao.productionPlan.labelPlanPeriod')}</strong>{currentPlan.plan_start_date} ~ {currentPlan.plan_end_date}
                  </Col>
                  <Col span={12}>
                    <strong>{t('app.kuaizhizao.productionPlan.labelCreatedAt')}</strong>{currentPlan.created_at}
                  </Col>
                </Row>
                {hasCustomFieldsDetailContent(
                  productionPlanListCustomFields,
                  productionPlanDetailCustomFieldValues,
                ) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={productionPlanListCustomFields}
                      customFieldValues={productionPlanDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {currentPlan.notes ? (
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>{t('app.kuaizhizao.productionPlan.labelNotes')}</strong>{currentPlan.notes}
                    </Col>
                  </Row>
                ) : null}
              </DetailDrawerSection>

              {/* 生命周期 */}
              {(() => {
                const lifecycle = getProductionPlanLifecycle(currentPlan);
                const mainStages = lifecycle.mainStages ?? [];
                if (mainStages.length === 0) return null;
                return (
                  <DetailDrawerSection title={t('app.kuaizhizao.productionPlan.colLifecycle')}>
                    <DetailLifecycleCollaborationBlock
                      record={currentPlan}
                      auditEnabled={productionPlanAuditRequired}
                    >
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                      />
                    </DetailLifecycleCollaborationBlock>
                  </DetailDrawerSection>
                );
              })()}

              {/* 3. 单据明细 */}
              {currentPlan.items && currentPlan.items.length > 0 && (
                <DetailDrawerSection title={t('app.kuaizhizao.productionPlan.planItems')}>
                  <Table
                    size="small"
                    columns={planItemDetailColumns}
                    dataSource={currentPlan.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
                </DetailDrawerSection>
              )}

              {/* 4. 操作记录 */}
              {currentPlan?.id && (
                <DetailDrawerSection title={t('app.kuaizhizao.productionPlan.operationHistory')}>
                  <DocumentTrackingPanel documentType="production_plan" documentId={currentPlan.id} />
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />
      
      <SyncFromDatasetModal
        title={t('app.kuaizhizao.productionPlan.syncFromDataset')}
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={async (rows) => {
          try {
            let successCount = 0;
            for (const row of rows) {
              const payload = {
                plan_code: row.plan_code || row.planCode,
                plan_name: row.plan_name || row.planName,
                plan_type: row.plan_type || row.planType || 'MRP',
                plan_start_date: row.plan_start_date || row.planStartDate,
                plan_end_date: row.plan_end_date || row.planEndDate,
                items: Array.isArray(row.items) ? row.items : [],
              };
              await planningApi.productionPlan.create(payload);
              successCount += 1;
            }
            messageApi.success(t('app.kuaizhizao.productionPlan.syncSuccess', { count: successCount }));
            setSyncModalVisible(false);
            invalidatePlanStatistics();
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error?.message || t('app.kuaizhizao.productionPlan.syncFailed'));
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default ProductionPlansPage;
