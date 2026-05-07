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
        messageApi.error('核算记录UUID不存在');
        return;
      }
      const detail = await costCalculationApi.get(record.uuid);
      setCostCalculationDetail(detail);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取核算记录详情失败');
    }
  };

  const handleSaveWorkOrderCalculation = async (values: any) => {
    try {
      await costCalculationApi.calculateWorkOrderCost({
        work_order_id: values.work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        remark: values.remark,
      });
      messageApi.success('工单成本核算成功');
      setExecModal(null);
      setLedger();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '工单成本核算失败');
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
      messageApi.success('产品成本核算成功');
      setExecModal(null);
      setLedger();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '产品成本核算失败');
    }
  };

  const handleCompareQuery = async (values: any) => {
    try {
      const data = await costCalculationApi.compareCosts(values.product_id);
      setCompareData(data);
    } catch (error: any) {
      messageApi.error(error.message || '成本对比查询失败');
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
      messageApi.success('成本对比成功');
    } catch (error: any) {
      messageApi.error(error.message || '成本对比失败');
    } finally {
      setMaterialCompareLoading(false);
    }
  };

  const getMaterialCompareSourceTag = (sourceType: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      Make: { color: 'blue', text: '自制件' },
      Buy: { color: 'green', text: '采购件' },
      Outsource: { color: 'orange', text: '委外件' },
      Phantom: { color: 'purple', text: '虚拟件' },
      Configure: { color: 'cyan', text: '配置件' },
    };
    const t = typeMap[sourceType] || { color: 'default', text: sourceType };
    return <Tag color={t.color}>{t.text}</Tag>;
  };

  const handleAnalyzeQuery = async (values: any) => {
    try {
      const data = await costCalculationApi.analyzeCost(values.product_id);
      setAnalyzeData(data);
      setAnalyzeInnerTab('composition');
    } catch (error: any) {
      messageApi.error(error.message || '成本分析查询失败');
    }
  };

  const columns: ProColumns<CostCalculation>[] = [
    {
      title: '核算单号',
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
      title: '核算类型',
      dataIndex: 'calculation_type',
      key: 'calculation_type',
      width: 120,
      render: (_, r) => {
        const text = r.calculation_type;
        const typeMap: Record<string, { color: string; text: string }> = {
          工单成本: { color: 'blue', text: '工单成本' },
          产品成本: { color: 'green', text: '产品成本' },
          标准成本: { color: 'orange', text: '标准成本' },
          实际成本: { color: 'red', text: '实际成本' },
        };
        const type = typeMap[text || ''] || { color: 'default', text: text || '-' };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: '工单编号',
      dataIndex: 'work_order_code',
      key: 'work_order_code',
      width: 150,
      render: (_, r) =>
        r.work_order_code ? (
          <Typography.Text copyable={{ text: String(r.work_order_code) }} ellipsis>
            {r.work_order_code}
          </Typography.Text>
        ) : (
          '-'
        ),
    },
    {
      title: '产品编号',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 150,
      render: (_, r) =>
        r.product_code ? (
          <Typography.Text copyable={{ text: String(r.product_code) }} ellipsis>
            {r.product_code}
          </Typography.Text>
        ) : (
          '-'
        ),
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 200,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (_, r) => (r.quantity != null ? Number(r.quantity).toFixed(2) : '0.00'),
    },
    {
      title: '材料成本',
      dataIndex: 'material_cost',
      key: 'material_cost',
      width: 120,
      render: (_, r) => `¥${r.material_cost != null ? Number(r.material_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '人工成本',
      dataIndex: 'labor_cost',
      key: 'labor_cost',
      width: 120,
      render: (_, r) => `¥${r.labor_cost != null ? Number(r.labor_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '制造费用',
      dataIndex: 'manufacturing_cost',
      key: 'manufacturing_cost',
      width: 120,
      render: (_, r) => `¥${r.manufacturing_cost != null ? Number(r.manufacturing_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 120,
      render: (_, r) => `¥${r.total_cost != null ? Number(r.total_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '单位成本',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 120,
      render: (_, r) => `¥${r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '核算日期',
      dataIndex: 'calculation_date',
      key: 'calculation_date',
      width: 120,
      search: false,
      render: (_, r) => (r.calculation_date ? dayjs(r.calculation_date as string).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      search: false,
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at as string).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      key: 'lifecycle',
      width: 200,
      fixed: 'right',
      align: 'left',
      search: false,
      render: (_, record) => (
        <UniLifecycle {...getCostCalculationLifecycle(record as Record<string, unknown>)} showCircleTooltip={false} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: any, record: CostCalculation) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  const detailItems: ProDescriptionsItemProps<CostCalculation>[] = [
    { title: '核算单号', dataIndex: 'calculation_no' },
    { title: '核算类型', dataIndex: 'calculation_type' },
    { title: '工单编号', dataIndex: 'work_order_code' },
    { title: '产品编号', dataIndex: 'product_code' },
    { title: '产品名称', dataIndex: 'product_name' },
    {
      title: '数量',
      dataIndex: 'quantity',
      render: (_, entity) => (entity.quantity != null ? Number(entity.quantity).toFixed(2) : '0.00'),
    },
    {
      title: '材料成本',
      dataIndex: 'material_cost',
      render: (_, entity) => `¥${entity.material_cost != null ? Number(entity.material_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '人工成本',
      dataIndex: 'labor_cost',
      render: (_, entity) => `¥${entity.labor_cost != null ? Number(entity.labor_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '制造费用',
      dataIndex: 'manufacturing_cost',
      render: (_, entity) =>
        `¥${entity.manufacturing_cost != null ? Number(entity.manufacturing_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      render: (_, entity) => `¥${entity.total_cost != null ? Number(entity.total_cost).toFixed(2) : '0.00'}`,
    },
    {
      title: '单位成本',
      dataIndex: 'unit_cost',
      render: (_, entity) => `¥${entity.unit_cost != null ? Number(entity.unit_cost).toFixed(2) : '0.00'}`,
    },
    { title: '核算状态', dataIndex: 'calculation_status' },
    {
      title: '核算日期',
      dataIndex: 'calculation_date',
      render: (_, entity) =>
        entity.calculation_date ? dayjs(entity.calculation_date as string).format('YYYY-MM-DD') : '-',
    },
    { title: '备注', dataIndex: 'remark' },
    { title: '创建人', dataIndex: 'created_by_name' },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (_, entity) =>
        entity.created_at ? dayjs(entity.created_at as string).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    { title: '更新人', dataIndex: 'updated_by_name' },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      render: (_, entity) =>
        entity.updated_at ? dayjs(entity.updated_at as string).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

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
          searchConfig: { submitText: '核算' },
          resetButtonProps: { style: { display: 'none' } },
        }}
      >
        <ProFormSelect
          name="work_order_id"
          label="工单"
          placeholder="请选择工单"
          rules={[{ required: true, message: '请选择工单' }]}
          options={costReferenceOptions.workOrders}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDatePicker name="calculation_date" label="核算日期" placeholder="请选择核算日期" />
        <ProFormTextArea name="remark" label="备注" placeholder="请输入备注" fieldProps={{ rows: 3 }} />
      </ProForm>
    </Card>
  );

  const productPanel = (
    <Card variant="borderless">
      <ProForm
        formRef={productFormRef}
        onFinish={handleSaveProductCalculation}
        submitter={{
          searchConfig: { submitText: '核算' },
          resetButtonProps: { style: { display: 'none' } },
        }}
      >
        <ProFormSelect
          name="product_id"
          label="产品（物料）"
          placeholder="请选择产品物料"
          rules={[{ required: true, message: '请选择产品' }]}
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
          label="数量"
          placeholder="请输入数量"
          rules={[{ required: true, message: '请输入数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="calculation_type"
          label="核算类型"
          placeholder="请选择核算类型"
          options={[
            { label: '标准成本', value: '标准成本' },
            { label: '实际成本', value: '实际成本' },
          ]}
          rules={[{ required: true, message: '请选择核算类型' }]}
        />
        <ProFormDatePicker name="calculation_date" label="核算日期" placeholder="请选择核算日期" />
        <ProFormTextArea name="remark" label="备注" placeholder="请输入备注" fieldProps={{ rows: 3 }} />
      </ProForm>
    </Card>
  );

  const ledgerPanel = (
    <ListPageTemplate>
      <UniTable<CostCalculation>
        actionRef={actionRef}
        columnPersistenceId="kuaicaiwu-cost-calculations-ledger"
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
            工单成本核算
          </Button>,
          <Button key="product-cost" icon={<CalculatorOutlined />} onClick={() => setExecModal('product')}>
            产品成本核算
          </Button>,
        ]}
      />
      <Modal
        title="工单成本核算"
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
        title="产品成本核算"
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
        title="成本核算记录详情"
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
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildMasterDetailDescriptionItems(
                    costCalculationDetail as Record<string, unknown>,
                    calculationDetailBaseItems as any,
                  )}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
                <UniLifecycle
                  {...getCostCalculationLifecycle(costCalculationDetail as Record<string, unknown>)}
                  showCircleTooltip={false}
                />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  核算状态以列表与基本信息为准；完整上下游跟踪接入后可在此展示关联单据。
                </Typography.Paragraph>
              </DetailDrawerSection>
              <DetailDrawerSection title="明细信息">
                <div style={{ maxHeight: 420, overflow: 'auto', minWidth: 320 }}>
                  {costCalculationDetail.cost_details ? (
                    <StructuredCostDataView data={costCalculationDetail.cost_details} />
                  ) : (
                    '-'
                  )}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
                <Timeline
                  items={[
                    {
                      color: 'green',
                      children: (
                        <>
                          创建 ·{' '}
                          {costCalculationDetail.created_at
                            ? dayjs(costCalculationDetail.created_at).format('YYYY-MM-DD HH:mm:ss')
                            : '-'}
                          {costCalculationDetail.created_by_name ? ` · ${costCalculationDetail.created_by_name}` : ''}
                        </>
                      ),
                    },
                    {
                      color: 'blue',
                      children: (
                        <>
                          更新 ·{' '}
                          {costCalculationDetail.updated_at
                            ? dayjs(costCalculationDetail.updated_at).format('YYYY-MM-DD HH:mm:ss')
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
            label: '按产品',
            children: (
              <div>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  选择产品（物料）拉取该产品标准与实际成本汇总。
                </Typography.Paragraph>
                <ProForm
                  formRef={compareFormRef}
                  onFinish={handleCompareQuery}
                  submitter={{
                    searchConfig: { submitText: '查询' },
                    resetButtonProps: { style: { display: 'none' } },
                  }}
                >
                  <ProFormSelect
                    name="product_id"
                    label="产品（物料）"
                    placeholder="请选择产品"
                    rules={[{ required: true, message: '请选择产品' }]}
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
                  <Card title="产品成本对比结果" style={{ marginTop: 16 }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic title="标准成本" value={compareData.standard_cost} prefix="¥" precision={2} />
                      </Col>
                      <Col span={12}>
                        <Statistic title="实际成本" value={compareData.actual_cost} prefix="¥" precision={2} />
                      </Col>
                    </Row>
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      <Col span={12}>
                        <Statistic
                          title="成本差异"
                          value={compareData.cost_difference}
                          prefix="¥"
                          precision={2}
                          valueStyle={{ color: compareData.cost_difference > 0 ? '#cf1322' : '#3f8600' }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="成本差异率"
                          value={compareData.cost_difference_rate}
                          suffix="%"
                          precision={2}
                          valueStyle={{ color: compareData.cost_difference_rate > 0 ? '#cf1322' : '#3f8600' }}
                        />
                      </Col>
                    </Row>
                    <ProDescriptions
                      title="成本明细差异"
                      bordered
                      style={{ marginTop: 16 }}
                      dataSource={{
                        material_cost_difference: `¥${compareData.material_cost_difference?.toFixed(2) || '0.00'}`,
                        labor_cost_difference: `¥${compareData.labor_cost_difference?.toFixed(2) || '0.00'}`,
                        manufacturing_cost_difference: `¥${compareData.manufacturing_cost_difference?.toFixed(2) || '0.00'}`,
                      }}
                      columns={[
                        { title: '材料成本差异', dataIndex: 'material_cost_difference' },
                        { title: '人工成本差异', dataIndex: 'labor_cost_difference' },
                        { title: '制造费用差异', dataIndex: 'manufacturing_cost_difference' },
                      ]}
                    />
                    {compareData.difference_analysis && (
                      <div style={{ marginTop: 16 }}>
                        <strong>差异原因分析：</strong>
                        <p>{compareData.difference_analysis}</p>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="选择产品并查询后，将在此展示标准/实际成本与差异"
                    style={{ margin: '32px 0' }}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'by_material',
            label: '按物料 / 工单',
            children: (
              <div>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  选择物料并填写数量；可按来源补充工单、采购订单或委外工单等条件，与独立「成本对比」页同一接口。
                </Typography.Paragraph>
                <ProForm
                  formRef={materialCompareFormRef}
                  onFinish={handleMaterialLevelCompare}
                  submitter={{
                    searchConfig: { submitText: '对比' },
                    resetButtonProps: { style: { display: 'none' } },
                    submitButtonProps: { loading: materialCompareLoading },
                  }}
                  initialValues={{
                    calculation_date: dayjs(),
                    quantity: 1,
                  }}
                >
                  <ProFormSelect
                    name="material_id"
                    label="物料"
                    placeholder="请选择物料"
                    rules={[{ required: true, message: '请选择物料' }]}
                    options={materialCompareList.map((m) => ({
                      label: `${m.mainCode || m.code} - ${m.name} (${m.sourceType || m.source_type || 'Make'})`,
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
                    label="数量"
                    placeholder="请输入数量（用于计算标准成本）"
                    rules={[
                      { required: true, message: '请输入数量' },
                      { type: 'number', min: 0.0001, message: '数量必须大于0' },
                    ]}
                    fieldProps={{
                      precision: 4,
                      style: { width: '100%' },
                    }}
                  />
                  <ProFormSelect
                    name="work_order_id"
                    label="工单（自制件/配置件实际成本）"
                    placeholder="可选"
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
                    label="采购订单（采购件实际成本-整单）"
                    placeholder="可选"
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
                    label="采购订单明细（采购件实际成本-明细）"
                    placeholder="可选"
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
                    label="委外工单（委外件实际成本）"
                    placeholder="可选"
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
                    label="核算日期"
                    placeholder="请选择核算日期"
                    fieldProps={{ style: { width: '100%' } }}
                  />
                </ProForm>
                {materialCompareResult ? (
                  <Card title="物料标准与实际对比结果" style={{ marginTop: 16 }} styles={{ body: { padding: 16 } }}>
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
                        { title: '物料编号', dataIndex: 'material_code' },
                        { title: '物料名称', dataIndex: 'material_name' },
                        { title: '物料来源类型', dataIndex: 'source_type' },
                        { title: '数量', dataIndex: 'quantity' },
                      ]}
                    />

                    <Row gutter={16} style={{ marginBottom: 24 }}>
                      <Col span={12}>
                        <Card title="标准成本" size="small">
                          <Statistic
                            title="总成本"
                            value={materialCompareResult.standard_cost.total_cost}
                            prefix="¥"
                            precision={2}
                          />
                          <Divider style={{ margin: '12px 0' }} />
                          <Statistic
                            title="单位成本"
                            value={materialCompareResult.standard_cost.unit_cost}
                            prefix="¥"
                            precision={2}
                          />
                          <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                            核算类型：{materialCompareResult.standard_cost.calculation_type}
                          </div>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card title="实际成本" size="small">
                          <Statistic
                            title="总成本"
                            value={materialCompareResult.actual_cost.total_cost}
                            prefix="¥"
                            precision={2}
                          />
                          <Divider style={{ margin: '12px 0' }} />
                          <Statistic
                            title="单位成本"
                            value={materialCompareResult.actual_cost.unit_cost}
                            prefix="¥"
                            precision={2}
                          />
                          <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                            核算类型：{materialCompareResult.actual_cost.calculation_type}
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    <Card title="成本差异" style={{ marginBottom: 16 }}>
                      <Alert
                        message={materialCompareResult.cost_variance.variance_type}
                        description={
                          <div>
                            <p>总成本差异：¥{materialCompareResult.cost_variance.total_cost_variance.toFixed(2)}</p>
                            <p>总成本差异率：{materialCompareResult.cost_variance.total_cost_variance_rate.toFixed(2)}%</p>
                            <p>单位成本差异：¥{materialCompareResult.cost_variance.unit_cost_variance.toFixed(2)}</p>
                            <p>单位成本差异率：{materialCompareResult.cost_variance.unit_cost_variance_rate.toFixed(2)}%</p>
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

                    <Divider>成本明细</Divider>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Card title="标准成本明细" size="small">
                          <div style={{ maxHeight: 300, overflow: 'auto' }}>
                            <StructuredCostDataView data={materialCompareResult.standard_cost.cost_details} />
                          </div>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card title="实际成本明细" size="small">
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
                    description="填写表单并点击对比后，将在此展示标准/实际成本与明细"
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
        选择产品（物料）查询该产品成本构成、趋势与明细。物料来源维度的优化建议请使用「优化建议」页签。
      </Typography.Paragraph>
      <ProForm
        formRef={analyzeFormRef}
        onFinish={handleAnalyzeQuery}
        submitter={{
          searchConfig: { submitText: '查询' },
          resetButtonProps: { style: { display: 'none' } },
        }}
      >
        <ProFormSelect
          name="product_id"
          label="产品（物料）"
          placeholder="请选择产品"
          rules={[{ required: true, message: '请选择产品' }]}
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
              label: '成本构成',
              children: (
                <Row gutter={16}>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="材料成本"
                        value={analyzeData!.cost_composition?.材料成本 || 0}
                        prefix="¥"
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="人工成本"
                        value={analyzeData!.cost_composition?.人工成本 || 0}
                        prefix="¥"
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="制造费用"
                        value={analyzeData!.cost_composition?.制造费用 || 0}
                        prefix="¥"
                        precision={2}
                      />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'trend',
              label: '成本趋势',
              children: (
                <Card>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    最近若干次「已审核」核算记录的成本构成与单位成本（按核算日期升序）。
                  </Typography.Paragraph>
                  <StructuredCostDataView data={analyzeData!.cost_trend} emptyDescription="暂无趋势数据" />
                </Card>
              ),
            },
            {
              key: 'breakdown',
              label: '成本明细',
              children: (
                <Card>
                  <div style={{ maxHeight: 480, overflow: 'auto' }}>
                    <StructuredCostDataView data={analyzeData!.cost_breakdown} emptyDescription="暂无明细" />
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
              生产成本
            </Space>
          ),
          children: <ProductionCostPage embedded />,
        },
        {
          key: 'outsource',
          label: (
            <Space>
              <TeamOutlined />
              委外成本
            </Space>
          ),
          children: <OutsourceCostPage embedded />,
        },
        {
          key: 'purchase',
          label: (
            <Space>
              <ShoppingOutlined />
              采购成本
            </Space>
          ),
          children: <PurchaseCostPage embedded />,
        },
        {
          key: 'quality',
          label: (
            <Space>
              <SafetyCertificateOutlined />
              质量成本
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
          核算台账
        </Space>
      ),
      children: ledgerPanel,
    },
    {
      key: 'compare',
      label: (
        <Space>
          <BarChartOutlined />
          成本对比
        </Space>
      ),
      children: comparePanel,
    },
    {
      key: 'analyze',
      label: (
        <Space>
          <LineChartOutlined />
          成本分析
        </Space>
      ),
      children: analyzePanel,
    },
    {
      key: 'optimization',
      label: (
        <Space>
          <BulbOutlined />
          优化建议
        </Space>
      ),
      children: <CostOptimizationPanel />,
    },
    {
      key: 'trial',
      label: (
        <Space>
          <ExperimentOutlined />
          分项试算
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
