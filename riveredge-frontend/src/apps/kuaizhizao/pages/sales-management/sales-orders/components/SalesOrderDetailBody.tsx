/**
 * 销售订单详情主体（基本信息 / 生命周期·协作 / 明细 / 操作记录）
 *
 * 原版外壳：SalesOrderDetailDrawer（Provider + DetailDrawerTemplate 插槽）。
 * SalesOrderDetailBody（plainBody 分区卡片）仅保留兼容，关联入口禁止使用。
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { App, Button, Space, Table, Tooltip, Typography, Descriptions, Tag } from 'antd';
import { CopyOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import { AmountDisplay } from '../../../../../../components/permission';
import { KUAIZHIZAO_SALES_ORDER_FIELD_RESOURCE as SO } from '../../../../constants/fieldPermissionResources';
import { MaterialUnitLabel } from '../../../../../../components/material-unit-label';
import { MaterialBomIndicator } from '../../../../components/MaterialBomIndicator';
import { MaterialInventoryIndicator } from '../../../../components/MaterialInventoryIndicator';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DetailAuditPhaseTitleExtra } from '../../../../../../components/uni-audit/DetailAuditPhaseRow';
import type { LifecycleResult } from '../../../../../../components/uni-lifecycle/types';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { DetailDrawerSection, useDetailDrawerDescriptionItems, type TraceBriefDocument } from '../../../../../../components/layout-templates';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { alignDescriptionColumns } from '../../shared/documentFieldAlignment';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../../components/custom-fields';
import type { CustomField } from '../../../../../../services/customField';
import { getSalesOrderLifecycle } from '../../../../utils/salesOrderLifecycle';
import { formatOrderChangeStatusLabel } from '../../../../utils/orderChangeLifecycle';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../../services/dataDictionary';
import type { SalesOrder, SalesOrderItem } from '../../../../services/sales-order';
import { listSalesOrderChangesByOrder, type SalesOrderChange } from '../../../../services/sales-order-change';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';
import { UniWorkflowActions } from '../../../../../../components/uni-workflow-actions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { isManualAuditEnabled } from '../../../../../../utils/auditMode';

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

/** 关联/只读场景：打印 + 工作流（须在 Provider 内） */
export const SalesOrderDetailReadonlyExtra: React.FC<{ onWorkflowSuccess?: () => void }> = ({
  onWorkflowSuccess,
}) => {
  const { t } = useTranslation();
  const { order, handlePrintSalesOrder } = useSalesOrderDetailContext();
  const salesOrderPerms = useResourcePermissions('kuaizhizao:sales-order');
  return (
    <Space size="small">
      <UniWorkflowActions
        {...rowActionKind('skip')}
        record={order}
        entityName={t('app.kuaizhizao.salesOrder.entityName')}
        entityType="sales_order"
        unifiedAudit
        resourcePrefix="kuaizhizao:sales-order"
        theme="default"
        onSuccess={() => onWorkflowSuccess?.()}
        confirmMessages={{
          submit: isManualAuditEnabled(order.audit)
            ? t('app.kuaizhizao.salesOrder.submitConfirmAudit')
            : t('app.kuaizhizao.salesOrder.submitConfirmAuto'),
        }}
      />
      {order.id != null && salesOrderPerms.canPrint ? (
        <Button icon={<PrinterOutlined />} onClick={() => void handlePrintSalesOrder()}>
          {t('components.uniAction.print')}
        </Button>
      ) : null}
    </Space>
  );
};

/** DetailDrawerSection 生命周期标题行右侧审核状态（须在 Provider 内） */
export const SalesOrderDetailCollaborationTitleExtra: React.FC = () => {
  const { order } = useSalesOrderDetailContext();
  return <DetailAuditPhaseTitleExtra record={order} />;
};

/** DetailDrawerTemplate.collaborationTitleSuffix（须在 Provider 内） */
export const SalesOrderDetailCollaborationTitleSuffix: React.FC = () => {
  const { t } = useTranslation();
  const { lifecycle } = useSalesOrderDetailContext();
  const next = lifecycle.nextStepSuggestions;
  if (!next?.length) return null;
  return (
    <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
      {t('common.next')}：
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

  const columns = useMemo(
    () =>
      alignDescriptionColumns<SalesOrder>([
        {
          title: t('app.kuaizhizao.salesOrder.orderCode'),
          dataIndex: 'order_code',
          render: (_, record) => (
            <Space size={4}>
              <span>{record.order_code ?? '-'}</span>
              <Tooltip title={t('common.print')}>
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
                    const text = record.order_code ?? '';
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
        { title: t('app.kuaizhizao.salesOrder.orderDate'), dataIndex: 'order_date', valueType: 'date' },
        { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', valueType: 'date' },
        { title: t('app.kuaizhizao.salesOrder.customerName'), dataIndex: 'customer_name' },
        { title: t('app.kuaizhizao.salesOrder.customerContact'), dataIndex: 'customer_contact' },
        { title: t('app.kuaizhizao.salesOrder.customerPhone'), dataIndex: 'customer_phone' },
        {
          title: t('app.kuaizhizao.salesContract.linkedContract'),
          dataIndex: 'contract_code',
          key: 'linked_contract_code',
        },
        { title: t('app.kuaizhizao.salesOrder.shippingAddress'), dataIndex: 'shipping_address', span: 3 },
        { title: t('app.kuaizhizao.salesOrder.salesman'), dataIndex: 'salesman_name' },
        {
          title: t('app.kuaizhizao.salesOrder.shippingMethod'),
          dataIndex: 'shipping_method',
          render: (_, record) =>
            shippingMethodOptions.find((o) => o.value === record.shipping_method)?.label ??
            record.shipping_method ??
            '-',
        },
        {
          title: t('app.kuaizhizao.salesOrder.paymentTerms'),
          dataIndex: 'payment_terms',
          render: (_, record) =>
            paymentTermsOptions.find((o) => o.value === record.payment_terms)?.label ??
            record.payment_terms ??
            '-',
        },
        {
          title: t('app.kuaizhizao.salesOrder.priceType'),
          dataIndex: 'price_type',
          render: (_, record) =>
            record.price_type === 'tax_inclusive'
              ? t('app.kuaizhizao.salesOrder.taxInclusive')
              : t('app.kuaizhizao.salesOrder.taxExclusive'),
        },
        {
          title: t('app.kuaizhizao.salesOrder.discountAmount'),
          dataIndex: 'discount_amount',
          render: (_, record) =>
            Number(record.discount_amount ?? 0) > 0 ? (
              <AmountDisplay resource={SO} fieldName="amount" value={record.discount_amount ?? 0} />
            ) : (
              '-'
            ),
        },
        {
          title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
          dataIndex: 'total_amount',
          render: (_, record) => (
            <AmountDisplay resource={SO} fieldName="total_amount" value={record.total_amount ?? 0} />
          ),
        },
        {
          title: t('app.kuaizhizao.salesOrder.totalFeeAmount'),
          dataIndex: 'total_fee_amount',
          render: (_, record) => (
            <AmountDisplay resource={SO} fieldName="amount" value={record.total_fee_amount ?? 0} />
          ),
        },
      ] as ProDescriptionsItemProps<SalesOrder>[]),
    [t, shippingMethodOptions, paymentTermsOptions, handlePrintSalesOrder, messageApi],
  );

  const noteColumns = useMemo(
    () =>
      alignDescriptionColumns<SalesOrder>([
        { title: t('common.remark'), dataIndex: 'notes', span: 3 },
      ] as ProDescriptionsItemProps<SalesOrder>[]),
    [t],
  );
  const basicItems = useDetailDrawerDescriptionItems(columns, order, 'sales_order');
  const noteItems = useDetailDrawerDescriptionItems(noteColumns, order, 'sales_order');

  return (
    <>
      <Descriptions column={3} size="small" items={basicItems} />
      {showCustomFields ? (
        <div style={{ marginTop: 16 }}>
          <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
        </div>
      ) : null}
      <Descriptions
        column={3}
        size="small"
        style={{ marginTop: showCustomFields ? 16 : 0 }}
        items={noteItems}
      />
    </>
  );
};

/** 销售订单全链路节点简易操作（供 DetailDrawerTemplate.traceDocument 使用） */
export function renderSalesOrderTraceBriefActions(
  doc: TraceBriefDocument,
  opts: {
    t: TFunction;
    navigate: NavigateFunction;
    closeDrawer: () => void;
  },
): React.ReactNode {
  const { t, navigate, closeDrawer } = opts;
  return (
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
  );
}

export const SalesOrderDetailCollaborationPane: React.FC = () => {
  const { lifecycle } = useSalesOrderDetailContext();
  const mainStages = lifecycle.mainStages ?? [];
  const subStages = lifecycle.subStages ?? [];
  const hideStepperNext = Boolean(lifecycle.nextStepSuggestions?.length);

  return (
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
    </div>
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
                { title: t('common.remark'), dataIndex: 'notes' },
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
              { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 200,
                render: (val: string, record: SalesOrderItem) => (
                  <span>
                    {val}
                    {(record as any).is_gift ? (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        {t('app.kuaizhizao.sales.isGift')}
                      </Tag>
                    ) : null}
                  </span>
                ),
              },
              { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 120 },
              {
                title: t('common.unit'),
                dataIndex: 'material_unit',
                width: 80,
                render: (v: string) => <MaterialUnitLabel value={v} />,
              },
              {
                title: t('app.kuaizhizao.salesOrder.bomCheck'),
                key: 'bom_check',
                width: 80,
                render: (_: unknown, record: SalesOrderItem) => <MaterialBomIndicator materialId={record.material_id} />,
              },
              {
                title: t('common.quantity'),
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
                render: (val: number, record: SalesOrderItem) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <AmountDisplay resource={SO} fieldName="unit_price" value={val} />
                    {(record as SalesOrderItem & { price_settlement_status?: string }).price_settlement_status ===
                    'PROVISIONAL' ? (
                      <MarkerTag color="warning">{t('app.kuaizhizao.salesOrder.priceProvisional')}</MarkerTag>
                    ) : null}
                  </span>
                ),
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
            {
              title: t('common.status'),
              dataIndex: 'status',
              width: 100,
              render: (status: string) => formatOrderChangeStatusLabel(status, t),
            },
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
      <DetailDrawerSection
        title={<SalesOrderDetailCollaborationDrawerTitle />}
        titleExtra={<SalesOrderDetailCollaborationTitleExtra />}
      >
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
