import React, { Suspense, lazy, useMemo } from 'react';
import { Button, Col, Empty, Row, Statistic } from 'antd';
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
  const rows = useMemo(() => orderedAgingRows(data), [data]);
  const chartData = useMemo(() => agingChartData(data), [data]);
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
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无未结清账龄" style={{ margin: '24px 0' }} />
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
                styles={{ content: {fontSize: 16 } }}
              />
              <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                {row.count} 笔
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
          未结清合计 ¥{totalAmount.toFixed(2)} · {totalCount} 笔
        </span>
        <Button type="link" size="small" onClick={() => onOpenDetail(detailPath)}>
          查看明细
        </Button>
      </div>
    </>
  );
};

export default FinanceAgingPanel;
