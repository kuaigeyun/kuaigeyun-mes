/**
 * 报工管理页面
 *
 * 提供报工记录的管理和查询功能，支持移动端扫码报工。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col } from 'antd';
import { QrcodeOutlined, ScanOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { reportingApi } from '../../../services/production';

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

  // 报废记录Modal状态
  const [scrapModalVisible, setScrapModalVisible] = useState(false);
  const [currentReportingRecord, setCurrentReportingRecord] = useState<ReportingRecord | null>(null);
  const scrapFormRef = useRef<any>(null);

  // 不良品记录Modal状态
  const [defectModalVisible, setDefectModalVisible] = useState(false);
  const [currentReportingRecordForDefect, setCurrentReportingRecordForDefect] = useState<ReportingRecord | null>(null);
  const defectFormRef = useRef<any>(null);

  // 数据修正Modal状态
  const [correctModalVisible, setCorrectModalVisible] = useState(false);
  const [currentReportingRecordForCorrect, setCurrentReportingRecordForCorrect] = useState<ReportingRecord | null>(null);
  const correctFormRef = useRef<any>(null);

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
   * 处理创建报废记录
   */
  const handleCreateScrap = (record: ReportingRecord) => {
    if (record.unqualifiedQuantity <= 0) {
      messageApi.warning('该报工记录没有不合格数量，无法创建报废记录');
      return;
    }
    setCurrentReportingRecord(record);
    setScrapModalVisible(true);
    setTimeout(() => {
      scrapFormRef.current?.setFieldsValue({
        scrap_quantity: record.unqualifiedQuantity,
        scrap_type: 'other',
      });
    }, 100);
  };

  /**
   * 处理提交报废记录
   */
  const handleSubmitScrap = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecord?.id) {
        throw new Error('报工记录信息不存在');
      }

      await reportingApi.recordScrap(currentReportingRecord.id.toString(), values);
      messageApi.success('报废记录创建成功');
      setScrapModalVisible(false);
      setCurrentReportingRecord(null);
      scrapFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建报废记录失败');
      throw error;
    }
  };

  /**
   * 处理创建不良品记录
   */
  const handleCreateDefect = (record: ReportingRecord) => {
    if (record.unqualifiedQuantity <= 0) {
      messageApi.warning('该报工记录没有不合格数量，无法创建不良品记录');
      return;
    }
    setCurrentReportingRecordForDefect(record);
    setDefectModalVisible(true);
    setTimeout(() => {
      defectFormRef.current?.setFieldsValue({
        defect_quantity: record.unqualifiedQuantity,
        defect_type: 'other',
        disposition: 'quarantine',
      });
    }, 100);
  };

  /**
   * 处理提交不良品记录
   */
  const handleSubmitDefect = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecordForDefect?.id) {
        throw new Error('报工记录信息不存在');
      }

      await reportingApi.recordDefect(currentReportingRecordForDefect.id.toString(), values);
      messageApi.success('不良品记录创建成功');
      setDefectModalVisible(false);
      setCurrentReportingRecordForDefect(null);
      defectFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建不良品记录失败');
      throw error;
    }
  };

  /**
   * 处理修正报工数据
   */
  const handleCorrectReporting = async (record: ReportingRecord) => {
    try {
      const detail = await reportingApi.get(record.id!.toString());
      setCurrentReportingRecordForCorrect(detail);
      setCorrectModalVisible(true);
      setTimeout(() => {
        correctFormRef.current?.setFieldsValue({
          reported_quantity: detail.reportedQuantity,
          qualified_quantity: detail.qualifiedQuantity,
          unqualified_quantity: detail.unqualifiedQuantity,
          work_hours: detail.workHours,
          remarks: detail.remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取报工记录详情失败');
    }
  };

  /**
   * 处理提交数据修正
   */
  const handleSubmitCorrect = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecordForCorrect?.id) {
        throw new Error('报工记录信息不存在');
      }

      if (!values.correction_reason || !values.correction_reason.trim()) {
        messageApi.error('请输入修正原因');
        throw new Error('修正原因不能为空');
      }

      await reportingApi.correct(
        currentReportingRecordForCorrect.id.toString(),
        values
      );
      messageApi.success('报工数据修正成功');
      setCorrectModalVisible(false);
      setCurrentReportingRecordForCorrect(null);
      correctFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== '修正原因不能为空') {
        messageApi.error(error.message || '修正报工数据失败');
      }
      throw error;
    }
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
      width: 300,
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
              <Button
                type="link"
                size="small"
                onClick={() => handleCorrectReporting(record)}
              >
                修正
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <>
              {record.unqualifiedQuantity > 0 && (
                <>
                  <Button
                    type="link"
                    size="small"
                    icon={<WarningOutlined />}
                    onClick={() => handleCreateDefect(record)}
                    style={{ color: '#faad14' }}
                  >
                    不良品
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleCreateScrap(record)}
                  >
                    报废
                  </Button>
                </>
              )}
              <Button
                type="link"
                size="small"
                onClick={() => handleCorrectReporting(record)}
              >
                修正
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

      {/* 创建报废记录Modal */}
      <FormModalTemplate
        title="创建报废记录"
        open={scrapModalVisible}
        onCancel={() => {
          setScrapModalVisible(false);
          setCurrentReportingRecord(null);
          scrapFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitScrap}
        formRef={scrapFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecord && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>工单编码：</strong>{currentReportingRecord.workOrderCode}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecord.operationName}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div><strong>不合格数量：</strong>{currentReportingRecord.unqualifiedQuantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="scrap_quantity"
              label="报废数量"
              placeholder="请输入报废数量"
              rules={[{ required: true, message: '请输入报废数量' }]}
              min={0}
              max={currentReportingRecord.unqualifiedQuantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="scrap_type"
              label="报废类型"
              placeholder="请选择报废类型"
              rules={[{ required: true, message: '请选择报废类型' }]}
              options={[
                { label: '工艺问题', value: 'process' },
                { label: '物料问题', value: 'material' },
                { label: '质量问题', value: 'quality' },
                { label: '设备问题', value: 'equipment' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="scrap_reason"
              label="报废原因"
              placeholder="请输入报废原因"
              rules={[{ required: true, message: '请输入报废原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormDigit
              name="unit_cost"
              label="单位成本（可选）"
              placeholder="请输入单位成本"
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 创建不良品记录Modal */}
      <FormModalTemplate
        title="创建不良品记录"
        open={defectModalVisible}
        onCancel={() => {
          setDefectModalVisible(false);
          setCurrentReportingRecordForDefect(null);
          defectFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitDefect}
        formRef={defectFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecordForDefect && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>工单编码：</strong>{currentReportingRecordForDefect.workOrderCode}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecordForDefect.operationName}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div><strong>不合格数量：</strong>{currentReportingRecordForDefect.unqualifiedQuantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="defect_quantity"
              label="不良品数量"
              placeholder="请输入不良品数量"
              rules={[{ required: true, message: '请输入不良品数量' }]}
              min={0}
              max={currentReportingRecordForDefect.unqualifiedQuantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="defect_type"
              label="不良品类型"
              placeholder="请选择不良品类型"
              rules={[{ required: true, message: '请选择不良品类型' }]}
              options={[
                { label: '尺寸问题', value: 'dimension' },
                { label: '外观问题', value: 'appearance' },
                { label: '功能问题', value: 'function' },
                { label: '物料问题', value: 'material' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="defect_reason"
              label="不良品原因"
              placeholder="请输入不良品原因"
              rules={[{ required: true, message: '请输入不良品原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormSelect
              name="disposition"
              label="处理方式"
              placeholder="请选择处理方式"
              rules={[{ required: true, message: '请选择处理方式' }]}
              options={[
                { label: '隔离', value: 'quarantine' },
                { label: '返工', value: 'rework' },
                { label: '报废', value: 'scrap' },
                { label: '接受', value: 'accept' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="quarantine_location"
              label="隔离位置（处理方式为隔离时填写）"
              placeholder="请输入隔离位置"
              fieldProps={{ rows: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 修正报工数据Modal */}
      <FormModalTemplate
        title="修正报工数据"
        open={correctModalVisible}
        onCancel={() => {
          setCorrectModalVisible(false);
          setCurrentReportingRecordForCorrect(null);
          correctFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitCorrect}
        formRef={correctFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecordForCorrect && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>工单编码：</strong>{currentReportingRecordForCorrect.workOrderCode}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecordForCorrect.operationName}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="reported_quantity"
              label="报工数量"
              placeholder="请输入报工数量"
              rules={[{ required: true, message: '请输入报工数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              placeholder="请输入合格数量"
              rules={[{ required: true, message: '请输入合格数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="unqualified_quantity"
              label="不合格数量"
              placeholder="请输入不合格数量"
              rules={[{ required: true, message: '请输入不合格数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="work_hours"
              label="工时（小时）"
              placeholder="请输入工时"
              rules={[{ required: true, message: '请输入工时' }]}
              min={0}
              fieldProps={{ precision: 2, step: 0.1 }}
            />
            <ProFormTextArea
              name="correction_reason"
              label="修正原因"
              placeholder="请输入修正原因（必填）"
              rules={[{ required: true, message: '请输入修正原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ReportingPage;
