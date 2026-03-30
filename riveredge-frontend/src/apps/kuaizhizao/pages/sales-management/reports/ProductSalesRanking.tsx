/**
 * 产品销售排行榜报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import SalesBaseReport from './BaseReport';
import { getSalesReport } from '../../../services/reports';

const ProductSalesRanking: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '排名',
      dataIndex: 'rank',
      valueType: 'indexBorder',
      width: 60,
      fixed: 'left',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      ellipsis: true,
      fixed: 'left',
      width: 200,
    },
    {
      title: '产品编号',
      dataIndex: 'product_code',
      width: 150,
    },
    {
      title: '规格型号',
      dataIndex: 'product_spec',
      ellipsis: true,
      width: 150,
    },
    {
      title: '销售总量',
      dataIndex: 'total_quantity',
      valueType: 'digit',
      sorter: true,
      width: 120,
    },
    {
      title: '销售总额',
      dataIndex: 'total_revenue',
      valueType: 'money',
      sorter: true,
      width: 150,
    },
    {
      title: '销售毛利',
      dataIndex: 'profit',
      valueType: 'money',
      sorter: true,
      width: 150,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
    },
    {
      title: '产品类别',
      dataIndex: 'category',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '平均单价',
      dataIndex: 'avg_price',
      valueType: 'money',
      width: 120,
    },
  ];

  return (
    <SalesBaseReport
      title="产品销售排行榜"
      reportType="product_ranking"
      columns={columns}
      request={async (params) => {
        const res = await getSalesReport({
          ...params,
          report_type: 'product_ranking',
        });
        return {
          data: res.data,
          success: res.success,
          total: res.data?.length || 0,
        };
      }}
    />
  );
};

export default ProductSalesRanking;
