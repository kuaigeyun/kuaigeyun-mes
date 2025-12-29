/**
 * 来料检验页面
 *
 * 提供采购到货物料的检验功能，支持合格/不合格判定和处理
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Form, Card, Row, Col, Statistic, Radio, Input, Select } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

// 来料检验接口定义
interface IncomingInspection {
  id: number;
  inspectionCode: string;
  purchaseOrderCode: string;
  materialCode: string;
  materialName: string;
  supplierName: string;
  batchNo: string;
  quantity: number;
  unit: string;
  inspectionStatus: 'pending' | 'qualified' | 'unqualified' | 'conditional';
  inspectionResult: 'pending' | 'pass' | 'fail';
  inspectorName: string;
  inspectionDate?: string;
  remarks?: string;
  createdAt: string;
}

const IncomingInspectionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 检验Modal状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<IncomingInspection | null>(null);
  const [inspectionForm] = Form.useForm();

  // 详情Drawer状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<IncomingInspection | null>(null);

  // 统计数据状态
  const [stats, setStats] = useState({
    pendingCount: 12,
    qualifiedCount: 45,
    unqualifiedCount: 3,
    totalInspected: 58,
  });

  // 处理检验
  const handleInspect = (record: IncomingInspection) => {
    setCurrentInspection(record);
    setInspectionModalVisible(true);

    // 设置表单初始值
    inspectionForm.setFieldsValue({
      inspectionResult: 'pending',
      remarks: '',
    });
  };

  // 处理检验提交
  const handleInspectionSubmit = async (values: any) => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      const resultText = values.inspectionResult === 'pass' ? '合格' : '不合格';
      messageApi.success(`来料检验完成：${resultText}`);

      setInspectionModalVisible(false);
      inspectionForm.resetFields();
      actionRef.current?.reload();

      // 更新统计数据
      setStats(prev => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
        qualifiedCount: values.inspectionResult === 'pass' ? prev.qualifiedCount + 1 : prev.qualifiedCount,
        unqualifiedCount: values.inspectionResult === 'fail' ? prev.unqualifiedCount + 1 : prev.unqualifiedCount,
        totalInspected: prev.totalInspected + 1,
      }));

    } catch (error: any) {
      messageApi.error(error.message || '检验提交失败');
    }
  };

  // 处理详情查看
  const handleDetail = (record: IncomingInspection) => {
    setInspectionDetail(record);
    setDetailVisible(true);
  };

  // 表格列定义
  const columns: ProColumns<IncomingInspection>[] = [
    {
      title: '检验单号',
      dataIndex: 'inspectionCode',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '采购订单',
      dataIndex: 'purchaseOrderCode',
      width: 120,
    },
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 100,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      align: 'right',
    },
    {
      title: '检验状态',
      dataIndex: 'inspectionStatus',
      width: 100,
      render: (status) => {
        const statusMap = {
          pending: { text: '待检验', color: 'default' },
          qualified: { text: '合格', color: 'success' },
          unqualified: { text: '不合格', color: 'error' },
          conditional: { text: '条件合格', color: 'warning' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '检验结果',
      dataIndex: 'inspectionResult',
      width: 100,
      render: (result) => {
        const resultMap = {
          pending: { text: '待检验', color: 'default' },
          pass: { text: '合格', color: 'success' },
          fail: { text: '不合格', color: 'error' },
        };
        const config = resultMap[result as keyof typeof resultMap] || resultMap.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '检验员',
      dataIndex: 'inspectorName',
      width: 100,
    },
    {
      title: '检验日期',
      dataIndex: 'inspectionDate',
      width: 120,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.inspectionResult === 'pending' ? (
            <Button
              size="small"
              type="primary"
              onClick={() => handleInspect(record)}
            >
              检验
            </Button>
          ) : (
            <Button
              size="small"
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleDetail(record)}
            >
              详情
            </Button>
          )}
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => messageApi.info('编辑功能开发中...')}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div>
        {/* 统计卡片 */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待检验数量"
                  value={stats.pendingCount}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="合格数量"
                  value={stats.qualifiedCount}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="不合格数量"
                  value={stats.unqualifiedCount}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总检验数量"
                  value={stats.totalInspected}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* UniTable */}
        <UniTable<IncomingInspection>
          headerTitle="来料检验管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: IncomingInspection[] = [
              {
                id: 1,
                inspectionCode: 'IQ20251229001',
                purchaseOrderCode: 'PO20251229001',
                materialCode: 'RAW001',
                materialName: '螺丝A',
                supplierName: '供应商A',
                batchNo: 'BATCH001',
                quantity: 1000,
                unit: '个',
                inspectionStatus: 'pending',
                inspectionResult: 'pending',
                inspectorName: '',
                createdAt: '2025-12-29 09:00:00',
              },
              {
                id: 2,
                inspectionCode: 'IQ20251229002',
                purchaseOrderCode: 'PO20251229002',
                materialCode: 'RAW002',
                materialName: '螺母B',
                supplierName: '供应商B',
                batchNo: 'BATCH002',
                quantity: 500,
                unit: '个',
                inspectionStatus: 'qualified',
                inspectionResult: 'pass',
                inspectorName: '张三',
                inspectionDate: '2025-12-29 10:30:00',
                createdAt: '2025-12-29 08:30:00',
              },
              {
                id: 3,
                inspectionCode: 'IQ20251229003',
                purchaseOrderCode: 'PO20251229003',
                materialCode: 'RAW003',
                materialName: '垫片C',
                supplierName: '供应商C',
                batchNo: 'BATCH003',
                quantity: 200,
                unit: '个',
                inspectionStatus: 'unqualified',
                inspectionResult: 'fail',
                inspectorName: '李四',
                inspectionDate: '2025-12-29 11:00:00',
                remarks: '尺寸不符合要求',
                createdAt: '2025-12-29 09:30:00',
              },
            ];

            return {
              data: mockData,
              success: true,
              total: mockData.length,
            };
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          toolBarRender={() => [
            <Button
              key="batch-inspect"
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={() => messageApi.info('批量检验功能开发中...')}
            >
              批量检验
            </Button>,
          ]}
          scroll={{ x: 1400 }}
        />
      </div>

      {/* 检验Modal */}
      <Modal
        title={`来料检验 - ${currentInspection?.inspectionCode}`}
        open={inspectionModalVisible}
        onCancel={() => setInspectionModalVisible(false)}
        onOk={() => inspectionForm.submit()}
        okText="提交检验结果"
        cancelText="取消"
        width={600}
      >
        {currentInspection && (
          <div style={{ marginBottom: 24 }}>
            <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>物料：</strong>{currentInspection.materialName}
                </Col>
                <Col span={12}>
                  <strong>供应商：</strong>{currentInspection.supplierName}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>数量：</strong>{currentInspection.quantity} {currentInspection.unit}
                </Col>
                <Col span={12}>
                  <strong>批次号：</strong>{currentInspection.batchNo}
                </Col>
              </Row>
            </Card>

            <Form
              form={inspectionForm}
              layout="vertical"
              onFinish={handleInspectionSubmit}
            >
              <Form.Item
                name="inspectionResult"
                label="检验结果"
                rules={[{ required: true, message: '请选择检验结果' }]}
              >
                <Radio.Group>
                  <Radio value="pass">
                    <Tag color="success">合格</Tag> 产品符合质量标准
                  </Radio>
                  <Radio value="fail">
                    <Tag color="error">不合格</Tag> 产品不符合质量标准
                  </Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="remarks"
                label="检验备注"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="请输入检验详情、发现的问题或处理意见"
                />
              </Form.Item>

              <Form.Item
                name="inspectorName"
                label="检验员"
                rules={[{ required: true, message: '请输入检验员姓名' }]}
              >
                <Input placeholder="请输入检验员姓名" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 详情Drawer */}
      <Drawer
        title={`检验详情 - ${inspectionDetail?.inspectionCode}`}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={600}
      >
        {inspectionDetail && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>检验单号：</strong>{inspectionDetail.inspectionCode}
                </Col>
                <Col span={12}>
                  <strong>采购订单：</strong>{inspectionDetail.purchaseOrderCode}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>物料：</strong>{inspectionDetail.materialName}
                </Col>
                <Col span={12}>
                  <strong>供应商：</strong>{inspectionDetail.supplierName}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>数量：</strong>{inspectionDetail.quantity} {inspectionDetail.unit}
                </Col>
                <Col span={12}>
                  <strong>批次号：</strong>{inspectionDetail.batchNo}
                </Col>
              </Row>
            </Card>

            <Card title="检验结果">
              <Row gutter={16}>
                <Col span={12}>
                  <strong>检验状态：</strong>
                  <Tag color={
                    inspectionDetail.inspectionStatus === 'qualified' ? 'success' :
                    inspectionDetail.inspectionStatus === 'unqualified' ? 'error' :
                    inspectionDetail.inspectionStatus === 'conditional' ? 'warning' : 'default'
                  }>
                    {inspectionDetail.inspectionStatus === 'qualified' ? '合格' :
                     inspectionDetail.inspectionStatus === 'unqualified' ? '不合格' :
                     inspectionDetail.inspectionStatus === 'conditional' ? '条件合格' : '待检验'}
                  </Tag>
                </Col>
                <Col span={12}>
                  <strong>检验结果：</strong>
                  <Tag color={
                    inspectionDetail.inspectionResult === 'pass' ? 'success' :
                    inspectionDetail.inspectionResult === 'fail' ? 'error' : 'default'
                  }>
                    {inspectionDetail.inspectionResult === 'pass' ? '合格' :
                     inspectionDetail.inspectionResult === 'fail' ? '不合格' : '待检验'}
                  </Tag>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>检验员：</strong>{inspectionDetail.inspectorName}
                </Col>
                <Col span={12}>
                  <strong>检验日期：</strong>{inspectionDetail.inspectionDate}
                </Col>
              </Row>
              {inspectionDetail.remarks && (
                <Row style={{ marginTop: 8 }}>
                  <Col span={24}>
                    <strong>检验备注：</strong>{inspectionDetail.remarks}
                  </Col>
                </Row>
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default IncomingInspectionPage;
