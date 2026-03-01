/**
 * 采购入库单管理页面
 *
 * 提供采购入库单的创建、编辑、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table } from 'antd';
import { EyeOutlined, CheckCircleOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniImport } from '../../../../../components/uni-import';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { warehouseApi } from '../../../services/production';
import { getPurchaseReceiptLifecycle } from '../../../utils/purchaseReceiptLifecycle';
import { getDocumentRelations } from '../../../services/document-relation';
import { downloadFile } from '../../../services/common';

// 采购入库单接口定义
interface PurchaseReceipt {
  id?: number;
  tenant_id?: number;
  receipt_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  receipt_time?: string;
  receiver_id?: number;
  receiver_name?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  review_status?: string;
  reviewer_name?: string;
  review_time?: string;
  delivery_note?: string;
  invoice_number?: string;
  notes?: string;
  created_at?: string;
}

interface PurchaseReceiptDetail extends PurchaseReceipt {
  items?: PurchaseReceiptItem[];
}

interface PurchaseReceiptItem {
  id?: number;
  material_code?: string;
  material_name?: string;
  receipt_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  quality_status?: string;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  notes?: string;
}

const PurchaseReceiptsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [receiptDetail, setReceiptDetail] = useState<PurchaseReceiptDetail | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  // 导入导出相关状态
  const [importVisible, setImportVisible] = useState(false);

  // 表格列定义
  const columns: ProColumns<PurchaseReceipt>[] = [
    {
      title: '入库单编号',
      dataIndex: 'receipt_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
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
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      render: (_, record) => {
        const lifecycle = getPurchaseReceiptLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '待入库';
        const colorMap: Record<string, string> = {
          待入库: 'default',
          已入库: 'success',
          已取消: 'error',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
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
      title: '入库时间',
      dataIndex: 'receipt_time',
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
      width: 180,
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
          {record.status === '待入库' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
              style={{ color: '#52c41a' }}
            >
              确认入库
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: PurchaseReceipt) => {
    try {
      const detail = await warehouseApi.purchaseReceipt.get(record.id!.toString());
      setReceiptDetail(detail as PurchaseReceiptDetail);

      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('purchase_receipt', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }

      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取采购入库单详情失败');
    }
  };

  // 处理确认入库
  const handleConfirm = async (record: PurchaseReceipt) => {
    Modal.confirm({
      title: '确认采购入库',
      content: `确定要确认采购入库单 "${record.receipt_code}" 吗？确认后将自动更新库存并生成应付单。`,
      onOk: async () => {
        try {
          await warehouseApi.purchaseReceipt.confirm(record.id!.toString());
          messageApi.success('采购入库确认成功');
          actionRef.current?.reload();
          if (receiptDetail?.id === record.id) {
            try {
              const detail = await warehouseApi.purchaseReceipt.get(record.id!.toString());
              setReceiptDetail(detail as PurchaseReceiptDetail);
            } catch { /* ignore */ }
          }
        } catch (error: any) {
          messageApi.error(error.message || '采购入库确认失败');
        }
      },
    });
  };

  // 处理批量导入
  const handleImport = async (data: any[][]) => {
    try {
      const result = await warehouseApi.purchaseReceipt.import(data);
      if (result.success) {
        const resultData = result.data || {};
        messageApi.success(`导入成功：成功 ${resultData.success_count || 0} 条，失败 ${resultData.failure_count || 0} 条`);
        setImportVisible(false);
        actionRef.current?.reload();
      } else {
        const resultData = result.data || {};
        messageApi.warning(`导入完成：成功 ${resultData.success_count || 0} 条，失败 ${resultData.failure_count || 0} 条`);
      }
    } catch (error: any) {
      messageApi.error(error.message || '导入失败');
    }
  };

  // 处理批量导出
  const handleExport = async () => {
    try {
      const blob = await warehouseApi.purchaseReceipt.export();
      const filename = `采购入库单_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };

  // 详情列 definition
  const detailColumns: ProDescriptionsItemProps<PurchaseReceiptDetail>[] = [
    {
      title: '入库单编号',
      dataIndex: 'receipt_code',
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
      title: '入库状态',
      dataIndex: 'status',
      render: (status: any) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待入库': { text: '待入库', color: 'default' },
          '已入库': { text: '已入库', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status: any) => {
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
      render: (text: any) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '入库时间',
      dataIndex: 'receipt_time',
      valueType: 'dateTime',
    },
    {
      title: '入库人',
      dataIndex: 'receiver_name',
    },
    {
      title: '送货单号',
      dataIndex: 'delivery_note',
    },
    {
      title: '发票号',
      dataIndex: 'invoice_number',
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
        toolbarExtra={
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>
              批量导入
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              批量导出
            </Button>
          </Space>
        }
        statCards={[
          {
            title: '总入库单数',
            value: 0,
            prefix: <CheckCircleOutlined />,
            valueStyle: { color: '#1890ff' },
          },
          {
            title: '待入库',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#faad14' },
          },
          {
            title: '已入库',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#52c41a' },
          },
        ]}
      >
        <UniTable
          headerTitle="采购入库"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await warehouseApi.purchaseReceipt.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                purchase_order_id: params.purchase_order_id,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取采购入库单列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条采购入库单吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await warehouseApi.purchaseReceipt.delete(String(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`采购入库单详情${receiptDetail?.receipt_code ? ` - ${receiptDetail.receipt_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReceiptDetail(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={receiptDetail || undefined}
        extra={
          receiptDetail?.status === '待入库' && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(receiptDetail)}
            >
              确认入库
            </Button>
          )
        }
        customContent={
          receiptDetail ? (
            <div style={{ padding: '16px 0' }}>
              {/* 生命周期 */}
              {(() => {
                const lifecycle = getPurchaseReceiptLifecycle(receiptDetail);
                const mainStages = lifecycle.mainStages ?? [];
                if (mainStages.length === 0) return null;
                return (
                  <DetailDrawerSection title="生命周期">
                    <UniLifecycleStepper
                      steps={mainStages}
                      status={lifecycle.status}
                      showLabels
                      nextStepSuggestions={lifecycle.nextStepSuggestions}
                    />
                  </DetailDrawerSection>
                );
              })()}
              {/* 明细表格 */}
              {receiptDetail.items && receiptDetail.items.length > 0 && (
                <Card title="入库明细" style={{ marginBottom: 16 }}>
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '入库数量', dataIndex: 'receipt_quantity', width: 100, align: 'right' },
                      { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '合格数量', dataIndex: 'qualified_quantity', width: 100, align: 'right' },
                      { title: '不合格数量', dataIndex: 'unqualified_quantity', width: 100, align: 'right' },
                      { title: '质量状态', dataIndex: 'quality_status', width: 100, render: (status) => <Tag>{status || '合格'}</Tag> },
                      { title: '批次号', dataIndex: 'batch_number', width: 120 },
                      { title: '库位', dataIndex: 'location_code', width: 100 },
                    ]}
                    dataSource={receiptDetail.items}
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

              {/* 操作记录 */}
              {receiptDetail?.id && (
                <DetailDrawerSection title="操作记录">
                  <DocumentTrackingPanel documentType="purchase_receipt" documentId={receiptDetail.id} />
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />

      {/* 批量导入弹窗 */}
      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImport}
        title="批量导入采购入库单"
        headers={[
          '采购订单编号',
          '供应商名称',
          '仓库名称',
          '入库时间',
          '备注',
        ]}
        exampleRow={[
          'PO20250115001', '供应商A', '主仓库', '2025-01-15 10:00:00', '备注信息'
        ]}
      />
    </>
  );
};

export default PurchaseReceiptsPage;

