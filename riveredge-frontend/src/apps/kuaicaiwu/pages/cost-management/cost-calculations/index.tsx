/**
 * 成本核算页面
 *
 * 一级：核算台账 / 成本对比 / 成本分析 / 优化建议 / 分项试算；工单与产品核算从台账表格工具栏以弹窗执行。
 * URL：?cat=ledger | compare | analyze | optimization | trial；兼容旧 ?cat=analysis（及 sub=compare|analyze）、?tab=compare|analyze；兼容 ?cat=exec&sub=work_order|product、?tab=work_order|product（打开对应弹窗）。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormSelect,
  ProFormDigit,
  ProFormDatePicker,
  ProFormTextArea,
  ProForm,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Space,
  Tabs,
  Card,
  Statistic,
  Row,
  Col,
  Empty,
  Modal,
  Divider,
  Alert,
  Typography,
  Descriptions,
  Timeline,
} from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import {
  EyeOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  LineChartOutlined,
  ToolOutlined,
  TeamOutlined,
  ShoppingOutlined,
  SafetyCertificateOutlined,
  TableOutlined,
  ExperimentOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  MultiTabListPageTemplate,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { buildMasterDetailDescriptionItems } from '../../../utils/buildMasterDetailDescriptionItems';
import { getCostCalculationLifecycle } from '../../../utils/costLifecycle';
import { costCalculationApi, costComparisonApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import {
  loadWorkOrderSelectOptions,
  loadOutsourceWorkOrderSelectOptions,
  loadPurchaseOrderSelectOptions,
  loadPurchaseOrderItemSelectOptions,
  materialsToIdSelectOptions,
  normalizeCostListRows,
  type CostSelectOption,
} from '../costSelectData';
import ProductionCostPage from '../production-cost';
import OutsourceCostPage from '../outsource-cost';
import PurchaseCostPage from '../purchase-cost';
import QualityCostPage from '../quality-cost';
import CostOptimizationPanel from '../CostOptimizationPanel';
import { StructuredCostDataView } from '../../../../../components/structured-cost-data-view';
import {
  formatCalculationType,
  formatSourceType,
  formatVarianceType,
  getSourceTypeTag,
  getVarianceTypeTag,
} from '../../../utils/costUiLabels';
import { formatDateTime } from '../../../../../utils/format';

type TopCat = 'ledger' | 'compare' | 'analyze' | 'optimization' | 'trial';

const TRIAL_SUBS = ['production', 'outsource', 'purchase', 'quality'] as const;

type TrialSub = (typeof TRIAL_SUBS)[number];

function parseLocation(sp: URLSearchParams): { cat: TopCat; sub: string } {
  const cat = sp.get('cat');
  const sub = sp.get('sub') || '';
  const tab = sp.get('tab');

  if (cat === 'trial' && TRIAL_SUBS.includes(sub as TrialSub)) {
    return { cat: 'trial', sub };
  }
  if (tab === 'collection' && TRIAL_SUBS.includes(sub as TrialSub)) {
    return { cat: 'trial', sub };
  }
  if (tab && TRIAL_SUBS.includes(tab as TrialSub)) {
    return { cat: 'trial', sub: tab };
  }

  if (cat === 'compare') {
    return { cat: 'compare', sub: '' };
  }
  if (cat === 'analyze') {
    return { cat: 'analyze', sub: '' };
  }
  if (cat === 'optimization') {
    return { cat: 'optimization', sub: '' };
  }
  if (tab === 'optimization') {
    return { cat: 'optimization', sub: '' };
  }
  /* 兼容旧 URL：一级「差异与分析」及 sub */
  if (cat === 'analysis') {
    if (sub === 'analyze') return { cat: 'analyze', sub: '' };
    return { cat: 'compare', sub: '' };
  }
  if (tab === 'compare') {
    return { cat: 'compare', sub: '' };
  }
  if (tab === 'analyze') {
    return { cat: 'analyze', sub: '' };
  }

  if (cat === 'ledger') {
    return { cat: 'ledger', sub: '' };
  }
  if (tab === 'ledger') {
    return { cat: 'ledger', sub: '' };
  }

  /* 原「核算执行」一级 Tab 已并入台账工具栏；URL 仍兼容，归一为台账 */
  if (cat === 'exec') {
    return { cat: 'ledger', sub: '' };
  }
  if (tab === 'work_order' || tab === 'product') {
    return { cat: 'ledger', sub: '' };
  }

  return { cat: 'ledger', sub: '' };
}

/** 从 query 解析是否应打开工单/产品核算弹窗（与 parseLocation 分离，避免丢意图） */
function parseExecModalIntent(sp: URLSearchParams): 'work_order' | 'product' | null {
  const cat = sp.get('cat');
  const sub = sp.get('sub') || '';
  const tab = sp.get('tab');
  if (cat === 'exec') {
    if (sub === 'work_order') return 'work_order';
    if (sub === 'product') return 'product';
  }
  if (tab === 'work_order') return 'work_order';
  if (tab === 'product') return 'product';
  return null;
}

function defaultSubForCat(cat: TopCat, currentSub: string): string {
  if (cat === 'ledger' || cat === 'compare' || cat === 'analyze' || cat === 'optimization') return '';
  if (cat === 'trial') {
    return TRIAL_SUBS.includes(currentSub as TrialSub) ? currentSub : 'production';
  }
  return '';
}

interface CostCalculation {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  calculation_no?: string;
  calculation_type?: string;
  work_order_id?: number;
  work_order_code?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  material_cost?: number;
  labor_cost?: number;
  manufacturing_cost?: number;
  total_cost?: number;
  unit_cost?: number;
  cost_details?: any;
  calculation_date?: string;
  calculation_status?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
}

/** 与独立「成本对比」页 costComparisonApi.compare 返回结构一致 */
interface MaterialCostComparisonResult {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type: string;
  quantity: number;
  standard_cost: {
    total_cost: number;
    unit_cost: number;
    cost_details: any;
    calculation_type: string;
  };
  actual_cost: {
    total_cost: number;
    unit_cost: number;
    cost_details: any;
    calculation_type: string;
  };
  cost_variance: {
    total_cost_variance: number;
    total_cost_variance_rate: number;
    unit_cost_variance: number;
    unit_cost_variance_rate: number;
    variance_type: string;
  };
  calculation_date: string;
}

const CostCalculationPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cat: rawCat, sub: rawSub } = parseLocation(searchParams);
  const cat = rawCat;
  const sub = defaultSubForCat(cat, rawSub);
  const actionRef = useRef<ActionType>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [costCalculationDetail, setCostCalculationDetail] = useState<CostCalculation | null>(null);
  const [execModal, setExecModal] = useState<null | 'work_order' | 'product'>(null);

  const [compareData, setCompareData] = useState<any>(null);
  const [materialCompareList, setMaterialCompareList] = useState<any[]>([]);
  const [costReferenceOptions, setCostReferenceOptions] = useState<{
    workOrders: CostSelectOption[];
    outsourceWorkOrders: CostSelectOption[];
    purchaseOrders: CostSelectOption[];
    purchaseOrderItems: CostSelectOption[];
  }>({ workOrders: [], outsourceWorkOrders: [], purchaseOrders: [], purchaseOrderItems: [] });
  const [materialCompareResult, setMaterialCompareResult] = useState<MaterialCostComparisonResult | null>(null);
  const [materialCompareLoading, setMaterialCompareLoading] = useState(false);
  const [analyzeData, setAnalyzeData] = useState<any>(null);
  const [analyzeInnerTab, setAnalyzeInnerTab] = useState<string>('composition');

  const workOrderFormRef = useRef<any>(null);
  const productFormRef = useRef<any>(null);
  const compareFormRef = useRef<any>(null);
  const materialCompareFormRef = useRef<any>(null);
  const analyzeFormRef = useRef<any>(null);

  const setLedger = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const setCatWithSub = useCallback(
    (nextCat: TopCat, nextSub?: string) => {
      if (nextCat === 'ledger') {
        setLedger();
        return;
      }
      if (nextCat === 'compare' || nextCat === 'analyze' || nextCat === 'optimization') {
        setSearchParams({ cat: nextCat }, { replace: true });
        return;
      }
      const dSub = defaultSubForCat(nextCat, nextSub || '');
      setSearchParams({ cat: nextCat, sub: dSub }, { replace: true });
    },
    [setSearchParams, setLedger]
  );

  const setInnerSubOnly = useCallback(
    (nextSub: string) => {
      setSearchParams({ cat, sub: nextSub }, { replace: true });
    },
    [setSearchParams, cat]
  );

  useEffect(() => {
    const intent = parseExecModalIntent(searchParams);
    if (!intent) return;
    setExecModal(intent);
    setLedger();
  }, [searchParams, setLedger]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await materialApi.list({ limit: 1000, isActive: true });
        if (!cancelled) setMaterialCompareList(normalizeCostListRows(list));
      } catch (e) {
        console.error('加载物料列表失败:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wo, owo, po, poi] = await Promise.all([
          loadWorkOrderSelectOptions(400),
          loadOutsourceWorkOrderSelectOptions(400),
          loadPurchaseOrderSelectOptions(200),
          loadPurchaseOrderItemSelectOptions(32),
        ]);
        if (!cancelled) {
          setCostReferenceOptions({
            workOrders: wo,
            outsourceWorkOrders: owo,
            purchaseOrders: po,
            purchaseOrderItems: poi,
          });
        }
      } catch (e) {
        console.error('加载工单/采购/委外下拉数据失败:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productMaterialSelectOptions = useMemo(
    () => materialsToIdSelectOptions(materialCompareList),
    [materialCompareList]
  );

  useEffect(() => {
    if (execModal !== 'work_order') return;
    workOrderFormRef.current?.resetFields();
    workOrderFormRef.current?.setFieldsValue({ calculation_date: dayjs() });
  }, [execModal]);

  useEffect(() => {
    if (execModal !== 'product') return;
    productFormRef.current?.resetFields();
    productFormRef.current?.setFieldsValue({
      calculation_date: dayjs(),
      calculation_type: '标准成本',
    });
  }, [execModal]);

  const handleTopTabChange = (key: string) => {
    setCatWithSub(key as TopCat);
  };

  const handleDetail = async (record: CostCalculation) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaicaiwu.costCalculation.uuidMissing'));
        return;
      }
      const detail = await costCalculationApi.get(record.uuid);
      setCostCalculationDetail(detail);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCalculation.loadDetailFailed'));
    }
  };

  const handleSaveWorkOrderCalculation = async (values: any) => {
    try {
      await costCalculationApi.calculateWorkOrderCost({
        work_order_id: values.work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        remark: values.remark,
      });
      messageApi.success(t('app.kuaicaiwu.costCalculation.workOrderSuccess'));
      setExecModal(null);
      setLedger();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCalculation.workOrderFailed'));
    }
  };

  const handleSaveProductCalculation = async (values: any) => {
    try {
      await costCalculationApi.calculateProductCost({
        product_id: values.product_id,
        quantity: values.quantity,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        calculation_type: values.calculation_type,
        remark: values.remark,
      });
      messageApi.success(t('app.kuaicaiwu.costCalculation.productSuccess'));
      setExecModal(null);
      setLedger();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCalculation.productFailed'));
    }
  };

  const handleCompareQuery = async (values: any) => {
    try {
      const data = await costCalculationApi.compareCosts(values.product_id);
      setCompareData(data);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCalculation.compareQueryFailed'));
    }
  };

  const handleMaterialLevelCompare = async (values: any) => {
    try {
      setMaterialCompareLoading(true);
      const data = {
        material_id: values.material_id,
        quantity: values.quantity,
        work_order_id: values.work_order_id,
        purchase_order_id: values.purchase_order_id,
        purchase_order_item_id: values.purchase_order_item_id,
        outsource_work_order_id: values.outsource_work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
      };
      const result = await costComparisonApi.compare(data);
      setMaterialCompareResult(result);
      messageApi.success(t('app.kuaicaiwu.costComparison.compareSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costComparison.compareFailed'));
    } finally {
      setMaterialCompareLoading(false);
    }
  };

  const getMaterialCompareSourceTag = (sourceType: string) => getSourceTypeTag(sourceType, t);

  const handleAnalyzeQuery = async (values: any) => {
    try {
      const data = await costCalculationApi.analyzeCost(values.product_id);
      setAnalyzeData(data);
      setAnalyzeInnerTab('composition');
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCalculation.analyzeQueryFailed'));
    }
  };

  const calcTypeColor: Record<string, string> = {
    工单成本: 'blue',
    产品成本: 'green',
    标准成本: 'orange',
    实际成本: 'red',
  };

  const columns: ProColumns<CostCalculation>[] = useMemo(
    () => [
      {
        title: t('app.kuaicaiwu.costCalculation.col.calculationNo'),
        dataIndex: 'calculation_no',
        key: 'calculation_no',
        width: 150,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.calculation_no ?? '') }} ellipsis>
            {r.calculation_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaicaiwu.costCalculation.col.calculationType'),
        dataIndex: 'calculation_type',
        key: 'calculation_type',
        width: 120,
        render: (_, r) => {
          const text = r.calculation_type || '';
          return <Tag color={calcTypeColor[text] || 'default'}>{formatCalculationType(text, t)}</Tag>;
        },
      },
      {
        title: t('app.kuaicaiwu.costCalculation.col.workOrderCode'),
        dataIndex: 'work_order_code',
        key: 'work_order_code',
        width: 150,
        render: (_, r) =>
          r.work_order_code ? (
            <Typography.Text copyable={{ text: String(r.work_order_code) }} ellipsis>{r.work_order_code}</Typography.Text>
          ) : (
            '-'
          ),
      },
      {
        title: t('app.kuaicaiwu.costCalculation.col.productCode'),
        dataIndex: 'product_code',
        key: 'product_code',
        width: 150,
        render: (_, r) =>
          r.product_code ? (
            <Typography.Text copyable={{ text: String(r.product_code) }} ellipsis>{r.product_code}</Typography.Text>
          ) : (
            '-'
          ),
      },
      { title: t('app.kuaicaiwu.costCalculation.col.productName'), dataIndex: 'product_name', key: 'product_name', width: 200 },
      {
        title: t('app.kuaicaiwu.costCommon.col.quantity'),
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        render: (_, r) => (r.quantity != null ? Number(r.quantity).toFixed(2) : '0.00'),
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.materialCost'),
        dataIndex: 'material_cost',
        key: 'material_cost',
        width: 120,
        render: (_, r) => `¥${r.material_cost != null ? Number(r.material_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.laborCost'),
        dataIndex: 'labor_cost',
        key: 'labor_cost',
        width: 120,
        render: (_, r) => `¥${r.labor_cost != null ? Number(r.labor_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.manufacturingCost'),
        dataIndex: 'manufacturing_cost',
        key: 'manufacturing_cost',
        width: 120,
        render: (_, r) => `¥${r.manufacturing_cost != null ? Number(r.manufacturing_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.totalCost'),
        dataIndex: 'total_cost',
        key: 'total_cost',
        width: 120,
        render: (_, r) => `¥${r.total_cost != null ? Number(r.total_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.unitCost'),
        dataIndex: 'unit_cost',
        key: 'unit_cost',
        width: 120,
        render: (_, r) => `¥${r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.calculationDate'),
        dataIndex: 'calculation_date',
        key: 'calculation_date',
        width: 120,
        search: false,
        render: (_, r) => (r.calculation_date ? formatDateTime(r.calculation_date as string, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.updatedAt'),
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 180,
        search: false,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at as string, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaicaiwu.costCommon.section.lifecycle'),
        dataIndex: 'lifecycle_stage',
        key: 'lifecycle',
        width: 200,
        fixed: 'right',
        align: 'left',
        search: false,
        render: (_, record) => (
          <UniLifecycle {...getCostCalculationLifecycle(record as Record<string, unknown>, t)} showCircleTooltip={false} />
        ),
      },
      {
        title: t('app.kuaicaiwu.costCommon.action'),
        key: 'action',
        width: 100,
        fixed: 'right',
        render: (_: any, record: CostCalculation) => (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            {t('app.kuaicaiwu.costCommon.detail')}
          </Button>
        ),
      },
    ],
    [t],
  );

  const detailItems: ProDescriptionsItemProps<CostCalculation>[] = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costCalculation.col.calculationNo'), dataIndex: 'calculation_no' },
      {
        title: t('app.kuaicaiwu.costCalculation.col.calculationType'),
        dataIndex: 'calculation_type',
        render: (_, entity) => formatCalculationType(entity.calculation_type, t),
      },
      { title: t('app.kuaicaiwu.costCalculation.col.workOrderCode'), dataIndex: 'work_order_code' },
      { title: t('app.kuaicaiwu.costCalculation.col.productCode'), dataIndex: 'product_code' },
      { title: t('app.kuaicaiwu.costCalculation.col.productName'), dataIndex: 'product_name' },
      {
        title: t('app.kuaicaiwu.costCommon.col.quantity'),
        dataIndex: 'quantity',
        render: (_, entity) => (entity.quantity != null ? Number(entity.quantity).toFixed(2) : '0.00'),
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.materialCost'),
        dataIndex: 'material_cost',
        render: (_, entity) => `¥${entity.material_cost != null ? Number(entity.material_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.laborCost'),
        dataIndex: 'labor_cost',
        render: (_, entity) => `¥${entity.labor_cost != null ? Number(entity.labor_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.manufacturingCost'),
        dataIndex: 'manufacturing_cost',
        render: (_, entity) =>
          `¥${entity.manufacturing_cost != null ? Number(entity.manufacturing_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.totalCost'),
        dataIndex: 'total_cost',
        render: (_, entity) => `¥${entity.total_cost != null ? Number(entity.total_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.unitCost'),
        dataIndex: 'unit_cost',
        render: (_, entity) => `¥${entity.unit_cost != null ? Number(entity.unit_cost).toFixed(2) : '0.00'}`,
      },
      { title: t('app.kuaicaiwu.costCalculation.col.calculationStatus'), dataIndex: 'calculation_status' },
      {
        title: t('app.kuaicaiwu.costCommon.col.calculationDate'),
        dataIndex: 'calculation_date',
        render: (_, entity) =>
          entity.calculation_date ? formatDateTime(entity.calculation_date as string, 'YYYY-MM-DD') : '-',
      },
      { title: t('app.kuaicaiwu.costCommon.remark'), dataIndex: 'remark' },
      { title: t('app.kuaicaiwu.costCommon.col.createdBy'), dataIndex: 'created_by_name' },
      {
        title: t('app.kuaicaiwu.costCommon.col.createdAt'),
        dataIndex: 'created_at',
        render: (_, entity) =>
          entity.created_at ? formatDateTime(entity.created_at as string, 'YYYY-MM-DD HH:mm:ss') : '-',
      },
      { title: t('app.kuaicaiwu.costCommon.col.updatedBy'), dataIndex: 'updated_by_name' },
      {
        title: t('app.kuaicaiwu.costCommon.col.updatedAt'),
        dataIndex: 'updated_at',
        render: (_, entity) =>
          entity.updated_at ? formatDateTime(entity.updated_at as string, 'YYYY-MM-DD HH:mm:ss') : '-',
      },
    ],
    [t],
  );

  const calculationDetailBaseItems = detailItems;

  const closeWorkOrderModal = () => {
    setExecModal(null);
    workOrderFormRef.current?.resetFields();
  };

  const closeProductModal = () => {
    setExecModal(null);
    productFormRef.current?.resetFields();
  };

  const workOrderPanel = (
    <Card variant="borderless">
      <ProForm
        formRef={workOrderFormRef}
        onFinish={handleSaveWorkOrderCalculation}
        submitter={{
          searchConfig: { submitText: t('app.kuaicaiwu.costCalculation.calculate') },
          resetButtonProps: { style: { display: 'none' } },
        }}
      >
        <ProFormSelect
          name="work_order_id"
          label={t('app.kuaicaiwu.costCalculation.field.workOrder')}
          placeholder={t('app.kuaicaiwu.costCalculation.field.workOrderPlaceholder')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costCalculation.field.workOrderRequired') }]}
          options={costReferenceOptions.workOrders}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDatePicker name="calculation_date" label={t('app.kuaicaiwu.costCommon.col.calculationDate')} placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')} />
        <ProFormTextArea name="remark" label={t('app.kuaicaiwu.costCommon.remark')} placeholder={t('app.kuaicaiwu.costCommon.remarkPlaceholder')} fieldProps={{ rows: 3 }} />
      </ProForm>
    </Card>
  );

  const productPanel = (
    <Card variant="borderless">
      <ProForm
        formRef={productFormRef}
        onFinish={handleSaveProductCalculation}
        submitter={{
          searchConfig: { submitText: t('app.kuaicaiwu.costCalculation.calculate') },
          resetButtonProps: { style: { display: 'none' } },
        }}
      >
        <ProFormSelect
          name="product_id"
          label={t('app.kuaicaiwu.costCalculation.field.productMaterial')}
          placeholder={t('app.kuaicaiwu.costCalculation.field.productMaterialPlaceholder')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costCalculation.field.productRequired') }]}
          options={productMaterialSelectOptions}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDigit
          name="quantity"
          label={t('app.kuaicaiwu.costCommon.col.quantity')}
          placeholder={t('app.kuaicaiwu.costCommon.field.quantityPlaceholder')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.quantityRequired') }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="calculation_type"
          label={t('app.kuaicaiwu.costCalculation.col.calculationType')}
          placeholder={t('app.kuaicaiwu.costCalculation.field.calculationTypePlaceholder')}
          options={[
            { label: t('app.kuaicaiwu.costCommon.calculationType.standard'), value: '标准成本' },
            { label: t('app.kuaicaiwu.costCommon.calculationType.actual'), value: '实际成本' },
          ]}
          rules={[{ required: true, message: t('app.kuaicaiwu.costCalculation.field.calculationTypeRequired') }]}
        />
        <ProFormDatePicker name="calculation_date" label={t('app.kuaicaiwu.costCommon.col.calculationDate')} placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')} />
        <ProFormTextArea name="remark" label={t('app.kuaicaiwu.costCommon.remark')} placeholder={t('app.kuaicaiwu.costCommon.remarkPlaceholder')} fieldProps={{ rows: 3 }} />
      </ProForm>
    </Card>
  );

  const ledgerPanel = (
    <ListPageTemplate>
      <UniTable<CostCalculation>
        actionRef={actionRef}
        columnPersistenceId="apps.kuaicaiwu.pages.cost-management.cost-calculations"
        scroll={{ x: 'max-content' }}
        request={async (params) => {
          const response = await costCalculationApi.list(params);
          return {
            data: response.items || [],
            success: true,
            total: response.total || 0,
          };
        }}
        columns={columns}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarActions={[
          <Button
            key="work-order-cost"
            type="primary"
            icon={<CalculatorOutlined />}
            onClick={() => setExecModal('work_order')}
          >
            {t('app.kuaicaiwu.costCalculation.workOrderCalculate')}
          </Button>,
          <Button key="product-cost" icon={<CalculatorOutlined />} onClick={() => setExecModal('product')}>
            {t('app.kuaicaiwu.costCalculation.productCalculate')}
          </Button>,
        ]}
      />
      <Modal
        title={t('app.kuaicaiwu.costCalculation.workOrderModalTitle')}
        open={execModal === 'work_order'}
        onCancel={closeWorkOrderModal}
        footer={null}
        destroyOnHidden
        width={520}
        maskClosable={false}
      >
        {workOrderPanel}
      </Modal>
      <Modal
        title={t('app.kuaicaiwu.costCalculation.productModalTitle')}
        open={execModal === 'product'}
        onCancel={closeProductModal}
        footer={null}
        destroyOnHidden
        width={520}
        maskClosable={false}
      >
        {productPanel}
      </Modal>
      <DetailDrawerTemplate
        title={t('app.kuaicaiwu.costCalculation.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setCostCalculationDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          costCalculationDetail ? (
            <>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.basicInfo')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildMasterDetailDescriptionItems(
                    costCalculationDetail as Record<string, unknown>,
                    calculationDetailBaseItems as any,
                  )}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.lifecycle')}>
                <UniLifecycle
                  {...getCostCalculationLifecycle(costCalculationDetail as Record<string, unknown>, t)}
                  showCircleTooltip={false}
                />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {t('app.kuaicaiwu.costCalculation.lifecycleHint')}
                </Typography.Paragraph>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.details')}>
                <div style={{ maxHeight: 420, overflow: 'auto', minWidth: 320 }}>
                  {costCalculationDetail.cost_details ? (
                    <StructuredCostDataView data={costCalculationDetail.cost_details} />
                  ) : (
                    '-'
                  )}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.operationLog')}>
                <Timeline
                  items={[
                    {
                      color: 'green',
                      children: (
                        <>
                          {t('app.kuaicaiwu.costCommon.log.created')} ·{' '}
                          {costCalculationDetail.created_at
                            ? formatDateTime(costCalculationDetail.created_at, 'YYYY-MM-DD HH:mm:ss')
                            : '-'}
                          {costCalculationDetail.created_by_name ? ` · ${costCalculationDetail.created_by_name}` : ''}
                        </>
                      ),
                    },
                    {
                      color: 'blue',
                      children: (
                        <>
                          {t('app.kuaicaiwu.costCommon.log.updated')} ·{' '}
                          {costCalculationDetail.updated_at
                            ? formatDateTime(costCalculationDetail.updated_at, 'YYYY-MM-DD HH:mm:ss')
                            : '-'}
                          {costCalculationDetail.updated_by_name ? ` · ${costCalculationDetail.updated_by_name}` : ''}
                        </>
                      ),
                    },
                  ]}
                />
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </ListPageTemplate>
  );

  const comparePanel = (
    <div>
      <Tabs
        defaultActiveKey="by_product"
        destroyInactiveTabPane={false}
        items={[
          {
            key: 'by_product',
            label: t('app.kuaicaiwu.costCalculation.compareTab.byProduct'),
            children: (
              <div>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  {t('app.kuaicaiwu.costCalculation.compareByProductHint')}
                </Typography.Paragraph>
                <ProForm
                  formRef={compareFormRef}
                  onFinish={handleCompareQuery}
                  submitter={{
                    searchConfig: { submitText: t('app.kuaicaiwu.costCommon.query') },
                    resetButtonProps: { style: { display: 'none' } },
                  }}
                >
                  <ProFormSelect
                    name="product_id"
                    label={t('app.kuaicaiwu.costCalculation.field.productMaterial')}
                    placeholder={t('app.kuaicaiwu.costCalculation.field.productRequired')}
                    rules={[{ required: true, message: t('app.kuaicaiwu.costCalculation.field.productRequired') }]}
                    options={productMaterialSelectOptions}
                    showSearch
                    fieldProps={{
                      optionFilterProp: 'label',
                      filterOption: (input: string, option: any) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                    }}
                  />
                </ProForm>
                {compareData ? (
                  <Card title={t('app.kuaicaiwu.costCalculation.productCompareResult')} style={{ marginTop: 16 }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic title={t('app.kuaicaiwu.costCommon.standardCost')} value={compareData.standard_cost} prefix="¥" precision={2} />
                      </Col>
                      <Col span={12}>
                        <Statistic title={t('app.kuaicaiwu.costCommon.actualCost')} value={compareData.actual_cost} prefix="¥" precision={2} />
                      </Col>
                    </Row>
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      <Col span={12}>
                        <Statistic
                          title={t('app.kuaicaiwu.costCalculation.costDifference')}
                          value={compareData.cost_difference}
                          prefix="¥"
                          precision={2}
                          styles={{ content: {color: compareData.cost_difference > 0 ? '#cf1322' : '#3f8600' } }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title={t('app.kuaicaiwu.costCalculation.costDifferenceRate')}
                          value={compareData.cost_difference_rate}
                          suffix="%"
                          precision={2}
                          styles={{ content: {color: compareData.cost_difference_rate > 0 ? '#cf1322' : '#3f8600' } }}
                        />
                      </Col>
                    </Row>
                    <ProDescriptions
                      title={t('app.kuaicaiwu.costCalculation.costDetailDifference')}
                      bordered
                      style={{ marginTop: 16 }}
                      dataSource={{
                        material_cost_difference: `¥${compareData.material_cost_difference?.toFixed(2) || '0.00'}`,
                        labor_cost_difference: `¥${compareData.labor_cost_difference?.toFixed(2) || '0.00'}`,
                        manufacturing_cost_difference: `¥${compareData.manufacturing_cost_difference?.toFixed(2) || '0.00'}`,
                      }}
                      columns={[
                        { title: t('app.kuaicaiwu.costCalculation.materialCostDifference'), dataIndex: 'material_cost_difference' },
                        { title: t('app.kuaicaiwu.costCalculation.laborCostDifference'), dataIndex: 'labor_cost_difference' },
                        { title: t('app.kuaicaiwu.costCalculation.manufacturingCostDifference'), dataIndex: 'manufacturing_cost_difference' },
                      ]}
                    />
                    {compareData.difference_analysis && (
                      <div style={{ marginTop: 16 }}>
                        <strong>{t('app.kuaicaiwu.costCalculation.differenceAnalysis')}：</strong>
                        <p>{compareData.difference_analysis}</p>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('app.kuaicaiwu.costCalculation.compareByProductEmpty')}
                    style={{ margin: '32px 0' }}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'by_material',
            label: t('app.kuaicaiwu.costCalculation.compareTab.byMaterial'),
            children: (
              <div>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  {t('app.kuaicaiwu.costCalculation.compareByMaterialHint')}
                </Typography.Paragraph>
                <ProForm
                  formRef={materialCompareFormRef}
                  onFinish={handleMaterialLevelCompare}
                  submitter={{
                    searchConfig: { submitText: t('app.kuaicaiwu.costCommon.compare') },
                    resetButtonProps: { style: { display: 'none' } },
                    submitButtonProps: { loading: materialCompareLoading },
                  }}
                  initialValues={{ calculation_date: dayjs(), quantity: 1 }}
                >
                  <ProFormSelect
                    name="material_id"
                    label={t('app.kuaicaiwu.costCommon.field.material')}
                    placeholder={t('app.kuaicaiwu.costCommon.field.materialPlaceholder')}
                    rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.materialRequired') }]}
                    options={materialCompareList.map((m) => ({
                      label: `${m.mainCode || m.code} - ${m.name} (${formatSourceType(m.sourceType || m.source_type || 'Make', t)})`,
                      value: m.id,
                    }))}
                    fieldProps={{
                      showSearch: true,
                      filterOption: (input: string, option: any) =>
                        option?.label?.toLowerCase().includes(input.toLowerCase()),
                    }}
                  />
                  <ProFormDigit
                    name="quantity"
                    label={t('app.kuaicaiwu.costCommon.col.quantity')}
                    placeholder={t('app.kuaicaiwu.costComparison.field.quantityPlaceholder')}
                    rules={[
                      { required: true, message: t('app.kuaicaiwu.costCommon.field.quantityRequired') },
                      { type: 'number', min: 0.0001, message: t('app.kuaicaiwu.costCommon.field.quantityMin') },
                    ]}
                    fieldProps={{ precision: 4, style: { width: '100%' } }}
                  />
                  <ProFormSelect
                    name="work_order_id"
                    label={t('app.kuaicaiwu.costComparison.field.workOrder')}
                    placeholder={t('app.kuaicaiwu.costCommon.optional')}
                    allowClear
                    options={costReferenceOptions.workOrders}
                    showSearch
                    fieldProps={{
                      optionFilterProp: 'label',
                      filterOption: (input: string, option: any) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                    }}
                  />
                  <ProFormSelect
                    name="purchase_order_id"
                    label={t('app.kuaicaiwu.costComparison.field.purchaseOrder')}
                    placeholder={t('app.kuaicaiwu.costCommon.optional')}
                    allowClear
                    options={costReferenceOptions.purchaseOrders}
                    showSearch
                    fieldProps={{
                      optionFilterProp: 'label',
                      filterOption: (input: string, option: any) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                    }}
                  />
                  <ProFormSelect
                    name="purchase_order_item_id"
                    label={t('app.kuaicaiwu.costComparison.field.purchaseOrderItem')}
                    placeholder={t('app.kuaicaiwu.costCommon.optional')}
                    allowClear
                    options={costReferenceOptions.purchaseOrderItems}
                    showSearch
                    fieldProps={{
                      optionFilterProp: 'label',
                      filterOption: (input: string, option: any) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                    }}
                  />
                  <ProFormSelect
                    name="outsource_work_order_id"
                    label={t('app.kuaicaiwu.costComparison.field.outsourceWorkOrder')}
                    placeholder={t('app.kuaicaiwu.costCommon.optional')}
                    allowClear
                    options={costReferenceOptions.outsourceWorkOrders}
                    showSearch
                    fieldProps={{
                      optionFilterProp: 'label',
                      filterOption: (input: string, option: any) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                    }}
                  />
                  <ProFormDatePicker
                    name="calculation_date"
                    label={t('app.kuaicaiwu.costCommon.col.calculationDate')}
                    placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')}
                    fieldProps={{ style: { width: '100%' } }}
                  />
                </ProForm>
                {materialCompareResult ? (
                  <Card title={t('app.kuaicaiwu.costCalculation.materialCompareResult')} style={{ marginTop: 16 }} styles={{ body: { padding: 16 } }}>
                    <ProDescriptions
                      bordered
                      column={2}
                      style={{ marginBottom: 24 }}
                      dataSource={{
                        material_code: materialCompareResult.material_code,
                        material_name: materialCompareResult.material_name,
                        source_type: getMaterialCompareSourceTag(materialCompareResult.source_type),
                        quantity: materialCompareResult.quantity,
                      }}
                      columns={[
                        { title: t('app.kuaicaiwu.costCommon.col.materialCode'), dataIndex: 'material_code' },
                        { title: t('app.kuaicaiwu.costCommon.col.materialName'), dataIndex: 'material_name' },
                        { title: t('app.kuaicaiwu.costCommon.col.sourceType'), dataIndex: 'source_type' },
                        { title: t('app.kuaicaiwu.costCommon.col.quantity'), dataIndex: 'quantity' },
                      ]}
                    />

                    <Row gutter={16} style={{ marginBottom: 24 }}>
                      <Col span={12}>
                        <Card title={t('app.kuaicaiwu.costCommon.standardCost')} size="small">
                          <Statistic title={t('app.kuaicaiwu.costCommon.col.totalCost')} value={materialCompareResult.standard_cost.total_cost} prefix="¥" precision={2} />
                          <Divider style={{ margin: '12px 0' }} />
                          <Statistic title={t('app.kuaicaiwu.costCommon.col.unitCost')} value={materialCompareResult.standard_cost.unit_cost} prefix="¥" precision={2} />
                          <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                            {t('app.kuaicaiwu.costCommon.calculationTypeLabel', {
                              type: formatCalculationType(materialCompareResult.standard_cost.calculation_type, t),
                            })}
                          </div>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card title={t('app.kuaicaiwu.costCommon.actualCost')} size="small">
                          <Statistic title={t('app.kuaicaiwu.costCommon.col.totalCost')} value={materialCompareResult.actual_cost.total_cost} prefix="¥" precision={2} />
                          <Divider style={{ margin: '12px 0' }} />
                          <Statistic title={t('app.kuaicaiwu.costCommon.col.unitCost')} value={materialCompareResult.actual_cost.unit_cost} prefix="¥" precision={2} />
                          <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                            {t('app.kuaicaiwu.costCommon.calculationTypeLabel', {
                              type: formatCalculationType(materialCompareResult.actual_cost.calculation_type, t),
                            })}
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    <Card title={t('app.kuaicaiwu.costCalculation.costDifference')} style={{ marginBottom: 16 }}>
                      <Alert
                        message={formatVarianceType(materialCompareResult.cost_variance.variance_type, t)}
                        description={
                          <div>
                            <p>{t('app.kuaicaiwu.costComparison.totalVariance', { amount: materialCompareResult.cost_variance.total_cost_variance.toFixed(2) })}</p>
                            <p>{t('app.kuaicaiwu.costComparison.totalVarianceRate', { rate: materialCompareResult.cost_variance.total_cost_variance_rate.toFixed(2) })}</p>
                            <p>{t('app.kuaicaiwu.costComparison.unitVariance', { amount: materialCompareResult.cost_variance.unit_cost_variance.toFixed(2) })}</p>
                            <p>{t('app.kuaicaiwu.costComparison.unitVarianceRate', { rate: materialCompareResult.cost_variance.unit_cost_variance_rate.toFixed(2) })}</p>
                          </div>
                        }
                        type={
                          materialCompareResult.cost_variance.variance_type === '超支'
                            ? 'error'
                            : materialCompareResult.cost_variance.variance_type === '节约'
                              ? 'success'
                              : 'info'
                        }
                        showIcon
                      />
                    </Card>

                    <Divider>{t('app.kuaicaiwu.costCommon.costDetails')}</Divider>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Card title={t('app.kuaicaiwu.costComparison.standardDetails')} size="small">
                          <div style={{ maxHeight: 300, overflow: 'auto' }}>
                            <StructuredCostDataView data={materialCompareResult.standard_cost.cost_details} />
                          </div>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card title={t('app.kuaicaiwu.costComparison.actualDetails')} size="small">
                          <div style={{ maxHeight: 300, overflow: 'auto' }}>
                            <StructuredCostDataView data={materialCompareResult.actual_cost.cost_details} />
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </Card>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('app.kuaicaiwu.costCalculation.compareByMaterialEmpty')}
                    style={{ margin: '32px 0' }}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );

  const hasAnalyzeResult = analyzeData != null;

  const analyzePanel = (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('app.kuaicaiwu.costCalculation.analyzeHint')}
      </Typography.Paragraph>
      <ProForm
        formRef={analyzeFormRef}
        onFinish={handleAnalyzeQuery}
        submitter={{
          searchConfig: { submitText: t('app.kuaicaiwu.costCommon.query') },
          resetButtonProps: { style: { display: 'none' } },
        }}
      >
        <ProFormSelect
          name="product_id"
          label={t('app.kuaicaiwu.costCalculation.field.productMaterial')}
          placeholder={t('app.kuaicaiwu.costCalculation.field.productRequired')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costCalculation.field.productRequired') }]}
          options={productMaterialSelectOptions}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
      </ProForm>
      {hasAnalyzeResult && (
        <Tabs
          activeKey={analyzeInnerTab}
          onChange={setAnalyzeInnerTab}
          destroyInactiveTabPane={false}
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'composition',
              label: t('app.kuaicaiwu.costCalculation.analyzeTab.composition'),
              children: (
                <Row gutter={16}>
                  <Col span={8}>
                    <Card>
                      <Statistic title={t('app.kuaicaiwu.costCommon.col.materialCost')} value={analyzeData!.cost_composition?.材料成本 || 0} prefix="¥" precision={2} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic title={t('app.kuaicaiwu.costCommon.col.laborCost')} value={analyzeData!.cost_composition?.人工成本 || 0} prefix="¥" precision={2} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic title={t('app.kuaicaiwu.costCommon.col.manufacturingCost')} value={analyzeData!.cost_composition?.制造费用 || 0} prefix="¥" precision={2} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'trend',
              label: t('app.kuaicaiwu.costCalculation.analyzeTab.trend'),
              children: (
                <Card>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    {t('app.kuaicaiwu.costCalculation.analyzeTrendHint')}
                  </Typography.Paragraph>
                  <StructuredCostDataView data={analyzeData!.cost_trend} emptyDescription={t('app.kuaicaiwu.costCalculation.noTrendData')} />
                </Card>
              ),
            },
            {
              key: 'breakdown',
              label: t('app.kuaicaiwu.costCommon.costDetails'),
              children: (
                <Card>
                  <div style={{ maxHeight: 480, overflow: 'auto' }}>
                    <StructuredCostDataView data={analyzeData!.cost_breakdown} emptyDescription={t('app.kuaicaiwu.costCalculation.noBreakdownData')} />
                  </div>
                </Card>
              ),
            },
          ]}
        />
      )}
    </div>
  );

  const trialPanel = (
    <Tabs
      activeKey={cat === 'trial' ? sub : 'production'}
      onChange={(k) => setInnerSubOnly(k)}
      destroyInactiveTabPane={false}
      items={[
        {
          key: 'production',
          label: (
            <Space>
              <ToolOutlined />
              {t('app.kuaicaiwu.productionCost.title')}
            </Space>
          ),
          children: <ProductionCostPage embedded />,
        },
        {
          key: 'outsource',
          label: (
            <Space>
              <TeamOutlined />
              {t('app.kuaicaiwu.outsourceCost.title')}
            </Space>
          ),
          children: <OutsourceCostPage embedded />,
        },
        {
          key: 'purchase',
          label: (
            <Space>
              <ShoppingOutlined />
              {t('app.kuaicaiwu.purchaseCost.title')}
            </Space>
          ),
          children: <PurchaseCostPage embedded />,
        },
        {
          key: 'quality',
          label: (
            <Space>
              <SafetyCertificateOutlined />
              {t('app.kuaicaiwu.qualityCost.title')}
            </Space>
          ),
          children: <QualityCostPage embedded />,
        },
      ]}
    />
  );

  const topTabItems = [
    {
      key: 'ledger',
      label: (
        <Space>
          <TableOutlined />
          {t('app.kuaicaiwu.costCalculation.tab.ledger')}
        </Space>
      ),
      children: ledgerPanel,
    },
    {
      key: 'compare',
      label: (
        <Space>
          <BarChartOutlined />
          {t('app.kuaicaiwu.costCalculation.tab.compare')}
        </Space>
      ),
      children: comparePanel,
    },
    {
      key: 'analyze',
      label: (
        <Space>
          <LineChartOutlined />
          {t('app.kuaicaiwu.costCalculation.tab.analyze')}
        </Space>
      ),
      children: analyzePanel,
    },
    {
      key: 'optimization',
      label: (
        <Space>
          <BulbOutlined />
          {t('app.kuaicaiwu.costCalculation.tab.optimization')}
        </Space>
      ),
      children: <CostOptimizationPanel />,
    },
    {
      key: 'trial',
      label: (
        <Space>
          <ExperimentOutlined />
          {t('app.kuaicaiwu.costCalculation.tab.trial')}
        </Space>
      ),
      children: trialPanel,
    },
  ];

  return (
    <MultiTabListPageTemplate
      activeTabKey={cat}
      onTabChange={handleTopTabChange}
      tabs={topTabItems}
      padding={16}
      preserveMounted
    />
  );
};

export default CostCalculationPage;
