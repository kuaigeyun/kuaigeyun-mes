/**
 * 应收单列表页
 *
 * 路由复用：/finance-management/receivables、/finance-management/receipts 均使用本组件，
 * 展示应收账款列表。回款菜单作为应收管理的快捷入口。
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Space } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, DollarOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { receivableService } from '../../../services/finance/receivable';
import { Receivable, ReceivableCreateData, ReceivableListParams } from '../../../types/finance/receivable';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import dayjs from 'dayjs';

const ReceivableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isReceiptsPage = location.pathname.includes('/receipts');
    const headerTitle = isReceiptsPage ? '收款单' : '应收账款';

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } });
                const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                setCustomerOptions((Array.isArray(list) ? list : []).map((c: any) => ({
                    label: c.name || c.customer_name || c.code || String(c.id),
                    value: c.id,
                })));
            } catch {
                setCustomerOptions([]);
            }
        };
        load();
    }, []);

    const handleCreate = async (values: any) => {
        const today = dayjs().format('YYYY-MM-DD');
        const data: ReceivableCreateData = {
            source_type: '手工',
            source_id: 0,
            source_code: '手工',
            customer_id: values.customer_id,
            customer_name: customerOptions.find(o => o.value === values.customer_id)?.label || '',
            total_amount: values.total_amount,
            received_amount: 0,
            remaining_amount: values.total_amount,
            due_date: values.due_date || today,
            business_date: values.business_date || today,
            status: '未收款',
            review_status: '待审核',
            notes: values.notes,
        };
        await receivableService.createReceivable(data);
        messageApi.success('创建成功');
        setCreateModalVisible(false);
        actionRef.current?.reload();
    };

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
                showCreateButton
                createButtonText="新建应收单"
                onCreate={() => setCreateModalVisible(true)}
                enableRowSelection
                showDeleteButton
                deleteButtonText="批量删除"
                onDelete={async (keys) => {
                    Modal.confirm({
                        title: '确认批量删除',
                        content: `确定要删除选中的 ${keys.length} 条应收单吗？仅待审核且无收款记录的应收单可删除。`,
                        onOk: async () => {
                            try {
                                for (const id of keys) {
                                    await receivableService.deleteReceivable(Number(id));
                                }
                                messageApi.success(`成功删除 ${keys.length} 条记录`);
                                actionRef.current?.reload();
                            } catch (error: any) {
                                messageApi.error(error?.message || '删除失败');
                            }
                        },
                    });
                }}
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

            <ModalForm
                title="新建应收单"
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleCreate}
                width={480}
            >
                <ProFormSelect
                    name="customer_id"
                    label="客户"
                    options={customerOptions}
                    rules={[{ required: true, message: '请选择客户' }]}
                    placeholder="请选择客户"
                />
                <ProFormMoney name="total_amount" label="应收金额" min={0.01} rules={[{ required: true }]} />
                <ProFormDatePicker name="due_date" label="到期日期" rules={[{ required: true }]} />
                <ProFormDatePicker name="business_date" label="业务日期" />
                <ProFormTextArea name="notes" label="备注" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default ReceivableList;
