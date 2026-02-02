/**
 * 物料倒冲记录页面
 *
 * 查看报工触发的物料倒冲记录，支持按工单、物料、状态筛选，失败记录可重试。
 */

import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Card, Tag, message, Button, Modal } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { warehouseApi } from '../../../services/production';

interface BackflushRecordItem {
  id: number;
  work_order_code: string;
  operation_code: string | null;
  report_id: number;
  report_quantity: number;
  material_code: string;
  material_name: string;
  material_unit: string | null;
  batch_no: string | null;
  warehouse_name: string | null;
  bom_quantity: number;
  backflush_quantity: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

const BackflushRecordsPage: React.FC = () => {
  const actionRef = useRef<any>(null);

  const columns: ProColumns<BackflushRecordItem>[] = [
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      width: 130,
      fixed: 'left',
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 140,
    },
    {
      title: '批号',
      dataIndex: 'batch_no',
      width: 100,
      render: (_, record) => record.batch_no || '-',
    },
    {
      title: '报工数量',
      dataIndex: 'report_quantity',
      width: 90,
      valueType: 'digit',
    },
    {
      title: 'BOM用量',
      dataIndex: 'bom_quantity',
      width: 90,
      valueType: 'digit',
    },
    {
      title: '倒冲数量',
      dataIndex: 'backflush_quantity',
      width: 100,
      valueType: 'digit',
      render: (_, record) => `${record.backflush_quantity} ${record.material_unit || ''}`,
    },
    {
      title: '出库仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      render: (_, record) => record.warehouse_name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '待处理' },
          completed: { color: 'green', text: '已完成' },
          failed: { color: 'red', text: '失败' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const s = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      width: 180,
      ellipsis: true,
      render: (_, record) => record.error_message || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 90,
      fixed: 'right',
      render: (_, record) =>
        record.status === 'failed' ? (
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleRetry(record)}
          >
            重试
          </Button>
        ) : null,
    },
  ];

  const handleRetry = (record: BackflushRecordItem) => {
    Modal.confirm({
      title: '重试倒冲',
      content: `确定要重试物料 "${record.material_name}" 的倒冲吗？请确保线边仓已有足够库存。`,
      onOk: async () => {
        try {
          const res = await warehouseApi.backflushRecords.retry(String(record.id));
          if (res?.success) {
            message.success(res?.message || '重试成功');
            actionRef.current?.reload();
          } else {
            message.warning(res?.message || '重试失败');
          }
        } catch {
          message.error('重试失败');
        }
      },
    });
  };

  const fetchRecords = async (params: any) => {
    try {
      const res = await warehouseApi.backflushRecords.list({
        work_order_code: params?.work_order_code,
        material_code: params?.material_code,
        status: params?.status,
        skip: ((params?.current || 1) - 1) * (params?.pageSize || 20),
        limit: params?.pageSize || 20,
      });
      return {
        data: res?.items || [],
        total: res?.total || 0,
        success: true,
      };
    } catch {
      message.error('查询失败');
      return { data: [], total: 0, success: false };
    }
  };

  return (
    <Card title="物料倒冲记录">
      <ProTable<BackflushRecordItem>
        actionRef={actionRef}
        columns={columns}
        request={fetchRecords}
        rowKey="id"
        search={{
          labelWidth: 'auto',
          optionRender: (_, formConfig, form) => [
            ...form,
            <Button key="reset" onClick={() => form?.resetFields()}>
              重置
            </Button>,
            <Button key="submit" type="primary" onClick={() => form?.submit()}>
              查询
            </Button>,
          ],
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1300 }}
        headerTitle="倒冲记录列表"
      />
    </Card>
  );
};

export default BackflushRecordsPage;
