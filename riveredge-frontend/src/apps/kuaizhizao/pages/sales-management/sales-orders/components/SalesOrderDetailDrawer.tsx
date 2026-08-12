/**
 * 销售订单原版详情抽屉（DetailDrawerTemplate 插槽壳）。
 * 列表页 / 关联单据嵌套共用，禁止再走 SalesOrderDetailBody plainBody。
 */

import React from 'react';
import { App, Button, Space, Spin, Tooltip } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../../components/layout-templates';
import type { SalesOrder } from '../../../../services/sales-order';
import type { CustomField } from '../../../../../../services/customField';
import {
  SalesOrderDetailProvider,
  SalesOrderDetailBasicPane,
  SalesOrderDetailCollaborationPane,
  SalesOrderDetailCollaborationTitleSuffix,
  SalesOrderDetailLinesPane,
  SalesOrderDetailTimelinePane,
  SalesOrderDetailReadonlyExtra,
  renderSalesOrderTraceBriefActions,
} from './SalesOrderDetailBody';

export type SalesOrderDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  order: SalesOrder | null;
  loading?: boolean;
  zIndex?: number;
  auditRequired: boolean;
  trackingRefreshKey?: number;
  shippingMethodOptions?: Array<{ label: string; value: string }>;
  paymentTermsOptions?: Array<{ label: string; value: string }>;
  feeTypeOptions?: unknown[];
  customFields?: CustomField[];
  customFieldValues?: Record<string, unknown>;
  /** 覆盖默认只读 extra（打印 + 工作流）；列表页可传入完整操作区 */
  extra?: React.ReactNode;
  onWorkflowSuccess?: () => void;
  /** 是否展示默认只读 extra；传入 extra 时忽略 */
  showReadonlyActions?: boolean;
};

export const SalesOrderDetailDrawer: React.FC<SalesOrderDetailDrawerProps> = ({
  open,
  onClose,
  order,
  loading = false,
  zIndex,
  auditRequired,
  trackingRefreshKey = 0,
  shippingMethodOptions,
  paymentTermsOptions,
  feeTypeOptions,
  customFields,
  customFieldValues,
  extra,
  onWorkflowSuccess,
  showReadonlyActions = true,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();

  const title = (
    <Space size={4}>
      <span>{t('app.kuaizhizao.salesOrder.detail')}</span>
      {order?.order_code ? (
        <>
          <span style={{ color: 'var(--ant-color-text-secondary)', fontWeight: 'normal' }}>
            {order.order_code}
          </span>
          <Tooltip title={t('field.invitationCode.copy')}>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined style={{ fontSize: 12 }} />}
              onClick={() => {
                navigator.clipboard.writeText(order.order_code ?? '').then(
                  () => messageApi.success(t('common.copySuccess')),
                  () => messageApi.error(t('common.copyFailed')),
                );
              }}
            />
          </Tooltip>
        </>
      ) : null}
    </Space>
  );

  if (!open) return null;

  if (loading || !order) {
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
    <SalesOrderDetailProvider
      order={order}
      auditRequired={auditRequired}
      trackingRefreshKey={trackingRefreshKey}
      shippingMethodOptions={shippingMethodOptions}
      paymentTermsOptions={paymentTermsOptions}
      feeTypeOptions={feeTypeOptions as any[]}
      customFields={customFields}
      customFieldValues={customFieldValues}
    >
      <DetailDrawerTemplate
        title={title}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.HALF_WIDTH}
        zIndex={zIndex}
        collaborationTitleSuffix={<SalesOrderDetailCollaborationTitleSuffix />}
        collaborationAuditRecord={order}
        extra={
          extra ??
          (showReadonlyActions ? (
            <SalesOrderDetailReadonlyExtra onWorkflowSuccess={onWorkflowSuccess} />
          ) : null)
        }
        basic={<SalesOrderDetailBasicPane />}
        collaboration={<SalesOrderDetailCollaborationPane />}
        lines={<SalesOrderDetailLinesPane />}
        timeline={<SalesOrderDetailTimelinePane />}
        traceDocument={
          order.id != null
            ? {
                documentType: 'sales_order',
                documentId: order.id,
                selfDocumentId: order.id,
                renderBriefActions: (doc) =>
                  renderSalesOrderTraceBriefActions(doc, {
                    t,
                    navigate,
                    closeDrawer: onClose,
                  }),
              }
            : undefined
        }
      />
    </SalesOrderDetailProvider>
  );
};
