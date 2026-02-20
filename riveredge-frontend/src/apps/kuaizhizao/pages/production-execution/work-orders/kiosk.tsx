/**
 * 高级生产终端 (Premium Production Terminal)
 * 
 * Author: Antigravity
 * Date: 2026-02-05
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Tag, message, Input, Empty, 
  List, Typography, Form, Progress, Tooltip, Tabs, theme, Alert, Segmented, Modal, Radio, Select, Divider, Table
} from 'antd';
import { 
  PlayCircleOutlined, 
  CheckCircleOutlined,
  ReloadOutlined,
  SwapOutlined,
  PauseCircleOutlined,
  AlertOutlined,
  StopOutlined,
  UnorderedListOutlined,
  FileProtectOutlined,
  HistoryOutlined,
  PrinterOutlined,
  QrcodeOutlined,
} from '@ant-design/icons';

import { PremiumTerminalTemplate, HMI_DESIGN_TOKENS, HMI_LAYOUT, TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { workOrderApi, reportingApi, warehouseApi } from '../../../services/production';
import StationBinder, { STATION_STORAGE_KEY, type StationInfo } from '../../../components/StationBinder';
import ReportingParameterForm from './components/ReportingParameterForm';
import MaterialBindingModal from './components/MaterialBindingModal';
import BarcodePrintModal from './components/BarcodePrintModal';
import ProcessInspectionModal from './components/ProcessInspectionModal';
import NumericKeypad from './components/NumericKeypad';
import DocumentCenter, { type DocumentCenterTabKey } from './components/DocumentCenter';
import { getToken } from '../../../../../utils/auth';
import { getCurrentUser, CurrentUser } from '../../../../../services/auth';
import dayjs from 'dayjs';

const { Search } = Input;
const { Text, Title } = Typography;

interface WorkOrder {
  id?: number;
  code?: string;
  name?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  status?: string;
  priority?: string;
  completed_quantity?: number;
  unqualified_quantity?: number;
  qualified_quantity?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  work_center_id?: number;
  work_center_name?: string;
}

const WorkOrdersKioskPage: React.FC = () => {
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
    const [userInfo, setUserInfo] = useState<CurrentUser | null>(null);
    
    // 选中状态
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
    const [operations, setOperations] = useState<any[]>([]);
    const [activeOperation, setActiveOperation] = useState<any>(null);
    const [opsLoading, setOpsLoading] = useState(false);
    const [form] = Form.useForm();
    const [isPaused, setIsPaused] = useState(false);
    const [recentOps, setRecentOps] = useState<Array<{ time: string; action: string; detail?: string; operator?: string }>>([]);
    const [middleTabKey, setMiddleTabKey] = useState<string>('operation');
    const [docSubTabKey, setDocSubTabKey] = useState<DocumentCenterTabKey>('sop');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [focusedNumField, setFocusedNumField] = useState<'qualified_quantity' | 'unqualified_quantity' | null>(null);
    // 不良品弹窗：输入不合格数>0时弹出
    const [defectModalVisible, setDefectModalVisible] = useState(false);
    const [defectTypeOptions, setDefectTypeOptions] = useState<Array<{ code: string; name: string }>>([]);
    const [selectedDefectType, setSelectedDefectType] = useState<string | null>(null);
    // 作业指导书弹窗
    const [sopModalVisible, setSopModalVisible] = useState(false);
    const [sopModalTab, setSopModalTab] = useState<'static' | 'guided'>('static');
    // 报工参数弹窗
    const [paramModalVisible, setParamModalVisible] = useState(false);
    // 物料绑定弹窗
    const [materialBindingModalVisible, setMaterialBindingModalVisible] = useState(false);
    const [lastReportingRecordId, setLastReportingRecordId] = useState<string | number | null>(null);
    // 条码打印弹窗
    const [barcodePrintModalVisible, setBarcodePrintModalVisible] = useState(false);
    const [barcodePrintLevel, setBarcodePrintLevel] = useState<'work_order' | 'operation'>('operation');
    // 工序检验弹窗
    const [processInspectionModalVisible, setProcessInspectionModalVisible] = useState(false);
    // 工单列表筛选：全部/只看本机台/只看当前用户
    const [workOrderFilter, setWorkOrderFilter] = useState<'all' | 'station' | 'currentUser'>('all');

    useEffect(() => {
        // Load User Info
        getCurrentUser().then(user => {
             setUserInfo(user);
        }).catch(err => {
             console.error('Failed to load user info', err);
             // Optionally redirect to login if critical
        });

        const savedStation = localStorage.getItem(STATION_STORAGE_KEY);
        if (savedStation) {
            try {
                const info = JSON.parse(savedStation);
                setStationInfo(info);
                loadWorkOrders((info as any).workCenterId);
            } catch (e) {
                localStorage.removeItem(STATION_STORAGE_KEY);
            }
        }
    }, []);

    // 不良品弹窗打开时：只显示当前工序关联的不良品项
    useEffect(() => {
        if (!defectModalVisible || !activeOperation) return;
        const opDefects = activeOperation?.defect_types ?? activeOperation?.defectTypes ?? [];
        setDefectTypeOptions(opDefects.map((d: any) => ({ code: d.code, name: d.name })));
    }, [defectModalVisible, activeOperation]);


    const loadWorkOrders = async (workCenterId?: number, filterOverride?: 'all' | 'station' | 'currentUser') => {
        setLoading(true);
        setLoadError(null);
        try {
            const effectiveFilter = filterOverride ?? workOrderFilter;
            const params: any = { skip: 0, limit: 200 };
            if (workCenterId) params.work_center_id = workCenterId;
            if (effectiveFilter === 'currentUser' && userInfo?.id) params.assigned_worker_id = userInfo.id;
            const response = await workOrderApi.list(params);
            const data = response?.data ?? (Array.isArray(response) ? response : []);
            const list = Array.isArray(data) ? data : [];
            setWorkOrders(list.filter((wo: WorkOrder) => ['released', 'in_progress'].includes(wo.status || '')));
            
            if (selectedWorkOrder) {
                const updated = data.find((wo: WorkOrder) => wo.id === selectedWorkOrder.id);
                if (updated) setSelectedWorkOrder(updated);
            }
        } catch (error) {
            console.error(error);
            setLoadError('加载工单列表失败，请重试');
            message.error('加载工单列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectWorkOrder = async (workOrder: WorkOrder) => {
        if (selectedWorkOrder?.id === workOrder.id) return;
        setSelectedWorkOrder(workOrder);
        setOperations([]);
        setActiveOperation(null);
        
        if (workOrder.id) {
            setOpsLoading(true);
            try {
                // Fetch real operations
                const ops = await workOrderApi.getOperations(workOrder.id.toString());
                // Sort ops by sequence if needed, usually backend returns sorted or we trust list order
                const sortedOps = Array.isArray(ops) ? ops.sort((a: any, b: any) => a.sequence - b.sequence) : [];
                setOperations(sortedOps);
                
                // Find active operation: first 'processing', then 'pending', else last one?
                // Logic: Current active is the one being worked on, or the next available.
                const current = sortedOps.find((o: any) => o.status === 'processing') || sortedOps.find((o: any) => o.status === 'pending');
                setActiveOperation(current || sortedOps[0]);
            } catch (error) {
                console.error(error);
                message.error('加载工序失败');
            } finally {
                setOpsLoading(false);
            }
        }
    };

    const handleSwitchStation = () => {
        localStorage.removeItem(STATION_STORAGE_KEY);
        setStationInfo(null);
        setWorkOrders([]);
        setSelectedWorkOrder(null);
    };

    const addRecentOp = (action: string, detail?: string) => {
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const operator = userInfo?.full_name || userInfo?.username || '操作员';
        setRecentOps(prev => [{ time, action, detail, operator }, ...prev].slice(0, 20));
    };

    const handleStart = async () => {
        if (!selectedWorkOrder?.id || !activeOperation?.id) return;
        try {
            setOpsLoading(true);
            // Call startOperation API
            await workOrderApi.startOperation(selectedWorkOrder.id.toString(), activeOperation.id);
            addRecentOp('开始执行', activeOperation.operation_name || activeOperation.name);
            message.success('工序已开始');
            
            // Refresh operations and work order list status
            const ops = await workOrderApi.getOperations(selectedWorkOrder.id.toString());
            setOperations(ops || []);
            const updatedOp = ops.find((o: any) => o.id === activeOperation.id);
            if (updatedOp) setActiveOperation(updatedOp);

            loadWorkOrders(stationInfo?.workCenterId);
        } catch (error) {
            console.error(error);
            message.error('操作失败');
        } finally {
            setOpsLoading(false);
        }
    };

    const handleQuickPick = async () => {
        if (!selectedWorkOrder?.id) {
            message.warning('请先选择工单');
            return;
        }
        try {
            setLoading(true);
            await warehouseApi.productionPicking.quickPick(selectedWorkOrder.id.toString());
            message.success('一键领料成功');
        } catch (error) {
            console.error(error);
            message.error('领料失败');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintWorkOrder = () => {
        if (!selectedWorkOrder?.id) {
            message.warning('请先选择工单');
            return;
        }
        const url = workOrderApi.getPrintUrl(selectedWorkOrder.id.toString());
        window.open(url, '_blank');
    };

    const handleReport = async () => {
        try {
            const values = await form.validateFields();
            if (!activeOperation || !selectedWorkOrder) return;
            const qualified = Number(values.qualified_quantity) || 0;
            const unqualified = Number(values.unqualified_quantity) || 0;
            const qty = qualified + unqualified;
            if (qty <= 0) {
                message.warning('合格数和不合格数之和须大于 0');
                return;
            }
            if (unqualified > 0 && defectTypeOptions.length > 0 && !selectedDefectType) {
                message.warning('请选择不良品类型');
                return;
            }
            setOpsLoading(true);
            const sopParams = Object.fromEntries(
                Object.entries(values).filter(([k]) => !['qualified_quantity', 'unqualified_quantity', 'work_hours', 'remarks'].includes(k))
            );
            
            const created = await reportingApi.create({
                work_order_id: selectedWorkOrder.id!,
                work_order_code: selectedWorkOrder.code || '',
                work_order_name: selectedWorkOrder.name || selectedWorkOrder.product_name || '',
                operation_id: activeOperation.operation_id ?? activeOperation.id,
                operation_code: activeOperation.operation_code || '',
                operation_name: activeOperation.operation_name || activeOperation.name || '',
                worker_id: userInfo?.id ?? 0,
                worker_name: userInfo?.full_name || userInfo?.username || '操作员',
                reported_quantity: qty,
                qualified_quantity: qualified,
                unqualified_quantity: unqualified,
                work_hours: Number(values.work_hours) || 0,
                status: 'pending',
                reported_at: new Date().toISOString(),
                remarks: values.remarks,
                sop_parameters: Object.keys(sopParams).length ? sopParams : undefined,
            });
            
            // 不合格数 > 0 且已选不良品类型时，创建不良品记录
            if (unqualified > 0 && selectedDefectType && created?.id) {
                try {
                    await reportingApi.recordDefect(created.id.toString(), {
                        defect_quantity: unqualified,
                        defect_type: selectedDefectType,
                        defect_reason: '报工终端录入',
                        disposition: 'quarantine',
                    });
                } catch (defectErr) {
                    console.error('创建不良品记录失败', defectErr);
                    message.warning('报工成功，但不良品记录创建失败');
                }
            }
            
            addRecentOp('完成报工', `合格 ${qualified} / 不合格 ${unqualified}`);
            message.success('报工成功');
            form.resetFields();
            setSelectedDefectType(null);
            
            if (created?.id) {
                setLastReportingRecordId(created.id);
                // Optionally auto-open material binding
                // setMaterialBindingModalVisible(true);
            }
            
            // Refresh
            loadWorkOrders(stationInfo?.workCenterId);
            if (selectedWorkOrder.id) {
                const ops = await workOrderApi.getOperations(selectedWorkOrder.id.toString());
                setOperations(ops || []);
                const updatedOp = ops.find((o: any) => o.id === activeOperation.id);
                if (updatedOp) setActiveOperation(updatedOp);
            }
            
        } catch (error) {
            console.error(error);
            // validate error
        } finally {
            setOpsLoading(false);
        }
    };

    const STATUS_LABELS: Record<string, string> = {
        draft: '草稿', released: '已下达', in_progress: '生产中', completed: '已完成', cancelled: '已取消',
        pending: '待执行', processing: '执行中',
    };
    const PRIORITY_LABELS: Record<string, string> = {
        low: '低', normal: '普通', high: '高', urgent: '紧急',
    };
    const formatDate = (d?: string) => d ? dayjs(d).format('MM-DD HH:mm') : '—';
    const getStatusBadgeStyle = (status?: string): { background: string; color: string } => {
        const s = HMI_DESIGN_TOKENS.STATUS_BADGE[status as keyof typeof HMI_DESIGN_TOKENS.STATUS_BADGE] ?? HMI_DESIGN_TOKENS.STATUS_BADGE.default;
        return { background: s.bg, color: s.color };
    };

    const filteredWorkOrders = workOrders.filter(wo => {
        const matchSearch = !searchKeyword ||
            wo.code?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            wo.product_name?.toLowerCase().includes(searchKeyword.toLowerCase());
        if (!matchSearch) return false;
        if (workOrderFilter === 'station' && stationInfo?.workCenterId != null) {
            return wo.work_center_id === stationInfo.workCenterId;
        }
        return true;
    });

    const renderLeftPanel = () => (
        <div
            onClick={() => setFocusedNumField(null)}
            style={{
                height: '100%',
                width: HMI_LAYOUT.LEFT_PANEL_WIDTH,
                minWidth: HMI_LAYOUT.LEFT_PANEL_WIDTH,
                background: HMI_DESIGN_TOKENS.BG_CARD,
                borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <div style={{ padding: HMI_DESIGN_TOKENS.PANEL_PADDING, borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600 }}>
                        <UnorderedListOutlined style={{ fontSize: HMI_DESIGN_TOKENS.CARD_HEADER_ICON_SIZE }} />
                        工单列表
                    </span>
                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 400 }}>共 {filteredWorkOrders.length} 项</div>
                </div>
                <Select
                    value={workOrderFilter}
                    getPopupContainer={() => document.querySelector('.premium-terminal-fullscreen-wrap') || document.body}
                    onChange={(v) => {
                        setWorkOrderFilter(v);
                        if (stationInfo?.workCenterId) loadWorkOrders(stationInfo.workCenterId, v);
                    }}
                    options={[
                        { label: '全部', value: 'all' },
                        { label: '只看本机台', value: 'station' },
                        { label: '只看当前用户', value: 'currentUser' },
                    ]}
                    style={{ width: '100%', marginBottom: 12 }}
                    className="kiosk-work-order-filter-select"
                    popupClassName="kiosk-work-order-filter-dropdown"
                />
                <Search
                    placeholder="搜索编号或产品"
                    onChange={e => setSearchKeyword(e.target.value)}
                    style={{ background: HMI_DESIGN_TOKENS.BG_CARD, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS }}
                />
            </div>
            <div className="kiosk-work-order-list" style={{ flex: 1, overflowY: 'auto', padding: `${HMI_DESIGN_TOKENS.PANEL_PADDING}px` }}>
                <style>{`
                    .kiosk-work-order-list .ant-list-item { border: none !important; border-bottom: none !important; }
                    .kiosk-work-order-filter-select.ant-select .ant-select-selector,
                    .kiosk-work-order-filter-select.ant-select-single .ant-select-selection-item {
                        font-size: 14px !important;
                        font-weight: 400 !important;
                        color: ${HMI_DESIGN_TOKENS.TEXT_TERTIARY} !important;
                    }
                    .kiosk-work-order-filter-dropdown .ant-select-item { font-size: 14px !important; font-weight: 400 !important; color: ${HMI_DESIGN_TOKENS.TEXT_TERTIARY} !important; }
                `}</style>
                <List
                    split={false}
                    dataSource={filteredWorkOrders}
                    loading={loading}
                    style={{ margin: 0, padding: 0, border: 'none' }}
                    locale={{ emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>选择工位后加载工单</span>}
                        />
                    ) }}
                    renderItem={wo => {
                        const isSelected = selectedWorkOrder?.id === wo.id;
                        const pct = Math.round(((wo.completed_quantity || 0) / (wo.quantity || 1)) * 100);
                        const isComplete = wo.status === 'completed';
                        return (
                            <List.Item
                                onClick={() => handleSelectWorkOrder(wo)}
                                style={{
                                    cursor: 'pointer',
                                    minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                    padding: `${HMI_DESIGN_TOKENS.LIST_CARD_PADDING}px 16px`,
                                    borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                                    marginBottom: HMI_DESIGN_TOKENS.LIST_CARD_GAP,
                                    background: isSelected ? HMI_DESIGN_TOKENS.LIST_CARD_SELECTED_BG : HMI_DESIGN_TOKENS.LIST_CARD_BG,
                                    border: 'none',
                                    borderBottom: 'none',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <Text strong style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{wo.code}</Text>
                                        <span style={{ fontSize: 12, lineHeight: 1, padding: '4px 8px', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontWeight: 500, ...getStatusBadgeStyle(wo.status) }}>{STATUS_LABELS[wo.status || ''] || wo.status}</span>
                                    </div>
                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{wo.product_name}</div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                        {wo.work_center_name && <span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12 }}>{wo.work_center_name}</span>}
                                        {wo.priority && wo.priority !== 'normal' && <Tag style={{ margin: 0, fontSize: 11 }}>{PRIORITY_LABELS[wo.priority] || wo.priority}</Tag>}
                                        <span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12 }}>{formatDate(wo.planned_start_date)} ~ {formatDate(wo.planned_end_date)}</span>
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <Progress
                                            percent={pct}
                                            size="small"
                                            strokeColor={isComplete ? HMI_DESIGN_TOKENS.STATUS_OK : HMI_DESIGN_TOKENS.STATUS_INFO}
                                            style={{ marginBottom: 0 }}
                                        />
                                    </div>
                                </div>
                            </List.Item>
                        );
                    }}
                />
            </div>
        </div>
    );

    const currentStatusLabel = !selectedWorkOrder
        ? '待选择'
        : (activeOperation?.status === 'processing' ? '执行中' : activeOperation?.status === 'completed' ? '已完成' : '待执行');

    const panelStyle: React.CSSProperties = {
        background: HMI_DESIGN_TOKENS.BG_CARD,
        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
        border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
        padding: HMI_DESIGN_TOKENS.PANEL_PADDING,
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    };

    const docCenterProps = {
        sopContent: selectedWorkOrder
            ? `操作指引：${selectedWorkOrder.code}${activeOperation ? `\n工序：${activeOperation.name || activeOperation.operation_name}` : ''}`
            : undefined,
        drawings: selectedWorkOrder ? [{ id: '1', name: '图纸.png', url: '' }] : [],
    };

    const renderWipTab = () => {
        if (!selectedWorkOrder) {
            return (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Empty 
                        description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY }}>当前工位暂无正在执行的工单，可在左侧选择工单查看进进度。</span>}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            );
        }

        // Mock WIP data based on work order operations
        const wipData = operations.map((op, idx) => ({
            key: op.id,
            sequence: idx + 1,
            name: op.name || op.operation_name,
            input: selectedWorkOrder.quantity || 0,
            output: op.completed_quantity || 0,
            scrap: op.unqualified_quantity || 0,
            yield: op.completed_quantity ? Math.round(((Number(op.completed_quantity) - (Number(op.unqualified_quantity) || 0)) / (Number(selectedWorkOrder.quantity) || 1)) * 100) : 0,
            status: op.status,
        }));

        return (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, margin: 0 }}>工序流转进度 - {selectedWorkOrder.code}</Title>
                    <Tag color="blue">在制数量: {Math.max(0, (Number(selectedWorkOrder.quantity || 0) - (Number(selectedWorkOrder.completed_quantity) || 0)))}</Tag>
                </div>
                
                <Table
                    dataSource={wipData}
                    pagination={false}
                    size="small"
                    bordered
                    className="kiosk-wip-table"
                    columns={[
                        { title: '序号', dataIndex: 'sequence', width: 60, align: 'center' },
                        { title: '工序名称', dataIndex: 'name', minWidth: 120 },
                        { title: '投入数', dataIndex: 'input', width: 80, align: 'right' },
                        { title: '产出数', dataIndex: 'output', width: 80, align: 'right', render: (val: number) => <span style={{ color: HMI_DESIGN_TOKENS.STATUS_OK, fontWeight: 600 }}>{val}</span> },
                        { title: '不良数', dataIndex: 'scrap', width: 80, align: 'right', render: (val: number) => <span style={{ color: val > 0 ? HMI_DESIGN_TOKENS.STATUS_ALARM : HMI_DESIGN_TOKENS.TEXT_TERTIARY }}>{val}</span> },
                        { title: '合格率', dataIndex: 'yield', width: 80, align: 'right', render: (val: number) => `${val}%` },
                    ]}
                    rowClassName={(record: any) => record.key === activeOperation?.id ? 'kiosk-wip-row-active' : ''}
                />
                
                <style>{`
                    .kiosk-wip-table .ant-table { background: transparent !important; color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important; }
                    .kiosk-wip-table .ant-table-thead > tr > th { background: rgba(255,255,255,0.05) !important; color: ${HMI_DESIGN_TOKENS.TEXT_SECONDARY} !important; border-bottom: 1px solid ${HMI_DESIGN_TOKENS.BORDER} !important; }
                    .kiosk-wip-table .ant-table-tbody > tr > td { border-bottom: 1px solid ${HMI_DESIGN_TOKENS.BORDER} !important; }
                    .kiosk-wip-table .ant-table-cell { font-size: 16px !important; padding: 16px 12px !important; }
                    .kiosk-wip-row-active { background: rgba(22, 119, 255, 0.1) !important; }
                `}</style>
            </div>
        );
    };

    const renderOperationTab = () => {
        if (!selectedWorkOrder) {
            return (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600 }}>
                            <UnorderedListOutlined style={{ fontSize: HMI_DESIGN_TOKENS.CARD_HEADER_ICON_SIZE, color: HMI_DESIGN_TOKENS.STATUS_INFO }} />
                            请选择工单开始
                        </div>
                        <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>从左侧列表选择工单</div>
                    </div>
                </div>
            );
        }

        const jobCardAccent = selectedWorkOrder.status === 'in_progress' || selectedWorkOrder.status === 'processing' ? HMI_DESIGN_TOKENS.STATUS_WARNING : HMI_DESIGN_TOKENS.STATUS_INFO;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: HMI_DESIGN_TOKENS.SECTION_GAP, flex: 1, minHeight: 0 }}>
                    <Card
                        style={{
                            background: HMI_DESIGN_TOKENS.BG_CARD,
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                        }}
                        styles={{ body: { padding: 16 } }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12 }}>正在执行</Text>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                                        <Title level={2} style={{ margin: 0, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_TITLE_MIN }}>{selectedWorkOrder.code}</Title>
                                        <Tag color={jobCardAccent}>{selectedWorkOrder.product_name}</Tag>
                                    </div>
                                </div>
                            </div>
                            {/* 工序圆环：不换行，超宽横向滑动 */}
                            {operations.length > 0 && (
                                <div style={{ overflowX: 'auto', overflowY: 'hidden', margin: '0 -8px', WebkitOverflowScrolling: 'touch' }}>
                                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 16, padding: '0 8px', minWidth: 'min-content' }}>
                                        {operations.map((op, idx) => {
                                            const isActive = op.id === activeOperation?.id;
                                            const isProcessing = op.status === 'processing';
                                            const isCompleted = op.status === 'completed';
                                            const progress = op.reporting_type === 'status'
                                                ? (isCompleted ? 100 : 0)
                                                : Math.min(100, Math.round(((Number(op.completed_quantity) || 0) / (Number(selectedWorkOrder?.quantity) || 1)) * 100));
                                            const strokeColor = isCompleted ? HMI_DESIGN_TOKENS.STATUS_OK : isProcessing ? HMI_DESIGN_TOKENS.STATUS_WARNING : HMI_DESIGN_TOKENS.STATUS_INFO;
                                            const opName = op.name || op.operation_name || `工序${idx + 1}`;
                                            return (
                                                <Tooltip title={opName} key={op.id}>
                                                    <div
                                                        onClick={() => setActiveOperation(op)}
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            cursor: 'pointer',
                                                            padding: 8,
                                                            flexShrink: 0,
                                                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                                                            background: isActive ? (isProcessing ? 'rgba(255,179,0,0.15)' : 'rgba(22,119,255,0.15)') : 'transparent',
                                                            border: `2px solid ${isActive ? strokeColor : 'transparent'}`,
                                                        }}
                                                    >
                                                        <Progress
                                                            type="circle"
                                                            percent={progress}
                                                            size={64}
                                                            strokeWidth={12}
                                                            strokeColor={strokeColor}
                                                            trailColor="rgba(255,255,255,0.1)"
                                                            showInfo={true}
                                                            format={(p) => <span style={{ fontSize: 14, fontWeight: 600, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY }}>{p}%</span>}
                                                        />
                                                        <div style={{ marginTop: 6, fontSize: 16, color: isActive ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>{opName}</div>
                                                    </div>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card
                        loading={opsLoading}
                        style={{ flex: 1, minHeight: 0, background: 'rgba(255,255,255,0.04)', border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS }}
                        styles={{ body: { padding: 24, overflowY: 'auto' } }}
                    >
                        {operations.length === 0 ? (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无工序</span>} />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: HMI_DESIGN_TOKENS.SECTION_GAP }}>
                                {activeOperation ? (
                                    <>
                                        {/* 选中工序信息 */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, background: HMI_DESIGN_TOKENS.BG_ELEVATED, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                                <div>
                                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12, marginBottom: 4 }}>工序名称</div>
                                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, fontWeight: 600 }}>{activeOperation.name || activeOperation.operation_name}</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12, marginBottom: 4 }}>状态</div>
                                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>
                                                        {activeOperation.status === 'completed' ? '已完成' : activeOperation.status === 'processing' ? '执行中' : '待执行'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12, marginBottom: 4 }}>完成进度</div>
                                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>
                                                        {activeOperation.reporting_type === 'status'
                                                            ? (activeOperation.status === 'completed' ? '100%' : '0%')
                                                            : `${activeOperation.completed_quantity ?? 0} / ${selectedWorkOrder?.quantity ?? 0}`}
                                                    </div>
                                                </div>
                                                {activeOperation.reporting_type !== 'status' && (
                                                    <>
                                                        <div>
                                                            <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12, marginBottom: 4 }}>合格/不合格</div>
                                                            <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>
                                                                {activeOperation.qualified_quantity ?? 0} / {activeOperation.unqualified_quantity ?? 0}
                                                            </div>
                                                        </div>
                                                        {(Number(activeOperation.completed_quantity) || 0) > 0 && (
                                                            <div>
                                                                <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 12, marginBottom: 4 }}>合格率</div>
                                                                <div style={{ color: HMI_DESIGN_TOKENS.STATUS_OK, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, fontWeight: 600 }}>
                                                                    {Math.round(((Number(activeOperation.qualified_quantity) || 0) / (Number(activeOperation.completed_quantity) || 1)) * 100)}%
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Button
                                                    type="default"
                                                    icon={<FileProtectOutlined />}
                                                    onClick={() => { setSopModalTab('static'); setSopModalVisible(true); }}
                                                    style={{
                                                        minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                                        fontWeight: 600,
                                                        background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                                                        borderColor: HMI_DESIGN_TOKENS.BORDER,
                                                        color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
                                                    }}
                                                >
                                                    作业指导书
                                                </Button>
                                                <Button
                                                    type="default"
                                                    onClick={() => setParamModalVisible(true)}
                                                    style={{
                                                        minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                                        fontWeight: 600,
                                                        background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                                                        borderColor: HMI_DESIGN_TOKENS.BORDER,
                                                        color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
                                                    }}
                                                >
                                                    报工参数
                                                </Button>
                                                <Button
                                                    type="default"
                                                    disabled={!lastReportingRecordId}
                                                    onClick={() => setMaterialBindingModalVisible(true)}
                                                    style={{
                                                        minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                                        fontWeight: 600,
                                                        background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                                                        borderColor: HMI_DESIGN_TOKENS.BORDER,
                                                        color: lastReportingRecordId ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : 'rgba(255,255,255,0.25)',
                                                    }}
                                                >
                                                    物料绑定
                                                </Button>
                                                <Button
                                                    type="default"
                                                    disabled={!activeOperation}
                                                    onClick={() => { setBarcodePrintLevel('operation'); setBarcodePrintModalVisible(true); }}
                                                    style={{
                                                        minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                                        fontWeight: 600,
                                                        background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                                                        borderColor: HMI_DESIGN_TOKENS.BORDER,
                                                        color: activeOperation ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : 'rgba(255,255,255,0.25)',
                                                    }}
                                                >
                                                    条码打印
                                                </Button>
                                                <Button
                                                    type="default"
                                                    disabled={!activeOperation}
                                                    onClick={() => setProcessInspectionModalVisible(true)}
                                                    style={{
                                                        minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                                        fontWeight: 600,
                                                        background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                                                        borderColor: HMI_DESIGN_TOKENS.BORDER,
                                                        color: activeOperation ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : 'rgba(255,255,255,0.25)',
                                                    }}
                                                >
                                                    工序检验
                                                </Button>
                                            </div>
                                        </div>
                                        <Form form={form} layout="vertical">
                                        <div style={{ display: 'flex', gap: HMI_DESIGN_TOKENS.SECTION_GAP, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                            <Form.Item name="qualified_quantity" label={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>合格数</Text>} initialValue={0} rules={[{ required: true, message: '请用右侧小键盘输入' }]}>
                                                <Input
                                                    type="text"
                                                    inputMode="none"
                                                    readOnly
                                                    onClick={(e) => { e.stopPropagation(); setFocusedNumField('qualified_quantity'); }}
                                                    style={{
                                                        height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE,
                                                        textAlign: 'center',
                                                        background: focusedNumField === 'qualified_quantity' ? HMI_DESIGN_TOKENS.LIST_CARD_SELECTED_BG : HMI_DESIGN_TOKENS.BG_CARD,
                                                        color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
                                                        border: `2px solid ${focusedNumField === 'qualified_quantity' ? HMI_DESIGN_TOKENS.STATUS_OK : HMI_DESIGN_TOKENS.BORDER}`,
                                                        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                                                        cursor: 'pointer',
                                                    }}
                                                />
                                            </Form.Item>
                                            <Form.Item name="unqualified_quantity" label={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>不合格数</Text>} initialValue={0} rules={[{ required: true, message: '请用右侧小键盘输入' }]}>
                                                <Input
                                                    type="text"
                                                    inputMode="none"
                                                    readOnly
                                                    onClick={(e) => { e.stopPropagation(); setFocusedNumField('unqualified_quantity'); }}
                                                    style={{
                                                        height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE,
                                                        textAlign: 'center',
                                                        background: focusedNumField === 'unqualified_quantity' ? HMI_DESIGN_TOKENS.LIST_CARD_SELECTED_BG : HMI_DESIGN_TOKENS.BG_CARD,
                                                        color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
                                                        border: `2px solid ${focusedNumField === 'unqualified_quantity' ? HMI_DESIGN_TOKENS.STATUS_OK : HMI_DESIGN_TOKENS.BORDER}`,
                                                        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                                                        cursor: 'pointer',
                                                    }}
                                                />
                                            </Form.Item>
                                            <Form.Item label={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>总数</Text>}>
                                                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.qualified_quantity !== curr.qualified_quantity || prev.unqualified_quantity !== curr.unqualified_quantity}>
                                                    {({ getFieldValue }) => {
                                                        const q = Number(getFieldValue('qualified_quantity')) || 0;
                                                        const u = Number(getFieldValue('unqualified_quantity')) || 0;
                                                        return (
                                                            <div style={{ height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, display: 'flex', alignItems: 'center', justifyContent: 'center', background: HMI_DESIGN_TOKENS.BG_ELEVATED, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS }}>
                                                                {q + u}
                                                            </div>
                                                        );
                                                    }}
                                                </Form.Item>
                                            </Form.Item>
                                            <Form.Item label={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>&nbsp;</span>}>
                                                <Button
                                                    type="primary"
                                                    icon={<CheckCircleOutlined />}
                                                    onClick={handleReport}
                                                    loading={opsLoading}
                                                    style={{
                                                        height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                                        fontWeight: 600,
                                                        background: HMI_DESIGN_TOKENS.STATUS_OK,
                                                        borderColor: HMI_DESIGN_TOKENS.STATUS_OK,
                                                        boxShadow: HMI_DESIGN_TOKENS.BTN_SUCCESS_SHADOW,
                                                        padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_PRIMARY}px`,
                                                    }}
                                                >
                                                    确认报工
                                                </Button>
                                            </Form.Item>
                                        </div>
                                    </Form>
                                    </>
                                ) : (
                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, padding: 16, textAlign: 'center' }}>请先选择工序</div>
                                )}
                            </div>
                        )}
                    </Card>
            </div>
        );
    };

    const renderMiddlePanel = () => (
        <div className="kiosk-middle-tabs" style={panelStyle} onClick={() => setFocusedNumField(null)}>
            <style>{`
                .kiosk-middle-tabs .ant-tabs { height: 100%; display: flex; flex-direction: column; min-height: 0; }
                .kiosk-middle-tabs .ant-tabs-content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
                .kiosk-middle-tabs .ant-tabs-content-holder { flex: 1; min-height: 0; display: flex; flex-direction: column; }
                .kiosk-middle-tabs .ant-tabs-tabpane { flex: 1; min-height: 0; overflow: hidden; }
                .kiosk-middle-tabs .ant-tabs-tabpane:not(.ant-tabs-tabpane-active) { display: none !important; }
                .kiosk-middle-tabs .ant-tabs-tabpane.ant-tabs-tabpane-active { display: flex !important; flex-direction: column; }
                .kiosk-middle-tabs .ant-tabs-tab { font-size: ${HMI_DESIGN_TOKENS.FONT_CARD_HEADER}px !important; font-weight: 600 !important; color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important; }
                .kiosk-middle-tabs .ant-tabs-tab .anticon { font-size: ${HMI_DESIGN_TOKENS.CARD_HEADER_ICON_SIZE}px !important; }
                .kiosk-middle-tabs .ant-tabs-nav { margin-bottom: 12px !important; padding-top: 0 !important; }
                .kiosk-middle-tabs .ant-tabs-tab { padding-top: 0 !important; }
            `}</style>
            <Tabs
                activeKey={middleTabKey}
                onChange={setMiddleTabKey}
                destroyInactiveTabPane={true}
                size="large"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                tabBarStyle={{ marginBottom: 12, paddingTop: 0, borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, minHeight: 40 }}
                items={[
                    {
                        key: 'operation',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600 }}><PlayCircleOutlined style={{ fontSize: HMI_DESIGN_TOKENS.CARD_HEADER_ICON_SIZE }} />工单操作</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                                {renderOperationTab()}
                            </div>
                        ),
                    },
                    {
                        key: 'doc',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600 }}><FileProtectOutlined style={{ fontSize: HMI_DESIGN_TOKENS.CARD_HEADER_ICON_SIZE }} />文档</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                <Segmented
                                    value={docSubTabKey}
                                    onChange={v => setDocSubTabKey(v as DocumentCenterTabKey)}
                                    options={[
                                        { label: '作业指导书', value: 'sop' },
                                        { label: '图纸', value: 'drawings' },
                                        { label: '代码', value: 'cnc' },
                                        { label: '附件', value: 'attachments' },
                                    ]}
                                    style={{ marginBottom: 12, flexShrink: 0, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600 }}
                                />
                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <DocumentCenter {...docCenterProps} singleTab={docSubTabKey} style={{ height: '100%', minWidth: 0 }} />
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: 'wip',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600 }}><UnorderedListOutlined style={{ fontSize: HMI_DESIGN_TOKENS.CARD_HEADER_ICON_SIZE }} />在制品跟踪</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0 }}>
                                {renderWipTab()}
                            </div>
                        ),
                    },
                ]}
            />
        </div>
    );

    const isRunning = activeOperation?.status === 'processing';
    const handleStartEnd = () => {
        if (isRunning) {
            addRecentOp('结束', activeOperation?.name);
            message.info('结束操作（可在此接入结束逻辑）');
        } else {
            handleStart();
        }
    };
    const handlePauseResume = () => {
        setIsPaused(p => !p);
        addRecentOp(isPaused ? '继续' : '暂停');
        message.info(isPaused ? '已继续' : '已暂停');
    };
    const handleCall = () => {
        addRecentOp('呼叫');
        message.info('已发起呼叫');
    };

    const handleKeypadInput = (field: string, action: 'digit' | 'backspace' | 'clear', value?: string) => {
        const v = form.getFieldValue(field);
        const str = String(v ?? '');
        let next: string;
        if (action === 'clear') next = '0';
        else if (action === 'backspace') next = str.length <= 1 ? '0' : str.slice(0, -1);
        else if (value === '.') {
            if (str.includes('.')) return;
            next = str === '0' || str === '' ? '0.' : str + '.';
        } else {
            next = str === '0' && !str.includes('.') && value !== '0' ? (value ?? '0') : str + (value ?? '0');
        }
        form.setFieldValue(field, next === '.' ? '0.' : next);
        // 不合格数 > 0 时弹出不良品选项
        if (field === 'unqualified_quantity') {
            const num = parseFloat(next === '.' ? '0.' : next) || 0;
            if (num > 0) {
                setDefectModalVisible(true);
            } else {
                setSelectedDefectType(null);
            }
        }
    };

    const showNumericKeypad = middleTabKey === 'operation' && !!selectedWorkOrder && !!activeOperation && !!focusedNumField;

    const renderRightPanel = () => (
        <div style={panelStyle}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {showNumericKeypad ? (
                    <>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600, marginBottom: 12 }}>
                            数字输入
                        </span>
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <NumericKeypad
                                focusedField={focusedNumField}
                                onInput={handleKeypadInput}
                                onSelectField={(k) => setFocusedNumField(k as 'qualified_quantity' | 'unqualified_quantity')}
                                fields={[
                                    { key: 'qualified_quantity', label: '合格数' },
                                    { key: 'unqualified_quantity', label: '不合格数' },
                                ]}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_CARD_HEADER, fontWeight: 600, marginBottom: 12 }}>
                            <HistoryOutlined style={{ fontSize: HMI_DESIGN_TOKENS.CARD_HEADER_ICON_SIZE }} />
                            最近操作记录
                        </span>
                        <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.04)', borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, padding: HMI_DESIGN_TOKENS.PANEL_PADDING }}>
                            {recentOps.length === 0 ? (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无记录</span>} style={{ marginTop: 24 }} />
                            ) : (
                                <List
                                    size="small"
                                    dataSource={recentOps}
                                    split={false}
                                    renderItem={(item, idx) => (
                                        <List.Item
                                            style={{
                                                border: 'none',
                                                borderBottom: idx < recentOps.length - 1 ? `1px solid ${HMI_DESIGN_TOKENS.BORDER}` : 'none',
                                                padding: '10px 0',
                                                color: HMI_DESIGN_TOKENS.TEXT_SECONDARY,
                                                fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0 }}>
                                                <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.operator || '操作员'} · {item.time}
                                                </div>
                                                <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.action}{item.detail ? ` · ${item.detail}` : ''}
                                                </div>
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    if (!stationInfo) {
        return (
            <PremiumTerminalTemplate title="生产终端 - 绑定工位">
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div
                        style={{
                            width: 500,
                            background: 'rgba(0, 12, 28, 0.95)',
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                            boxShadow: HMI_DESIGN_TOKENS.CARD_SHADOW,
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            padding: HMI_DESIGN_TOKENS.SECTION_GAP,
                        }}
                    >
                        <StationBinder onBindSuccess={() => {
                            const info = JSON.parse(localStorage.getItem(STATION_STORAGE_KEY) || '{}') as StationInfo;
                            setStationInfo(info);
                            loadWorkOrders(info.workCenterId);
                        }} />
                    </div>
                </div>
            </PremiumTerminalTemplate>
        );
    }

    return (
        <PremiumTerminalTemplate
            title="生产终端"
            operatorName={userInfo?.full_name || userInfo?.username || (stationInfo as any).operatorName || '未登录'}
            operatorAvatar={
                userInfo?.avatar 
                    ? (userInfo.avatar.startsWith('http') 
                        ? userInfo.avatar 
                        : `/api/v1/core/files/${userInfo.avatar}/download?access_token=${getToken() || ''}`)
                    : (userInfo?.username ? `https://api.dicebear.com/7.x/initials/svg?seed=${userInfo.username}` : undefined)
            }
            operatorRole={userInfo?.is_tenant_admin ? '管理员' : '操作员'}
            operatorEmail={userInfo?.email}
            stationName={stationInfo.stationName}
            stationWorkshop={stationInfo.workshopName}
            stationLine={stationInfo.lineName}
            stationArea={(stationInfo as any).areaName}
            deviceName={(stationInfo as any).deviceName || '未连接'}
            headerExtra={
                <div className="header-extra-buttons" style={{ display: 'flex', gap: HMI_DESIGN_TOKENS.BUTTON_GAP }}>
                    <Button icon={<ReloadOutlined />} onClick={() => loadWorkOrders(stationInfo?.workCenterId)}>刷新</Button>
                    <Button icon={<SwapOutlined />} onClick={handleSwitchStation}>切换工位</Button>
                </div>
            }
        >
            <style>{`
                .kiosk-modal-terminal-bg .ant-modal-content {
                    background: linear-gradient(180deg, #0f2847 0%, #0a1f3c 40%, #061428 70%, #000814 100%) !important;
                }
                .kiosk-modal-terminal-bg .ant-modal-header { background: transparent !important; }
                .kiosk-modal-terminal-bg .ant-modal-body { background: transparent !important; }
                .kiosk-modal-terminal-bg .ant-modal-footer { background: transparent !important; }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: HMI_DESIGN_TOKENS.SECTION_GAP, flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
                {loadError && (
                    <Alert
                        type="error"
                        title={loadError}
                        showIcon
                        closable
                        onClose={() => setLoadError(null)}
                        style={{ flexShrink: 0 }}
                    />
                )}
                {/* 指标条：统一底条，轻量分隔线 */}
                <div
                    onClick={() => setFocusedNumField(null)}
                    style={{
                    display: 'flex',
                    flexShrink: 0,
                    height: HMI_LAYOUT.METRICS_HEIGHT,
                    minHeight: HMI_LAYOUT.METRICS_HEIGHT,
                    background: HMI_DESIGN_TOKENS.BG_CARD,
                    borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                    border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                }}>
                    {[
                        { label: '工单数', value: String(filteredWorkOrders.length), valueColor: HMI_DESIGN_TOKENS.STATUS_INFO },
                        { label: '计划/已报', planValue: selectedWorkOrder?.quantity ?? '—', reportedValue: selectedWorkOrder?.completed_quantity ?? 0 },
                        { label: '合格率', value: selectedWorkOrder && (selectedWorkOrder.completed_quantity ?? 0) > 0 ? `${Math.round(((selectedWorkOrder.qualified_quantity ?? ((selectedWorkOrder.completed_quantity ?? 0) - (selectedWorkOrder.unqualified_quantity ?? 0))) / (selectedWorkOrder.completed_quantity ?? 1)) * 100)}%` : '—', valueColor: selectedWorkOrder && (selectedWorkOrder.completed_quantity ?? 0) > 0 ? HMI_DESIGN_TOKENS.STATUS_OK : HMI_DESIGN_TOKENS.TEXT_TERTIARY },
                        { label: '质检', value: '—', valueColor: HMI_DESIGN_TOKENS.TEXT_TERTIARY },
                        { label: '当前状态', value: currentStatusLabel, valueColor: currentStatusLabel === '执行中' ? token.colorWarning : currentStatusLabel === '已完成' ? token.colorSuccess : HMI_DESIGN_TOKENS.TEXT_PRIMARY },
                    ].map((item, i) => {
                        const valueEl = 'planValue' in item ? (
                            <span style={{ fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, fontWeight: 600 }}>
                                <span style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY }}>{item.planValue}</span>
                                <span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, margin: '0 4px' }}>/</span>
                                <span style={{ color: HMI_DESIGN_TOKENS.STATUS_OK }}>{item.reportedValue}</span>
                            </span>
                        ) : (
                            <div style={{ color: item.valueColor, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, fontWeight: 600 }}>{item.value}</div>
                        );
                        return (
                        <Tooltip key={i} title={item.label === '质检' ? '工序检验数据待对接' : undefined}>
                            <div key={i} style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                padding: '0 16px',
                                borderRight: i < 4 ? `1px solid ${HMI_DESIGN_TOKENS.BORDER}` : 'none',
                                cursor: item.label === '质检' ? 'help' : 'default',
                            }}>
                                <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: 12, marginBottom: 2 }}>{item.label}</div>
                                {valueEl}
                            </div>
                        </Tooltip>
                    );})}
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `${HMI_LAYOUT.LEFT_PANEL_WIDTH}px 1fr ${HMI_LAYOUT.RIGHT_PANEL_WIDTH}px`,
                    gridTemplateRows: '1fr',
                    gap: HMI_DESIGN_TOKENS.SECTION_GAP,
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    overflow: 'hidden',
                    alignContent: 'stretch',
                }}>
                    {renderLeftPanel()}
                    {renderMiddlePanel()}
                    {renderRightPanel()}
                </div>
                {/* 底部操作栏：始终显示，未选工单时置灰辅助功能 */}
                <div
                    onClick={() => setFocusedNumField(null)}
                    style={{
                        flexShrink: 0,
                        height: HMI_LAYOUT.FOOTER_HEIGHT,
                        minHeight: HMI_LAYOUT.FOOTER_HEIGHT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: HMI_DESIGN_TOKENS.BUTTON_GAP,
                        background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                        borderTop: `2px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                    }}>
                    <Button
                        type="primary"
                        disabled={!selectedWorkOrder}
                        icon={isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
                        onClick={handleStartEnd}
                        style={{
                            minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            height: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_PRIMARY}px`,
                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                            background: !selectedWorkOrder ? undefined : (isRunning ? undefined : HMI_DESIGN_TOKENS.STATUS_OK),
                            borderColor: !selectedWorkOrder ? undefined : (isRunning ? undefined : HMI_DESIGN_TOKENS.STATUS_OK),
                            boxShadow: isRunning ? HMI_DESIGN_TOKENS.BTN_PRIMARY_SHADOW : HMI_DESIGN_TOKENS.BTN_SUCCESS_SHADOW,
                        }}
                    >
                        {isRunning ? '结束' : '开始'}
                    </Button>
                    {activeOperation?.status === 'processing' && (
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={handleReport}
                            style={{
                                minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                height: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_PRIMARY}px`,
                                background: HMI_DESIGN_TOKENS.STATUS_OK,
                                borderColor: HMI_DESIGN_TOKENS.STATUS_OK,
                                fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                                boxShadow: HMI_DESIGN_TOKENS.BTN_SUCCESS_SHADOW,
                            }}
                        >
                            完成报工
                        </Button>
                    )}
                    <Button
                        icon={<PauseCircleOutlined />}
                        disabled={!selectedWorkOrder}
                        onClick={handlePauseResume}
                        style={{
                            minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            height: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_SECONDARY}px`,
                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                            background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            color: selectedWorkOrder ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : 'rgba(255,255,255,0.25)',
                        }}
                    >
                        {isPaused ? '继续' : '暂停'}
                    </Button>
                    <Button
                        icon={<AlertOutlined />}
                        onClick={handleCall}
                        style={{
                            minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            height: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_SECONDARY}px`,
                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                            background: HMI_DESIGN_TOKENS.STATUS_ALARM,
                            borderColor: HMI_DESIGN_TOKENS.STATUS_ALARM,
                            color: '#fff',
                        }}
                    >
                        呼叫
                    </Button>

                    <Divider orientation="vertical" style={{ height: 40, borderColor: 'rgba(255,255,255,0.1)' }} />

                    <Button
                        icon={<HistoryOutlined />}
                        disabled={!selectedWorkOrder}
                        onClick={handleQuickPick}
                        style={{
                            minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            height: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_SECONDARY}px`,
                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                            background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            color: selectedWorkOrder ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : 'rgba(255,255,255,0.25)',
                        }}
                    >
                        领料
                    </Button>
                    <Button
                        icon={<PrinterOutlined />}
                        disabled={!selectedWorkOrder}
                        onClick={handlePrintWorkOrder}
                        style={{
                            minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            height: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_SECONDARY}px`,
                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                            background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            color: selectedWorkOrder ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : 'rgba(255,255,255,0.25)',
                        }}
                    >
                        打印
                    </Button>
                    <Button
                        icon={<QrcodeOutlined />}
                        disabled={!selectedWorkOrder}
                        onClick={() => { setBarcodePrintLevel('work_order'); setBarcodePrintModalVisible(true); }}
                        style={{
                            minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            height: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                            padding: `0 ${HMI_DESIGN_TOKENS.BUTTON_PADDING_SECONDARY}px`,
                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                            background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            color: selectedWorkOrder ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : 'rgba(255,255,255,0.25)',
                        }}
                    >
                        条码
                    </Button>
                </div>
            </div>
            {/* 不良品类型选择弹窗：渲染到全屏容器内，否则全屏时不可见 */}
            <Modal
                title="选择不良品类型"
                open={defectModalVisible}
                rootClassName="kiosk-modal-terminal-bg"
                getContainer={() => document.querySelector('.premium-terminal-fullscreen-wrap') || document.body}
                onCancel={() => {
                    setDefectModalVisible(false);
                }}
                styles={{
                    header: { background: 'transparent', borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY },
                    body: { background: 'transparent', color: HMI_DESIGN_TOKENS.TEXT_PRIMARY },
                    footer: { background: 'transparent', borderTop: `1px solid ${HMI_DESIGN_TOKENS.BORDER}` },
                }}
                footer={[
                    <Button key="cancel" onClick={() => setDefectModalVisible(false)}>取消</Button>,
                    <Button
                        key="ok"
                        type="primary"
                        onClick={() => {
                            if (selectedDefectType) {
                                setDefectModalVisible(false);
                            } else {
                                message.warning('请选择不良品类型');
                            }
                        }}
                    >
                        确定
                    </Button>,
                ]}
                width={480}
                destroyOnHidden
            >
                <div style={{ padding: '8px 0' }}>
                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: 12, marginBottom: 12 }}>
                        不合格数 &gt; 0 时请选择不良品类型：
                    </div>
                    {defectTypeOptions.length === 0 ? (
                        <Empty description="当前工序未关联不良品项，请联系管理员在工序中配置" />
                    ) : (
                        <Radio.Group
                            value={selectedDefectType ?? undefined}
                            onChange={(e) => setSelectedDefectType(e.target.value)}
                            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}
                        >
                            {defectTypeOptions.map((opt) => (
                                <Radio
                                    key={opt.code}
                                    value={opt.code}
                                    style={{ fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}
                                >
                                    {opt.name} ({opt.code})
                                </Radio>
                            ))}
                        </Radio.Group>
                    )}
                </div>
            </Modal>
            {/* 作业指导书弹窗 */}
            <Modal
                title="作业指导书"
                open={sopModalVisible}
                rootClassName="kiosk-modal-terminal-bg"
                onCancel={() => setSopModalVisible(false)}
                footer={null}
                width={720}
                destroyOnHidden
                getContainer={() => document.querySelector('.premium-terminal-fullscreen-wrap') || document.body}
                styles={{
                    header: { background: 'transparent', borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY },
                    body: { background: 'transparent', color: HMI_DESIGN_TOKENS.TEXT_PRIMARY },
                }}
            >
                <Tabs
                    activeKey={sopModalTab}
                    onChange={(k) => setSopModalTab(k as 'static' | 'guided')}
                    items={[
                        {
                            key: 'static',
                            label: '图文作业指导（静态）',
                            children: (
                                <div style={{ padding: '16px 0', minHeight: 320, maxHeight: '60vh', overflowY: 'auto' }}>
                                    {docCenterProps.sopContent ? (
                                        <Typography.Paragraph style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, lineHeight: 1.8 }}>
                                            {docCenterProps.sopContent}
                                        </Typography.Paragraph>
                                    ) : (
                                        <Empty description="暂无图文作业指导" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 48 }} />
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'guided',
                            label: '分步作业指导（引导式）',
                            children: (
                                <div style={{ padding: '16px 0', minHeight: 320, maxHeight: '60vh', overflowY: 'auto' }}>
                                    <Empty description="分步引导式作业指导开发中" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 48 }} />
                                </div>
                            ),
                        },
                    ]}
                />
            </Modal>
            {/* 报工参数弹窗 */}
            <Modal
                title="报工参数采集"
                open={paramModalVisible}
                rootClassName="kiosk-modal-terminal-bg"
                onCancel={() => setParamModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setParamModalVisible(false)}>关闭</Button>,
                ]}
                width={640}
                destroyOnHidden
                getContainer={() => document.querySelector('.premium-terminal-fullscreen-wrap') || document.body}
                styles={{
                    header: { background: 'transparent', borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY },
                    body: { background: 'transparent', color: HMI_DESIGN_TOKENS.TEXT_PRIMARY },
                }}
            >
                <ReportingParameterForm
                    form={form}
                    parameters={[{ id: 'quality', name: '首检', type: 'boolean', defaultValue: true }]}
                    embedded
                />
            </Modal>
            {/* 物料绑定弹窗 */}
            {lastReportingRecordId && (
                <MaterialBindingModal
                    visible={materialBindingModalVisible}
                    reportingRecordId={lastReportingRecordId}
                    onCancel={() => setMaterialBindingModalVisible(false)}
                />
            )}
            {/* 条码打印弹窗 */}
            <BarcodePrintModal
                visible={barcodePrintModalVisible}
                level={barcodePrintLevel}
                workOrderId={selectedWorkOrder?.id}
                operationId={activeOperation?.id}
                onCancel={() => setBarcodePrintModalVisible(false)}
            />
            {/* 工序检验弹窗 */}
            <ProcessInspectionModal
                visible={processInspectionModalVisible}
                workOrderId={selectedWorkOrder?.id}
                operationId={activeOperation?.id}
                workOrderCode={selectedWorkOrder?.code}
                operationName={activeOperation?.name || activeOperation?.operation_name}
                onCancel={() => setProcessInspectionModalVisible(false)}
            />
        </PremiumTerminalTemplate>
    ); 
};

export default WorkOrdersKioskPage;
