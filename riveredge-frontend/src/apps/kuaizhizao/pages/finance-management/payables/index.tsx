import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Space } from 'antd';
import { payableService } from '../../../services/finance/payable';
import { Payable } from '../../../types/finance/payable';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';

const PayableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const columns: ProColumns<Payable>[] = [
        {
            title: t('app.kuaizhizao.common.code', { defaultValue: 'Code' }),
            dataIndex: 'payable_code',
            width: 150,
            fixed: 'left',
            render: (dom, entity) => (
                <a onClick={() => navigate(`/apps/kuaizhizao/finance-management/payables/${entity.id}`)}>{dom}</a>
            ),
        },
        {
            title: '供应商名称',
            dataIndex: 'supplier_name',
            width: 200,
        },
        {
            title: '应付总额',
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '已付金额',
            dataIndex: 'paid_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '剩余应付',
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
                '未付款': { text: '未付款', status: 'Error' },
                '部分付款': { text: '部分付款', status: 'Processing' },
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
                    <a onClick={() => navigate(`/apps/kuaizhizao/finance-management/payables/${record.id}`)}>详情</a>
                    {record.remaining_amount > 0 && <a onClick={() => navigate(`/apps/kuaizhizao/finance-management/payables/${record.id}/payment`)}>付款</a>}
                </Space>
            ),
        },
    ];

    return (
        <ListPageTemplate>
            <UniTable<Payable>
                headerTitle="应付单列表"
                actionRef={actionRef}
                rowKey="id"
                search={{
                    labelWidth: 120,
                }}
                request={async (params) => {
                    const { current, pageSize, ...rest } = params;
                    const res = await payableService.listPayables({
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
        </ListPageTemplate>
    );
};

export default PayableList;
