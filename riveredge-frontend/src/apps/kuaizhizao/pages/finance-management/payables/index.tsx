/**
 * 应付单列表页
 *
 * 路由复用：/finance-management/payables、/finance-management/payments 均使用本组件，
 * 展示应付账款列表。付款菜单作为应付管理的快捷入口。
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Space } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, DollarOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { payableService } from '../../../services/finance/payable';
import { Payable, PayableCreateData } from '../../../types/finance/payable';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import dayjs from 'dayjs';

const PayableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isPaymentsPage = location.pathname.includes('/payments');
    const headerTitle = isPaymentsPage ? '付款单' : '应付账款';

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

    const handleCreate = async (values: any) => {
        const today = dayjs().format('YYYY-MM-DD');
        const data: PayableCreateData = {
            source_type: '手工',
            source_id: 0,
            source_code: '手工',
            supplier_id: values.supplier_id,
            supplier_name: supplierOptions.find(o => o.value === values.supplier_id)?.label || '',
            total_amount: values.total_amount,
            paid_amount: 0,
            remaining_amount: values.total_amount,
            due_date: values.due_date || today,
            business_date: values.business_date || today,
            status: '未付款',
            review_status: '待审核',
            notes: values.notes,
        };
        await payableService.createPayable(data);
        messageApi.success('创建成功');
        setCreateModalVisible(false);
        actionRef.current?.reload();
    };

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
            width: 280,
            render: (_, record) => (
                <Space>
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/apps/kuaizhizao/finance-management/payables/${record.id}`)}>详情</Button>
                    <UniWorkflowActions
                        record={record}
                        entityName="应付单"
                        statusField="status"
                        reviewStatusField="review_status"
                        draftStatuses={[]}
                        pendingStatuses={['待审核']}
                        approvedStatuses={['已审核']}
                        rejectedStatuses={['已驳回']}
                        theme="link"
                        size="small"
                        actions={{
                            approve: (id) => payableService.approvePayable(id),
                            reject: (id, reason) => payableService.approvePayable(id, reason),
                        }}
                        onSuccess={() => actionRef.current?.reload()}
                    />
                    {record.remaining_amount > 0 && <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => navigate(`/apps/kuaizhizao/finance-management/payables/${record.id}/payment`)}>付款</Button>}
                </Space>
            ),
        },
    ];

    return (
        <ListPageTemplate>
            <UniTable<Payable>
                headerTitle={headerTitle}
                actionRef={actionRef}
                rowKey="id"
                search={{
                    labelWidth: 120,
                }}
                showCreateButton
                createButtonText="新建应付单"
                onCreate={() => setCreateModalVisible(true)}
                enableRowSelection
                showDeleteButton
                deleteButtonText="批量删除"
                onDelete={async (keys) => {
                    Modal.confirm({
                        title: '确认批量删除',
                        content: `确定要删除选中的 ${keys.length} 条应付单吗？仅待审核且无付款记录的应付单可删除。`,
                        onOk: async () => {
                            try {
                                for (const id of keys) {
                                    await payableService.deletePayable(Number(id));
                                }
                                messageApi.success(`成功删除 ${keys.length} 条记录`);
                                actionRef.current?.reload();
                            } catch (error: any) {
                                messageApi.error(error?.message || '删除失败');
                            }
                        },
                    });
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

            <ModalForm
                title="新建应付单"
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleCreate}
                width={480}
            >
                <ProFormSelect
                    name="supplier_id"
                    label="供应商"
                    options={supplierOptions}
                    rules={[{ required: true, message: '请选择供应商' }]}
                    placeholder="请选择供应商"
                />
                <ProFormMoney name="total_amount" label="应付金额" min={0.01} rules={[{ required: true }]} />
                <ProFormDatePicker name="due_date" label="到期日期" rules={[{ required: true }]} />
                <ProFormDatePicker name="business_date" label="业务日期" />
                <ProFormTextArea name="notes" label="备注" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default PayableList;
