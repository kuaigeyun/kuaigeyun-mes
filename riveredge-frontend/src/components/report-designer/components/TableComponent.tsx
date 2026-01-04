/**
 * 表格组件
 *
 * 基于Ant Design Table的报表表格组件
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React from 'react';
import { Table } from 'antd';
import { ReportComponent } from '../index';

/**
 * 表格组件Props
 */
export interface TableComponentProps {
  component: ReportComponent;
  data?: any[];
}

/**
 * 表格组件
 */
const TableComponent: React.FC<TableComponentProps> = ({ component, data = [] }) => {
  const columns = component.columns || [];

  return (
    <Table
      dataSource={data}
      columns={columns}
      pagination={component.pagination || false}
      size="small"
      style={component.style}
    />
  );
};

export default TableComponent;

