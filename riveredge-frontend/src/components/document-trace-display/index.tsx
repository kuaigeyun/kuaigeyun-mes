/**
 * 单据关联追溯展示组件
 *
 * 用于可视化展示单据关联追溯链，支持树形结构展示。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useState, useEffect } from 'react';
import { Card, Tree, Button, Space, Tag, Empty, Spin } from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { traceDocumentChain, type DocumentTraceData, type TraceNode } from '../../apps/kuaizhizao/services/document-relation';

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
 * 将追溯节点转换为树节点
 */
const convertTraceNodeToTreeNode = (
  node: TraceNode,
  onDocumentClick?: (documentType: string, documentId: number) => void
): DataNode => {
  const title = (
    <Space>
      <Tag color="blue">{getDocumentTypeName(node.document_type)}</Tag>
      <span>{node.document_code || `ID: ${node.document_id}`}</span>
      {node.document_name && <span style={{ color: '#999' }}>({node.document_name})</span>}
      {onDocumentClick && (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onDocumentClick(node.document_type, node.document_id);
          }}
        >
          查看
        </Button>
      )}
    </Space>
  );

  return {
    title,
    key: `${node.document_type}-${node.document_id}-${node.level}`,
    children: node.children.map((child) => convertTraceNodeToTreeNode(child, onDocumentClick)),
  };
};

/**
 * 单据关联追溯展示组件Props
 */
export interface DocumentTraceDisplayProps {
  /** 单据类型 */
  documentType: string;
  /** 单据ID */
  documentId: number;
  /** 追溯方向 */
  direction?: 'upstream' | 'downstream' | 'both';
  /** 最大追溯深度 */
  maxDepth?: number;
  /** 点击关联单据时的回调 */
  onDocumentClick?: (documentType: string, documentId: number) => void;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 标题 */
  title?: string;
}

/**
 * 单据关联追溯展示组件
 */
const DocumentTraceDisplay: React.FC<DocumentTraceDisplayProps> = ({
  documentType,
  documentId,
  direction = 'both',
  maxDepth = 10,
  onDocumentClick,
  style,
  title = '单据关联追溯',
}) => {
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState<DocumentTraceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载追溯数据
   */
  const loadTraceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await traceDocumentChain(documentType, documentId, direction, maxDepth);
      setTraceData(data);
    } catch (err: any) {
      setError(err.message || '加载追溯数据失败');
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTraceData();
  }, [documentType, documentId, direction, maxDepth]);

  // 构建树形数据
  const upstreamTreeData: DataNode[] = traceData?.upstream_chain.map((node) =>
    convertTraceNodeToTreeNode(node, onDocumentClick)
  ) || [];

  const downstreamTreeData: DataNode[] = traceData?.downstream_chain.map((node) =>
    convertTraceNodeToTreeNode(node, onDocumentClick)
  ) || [];

  return (
    <Card
      title={
        <Space>
          <span>{title}</span>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={loadTraceData}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      }
      style={style}
    >
      {loading && <Spin style={{ display: 'block', textAlign: 'center', padding: '20px' }} />}

      {error && (
        <div style={{ color: '#ff4d4f', textAlign: 'center', padding: '20px' }}>
          {error}
        </div>
      )}

      {!loading && !error && traceData && (
        <div>
          {/* 根节点信息 */}
          <div style={{ marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
            <Space>
              <Tag color="purple">当前单据</Tag>
              <Tag color="blue">{getDocumentTypeName(traceData.document_type)}</Tag>
              <span>{traceData.document_code || `ID: ${traceData.document_id}`}</span>
              {traceData.document_name && <span style={{ color: '#999' }}>({traceData.document_name})</span>}
            </Space>
          </div>

          {/* 上游追溯链 */}
          {(direction === 'upstream' || direction === 'both') && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                上游追溯链 ({traceData.upstream_chain.length})
              </div>
              {upstreamTreeData.length > 0 ? (
                <Tree
                  treeData={upstreamTreeData}
                  defaultExpandAll={true}
                  showLine={{ showLeafIcon: false }}
                />
              ) : (
                <Empty description="暂无上游关联单据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          )}

          {/* 下游追溯链 */}
          {(direction === 'downstream' || direction === 'both') && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                下游追溯链 ({traceData.downstream_chain.length})
              </div>
              {downstreamTreeData.length > 0 ? (
                <Tree
                  treeData={downstreamTreeData}
                  defaultExpandAll={true}
                  showLine={{ showLeafIcon: false }}
                />
              ) : (
                <Empty description="暂无下游关联单据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          )}

          {/* 空状态 */}
          {traceData.upstream_chain.length === 0 && traceData.downstream_chain.length === 0 && (
            <Empty description="暂无关联追溯数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      )}
    </Card>
  );
};

export default DocumentTraceDisplay;
