/**
 * 单据耗时统计页面
 *
 * 提供单据节点耗时统计功能，支持查看单据在各个节点的耗时信息。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Table, Descriptions, Typography, Timeline } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { apiRequest } from '../../../../../services/api';
import { getDocumentTimingLifecycle } from '../../../utils/documentTimingLifecycle';

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
  const docTypeLabel = (t?: string) =>
    t === 'work_order' ? '工单' : t === 'purchase_order' ? '采购订单' : t === 'sales_order' ? '销售订单' : t || '-';

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
      render: (_, record: any) => docTypeLabel(record.document_type),
    },
    {
      title: '单据编号',
      dataIndex: 'document_code',
      width: 180,
      fixed: 'left',
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r.document_code ?? '') }} ellipsis>
          {r.document_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '总耗时（小时）',
      dataIndex: 'total_duration_hours',
      width: 120,
      align: 'right',
      search: false,
      render: (_, record: any) => record.total_duration_hours?.toFixed(2) || '-',
    },
    {
      title: '当前阶段',
      dataIndex: 'lifecycle_stage',
      key: 'lifecycle',
      width: 200,
      fixed: 'right',
      align: 'left',
      search: false,
      render: (_, record: any) => (
        <UniLifecycle {...getDocumentTimingLifecycle(record)} showCircleTooltip={false} />
      ),
    },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      search: false,
      render: (_, record: any) => (
        <a onClick={() => handleDetail(record)}>
          <EyeOutlined /> 详情
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
        columnPersistenceId="apps.kuaizhizao.pages.analysis-center.document-timing"
        scroll={{ x: 'max-content' }}
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
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentTiming(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentTiming ? (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="单据类型">
                    <Tag
                      color={
                        currentTiming.document_type === 'work_order'
                          ? 'processing'
                          : currentTiming.document_type === 'purchase_order'
                            ? 'default'
                            : 'success'
                      }
                    >
                      {docTypeLabel(currentTiming.document_type)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="单据编号">
                    <Typography.Text copyable={{ text: String(currentTiming.document_code ?? '') }}>
                      {currentTiming.document_code ?? '-'}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="总耗时（小时）">
                    {currentTiming.total_duration_hours?.toFixed(2) ?? '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="总耗时（秒）">
                    {currentTiming.total_duration_seconds ?? '-'}
                  </Descriptions.Item>
                </Descriptions>
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
                <UniLifecycle {...getDocumentTimingLifecycle(currentTiming)} showCircleTooltip={false} />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  分析中心为只读统计；上下游单据跟踪未接入时仅展示节点汇总进度。
                </Typography.Paragraph>
              </DetailDrawerSection>
              <DetailDrawerSection title="明细信息">
                <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                  <Table
                    columns={nodeColumns}
                    dataSource={currentTiming.nodes || []}
                    rowKey={(r) => String(r.id ?? r.node_code ?? Math.random())}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录" marginBottom={0}>
                <Timeline
                  items={(currentTiming.nodes || []).slice(0, 12).map((n, i) => ({
                    key: String(n.id ?? i),
                    color: 'blue',
                    children: (
                      <>
                        {n.node_name || n.node_code || '节点'} ·{' '}
                        {n.end_time || n.start_time
                          ? `${n.start_time ?? ''} → ${n.end_time ?? ''}`
                          : '-'}
                        {n.operator_name ? ` · ${n.operator_name}` : ''}
                      </>
                    ),
                  }))}
                />
                {(!currentTiming.nodes || currentTiming.nodes.length === 0) && (
                  <Typography.Text type="secondary">暂无节点级时间线，请先加载完整耗时详情。</Typography.Text>
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default DocumentTimingPage;
