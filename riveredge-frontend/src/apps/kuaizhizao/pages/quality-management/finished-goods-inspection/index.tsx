/**
 * 成品检验页面
 *
 * 提供生产完工成品的最终检验功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Form, Card, Row, Col, Statistic, Radio, Input, Select, Table } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, ScanOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

// 成品检验接口定义
interface FinishedGoodsInspection {
  id: number;
  inspectionCode: string;
  workOrderCode: string;
  workOrderName: string;
  productCode: string;
  productName: string;
  batchNo: string;
  totalQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
  unit: string;
  inspectionStatus: 'pending' | 'qualified' | 'unqualified' | 'conditional';
  inspectionResult: 'pending' | 'pass' | 'fail';
  inspectorName: string;
  inspectionDate?: string;
  remarks?: string;
  createdAt: string;
}

interface InspectionDetail {
  id: number;
  sampleNo: string;
  qualityItems: string[];
  result: 'pass' | 'fail';
  remarks?: string;
}

const FinishedGoodsInspectionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 检验Modal状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<FinishedGoodsInspection | null>(null);
  const [inspectionForm] = Form.useForm();
  const [inspectionDetails, setInspectionDetails] = useState<InspectionDetail[]>([]);

  // 扫码Modal状态
  const [scanModalVisible, setScanModalVisible] = useState(false);

  // 统计数据状态
  const [stats, setStats] = useState({
    pendingCount: 5,
    qualifiedCount: 18,
    unqualifiedCount: 1,
    totalInspected: 24,
  });

  // 处理扫码报工
  const handleScanInspection = () => {
    setScanModalVisible(true);
  };

  // 处理检验
  const handleInspect = (record: FinishedGoodsInspection) => {
    setCurrentInspection(record);
    setInspectionModalVisible(true);

    // 初始化检验明细
    const initialDetails: InspectionDetail[] = [
      { id: 1, sampleNo: '样品001', qualityItems: [], result: 'pass' },
      { id: 2, sampleNo: '样品002', qualityItems: [], result: 'pass' },
      { id: 3, sampleNo: '样品003', qualityItems: [], result: 'pass' },
    ];
    setInspectionDetails(initialDetails);

    inspectionForm.setFieldsValue({
      qualifiedQuantity: record.totalQuantity,
      unqualifiedQuantity: 0,
      remarks: '',
    });
  };

  // 处理检验提交
  const handleInspectionSubmit = async (values: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const qualifiedRate = ((values.qualifiedQuantity / currentInspection!.totalQuantity) * 100).toFixed(1);
      const resultText = values.qualifiedQuantity === currentInspection!.totalQuantity ? '全检合格' : '部分不合格';

      messageApi.success(`成品检验完成：${resultText}，合格率${qualifiedRate}%`);

      setInspectionModalVisible(false);
      inspectionForm.resetFields();
      setInspectionDetails([]);
      actionRef.current?.reload();

      // 更新统计数据
      setStats(prev => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
        qualifiedCount: values.unqualifiedQuantity === 0 ? prev.qualifiedCount + 1 : prev.qualifiedCount,
        unqualifiedCount: values.unqualifiedQuantity > 0 ? prev.unqualifiedCount + 1 : prev.unqualifiedCount,
        totalInspected: prev.totalInspected + 1,
      }));

    } catch (error: any) {
      messageApi.error(error.message || '检验提交失败');
    }
  };

  // 更新检验明细
  const updateInspectionDetail = (id: number, field: string, value: any) => {
    setInspectionDetails(prev =>
      prev.map(detail =>
        detail.id === id ? { ...detail, [field]: value } : detail
      )
    );
  };

  // 表格列定义
  const columns: ProColumns<FinishedGoodsInspection>[] = [
    {
      title: '检验单号',
      dataIndex: 'inspectionCode',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单编号',
      dataIndex: 'workOrderCode',
      width: 120,
    },
    {
      title: '工单名称',
      dataIndex: 'workOrderName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品编码',
      dataIndex: 'productCode',
      width: 120,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 100,
    },
    {
      title: '总数',
      dataIndex: 'totalQuantity',
      width: 80,
      align: 'right',
    },
    {
      title: '合格数',
      dataIndex: 'qualifiedQuantity',
      width: 80,
      align: 'right',
      render: (text, record) => (
        <span style={{ color: text === record.totalQuantity ? '#52c41a' : '#f5222d' }}>
          {text}
        </span>
      ),
    },
    {
      title: '合格率',
      width: 80,
      align: 'right',
      render: (_, record) => {
        const rate = ((record.qualifiedQuantity / record.totalQuantity) * 100).toFixed(1);
        return `${rate}%`;
      },
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
      width: 120,
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
              onClick={() => messageApi.info('详情功能开发中...')}
            >
              详情
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 检验明细表格列定义
  const detailColumns = [
    {
      title: '样品编号',
      dataIndex: 'sampleNo',
      width: 100,
    },
    {
      title: '质量检查项目',
      dataIndex: 'qualityItems',
      width: 200,
      render: (items: string[], record: InspectionDetail) => (
        <Select
          mode="multiple"
          size="small"
          style={{ width: '100%' }}
          value={items}
          onChange={(value) => updateInspectionDetail(record.id, 'qualityItems', value)}
          options={[
            { label: '外观检查', value: 'appearance' },
            { label: '功能测试', value: 'function' },
            { label: '性能测试', value: 'performance' },
            { label: '尺寸测量', value: 'dimension' },
          ]}
        />
      ),
    },
    {
      title: '检验结果',
      dataIndex: 'result',
      width: 100,
      render: (result: string, record: InspectionDetail) => (
        <Radio.Group
          size="small"
          value={result}
          onChange={(e) => updateInspectionDetail(record.id, 'result', e.target.value)}
        >
          <Radio value="pass">合格</Radio>
          <Radio value="fail">不合格</Radio>
        </Radio.Group>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      render: (remarks: string, record: InspectionDetail) => (
        <Input
          size="small"
          value={remarks}
          onChange={(e) => updateInspectionDetail(record.id, 'remarks', e.target.value)}
          placeholder="输入备注"
        />
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
        <UniTable<FinishedGoodsInspection>
          headerTitle="成品检验管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: FinishedGoodsInspection[] = [
              {
                id: 1,
                inspectionCode: 'FQ20251229001',
                workOrderCode: 'WO20241201001',
                workOrderName: '产品A生产工单',
                productCode: 'FIN001',
                productName: '产品A',
                batchNo: 'BATCH001',
                totalQuantity: 100,
                qualifiedQuantity: 0,
                unqualifiedQuantity: 0,
                unit: '个',
                inspectionStatus: 'pending',
                inspectionResult: 'pending',
                inspectorName: '',
                createdAt: '2025-12-29 16:00:00',
              },
              {
                id: 2,
                inspectionCode: 'FQ20251229002',
                workOrderCode: 'WO20241201002',
                workOrderName: '产品B定制工单',
                productCode: 'FIN002',
                productName: '产品B',
                batchNo: 'BATCH002',
                totalQuantity: 50,
                qualifiedQuantity: 48,
                unqualifiedQuantity: 2,
                unit: '个',
                inspectionStatus: 'qualified',
                inspectionResult: 'pass',
                inspectorName: '孙七',
                inspectionDate: '2025-12-29 17:30:00',
                createdAt: '2025-12-29 15:30:00',
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
              key="scan"
              type="primary"
              icon={<ScanOutlined />}
              onClick={handleScanInspection}
            >
              扫码检验
            </Button>,
            <Button
              key="batch-inspect"
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
        title={`成品检验 - ${currentInspection?.inspectionCode}`}
        open={inspectionModalVisible}
        onCancel={() => setInspectionModalVisible(false)}
        onOk={() => inspectionForm.submit()}
        okText="提交检验结果"
        cancelText="取消"
        width={800}
      >
        {currentInspection && (
          <div style={{ marginBottom: 24 }}>
            <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>工单：</strong>{currentInspection.workOrderName}
                </Col>
                <Col span={12}>
                  <strong>产品：</strong>{currentInspection.productName}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>批次号：</strong>{currentInspection.batchNo}
                </Col>
                <Col span={12}>
                  <strong>总数：</strong>{currentInspection.totalQuantity} {currentInspection.unit}
                </Col>
              </Row>
            </Card>

            <Card title="检验明细" size="small" style={{ marginBottom: 16 }}>
              <Table
                size="small"
                columns={detailColumns}
                dataSource={inspectionDetails}
                pagination={false}
                rowKey="id"
              />
            </Card>

            <Form
              form={inspectionForm}
              layout="vertical"
              onFinish={handleInspectionSubmit}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="qualifiedQuantity"
                    label="合格数量"
                    rules={[{ required: true, message: '请输入合格数量' }]}
                  >
                    <Input
                      type="number"
                      min={0}
                      max={currentInspection.totalQuantity}
                      addonAfter={currentInspection.unit}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="unqualifiedQuantity"
                    label="不合格数量"
                    rules={[{ required: true, message: '请输入不合格数量' }]}
                  >
                    <Input
                      type="number"
                      min={0}
                      max={currentInspection.totalQuantity}
                      addonAfter={currentInspection.unit}
                    />
                  </Form.Item>
                </Col>
              </Row>

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

      {/* 扫码检验Modal */}
      <Modal
        title="扫码成品检验"
        open={scanModalVisible}
        onCancel={() => setScanModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{
            width: 120,
            height: 120,
            margin: '0 auto 24px auto',
            border: '1px dashed #d9d9d9',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999'
          }}>
            <ScanOutlined style={{ fontSize: '48px' }} />
          </div>
          <p>请使用手机扫描工单二维码进行成品检验</p>
          <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            扫码后将自动跳转到检验页面
          </p>
        </div>
      </Modal>
    </>
  );
};

export default FinishedGoodsInspectionPage;
