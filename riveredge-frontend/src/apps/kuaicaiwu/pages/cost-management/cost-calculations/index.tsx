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
  ProFormSelect,
  ProFormDigit,
  ProFormDatePicker,
  ProFormTextArea,
  ProForm,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Space,
  Tabs,
  Card,
  Statistic,
  Row,
  Col,
  Empty,
  Divider,
  Alert,
  Typography,
} from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import {
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
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag } from '../../../../../constants/statusBadges';
import {
  ListPageTemplate,
  MultiTabListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { CostCalculationDetailDrawer } from './components/CostCalculationDetailDrawer';
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
import { CostCalculationFactorsPanel, type CostCalculationReadiness } from '../CostCalculationFactorsPanel';
import { StructuredCostDataView } from '../../../../../components/structured-cost-data-view';
import { formatCalculationType,
  formatSourceType,
  formatVarianceType,
  getSourceTypeTag,
  getVarianceTypeTag,
} from '../../../utils/costUiLabels';
import {formatDateTime, formatQuantity} from '../../../../../utils/format';
import {
  COST_CALCULATION_PINNED_STATUS_FIELD,
  costCalculationSearchColumns,
  costDocCreatedUpdatedColumns,
  resolveCostCalculationListParams,
} from '../../../utils/costListCore';
import { formDateRangeFormItemProps, toApiDateString } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

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
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [costCalculationDetail, setCostCalculationDetail] = useState<CostCalculation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [execModal, setExecModal] = useState<null | 'work_order' | 'product'>(null);
  const [workOrderCalcResult, setWorkOrderCalcResult] = useState<CostCalculation | null>(null);
  const [productCalcResult, setProductCalcResult] = useState<CostCalculation | null>(null);
  const [execCalcLoading, setExecCalcLoading] = useState(false);
  const [workOrderReadiness, setWorkOrderReadiness] = useState<CostCalculationReadiness | null>(null);
  const [productReadiness, setProductReadiness] = useState<CostCalculationReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState<null | 'work_order' | 'product'>(null);

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
    if (execModal === 'work_order') {
      setWorkOrderCalcResult(null);
      setWorkOrderReadiness(null);
    } else if (execModal === 'product') {
      setProductCalcResult(null);
      setProductReadiness(null);
    } else {
      setWorkOrderCalcResult(null);
      setProductCalcResult(null);
      setWorkOrderReadiness(null);
      setProductReadiness(null);
    }
  }, [execModal]);

  const loadWorkOrderReadiness = useCallback(async (workOrderId?: number) => {
    if (!workOrderId) {
      setWorkOrderReadiness(null);
      return;
    }
    setReadinessLoading('work_order');
    try {
      const res = await costCalculationApi.previewWorkOrderReadiness(workOrderId);
      setWorkOrderReadiness(res as CostCalculationReadiness);
    } catch {
      setWorkOrderReadiness(null);
    } finally {
      setReadinessLoading((prev) => (prev === 'work_order' ? null : prev));
    }
  }, []);

  const loadProductReadiness = useCallback(async (productId?: number, quantity?: number) => {
    if (!productId) {
      setProductReadiness(null);
      return;
    }
    setReadinessLoading('product');
    try {
      const res = await costCalculationApi.previewProductReadiness(productId, Number(quantity) > 0 ? Number(quantity) : 1);
      setProductReadiness(res as CostCalculationReadiness);
    } catch {
      setProductReadiness(null);
    } finally {
      setReadinessLoading((prev) => (prev === 'product' ? null : prev));
    }
  }, []);

  const calcResultSummaryColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costCalculation.col.calculationNo'), dataIndex: 'calculation_no' },
      { title: t('app.kuaicaiwu.costCalculation.col.workOrderCode'), dataIndex: 'work_order_code' },
      { title: t('app.kuaicaiwu.costCalculation.col.productCode'), dataIndex: 'product_code' },
      { title: t('app.kuaicaiwu.costCalculation.col.productName'), dataIndex: 'product_name' },
      { title: t('app.kuaicaiwu.costCommon.col.quantity'), dataIndex: 'quantity' },
      { title: t('app.kuaicaiwu.costCommon.col.materialCost'), dataIndex: 'material_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.laborCost'), dataIndex: 'labor_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.manufacturingCost'), dataIndex: 'manufacturing_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.totalCost'), dataIndex: 'total_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.unitCost'), dataIndex: 'unit_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationType'), dataIndex: 'calculation_type' },
      { title: t('app.kuaicaiwu.costCommon.col.calculationDate'), dataIndex: 'calculation_date' },
    ],
    [t],
  );

  const buildCalcResultSummary = useCallback(
    (result: CostCalculation) => {
      const money = (v?: number) => (v != null ? `¥${Number(v).toFixed(2)}` : '-');
      return {
        calculation_no: result.calculation_no ?? '-',
        work_order_code: result.work_order_code ?? undefined,
        product_code: result.product_code ?? '-',
        product_name: result.product_name ?? '-',
        quantity: result.quantity ?? '-',
        material_cost: money(result.material_cost),
        labor_cost: money(result.labor_cost),
        manufacturing_cost: money(result.manufacturing_cost),
        total_cost: (
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1677ff' }}>{money(result.total_cost)}</span>
        ),
        unit_cost: money(result.unit_cost),
        calculation_type: result.calculation_type ? formatCalculationType(result.calculation_type, t) : '-',
        calculation_date: result.calculation_date
          ? formatDateTime(result.calculation_date, 'YYYY-MM-DD')
          : '-',
      };
    },
    [t],
  );

  const renderCalcResult = useCallback(
    (result: CostCalculation) => {
      const columns = calcResultSummaryColumns.filter((col) => {
        if (col.dataIndex === 'work_order_code') {
          return Boolean(result.work_order_code);
        }
        return true;
      });
      return (
        <>
          <ProDescriptions
            bordered
            column={2}
            size="small"
            dataSource={buildCalcResultSummary(result)}
            columns={columns}
          />
          {result.cost_details ? (
            <>
              <Divider orientation="left" style={{ marginTop: 16 }}>
                {t('app.kuaicaiwu.costCalculation.calculationFactors')}
              </Divider>
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                <StructuredCostDataView data={result.cost_details} />
              </div>
            </>
          ) : null}
        </>
      );
    },
    [buildCalcResultSummary, calcResultSummaryColumns, t],
  );

  const handleTopTabChange = (key: string) => {
    setCatWithSub(key as TopCat);
  };

  const loadDetail = useCallback(async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setCostCalculationDetail(await costCalculationApi.get(uuid));
    } catch (error) {
      setCostCalculationDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaicaiwu.costCalculation.loadDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const handleDetail = useCallback((record: CostCalculation) => {
    if (!record.uuid) {
      messageApi.error(t('app.kuaicaiwu.costCalculation.uuidMissing'));
      return;
    }
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setCostCalculationDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  }, [loadDetail, messageApi, t]);

  const closeDetail = () => {
    setDrawerVisible(false);
    setCostCalculationDetail(null);
    setDetailError(null);
  };

  const handleSaveWorkOrderCalculation = async (values: any) => {
    if (workOrderReadiness && !workOrderReadiness.ready) {
      messageApi.warning(t('app.kuaicaiwu.costCalculation.factorsFixBeforeCalculate'));
      return;
    }
    try {
      setExecCalcLoading(true);
      const res = await costCalculationApi.calculateWorkOrderCost({
        work_order_id: values.work_order_id,
        calculation_date: toApiDateString(values.calculation_date),
        remark: values.remark,
      });
      setWorkOrderCalcResult(res);
      messageApi.success(t('app.kuaicaiwu.costCalculation.workOrderSuccess'));
      setLedger();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCalculation.workOrderFailed'));
    } finally {
      setExecCalcLoading(false);
    }
  };

  const handleSaveProductCalculation = async (values: any) => {
    if (productReadiness && !productReadiness.ready) {
      messageApi.warning(t('app.kuaicaiwu.costCalculation.factorsFixBeforeCalculate'));
      return;
    }
    try {
      setExecCalcLoading(true);
      const res = await costCalculationApi.calculateProductCost({
        product_id: values.product_id,
        quantity: values.quantity,
        calculation_date: toApiDateString(values.calculation_date),
        calculation_type: values.calculation_type,
        remark: values.remark,
      });
      setProductCalcResult(res);
      messageApi.success(t('app.kuaicaiwu.costCalculation.productSuccess'));
      setLedger();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCalculation.productFailed'));
    } finally {
      setExecCalcLoading(false);
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
        calculation_date: toApiDateString(values.calculation_date),
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

  const calculationStatusEnum = useMemo(
    () => ({
      草稿: { text: t('app.kuaicaiwu.costCalculation.lifecycle.draft') },
      已核算: { text: t('app.kuaicaiwu.costCalculation.lifecycle.calculated') },
      已审核: { text: t('app.kuaicaiwu.costCalculation.lifecycle.audited') },
    }),
    [t],
  );

  const columns: ProColumns<CostCalculation>[] = useMemo(
    () => [
      ...costCalculationSearchColumns({
        calculationNo: t('app.kuaicaiwu.costCalculation.col.calculationNo'),
        workOrderCode: t('app.kuaicaiwu.costCalculation.col.workOrderCode'),
        productCode: t('app.kuaicaiwu.costCalculation.col.productCode'),
        productName: t('app.kuaicaiwu.costCalculation.col.productName'),
      }),
      {
        title: t('app.kuaicaiwu.costCalculation.col.calculationNo'),
        key: 'finance_doc_partner_stacked',
        dataIndex: 'calculation_no',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: true,
        sorter: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={[r.product_code, r.product_name]
              .map((v) => String(v ?? '').trim())
              .filter(Boolean)
              .join(' ')}
            secondary={String(r.calculation_no ?? '')}
            onSecondaryClick={() => handleDetail(r)}
          />
        ),
      },
      {
        title: t('app.kuaicaiwu.costCalculation.col.calculationType'),
        dataIndex: 'calculation_type',
        key: 'calculation_type',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => {
          const text = r.calculation_type || '';
          return (
            <MarkerTag color={calcTypeColor[text] || 'default'}>
              {formatCalculationType(text, t)}
            </MarkerTag>
          );
        },
      },
      {
        title: t('app.kuaicaiwu.costCalculation.col.workOrderCode'),
        dataIndex: 'work_order_code',
        key: 'cost_calculation_work_order_code',
        width: 150,
        minWidth: 150,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
      },
      { title: t('app.kuaicaiwu.costCalculation.col.productName'), dataIndex: 'product_name', key: 'product_name', hideInTable: true },
      {
        title: t('app.kuaicaiwu.costCommon.col.quantity'),
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => formatQuantity(r.quantity),
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.materialCost'),
        dataIndex: 'material_cost',
        key: 'material_cost',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => `¥${r.material_cost != null ? Number(r.material_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.laborCost'),
        dataIndex: 'labor_cost',
        key: 'labor_cost',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => `¥${r.labor_cost != null ? Number(r.labor_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.manufacturingCost'),
        dataIndex: 'manufacturing_cost',
        key: 'manufacturing_cost',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => `¥${r.manufacturing_cost != null ? Number(r.manufacturing_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.totalCost'),
        dataIndex: 'total_cost',
        key: 'total_cost',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => `¥${r.total_cost != null ? Number(r.total_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.unitCost'),
        dataIndex: 'unit_cost',
        key: 'unit_cost',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => `¥${r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : '0.00'}`,
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.calculationDate'),
        dataIndex: 'calculation_date',
        key: 'calculation_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => (r.calculation_date ? formatDateTime(r.calculation_date as string, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.calculationDate'),
        dataIndex: 'calculation_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 20,
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('app.kuaicaiwu.costCalculation.col.calculationStatus'),
        dataIndex: 'calculation_status',
        hideInTable: true,
        order: 22,
        valueType: 'select',
        valueEnum: calculationStatusEnum,
      },
      ...costDocCreatedUpdatedColumns<CostCalculation>(t),
      {
        title: t('app.kuaicaiwu.costCommon.action'),
        valueType: 'option',
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_: unknown, record: CostCalculation) => [
          <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)} />,
        ],
      },
    ],
    [t, calculationStatusEnum, handleDetail],
  );

  const ledgerPanel = (
    <ListPageTemplate>
      <UniTable<CostCalculation>
        actionRef={actionRef}
        columnPersistenceId="apps.kuaicaiwu.pages.cost-management.cost-calculations.list-v5"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={COST_CALCULATION_PINNED_STATUS_FIELD}
        request={async (params, sort, _filter, searchFormValues) => {
          const listParams = resolveCostCalculationListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          try {
            const response = await costCalculationApi.list({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              ...listParams,
            });
            return {
              data: response.items || [],
              success: true,
              total: response.total || 0,
            };
          } catch (error: unknown) {
            const err = error as { message?: string };
            messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
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
      <FormModalTemplate
        title={
          workOrderCalcResult
            ? t('app.kuaicaiwu.costCommon.resultTitle')
            : t('app.kuaicaiwu.costCalculation.workOrderModalTitle')
        }
        open={execModal === 'work_order'}
        onClose={() => {
          setExecModal(null);
          setWorkOrderCalcResult(null);
          setWorkOrderReadiness(null);
        }}
        formRef={workOrderFormRef}
        onFinish={handleSaveWorkOrderCalculation}
        onValuesChange={(changed, allValues) => {
          if ('work_order_id' in changed) {
            void loadWorkOrderReadiness(changed.work_order_id);
          }
        }}
        initialValues={{ calculation_date: dayjs() }}
        submitText={t('app.kuaicaiwu.costCalculation.calculate')}
        submitHidden={
          Boolean(workOrderCalcResult) ||
          readinessLoading === 'work_order' ||
          (workOrderReadiness != null && !workOrderReadiness.ready)
        }
        loading={execCalcLoading}
        width={
          workOrderCalcResult || workOrderReadiness
            ? MODAL_CONFIG.SMALL_WIDTH
            : MODAL_CONFIG.TINY_WIDTH
        }
        extraFooterAfter={
          workOrderCalcResult ? (
            <Button
              type="primary"
              onClick={() => {
                setWorkOrderCalcResult(null);
                workOrderFormRef.current?.resetFields();
                workOrderFormRef.current?.setFieldsValue({ calculation_date: dayjs() });
              }}
            >
              {t('app.kuaicaiwu.costCalculation.calculateAgain')}
            </Button>
          ) : undefined
        }
      >
        {workOrderCalcResult ? (
          renderCalcResult(workOrderCalcResult)
        ) : (
          <>
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
                onChange: (value: number) => {
                  void loadWorkOrderReadiness(value);
                },
              }}
            />
            <CostCalculationFactorsPanel
              readiness={workOrderReadiness}
              loading={readinessLoading === 'work_order'}
            />
            <ProFormDatePicker
              name="calculation_date"
              label={t('app.kuaicaiwu.costCommon.col.calculationDate')}
              placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')}
              fieldProps={{ style: { width: '100%' } }}
            />
            <ProFormTextArea
              name="remark"
              label={t('app.kuaicaiwu.costCommon.remark')}
              placeholder={t('app.kuaicaiwu.costCommon.remarkPlaceholder')}
              fieldProps={{ rows: 3 }}
            />
          </>
        )}
      </FormModalTemplate>
      <FormModalTemplate
        title={
          productCalcResult
            ? t('app.kuaicaiwu.costCommon.resultTitle')
            : t('app.kuaicaiwu.costCalculation.productModalTitle')
        }
        open={execModal === 'product'}
        onClose={() => {
          setExecModal(null);
          setProductCalcResult(null);
          setProductReadiness(null);
        }}
        formRef={productFormRef}
        onFinish={handleSaveProductCalculation}
        onValuesChange={(changed, allValues) => {
          if ('product_id' in changed || 'quantity' in changed) {
            void loadProductReadiness(allValues.product_id, allValues.quantity);
          }
        }}
        initialValues={{ calculation_date: dayjs(), calculation_type: '标准成本', quantity: 1 }}
        submitText={t('app.kuaicaiwu.costCalculation.calculate')}
        submitHidden={
          Boolean(productCalcResult) ||
          readinessLoading === 'product' ||
          (productReadiness != null && !productReadiness.ready)
        }
        loading={execCalcLoading}
        width={
          productCalcResult || productReadiness ? MODAL_CONFIG.SMALL_WIDTH : MODAL_CONFIG.TINY_WIDTH
        }
        extraFooterAfter={
          productCalcResult ? (
            <Button
              type="primary"
              onClick={() => {
                setProductCalcResult(null);
                productFormRef.current?.resetFields();
                productFormRef.current?.setFieldsValue({
                  calculation_date: dayjs(),
                  calculation_type: '标准成本',
                  quantity: 1,
                });
              }}
            >
              {t('app.kuaicaiwu.costCalculation.calculateAgain')}
            </Button>
          ) : undefined
        }
      >
        {productCalcResult ? (
          renderCalcResult(productCalcResult)
        ) : (
          <>
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
                onChange: (value: number) => {
                  const qty = productFormRef.current?.getFieldValue('quantity');
                  void loadProductReadiness(value, qty);
                },
              }}
            />
            <ProFormDigit
              name="quantity"
              label={t('app.kuaicaiwu.costCommon.col.quantity')}
              placeholder={t('app.kuaicaiwu.costCommon.field.quantityPlaceholder')}
              rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.quantityRequired') }]}
              min={0}
              fieldProps={{
                precision: 2,
                style: { width: '100%' },
                onChange: (value: number | null) => {
                  const pid = productFormRef.current?.getFieldValue('product_id');
                  void loadProductReadiness(pid, value ?? undefined);
                },
              }}
            />
            <CostCalculationFactorsPanel
              readiness={productReadiness}
              loading={readinessLoading === 'product'}
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
            <ProFormDatePicker
              name="calculation_date"
              label={t('app.kuaicaiwu.costCommon.col.calculationDate')}
              placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')}
              fieldProps={{ style: { width: '100%' } }}
            />
            <ProFormTextArea
              name="remark"
              label={t('app.kuaicaiwu.costCommon.remark')}
              placeholder={t('app.kuaicaiwu.costCommon.remarkPlaceholder')}
              fieldProps={{ rows: 3 }}
            />
          </>
        )}
      </FormModalTemplate>
      <CostCalculationDetailDrawer
        open={drawerVisible}
        onClose={closeDetail}
        detail={costCalculationDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
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
