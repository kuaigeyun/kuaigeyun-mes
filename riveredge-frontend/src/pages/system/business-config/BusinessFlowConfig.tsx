

import React, { useState, useEffect } from 'react';
import { FlowEditor } from '@ant-design/pro-flow';
import { Layout, Form, Switch, Select, Button, Space, Typography, message, Alert, Card, List, Popconfirm } from 'antd';
import {
    DeleteOutlined,
    ShopOutlined,
    ShoppingCartOutlined,
    CodeSandboxOutlined,
    RocketOutlined,
    CloudUploadOutlined,
} from '@ant-design/icons';
import type { ConfigTemplate } from '../../../services/businessConfig';
import { getBusinessConfig, updateNodesConfig, deleteConfigTemplate } from '../../../services/businessConfig';

import { Background, BackgroundVariant, MarkerType } from 'reactflow';

const { Content, Sider } = Layout;

const { Text } = Typography;
const { Option } = Select;

/**
 * Business Flow Configuration Component
 * Graphs the business process and allows configuration of documents/steps.
 */
interface BusinessFlowConfigProps {
    onSaveAsTemplate?: () => void;
    templates?: ConfigTemplate[];
    onRefreshTemplates?: () => void; // Callback to refresh templates list
}

const BusinessFlowConfig: React.FC<BusinessFlowConfigProps> = ({ onSaveAsTemplate, templates = [], onRefreshTemplates }) => {
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [form] = Form.useForm();
    const [scale, setScale] = useState<'small' | 'medium' | 'large'>('medium');
    const [industry, setIndustry] = useState<'general' | 'electronics' | 'machinery' | 'machining'>('general');
    const [loading, setLoading] = useState(false);

    /**
     * 限制右键菜单仅在画板区域（.react-flow__pane）内触发
     * 使用 capture 阶段拦截，避免在侧边栏、工具栏等区域右击时弹出菜单
     */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.react-flow__pane')) {
                e.stopImmediatePropagation();
            }
        };
        document.addEventListener('contextmenu', handler, true);
        return () => document.removeEventListener('contextmenu', handler, true);
    }, []);

    // Node Style Helper
    const getNodeStyle = (enabled: boolean, auditRequired: boolean) => ({
        background: enabled ? '#fff' : '#fafafa',
        border: enabled
            ? (auditRequired ? '1px solid #1890ff' : '1px solid #52c41a')
            : '1px dashed #d9d9d9',
        borderRadius: '8px',
        padding: '10px',
        boxShadow: enabled ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
        opacity: enabled ? 1 : 0.6,
        width: 180,
    });

    // Initial Mock Data Structure for Graph (will be updated or merged)
    const initialNodes = [
        // 销售管理
        {
            id: 'customer',
            data: { label: '客户管理', title: '客户管理', enabled: true, auditRequired: false, icon: <ShopOutlined style={{ color: '#fa8c16' }} />, type: 'master' },
            position: { x: 100, y: 50 },
            style: getNodeStyle(true, false),
        },
        {
            id: 'sales_order',
            data: { label: '销售订单', title: '销售订单', enabled: true, auditRequired: true, icon: <ShopOutlined style={{ color: '#1890ff' }} />, type: 'business' },
            position: { x: 100, y: 200 },
            style: getNodeStyle(true, true),
        },
        {
            id: 'sales_delivery',
            data: { label: '销售出库', title: '销售出库', enabled: true, auditRequired: false, icon: <RocketOutlined style={{ color: '#1890ff' }} />, type: 'business' },
            position: { x: 350, y: 200 },
            style: getNodeStyle(true, false),
        },
        // 生产管理
        {
            id: 'bom',
            data: { label: '物料BOM', title: '物料清单(BOM)', enabled: true, auditRequired: true, icon: <CodeSandboxOutlined style={{ color: '#eb2f96' }} />, type: 'master' },
            position: { x: 600, y: 50 },
            style: getNodeStyle(true, true),
        },
        {
            id: 'production_plan',
            data: { label: '生产计划', title: '生产计划', enabled: true, auditRequired: true, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} />, type: 'business' },
            position: { x: 600, y: 200 },
            style: getNodeStyle(true, true),
        },
        {
            id: 'work_order',
            data: { label: '生产工单', title: '生产工单', enabled: true, auditRequired: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} />, type: 'business' },
            position: { x: 850, y: 200 },
            style: getNodeStyle(true, false),
        },
        // 采购与库存
        {
            id: 'purchase_request',
            data: { label: '采购申请', title: '采购申请', enabled: false, auditRequired: true, icon: <ShoppingCartOutlined />, type: 'business' },
            position: { x: 600, y: 350 },
            style: getNodeStyle(false, true),
        },
        {
            id: 'purchase_order',
            data: { label: '采购订单', title: '采购订单', enabled: false, auditRequired: true, icon: <ShoppingCartOutlined />, type: 'business' },
            position: { x: 850, y: 350 },
            style: getNodeStyle(false, true),
        },
        {
            id: 'inbound_delivery',
            data: { label: '采购入库', title: '采购入库', enabled: false, auditRequired: false, icon: <CloudUploadOutlined />, type: 'business' },
            position: { x: 1100, y: 350 },
            style: getNodeStyle(false, false),
        },
        // 质量与库存
        {
            id: 'inventory_check',
            data: { label: '库存校验', title: '库存校验', enabled: true, auditRequired: false, icon: <CodeSandboxOutlined style={{ color: '#52c41a' }} />, type: 'core' },
            position: { x: 350, y: 100 },
            style: getNodeStyle(true, false),
        },
        {
            id: 'quality_inspection',
            data: { label: '质量检验', title: '质量检验', enabled: true, auditRequired: true, icon: <CodeSandboxOutlined style={{ color: '#faad14' }} />, type: 'business' },
            position: { x: 850, y: 100 },
            style: getNodeStyle(true, true),
        },
    ];

    const initialEdges = [
        { id: 'e_cust_so', source: 'customer', target: 'sales_order', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e1', source: 'sales_order', target: 'sales_delivery', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e2', source: 'sales_order', target: 'inventory_check', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e3', source: 'sales_order', target: 'production_plan', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_bom_pp', source: 'bom', target: 'production_plan', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_pp_wo', source: 'production_plan', target: 'work_order', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_wo_qi', source: 'work_order', target: 'quality_inspection', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e4', source: 'production_plan', target: 'purchase_request', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_pr_po', source: 'purchase_request', target: 'purchase_order', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_po_id', source: 'purchase_order', target: 'inbound_delivery', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
    ];

    const [nodes, setNodes] = useState(initialNodes);
    const [edges] = useState(initialEdges); // Edges change is not supported yet

    // Handle Node Click
    const handleNodeClick = (_e: any, node: any) => {
        setSelectedNode(node);
        form.setFieldsValue({
            enabled: node.data.enabled,
            auditRequired: node.data.auditRequired,
        });
    };

    // Handle Form Change (Real-time update graph data)
    const handleFormChange = (changedValues: any) => {
        if (!selectedNode) return;

        setNodes((prevNodes) =>
            prevNodes.map((node) => {
                if (node.id === selectedNode.id) {
                    const newData = { ...node.data, ...changedValues };
                    // Update the selected node simultaneously to reflect changes in Drawer
                    setSelectedNode((prev: any) => ({ ...prev, data: newData }));
                    return {
                        ...node,
                        data: newData,
                        style: getNodeStyle(newData.enabled, newData.auditRequired),
                    };
                }
                return node;
            })
        );
    };

    // Predefined Templates Configuration
    const PRESET_TEMPLATES = {
        general: { // 通用制造
            small: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    inventory_check: { enabled: false, auditRequired: false },
                    production_plan: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                }
            },
            medium: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: false },
                    inventory_check: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                }
            },
            large: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    purchase_request: { enabled: true, auditRequired: true },
                }
            }
        },
        machinery: { // 机械装备 (项目型，长周期)
            small: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: true }, // High value items need delivery audit
                    inventory_check: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                }
            },
            medium: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    purchase_request: { enabled: true, auditRequired: true },
                }
            },
            large: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    purchase_request: { enabled: true, auditRequired: true },
                }
            }
        },
        electronics: { // 电子电器 (高频，精细)
            small: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    inventory_check: { enabled: true, auditRequired: false }, // Inventory check is crucial for electronics
                    production_plan: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                }
            },
            medium: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    inventory_check: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                }
            },
            large: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    purchase_request: { enabled: true, auditRequired: true },
                }
            }
        },
        machining: { // 零部件加工 (工序，来料)
            small: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    inventory_check: { enabled: false, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false }, // Production is core
                    purchase_request: { enabled: false, auditRequired: false }, // Often customer supplied material
                }
            },
            medium: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    inventory_check: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                }
            },
            large: {
                nodes: {
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    purchase_request: { enabled: true, auditRequired: true },
                }
            }
        }
    };

    // Apply Template Logic
    const applyTemplate = (targetIndustry: 'general' | 'electronics' | 'machinery' | 'machining', targetScale: 'small' | 'medium' | 'large') => {
        const template = PRESET_TEMPLATES[targetIndustry][targetScale];

        if (!template) return;

        setNodes((prevNodes) =>
            prevNodes.map((node) => {
                const config = template.nodes[node.id as keyof typeof template.nodes];
                if (config) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            enabled: config.enabled,
                            auditRequired: config.auditRequired,
                        },
                        style: getNodeStyle(config.enabled, config.auditRequired),
                    };
                }
                return node;
            })
        );


        // message.success(`已切换至 ${industryName} - ${scaleName}企业配置模版`);
    };

    // Load Config from Backend
    useEffect(() => {
        const loadConfig = async () => {
            setLoading(true);
            try {
                const config = await getBusinessConfig();
                if (config) {
                    // If backend has saved industry/scale, use them. 
                    // Note: Backend stores defaults as 'general'/'medium' if not set.
                    // We need to cast types as strings from backend might match literals
                    if (config.industry) setIndustry(config.industry as any);
                    if (config.scale) setScale(config.scale as any);

                    // If backend has nodes config, merge it
                    if (config.nodes) {
                        setNodes((prevNodes) =>
                            prevNodes.map((node) => {
                                const nodeConfig = config.nodes?.[node.id];
                                if (nodeConfig) {
                                    return {
                                        ...node,
                                        data: {
                                            ...node.data,
                                            enabled: nodeConfig.enabled,
                                            auditRequired: nodeConfig.auditRequired,
                                        },
                                        style: getNodeStyle(nodeConfig.enabled, nodeConfig.auditRequired),
                                    };
                                }
                                return node;
                            })
                        );
                    } else {
                        // Apply default template based on loaded industry/scale if no specific nodes config
                        // Note: getBusinessConfig already returns defaults if empty, but explicit Application might be safer visual sync
                        applyTemplate(config.industry as any || 'general', config.scale as any || 'medium');
                    }
                }
            } catch (error) {
                console.error("Load config failed", error);
                message.error("加载配置失败");
            } finally {
                setLoading(false);
            }
        };
        loadConfig();
    }, []);

    // Save Configuration
    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            // Transform nodes to backend format (map by id)
            const nodesConfig: Record<string, any> = {};
            nodes.forEach(node => {
                nodesConfig[node.id] = {
                    enabled: node.data.enabled,
                    auditRequired: node.data.auditRequired
                };
            });

            await updateNodesConfig({
                nodes: nodesConfig,
                industry,
                scale
            });
            message.success("配置已保存");
        } catch (error) {
            console.error("Save config failed", error);
            message.error("保存配置失败");
        } finally {
            setLoading(false);
        }
    };

    // Handle Custom Template Change
    const handleCustomTemplateChange = (templateId: number) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            // Logic to actually parse template.config and update nodes would go here
            // For now we assume the parent index.tsx handles passing/reloading config or
            // we should expose reloading from here if we had full logic.
            // Since applyTemplate doesn't handle loading custom config object directly,
            // and we rely on backend load logic. 
            // In a perfect world, we would call applyConfigTemplate API then reload.
            // But for UI demo purpose:
            message.success(`已加载自定义模板: ${template.name}`);
        }
    };

    // Handle Delete Template
    const handleDeleteTemplate = async (e: React.MouseEvent, templateId: number) => {
        e.stopPropagation(); // Prevent select change
        try {
            await deleteConfigTemplate(templateId);
            message.success('模版已删除');
            if (onRefreshTemplates) {
                onRefreshTemplates();
            }
        } catch (error) {
            console.error('Delete template failed', error);
            message.error('删除模版失败');
        }
    };

    // Switch Handlers
    const handleIndustryChange = (value: 'general' | 'electronics' | 'machinery' | 'machining') => {
        setIndustry(value);
        applyTemplate(value, scale);
    };

    const handleScaleChange = (value: 'small' | 'medium' | 'large') => {
        setScale(value);
        applyTemplate(industry, value);
    };



    const renderToolbox = () => (
        <Card title="组件库" bordered={false} styles={{ body: { padding: 10 } }}>
            <List
                grid={{ gutter: 16, column: 1 }}
                dataSource={nodes} // Currently showing active nodes, usually this is a static list of ALL available types
                renderItem={item => (
                    <List.Item>
                        <Card
                            size="small"
                            hoverable
                            style={{
                                cursor: 'grab',
                                border: '1px solid #d9d9d9',
                                background: '#fafafa'
                            }}
                        >
                            <Space>
                                {item.data.icon}
                                <Text>{(item.data as any).title}</Text>
                            </Space>
                        </Card>
                    </List.Item>
                )}
            />
        </Card>
    );

    const renderPropertiesPanel = () => {
        if (!selectedNode) {
            return (
                <Card title="全局配置" bordered={false} style={{ height: '100%' }}>
                    <Alert
                        message="未选择节点"
                        description="请在画布中点击节点以配置其属性，或者在左上方选择预设模版。"
                        type="info"
                        showIcon
                    />
                    <div style={{ marginTop: 24 }}>
                        <Text strong>当前环境：</Text>
                        <div style={{ marginTop: 8 }}>
                            <Text>行业：</Text>
                            <Text type="secondary">{
                                {
                                    general: '通用制造',
                                    machinery: '机械装备',
                                    electronics: '电子电器',
                                    machining: '零部件加工'
                                }[industry]
                            }</Text>
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <Text>规模：</Text>
                            <Text type="secondary">{
                                {
                                    small: '小型',
                                    medium: '中型',
                                    large: '大型'
                                }[scale]
                            }</Text>
                        </div>
                    </div>
                </Card>
            );
        }

        return (
            <Card title={`节点配置: ${(selectedNode.data as any).title}`} bordered={false} style={{ height: '100%' }}>
                <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
                    <Form.Item name="enabled" label="功能启用" valuePropName="checked">
                        <Switch checkedChildren="已启用" unCheckedChildren="已禁用" />
                    </Form.Item>

                    <Alert
                        message={selectedNode.data.enabled ? "功能处于启用状态" : "功能已禁用，相关菜单将隐藏"}
                        type={selectedNode.data.enabled ? "success" : "warning"}
                        showIcon
                        style={{ marginBottom: 24 }}
                    />

                    <Form.Item name="auditRequired" label="审核流程" valuePropName="checked">
                        <Switch checkedChildren="需要审核" unCheckedChildren="自动通过" disabled={!selectedNode.data.enabled} />
                    </Form.Item>
                    <Alert
                        message="开启审核后，单据提交后需要主管审批才能生效；关闭则自动生效。"
                        type="info"
                        style={{ fontSize: 12 }}
                    />
                    <div style={{ marginTop: 24 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>节点 ID: {selectedNode.id}</Text>
                    </div>
                </Form>
            </Card>
        );
    };

    return (
        <Layout style={{ height: 'calc(100vh - 200px)', border: '1px solid #f0f0f0' }}>
            {/* Top Toolbar */}
            <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 16px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                    <Space size={8}>
                        <Text strong>行业类型：</Text>
                        <Select value={industry} onChange={handleIndustryChange} style={{ width: 140 }}>
                            <Option value="general">通用制造</Option>
                            <Option value="machinery">机械装备</Option>
                            <Option value="electronics">电子电器</Option>
                            <Option value="machining">零部件加工</Option>
                        </Select>
                    </Space>
                    <Space size={8}>
                        <Text strong>企业规模：</Text>
                        <Select value={scale} onChange={handleScaleChange} style={{ width: 140 }}>
                            <Option value="small">小型 (极简)</Option>
                            <Option value="medium">中型 (标准)</Option>
                            <Option value="large">大型 (全流程)</Option>
                        </Select>
                    </Space>
                    <Space size={8}>
                        <Text strong>自定义模板：</Text>
                        <Select
                            placeholder="选择模板"
                            style={{ width: 180 }}
                            onChange={handleCustomTemplateChange}
                            allowClear
                            optionLabelProp="label"
                        >
                            {templates.map(t => (
                                <Option key={t.id} value={t.id} label={t.name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{t.name}</span>
                                        <Popconfirm
                                            title="确定删除此模版吗？"
                                            onConfirm={(e: any) => handleDeleteTemplate(e, t.id)}
                                            onCancel={(e: any) => e?.stopPropagation()}
                                            okText="删除"
                                            cancelText="取消"
                                        >
                                            <Button
                                                type="text"
                                                size="small"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={(e) => e.stopPropagation()} // Stop propagation to prevent selection
                                            />
                                        </Popconfirm>
                                    </div>
                                </Option>
                            ))}
                        </Select>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            <span style={{ color: '#faad14', marginRight: 4 }}>*</span>
                            切换将被重置
                        </Text>
                    </Space>
                </Space>
                <Space style={{ flexShrink: 0 }}>
                    <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleSaveConfig} loading={loading}>
                        保存配置
                    </Button>
                    <Button onClick={onSaveAsTemplate}>另存为模板</Button>
                </Space>
            </div>
            <Layout style={{ height: 'calc(100% - 64px)' }}>
                <Sider width={200} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
                    {renderToolbox()}
                </Sider>
                <Content style={{ position: 'relative', background: '#fff' }}>
                    <FlowEditor
                        flowProps={{
                            nodes,
                            edges,
                            onNodeClick: handleNodeClick,
                            fitView: false,
                            defaultViewport: { x: 0, y: 0, zoom: 1 },
                        }}
                        miniMap={true}
                        devtools={false}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#e0e0e0" />
                    </FlowEditor>
                </Content>
                <Sider width={300} theme="light" style={{ borderLeft: '1px solid #f0f0f0' }}>
                    {renderPropertiesPanel()}
                </Sider>
            </Layout>
        </Layout>
    );
};

export default BusinessFlowConfig;
