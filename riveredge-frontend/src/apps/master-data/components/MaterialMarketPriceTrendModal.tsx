import React, { useMemo } from 'react';
import { Empty, Modal, Result, Space, Spin, Typography } from 'antd';
import { Line } from '@ant-design/charts';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatBusinessDateOnly } from '../../../utils/format';
import { materialMarketPriceApi } from '../services/material-market-price';

const { Text } = Typography;

export interface MaterialMarketPriceTrendModalProps {
  open: boolean;
  onClose: () => void;
  quoteCode?: string | null;
  quoteName?: string | null;
  currentPrice?: number;
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const MaterialMarketPriceTrendModal: React.FC<MaterialMarketPriceTrendModalProps> = ({
  open,
  onClose,
  quoteCode,
  quoteName,
  currentPrice,
}) => {
  const { t } = useTranslation();
  const code = quoteCode?.trim() || null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['material-market-price-trend', code],
    queryFn: () => materialMarketPriceApi.getTrend(code!, { days: 30 }),
    enabled: open && !!code,
  });

  const avgPrice = toNumber(data?.averagePrice);
  const minPrice = toNumber(data?.minPrice);
  const maxPrice = toNumber(data?.maxPrice);
  const current = toNumber(currentPrice);

  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((point) => ({
        date: formatBusinessDateOnly(String(point.priceDate)),
        price: toNumber(point.unitPrice),
      })),
    [data?.points],
  );

  const title = t('app.master-data.marketPrices.trendModalTitle', {
    name: quoteName || data?.name || code || '',
  });

  return (
    <Modal
      open={open}
      title={title}
      width={720}
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
      ) : !data || data.points.length === 0 ? (
        <Empty description={t('app.master-data.marketPrices.trendNoData')} />
      ) : (
        <>
          <Space
            separator={<div style={{ width: 1, height: 14, background: 'var(--river-divider-color)' }} />}
            style={{ marginBottom: 16, width: '100%', justifyContent: 'space-around' }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                {t('app.master-data.marketPrices.trendAvgPrice')}
              </div>
              <Text strong style={{ color: '#1890ff' }}>
                {avgPrice.toFixed(2)}
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                {t('app.master-data.marketPrices.trendMinPrice')}
              </div>
              <Text strong style={{ color: '#52c41a' }}>
                {minPrice.toFixed(2)}
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                {t('app.master-data.marketPrices.trendMaxPrice')}
              </div>
              <Text strong style={{ color: '#ff4d4f' }}>
                {maxPrice.toFixed(2)}
              </Text>
            </div>
          </Space>

          <div style={{ height: 260 }}>
            <Line
              data={chartData}
              xField="date"
              yField="price"
              shapeField="smooth"
              axis={{
                x: { title: false },
                y: {
                  title: false,
                  labelFormatter: (value: number) => toNumber(value).toFixed(2),
                },
              }}
              tooltip={{
                title: (datum: { date?: string }) => datum.date,
              }}
              autoFit
            />
          </div>

          {current > 0 && avgPrice > 0 ? (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0faff', borderRadius: 4 }}>
              <Text>
                {t('app.master-data.marketPrices.trendCurrentVsAvg')}
                <Text
                  strong
                  style={{ color: current <= avgPrice ? '#52c41a' : '#ff4d4f', marginLeft: 4 }}
                >
                  {current <= avgPrice
                    ? t('app.master-data.marketPrices.trendBelowAvg')
                    : t('app.master-data.marketPrices.trendAboveAvg')}{' '}
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
