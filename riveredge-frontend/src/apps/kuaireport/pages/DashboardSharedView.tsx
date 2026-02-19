import React, { useState, useEffect } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, message, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ChartWidget from '../components/widgets/ChartWidget';
import DecorationWidget from '../components/widgets/DecorationWidget';
import { WidgetConfig } from '../types/dashboard';
import { getDashboardByShareToken } from '../services/kuaireport';
import IndicatorWidget from '../components/widgets/IndicatorWidget';
import TextWidget from '../components/widgets/TextWidget';
import MediaWidget from '../components/widgets/MediaWidget';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const DashboardSharedView: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [layout, setLayout] = useState<any[]>([]);
    const [widgets, setWidgets] = useState<Record<string, WidgetConfig>>({});
    const { width, containerRef, mounted } = useContainerWidth();

    useEffect(() => {
        if (token) {
            getDashboardByShareToken(token)
                .then((res) => {
                    if (res) {
                        setName(res.name);
                        setLayout(res.layout_config || []);
                        setWidgets(res.widgets_config || {});
                    }
                })
                .catch(() => message.error('加载看板失败'))
                .finally(() => setLoading(false));
        } else {
            message.error('分享链接无效');
            setLoading(false);
        }
    }, [token]);

    const renderWidgetContent = (config: WidgetConfig) => {
        const mockData = [
            { x: '1月', y: 30, value: 30, type: 'A', col1: '数据1', col2: '100' },
            { x: '2月', y: 40, value: 40, type: 'A', col1: '数据2', col2: '200' },
            { x: '3月', y: 35, value: 35, type: 'A', col1: '数据3', col2: '150' },
            { x: '4月', y: 50, value: 50, type: 'A', col1: '数据4', col2: '300' },
        ];
        switch (config.type) {
            case 'chart': return <ChartWidget type={config.subType as any} data={mockData} />;
            case 'decoration': return <DecorationWidget type="decoration" index={parseInt(config.subType.split('-')[1]) || 1} />;
            case 'border': return <DecorationWidget type="border" index={parseInt(config.subType.split('-')[1]) || 1} />;
            case 'indicator': return <IndicatorWidget type={config.subType as any} title={config.title} value={config.value || 8888} unit={config.unit} props={config.props} />;
            case 'text': return <TextWidget type={config.subType as any} content={config.content || config.title || ''} props={config.props} />;
            case 'media': return <MediaWidget type={config.subType as any} data={mockData} url={config.url} />;
            default: return <div>Unknown Widget: {config.type}</div>;
        }
    };

    if (!token) return <div style={{ padding: 60, textAlign: 'center' }}>分享链接无效</div>;
    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a0f' }}><Spin size="large" tip="加载大屏中..." /></div>;

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#050a0f', overflow: 'auto', position: 'relative', color: '#fff' }}>
            <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 100, opacity: 0.2, transition: 'opacity 0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.2'; }}>
                <Button ghost icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ borderColor: 'rgba(255,255,255,0.3)' }}>返回</Button>
                <span style={{ marginLeft: 12, fontSize: 18, fontWeight: 'bold' }}>{name}</span>
            </div>
            <div ref={containerRef as any} style={{ padding: 20 }}>
                {mounted && (
                    <ResponsiveGridLayout className="layout-view" layouts={{ lg: layout }} width={width} cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }} rowHeight={40} margin={[10, 10]} dragConfig={{ enabled: false }} resizeConfig={{ enabled: false }}>
                        {layout.map(item => {
                            const widget = widgets[item.i];
                            return (
                                <div key={item.i} style={{ background: widget?.type === 'border' ? 'transparent' : 'rgba(0,18,36,0.6)', border: '1px solid rgba(0,120,215,0.2)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ width: '100%', height: '100%' }}>{widget ? renderWidgetContent(widget) : item.i}</div>
                                </div>
                            );
                        })}
                    </ResponsiveGridLayout>
                )}
            </div>
        </div>
    );
};

export default DashboardSharedView;
