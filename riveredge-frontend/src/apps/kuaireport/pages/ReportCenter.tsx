import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Card, Row, Col, Tag, Typography, Space, Empty, Spin, message, theme } from 'antd';
import {
    PlusOutlined,
    BarChartOutlined,
    UserOutlined,
    AppstoreOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    DatabaseOutlined,
    ShareAltOutlined,
    MenuOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Modal, InputNumber } from 'antd';
import { getSystemReports, getMyReports, deleteReport, shareReport, mountReportToMenu } from '../services/kuaireport';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useToken } = theme;

type Tab = 'system' | 'my';

const ReportCenter: React.FC = () => {
    const { token } = useToken();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('system');
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [shareModal, setShareModal] = useState<{ visible: boolean; report: any; link?: string }>({ visible: false, report: null });
    const [mountModal, setMountModal] = useState<{ visible: boolean; report: any }>({ visible: false, report: null });

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const fetch = activeTab === 'system' ? getSystemReports : getMyReports;
        fetch({ limit: 50 })
            .then((res) => {
                if (!cancelled && res?.data) {
                    setReports(res.data);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    message.error(err?.message || '加载报表列表失败');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [activeTab]);

    const handleDelete = async (id: number) => {
        try {
            await deleteReport(id);
            message.success('删除成功');
            setReports((prev) => prev.filter((r) => r.id !== id));
        } catch (err: any) {
            message.error(err?.message || '删除失败');
        }
    };

    const handleShare = async (report: any, expiresDays = 30) => {
        try {
            const res = await shareReport(report.id, expiresDays);
            const baseUrl = window.location.origin;
            const link = `${baseUrl}/apps/kuaireport/reports/shared?token=${res.share_token}`;
            setShareModal({ visible: true, report, link });
        } catch (err: any) {
            message.error(err?.message || '生成分享链接失败');
        }
    };

    const handleMountToMenu = async (report: any, menuName?: string) => {
        try {
            await mountReportToMenu(report.id, menuName || report.name);
            message.success('已挂载到菜单');
            setMountModal({ visible: false, report: null });
        } catch (err: any) {
            message.error(err?.message || '挂载失败');
        }
    };

    const menuItems = [
        {
            key: 'system',
            icon: <AppstoreOutlined />,
            label: '系统报表',
        },
        {
            key: 'my',
            icon: <UserOutlined />,
            label: '我的报表',
        },
    ];

    const statusColor: Record<string, string> = {
        PUBLISHED: 'green',
        DRAFT: 'orange',
    };

    return (
        <Layout style={{ minHeight: 'calc(100vh - 56px)', background: '#f5f5f5' }}>
            {/* 左侧分类导航 */}
            <Sider width={200} style={{ background: '#fff', borderRight: `1px solid ${token.colorBorder}` }}>
                <div style={{ padding: '16px 16px 8px', fontWeight: 600, color: '#333' }}>
                    <BarChartOutlined style={{ marginRight: 8 }} />
                    报表中心
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[activeTab]}
                    items={menuItems}
                    onClick={({ key }) => setActiveTab(key as Tab)}
                    style={{ border: 'none' }}
                />
            </Sider>

            {/* 右侧内容区 */}
            <Content style={{ padding: '24px' }}>
                {/* 顶部操作栏 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Title level={4} style={{ margin: 0 }}>
                        {activeTab === 'system' ? '系统报表' : '我的报表'}
                    </Title>
                    <Space>
                        <Button
                            type="default"
                            icon={<DatabaseOutlined />}
                            onClick={() => navigate('/system/data-sources')}
                        >
                            管理数据源
                        </Button>
                        {activeTab === 'my' && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => navigate('../reports/new')}
                            >
                                新建报表
                            </Button>
                        )}
                    </Space>
                </div>

                <>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                <Spin size="large" />
                            </div>
                        ) : reports.length === 0 ? (
                            <Empty
                                description={activeTab === 'my' ? '还没有自定义报表，点击右上角新建' : '暂无系统报表'}
                                style={{ marginTop: 60 }}
                            />
                        ) : (
                            <Row gutter={[16, 16]}>
                                {reports.map((report: any) => (
                                    <Col key={report.id} xs={24} sm={12} md={8} lg={6}>
                                        <Card
                                            hoverable
                                            size="small"
                                            actions={[
                                                <EyeOutlined
                                                    key="view"
                                                    title="查看"
                                                    onClick={() => navigate(`../reports/${report.id}`)}
                                                />,
                                                <ShareAltOutlined
                                                    key="share"
                                                    title="分享"
                                                    onClick={() => handleShare(report)}
                                                />,
                                                <MenuOutlined
                                                    key="menu"
                                                    title="挂载到菜单"
                                                    onClick={() => setMountModal({ visible: true, report })}
                                                />,
                                                ...(activeTab === 'my' ? [
                                                    <EditOutlined
                                                        key="edit"
                                                        title="编辑"
                                                        onClick={() => navigate(`../reports/${report.id}/edit`)}
                                                    />,
                                                    <DeleteOutlined
                                                        key="delete"
                                                        title="删除"
                                                        style={{ color: '#ff4d4f' }}
                                                        onClick={() => handleDelete(report.id)}
                                                    />,
                                                ] : []),
                                            ]}
                                        >
                                            <Card.Meta
                                                avatar={<BarChartOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
                                                title={
                                                    <Space>
                                                        <Text ellipsis style={{ maxWidth: 120 }}>{report.name}</Text>
                                                        <Tag color={statusColor[report.status] ?? 'default'} style={{ margin: 0 }}>
                                                            {report.status === 'PUBLISHED' ? '已发布' : '草稿'}
                                                        </Tag>
                                                    </Space>
                                                }
                                                description={
                                                    <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                                                        {report.description || report.code}
                                                    </Text>
                                                }
                                            />
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}
                </>
            </Content>

            <Modal
                title="分享报表"
                open={shareModal.visible}
                onCancel={() => setShareModal({ visible: false, report: null })}
                footer={null}
            >
                {shareModal.link && (
                    <div>
                        <p style={{ marginBottom: 8 }}>分享链接（复制后发送给他人，无需登录即可查看）：</p>
                        <input
                            readOnly
                            value={shareModal.link}
                            style={{ width: '100%', padding: 8, fontSize: 12 }}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                            type="primary"
                            style={{ marginTop: 12 }}
                            onClick={() => {
                                navigator.clipboard.writeText(shareModal.link!);
                                message.success('已复制到剪贴板');
                            }}
                        >
                            复制链接
                        </Button>
                    </div>
                )}
            </Modal>

            <Modal
                title="挂载到菜单"
                open={mountModal.visible}
                onCancel={() => setMountModal({ visible: false, report: null })}
                onOk={() => mountModal.report && handleMountToMenu(mountModal.report, (document.getElementById('mount-menu-name') as HTMLInputElement)?.value)}
                okText="确定挂载"
            >
                {mountModal.report && (
                    <div>
                        <p style={{ marginBottom: 8 }}>菜单名称：</p>
                        <input
                            id="mount-menu-name"
                            defaultValue={mountModal.report.name}
                            style={{ width: '100%', padding: 8 }}
                            placeholder="留空则使用报表名称"
                        />
                    </div>
                )}
            </Modal>
        </Layout>
    );
};

export default ReportCenter;
