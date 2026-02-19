/**
 * 过程检验页面
 *
 * 提供生产报工环节关键工序的检验功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Row, Col, Table, Modal } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, UploadOutlined, DownloadOutlined, FileAddOutlined, ScanOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniImport } from '../../../../../components/uni-import';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { qualityApi } from '../../../services/production';
import { getDocumentRelations } from '../../../services/document-relation';
import { downloadFile } from '../../../services/common';

// 过程检验接口定义
interface ProcessInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  operation_id?: number;
  operation_code?: string;
  operation_name?: string;
  workshop_id?: number;
  workshop_name?: string;
  workstation_id?: number;
  workstation_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  batch_number?: string;
  inspection_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  inspection_result?: string;
  quality_status?: string;
  inspector_id?: number;
  inspector_name?: string;
  inspection_time?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

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
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  // 从工单创建Modal状态
  const [createFromWorkOrderModalVisible, setCreateFromWorkOrderModalVisible] = useState(false);
  const createFromWorkOrderFormRef = useRef<any>(null); // Ant Design ProForm instances often have 'any' type due to dynamic nature

  // 批量导入状态
  const [importVisible, setImportVisible] = useState(false);

  // 扫码检验Modal状态
  const [scanModalVisible, setScanModalVisible] = useState(false);

  // 创建不合格品记录Modal状态
  const [createDefectModalVisible, setCreateDefectModalVisible] = useState(false);
  const [currentDefectInspection, setCurrentDefectInspection] = useState<ProcessInspection | null>(null);
  const defectFormRef = useRef<any>(null); // Ant Design ProForm instances often have 'any' type due to dynamic nature

  // 统计数据状态
  const [stats] = useState({
    pendingCount: 8,
    qualifiedCount: 32,
    unqualifiedCount: 2,
    totalInspected: 42,
  });

  // 处理详情查看
  const handleDetail = async (record: ProcessInspection) => {
    try {
      const detail = await qualityApi.processInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailDrawerVisible(true);

      // 获取单据关联
      const relations = await getDocumentRelations('process_inspection', record.id!);
      setDocumentRelations(relations);
    } catch (error) {
      messageApi.error('获取过程检验详情失败');
    }
  };

  /*
  // 处理扫码报工 (TODO: Add button to trigger this)
  const _handleScanInspection = () => {
    setScanModalVisible(true);
  };
  */

  // 处理检验
  const handleInspect = (record: ProcessInspection) => {
    setCurrentInspection(record);
    setInspectionModalVisible(true);

    formRef.current?.setFieldsValue({
      qualified_quantity: record.inspection_quantity || 0,
      unqualified_quantity: 0,
      notes: '',
    });
  };

  // 处理检验提交
  const handleInspectionSubmit = async (values: any) => {
    try {
      if (currentInspection?.id) {
        await qualityApi.processInspection.conduct(currentInspection.id.toString(), {
          qualified_quantity: values.qualified_quantity,
          unqualified_quantity: values.unqualified_quantity,
          notes: values.notes,
        });
      }

      messageApi.success('过程检验完成');
      setInspectionModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '检验提交失败');
      throw error;
    }
  };

  // 从工单创建过程检验单
  const handleCreateFromWorkOrder = () => {
    setCreateFromWorkOrderModalVisible(true);
  };

  const handleCreateFromWorkOrderSubmit = async (values: any) => {
    try {
      await qualityApi.processInspection.createFromWorkOrder(
        values.work_order_id.toString(),
        values.operation_id.toString()
      );
      messageApi.success('成功创建过程检验单');
      setCreateFromWorkOrderModalVisible(false);
      createFromWorkOrderFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建过程检验单失败');
    }
  };

  // 批量导入
  const handleImport = async (data: any[][]) => {
    try {
      const result = await qualityApi.processInspection.import(data);
      if (result.success) {
        messageApi.success(result.message || '导入成功');
        setImportVisible(false);
        actionRef.current?.reload();
      } else {
        messageApi.error(result.message || '导入失败');
      }
    } catch (error: any) {
      messageApi.error(error.message || '导入失败');
    }
  };

  // 批量导出
  const handleExport = async () => {
    try {
      const blob = await qualityApi.processInspection.export();
      const filename = `过程检验单_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };

  // 处理创建不合格品记录
  const handleCreateDefect = (record: ProcessInspection) => {
    setCurrentDefectInspection(record);
    setCreateDefectModalVisible(true);
    defectFormRef.current?.setFieldsValue({
      defect_quantity: record.unqualified_quantity || 0,
      defect_type: 'other',
      defect_reason: '',
      disposition: 'rework', // 过程检验不合格默认返工
      remarks: '',
    });
  };

  // 处理创建不合格品记录提交
  const handleCreateDefectSubmit = async (values: any) => {
    try {
      if (currentDefectInspection?.id) {
        await qualityApi.processInspection.createDefect(currentDefectInspection.id.toString(), {
          defect_quantity: values.defect_quantity,
          defect_type: values.defect_type,
          defect_reason: values.defect_reason,
          disposition: values.disposition,
          remarks: values.remarks,
        });
      }

      messageApi.success('不合格品记录创建成功');
      setCreateDefectModalVisible(false);
      defectFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建不合格品记录失败');
      throw error;
    }
  };

  // 表格列定义
  const columns: ProColumns<ProcessInspection>[] = [
    {
      title: '检验单号',
      dataIndex: 'inspection_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '工序名称',
      dataIndex: 'operation_name',
      width: 150,
      ellipsis: true,
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
      dataIndex: 'inspection_quantity',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '检验结果',
      dataIndex: 'inspection_result',
      width: 100,
      render: (text) => {
        const resultMap: Record<string, { text: string; color: string }> = {
          '待检验': { text: '待检验', color: 'default' },
          '已检验': { text: '已检验', color: 'success' },
          '合格': { text: '合格', color: 'success' },
          '不合格': { text: '不合格', color: 'error' },
        };
        const config = resultMap[text as string] || { text: text || '待检验', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '检验时间',
      dataIndex: 'inspection_time',
      width: 160,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待检验': { text: '待检验', color: 'default' },
          '已检验': { text: '已检验', color: 'success' },
          '已审核': { text: '已审核', color: 'processing' },
        };
        const config = statusMap[status as string] || { text: status || '待检验', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === '待检验' || record.inspection_result === '待检验' ? (
            <Button
              size="small"
              type="primary"
              onClick={() => handleInspect(record)}
            >
              检验
            </Button>
          ) : (
            <>
              <Button
                size="small"
                type="link"
                icon={<EyeOutlined />}
                onClick={() => handleDetail(record)}
              >
                详情
              </Button>
              {record.quality_status === '不合格' && (record.unqualified_quantity || 0) > 0 && (
                <Button
                  size="small"
                  type="link"
                  danger
                  onClick={() => handleCreateDefect(record)}
                >
                  创建不合格品记录
                </Button>
              )}
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
        headerTitle="过程检验"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params: any) => {
          try {
            const response = await qualityApi.processInspection.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              status: params.status,
              quality_status: params.quality_status,
              work_order_id: params.work_order_id,
              operation_id: params.operation_id,
            });
            // 后端返回的是数组
            const data = Array.isArray(response) ? response : (response.data || []);
            return {
              data: data,
              success: true,
              total: data.length,
            };
          } catch (error) {
            messageApi.error('获取过程检验列表失败');
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
            key="create-from-work-order"
            type="primary"
            icon={<FileAddOutlined />}
            onClick={handleCreateFromWorkOrder}
          >
            从工单创建
          </Button>,
          <Button
            key="import"
            icon={<UploadOutlined />}
            onClick={() => setImportVisible(true)}
          >
            批量导入
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            批量导出
          </Button>,
        ]}
        scroll={{ x: 1400 }}
      />

      <FormModalTemplate
        title={`过程检验 - ${currentInspection?.inspection_code || ''}`}
        open={inspectionModalVisible}
        onClose={() => setInspectionModalVisible(false)}
        onFinish={handleInspectionSubmit}
        isEdit={false}
        initialValues={{
          qualified_quantity: currentInspection?.inspection_quantity || 0,
          unqualified_quantity: 0,
          notes: '',
        }}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        {currentInspection && (
          <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>工单编码：</strong>{currentInspection.work_order_code}
              </Col>
              <Col span={12}>
                <strong>工序名称：</strong>{currentInspection.operation_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>物料编码：</strong>{currentInspection.material_code}
              </Col>
              <Col span={12}>
                <strong>物料名称：</strong>{currentInspection.material_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={24}>
                <strong>检验数量：</strong>{currentInspection.inspection_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormDigit
          name="qualified_quantity"
          label="合格数量"
          placeholder="请输入合格数量"
          rules={[
            { required: true, message: '请输入合格数量' },
            { type: 'number', min: 0, message: '合格数量不能小于0' },
            ({ getFieldValue }: any) => ({
              validator(_: any, value: any) {
                if (!currentInspection) return Promise.resolve();
                const unqualifiedQuantity = getFieldValue('unqualified_quantity') || 0;
                if (value + unqualifiedQuantity > (currentInspection.inspection_quantity || 0)) {
                  return Promise.reject('合格数量 + 不合格数量不能超过检验数量');
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="unqualified_quantity"
          label="不合格数量"
          placeholder="请输入不合格数量"
          rules={[
            { required: true, message: '请输入不合格数量' },
            { type: 'number', min: 0, message: '不合格数量不能小于0' },
            ({ getFieldValue }: any) => ({
              validator(_: any, value: any) {
                if (!currentInspection) return Promise.resolve();
                const qualifiedQuantity = getFieldValue('qualified_quantity') || 0;
                if (qualifiedQuantity + value > (currentInspection.inspection_quantity || 0)) {
                  return Promise.reject('合格数量 + 不合格数量不能超过检验数量');
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea
          name="notes"
          label="检验备注"
          placeholder="请输入检验详情、发现的问题或处理意见"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 从工单创建Modal */}
      <FormModalTemplate
        title="从工单创建过程检验单"
        open={createFromWorkOrderModalVisible}
        onClose={() => {
          setCreateFromWorkOrderModalVisible(false);
          createFromWorkOrderFormRef.current?.resetFields();
        }}
        onFinish={handleCreateFromWorkOrderSubmit}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={createFromWorkOrderFormRef}
      >
        <ProFormSelect
          name="work_order_id"
          label="选择工单"
          placeholder="请选择工单"
          rules={[{ required: true, message: '请选择工单' }]}
          request={async () => {
            try {
              const { workOrderApi } = await import('../../../services/production');
              const response = await workOrderApi.list({
                skip: 0,
                limit: 1000,
                status: '进行中',
              });
              const data = Array.isArray(response) ? response : (response.data || []);
              return data.map((wo: any) => ({
                label: `${wo.code} - ${wo.name}`,
                value: wo.id,
              }));
            } catch (error) {
              return [];
            }
          }}
        />
        <ProFormSelect
          name="operation_id"
          label="选择工序"
          placeholder="请先选择工单"
          rules={[{ required: true, message: '请选择工序' }]}
          dependencies={['work_order_id']}
          request={async (params) => {
            if (!params.work_order_id) return [];
            try {
              // 获取工单的工艺路线，然后获取工序列表
              const { workOrderApi } = await import('../../../services/production');
              await workOrderApi.get(params.work_order_id.toString());
              // TODO: 根据工艺路线获取工序列表
              return [];
            } catch (error) {
              return [];
            }
          }}
        />
      </FormModalTemplate>

      {/* 批量导入 */}
      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImport}
        headers={[
          '工单编码',
          '工序编码',
          '检验数量',
          '合格数量',
          '不合格数量',
          '备注',
        ]}
      />

      {/* 过程检验详情 Drawer */}
      <DetailDrawerTemplate
        title={`过程检验详情 - ${inspectionDetail?.inspection_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        columns={[]}
        customContent={
          inspectionDetail ? (
            <div style={{ padding: '16px 0' }}>
              {/* 单据关联展示 */}
              {documentRelations && (
                <Card title="单据关联" style={{ marginBottom: 16 }}>
                  {documentRelations.upstream_count > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        上游单据 ({documentRelations.upstream_count})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '关联时间', dataIndex: 'relation_time', width: 160 },
                        ]}
                        dataSource={documentRelations.upstream_documents}
                        pagination={false}
                        rowKey="id"
                      />
                    </div>
                  )}
                  {documentRelations.upstream_count === 0 && (
                    <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                      暂无关联单据
                    </div>
                  )}
                </Card>
              )}

              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>检验单号：</strong>{inspectionDetail.inspection_code}
                  </Col>
                  <Col span={12}>
                    <strong>工单编码：</strong>{inspectionDetail.work_order_code}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>工序名称：</strong>{inspectionDetail.operation_name}
                  </Col>
                  <Col span={12}>
                    <strong>物料编码：</strong>{inspectionDetail.material_code}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}>
                    <strong>检验数量：</strong>{inspectionDetail.inspection_quantity || 0}
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
                    <strong>检验结果：</strong>
                    <Tag color={inspectionDetail.inspection_result === '已检验' ? 'success' : 'default'}>
                      {inspectionDetail.inspection_result || '待检验'}
                    </Tag>
                  </Col>
                  <Col span={12}>
                    <strong>质量状态：</strong>
                    <Tag color={inspectionDetail.quality_status === '合格' ? 'success' : 'error'}>
                      {inspectionDetail.quality_status || '待判定'}
                    </Tag>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>检验员：</strong>{inspectionDetail.inspector_name || '未指定'}
                  </Col>
                  <Col span={12}>
                    <strong>检验时间：</strong>{inspectionDetail.inspection_time || '未检验'}
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
          ) : null
        }
      />

      {/* 创建不合格品记录Modal */}
      <FormModalTemplate
        title="创建不合格品记录"
        open={createDefectModalVisible}
        onClose={() => {
          setCreateDefectModalVisible(false);
          defectFormRef.current?.resetFields();
        }}
        onFinish={handleCreateDefectSubmit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={defectFormRef}
      >
        {currentDefectInspection && (
          <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>检验单号：</strong>{currentDefectInspection.inspection_code}
              </Col>
              <Col span={12}>
                <strong>物料名称：</strong>{currentDefectInspection.material_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>不合格数量：</strong>{currentDefectInspection.unqualified_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormDigit
          name="defect_quantity"
          label="不合格品数量"
          placeholder="请输入不合格品数量"
          rules={[
            { required: true, message: '请输入不合格品数量' },
            { type: 'number', min: 0, message: '不合格品数量不能小于0' },
            () => ({
              validator(_: any, value: any) {
                if (!currentDefectInspection) return Promise.resolve();
                if (value > (currentDefectInspection.unqualified_quantity || 0)) {
                  return Promise.reject('不合格品数量不能超过检验单的不合格数量');
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="defect_type"
          label="不合格品类型"
          placeholder="请选择不合格品类型"
          rules={[{ required: true, message: '请选择不合格品类型' }]}
          options={[
            { label: '尺寸偏差', value: 'dimension' },
            { label: '外观缺陷', value: 'appearance' },
            { label: '功能异常', value: 'function' },
            { label: '材质问题', value: 'material' },
            { label: '其他', value: 'other' },
          ]}
        />
        <ProFormTextArea
          name="defect_reason"
          label="不合格原因"
          placeholder="请输入不合格原因"
          rules={[{ required: true, message: '请输入不合格原因' }]}
          fieldProps={{ rows: 3 }}
        />
        <ProFormSelect
          name="disposition"
          label="处理方式"
          placeholder="请选择处理方式"
          rules={[{ required: true, message: '请选择处理方式' }]}
          options={[
            { label: '返工', value: 'rework' },
            { label: '报废', value: 'scrap' },
            { label: '让步接收', value: 'accept' },
            { label: '隔离', value: 'quarantine' },
            { label: '其他', value: 'other' },
          ]}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 2 }}
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
