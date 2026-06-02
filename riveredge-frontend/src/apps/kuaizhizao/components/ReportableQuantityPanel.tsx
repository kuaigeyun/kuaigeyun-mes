/**
 * 报工弹窗：工单计划 / 料损 / 补料 + 计划可报 / 物料可报 / 本次可报上限（单行六列）
 */

import React, { useMemo } from 'react';
import { Col, Row, Statistic, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getReportableQuantityBreakdown,
  getWorkOrderMaterialLossTotal,
} from '../utils/workOrderReporting';
import { warehouseApi } from '../services/warehouse-execution';

export interface ReportableQuantityPanelProps {
  operation: any;
  workOrderQuantity: number;
  /** 工单全部工序（用于累计料损） */
  operations?: any[];
  workOrderId?: number;
}

const ReportableQuantityPanel: React.FC<ReportableQuantityPanelProps> = ({
  operation,
  workOrderQuantity,
  operations = [],
  workOrderId,
}) => {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const {
    planCap,
    operationCompleted,
    planRemaining,
    materialRemaining,
    prevTransferQty,
    effectiveRemaining,
  } = getReportableQuantityBreakdown(operation, workOrderQuantity);

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
    staleTime: 30_000,
  });

  const statTitleStyle: React.CSSProperties = {
    fontSize: 11,
    color: token.colorTextSecondary,
    fontWeight: 400,
    whiteSpace: 'nowrap',
  };
  const statValueStyle: React.CSSProperties = {
    color: token.colorText,
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.2,
  };
  const lossValueStyle: React.CSSProperties = {
    ...statValueStyle,
    color: cumulativeLoss > 0 ? token.colorError : token.colorTextTertiary,
  };
  const replenishValueStyle: React.CSSProperties = {
    ...statValueStyle,
    color: replenishmentQty > 0 ? token.colorWarning : token.colorTextTertiary,
  };

  const formulaTextStyle: React.CSSProperties = {
    fontSize: 11,
    lineHeight: 1.45,
    display: 'block',
    marginTop: 4,
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: token.borderRadiusLG,
        background: token.colorFillAlter,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Row gutter={[12, 8]} align="top">
        <Col span={4}>
          <Statistic
            title={
              <span style={statTitleStyle}>
                {t('apps.kuaizhizao.workOrder.quickReport.workOrderPlanQty')}
              </span>
            }
            value={workOrderQuantity}
            valueStyle={statValueStyle}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title={
              <span style={statTitleStyle}>
                {t('apps.kuaizhizao.workOrder.quickReport.cumulativeMaterialLoss')}
              </span>
            }
            value={cumulativeLoss}
            valueStyle={lossValueStyle}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title={
              <span style={statTitleStyle}>
                {t('apps.kuaizhizao.workOrder.quickReport.replenishmentQty')}
              </span>
            }
            value={replenishmentQty}
            valueStyle={replenishValueStyle}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title={
              <span style={statTitleStyle}>
                {t('apps.kuaizhizao.workOrder.quickReport.planReportableTitle')}
              </span>
            }
            value={planRemaining}
            valueStyle={statValueStyle}
          />
          <Typography.Text type="secondary" style={formulaTextStyle}>
            {t('apps.kuaizhizao.workOrder.quickReport.planReportableFormula', {
              plan: planCap,
              reported: operationCompleted,
            })}
          </Typography.Text>
        </Col>
        <Col span={4}>
          <Statistic
            title={
              <span style={statTitleStyle}>
                {t('apps.kuaizhizao.workOrder.quickReport.materialReportableTitle')}
              </span>
            }
            value={materialRemaining ?? '—'}
            valueStyle={statValueStyle}
          />
          {materialRemaining != null && prevTransferQty != null ? (
            <Typography.Text type="secondary" style={formulaTextStyle}>
              {t('apps.kuaizhizao.workOrder.quickReport.materialReportableFormula', {
                transfer: prevTransferQty,
                reported: operationCompleted,
              })}
            </Typography.Text>
          ) : null}
        </Col>
        <Col span={4}>
          <Statistic
            title={
              <span style={{ ...statTitleStyle, color: token.colorPrimary }}>
                {t('apps.kuaizhizao.workOrder.quickReport.effectiveReportableTitle')}
              </span>
            }
            value={effectiveRemaining}
            valueStyle={{
              color: token.colorPrimary,
              fontSize: 20,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          />
        </Col>
      </Row>
      <Typography.Paragraph
        type="secondary"
        style={{ marginBottom: 0, marginTop: 10, fontSize: 12, lineHeight: 1.65 }}
      >
        {t('apps.kuaizhizao.workOrder.quickReport.reportablePanelHint')}
      </Typography.Paragraph>
    </div>
  );
};

export default ReportableQuantityPanel;
