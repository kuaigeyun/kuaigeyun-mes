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
    CalculatorOutlined,
    UnorderedListOutlined,
    ExportOutlined,
    ImportOutlined,
    PlusOutlined,
    MinusOutlined,
    BarcodeOutlined,
    BlockOutlined,
    BuildOutlined,
} from '@ant-design/icons';
import type { ConfigTemplate, ComplexityPreset } from '../../../services/businessConfig';
import { getBusinessConfig, updateNodesConfig, deleteConfigTemplate, getComplexityPresets, applyComplexityPreset, applyConfigTemplate } from '../../../services/businessConfig';
import { useThemeStore } from '../../../stores/themeStore';

import { Background, BackgroundVariant } from 'reactflow';
import { CANVAS_GRID_REACTFLOW } from '../../../components/layout-templates';
import BusinessBlueprintNode from './BusinessBlueprintNode';

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

    // Node Style Helper（节点使用 CheckCard 渲染，包装器透明，仅保留尺寸）
    const getNodeStyle = React.useCallback((_enabled: boolean, _auditRequired: boolean) => {
        return {
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            padding: 0,
            boxShadow: 'none',
            width: 108,
        };
    }, []);

    // 后端约定的节点白名单（45 节点，与菜单结构对齐：设备/模具/工装运营细粒度）
    const BACKEND_NODE_IDS = [
        'quotation', 'sample_trial', 'sales_forecast', 'sales_order', 'sales_delivery', 'shipment_notice', 'delivery_notice',
        'demand', 'demand_computation',
        'purchase_request', 'purchase_order', 'receipt_notice', 'inbound_delivery',
        'production_plan', 'work_order', 'rework_order', 'outsource_order',
        'quality_inspection', 'inventory_check',
        'equipment_fault', 'maintenance_plan', 'maintenance_reminder', 'equipment_status',
        'mold_usage', 'mold_calibration', 'mold_maintenance_reminder',
        'tool_usage', 'tool_maintenance', 'tool_calibration', 'tool_maintenance_reminder',
        'inbound', 'outbound', 'other_inbound', 'other_outbound', 'stocktaking', 'inventory_transfer', 'assembly_order', 'disassembly_order', 'material_borrow', 'material_return', 'barcode_mapping',
        'receivable', 'payable', 'invoice', 'cost_calculation',
    ];

    const getNodeLabel = (id: string) => t(`pages.system.businessConfig.node.${id}`);
    // 按大模块分组布局，垂直间距适中
    const GAP = 72; // 组内行间距
    const COL = 120; // 同列内水平偏移
    const MOD = { sales: 0, plan: 240, purchase: 400, production: 560, warehouse: 720, equipment: 0, finance: 0 };
    const BOTTOM_BASE_Y = 460; // 底部四行布局基准 y：设备/模具/工装/账款
    const nodeDefs: Array<{ id: string; x: number; y: number; enabled: boolean; audit: boolean; icon: React.ReactNode }> = [
        // 销售管理
        { id: 'quotation', x: MOD.sales, y: 0, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sample_trial', x: MOD.sales + COL, y: 0, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_forecast', x: MOD.sales + 70, y: GAP, enabled: true, audit: false, icon: <LineChartOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_order', x: MOD.sales + 70, y: GAP * 2, enabled: true, audit: false, icon: <ShopOutlined style={{ color: '#1890ff' }} /> },
        { id: 'shipment_notice', x: MOD.sales + 70, y: GAP * 3, enabled: true, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_delivery', x: MOD.sales + 70, y: GAP * 4, enabled: true, audit: false, icon: <RocketOutlined style={{ color: '#1890ff' }} /> },
        { id: 'delivery_notice', x: MOD.sales + 70, y: GAP * 5, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        // 计划管理
        { id: 'demand', x: MOD.plan, y: 0, enabled: true, audit: false, icon: <UnorderedListOutlined style={{ color: '#722ed1' }} /> },
        { id: 'demand_computation', x: MOD.plan, y: GAP, enabled: true, audit: false, icon: <CalculatorOutlined style={{ color: '#722ed1' }} /> },
        { id: 'inventory_check', x: MOD.plan, y: GAP * 2, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#52c41a' }} /> },
        { id: 'production_plan', x: MOD.plan, y: GAP * 3, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        // 采购管理
        { id: 'purchase_request', x: MOD.purchase, y: 0, enabled: true, audit: false, icon: <ShoppingCartOutlined /> },
        { id: 'purchase_order', x: MOD.purchase, y: GAP, enabled: true, audit: false, icon: <ShoppingCartOutlined /> },
        { id: 'receipt_notice', x: MOD.purchase, y: GAP * 2, enabled: true, audit: false, icon: <FileTextOutlined /> },
        { id: 'inbound_delivery', x: MOD.purchase, y: GAP * 3, enabled: true, audit: false, icon: <CloudUploadOutlined /> },
        // 生产执行
        { id: 'quality_inspection', x: MOD.production, y: 0, enabled: true, audit: false, icon: <CodeSandboxOutlined style={{ color: '#faad14' }} /> },
        { id: 'work_order', x: MOD.production, y: GAP, enabled: true, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'rework_order', x: MOD.production, y: GAP * 2, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'outsource_order', x: MOD.production, y: GAP * 3, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        // 仓储管理
        { id: 'inbound', x: MOD.warehouse, y: 0, enabled: true, audit: false, icon: <InboxOutlined /> },
        { id: 'outbound', x: MOD.warehouse, y: GAP, enabled: true, audit: false, icon: <InboxOutlined /> },
        { id: 'other_inbound', x: MOD.warehouse + COL, y: 0, enabled: false, audit: false, icon: <PlusOutlined /> },
        { id: 'other_outbound', x: MOD.warehouse + COL, y: GAP, enabled: false, audit: false, icon: <MinusOutlined /> },
        { id: 'stocktaking', x: MOD.warehouse, y: GAP * 2, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'inventory_transfer', x: MOD.warehouse, y: GAP * 3, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'assembly_order', x: MOD.warehouse, y: GAP * 4, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'disassembly_order', x: MOD.warehouse, y: GAP * 5, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'material_borrow', x: MOD.warehouse + COL, y: GAP * 4, enabled: false, audit: false, icon: <ExportOutlined /> },
        { id: 'material_return', x: MOD.warehouse + COL, y: GAP * 5, enabled: false, audit: false, icon: <ImportOutlined /> },
        { id: 'barcode_mapping', x: MOD.warehouse + COL, y: GAP * 6, enabled: false, audit: false, icon: <BarcodeOutlined /> },
        // 设备管理（四行布局：设备 / 模具 / 工装 / 账款）
        { id: 'equipment_fault', x: MOD.equipment, y: BOTTOM_BASE_Y, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'maintenance_plan', x: MOD.equipment + COL, y: BOTTOM_BASE_Y, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'maintenance_reminder', x: MOD.equipment + COL * 2, y: BOTTOM_BASE_Y, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'equipment_status', x: MOD.equipment + COL * 3, y: BOTTOM_BASE_Y, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'mold_usage', x: MOD.equipment, y: BOTTOM_BASE_Y + GAP, enabled: false, audit: false, icon: <BlockOutlined /> },
        { id: 'mold_calibration', x: MOD.equipment + COL, y: BOTTOM_BASE_Y + GAP, enabled: false, audit: false, icon: <BlockOutlined /> },
        { id: 'mold_maintenance_reminder', x: MOD.equipment + COL * 2, y: BOTTOM_BASE_Y + GAP, enabled: false, audit: false, icon: <BlockOutlined /> },
        { id: 'tool_usage', x: MOD.equipment, y: BOTTOM_BASE_Y + GAP * 2, enabled: false, audit: false, icon: <BuildOutlined /> },
        { id: 'tool_maintenance', x: MOD.equipment + COL, y: BOTTOM_BASE_Y + GAP * 2, enabled: false, audit: false, icon: <BuildOutlined /> },
        { id: 'tool_calibration', x: MOD.equipment + COL * 2, y: BOTTOM_BASE_Y + GAP * 2, enabled: false, audit: false, icon: <BuildOutlined /> },
        { id: 'tool_maintenance_reminder', x: MOD.equipment + COL * 3, y: BOTTOM_BASE_Y + GAP * 2, enabled: false, audit: false, icon: <BuildOutlined /> },
        { id: 'receivable', x: MOD.finance, y: BOTTOM_BASE_Y + GAP * 3, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'payable', x: MOD.finance + COL, y: BOTTOM_BASE_Y + GAP * 3, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'invoice', x: MOD.finance + COL * 2, y: BOTTOM_BASE_Y + GAP * 3, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'cost_calculation', x: MOD.finance + COL * 3, y: BOTTOM_BASE_Y + GAP * 3, enabled: false, audit: false, icon: <CalculatorOutlined /> },
    ];
    const initialNodes = useMemo(() => nodeDefs.map((n) => {
        const label = getNodeLabel(n.id);
        const style = getNodeStyle(n.enabled, n.audit);
        return {
            id: n.id,
            type: 'business' as const,
            data: { label, title: label, enabled: n.enabled, auditRequired: n.audit, icon: n.icon, style },
            position: { x: n.x, y: n.y },
            style,
        };
    }), [t, getNodeStyle]);

    // 暂不显示连线，按模块分组展示节点
    const edges = useMemo(() => [], []);

    const [nodes, setNodes] = useState(initialNodes);

    // 主题切换时重新应用节点样式
    useEffect(() => {
        setNodes((prev) =>
            prev.map((n) => {
                const style = getNodeStyle(n.data.enabled, n.data.auditRequired);
                return {
                    ...n,
                    data: { ...n.data, style },
                    style,
                };
            })
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
                    const style = getNodeStyle(newData.enabled, newData.auditRequired);
                    setSelectedNode((prev: any) => ({ ...prev, data: { ...newData, style } }));
                    return {
                        ...node,
                        data: { ...newData, style },
                        style,
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
                    mold_usage: { enabled: false, auditRequired: false },
                    mold_calibration: { enabled: false, auditRequired: false },
                    mold_maintenance_reminder: { enabled: false, auditRequired: false },
                    tool_usage: { enabled: false, auditRequired: false },
                    tool_maintenance: { enabled: false, auditRequired: false },
                    tool_calibration: { enabled: false, auditRequired: false },
                    tool_maintenance_reminder: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: false, auditRequired: false },
                    inventory_transfer: { enabled: false, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: false, auditRequired: false },
                    material_return: { enabled: false, auditRequired: false },
                    barcode_mapping: { enabled: false, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: false, auditRequired: false },
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
                    mold_usage: { enabled: false, auditRequired: false },
                    mold_calibration: { enabled: false, auditRequired: false },
                    mold_maintenance_reminder: { enabled: false, auditRequired: false },
                    tool_usage: { enabled: false, auditRequired: false },
                    tool_maintenance: { enabled: false, auditRequired: false },
                    tool_calibration: { enabled: false, auditRequired: false },
                    tool_maintenance_reminder: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: false, auditRequired: false },
                    material_return: { enabled: false, auditRequired: false },
                    barcode_mapping: { enabled: false, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    mold_usage: { enabled: true, auditRequired: false },
                    mold_calibration: { enabled: true, auditRequired: false },
                    mold_maintenance_reminder: { enabled: true, auditRequired: false },
                    tool_usage: { enabled: true, auditRequired: false },
                    tool_maintenance: { enabled: true, auditRequired: false },
                    tool_calibration: { enabled: true, auditRequired: false },
                    tool_maintenance_reminder: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: true, auditRequired: false },
                    material_borrow: { enabled: true, auditRequired: false },
                    material_return: { enabled: true, auditRequired: false },
                    barcode_mapping: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    mold_usage: { enabled: false, auditRequired: false },
                    mold_calibration: { enabled: false, auditRequired: false },
                    mold_maintenance_reminder: { enabled: false, auditRequired: false },
                    tool_usage: { enabled: false, auditRequired: false },
                    tool_maintenance: { enabled: false, auditRequired: false },
                    tool_calibration: { enabled: false, auditRequired: false },
                    tool_maintenance_reminder: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: false, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: false, auditRequired: false },
                    material_return: { enabled: false, auditRequired: false },
                    barcode_mapping: { enabled: false, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: false, auditRequired: false },
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
                    mold_usage: { enabled: true, auditRequired: false },
                    mold_calibration: { enabled: true, auditRequired: false },
                    mold_maintenance_reminder: { enabled: true, auditRequired: false },
                    tool_usage: { enabled: true, auditRequired: false },
                    tool_maintenance: { enabled: true, auditRequired: false },
                    tool_calibration: { enabled: true, auditRequired: false },
                    tool_maintenance_reminder: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: true, auditRequired: false },
                    material_return: { enabled: true, auditRequired: false },
                    barcode_mapping: { enabled: false, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    mold_usage: { enabled: true, auditRequired: false },
                    mold_calibration: { enabled: true, auditRequired: false },
                    mold_maintenance_reminder: { enabled: true, auditRequired: false },
                    tool_usage: { enabled: true, auditRequired: false },
                    tool_maintenance: { enabled: true, auditRequired: false },
                    tool_calibration: { enabled: true, auditRequired: false },
                    tool_maintenance_reminder: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: true },
                    disassembly_order: { enabled: true, auditRequired: false },
                    material_borrow: { enabled: true, auditRequired: false },
                    material_return: { enabled: true, auditRequired: false },
                    barcode_mapping: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    mold_usage: { enabled: false, auditRequired: false },
                    mold_calibration: { enabled: false, auditRequired: false },
                    mold_maintenance_reminder: { enabled: false, auditRequired: false },
                    tool_usage: { enabled: false, auditRequired: false },
                    tool_maintenance: { enabled: false, auditRequired: false },
                    tool_calibration: { enabled: false, auditRequired: false },
                    tool_maintenance_reminder: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: false, auditRequired: false },
                    material_return: { enabled: false, auditRequired: false },
                    barcode_mapping: { enabled: true, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: false, auditRequired: false },
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
                    mold_usage: { enabled: false, auditRequired: false },
                    mold_calibration: { enabled: false, auditRequired: false },
                    mold_maintenance_reminder: { enabled: false, auditRequired: false },
                    tool_usage: { enabled: false, auditRequired: false },
                    tool_maintenance: { enabled: false, auditRequired: false },
                    tool_calibration: { enabled: false, auditRequired: false },
                    tool_maintenance_reminder: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: true, auditRequired: false },
                    material_return: { enabled: true, auditRequired: false },
                    barcode_mapping: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    mold_usage: { enabled: true, auditRequired: false },
                    mold_calibration: { enabled: true, auditRequired: false },
                    mold_maintenance_reminder: { enabled: true, auditRequired: false },
                    tool_usage: { enabled: true, auditRequired: false },
                    tool_maintenance: { enabled: true, auditRequired: false },
                    tool_calibration: { enabled: true, auditRequired: false },
                    tool_maintenance_reminder: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: true, auditRequired: false },
                    material_borrow: { enabled: true, auditRequired: false },
                    material_return: { enabled: true, auditRequired: false },
                    barcode_mapping: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    mold_usage: { enabled: false, auditRequired: false },
                    mold_calibration: { enabled: false, auditRequired: false },
                    mold_maintenance_reminder: { enabled: false, auditRequired: false },
                    tool_usage: { enabled: false, auditRequired: false },
                    tool_maintenance: { enabled: false, auditRequired: false },
                    tool_calibration: { enabled: false, auditRequired: false },
                    tool_maintenance_reminder: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: false, auditRequired: false },
                    inventory_transfer: { enabled: false, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: false, auditRequired: false },
                    material_return: { enabled: false, auditRequired: false },
                    barcode_mapping: { enabled: false, auditRequired: false },
                    receivable: { enabled: false, auditRequired: false },
                    payable: { enabled: false, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: false, auditRequired: false },
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
                    mold_usage: { enabled: false, auditRequired: false },
                    mold_calibration: { enabled: false, auditRequired: false },
                    mold_maintenance_reminder: { enabled: false, auditRequired: false },
                    tool_usage: { enabled: false, auditRequired: false },
                    tool_maintenance: { enabled: false, auditRequired: false },
                    tool_calibration: { enabled: false, auditRequired: false },
                    tool_maintenance_reminder: { enabled: false, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: false },
                    inventory_transfer: { enabled: true, auditRequired: false },
                    assembly_order: { enabled: false, auditRequired: false },
                    disassembly_order: { enabled: false, auditRequired: false },
                    material_borrow: { enabled: true, auditRequired: false },
                    material_return: { enabled: true, auditRequired: false },
                    barcode_mapping: { enabled: false, auditRequired: false },
                    receivable: { enabled: true, auditRequired: false },
                    payable: { enabled: true, auditRequired: false },
                    invoice: { enabled: false, auditRequired: false },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    mold_usage: { enabled: true, auditRequired: false },
                    mold_calibration: { enabled: true, auditRequired: false },
                    mold_maintenance_reminder: { enabled: true, auditRequired: false },
                    tool_usage: { enabled: true, auditRequired: false },
                    tool_maintenance: { enabled: true, auditRequired: false },
                    tool_calibration: { enabled: true, auditRequired: false },
                    tool_maintenance_reminder: { enabled: true, auditRequired: false },
                    inbound: { enabled: true, auditRequired: false },
                    outbound: { enabled: true, auditRequired: false },
                    stocktaking: { enabled: true, auditRequired: true },
                    inventory_transfer: { enabled: true, auditRequired: true },
                    assembly_order: { enabled: true, auditRequired: false },
                    disassembly_order: { enabled: true, auditRequired: false },
                    material_borrow: { enabled: true, auditRequired: false },
                    material_return: { enabled: true, auditRequired: false },
                    barcode_mapping: { enabled: true, auditRequired: false },
                    receivable: { enabled: true, auditRequired: true },
                    payable: { enabled: true, auditRequired: true },
                    invoice: { enabled: true, auditRequired: true },
                    cost_calculation: { enabled: true, auditRequired: false },
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
                    const style = getNodeStyle(config.enabled, config.auditRequired);
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            enabled: config.enabled,
                            auditRequired: config.auditRequired,
                            style,
                        },
                        style,
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
                                    const style = getNodeStyle(nodeConfig.enabled, nodeConfig.auditRequired);
                                    return {
                                        ...node,
                                        data: {
                                            ...node.data,
                                            enabled: nodeConfig.enabled,
                                            auditRequired: nodeConfig.auditRequired,
                                            style,
                                        },
                                        style,
                                    };
                                }
                                return node;
                            });
                            // 合并后端多出的节点（避免 config 中有而前端无的节点丢失）
                            Object.entries(config.nodes).forEach(([id, nodeConfig]) => {
                                if (id === 'quality_standard') return; // 质检标准为基础资料，不在蓝图中显示
                                if (id === 'mold_management' || id === 'tool_management') return; // 已拆分为细粒度节点
                                if (!nodeIds.has(id) && nodeConfig && typeof nodeConfig === 'object') {
                                    const enabled = (nodeConfig as any).enabled ?? true;
                                    const auditRequired = (nodeConfig as any).auditRequired ?? false;
                                    const style = getNodeStyle(enabled, auditRequired);
                                    const label = t(`pages.system.businessConfig.node.${id}`);
                                    updated.push({
                                        id,
                                        type: 'business' as const,
                                        data: {
                                            label: label || id,
                                            title: label || id,
                                            enabled,
                                            auditRequired,
                                            icon: <CodeSandboxOutlined style={{ color: '#1890ff' }} />,
                                            style,
                                        },
                                        position: { x: 100, y: 400 + updated.length * 60 },
                                        style,
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
                            const style = getNodeStyle(nodeConfig.enabled, nodeConfig.auditRequired);
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    enabled: nodeConfig.enabled,
                                    auditRequired: nodeConfig.auditRequired,
                                    style,
                                },
                                style,
                            };
                        }
                        return node;
                    });
                    Object.entries(configNodes).forEach(([id, nodeConfig]) => {
                        if (id === 'quality_standard') return; // 质检标准为基础资料，不在蓝图中显示
                        if (id === 'mold_management' || id === 'tool_management') return; // 已拆分为细粒度节点
                        if (!nodeIds.has(id) && nodeConfig && typeof nodeConfig === 'object') {
                            const enabled = (nodeConfig as any).enabled ?? true;
                            const auditRequired = (nodeConfig as any).auditRequired ?? false;
                            const style = getNodeStyle(enabled, auditRequired);
                            const label = t(`pages.system.businessConfig.node.${id}`);
                            updated.push({
                                id,
                                type: 'business' as const,
                                data: {
                                    label: label || id,
                                    title: label || id,
                                    enabled,
                                    auditRequired,
                                    icon: <CodeSandboxOutlined style={{ color: '#1890ff' }} />,
                                    style,
                                },
                                position: { x: 100, y: 400 + updated.length * 60 },
                                style,
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
                            const style = getNodeStyle(nodeConfig.enabled, nodeConfig.auditRequired);
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    enabled: nodeConfig.enabled,
                                    auditRequired: nodeConfig.auditRequired,
                                    style,
                                },
                                style,
                            };
                        }
                        return node;
                    });
                    Object.entries(configNodes).forEach(([id, nodeConfig]) => {
                        if (id === 'quality_standard') return; // 质检标准为基础资料，不在蓝图中显示
                        if (id === 'mold_management' || id === 'tool_management') return; // 已拆分为细粒度节点
                        if (!nodeIds.has(id) && nodeConfig && typeof nodeConfig === 'object') {
                            const enabled = (nodeConfig as any).enabled ?? true;
                            const auditRequired = (nodeConfig as any).auditRequired ?? false;
                            const style = getNodeStyle(enabled, auditRequired);
                            const label = t(`pages.system.businessConfig.node.${id}`);
                            updated.push({
                                id,
                                type: 'business' as const,
                                data: {
                                    label: label || id,
                                    title: label || id,
                                    enabled,
                                    auditRequired,
                                    icon: <CodeSandboxOutlined style={{ color: '#1890ff' }} />,
                                    style,
                                },
                                position: { x: 100, y: 400 + updated.length * 60 },
                                style,
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

    // 选中的节点使用光晕效果，颜色跟随主题色
    const displayNodes = useMemo(
        () =>
            nodes.map((node) => ({
                ...node,
                style:
                    selectedNode?.id === node.id
                        ? {
                              ...node.style,
                              borderRadius: 8,
                              border: 'none',
                              boxShadow: `0 0 0 1px ${token.colorPrimary}33, 0 0 10px 5px ${token.colorPrimary}4d, 0 0 20px 8px ${token.colorPrimary}26`,
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
                    <style>{`
                        /* 审核角标：仅上、右边着色，下、左保持透明以形成三角形 */
                        .business-blueprint-node-audit.ant-pro-checkcard-checked::after {
                            border-block-start-color: ${token.colorWarning} !important;
                            border-inline-end-color: ${token.colorWarning} !important;
                            border-block-end-color: transparent !important;
                            border-inline-start-color: transparent !important;
                        }
                    `}</style>
                    <FlowEditor
                        flowProps={{
                            nodes: displayNodes,
                            edges,
                            nodeTypes: { business: BusinessBlueprintNode },
                            onNodeClick: handleNodeClick,
                            fitView: true,
                            fitViewOptions: { padding: 0.2, duration: 300 },
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
