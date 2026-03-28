/**
 * 采购发票列表页
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { purchaseInvoiceService } from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';

const PurchaseInvoiceList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 1000, is_active: true } });
                const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                setSupplierOptions((Array.isArray(list) ? list : []).map((s: any) => ({
                    label: s.name || s.supplier_name || s.code || String(s.id),
                    value: s.id,
                })));
            } catch {
                setSupplierOptions([]);
            }
        };
        load();
    }, []);

    const columns: ProColumns<PurchaseInvoice>[] = [
        {
            title: '发票编号',
            dataIndex: 'invoice_code',
            width: 150,
            fixed: 'left',
            render: (dom, entity) => (
                <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${entity.id}`)}>{dom}</a>
            ),
        },
        {
            title: '采购订单',
            dataIndex: 'purchase_order_code',
            width: 150,
        },
        {
            title: '供应商',
            dataIndex: 'supplier_name',
            width: 200,
        },
        {
            title: '发票号码',
            dataIndex: 'invoice_number',
            width: 120,
        },
        {
            title: '价税合计',
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: '开票日期',
            dataIndex: 'invoice_date',
            valueType: 'date',
            width: 120,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
        },
        {
            title: '审核状态',
            dataIndex: 'review_status',
            valueEnum: {
                '待审核': { text: '待审核', status: 'Processing' },
                '已审核': { text: '已审核', status: 'Success' },
                '已驳回': { text: '已驳回', status: 'Error' },
                '通过': { text: '已审核', status: 'Success' },
                '驳回': { text: '已驳回', status: 'Error' },
            },
            width: 100,
        },
        {
            title: '操作',
            valueType: 'option',
            fixed: 'right',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${record.id}`)}>详情</Button>
                    {(record.review_status === '待审核') && (
                        <UniWorkflowActions
                            record={record}
                            entityName="采购发票"
                            statusField="status"
                            reviewStatusField="review_status"
                            draftStatuses={[]}
                            pendingStatuses={['待审核']}
                            approvedStatuses={['已审核', '通过']}
                            rejectedStatuses={['已驳回', '驳回']}
                            theme="link"
                            size="small"
                            actions={{
                                approve: (id) => purchaseInvoiceService.approve(id),
                                reject: (id, reason) => purchaseInvoiceService.approve(id, reason),
                            }}
                            onSuccess={() => actionRef.current?.reload()}
                        />
                    )}
                </Space>
            ),
        },
    ];

    return (
        <ListPageTemplate>
            <UniTable<PurchaseInvoice>
                headerTitle="采购发票"
                actionRef={actionRef}
                columns={columns}
                request={async (params) => {
                    const { current, pageSize, ...rest } = params;
                    try {
                        const res = await purchaseInvoiceService.list({
                            skip: ((current || 1) - 1) * (pageSize || 20),
                            limit: pageSize || 20,
                            ...rest,
                        });
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
            />
        </ListPageTemplate>
    );
};

export default PurchaseInvoiceList;
