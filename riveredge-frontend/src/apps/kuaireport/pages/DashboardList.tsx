import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, Dropdown, Typography } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    PlayCircleOutlined,
    ShareAltOutlined,
    MenuOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate } from '../../../components/layout-templates';
import {
    getDashboards,
    deleteDashboard,
    shareDashboard,
    mountDashboardToMenu,
} from '../services/kuaireport';
import { UniLifecycle } from '../../../components/uni-lifecycle';
import { getPublishDraftLifecycle } from '../utils/publishLifecycle';

const DASHBOARD_ROW_ACTIONS_MAX = 4;

interface Dashboard {
    id: number;
    name?: string;
    code?: string;
    status?: string;
    updated_at?: string;
    [key: string]: any;
}

const DashboardList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const { message: messageApi } = App.useApp();
    const navigate = useNavigate();
    const [shareModal, setShareModal] = useState<{ visible: boolean; dashboard: any; link?: string }>({
        visible: false,
        dashboard: null,
    });
    const [mountModal, setMountModal] = useState<{ visible: boolean; dashboard: any }>({
        visible: false,
        dashboard: null,
    });

    const handleShare = async (dashboard: any) => {
        try {
            const res = await shareDashboard(dashboard.id, 30);
            const baseUrl = window.location.origin;
            const link = `${baseUrl}/apps/kuaireport/dashboards/shared?token=${res.share_token}`;
            setShareModal({ visible: true, dashboard, link });
        } catch (err: any) {
            messageApi.error(err?.message || '生成分享链接失败');
        }
    };

    const handleMountToMenu = async (dashboard: any, menuName?: string) => {
        try {
            await mountDashboardToMenu(dashboard.id, menuName || dashboard.name);
            messageApi.success('已挂载到菜单');
            setMountModal({ visible: false, dashboard: null });
        } catch (err: any) {
            messageApi.error(err?.message || '挂载失败');
        }
    };

    const handleDelete = async (keys: React.Key[]) => {
        const ids = keys.map((k) => Number(k)).filter((n) => !isNaN(n));
        if (ids.length === 0) return;
        try {
            for (const id of ids) {
                await deleteDashboard(id);
            }
            messageApi.success(`已删除 ${ids.length} 条记录`);
            actionRef.current?.reload();
        } catch (err: any) {
            messageApi.error(err?.message || '删除失败');
            throw err;
        }
    };

    const renderDashboardRowActions = (record: Dashboard) => {
        const nodes: React.ReactNode[] = [
            <Button
                key="edit"
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate('../dashboard-designer?id=' + record.id)}
            >
                编辑
            </Button>,
            <Button
                key="preview"
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(`../dashboards/${record.id}`)}
            >
                预览
            </Button>,
            <Button
                key="share"
                type="link"
                size="small"
                icon={<ShareAltOutlined />}
                onClick={() => handleShare(record)}
            >
                分享
            </Button>,
            <Button
                key="mount"
                type="link"
                size="small"
                icon={<MenuOutlined />}
                onClick={() => setMountModal({ visible: true, dashboard: record })}
            >
                挂载到菜单
            </Button>,
            <Button
                key="delete"
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete([record.id])}
            >
                删除
            </Button>,
        ];
        const wrapped = nodes.map((node, i) => <span key={`db-act-${record.id}-${i}`}>{node}</span>);
        if (wrapped.length <= DASHBOARD_ROW_ACTIONS_MAX) {
            return <Space size="small">{wrapped}</Space>;
        }
        const inline = wrapped.slice(0, DASHBOARD_ROW_ACTIONS_MAX);
        const overflow = wrapped.slice(DASHBOARD_ROW_ACTIONS_MAX);
        return (
            <Space size="small" wrap>
                {inline}
                <Dropdown
                    menu={{
                        items: overflow.map((node, i) => ({
                            key: `db-more-${record.id}-${i}`,
                            label: node,
                        })),
                    }}
                    trigger={['click']}
                >
                    <Button type="link" size="small">
                        更多
                    </Button>
                </Dropdown>
            </Space>
        );
    };

    const columns: ProColumns<Dashboard>[] = [
        {
            title: '名称',
            dataIndex: 'name',
            width: 200,
            ellipsis: true,
        },
        {
            title: '编号',
            dataIndex: 'code',
            width: 160,
            render: (_, r) => (
                <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
                    {r.code ?? '-'}
                </Typography.Text>
            ),
        },
        {
            title: '更新时间',
            dataIndex: 'updated_at',
            valueType: 'dateTime',
            width: 160,
            search: false,
        },
        {
            title: '生命周期',
            dataIndex: 'lifecycle',
            key: 'lifecycle',
            width: 200,
            fixed: 'right',
            align: 'left',
            search: false,
            render: (_, record) => (
                <UniLifecycle {...getPublishDraftLifecycle(record as Record<string, unknown>)} showCircleTooltip={false} />
            ),
        },
        {
            title: '操作',
            valueType: 'option',
            fixed: 'right',
            width: 220,
            render: (_, record) => renderDashboardRowActions(record),
        },
    ];

    return (
        <>
            <ListPageTemplate>
                <UniTable<Dashboard>
                    headerTitle="大屏中心"
                    actionRef={actionRef}
                    columnPersistenceId="kuaireport-dashboard-list"
                    scroll={{ x: 'max-content' }}
                    columns={columns}
                    request={async (params) => {
                        const { current, pageSize } = params;
                        try {
                            const res = await getDashboards({
                                skip: ((current || 1) - 1) * (pageSize || 20),
                                limit: pageSize || 20,
                            });
                            const items = res?.data ?? (Array.isArray(res) ? res : []);
                            const total = res?.total ?? items?.length ?? 0;
                            return {
                                data: items,
                                total: typeof total === 'number' ? total : items?.length ?? 0,
                                success: true,
                            };
                        } catch (error: any) {
                            messageApi.error(error?.message || '获取列表失败');
                            return { data: [], total: 0, success: false };
                        }
                    }}
                    rowKey="id"
                    showCreateButton
                    onCreate={() => navigate('../dashboard-designer')}
                    createButtonText="新建看板"
                    showEditButton={false}
                    showDeleteButton
                    onDelete={handleDelete}
                    enableRowSelection
                    showAdvancedSearch={true}
                    showExportButton
                    onExport={async (type, keys, pageData) => {
                        try {
                            const res = await getDashboards({ skip: 0, limit: 10000 });
                            let items = res?.data ?? (Array.isArray(res) ? res : []);
                            if (type === 'currentPage' && pageData?.length) {
                                items = pageData;
                            } else if (type === 'selected' && keys?.length) {
                                items = items.filter((d: Dashboard) => d.id != null && keys.includes(d.id));
                            }
                            if (!items?.length) {
                                messageApi.warning('暂无数据可导出');
                                return;
                            }
                            const blob = new Blob([JSON.stringify(items, null, 2)], {
                                type: 'application/json',
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `dashboards-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            messageApi.success(`已导出 ${items.length} 条记录`);
                        } catch (error: any) {
                            messageApi.error(error?.message || '导出失败');
                        }
                    }}
                />
            </ListPageTemplate>

            <Modal
                title="分享大屏"
                open={shareModal.visible}
                onCancel={() => setShareModal({ visible: false, dashboard: null })}
                footer={null}
            >
                {shareModal.link && (
                    <div>
                        <p style={{ marginBottom: 8 }}>
                            分享链接（复制后发送给他人，无需登录即可查看）：
                        </p>
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
                                messageApi.success('已复制到剪贴板');
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
                onCancel={() => setMountModal({ visible: false, dashboard: null })}
                onOk={() =>
                    mountModal.dashboard &&
                    handleMountToMenu(
                        mountModal.dashboard,
                        (document.getElementById('mount-dashboard-name') as HTMLInputElement)?.value
                    )
                }
                okText="确定挂载"
            >
                {mountModal.dashboard && (
                    <div>
                        <p style={{ marginBottom: 8 }}>菜单名称：</p>
                        <input
                            id="mount-dashboard-name"
                            defaultValue={mountModal.dashboard.name}
                            style={{ width: '100%', padding: 8 }}
                            placeholder="留空则使用大屏名称"
                        />
                    </div>
                )}
            </Modal>
        </>
    );
};

export default DashboardList;
