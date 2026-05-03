/**
 * 全链路节点点击后的关联单据简览：基本信息 + 明细表（按需拉取详情接口）
 */

import React, { useMemo } from 'react';
import { Descriptions, Empty, Spin, Table, Typography, Button, Space, Divider, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { getQuotation } from '../../apps/kuaizhizao/services/quotation';
import { getSalesOrder } from '../../apps/kuaizhizao/services/sales-order';
import { getDemand } from '../../apps/kuaizhizao/services/demand';
import { getDemandComputation } from '../../apps/kuaizhizao/services/demand-computation';
import { workOrderApi } from '../../apps/kuaizhizao/services/production';
import { getPurchaseOrder } from '../../apps/kuaizhizao/services/purchase';
import { AmountDisplay } from '../permission';
import { getMaterialUnitDisplayMapShared, resolveMaterialUnitLabel } from '../../utils/materialUnitDisplay';
import { getStatusLabel } from '../../apps/kuaizhizao/constants/documentStatus';
import { getDemandBusinessModeLabel } from '../../apps/kuaizhizao/utils/businessMode';
import { getDemandTypeLabel } from '../../apps/kuaizhizao/utils/demandType';
import { getDemandComputationLifecycle } from '../../apps/kuaizhizao/utils/demandComputationLifecycle';

const { useToken } = theme;

export interface TraceLinkedDocumentBriefProps {
  documentType?: string;
  documentId?: number;
  /** 在销售订单简览中打开宿主详情抽屉（如报价单页的关联订单抽屉） */
  onOpenSalesOrderDetail?: (id: number) => void;
  /** 嵌入 Modal 时隐藏顶部类型标题与内联「打开销售订单」链式按钮，由外层底部操作区承接 */
  compactChrome?: boolean;
}

interface BriefModel {
  basics: { key: string; label: string; value: React.ReactNode }[];
  columns: ColumnsType<Record<string, unknown>>;
  rows: Record<string, unknown>[];
}

function dash(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/** 主状态码 / 中文态 → 与列表、详情一致的展示文案（依赖 enums 缓存 + fallback） */
function briefDocStatus(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  const label = getStatusLabel(String(raw).trim());
  return label === '-' ? '—' : label;
}

function briefComputationStatus(c: {
  computation_status?: string;
  lifecycle?: unknown;
}): string {
  const lc = getDemandComputationLifecycle(c);
  const name = (lc.stageName ?? '').trim();
  if (name && name !== '-') return name;
  return briefDocStatus(c.computation_status);
}

function briefMaterialSourceType(raw: unknown): string {
  const map: Record<string, string> = {
    Make: '自制',
    Buy: '采购',
    Phantom: '虚拟',
    Outsource: '委外',
    Configure: '配置',
  };
  const t = String(raw ?? '').trim();
  if (!t) return '—';
  return map[t] ?? t;
}

function briefBusinessMode(raw: unknown): string {
  const s = getDemandBusinessModeLabel(raw === null || raw === undefined ? undefined : String(raw));
  return s === '-' ? '—' : s;
}

async function loadBrief(documentType: string, documentId: number): Promise<BriefModel> {
  const unitMap = await getMaterialUnitDisplayMapShared();
  const unitCell = (code: unknown) => {
    const s = resolveMaterialUnitLabel(code, unitMap);
    return s === '' ? '—' : s;
  };

  switch (documentType) {
    case 'quotation': {
      const q = await getQuotation(documentId, true);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(q.quotation_code) },
        { key: 'customer', label: '客户', value: dash(q.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(q.status) },
        { key: 'date', label: '报价日期', value: dash(q.quotation_date) },
        { key: 'amount', label: '总金额', value: q.total_amount != null ? <AmountDisplay resource="sales_order" value={Number(q.total_amount)} /> : '—' },
      ];
      const rows = (q.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.quote_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.total_amount ?? (Number(it.quote_quantity || 0) * Number(it.unit_price || 0) || undefined),
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="sales_order" value={Number(v)} /> : '—',
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="sales_order" value={Number(v)} /> : '—',
        },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'sales_order': {
      const o = await getSalesOrder(documentId, true, false);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(o.order_code) },
        { key: 'customer', label: '客户', value: dash(o.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(o.status) },
        { key: 'date', label: '订单日期', value: dash(o.order_date) },
        { key: 'amount', label: '总金额', value: o.total_amount != null ? <AmountDisplay resource="sales_order" value={Number(o.total_amount)} /> : '—' },
      ];
      const rows = (o.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.required_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.item_amount,
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="sales_order" value={Number(v)} /> : '—',
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="sales_order" value={Number(v)} /> : '—',
        },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'demand': {
      const d = await getDemand(documentId, true, false);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(d.demand_code) },
        { key: 'type', label: '需求类型', value: dash(getDemandTypeLabel(d.demand_type)) },
        { key: 'customer', label: '客户', value: dash(d.customer_name) },
        { key: 'status', label: '状态', value: briefDocStatus(d.status) },
        { key: 'delivery', label: '交期', value: dash(d.delivery_date) },
      ];
      const rows = (d.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.required_quantity,
        unit: unitCell(it.material_unit),
        unit_price: it.unit_price,
        amount: it.item_amount,
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="sales_order" value={Number(v)} /> : '—',
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="sales_order" value={Number(v)} /> : '—',
        },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'demand_computation': {
      const c = await getDemandComputation(documentId, true);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '计算单号', value: dash(c.computation_code) },
        { key: 'demand', label: '需求', value: dash(c.demand_code) },
        { key: 'status', label: '状态', value: briefComputationStatus(c) },
        { key: 'mode', label: '业务模式', value: briefBusinessMode(c.business_mode) },
      ];
      const rows = (c.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        net_requirement: it.net_requirement,
        unit: unitCell(it.material_unit),
        source: briefMaterialSourceType(it.material_source_type),
        delivery_date: it.delivery_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '净需求',
          dataIndex: 'net_requirement',
          width: 96,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        { title: '来源', dataIndex: 'source', width: 88 },
        { title: '交期', dataIndex: 'delivery_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    case 'work_order': {
      const w = await workOrderApi.get(String(documentId));
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '工单号', value: dash(w.code) },
        { key: 'name', label: '名称', value: dash(w.name) },
        { key: 'product', label: '产品', value: dash(w.product_name ?? w.product_code) },
        { key: 'status', label: '状态', value: briefDocStatus(w.status) },
        { key: 'qty', label: '数量', value: w.quantity != null ? String(w.quantity) : '—' },
        { key: 'so', label: '销售订单', value: dash(w.sales_order_code) },
      ];
      const rows = [
        {
          key: 'wo-product',
          material_code: w.product_code,
          material_name: w.product_name,
          qty: w.quantity,
        },
      ];
      const columns: BriefModel['columns'] = [
        { title: '产品编码', dataIndex: 'material_code', ellipsis: true },
        { title: '产品名称', dataIndex: 'material_name', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 120,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
      ];
      return { basics, columns, rows };
    }
    case 'purchase_order': {
      const p = await getPurchaseOrder(documentId);
      const basics: BriefModel['basics'] = [
        { key: 'code', label: '单据编号', value: dash(p.order_code) },
        { key: 'supplier', label: '供应商', value: dash(p.supplier_name) },
        { key: 'status', label: '状态', value: briefDocStatus(p.status) },
        { key: 'date', label: '订单日期', value: dash(p.order_date) },
        {
          key: 'amount',
          label: '总金额',
          value: p.total_amount != null ? <AmountDisplay resource="purchase_order" value={Number(p.total_amount)} /> : '—',
        },
      ];
      const rows = (p.items ?? []).map((it, i) => ({
        key: String(it.id ?? i),
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        qty: it.ordered_quantity,
        unit: unitCell(it.unit),
        unit_price: it.unit_price,
        amount: it.total_price,
        required_date: it.required_date,
      }));
      const columns: BriefModel['columns'] = [
        { title: '物料编码', dataIndex: 'material_code', ellipsis: true },
        { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
        { title: '规格', dataIndex: 'material_spec', ellipsis: true },
        {
          title: '数量',
          dataIndex: 'qty',
          width: 88,
          render: (v: number) => (v != null ? Number(v).toFixed(4).replace(/\.?0+$/, '') : '—'),
        },
        { title: '单位', dataIndex: 'unit', width: 64 },
        {
          title: '单价',
          dataIndex: 'unit_price',
          width: 96,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="purchase_order" value={Number(v)} /> : '—',
        },
        {
          title: '金额',
          dataIndex: 'amount',
          width: 104,
          render: (v: number) =>
            v != null ? <AmountDisplay resource="purchase_order" value={Number(v)} /> : '—',
        },
        { title: '要求到货', dataIndex: 'required_date', width: 108, render: (v: string) => dash(v) },
      ];
      return { basics, columns, rows };
    }
    default:
      throw new Error(`unsupported:${documentType}`);
  }
}

export const TraceLinkedDocumentBrief: React.FC<TraceLinkedDocumentBriefProps> = ({
  documentType,
  documentId,
  onOpenSalesOrderDetail,
  compactChrome = false,
}) => {
  const { t } = useTranslation();
  const { token } = useToken();

  const ready = Boolean(documentType && documentId != null && documentId > 0);

  const { data, loading, error } = useRequest(() => loadBrief(documentType!, documentId!), {
    ready,
    refreshDeps: [documentType, documentId],
  });

  const typeTitle = useMemo(() => {
    if (!documentType) return '';
    return t(`components.documentTrackingPanel.docType.${documentType}`, {
      defaultValue: documentType,
    });
  }, [documentType, t]);

  if (!ready) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 12px',
          boxSizing: 'border-box',
        }}
      >
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('components.documentTrackingPanel.traceBriefSelectNode')} />
      </div>
    );
  }

  const unsupported =
    error && typeof (error as Error)?.message === 'string' && (error as Error).message.startsWith('unsupported:');

  if (unsupported || (error && !loading && !data)) {
    return (
      <div style={{ padding: '16px 0' }}>
        <Empty
          description={
            unsupported
              ? t('components.documentTrackingPanel.traceBriefUnsupported', { type: typeTitle })
              : t('components.documentTrackingPanel.traceBriefLoadFailed')
          }
        />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: compactChrome ? 0 : 8 }}>
      {!compactChrome ? (
        <Space align="center" style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }} wrap>
          <Typography.Text strong style={{ fontSize: 13, color: token.colorText }}>
            {typeTitle}
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              #{documentId}
            </Typography.Text>
          </Typography.Text>
          {documentType === 'sales_order' && onOpenSalesOrderDetail ? (
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenSalesOrderDetail(documentId!)}>
              {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
            </Button>
          ) : null}
        </Space>
      ) : null}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : data ? (
        <>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            {t('components.documentTrackingPanel.traceBriefBasic')}
          </Typography.Text>
          <Descriptions size="small" column={2} bordered styles={{ label: { width: 96 } }}>
            {data.basics.map((row) => (
              <Descriptions.Item key={row.key} label={row.label}>
                {row.value}
              </Descriptions.Item>
            ))}
          </Descriptions>

          <Divider style={{ margin: '12px 0' }} />

          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            {t('components.documentTrackingPanel.traceBriefItems')}
          </Typography.Text>
          <Table<Record<string, unknown>>
            size="small"
            rowKey="key"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={data.columns}
            dataSource={data.rows}
            locale={{ emptyText: t('components.documentTrackingPanel.traceBriefNoItems') }}
          />
        </>
      ) : null}
    </div>
  );
};
