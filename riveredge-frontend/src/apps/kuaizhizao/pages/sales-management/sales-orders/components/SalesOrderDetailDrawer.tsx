/**
 * 销售订单原版详情抽屉（DetailDrawerTemplate 插槽壳）。
 * 列表页 / 关联单据嵌套共用，禁止再走 SalesOrderDetailBody plainBody。
 *
 * 须保持单一 Drawer 壳：加载中 / 失败 / 有数据时不得切换两棵 DetailDrawerTemplate，
 * 否则 Ant Design Drawer 会连续滑入两次。
 */

import React, { useMemo } from 'react';
import { App, Button, Result, Space, Tooltip } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../../components/layout-templates';
import type { SalesOrder } from '../../../../services/sales-order';
import type { CustomField } from '../../../../../../services/customField';
import {
  DocumentAttachmentsReadonly,
  documentAttachmentsFromRecord,
  hasDocumentAttachments,
} from '../../../../components/DocumentAttachmentsReadonly';
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
  /** 取数失败文案；与 order 互斥展示 */
  error?: string | null;
  /** Result 状态；关联抽屉权限不足时为 403 */
  errorStatus?: '403' | 'error';
  onRetry?: () => void;
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

/** Provider 在 order 尚未返回时的占位（仅用于挂载壳，不展示业务内容） */
const PLACEHOLDER_ORDER: SalesOrder = { id: 0 };

export const SalesOrderDetailDrawer: React.FC<SalesOrderDetailDrawerProps> = ({
  open,
  onClose,
  order,
  loading = false,
  error = null,
  errorStatus = 'error',
  onRetry,
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

  const effectiveOrder = order ?? PLACEHOLDER_ORDER;
  const contentReady = Boolean(order);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const attachments = documentAttachmentsFromRecord(order);
  const showAttachments = contentReady && hasDocumentAttachments(attachments);

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

  const providerProps = useMemo(
    () => ({
      order: effectiveOrder,
      auditRequired,
      trackingRefreshKey,
      shippingMethodOptions,
      paymentTermsOptions,
      feeTypeOptions: feeTypeOptions as any[],
      customFields,
      customFieldValues,
    }),
    [
      effectiveOrder,
      auditRequired,
      trackingRefreshKey,
      shippingMethodOptions,
      paymentTermsOptions,
      feeTypeOptions,
      customFields,
      customFieldValues,
    ],
  );

  if (!open) return null;

  return (
    <SalesOrderDetailProvider {...providerProps}>
      <DetailDrawerTemplate
        title={title}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.HALF_WIDTH}
        zIndex={zIndex}
        loading={showLoading}
        plainBody={
          showError ? (
            <Result
              status={errorStatus}
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
        collaborationTitleSuffix={contentReady ? <SalesOrderDetailCollaborationTitleSuffix /> : null}
        collaborationAuditRecord={contentReady ? order : null}
        extra={
          contentReady
            ? extra ??
              (showReadonlyActions ? (
                <SalesOrderDetailReadonlyExtra onWorkflowSuccess={onWorkflowSuccess} />
              ) : null)
            : null
        }
        basic={contentReady ? <SalesOrderDetailBasicPane /> : showError ? null : <div style={{ minHeight: 80 }} />}
        collaboration={contentReady ? <SalesOrderDetailCollaborationPane /> : null}
        supplementary={
          showAttachments ? <DocumentAttachmentsReadonly attachments={attachments} /> : undefined
        }
        supplementaryTitle={
          showAttachments ? t('app.uniDetail.sectionAttachments') : undefined
        }
        supplementaryVisible={showAttachments}
        lines={contentReady ? <SalesOrderDetailLinesPane /> : null}
        timeline={contentReady ? <SalesOrderDetailTimelinePane /> : null}
        traceDocument={
          contentReady && order?.id != null
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
