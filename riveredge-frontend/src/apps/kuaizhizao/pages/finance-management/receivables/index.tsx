import React, { useRef } from 'react';
import { PageContainer, ProTable, ProColumns, ActionType } from '@ant-design/pro-components';
import { Space, Tag, Button } from 'antd';
import { receivableService } from '../../../services/finance/receivable';
import { Receivable, ReceivableListParams } from '../../../types/finance/receivable';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const ReceivableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const columns: ProColumns<Receivable>[] = [
        {
            title: t('app.kuaizhizao.common.code', { defaultValue: 'Code' }),
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
            )
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
            width: 150,
            render: (_, record) => (
                <Space>
                    <a onClick={() => navigate(`/apps/kuaizhizao/finance-management/receivables/${record.id}`)}>详情</a>
                    {record.remaining_amount > 0 && <a onClick={() => navigate(`/apps/kuaizhizao/finance-management/receivables/${record.id}/receipt`)}>收款</a>}
                </Space>
            ),
        },
    ];

    return (
        <PageContainer
            header={{
                title: '应收对账',
                breadcrumb: {},
            }}
        >
            <ProTable<Receivable, ReceivableListParams>
                headerTitle="应收单列表"
                actionRef={actionRef}
                rowKey="id"
                search={{
                    labelWidth: 120,
                }}
                request={async (params) => {
                    const { current, pageSize, ...rest } = params;
                    const res = await receivableService.listReceivables({
                        skip: ((current || 1) - 1) * (pageSize || 20),
                        limit: pageSize || 20,
                        ...rest,
                    });
                    return {
                        data: res.items,
                        total: res.total,
                        success: true,
                    };
                }}
                columns={columns}
            />
        </PageContainer>
    );
};

export default ReceivableList;
