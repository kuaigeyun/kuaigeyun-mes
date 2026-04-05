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
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/warehouse-execution';
import { getMaterialCallLifecycle } from '../../../utils/materialCallLifecycle';

const MaterialCallsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  /**
   * 处理叫料请求状态流转
   */
  const handleHandleCall = async (id: number, status: 'processing' | 'completed' | 'cancelled') => {
    try {
      await warehouseApi.materialCall.update(id, { status });
      const statusMap: Record<string, string> = {
        processing: '已开始配料',
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
      width: 140,
      fixed: 'left',
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '关联工单',
      dataIndex: 'work_order_code',
      width: 140,
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }} ellipsis>
          {r.work_order_code ?? '-'}
        </Typography.Text>
      ),
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
      dataIndex: 'requested_quantity',
      width: 100,
      align: 'right',
      render: (val, record: any) => {
        const q = val ?? record.quantity ?? record.requested_quantity;
        return (
          <Typography.Text strong>
            {q} {record.unit || record.material_unit || ''}
          </Typography.Text>
        );
      },
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
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        pending: { text: '待处理', status: 'Warning' },
        processing: { text: '配料中', status: 'Processing' },
        partial: { text: '部分送达', status: 'Processing' },
        completed: { text: '已完成', status: 'Success' },
        cancelled: { text: '已取消', status: 'Default' },
      },
    },
    {
      title: '叫料人',
      dataIndex: 'caller_name',
      width: 100,
      render: (_, r: any) => r.caller_name ?? r.created_by_name ?? '-',
    },
    {
      title: '叫料时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r: any) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      ellipsis: true,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 140,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMaterialCallLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record: any) => {
        const st = record.status === 'picking' ? 'processing' : record.status;
        return (
          <Space>
            {st === 'pending' && (
              <Button
                type="link"
                size="small"
                icon={<ClockCircleOutlined />}
                onClick={() => handleHandleCall(record.id, 'processing')}
              >
                开始配料
              </Button>
            )}
            {(st === 'processing' || st === 'partial') && (
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
            {['pending', 'processing', 'partial', 'picking'].includes(record.status) && (
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
        );
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="现场叫料实时监控"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="kuaizhizao-wm-material-calls"
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const res = await warehouseApi.materialCall.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              status: params.status,
              work_order_code: params.work_order_code,
            });
            const rows = Array.isArray(res) ? res : (res as { items?: unknown[] })?.items ?? [];
            const pageSize = params.pageSize || 20;
            const skip = (params.current! - 1) * pageSize;
            const total = Array.isArray(res)
              ? rows.length < pageSize
                ? skip + rows.length
                : skip + rows.length + 1
              : (res as { total?: number }).total ?? rows.length;
            return {
              data: rows as any[],
              total,
              success: true,
            };
          } catch (error) {
            return { data: [], success: false, total: 0 };
          }
        }}
        polling={10000}
        scroll={{ x: 1400 }}
      />
    </ListPageTemplate>
  );
};

export default MaterialCallsPage;
