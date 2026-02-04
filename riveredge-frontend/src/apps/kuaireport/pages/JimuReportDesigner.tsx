import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, message, Spin, Layout, Typography, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
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

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;

    // 积木报表后端服务地址
    // 使用相对路径，通过 Vite 代理转发，实现视觉上的“融合”效果
    const jimuReportBaseUrl = '/jeecg-boot/jmreport/view';

    // 如果有 ID，则是编辑模式，否则是新建模式
    // 注意：积木报表的 ID 通常是 UUID
    const reportUrl = id
        ? `${jimuReportBaseUrl}/${id}`
        : `/jeecg-boot/jmreport/list`; // 如果没有 ID，默认跳转到列表或新建页

    return (
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
            <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', height: '50px', lineHeight: '50px' }}>
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回列表</Button>
                    <Title level={5} style={{ margin: 0 }}>{report?.name || '报表设计器'}</Title>
                </Space>
                <div style={{ fontSize: '12px', color: '#999' }}>
                    Powered by JimuReport Community
                </div>
            </Header>
            <Content style={{ position: 'relative', height: 'calc(100vh - 50px)' }}>
                {loading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spin size="large" tip="加载设计器中..." />
                    </div>
                ) : (
                    <iframe
                        src={reportUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="JimuReport Designer"
                    />
                )}
            </Content>
        </Layout>
    );
};

export default JimuReportDesigner;
