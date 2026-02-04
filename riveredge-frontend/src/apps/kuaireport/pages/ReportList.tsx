import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Table, Button, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getReports } from '../services/kuaireport';

const ReportList: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getReports({});
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
            title: '引擎类型', dataIndex: 'report_type', key: 'report_type', render: (type: string) => {
                const config = {
                    jimu: { color: 'blue', text: '专业报表 (Jimu)' },
                    grid: { color: 'purple', text: '动态网格 (Grid)' },
                    univer: { color: 'cyan', text: '协同表格 (Univer)' }
                }[type] || { color: 'default', text: type };
                return <Tag color={config.color}>{config.text}</Tag>;
            }
        },
        {
            title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
                <Tag color={status === 'PUBLISHED' ? 'green' : 'orange'}>{status}</Tag>
            )
        },
        { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
        {
            title: '操作', key: 'action', render: (_: any, record: any) => (
                <Space size="middle">
                    {record.report_type === 'grid' && (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => navigate(`../report-grid?id=${record.id}`)}
                        >
                            查看
                        </Button>
                    )}
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => {
                            const path = record.report_type === 'jimu' ? '../jimu-designer' : '../report-designer';
                            navigate(`${path}?id=${record.id}`);
                        }}
                    >
                        设计
                    </Button>
                    <Button icon={<DeleteOutlined />} size="small" danger onClick={() => message.info('功能开发中')}>删除</Button>
                </Space>
            )
        },
    ];

    return (
        <PageContainer
            title="报表管理"
            extra={[
                <Space key="extra">
                    <Button icon={<PlusOutlined />} onClick={() => navigate('../report-designer')}>新建协同表格</Button>
                    <Button icon={<PlusOutlined />} onClick={() => navigate('../jimu-designer')}>新建专业报表</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('网格报表设计器开发中')}>新建动态网格</Button>
                </Space>
            ]}
        >
            <Card>
                <div style={{ marginBottom: '16px', color: '#666' }}>
                    <p>提示：积木报表适用于制作固定排版、精准分页打印的各种业务单据和明细汇总表。</p>
                </div>
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

export default ReportList;
