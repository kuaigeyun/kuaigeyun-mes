/**
 * 物料需求管理页面
 * 
 * 提供物料需求的查看功能，包括列表展示、详情查看等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions } from '@ant-design/pro-components';
import { App, Drawer, Tag } from 'antd';
import { UniTable } from '@/components/uni_table';
import { materialRequirementApi } from '../../services/process';
import type { MaterialRequirement } from '../../types/process';

/**
 * 物料需求管理列表页面组件
 */
const MaterialRequirementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentRequirementUuid, setCurrentRequirementUuid] = useState<string | null>(null);
  const [requirementDetail, setRequirementDetail] = useState<MaterialRequirement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: MaterialRequirement) => {
    try {
      setCurrentRequirementUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await materialRequirementApi.get(record.uuid);
      setRequirementDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取需求详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaterialRequirement>[] = [
    {
      title: '需求编号',
      dataIndex: 'requirementNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.requirementNo}</a>
      ),
    },
    {
      title: '物料ID',
      dataIndex: 'materialId',
      width: 100,
    },
    {
      title: '需求类型',
      dataIndex: 'requirementType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        'MRP': { text: <Tag color="blue">MRP</Tag> },
        'LRP': { text: <Tag color="green">LRP</Tag> },
      },
    },
    {
      title: '毛需求',
      dataIndex: 'grossRequirement',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '可用库存',
      dataIndex: 'availableStock',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '净需求',
      dataIndex: 'netRequirement',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '建议类型',
      dataIndex: 'suggestedType',
      width: 100,
      render: (type) => {
        if (!type) return '-';
        const typeMap: Record<string, { color: string; text: string }> = {
          '采购': { color: 'blue', text: '采购' },
          '生产': { color: 'green', text: '生产' },
          '委外': { color: 'orange', text: '委外' },
        };
        const info = typeMap[type] || { color: 'default', text: type };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待处理': { text: <Tag color="orange">待处理</Tag> },
        '已生成计划': { text: <Tag color="green">已生成计划</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
      },
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<MaterialRequirement>
        headerTitle="物料需求管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await materialRequirementApi.list({
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
        title="物料需求详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : requirementDetail ? (
          <ProDescriptions<MaterialRequirement>
            column={1}
            dataSource={requirementDetail}
            columns={[
              { title: '需求编号', dataIndex: 'requirementNo' },
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '需求类型', dataIndex: 'requirementType' },
              { title: '需求日期', dataIndex: 'requirementDate', valueType: 'dateTime' },
              { title: '毛需求', dataIndex: 'grossRequirement', valueType: 'digit' },
              { title: '可用库存', dataIndex: 'availableStock', valueType: 'digit' },
              { title: '在途库存', dataIndex: 'inTransitStock', valueType: 'digit' },
              { title: '安全库存', dataIndex: 'safetyStock', valueType: 'digit' },
              { title: '净需求', dataIndex: 'netRequirement', valueType: 'digit' },
              { title: '建议数量', dataIndex: 'suggestedOrderQty', valueType: 'digit' },
              { title: '建议日期', dataIndex: 'suggestedOrderDate', valueType: 'dateTime' },
              { title: '建议类型', dataIndex: 'suggestedType' },
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

export default MaterialRequirementsPage;
