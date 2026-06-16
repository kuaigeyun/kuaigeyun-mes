import React, { Suspense, lazy, useMemo } from 'react';
import { Button, Col, Empty, Row, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  agingChartData,
  orderedAgingRows,
  type AgingBucketData,
} from '../utils/financeUiLabels';

const FinancePie = lazy(async () => {
  const { Pie } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Pie>) => <Pie {...props} /> };
});

type FinanceAgingPanelProps = {
  data?: Record<string, AgingBucketData>;
  detailPath: string;
  onOpenDetail: (path: string) => void;
};

const FinanceAgingPanel: React.FC<FinanceAgingPanelProps> = ({ data, detailPath, onOpenDetail }) => {
  const { t } = useTranslation();
  const rows = useMemo(() => orderedAgingRows(data, t), [data, t]);
  const chartData = useMemo(() => agingChartData(data, t), [data, t]);
  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  );
  const totalCount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.count || 0), 0),
    [rows],
  );

  return (
    <>
      {chartData.length > 0 && totalAmount > 0 ? (
        <Suspense fallback={null}>
          <FinancePie
            data={chartData}
            angleField="value"
            colorField="type"
            radius={0.72}
            height={200}
            legend={{ position: 'bottom' }}
            label={false}
          />
        </Suspense>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaicaiwu.financeUi.aging.noOpenAging')}
          style={{ margin: '24px 0' }}
        />
      )}
      <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
        {rows.map((row) => (
          <Col xs={12} sm={6} key={row.bucket}>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--ant-color-fill-quaternary)',
              }}
            >
              <Statistic
                title={row.label}
                value={row.amount}
                precision={2}
                prefix="¥"
                styles={{ content: { fontSize: 16 } }}
              />
              <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                {t('app.kuaicaiwu.financeUi.aging.countUnit', { count: row.count })}
              </div>
            </div>
          </Col>
        ))}
      </Row>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--ant-color-text-secondary)',
          fontSize: 13,
        }}
      >
        <span>
          {t('app.kuaicaiwu.financeUi.aging.openTotal', {
            amount: totalAmount.toFixed(2),
            count: totalCount,
          })}
        </span>
        <Button type="link" size="small" onClick={() => onOpenDetail(detailPath)}>
          {t('app.kuaicaiwu.financeUi.aging.viewDetail')}
        </Button>
      </div>
    </>
  );
};

export default FinanceAgingPanel;
