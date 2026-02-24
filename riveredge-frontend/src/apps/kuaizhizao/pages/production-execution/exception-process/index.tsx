/**
 * 异常处理流程管理页面
 *
 * 提供异常处理流程管理功能，包括流程启动、分配、步骤流转、解决、取消等。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Modal, message, Steps, Timeline, Card, Divider } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { EyeOutlined, PlayCircleOutlined, UserOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { exceptionApi } from '../../../services/production';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';

/**
 * 异常处理流程接口定义
 */
interface ExceptionProcessRecord {
  id?: number;
  uuid?: string;
  exception_type?: string;
  exception_id?: number;
  process_status?: string;
  current_step?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  remarks?: string;
  created_at?: string;
  histories?: ExceptionProcessHistory[];
}

interface ExceptionProcessHistory {
  id?: number;
  action?: string;
  action_by?: number;
  action_by_name?: string;
  action_at?: string;
  from_step?: string;
  to_step?: string;
  comment?: string;
}

/**
 * 异常处理流程管理页面组件
 */
const ExceptionProcessPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ExceptionProcessRecord | null>(null);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [stepTransitionModalVisible, setStepTransitionModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  // 用户列表交由 UniUserSelect 内置管理
  const [exceptionList, setExceptionList] = useState<any[]>([]);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: ExceptionProcessRecord) => {
    try {
      const detail = await exceptionApi.process.get(String(record.id));
      setCurrentRecord(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || '获取详情失败');
    }
  };

  // 获取用户列表逻辑已由 UniUserSelect 接管

  // 加载异常列表
  useEffect(() => {
    const loadExceptions = async () => {
      try {
        // 加载缺料异常、延期异常、质量异常
        const [materialShortage, deliveryDelay, quality] = await Promise.all([
          exceptionApi.materialShortage.list({ limit: 1000 }).catch(() => []),
          exceptionApi.deliveryDelay.list({ limit: 1000 }).catch(() => []),
          exceptionApi.quality.list({ limit: 1000 }).catch(() => []),
        ]);

        const exceptions: any[] = [];
        (Array.isArray(materialShortage) ? materialShortage : []).forEach((item: any) => {
          exceptions.push({ ...item, exception_type: 'material_shortage', display_name: `缺料异常 - ${item.work_order_code}` });
        });
        (Array.isArray(deliveryDelay) ? deliveryDelay : []).forEach((item: any) => {
          exceptions.push({ ...item, exception_type: 'delivery_delay', display_name: `延期异常 - ${item.work_order_code}` });
        });
        (Array.isArray(quality) ? quality : []).forEach((item: any) => {
          exceptions.push({ ...item, exception_type: 'quality', display_name: `质量异常 - ${item.work_order_code || item.material_code}` });
        });

        setExceptionList(exceptions);
      } catch (error) {
        console.error('获取异常列表失败:', error);
      }
    };
    loadExceptions();
  }, []);

  /**
   * 打开启动流程Modal
   */
  const openStartModal = (record?: ExceptionProcessRecord) => {
    if (record) {
      setCurrentRecord(record);
    }
    setStartModalVisible(true);
  };

  /**
   * 启动异常处理流程
   */
  const handleStart = async (values: any) => {
    try {
      await exceptionApi.process.start({
        exception_type: values.exception_type,
        exception_id: values.exception_id,
        assigned_to: values.assigned_to,
        remarks: values.remarks,
      });
      messageApi.success('异常处理流程启动成功');
      setStartModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '启动异常处理流程失败');
    }
  };

  /**
   * 打开分配Modal
   */
  const openAssignModal = (record: ExceptionProcessRecord) => {
    setCurrentRecord(record);
    setAssignModalVisible(true);
  };

  /**
   * 分配异常处理流程
   */
  const handleAssign = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error('处理记录不存在');
      }
      await exceptionApi.process.assign(String(currentRecord.id), {
        assigned_to: values.assigned_to,
        comment: values.comment,
      });
      messageApi.success('分配成功');
      setAssignModalVisible(false);
      actionRef.current?.reload();
      if (detailDrawerVisible) {
        handleDetail(currentRecord);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '分配失败');
    }
  };

  /**
   * 打开步骤流转Modal
   */
  const openStepTransitionModal = (record: ExceptionProcessRecord) => {
    setCurrentRecord(record);
    setStepTransitionModalVisible(true);
  };

  /**
   * 步骤流转
   */
  const handleStepTransition = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error('处理记录不存在');
      }
      await exceptionApi.process.stepTransition(String(currentRecord.id), {
        to_step: values.to_step,
        comment: values.comment,
      });
      messageApi.success('步骤流转成功');
      setStepTransitionModalVisible(false);
      actionRef.current?.reload();
      if (detailDrawerVisible) {
        handleDetail(currentRecord);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '步骤流转失败');
    }
  };

  /**
   * 打开解决Modal
   */
  const openResolveModal = (record: ExceptionProcessRecord) => {
    setCurrentRecord(record);
    setResolveModalVisible(true);
  };

  /**
   * 解决异常处理流程
   */
  const handleResolve = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error('处理记录不存在');
      }
      await exceptionApi.process.resolve(String(currentRecord.id), {
        comment: values.comment,
        verification_result: values.verification_result,
      });
      messageApi.success('异常已解决');
      setResolveModalVisible(false);
      actionRef.current?.reload();
      setDetailDrawerVisible(false);
    } catch (error: any) {
      messageApi.error(error?.message || '解决失败');
    }
  };

  /**
   * 取消异常处理流程
   */
  const handleCancel = async (record: ExceptionProcessRecord) => {
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消该异常处理流程吗？',
      onOk: async () => {
        try {
          await exceptionApi.process.cancel(String(record.id));
          messageApi.success('已取消');
          actionRef.current?.reload();
          setDetailDrawerVisible(false);
        } catch (error: any) {
          messageApi.error(error?.message || '取消失败');
        }
      },
    });
  };

  /**
   * 获取状态标签
   */
  const getStatusTag = (status?: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '待处理' },
      processing: { color: 'processing', text: '处理中' },
      resolved: { color: 'success', text: '已解决' },
      cancelled: { color: 'error', text: '已取消' },
    };
    const item = statusMap[status || 'pending'] || statusMap.pending;
    return <Tag color={item.color}>{item.text}</Tag>;
  };

  /**
   * 获取异常类型标签
   */
  const getExceptionTypeTag = (type?: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      material_shortage: { color: 'orange', text: '缺料异常' },
      delivery_delay: { color: 'red', text: '延期异常' },
      quality: { color: 'purple', text: '质量异常' },
    };
    const item = typeMap[type || ''] || { color: 'default', text: type || '未知' };
    return <Tag color={item.color}>{item.text}</Tag>;
  };

  /**
   * 获取步骤标签
   */
  const getStepTag = (step?: string) => {
    const stepMap: Record<string, { color: string; text: string }> = {
      detected: { color: 'blue', text: '已检测' },
      assigned: { color: 'cyan', text: '已分配' },
      investigating: { color: 'orange', text: '调查中' },
      handling: { color: 'processing', text: '处理中' },
      verifying: { color: 'purple', text: '验证中' },
      closed: { color: 'success', text: '已关闭' },
      cancelled: { color: 'error', text: '已取消' },
    };
    const item = stepMap[step || ''] || { color: 'default', text: step || '未知' };
    return <Tag color={item.color}>{item.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ExceptionProcessRecord>[] = [
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      width: 120,
      render: (_, record) => getExceptionTypeTag(record.exception_type),
    },
    {
      title: '异常ID',
      dataIndex: 'exception_id',
      width: 100,
    },
    {
      title: '处理状态',
      dataIndex: 'process_status',
      width: 100,
      render: (_, record) => getStatusTag(record.process_status),
    },
    {
      title: '当前步骤',
      dataIndex: 'current_step',
      width: 120,
      render: (_, record) => getStepTag(record.current_step),
    },
    {
      title: '分配给',
      dataIndex: 'assigned_to_name',
      width: 120,
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      width: 180,
      render: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      width: 180,
      render: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          {record.process_status === 'pending' && (
            <Button type="link" size="small" icon={<UserOutlined />} onClick={() => openAssignModal(record)}>
              分配
            </Button>
          )}
          {record.process_status === 'processing' && (
            <>
              <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={() => openStepTransitionModal(record)}>
                流转
              </Button>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => openResolveModal(record)}>
                解决
              </Button>
            </>
          )}
          {['pending', 'processing'].includes(record.process_status || '') && (
            <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(record)}>
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /**
   * 获取步骤配置
   */
  const getStepsConfig = (currentStep?: string) => {
    const steps = [
      { title: '已检测', key: 'detected' },
      { title: '已分配', key: 'assigned' },
      { title: '调查中', key: 'investigating' },
      { title: '处理中', key: 'handling' },
      { title: '验证中', key: 'verifying' },
      { title: '已关闭', key: 'closed' },
    ];

    const currentIndex = steps.findIndex((s) => s.key === currentStep);
    return {
      current: currentIndex >= 0 ? currentIndex : 0,
      steps,
    };
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable<ExceptionProcessRecord>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            if (searchFormValues?.exception_type) {
              apiParams.exception_type = searchFormValues.exception_type;
            }
            if (searchFormValues?.process_status) {
              apiParams.process_status = searchFormValues.process_status;
            }
            if (searchFormValues?.assigned_to) {
              apiParams.assigned_to = searchFormValues.assigned_to;
            }

            try {
              const result = await exceptionApi.process.list(apiParams);
              return {
                data: Array.isArray(result) ? result : (result?.data || result?.items || []),
                success: true,
                total: Array.isArray(result) ? result.length : (result?.total || result?.count || 0),
              };
            } catch (error: any) {
              console.error('获取异常处理流程列表失败:', error);
              messageApi.error(error?.message || '获取列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          showCreateButton={true}
          onCreate={() => openStartModal()}
          searchFormItems={[
            {
              name: 'exception_type',
              label: '异常类型',
              valueType: 'select',
              valueEnum: {
                material_shortage: '缺料异常',
                delivery_delay: '延期异常',
                quality: '质量异常',
              },
            },
            {
              name: 'process_status',
              label: '处理状态',
              valueType: 'select',
              valueEnum: {
                pending: '待处理',
                processing: '处理中',
                resolved: '已解决',
                cancelled: '已取消',
              },
            },
            {
              name: 'assigned_to',
              label: '分配给',
              renderFormItem: () => <UniUserSelect name="assigned_to" />
            },
          ]}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
        />
      </ListPageTemplate>

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title="异常处理流程详情"
        visible={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        extra={
          currentRecord && ['pending', 'processing'].includes(currentRecord.process_status || '') ? (
            <Space>
              {currentRecord.process_status === 'pending' && (
                <Button icon={<UserOutlined />} onClick={() => openAssignModal(currentRecord)}>
                  分配
                </Button>
              )}
              {currentRecord.process_status === 'processing' && (
                <>
                  <Button icon={<ArrowRightOutlined />} onClick={() => openStepTransitionModal(currentRecord)}>
                    步骤流转
                  </Button>
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openResolveModal(currentRecord)}>
                    解决
                  </Button>
                </>
              )}
              <Button danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(currentRecord)}>
                取消
              </Button>
            </Space>
          ) : null
        }
      >
        {currentRecord && (
          <div>
            <ProDescriptions
              column={2}
              bordered
              dataSource={{
                exception_type: getExceptionTypeTag(currentRecord.exception_type),
                exception_id: currentRecord.exception_id,
                process_status: getStatusTag(currentRecord.process_status),
                current_step: getStepTag(currentRecord.current_step),
                assigned_to_name: currentRecord.assigned_to_name || '-',
                assigned_at: currentRecord.assigned_at ? dayjs(currentRecord.assigned_at).format('YYYY-MM-DD HH:mm:ss') : '-',
                started_at: currentRecord.started_at ? dayjs(currentRecord.started_at).format('YYYY-MM-DD HH:mm:ss') : '-',
                completed_at: currentRecord.completed_at ? dayjs(currentRecord.completed_at).format('YYYY-MM-DD HH:mm:ss') : '-',
                remarks: currentRecord.remarks || '-',
              }}
              columns={[
                { title: '异常类型', dataIndex: 'exception_type' },
                { title: '异常ID', dataIndex: 'exception_id' },
                { title: '处理状态', dataIndex: 'process_status' },
                { title: '当前步骤', dataIndex: 'current_step' },
                { title: '分配给', dataIndex: 'assigned_to_name' },
                { title: '分配时间', dataIndex: 'assigned_at' },
                { title: '开始时间', dataIndex: 'started_at' },
                { title: '完成时间', dataIndex: 'completed_at' },
                { title: '备注', dataIndex: 'remarks', span: 2 },
              ]}
            />

            <Divider />

            <Card title="处理流程" style={{ marginBottom: 16 }}>
              <Steps
                {...getStepsConfig(currentRecord.current_step)}
                items={getStepsConfig(currentRecord.current_step).steps.map((step) => ({ title: step.title }))}
              />
            </Card>

            {currentRecord.histories && currentRecord.histories.length > 0 && (
              <Card title="处理历史">
                <Timeline>
                  {currentRecord.histories.map((history, index) => (
                    <Timeline.Item key={index}>
                      <div>
                        <div>
                          <strong>{history.action_by_name}</strong> - {history.action}
                          {history.from_step && history.to_step && (
                            <span>
                              {' '}
                              ({history.from_step} → {history.to_step})
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px', marginTop: 4 }}>
                          {dayjs(history.action_at).format('YYYY-MM-DD HH:mm:ss')}
                        </div>
                        {history.comment && <div style={{ marginTop: 8 }}>{history.comment}</div>}
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}
          </div>
        )}
      </DetailDrawerTemplate>

      {/* 启动流程Modal */}
      <FormModalTemplate
        title="启动异常处理流程"
        open={startModalVisible}
        onClose={() => {
          setStartModalVisible(false);
          setCurrentRecord(null);
        }}
        onFinish={handleStart}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formItems={[
          {
            name: 'exception_type',
            label: '异常类型',
            valueType: 'select',
            rules: [{ required: true, message: '请选择异常类型' }],
            valueEnum: {
              material_shortage: '缺料异常',
              delivery_delay: '延期异常',
              quality: '质量异常',
            },
            fieldProps: {
              onChange: (_: string) => {
                // 清空exception_id选择
                const form = (document.querySelector('.ant-pro-form') as any)?.__form;
                if (form) {
                  form.setFieldsValue({ exception_id: undefined });
                }
              },
            },
          },
          {
            name: 'exception_id',
            label: '异常记录',
            valueType: 'select',
            rules: [{ required: true, message: '请选择异常记录' }],
            dependencies: ['exception_type'],
            request: async (params: any) => {
              const exceptionType = params.exception_type;
              if (!exceptionType) {
                return [];
              }
              const filtered = exceptionList.filter((item) => item.exception_type === exceptionType);
              return filtered.map((item) => ({
                label: item.display_name || `${item.id}`,
                value: item.id,
              }));
            },
          },
          {
            name: 'assigned_to',
            label: '分配给',
            renderFormItem: () => <UniUserSelect name="assigned_to" />
          },
          {
            name: 'remarks',
            label: '备注',
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />

      {/* 分配Modal */}
      <FormModalTemplate
        title="分配异常处理流程"
        open={assignModalVisible}
        onClose={() => {
          setAssignModalVisible(false);
        }}
        onFinish={handleAssign}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formItems={[
          {
            name: 'assigned_to',
            label: '分配给',
            rules: [{ required: true, message: '请选择分配给谁' }],
            renderFormItem: () => <UniUserSelect name="assigned_to" />
          },
          {
            name: 'comment',
            label: '备注',
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />

      {/* 步骤流转Modal */}
      <FormModalTemplate
        title="步骤流转"
        open={stepTransitionModalVisible}
        onClose={() => {
          setStepTransitionModalVisible(false);
        }}
        onFinish={handleStepTransition}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formItems={[
          {
            name: 'to_step',
            label: '目标步骤',
            valueType: 'select',
            rules: [{ required: true, message: '请选择目标步骤' }],
            valueEnum: {
              detected: '已检测',
              assigned: '已分配',
              investigating: '调查中',
              handling: '处理中',
              verifying: '验证中',
              closed: '已关闭',
            },
          },
          {
            name: 'comment',
            label: '备注',
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />

      {/* 解决Modal */}
      <FormModalTemplate
        title="解决异常处理流程"
        open={resolveModalVisible}
        onClose={() => {
          setResolveModalVisible(false);
        }}
        onFinish={handleResolve}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formItems={[
          {
            name: 'comment',
            label: '备注',
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
          {
            name: 'verification_result',
            label: '验证结果',
            valueType: 'textarea',
            fieldProps: {
              rows: 4,
            },
          },
        ]}
      />
    </>
  );
};

export default ExceptionProcessPage;
