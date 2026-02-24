import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FlowEditor } from '@ant-design/pro-flow';
import { Layout, Form, Switch, Select, Button, Space, Typography, message, Alert, Card, Popconfirm, theme } from 'antd';
import {
    DeleteOutlined,
    ShopOutlined,
    ShoppingCartOutlined,
    CodeSandboxOutlined,
    RocketOutlined,
    CloudUploadOutlined,
    LineChartOutlined,
    FileTextOutlined,
    ToolOutlined,
    WalletOutlined,
    InboxOutlined,
} from '@ant-design/icons';
import type { ConfigTemplate, ComplexityPreset } from '../../../services/businessConfig';
import { getBusinessConfig, updateNodesConfig, deleteConfigTemplate, getComplexityPresets, applyComplexityPreset, applyConfigTemplate } from '../../../services/businessConfig';
import { useThemeStore } from '../../../stores/themeStore';

import { Background, BackgroundVariant, MarkerType } from 'reactflow';
import { CANVAS_GRID_REACTFLOW } from '../../../components/layout-templates';

const { Content, Sider } = Layout;

const { Text } = Typography;
const { useToken } = theme;
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
    const { t } = useTranslation();
    const { token } = useToken();
    const queryClient = useQueryClient();
    const isDark = useThemeStore((s) => s.resolved.isDark);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [form] = Form.useForm();
    const [scale, setScale] = useState<'small' | 'medium' | 'large'>('medium');
    const [industry, setIndustry] = useState<'general' | 'electronics' | 'machinery' | 'machining'>('general');
    const [loading, setLoading] = useState(false);
    const [complexityPresets, setComplexityPresets] = useState<ComplexityPreset[]>([]);
    const [complexityLevel, setComplexityLevel] = useState<string | null>(null);

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

    // Node Style Helper（深色模式下使用适配 token，减少白底强对比、提升连线可见度）
    const getNodeStyle = React.useCallback((enabled: boolean, auditRequired: boolean) => {
        if (isDark) {
            return {
                background: enabled ? token.colorBgContainer : token.colorFillQuaternary,
                border: enabled
                    ? (auditRequired ? `1px solid ${token.colorPrimary}` : `1px solid ${token.colorSuccess}`)
                    : `1px dashed ${token.colorBorder}`,
                borderRadius: '8px',
                padding: '8px',
                boxShadow: enabled ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                opacity: enabled ? 1 : 0.6,
                width: 120,
                color: token.colorText,
            };
        }
        return {
            background: enabled ? '#fff' : '#fafafa',
            border: enabled
                ? (auditRequired ? '1px solid #1890ff' : '1px solid #52c41a')
                : '1px dashed #d9d9d9',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: enabled ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
            opacity: enabled ? 1 : 0.6,
            width: 120,
        };
    }, [isDark, token]);

    // 后端约定的节点白名单（30 节点，与 business_config_service.ALL_NODES 对齐）
    const BACKEND_NODE_IDS = [
        'quotation', 'sample_trial', 'sales_forecast', 'sales_order', 'sales_delivery', 'shipment_notice', 'delivery_notice',
        'purchase_request', 'purchase_order', 'receipt_notice', 'inbound_delivery',
        'production_plan', 'work_order', 'rework_order', 'outsource_order',
        'quality_inspection', 'inventory_check',
        'equipment_fault', 'maintenance_plan', 'maintenance_reminder', 'equipment_status',
        'inbound', 'outbound', 'stocktaking', 'inventory_transfer', 'assembly_order', 'disassembly_order',
        'receivable', 'payable', 'invoice',
    ];

    const getNodeLabel = (id: string) => t(`pages.system.businessConfig.node.${id}`);
    // 布局：销售→计划→采购→生产→仓储（主线），质量/设备/财务（支线）；步长 150
    const nodeDefs: Array<{ id: string; x: number; y: number; enabled: boolean; audit: boolean; icon: React.ReactNode }> = [
        { id: 'quotation', x: 0, y: 0, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sample_trial', x: 150, y: 0, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_forecast', x: 75, y: 90, enabled: true, audit: false, icon: <LineChartOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_order', x: 75, y: 180, enabled: true, audit: false, icon: <ShopOutlined style={{ color: '#1890ff' }} /> },
        { id: 'shipment_notice', x: 75, y: 255, enabled: true, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_delivery', x: 75, y: 330, enabled: true, audit: false, icon: <RocketOutlined style={{ color: '#1890ff' }} /> },
        { id: 'delivery_notice', x: 75, y: 405, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'production_plan', x: 300, y: 180, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'inventory_check', x: 300, y: 90, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#52c41a' }} /> },
        { id: 'purchase_request', x: 500, y: 90, enabled: true, audit: false, icon: <ShoppingCartOutlined /> },
        { id: 'purchase_order', x: 500, y: 180, enabled: true, audit: false, icon: <ShoppingCartOutlined /> },
        { id: 'receipt_notice', x: 500, y: 270, enabled: true, audit: false, icon: <FileTextOutlined /> },
        { id: 'inbound_delivery', x: 500, y: 360, enabled: true, audit: false, icon: <CloudUploadOutlined /> },
        { id: 'work_order', x: 700, y: 180, enabled: true, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'rework_order', x: 700, y: 270, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'outsource_order', x: 700, y: 360, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'quality_inspection', x: 700, y: 90, enabled: true, audit: false, icon: <CodeSandboxOutlined style={{ color: '#faad14' }} /> },
        { id: 'inbound', x: 900, y: 0, enabled: true, audit: false, icon: <InboxOutlined /> },
        { id: 'outbound', x: 900, y: 90, enabled: true, audit: false, icon: <InboxOutlined /> },
        { id: 'stocktaking', x: 900, y: 180, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'inventory_transfer', x: 900, y: 270, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'assembly_order', x: 900, y: 360, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'disassembly_order', x: 900, y: 450, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'equipment_fault', x: 0, y: 520, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'maintenance_plan', x: 150, y: 520, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'maintenance_reminder', x: 300, y: 520, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'equipment_status', x: 450, y: 520, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'receivable', x: 0, y: 620, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'payable', x: 150, y: 620, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'invoice', x: 300, y: 620, enabled: false, audit: false, icon: <WalletOutlined /> },
    ];
    const initialNodes = useMemo(() => nodeDefs.map((n) => {
        const label = getNodeLabel(n.id);
        return {
            id: n.id,
            data: { label, title: label, enabled: n.enabled, auditRequired: n.audit, icon: n.icon, type: 'business' as const },
            position: { x: n.x, y: n.y },
            style: getNodeStyle(n.enabled, n.audit),
        };
    }), [t, getNodeStyle]);

    // pathOptions.offset 用于分散汇聚到同一节点的连线，减少重叠
    const baseEdges = [
        { id: 'e_q_so', source: 'quotation', target: 'sales_order', type: 'smoothstep' as const, pathOptions: { offset: -12 }, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_st_so', source: 'sample_trial', target: 'sales_order', type: 'smoothstep' as const, pathOptions: { offset: 12 }, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_sf_so', source: 'sales_forecast', target: 'sales_order', type: 'smoothstep' as const, pathOptions: { offset: 0 }, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_so_sn', source: 'sales_order', target: 'shipment_notice', type: 'smoothstep' as const, pathOptions: { offset: -10 }, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_sn_sd', source: 'shipment_notice', target: 'sales_delivery', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_sd_dn', source: 'sales_delivery', target: 'delivery_notice', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e2', source: 'sales_order', target: 'inventory_check', type: 'smoothstep' as const, pathOptions: { offset: 0 }, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e3', source: 'sales_order', target: 'production_plan', type: 'smoothstep' as const, pathOptions: { offset: 10 }, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_pp_wo', source: 'production_plan', target: 'work_order', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_wo_qi', source: 'work_order', target: 'quality_inspection', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e4', source: 'production_plan', target: 'purchase_request', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_pr_po', source: 'purchase_request', target: 'purchase_order', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_po_rn', source: 'purchase_order', target: 'receipt_notice', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e_rn_id', source: 'receipt_notice', target: 'inbound_delivery', type: 'smoothstep' as const, markerEnd: { type: MarkerType.ArrowClosed } },
    ];

    const edges = useMemo(() => {
        if (isDark) {
            return baseEdges.map((e) => ({ ...e, style: { stroke: token.colorTextSecondary } }));
        }
        return baseEdges;
    }, [isDark, token.colorTextSecondary]);

    const [nodes, setNodes] = useState(initialNodes);

    // 主题切换时重新应用节点样式
    useEffect(() => {
        setNodes((prev) =>
            prev.map((n) => ({
                ...n,
                style: getNodeStyle(n.data.enabled, n.data.auditRequired),
            }))
        );
    }, [getNodeStyle]);

    // 语言切换时更新节点标签
    useEffect(() => {
        setNodes((prev) =>
            prev.map((n) => ({
                ...n,
                data: {
                    ...n.data,
                    label: getNodeLabel(n.id),
                    title: getNodeLabel(n.id),
                },
            }))
        );
    }, [t]);

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

    // 28 节点预置模版（与 business_config_service.ALL_NODES 对齐）
    const PRESET_TEMPLATES = {
        general: { // 通用制造
            small: {
                nodes: {
                    quotation: { enabled: false, auditRequired: false },
                    sample_trial: { enabled: false, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: false },
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                    purchase_order: { enabled: true, auditRequired: false },
                    receipt_notice: { enabled: true, auditRequired: false },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: false, auditRequired: false },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: false, auditRequired: false },
                    outsource_order: { enabled: false, auditRequired: false },
                    quality_inspection: { enabled: false, auditRequired: false },
                    inventory_check: { enabled: false, auditRequired: false },
                    equipment_fault: { enabled: false, auditRequired: false },
                    maintenance_plan: { enabled: false, auditRequired: false },
                    maintenance_reminder: { enabled: false, auditRequired: false },
                    equipment_status: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: false, auditRequired: false },
                    inventory_transfer: { enabled: false, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            medium: {
                nodes: {
                    quotation: { enabled: true, auditRequired: false },
                    sample_trial: { enabled: false, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: true },
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: false },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: false },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: false },
                    outsource_order: { enabled: true, auditRequired: false },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: false },
                    equipment_fault: { enabled: true, auditRequired: false },
                    maintenance_plan: { enabled: true, auditRequired: false },
                    maintenance_reminder: { enabled: true, auditRequired: false },
                    equipment_status: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            large: {
                nodes: {
                    quotation: { enabled: true, auditRequired: true },
                    sample_trial: { enabled: true, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: true },
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: true },
                    inbound_delivery: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: true },
                    outsource_order: { enabled: true, auditRequired: true },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    equipment_fault: { enabled: true, auditRequired: true },
                    maintenance_plan: { enabled: true, auditRequired: true },
                    maintenance_reminder: { enabled: true, auditRequired: false },
                    equipment_status: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
                }
            }
        },
        machinery: { // 机械装备 (项目型，长周期)
            small: {
                nodes: {
                    quotation: { enabled: true, auditRequired: false },
                    sample_trial: { enabled: false, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: false },
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: true },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: false },
                    inbound_delivery: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: false },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: false },
                    outsource_order: { enabled: true, auditRequired: false },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: false },
                    equipment_fault: { enabled: true, auditRequired: false },
                    maintenance_plan: { enabled: true, auditRequired: false },
                    maintenance_reminder: { enabled: true, auditRequired: false },
                    equipment_status: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: false, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            medium: {
                nodes: {
                    quotation: { enabled: true, auditRequired: true },
                    sample_trial: { enabled: true, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: true },
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: true },
                    inbound_delivery: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: true },
                    outsource_order: { enabled: true, auditRequired: true },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    equipment_fault: { enabled: true, auditRequired: true },
                    maintenance_plan: { enabled: true, auditRequired: true },
                    maintenance_reminder: { enabled: true, auditRequired: false },
                    equipment_status: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            large: {
                nodes: {
                    quotation: { enabled: true, auditRequired: true },
                    sample_trial: { enabled: true, auditRequired: true },
                    sales_forecast: { enabled: true, auditRequired: true },
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: true },
                    inbound_delivery: { enabled: true, auditRequired: true },
                    production_plan: { enabled: true, auditRequired: true },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: true },
                    outsource_order: { enabled: true, auditRequired: true },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    equipment_fault: { enabled: true, auditRequired: true },
                    maintenance_plan: { enabled: true, auditRequired: true },
                    maintenance_reminder: { enabled: true, auditRequired: true },
                    equipment_status: { enabled: true, auditRequired: true },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: true },
                    disassembly_order: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
                }
            }
        },
        electronics: { // 电子电器 (高频，精细)
            small: {
                nodes: {
                    quotation: { enabled: false, auditRequired: false },
                    sample_trial: { enabled: true, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: false },
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                    purchase_order: { enabled: true, auditRequired: false },
                    receipt_notice: { enabled: true, auditRequired: false },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: false, auditRequired: false },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: false },
                    outsource_order: { enabled: true, auditRequired: false },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: false },
                    equipment_fault: { enabled: false, auditRequired: false },
                    maintenance_plan: { enabled: false, auditRequired: false },
                    maintenance_reminder: { enabled: false, auditRequired: false },
                    equipment_status: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            medium: {
                nodes: {
                    quotation: { enabled: true, auditRequired: false },
                    sample_trial: { enabled: true, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: false },
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: false },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: false },
                    outsource_order: { enabled: true, auditRequired: false },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    equipment_fault: { enabled: true, auditRequired: false },
                    maintenance_plan: { enabled: true, auditRequired: false },
                    maintenance_reminder: { enabled: true, auditRequired: false },
                    equipment_status: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            large: {
                nodes: {
                    quotation: { enabled: true, auditRequired: true },
                    sample_trial: { enabled: true, auditRequired: true },
                    sales_forecast: { enabled: true, auditRequired: true },
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: true },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: true },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: true },
                    outsource_order: { enabled: true, auditRequired: true },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    equipment_fault: { enabled: true, auditRequired: true },
                    maintenance_plan: { enabled: true, auditRequired: true },
                    maintenance_reminder: { enabled: true, auditRequired: false },
                    equipment_status: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
                }
            }
        },
        machining: { // 零部件加工 (工序，来料)
            small: {
                nodes: {
                    quotation: { enabled: false, auditRequired: false },
                    sample_trial: { enabled: false, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: false },
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: false, auditRequired: false },
                    purchase_order: { enabled: true, auditRequired: false },
                    receipt_notice: { enabled: true, auditRequired: false },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: false },
                    outsource_order: { enabled: true, auditRequired: false },
                    quality_inspection: { enabled: false, auditRequired: false },
                    inventory_check: { enabled: false, auditRequired: false },
                    equipment_fault: { enabled: false, auditRequired: false },
                    maintenance_plan: { enabled: false, auditRequired: false },
                    maintenance_reminder: { enabled: false, auditRequired: false },
                    equipment_status: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: false, auditRequired: false },
                    inventory_transfer: { enabled: false, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            medium: {
                nodes: {
                    quotation: { enabled: true, auditRequired: false },
                    sample_trial: { enabled: false, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: false },
                    sales_order: { enabled: true, auditRequired: false },
                    sales_delivery: { enabled: true, auditRequired: false },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: false, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: false },
                    purchase_order: { enabled: true, auditRequired: false },
                    receipt_notice: { enabled: true, auditRequired: false },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: false },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: false },
                    outsource_order: { enabled: true, auditRequired: false },
                    quality_inspection: { enabled: true, auditRequired: false },
                    inventory_check: { enabled: true, auditRequired: false },
                    equipment_fault: { enabled: true, auditRequired: false },
                    maintenance_plan: { enabled: true, auditRequired: false },
                    maintenance_reminder: { enabled: false, auditRequired: false },
                    equipment_status: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                }
            },
            large: {
                nodes: {
                    quotation: { enabled: true, auditRequired: true },
                    sample_trial: { enabled: true, auditRequired: false },
                    sales_forecast: { enabled: true, auditRequired: true },
                    sales_order: { enabled: true, auditRequired: true },
                    sales_delivery: { enabled: true, auditRequired: true },
                    shipment_notice: { enabled: true, auditRequired: false },
                    delivery_notice: { enabled: true, auditRequired: false },
                    purchase_request: { enabled: true, auditRequired: true },
                    purchase_order: { enabled: true, auditRequired: true },
                    receipt_notice: { enabled: true, auditRequired: true },
                    inbound_delivery: { enabled: true, auditRequired: false },
                    production_plan: { enabled: true, auditRequired: true },
                    work_order: { enabled: true, auditRequired: false },
                    rework_order: { enabled: true, auditRequired: true },
                    outsource_order: { enabled: true, auditRequired: true },
                    quality_inspection: { enabled: true, auditRequired: true },
                    inventory_check: { enabled: true, auditRequired: true },
                    equipment_fault: { enabled: true, auditRequired: true },
                    maintenance_plan: { enabled: true, auditRequired: true },
                    maintenance_reminder: { enabled: true, auditRequired: false },
                    equipment_status: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
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

    // Fetch complexity presets
    useEffect(() => {
        getComplexityPresets().then((res) => {
            setComplexityPresets(res.presets || []);
        }).catch(() => {});
    }, []);

    // Load Config from Backend
    useEffect(() => {
        const loadConfig = async () => {
            setLoading(true);
            try {
                const config = await getBusinessConfig();
                if (config) {
                    if (config.complexity_level) setComplexityLevel(config.complexity_level);
                    if (config.industry) setIndustry(config.industry as any);
                    if (config.scale) setScale(config.scale as any);

                    if (config.nodes && Object.keys(config.nodes).length > 0) {
                        setNodes((prevNodes) => {
                            const nodeIds = new Set(prevNodes.map((n) => n.id));
                            const updated = prevNodes.map((node) => {
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
                            });
                            // 合并后端多出的节点（避免 config 中有而前端无的节点丢失）
                            Object.entries(config.nodes).forEach(([id, nodeConfig]) => {
                                if (!nodeIds.has(id) && nodeConfig && typeof nodeConfig === 'object') {
                                    const enabled = (nodeConfig as any).enabled ?? true;
                                    const auditRequired = (nodeConfig as any).auditRequired ?? false;
                                    const label = t(`pages.system.businessConfig.node.${id}`);
                                    updated.push({
                                        id,
                                        data: {
                                            label: label || id,
                                            title: label || id,
                                            enabled,
                                            auditRequired,
                                            icon: <CodeSandboxOutlined style={{ color: '#1890ff' }} />,
                                            type: 'business',
                                        },
                                        position: { x: 100, y: 400 + updated.length * 60 },
                                        style: getNodeStyle(enabled, auditRequired),
                                    });
                                    nodeIds.add(id);
                                }
                            });
                            return updated;
                        });
                    } else {
                        applyTemplate(config.industry as any || 'general', config.scale as any || 'medium');
                    }
                }
            } catch (error) {
                console.error("Load config failed", error);
                message.error(t('pages.system.businessConfig.blueprint.loadFailed'));
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
            // 仅保存后端约定的节点，避免写入无效节点
            const nodesConfig: Record<string, any> = {};
            nodes.forEach(node => {
                if (BACKEND_NODE_IDS.includes(node.id)) {
                    nodesConfig[node.id] = {
                        enabled: node.data.enabled,
                        auditRequired: node.data.auditRequired
                    };
                }
            });

            await updateNodesConfig({
                nodes: nodesConfig,
                industry,
                scale
            });
            message.success(t('pages.system.businessConfig.blueprint.saveSuccess'));
            queryClient.invalidateQueries({ queryKey: ['businessConfig'] });
        } catch (error) {
            console.error("Save config failed", error);
            message.error(t('pages.system.businessConfig.blueprint.saveFailed'));
        } finally {
            setLoading(false);
        }
    };

    // Handle Custom Template Change
    const handleCustomTemplateChange = async (templateId: number | undefined) => {
        if (!templateId) return;
        const template = templates.find(t => t.id === templateId);
        if (!template) return;
        setLoading(true);
        try {
            const result = await applyConfigTemplate({ template_id: templateId });
            if (result.template?.config?.nodes) {
                const configNodes = result.template.config.nodes;
                setNodes((prevNodes) => {
                    const nodeIds = new Set(prevNodes.map((n) => n.id));
                    const updated = prevNodes.map((node) => {
                        const nodeConfig = configNodes[node.id];
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
                    });
                    Object.entries(configNodes).forEach(([id, nodeConfig]) => {
                        if (!nodeIds.has(id) && nodeConfig && typeof nodeConfig === 'object') {
                            const enabled = (nodeConfig as any).enabled ?? true;
                            const auditRequired = (nodeConfig as any).auditRequired ?? false;
                            const label = t(`pages.system.businessConfig.node.${id}`);
                            updated.push({
                                id,
                                data: {
                                    label: label || id,
                                    title: label || id,
                                    enabled,
                                    auditRequired,
                                    icon: <CodeSandboxOutlined style={{ color: '#1890ff' }} />,
                                    type: 'business',
                                },
                                position: { x: 100, y: 400 + updated.length * 60 },
                                style: getNodeStyle(enabled, auditRequired),
                            });
                            nodeIds.add(id);
                        }
                    });
                    return updated;
                });
            }
            message.success(result.message || t('pages.system.businessConfig.blueprint.templateLoaded', { name: template.name }));
            queryClient.invalidateQueries({ queryKey: ['businessConfig'] });
            if (onRefreshTemplates) onRefreshTemplates();
        } catch (error: any) {
            message.error(error?.message || t('pages.system.businessConfig.blueprint.applyTemplateFailed'));
        } finally {
            setLoading(false);
        }
    };

    // Handle Delete Template
    const handleDeleteTemplate = async (e: React.MouseEvent, templateId: number) => {
        e.stopPropagation(); // Prevent select change
        try {
            await deleteConfigTemplate(templateId);
            message.success(t('pages.system.businessConfig.blueprint.templateDeleted'));
            if (onRefreshTemplates) {
                onRefreshTemplates();
            }
        } catch (error) {
            console.error('Delete template failed', error);
            message.error(t('pages.system.businessConfig.blueprint.templateDeleteFailed'));
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

    const handleComplexityPresetChange = async (level: string) => {
        if (!level) return;
        setLoading(true);
        try {
            const result = await applyComplexityPreset(level);
            setComplexityLevel(result.complexity_level);
            if (result.config?.nodes) {
                const configNodes = result.config.nodes;
                setNodes((prevNodes) => {
                    const nodeIds = new Set(prevNodes.map((n) => n.id));
                    const updated = prevNodes.map((node) => {
                        const nodeConfig = configNodes[node.id];
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
                    });
                    Object.entries(configNodes).forEach(([id, nodeConfig]) => {
                        if (!nodeIds.has(id) && nodeConfig && typeof nodeConfig === 'object') {
                            const enabled = (nodeConfig as any).enabled ?? true;
                            const auditRequired = (nodeConfig as any).auditRequired ?? false;
                            const label = t(`pages.system.businessConfig.node.${id}`);
                            updated.push({
                                id,
                                data: {
                                    label: label || id,
                                    title: label || id,
                                    enabled,
                                    auditRequired,
                                    icon: <CodeSandboxOutlined style={{ color: '#1890ff' }} />,
                                    type: 'business',
                                },
                                position: { x: 100, y: 400 + updated.length * 60 },
                                style: getNodeStyle(enabled, auditRequired),
                            });
                            nodeIds.add(id);
                        }
                    });
                    return updated;
                });
            }
            message.success(result.message || t('pages.system.businessConfig.blueprint.presetApplied', { name: result.complexity_name }));
            queryClient.invalidateQueries({ queryKey: ['businessConfig'] });
        } catch (error: any) {
            message.error(error?.message || t('pages.system.businessConfig.blueprint.applyPresetFailed'));
        } finally {
            setLoading(false);
        }
    };

    // 选中的节点添加光晕效果（深色模式使用 token）
    const displayNodes = useMemo(
        () =>
            nodes.map((node) => ({
                ...node,
                style:
                    selectedNode?.id === node.id
                        ? {
                              ...node.style,
                              boxShadow: `0 0 0 2px ${token.colorPrimary}, 0 0 16px 6px ${token.colorPrimary}40`,
                              border: `2px solid ${token.colorPrimary}`,
                          }
                        : node.style,
            })),
        [nodes, selectedNode, token.colorPrimary]
    );

    const renderToolbox = () => (
        <Card title={t('pages.system.businessConfig.blueprint.componentLibrary')} variant="borderless" styles={{ body: { padding: 10 } }} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ maxHeight: 'calc(100vh - 218px - 64px - 64px)', overflowY: 'auto', margin: '-10px', padding: 10, flex: 1, minHeight: 0 }}>
                {nodes.map(item => {
                    const isSelected = selectedNode?.id === item.id;
                    return (
                        <div key={item.id} style={{ marginBottom: 6 }}>
                            <Card
                                size="small"
                                hoverable
                                styles={{ body: { padding: '6px 12px' } }}
                                style={{
                                    cursor: 'pointer',
                                    border: isSelected ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorder}`,
                                    background: isSelected ? token.colorPrimaryBg : token.colorFillQuaternary,
                                }}
                                onClick={() => {
                                    setSelectedNode(item);
                                    form.setFieldsValue({
                                        enabled: item.data.enabled,
                                        auditRequired: item.data.auditRequired,
                                    });
                                }}
                            >
                                <Space size="small">
                                    {item.data.icon}
                                    <Text style={{ fontSize: 13 }}>{(item.data as any).title}</Text>
                                </Space>
                            </Card>
                        </div>
                    );
                })}
            </div>
        </Card>
    );

    const renderPropertiesPanel = () => {
        if (!selectedNode) {
            return (
                <Card title={t('pages.system.businessConfig.blueprint.globalConfig')} variant="borderless" style={{ height: '100%' }}>
                    <Alert
                        title={t('pages.system.businessConfig.blueprint.noNodeSelected')}
                        description={t('pages.system.businessConfig.blueprint.noNodeSelectedDesc')}
                        type="info"
                        showIcon
                    />
                    <div style={{ marginTop: 24 }}>
                        <Text strong>{t('pages.system.businessConfig.blueprint.currentEnv')}</Text>
                        <div style={{ marginTop: 8 }}>
                            {complexityLevel ? (
                                <>
                                    <Text>{t('pages.system.businessConfig.blueprint.businessMode')}</Text>
                                    <Text type="secondary">{complexityLevel} {complexityPresets.find(p => p.code === complexityLevel)?.name || ''}</Text>
                                </>
                            ) : (
                                <>
                                    <Text>{t('pages.system.businessConfig.blueprint.industry')}</Text>
                                    <Text type="secondary">{t(`pages.system.businessConfig.blueprint.industry.${industry}`)}</Text>
                                    <span style={{ marginLeft: 16 }} />
                                    <Text>{t('pages.system.businessConfig.blueprint.scale')}</Text>
                                    <Text type="secondary">{t(`pages.system.businessConfig.blueprint.scale.${scale}`)}</Text>
                                </>
                            )}
                        </div>
                    </div>
                </Card>
            );
        }

        return (
            <Card title={t('pages.system.businessConfig.blueprint.nodeConfigTitle', { title: (selectedNode.data as any).title })} variant="borderless" style={{ height: '100%' }}>
                <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
                    <Form.Item name="enabled" label={t('pages.system.businessConfig.blueprint.enabled')} valuePropName="checked">
                        <Switch checkedChildren={t('pages.system.businessConfig.blueprint.enabledOn')} unCheckedChildren={t('pages.system.businessConfig.blueprint.enabledOff')} />
                    </Form.Item>

                    <Alert
                        title={selectedNode.data.enabled ? t('pages.system.businessConfig.blueprint.enabledAlert') : t('pages.system.businessConfig.blueprint.disabledAlert')}
                        type={selectedNode.data.enabled ? "success" : "warning"}
                        showIcon
                        style={{ marginBottom: 24 }}
                    />

                    <Form.Item name="auditRequired" label={t('pages.system.businessConfig.blueprint.auditFlow')} valuePropName="checked">
                        <Switch checkedChildren={t('pages.system.businessConfig.blueprint.auditRequired')} unCheckedChildren={t('pages.system.businessConfig.blueprint.autoPass')} disabled={!selectedNode.data.enabled} />
                    </Form.Item>
                    <Alert
                        title={t('pages.system.businessConfig.blueprint.auditTip')}
                        type="info"
                        style={{ fontSize: 12 }}
                    />
                    <div style={{ marginTop: 24 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.businessConfig.blueprint.nodeId')} {selectedNode.id}</Text>
                    </div>
                </Form>
            </Card>
        );
    };

    return (
        <Layout style={{ height: 'calc(100vh - 218px)', border: `1px solid ${token.colorBorder}` }}>
            {/* Top Toolbar */}
            <div style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}`, padding: '0 16px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                    <Space size={8}>
                        <Text strong>{t('pages.system.businessConfig.blueprint.businessModeLabel')}</Text>
                        <Select
                            value={complexityLevel || undefined}
                            onChange={handleComplexityPresetChange}
                            style={{ width: 220 }}
                            loading={loading}
                            placeholder={t('pages.system.businessConfig.blueprint.complexityPlaceholder')}
                            optionLabelProp="label"
                        >
                            {complexityPresets.map((p) => (
                                <Option key={p.code} value={p.code} label={`${p.code} ${p.name}`}>
                                    <div>
                                        <div><strong>{p.code} {p.name}</strong></div>
                                        {p.description ? <div style={{ fontSize: 12, color: '#888' }}>{p.description}</div> : null}
                                    </div>
                                </Option>
                            ))}
                        </Select>
                    </Space>
                    <Space size={8}>
                        <Text strong>{t('pages.system.businessConfig.blueprint.customTemplate')}</Text>
                        <Select
                            placeholder={t('pages.system.businessConfig.blueprint.selectTemplate')}
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
                                            title={t('pages.system.businessConfig.blueprint.confirmDeleteTemplate')}
                                            onConfirm={(e: any) => handleDeleteTemplate(e, t.id)}
                                            onCancel={(e: any) => e?.stopPropagation()}
                                            okText={t('pages.system.businessConfig.delete')}
                                            cancelText={t('common.cancel')}
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
                            {t('pages.system.businessConfig.blueprint.switchWillReset')}
                        </Text>
                    </Space>
                </Space>
                <Space style={{ flexShrink: 0 }}>
                    <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleSaveConfig} loading={loading}>
                        {t('pages.system.businessConfig.blueprint.saveConfig')}
                    </Button>
                    <Button onClick={onSaveAsTemplate}>{t('pages.system.businessConfig.blueprint.saveAsTemplate')}</Button>
                </Space>
            </div>
            <Layout style={{ height: 'calc(100% - 64px)' }}>
                <Sider width={200} theme={isDark ? 'dark' : 'light'} style={{ borderRight: `1px solid ${token.colorBorder}` }}>
                    {renderToolbox()}
                </Sider>
                <Content style={{ position: 'relative', background: token.colorBgLayout }}>
                    <FlowEditor
                        flowProps={{
                            nodes: displayNodes,
                            edges,
                            onNodeClick: handleNodeClick,
                            fitView: false,
                            defaultViewport: { x: 0, y: 0, zoom: 1 },
                        }}
                        miniMap={true}
                        devtools={false}
                    >
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={CANVAS_GRID_REACTFLOW.gap}
                            size={CANVAS_GRID_REACTFLOW.size}
                            color={isDark ? 'rgba(255,255,255,0.15)' : CANVAS_GRID_REACTFLOW.color}
                        />
                    </FlowEditor>
                </Content>
                <Sider width={300} theme={isDark ? 'dark' : 'light'} style={{ borderLeft: `1px solid ${token.colorBorder}` }}>
                    {renderPropertiesPanel()}
                </Sider>
            </Layout>
        </Layout>
    );
};

export default BusinessFlowConfig;
