/**
 * 采购退货单管理页面
 *
 * 提供采购退货单的创建、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table } from 'antd';
import { EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getDocumentRelations } from '../../../services/document-relation';

// 采购退货单接口定义
interface PurchaseReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
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

interface PurchaseReturnDetail extends PurchaseReturn {
  items?: PurchaseReturnItem[];
}

interface PurchaseReturnItem {
  id?: number;
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

const PurchaseReturnsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<PurchaseReturnDetail | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  // 表格列定义
  const columns: ProColumns<PurchaseReturn>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '采购入库单编号',
      dataIndex: 'purchase_receipt_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '采购订单编号',
      dataIndex: 'purchase_order_code',
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
      render: (text: any) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
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
  const handleDetail = async (record: PurchaseReturn) => {
    try {
      const detail = await warehouseApi.purchaseReturn.get(record.id!.toString());
      setReturnDetail(detail as PurchaseReturnDetail);

      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('purchase_return', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }

      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取采购退货单详情失败');
    }
  };

  // 处理确认退货
  const handleConfirm = async (record: PurchaseReturn) => {
    Modal.confirm({
      title: '确认采购退货',
      content: `确定要确认采购退货单 "${record.return_code}" 吗？确认后将自动更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.purchaseReturn.confirm(record.id!.toString());
          messageApi.success('采购退货确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '采购退货确认失败');
        }
      },
    });
  };

  // 详情列 definition
  const detailColumns: ProDescriptionsItemProps<PurchaseReturnDetail>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
    },
    {
      title: '采购入库单编号',
      dataIndex: 'purchase_receipt_code',
    },
    {
      title: '采购订单编号',
      dataIndex: 'purchase_order_code',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
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
      render: (text: any) => `¥${text?.toLocaleString() || 0}`,
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
          headerTitle="采购退货"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await warehouseApi.purchaseReturn.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                purchase_receipt_id: params.purchase_receipt_id,
                supplier_id: params.supplier_id,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取采购退货单列表失败');
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
        title={`采购退货单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
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

export default PurchaseReturnsPage;
