import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Table, Button, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDashboards } from '../services/kuaireport';

const DashboardList: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);

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
                    <Button icon={<PlayCircleOutlined />} size="small" onClick={() => navigate(`../dashboard-view?id=${record.id}`)}>预览</Button>
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
        </PageContainer>
    );
};

export default DashboardList;
