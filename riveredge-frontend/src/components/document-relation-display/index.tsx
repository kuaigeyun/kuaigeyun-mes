/**
 * 单据关联展示组件
 *
 * 用于在单据详情页面展示上下游关联单据，支持点击跳转到关联单据详情。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React from 'react';
import { Card, Table, Tag, Button, Empty } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

/**
 * 关联单据项
 */
export interface RelatedDocument {
  document_type: string;
  document_id: number;
  document_code?: string;
  document_name?: string;
  status?: string;
  created_at?: string;
  relation_desc?: string;
}

/**
 * 单据关联数据
 */
export interface DocumentRelationData {
  upstream_documents?: RelatedDocument[];
  downstream_documents?: RelatedDocument[];
  upstream_count?: number;
  downstream_count?: number;
}

/**
 * 单据关联展示组件Props
 */
export interface DocumentRelationDisplayProps {
  /** 关联数据 */
  relations: DocumentRelationData | null;
  /** 点击关联单据时的回调 */
  onDocumentClick?: (documentType: string, documentId: number) => void;
  /** 是否显示空状态 */
  showEmpty?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 标题 */
  title?: string;
}

/**
 * 单据类型显示名称映射
 */
const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  demand: '需求',
  demand_computation: '需求计算',
  work_order: '工单',
  purchase_order: '采购单',
  sales_order: '销售订单',
  sales_forecast: '销售预测',
  sales_delivery: '销售出库',
  purchase_receipt: '采购入库',
  finished_goods_inspection: '成品检验',
  process_inspection: '过程检验',
  incoming_inspection: '来料检验',
  accounts_payable: '应付单',
  accounts_receivable: '应收单',
};

/**
 * 获取单据类型显示名称
 */
const getDocumentTypeName = (type: string): string => {
  return DOCUMENT_TYPE_NAMES[type] || type;
};

/**
 * 单据关联展示组件
 */
const DocumentRelationDisplay: React.FC<DocumentRelationDisplayProps> = ({
  relations,
  onDocumentClick,
  showEmpty = true,
  style,
  title = '单据关联',
}) => {
  if (!relations) {
    return null;
  }

  const upstreamCount = relations.upstream_count || 0;
  const downstreamCount = relations.downstream_count || 0;

  // 如果没有关联单据且不显示空状态，则不渲染
  if (upstreamCount === 0 && downstreamCount === 0 && !showEmpty) {
    return null;
  }

  // 定义表格列
  const columns: ColumnsType<RelatedDocument> = [
    {
      title: '单据类型',
      dataIndex: 'document_type',
      width: 120,
      render: (type: string) => getDocumentTypeName(type),
    },
    {
      title: '单据编号',
      dataIndex: 'document_code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '单据名称',
      dataIndex: 'document_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (status ? <Tag>{status}</Tag> : '-'),
    },
    {
      title: '操作',
      width: 80,
      fixed: 'right',
      render: (_: any, record: RelatedDocument) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            if (onDocumentClick) {
              onDocumentClick(record.document_type, record.document_id);
            }
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <Card title={title} style={style}>
      {/* 上游单据 */}
      {upstreamCount > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
            上游单据 ({upstreamCount})
          </div>
          <Table
            size="small"
            columns={columns}
            dataSource={relations.upstream_documents || []}
            pagination={false}
            rowKey={(record) => `${record.document_type}-${record.document_id}`}
            bordered
          />
        </div>
      )}

      {/* 下游单据 */}
      {downstreamCount > 0 && (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
            下游单据 ({downstreamCount})
          </div>
          <Table
            size="small"
            columns={columns}
            dataSource={relations.downstream_documents || []}
            pagination={false}
            rowKey={(record) => `${record.document_type}-${record.document_id}`}
            bordered
          />
        </div>
      )}

      {/* 空状态 */}
      {upstreamCount === 0 && downstreamCount === 0 && showEmpty && (
        <Empty
          description="暂无关联单据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '20px 0' }}
        />
      )}
    </Card>
  );
};

export default DocumentRelationDisplay;
