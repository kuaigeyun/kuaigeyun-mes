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
import type { Edge } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { CANVAS_GRID_REACTFLOW } from '../../../components/layout-templates';
import BusinessBlueprintNode from './BusinessBlueprintNode';


const { Text } = Typography;
const { useToken } = theme;
const { Option } = Select;

// 节点名称优先跟随 manifest 同步菜单文案，旧键仅作兜底
const NODE_MANIFEST_I18N_KEY: Record<string, string> = {
    quotation: 'app.kuaizhizao.menu.sales-management.quotations',
    sample_trial: 'app.kuaizhizao.menu.sales-management.sample-trials',
    sales_forecast: 'app.kuaizhizao.menu.sales-management.sales-forecasts',
    sales_order: 'app.kuaizhizao.menu.sales-management.sales-orders',
    shipment_notice: 'app.kuaizhizao.menu.sales-management.shipment-notices',
    sales_delivery: 'app.kuaizhizao.menu.warehouse-management.sales-outbound',
    sales_return: 'app.kuaizhizao.menu.sales-management.sales-returns',
    customer_follow_up: 'app.kuaizhizao.menu.sales-management.customer-follow-ups',
    demand: 'app.kuaizhizao.menu.plan-management.demand-management',
    demand_computation: 'app.kuaizhizao.menu.plan-management.demand-computation',
    production_control_tower: 'app.kuaizhizao.menu.plan-management.control-tower',
    inventory_check: 'app.kuaizhizao.menu.plan-management.inventory-check',
    production_plan: 'app.kuaizhizao.menu.plan-management.production-plans',
    purchase_request: 'app.kuaizhizao.menu.purchase-management.purchase-requisitions',
    purchase_order: 'app.kuaizhizao.menu.purchase-management.purchase-orders',
    receipt_notice: 'app.kuaizhizao.menu.purchase-management.receipt-notices',
    inbound_delivery: 'app.kuaizhizao.menu.purchase-management.inbound-delivery',
    logistics_tracking: 'app.kuaizhizao.menu.purchase-management.logistics-tracking',
    purchase_return: 'app.kuaizhizao.menu.purchase-management.purchase-returns',
    quality_inspection: 'app.kuaizhizao.menu.quality-management.incoming-inspection',
    inspection_center: 'app.kuaizhizao.menu.quality-management.inspection-center',
    work_order: 'app.kuaizhizao.menu.production-execution.work-orders',
    rework_order: 'app.kuaizhizao.menu.production-execution.rework-orders',
    outsource_order: 'app.kuaizhizao.menu.production-execution.outsource-work-orders',
    inbound: 'app.kuaizhizao.menu.warehouse-management.inbound',
    outbound: 'app.kuaizhizao.menu.warehouse-management.outbound',
    other_inbound: 'app.kuaizhizao.menu.warehouse-management.other-inbound',
    other_outbound: 'app.kuaizhizao.menu.warehouse-management.other-outbound',
    stocktaking: 'app.kuaizhizao.menu.warehouse-management.stocktaking',
    inventory_transfer: 'app.kuaizhizao.menu.warehouse-management.inventory-transfer',
    batch_inventory_query: 'app.kuaizhizao.menu.warehouse-management.batch-inventory-query',
    material_call: 'app.kuaizhizao.menu.warehouse-management.material-calls',
    assembly_order: 'app.kuaizhizao.menu.warehouse-management.assembly-orders',
    disassembly_order: 'app.kuaizhizao.menu.warehouse-management.disassembly-orders',
    material_borrow: 'app.kuaizhizao.menu.warehouse-management.material-borrows',
    material_return: 'app.kuaizhizao.menu.warehouse-management.material-returns',
    barcode_mapping: 'app.kuaizhizao.menu.warehouse-management.barcode-mapping-rules',
    delivery_notice: 'app.kuaizhizao.menu.warehouse-management.delivery-notes',
    equipment_fault: 'app.kuaizhizao.menu.equipment-management.equipment-faults',
    maintenance_plan: 'app.kuaizhizao.menu.equipment-management.maintenance-plans',
    maintenance_reminder: 'app.kuaizhizao.menu.equipment-management.maintenance-reminders',
    equipment_status: 'app.kuaizhizao.menu.equipment-management.equipment-status',
    spare_parts: 'app.kuaizhizao.menu.equipment-management.spare-parts',
    mold_usage: 'app.kuaizhizao.menu.equipment-management.mold-usages',
    mold_calibration: 'app.kuaizhizao.menu.equipment-management.mold-calibrations',
    mold_maintenance_reminder: 'app.kuaizhizao.menu.equipment-management.mold-maintenance-reminders',
    tool_usage: 'app.kuaizhizao.menu.equipment-management.tool-usages',
    tool_maintenance: 'app.kuaizhizao.menu.equipment-management.tool-maintenances',
    tool_calibration: 'app.kuaizhizao.menu.equipment-management.tool-calibrations',
    tool_maintenance_reminder: 'app.kuaizhizao.menu.equipment-management.tool-maintenance-reminders',
    receivable: 'app.kuaizhizao.menu.finance-management.receivables',
    payable: 'app.kuaizhizao.menu.finance-management.payables',
    invoice: 'app.kuaizhizao.menu.finance-management.invoice-list',
    cost_calculation: 'app.kuaizhizao.menu.cost-management.cost-calculations',
};

const BusinessGroupNode: React.FC<NodeProps> = ({ data }) => (
    <div
        style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            border: '1px dashed rgba(114, 46, 209, 0.35)',
            background: 'rgba(114, 46, 209, 0.04)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            padding: 10,
        }}
    >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#531dab' }}>{data?.label}</div>
    </div>
);

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
        'sales_return', 'customer_follow_up',
        'demand', 'demand_computation', 'production_control_tower',
        'purchase_request', 'purchase_order', 'receipt_notice', 'inbound_delivery', 'logistics_tracking', 'purchase_return',
        'production_plan', 'work_order', 'rework_order', 'outsource_order',
        'quality_inspection', 'inspection_center', 'inventory_check',
        'equipment_fault', 'maintenance_plan', 'maintenance_reminder', 'equipment_status', 'spare_parts',
        'mold_usage', 'mold_calibration', 'mold_maintenance_reminder',
        'tool_usage', 'tool_maintenance', 'tool_calibration', 'tool_maintenance_reminder',
        'inbound', 'outbound', 'other_inbound', 'other_outbound', 'stocktaking', 'inventory_transfer', 'assembly_order', 'disassembly_order', 'material_borrow', 'material_return', 'barcode_mapping', 'batch_inventory_query', 'material_call',
        'receivable', 'payable', 'invoice', 'cost_calculation',
    ];

    const getNodeLabel = (id: string) => {
        const manifestKey = NODE_MANIFEST_I18N_KEY[id];
        const fallback = t(`pages.system.businessConfig.node.${id}`);
        if (!manifestKey) return fallback;
        const fromManifest = t(manifestKey);
        return fromManifest === manifestKey ? fallback : fromManifest;
    };
    // 组内严格网格对齐；组间垂直分层避免矩形重叠（采购/财务 → 销售/计划/仓储 → 生产 → 设备行）
    const ROW = 56;
    const COL = 112;
    const NODE_W = 108;
    const NODE_H = 56;
    const GROUP_PAD_X = 20;
    const GROUP_PAD_BOTTOM = 18;
    const GROUP_HEADER_OFFSET_Y = 26;
    /** 首行相对分组顶：与 position 公式 n.y = BASE + row*ROW 一致 */
    const FIRST_ROW_GAP = 12;

    /** 分组容器画布：统一原点、等间距、各行相对中间三列总宽居中，避免东一块西一块 */
    const CANVAS_ORIGIN_X = 40;
    const GROUP_GUTTER = 20;
    /** 顶行节点基准 y；中间行节点基准 y（与 group.y + 12 一致） */
    const BASE_Y = {
        purchase: 120,
        finance: 120,
        sales: 400,
        plan: 400,
        warehouse: 400,
    };

    type GridCell = { id: string; groupId: string; row: number; col: number; enabled: boolean; audit: boolean; icon: React.ReactNode };
    const blueprintGrid: GridCell[] = [
        // 销售管理：5 行 × 2 列，行优先填满
        { id: 'quotation', groupId: 'group_sales', row: 0, col: 0, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sample_trial', groupId: 'group_sales', row: 0, col: 1, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_forecast', groupId: 'group_sales', row: 1, col: 0, enabled: true, audit: false, icon: <LineChartOutlined style={{ color: '#1890ff' }} /> },
        { id: 'customer_follow_up', groupId: 'group_sales', row: 1, col: 1, enabled: false, audit: false, icon: <UnorderedListOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_order', groupId: 'group_sales', row: 2, col: 0, enabled: true, audit: false, icon: <ShopOutlined style={{ color: '#1890ff' }} /> },
        { id: 'shipment_notice', groupId: 'group_sales', row: 2, col: 1, enabled: true, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_delivery', groupId: 'group_sales', row: 3, col: 0, enabled: true, audit: false, icon: <RocketOutlined style={{ color: '#1890ff' }} /> },
        { id: 'delivery_notice', groupId: 'group_sales', row: 3, col: 1, enabled: false, audit: false, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        { id: 'sales_return', groupId: 'group_sales', row: 4, col: 0, enabled: false, audit: false, icon: <ImportOutlined style={{ color: '#1890ff' }} /> },
        // 计划管理：3 行 × 2 列
        { id: 'demand', groupId: 'group_plan', row: 0, col: 0, enabled: true, audit: false, icon: <UnorderedListOutlined style={{ color: '#722ed1' }} /> },
        { id: 'demand_computation', groupId: 'group_plan', row: 0, col: 1, enabled: true, audit: false, icon: <CalculatorOutlined style={{ color: '#722ed1' }} /> },
        { id: 'inventory_check', groupId: 'group_plan', row: 1, col: 0, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#52c41a' }} /> },
        { id: 'production_plan', groupId: 'group_plan', row: 1, col: 1, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'production_control_tower', groupId: 'group_plan', row: 2, col: 0, enabled: false, audit: false, icon: <CalculatorOutlined style={{ color: '#722ed1' }} /> },
        // 采购管理：左列主流程自上而下，右列对齐同行
        { id: 'purchase_request', groupId: 'group_purchase', row: 0, col: 0, enabled: true, audit: false, icon: <ShoppingCartOutlined /> },
        { id: 'logistics_tracking', groupId: 'group_purchase', row: 0, col: 1, enabled: false, audit: false, icon: <LineChartOutlined /> },
        { id: 'purchase_order', groupId: 'group_purchase', row: 1, col: 0, enabled: true, audit: false, icon: <ShoppingCartOutlined /> },
        { id: 'purchase_return', groupId: 'group_purchase', row: 1, col: 1, enabled: false, audit: false, icon: <ImportOutlined /> },
        { id: 'inbound_delivery', groupId: 'group_purchase', row: 2, col: 0, enabled: true, audit: false, icon: <CloudUploadOutlined /> },
        { id: 'receipt_notice', groupId: 'group_purchase', row: 2, col: 1, enabled: true, audit: false, icon: <FileTextOutlined /> },
        // 生产执行：左列工单链，右上质检中心与质检同行
        { id: 'work_order', groupId: 'group_production', row: 0, col: 0, enabled: true, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'inspection_center', groupId: 'group_production', row: 0, col: 1, enabled: false, audit: false, icon: <UnorderedListOutlined style={{ color: '#faad14' }} /> },
        { id: 'quality_inspection', groupId: 'group_production', row: 1, col: 0, enabled: true, audit: false, icon: <CodeSandboxOutlined style={{ color: '#faad14' }} /> },
        { id: 'rework_order', groupId: 'group_production', row: 1, col: 1, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        { id: 'outsource_order', groupId: 'group_production', row: 2, col: 0, enabled: false, audit: false, icon: <CodeSandboxOutlined style={{ color: '#722ed1' }} /> },
        // 仓储管理：7 行 × 2 列，行优先
        { id: 'other_inbound', groupId: 'group_warehouse', row: 0, col: 0, enabled: false, audit: false, icon: <PlusOutlined /> },
        { id: 'inbound', groupId: 'group_warehouse', row: 0, col: 1, enabled: true, audit: false, icon: <InboxOutlined /> },
        { id: 'stocktaking', groupId: 'group_warehouse', row: 1, col: 0, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'outbound', groupId: 'group_warehouse', row: 1, col: 1, enabled: true, audit: false, icon: <InboxOutlined /> },
        { id: 'inventory_transfer', groupId: 'group_warehouse', row: 2, col: 0, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'batch_inventory_query', groupId: 'group_warehouse', row: 2, col: 1, enabled: false, audit: false, icon: <UnorderedListOutlined /> },
        { id: 'assembly_order', groupId: 'group_warehouse', row: 3, col: 0, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'material_call', groupId: 'group_warehouse', row: 3, col: 1, enabled: false, audit: false, icon: <ExportOutlined /> },
        { id: 'disassembly_order', groupId: 'group_warehouse', row: 4, col: 0, enabled: false, audit: false, icon: <FileTextOutlined /> },
        { id: 'material_borrow', groupId: 'group_warehouse', row: 4, col: 1, enabled: false, audit: false, icon: <ExportOutlined /> },
        { id: 'material_return', groupId: 'group_warehouse', row: 5, col: 0, enabled: false, audit: false, icon: <ImportOutlined /> },
        { id: 'other_outbound', groupId: 'group_warehouse', row: 5, col: 1, enabled: false, audit: false, icon: <MinusOutlined /> },
        { id: 'barcode_mapping', groupId: 'group_warehouse', row: 6, col: 0, enabled: false, audit: false, icon: <BarcodeOutlined /> },
        // 财务管理：2×2
        { id: 'receivable', groupId: 'group_finance', row: 0, col: 0, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'payable', groupId: 'group_finance', row: 0, col: 1, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'invoice', groupId: 'group_finance', row: 1, col: 0, enabled: false, audit: false, icon: <WalletOutlined /> },
        { id: 'cost_calculation', groupId: 'group_finance', row: 1, col: 1, enabled: false, audit: false, icon: <CalculatorOutlined /> },
        // 设备管理：3+2 列网格
        { id: 'equipment_fault', groupId: 'group_equipment', row: 0, col: 0, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'maintenance_plan', groupId: 'group_equipment', row: 0, col: 1, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'maintenance_reminder', groupId: 'group_equipment', row: 0, col: 2, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'equipment_status', groupId: 'group_equipment', row: 1, col: 0, enabled: false, audit: false, icon: <ToolOutlined /> },
        { id: 'spare_parts', groupId: 'group_equipment', row: 1, col: 1, enabled: false, audit: false, icon: <ToolOutlined /> },
        // 模具：2+1
        { id: 'mold_usage', groupId: 'group_mold', row: 0, col: 0, enabled: false, audit: false, icon: <BlockOutlined /> },
        { id: 'mold_calibration', groupId: 'group_mold', row: 0, col: 1, enabled: false, audit: false, icon: <BlockOutlined /> },
        { id: 'mold_maintenance_reminder', groupId: 'group_mold', row: 1, col: 0, enabled: false, audit: false, icon: <BlockOutlined /> },
        // 工装：2×2
        { id: 'tool_usage', groupId: 'group_tooling', row: 0, col: 0, enabled: false, audit: false, icon: <BuildOutlined /> },
        { id: 'tool_maintenance', groupId: 'group_tooling', row: 0, col: 1, enabled: false, audit: false, icon: <BuildOutlined /> },
        { id: 'tool_calibration', groupId: 'group_tooling', row: 1, col: 0, enabled: false, audit: false, icon: <BuildOutlined /> },
        { id: 'tool_maintenance_reminder', groupId: 'group_tooling', row: 1, col: 1, enabled: false, audit: false, icon: <BuildOutlined /> },
    ];

    const computeGroupSize = (cells: GridCell[]) => {
        let maxRow = 0;
        let maxCol = 0;
        for (const c of cells) {
            maxRow = Math.max(maxRow, c.row);
            maxCol = Math.max(maxCol, c.col);
        }
        const w = GROUP_PAD_X * 2 + maxCol * COL + NODE_W;
        const h = FIRST_ROW_GAP + GROUP_HEADER_OFFSET_Y + maxRow * ROW + NODE_H + GROUP_PAD_BOTTOM;
        return { w, h, maxRow, maxCol };
    };

    const cellsByGroup = blueprintGrid.reduce((acc, cell) => {
        if (!acc[cell.groupId]) acc[cell.groupId] = [];
        acc[cell.groupId].push(cell);
        return acc;
    }, {} as Record<string, GridCell[]>);

    const blueprintLayout = useMemo(() => {
        const sz = (id: keyof typeof cellsByGroup) => computeGroupSize(cellsByGroup[id]);
        const sSales = sz('group_sales');
        const sPlan = sz('group_plan');
        const sPurchase = sz('group_purchase');
        const sProd = sz('group_production');
        const sWh = sz('group_warehouse');
        const sFin = sz('group_finance');
        const sEq = sz('group_equipment');
        const sMold = sz('group_mold');
        const sTool = sz('group_tooling');

        const G = GROUP_GUTTER;
        const ox = CANVAS_ORIGIN_X;

        /** 中间行总宽（销售|计划|仓储），作为整幅对齐基准 */
        const rowMidWidth = sSales.w + G + sPlan.w + G + sWh.w;

        const yTop = BASE_Y.purchase - 12;
        const yMid = BASE_Y.sales - 12;

        /** 顶行：采购 + 财务，相对中间行总宽居中 */
        const rowTopWidth = sPurchase.w + G + sFin.w;
        let x = ox + Math.max(0, (rowMidWidth - rowTopWidth) / 2);
        const gPurchase = { id: 'group_purchase' as const, label: '采购管理', x, y: yTop, w: sPurchase.w, h: sPurchase.h };
        x += sPurchase.w + G;
        const gFinance = { id: 'group_finance' as const, label: '财务管理', x, y: yTop, w: sFin.w, h: sFin.h };

        /** 中间行：销售 | 计划 | 仓储，左缘对齐画布原点 */
        x = ox;
        const gSales = { id: 'group_sales' as const, label: '销售管理', x, y: yMid, w: sSales.w, h: sSales.h };
        x += sSales.w + G;
        const gPlan = { id: 'group_plan' as const, label: '计划管理', x, y: yMid, w: sPlan.w, h: sPlan.h };
        x += sPlan.w + G;
        const gWarehouse = { id: 'group_warehouse' as const, label: '仓储管理', x, y: yMid, w: sWh.w, h: sWh.h };

        const middleBandBottom = Math.max(gSales.y + gSales.h, gPlan.y + gPlan.h, gWarehouse.y + gWarehouse.h);
        const productionTop = middleBandBottom + G;
        const gProd = {
            id: 'group_production' as const,
            label: '生产执行',
            x: ox + Math.max(0, (rowMidWidth - sProd.w) / 2),
            y: productionTop,
            w: sProd.w,
            h: sProd.h,
        };
        const productionBottom = gProd.y + gProd.h;
        const bottomY = productionBottom + 36;

        /** 底行：设备 | 模具 | 工装，相对中间行总宽居中 */
        const rowBotWidth = sEq.w + G + sMold.w + G + sTool.w;
        x = ox + Math.max(0, (rowMidWidth - rowBotWidth) / 2);
        const gEquipment = { id: 'group_equipment' as const, label: '设备管理', x, y: bottomY - 12, w: sEq.w, h: sEq.h };
        x += sEq.w + G;
        const gMold = { id: 'group_mold' as const, label: '模具管理', x, y: bottomY - 12, w: sMold.w, h: sMold.h };
        x += sMold.w + G;
        const gTooling = { id: 'group_tooling' as const, label: '工装管理', x, y: bottomY - 12, w: sTool.w, h: sTool.h };

        const moduleGroups = [gSales, gPlan, gPurchase, gProd, gWarehouse, gFinance, gEquipment, gMold, gTooling];
        const moduleGroupMap = moduleGroups.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {} as Record<string, (typeof moduleGroups)[number]>);

        return { moduleGroups, moduleGroupMap };
    }, []);

    const { moduleGroups, moduleGroupMap } = blueprintLayout;

    const nodeDefs: Array<{ id: string; groupId: string; x: number; y: number; enabled: boolean; audit: boolean; icon: React.ReactNode }> = useMemo(() => {
        return blueprintGrid.map((c) => {
            const g = moduleGroupMap[c.groupId];
            return {
                id: c.id,
                groupId: c.groupId,
                x: g.x + GROUP_PAD_X + c.col * COL,
                y: g.y + 12 + c.row * ROW,
                enabled: c.enabled,
                audit: c.audit,
                icon: c.icon,
            };
        });
    }, [moduleGroupMap]);
    const groupNodes = useMemo(
        () =>
            moduleGroups.map((g) => ({
                id: g.id,
                type: 'groupContainer' as const,
                data: { label: g.label },
                position: { x: g.x, y: g.y },
                style: { width: g.w, height: g.h },
                draggable: false,
                selectable: false,
                connectable: false,
                focusable: false,
            })),
        [moduleGroups]
    );
    const initialNodes = useMemo(
        () =>
            nodeDefs.map((n) => {
                const label = getNodeLabel(n.id);
                const style = getNodeStyle(n.enabled, n.audit);
                const group = moduleGroupMap[n.groupId];
                return {
                    id: n.id,
                    type: 'business' as const,
                    data: { label, title: label, enabled: n.enabled, auditRequired: n.audit, icon: n.icon, style },
                    position: { x: n.x - group.x, y: n.y - group.y + GROUP_HEADER_OFFSET_Y },
                    parentNode: n.groupId,
                    extent: 'parent' as const,
                    style,
                };
            }),
        [t, getNodeStyle, moduleGroupMap]
    );

    // 蓝图仅按分组展示能力开关，不绘制节点间连线，避免视觉干扰
    const edges = useMemo<Edge[]>(() => [], []);

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
    const flowNodes = useMemo(() => [...groupNodes, ...displayNodes], [groupNodes, displayNodes]);

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
        <Layout style={{ height: 'calc(100vh - 218px)' }}>
            {/* 工具栏 + 三栏 同在一个圆角容器内，分割线在内部，避免直边压圆角 */}
            <div
                style={{
                    height: '100%',
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: token.borderRadiusLG,
                    overflow: 'hidden',
                    background: token.colorBgContainer,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}`, padding: '0 16px', height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                {/* 三栏同级：组件库 | 画板 | 节点配置，无外框（由外层统一圆角） */}
                <div
                    className="blueprint-panels"
                    style={{
                        display: 'flex',
                        flex: 1,
                        minHeight: 0,
                        background: token.colorBgContainer,
                    }}
                >
                <div
                    className="blueprint-panel blueprint-panel-left"
                    style={{
                        width: 200,
                        minWidth: 200,
                        flexShrink: 0,
                        borderRight: `1px solid ${token.colorBorder}`,
                        background: token.colorBgContainer,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {renderToolbox()}
                </div>
                <div
                    className="blueprint-panel blueprint-panel-center"
                    style={{
                        flex: 1,
                        minWidth: 0,
                        position: 'relative',
                        background: token.colorBgLayout,
                    }}
                >
                    <style>{`
                        .business-blueprint-node-audit.ant-pro-checkcard-checked::after {
                            border-block-start-color: ${token.colorWarning} !important;
                            border-inline-end-color: ${token.colorWarning} !important;
                            border-block-end-color: transparent !important;
                            border-inline-start-color: transparent !important;
                        }
                    `}</style>
                    <FlowEditor
                        flowProps={{
                            nodes: flowNodes,
                            edges,
                            nodeTypes: { business: BusinessBlueprintNode, groupContainer: BusinessGroupNode },
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
                </div>
                <div
                    className="blueprint-panel blueprint-panel-right"
                    style={{
                        width: 300,
                        minWidth: 300,
                        flexShrink: 0,
                        borderLeft: `1px solid ${token.colorBorder}`,
                        background: token.colorBgContainer,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {renderPropertiesPanel()}
                </div>
                </div>
            </div>
        </Layout>
    );
};

export default BusinessFlowConfig;
