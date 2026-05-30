import React, { useState } from 'react';
import { Input, Space, Select, Empty, Spin, message, Descriptions, Tag, Button, theme, Typography } from 'antd';
import { useRequest } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../../services/api';
import { useTranslation } from 'react-i18next';
import { FlowGraph } from '@ant-design/graphs';
import { DetailDrawerTemplate, DetailDrawerSection, ListPageTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import {
  buildTraceabilityNodePath,
  getTraceabilityNodeStyle,
  getTraceabilityNodeTypeLabel,
} from '../components/inspectionTemplateUtils';

const { useToken } = theme;

const TraceabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useToken();
  const [searchParams, setSearchParams] = useState<{ batch_no: string; direction: string }>({
    batch_no: '',
    direction: 'both',
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const { data, loading, run } = useRequest(
    async (batch_no: string, direction: string) => {
      if (!batch_no) return null;
      return api.get('/apps/kuaizhizao/traceability/graph', {
        params: { batch_no, direction },
      });
    },
    {
      manual: true,
      onError: (err) => {
        message.error('追溯数据加载失败：' + (err?.message || String(err)));
      },
    },
  );

  const handleSearch = (value: string) => {
    if (!value) return;
    setSearchParams({ ...searchParams, batch_no: value });
    run(value, searchParams.direction);
  };

  const navigateFromNode = (node: { type?: string; id?: string; data?: Record<string, unknown> }) => {
    const path = buildTraceabilityNodePath(node);
    if (!path) {
      message.info('该节点暂无业务详情页可跳转');
      return;
    }
    setDetailVisible(false);
    setSelectedNode(null);
    navigate(path);
  };

  const config = {
    data: data
      ? {
          nodes: data.nodes.map((n: any) => {
            const style = getTraceabilityNodeStyle(n.type);
            return {
              id: n.id,
              label: n.label,
              style: { fill: style.fill, stroke: style.stroke },
            };
          }),
          edges: data.edges.map((e: any) => ({
            source: e.source,
            target: e.target,
            label: e.label,
          })),
        }
      : { nodes: [], edges: [] },
    layout: {
      type: 'dagre',
      rankdir: 'LR',
      nodesep: 30,
      ranksep: 50,
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-node'],
    node: {
      type: 'rect',
      style: {
        radius: 4,
      },
      labelCfg: {
        style: {
          fontSize: 12,
        },
      },
    },
    edge: {
      type: 'polyline',
      style: {
        endArrow: true,
        radius: 20,
      },
      labelCfg: {
        autoRotate: true,
        style: {
          fill: '#aaa',
          fontSize: 12,
        },
      },
    },
    markerCfg: () => ({ show: false }),
    onReady: (graph: any) => {
      graph.on('node:click', (evt: any) => {
        const nodeData = evt.item.getModel();
        const originalNode = data?.nodes.find((n: any) => n.id === nodeData.id);
        if (originalNode) {
          setSelectedNode(originalNode);
          setDetailVisible(true);
        }
      });
    },
  };

  const nodePath = selectedNode ? buildTraceabilityNodePath(selectedNode) : null;

  return (
    <ListPageTemplate>
      <div style={{ margin: -16, padding: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder={t('pages.traceability.searchPlaceholder', { defaultValue: '请输入批次号 / 条码' })}
            enterButton
            onSearch={handleSearch}
            style={{ width: 400 }}
          />
          <Select
            defaultValue="both"
            style={{ width: 150 }}
            onChange={(val) => setSearchParams({ ...searchParams, direction: val })}
            options={[
              { value: 'forward', label: t('pages.traceability.forward', { defaultValue: '正向 (-> 成品)' }) },
              { value: 'backward', label: t('pages.traceability.backward', { defaultValue: '反向 (-> 原料)' }) },
              { value: 'both', label: t('pages.traceability.both', { defaultValue: '双向' }) },
            ]}
          />
        </Space>

        <div
          style={{
            minHeight: 600,
            border: `1px solid ${token.colorBorder}`,
            position: 'relative',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {loading && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 }}>
              <Spin size="large" />
            </div>
          )}

          {!data && !loading && (
            <Empty description={t('pages.traceability.empty', { defaultValue: '请输入批次号进行查询' })} style={{ paddingTop: 150 }} />
          )}

          {data && <FlowGraph {...config} />}
        </div>

        <DetailDrawerTemplate
          title={t('pages.traceability.details', { defaultValue: '详情信息' })}
          open={detailVisible}
          onClose={() => {
            setDetailVisible(false);
            setSelectedNode(null);
          }}
          width={DRAWER_CONFIG.HALF_WIDTH}
          columns={[]}
          customContent={
            selectedNode ? (
              <>
                <DetailDrawerSection title="基本信息">
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label={t('pages.traceability.nodeType', { defaultValue: '类型' })}>
                      <Tag color="blue">{getTraceabilityNodeTypeLabel(selectedNode.type)}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('pages.traceability.nodeId', { defaultValue: '标识' })}>
                      <Typography.Text copyable={{ text: String(selectedNode.id) }}>{selectedNode.id}</Typography.Text>
                    </Descriptions.Item>
                    {selectedNode.data?.material_name && (
                      <Descriptions.Item label={t('pages.traceability.materialName', { defaultValue: '物料名称' })}>
                        {selectedNode.data.material_name}
                      </Descriptions.Item>
                    )}
                    {selectedNode.data?.material_code && (
                      <Descriptions.Item label={t('pages.traceability.materialCode', { defaultValue: '物料编号' })}>
                        <Typography.Text copyable={{ text: String(selectedNode.data.material_code) }}>
                          {selectedNode.data.material_code}
                        </Typography.Text>
                      </Descriptions.Item>
                    )}
                    {selectedNode.data?.operation_name && (
                      <Descriptions.Item label={t('pages.traceability.operationName', { defaultValue: '执行工序' })}>
                        {selectedNode.data.operation_name}
                      </Descriptions.Item>
                    )}
                    {selectedNode.data?.quality_status && (
                      <Descriptions.Item label="质量状态">
                        <Tag color={selectedNode.data.quality_status === '合格' ? 'success' : 'error'}>
                          {String(selectedNode.data.quality_status)}
                        </Tag>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </DetailDrawerSection>
                {nodePath ? (
                  <DetailDrawerSection title="业务跳转">
                    <Button type="primary" block onClick={() => navigateFromNode(selectedNode)}>
                      {selectedNode.type === 'work_order'
                        ? t('pages.traceability.viewWorkOrder', { defaultValue: '查看工单详情' })
                        : selectedNode.type === 'defect_record'
                          ? '查看不合格品台账'
                          : '查看检验单详情'}
                    </Button>
                  </DetailDrawerSection>
                ) : null}
              </>
            ) : null
          }
        />
      </div>
    </ListPageTemplate>
  );
};

export default TraceabilityPage;
