/**
 * 销售订单详情主体（四区块）
 * 保留订单全息追踪，同时拆分上下游/操作记录，避免框套框。
 */

import React, { useEffect, useState } from 'react';
import { App, Button, Space, Table, Tooltip, Typography, Descriptions } from 'antd';
import { CopyOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AmountDisplay } from '../../../../../../components/permission';
import { MaterialBomIndicator } from '../../../../components/MaterialBomIndicator';
import { MaterialInventoryIndicator } from '../../../../components/MaterialInventoryIndicator';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import {
  DocumentTrackingRelationsBody,
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../../components/document-tracking-panel';
import { DetailDrawerSection } from '../../../../../../components/layout-templates';
import { SalesOrderTrackingRadar } from './SalesOrderTrackingRadar';
import { getSalesOrderLifecycle } from '../../../../utils/salesOrderLifecycle';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../../services/dataDictionary';
import type { SalesOrder, SalesOrderItem } from '../../../../services/sales-order';
import { apiRequest } from '../../../../../../services/api';
import { trySalesOrderPdfmePreviewBlob } from '../../../../utils/salesOrderPdfmePreview';
import type { DocumentPrintApiResult } from '../../../../../../utils/printResponseHelpers';
import { isClientPdfmePrint } from '../../../../../../utils/printResponseHelpers';
import { openPdfBlobInPrintWindow } from '../../../../../../utils/pdfmeClientPrint';

export interface SalesOrderDetailBodyProps {
  order: SalesOrder;
  trackingRefreshKey?: number;
  onTrackingDocumentClick?: (type: string, id: number) => void;
  shippingMethodOptions?: Array<{ label: string; value: string }>;
  paymentTermsOptions?: Array<{ label: string; value: string }>;
  feeTypeOptions?: any[];
}

export const SalesOrderDetailBody: React.FC<SalesOrderDetailBodyProps> = ({
  order,
  trackingRefreshKey = 0,
  onTrackingDocumentClick,
  shippingMethodOptions: shippingProp,
  paymentTermsOptions: paymentProp,
  feeTypeOptions: feeProp,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

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

  const handleDocClick = onTrackingDocumentClick ?? ((type: string, id: number) => {
    messageApi.info(`跳转到${type}#${id}`);
  });

  const handlePrintSalesOrder = async () => {
    if (order.id == null) return;
    try {
      const pdfmeBlob = await trySalesOrderPdfmePreviewBlob(order.id);
      if (pdfmeBlob) {
        const { revoked } = openPdfBlobInPrintWindow(pdfmeBlob);
        if (revoked) {
          messageApi.warning('无法打开打印窗口，请检查浏览器弹窗设置');
        }
        return;
      }

      const result = await apiRequest<DocumentPrintApiResult>(
        `/apps/kuaizhizao/sales-orders/${order.id}/print`,
        {
          method: 'GET',
          params: { response_format: 'json', output_format: 'html' },
        }
      );
      if (isClientPdfmePrint(result)) {
        const blob = await trySalesOrderPdfmePreviewBlob(order.id);
        if (blob) {
          const r = openPdfBlobInPrintWindow(blob);
          if (r.revoked) messageApi.warning('无法打开打印窗口，请检查浏览器弹窗设置');
          return;
        }
        messageApi.warning(result?.message || '当前模板为 pdfme，无法在服务端成稿');
        return;
      }
      const html = result?.content || '';
      if (html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t('app.kuaizhizao.salesOrder.detail')}</title></head><body>${html}</body></html>`
          );
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        } else {
          messageApi.warning('无法打开打印窗口，请检查浏览器弹窗设置');
        }
      } else {
        messageApi.warning('打印内容为空');
      }
    } catch (e: any) {
      messageApi.error(e?.message || '打印失败');
    }
  };

  const lifecycle = getSalesOrderLifecycle(order);
  const mainStages = lifecycle.mainStages ?? [];
  const subStages = lifecycle.subStages ?? [];

  return (
    <>
      <DetailDrawerSection title="基本信息">
        <Descriptions
          column={3}
          size="small"
          items={[
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
            { key: 'customer_name', label: t('app.kuaizhizao.salesOrder.customerName'), children: order.customer_name || '-' },
            { key: 'customer_contact', label: t('app.kuaizhizao.salesOrder.customerContact'), children: order.customer_contact || '-' },
            { key: 'customer_phone', label: t('app.kuaizhizao.salesOrder.customerPhone'), children: order.customer_phone || '-' },
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
            {
              key: 'price_type',
              label: t('app.kuaizhizao.salesOrder.priceType'),
              children: order.price_type === 'tax_inclusive'
                ? t('app.kuaizhizao.salesOrder.taxInclusive')
                : t('app.kuaizhizao.salesOrder.taxExclusive'),
            },
            {
              key: 'total_amount',
              label: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
              children: <AmountDisplay resource="sales_order" value={order.total_amount ?? 0} />,
            },
            {
              key: 'total_fee_amount',
              label: '总费用金额',
              children: <AmountDisplay resource="sales_order" value={order.total_fee_amount ?? 0} />,
            },
            { key: 'shipping_address', label: t('app.kuaizhizao.salesOrder.shippingAddress'), children: order.shipping_address || '-', span: 3 },
            { key: 'notes', label: t('app.kuaizhizao.salesOrder.notes'), children: order.notes || '-', span: 3 },
          ]}
        />
      </DetailDrawerSection>

      <DetailDrawerSection title="生命周期">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {order.id != null && (
            <SalesOrderTrackingRadar salesOrderId={order.id} />
          )}
          {mainStages.length > 0 && (
            <UniLifecycleStepper
              steps={mainStages}
              status={lifecycle.status}
              showLabels
              nextStepSuggestions={lifecycle.nextStepSuggestions}
            />
          )}
          {subStages.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>执行中 · 全链路</div>
              <UniLifecycleStepper steps={subStages} showLabels />
            </div>
          )}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--ant-color-border-secondary)' }}>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>上下游单据</div>
            {tracking.data ? (
              <DocumentTrackingRelationsBody data={tracking.data} onDocumentClick={handleDocClick} />
            ) : (
              <Typography.Text type="secondary">暂无上下游关联</Typography.Text>
            )}
          </div>
        </div>
      </DetailDrawerSection>

      <DetailDrawerSection title="明细信息">
        <style>{`
          /* 仅保留外层横向滚动，避免出现表格内第二层滚动条 */
          .sales-order-detail-drawer-items .ant-table-wrapper .ant-table-content,
          .sales-order-detail-drawer-items .ant-table-wrapper .ant-table-body {
            overflow-x: hidden !important;
          }
          .sales-order-detail-drawer-items .ant-table-thead > tr > th {
            white-space: nowrap;
          }
        `}</style>
        {order.fee_details && order.fee_details.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>费用明细</div>
            <div className="sales-order-detail-drawer-items" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
              <Table
                size="small"
                tableLayout="fixed"
                style={{ minWidth: 560 }}
                columns={[
                  {
                    title: '费用类型',
                    dataIndex: 'type',
                    width: 120,
                    render: (val: string) => feeTypeOptions.find((o: any) => o.value === val)?.label ?? val,
                  },
                  { title: '金额', dataIndex: 'amount', width: 120, align: 'right', render: (val: number) => <AmountDisplay resource="sales_order" value={val} /> },
                  { title: '承担方', dataIndex: 'bearer', width: 100, render: (val: string) => (val === 'our_side' ? '我方' : '对方') },
                  { title: '备注', dataIndex: 'notes' },
                ]}
                dataSource={order.fee_details}
                rowKey={(_: any, i?: number) => i ?? 0}
                pagination={false}
              />
            </div>
          </div>
        )}

        {order.items && order.items.length > 0 ? (
          <div className="sales-order-detail-drawer-items" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
            <Table<SalesOrderItem>
              size="small"
              tableLayout="fixed"
              style={{ minWidth: 1280 }}
              columns={[
                { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
                { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 200 },
                { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 120 },
                { title: t('app.kuaizhizao.salesOrder.unit'), dataIndex: 'material_unit', width: 80 },
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
                  render: (val: number) => <AmountDisplay resource="sales_order" value={val} />,
                },
                { title: t('app.kuaizhizao.salesOrder.taxRate'), dataIndex: 'tax_rate', width: 80, align: 'right' as const, render: (val: number) => val ?? 0 },
                {
                  title: t('app.kuaizhizao.salesOrder.inclAmount'),
                  dataIndex: 'item_amount',
                  width: 120,
                  align: 'right' as const,
                  render: (val: number) => <AmountDisplay resource="sales_order" value={val} />,
                },
                { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 120 },
                { title: t('app.kuaizhizao.salesOrder.deliveredQty'), dataIndex: 'delivered_quantity', width: 100, align: 'right' as const, render: (text: number) => text || 0 },
                { title: t('app.kuaizhizao.salesOrder.remainingQty'), dataIndex: 'remaining_quantity', width: 100, align: 'right' as const, render: (text: number) => text || 0 },
              ]}
              dataSource={order.items}
              rowKey="id"
              pagination={false}
            />
          </div>
        ) : (
          <Typography.Text type="secondary">暂无明细</Typography.Text>
        )}
      </DetailDrawerSection>

      <DetailDrawerSection title="操作记录">
        {tracking.data ? (
          <DocumentTrackingTimelineBody data={tracking.data} />
        ) : (
          <Typography.Text type="secondary">暂无操作记录</Typography.Text>
        )}
      </DetailDrawerSection>
    </>
  );
};

