/**
 * 采购发票列表页
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { purchaseInvoiceService } from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsMax3 } from '../../../utils/renderRowActionsMax3';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';

const PurchaseInvoiceList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [createModalVisible, setCreateModalVisible] = useState(false);
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
 
    const handleRegister = async (values: any) => {
        try {
            const invoiceAmount = Number(values.invoice_amount) || 0;
            const taxRate = Number(values.tax_rate) || 13;
            const taxAmount = Number((invoiceAmount * taxRate / 100).toFixed(2));
            const totalAmount = Number((invoiceAmount + taxAmount).toFixed(2));
            
            const data: any = {
                supplier_id: values.supplier_id,
                supplier_name: supplierOptions.find(o => o.value === values.supplier_id)?.label || '',
                invoice_number: values.invoice_number,
                invoice_date: values.invoice_date?.format ? values.invoice_date.format('YYYY-MM-DD') : (values.invoice_date || dayjs().format('YYYY-MM-DD')),
                invoice_type: values.invoice_type || '增值税专用发票',
                tax_rate: taxRate,
                invoice_amount: invoiceAmount,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                notes: values.notes,
                status: '未审核',
                review_status: '待审核',
            };

            await purchaseInvoiceService.create(data);
            messageApi.success('采购发票登记成功');
            setCreateModalVisible(false);
            actionRef.current?.reload();
            return true;
        } catch (error: any) {
            messageApi.error(error?.message || '登记失败');
            return false;
        }
    };

    const columns: ProColumns<PurchaseInvoice>[] = [
        {
            title: '发票编号',
            dataIndex: 'invoice_code',
            width: 168,
            fixed: 'left',
            render: (_, entity) => (
                <Typography.Text copyable={{ text: String(entity.invoice_code ?? '') }} ellipsis>
                    <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${entity.id}`)}>{entity.invoice_code}</a>
                </Typography.Text>
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
            hideInTable: true,
        },
        {
            title: '审核状态',
            dataIndex: 'review_status',
            hideInTable: true,
            valueEnum: {
                '待审核': { text: '待审核' },
                '已审核': { text: '已审核' },
                '已驳回': { text: '已驳回' },
                '通过': { text: '已审核' },
                '驳回': { text: '已驳回' },
            },
        },
        {
            title: '生命周期',
            dataIndex: 'lifecycle',
            fixed: 'right',
            align: 'left',
            width: 130,
            hideInSearch: true,
            render: (_, record) => {
                const lc = getChineseInvoiceLifecycle(record as unknown as Record<string, unknown>);
                return (
                    <UniLifecycle
                        percent={lc.percent}
                        stageName={lc.stageName}
                        status={lc.status}
                        subStages={lc.subStages}
                        showLabel
                        size="small"
                        showCircleTooltip={false}
                    />
                );
            },
        },
        {
            title: '操作',
            valueType: 'option',
            fixed: 'right',
            width: 200,
            render: (_, record) =>
                renderRowActionsMax3(
                    [
                        <Button
                            key="det"
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${record.id}`)}
                        >
                            详情
                        </Button>,
                        record.review_status === '待审核' ? (
                            <UniWorkflowActions
                                key="wf"
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
                        ) : null,
                    ].filter(Boolean) as React.ReactNode[],
                    `pi-${record.id}`,
                ),
        },
    ];

    return (
        <ListPageTemplate>
            <UniTable<PurchaseInvoice>
                headerTitle="采购发票"
                actionRef={actionRef}
                columns={columns}
                columnPersistenceId="kuaicaiwu-finance-purchase-invoices"
                scroll={{ x: 1600 }}
                showAdvancedSearch
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
                showCreateButton
                createButtonText="登记采购发票"
                onCreate={() => setCreateModalVisible(true)}
            />

            <ModalForm
                title="手动登记采购发票"
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleRegister}
                width={520}
            >
                <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#8c8c8c', fontSize: '13px' }}>提示：如果是从采购订单转发票，请在采购订单页面点击“下推发票”。此操作用于直接登记收到的进项发票。</p>
                </div>
                <ProFormSelect
                    name="supplier_id"
                    label="供应商"
                    options={supplierOptions}
                    rules={[{ required: true, message: '请选择供应商' }]}
                    placeholder="请选择供应商"
                    showSearch
                />
                <ProFormText
                    name="invoice_number"
                    label="发票号码"
                    rules={[{ required: true, message: '请输入发票号码' }]}
                    placeholder="请输入票面号码"
                />
                <ProFormSelect
                    name="invoice_type"
                    label="发票类型"
                    options={[
                        { label: '增值税专用发票', value: '增值税专用发票' },
                        { label: '增值税普通发票', value: '增值税普通发票' },
                        { label: '其他', value: '其他' },
                    ]}
                    initialValue="增值税专用发票"
                    rules={[{ required: true }]}
                />
                <ProFormDatePicker name="invoice_date" label="开票日期" rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
                <ProFormDigit
                    name="tax_rate"
                    label="税率(%)"
                    initialValue={13}
                    min={0}
                    max={100}
                    rules={[{ required: true }]}
                    fieldProps={{ style: { width: '100%' } }}
                />
                <ProFormDigit
                    name="invoice_amount"
                    label="不含税金额"
                    min={0}
                    rules={[{ required: true, message: '请输入不含税金额' }]}
                    fieldProps={{ precision: 2, style: { width: '100%' } }}
                />
                <ProFormTextArea name="notes" label="备注" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default PurchaseInvoiceList;
