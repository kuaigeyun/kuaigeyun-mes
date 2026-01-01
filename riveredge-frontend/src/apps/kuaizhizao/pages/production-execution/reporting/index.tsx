/**
 * 报工管理页面
 *
 * 提供报工记录的管理和查询功能，支持移动端扫码报工。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col } from 'antd';
import { QrcodeOutlined, ScanOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';

interface ReportingRecord {
  id: number;
  workOrderCode: string;
  workOrderName: string;
  operationName: string;
  workerName: string;
  reportedQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
  workHours: number;
  status: 'pending' | 'approved' | 'rejected';
  reportedAt: string;
  remarks?: string;
}

const ReportingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 报工Modal状态
  const [reportingModalVisible, setReportingModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  // 扫码报工Modal状态
  const [scanModalVisible, setScanModalVisible] = useState(false);

  /**
   * 处理扫码报工
   */
  const handleScanReporting = () => {
    setScanModalVisible(true);
  };

  /**
   * 处理手动报工
   */
  const handleManualReporting = () => {
    setReportingModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理报工提交
   */
  const handleReportingSubmit = async (values: any) => {
    try {
      // 这里添加报工逻辑
      messageApi.success('报工成功');
      setReportingModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error('报工失败');
      throw error;
    }
  };

  /**
   * 处理审核报工
   */
  const handleApproveReporting = (record: ReportingRecord) => {
    Modal.confirm({
      title: '确认审核',
      content: `确定要审核通过报工记录 "${record.workOrderCode}" 吗？`,
      onOk: async () => {
        messageApi.success('审核通过');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReportingRecord>[] = [
    {
      title: '工单编号',
      dataIndex: 'workOrderCode',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'workOrderName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工序',
      dataIndex: 'operationName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作工',
      dataIndex: 'workerName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '报工数量',
      dataIndex: 'reportedQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '合格数量',
      dataIndex: 'qualifiedQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualifiedQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '工时(小时)',
      dataIndex: 'workHours',
      width: 100,
      align: 'right',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待审核', status: 'default' },
        approved: { text: '已审核', status: 'success' },
        rejected: { text: '已驳回', status: 'error' },
      },
    },
    {
      title: '报工时间',
      dataIndex: 'reportedAt',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApproveReporting(record)}
                style={{ color: '#52c41a' }}
              >
                审核
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => messageApi.info('驳回报工')}
              >
                驳回
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '今日报工总数',
          value: 128,
          prefix: <ClockCircleOutlined />,
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '待审核数量',
          value: 23,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#faad14' },
        },
        {
          title: '合格率',
          value: 96.8,
          suffix: '%',
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '总工时(小时)',
          value: 1247.5,
          prefix: <ClockCircleOutlined />,
          valueStyle: { color: '#722ed1' },
        },
      ]}
    >
      <UniTable
        headerTitle="报工管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          // 模拟数据
          const mockData: ReportingRecord[] = [
            {
              id: 1,
              workOrderCode: 'WO20241201001',
              workOrderName: '产品A生产工单',
              operationName: '注塑工序',
              workerName: '张三',
              reportedQuantity: 50,
              qualifiedQuantity: 48,
              unqualifiedQuantity: 2,
              workHours: 8.5,
              status: 'approved',
              reportedAt: '2024-12-01 16:30:00',
              remarks: '正常生产',
            },
            {
              id: 2,
              workOrderCode: 'WO20241201002',
              workOrderName: '产品B定制工单',
              operationName: '组装工序',
              workerName: '李四',
              reportedQuantity: 25,
              qualifiedQuantity: 25,
              unqualifiedQuantity: 0,
              workHours: 6.0,
              status: 'pending',
              reportedAt: '2024-12-01 17:00:00',
            },
            {
              id: 3,
              workOrderCode: 'WO20241201001',
              workOrderName: '产品A生产工单',
              operationName: '包装工序',
              workerName: '王五',
              reportedQuantity: 48,
              qualifiedQuantity: 46,
              unqualifiedQuantity: 2,
              workHours: 4.5,
              status: 'approved',
              reportedAt: '2024-12-01 18:15:00',
              remarks: '包装完成',
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
            onClick={handleScanReporting}
          >
            扫码报工
          </Button>,
          <Button
            key="manual"
            icon={<QrcodeOutlined />}
            onClick={handleManualReporting}
          >
            手动报工
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="手动报工"
        open={reportingModalVisible}
        onClose={() => setReportingModalVisible(false)}
        onFinish={handleReportingSubmit}
        isEdit={false}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
        grid={true}
      >
        <ProFormSelect
          name="workOrderCode"
          label="工单编号"
          placeholder="请选择工单"
          rules={[{ required: true, message: '请选择工单' }]}
          options={[
            { label: 'WO20241201001 - 产品A生产工单', value: 'WO20241201001' },
            { label: 'WO20241201002 - 产品B定制工单', value: 'WO20241201002' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="operationName"
          label="工序"
          placeholder="请选择工序"
          rules={[{ required: true, message: '请选择工序' }]}
          options={[
            { label: '注塑工序', value: '注塑工序' },
            { label: '组装工序', value: '组装工序' },
            { label: '包装工序', value: '包装工序' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="reportedQuantity"
          label="报工数量"
          placeholder="报工数量"
          rules={[{ required: true, message: '请输入报工数量' }]}
          min={0}
          colProps={{ span: 8 }}
        />
        <ProFormDigit
          name="qualifiedQuantity"
          label="合格数量"
          placeholder="合格数量"
          rules={[{ required: true, message: '请输入合格数量' }]}
          min={0}
          colProps={{ span: 8 }}
        />
        <ProFormDigit
          name="workHours"
          label="工时(小时)"
          placeholder="工时"
          rules={[{ required: true, message: '请输入工时' }]}
          min={0}
          fieldProps={{ step: 0.1 }}
          colProps={{ span: 8 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 扫码报工 Modal - 保留原有Modal，因为这是特殊功能 */}
      <Modal
        title="扫码报工"
        open={scanModalVisible}
        onCancel={() => setScanModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{
            width: 200,
            height: 200,
            margin: '0 auto 20px',
            background: '#f5f5f5',
            border: '2px dashed #d9d9d9',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999'
          }}>
            <QrcodeOutlined style={{ fontSize: '48px' }} />
          </div>
          <p>请使用手机扫描工单二维码进行报工</p>
          <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            扫码后将自动跳转到报工页面
          </p>
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default ReportingPage;
