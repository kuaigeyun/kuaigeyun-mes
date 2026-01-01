/**
 * 销售出库单管理页面
 *
 * 提供销售出库单的创建、编辑、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Table } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';

// 销售出库单接口定义
interface SalesDelivery {
  id?: number;
  tenant_id?: number;
  delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  delivery_time?: string;
  deliverer_id?: number;
  deliverer_name?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  review_status?: string;
  reviewer_name?: string;
  review_time?: string;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
}

interface SalesDeliveryDetail extends SalesDelivery {
  items?: SalesDeliveryItem[];
}

interface SalesDeliveryItem {
  id?: number;
  material_code?: string;
  material_name?: string;
  delivery_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  notes?: string;
}

const SalesDeliveriesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [deliveryDetail, setDeliveryDetail] = useState<SalesDeliveryDetail | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  // 表格列定义
  const columns: ProColumns<SalesDelivery>[] = [
    {
      title: '出库单编号',
      dataIndex: 'delivery_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
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
      title: '出库状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '待出库': { text: '待出库', color: 'default' },
          '已出库': { text: '已出库', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待出库'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      render: (status) => {
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
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '出库时间',
      dataIndex: 'delivery_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 150,
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
          {record.status === '待出库' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
              style={{ color: '#52c41a' }}
            >
              确认出库
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: SalesDelivery) => {
    try {
      const detail = await warehouseApi.salesDelivery.get(record.id!.toString());
      setDeliveryDetail(detail as SalesDeliveryDetail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('sales_delivery', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }
      
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取销售出库单详情失败');
    }
  };

  // 处理确认出库
  const handleConfirm = async (record: SalesDelivery) => {
    Modal.confirm({
      title: '确认销售出库',
      content: `确定要确认销售出库单 "${record.delivery_code}" 吗？确认后将自动更新库存并生成应收单。`,
      onOk: async () => {
        try {
          await warehouseApi.salesDelivery.confirm(record.id!.toString());
          messageApi.success('销售出库确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '销售出库确认失败');
        }
      },
    });
  };

  // 详情列定义
  const detailColumns: ProDescriptionsItemType<SalesDeliveryDetail>[] = [
    {
      title: '出库单编号',
      dataIndex: 'delivery_code',
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
      title: '出库状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待出库': { text: '待出库', color: 'default' },
          '已出库': { text: '已出库', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待审核': { text: '待审核', color: 'default' },
          '审核通过': { text: '审核通过', color: 'success' },
          '审核驳回': { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
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
      title: '出库时间',
      dataIndex: 'delivery_time',
      valueType: 'dateTime',
    },
    {
      title: '出库人',
      dataIndex: 'deliverer_name',
    },
    {
      title: '发货方式',
      dataIndex: 'shipping_method',
    },
    {
      title: '物流单号',
      dataIndex: 'tracking_number',
    },
    {
      title: '收货地址',
      dataIndex: 'shipping_address',
      span: 2,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      span: 2,
      render: (text) => text || '-',
    },
  ];

  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: '总出库单数',
            value: 0,
            prefix: <CheckCircleOutlined />,
            valueStyle: { color: '#1890ff' },
          },
          {
            title: '待出库',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#faad14' },
          },
          {
            title: '已出库',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#52c41a' },
          },
        ]}
      >
        <UniTable
          headerTitle="销售出库单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await warehouseApi.salesDelivery.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                sales_order_id: params.sales_order_id,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取销售出库单列表失败');
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
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`销售出库单详情${deliveryDetail?.delivery_code ? ` - ${deliveryDetail.delivery_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDeliveryDetail(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={detailColumns}
        dataSource={deliveryDetail}
        customContent={
          deliveryDetail ? (
            <div style={{ padding: '16px 0' }}>
              {/* 明细表格 */}
              {deliveryDetail.items && deliveryDetail.items.length > 0 && (
                <Card title="出库明细" style={{ marginBottom: 16 }}>
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '出库数量', dataIndex: 'delivery_quantity', width: 100, align: 'right' },
                      { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '批次号', dataIndex: 'batch_number', width: 120 },
                      { title: '库位', dataIndex: 'location_code', width: 100 },
                    ]}
                    dataSource={deliveryDetail.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
                </Card>
              )}

              {/* 单据关联 */}
              {documentRelations && (
                <Card title="单据关联">
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
                        rowKey={(record) => `${record.document_type}-${record.document_id}`}
                        bordered
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
                        rowKey={(record) => `${record.document_type}-${record.document_id}`}
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

export default SalesDeliveriesPage;

