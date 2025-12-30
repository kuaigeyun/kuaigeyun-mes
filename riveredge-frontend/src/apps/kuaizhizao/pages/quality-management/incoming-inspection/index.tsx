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
import { qualityApi } from '../../../services/production';

// 来料检验接口定义
interface IncomingInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  purchase_receipt_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  status?: string;
  inspection_date?: string;
  inspector_id?: number;
  inspector_name?: string;
  certificate_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
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
      if (currentInspection?.id) {
        await qualityApi.incomingInspection.conduct(currentInspection.id.toString(), {
          qualified_quantity: values.qualifiedQuantity,
          unqualified_quantity: values.unqualifiedQuantity,
          notes: values.remarks,
        });
      }

      messageApi.success('来料检验完成');

      setInspectionModalVisible(false);
      inspectionForm.resetFields();
      actionRef.current?.reload();

    } catch (error: any) {
      messageApi.error('检验提交失败');
    }
  };

  // 处理详情查看
  const handleDetail = async (record: IncomingInspection) => {
    try {
      const detail = await qualityApi.incomingInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailVisible(true);
    } catch (error) {
      messageApi.error('获取检验单详情失败');
    }
  };

  // 表格列定义
  const columns: ProColumns<IncomingInspection>[] = [
    {
      title: '检验单号',
      dataIndex: 'inspection_code',
      width: 140,
      ellipsis: true,
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
      width: 150,
      ellipsis: true,
    },
    {
      title: '检验数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '检验状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '草稿': { text: '草稿', color: 'default' },
          '已审核': { text: '已审核', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['草稿'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '检验员',
      dataIndex: 'inspector_name',
      width: 100,
    },
    {
      title: '检验日期',
      dataIndex: 'inspection_date',
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
            try {
              const response = await qualityApi.incomingInspection.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              });
              return {
                data: response.data,
                success: response.success,
                total: response.total,
              };
            } catch (error) {
              messageApi.error('获取来料检验列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
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
        title={`来料检验 - ${currentInspection?.inspection_code}`}
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
                  <strong>物料编码：</strong>{currentInspection.material_code}
                </Col>
                <Col span={12}>
                  <strong>物料名称：</strong>{currentInspection.material_name}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={24}>
                  <strong>检验数量：</strong>{currentInspection.quantity}
                </Col>
              </Row>
            </Card>

            <Form
              form={inspectionForm}
              layout="vertical"
              onFinish={handleInspectionSubmit}
              initialValues={{
                qualifiedQuantity: currentInspection.quantity,
                unqualifiedQuantity: 0,
              }}
            >
              <Form.Item
                name="qualifiedQuantity"
                label="合格数量"
                rules={[
                  { required: true, message: '请输入合格数量' },
                  { type: 'number', min: 0, message: '合格数量不能小于0' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const unqualifiedQuantity = getFieldValue('unqualifiedQuantity') || 0;
                      if (value + unqualifiedQuantity > currentInspection.quantity) {
                        return Promise.reject('合格数量 + 不合格数量不能超过检验数量');
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input type="number" placeholder="请输入合格数量" />
              </Form.Item>

              <Form.Item
                name="unqualifiedQuantity"
                label="不合格数量"
                rules={[
                  { required: true, message: '请输入不合格数量' },
                  { type: 'number', min: 0, message: '不合格数量不能小于0' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const qualifiedQuantity = getFieldValue('qualifiedQuantity') || 0;
                      if (qualifiedQuantity + value > currentInspection.quantity) {
                        return Promise.reject('合格数量 + 不合格数量不能超过检验数量');
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input type="number" placeholder="请输入不合格数量" />
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
            </Form>
          </div>
        )}
      </Modal>

      {/* 详情Drawer */}
      <Drawer
        title={`检验详情 - ${inspectionDetail?.inspection_code}`}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={600}
      >
        {inspectionDetail && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>检验单号：</strong>{inspectionDetail.inspection_code}
                </Col>
                <Col span={12}>
                  <strong>物料编码：</strong>{inspectionDetail.material_code}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={24}>
                  <strong>物料名称：</strong>{inspectionDetail.material_name}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <strong>检验数量：</strong>{inspectionDetail.quantity}
                </Col>
                <Col span={8}>
                  <strong>合格数量：</strong>{inspectionDetail.qualified_quantity || 0}
                </Col>
                <Col span={8}>
                  <strong>不合格数量：</strong>{inspectionDetail.unqualified_quantity || 0}
                </Col>
              </Row>
            </Card>

            <Card title="检验结果">
              <Row gutter={16}>
                <Col span={12}>
                  <strong>检验状态：</strong>
                  <Tag color={
                    inspectionDetail.status === '已完成' ? 'success' :
                    inspectionDetail.status === '已审核' ? 'processing' :
                    inspectionDetail.status === '已取消' ? 'error' : 'default'
                  }>
                    {inspectionDetail.status}
                  </Tag>
                </Col>
                <Col span={12}>
                  <strong>证书编号：</strong>{inspectionDetail.certificate_number || '无'}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>检验员：</strong>{inspectionDetail.inspector_name}
                </Col>
                <Col span={12}>
                  <strong>检验日期：</strong>{inspectionDetail.inspection_date}
                </Col>
              </Row>
              {inspectionDetail.notes && (
                <Row style={{ marginTop: 8 }}>
                  <Col span={24}>
                    <strong>检验备注：</strong>{inspectionDetail.notes}
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
