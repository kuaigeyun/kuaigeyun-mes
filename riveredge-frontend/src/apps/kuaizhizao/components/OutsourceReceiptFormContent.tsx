/**
 * 委外收货表单内容：自动带出委外产品待收明细（与委外发料样式对应）
 */
import React from 'react';
import { Divider, InputNumber, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

export type OutsourceReceiptLine = {
  key: number;
  productId?: number;
  productCode: string;
  productName: string;
  unit: string;
  orderedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  receiptQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
};

export type OutsourceReceiptWorkOrderBrief = {
  id?: number;
  code?: string;
  productId?: number;
  product_id?: number;
  productCode?: string;
  product_code?: string;
  productName?: string;
  product_name?: string;
  quantity?: number;
  receivedQuantity?: number;
  received_quantity?: number;
  unit?: string;
};

interface OutsourceReceiptFormContentProps {
  workOrder: OutsourceReceiptWorkOrderBrief;
  line: OutsourceReceiptLine | null;
  onLineChange: (line: OutsourceReceiptLine) => void;
}

function num(v: unknown, digits = 2): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : '-';
}

export function buildReceiptLineFromWorkOrder(wo: OutsourceReceiptWorkOrderBrief): OutsourceReceiptLine {
  const ordered = Number(wo.quantity || 0);
  const received = Number(wo.receivedQuantity ?? wo.received_quantity ?? 0);
  const pending = Math.max(0, ordered - received);
  const pid = Number(wo.productId ?? wo.product_id ?? 0);
  return {
    key: pid || Number(wo.id || 0),
    productId: pid || undefined,
    productCode: String(wo.productCode ?? wo.product_code ?? ''),
    productName: String(wo.productName ?? wo.product_name ?? ''),
    unit: String(wo.unit ?? '件'),
    orderedQuantity: ordered,
    receivedQuantity: received,
    pendingQuantity: pending,
    receiptQuantity: pending,
    qualifiedQuantity: pending,
    unqualifiedQuantity: 0,
  };
}

const OutsourceReceiptFormContent: React.FC<OutsourceReceiptFormContentProps> = ({
  workOrder,
  line,
  onLineChange,
}) => {
  const updateLine = (patch: Partial<OutsourceReceiptLine>) => {
    if (!line) return;
    const next = { ...line, ...patch };
    if (patch.receiptQuantity != null && patch.qualifiedQuantity == null && patch.unqualifiedQuantity == null) {
      const unqualified = Number(next.unqualifiedQuantity || 0);
      next.qualifiedQuantity = Math.max(0, Number(patch.receiptQuantity) - unqualified);
    }
    if (patch.qualifiedQuantity != null || patch.unqualifiedQuantity != null) {
      next.receiptQuantity = Number(next.qualifiedQuantity || 0) + Number(next.unqualifiedQuantity || 0);
    }
    onLineChange(next);
  };

  const columns: ColumnsType<OutsourceReceiptLine> = [
    {
      title: '产品编码',
      dataIndex: 'productCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 160,
      ellipsis: true,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 56,
      align: 'center',
    },
    {
      title: '委外数量',
      dataIndex: 'orderedQuantity',
      width: 96,
      align: 'right',
      render: (_, r) => num(r.orderedQuantity),
    },
    {
      title: '已收',
      dataIndex: 'receivedQuantity',
      width: 80,
      align: 'right',
      render: (_, r) => num(r.receivedQuantity),
    },
    {
      title: '待收',
      dataIndex: 'pendingQuantity',
      width: 80,
      align: 'right',
      render: (_, r) => (
        <Typography.Text type={r.pendingQuantity > 0 ? 'warning' : undefined}>
          {num(r.pendingQuantity)}
        </Typography.Text>
      ),
    },
    {
      title: '本次收货',
      dataIndex: 'receiptQuantity',
      width: 110,
      align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          max={r.pendingQuantity > 0 ? r.pendingQuantity : undefined}
          precision={2}
          value={r.receiptQuantity}
          disabled={r.pendingQuantity <= 0}
          style={{ width: '100%' }}
          onChange={(v) => updateLine({ receiptQuantity: Number(v ?? 0) })}
        />
      ),
    },
    {
      title: '合格',
      dataIndex: 'qualifiedQuantity',
      width: 100,
      align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          max={r.receiptQuantity}
          precision={2}
          value={r.qualifiedQuantity}
          disabled={r.pendingQuantity <= 0}
          style={{ width: '100%' }}
          onChange={(v) => updateLine({ qualifiedQuantity: Number(v ?? 0) })}
        />
      ),
    },
    {
      title: '不合格',
      dataIndex: 'unqualifiedQuantity',
      width: 100,
      align: 'right',
      fixed: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          max={r.receiptQuantity}
          precision={2}
          value={r.unqualifiedQuantity}
          disabled={r.pendingQuantity <= 0}
          style={{ width: '100%' }}
          onChange={(v) => updateLine({ unqualifiedQuantity: Number(v ?? 0) })}
        />
      ),
    },
  ];

  const ordered = Number(workOrder.quantity || 0);
  const received = Number(workOrder.receivedQuantity ?? workOrder.received_quantity ?? 0);
  const pending = Math.max(0, ordered - received);

  return (
    <>
      <Divider style={{ margin: '12px 0' }}>工单委外信息</Divider>
      <div style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <div><strong>工单委外编号：</strong>{workOrder.code ?? '-'}</div>
        <div><strong>产品名称：</strong>{workOrder.productName || workOrder.product_name || '-'}</div>
        <div><strong>委外数量：</strong>{num(ordered)}</div>
        <div><strong>已收货数量：</strong>{num(received)}</div>
        <div><strong>待收数量：</strong>{num(pending)}</div>
      </div>

      <Divider style={{ margin: '12px 0' }}>待收产品明细</Divider>
      <Table<OutsourceReceiptLine>
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={line ? [line] : []}
        pagination={false}
        scroll={{ x: 920 }}
        locale={{ emptyText: '无可收产品' }}
      />
    </>
  );
};

export default OutsourceReceiptFormContent;
