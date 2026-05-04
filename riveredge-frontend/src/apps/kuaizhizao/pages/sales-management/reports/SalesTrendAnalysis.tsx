/**
 * 销售趋势分析报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Card, Row, Col } from 'antd';
import { Line, Column } from '@ant-design/charts';
import SalesBaseReport from './BaseReport';
import { getSalesReport, parseSalesReportDateRange } from '../../../services/reports';

const SalesTrendAnalysis: React.FC = () => {
  const [data, setData] = React.useState<any[]>([]);

  const columns: ProColumns[] = [
    {
      title: '统计期间',
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as any,
    },
    {
      title: '月份',
      dataIndex: 'month',
      width: 120,
    },
    {
      title: '销售收入',
      dataIndex: 'revenue',
      valueType: 'money',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: '销售数量',
      dataIndex: 'quantity',
      valueType: 'digit',
      sorter: true,
    },
  ];

  return (
    <SalesBaseReport
      title="销售趋势分析"
      reportType="trend"
      columns={columns}
      request={async (params, _s, _f, searchFormValues) => {
        const { date_start, date_end } = parseSalesReportDateRange(searchFormValues);
        const res = await getSalesReport({
          report_type: 'trend',
          date_start,
          date_end,
        });
        const rows = (res.data || []).map((r: any) => ({
          ...r,
          revenue: r.revenue ?? r.total_amount ?? 0,
          quantity: r.quantity ?? 0,
        }));
        if (res.success) {
          setData(rows);
        }
        return {
          data: rows,
          success: res.success,
          total: res.total ?? rows.length ?? 0,
        };
      }}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="月度收入趋势" size="small">
            <Line
              data={data}
              xField="month"
              yField="revenue"
              smooth
              point={{ size: 5, shape: 'diamond' }}
              label={{
                style: {
                  fill: '#aaa',
                },
              }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="月度销量对比" size="small">
            <Column
              data={data}
              xField="month"
              yField="quantity"
              label={{
                position: 'middle',
                style: {
                  fill: '#FFFFFF',
                  opacity: 0.6,
                },
              }}
            />
          </Card>
        </Col>
      </Row>
    </SalesBaseReport>
  );
};

export default SalesTrendAnalysis;
