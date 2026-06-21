/**
 * 单据全链路追溯：FlowGraph（dagre LR），懒加载 trace API
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Spin, Button, Space, theme, message, Tooltip, Tag } from 'antd';
import {
  ReloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  AimOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  PartitionOutlined,
  CalculatorOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { FlowGraph } from '@ant-design/graphs';
import { NodeEvent, type Graph, type NodeData } from '@antv/g6';
import { CANVAS_FLOW_GRAPH_GRID_STYLE } from '../layout-templates/constants';
import { getDocumentRelationTrace } from '../../services/documentRelations';
import type { TraceGraphNodeMeta } from './traceToGraph';
import { traceDocumentNodeKey, traceResponseToFlowGraphData } from './traceToGraph';

/** fitView 时画布内边距（左右留白），与视口选项 padding 一致 */
const TRACE_FLOW_VIEWPORT_PADDING = { compact: 24, normal: 36 } as const;

/** React 自定义节点基准尺寸 [宽, 高]；须写在 node.style.size，否则会落回库默认 [100,40] 导致极窄 */
const TRACE_FLOW_NODE_BASE_SIZE: Record<'compact' | 'normal', [number, number]> = {
  compact: [172, 52],
  normal: [216, 58],
};

/**
 * 仅 1 个节点时 fitView 会把缩放拉得很高，节点在屏幕上过宽；
 * 限制首次适配后的 zoom 上限（约等于「节点视窗宽度不超过该像素」）。
 * 不写入 zoomRange，用户仍可滚轮/手势继续放大画布。
 */
const TRACE_FLOW_SINGLE_NODE_MAX_VIEW_WIDTH_PX = { compact: 220, normal: 260 } as const;

/** 首次 fitView / zoomTo 视口过渡，掩盖默认左上角再自适应的跳变 */
const TRACE_FLOW_VIEWPORT_FIT_ANIM = { duration: 420, easing: 'cubic-in-out' } as const;

/** G6 v5：节点点击为 target.id；旧版可能含 item.getModel */
type FlowGraphNodeClickEvt = {
  target?: { id?: string };
  targetType?: string;
  item?: { getModel?: () => { id?: string } };
};

function resolveFlowGraphClickedNodeId(evt: FlowGraphNodeClickEvt): string | undefined {
  const tid = evt.target?.id;
  if (tid != null && tid !== '') return String(tid);
  const legacyId = evt.item?.getModel?.()?.id;
  if (legacyId != null && legacyId !== '') return String(legacyId);
  return undefined;
}

const { useToken } = theme;

/** 与审批流 UniFlowNode 一致的文档节点图标映射 */
function TraceDocIcon({ document_type }: { document_type: string }) {
  switch (document_type) {
    case 'sales_order':
    case 'sales_delivery':
    case 'sales_return':
      return <ShoppingOutlined />;
    case 'purchase_order':
    case 'purchase_receipt':
    case 'purchase_return':
      return <ShoppingCartOutlined />;
    case 'work_order':
    case 'rework_order':
      return <ToolOutlined />;
    case 'demand':
      return <PartitionOutlined />;
    case 'demand_computation':
      return <CalculatorOutlined />;
    case 'reporting_timeline':
      return <ScheduleOutlined />;
    default:
      return <FileTextOutlined />;
  }
}

/**
 * 追溯接口里 document_name 常与「类型 + 单号」拼接重复（如 需求计算-MRP-xxx），
 * 与节点上已有类型行、编码行重复时不展示副标题。
 */
function traceNodeSubtitleToShow(typeTitle: string, mainCode: string, documentName: string): string | null {
  const name = documentName.trim();
  const code = (mainCode || '').trim();
  const tt = (typeTitle || '').trim();
  if (!name) return null;
  const fold = (s: string) => s.replace(/[\s·\-—_:：\/]/g, '').toLowerCase();
  if (code && fold(name) === fold(code)) return null;
  if (code && tt && fold(name) === fold(tt + code)) return null;
  return name;
}

interface TraceDocumentFlowNodeProps {
  document_type: string;
  document_id: number;
  document_code?: string;
  /** 追溯接口中的单据名称；报工节点为工序名称 */
  document_name?: string;
  created_at?: string;
  is_root: boolean;
  /** 画布点击选中（与 UniFlowNode selected 一致的主色描边 + 光晕） */
  selected: boolean;
  /** 关联单据已删除 */
  is_deleted?: boolean;
  compact: boolean;
}

/** 参照 UniFlowNode：顶栏浅色底 + 左侧色条 + 图标 + 类型标签 + 主文案 */
const TraceDocumentFlowNode: React.FC<TraceDocumentFlowNodeProps> = ({
  document_type,
  document_id,
  document_code,
  document_name,
  created_at,
  is_root,
  selected,
  is_deleted = false,
  compact,
}) => {
  const { token } = useToken();
  const { t } = useTranslation();

  const isSalesDelivery = document_type === 'sales_delivery';
  const isReportingTimeline = document_type === 'reporting_timeline';
  const success = token.colorSuccess;
  const accentBase = is_deleted
    ? token.colorTextQuaternary
    : is_root
      ? token.colorPrimary
      : isSalesDelivery
        ? success
        : isReportingTimeline
          ? token.colorPrimary
          : token.colorTextSecondary;
  /** 选中时统一用主色强调条与图标色 */
  const accent = selected ? token.colorPrimary : accentBase;
  const primary = token.colorPrimary;
  const typeTitle = t(`components.documentTrackingPanel.docType.${document_type}`, {
    defaultValue: document_type,
  });
  const code =
    (document_code || '').trim() ||
    `#${document_id}`;
  const subTitleRaw = (document_name || '').trim();
  const displaySubtitle = traceNodeSubtitleToShow(typeTitle, code, subTitleRaw);
  const createdAtText = created_at ? new Date(created_at).toLocaleString() : '-';

  const cardBorder =
    selected
      ? `2px solid ${primary}`
      : is_deleted
        ? `1px dashed ${token.colorErrorBorder}`
        : is_root
          ? `1px solid ${accentBase}`
          : isSalesDelivery
            ? `1px solid ${success}`
            : isReportingTimeline
              ? `1px solid ${accentBase}`
              : `1px solid ${token.colorBorderSecondary}`;
  const cardShadow = selected
    ? `0 0 0 2px ${primary}1f, ${token.boxShadowTertiary}`
    : is_deleted
      ? token.boxShadowTertiary
      : is_root
        ? `0 0 0 2px ${accentBase}22, ${token.boxShadowSecondary}`
        : isSalesDelivery
          ? `0 0 0 2px ${success}22, ${token.boxShadowSecondary}`
          : token.boxShadowTertiary;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        filter: selected ? `drop-shadow(0 0 4px ${primary}26)` : 'none',
        transition: 'filter 0.2s ease',
        opacity: is_deleted ? 0.72 : 1,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          background: is_deleted ? token.colorFillQuaternary : token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          border: cardBorder,
          boxShadow: cardShadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 6 : 8,
          padding: compact ? '6px 10px' : '8px 12px',
          background: `${accent}0a`,
          position: 'relative',
          minHeight: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '18%',
            bottom: '18%',
            width: 3,
            borderRadius: '0 2px 2px 0',
            background: accent,
          }}
        />
        <span
          style={{
            color: accent,
            fontSize: compact ? 14 : 16,
            display: 'flex',
            marginLeft: 6,
            flexShrink: 0,
          }}
        >
          <TraceDocIcon document_type={document_type} />
        </span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: compact ? 1 : 2 }}>
          <div
            style={{
              fontSize: compact ? 8 : 9,
              color: accent,
              fontWeight: 800,
              letterSpacing: '0.08em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{typeTitle}</span>
            {is_deleted ? (
              <Tag color="error" style={{ margin: 0, lineHeight: '14px', fontSize: compact ? 8 : 9, padding: '0 4px' }}>
                {t('components.documentTrackingPanel.relationDeleted')}
              </Tag>
            ) : null}
          </div>
          <div
            style={{
              fontSize: compact ? 11 : 12,
              fontWeight: 600,
              color: is_deleted ? token.colorTextQuaternary : token.colorText,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.35,
              textDecoration: is_deleted ? 'line-through' : undefined,
            }}
            title={displaySubtitle ? `${code}\n${displaySubtitle}` : code}
          >
            {code}
          </div>
          {displaySubtitle ? (
            <div
              style={{
                fontSize: compact ? 9 : 10,
                color: token.colorTextSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.25,
              }}
              title={displaySubtitle}
            >
              {displaySubtitle}
            </div>
          ) : null}
          <div
            style={{
              fontSize: compact ? 9 : 10,
              color: token.colorTextTertiary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
            title={`创建时间: ${createdAtText}`}
          >
            创建: {createdAtText}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export interface DocumentTraceFlowGraphProps {
  documentType: string;
  documentId: number;
  /** 仅在为 true 时请求追溯接口（例如切换到「全链路」Tab） */
  enabled: boolean;
  refreshKey?: number;
  onDocumentClick?: (type: string, id: number) => void;
  /** 填满父容器高度（抽屉外固定分区等窄区域） */
  compact?: boolean;
  /** 为 true 时不渲染内置刷新按钮（由外层标题栏承接） */
  hideInlineRefresh?: boolean;
  /** 追溯接口加载状态（便于外层刷新按钮展示 loading） */
  onTraceLoadingChange?: (loading: boolean) => void;
}

export const DocumentTraceFlowGraph: React.FC<DocumentTraceFlowGraphProps> = ({
  documentType,
  documentId,
  enabled,
  refreshKey = 0,
  onDocumentClick,
  compact = false,
  hideInlineRefresh = false,
  onTraceLoadingChange,
}) => {
  const { t } = useTranslation();
  const { token } = useToken();
  const traceCanvasRadius = Math.max(4, Number(token.borderRadiusLG ?? token.borderRadius ?? 6));
  const metaRef = useRef<Record<string, TraceGraphNodeMeta>>({});
  const onDocumentClickRef = useRef(onDocumentClick);
  onDocumentClickRef.current = onDocumentClick;

  /** G6 节点 id（与 traceDocumentNodeKey 一致），用于选中描边 / 光晕 */
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);

  /** 仅在追溯拓扑变化时做一次 fitView，避免选中节点反复重置缩放/平移 */
  const traceFlowViewportFitKeyRef = useRef<string>('');
  /** fitView 完成前保持遮罩，避免画布从左上角闪跳到居中 */
  const [traceViewportReady, setTraceViewportReady] = useState(false);
  /** 每次主动拉取/刷新递增，迫使 FlowGraph  remount 并重新 fitView */
  const [traceLoadSeq, setTraceLoadSeq] = useState(0);

  /** 全屏包裹追溯图画布（不含外层「刷新」工具条） */
  const traceChartShellRef = useRef<HTMLDivElement | null>(null);
  const [traceChartFullscreen, setTraceChartFullscreen] = useState(false);
  /** 防误触：默认不允许滚轮缩放，点击画板进入选中模式后才开启 */
  const [traceCanvasActive, setTraceCanvasActive] = useState(false);
  /** 当前画布实例：用于“定位到中心”恢复首屏自适应位置 */
  const traceGraphRef = useRef<Graph | null>(null);

  useEffect(() => {
    const onFsChange = () => {
      setTraceChartFullscreen(document.fullscreenElement === traceChartShellRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!traceCanvasActive) return;
    const onPointerDownOutside = (event: MouseEvent) => {
      const shell = traceChartShellRef.current;
      if (!shell) return;
      if (event.target instanceof Node && shell.contains(event.target)) return;
      setTraceCanvasActive(false);
    };
    document.addEventListener('mousedown', onPointerDownOutside);
    return () => document.removeEventListener('mousedown', onPointerDownOutside);
  }, [traceCanvasActive]);

  const toggleTraceChartFullscreen = useCallback(async () => {
    const el = traceChartShellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await el.requestFullscreen();
    } catch {
      message.warning(t('components.documentRelationGraph.fullscreenUnsupported'));
    }
  }, [t]);

  const handleTraceFlowNodeClick = useCallback((evt: unknown) => {
    const nodeId = resolveFlowGraphClickedNodeId(evt as FlowGraphNodeClickEvt);
    if (!nodeId) return;
    const meta = metaRef.current[nodeId];
    if (!meta) return;
    if (meta.is_deleted) return;
    setSelectedGraphNodeId(nodeId);
    onDocumentClickRef.current?.(meta.document_type, meta.document_id);
  }, []);

  const formatLabel = useCallback(
    (meta: TraceGraphNodeMeta) => {
      const typeLabel = t(`components.documentTrackingPanel.docType.${meta.document_type}`, {
        defaultValue: meta.document_type,
      });
      const code = (meta.document_code || '').trim() || `#${meta.document_id}`;
      return `${typeLabel}（${code}）`;
    },
    [t]
  );

  const { data: trace, loading, error, run } = useRequest(
    () => getDocumentRelationTrace(documentType, documentId, { direction: 'both', max_depth: 10 }),
    {
      manual: true,
      onError: (err: Error) => {
        message.error(err?.message || t('components.documentRelationGraph.loadFailed'));
      },
    }
  );

  const beginTraceReload = useCallback(() => {
    traceFlowViewportFitKeyRef.current = '';
    setTraceViewportReady(false);
    setTraceLoadSeq((n) => n + 1);
  }, []);

  const reloadTrace = useCallback(() => {
    beginTraceReload();
    run();
  }, [beginTraceReload, run]);

  const resetTraceViewportToInitialFit = useCallback(async () => {
    const graph = traceGraphRef.current;
    if (!graph || graph.destroyed) return;
    const layoutMode: 'compact' | 'normal' = compact ? 'compact' : 'normal';
    const [nodeBaseWidth] = TRACE_FLOW_NODE_BASE_SIZE[layoutMode];
    const singleNodeFitMaxZoom =
      TRACE_FLOW_SINGLE_NODE_MAX_VIEW_WIDTH_PX[layoutMode] / nodeBaseWidth;
    const nodesCount = trace ? traceResponseToFlowGraphData(trace, formatLabel).nodes.length : 0;
    try {
      await graph.fitView({ when: 'always', direction: 'both' }, TRACE_FLOW_VIEWPORT_FIT_ANIM);
      if (nodesCount <= 1) {
        const z = graph.getZoom();
        if (z > singleNodeFitMaxZoom) {
          await graph.zoomTo(singleNodeFitMaxZoom, TRACE_FLOW_VIEWPORT_FIT_ANIM);
        }
      }
    } catch {
      // 忽略定位失败，避免打断页面交互
    }
  }, [compact, formatLabel, trace]);

  useEffect(() => {
    if (!enabled || !documentType || documentId == null) return;
    setTraceCanvasActive(false);
    beginTraceReload();
    run();
  }, [enabled, documentType, documentId, refreshKey, beginTraceReload, run]);

  useEffect(() => {
    onTraceLoadingChange?.(loading);
  }, [loading, onTraceLoadingChange]);

  /** 追溯加载完成后默认高亮当前根单据节点 */
  useEffect(() => {
    if (!trace) {
      setSelectedGraphNodeId(null);
      return;
    }
    setSelectedGraphNodeId(traceDocumentNodeKey(trace.document_type, trace.document_id));
  }, [trace]);

  useEffect(() => {
    if (loading) setTraceViewportReady(false);
  }, [loading]);

  const { flowKey, graphConfig } = useMemo(() => {
    if (!trace) {
      return { flowKey: 'empty', graphConfig: null as Record<string, unknown> | null };
    }
    const { nodes, edges, metaById } = traceResponseToFlowGraphData(trace, formatLabel);
    metaRef.current = metaById;

    const flowKey = `${documentType}-${documentId}-${nodes.length}-${edges.length}-${refreshKey}-${traceLoadSeq}`;
    const viewportPadding = compact ? TRACE_FLOW_VIEWPORT_PADDING.compact : TRACE_FLOW_VIEWPORT_PADDING.normal;
    const layoutMode = compact ? 'compact' : 'normal';
    const [nodeBaseWidth] = TRACE_FLOW_NODE_BASE_SIZE[layoutMode];
    const singleNodeFitMaxZoom =
      TRACE_FLOW_SINGLE_NODE_MAX_VIEW_WIDTH_PX[layoutMode] / nodeBaseWidth;
    const dagreRankSep = 48;

    const config: Record<string, unknown> = {
      /** fitView 内边距：适配视口时四周留白 */
      padding: viewportPadding,
      /** 透出底层点阵背景（底色同 CANVAS_GRID_STYLE，点距/圆点略小） */
      background: 'transparent',
      plugins: [
        {
          type: 'background',
          key: 'document-trace-flow-bg',
          backgroundColor: CANVAS_FLOW_GRAPH_GRID_STYLE.backgroundColor,
          backgroundImage: CANVAS_FLOW_GRAPH_GRID_STYLE.backgroundImage,
          backgroundSize: CANVAS_FLOW_GRAPH_GRID_STYLE.backgroundSize,
        },
      ],
      /** 使用 data.label，见 @ant-design/graphs formatLabel(data, labelField) */
      labelField: 'label',
      data: {
        nodes: nodes.map((n) => ({
          id: n.id,
          style: {
            size: n.flowNodeSize ?? TRACE_FLOW_NODE_BASE_SIZE[layoutMode],
          },
          data: {
            label: n.label,
            is_root: n.meta?.is_root,
            document_type: n.meta?.document_type ?? '',
            document_id: n.meta?.document_id ?? 0,
            document_code: n.meta?.document_code,
            document_name: n.meta?.document_name,
            created_at: n.meta?.created_at,
            is_deleted: n.meta?.is_deleted,
          },
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
        })),
      },
      layout: {
        type: 'dagre',
        rankdir: 'LR',
        nodesep: 28,
        ranksep: dagreRankSep,
      },
      behaviors: traceCanvasActive
        ? ['drag-canvas', 'zoom-canvas', 'drag-node']
        : ['drag-canvas', 'drag-node'],
      /** React 自定义节点（对齐 UniFlowNode 层次）；勿改为 rect，否则不走 React 挂载链路 */
      node: {
        style: {
          size: TRACE_FLOW_NODE_BASE_SIZE[layoutMode],
          component: (data: NodeData) => {
            const datum = data?.data as {
              label?: string;
              is_root?: boolean;
              document_type?: string;
              document_id?: number;
              document_code?: string;
              document_name?: string;
              created_at?: string;
              is_deleted?: boolean;
            };
            const document_type = datum?.document_type ?? '';
            const document_id = datum?.document_id ?? 0;
            const nid = data?.id != null ? String(data.id) : '';
            return (
              <TraceDocumentFlowNode
                document_type={document_type}
                document_id={document_id}
                document_code={datum?.document_code}
                document_name={datum?.document_name}
                created_at={datum?.created_at}
                is_root={!!datum?.is_root}
                is_deleted={!!datum?.is_deleted}
                selected={nid !== '' && nid === selectedGraphNodeId}
                compact={compact}
              />
            );
          },
        },
      },
      edge: {
        type: 'polyline',
        style: {
          /** 浅灰点阵底上 borderSecondary 对比度过低，连线会像「消失」 */
          stroke: '#64748b',
          lineWidth: 1.75,
          endArrow: true,
          radius: 16,
          router: { type: 'orth' },
        },
      },
      /** G6 v5：Graphin 每次 setOptions 后会再次 onReady，先卸旧监听避免重复触发 */
      onReady: (graph: Graph) => {
        traceGraphRef.current = graph;
        graph.off(NodeEvent.CLICK, handleTraceFlowNodeClick);
        graph.on(NodeEvent.CLICK, handleTraceFlowNodeClick);

        if (traceFlowViewportFitKeyRef.current === flowKey) {
          setTraceViewportReady(true);
          return;
        }

        traceFlowViewportFitKeyRef.current = flowKey;
        const runFitView = () => {
          if (graph.destroyed) return;
          void graph
            .fitView({ when: 'always', direction: 'both' }, TRACE_FLOW_VIEWPORT_FIT_ANIM)
            .then(async () => {
              if (graph.destroyed) return;
              if (nodes.length <= 1) {
                const z = graph.getZoom();
                if (z > singleNodeFitMaxZoom) {
                  await graph.zoomTo(singleNodeFitMaxZoom, TRACE_FLOW_VIEWPORT_FIT_ANIM);
                }
              }
              setTraceViewportReady(true);
            });
        };
        queueMicrotask(() => requestAnimationFrame(runFitView));
      },
    };

    return {
      flowKey,
      graphConfig: config,
    };
  }, [trace, formatLabel, documentType, documentId, refreshKey, traceLoadSeq, compact, selectedGraphNodeId, handleTraceFlowNodeClick, traceCanvasActive]);

  if (!enabled) {
    return <div style={{ minHeight: compact ? 0 : 400 }} />;
  }

  return (
    <div
      style={
        compact
          ? {
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              gap: hideInlineRefresh ? 0 : 8,
            }
          : undefined
      }
    >
      {!hideInlineRefresh ? (
        <Space style={{ marginBottom: compact ? 0 : 8, flexShrink: 0 }}>
          <Tooltip title={traceChartFullscreen ? t('components.documentRelationGraph.exitFullscreen') : t('components.documentRelationGraph.fullscreen')}>
            <Button
              type="default"
              size="small"
              icon={traceChartFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => void toggleTraceChartFullscreen()}
            >
              {traceChartFullscreen
                ? t('components.documentRelationGraph.exitFullscreen', { defaultValue: '退出全屏' })
                : t('components.documentRelationGraph.fullscreen', { defaultValue: '全屏' })}
            </Button>
          </Tooltip>
          <Tooltip title={t('components.documentRelationGraph.center', { defaultValue: '定位到中心' })}>
            <Button
              type="default"
              size="small"
              icon={<AimOutlined />}
              onClick={() => void resetTraceViewportToInitialFit()}
            >
              {t('components.documentRelationGraph.center', { defaultValue: '定位到中心' })}
            </Button>
          </Tooltip>
          <Button type="default" size="small" icon={<ReloadOutlined />} loading={loading} onClick={reloadTrace}>
            {t('components.documentRelationGraph.refresh')}
          </Button>
        </Space>
      ) : null}
      <div
        ref={traceChartShellRef}
        style={{
          position: 'relative',
          boxSizing: 'border-box',
          ...(compact || traceChartFullscreen
            ? { flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }
            : { minHeight: 480 }),
          border: traceCanvasActive
            ? `1px solid ${token.colorPrimary}`
            : `1px solid ${token.colorBorder}`,
          boxShadow: traceCanvasActive
            ? `inset 0 0 0 3px ${token.colorPrimary}40, 0 0 0 2px ${token.colorPrimary}2e`
            : undefined,
          borderRadius: traceChartFullscreen ? 0 : traceCanvasRadius,
          overflow: 'hidden',
          background: token.colorBgContainer,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {hideInlineRefresh ? (
          <Space size={4} style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
            <Tooltip title={t('components.documentRelationGraph.center', { defaultValue: '定位到中心' })}>
              <Button
                type="default"
                size="small"
                icon={<AimOutlined />}
                onClick={() => void resetTraceViewportToInitialFit()}
              >
                {t('components.documentRelationGraph.center', { defaultValue: '定位到中心' })}
              </Button>
            </Tooltip>
            <Button
              type="default"
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={reloadTrace}
            >
              {t('components.documentRelationGraph.refresh')}
            </Button>
            <Tooltip
              title={
                traceChartFullscreen
                  ? t('components.documentRelationGraph.exitFullscreen')
                  : t('components.documentRelationGraph.fullscreen')
              }
            >
              <Button
                type="default"
                size="small"
                icon={traceChartFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={() => void toggleTraceChartFullscreen()}
              >
                {traceChartFullscreen
                  ? t('components.documentRelationGraph.exitFullscreen', { defaultValue: '退出全屏' })
                  : t('components.documentRelationGraph.fullscreen', { defaultValue: '全屏' })}
              </Button>
            </Tooltip>
          </Space>
        ) : null}
        {loading || (trace && graphConfig && !traceViewportReady) ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: token.colorBgContainer,
              zIndex: 2,
            }}
          >
            <Spin size="large" />
          </div>
        ) : null}
        {error && !trace && (
          <div style={{ padding: 48 }}>
            <Empty description={t('components.documentRelationGraph.loadFailed')} />
          </div>
        )}
        {!loading && trace && graphConfig && (
          <div
            onMouseDown={() => {
              if (!traceCanvasActive) setTraceCanvasActive(true);
            }}
            style={{
              flex: 1,
              minHeight: 0,
              height: compact || traceChartFullscreen ? '100%' : undefined,
              width: '100%',
              opacity: traceViewportReady ? 1 : 0,
              transition: traceViewportReady ? 'opacity 0.28s ease-out' : 'none',
            }}
          >
            <FlowGraph
              key={flowKey}
              {...(graphConfig as object)}
              {...(
                compact || traceChartFullscreen
                  ? { containerStyle: { flex: 1, minHeight: 0, height: '100%', width: '100%' } as React.CSSProperties }
                  : {}
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};
