/**
 * 现场叫料监控页面
 * 
 * 仓库端用于实时查看并处理来自生产现场的叫料请求。
 * 支持 待处理 -> 配料中 -> 已完成 的状态流转。
 */
import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/warehouse-execution';

const MaterialCallsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  /**
   * 处理叫料请求状态流转
   */
  const handleHandleCall = async (id: number, status: 'picking' | 'completed' | 'cancelled') => {
    try {
      await warehouseApi.materialCall.update(id, { status });
      const statusMap: Record<string, string> = {
        picking: '已开始配料',
        completed: '叫料已完成',
        cancelled: '叫料已取消',
      };
      messageApi.success(statusMap[status] || '操作成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    }
  };

  const columns: ProColumns[] = [
    {
      title: '叫料单号',
      dataIndex: 'code',
      copyable: true,
      width: 140,
      fixed: 'left',
    },
    {
      title: '关联工单',
      dataIndex: 'work_order_code',
      width: 140,
    },
    {
      title: '物料信息',
      key: 'material',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.material_name}</div>
          <div style={{ fontSize: '11px', color: '#666' }}>{record.material_code}</div>
        </div>
      ),
    },
    {
      title: '叫料数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
      render: (val, record) => (
        <Typography.Text strong>{val} {record.unit || ''}</Typography.Text>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      valueType: 'select',
      valueEnum: {
        low: { text: '低', status: 'Default' },
        normal: { text: '正常', status: 'Processing' },
        high: { text: '高', status: 'Warning' },
        urgent: { text: '紧急', status: 'Error' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        pending: { text: '待处理', status: 'Warning' },
        picking: { text: '配料中', status: 'Processing' },
        completed: { text: '已完成', status: 'Success' },
        cancelled: { text: '已取消', status: 'Default' },
      },
    },
    {
      title: '叫料人',
      dataIndex: 'created_by_name',
      width: 100,
    },
    {
      title: '叫料时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      ellipsis: true,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record: any) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<ClockCircleOutlined />}
              onClick={() => handleHandleCall(record.id, 'picking')}
            >
              开始配料
            </Button>
          )}
          {record.status === 'picking' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleHandleCall(record.id, 'completed')}
              style={{ color: '#52c41a' }}
            >
              完成
            </Button>
          )}
          {['pending', 'picking'].includes(record.status) && (
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认取消',
                  content: '确认要取消该叫料请求吗？',
                  onOk: () => handleHandleCall(record.id, 'cancelled'),
                });
              }}
            >
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="现场叫料实时监控"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const res = await warehouseApi.materialCall.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              status: params.status,
              work_order_code: params.work_order_code,
            });
            return {
              data: res.items || [],
              total: res.total || 0,
              success: true,
            };
          } catch (error) {
            return { data: [], success: false, total: 0 };
          }
        }}
        polling={10000} // 每10秒自动刷新一次
      />
    </ListPageTemplate>
  );
};

export default MaterialCallsPage;
