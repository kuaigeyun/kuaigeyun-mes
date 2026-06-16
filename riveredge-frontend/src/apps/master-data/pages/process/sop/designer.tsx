/**
 * SOP 流程设计器页面
 * 
 * 修改记录：
 * - 修正 CanvasPageTemplate 的正确用法。
 * - 修正 SOP 接口导入路径。
 * - 切换为 ReactFlow 原生组件以获得更好适配和显示效果。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Space, Form, Input, theme, Typography as AntdTypography, Upload } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import { App } from 'antd';
import type { UploadFile, UploadProps } from 'antd';

import ReactFlow, { 
  Background, 
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { sopApi } from '../../../services/process';
import { CanvasPageTemplate } from '../../../../../components/layout-templates/CanvasPageTemplate';
import { CANVAS_GRID_REACTFLOW } from '../../../../../components/layout-templates/constants';
import FormSchemaEditor from './FormSchemaEditor';
import type { ISchema } from '@formily/json-schema';
import UniFlowNode from '../../../../../components/common/uni-flow-node';
import type { SOP, SOPUpdate } from '../../../types/process';
import { getFileByUuid, uploadMultipleFiles } from '../../../../../services/file';
// Remove unused Text declaration
/** 垂直布局常量 */
const LAYOUT_CENTER_X = 280;
const LAYOUT_BASE_Y = 60;
const LAYOUT_GAP = 120;
const SOP_NODE_ATTACHMENT_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'dwg', 'dxf', 'step', 'stp', 'xls', 'xlsx',
  'mp4', 'mov', 'avi',
]);


const nodeTypes = {
  start: UniFlowNode,
  end: UniFlowNode,
  step: UniFlowNode,
  check: UniFlowNode,
};
const { Dragger } = Upload;

const SOPDesignerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sopUuid = searchParams.get('uuid');
  const { message } = App.useApp();
  const { token } = theme.useToken();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [nodeDataMap, setNodeDataMap] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formSchema, setFormSchema] = useState<ISchema | null>(null);
  const [attachmentFileList, setAttachmentFileList] = useState<UploadFile[]>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  const [nodeConfigForm] = Form.useForm();

  const toAttachmentUuids = useCallback((raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    const uuids = raw
      .map((item: any) => (typeof item === 'string' ? item : item?.uuid || item?.uid))
      .filter((u: unknown): u is string => !!u && typeof u === 'string');
    return Array.from(new Set(uuids));
  }, []);

  const buildAttachmentFileList = useCallback(async (uuids: string[]) => {
    if (!uuids.length) return [];
    const list = await Promise.all(
      uuids.map(async (uuid) => {
        try {
          const meta = await getFileByUuid(uuid);
          return {
            uid: uuid,
            name: meta.original_name || meta.name || uuid,
            status: 'done' as const,
          } as UploadFile;
        } catch {
          return { uid: uuid, name: uuid, status: 'done' as const } as UploadFile;
        }
      })
    );
    return list;
  }, []);

  const applyVerticalLayout = useCallback((nodes: Node[], edges: Edge[]) => {
    const nodeLevels: Record<string, number> = {};
    const processed = new Set<string>();
    
    const calculateLevel = (nodeId: string, level: number) => {
      if (processed.has(nodeId)) return;
      nodeLevels[nodeId] = Math.max(nodeLevels[nodeId] || 0, level);
      processed.add(nodeId);
      edges.filter(e => e.source === nodeId).forEach(e => calculateLevel(e.target, level + 1));
    };

    calculateLevel('start', 0);

    // 兜底：未从开始节点可达的孤立节点，顺延放到后续层级，避免重叠
    const maxKnownLevel = Math.max(0, ...Object.values(nodeLevels));
    let extraLevel = maxKnownLevel + 1;
    for (const n of nodes) {
      if (nodeLevels[n.id] == null) {
        nodeLevels[n.id] = extraLevel++;
      }
    }

    return nodes.map(node => ({
      ...node,
      position: {
        x: LAYOUT_CENTER_X - 100,
        y: LAYOUT_BASE_Y + (nodeLevels[node.id] || 0) * LAYOUT_GAP
      }
    }));
  }, []);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => applyVerticalLayout(nds as Node[], edges) as any);
  }, [applyVerticalLayout, edges, setNodes]);

  const loadSOPData = useCallback(async () => {
    try {
      const data = await (sopApi.get(sopUuid!) as Promise<SOP>);
      const flowData = (data.flowConfig || (data as any).flow_config || { nodes: [], edges: [] }) as any;
      
      let nodesData = flowData.nodes || [];
      let edgesData = flowData.edges || [];

      if (nodesData.length === 0) {
        nodesData = [
          { id: 'start', type: 'start', position: { x: 100, y: 100 }, data: { label: t('app.master-data.sop.flowStart') } },
          { id: 'end', type: 'end', position: { x: 400, y: 100 }, data: { label: t('app.master-data.sop.flowEnd') } },
        ];
        edgesData = [{ id: 'e-start-end', source: 'start', target: 'end', type: 'default' }];
      }
      
      const initialDataMap: Record<string, any> = {};
      nodesData.forEach((n: any) => {
        initialDataMap[n.id] = { ...n.data };
      });
      setNodeDataMap(initialDataMap);
      
      const normalizedEdges = edgesData.map((e: any, i: number) => ({
        ...e, id: e.id || `e-${e.source}-${e.target}-${i}`, type: 'default'
      }));
      setNodes(applyVerticalLayout(nodesData, normalizedEdges) as any);
      setEdges(normalizedEdges);
    } catch (err) {
      window.console.error('Failed to load SOP:', err);
      message.error(t('app.master-data.sop.loadFailed'));
    }
  }, [sopUuid, applyVerticalLayout, t, message, setNodes, setEdges]);

  useEffect(() => {
    const init = async () => {
      if (sopUuid) {
        await loadSOPData();
      }
    };
    init();
  }, [sopUuid, loadSOPData]);

  const handleSave = async () => {
    if (!sopUuid) return;
    setSaving(true);
    try {
      await sopApi.update(sopUuid, {
        flowConfig: { nodes, edges }
      } as SOPUpdate);
      message.success(t('common.saveSuccess'));
    } catch (e) {
      window.console.error('Save failed:', e);
      message.error(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadNodeAttachments = async () => {
      if (!selectedNode || (selectedNode.type !== 'step' && selectedNode.type !== 'check')) {
        setAttachmentFileList([]);
        return;
      }
      const uuids = toAttachmentUuids(nodeDataMap[selectedNode.id]?.attachments);
      if (!uuids.length) {
        setAttachmentFileList([]);
        return;
      }
      setAttachmentLoading(true);
      try {
        const files = await buildAttachmentFileList(uuids);
        if (!cancelled) setAttachmentFileList(files);
      } finally {
        if (!cancelled) setAttachmentLoading(false);
      }
    };
    loadNodeAttachments();
    return () => {
      cancelled = true;
    };
  }, [selectedNode?.id, selectedNode?.type, nodeDataMap, toAttachmentUuids, buildAttachmentFileList]);

  const handleUploadAttachment: UploadProps['customRequest'] = async (options) => {
    if (!selectedNode) return;
    const file = options.file as File;
    try {
      const uploaded = await uploadMultipleFiles([file], { category: 'sop-node-attachment' });
      const first = uploaded?.[0];
      if (!first?.uuid) throw new Error('upload failed');
      const fileItem: UploadFile = {
        uid: first.uuid,
        name: first.original_name || first.name || file.name,
        status: 'done',
      };
      setAttachmentFileList((prev) => [...prev, fileItem]);
      setNodeDataMap((prev) => {
        const current = prev[selectedNode.id] || {};
        const uuids = toAttachmentUuids(current.attachments);
        return {
          ...prev,
          [selectedNode.id]: {
            ...current,
            attachments: Array.from(new Set([...uuids, first.uuid])),
          },
        };
      });
      options.onSuccess?.(first);
    } catch (e: any) {
      options.onError?.(e);
      message.error(e?.message || t('app.master-data.sop.attachmentUploadFailed'));
    }
  };

  const addNextNode = useCallback((type: 'step' | 'check') => {
    if (!selectedNode) return;
    const newNodeId = `${type}-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type,
      position: { x: selectedNode.position.x, y: selectedNode.position.y + LAYOUT_GAP },
      data: { label: type === 'step' ? t('app.master-data.sop.newWorkStep') : t('app.master-data.sop.newInspectionStep'), description: '', keyPoints: '' },
    } as any;

    const newEdge = {
      id: `e-${selectedNode.id}-${newNodeId}`,
      source: selectedNode.id,
      target: newNodeId,
    };

    setNodes((nds) => {
      const existingEdges = edges.filter(e => e.source === selectedNode.id);
      if (existingEdges.length > 0) {
        // 插入模式：selected -> newNode -> firstTarget（其余分支保持不变）
        const firstEdge = existingEdges[0];
        const bridgeEdge = {
          id: `e-${newNodeId}-${firstEdge.target}`,
          source: newNodeId,
          target: firstEdge.target,
        };
        setEdges((eds) => {
          let removedFirst = false;
          const kept = eds.filter((e) => {
            if (!removedFirst && e.source === selectedNode.id && e.target === firstEdge.target) {
              removedFirst = true;
              return false;
            }
            return true;
          });
          return kept.concat([newEdge, bridgeEdge]);
        });
      } else {
        setEdges((eds) => addEdge(newEdge, eds));
      }
      return nds.concat(newNode);
    });
  }, [selectedNode, edges, setEdges, setNodes]);

  const deleteNode = useCallback(() => {
    if (!selectedNode || selectedNode.id === 'start' || selectedNode.id === 'end') return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => {
      const inEdges = eds.filter(e => e.target === selectedNode.id);
      const outEdges = eds.filter(e => e.source === selectedNode.id);
      if (inEdges.length > 0 && outEdges.length > 0) {
        const bridgeEdge: Edge = {
          id: `e-${inEdges[0].source}-${outEdges[0].target}`,
          source: inEdges[0].source,
          target: outEdges[0].target,
        };
        return eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id).concat(bridgeEdge);
      }
      return eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
    });
    setSelectedNode(null);
  }, [selectedNode, setEdges, setNodes]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const toolbar = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Space>
        <div style={{ marginRight: 16 }}>
          <AntdTypography.Text type="secondary" style={{ fontSize: 13 }}>{t('app.master-data.sop.selectedNode')}: </AntdTypography.Text>
          <AntdTypography.Text strong style={{ fontSize: 13 }}>{selectedNode ? (nodeDataMap[selectedNode.id]?.label || selectedNode.id) : t('common.none')}</AntdTypography.Text>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          disabled={!selectedNode || selectedNode.id === 'end'}
          onClick={() => addNextNode('step')}
        >
          {t('app.master-data.sop.addStep')}
        </Button>
        <Button 
          icon={<PlusOutlined />} 
          disabled={!selectedNode || selectedNode.id === 'end'}
          onClick={() => addNextNode('check')}
        >
          {t('app.master-data.sop.addCheck')}
        </Button>
        <Button 
          danger 
          icon={<DeleteOutlined />} 
          disabled={!selectedNode || selectedNode.id === 'start' || selectedNode.id === 'end'}
          onClick={deleteNode}
        >
          {t('common.delete')}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleAutoLayout}
        >
          {t('app.master-data.sop.autoLayout')}
        </Button>
      </Space>
      <Space>
        <Button icon={<CloseOutlined />} onClick={() => navigate('/apps/master-data/process/sop')}>{t('common.close')}</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>{t('common.save')}</Button>
      </Space>
    </div>
  );

  const canvas = (
    <div style={{ width: '100%', height: '100%', ...CANVAS_GRID_REACTFLOW.style }}>
      <ReactFlow
        nodes={nodes.map((n) => ({ 
          ...n, selected: selectedNode?.id === n.id, 
          data: { ...n.data, ...nodeDataMap[n.id] } 
        })) as any}
        edges={edges.map((e) => ({ 
          ...e, style: { shrink: 0, stroke: selectedEdge?.id === e.id ? token.colorPrimary : '#475569', strokeWidth: selectedEdge?.id === e.id ? 3 : 2 } 
        }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes as any}
        onNodeClick={(_, node) => {
          setSelectedNode(node); setSelectedEdge(null);
          nodeConfigForm.setFieldsValue({
            label: nodeDataMap[node.id]?.label || node.data?.label || '',
            description: nodeDataMap[node.id]?.description || node.data?.description || '',
            keyPoints: nodeDataMap[node.id]?.keyPoints || node.data?.keyPoints || '',
          });
          setFormSchema(nodeDataMap[node.id]?.formSchema || null);
        }}
        onEdgeClick={(_, edge) => { setSelectedEdge(edge); setSelectedNode(null); }}
        onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={CANVAS_GRID_REACTFLOW.variant as BackgroundVariant} 
          color={CANVAS_GRID_REACTFLOW.color} 
          gap={CANVAS_GRID_REACTFLOW.gap} 
          size={CANVAS_GRID_REACTFLOW.size} 
        />
      </ReactFlow>
    </div>
  );

  const rightPanel = selectedNode && (selectedNode.type === 'step' || selectedNode.type === 'check') ? {
    title: t('app.master-data.sop.stepConfig'),
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Form
          form={nodeConfigForm}
          layout="vertical"
          onValuesChange={(_, values) => {
            if (selectedNode) {
              const updatedData = { ...nodeDataMap[selectedNode.id], ...values };
              setNodeDataMap(prev => ({ ...prev, [selectedNode.id]: updatedData }));
              setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...values } } : n));
            }
          }}
        >
          <Form.Item name="label" label={<AntdTypography.Text type="secondary">{t('app.master-data.sop.nodeNameLabel')}</AntdTypography.Text>}>
            <Input placeholder={t('app.master-data.sop.nodeNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={<AntdTypography.Text type="secondary">{t('app.master-data.sop.nodeDescLabel')}</AntdTypography.Text>}>
            <Input.TextArea rows={3} placeholder={t('app.master-data.sop.nodeDescPlaceholder')} />
          </Form.Item>
          <Form.Item name="keyPoints" label={<AntdTypography.Text type="secondary">{t('app.master-data.sop.nodeKeyPointsLabel')}</AntdTypography.Text>}>
            <Input.TextArea rows={3} placeholder={t('app.master-data.sop.nodeKeyPointsPlaceholder')} />
          </Form.Item>
          <Form.Item label={<AntdTypography.Text type="secondary">{t('app.master-data.sop.nodeAttachmentLabel')}</AntdTypography.Text>}>
            <Dragger
              fileList={attachmentFileList}
              customRequest={handleUploadAttachment}
              multiple
              disabled={!selectedNode}
              showUploadList
              style={{ background: token.colorBgContainer }}
              beforeUpload={(file) => {
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                if (!SOP_NODE_ATTACHMENT_EXT.has(ext)) {
                  message.error(t('app.master-data.sop.nodeAttachmentTypeInvalid'));
                  return Upload.LIST_IGNORE;
                }
                return true;
              }}
              onRemove={(file) => {
                if (!selectedNode) return true;
                setAttachmentFileList((prev) => prev.filter((f) => f.uid !== file.uid));
                setNodeDataMap((prev) => {
                  const current = prev[selectedNode.id] || {};
                  const uuids = toAttachmentUuids(current.attachments).filter((u) => u !== String(file.uid));
                  return {
                    ...prev,
                    [selectedNode.id]: {
                      ...current,
                      attachments: uuids,
                    },
                  };
                });
                return true;
              }}
            >
              <div style={{ padding: '8px 0' }}>
                <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                  <InboxOutlined style={{ color: token.colorPrimary }} />
                </p>
                <p className="ant-upload-text" style={{ marginBottom: 6 }}>
                  {t('app.master-data.sop.addNodeAttachment')}
                </p>
                <p className="ant-upload-hint" style={{ marginBottom: 0 }}>
                  {t('app.master-data.sop.nodeAttachmentDropHint')}
                </p>
              </div>
            </Dragger>
            <div style={{ marginTop: 6, color: token.colorTextSecondary, fontSize: 12 }}>
              {t('app.master-data.sop.nodeAttachmentHint')}
            </div>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <FormSchemaEditor
            value={formSchema ?? undefined}
            onChange={(newSchema) => {
              setFormSchema(newSchema);
              if (selectedNode) {
                setNodeDataMap(prev => ({
                  ...prev,
                  [selectedNode.id]: {
                    ...prev[selectedNode.id],
                    formSchema: newSchema
                  }
                }));
              }
            }}
          />
        </div>
      </div>
    )
  } : undefined;

  return (
    <CanvasPageTemplate
      toolbar={toolbar}
      canvas={canvas}
      rightPanel={rightPanel}
      functionalTitle={t('app.master-data.sop.designerTitle')}
    />
  );
};

export default SOPDesignerPage;
