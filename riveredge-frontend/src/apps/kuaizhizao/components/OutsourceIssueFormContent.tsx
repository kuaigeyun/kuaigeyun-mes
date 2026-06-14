/**
 * 委外发料表单内容：从 BOM 自动读取待发物料明细表
 */
import React from 'react';
import { Alert, Divider, InputNumber, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

export type OutsourceIssueLine = {
  key: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  requiredQuantity: number;
  issuedQuantity: number;
  pendingQuantity: number;
  availableQuantity: number;
  issueQuantity: number;
};

export type OutsourceIssueWorkOrderBrief = {
  id?: number;
  code?: string;
  productName?: string;
  product_name?: string;
  quantity?: number;
};

interface OutsourceIssueFormContentProps {
  workOrder: OutsourceIssueWorkOrderBrief;
  lines: OutsourceIssueLine[];
  onLinesChange: (lines: OutsourceIssueLine[]) => void;
  loading?: boolean;
  previewMessage?: string | null;
}

function num(v: unknown, digits = 2): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : '-';
}

const OutsourceIssueFormContent: React.FC<OutsourceIssueFormContentProps> = ({
  workOrder,
  lines,
  onLinesChange,
  loading,
  previewMessage,
}) => {
  const updateLineQty = (materialId: number, issueQuantity: number) => {
    onLinesChange(
      lines.map((l) => (l.materialId === materialId ? { ...l, issueQuantity } : l)),
    );
  };

  const columns: ColumnsType<OutsourceIssueLine> = [
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
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
      title: '需求数量',
      dataIndex: 'requiredQuantity',
      width: 96,
      align: 'right',
      render: (_, r) => num(r.requiredQuantity),
    },
    {
      title: '已发',
      dataIndex: 'issuedQuantity',
      width: 80,
      align: 'right',
      render: (_, r) => num(r.issuedQuantity),
    },
    {
      title: '待发',
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
      title: '可用库存',
      dataIndex: 'availableQuantity',
      width: 96,
      align: 'right',
      render: (_, r) => num(r.availableQuantity),
    },
    {
      title: '本次发料',
      dataIndex: 'issueQuantity',
      width: 120,
      align: 'right',
      fixed: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          max={r.pendingQuantity > 0 ? r.pendingQuantity : undefined}
          precision={2}
          value={r.issueQuantity}
          disabled={r.pendingQuantity <= 0}
          style={{ width: '100%' }}
          onChange={(v) => updateLineQty(r.materialId, Number(v ?? 0))}
        />
      ),
    },
  ];

  return (
    <>
      <Divider style={{ margin: '12px 0' }}>工单委外信息</Divider>
      <div style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <div><strong>工单委外编号：</strong>{workOrder.code ?? '-'}</div>
        <div><strong>产品名称：</strong>{workOrder.productName || workOrder.product_name || '-'}</div>
        <div><strong>委外数量：</strong>{workOrder.quantity != null ? num(workOrder.quantity) : '-'}</div>
      </div>

      <Divider style={{ margin: '12px 0' }}>待发物料明细（来自 BOM）</Divider>
      {previewMessage && (
        <Alert type="warning" showIcon title={previewMessage} style={{ marginBottom: 12 }} />
      )}
      <Spin spinning={!!loading}>
        <Table<OutsourceIssueLine>
          size="small"
          rowKey="materialId"
          columns={columns}
          dataSource={lines}
          pagination={false}
          scroll={{ x: 900, y: 280 }}
          locale={{ emptyText: loading ? '加载中…' : '暂无待发物料，请检查产品 BOM' }}
        />
      </Spin>
    </>
  );
};

export default OutsourceIssueFormContent;
