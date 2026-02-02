/**
 * 单据耗时统计页面
 *
 * 提供单据节点耗时统计功能，支持查看单据在各个节点的耗时信息。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions } from '@ant-design/pro-components';
import { App, Card, Tag, Table } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';

/**
 * 单据耗时统计接口定义
 */
interface DocumentTiming {
  document_type?: string;
  document_id?: number;
  document_code?: string;
  total_duration_seconds?: number;
  total_duration_hours?: number;
  nodes?: DocumentNode[];
}

interface DocumentNode {
  id?: number;
  node_name?: string;
  node_code?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  duration_hours?: number;
  operator_name?: string;
}

/**
 * 单据耗时统计页面组件
 */
const DocumentTimingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentTiming, setCurrentTiming] = useState<DocumentTiming | null>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: DocumentTiming) => {
    try {
      const result = await apiRequest(
        `/apps/kuaizhizao/documents/${record.document_type}/${record.document_id}/timing`,
        { method: 'GET' }
      );
      setCurrentTiming(result);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取耗时统计失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<any>[] = [
    {
      title: '单据类型',
      dataIndex: 'document_type',
      width: 120,
      valueEnum: {
        work_order: { text: '工单', status: 'processing' },
        purchase_order: { text: '采购订单', status: 'default' },
        sales_order: { text: '销售订单', status: 'success' },
      },
    },
    {
      title: '单据编码',
      dataIndex: 'document_code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '总耗时（小时）',
      dataIndex: 'total_duration_hours',
      width: 120,
      align: 'right',
      render: (_, record: any) => record.total_duration_hours?.toFixed(2) || '-',
    },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_, record: any) => (
        <a onClick={() => handleDetail(record)}>
          <EyeOutlined /> 查看
        </a>
      ),
    },
  ];

  /**
   * 节点表格列定义
   */
  const nodeColumns = [
    {
      title: '节点名称',
      dataIndex: 'node_name',
      key: 'node_name',
      width: 120,
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 160,
    },
    {
      title: '耗时（小时）',
      dataIndex: 'duration_hours',
      key: 'duration_hours',
      width: 120,
      align: 'right' as const,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100,
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="单据节点耗时"
        actionRef={actionRef}
        rowKey="document_code"
        columns={columns}
        request={async (params: any) => {
          try {
            const result = await apiRequest('/apps/kuaizhizao/documents/timing', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                document_type: params.document_type,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取单据列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showAdvancedSearch={true}
      />

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={`耗时统计 - ${currentTiming?.document_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentTiming ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <ProDescriptions
                  column={2}
                  dataSource={{
                    document_type: (
                      <Tag color={
                        currentTiming.document_type === 'work_order' ? 'processing' :
                          currentTiming.document_type === 'purchase_order' ? 'default' : 'success'
                      }>
                        {currentTiming.document_type === 'work_order' ? '工单' :
                          currentTiming.document_type === 'purchase_order' ? '采购订单' : '销售订单'}
                      </Tag>
                    ),
                    document_code: currentTiming.document_code,
                    total_duration_hours: currentTiming.total_duration_hours?.toFixed(2) || '-',
                    total_duration_seconds: currentTiming.total_duration_seconds || '-',
                  }}
                  columns={[
                    { title: '单据类型', dataIndex: 'document_type' },
                    { title: '单据编码', dataIndex: 'document_code' },
                    { title: '总耗时（小时）', dataIndex: 'total_duration_hours' },
                    { title: '总耗时（秒）', dataIndex: 'total_duration_seconds' },
                  ]}
                />
              </Card>

              <Card title="节点耗时明细">
                <Table
                  columns={nodeColumns}
                  dataSource={currentTiming.nodes || []}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default DocumentTimingPage;

