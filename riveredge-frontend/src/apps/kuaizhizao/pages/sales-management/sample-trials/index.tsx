/**
 * 样品试用单管理页面
 *
 * 客户申请样品试用，可转正式销售订单，样品出库可通过其他出库（原因：样品）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, InputNumber, Row, Col, Select, Typography, Dropdown, Empty, Descriptions, Input } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, ExportOutlined, PrinterOutlined, AppstoreAddOutlined, ImportOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniImport } from '../../../../../components/uni-import';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
import { sampleTrialApi } from '../../../services/sample-trial';
import { pushSalesOrderToShipmentNotice } from '../../../services/sales-order';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { warehouseApi } from '../../../../master-data/services/warehouse';
import type { Material } from '../../../../master-data/types/material';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImport } from '../../../../../utils/batchOperations';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { useTranslation } from 'react-i18next';
import { RE_STATUS_BADGE_DRAFT, resolveStatusTagDisplayProps } from '../../../../../constants/statusBadges';
import { AmountDisplay } from '../../../../../components/permission';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingRelationsBody, DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import '../../../../../components/uni-table-detail/index.less';
import type { DocumentPrintApiResult } from '../../../../../utils/printResponseHelpers';
import { isClientPdfmePrint, clientPdfmeListPrintMessage } from '../../../../../utils/printResponseHelpers';

interface SampleTrial {
  id?: number;
  trial_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  trial_purpose?: string;
  trial_period_start?: string;
  trial_period_end?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  other_outbound_id?: number;
  other_outbound_code?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

interface SampleTrialDetail extends SampleTrial {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; trial_quantity: number; unit_price?: number; total_amount?: number }[];
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  草稿: { text: '草稿', color: RE_STATUS_BADGE_DRAFT },
  已提交: { text: '已提交', color: 'processing' },
  已审核: { text: '已审核', color: 'processing' },
  已审批: { text: '已审核', color: 'processing' },
  试用中: { text: '试用中', color: 'processing' },
  已归还: { text: '已归还', color: 'success' },
  已转订单: { text: '已转订单', color: 'success' },
  已关闭: { text: '已关闭', color: 'default' },
};

const SAMPLE_TRIAL_ACTIONS_INLINE_MAX = 4;

function renderSampleTrialRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  const wrapped = nodes.map((node, i) => <span key={`${keyPrefix}-${i}`}>{node}</span>);
  if (wrapped.length <= SAMPLE_TRIAL_ACTIONS_INLINE_MAX) {
    return <Space size="small" wrap>{wrapped}</Space>;
  }
  return (
    <Space size="small" wrap>
      {wrapped.slice(0, SAMPLE_TRIAL_ACTIONS_INLINE_MAX)}
      <Dropdown
        trigger={['click']}
        menu={{
          items: wrapped.slice(SAMPLE_TRIAL_ACTIONS_INLINE_MAX).map((node, i) => ({
            key: `${keyPrefix}-more-${i}`,
            label: node,
          })),
        }}
      >
        <Button type="link" size="small">更多</Button>
      </Dropdown>
    </Space>
  );
}

function getSampleTrialLifecycle(trial?: Pick<SampleTrial, 'status' | 'sales_order_id' | 'other_outbound_id'>) {
  const normalized = (trial?.status || '').trim();
  if (trial?.sales_order_id && trial?.other_outbound_id) {
    return { percent: 100, stageName: '已下推并出库', status: 'success' as const };
  }
  if (trial?.sales_order_id) {
    return { percent: 90, stageName: '已转订单', status: 'success' as const };
  }
  if (trial?.other_outbound_id) {
    return { percent: 70, stageName: '试用中（已出库）', status: 'normal' as const };
  }
  const map: Record<string, { percent: number; stageName: string; status: 'normal' | 'success' | 'exception' | 'active' }> = {
    草稿: { percent: 16, stageName: '草稿', status: 'normal' },
    已提交: { percent: 28, stageName: '已提交', status: 'normal' },
    已审核: { percent: 35, stageName: '已审核', status: 'normal' },
    已审批: { percent: 35, stageName: '已审核', status: 'normal' },
    试用中: { percent: 60, stageName: '试用中', status: 'normal' },
    已归还: { percent: 85, stageName: '已归还', status: 'success' },
    已转订单: { percent: 100, stageName: '已转订单', status: 'success' },
    已关闭: { percent: 100, stageName: '已关闭', status: 'exception' },
  };
  return map[normalized] || { percent: 0, stageName: normalized || '未知', status: 'normal' as const };
}

function getSampleTrialLifecycleStages(trial?: Pick<SampleTrial, 'status' | 'sales_order_id' | 'other_outbound_id'>) {
  const status = (trial?.status || '').trim();
  const converted = !!trial?.sales_order_id;
  const outbound = !!trial?.other_outbound_id;
  const closed = status === '已关闭';
  const returned = status === '已归还';
  const submitted = status === '已提交';
  const approved = status === '已审核' || status === '已审批' || status === '试用中' || returned || converted;
  const inTrial = status === '试用中' || returned || outbound;

  const steps = [
    { key: 'draft', label: '草稿', status: 'done' as const },
    { key: 'submitted', label: '已提交', status: approved ? ('done' as const) : submitted ? ('active' as const) : ('pending' as const) },
    { key: 'approved', label: '已审核', status: approved ? ('done' as const) : ('pending' as const) },
    { key: 'in_trial', label: outbound ? '试用中（已出库）' : '试用中', status: inTrial ? ('done' as const) : ('pending' as const) },
    { key: 'returned', label: '已归还', status: returned ? ('done' as const) : ('pending' as const) },
    { key: 'converted', label: '已转订单', status: converted ? ('done' as const) : ('pending' as const) },
    { key: 'closed', label: '已关闭', status: closed ? ('done' as const) : ('pending' as const) },
  ];

  if (!closed && !converted && !returned && !steps.some((s) => s.status === 'active')) {
    const activeIdx = steps.findIndex((s) => s.status === 'pending');
    if (activeIdx >= 0) {
      steps[activeIdx] = { ...steps[activeIdx], status: 'active' as const };
    }
  }

  return steps;
}

/**
 * 试用单明细汇总组件
 */
const SampleTrialFormSummary: React.FC = () => {
  const items = Form.useWatch('items');
  const totalQuantity = items?.reduce((sum: number, it: any) => sum + (Number(it?.trial_quantity) || 0), 0) || 0;
  const totalAmount = items?.reduce((sum: number, it: any) => sum + ((Number(it?.trial_quantity) || 0) * (Number(it?.unit_price) || 0)), 0) || 0;

  return (
    <div style={{ marginTop: 12, padding: '12px', background: '#fafafa', borderRadius: '4px', display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
      <span>总数量: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
      <span>
        总金额:{' '}
        <Typography.Text strong type="danger">
          <AmountDisplay resource="sample_trial" value={totalAmount} />
        </Typography.Text>
      </span>
    </div>
  );
};

/** 与报价单一致的物料选择单元格写法 */
const SampleTrialMaterialSelectCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const mid = row?.material_id != null && row?.material_id !== '' ? Number(row.material_id) : null;
  const fallback =
    mid != null && Number.isFinite(mid) && (row?.material_code || row?.material_name)
      ? {
          value: mid,
          label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
        }
      : undefined;
  return (
    <div className="sample-trial-material-cell" style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <UniMaterialSelect
          name={[index, 'material_id']}
          label=""
          placeholder="请选择物料（支持名称/编号搜索）"
          required
          size="small"
          listFieldKey={index}
          listFieldName="items"
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
            material_spec: 'specification',
            material_unit: 'baseUnit',
            unit_price: 'defaults.defaultSalePrice' as any,
          }}
          fallbackOption={fallback}
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
        />
      </div>
    </div>
  );
};

const SampleTrialsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [trialDetail, setTrialDetail] = useState<SampleTrialDetail | null>(null);
  const trialTracking = useDocumentTracking(
    detailDrawerVisible && trialDetail ? 'sample_trial' : undefined,
    trialDetail?.id
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const [createOutboundModalVisible, setCreateOutboundModalVisible] = useState(false);
  const [createOutboundTrialId, setCreateOutboundTrialId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const outboundFormRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setCustomersLoading(true);
      try {
        const [custRes, matRes, whRes] = await Promise.allSettled([
          customerApi.list({ limit: 1000, is_active: true } as any),
          materialApi.list({ limit: 1000, is_active: true } as any),
          warehouseApi.list({ limit: 1000, is_active: true } as any),
        ]);
        const cust = custRes.status === 'fulfilled' ? custRes.value : [];
        const mat = matRes.status === 'fulfilled' ? matRes.value : [];
        const wh = whRes.status === 'fulfilled' ? whRes.value : [];
        setCustomerList(Array.isArray(cust) ? cust : (cust as any)?.data ?? (cust as any)?.items ?? []);
        setMaterialList(Array.isArray(mat) ? mat : (mat as any)?.data ?? (mat as any)?.items ?? []);
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.data ?? (wh as any)?.items ?? []);
      } catch {
        // 理论上 allSettled 不会走到这里，保底不阻断页面
      } finally {
        setCustomersLoading(false);
      }
    };
    load();
  }, []);

  const columns: ProColumns<SampleTrial>[] = [
    { title: '试用单号', dataIndex: 'trial_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    {
      title: '试用单号',
      key: 'trial_code_search',
      dataIndex: 'trial_code',
      hideInTable: true,
      order: 10,
      fieldProps: { placeholder: '支持模糊匹配' },
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      hideInTable: true,
      order: 20,
      fieldProps: { placeholder: '客户名称' },
    },
    {
      title: '试用日期',
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 30,
      fieldProps: { placeholder: ['开始日期', '结束日期'] },
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      order: 40,
      valueEnum: {
        草稿: { text: '草稿' },
        已提交: { text: '已提交' },
        已审核: { text: '已审核' },
        试用中: { text: '试用中' },
        已归还: { text: '已归还' },
        已转订单: { text: '已转订单' },
        已关闭: { text: '已关闭' },
      },
    },
    { title: '试用目的', dataIndex: 'trial_purpose', ellipsis: true, hideInSearch: true },
    { title: '试用开始', dataIndex: 'trial_period_start', valueType: 'date', width: 110, hideInSearch: true },
    { title: '试用结束', dataIndex: 'trial_period_end', valueType: 'date', width: 110, hideInSearch: true },
    { title: '关联销售订单', dataIndex: 'sales_order_code', width: 130, ellipsis: true, hideInSearch: true },
    { title: '关联出库单', dataIndex: 'other_outbound_code', width: 130, ellipsis: true, hideInSearch: true },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160, hideInSearch: true },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getSampleTrialLifecycle(record);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 340,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const parts: React.ReactNode[] = [
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>,
        ];
        if (record.status === '草稿') {
          parts.push(
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>,
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>,
            <Button type="link" size="small" onClick={() => handleSubmit(record)}>提交审核</Button>,
          );
        }
        if (record.status === '已提交') {
          parts.push(
            <Button type="link" size="small" onClick={() => handleApprove(record)}>审核通过</Button>,
            <Button type="link" size="small" danger onClick={() => handleReject(record)}>驳回</Button>,
            <Button type="link" size="small" onClick={() => handleWithdraw(record)}>撤回提交</Button>,
          );
        }
        if (!record.sales_order_id && record.status !== '已转订单' && record.status !== '草稿' && record.status !== '已提交') {
          parts.push(<Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvertToOrder(record)} style={{ color: '#52c41a' }}>转订单</Button>);
        }
        if (record.sales_order_id) {
          parts.push(<Button type="link" size="small" icon={<ExportOutlined />} onClick={() => handlePushShipmentNotice(record)}>下推发货通知单</Button>);
        }
        if (!record.other_outbound_id && record.status !== '草稿' && record.status !== '已提交') {
          parts.push(<Button type="link" size="small" icon={<ExportOutlined />} onClick={() => handleOpenCreateOutbound(record)}>样品出库</Button>);
        }
        parts.push(<Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>打印</Button>);
        return renderSampleTrialRowActions(parts, `sample-trial-${record.id ?? 'row'}`);
      },
    },
  ];

  const handleItemImport = (data: any[][]) => {
    const rows = data.slice(2);
    const newItems = rows
      .map((row) => {
        const materialCode = String(row[0] || '').trim();
        const quantity = parseFloat(row[1]) || 0;
        const unitPrice = parseFloat(row[2]) || 0;
        if (!materialCode || quantity <= 0) return null;
        const material = materialList.find((m: any) =>
          String(m.mainCode || m.code || m.material_code || '').trim() === materialCode
        );
        return {
          material_id: material?.id ?? material?.material_id,
          material_code: material?.mainCode ?? material?.code ?? materialCode,
          material_name: material?.name ?? material?.material_name ?? '',
          material_spec: material?.specification ?? '',
          material_unit: material?.baseUnit ?? material?.material_unit ?? '件',
          trial_quantity: quantity,
          unit_price: unitPrice,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it != null && (it.material_id != null || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning('未检测到有效明细（请确保物料编号不为空且数量大于0）');
      return;
    }
    const currentItems = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({ items: [...currentItems, ...newItems] });
    messageApi.success(`成功导入 ${newItems.length} 条明细`);
  };

  const handleDetail = async (record: SampleTrial) => {
    try {
      const detail = await sampleTrialApi.get(record.id!.toString());
      setTrialDetail(detail as SampleTrialDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取样品试用单详情失败');
    }
  };

  const handleEdit = async (record: SampleTrial) => {
    try {
      const detail = await sampleTrialApi.get(record.id!.toString()) as SampleTrialDetail;
      formRef.current?.setFieldsValue({
        trial_code: detail.trial_code,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        trial_purpose: detail.trial_purpose,
        trial_period_start: detail.trial_period_start ? dayjs(detail.trial_period_start) : undefined,
        trial_period_end: detail.trial_period_end ? dayjs(detail.trial_period_end) : undefined,
        status: detail.status,
        notes: detail.notes,
        items: (detail.items || []).map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          trial_quantity: Number(it.trial_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      });
      setEditingId(record.id!);
      setModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleDelete = (record: SampleTrial) => {
    Modal.confirm({
      title: '删除样品试用单',
      content: `确定要删除 "${record.trial_code}" 吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条样品试用单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await sampleTrialApi.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条样品试用单`);
          setSelectedRowKeys([]);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleBatchConvertToOrder = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量转订单',
      content: `确定要将选中的 ${keys.length} 条样品试用单尝试转为销售订单吗？`,
      onOk: async () => {
        let successCount = 0;
        let failedCount = 0;
        for (const k of keys) {
          try {
            await sampleTrialApi.convertToOrder(String(k));
            successCount += 1;
          } catch {
            failedCount += 1;
          }
        }
        if (failedCount === 0) {
          messageApi.success(`已转订单 ${successCount} 条`);
        } else {
          messageApi.warning(`已转订单 ${successCount} 条，失败 ${failedCount} 条`);
        }
        setSelectedRowKeys([]);
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload = {
          customer_id: row.customer_id ?? row.customerId,
          customer_name: row.customer_name || row.customerName,
          trial_purpose: row.trial_purpose,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await sampleTrialApi.create(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条样品试用单`);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning('导入数据为空或格式不正确');
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      if (h.includes('试用单号') || h.includes('trial_code')) headerMap['trial_code'] = i;
      else if (h.includes('客户') || h.includes('customer')) headerMap['customer_name'] = i;
      else if (h.includes('试用目的') || h.includes('trial_purpose')) headerMap['trial_purpose'] = i;
      else if (h.includes('开始') || h.includes('start')) headerMap['start'] = i;
      else if (h.includes('结束') || h.includes('end')) headerMap['end'] = i;
      else if (h.includes('状态') || h.includes('status')) headerMap['status'] = i;
      else if (h.includes('物料') || h.includes('material')) headerMap['material_code'] = i;
      else if (h.includes('数量') || h.includes('quantity')) headerMap['quantity'] = i;
      else if (h.includes('单价') || h.includes('price')) headerMap['unit_price'] = i;
      else if (h.includes('备注') || h.includes('notes')) headerMap['notes'] = i;
    });
    if (headerMap['customer_name'] === undefined) {
      messageApi.error('导入表头需包含客户名称');
      return;
    }
    if (headerMap['material_code'] === undefined || headerMap['quantity'] === undefined) {
      messageApi.error('导入表头需包含物料编号和数量');
      return;
    }
    const getVal = (row: any[], key: string) => {
      const idx = headerMap[key];
      if (idx === undefined) return '';
      const v = row[idx];
      return v != null ? String(v).trim() : '';
    };
    const grouped = new Map<string, { customer_name: string; trial_purpose: string; start: string; end: string; status: string; notes: string; items: { material_code: string; quantity: number; unit_price: number }[] }>();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((c: any) => (c == null || String(c).trim() === ''))) continue;
      const trialCode = getVal(row, 'trial_code') || `IMPORT-${i}`;
      const customerName = getVal(row, 'customer_name');
      const materialCode = getVal(row, 'material_code');
      const qty = Number(getVal(row, 'quantity')) || 0;
      if (!customerName || !materialCode || qty <= 0) continue;
      const entry = grouped.get(trialCode);
      const item = { material_code: materialCode, quantity: qty, unit_price: Number(getVal(row, 'unit_price')) || 0 };
      if (!entry) {
        grouped.set(trialCode, {
          customer_name: customerName,
          trial_purpose: getVal(row, 'trial_purpose'),
          start: getVal(row, 'start'),
          end: getVal(row, 'end'),
          status: getVal(row, 'status') || '草稿',
          notes: getVal(row, 'notes'),
          items: [item],
        });
      } else {
        entry.items.push(item);
      }
    }
    const toImport = Array.from(grouped.entries()).map(([code, v]) => ({
      trial_code: code,
      customer_name: v.customer_name,
      trial_purpose: v.trial_purpose,
      trial_period_start: v.start || undefined,
      trial_period_end: v.end || undefined,
      status: v.status,
      notes: v.notes || undefined,
      items: v.items,
    }));
    if (toImport.length === 0) {
      messageApi.warning('没有可导入的有效数据');
      return;
    }
    let custList = Array.isArray(customerList) ? customerList : [];
    let matList = Array.isArray(materialList) ? materialList : [];
    if (custList.length === 0) {
      const r = await customerApi.list({ limit: 5000, isActive: true });
      custList = Array.isArray(r) ? r : (r as any)?.data ?? (r as any)?.items ?? [];
    }
    if (matList.length === 0) {
      const r = await materialApi.list({ limit: 5000, isActive: true });
      matList = Array.isArray(r) ? r : (r as any)?.items ?? [];
    }
    const items = toImport.map((t) => {
      const cust = custList.find((c: any) => (c.name || c.customer_name || '').trim() === (t.customer_name || '').trim())
        ?? custList.find((c: any) => (c.code || '').trim() === (t.customer_name || '').trim())
        ?? custList.find((c: any) => (c.name || c.customer_name || c.code || '').includes(t.customer_name));
      const mappedItems = t.items.map((it) => {
        const mat = matList.find((m: any) => (m.code || m.material_code || '').toString().trim() === (it.material_code || '').trim());
        return {
          material_id: mat?.id ?? mat?.material_id,
          material_code: it.material_code,
          material_name: mat?.name || mat?.material_name || '',
          material_unit: mat?.unit || mat?.material_unit || '件',
          trial_quantity: it.quantity,
          unit_price: it.unit_price,
        };
      }).filter((it) => it.material_id || it.material_code);
      return {
        ...t,
        customer_id: cust?.id ?? cust?.customer_id,
        customer_name: t.customer_name || cust?.name || cust?.customer_name,
        items: mappedItems,
      };
    }).filter((t) => t.items.length > 0 && (t.customer_id != null || t.customer_name));
    if (items.length === 0) {
      messageApi.warning('没有匹配到客户或物料的有效数据');
      return;
    }
    const result = await batchImport({
      items,
      importFn: async (item: any) =>
        sampleTrialApi.create({
          trial_code: item.trial_code,
          customer_id: item.customer_id,
          customer_name: item.customer_name,
          trial_purpose: item.trial_purpose,
          trial_period_start: item.trial_period_start || undefined,
          trial_period_end: item.trial_period_end || undefined,
          status: item.status || '草稿',
          notes: item.notes,
          items: item.items,
        }),
      title: '导入样品试用单',
      concurrency: 5,
    });
    if (result.successCount > 0) {
      messageApi.success(`成功导入 ${result.successCount} 条样品试用单`);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    }
    if (result.failureCount > 0) {
      messageApi.warning(`部分失败 ${result.failureCount} 条`);
    }
  };

  const handleConvertToOrder = (record: SampleTrial) => {
    Modal.confirm({
      title: '转为销售订单',
      content: `确定要将样品试用单 "${record.trial_code}" 转为销售订单吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.convertToOrder(record.id!.toString());
          messageApi.success('转换成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '转换失败');
        }
      },
    });
  };

  const handleSubmit = (record: SampleTrial) => {
    Modal.confirm({
      title: '提交审核',
      content: `确定提交样品试用单 "${record.trial_code}" 吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.submit(String(record.id));
          messageApi.success('提交成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '提交失败');
        }
      },
    });
  };

  const handleWithdraw = (record: SampleTrial) => {
    Modal.confirm({
      title: '撤回提交',
      content: `确定撤回样品试用单 "${record.trial_code}" 到草稿吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.withdraw(String(record.id));
          messageApi.success('撤回成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '撤回失败');
        }
      },
    });
  };

  const handleApprove = (record: SampleTrial) => {
    Modal.confirm({
      title: '审核通过',
      content: `确定审核通过样品试用单 "${record.trial_code}" 吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.approve(String(record.id));
          messageApi.success('审核通过');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '审核失败');
        }
      },
    });
  };

  const handleReject = (record: SampleTrial) => {
    Modal.confirm({
      title: '审核驳回',
      content: `确定驳回样品试用单 "${record.trial_code}" 并退回草稿吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.reject(String(record.id));
          messageApi.success('已驳回并退回草稿');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '驳回失败');
        }
      },
    });
  };

  const handleOpenCreateOutbound = (record: SampleTrial) => {
    setCreateOutboundTrialId(record.id!);
    outboundFormRef.current?.resetFields();
    setCreateOutboundModalVisible(true);
  };

  const handlePushShipmentNotice = (record: SampleTrial) => {
    if (!record.sales_order_id) {
      messageApi.warning('请先转为销售订单，再下推发货通知单');
      return;
    }
    Modal.confirm({
      title: '下推发货通知单',
      content: `确定要基于销售订单 "${record.sales_order_code || record.sales_order_id}" 下推发货通知单吗？`,
      onOk: async () => {
        try {
          const res = await pushSalesOrderToShipmentNotice(record.sales_order_id!);
          messageApi.success(`下推成功：${res.notice_code || res.notice_id || ''}`);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '下推发货通知单失败');
        }
      },
    });
  };

  const handleCreateOutboundSubmit = async () => {
    if (!createOutboundTrialId) return;
    try {
      const values = await outboundFormRef.current?.validateFields();
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = wh?.name || wh?.warehouse_name || '';
      await sampleTrialApi.createOutbound(createOutboundTrialId.toString(), {
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
      });
      messageApi.success('样品出库单创建成功');
      setCreateOutboundModalVisible(false);
      setCreateOutboundTrialId(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.errorFields) messageApi.error('请选择出库仓库');
      else messageApi.error(error.message || '创建失败');
    }
  };

  const handlePrint = async (record: SampleTrial) => {
    try {
      const result = (await sampleTrialApi.print(record.id!.toString())) as DocumentPrintApiResult;
      if (isClientPdfmePrint(result)) {
        messageApi.warning(clientPdfmeListPrintMessage(result.message));
        return;
      }
      if (result?.success && result?.content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        }
      } else {
        messageApi.warning(result?.message || '打印功能暂未配置模板');
      }
    } catch {
      messageApi.error('打印失败');
    }
  };

  const defaultTrialItem = { material_id: undefined, material_code: '', material_name: '', material_spec: '', material_unit: '件', trial_quantity: 1, unit_price: 0 };

  const appendSampleTrialItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const rowFromMaterial = (m: Material) => ({
        ...defaultTrialItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? '件',
        unit_price: (m as any).defaults?.defaultSalePrice ?? (m as any).default_sale_price ?? 0,
      });
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const queue = selected.map(rowFromMaterial);
      const items = [...(formRef.current?.getFieldValue('items') ?? [])].map((row: any) => ({ ...row }));
      for (let i = 0; i < items.length && queue.length > 0; i++) {
        if (isEmptyItemRow(items[i])) {
          items[i] = queue.shift()!;
        }
      }
      while (queue.length > 0) {
        items.push(queue.shift()!);
      }
      formRef.current?.setFieldsValue({ items });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /**
   * 处理新建样品试用单
   * 参考销售订单：先打开弹窗，再请求 testGenerateCode 预填编号（不占用序号）
   */
  const handleCreate = async () => {
    formRef.current?.resetFields();
    setEditingId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultTrialItem] });
    }, 100);
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-sample-trial');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-sample-trial');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-sample-trial');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ trial_code: preview ?? '' });
        } catch (e) {
          console.warn('样品试用单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-sample-trial');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-sample-trial'));
      if (isAutoGenerateEnabled('kuaizhizao-sample-trial') && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ trial_code: preview ?? '' });
        } catch (e) {
          console.warn('样品试用单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    }
  };

  const getValidItems = (values: any) =>
    (values.items || []).filter((it: any) => it.material_id && (it.trial_quantity ?? 0) > 0);

  const handleCreateSubmit = async (values: any) => {
    const validItems = getValidItems(values);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    if (!cust) {
      messageApi.error('请选择客户');
      throw new Error('请选择客户');
    }
    let trialCode = values.trial_code;
    const ruleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-sample-trial');
    const autoGen = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-sample-trial');
    if (autoGen && ruleCode && (trialCode === previewCode || !trialCode)) {
      try {
        const codeResponse = await generateCode({ rule_code: ruleCode });
        trialCode = codeResponse.code;
      } catch (e) {
        console.warn('样品试用单编号正式生成失败，使用当前值:', e);
      }
    }
    try {
      await sampleTrialApi.create({
        trial_code: trialCode || undefined,
        customer_id: values.customer_id,
        customer_name: cust.name || cust.customer_name || cust.code,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        trial_purpose: values.trial_purpose,
        trial_period_start: values.trial_period_start ? dayjs(values.trial_period_start).format('YYYY-MM-DD') : undefined,
        trial_period_end: values.trial_period_end ? dayjs(values.trial_period_end).format('YYYY-MM-DD') : undefined,
        status: values.status || '草稿',
        notes: values.notes,
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit,
          trial_quantity: it.trial_quantity,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success('创建成功');
      setModalVisible(false);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    const validItems = getValidItems(values);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    try {
      await sampleTrialApi.update(editingId.toString(), {
        customer_id: values.customer_id,
        customer_name: cust?.name || cust?.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        trial_purpose: values.trial_purpose,
        trial_period_start: values.trial_period_start ? dayjs(values.trial_period_start).format('YYYY-MM-DD') : undefined,
        trial_period_end: values.trial_period_end ? dayjs(values.trial_period_end).format('YYYY-MM-DD') : undefined,
        status: values.status || '草稿',
        notes: values.notes,
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit,
          trial_quantity: it.trial_quantity,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success('更新成功');
      setModalVisible(false);
      setEditingId(null);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<SampleTrialDetail>[] = [
    { title: '试用单号', dataIndex: 'trial_code' },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '试用目的', dataIndex: 'trial_purpose', span: 3 },
    { title: '试用开始', dataIndex: 'trial_period_start', valueType: 'date' },
    { title: '试用结束', dataIndex: 'trial_period_end', valueType: 'date' },
    { title: '关联销售订单', dataIndex: 'sales_order_code' },
    { title: '关联出库单', dataIndex: 'other_outbound_code' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag {...resolveStatusTagDisplayProps(c)}>{c.text}</Tag>;
      },
    },
    { title: '备注', dataIndex: 'notes', span: 3 },
  ];

  const sampleTrialFormContent = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="trial_code"
            label={t('app.kuaizhizao.sampleTrial.fieldTrialCode') || '试用单号'}
            placeholder={isAutoGenerateEnabled('kuaizhizao-sample-trial') ? '编号将根据编号规则自动生成，可修改' : '请输入试用单号'}
            fieldProps={{ disabled: !!editingId }}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item
            name="customer_id"
            label={<span>{t('app.kuaizhizao.sampleTrial.fieldCustomer') || '客户'}</span>}
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <UniDropdown
              placeholder="请选择客户"
              showSearch
              allowClear
              loading={customersLoading}
              options={customerList.map((c: any) => ({
                value: c.id ?? c.customer_id,
                label: `${c.code ?? c.customer_code ?? ''} - ${c.name ?? c.customer_name ?? ''}`.trim() || String(c.id ?? c.customer_id),
              }))}
              onChange={(v) => {
                const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
                if (cust) {
                  formRef.current?.setFieldsValue({
                    customer_contact: cust.contactPerson ?? cust.contact ?? cust.customer_contact,
                    customer_phone: cust.phone ?? cust.customer_phone,
                  });
                }
              }}
              quickCreate={{ label: '快速新增客户', onClick: () => setCustomerModalVisible(true) }}
            />
          </ProForm.Item>
        </Col>
        <Col span={6}>
          <ProFormText name="customer_contact" label="联系人" placeholder="联系人" />
        </Col>
        <Col span={6}>
          <ProFormText name="customer_phone" label="电话" placeholder="电话" />
        </Col>
        <Col span={12}>
          <ProFormText name="trial_purpose" label="试用目的" placeholder="试用目的" />
        </Col>
        <Col span={6}>
          <ProFormDatePicker name="trial_period_start" label={t('app.kuaizhizao.sampleTrial.fieldStartDate') || '试用开始日期'} fieldProps={{ style: { width: '100%' } }} />
        </Col>
        <Col span={6}>
          <ProFormDatePicker name="trial_period_end" label={t('app.kuaizhizao.sampleTrial.fieldEndDate') || '试用结束日期'} fieldProps={{ style: { width: '100%' } }} />
        </Col>
      </Row>

      <div className="uni-table-detail" style={{ marginBottom: 24 }}>
        <div className="uni-table-detail-header">
          <span className="detail-title">
            <span className="required-mark">*</span>
            {t('app.kuaizhizao.sampleTrial.detailItems') || '明细'}
          </span>
          <div className="uni-table-detail-header-actions">
            <Button size="small" icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
              导入明细
            </Button>
          </div>
        </div>
        <ProForm.Item name="items" noStyle rules={[{ type: 'array' as const, min: 1, message: '请至少添加一条明细' }]}>
          <Form.List name="items">
          {(fields, { add, remove }) => {
            const cols = [
              {
                title: '物料',
                dataIndex: 'material_id',
                width: 260,
                render: (_: any, __: any, index: number) => <SampleTrialMaterialSelectCell index={index} />,
              },
              {
                title: '规格',
                dataIndex: 'material_spec',
                width: 120,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                    <Input placeholder="规格" size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '单位',
                dataIndex: 'material_unit',
                width: 100,
                render: (_: any, __: any, index: number) => (
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev: any, curr: any) =>
                      prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                    }
                  >
                    {({ getFieldValue }) => {
                      const materialId = getFieldValue(['items', index, 'material_id']);
                      return (
                        <Form.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                          <MaterialUnitSelect materialId={materialId} size="small" noStyle />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                ),
              },
              {
                title: '数量',
                dataIndex: 'trial_quantity',
                width: 100,
                align: 'right' as const,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'trial_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number' as const, min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                    <InputNumber placeholder="数量" min={0.01} precision={2} style={{ width: '100%' }} size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '单价',
                dataIndex: 'unit_price',
                width: 100,
                align: 'right' as const,
                render: (_: any, __: any, index: number) => (
                  <Form.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                    <InputNumber placeholder="单价" min={0} precision={2} style={{ width: '100%' }} size="small" />
                  </Form.Item>
                ),
              },
              {
                title: '金额',
                width: 120,
                align: 'right' as const,
                render: (_: any, __: any, index: number) => {
                  const row = formRef.current?.getFieldValue(['items', index]) || {};
                  const amt = (Number(row?.trial_quantity) || 0) * (Number(row?.unit_price) || 0);
                  return <AmountDisplay resource="sample_trial" value={amt} />;
                },
              },
              {
                title: '操作',
                width: 70,
                fixed: 'right' as const,
                onHeaderCell: () => ({ className: 'sample-trial-fixed-op-header' }),
                render: (_: any, __: any, index: number) => (
                  <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                    删除
                  </Button>
                ),
              },
            ];
            const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
            return (
              <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <style>{`
                  .sample-trial-detail-table .ant-table-thead > tr > th {
                    background-color: var(--ant-color-fill-alter) !important;
                    font-weight: 600;
                  }
                  .sample-trial-detail-table .ant-table-thead > tr > th.sample-trial-fixed-op-header {
                    background: var(--ant-color-fill-alter) !important;
                  }
                  .sample-trial-detail-table .ant-table-cell-fix-right {
                    background: var(--ant-color-bg-container) !important;
                  }
                  .sample-trial-detail-table .ant-table { border-top: 1px solid var(--ant-color-border); }
                  .sample-trial-detail-table .ant-table-tbody > tr > td { border-bottom: 1px solid var(--ant-color-border); }
                  .sample-trial-detail-table .sample-trial-material-cell .ant-form-item,
                  .sample-trial-detail-table .sample-trial-material-cell .ant-form-item-control,
                  .sample-trial-detail-table .sample-trial-material-cell .ant-form-item-control-input,
                  .sample-trial-detail-table .sample-trial-material-cell .ant-select {
                    width: 100% !important;
                    min-width: 0;
                  }
                `}</style>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <Table
                    className="sample-trial-detail-table"
                    size="small"
                    dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                    rowKey="key"
                    pagination={false}
                    columns={cols}
                    scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                    style={{ width: '100%', margin: 0 }}
                    footer={() => (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          style={{ flex: 1, minWidth: 120 }}
                          onClick={() => add({ ...defaultTrialItem })}
                        >
                          添加明细
                        </Button>
                        <Button
                          type="default"
                          icon={<AppstoreAddOutlined />}
                          style={{ flex: 1, minWidth: 120 }}
                          onClick={() => setMaterialPickerOpen(true)}
                        >
                          {t('app.kuaizhizao.common.materialBatchSelect')}
                        </Button>
                      </div>
                    )}
                  />
                </div>
              </div>
            );
          }}
          </Form.List>
        </ProForm.Item>
        <SampleTrialFormSummary />
      </div>
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes') || '备注'} fieldProps={{ rows: 2 }} />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="样品试用单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建样品试用"
          onCreate={handleCreate}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarRender={() => [
            <Space.Compact key={`batch-btn-${selectedRowKeys.length}`}>
              <Button
                disabled={selectedRowKeys.length === 0}
                danger
                onClick={() => handleBatchDelete(selectedRowKeys)}
              >
                <DeleteOutlined /> 批量删除
              </Button>
              <Dropdown
                disabled={selectedRowKeys.length === 0}
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'convert',
                      label: '批量转订单',
                      icon: <SwapOutlined />,
                      onClick: () => handleBatchConvertToOrder(selectedRowKeys),
                    },
                  ],
                }}
              >
                <Button danger icon={<ArrowDownOutlined />} />
              </Dropdown>
            </Space.Compact>,
          ]}
          showImportButton
          onImport={handleListImport}
          importHeaders={['试用单号', '客户名称', '试用目的', '开始日期', '结束日期', '状态', '物料编号', '数量', '单价', '备注']}
          importExampleRow={['TRIAL001', '客户A', '功能验证', '2026-04-01', '2026-04-15', '草稿', 'MAT001', '10', '100', '']}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await sampleTrialApi.list({ skip: 0, limit: 10000 });
              const rawData = Array.isArray(response) ? response : response?.items || response?.data || [];
              let items = rawData;
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: SampleTrial) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sample-trials-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const dr = params?.date_range as [unknown, unknown] | undefined;
              let startDate: string | undefined;
              let endDate: string | undefined;
              if (dr && Array.isArray(dr) && dr[0]) {
                startDate = dayjs(dr[0] as string | Date).format('YYYY-MM-DD');
                endDate = dr[1] ? dayjs(dr[1] as string | Date).format('YYYY-MM-DD') : startDate;
              }
              const response = await sampleTrialApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                customer_name: params.customer_name,
                trial_code: params.trial_code,
                trial_period_start: startDate,
                trial_period_end: endDate,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1400 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`样品试用详情${trialDetail?.trial_code ? ` - ${trialDetail.trial_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setTrialDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        dataSource={trialDetail || {}}
      >
        {trialDetail && (
          <>
            <DetailDrawerSection title="基本信息">
              <Descriptions column={3} size="small" items={detailColumns.map((col, idx) => {
                const key = String(col.dataIndex ?? idx);
                const raw = col.dataIndex ? (trialDetail as any)[col.dataIndex as string] : undefined;
                const value = col.render ? col.render(raw as any, trialDetail, idx, {} as any, col as any) : raw;
                return {
                  key,
                  label: col.title as React.ReactNode,
                  children: value ?? '-',
                  span: col.span ?? 1,
                };
              })} />
            </DetailDrawerSection>

            <DetailDrawerSection title="生命周期">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <UniLifecycleStepper
                  steps={getSampleTrialLifecycleStages(trialDetail)}
                  status={getSampleTrialLifecycle(trialDetail).status}
                  showLabels
                />
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--ant-color-border-secondary)' }}>
                  <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                    上下游单据
                  </div>
                  {trialTracking.data ? (
                    <DocumentTrackingRelationsBody data={trialTracking.data} />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无上下游关联" />
                  )}
                </div>
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title="明细信息">
              {trialDetail.items && trialDetail.items.length > 0 ? (
                <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                  <Table
                    size="small"
                    rowKey={(_, idx) => String(idx)}
                    tableLayout="fixed"
                    style={{ minWidth: 760 }}
                    columns={[
                      { title: '物料编号', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '单位', dataIndex: 'material_unit', width: 60 },
                      { title: '数量', dataIndex: 'trial_quantity', width: 90, align: 'right' },
                      {
                        title: '单价',
                        dataIndex: 'unit_price',
                        width: 90,
                        align: 'right',
                        render: (v: number) => <AmountDisplay resource="sample_trial" value={v} />,
                      },
                      {
                        title: '金额',
                        dataIndex: 'total_amount',
                        width: 100,
                        align: 'right',
                        render: (v: number) => <AmountDisplay resource="sample_trial" value={v} />,
                      },
                    ]}
                    dataSource={trialDetail.items}
                    pagination={false}
                  />
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="操作记录">
              {trialTracking.data ? (
                <DocumentTrackingTimelineBody data={trialTracking.data} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
              )}
            </DetailDrawerSection>
          </>
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title={editingId != null ? '编辑样品试用单' : '新建样品试用单'}
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditingId(null); setEffectiveRuleCode(null); setEffectiveAutoGen(null); }}
        onFinish={async (values) => {
          if (editingId != null) await handleEditSubmit(values);
          else await handleCreateSubmit(values);
        }}
        isEdit={editingId != null}
        formRef={formRef}
        width={1200}
        layout="vertical"
      >
        {sampleTrialFormContent}
      </FormModalTemplate>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendSampleTrialItemsFromMaterials}
      />

      <Modal
        title="创建样品出库"
        open={createOutboundModalVisible}
        onOk={handleCreateOutboundSubmit}
        onCancel={() => { setCreateOutboundModalVisible(false); setCreateOutboundTrialId(null); }}
        okText="确定"
      >
        <Form ref={outboundFormRef} layout="vertical">
          <Form.Item name="warehouse_id" label="出库仓库" rules={[{ required: true, message: '请选择出库仓库' }]}>
            <Select
              placeholder="请选择出库仓库"
              options={warehouseList.map((w: any) => ({ value: w.id ?? w.warehouse_id, label: w.name || w.warehouse_name || w.code }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="同步样品申请"
      />

      <CustomerFormModal
        open={customerModalVisible}
        editUuid={null}
        onClose={() => setCustomerModalVisible(false)}
        onSuccess={(newCust) => {
          setCustomerList(prev => [...prev, newCust]);
          formRef.current?.setFieldsValue({ customer_id: newCust.id });
          setCustomerModalVisible(false);
        }}
      />
      <UniImport
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onConfirm={handleItemImport}
        title="导入样品试用明细"
        headers={['物料编号', '数量', '单价', '备注']}
        exampleRow={['MAT001', '10', '1.5', '试用备注']}
      />
    </>
  );
};

export default SampleTrialsPage;
