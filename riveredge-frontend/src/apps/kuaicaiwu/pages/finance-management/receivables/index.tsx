/**
 * 应收单列表页
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Typography } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { EyeOutlined, DollarOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { receivableService } from '../../../services/finance/receivable';
import { Receivable, ReceivableCreateData, ReceivableListParams } from '../../../types/finance/receivable';
import { batchImport } from '../../../../../utils/batchOperations';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { useTranslation } from 'react-i18next';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getReceivableLifecycle } from '../../../utils/financeLifecycle';
import { buildReceivableStatusEnum, buildReviewStatusEnum } from '../../../utils/financeSharedOptions';
import dayjs from 'dayjs';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaicaiwu.receivable';

const ReceivableList: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const createFormRef = useRef<ProFormInstance>(null);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
    const { message: messageApi } = App.useApp();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    const receivableImportTemplate = useMemo(
        () =>
            buildFactoryImportTemplate(
                t,
                [
                    {
                        field: 'customer',
                        required: true,
                        labelKey: `${P}.import.customerName`,
                        aliases: ['客户名称', '客户'],
                    },
                    {
                        field: 'amount',
                        required: true,
                        labelKey: `${P}.import.amount`,
                        aliases: ['应收金额', '金额'],
                    },
                    { field: 'dueDate', labelKey: `${P}.import.dueDate`, aliases: ['到期日期'] },
                    { field: 'businessDate', labelKey: `${P}.import.businessDate`, aliases: ['业务日期'] },
                ],
                [
                    t(`${P}.importExample.customerName`),
                    t(`${P}.importExample.amount`),
                    t(`${P}.importExample.dueDate`),
                    t(`${P}.importExample.businessDate`),
                ],
            ),
        [t, i18n.language],
    );

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
        const today = formatDateTime(dayjs(), 'YYYY-MM-DD');
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
            attachments: normalizeDocumentAttachments(values.attachments),
        };
        await receivableService.createReceivable(data);
        messageApi.success(t('common.createSuccess'));
        setCreateModalVisible(false);
        actionRef.current?.reload();
    };

    const handleBatchDelete = async (keys: React.Key[]) => {
        try {
            for (const id of keys) {
                await receivableService.deleteReceivable(Number(id));
            }
            messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
            setSelectedRowKeys([]);
            actionRef.current?.reload();
        } catch (error: any) {
            messageApi.error(error?.message || t('common.deleteFailed'));
        }
    };

    const handleBatchApprove = async (keys: React.Key[]) => {
        try {
            for (const id of keys) {
                await receivableService.approveReceivable(Number(id));
            }
            messageApi.success(t('app.kuaicaiwu.common.batchApproveSuccess', { count: keys.length, entity: t(`${P}.entityName`) }));
            setSelectedRowKeys([]);
            actionRef.current?.reload();
        } catch (error: any) {
            messageApi.error(error?.message || t('app.kuaicaiwu.common.batchApproveFailed'));
        }
    };

    const columns: ProColumns<Receivable>[] = useMemo(() => [
        {
            title: t('app.kuaicaiwu.common.code'),
            dataIndex: 'receivable_code',
            width: 168,
            fixed: 'left',
            render: (_, entity) => (
                <Typography.Text copyable={{ text: String(entity.receivable_code ?? '') }} ellipsis>
                    <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${entity.id}`)}>{entity.receivable_code}</a>
                </Typography.Text>
            ),
        },
        {
            title: t(`${P}.col.customerName`),
            dataIndex: 'customer_name',
            width: 200,
        },
        {
            title: t(`${P}.col.totalAmount`),
            dataIndex: 'total_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: t(`${P}.col.receivedAmount`),
            dataIndex: 'received_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
        },
        {
            title: t(`${P}.col.remainingAmount`),
            dataIndex: 'remaining_amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            render: (_, record) => (
                <span style={{ color: record.remaining_amount > 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>
                    {record.remaining_amount != null
                        ? `¥${Number(record.remaining_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
                        : '-'}
                </span>
            ),
        },
        {
            title: t('app.kuaicaiwu.common.dueDate'),
            dataIndex: 'due_date',
            valueType: 'date',
            width: 120,
        },
        {
            title: t('common.status'),
            dataIndex: 'status',
            hideInTable: true,
            valueEnum: buildReceivableStatusEnum(t),
        },
        {
            title: t('app.kuaicaiwu.common.reviewStatus'),
            dataIndex: 'review_status',
            hideInTable: true,
            valueEnum: buildReviewStatusEnum(t),
        },
        {
            title: t('common.updatedAt'),
            dataIndex: 'updated_at',
            width: 168,
            hideInSearch: true,
            render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
        },
        {
            title: t('app.kuaicaiwu.common.lifecycle'),
            dataIndex: 'lifecycle_stage',
            fixed: 'right',
            align: 'left',
            width: 130,
            hideInSearch: true,
            render: (_, record) => {
                const lc = getReceivableLifecycle(record as unknown as Record<string, unknown>, t);
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
            title: t('common.actions'),
            valueType: 'option',
            fixed: 'right',
            width: 220,
            render: (_, record) => [
                        <Button {...rowActionKind('read')}
                            key="det"
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${record.id}`)}
                        >
                            {t('common.detail')}
                        </Button>,
                        <UniWorkflowActions {...rowActionKind('skip')}
                            key="wf"
                            record={record}
                            entityName={t(`${P}.entityName`)}
                            statusField="status"
                            reviewStatusField="review_status"
                            draftStatuses={[]}
                            pendingStatuses={['待审核']}
                            approvedStatuses={['已审核', '通过']}
                            rejectedStatuses={['已驳回', '驳回']}
                            theme="link"
                            size="small"
                            onSuccess={() => actionRef.current?.reload()}
                        />,
                        record.remaining_amount > 0 ? (
                            <Button {...rowActionKind('execute')}
                                key="pay"
                                type="link"
                                size="small"
                                icon={<DollarOutlined />}
                                onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${record.id}`)}
                            >
                                {t('app.kuaicaiwu.common.collect')}
                            </Button>
                        ) : null,
                    ].filter(Boolean) as React.ReactNode[],
        },
    ], [t, navigate]);

    const batchMenuItems = useMemo(() => [
        {
            key: 'batch-approve',
            label: t('app.kuaicaiwu.common.batchApprove'),
            requireConfirm: true,
            confirmTitle: (count: number) => t(`${P}.batchApproveTitle`, { count }),
            confirmDescription: t('app.kuaicaiwu.common.batchOnlyPendingApprove'),
            onClick: handleBatchApprove,
        },
    ], [t]);

    return (
        <ListPageTemplate>
            <UniTable<Receivable>
                headerTitle={t(`${P}.pageTitle`)}
                actionRef={actionRef}
                columns={columns}
                columnPersistenceId="apps.kuaicaiwu.pages.finance-management.receivables"
                scroll={{ x: 1680 }}
                request={async (params, _sort, _filter, searchFormValues) => {
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
                        messageApi.error(error?.message || t('app.kuaicaiwu.common.loadListFailed'));
                        return { data: [], total: 0, success: false };
                    }
                }}
                rowKey="id"
                showCreateButton
                createButtonText={t(`${P}.createTitle`)}
                onCreate={() => setCreateModalVisible(true)}
                enableRowSelection
                selectedRowKeys={selectedRowKeys}
                onRowSelectionChange={setSelectedRowKeys}
                showDeleteButton
                deleteButtonText={t('common.batchDelete')}
                onDelete={handleBatchDelete}
                deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
                deleteConfirmDescription={(count) => t(`${P}.deleteConfirm`, { count })}
                toolBarActionsAfterDelete={[
                    <UniBatchMenuButton
                        key="receivable-batch-actions"
                        selectedRowKeys={selectedRowKeys}
                        buttonText={t('components.uniBatch.batchActions')}
                        menuItems={batchMenuItems}
                    />,
                ]}
                showAdvancedSearch={true}
                showImportButton
                onImport={async (data) => {
                    if (!data || data.length < 2) {
                        messageApi.warning(t('app.kuaicaiwu.common.importEmpty'));
                        return;
                    }
                    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
                    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
                        headers,
                        receivableImportTemplate.importHeaderMap,
                    );
                    if (headerIndexMap.customer === undefined || headerIndexMap.amount === undefined) {
                        messageApi.error(t(`${P}.importHeaderError`));
                        return;
                    }
                    const items: ReceivableCreateData[] = [];
                    const importRows = data.slice(2).filter((row: any[]) =>
                        row?.some((c: any) => c != null && String(c).trim() !== ''),
                    );
                    for (const row of importRows) {
                        const custLabel = String(row[headerIndexMap.customer] ?? '').trim();
                        const custOpt = customerOptions.find(o => (o.label || '').trim() === custLabel) ?? customerOptions.find(o => (o.label || '').includes(custLabel));
                        const custId = custOpt?.value;
                        const amount = Number(row[headerIndexMap.amount]) || 0;
                        if (!custId || amount <= 0) continue;
                        const today = formatDateTime(dayjs(), 'YYYY-MM-DD');
                        const dueDate =
                            headerIndexMap.dueDate !== undefined && row[headerIndexMap.dueDate]
                                ? formatDateTime(row[headerIndexMap.dueDate], 'YYYY-MM-DD')
                                : today;
                        const bizDate =
                            headerIndexMap.businessDate !== undefined && row[headerIndexMap.businessDate]
                                ? formatDateTime(row[headerIndexMap.businessDate], 'YYYY-MM-DD')
                                : today;
                        items.push({
                            source_type: '手工',
                            source_id: 0,
                            source_code: '手工',
                            customer_id: custId,
                            customer_name: custOpt?.label || custLabel,
                            total_amount: amount,
                            received_amount: 0,
                            remaining_amount: amount,
                            due_date: dueDate,
                            business_date: bizDate,
                            status: '未收款',
                            review_status: '待审核',
                        });
                    }
                    if (items.length === 0) {
                        messageApi.warning(t('app.kuaicaiwu.common.importNoValidRows'));
                        return;
                    }
                    const result = await batchImport({
                        items,
                        importFn: async (item) => receivableService.createReceivable(item),
                        title: t(`${P}.importTitle`),
                        concurrency: 5,
                    });
                    if (result.successCount > 0) {
                        messageApi.success(t(`${P}.importSuccess`, { count: result.successCount }));
                        actionRef.current?.reload();
                    }
                    if (result.failureCount > 0) {
                        messageApi.warning(t('app.kuaicaiwu.common.importPartialFail', { count: result.failureCount }));
                    }
                }}
                importHeaders={receivableImportTemplate.importHeaders}
                importExampleRow={receivableImportTemplate.importExampleRow}
                importFieldMap={receivableImportTemplate.importHeaderMap}
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
                            messageApi.warning(t('common.exportNoData'));
                            return;
                        }
                        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `receivables-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        messageApi.success(t('common.exportCountSuccess', { count: items.length }));
                    } catch (error: any) {
                        messageApi.error(error?.message || t('common.exportFailed'));
                    }
                }}
            />

            <ModalForm
                title={t(`${P}.createTitle`)}
                open={createModalVisible}
                onOpenChange={setCreateModalVisible}
                onFinish={handleCreate}
                formRef={createFormRef}
                width={480}
            >
                <ProFormSelect
                    name="customer_id"
                    label={t('app.kuaicaiwu.common.customer')}
                    options={customerOptions}
                    rules={[{ required: true, message: t('app.kuaicaiwu.common.selectCustomer') }]}
                    placeholder={t('app.kuaicaiwu.common.selectCustomer')}
                />
                <ProFormMoney name="total_amount" label={t(`${P}.col.amount`)} min={0.01} rules={[{ required: true }]} />
                <ProFormDatePicker
                    name="due_date"
                    label={t('app.kuaicaiwu.common.dueDate')}
                    rules={[{ required: true }]}
                    fieldProps={buildFutureDateShortcutFieldProps({
                        getForm: () => createFormRef.current,
                        fieldName: 'due_date',
                        baseFieldName: 'business_date',
                        t,
                    })}
                />
                <ProFormDatePicker name="business_date" label={t('app.kuaicaiwu.common.businessDate')} />
                <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
                <DocumentAttachmentsField category="receivable_attachments" />
            </ModalForm>
        </ListPageTemplate>
    );
};

export default ReceivableList;
