/**
 * 销售员业绩排行榜
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Bar } from '@ant-design/charts';
import SalesBaseReport from './BaseReport';
import { getSalesReport, parseSalesReportDateRange } from '../../../services/reports';

const SalespersonPerformance: React.FC = () => {
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
      title: '排名',
      dataIndex: 'rank',
      width: 80,
      render: (text) => <b>{text}</b>,
    },
    {
      title: '销售员',
      dataIndex: 'salesman_name',
      width: 150,
    },
    {
      title: '订单总数',
      dataIndex: 'order_count',
      valueType: 'digit',
      sorter: true,
      width: 120,
    },
    {
      title: '总销售金额',
      dataIndex: 'total_revenue',
      valueType: 'money',
      sorter: true,
      width: 150,
    },
  ];

  return (
    <SalesBaseReport
      title="销售员业绩排行"
      reportType="salesman"
      columns={columns}
      request={async (params, _s, _f, searchFormValues) => {
        const { date_start, date_end } = parseSalesReportDateRange(searchFormValues);
        const res = await getSalesReport({
          report_type: 'salesman',
          date_start,
          date_end,
        });
        const rows = res.data || [];
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
      <div style={{ marginBottom: 16, height: 400 }}>
        <Bar
          data={data}
          xField="total_revenue"
          yField="salesman_name"
          seriesField="salesman_name"
          legend={false}
          label={{
            position: 'middle',
            style: {
              fill: '#FFFFFF',
              opacity: 0.6,
            },
          }}
        />
      </div>
    </SalesBaseReport>
  );
};

export default SalespersonPerformance;
