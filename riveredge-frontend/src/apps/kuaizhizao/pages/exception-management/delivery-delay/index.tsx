/**
 * 交期延期异常管理页面
 *
 * 提供交期延期异常的管理功能，包括异常列表查看、异常处理等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message } from 'antd';
import { EyeOutlined, CheckCircleOutlined, EditOutlined, RocketOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { exceptionApi } from '../../../services/production';

interface DeliveryDelayException {
  id?: number;
  uuid?: string;
  work_order_id?: number;
  work_order_code?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  delay_days?: number;
  delay_reason?: string;
  alert_level?: string;
  status?: string;
  suggested_action?: string;
  handled_by?: number;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const DeliveryDelayExceptionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  // Modal 相关状态
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentExceptionId, setCurrentExceptionId] = useState<number | null>(null);
  const [handleAction, setHandleAction] = useState<string>('adjust_plan');

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentException, setCurrentException] = useState<DeliveryDelayException | null>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: DeliveryDelayException) => {
    try {
      setCurrentException(record);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取异常详情失败');
    }
  };

  /**
   * 处理异常
   */
  const handleException = async (record: DeliveryDelayException, action: string) => {
    setCurrentExceptionId(record.id!);
    setHandleAction(action);
    setHandleModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      action,
    });
  };

  /**
   * 处理提交异常处理
   */
  const handleExceptionSubmit = async (values: any) => {
    try {
      if (!currentExceptionId) {
        messageApi.error('异常记录ID不存在');
        return;
      }

      await exceptionApi.deliveryDelay.handle(
        currentExceptionId.toString(),
        values.action,
        values.remarks
      );
      messageApi.success('异常处理成功');
      setHandleModalVisible(false);
      setCurrentExceptionId(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理异常失败');
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DeliveryDelayException>[] = [
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '计划结束日期',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '延期天数',
      dataIndex: 'delay_days',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Tag color="error">{record.delay_days}天</Tag>
      ),
    },
    {
      title: '延期原因',
      dataIndex: 'delay_reason',
      width: 200,
      ellipsis: true,
    },
    {
      title: '预警级别',
      dataIndex: 'alert_level',
      width: 100,
      valueEnum: {
        low: { text: '低', status: 'default' },
        medium: { text: '中', status: 'warning' },
        high: { text: '高', status: 'error' },
        critical: { text: '严重', status: 'error' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'warning' },
        processing: { text: '处理中', status: 'processing' },
        resolved: { text: '已解决', status: 'success' },
        cancelled: { text: '已取消', status: 'default' },
      },
    },
    {
      title: '建议操作',
      dataIndex: 'suggested_action',
      width: 120,
      valueEnum: {
        adjust_plan: { text: '调整计划', status: 'default' },
        increase_resources: { text: '增加资源', status: 'warning' },
        expedite: { text: '加急', status: 'error' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleException(record, 'adjust_plan')}
              >
                调整计划
              </Button>
              <Button
                type="link"
                size="small"
                icon={<RocketOutlined />}
                onClick={() => handleException(record, 'expedite')}
              >
                加急
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleException(record, 'resolve')}
              >
                解决
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="交期延期异常管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const result = await exceptionApi.deliveryDelay.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              work_order_id: params.work_order_id,
              status: params.status,
              alert_level: params.alert_level,
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        scroll={{ x: 1400 }}
      />

      {/* 处理异常Modal */}
      <FormModalTemplate
        title="处理交期延期异常"
        open={handleModalVisible}
        onCancel={() => {
          setHandleModalVisible(false);
          setCurrentExceptionId(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleExceptionSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color="info">
            处理操作：
            {handleAction === 'adjust_plan' ? '调整计划' :
             handleAction === 'increase_resources' ? '增加资源' :
             handleAction === 'expedite' ? '加急' : '解决'}
          </Tag>
        </div>
        <div>
          <label>备注：</label>
          <textarea
            rows={3}
            onChange={(e) => {
              formRef.current?.setFieldsValue({
                remarks: e.target.value,
              });
            }}
          />
        </div>
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="交期延期异常详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentException(null);
        }}
        dataSource={currentException || {}}
        columns={[
          {
            title: '工单编码',
            dataIndex: 'work_order_code',
          },
          {
            title: '计划结束日期',
            dataIndex: 'planned_end_date',
            valueType: 'dateTime',
          },
          {
            title: '实际结束日期',
            dataIndex: 'actual_end_date',
            valueType: 'dateTime',
          },
          {
            title: '延期天数',
            dataIndex: 'delay_days',
          },
          {
            title: '延期原因',
            dataIndex: 'delay_reason',
          },
          {
            title: '预警级别',
            dataIndex: 'alert_level',
            valueEnum: {
              low: { text: '低', status: 'default' },
              medium: { text: '中', status: 'warning' },
              high: { text: '高', status: 'error' },
              critical: { text: '严重', status: 'error' },
            },
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              pending: { text: '待处理', status: 'warning' },
              processing: { text: '处理中', status: 'processing' },
              resolved: { text: '已解决', status: 'success' },
              cancelled: { text: '已取消', status: 'default' },
            },
          },
          {
            title: '建议操作',
            dataIndex: 'suggested_action',
            valueEnum: {
              adjust_plan: { text: '调整计划', status: 'default' },
              increase_resources: { text: '增加资源', status: 'warning' },
              expedite: { text: '加急', status: 'error' },
            },
          },
          {
            title: '处理人',
            dataIndex: 'handled_by_name',
          },
          {
            title: '处理时间',
            dataIndex: 'handled_at',
            valueType: 'dateTime',
          },
          {
            title: '备注',
            dataIndex: 'remarks',
          },
        ]}
      />
    </ListPageTemplate>
  );
};

export default DeliveryDelayExceptionPage;
