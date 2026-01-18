/**
 * 报工管理 - 工位机触屏模式页面
 *
 * 专门为工控机设计的全屏触屏报工界面，适合车间固定工位使用。
 * 特点：大按钮、大字体、全屏模式、触屏优化布局、扫码报工。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, message, Input, Alert, Spin, Form, Radio, InputNumber, Row, Col, Tag, Divider } from 'antd';
import { QrcodeOutlined, ScanOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { TouchScreenTemplate, TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { reportingApi, workOrderApi } from '../../../services/production';
import { QRCodeScanner } from '../../../../../components/qrcode';
import { qrcodeApi } from '../../../../../services/qrcode';
import { useTouchScreen } from '../../../../../hooks/useTouchScreen';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface WorkOrder {
  id?: number;
  code?: string;
  name?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  completed_quantity?: number;
  status?: string;
}

interface Operation {
  operation_id?: number;
  operation_code?: string;
  operation_name?: string;
  sequence?: number;
  status?: string;
  reporting_type?: 'quantity' | 'status';
  standard_time?: number;
  completed_quantity?: number;
  allow_jump?: boolean;
}

/**
 * 报工管理 - 工位机触屏模式页面
 */
const ReportingKioskPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const touchScreen = useTouchScreen();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // 工单和工序状态
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(null);
  const [workOrderOperations, setWorkOrderOperations] = useState<Operation[]>([]);
  const [currentOperation, setCurrentOperation] = useState<Operation | null>(null);
  const [jumpRuleError, setJumpRuleError] = useState<string>('');

  /**
   * 处理扫码报工
   */
  const handleScanQRCode = () => {
    setScanning(true);
  };

  /**
   * 处理二维码扫描成功
   */
  const handleQRCodeScanned = async (data: any) => {
    setScanning(false);
    
    try {
      // 解析二维码数据
      let workOrderCode = '';
      if (data.qr_type === 'WO' && data.work_order_id) {
        // 从工单二维码获取工单ID
        const workOrder = await workOrderApi.get(data.work_order_id.toString());
        workOrderCode = workOrder.code || '';
      } else if (data.work_order_code) {
        workOrderCode = data.work_order_code;
      } else {
        messageApi.error('二维码数据不完整');
        return;
      }

      if (workOrderCode) {
        await loadWorkOrderByCode(workOrderCode);
      }
    } catch (error: any) {
      messageApi.error(error.message || '处理二维码失败');
    }
  };

  /**
   * 根据工单编码加载工单信息
   */
  const loadWorkOrderByCode = async (workOrderCode: string) => {
    setLoading(true);
    setJumpRuleError('');

    try {
      // 根据工单编码获取工单信息
      const workOrders = await workOrderApi.list({ code: workOrderCode.trim() });
      if (!workOrders || workOrders.length === 0) {
        messageApi.error('未找到该工单');
        setLoading(false);
        return;
      }

      const workOrder = workOrders[0];
      setCurrentWorkOrder(workOrder);

      // 获取工单工序列表
      const operations = await workOrderApi.getOperations(workOrder.id!.toString());
      setWorkOrderOperations(operations || []);

      // 自动选择第一个未完成的工序
      const pendingOperation = operations?.find((op: any) => op.status !== 'completed');
      if (pendingOperation) {
        setCurrentOperation(pendingOperation);
        // 检查跳转规则
        await checkJumpRule(pendingOperation, operations);
        
        // 自动填充表单
        autoFillForm(workOrder, pendingOperation);
      } else {
        messageApi.warning('该工单所有工序已完成');
      }
    } catch (error: any) {
      messageApi.error(error.message || '获取工单信息失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 检查工序跳转规则
   */
  const checkJumpRule = async (operation: Operation, allOperations: Operation[]) => {
    if (operation.allow_jump) {
      setJumpRuleError('');
      return;
    }

    // 检查前序工序是否完成
    const previousOperations = allOperations.filter(
      (op: any) => op.sequence! < operation.sequence! && op.status !== 'completed'
    );

    if (previousOperations.length > 0) {
      const prevOpNames = previousOperations.map((op: any) => op.operation_name).join('、');
      setJumpRuleError(`工序跳转规则：必须先完成前序工序 "${prevOpNames}" 才能报工当前工序`);
    } else {
      setJumpRuleError('');
    }
  };

  /**
   * 自动填充表单
   */
  const autoFillForm = (workOrder: WorkOrder, operation: Operation) => {
    const formValues: any = {};

    // 按数量报工时，自动填充完成数量
    if (operation.reporting_type === 'quantity' && workOrder.quantity) {
      const remainingQuantity = workOrder.quantity - (operation.completed_quantity || 0);
      if (remainingQuantity > 0) {
        formValues.reported_quantity = remainingQuantity;
        formValues.qualified_quantity = remainingQuantity;
        formValues.unqualified_quantity = 0;
      }
    }

    // 按状态报工时，默认选择"完成"
    if (operation.reporting_type === 'status') {
      formValues.completed_status = 'completed';
    }

    // 自动填充工时（根据标准工时和工单数量计算）
    if (operation.standard_time && workOrder.quantity) {
      const estimatedWorkHours = parseFloat(operation.standard_time.toString()) * parseFloat(workOrder.quantity.toString());
      formValues.work_hours = estimatedWorkHours;
    }

    form.setFieldsValue(formValues);
  };

  /**
   * 处理选择工序
   */
  const handleSelectOperation = async (operation: Operation) => {
    setCurrentOperation(operation);
    await checkJumpRule(operation, workOrderOperations);
    
    if (currentWorkOrder) {
      autoFillForm(currentWorkOrder, operation);
    }
  };

  /**
   * 处理提交报工
   */
  const handleSubmit = async (values: any) => {
    if (!currentWorkOrder || !currentOperation) {
      messageApi.error('请先选择工单和工序');
      return;
    }

    if (jumpRuleError) {
      messageApi.error(jumpRuleError);
      return;
    }

    setLoading(true);
    try {
      const reportingData = {
        work_order_id: currentWorkOrder.id,
        operation_id: currentOperation.operation_id,
        reported_quantity: values.reported_quantity || 0,
        qualified_quantity: values.qualified_quantity || 0,
        unqualified_quantity: values.unqualified_quantity || 0,
        work_hours: values.work_hours || 0,
        completed_status: values.completed_status || 'completed',
        remarks: values.remarks || '',
      };

      await reportingApi.create(reportingData);
      messageApi.success('报工成功！');
      
      // 重置表单和状态
      form.resetFields();
      setCurrentWorkOrder(null);
      setCurrentOperation(null);
      setWorkOrderOperations([]);
      setJumpRuleError('');
    } catch (error: any) {
      messageApi.error(error.message || '报工失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理手动输入工单编码
   */
  const handleManualInput = () => {
    const workOrderCode = form.getFieldValue('work_order_code');
    if (workOrderCode) {
      loadWorkOrderByCode(workOrderCode);
    } else {
      messageApi.warning('请输入工单编码');
    }
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    form.resetFields();
    setCurrentWorkOrder(null);
    setCurrentOperation(null);
    setWorkOrderOperations([]);
    setJumpRuleError('');
  };

  return (
    <TouchScreenTemplate
      title="现场报工"
      fullscreen={true}
      footerButtons={[
        {
          title: '提交报工',
          type: 'primary',
          onClick: () => form.submit(),
          disabled: !currentWorkOrder || !currentOperation || !!jumpRuleError,
          block: true,
        },
        {
          title: '重置',
          type: 'default',
          onClick: handleReset,
          block: true,
        },
      ]}
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ width: '100%' }}
        >
          {/* 扫码/输入工单编码区域 */}
          <Card title="工单信息" style={{ marginBottom: 24 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item
                    name="work_order_code"
                    label="工单编码"
                    rules={[{ required: true, message: '请输入工单编码或扫码' }]}
                  >
                    <Input
                      size="large"
                      placeholder="请输入工单编码或点击扫码"
                      suffix={
                        <Button
                          type="link"
                          icon={<QrcodeOutlined />}
                          onClick={handleScanQRCode}
                          style={{ padding: 0 }}
                        >
                          扫码
                        </Button>
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<ScanOutlined />}
                    onClick={handleManualInput}
                    style={{ height: 60, fontSize: 24 }}
                  >
                    加载工单信息
                  </Button>
                </Col>
              </Row>

              {/* 工单信息显示 */}
              {currentWorkOrder && (
                <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <strong>工单编码：</strong>
                      <span>{currentWorkOrder.code}</span>
                    </div>
                    <div>
                      <strong>工单名称：</strong>
                      <span>{currentWorkOrder.name}</span>
                    </div>
                    <div>
                      <strong>产品编码：</strong>
                      <span>{currentWorkOrder.product_code}</span>
                    </div>
                    <div>
                      <strong>产品名称：</strong>
                      <span>{currentWorkOrder.product_name}</span>
                    </div>
                    <div>
                      <strong>计划数量：</strong>
                      <span>{currentWorkOrder.quantity}</span>
                    </div>
                    <div>
                      <strong>已完成数量：</strong>
                      <span>{currentWorkOrder.completed_quantity || 0}</span>
                    </div>
                  </Space>
                </Card>
              )}
            </Space>
          </Card>

          {/* 工序选择区域 */}
          {currentWorkOrder && workOrderOperations.length > 0 && (
            <Card title="选择工序" style={{ marginBottom: 24 }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {workOrderOperations.map((operation) => (
                  <Button
                    key={operation.operation_id}
                    type={currentOperation?.operation_id === operation.operation_id ? 'primary' : 'default'}
                    size="large"
                    block
                    onClick={() => handleSelectOperation(operation)}
                    disabled={operation.status === 'completed'}
                    style={{ height: 60, fontSize: 24, textAlign: 'left' }}
                  >
                    <Space>
                      <span>
                        {operation.sequence}. {operation.operation_name}
                      </span>
                      {operation.status === 'completed' && (
                        <Tag color="success">已完成</Tag>
                      )}
                      {operation.allow_jump && (
                        <Tag color="warning">可跳转</Tag>
                      )}
                    </Space>
                  </Button>
                ))}
              </Space>

              {/* 跳转规则错误提示 */}
              {jumpRuleError && (
                <Alert
                  message={jumpRuleError}
                  type="error"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          )}

          {/* 报工表单区域 */}
          {currentOperation && (
            <Card title="报工信息" style={{ marginBottom: 24 }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* 工序信息显示 */}
                <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <strong>工序编码：</strong>
                      <span>{currentOperation.operation_code}</span>
                    </div>
                    <div>
                      <strong>工序名称：</strong>
                      <span>{currentOperation.operation_name}</span>
                    </div>
                    <div>
                      <strong>报工类型：</strong>
                      <span>{currentOperation.reporting_type === 'quantity' ? '按数量报工' : '按状态报工'}</span>
                    </div>
                  </Space>
                </Card>

                {/* 按数量报工 */}
                {currentOperation.reporting_type === 'quantity' && (
                  <>
                    <Form.Item
                      name="reported_quantity"
                      label="完成数量"
                      rules={[{ required: true, message: '请输入完成数量' }]}
                    >
                      <InputNumber
                        size="large"
                        min={0}
                        precision={2}
                        style={{ width: '100%', height: 60, fontSize: 24 }}
                        placeholder="请输入完成数量"
                      />
                    </Form.Item>

                    <Form.Item
                      name="qualified_quantity"
                      label="合格数量"
                      rules={[{ required: true, message: '请输入合格数量' }]}
                    >
                      <InputNumber
                        size="large"
                        min={0}
                        precision={2}
                        style={{ width: '100%', height: 60, fontSize: 24 }}
                        placeholder="请输入合格数量"
                      />
                    </Form.Item>

                    <Form.Item
                      name="unqualified_quantity"
                      label="不合格数量"
                      rules={[{ required: true, message: '请输入不合格数量' }]}
                    >
                      <InputNumber
                        size="large"
                        min={0}
                        precision={2}
                        style={{ width: '100%', height: 60, fontSize: 24 }}
                        placeholder="请输入不合格数量"
                      />
                    </Form.Item>
                  </>
                )}

                {/* 按状态报工 */}
                {currentOperation.reporting_type === 'status' && (
                  <Form.Item
                    name="completed_status"
                    label="完成状态"
                    rules={[{ required: true, message: '请选择完成状态' }]}
                  >
                    <Radio.Group size="large" style={{ fontSize: 24 }}>
                      <Radio.Button value="completed" style={{ height: 60, lineHeight: '60px', fontSize: 24 }}>
                        <CheckCircleOutlined /> 完成
                      </Radio.Button>
                      <Radio.Button value="incomplete" style={{ height: 60, lineHeight: '60px', fontSize: 24 }}>
                        <CloseCircleOutlined /> 未完成
                      </Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                )}

                {/* 工时 */}
                <Form.Item
                  name="work_hours"
                  label="工时（小时）"
                  rules={[{ required: true, message: '请输入工时' }]}
                >
                  <InputNumber
                    size="large"
                    min={0}
                    precision={2}
                    style={{ width: '100%', height: 60, fontSize: 24 }}
                    placeholder="请输入工时"
                  />
                </Form.Item>

                {/* 备注 */}
                <Form.Item name="remarks" label="备注">
                  <TextArea
                    size="large"
                    rows={4}
                    style={{ fontSize: 24 }}
                    placeholder="请输入备注（可选）"
                  />
                </Form.Item>
              </Space>
            </Card>
          )}
        </Form>
      </Spin>

      {/* 二维码扫描Modal */}
      {scanning && (
        <Modal
          title="扫码报工"
          open={scanning}
          onCancel={() => setScanning(false)}
          footer={null}
          width="90%"
          style={{ maxWidth: 800 }}
        >
          <QRCodeScanner
            onScanSuccess={handleQRCodeScanned}
            onCancel={() => setScanning(false)}
          />
        </Modal>
      )}
    </TouchScreenTemplate>
  );
};

export default ReportingKioskPage;
