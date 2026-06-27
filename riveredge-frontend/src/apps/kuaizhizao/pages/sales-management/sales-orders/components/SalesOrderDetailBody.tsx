/**
 * 销售订单详情主体（基本信息 / 生命周期·协作 / 明细 / 操作记录）
 *
 * 支持两种外壳：
 * - SalesOrderDetailBody：自带 DetailDrawerSection（报价单嵌套抽屉等 plainBody）
 * - Provider + *Pane：配合 DetailDrawerTemplate 插槽（销售订单列表详情）
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { App, Button, Space, Table, Tooltip, Typography, Descriptions } from 'antd';
import { CopyOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { AmountDisplay } from '../../../../../../components/permission';
import { KUAIZHIZAO_SALES_ORDER_FIELD_RESOURCE as SO } from '../../../../constants/fieldPermissionResources';
import { DictionaryLabel } from '../../../../../../components/dictionary-label';
import { MaterialBomIndicator } from '../../../../components/MaterialBomIndicator';
import { MaterialInventoryIndicator } from '../../../../components/MaterialInventoryIndicator';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DetailLifecycleCollaborationBlock } from '../../../../../../components/uni-audit/DetailAuditPhaseRow';
import type { LifecycleResult } from '../../../../../../components/uni-lifecycle/types';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { DetailDrawerSection, DetailDrawerInlineFullChain } from '../../../../../../components/layout-templates';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../../components/custom-fields';
import type { CustomField } from '../../../../../../services/customField';
import { getSalesOrderLifecycle } from '../../../../utils/salesOrderLifecycle';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../../services/dataDictionary';
import type { SalesOrder, SalesOrderItem } from '../../../../services/sales-order';
import { listSalesOrderChangesByOrder, type SalesOrderChange } from '../../../../services/sales-order-change';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';

export interface SalesOrderDetailBodyProps {
  order: SalesOrder;
  trackingRefreshKey?: number;
  shippingMethodOptions?: Array<{ label: string; value: string }>;
  paymentTermsOptions?: Array<{ label: string; value: string }>;
  feeTypeOptions?: any[];
  customFields?: CustomField[];
  customFieldValues?: Record<string, any>;
}

interface SalesOrderDetailContextValue {
  order: SalesOrder;
  lifecycle: LifecycleResult;
  tracking: ReturnType<typeof useDocumentTracking>;
  feeTypeOptions: any[];
  shippingMethodOptions: Array<{ label: string; value: string }>;
  paymentTermsOptions: Array<{ label: string; value: string }>;
  handlePrintSalesOrder: () => Promise<void>;
  customFields: CustomField[];
  customFieldValues: Record<string, any>;
}

const SalesOrderDetailContext = createContext<SalesOrderDetailContextValue | null>(null);

function useSalesOrderDetailContext(): SalesOrderDetailContextValue {
  const v = useContext(SalesOrderDetailContext);
  if (!v) throw new Error('SalesOrderDetailProvider required');
  return v;
}

export const SalesOrderDetailProvider: React.FC<
  SalesOrderDetailBodyProps & { auditRequired: boolean; children: React.ReactNode }
> = ({
  order,
  auditRequired,
  trackingRefreshKey = 0,
  shippingMethodOptions: shippingProp,
  paymentTermsOptions: paymentProp,
  feeTypeOptions: feeProp,
  customFields: customFieldsProp = [],
  customFieldValues: customFieldValuesProp = {},
  children,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();

  const [internalFee, setInternalFee] = useState<any[]>([]);
  const [internalShipping, setInternalShipping] = useState<Array<{ label: string; value: string }>>([]);
  const [internalPayment, setInternalPayment] = useState<Array<{ label: string; value: string }>>([]);
  const tracking = useDocumentTracking(order?.id ? 'sales_order' : undefined, order?.id, trackingRefreshKey);

  const feeTypeOptions = feeProp ?? internalFee;
  const shippingMethodOptions = shippingProp ?? internalShipping;
  const paymentTermsOptions = paymentProp ?? internalPayment;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const tasks: Promise<void>[] = [];
      if (feeProp === undefined) {
        tasks.push(
          getDataDictionaryByCode('FEE_TYPE')
            .then((dict) => getDictionaryItemList(dict.uuid))
            .then((res) => {
              if (!cancelled) setInternalFee(res || []);
            })
            .catch(() => {
              if (!cancelled) setInternalFee([]);
            }),
        );
      }
      if (shippingProp === undefined) {
        tasks.push(
          (async () => {
            try {
              const dict = await getDataDictionaryByCode('SHIPPING_METHOD');
              const items = await getDictionaryItemList(dict.uuid, true);
              if (!cancelled) {
                setInternalShipping(
                  items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })),
                );
              }
            } catch {
              if (!cancelled) setInternalShipping([]);
            }
          })(),
        );
      }
      if (paymentProp === undefined) {
        tasks.push(
          (async () => {
            try {
              const dict = await getDataDictionaryByCode('PAYMENT_TERMS');
              const items = await getDictionaryItemList(dict.uuid, true);
              if (!cancelled) {
                setInternalPayment(
                  items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })),
                );
              }
            } catch {
              if (!cancelled) setInternalPayment([]);
            }
          })(),
        );
      }
      await Promise.all(tasks);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [feeProp, shippingProp, paymentProp]);

  const handlePrintSalesOrder = useCallback(() => {
    if (order.id == null) return;
    openPrint({ documentType: 'sales_order', documentId: order.id });
  }, [order.id, openPrint]);

  const lifecycle = useMemo(
    () => getSalesOrderLifecycle(order, auditRequired, t),
    [order, auditRequired, t],
  );

  const ctxValue = useMemo<SalesOrderDetailContextValue>(
    () => ({
      order,
      lifecycle,
      tracking,
      feeTypeOptions,
      shippingMethodOptions,
      paymentTermsOptions,
      handlePrintSalesOrder,
      customFields: customFieldsProp,
      customFieldValues: customFieldValuesProp,
    }),
    [
      order,
      lifecycle,
      tracking,
      feeTypeOptions,
      shippingMethodOptions,
      paymentTermsOptions,
      handlePrintSalesOrder,
      customFieldsProp,
      customFieldValuesProp,
    ],
  );

  return (
    <SalesOrderDetailContext.Provider value={ctxValue}>
      {children}
      {PrintModal}
    </SalesOrderDetailContext.Provider>
  );
};

/** DetailDrawerTemplate.collaborationTitleSuffix（须在 Provider 内） */
export const SalesOrderDetailCollaborationTitleSuffix: React.FC = () => {
  const { t } = useTranslation();
  const { lifecycle } = useSalesOrderDetailContext();
  const next = lifecycle.nextStepSuggestions;
  if (!next?.length) return null;
  return (
    <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
      {t('components.uniLifecycle.nextStep')}：
      {next.join(t('components.uniLifecycle.nextStepSeparator'))}
    </Typography.Text>
  );
};

function SalesOrderDetailCollaborationDrawerTitle() {
  const { t } = useTranslation();
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, rowGap: 4 }}>
      <span>{t('app.uniDetail.sectionCollaboration')}</span>
      <SalesOrderDetailCollaborationTitleSuffix />
    </span>
  );
}

export const SalesOrderDetailBasicPane: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const {
    order,
    shippingMethodOptions,
    paymentTermsOptions,
    handlePrintSalesOrder,
    customFields,
    customFieldValues,
  } = useSalesOrderDetailContext();
  const showCustomFields = hasCustomFieldsDetailContent(customFields, customFieldValues);
  return (
    <>
    <Descriptions
      column={3}
      size="small"
      items={[
        // 单据与时间
        {
          key: 'order_code',
          label: t('app.kuaizhizao.salesOrder.orderCode'),
          children: (
            <Space size={4}>
              <span>{order.order_code ?? '-'}</span>
              <Tooltip title={t('app.kuaizhizao.salesOrder.printPdf')}>
                <Button
                  type="link"
                  size="small"
                  icon={<PrinterOutlined style={{ fontSize: 12 }} />}
                  onClick={handlePrintSalesOrder}
                />
              </Tooltip>
              <Tooltip title={t('field.invitationCode.copy')}>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined style={{ fontSize: 12 }} />}
                  onClick={() => {
                    const text = order.order_code ?? '';
                    if (text) {
                      navigator.clipboard.writeText(text).then(
                        () => messageApi.success(t('common.copySuccess')),
                        () => messageApi.error(t('common.copyFailed')),
                      );
                    }
                  }}
                />
              </Tooltip>
            </Space>
          ),
        },
        { key: 'order_date', label: t('app.kuaizhizao.salesOrder.orderDate'), children: order.order_date || '-' },
        { key: 'delivery_date', label: t('app.kuaizhizao.salesOrder.deliveryDate'), children: order.delivery_date || '-' },
        // 客户联系
        { key: 'customer_name', label: t('app.kuaizhizao.salesOrder.customerName'), children: order.customer_name || '-' },
        { key: 'customer_contact', label: t('app.kuaizhizao.salesOrder.customerContact'), children: order.customer_contact || '-' },
        { key: 'customer_phone', label: t('app.kuaizhizao.salesOrder.customerPhone'), children: order.customer_phone || '-' },
        {
          key: 'contract_code',
          label: t('app.kuaizhizao.salesContract.linkedContract'),
          children: order.contract_code ? (
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto' }}
              onClick={() =>
                navigate('/apps/kuaizhizao/sales-management/sales-contracts', {
                  state: { openContractId: order.contract_id },
                })
              }
            >
              {order.contract_code}
            </Button>
          ) : (
            '-'
          ),
        },
        {
          key: 'shipping_address',
          label: t('app.kuaizhizao.salesOrder.shippingAddress'),
          children: order.shipping_address || '-',
          span: 3,
        },
        // 销售与履约（交货方式、付款条件）
        { key: 'salesman_name', label: t('app.kuaizhizao.salesOrder.salesman'), children: order.salesman_name || '-' },
        {
          key: 'shipping_method',
          label: t('app.kuaizhizao.salesOrder.shippingMethod'),
          children: shippingMethodOptions.find((o) => o.value === order.shipping_method)?.label ?? order.shipping_method ?? '-',
        },
        {
          key: 'payment_terms',
          label: t('app.kuaizhizao.salesOrder.paymentTerms'),
          children: paymentTermsOptions.find((o) => o.value === order.payment_terms)?.label ?? order.payment_terms ?? '-',
        },
        // 计价与金额
        {
          key: 'price_type',
          label: t('app.kuaizhizao.salesOrder.priceType'),
          children:
            order.price_type === 'tax_inclusive'
              ? t('app.kuaizhizao.salesOrder.taxInclusive')
              : t('app.kuaizhizao.salesOrder.taxExclusive'),
        },
        {
          key: 'discount_amount',
          label: t('app.kuaizhizao.salesOrder.discountAmount'),
          children:
            Number(order.discount_amount ?? 0) > 0 ? (
              <AmountDisplay resource={SO} fieldName="amount" value={order.discount_amount ?? 0} />
            ) : (
              '-'
            ),
        },
        {
          key: 'total_amount',
          label: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
          children: <AmountDisplay resource={SO} fieldName="total_amount" value={order.total_amount ?? 0} />,
        },
        {
          key: 'total_fee_amount',
          label: t('app.kuaizhizao.salesOrder.totalFeeAmount'),
          children: <AmountDisplay resource={SO} fieldName="amount" value={order.total_fee_amount ?? 0} />,
        },
      ]}
    />
    {showCustomFields ? (
      <div style={{ marginTop: 16 }}>
        <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
      </div>
    ) : null}
    <Descriptions
      column={3}
      size="small"
      style={{ marginTop: showCustomFields ? 16 : 0 }}
      items={[
        { key: 'notes', label: t('app.kuaizhizao.salesOrder.notes'), children: order.notes || '-', span: 3 },
      ]}
    />
    </>
  );
};

export interface SalesOrderDetailCollaborationPaneProps {
  drawerVisible?: boolean;
  onCloseDrawer?: () => void;
  navigate?: NavigateFunction;
  auditEnabled?: boolean;
}

export const SalesOrderDetailCollaborationPane: React.FC<SalesOrderDetailCollaborationPaneProps> = ({
  drawerVisible = true,
  onCloseDrawer,
  navigate: navigateProp,
  auditEnabled = true,
}) => {
  const { t } = useTranslation();
  const navigateHook = useNavigate();
  const navigate = navigateProp ?? navigateHook;
  const { order, lifecycle } = useSalesOrderDetailContext();
  const mainStages = lifecycle.mainStages ?? [];
  const subStages = lifecycle.subStages ?? [];
  const hideStepperNext = Boolean(lifecycle.nextStepSuggestions?.length);
  const closeDrawer = onCloseDrawer ?? (() => {});

  return (
    <DetailLifecycleCollaborationBlock record={order} auditEnabled={auditEnabled}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mainStages.length > 0 && (
          <UniLifecycleStepper
            steps={mainStages}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={hideStepperNext}
          />
        )}
        {subStages.length > 0 && (
          <UniLifecycleStepper
            steps={subStages}
            status={lifecycle.status}
            showLabels
            nodeSize={36}
            connectorWidth={36}
            stepLabelMaxWidth={120}
          />
        )}
        {order.id != null ? (
          <DetailDrawerInlineFullChain
          documentType="sales_order"
          documentId={order.id}
          active={drawerVisible}
          selfDocumentId={order.id}
          renderBriefActions={(doc) => (
            <>
              {doc.document_type === 'quotation' ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    closeDrawer();
                    navigate('/apps/kuaizhizao/sales-management/quotations', {
                      state: { openQuotationDetailId: doc.document_id },
                    });
                  }}
                >
                  {t('components.documentTrackingPanel.traceBriefOpenQuotation')}
                </Button>
              ) : null}
              {doc.document_type === 'sales_invoice' ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    closeDrawer();
                    navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${doc.document_id}`);
                  }}
                >
                  {t('components.documentTrackingPanel.traceBriefOpenSalesInvoice')}
                </Button>
              ) : null}
              {doc.document_type === 'receivable' ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    closeDrawer();
                    navigate(`/apps/kuaicaiwu/finance-management/receivables/${doc.document_id}`);
                  }}
                >
                  {t('components.documentTrackingPanel.traceBriefOpenReceivable')}
                </Button>
              ) : null}
              {doc.document_type === 'receipt' ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    closeDrawer();
                    navigate('/apps/kuaicaiwu/finance-management/receipts');
                  }}
                >
                  {t('components.documentTrackingPanel.traceBriefOpenReceipt')}
                </Button>
              ) : null}
              {doc.document_type === 'payment' ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    closeDrawer();
                    navigate('/apps/kuaicaiwu/finance-management/payments');
                  }}
                >
                  {t('components.documentTrackingPanel.traceBriefOpenPayment')}
                </Button>
              ) : null}
            </>
          )}
        />
      ) : null}
      </div>
    </DetailLifecycleCollaborationBlock>
  );
};

export const SalesOrderDetailLinesPane: React.FC = () => {
  const { t } = useTranslation();
  const { order, feeTypeOptions } = useSalesOrderDetailContext();

  return (
    <>
      {order.fee_details && order.fee_details.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>{t('app.kuaizhizao.salesOrder.feeDetailsTitle')}</div>
          <Table
            size="small"
            tableLayout="fixed"
            style={{ minWidth: 560 }}
            columns={[
                {
                  title: t('app.kuaizhizao.salesOrder.feeType'),
                  dataIndex: 'type',
                  width: 120,
                  render: (val: string) => feeTypeOptions.find((o: any) => o.value === val)?.label ?? val,
                },
                {
                  title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
                  dataIndex: 'amount',
                  width: 120,
                  align: 'right',
                  render: (val: number) => <AmountDisplay resource={SO} fieldName="amount" value={val} />,
                },
                {
                  title: t('app.kuaizhizao.salesOrder.feeBearer'),
                  dataIndex: 'bearer',
                  width: 100,
                  render: (val: string) =>
                    val === 'our_side'
                      ? t('app.kuaizhizao.salesOrder.feeBearerOurSide')
                      : t('app.kuaizhizao.salesOrder.feeBearerCounterparty'),
                },
                { title: t('app.kuaizhizao.salesOrder.notes'), dataIndex: 'notes' },
              ]}
              dataSource={order.fee_details}
              rowKey={(_: any, i?: number) => i ?? 0}
              pagination={false}
            />
        </div>
      )}

      {order.items && order.items.length > 0 ? (
          <Table<SalesOrderItem>
            size="small"
            tableLayout="fixed"
            style={{ minWidth: 1280 }}
            columns={[
              { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
              { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 200 },
              { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 120 },
              {
                title: t('app.kuaizhizao.salesOrder.unit'),
                dataIndex: 'material_unit',
                width: 80,
                render: (v: string) => <DictionaryLabel dictionaryCode="MATERIAL_UNIT" value={v} />,
              },
              {
                title: t('app.kuaizhizao.salesOrder.bomCheck'),
                key: 'bom_check',
                width: 80,
                render: (_: unknown, record: SalesOrderItem) => <MaterialBomIndicator materialId={record.material_id} />,
              },
              {
                title: t('app.kuaizhizao.salesOrder.quantity'),
                dataIndex: 'required_quantity',
                width: 100,
                align: 'right' as const,
                render: (val: number, record: SalesOrderItem) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <MaterialInventoryIndicator materialId={record.material_id} requiredQuantity={record.required_quantity} />
                    {val ?? 0}
                  </span>
                ),
              },
              {
                title: t('app.kuaizhizao.salesOrder.unitPrice'),
                dataIndex: 'unit_price',
                width: 100,
                align: 'right' as const,
                render: (val: number) => <AmountDisplay resource={SO} fieldName="unit_price" value={val} />,
              },
              {
                title: t('app.kuaizhizao.salesOrder.taxRate'),
                dataIndex: 'tax_rate',
                width: 80,
                align: 'right' as const,
                render: (val: number) => val ?? 0,
              },
              {
                title: t('app.kuaizhizao.salesOrder.inclAmount'),
                dataIndex: 'item_amount',
                width: 120,
                align: 'right' as const,
                render: (val: number) => <AmountDisplay resource={SO} fieldName="amount_with_tax" value={val} />,
              },
              { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 120 },
              {
                title: t('app.kuaizhizao.salesOrder.deliveredQty'),
                dataIndex: 'delivered_quantity',
                width: 100,
                align: 'right' as const,
                render: (text: number) => text || 0,
              },
              {
                title: t('app.kuaizhizao.salesOrder.remainingQty'),
                dataIndex: 'remaining_quantity',
                width: 100,
                align: 'right' as const,
                render: (text: number) => text || 0,
              },
            ]}
            dataSource={order.items}
            rowKey="id"
            pagination={false}
          />
      ) : (
        <Typography.Text type="secondary">{t('app.kuaizhizao.salesOrder.emptyItems')}</Typography.Text>
      )}
    </>
  );
};

export const SalesOrderDetailTimelinePane: React.FC = () => {
  const { t } = useTranslation();
  const { tracking, order } = useSalesOrderDetailContext();
  const [changes, setChanges] = useState<SalesOrderChange[]>([]);

  useEffect(() => {
    if (!order?.id) return;
    listSalesOrderChangesByOrder(order.id).then(setChanges).catch(() => setChanges([]));
  }, [order?.id]);

  return (
    <>
      {tracking.data ? (
        <DocumentTrackingTimelineBody data={tracking.data} />
      ) : (
        <Typography.Text type="secondary">{t('app.kuaizhizao.salesOrder.emptyTimeline')}</Typography.Text>
      )}
      <Typography.Title level={5} style={{ marginTop: 24 }}>{t('app.kuaizhizao.salesOrder.changeHistoryTitle')}</Typography.Title>
      {changes.length ? (
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={changes}
          columns={[
            { title: t('app.kuaizhizao.salesOrderChange.colChangeCode'), dataIndex: 'change_code' },
            { title: t('app.kuaizhizao.salesOrderChange.colVersion'), dataIndex: 'change_version', width: 70 },
            { title: t('app.kuaizhizao.salesOrderChange.colDeltaAmount'), dataIndex: 'delta_amount', width: 100 },
            { title: t('common.status'), dataIndex: 'status', width: 100 },
            {
              title: t('app.kuaizhizao.salesOrderChange.colAppliedAt'),
              dataIndex: 'applied_at',
              width: 160,
              render: (v: string) => v || '-',
            },
          ]}
        />
      ) : (
        <Typography.Text type="secondary">{t('app.kuaizhizao.salesOrder.emptyChanges')}</Typography.Text>
      )}
    </>
  );
};

/** plainBody / 嵌套抽屉：自带分区卡片 */
export const SalesOrderDetailBody: React.FC<SalesOrderDetailBodyProps & { auditRequired?: boolean }> = (props) => {
  const { t } = useTranslation();
  const auditRequired = props.auditRequired ?? false;
  return (
    <SalesOrderDetailProvider {...props} auditRequired={auditRequired}>
      <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
        <SalesOrderDetailBasicPane />
      </DetailDrawerSection>
      <DetailDrawerSection title={<SalesOrderDetailCollaborationDrawerTitle />}>
        <SalesOrderDetailCollaborationPane />
      </DetailDrawerSection>
      <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
        <SalesOrderDetailLinesPane />
      </DetailDrawerSection>
      <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
        <SalesOrderDetailTimelinePane />
      </DetailDrawerSection>
    </SalesOrderDetailProvider>
  );
};
