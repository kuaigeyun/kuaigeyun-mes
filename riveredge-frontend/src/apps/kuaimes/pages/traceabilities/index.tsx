/**
 * 生产追溯管理页面
 * 
 * 提供生产追溯的查看功能，包括列表展示、详情查看、追溯查询等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions } from '@ant-design/pro-components';
import { App, Drawer, Tag, Button } from 'antd';
import { UniTable } from '../../../../components/uni-table';
import { traceabilityApi } from '../../services/process';
import type { Traceability } from '../../types/process';

/**
 * 生产追溯管理列表页面组件
 */
const TraceabilitiesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentTraceUuid, setCurrentTraceUuid] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<Traceability | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Traceability) => {
    try {
      setCurrentTraceUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await traceabilityApi.get(record.uuid);
      setTraceDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取追溯详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Traceability>[] = [
    {
      title: '追溯编号',
      dataIndex: 'traceNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.traceNo}</a>
      ),
    },
    {
      title: '追溯类型',
      dataIndex: 'traceType',
      width: 120,
      render: (type) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          '批次追溯': { color: 'blue', text: '批次追溯' },
          '序列号追溯': { color: 'green', text: '序列号追溯' },
        };
        const typeInfo = typeMap[type] || { color: 'default', text: type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 120,
    },
    {
      title: '序列号',
      dataIndex: 'serialNo',
      width: 120,
    },
    {
      title: '工序名称',
      dataIndex: 'operationName',
      width: 150,
    },
    {
      title: '原材料名称',
      dataIndex: 'materialName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '原材料批次号',
      dataIndex: 'materialBatchNo',
      width: 150,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      valueType: 'dateTime',
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Traceability>
        headerTitle="生产追溯管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await traceabilityApi.list({
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
        title="生产追溯详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : traceDetail ? (
          <ProDescriptions<Traceability>
            column={1}
            dataSource={traceDetail}
            columns={[
              { title: '追溯编号', dataIndex: 'traceNo' },
              { title: '追溯类型', dataIndex: 'traceType' },
              { title: '产品ID', dataIndex: 'productId' },
              { title: '产品名称', dataIndex: 'productName' },
              { title: '批次号', dataIndex: 'batchNo' },
              { title: '序列号', dataIndex: 'serialNo' },
              { title: '工序名称', dataIndex: 'operationName' },
              { title: '原材料名称', dataIndex: 'materialName' },
              { title: '原材料批次号', dataIndex: 'materialBatchNo' },
              { title: '数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '追溯数据', dataIndex: 'traceData', valueType: 'jsonCode' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default TraceabilitiesPage;
