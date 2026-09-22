/**
 * 将成本明细、趋势、breakdown 等 JSON 结构化为表格 / 描述列表，避免整页 raw JSON。
 * 快智造 / 快财务成本页共用。字段标题走 i18n，禁止把英文 key 直接当表头。
 */

import React, { useCallback, useMemo } from 'react';
import { Table, Empty, Typography, Descriptions, Collapse } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatCurrencyAmount } from '../../utils/format';

const STRUCTURED_COST_MAX_DEPTH = 4;

/** 已知字段 → i18n key 后缀（前缀 app.kuaicaiwu.structuredCost.field.） */
const COST_FIELD_I18N_SUFFIX: Record<string, string> = {
  date: 'date',
  material_cost: 'materialCost',
  labor_cost: 'laborCost',
  manufacturing_cost: 'manufacturingCost',
  total_cost: 'totalCost',
  unit_cost: 'unitCost',
  quantity: 'quantity',
  code: 'code',
  name: 'name',
  amount: 'amount',
  price: 'price',
  total: 'total',
  hours: 'hours',
  item: 'item',
  material_cost_breakdown: 'materialCostBreakdown',
  labor_cost_breakdown: 'laborCostBreakdown',
  manufacturing_cost_breakdown: 'manufacturingCostBreakdown',
  operation_name: 'operationName',
  standard_time_hours: 'standardTimeHours',
  hourly_rate: 'hourlyRate',
  overhead_rate: 'overheadRate',
  work_center_id: 'workCenterId',
  worker_name: 'workerName',
  rule_name: 'ruleName',
  calculation_method: 'calculationMethod',
  ratio: 'ratio',
  base_material_cost: 'baseMaterialCost',
  source: 'source',
  unit_price: 'unitPrice',
  material_code: 'materialCode',
  material_name: 'materialName',
};

/** 明细行内已知枚举/文案值 → i18n */
const COST_VALUE_I18N: Record<string, string> = {
  按工时: 'app.kuaicaiwu.structuredCost.value.byHours',
  按比例: 'app.kuaicaiwu.structuredCost.value.byRatio',
  历史报工工时: 'app.kuaicaiwu.structuredCost.value.historicalReportingHours',
  工得分摊制造费用: 'app.kuaicaiwu.structuredCost.value.laborHoursOverheadAllocation',
};

function isPlainCostRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMoneyLikeKey(key: string): boolean {
  return /cost|amount|price|fee|total|unit_cost|tax|discount|rate/i.test(key) && !/hours|ratio|quantity/i.test(key);
}

export interface StructuredCostDataViewProps {
  data: unknown;
  emptyDescription?: string;
  depth?: number;
}

export const StructuredCostDataView: React.FC<StructuredCostDataViewProps> = ({
  data,
  emptyDescription,
  depth = 0,
}) => {
  const { t } = useTranslation();
  const emptyText = emptyDescription ?? t('app.kuaicaiwu.structuredCost.empty');

  const costFieldTitle = useCallback(
    (key: string): string => {
      const suffix = COST_FIELD_I18N_SUFFIX[key];
      if (suffix) {
        return t(`app.kuaicaiwu.structuredCost.field.${suffix}`);
      }
      return key;
    },
    [t],
  );

  const renderScalarCostField = useCallback(
    (key: string, val: unknown): React.ReactNode => {
      if (val === null || val === undefined) return '-';
      if (typeof val === 'boolean') return val ? t('common.yes') : t('common.no');
      if (typeof val === 'number' && Number.isFinite(val)) {
        if (isMoneyLikeKey(key)) {
          return formatCurrencyAmount(val);
        }
        return val.toLocaleString(undefined, { maximumFractionDigits: 6 });
      }
      if (typeof val === 'string') {
        const valueKey = COST_VALUE_I18N[val];
        if (valueKey) return t(valueKey);
        const n = Number(val);
        if (val.trim() !== '' && !Number.isNaN(n) && isMoneyLikeKey(key)) {
          return formatCurrencyAmount(n);
        }
        return val;
      }
      return String(val);
    },
    [t],
  );

  const sortedKeys = useMemo(() => {
    return (keys: string[]) =>
      [...keys].sort((a, b) => {
        if (a === 'date') return -1;
        if (b === 'date') return 1;
        return a.localeCompare(b);
      });
  }, []);

  if (data === null || data === undefined) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
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
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
    }
    const allObjects = data.every((row) => isPlainCostRecord(row));
    if (allObjects) {
      const rows = data as Record<string, unknown>[];
      const keySet = new Set<string>();
      rows.forEach((row) => Object.keys(row).forEach((k) => keySet.add(k)));
      const keys = sortedKeys(Array.from(keySet));
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
