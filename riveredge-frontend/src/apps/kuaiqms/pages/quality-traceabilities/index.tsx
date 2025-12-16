/**
 * 质量追溯管理页面
 * 
 * 提供质量追溯的查看功能，包括列表展示、详情查看、追溯查询等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions } from '@ant-design/pro-components';
import { App, Drawer, Tag, Button } from 'antd';
import { UniTable } from '@/components/uni-table';
import { qualityTraceabilityApi } from '../../services/process';
import type { QualityTraceability } from '../../types/process';

/**
 * 质量追溯管理列表页面组件
 */
const QualityTraceabilitiesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentTraceUuid, setCurrentTraceUuid] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<QualityTraceability | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: QualityTraceability) => {
    try {
      setCurrentTraceUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await qualityTraceabilityApi.get(record.uuid);
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
  const columns: ProColumns<QualityTraceability>[] = [
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
          '质量档案': { color: 'purple', text: '质量档案' },
        };
        const typeInfo = typeMap[type] || { color: 'default', text: type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
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
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '有效': { text: <Tag color="success">有效</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
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
      <UniTable<QualityTraceability>
        headerTitle="质量追溯管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await qualityTraceabilityApi.list({
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
        title="质量追溯详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : traceDetail ? (
          <ProDescriptions<QualityTraceability>
            column={1}
            dataSource={traceDetail}
            columns={[
              { title: '追溯编号', dataIndex: 'traceNo' },
              { title: '追溯类型', dataIndex: 'traceType' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '批次号', dataIndex: 'batchNo' },
              { title: '序列号', dataIndex: 'serialNo' },
              { title: '追溯数据', dataIndex: 'traceData', valueType: 'jsonCode' },
              { title: '状态', dataIndex: 'status' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default QualityTraceabilitiesPage;
