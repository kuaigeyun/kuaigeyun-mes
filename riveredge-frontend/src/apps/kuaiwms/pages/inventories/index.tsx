/**
 * 库存管理页面
 * 
 * 提供库存的查看功能，包括列表展示、详情查看等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions } from '@ant-design/pro-components';
import { App, Drawer } from 'antd';
import { UniTable } from '@/components/uni_table';
import { inventoryApi } from '../../services/process';
import type { Inventory } from '../../types/process';

/**
 * 库存管理列表页面组件
 */
const InventoriesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentInventoryUuid, setCurrentInventoryUuid] = useState<string | null>(null);
  const [inventoryDetail, setInventoryDetail] = useState<Inventory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Inventory) => {
    try {
      setCurrentInventoryUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await inventoryApi.get(record.uuid);
      setInventoryDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取库存详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Inventory>[] = [
    {
      title: '物料ID',
      dataIndex: 'materialId',
      width: 100,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.materialId}</a>
      ),
    },
    {
      title: '仓库ID',
      dataIndex: 'warehouseId',
      width: 100,
    },
    {
      title: '库位ID',
      dataIndex: 'locationId',
      width: 100,
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '可用数量',
      dataIndex: 'availableQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '预留数量',
      dataIndex: 'reservedQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '在途数量',
      dataIndex: 'inTransitQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 120,
    },
    {
      title: '总成本',
      dataIndex: 'totalCost',
      width: 120,
      valueType: 'money',
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Inventory>
        headerTitle="实时库存管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await inventoryApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="库存详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : inventoryDetail ? (
          <ProDescriptions<Inventory>
            column={1}
            dataSource={inventoryDetail}
            columns={[
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '仓库ID', dataIndex: 'warehouseId' },
              { title: '库位ID', dataIndex: 'locationId' },
              { title: '库存数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '可用数量', dataIndex: 'availableQuantity', valueType: 'digit' },
              { title: '预留数量', dataIndex: 'reservedQuantity', valueType: 'digit' },
              { title: '在途数量', dataIndex: 'inTransitQuantity', valueType: 'digit' },
              { title: '单位', dataIndex: 'unit' },
              { title: '批次号', dataIndex: 'batchNo' },
              { title: '有效期', dataIndex: 'expiryDate', valueType: 'dateTime' },
              { title: '成本单价', dataIndex: 'costPrice', valueType: 'money' },
              { title: '总成本', dataIndex: 'totalCost', valueType: 'money' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default InventoriesPage;
