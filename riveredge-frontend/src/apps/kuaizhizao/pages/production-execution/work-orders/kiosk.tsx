/**
 * 高级生产终端 (Premium Production Terminal)
 * 
 * Author: Antigravity
 * Date: 2026-02-05
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Tag, message, Input, Empty, 
  List, Typography, Form, Row, Col, Progress, Statistic,
  Tooltip, Tabs
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
  FileImageOutlined,
  CodeOutlined,
  PaperClipOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

import { PremiumTerminalTemplate, HMI_DESIGN_TOKENS, TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { workOrderApi, reportingApi } from '../../../services/production';
import StationBinder, { STATION_STORAGE_KEY, StationInfo } from '../../../components/StationBinder';
import ReportingParameterForm from './components/ReportingParameterForm';
import DocumentCenter from './components/DocumentCenter';

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
  planned_start_date?: string;
  planned_end_date?: string;
}

const WorkOrdersKioskPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
    
    // 选中状态
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
    const [operations, setOperations] = useState<any[]>([]);
    const [activeOperation, setActiveOperation] = useState<any>(null);
    const [opsLoading, setOpsLoading] = useState(false);
    const [form] = Form.useForm();
    const [isPaused, setIsPaused] = useState(false);
    const [recentOps, setRecentOps] = useState<Array<{ time: string; action: string; detail?: string }>>([]);
    const [middleTabKey, setMiddleTabKey] = useState<string>('operation');

    useEffect(() => {
        const savedStation = localStorage.getItem(STATION_STORAGE_KEY);
        if (savedStation) {
            try {
                const info = JSON.parse(savedStation);
                setStationInfo(info);
                loadWorkOrders(info.stationId);
            } catch (e) {
                localStorage.removeItem(STATION_STORAGE_KEY);
            }
        }
    }, []);

    const loadWorkOrders = async (stationId?: number) => {
        setLoading(true);
        try {
            const params: any = { skip: 0, limit: 100 };
            if (stationId) params.work_center_id = stationId;
            const response = await workOrderApi.list(params);
            const data = Array.isArray(response) ? response : (response?.data || response?.items || []);
            setWorkOrders(data);
            if (selectedWorkOrder) {
                const updated = data.find((wo: WorkOrder) => wo.id === selectedWorkOrder.id);
                if (updated) setSelectedWorkOrder(updated);
            }
        } catch (error) {
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
                const ops = await workOrderApi.getOperations(workOrder.id.toString());
                setOperations(ops || []);
                const current = ops.find((o: any) => o.status === 'processing') || ops.find((o: any) => o.status === 'pending');
                setActiveOperation(current || ops[0]);
            } catch (error) {
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
        setRecentOps(prev => [{ time, action, detail }, ...prev].slice(0, 20));
    };

    const handleStart = async () => {
        if (!selectedWorkOrder?.id || !activeOperation?.id) return;
        try {
            setOpsLoading(true);
            await workOrderApi.startOperation(selectedWorkOrder.id.toString(), activeOperation.id);
            addRecentOp('开始执行', activeOperation.name);
            message.success('工序已开始');
            loadWorkOrders(stationInfo?.stationId);
            handleSelectWorkOrder(selectedWorkOrder);
        } catch (error) {
            message.error('操作失败');
        } finally {
            setOpsLoading(false);
        }
    };

    const handleReport = async () => {
        try {
            const values = await form.validateFields();
            if (!activeOperation || !selectedWorkOrder) return;
            
            setOpsLoading(true);
            await reportingApi.create({
                work_order_id: selectedWorkOrder.id,
                operation_id: activeOperation.id,
                quantity: values.report_quantity || 1,
                parameters: values,
            });
            
            addRecentOp('完成报工', `数量 ${values.report_quantity || 1}`);
            message.success('报工成功');
            form.resetFields();
            loadWorkOrders(stationInfo?.stationId);
            handleSelectWorkOrder(selectedWorkOrder);
        } catch (error) {
            // validate error
        } finally {
            setOpsLoading(false);
        }
    };

    const getStatusColor = (status?: string): string => {
        const map: Record<string, string> = {
            '已下达': HMI_DESIGN_TOKENS.STATUS_INFO,
            '生产中': HMI_DESIGN_TOKENS.STATUS_WARNING,
            '已完成': HMI_DESIGN_TOKENS.STATUS_OK,
            'pending': HMI_DESIGN_TOKENS.STATUS_INFO,
            'processing': HMI_DESIGN_TOKENS.STATUS_WARNING,
            'completed': HMI_DESIGN_TOKENS.STATUS_OK,
        };
        return map[status || ''] || HMI_DESIGN_TOKENS.TEXT_SECONDARY;
    };

    const filteredWorkOrders = workOrders.filter(wo => 
        !searchKeyword || 
        wo.code?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        wo.product_name?.toLowerCase().includes(searchKeyword.toLowerCase())
    );

    const renderLeftPanel = () => (
        <div
            style={{
                height: '100%',
                minWidth: 280,
                background: HMI_DESIGN_TOKENS.BG_GRADIENT_SIDEBAR,
                borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
                border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <div style={{ padding: '16px 12px 12px 16px', borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: 22, fontWeight: 600 }}>
                        <UnorderedListOutlined style={{ fontSize: 20 }} />
                        工单列表
                    </span>
                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>共 {filteredWorkOrders.length} 项</div>
                </div>
                <Search
                    placeholder="搜索编号或产品..."
                    onChange={e => setSearchKeyword(e.target.value)}
                    style={{ background: HMI_DESIGN_TOKENS.BG_CARD, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS }}
                />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px 16px' }}>
                <List
                    dataSource={filteredWorkOrders}
                    loading={loading}
                    locale={{ emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>选择工位后加载工单</span>}
                        />
                    ) }}
                    renderItem={wo => {
                        const isSelected = selectedWorkOrder?.id === wo.id;
                        const pct = Math.round(((wo.completed_quantity || 0) / (wo.quantity || 1)) * 100);
                        const isComplete = (wo.status === 'completed' || wo.status === '已完成');
                        return (
                            <List.Item
                                onClick={() => handleSelectWorkOrder(wo)}
                                style={{
                                    cursor: 'pointer',
                                    minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                    padding: '16px 12px 16px 16px',
                                    borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                                    marginBottom: 8,
                                    borderLeft: `4px solid ${isSelected ? HMI_DESIGN_TOKENS.STATUS_INFO : 'transparent'}`,
                                    background: isSelected ? `rgba(22, 119, 255, 0.2)` : 'transparent',
                                    transition: 'all 0.3s',
                                }}
                            >
                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text strong style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{wo.code}</Text>
                                        <Tag color={getStatusColor(wo.status)} style={{ fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{wo.status}</Tag>
                                    </div>
                                    <div style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{wo.product_name}</div>
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

    const frostedPanelStyle: React.CSSProperties = {
        background: HMI_DESIGN_TOKENS.PANEL_FROSTED,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
        boxShadow: HMI_DESIGN_TOKENS.PANEL_GLOW,
        border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
        padding: HMI_DESIGN_TOKENS.SECTION_GAP,
        height: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    };

    const docCenterProps = {
        sopContent: selectedWorkOrder ? `操作指引：${selectedWorkOrder.code}` : undefined,
        drawings: selectedWorkOrder ? [{ id: '1', name: '图纸.png', url: '' }] : [],
    };

    const renderOperationTab = () => {
        if (!selectedWorkOrder) {
            return (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
                    <Empty
                        image={
                            <span style={{ fontSize: 72, color: HMI_DESIGN_TOKENS.STATUS_INFO, opacity: 0.9 }}>
                                <UnorderedListOutlined />
                            </span>
                        }
                        description={
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_TITLE_MIN, marginBottom: 8 }}>请选择工单开始</div>
                                <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>从左侧列表选择工单</div>
                            </div>
                        }
                    />
                </div>
            );
        }

        const jobCardAccent = selectedWorkOrder.status === '生产中' || selectedWorkOrder.status === 'processing' ? HMI_DESIGN_TOKENS.STATUS_WARNING : HMI_DESIGN_TOKENS.STATUS_INFO;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: HMI_DESIGN_TOKENS.SECTION_GAP, flex: 1, minHeight: 0 }}>
                    <Card
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            borderLeft: `4px solid ${jobCardAccent}`,
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                        }}
                        bodyStyle={{ padding: 20 }}
                    >
                        <Row gutter={24} align="middle">
                            <Col flex="1">
                                <Text style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>正在执行</Text>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
                                    <Title level={2} style={{ margin: 0, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_TITLE_MIN }}>{selectedWorkOrder.code}</Title>
                                    <Tag color={jobCardAccent}>{selectedWorkOrder.product_name}</Tag>
                                </div>
                            </Col>
                            <Col>
                                <Statistic
                                    title={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>计划</Text>}
                                    value={selectedWorkOrder.quantity}
                                    valueStyle={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE }}
                                />
                            </Col>
                            <Col>
                                <Statistic
                                    title={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>已报</Text>}
                                    value={selectedWorkOrder.completed_quantity || 0}
                                    valueStyle={{ color: HMI_DESIGN_TOKENS.STATUS_OK, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE }}
                                />
                            </Col>
                        </Row>
                    </Card>

                    <Card
                        loading={opsLoading}
                        title={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_TITLE_MIN }}>工序: {activeOperation?.name || '未选择'}</Text>}
                        extra={
                            <div style={{ display: 'flex', gap: 12 }}>
                                {activeOperation?.status === 'pending' && (
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<PlayCircleOutlined />}
                                        onClick={handleStart}
                                        style={{
                                            minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                                            height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                                            padding: '0 24px',
                                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
                                            boxShadow: HMI_DESIGN_TOKENS.BTN_PRIMARY_SHADOW,
                                        }}
                                    >
                                        开始执行
                                    </Button>
                                )}
                                {activeOperation?.status === 'processing' && (
                                    <Button
                                        type="primary"
                                        icon={<CheckCircleOutlined />}
                                        onClick={handleReport}
                                        style={{
                                            minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                                            height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                                            padding: '0 24px',
                                            background: HMI_DESIGN_TOKENS.STATUS_OK,
                                            borderColor: HMI_DESIGN_TOKENS.STATUS_OK,
                                            fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
                                            boxShadow: HMI_DESIGN_TOKENS.BTN_SUCCESS_SHADOW,
                                        }}
                                    >
                                        完成报工
                                    </Button>
                                )}
                            </div>
                        }
                        style={{ flex: 1, minHeight: 0, background: 'rgba(255,255,255,0.04)', border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS }}
                        bodyStyle={{ padding: 24, overflowY: 'auto' }}
                    >
                        {activeOperation ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: HMI_DESIGN_TOKENS.SECTION_GAP }}>
                                <Form form={form} layout="vertical">
                                    <Form.Item name="report_quantity" label={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>报工数量</Text>} initialValue={1}>
                                        <Input
                                            type="number"
                                            style={{ height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, textAlign: 'center', background: HMI_DESIGN_TOKENS.BG_CARD, color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS }}
                                        />
                                    </Form.Item>
                                    <ReportingParameterForm form={form} parameters={[{ id: 'quality', name: '首检', type: 'boolean', defaultValue: true }]} />
                                </Form>
                                <div>
                                    <Text style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, display: 'block', marginBottom: 12 }}>流转进度</Text>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {operations.map((op, idx) => (
                                            <Tooltip title={op.name} key={op.id}>
                                                <div
                                                    onClick={() => setActiveOperation(op)}
                                                    style={{
                                                        minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE,
                                                        padding: '8px 14px',
                                                        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
                                                        background: op.id === activeOperation.id ? HMI_DESIGN_TOKENS.STATUS_INFO : (op.status === 'completed' ? HMI_DESIGN_TOKENS.STATUS_OK : HMI_DESIGN_TOKENS.BG_ELEVATED),
                                                        color: op.id === activeOperation.id || op.status === 'completed' ? HMI_DESIGN_TOKENS.TEXT_PRIMARY : HMI_DESIGN_TOKENS.TEXT_SECONDARY,
                                                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                                                        cursor: 'pointer',
                                                        border: op.id === activeOperation.id ? `2px solid ${HMI_DESIGN_TOKENS.TEXT_PRIMARY}` : '2px solid transparent',
                                                    }}
                                                >
                                                    {idx + 1}
                                                </div>
                                            </Tooltip>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无工序</span>} />}
                    </Card>
            </div>
        );
    };

    const renderMiddlePanel = () => (
        <div className="kiosk-middle-tabs" style={frostedPanelStyle}>
            <style>{`
                .kiosk-middle-tabs .ant-tabs { height: 100%; display: flex; flex-direction: column; min-height: 0; }
                .kiosk-middle-tabs .ant-tabs-content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
                .kiosk-middle-tabs .ant-tabs-content-holder { flex: 1; min-height: 0; display: flex; flex-direction: column; }
                .kiosk-middle-tabs .ant-tabs-tabpane { flex: 1; min-height: 0; overflow: hidden; }
                .kiosk-middle-tabs .ant-tabs-tabpane:not(.ant-tabs-tabpane-active) { display: none !important; }
                .kiosk-middle-tabs .ant-tabs-tabpane.ant-tabs-tabpane-active { display: flex !important; flex-direction: column; }
            `}</style>
            <Tabs
                activeKey={middleTabKey}
                onChange={setMiddleTabKey}
                destroyInactiveTabPane={true}
                size="large"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                tabBarStyle={{ marginBottom: 12, borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, minHeight: 40 }}
                items={[
                    {
                        key: 'operation',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}><PlayCircleOutlined />工单操作</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                                {renderOperationTab()}
                            </div>
                        ),
                    },
                    {
                        key: 'sop',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}><FileProtectOutlined />作业指导书</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0 }}>
                                <DocumentCenter {...docCenterProps} singleTab="sop" style={{ height: '100%', minWidth: 0 }} />
                            </div>
                        ),
                    },
                    {
                        key: 'drawings',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}><FileImageOutlined />图纸</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0 }}>
                                <DocumentCenter {...docCenterProps} singleTab="drawings" style={{ height: '100%', minWidth: 0 }} />
                            </div>
                        ),
                    },
                    {
                        key: 'cnc',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}><CodeOutlined />代码</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0 }}>
                                <DocumentCenter {...docCenterProps} singleTab="cnc" style={{ height: '100%', minWidth: 0 }} />
                            </div>
                        ),
                    },
                    {
                        key: 'attachments',
                        label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}><PaperClipOutlined />附件</span>,
                        children: (
                            <div style={{ flex: 1, minHeight: 0 }}>
                                <DocumentCenter {...docCenterProps} singleTab="attachments" style={{ height: '100%', minWidth: 0 }} />
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

    const rightPanelFrostedStyle: React.CSSProperties = {
        background: HMI_DESIGN_TOKENS.PANEL_FROSTED,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
        boxShadow: HMI_DESIGN_TOKENS.PANEL_GLOW,
        border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
        padding: HMI_DESIGN_TOKENS.SECTION_GAP,
        height: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    };

    const renderRightPanel = () => (
        <div style={rightPanelFrostedStyle}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: HMI_DESIGN_TOKENS.SECTION_GAP }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, marginBottom: 12 }}>
                    <HistoryOutlined />
                    最近操作记录
                </span>
                <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.04)', borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, padding: 12 }}>
                    {recentOps.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无记录</span>} style={{ marginTop: 24 }} />
                    ) : (
                        <List
                            size="small"
                            dataSource={recentOps}
                            renderItem={item => (
                                <List.Item style={{ border: 'none', padding: '8px 0', color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>
                                    <span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, marginRight: 8 }}>{item.time}</span>
                                    <span>{item.action}{item.detail ? ` · ${item.detail}` : ''}</span>
                                </List.Item>
                            )}
                        />
                    )}
                </div>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button
                    type="primary"
                    icon={isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
                    onClick={handleStartEnd}
                    style={{
                        flex: 1,
                        minWidth: 100,
                        minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
                        background: isRunning ? undefined : HMI_DESIGN_TOKENS.STATUS_OK,
                        borderColor: isRunning ? undefined : HMI_DESIGN_TOKENS.STATUS_OK,
                        boxShadow: isRunning ? HMI_DESIGN_TOKENS.BTN_PRIMARY_SHADOW : HMI_DESIGN_TOKENS.BTN_SUCCESS_SHADOW,
                    }}
                >
                    {isRunning ? '结束' : '开始'}
                </Button>
                <Button
                    icon={<PauseCircleOutlined />}
                    onClick={handlePauseResume}
                    style={{
                        flex: 1,
                        minWidth: 100,
                        minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
                        background: HMI_DESIGN_TOKENS.BG_ELEVATED,
                        border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                        color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
                    }}
                >
                    {isPaused ? '继续' : '暂停'}
                </Button>
                <Button
                    icon={<AlertOutlined />}
                    onClick={handleCall}
                    style={{
                        flex: 1,
                        minWidth: 100,
                        minHeight: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                        fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
                        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
                        background: HMI_DESIGN_TOKENS.STATUS_ALARM,
                        borderColor: HMI_DESIGN_TOKENS.STATUS_ALARM,
                        color: '#fff',
                    }}
                >
                    呼叫
                </Button>
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
                            background: HMI_DESIGN_TOKENS.PANEL_FROSTED,
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
                            boxShadow: HMI_DESIGN_TOKENS.PANEL_GLOW,
                            border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
                            padding: HMI_DESIGN_TOKENS.SECTION_GAP,
                        }}
                    >
                        <StationBinder onBindSuccess={() => {
                            const info = JSON.parse(localStorage.getItem(STATION_STORAGE_KEY) || '{}');
                            setStationInfo(info);
                            loadWorkOrders(info.stationId);
                        }} />
                    </div>
                </div>
            </PremiumTerminalTemplate>
        );
    }

    return (
        <PremiumTerminalTemplate
            title="生产终端"
            operatorName={(stationInfo as any).operatorName || '未登录'}
            operatorAvatar={(stationInfo as any).operatorAvatar}
            operatorRole={(stationInfo as any).operatorRole}
            stationName={stationInfo.stationName}
            stationWorkshop={stationInfo.workshopName}
            stationLine={stationInfo.lineName}
            stationArea={(stationInfo as any).areaName}
            deviceName={(stationInfo as any).deviceName || '未连接'}
            headerExtra={
                <div className="header-extra-buttons" style={{ display: 'flex', gap: 12 }}>
                    <Button icon={<ReloadOutlined />} type="primary" onClick={() => loadWorkOrders(stationInfo.stationId)}>刷新</Button>
                    <Button icon={<SwapOutlined />} onClick={handleSwitchStation}>切换工位</Button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: HMI_DESIGN_TOKENS.SECTION_GAP, height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
                {/* 指标卡行：工单数 / 计划-已报 / 当前状态 / 质检 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: HMI_DESIGN_TOKENS.SECTION_GAP, flexShrink: 0 }}>
                    <div style={{ background: HMI_DESIGN_TOKENS.BG_CARD, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG, padding: '16px 20px', boxShadow: HMI_DESIGN_TOKENS.CARD_SHADOW, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}` }}>
                        <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, marginBottom: 4 }}>工单数</div>
                        <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, fontWeight: 600 }}>{filteredWorkOrders.length}</div>
                    </div>
                    <div style={{ background: HMI_DESIGN_TOKENS.BG_CARD, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG, padding: '16px 20px', boxShadow: HMI_DESIGN_TOKENS.CARD_SHADOW, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}` }}>
                        <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, marginBottom: 4 }}>计划 / 已报</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <span style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, fontWeight: 600 }}>{selectedWorkOrder?.quantity ?? '—'}</span>
                            <span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>/</span>
                            <span style={{ color: HMI_DESIGN_TOKENS.STATUS_OK, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, fontWeight: 600 }}>{selectedWorkOrder?.completed_quantity ?? 0}</span>
                        </div>
                    </div>
                    <div style={{ background: HMI_DESIGN_TOKENS.BG_CARD, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG, padding: '16px 20px', boxShadow: HMI_DESIGN_TOKENS.CARD_SHADOW, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}` }}>
                        <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, marginBottom: 4 }}>当前状态</div>
                        <div style={{ color: currentStatusLabel === '执行中' ? HMI_DESIGN_TOKENS.STATUS_WARNING : currentStatusLabel === '已完成' ? HMI_DESIGN_TOKENS.STATUS_OK : HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, fontWeight: 600 }}>{currentStatusLabel}</div>
                    </div>
                    <div style={{ background: HMI_DESIGN_TOKENS.BG_CARD, borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG, padding: '16px 20px', boxShadow: HMI_DESIGN_TOKENS.CARD_SHADOW, border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}` }}>
                        <div style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, marginBottom: 4 }}>质检</div>
                        <div style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_FIGURE, fontWeight: 600 }}>—</div>
                    </div>
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 350px) minmax(0, 1fr) minmax(320px, 420px)',
                    gap: HMI_DESIGN_TOKENS.SECTION_GAP,
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    overflow: 'auto',
                    alignContent: 'stretch',
                }}>
                    {renderLeftPanel()}
                    {renderMiddlePanel()}
                    {renderRightPanel()}
                </div>
            </div>
        </PremiumTerminalTemplate>
    ); 
};

export default WorkOrdersKioskPage;
