import React, { useMemo } from 'react';
import { Empty, Modal, Result, Space, Spin, Table, Typography } from 'antd';
import { Line } from '@ant-design/charts';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDateBySiteSetting } from '../../../../utils/format';
import {
  fetchPartnerMaterialPriceTrend,
  partnerMaterialPriceTrendQueryKey,
  type PartnerMaterialPriceTrendSide,
} from './types';

const { Text } = Typography;

export interface PartnerMaterialPriceTrendModalProps {
  open: boolean;
  onClose: () => void;
  side: PartnerMaterialPriceTrendSide;
  materialId?: number | null;
  partnerId?: number | null;
  currentPrice?: number;
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const PartnerMaterialPriceTrendModal: React.FC<PartnerMaterialPriceTrendModalProps> = ({
  open,
  onClose,
  side,
  materialId,
  partnerId,
  currentPrice,
}) => {
  const { t } = useTranslation();
  const materialKey = materialId ?? null;
  const partnerKey = partnerId ?? null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: partnerMaterialPriceTrendQueryKey(side, materialKey, partnerKey),
    queryFn: () => fetchPartnerMaterialPriceTrend(side, materialKey!, partnerKey!),
    enabled: open && !!materialKey && !!partnerKey,
  });

  const avgPrice = toNumber(data?.average_price);
  const minPrice = toNumber(data?.min_price);
  const maxPrice = toNumber(data?.max_price);
  const current = toNumber(currentPrice);

  const chartData = useMemo(
    () =>
      (data?.trend_points ?? []).map((point) => ({
        date: formatDateBySiteSetting(point.date),
        price: toNumber(point.price),
        order_code: point.order_code,
      })),
    [data?.trend_points],
  );

  const historyColumns = useMemo(
    () => [
      {
        title:
          side === 'sales'
            ? t('app.kuaizhizao.priceTrend.col.orderDate')
            : t('app.kuaizhizao.purchaseOrder.empower.purchaseDate'),
        dataIndex: 'order_date',
        key: 'order_date',
        width: 120,
        render: (value: string) => formatDateBySiteSetting(value),
      },
      {
        title: t('app.kuaizhizao.priceTrend.col.orderCode'),
        dataIndex: 'order_code',
        key: 'order_code',
        ellipsis: true,
      },
      {
        title:
          side === 'sales'
            ? t('app.kuaizhizao.priceTrend.col.customer')
            : t('app.kuaizhizao.purchaseOrder.col.supplier'),
        dataIndex: 'partner_name',
        key: 'partner_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.empower.unitPrice'),
        dataIndex: 'unit_price',
        key: 'unit_price',
        width: 110,
        align: 'right' as const,
        render: (value: number) => (
          <Text strong style={{ color: current > 0 && toNumber(value) < current ? '#52c41a' : 'inherit' }}>
            ¥{toNumber(value).toFixed(2)}
          </Text>
        ),
      },
    ],
    [current, side, t],
  );

  const title =
    side === 'sales'
      ? t('app.kuaizhizao.priceTrend.modalTitleSales')
      : t('app.kuaizhizao.priceTrend.modalTitlePurchase');

  return (
    <Modal
      open={open}
      title={title}
      width={760}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      mask={{ closable: true }}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin description={t('common.loading')} />
        </div>
      ) : isError ? (
        <Result
          status="error"
          title={t('common.loadFailed')}
          extra={
            <a
              onClick={(event) => {
                event.preventDefault();
                void refetch();
              }}
            >
              {t('common.retry')}
            </a>
          }
        />
      ) : !data || data.history_items.length === 0 ? (
        <Empty description={t('app.kuaizhizao.priceTrend.noHistory')} />
      ) : (
        <>
          <Space
            split={<div style={{ width: 1, height: 14, background: 'var(--river-divider-color)' }} />}
            style={{ marginBottom: 16, width: '100%', justifyContent: 'space-around' }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                {t('app.kuaizhizao.purchaseOrder.empower.avgPrice')}
              </div>
              <Text strong style={{ color: '#1890ff' }}>
                ¥{avgPrice.toFixed(2)}
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                {t('app.kuaizhizao.purchaseOrder.empower.minPrice')}
              </div>
              <Text strong style={{ color: '#52c41a' }}>
                ¥{minPrice.toFixed(2)}
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                {t('app.kuaizhizao.purchaseOrder.empower.maxPrice')}
              </div>
              <Text strong style={{ color: '#ff4d4f' }}>
                ¥{maxPrice.toFixed(2)}
              </Text>
            </div>
          </Space>

          {chartData.length > 0 ? (
            <div style={{ height: 220, marginBottom: 16 }}>
              <Line
                data={chartData}
                xField="date"
                yField="price"
                shapeField="smooth"
                axis={{
                  x: { title: false },
                  y: { title: false, labelFormatter: (value: number) => `¥${toNumber(value).toFixed(2)}` },
                }}
                tooltip={{
                  title: (datum: { date?: string; order_code?: string }) =>
                    datum.order_code ? `${datum.date} ${datum.order_code}` : datum.date,
                }}
                autoFit
              />
            </div>
          ) : null}

          <Table
            size="small"
            rowKey={(row) => `${row.order_id}-${row.order_date}-${row.unit_price}`}
            dataSource={data.history_items}
            pagination={false}
            columns={historyColumns}
            scroll={{ y: 240 }}
          />

          {current > 0 && avgPrice > 0 ? (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0faff', borderRadius: 4 }}>
              <Text>
                {t('app.kuaizhizao.purchaseOrder.empower.currentVsAvg')}
                <Text strong style={{ color: current <= avgPrice ? '#52c41a' : '#ff4d4f', marginLeft: 4 }}>
                  {current <= avgPrice
                    ? t('app.kuaizhizao.purchaseOrder.empower.priceLower')
                    : t('app.kuaizhizao.purchaseOrder.empower.priceHigher')}{' '}
                  {Math.abs(((current - avgPrice) / avgPrice) * 100).toFixed(1)}%
                </Text>
              </Text>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
};
