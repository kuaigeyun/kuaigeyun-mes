/**
 * 过程检验页面
 *
 * 提供生产报工环节关键工序的检验功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormRadio, ProFormSelect, ProFormTextArea, ProFormText, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, ScanOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { getProcessInspection, ProcessInspection as APIProcessInspection } from '../../../services/quality';

// 使用API服务中的接口定义
type ProcessInspection = APIProcessInspection;

const ProcessInspectionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 检验Modal状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<ProcessInspection | null>(null);
  const formRef = useRef<any>(null);

  // 详情Drawer状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<ProcessInspection | null>(null);

  // 扫码Modal状态
  const [scanModalVisible, setScanModalVisible] = useState(false);

  // 统计数据状态
  const [stats, setStats] = useState({
    pendingCount: 8,
    qualifiedCount: 32,
    unqualifiedCount: 2,
    totalInspected: 42,
  });

  // 处理详情查看
  const handleDetail = async (record: ProcessInspection) => {
    try {
      const detail = await getProcessInspection(record.id!);
      setInspectionDetail(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取过程检验详情失败');
    }
  };

  // 处理扫码报工
  const handleScanInspection = () => {
    setScanModalVisible(true);
  };

  // 处理检验
  const handleInspect = (record: ProcessInspection) => {
    setCurrentInspection(record);
    setInspectionModalVisible(true);

    formRef.current?.setFieldsValue({
      inspectionResult: 'pending',
      remarks: '',
    });
  };

  // 处理检验提交
  const handleInspectionSubmit = async (values: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const resultText = values.inspectionResult === 'pass' ? '合格' : '不合格';
      messageApi.success(`过程检验完成：${resultText}`);

      setInspectionModalVisible(false);
      formRef.current?.resetFields();
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
      throw error;
    }
  };

  // 表格列定义
  const columns: ProColumns<ProcessInspection>[] = [
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
      title: '工序名称',
      dataIndex: 'operationName',
      width: 120,
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
              onClick={() => handleDetail(record)}
            >
              详情
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '待检验数量',
          value: stats.pendingCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#faad14' },
        },
        {
          title: '合格数量',
          value: stats.qualifiedCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '不合格数量',
          value: stats.unqualifiedCount,
          prefix: <CloseCircleOutlined />,
          valueStyle: { color: '#f5222d' },
        },
        {
          title: '总检验数量',
          value: stats.totalInspected,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#1890ff' },
        },
      ]}
    >
      <UniTable<ProcessInspection>
          headerTitle="过程检验管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: ProcessInspection[] = [
              {
                id: 1,
                inspectionCode: 'PQ20251229001',
                workOrderCode: 'WO20241201001',
                workOrderName: '产品A生产工单',
                operationName: '注塑工序',
                productCode: 'FIN001',
                productName: '产品A',
                batchNo: 'BATCH001',
                quantity: 100,
                unit: '个',
                inspectionStatus: 'pending',
                inspectionResult: 'pending',
                inspectorName: '',
                createdAt: '2025-12-29 14:00:00',
              },
              {
                id: 2,
                inspectionCode: 'PQ20251229002',
                workOrderCode: 'WO20241201002',
                workOrderName: '产品B定制工单',
                operationName: '组装工序',
                productCode: 'FIN002',
                productName: '产品B',
                batchNo: 'BATCH002',
                quantity: 50,
                unit: '个',
                inspectionStatus: 'qualified',
                inspectionResult: 'pass',
                inspectorName: '王五',
                inspectionDate: '2025-12-29 15:30:00',
                createdAt: '2025-12-29 13:30:00',
              },
              {
                id: 3,
                inspectionCode: 'PQ20251229003',
                workOrderCode: 'WO20241201003',
                workOrderName: '产品C生产工单',
                operationName: '包装工序',
                productCode: 'FIN003',
                productName: '产品C',
                batchNo: 'BATCH003',
                quantity: 80,
                unit: '个',
                inspectionStatus: 'unqualified',
                inspectionResult: 'fail',
                inspectorName: '赵六',
                inspectionDate: '2025-12-29 16:00:00',
                remarks: '包装外观不符合要求',
                createdAt: '2025-12-29 14:30:00',
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

      <FormModalTemplate
        title={`过程检验 - ${currentInspection?.inspectionCode || ''}`}
        open={inspectionModalVisible}
        onClose={() => setInspectionModalVisible(false)}
        onFinish={handleInspectionSubmit}
        isEdit={false}
        initialValues={{
          inspectionResult: 'pending',
          remarks: '',
        }}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        {currentInspection && (
          <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>工单：</strong>{currentInspection.workOrderName}
              </Col>
              <Col span={12}>
                <strong>工序：</strong>{currentInspection.operationName}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>产品：</strong>{currentInspection.productName}
              </Col>
              <Col span={12}>
                <strong>批次号：</strong>{currentInspection.batchNo}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>数量：</strong>{currentInspection.quantity} {currentInspection.unit}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormRadio.Group
          name="inspectionResult"
          label="检验结果"
          rules={[{ required: true, message: '请选择检验结果' }]}
          options={[
            {
              label: (
                <span>
                  <Tag color="success">合格</Tag> 工序质量符合要求
                </span>
              ),
              value: 'pass',
            },
            {
              label: (
                <span>
                  <Tag color="error">不合格</Tag> 工序质量不符合要求
                </span>
              ),
              value: 'fail',
            },
          ]}
        />
        <ProFormSelect
          name="qualityItems"
          label="质量检查项目"
          mode="multiple"
          placeholder="选择检查的项目"
          options={[
            { label: '尺寸精度', value: 'dimension' },
            { label: '表面质量', value: 'surface' },
            { label: '功能测试', value: 'function' },
            { label: '外观检查', value: 'appearance' },
          ]}
        />
        <ProFormTextArea
          name="remarks"
          label="检验备注"
          placeholder="请输入检验详情、发现的问题或处理意见"
          fieldProps={{ rows: 3 }}
        />
        <ProFormText
          name="inspectorName"
          label="检验员"
          placeholder="请输入检验员姓名"
          rules={[{ required: true, message: '请输入检验员姓名' }]}
        />
      </FormModalTemplate>

      {/* 扫码检验Modal - 保留原有Modal，因为这是特殊功能 */}
      <Modal
        title="扫码过程检验"
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
          <p>请使用手机扫描工单二维码进行过程检验</p>
          <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            扫码后将自动跳转到检验页面
          </p>
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default ProcessInspectionPage;
