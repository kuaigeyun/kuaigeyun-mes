/**
 * 工厂拓扑页面
 *
 * 以图形化方式展示工厂层级结构：厂区 → 车间 → 产线 → 工位，以及工作中心与工位的关联。
 */

import React, { useState, useEffect, useRef } from 'react';
import { Space, Empty, Spin, message, Descriptions, Tag, Button, theme, Select, Segmented } from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FlowGraph } from '@ant-design/graphs';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { factoryTopologyApi, type FactoryTopologyNode } from '../../../services/factory';
import Topology3D from './Topology3D';

const { useToken } = theme;

/** 按层级（depth）配色，同等级节点相同颜色 */
const LEVEL_COLORS: Record<number, { fill: string; stroke: string }> = {
  0: { fill: '#F0F5FF', stroke: '#597EF7' },
  1: { fill: '#E6F7FF', stroke: '#1890FF' },
  2: { fill: '#F6FFED', stroke: '#52C41A' },
  3: { fill: '#FFF7E6', stroke: '#FA8C16' },
  4: { fill: '#FFF1F0', stroke: '#F5222D' },
};

/** 双色块节点：上白底黑字（编码），下彩色底白字（名称），圆角+描边 */
const TopologyNode: React.FC<{
  code?: string;
  name?: string;
  label?: string;
  depth: number;
}> = ({ code, name, label, depth }) => {
  const { token } = useToken();
  const colors = LEVEL_COLORS[depth] ?? { fill: '#f0f0f0', stroke: '#d9d9d9' };
  const hasTwoSections = !!(code && name);
  const radius = typeof token.borderRadius === 'number' ? token.borderRadius : 6;

  if (!hasTwoSections) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
          border: `1px solid ${token.colorBorder}`,
          boxSizing: 'border-box',
          background: colors.stroke,
          color: '#fff',
          fontSize: 16,
          fontWeight: 600,
          padding: '0 12px',
        }}
      >
        {label || ''}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: radius,
        border: `1px solid ${token.colorBorder}`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: '0 0 36%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          color: '#262626',
          fontSize: 12,
          padding: '0 10px',
        }}
      >
        {code}
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.stroke,
          color: '#fff',
          fontSize: 18,
          fontWeight: 600,
          padding: '0 8px',
        }}
      >
        {name}
      </div>
    </div>
  );
};

const TYPE_LABELS: Record<string, string> = {
  root: 'pages.factoryTopology.typeRoot',
  plant: 'pages.factoryTopology.typePlant',
  workshop: 'pages.factoryTopology.typeWorkshop',
  production_line: 'pages.factoryTopology.typeProductionLine',
  workstation: 'pages.factoryTopology.typeWorkstation',
  work_center: 'pages.factoryTopology.typeWorkCenter',
};

const FactoryTopologyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useToken();
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FactoryTopologyNode | null>(null);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'flat' | '3d'>('flat');
  const [flatGraphReady, setFlatGraphReady] = useState(false);
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { data, loading, run } = useRequest(
    () =>
      factoryTopologyApi.getTopology(
        isActiveFilter !== undefined ? { is_active: isActiveFilter } : undefined
      ),
    {
      refreshDeps: [isActiveFilter],
      onError: (err) => {
        message.error(t('pages.factoryTopology.loadFailed', { defaultValue: '加载失败' }) + ': ' + (err as Error).message);
      },
    }
  );

  useEffect(() => {
    setFlatGraphReady(false);
    return () => {
      if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
    };
  }, [data]);

  const handleNodeClick = (nodeData: FactoryTopologyNode) => {
    setSelectedNode(nodeData);
    setDetailVisible(true);
  };

  const getDetailPath = (node: FactoryTopologyNode) => {
    const uuid = node.data?.uuid;
    if (!uuid) return null;
    switch (node.type) {
      case 'plant': return `/apps/master-data/factory/plants`;
      case 'workshop': return `/apps/master-data/factory/workshops`;
      case 'production_line': return `/apps/master-data/factory/production-lines`;
      case 'workstation': return `/apps/master-data/factory/workstations`;
      case 'work_center': return `/apps/master-data/factory/work-centers`;
      default: return null;
    }
  };

  const config = {
    direction: 'vertical' as const,
    padding: 32,
    autoResize: true,
    data: data
      ? {
          nodes: data.nodes.map((n) => {
            const depth = (n.data as { depth?: number })?.depth ?? 0;
            const colors = LEVEL_COLORS[depth] ?? { fill: '#f0f0f0', stroke: '#d9d9d9' };
            const code = (n.data as { code?: string })?.code;
            const name = (n.data as { name?: string })?.name;
            const displayText = code && name ? `${code}\n${name}` : (n.label || n.id);
            const line1Len = code?.length ?? 0;
            const line2Len = name?.length ?? 0;
            const maxLen = Math.max(line1Len, line2Len, displayText.length);
            const nodeWidth = Math.max(130, Math.min(maxLen * 11, 280));
            const nodeHeight = code && name ? 64 : 46;
            return {
              id: n.id,
              label: displayText,
              data: { ...n.data, depth, code, name },
              size: [nodeWidth, nodeHeight],
              style: {
                fill: colors.fill,
                stroke: colors.stroke,
                size: [nodeWidth, nodeHeight],
              },
            };
          }),
          edges: data.edges.map((e) => {
            // 工作中心→工位 反转为 工位→工作中心，使工作中心显示在工位下方
            const isWcToWs =
              e.source.startsWith('work_center_') && e.target.startsWith('workstation_');
            return isWcToWs
              ? { source: e.target, target: e.source }
              : { source: e.source, target: e.target };
          }),
        }
      : { nodes: [] as { id: string; label: string; style: { fill: string; stroke: string } }[], edges: [] as { source: string; target: string }[] },
    labelField: (node: { id: string; label?: string; data?: { code?: string; name?: string } }) =>
      node.label ?? (node.data?.code && node.data?.name ? `${node.data.code}\n${node.data.name}` : node.id),
    layout: {
      type: 'dagre' as const,
      rankdir: 'TB',
      nodesep: 80,
      ranksep: 120,
      edgesep: 30,
      align: 'UL',
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-node'],
    node: {
      style: {
        radius: 6,
        component: (datum: {
          id?: string;
          label?: string;
          data?: { code?: string; name?: string; depth?: number };
        }) => (
          <TopologyNode
            code={datum.data?.code}
            name={datum.data?.name}
            label={datum.label ?? datum.id}
            depth={datum.data?.depth ?? 0}
          />
        ),
        size: (
          datum: { label?: string; data?: { code?: string; name?: string }; id?: string }
        ): [number, number] => {
          const code = datum.data?.code;
          const name = datum.data?.name;
          const hasTwoSections = !!(code && name);
          const maxLen = hasTwoSections
            ? Math.max(code!.length, name!.length)
            : (datum.label ?? datum.id ?? '').length;
          const w = Math.max(130, Math.min(maxLen * 11, 280));
          const h = hasTwoSections ? 64 : 46;
          return [w, h];
        },
      },
    },
    edge: {
      type: 'cubic-vertical',
      style: {
        lineWidth: 2,
        endArrow: true,
      },
    },
    markerCfg: () => ({ show: false }),
    onReady: (graph: any) => {
      if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
      graph.on('node:click', (evt: any) => {
        const model = evt.item.getModel();
        const node = data?.nodes.find((n) => n.id === model.id);
        if (node) handleNodeClick(node);
      });
      const fitAndShow = () => {
        graph.fitView?.(undefined, false);
        setFlatGraphReady(true);
      };
      graph.once?.('afterlayout', fitAndShow);
      queueMicrotask(fitAndShow);
      fitTimeoutRef.current = setTimeout(fitAndShow, 350);
    },
  };

  return (
    <ListPageTemplate>
      <div style={{ margin: 0, padding: '0' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'flat' | '3d')}
            options={[
              { value: 'flat', label: t('pages.factoryTopology.viewFlat', { defaultValue: '平面拓扑' }) },
              { value: '3d', label: t('pages.factoryTopology.view3D', { defaultValue: '3D拓扑' }) },
            ]}
          />
          <Select
            value={isActiveFilter === undefined ? 'all' : isActiveFilter}
            style={{ width: 160 }}
            onChange={(v) => setIsActiveFilter(v === 'all' ? undefined : (v as boolean))}
            options={[
              { value: 'all', label: t('pages.factoryTopology.filterAll', { defaultValue: '全部' }) },
              { value: true, label: t('pages.factoryTopology.filterActive', { defaultValue: '仅启用' }) },
              { value: false, label: t('pages.factoryTopology.filterInactive', { defaultValue: '仅停用' }) },
            ]}
          />
          <Button onClick={() => run()}>{t('common.refresh', { defaultValue: '刷新' })}</Button>
        </Space>

        <div
          style={{
            height: 'calc(100vh - 176px)',
            minHeight: 400,
            border: `1px solid ${token.colorBorder}`,
            position: 'relative',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {loading && (
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

          {!data && !loading && (
            <Empty
              description={t('pages.factoryTopology.empty', { defaultValue: '暂无工厂数据' })}
              style={{ paddingTop: 150 }}
            />
          )}

          {data && data.nodes.length > 0 &&
            (viewMode === 'flat' ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: flatGraphReady ? 1 : 0,
                  transition: 'opacity 0.12s ease-out',
                }}
              >
                <FlowGraph {...config} />
              </div>
            ) : (
              <Topology3D
                nodes={data.nodes}
                edges={data.edges}
                onNodeClick={handleNodeClick}
              />
            ))}
        </div>

        <DetailDrawerTemplate
          title={t('pages.factoryTopology.details', { defaultValue: '节点详情' })}
          open={detailVisible}
          onClose={() => {
            setDetailVisible(false);
            setSelectedNode(null);
          }}
          width={DRAWER_CONFIG.HALF_WIDTH}
          columns={[]}
          customContent={
            selectedNode ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label={t('pages.factoryTopology.nodeType', { defaultValue: '类型' })}>
                  <Tag color={LEVEL_COLORS[(selectedNode.data as { depth?: number })?.depth ?? 0]?.stroke ?? 'default'}>
                    {t(TYPE_LABELS[selectedNode.type] ?? selectedNode.type)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('pages.factoryTopology.label', { defaultValue: '名称' })}>
                  {selectedNode.label}
                </Descriptions.Item>
                {selectedNode.data?.code && (
                  <Descriptions.Item label={t('pages.factoryTopology.code', { defaultValue: '编码' })}>
                    {selectedNode.data.code}
                  </Descriptions.Item>
                )}
                {selectedNode.data?.uuid && (
                  <Descriptions.Item label={t('pages.factoryTopology.uuid', { defaultValue: 'UUID' })}>
                    {selectedNode.data.uuid}
                  </Descriptions.Item>
                )}
              </Descriptions>
            ) : null
          }
        >
          {selectedNode && getDetailPath(selectedNode) && (
            <div style={{ marginTop: 24 }}>
              <Button
                type="primary"
                block
                onClick={() => {
                  navigate(getDetailPath(selectedNode)!);
                  setDetailVisible(false);
                }}
              >
                {t('pages.factoryTopology.viewDetail', { defaultValue: '查看详情' })}
              </Button>
            </div>
          )}
        </DetailDrawerTemplate>
      </div>
    </ListPageTemplate>
  );
};

export default FactoryTopologyPage;
