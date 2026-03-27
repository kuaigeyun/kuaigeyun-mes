/**
 * 销售退货单管理页面
 *
 * 提供销售退货单的创建、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table, Row, Col, Form as AntForm, InputNumber, Input } from 'antd';
import { EyeOutlined, CheckCircleOutlined, PlusOutlined, ShoppingOutlined, ImportOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate } from '../../../../../components/layout-templates';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { UniImport } from '../../../../../components/uni-import';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import type { Material } from '../../../../master-data/types/material';
import { warehouseApi } from '../../../services/production';
import { getDocumentRelations } from '../../../services/document-relation';
import type { DocumentRelationData } from '../../../../../components/document-relation-display';
import dayjs from 'dayjs';

// 销售退货单接口定义
interface SalesReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_time?: string;
  returner_id?: number;
  returner_name?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  return_reason?: string;
  return_type?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
}

interface SalesReturnDetail extends SalesReturn {
  items?: SalesReturnItem[];
}

interface SalesReturnItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  return_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  serial_numbers?: string[];
  notes?: string;
}

const SalesReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<SalesReturnDetail | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelationData | null>(null);
  
  // 创建/编辑相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<ProFormInstance>(null);

  // 表格列定义
  const columns: ProColumns<SalesReturn>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '销售出库单编号',
      dataIndex: 'sales_delivery_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '退货状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => {
        const statusMap = {
          '待退货': { text: '待退货', color: 'default' },
          '已退货': { text: '已退货', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待退货'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      render: (status: any) => {
        const statusMap = {
          '待审核': { text: '待审核', color: 'default' },
          '审核通过': { text: '审核通过', color: 'success' },
          '审核驳回': { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待审核'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalQuantity') || '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalAmount') || '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${Number(text || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnTime') || '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('common.createdAt') || '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {record.status === '待退货' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
              style={{ color: '#52c41a' }}
            >
              确认退货
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: SalesReturn) => {
    try {
      const detail = await warehouseApi.salesReturn.get(record.id!.toString());
      setReturnDetail(detail as SalesReturnDetail);

      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('sales_return', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }

      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取销售退货单详情失败');
    }
  };

  // 处理新增
  const handleCreate = () => {
    setEditingId(null);
    setModalVisible(true);
  };

  // 处理确认退货
  const handleConfirm = async (record: SalesReturn) => {
    Modal.confirm({
      title: '确认销售退货',
      content: `确定要确认销售退货单 "${record.return_code}" 吗？确认后将自动更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.salesReturn.confirm(record.id!.toString());
          messageApi.success('销售退货确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '销售退货确认失败');
        }
      },
    });
  };

  // 处理批量删除
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条销售退货单吗？`,
      onOk: async () => {
        try {
          for (const id of keys) {
            await warehouseApi.salesReturn.delete(String(id));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  // 表单提交处理
  const onFinish = async (values: any) => {
    try {
      if (editingId) {
        // 更新逻辑
        messageApi.warning('非草稿状态不支持编辑');
      } else {
        await warehouseApi.salesReturn.create(values);
        messageApi.success('销售退货单创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
      return true;
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      return false;
    }
  };

  // 物料选择器追加明细
  const appendItemsFromMaterials = (materials: Material[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = materials.map(m => ({
      material_id: m.id,
      material_code: m.mainCode,
      material_name: m.name,
      material_spec: m.specification,
      material_unit: m.baseUnit,
      return_quantity: 1,
      unit_price: m.defaultPrice || 0,
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems]
    });
    setMaterialPickerOpen(false);
  };

  // Excel导入处理
  const handleImport = (data: any[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = data.map(row => ({
      material_code: row['物料编码'],
      return_quantity: Number(row['退货数量'] || 1),
      unit_price: Number(row['单价'] || 0),
      batch_number: row['批次号'],
      notes: row['备注'],
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems]
    });
    setImportModalVisible(false);
  };

  // 详情列 definition
  const detailColumns: ProDescriptionsItemProps<SalesReturnDetail>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
    },
    {
      title: '销售出库单编号',
      dataIndex: 'sales_delivery_code',
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
    },
    {
      title: '退货状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待退货': { text: '待退货', color: 'default' },
          '已退货': { text: '已退货', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[(status as any) || ''] || { text: (status as any) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '退货原因',
      dataIndex: 'return_reason',
    },
    {
      title: '退货类型',
      dataIndex: 'return_type',
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
    },
    {
      title: '退货人',
      dataIndex: 'returner_name',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      span: 2,
      render: (text: any) => text || '-',
    },
  ];

  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: '总退货单数',
            value: 0,
            prefix: <CheckCircleOutlined />,
            valueStyle: { color: '#1890ff' },
          },
          {
            title: '待退货',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#faad14' },
          },
          {
            title: '已退货',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#52c41a' },
          },
        ]}
      >
        <UniTable
          headerTitle="销售退货"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={true}
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.salesReturn.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                sales_delivery_id: params.sales_delivery_id,
                customer_id: params.customer_id,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取销售退货单列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleDelete}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingId ? '编辑销售退货单' : '新增销售退货单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onFinish={onFinish}
        formRef={formRef}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="customer_id"
              label="客户"
              placeholder="请选择客户"
              required
              request={async () => {
                // mock request - should use real service in production
                return [];
              }}
              rules={[{ required: true, message: '请选择客户' }]}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="warehouse_id"
              label="退入仓库"
              placeholder="请选择仓库"
              required
              request={async () => {
                // mock request - should use real service in production
                return [];
              }}
              rules={[{ required: true, message: '请选择仓库' }]}
            />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="return_time"
              label="退货日期"
              required
              fieldProps={{ style: { width: '100%' } }}
              initialValue={dayjs()}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <DictionarySelect
              dictionaryCode="SALES_RETURN_REASON"
              name="return_reason"
              label="退货原因"
              placeholder="请选择退货原因"
              formRef={formRef}
            />
          </Col>
          <Col span={8}>
            <DictionarySelect
              dictionaryCode="SALES_RETURN_TYPE"
              name="return_type"
              label="退货类型"
              placeholder="请选择退货类型"
              formRef={formRef}
            />
          </Col>
          <Col span={8}>
            <DictionarySelect
              dictionaryCode="SHIPPING_METHOD"
              name="shipping_method"
              label="发货方式"
              formRef={formRef}
            />
          </Col>
        </Row>
        <ProFormTextArea name="notes" label="备注" placeholder="请输入备注说明" />

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
              退货明细
            </span>
            <Button
              type="link"
              size="small"
              icon={<ImportOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              EXCEL导入明细
            </Button>
          </div>
          <ProForm.Item name="items" noStyle rules={[{ required: true, message: '请添加至少一项明细' }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => (
                <Table
                  size="small"
                  dataSource={fields}
                  pagination={false}
                  rowKey="key"
                  columns={[
                    {
                      title: '物料',
                      dataIndex: 'material_id',
                      width: 260,
                      render: (_, field) => (
                        <UniMaterialSelect
                          name={[field.name, 'material_id']}
                          label=""
                          placeholder="选择物料"
                          required
                          size="small"
                          listFieldKey={field.name}
                          listFieldName="items"
                          fillMapping={{
                            material_code: 'mainCode',
                            material_name: 'name',
                            material_spec: 'specification',
                            material_unit: 'baseUnit',
                          }}
                          showAdvancedSearch
                        />
                      ),
                    },
                    {
                      title: '退货数量',
                      dataIndex: 'return_quantity',
                      width: 120,
                      render: (_, field) => (
                        <AntForm.Item name={[field.name, 'return_quantity']} noStyle>
                          <InputNumber size="small" style={{ width: '100%' }} min={1} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '单价',
                      dataIndex: 'unit_price',
                      width: 120,
                      render: (_, field) => (
                        <AntForm.Item name={[field.name, 'unit_price']} noStyle>
                          <InputNumber size="small" style={{ width: '100%' }} min={0} prefix="¥" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '操作',
                      width: 60,
                      render: (_, field) => (
                        <Button type="link" danger onClick={() => remove(field.name)}>删除</Button>
                      ),
                    },
                  ]}
                  footer={() => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => add({ return_quantity: 1, unit_price: 0 })}
                      >
                        新增明细
                      </Button>
                      <Button
                        type="link"
                        icon={<ShoppingOutlined />}
                        onClick={() => setMaterialPickerOpen(true)}
                      >
                        批量选择物料
                      </Button>
                    </div>
                  )}
                />
              )}
            </AntForm.List>
          </ProForm.Item>
        </div>
      </FormModalTemplate>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
      />

      <UniImport
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onConfirm={handleImport}
        title="导入销售退货明细"
        headers={['物料编码', '退货数量', '单价', '批次号', '备注']}
        exampleRow={['MAT001', '10', '99.5', 'B20260117001', '备注说明']}
      />

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`销售退货单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={returnDetail || undefined}
        customContent={
          returnDetail ? (
            <div style={{ padding: '16px 0' }}>
              {/* 明细表格 */}
              {returnDetail.items && returnDetail.items.length > 0 && (
                <Card title="退货明细" style={{ marginBottom: 16 }}>
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '退货数量', dataIndex: 'return_quantity', width: 100, align: 'right' },
                      { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '批次号', dataIndex: 'batch_number', width: 120 },
                      { title: '库位', dataIndex: 'location_code', width: 100 },
                    ]}
                    dataSource={returnDetail.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
                </Card>
              )}

              {/* 单据关联 */}
              {documentRelations && (
                <Card title="单据关联">
                  {documentRelations.upstream_documents && documentRelations.upstream_documents.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        上游单据 ({documentRelations.upstream_count ?? 0})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '单据名称', dataIndex: 'document_name', width: 150 },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            width: 100,
                            render: (status: string) => <Tag>{status}</Tag>
                          },
                        ]}
                        dataSource={documentRelations.upstream_documents}
                        pagination={false}
                        rowKey={(record: any) => `${record.document_type}-${record.document_id}`}
                        bordered
                      />
                    </div>
                  )}
                  {documentRelations.downstream_documents && documentRelations.downstream_documents.length > 0 && (
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        下游单据 ({documentRelations.downstream_count ?? 0})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '单据名称', dataIndex: 'document_name', width: 150 },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            width: 100,
                            render: (status: string) => <Tag>{status}</Tag>
                          },
                        ]}
                        dataSource={documentRelations.downstream_documents}
                        pagination={false}
                        rowKey={(record: any) => `${record.document_type}-${record.document_id}`}
                        bordered
                      />
                    </div>
                  )}
                  {documentRelations.upstream_count === 0 && documentRelations.downstream_count === 0 && (
                    <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                      暂无关联单据
                    </div>
                  )}
                </Card>
              )}
            </div>
          ) : null
        }
      />
    </>
  );
};

export default SalesReturnsPage;
