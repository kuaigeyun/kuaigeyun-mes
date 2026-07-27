/**
 * 报工弹窗：工单计划 / 累计料损 / 补料 / 已报合格数 / 剩余可报 / 物料剩余 / 本次可报
 */

import React, { useMemo } from 'react';
import { Col, Row, Statistic, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getReportableQuantityBreakdown,
  getWorkOrderMaterialLossTotal,
} from '../utils/workOrderReporting';
import { warehouseApi } from '../services/warehouse-execution';
import { convertBaseQtyToProductionDisplay } from '../../../utils/materialScenarioUnit';

export interface ReportableQuantityPanelProps {
  operation: any;
  /** 工单计划数量（基础单位） */
  workOrderQuantity: number;
  operations?: any[];
  workOrderId?: number;
  /** 生产场景展示单位；与基础单位不同时，面板数值按生产单位展示 */
  unitContext?: {
    product_unit?: string;
    productUnit?: string;
    base_unit?: string;
    baseUnit?: string;
    unit_to_base_factor?: number;
    unitToBaseFactor?: number;
  };
}

const ReportableQuantityPanel: React.FC<ReportableQuantityPanelProps> = ({
  operation,
  workOrderQuantity,
  operations = [],
  workOrderId,
  unitContext,
}) => {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const { planRemaining, materialRemaining, effectiveRemaining } =
    getReportableQuantityBreakdown(operation, workOrderQuantity);

  const toDisplay = (baseQty: number) =>
    unitContext ? convertBaseQtyToProductionDisplay(baseQty, unitContext) : baseQty;

  const unitSuffix = (() => {
    const productUnit = String(unitContext?.product_unit ?? unitContext?.productUnit ?? '').trim();
    const baseUnit = String(unitContext?.base_unit ?? unitContext?.baseUnit ?? '').trim();
    return productUnit && baseUnit && productUnit !== baseUnit ? ` ${productUnit}` : '';
  })();

  const operationQualified =
    Number(operation?.qualified_quantity ?? operation?.qualifiedQuantity ?? 0) || 0;

  const cumulativeLoss = useMemo(
    () => getWorkOrderMaterialLossTotal(operations),
    [operations],
  );

  const { data: replenishmentQty = 0 } = useQuery({
    queryKey: ['woReplenishmentQty', workOrderId],
    enabled: workOrderId != null,
    queryFn: async () => {
      const res = await warehouseApi.materialCall.list({ work_order_id: workOrderId, limit: 200 });
      const rows = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
      return rows
        .filter(
          (c: any) =>
            String(c.call_reason ?? '') === 'SCRAP_REPLENISH' &&
            String(c.status ?? '') !== 'cancelled',
        )
        .reduce((sum: number, c: any) => sum + (Number(c.delivered_quantity) || 0), 0);
    },
    staleTime: 0,
  });

  const statTitleStyle: React.CSSProperties = {
    fontSize: 11,
    color: token.colorTextSecondary,
    fontWeight: 400,
    whiteSpace: 'nowrap',
  };
  const statValueStyle: React.CSSProperties = {
    color: token.colorText,
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.2,
  };

  const metrics: Array<{ key: string; title: string; value: number | string; valueStyle?: React.CSSProperties }> = [
    {
      key: 'plan',
      title: t('apps.kuaizhizao.workOrder.quickReport.workOrderPlanQty'),
      value: `${toDisplay(workOrderQuantity)}${unitSuffix}`,
    },
    {
      key: 'loss',
      title: t('apps.kuaizhizao.workOrder.quickReport.cumulativeMaterialLoss'),
      value: `${toDisplay(cumulativeLoss)}${unitSuffix}`,
      valueStyle: {
        color: cumulativeLoss > 0 ? token.colorError : token.colorTextTertiary,
      },
    },
    {
      key: 'replenish',
      title: t('apps.kuaizhizao.workOrder.quickReport.replenishmentQty'),
      value: `${toDisplay(replenishmentQty)}${unitSuffix}`,
      valueStyle: {
        color: replenishmentQty > 0 ? token.colorWarning : token.colorTextTertiary,
      },
    },
    {
      key: 'qualified',
      title: t('apps.kuaizhizao.workOrder.quickReport.reportedQualifiedQty'),
      value: `${toDisplay(operationQualified)}${unitSuffix}`,
    },
    {
      key: 'planRemaining',
      title: t('apps.kuaizhizao.workOrder.quickReport.planRemainingTitle'),
      value: `${toDisplay(planRemaining)}${unitSuffix}`,
    },
    {
      key: 'materialRemaining',
      title: t('apps.kuaizhizao.workOrder.quickReport.materialRemainingTitle'),
      value:
        materialRemaining == null
          ? '—'
          : `${toDisplay(materialRemaining)}${unitSuffix}`,
    },
    {
      key: 'effective',
      title: t('apps.kuaizhizao.workOrder.quickReport.effectiveReportableTitle'),
      value: `${toDisplay(effectiveRemaining)}${unitSuffix}`,
      valueStyle: { color: token.colorPrimary },
    },
  ];

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: token.borderRadiusLG,
        background: token.colorFillAlter,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Row gutter={8} wrap={false} align="top">
        {metrics.map((m) => (
          <Col key={m.key} flex="1 1 0" style={{ minWidth: 0 }}>
            <Statistic
              title={<span style={statTitleStyle}>{m.title}</span>}
              value={m.value}
              styles={{ content: {...statValueStyle, ...m.valueStyle } }}
            />
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default ReportableQuantityPanel;
