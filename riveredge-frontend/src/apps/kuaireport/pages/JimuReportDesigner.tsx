import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, message, Spin, Layout, Typography, Space } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, DesktopOutlined, FileTextOutlined } from '@ant-design/icons';
import { getReport } from '../services/kuaireport';

const { Header, Content } = Layout;
const { Title } = Typography;

const JimuReportDesigner: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const id = searchParams.get('id');
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<any>(null);

    useEffect(() => {
        if (id) {
            loadReport(id);
        } else {
            setLoading(false);
            setReport({ name: '新建专业报表', report_type: 'jimu' });
        }
    }, [id]);

    const loadReport = async (reportId: string) => {
        try {
            const res = await getReport(reportId);
            setReport(res);
        } catch (error) {
            message.error('加载报表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        message.success('报表模板已保存');
    };

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;

    const isSOTracking = report?.code === 'SO_TRACKING_001';

    return (
        <Layout style={{ height: '100vh' }}>
            <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
                    <Title level={4} style={{ margin: 0 }}>{report?.name} - 专业报表设计器</Title>
                </Space>
                <Space>
                    <Button icon={<DesktopOutlined />}>预览</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存模板</Button>
                </Space>
            </Header>
            <Content style={{ background: '#f5f5f5', position: 'relative', overflow: 'auto' }}>
                <div style={{
                    margin: '40px auto',
                    background: '#fff',
                    width: '1100px',
                    minHeight: '1200px',
                    padding: '40px',
                    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
                    position: 'relative'
                }}>
                    {isSOTracking ? (
                        <div className="so-report-preview">
                            <h2 style={{ textAlign: 'center', fontSize: '24px', marginBottom: '20px' }}>销售订单执行统计与跟踪报表</h2>

                            {/* 报表汇总统计区 */}
                            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                                <div style={kpiCardStyle}>
                                    <div style={{ color: '#666', fontSize: '12px' }}>本月总订单量</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>1,280 <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#52c41a' }}>↑ 12%</span></div>
                                </div>
                                <div style={kpiCardStyle}>
                                    <div style={{ color: '#666', fontSize: '12px' }}>待发货总数</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>452</div>
                                </div>
                                <div style={kpiCardStyle}>
                                    <div style={{ color: '#666', fontSize: '12px' }}>订单准时交付率</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>94.2%</div>
                                </div>
                                <div style={kpiCardStyle}>
                                    <div style={{ color: '#666', fontSize: '12px' }}>销售回款总额</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>¥2.48M</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '10px', fontWeight: 'bold', borderLeft: '4px solid #1890ff', paddingLeft: '10px' }}>订单明细跟踪</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ background: '#f8f9fa' }}>
                                        <th style={tableHeaderStyle}>订单编码</th>
                                        <th style={tableHeaderStyle}>客户</th>
                                        <th style={tableHeaderStyle}>交货日期</th>
                                        <th style={tableHeaderStyle}>产品明细</th>
                                        <th style={tableHeaderStyle}>订单数</th>
                                        <th style={tableHeaderStyle}>已发货</th>
                                        <th style={tableHeaderStyle}>跟踪进度</th>
                                        <th style={tableHeaderStyle}>状态</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { code: 'SO2026020101', customer: '三一重工', delivery: '2026-02-15', material: '高强度螺栓 M20', qty: 1000, delivered: 400, status: '生产中' },
                                        { code: 'SO2026020102', customer: '徐工机械', delivery: '2026-02-05', material: '液压密封圈', qty: 500, delivered: 500, status: '已完成' },
                                        { code: 'SO2026020201', customer: '中联重科', delivery: '2026-02-10', material: '传动齿轮', qty: 200, delivered: 20, status: '逾期风险' }
                                    ].map((row, idx) => {
                                        const progress = (row.delivered / row.qty) * 100;
                                        return (
                                            <tr key={idx}>
                                                <td style={tableCellStyle}>{row.code}</td>
                                                <td style={tableCellStyle}>{row.customer}</td>
                                                <td style={tableCellStyle}>{row.delivery}</td>
                                                <td style={tableCellStyle}>{row.material}</td>
                                                <td style={tableCellStyle}>{row.qty}</td>
                                                <td style={tableCellStyle}>{row.delivered}</td>
                                                <td style={tableCellStyle}>
                                                    <div style={{ width: '100px', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${progress}%`, height: '100%', background: row.status === '逾期风险' ? '#ff4d4f' : '#1890ff' }} />
                                                    </div>
                                                    <div style={{ fontSize: '10px', marginTop: '4px' }}>{progress.toFixed(1)}%</div>
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '10px',
                                                        fontSize: '11px',
                                                        background: row.status === '已完成' ? '#f6ffed' : row.status === '逾期风险' ? '#fff1f0' : '#e6f7ff',
                                                        color: row.status === '已完成' ? '#52c41a' : row.status === '逾期风险' ? '#f5222d' : '#1890ff',
                                                        border: `1px solid ${row.status === '已完成' ? '#b7eb8f' : row.status === '逾期风险' ? '#ffa39e' : '#91d5ff'}`
                                                    }}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div style={{ marginTop: '40px', fontWeight: 'bold', borderLeft: '4px solid #1890ff', paddingLeft: '10px', marginBottom: '15px' }}>客户订货量分析 (统计分析)</div>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ flex: 1, border: '1px solid #eee', padding: '15px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>各产品下单分布 (饼图统计)</div>
                                    <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fcfcfc', border: '1px dashed #ddd' }}>
                                        [图表组件：产品占比分布分析]
                                    </div>
                                </div>
                                <div style={{ flex: 1, border: '1px solid #eee', padding: '15px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>近一月订单趋势 (月度汇总)</div>
                                    <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fcfcfc', border: '1px dashed #ddd' }}>
                                        [图表组件：销售额月度趋势分析]
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '50px', borderTop: '1px solid #eee', paddingTop: '10px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
                                报表生成时间：{new Date().toLocaleString()} | 系统管理员 | Powered by JimuReport
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.5
                        }}>
                            <FileTextOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '16px' }} />
                            <Title level={3}>设计器画布</Title>
                            <p>从侧边栏拖拽字段或组件到此处进行设计</p>
                        </div>
                    )}
                </div>
            </Content>
        </Layout>
    );
};

const tableHeaderStyle: React.CSSProperties = {
    border: '1px solid #e8e8e8',
    padding: '12px 8px',
    textAlign: 'left',
    fontWeight: 'bold'
};

const tableCellStyle: React.CSSProperties = {
    border: '1px solid #e8e8e8',
    padding: '12px 8px'
};

const kpiCardStyle: React.CSSProperties = {
    flex: 1,
    padding: '15px',
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

export default JimuReportDesigner;
