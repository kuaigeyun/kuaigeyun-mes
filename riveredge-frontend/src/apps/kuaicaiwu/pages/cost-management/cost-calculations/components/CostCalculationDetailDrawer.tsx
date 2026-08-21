/**
 * 成本核算台账原版详情抽屉。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  useDetailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { StructuredCostDataView } from '../../../../../../components/structured-cost-data-view';
import { alignDescriptionColumns } from '../../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { formatQuantity } from '../../../../../../utils/format';
import { getCostCalculationLifecycle } from '../../../../utils/costLifecycle';
import { formatCalculationType } from '../../../../utils/costUiLabels';

export type CostCalculationDetail = {
  uuid?: string;
  calculation_no?: string;
  calculation_type?: string;
  work_order_id?: number;
  work_order_code?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  material_cost?: number;
  labor_cost?: number;
  manufacturing_cost?: number;
  total_cost?: number;
  unit_cost?: number;
  cost_details?: unknown;
  calculation_date?: string;
  calculation_status?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
};

const PLACEHOLDER: CostCalculationDetail = {
  calculation_no: '',
};

function formatMoney(value: unknown): string {
  return `¥${value != null ? Number(value).toFixed(2) : '0.00'}`;
}

export type CostCalculationDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  detail: CostCalculationDetail | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const CostCalculationDetailDrawer: React.FC<CostCalculationDetailDrawerProps> = ({
  open,
  onClose,
  detail,
  loading = false,
  error = null,
  onRetry,
  extra,
  zIndex,
}) => {
  const { t } = useTranslation();

  const contentReady = Boolean(detail);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = detail ?? PLACEHOLDER;

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaicaiwu.costCalculation.col.calculationNo'), dataIndex: 'calculation_no' },
        {
          title: t('app.kuaicaiwu.costCommon.col.calculationDate'),
          dataIndex: 'calculation_date',
          valueType: 'date',
        },
        {
          title: t('app.kuaicaiwu.costCalculation.col.calculationType'),
          dataIndex: 'calculation_type',
          render: (_, row) => formatCalculationType(row.calculation_type, t),
        },
        {
          title: t('app.kuaicaiwu.costCalculation.col.workOrderCode'),
          dataIndex: 'work_order_code',
          key: 'linked_work_order_code',
        },
        { title: t('app.kuaicaiwu.costCalculation.col.productCode'), dataIndex: 'product_code' },
        { title: t('app.kuaicaiwu.costCalculation.col.productName'), dataIndex: 'product_name' },
        {
          title: t('common.quantity'),
          dataIndex: 'quantity',
          render: (_, row) => formatQuantity(row.quantity),
        },
        {
          title: t('app.kuaicaiwu.costCommon.col.materialCost'),
          dataIndex: 'material_cost',
          render: (_, row) => formatMoney(row.material_cost),
        },
        {
          title: t('app.kuaicaiwu.costCommon.col.laborCost'),
          dataIndex: 'labor_cost',
          render: (_, row) => formatMoney(row.labor_cost),
        },
        {
          title: t('app.kuaicaiwu.costCommon.col.manufacturingCost'),
          dataIndex: 'manufacturing_cost',
          render: (_, row) => formatMoney(row.manufacturing_cost),
        },
        {
          title: t('app.kuaicaiwu.costCommon.col.totalCost'),
          dataIndex: 'total_cost',
          render: (_, row) => formatMoney(row.total_cost),
        },
        {
          title: t('app.kuaicaiwu.costCommon.col.unitCost'),
          dataIndex: 'unit_cost',
          render: (_, row) => formatMoney(row.unit_cost),
        },
        { title: t('common.remark'), dataIndex: 'remark', span: 3 },
        { title: t('app.kuaicaiwu.costCommon.col.createdBy'), dataIndex: 'created_by_name' },
        { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
        { title: t('app.kuaicaiwu.costCommon.col.updatedBy'), dataIndex: 'updated_by_name' },
        { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
      ] as ProDescriptionsItemProps<CostCalculationDetail>[]),
    [t],
  );
  const basicItems = useDetailDrawerDescriptionItems(basicColumns, effective);

  const lifecycle = getCostCalculationLifecycle(effective as Record<string, unknown>, t);
  const steps = lifecycle.mainStages ?? [];
  const code = String(effective.calculation_no ?? '').trim();
  const title = code
    ? `${t('app.kuaicaiwu.costCalculation.detailTitle')} ${code}`
    : t('app.kuaicaiwu.costCalculation.detailTitle');

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      extra={contentReady ? extra ?? null : null}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              onRetry ? (
                <Button type="primary" onClick={onRetry}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      basic={
        contentReady ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={basicItems}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaborationTitle={t('app.kuaicaiwu.costCommon.section.lifecycle')}
      collaborationLifecycle={
        contentReady && steps.length > 0 ? (
          <UniLifecycleStepper
            steps={steps}
            showLabels
            status={lifecycle.status}
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions
          />
        ) : undefined
      }
      linesTitle={t('app.kuaicaiwu.costCommon.section.details')}
      lines={
        contentReady ? (
          effective.cost_details ? (
            <div style={{ maxHeight: 420, overflow: 'auto', minWidth: 320 }}>
              <StructuredCostDataView data={effective.cost_details} />
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="-" />
          )
        ) : undefined
      }
    />
  );
};
