/**
 * 销售员业绩排行榜
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Bar } from '@ant-design/charts';
import SalesBaseReport from './BaseReport';
import { getSalesReport } from '../../../services/reports';

const SalespersonPerformance: React.FC = () => {
  const [data, setData] = React.useState<any[]>([]);

  const columns: ProColumns[] = [
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
      request={async (params) => {
        const res = await getSalesReport({
          ...params,
          report_type: 'salesman',
        });
        if (res.success) {
          setData(res.data);
        }
        return {
          data: res.data,
          success: res.success,
          total: res.data?.length || 0,
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
