import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Input,
  Space,
  Select,
  Empty,
  Spin,
  message,
  Descriptions,
  Tag,
  Button,
  Typography,
  Table,
  Segmented,
  ConfigProvider,
} from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FlowGraph } from '@ant-design/graphs';
import { NodeEvent, type Graph } from '@antv/g6';
import {
  CANVAS_FLOW_GRAPH_GRID_STYLE,
  CANVAS_VISUAL_BASE,
} from '../../../../../components/layout-templates/constants';
import {
  DetailDrawerTemplate,
  DetailDrawerSection,
  ListPageTemplate,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import {
  buildTraceabilityNodePath,
  formatTraceEventRemark,
  getTraceabilityNodeStyle,
  getTraceabilityNodeTypeLabel,
} from '../components/inspectionTemplateUtils';
import { renderQualityQualityStatusTag } from '../components/qualityMeta';
import TraceSankeyChart from '../components/TraceSankeyChart';
import { traceabilityApi, type TraceDirection, type TraceProfile } from '../../../services/traceability';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';

const TRACE_RESOURCE = 'kuaizhizao:quality-management-traceability';

type TraceGraphViewMode = 'sankey' | 'flow';

const TRACE_CANVAS_HEIGHT = 480;

const TRACE_GRAPH_VIEWPORT_PADDING = 36;
const TRACE_GRAPH_FIT_ANIM = { duration: 420, easing: 'cubic-in-out' } as const;
const TRACE_GRAPH_MIN_NODE_WIDTH = 120;
const TRACE_GRAPH_MAX_NODE_WIDTH = 260;
const TRACE_GRAPH_NODE_HEIGHT = 48;

function estimateTraceNodeWidth(label: string): number {
  const text = (label || '').trim();
  const estimated = text.length * 7 + 28;
  return Math.min(TRACE_GRAPH_MAX_NODE_WIDTH, Math.max(TRACE_GRAPH_MIN_NODE_WIDTH, estimated));
}

type FlowGraphNodeClickEvt = {
  target?: { id?: string };
  item?: { getModel?: () => { id?: string } };
};

function resolveClickedNodeId(evt: FlowGraphNodeClickEvt): string | undefined {
  const tid = evt.target?.id;
  if (tid) return String(tid);
  const legacyId = evt.item?.getModel?.()?.id;
  return legacyId != null ? String(legacyId) : undefined;
}

const TraceabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tracePerms = useResourcePermissions(TRACE_RESOURCE);

  const [direction, setDirection] = useState<TraceDirection>('both');
  const [searchCode, setSearchCode] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TraceProfile['nodes'][0] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [graphView, setGraphView] = useState<TraceGraphViewMode>('sankey');
  const [graphViewportReady, setGraphViewportReady] = useState(false);
  const graphRef = useRef<Graph | null>(null);
  const viewportFitKeyRef = useRef('');
  const profileNodesRef = useRef<TraceProfile['nodes']>([]);

  const { data, loading, run } = useRequest(
    async (code: string, dir: TraceDirection) => traceabilityApi.getProfile(code, dir),
    {
      manual: true,
      onError: (err) => {
        message.error(
          t('app.kuaizhizao.quality.traceability.messages.loadFailed', {
            message: err?.message || String(err),
          }),
        );
      },
    },
  );

  const handleSearch = (value: string) => {
    const code = value.trim();
    if (!code) return;
    viewportFitKeyRef.current = '';
    setGraphViewportReady(false);
    setSearchCode(code);
    run(code, direction);
  };

  const handleExport = async () => {
    if (!searchCode) return;
    setExporting(true);
    try {
      await traceabilityApi.downloadReport(searchCode, direction);
      message.success(t('app.kuaizhizao.quality.traceability.messages.exportSuccess'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      message.error(t('app.kuaizhizao.quality.traceability.messages.exportFailed', { message: msg }));
    } finally {
      setExporting(false);
    }
  };

  const handleNodeClick = useCallback((evt: unknown) => {
    const nodeId = resolveClickedNodeId(evt as FlowGraphNodeClickEvt);
    if (!nodeId) return;
    const originalNode = profileNodesRef.current.find((n) => n.id === nodeId);
    if (originalNode) {
      setSelectedNode(originalNode);
      setDetailVisible(true);
    }
  }, []);

  const graphBundle = useMemo(() => {
    if (!data?.nodes?.length) {
      return { flowKey: 'empty', config: null as Record<string, unknown> | null };
    }

    profileNodesRef.current = data.nodes;

    const nodes = data.nodes.map((n) => {
      const style = getTraceabilityNodeStyle(n.type);
      const label = n.label || n.id;
      const width = estimateTraceNodeWidth(label);
      return {
        id: n.id,
        style: {
          size: [width, TRACE_GRAPH_NODE_HEIGHT] as [number, number],
          fill: style.fill,
          stroke: style.stroke,
          lineWidth: 1.5,
          radius: 6,
          labelText: label,
          labelFill: '#334155',
          labelFontSize: 11,
          labelPlacement: 'center' as const,
          labelWordWrap: true,
          labelMaxWidth: width - 16,
        },
        data: {
          label,
          nodeType: n.type,
        },
      };
    });

    const edges = (data.edges || []).reduce<Array<{ source: string; target: string }>>((acc, e) => {
      const key = `${e.source}\n${e.target}`;
      if (acc.some((x) => `${x.source}\n${x.target}` === key)) return acc;
      acc.push({ source: e.source, target: e.target });
      return acc;
    }, []);

    const flowKey = `${searchCode}-${direction}-${nodes.length}-${edges.length}`;

    const config: Record<string, unknown> = {
      padding: TRACE_GRAPH_VIEWPORT_PADDING,
      background: 'transparent',
      plugins: [
        {
          type: 'background',
          key: 'traceability-flow-bg',
          backgroundColor: CANVAS_FLOW_GRAPH_GRID_STYLE.backgroundColor,
          backgroundImage: CANVAS_FLOW_GRAPH_GRID_STYLE.backgroundImage,
          backgroundSize: CANVAS_FLOW_GRAPH_GRID_STYLE.backgroundSize,
        },
      ],
      labelField: 'label',
      data: { nodes, edges },
      layout: {
        type: 'dagre',
        rankdir: 'LR',
        nodesep: 28,
        ranksep: 56,
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-node'],
      node: {
        type: 'rect',
        style: {
          size: [TRACE_GRAPH_MAX_NODE_WIDTH, TRACE_GRAPH_NODE_HEIGHT],
        },
      },
      edge: {
        type: 'polyline',
        style: {
          stroke: '#64748b',
          lineWidth: 1.5,
          endArrow: true,
          radius: 16,
        },
      },
      onReady: (graph: Graph) => {
        graphRef.current = graph;
        graph.off(NodeEvent.CLICK, handleNodeClick);
        graph.on(NodeEvent.CLICK, handleNodeClick);

        if (viewportFitKeyRef.current === flowKey) {
          setGraphViewportReady(true);
          return;
        }
        viewportFitKeyRef.current = flowKey;

        const runFitView = () => {
          if (graph.destroyed) return;
          void graph
            .fitView({ when: 'always', direction: 'both' }, TRACE_GRAPH_FIT_ANIM)
            .then(() => {
              if (!graph.destroyed) setGraphViewportReady(true);
            });
        };
        queueMicrotask(() => requestAnimationFrame(runFitView));
      },
    };

    return { flowKey, config };
  }, [data, direction, searchCode, handleNodeClick]);

  const timelineEvents = useMemo(() => {
    if (!data?.events) return [];
    return data.events.filter(
      (e) =>
        !(
          (e.documentType === 'serial' || e.documentType === 'batch') &&
          e.documentCode === data.anchor.code
        ),
    );
  }, [data]);

  const anchorSummaryItems = useMemo(() => {
    if (!data?.anchor) return [];
    const anchor = data.anchor;
    return [
      {
        key: 'code',
        label: t('app.kuaizhizao.quality.traceability.nodeId'),
        children: anchor.code,
      },
      {
        key: 'type',
        label: t('app.kuaizhizao.quality.traceability.nodeType'),
        children: getTraceabilityNodeTypeLabel(anchor.identifierType, t),
      },
      {
        key: 'materialCode',
        label: t('app.kuaizhizao.quality.traceability.materialCode'),
        children: anchor.materialCode || '-',
      },
      {
        key: 'materialName',
        label: t('app.kuaizhizao.quality.traceability.materialName'),
        children: anchor.materialName || '-',
      },
    ];
  }, [data?.anchor, t]);

  const navigateFromNode = (node: { type?: string; id?: string; data?: Record<string, unknown> }) => {
    const path = buildTraceabilityNodePath(node);
    if (!path) {
      message.info(t('app.kuaizhizao.quality.traceability.messages.noDetailPage'));
      return;
    }
    setDetailVisible(false);
    setSelectedNode(null);
    navigate(path);
  };

  const getNavigateButtonLabel = (nodeType?: string) => {
    if (nodeType === 'work_order') return t('app.kuaizhizao.quality.traceability.viewWorkOrder');
    if (nodeType === 'defect_record') return t('app.kuaizhizao.quality.traceability.viewDefectRecord');
    if (nodeType === 'inbound' || nodeType === 'outbound') {
      return t('app.kuaizhizao.quality.traceability.viewDocument');
    }
    return t('app.kuaizhizao.quality.traceability.viewInspectionDetail');
  };

  const nodePath = selectedNode ? buildTraceabilityNodePath(selectedNode) : null;

  const showEmpty = !loading && !data;
  const showNoGraph = !loading && data && !graphBundle.config;
  const showFlowLoading =
    graphView === 'flow' && (loading || (graphBundle.config && !graphViewportReady));
  const showSankeyLoading = graphView === 'sankey' && loading;

  return (
    <ListPageTemplate>
      <div style={{ margin: -16, padding: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <Space wrap>
            <Input.Search
              placeholder={t('app.kuaizhizao.quality.traceability.searchPlaceholder')}
              enterButton
              onSearch={handleSearch}
              style={{ width: 400 }}
              allowClear
            />
            <Select
              value={direction}
              style={{ width: 150 }}
              onChange={(val) => setDirection(val)}
              options={[
                { value: 'forward', label: t('app.kuaizhizao.quality.traceability.forward') },
                { value: 'backward', label: t('app.kuaizhizao.quality.traceability.backward') },
                { value: 'both', label: t('app.kuaizhizao.quality.traceability.both') },
              ]}
            />
            {tracePerms.canPrint && (
              <Button
                icon={<FilePdfOutlined />}
                loading={exporting}
                disabled={!searchCode || !data}
                onClick={handleExport}
              >
                {t('app.kuaizhizao.quality.traceability.exportReport')}
              </Button>
            )}
          </Space>
          {data?.nodes?.length ? (
            <Segmented<TraceGraphViewMode>
              value={graphView}
              onChange={(val) => {
                setGraphView(val);
                if (val === 'flow') {
                  viewportFitKeyRef.current = '';
                  setGraphViewportReady(false);
                }
              }}
              options={[
                { label: t('app.kuaizhizao.quality.traceability.viewSankey'), value: 'sankey' },
                { label: t('app.kuaizhizao.quality.traceability.viewFlowGraph'), value: 'flow' },
              ]}
            />
          ) : null}
        </div>

        {data?.anchor && (
          <ConfigProvider
            theme={{
              token: {
                colorSplit: CANVAS_VISUAL_BASE.BORDER_COLOR,
                lineWidth: 2,
              },
            }}
          >
            <Descriptions
              size="small"
              bordered
              column={4}
              items={anchorSummaryItems}
              styles={{
                root: {
                  marginBottom: 16,
                  borderRadius: CANVAS_VISUAL_BASE.BORDER_RADIUS,
                  overflow: 'hidden',
                },
                label: {
                  fontWeight: 600,
                  textAlign: 'center',
                  display: 'block',
                  width: '100%',
                },
              }}
            />
          </ConfigProvider>
        )}

        <div
          style={{
            minHeight: TRACE_CANVAS_HEIGHT,
            border: `1px solid ${CANVAS_VISUAL_BASE.BORDER_COLOR}`,
            position: 'relative',
            borderRadius: CANVAS_VISUAL_BASE.BORDER_RADIUS,
            overflow: 'hidden',
            marginBottom: 16,
            backgroundColor: CANVAS_FLOW_GRAPH_GRID_STYLE.backgroundColor,
          }}
        >
          {(showFlowLoading || showSankeyLoading) && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
              }}
            >
              <Spin size="large" />
            </div>
          )}

          {showEmpty && (
            <Empty description={t('app.kuaizhizao.quality.traceability.empty')} style={{ paddingTop: 150 }} />
          )}

          {showNoGraph && (
            <Empty description={t('app.kuaizhizao.quality.traceability.noGraphData')} style={{ paddingTop: 150 }} />
          )}

          {!showEmpty && !showNoGraph && data && graphView === 'sankey' && (
            <div style={{ height: TRACE_CANVAS_HEIGHT, width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
              <TraceSankeyChart profile={data} height={TRACE_CANVAS_HEIGHT - 16} />
            </div>
          )}

          {!showEmpty && !showNoGraph && graphView === 'flow' && graphBundle.config && (
            <div
              style={{
                height: TRACE_CANVAS_HEIGHT,
                width: '100%',
                opacity: graphViewportReady ? 1 : 0,
                transition: graphViewportReady ? 'opacity 0.28s ease-out' : 'none',
              }}
            >
              <FlowGraph
                key={graphBundle.flowKey}
                {...(graphBundle.config as object)}
                containerStyle={{ height: '100%', width: '100%' }}
              />
            </div>
          )}
        </div>

        {data && timelineEvents.length > 0 && (
          <>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              {t('app.kuaizhizao.quality.traceability.eventTimeline')}
            </Typography.Title>
            <Table
              size="small"
              rowKey="eventId"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              dataSource={timelineEvents}
              columns={[
                {
                  title: t('app.kuaizhizao.quality.traceability.eventTime'),
                  dataIndex: 'eventTime',
                  width: 170,
                  render: (v) => (v ? formatDateTimeBySiteSetting(String(v)) : '-'),
                },
                {
                  title: t('app.kuaizhizao.quality.traceability.documentType'),
                  dataIndex: 'documentType',
                  width: 120,
                  render: (v) => getTraceabilityNodeTypeLabel(String(v), t),
                },
                {
                  title: t('app.kuaizhizao.quality.traceability.documentCode'),
                  dataIndex: 'documentCode',
                  ellipsis: true,
                  render: (v) =>
                    v ? (
                      <Typography.Text copyable={{ text: String(v) }}>{String(v)}</Typography.Text>
                    ) : (
                      '-'
                    ),
                },
                {
                  title: t('app.kuaizhizao.quality.traceability.materialName'),
                  dataIndex: 'materialName',
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.quality.traceability.qualityStatus'),
                  dataIndex: 'qualityStatus',
                  width: 100,
                  render: (v) => (v ? renderQualityQualityStatusTag(t, String(v)) : '-'),
                },
                {
                  title: t('app.kuaizhizao.quality.traceability.remark'),
                  dataIndex: 'remark',
                  ellipsis: true,
                  render: (v) => formatTraceEventRemark(v != null ? String(v) : undefined, t),
                },
              ]}
            />
          </>
        )}

        <DetailDrawerTemplate
          title={t('app.kuaizhizao.quality.traceability.details')}
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
                <DetailDrawerSection title={t('app.kuaizhizao.quality.traceability.basicInfo')}>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label={t('app.kuaizhizao.quality.traceability.nodeType')}>
                      <Tag color="blue">{getTraceabilityNodeTypeLabel(selectedNode.type, t)}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('app.kuaizhizao.quality.traceability.nodeId')}>
                      <Typography.Text copyable={{ text: String(selectedNode.id) }}>
                        {selectedNode.id}
                      </Typography.Text>
                    </Descriptions.Item>
                    {selectedNode.data?.material_name && (
                      <Descriptions.Item label={t('app.kuaizhizao.quality.traceability.materialName')}>
                        {String(selectedNode.data.material_name)}
                      </Descriptions.Item>
                    )}
                    {selectedNode.data?.material_code && (
                      <Descriptions.Item label={t('app.kuaizhizao.quality.traceability.materialCode')}>
                        <Typography.Text copyable={{ text: String(selectedNode.data.material_code) }}>
                          {String(selectedNode.data.material_code)}
                        </Typography.Text>
                      </Descriptions.Item>
                    )}
                    {selectedNode.data?.operation_name && (
                      <Descriptions.Item label={t('app.kuaizhizao.quality.traceability.operationName')}>
                        {String(selectedNode.data.operation_name)}
                      </Descriptions.Item>
                    )}
                    {selectedNode.data?.quality_status && (
                      <Descriptions.Item label={t('app.kuaizhizao.quality.traceability.qualityStatus')}>
                        {renderQualityQualityStatusTag(t, String(selectedNode.data.quality_status))}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </DetailDrawerSection>
                {nodePath ? (
                  <DetailDrawerSection title={t('app.kuaizhizao.quality.traceability.businessNav')}>
                    <Button type="primary" block onClick={() => navigateFromNode(selectedNode)}>
                      {getNavigateButtonLabel(selectedNode.type)}
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
