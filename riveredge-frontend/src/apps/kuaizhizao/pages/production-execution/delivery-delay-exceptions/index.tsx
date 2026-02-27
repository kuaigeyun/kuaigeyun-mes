/**
 * 交期延期异常处理页面
 *
 * 提供交期延期异常处理功能，包括延期预警、原因分析、处理建议等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space } from 'antd';
import { EyeOutlined, CheckCircleOutlined, ClockCircleOutlined, ToolOutlined, CloseCircleOutlined, UserAddOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';

/**
 * 延期异常接口定义
 */
interface DeliveryDelayException {
  id?: number;
  work_order_id?: number;
  work_order_code?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  delay_days?: number;
  delay_reason?: string;
  alert_level?: string;
  status?: string;
  suggested_action?: string;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
  created_at?: string;
}

/**
 * 延期异常处理页面组件
 */
const DeliveryDelayExceptionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<DeliveryDelayException | null>(null);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const handleFormRef = useRef<any>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: DeliveryDelayException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 打开处理异常Modal
   */
  const openHandleModal = (record: DeliveryDelayException, action: string) => {
    setCurrentRecord(record);
    setCurrentAction(action);
    setHandleModalVisible(true);
    setTimeout(() => {
      handleFormRef.current?.resetFields();
    }, 100);
  };

  /**
   * 处理延期异常
   */
  const handleException = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error('异常记录不存在');
      }

      const params: any = {
        action: currentAction,
      };

      if (values.remarks) {
        params.remarks = values.remarks;
      }

      await apiRequest(`/apps/kuaizhizao/exceptions/delivery-delay/${currentRecord.id}/handle`, {
        method: 'POST',
        params,
      });
      messageApi.success('处理成功');
      setHandleModalVisible(false);
      setCurrentRecord(null);
      setCurrentAction('');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理失败');
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
      width: 140,
      fixed: 'left',
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
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {record.delay_days} 天
        </span>
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
        critical: { text: '紧急', status: 'error' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'default' },
        processing: { text: '处理中', status: 'processing' },
        resolved: { text: '已解决', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '建议操作',
      dataIndex: 'suggested_action',
      width: 120,
      valueEnum: {
        adjust_plan: { text: '调整计划', status: 'default' },
        increase_resources: { text: '增加资源', status: 'processing' },
        expedite: { text: '加急处理', status: 'error' },
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
                icon={<ToolOutlined />}
                onClick={() => openHandleModal(record, 'adjust_plan')}
              >
                调整计划
              </Button>
              <Button
                type="link"
                size="small"
                icon={<UserAddOutlined />}
                onClick={() => openHandleModal(record, 'increase_resources')}
              >
                增加资源
              </Button>
              <Button
                type="link"
                size="small"
                icon={<ClockCircleOutlined />}
                onClick={() => openHandleModal(record, 'expedite')}
              >
                加急
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => openHandleModal(record, 'resolve')}
              >
                已解决
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => openHandleModal(record, 'cancel')}
                danger
              >
                取消
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
        headerTitle="延期异常"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/apps/kuaizhizao/exceptions/delivery-delay', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                alert_level: params.alert_level,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取异常列表失败');
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
        title={`延期异常详情 - ${currentRecord?.work_order_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>工单编码：</strong>{currentRecord.work_order_code}</p>
              <p><strong>计划结束日期：</strong>{currentRecord.planned_end_date}</p>
              {currentRecord.actual_end_date && (
                <p><strong>实际结束日期：</strong>{currentRecord.actual_end_date}</p>
              )}
              <p><strong>延期天数：</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {currentRecord.delay_days} 天
                </span>
              </p>
              <p><strong>延期原因：</strong>{currentRecord.delay_reason || '-'}</p>
              <p><strong>预警级别：</strong>
                <Tag color={
                  currentRecord.alert_level === 'critical' ? 'red' :
                    currentRecord.alert_level === 'high' ? 'orange' :
                      currentRecord.alert_level === 'medium' ? 'gold' : 'default'
                }>
                  {currentRecord.alert_level === 'critical' ? '紧急' :
                    currentRecord.alert_level === 'high' ? '高' :
                      currentRecord.alert_level === 'medium' ? '中' : '低'}
                </Tag>
              </p>
              <p><strong>状态：</strong>
                <Tag color={
                  currentRecord.status === 'resolved' ? 'success' :
                    currentRecord.status === 'processing' ? 'processing' :
                      currentRecord.status === 'cancelled' ? 'error' : 'default'
                }>
                  {currentRecord.status === 'resolved' ? '已解决' :
                    currentRecord.status === 'processing' ? '处理中' :
                      currentRecord.status === 'cancelled' ? '已取消' : '待处理'}
                </Tag>
              </p>
              <p><strong>建议操作：</strong>
                {currentRecord.suggested_action === 'adjust_plan' ? '调整计划' :
                  currentRecord.suggested_action === 'increase_resources' ? '增加资源' :
                    currentRecord.suggested_action === 'expedite' ? '加急处理' : '-'}
              </p>
              {currentRecord.handled_by_name && (
                <>
                  <p><strong>处理人：</strong>{currentRecord.handled_by_name}</p>
                  <p><strong>处理时间：</strong>{currentRecord.handled_at}</p>
                </>
              )}
              {currentRecord.remarks && (
                <p><strong>备注：</strong>{currentRecord.remarks}</p>
              )}
            </div>
          ) : null
        }
      />

      {/* 处理异常 Modal */}
      <FormModalTemplate
        title={
          currentAction === 'adjust_plan' ? '处理延期异常 - 调整计划' :
            currentAction === 'increase_resources' ? '处理延期异常 - 增加资源' :
              currentAction === 'expedite' ? '处理延期异常 - 加急处理' :
                currentAction === 'resolve' ? '处理延期异常 - 已解决' :
                  currentAction === 'cancel' ? '处理延期异常 - 取消' :
                    '处理延期异常'
        }
        open={handleModalVisible}
        onClose={() => {
          setHandleModalVisible(false);
          setCurrentRecord(null);
          setCurrentAction('');
          handleFormRef.current?.resetFields();
        }}
        onFinish={handleException}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={handleFormRef}
      >
        {currentRecord && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>工单编码：</strong>{currentRecord.work_order_code}</p>
              <p><strong>计划结束日期：</strong>{currentRecord.planned_end_date}</p>
              <p><strong>延期天数：</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {currentRecord.delay_days} 天
                </span>
              </p>
              <p><strong>延期原因：</strong>{currentRecord.delay_reason || '-'}</p>
            </div>
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入处理备注（可选）"
              fieldProps={{
                rows: 4,
              }}
            />
          </>
        )}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default DeliveryDelayExceptionsPage;

