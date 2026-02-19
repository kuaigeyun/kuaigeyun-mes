import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Table, Button, Space, Tag, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, ShareAltOutlined, MenuOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDashboards, shareDashboard, mountDashboardToMenu } from '../services/kuaireport';

const DashboardList: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [shareModal, setShareModal] = useState<{ visible: boolean; dashboard: any; link?: string }>({ visible: false, dashboard: null });
    const [mountModal, setMountModal] = useState<{ visible: boolean; dashboard: any }>({ visible: false, dashboard: null });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getDashboards({});
            if (res && res.data) {
                setData(res.data);
            }
        } catch (error) {
            message.error('获取列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async (dashboard: any) => {
        try {
            const res = await shareDashboard(dashboard.id, 30);
            const baseUrl = window.location.origin;
            const link = `${baseUrl}/apps/kuaireport/dashboards/shared?token=${res.share_token}`;
            setShareModal({ visible: true, dashboard, link });
        } catch (err: any) {
            message.error(err?.message || '生成分享链接失败');
        }
    };

    const handleMountToMenu = async (dashboard: any, menuName?: string) => {
        try {
            await mountDashboardToMenu(dashboard.id, menuName || dashboard.name);
            message.success('已挂载到菜单');
            setMountModal({ visible: false, dashboard: null });
        } catch (err: any) {
            message.error(err?.message || '挂载失败');
        }
    };

    const columns = [
        { title: '名称', dataIndex: 'name', key: 'name' },
        { title: '编码', dataIndex: 'code', key: 'code' },
        {
            title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
                <Tag color={status === 'PUBLISHED' ? 'green' : 'orange'}>{status}</Tag>
            )
        },
        { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
        {
            title: '操作', key: 'action', render: (_: any, record: any) => (
                <Space size="middle">
                    <Button icon={<EditOutlined />} size="small" onClick={() => navigate(`../dashboard-designer?id=${record.id}`)}>编辑</Button>
                    <Button icon={<PlayCircleOutlined />} size="small" onClick={() => navigate(`../dashboards/${record.id}`)}>预览</Button>
                    <Button icon={<ShareAltOutlined />} size="small" onClick={() => handleShare(record)}>分享</Button>
                    <Button icon={<MenuOutlined />} size="small" onClick={() => setMountModal({ visible: true, dashboard: record })}>挂载到菜单</Button>
                    <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
                </Space>
            )
        },
    ];

    return (
        <PageContainer
            title="大屏看板管理"
            extra={[
                <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => navigate('../dashboard-designer')}>新建看板</Button>
            ]}
        >
            <Card>
                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal title="分享大屏" open={shareModal.visible} onCancel={() => setShareModal({ visible: false, dashboard: null })} footer={null}>
                {shareModal.link && (
                    <div>
                        <p style={{ marginBottom: 8 }}>分享链接（复制后发送给他人，无需登录即可查看）：</p>
                        <input readOnly value={shareModal.link} style={{ width: '100%', padding: 8, fontSize: 12 }} onClick={(e) => (e.target as HTMLInputElement).select()} />
                        <Button type="primary" style={{ marginTop: 12 }} onClick={() => { navigator.clipboard.writeText(shareModal.link!); message.success('已复制到剪贴板'); }}>复制链接</Button>
                    </div>
                )}
            </Modal>

            <Modal title="挂载到菜单" open={mountModal.visible} onCancel={() => setMountModal({ visible: false, dashboard: null })} onOk={() => mountModal.dashboard && handleMountToMenu(mountModal.dashboard, (document.getElementById('mount-dashboard-name') as HTMLInputElement)?.value)} okText="确定挂载">
                {mountModal.dashboard && (
                    <div>
                        <p style={{ marginBottom: 8 }}>菜单名称：</p>
                        <input id="mount-dashboard-name" defaultValue={mountModal.dashboard.name} style={{ width: '100%', padding: 8 }} placeholder="留空则使用大屏名称" />
                    </div>
                )}
            </Modal>
        </PageContainer>
    );
};

export default DashboardList;
