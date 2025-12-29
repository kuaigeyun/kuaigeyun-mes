/**
 * 库存查询页面
 *
 * 提供多维度库存查询功能，支持按仓库、物料、批次等条件查询库存状态。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Row, Col, Statistic, Table } from 'antd';
import { ReloadOutlined, ExportOutlined, SearchOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

interface InventoryRecord {
  id: number;
  materialCode: string;
  materialName: string;
  warehouseName: string;
  storageAreaName?: string;
  storageLocationName?: string;
  batchNo?: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  unit: string;
  expiryDate?: string;
  lastInboundDate: string;
}

const InventoryPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 统计数据状态
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    expiringItems: 0,
  });

  /**
   * 表格列定义
   */
  const columns: ProColumns<InventoryRecord>[] = [
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '库区',
      dataIndex: 'storageAreaName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '库位',
      dataIndex: 'storageLocationName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 120,
      ellipsis: true,
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '可用数量',
      dataIndex: 'availableQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '预留数量',
      dataIndex: 'reservedQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      align: 'center',
    },
    {
      title: '到期日期',
      dataIndex: 'expiryDate',
      valueType: 'date',
      width: 120,
    },
    {
      title: '最后入库日期',
      dataIndex: 'lastInboundDate',
      valueType: 'dateTime',
      width: 160,
    },
  ];

  return (
    <div>
      {/* 库存统计卡片 */}
      <div style={{ padding: '0 16px' }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="库存总品种数"
                value={stats.totalItems}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="库存总价值"
                value={stats.totalValue}
                prefix="¥"
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="低库存预警"
                value={stats.lowStockItems}
                suffix="种"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="临近过期"
                value={stats.expiringItems}
                suffix="种"
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* UniTable */}
      <div style={{ padding: '16px' }}>
        <UniTable
        headerTitle="库存查询"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          // 模拟数据
          const mockData: InventoryRecord[] = [
            {
              id: 1,
              materialCode: 'RAW001',
              materialName: '塑料颗粒A',
              warehouseName: '原材料仓库',
              storageAreaName: 'A区',
              storageLocationName: 'A01',
              batchNo: 'BATCH001',
              quantity: 950,
              availableQuantity: 950,
              reservedQuantity: 0,
              unit: 'kg',
              expiryDate: '2026-12-31',
              lastInboundDate: '2024-12-01 10:00:00',
            },
            {
              id: 2,
              materialCode: 'RAW003',
              materialName: '螺丝',
              warehouseName: '原材料仓库',
              storageAreaName: 'B区',
              storageLocationName: 'B02',
              batchNo: 'BATCH003',
              quantity: 9800,
              availableQuantity: 9800,
              reservedQuantity: 0,
              unit: '个',
              lastInboundDate: '2024-12-01 11:30:00',
            },
            {
              id: 3,
              materialCode: 'FIN001',
              materialName: '产品A',
              warehouseName: '成品仓库',
              storageAreaName: 'A区',
              storageLocationName: 'A01',
              batchNo: 'PROD001',
              quantity: 8,
              availableQuantity: 8,
              reservedQuantity: 0,
              unit: '个',
              lastInboundDate: '2024-12-01 15:20:00',
            },
          ];

          return {
            data: mockData,
            success: true,
            total: mockData.length,
          };
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => actionRef.current?.reload()}
          >
            刷新
          </Button>,
          <Button
            key="export"
            icon={<ExportOutlined />}
            onClick={() => messageApi.info('导出功能开发中')}
          >
            导出
          </Button>,
        ]}
        search={{
          labelWidth: 80,
          filterType: 'light',
        }}
        form={{
          syncToUrl: true,
        }}
      />
    </div>
  );
};

export default InventoryPage;
