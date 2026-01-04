/**
 * 来料检验页面
 *
 * 提供采购到货物料的检验功能，支持合格/不合格判定和处理
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Row, Col, Table, Modal } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, EditOutlined, PlusOutlined, UploadOutlined, DownloadOutlined, FileAddOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniImport } from '../../../../../components/uni-import';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { qualityApi, warehouseApi } from '../../../services/production';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';
import { downloadFile } from '../../../services/common';

// 来料检验接口定义
interface IncomingInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
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

const IncomingInspectionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 检验Modal状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<IncomingInspection | null>(null);
  const formRef = useRef<any>(null);

  // 详情Drawer状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<IncomingInspection | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  // 从采购入库单创建Modal状态
  const [createFromReceiptModalVisible, setCreateFromReceiptModalVisible] = useState(false);
  const createFromReceiptFormRef = useRef<any>(null);

  // 批量导入状态
  const [importVisible, setImportVisible] = useState(false);

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
        await qualityApi.incomingInspection.conduct(currentInspection.id.toString(), {
          qualified_quantity: values.qualified_quantity,
          unqualified_quantity: values.unqualified_quantity,
          notes: values.notes,
        });
      }

      messageApi.success('来料检验完成');
      setInspectionModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('检验提交失败');
      throw error;
    }
  };

  // 处理详情查看
  const handleDetail = async (record: IncomingInspection) => {
    try {
      const detail = await qualityApi.incomingInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailVisible(true);
      
      // 获取单据关联
      const relations = await getDocumentRelations('incoming_inspection', record.id!);
      setDocumentRelations(relations);
    } catch (error) {
      messageApi.error('获取检验单详情失败');
    }
  };

  // 从采购入库单创建来料检验单
  const handleCreateFromReceipt = () => {
    setCreateFromReceiptModalVisible(true);
  };

  const handleCreateFromReceiptSubmit = async (values: any) => {
    try {
      await qualityApi.incomingInspection.createFromPurchaseReceipt(values.purchase_receipt_id.toString());
      messageApi.success('成功创建来料检验单');
      setCreateFromReceiptModalVisible(false);
      createFromReceiptFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建来料检验单失败');
    }
  };

  // 批量导入
  const handleImport = async (data: any[][]) => {
    try {
      const result = await qualityApi.incomingInspection.import(data);
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
      const blob = await qualityApi.incomingInspection.export();
      const filename = `来料检验单_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
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
      title: '采购入库单号',
      dataIndex: 'purchase_receipt_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
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
      title: '检验结果',
      dataIndex: 'inspection_result',
      width: 100,
      render: (text) => {
        const resultMap: Record<string, { text: string; color: string }> = {
          '待检验': { text: '待检验', color: 'default' },
          '合格': { text: '合格', color: 'success' },
          '不合格': { text: '不合格', color: 'error' },
          '部分合格': { text: '部分合格', color: 'warning' },
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
      title: '操作',
      key: 'action',
      width: 150,
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
                status: params.status,
                quality_status: params.quality_status,
                supplier_id: params.supplier_id,
                material_id: params.material_id,
              });
              // 后端返回的是数组
              const data = Array.isArray(response) ? response : (response.data || []);
              return {
                data: data,
                success: true,
                total: data.length,
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
              key="create-from-receipt"
              type="primary"
              icon={<FileAddOutlined />}
              onClick={handleCreateFromReceipt}
            >
              从采购入库单创建
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
        title={`来料检验 - ${currentInspection?.inspection_code || ''}`}
        open={inspectionModalVisible}
        onClose={() => setInspectionModalVisible(false)}
        onFinish={handleInspectionSubmit}
        isEdit={false}
        initialValues={
          currentInspection ? {
            qualified_quantity: currentInspection.inspection_quantity || 0,
            unqualified_quantity: 0,
          } : {}
        }
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        {currentInspection && (
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
            ({ getFieldValue }) => ({
              validator(_, value) {
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
            ({ getFieldValue }) => ({
              validator(_, value) {
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

      <DetailDrawerTemplate
        title={`检验详情 - ${inspectionDetail?.inspection_code || ''}`}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={DRAWER_CONFIG.SMALL_WIDTH}
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
                  {documentRelations.downstream_count > 0 && (
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        下游单据 ({documentRelations.downstream_count})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '关联时间', dataIndex: 'relation_time', width: 160 },
                        ]}
                        dataSource={documentRelations.downstream_documents}
                        pagination={false}
                        rowKey="id"
                      />
                    </div>
                  )}
                  {documentRelations.upstream_count === 0 && documentRelations.downstream_count === 0 && (
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
                    <strong>检验数量：</strong>{inspectionDetail.inspection_quantity || 0}
                  </Col>
                  <Col span={8}>
                    <strong>合格数量：</strong>{inspectionDetail.qualified_quantity || 0}
                  </Col>
                  <Col span={8}>
                    <strong>不合格数量：</strong>{inspectionDetail.unqualified_quantity || 0}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>采购入库单号：</strong>{inspectionDetail.purchase_receipt_code}
                  </Col>
                  <Col span={12}>
                    <strong>供应商：</strong>{inspectionDetail.supplier_name}
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
                {inspectionDetail.reviewer_name && (
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={12}>
                      <strong>审核人：</strong>{inspectionDetail.reviewer_name}
                    </Col>
                    <Col span={12}>
                      <strong>审核时间：</strong>{inspectionDetail.review_time || '未审核'}
                    </Col>
                  </Row>
                )}
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

      {/* 从采购入库单创建Modal */}
      <FormModalTemplate
        title="从采购入库单创建来料检验单"
        open={createFromReceiptModalVisible}
        onClose={() => {
          setCreateFromReceiptModalVisible(false);
          createFromReceiptFormRef.current?.resetFields();
        }}
        onFinish={handleCreateFromReceiptSubmit}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={createFromReceiptFormRef}
      >
        <ProFormSelect
          name="purchase_receipt_id"
          label="选择采购入库单"
          placeholder="请选择采购入库单"
          rules={[{ required: true, message: '请选择采购入库单' }]}
          request={async () => {
            try {
              const response = await warehouseApi.purchaseReceipt.list({
                skip: 0,
                limit: 1000,
                status: '已入库',
              });
              const data = Array.isArray(response) ? response : (response.data || []);
              return data.map((receipt: any) => ({
                label: `${receipt.receipt_code} - ${receipt.supplier_name}`,
                value: receipt.id,
              }));
            } catch (error) {
              return [];
            }
          }}
        />
      </FormModalTemplate>

      {/* 批量导入 */}
      <UniImport
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImport={handleImport}
        columns={[
          { title: '采购入库单号', dataIndex: 'purchase_receipt_code', required: true },
          { title: '物料编码', dataIndex: 'material_code', required: true },
          { title: '检验数量', dataIndex: 'inspection_quantity', required: true },
          { title: '合格数量', dataIndex: 'qualified_quantity' },
          { title: '不合格数量', dataIndex: 'unqualified_quantity' },
          { title: '备注', dataIndex: 'notes' },
        ]}
      />
    </ListPageTemplate>
  );
};

export default IncomingInspectionPage;

