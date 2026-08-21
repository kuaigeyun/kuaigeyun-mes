/**
 * 成本规则基础资料详情抽屉。
 * STANDARD_WIDTH、2 列、MASTER_DATA rank；无生命周期 / 全链路。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Result, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import {
  alignDescriptionColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { getRuleTypeTag } from '../../../../utils/costUiLabels';
import { renderFinanceActiveTag } from '../../../../utils/financeListPresentation';

export type CostRuleDetail = {
  uuid?: string;
  code?: string;
  name?: string;
  rule_type?: string;
  cost_type?: string;
  calculation_method?: string;
  allocation_basis?: string;
  source_module?: string;
  calculation_formula?: unknown;
  rule_parameters?: unknown;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
};

export type CostRuleDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  detail: CostRuleDetail | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

function formatJsonBlock(value: unknown): string {
  return value ? JSON.stringify(value, null, 2) : '-';
}

export const CostRuleDetailDrawer: React.FC<CostRuleDetailDrawerProps> = ({
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

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns(
        [
          { title: t('app.kuaicaiwu.costRule.col.code'), dataIndex: 'code' },
          { title: t('app.kuaicaiwu.costRule.col.name'), dataIndex: 'name' },
          {
            title: t('app.kuaicaiwu.costRule.col.ruleType'),
            dataIndex: 'rule_type',
            render: (_, row) => (row.rule_type ? getRuleTypeTag(row.rule_type, t) : '-'),
          },
          { title: t('app.kuaicaiwu.costRule.col.costType'), dataIndex: 'cost_type' },
          { title: t('app.kuaicaiwu.costRule.col.calculationMethod'), dataIndex: 'calculation_method' },
          { title: t('app.kuaicaiwu.costRule.col.allocationBasis'), dataIndex: 'allocation_basis' },
          { title: t('app.kuaicaiwu.costRule.col.sourceModule'), dataIndex: 'source_module' },
          {
            title: t('app.kuaicaiwu.costRule.col.isActive'),
            dataIndex: 'is_active',
            render: (_, row) =>
              renderFinanceActiveTag(
                t,
                row.is_active,
                'common.enabled',
                'common.disabled',
              ),
          },
          { title: t('common.remark'), dataIndex: 'description', span: 2 },
          { title: t('app.kuaicaiwu.costCommon.col.createdBy'), dataIndex: 'created_by_name' },
          { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
          { title: t('app.kuaicaiwu.costCommon.col.updatedBy'), dataIndex: 'updated_by_name' },
          { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
        ] as ProDescriptionsItemProps<CostRuleDetail>[],
        MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
      ),
    [t],
  );

  const code = String(detail?.code ?? '').trim();
  const name = String(detail?.name ?? '').trim();
  const title = name || code || t('app.kuaicaiwu.costRule.detailTitle');

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
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
        contentReady && detail ? (
          <Descriptions
            column={2}
            size="small"
            items={detailDrawerDescriptionItems(basicColumns, detail)}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      supplementaryTitle={t('app.kuaicaiwu.costCommon.section.details')}
      supplementary={
        contentReady && detail ? (
          <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <Typography.Text type="secondary">{t('app.kuaicaiwu.costRule.col.calculationFormula')}</Typography.Text>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
              {formatJsonBlock(detail.calculation_formula)}
            </pre>
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
              {t('app.kuaicaiwu.costRule.col.ruleParameters')}
            </Typography.Text>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
              {formatJsonBlock(detail.rule_parameters)}
            </pre>
          </div>
        ) : undefined
      }
    />
  );
};
