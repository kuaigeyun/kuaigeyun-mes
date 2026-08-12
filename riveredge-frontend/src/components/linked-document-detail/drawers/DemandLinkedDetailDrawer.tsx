/**
 * 关联单据：需求计划（Demand）原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { getDemand, type Demand } from '../../../apps/kuaizhizao/services/demand';
import { getDemandLifecycle } from '../../../apps/kuaizhizao/utils/demandLifecycle';
import { getDemandTypeTagProps } from '../../../apps/kuaizhizao/utils/demandType';
import { formatDateTime, formatQuantity } from '../../../utils/format';

export type DemandLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function DemandLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: DemandLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDetail(await getDemand(documentId, true, false));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(err?.message || err?.detail || t('app.kuaizhizao.demandManagement.detailFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lifecycle = useMemo(
    () => (detail ? getDemandLifecycle(detail as Record<string, unknown>, t) : null),
    [detail, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length);
  const tracking = useDocumentTracking(open && detail?.id ? 'demand' : undefined, detail?.id, refreshKey);

  const demandTypeLabel = useMemo(() => {
    const key = detail?.demand_type;
    if (key === 'sales_order') return t('app.kuaizhizao.salesOrder.entityName');
    if (key === 'sales_forecast') return t('app.kuaizhizao.salesForecast.title');
    if (key === 'demand_plan') return t('app.kuaizhizao.demandManagement.demandTypePlan');
    return key || '-';
  }, [detail?.demand_type, t]);

  const title = detail?.demand_code
    ? t('app.kuaizhizao.demandManagement.detailTitleWithCode', { code: detail.demand_code })
    : t('app.kuaizhizao.demandManagement.detailTitle');

  if (!open) return null;

  if (loading || !detail) {
    return (
      <DetailDrawerTemplate
        title={title}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.HALF_WIDTH}
        zIndex={zIndex}
        plainBody={
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        }
      />
    );
  }

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      collaborationTitleSuffix={
        showNextInTitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：
            {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={detail as any}
      collaborationLifecycle={
        lifecycle ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={Boolean(nextSteps?.length)}
          />
        ) : undefined
      }
      basic={
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'demand_code', label: t('app.kuaizhizao.demandManagement.demandCode'), children: detail.demand_code || '-' },
            {
              key: 'demand_type',
              label: t('app.kuaizhizao.demandManagement.demandType'),
              children: <Tag {...getDemandTypeTagProps(detail.demand_type)}>{demandTypeLabel}</Tag>,
            },
            { key: 'demand_name', label: t('app.kuaizhizao.demandManagement.demandName'), children: detail.demand_name || '-' },
            {
              key: 'business_mode',
              label: t('app.kuaizhizao.demandManagement.businessMode'),
              children: detail.business_mode || '-',
            },
            {
              key: 'start_date',
              label: t('app.kuaizhizao.salesForecast.startDate'),
              children: detail.start_date ? formatDateTime(detail.start_date, 'YYYY-MM-DD') : '-',
            },
            {
              key: 'end_date',
              label: t('app.kuaizhizao.salesForecast.endDate'),
              children: detail.end_date ? formatDateTime(detail.end_date, 'YYYY-MM-DD') : '-',
            },
            {
              key: 'customer_name',
              label: t('app.kuaizhizao.salesOrder.customerName'),
              children: detail.customer_name || '-',
            },
            {
              key: 'total_quantity',
              label: t('app.kuaizhizao.salesOrder.totalQuantity'),
              children: formatQuantity(detail.total_quantity),
            },
            {
              key: 'status',
              label: t('common.status'),
              children: <Tag>{lifecycle?.stageName || detail.status || '-'}</Tag>,
            },
            {
              key: 'notes',
              label: t('app.kuaizhizao.salesOrder.notes'),
              children: detail.notes || '-',
              span: 3,
            },
          ]}
        />
      }
      lines={
        <Table
          size="small"
          rowKey={(r) => String(r.id ?? r.material_id ?? Math.random())}
          pagination={false}
          scroll={{ x: 900 }}
          dataSource={detail.items ?? []}
          columns={[
            { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
            { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
            { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 120 },
            {
              title: t('app.kuaizhizao.planReports.colRequirementQty'),
              dataIndex: 'required_quantity',
              width: 100,
              align: 'right',
              render: (v) => formatQuantity(v),
            },
            {
              title: t('app.kuaizhizao.salesOrder.deliveryDate'),
              dataIndex: 'delivery_date',
              width: 120,
              render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
            },
          ]}
          locale={{ emptyText: t('app.kuaizhizao.salesOrder.emptyItems') }}
        />
      }
      timeline={
        <>
          {tracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : null}
          {tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null}
        </>
      }
      traceDocument={{
        documentType: 'demand',
        documentId: detail.id!,
        selfDocumentId: detail.id!,
      }}
    />
  );
}
