/**
 * 将成本明细、趋势、breakdown 等 JSON 结构化为表格 / 描述列表，避免整页 raw JSON。
 * 快智造 / 快财务成本页共用。
 */

import React from 'react';
import { Table, Empty, Typography, Descriptions, Collapse } from 'antd';

const STRUCTURED_COST_MAX_DEPTH = 4;

const COST_FIELD_LABELS: Record<string, string> = {
  date: '核算日期',
  material_cost: '材料成本',
  labor_cost: '人工成本',
  manufacturing_cost: '制造费用',
  total_cost: '总成本',
  unit_cost: '单位成本',
  quantity: '数量',
  code: '编码',
  name: '名称',
  amount: '金额',
  price: '单价',
};

function isPlainCostRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function costFieldTitle(key: string): string {
  return COST_FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

function isMoneyLikeKey(key: string): boolean {
  return /cost|amount|price|fee|total|unit_cost|tax|discount/i.test(key);
}

function renderScalarCostField(key: string, val: unknown): React.ReactNode {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? '是' : '否';
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (isMoneyLikeKey(key)) {
      return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return val.toLocaleString('zh-CN', { maximumFractionDigits: 6 });
  }
  if (typeof val === 'string') {
    const n = Number(val);
    if (val.trim() !== '' && !Number.isNaN(n) && isMoneyLikeKey(key)) {
      return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return val;
  }
  return String(val);
}

export interface StructuredCostDataViewProps {
  data: unknown;
  emptyDescription?: string;
  depth?: number;
}

export const StructuredCostDataView: React.FC<StructuredCostDataViewProps> = ({
  data,
  emptyDescription = '暂无数据',
  depth = 0,
}) => {
  if (data === null || data === undefined) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />;
  }
  if (depth > STRUCTURED_COST_MAX_DEPTH) {
    return (
      <Typography.Paragraph copyable style={{ marginBottom: 0 }}>
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
      </Typography.Paragraph>
    );
  }
  const nextDepth = depth + 1;

  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return <Typography.Text>{String(data)}</Typography.Text>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />;
    }
    const allObjects = data.every((row) => isPlainCostRecord(row));
    if (allObjects) {
      const rows = data as Record<string, unknown>[];
      const keySet = new Set<string>();
      rows.forEach((row) => Object.keys(row).forEach((k) => keySet.add(k)));
      const keys = Array.from(keySet).sort((a, b) => {
        if (a === 'date') return -1;
        if (b === 'date') return 1;
        return a.localeCompare(b);
      });
      const columns = keys.map((k) => ({
        title: costFieldTitle(k),
        dataIndex: k,
        key: k,
        ellipsis: true,
        render: (v: unknown) => {
          if (isPlainCostRecord(v) || Array.isArray(v)) {
            return <StructuredCostDataView data={v} depth={nextDepth} />;
          }
          return renderScalarCostField(k, v);
        },
      }));
      return (
        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={columns}
          dataSource={rows}
        />
      );
    }
    return (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {data.map((item, idx) => (
          <li key={idx}>
            <StructuredCostDataView data={item} depth={nextDepth} />
          </li>
        ))}
      </ul>
    );
  }

  if (isPlainCostRecord(data)) {
    const entries = Object.entries(data);
    const allScalars = entries.every(([, v]) => !isPlainCostRecord(v) && !Array.isArray(v));
    if (allScalars) {
      return (
        <Descriptions size="small" column={1} bordered>
          {entries.map(([k, v]) => (
            <Descriptions.Item key={k} label={costFieldTitle(k)}>
              {renderScalarCostField(k, v)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      );
    }
    return (
      <Collapse size="small" ghost>
        {entries.map(([k, v]) => (
          <Collapse.Panel header={costFieldTitle(k)} key={k}>
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              <StructuredCostDataView data={v} depth={nextDepth} />
            </div>
          </Collapse.Panel>
        ))}
      </Collapse>
    );
  }

  return <Typography.Text type="secondary">—</Typography.Text>;
};
