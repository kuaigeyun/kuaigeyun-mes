import React, { useState } from 'react';
import { Row, Col, Button, List, Space, Typography, Tag, Divider, Tabs, Input } from 'antd';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import {
    DeleteOutlined,
    SaveOutlined,
    PlayCircleOutlined,
    AreaChartOutlined,
    TableOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ChartWidget from '../components/widgets/ChartWidget';
import DecorationWidget from '../components/widgets/DecorationWidget';
import PropertiesPanel from '../components/designer/PropertiesPanel';
import { WidgetConfig } from '../types/dashboard';
import { getDashboard, createDashboard, updateDashboard } from '../services/kuaireport';
import { WIDGET_REGISTRY, WIDGET_CATEGORIES } from '../components/designer/WidgetRegistry';

import { message } from 'antd';
import IndicatorWidget from '../components/widgets/IndicatorWidget';
import TextWidget from '../components/widgets/TextWidget';
import MediaWidget from '../components/widgets/MediaWidget';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const { Text, Title } = Typography;

const DashboardDesigner: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');

    const [name, setName] = useState('新建看板');
    const [layout, setLayout] = useState<any[]>([]);
    const [widgets, setWidgets] = useState<Record<string, WidgetConfig>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [counter, setCounter] = useState(1);
    const [saving, setSaving] = useState(false);

    // useContainerWidth hook for v2
    const { width, containerRef, mounted } = useContainerWidth();

    // 加载数据
    React.useEffect(() => {
        if (id) {
            loadDashboard(id);
        }
    }, [id]);

    const loadDashboard = async (dashboardId: string) => {
        try {
            const res = await getDashboard(dashboardId);
            if (res) {
                setName(res.name);
                setLayout(res.layout_config || []);
                setWidgets(res.widgets_config || {});
                // 设置 counter 为最大 ID + 1
                const ids = Object.keys(res.widgets_config || {}).map(Number).filter(n => !isNaN(n));
                if (ids.length > 0) setCounter(Math.max(...ids) + 1);
            }
        } catch (error) {
            message.error('加载看板失败');
        }
    };

    const saveDashboard = async () => {
        setSaving(true);
        try {
            const data = {
                name,
                code: id ? undefined : `DB_${Date.now()}`,
                layout_config: layout,
                widgets_config: widgets,
                status: 'PUBLISHED'
            };

            if (id) {
                await updateDashboard(id, data);
                message.success('更新成功');
            } else {
                const res = await createDashboard(data);
                message.success('保存成功');
                if (res?.id) navigate(`?id=${res.id}`, { replace: true });
            }
        } catch (error) {
            message.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const onLayoutChange = (newLayout: any) => {
        setLayout([...newLayout]);
    };

    const removeWidget = (id: string) => {
        setLayout(layout.filter(l => l.i !== id));
        const newWidgets = { ...widgets };
        delete newWidgets[id];
        setWidgets(newWidgets);
        if (selectedId === id) setSelectedId(null);
    };

    const updateWidget = (id: string, updates: Partial<WidgetConfig>) => {
        setWidgets({
            ...widgets,
            [id]: { ...widgets[id], ...updates }
        });
    };

    const renderWidgetContent = (config: WidgetConfig) => {
        const mockData = [
            { x: '1月', y: 30, value: 30, type: 'A', col1: '数据1', col2: '100' },
            { x: '2月', y: 40, value: 40, type: 'A', col1: '数据2', col2: '200' },
            { x: '3月', y: 35, value: 35, type: 'A', col1: '数据3', col2: '150' },
            { x: '4月', y: 50, value: 50, type: 'A', col1: '数据4', col2: '300' },
        ];

        switch (config.type) {
            case 'chart':
                return <ChartWidget type={config.subType as any} data={mockData} />;
            case 'decoration':
                return <DecorationWidget type="decoration" index={parseInt(config.subType.split('-')[1]) || 1} />;
            case 'border':
                return (
                    <DecorationWidget type="border" index={parseInt(config.subType.split('-')[1]) || 1}>
                        {/* 边框容器 */}
                    </DecorationWidget>
                );
            case 'indicator':
                return (
                    <IndicatorWidget
                        type={config.subType as any}
                        title={config.title}
                        value={config.value || 8888}
                        unit={config.unit}
                        props={config.props}
                    />
                );
            case 'text':
                return <TextWidget type={config.subType as any} content={config.content || config.title || ''} />;
            case 'media':
                return <MediaWidget type={config.subType as any} data={mockData} url={config.url} />;
            default:
                return <div>Unknown Widget: {config.type}</div>;
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a1120', color: '#fff' }}>
            {/* 顶栏 */}
            <div style={{
                height: '50px',
                background: '#111d33',
                borderBottom: '1px solid #1f2d4d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}>
                <Space>
                    <Button type="text" onClick={() => navigate('../dashboards')} style={{ color: '#fff' }}>←</Button>
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        variant="borderless"
                        style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold', width: '200px' }}
                    />
                </Space>
                <Space>
                    <Button
                        key="preview"
                        icon={<PlayCircleOutlined />}
                        onClick={() => id && navigate(`../dashboard-view?id=${id}`)}
                        disabled={!id}
                        ghost
                    >
                        预览
                    </Button>
                    <Button
                        key="save"
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={saveDashboard}
                    >
                        保存设计
                    </Button>
                </Space>
            </div>

            {/* 工具栏 */}
            <div style={{
                height: '40px',
                background: '#1a263e',
                borderBottom: '1px solid #1f2d4d',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '16px'
            }}>
                <Space split={<Divider type="vertical" style={{ borderColor: '#303030' }} />}>
                    <Space>
                        <Button size="small" ghost icon={<AreaChartOutlined />} title="对齐" />
                        <Button size="small" ghost icon={<TableOutlined />} title="辅助网格" />
                    </Space>
                    <Space>
                        <Button size="small" ghost onClick={() => { }} disabled>撤销</Button>
                        <Button size="small" ghost onClick={() => { }} disabled>恢复</Button>
                    </Space>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>画布比例: 100%</Text>
                </Space>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* 左侧组件库 */}
                <div style={{ width: '260px', background: '#141414', borderRight: '1px solid #303030', display: 'flex', flexDirection: 'column' }}>
                    <Tabs
                        defaultActiveKey="widgets"
                        centered
                        items={[
                            {
                                key: 'widgets',
                                label: '组件',
                                children: (
                                    <div style={{ padding: '0 12px', overflowY: 'auto', height: 'calc(100vh - 100px)' }}>
                                        {WIDGET_CATEGORIES.map(cat => (
                                            <div key={cat.key} style={{ marginBottom: '16px' }}>
                                                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginBottom: '8px', padding: '0 4px' }}>
                                                    {cat.icon} <span style={{ marginLeft: '4px' }}>{cat.label}</span>
                                                </div>
                                                <Row gutter={[8, 8]}>
                                                    {WIDGET_REGISTRY.filter(w => w.category === cat.key).map(widget => (
                                                        <Col span={12} key={widget.subType}>
                                                            <div
                                                                onClick={() => {
                                                                    const id = String(counter);
                                                                    setCounter(counter + 1);
                                                                    const newItem: any = {
                                                                        i: id,
                                                                        x: 0,
                                                                        y: 0,
                                                                        w: widget.defaultSize.w,
                                                                        h: widget.defaultSize.h
                                                                    };
                                                                    setLayout([...layout, newItem]);
                                                                    setWidgets({
                                                                        ...widgets,
                                                                        [id]: { id, type: widget.type, subType: widget.subType, title: widget.title }
                                                                    });
                                                                    setSelectedId(id);
                                                                }}
                                                                className="widget-item-box"
                                                            >
                                                                <div style={{ fontSize: '20px', color: '#1890ff' }}>{widget.icon}</div>
                                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>{widget.title}</div>
                                                            </div>
                                                        </Col>
                                                    ))}
                                                </Row>
                                            </div>
                                        ))}
                                    </div>
                                )
                            },
                            {
                                key: 'layers',
                                label: '图层',
                                children: (
                                    <div style={{ padding: '12px', color: '#fff' }}>
                                        <List
                                            size="small"
                                            dataSource={layout}
                                            renderItem={item => (
                                                <List.Item
                                                    className={`layer-item ${selectedId === item.i ? 'active' : ''}`}
                                                    onClick={() => setSelectedId(item.i)}
                                                >
                                                    <Space style={{ color: 'rgba(255,255,255,0.85)' }}>
                                                        <Tag color="blue" style={{ margin: 0 }}>{widgets[item.i]?.type || 'N/A'}</Tag>
                                                        <span style={{ fontSize: '12px' }}>{widgets[item.i]?.title || item.i}</span>
                                                    </Space>
                                                    <DeleteOutlined
                                                        onClick={(e) => { e.stopPropagation(); removeWidget(item.i); }}
                                                        style={{ color: '#ff4d4f' }}
                                                    />
                                                </List.Item>
                                            )}
                                        />
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>

                {/* 中间画布区域 */}
                <div style={{ flex: 1, position: 'relative', overflow: 'auto', background: '#050a0f' }} onClick={() => setSelectedId(null)}>
                    <div ref={containerRef as any} style={{
                        minHeight: '100%',
                        width: '100%',
                        position: 'absolute',
                        padding: '24px',
                        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 0)',
                        backgroundSize: '30px 30px',
                    }}>
                        {mounted && (
                            <ResponsiveGridLayout
                                className="layout"
                                layouts={{ lg: layout }}
                                width={width}
                                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                                rowHeight={30}
                                onLayoutChange={onLayoutChange}
                                dragConfig={{ handle: ".drag-handle" }}
                                margin={[10, 10]}
                            >
                                {layout.map(item => {
                                    const widget = widgets[item.i];
                                    const isSelected = selectedId === item.i;
                                    return (
                                        <div
                                            key={item.i}
                                            onClick={(e) => { e.stopPropagation(); setSelectedId(item.i); }}
                                            style={{
                                                background: widget?.type === 'border' ? 'transparent' : 'rgba(16, 22, 30, 0.8)',
                                                border: isSelected ? '1px solid #00f2ff' : '1px solid rgba(0, 242, 255, 0.1)',
                                                boxShadow: isSelected ? '0 0 10px rgba(0, 242, 255, 0.3)' : 'none',
                                                borderRadius: '2px',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}
                                        >
                                            <div className="drag-handle" style={{
                                                padding: '0 8px',
                                                cursor: 'move',
                                                background: isSelected ? 'rgba(0, 242, 255, 0.2)' : 'transparent',
                                                color: isSelected ? '#00f2ff' : 'transparent',
                                                fontSize: '11px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                height: '20px',
                                                transition: 'all 0.3s'
                                            }}>
                                                <span>{widget?.title || `ID: ${item.i}`}</span>
                                                {isSelected && (
                                                    <DeleteOutlined
                                                        style={{ cursor: 'pointer', color: '#ff4d4f' }}
                                                        onClick={(e) => { e.stopPropagation(); removeWidget(item.i); }}
                                                    />
                                                )}
                                            </div>
                                            <div style={{ flex: 1, padding: widget?.type === 'border' ? 0 : '8px', overflow: 'hidden' }}>
                                                {widget ? renderWidgetContent(widget) : item.i}
                                            </div>
                                        </div>
                                    );
                                })}
                            </ResponsiveGridLayout>
                        )}
                    </div>
                </div>

                {/* 右侧属性面板 */}
                <div style={{ width: '300px', background: '#141414', borderLeft: '1px solid #303030', overflowY: 'auto' }}>
                    <div style={{ padding: '16px' }}>
                        <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
                            {selectedId ? '组件属性' : '大屏配置'}
                        </Title>
                        {selectedId ? (
                            <PropertiesPanel
                                selectedWidget={widgets[selectedId]}
                                onChange={updateWidget}
                            />
                        ) : (
                            <div style={{ color: 'rgba(255,255,255,0.45)' }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div>大屏名称: {name}</div>
                                    <div>组件总数: {layout.length}</div>
                                    <Divider style={{ borderColor: '#303030' }} />
                                    <Text style={{ color: '#888' }}>点击组件开始编辑属性</Text>
                                </Space>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .widget-item-box {
                    background: #1f1f1f;
                    border: 1px solid #303030;
                    border-radius: 4px;
                    padding: 8px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .widget-item-box:hover {
                    border-color: #1890ff;
                    background: #262626;
                }
                .layer-item {
                    border-bottom: 1px solid #303030;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .layer-item:hover {
                    background: #1f1f1f;
                }
                .layer-item.active {
                    background: #111b26;
                }
                .ant-tabs-tab { color: rgba(255,255,255,0.45) !important; }
                .ant-tabs-tab-active .ant-tabs-tab-btn { color: #1890ff !important; }
                
                .dashboard-table .ant-table {
                    background: transparent !important;
                    color: #fff !important;
                }
                .dashboard-table .ant-table-thead > tr > th {
                    background: rgba(255,255,255,0.05) !important;
                    color: rgba(255,255,255,0.85) !important;
                    border-bottom: 1px solid #303030 !important;
                }
                .dashboard-table .ant-table-tbody > tr > td {
                    border-bottom: 1px solid #303030 !important;
                    color: rgba(255,255,255,0.85) !important;
                }
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
            `}</style>
        </div>
    );
};

export default DashboardDesigner;
