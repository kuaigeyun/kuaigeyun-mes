/**
 * 应收单列表页
 *
 * 路由复用：/finance-management/receivables、/finance-management/receipts 均使用本组件，
 * 展示应收账款列表。回款菜单作为应收管理的快捷入口。
 */
import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space } from 'antd';
import { EyeOutlined, DollarOutlined } from '@ant-design/icons';
import { receivableService } from '../../../services/finance/receivable';
import { Receivable, ReceivableListParams } from '../../../types/finance/receivable';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';

const ReceivableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const { message: messageApi } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isReceiptsPage = location.pathname.includes('/receipts');
    const headerTitle = isReceiptsPage ? '收款单' : '应收账款';

    const columns: ProColumns<Receivable>[] = [
        {
            title: t('app.kuaizhizao.common.code', { defaultValue: '编码' }),
            dataIndex: 'receivable_code',
            width: 150,
            fixed: 'left',
            render: (dom, entity) => (
                <a onClick={() => navigate(`/apps/kuaizhizao/finance-management/receivables/${entity.id}`)}>{dom}</a>
            ),
        },
        {
            title: '客户名称',
            dataIndex: 'customer_name',
            width: 200,
        },
        {
            title: '应收总额',
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '已收金额',
            dataIndex: 'received_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '剩余应收',
            dataIndex: 'remaining_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            render: (_, record) => (
                <span style={{ color: record.remaining_amount > 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>
                    {_}
                </span>
            ),
        },
        {
            title: '到期日期',
            dataIndex: 'due_date',
            valueType: 'date',
            width: 120,
        },
        {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
                '未收款': { text: '未收款', status: 'Error' },
                '部分收款': { text: '部分收款', status: 'Processing' },
                '已结清': { text: '已结清', status: 'Success' },
            },
            width: 100,
        },
        {
            title: '审核状态',
            dataIndex: 'review_status',
            valueEnum: {
                '待审核': { text: '待审核', status: 'Processing' },
                '已审核': { text: '已审核', status: 'Success' },
                '已驳回': { text: '已驳回', status: 'Error' },
            },
            width: 100,
        },
        {
            title: '操作',
            valueType: 'option',
            fixed: 'right',
            width: 280,
            render: (_, record) => (
                <Space>
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/apps/kuaizhizao/finance-management/receivables/${record.id}`)}>详情</Button>
                    <UniWorkflowActions
                        record={record}
                        entityName="应收单"
                        statusField="status"
                        reviewStatusField="review_status"
                        draftStatuses={[]}
                        pendingStatuses={['待审核']}
                        approvedStatuses={['已审核']}
                        rejectedStatuses={['已驳回']}
                        theme="link"
                        size="small"
                        actions={{
                            approve: (id) => receivableService.approveReceivable(id),
                            reject: (id, reason) => receivableService.approveReceivable(id, reason),
                        }}
                        onSuccess={() => actionRef.current?.reload()}
                    />
                    {record.remaining_amount > 0 && (
                        <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => navigate(`/apps/kuaizhizao/finance-management/receivables/${record.id}/receipt`)}>收款</Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <ListPageTemplate>
            <UniTable<Receivable>
                headerTitle={headerTitle}
                actionRef={actionRef}
                columns={columns}
                request={async (params, sort, _filter, searchFormValues) => {
                    const { current, pageSize } = params;
                    const apiParams: ReceivableListParams = {
                        skip: ((current || 1) - 1) * (pageSize || 20),
                        limit: pageSize || 20,
                    };
                    if (searchFormValues?.status) apiParams.status = searchFormValues.status;
                    if (searchFormValues?.customer_id) apiParams.customer_id = searchFormValues.customer_id;

                    try {
                        const res = await receivableService.listReceivables(apiParams);
                        return {
                            data: res.items || [],
                            total: res.total || 0,
                            success: true,
                        };
                    } catch (error: any) {
                        messageApi.error(error?.message || '获取列表失败');
                        return { data: [], total: 0, success: false };
                    }
                }}
                rowKey="id"
                showCreateButton={false}
                showAdvancedSearch={true}
                showExportButton
                onExport={async (type, keys, pageData) => {
                    try {
                        const res = await receivableService.listReceivables({ skip: 0, limit: 10000 });
                        let items = res.items || [];
                        if (type === 'currentPage' && pageData?.length) {
                            items = pageData;
                        } else if (type === 'selected' && keys?.length) {
                            items = items.filter((d: Receivable) => d.id != null && keys.includes(d.id));
                        }
                        if (items.length === 0) {
                            messageApi.warning('暂无数据可导出');
                            return;
                        }
                        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `receivables-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        messageApi.success(`已导出 ${items.length} 条记录`);
                    } catch (error: any) {
                        messageApi.error(error?.message || '导出失败');
                    }
                }}
            />
        </ListPageTemplate>
    );
};

export default ReceivableList;
