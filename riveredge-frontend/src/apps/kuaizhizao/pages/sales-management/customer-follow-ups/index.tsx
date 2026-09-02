/**
 * 客户跟进（销售极简 CRM）
 *
 * 列表与详情抽屉风格对齐报价单：UniLifecycle、DetailDrawerTemplate；
 * 操作列仅返回 Button[] + rowActionKind，由 UniTable → uni-action 统一规范化。
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Modal, Space, Descriptions, Typography, Table, Empty, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { useOptionalLinkedDocumentDetail } from '../../../../../components/linked-document-detail';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { rowActionKind, rowActionAddFollowUpFromDocument } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

import { customerFollowUpApi, type CustomerFollowUp } from '../../../services/customer-follow-up';
import {
  getDictionaryOptions,
  getDictionaryOptionsSync,
} from '../../../../master-data/services/supply-chain';
import {
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag } from '../../../../../constants/statusBadges';
import {
  CustomerFollowUpFormModal,
  type CustomerFollowUpPreset,
} from '../../../components/CustomerFollowUpFormModal';
import { getCustomerFollowUpLifecycle, isCustomerFollowUpRevisitOverdue } from '../../../utils/customerFollowUpLifecycle';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import {
  KUAIZHIZAO_DOC_HOST,
  loadCustomerFormReferenceList,
} from '../../../../../utils/documentFormReferenceLoad';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';

function followUpPresetFromRecord(record: CustomerFollowUp): CustomerFollowUpPreset {
  const preset: CustomerFollowUpPreset = {
    customer_id: record.customer_id,
  };
  if (record.quotation_id != null) {
    preset.quotation_id = record.quotation_id;
    preset.quotation_code = record.quotation_code ?? undefined;
  }
  if (record.sales_order_id != null) {
    preset.sales_order_id = record.sales_order_id;
    preset.sales_order_code = record.sales_order_code ?? undefined;
  }
  return preset;
}

const CustomerFollowUpsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const linkedDetail = useOptionalLinkedDocumentDetail();
  const actionRef = useRef<ActionType>(null);
  const detailIdRef = useRef<number | null>(null);
  const pendingOnlySkipReloadRef = useRef(true);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string; color?: string }[]>(
    () => getDictionaryOptionsSync(DICT_CODE) ?? [],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFollowUp | null>(null);
  const [followUpPreset, setFollowUpPreset] = useState<CustomerFollowUpPreset | null>(null);
  const [pendingOnlyFilter, setPendingOnlyFilter] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<CustomerFollowUp | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<CustomerFollowUp[]>([]);

  const activityLabelMap = useMemo(() => {
    const m: Record<string, string> = {};
    activityOptions.forEach((o) => {
      m[o.value] = o.label;
    });
    return m;
  }, [activityOptions]);

  const activityColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    activityOptions.forEach((o) => {
      const color = String(o.color ?? '').trim();
      if (color) m[o.value] = color;
    });
    return m;
  }, [activityOptions]);

  const renderActivityTypeTag = useCallback(
    (activityTypeCode?: string) => (
      <MarkerTag color={activityColorMap[activityTypeCode ?? ''] || 'processing'}>
        {activityLabelMap[activityTypeCode ?? ''] ?? '—'}
      </MarkerTag>
    ),
    [activityLabelMap, activityColorMap],
  );

  const customerSearchOptions = useMemo(
    () =>
      customerList
        .map((c: any) => ({
          label: String(c.name ?? c.customer_name ?? '').trim() || String(c.id ?? ''),
          value: Number(c.id ?? c.customer_id),
        }))
        .filter((o) => Number.isFinite(o.value) && o.value > 0),
    [customerList],
  );

  const activitySearchValueEnum = useMemo(
    () =>
      Object.fromEntries(
        activityOptions.map((o) => [o.value, { text: o.label }]),
      ) as Record<string, { text: string }>,
    [activityOptions],
  );

  const detailLifecycle = useMemo(
    () => (detailRecord ? getCustomerFollowUpLifecycle(detailRecord, t) : null),
    [detailRecord, t],
  );
  const detailNextSteps = detailLifecycle?.nextStepSuggestions;
  const hideDetailStepperNextRow = Boolean(detailNextSteps?.length);
  const showDetailLifecycleTitleSuffix = Boolean(detailNextSteps?.length);

  const recentColumns: ColumnsType<CustomerFollowUp> = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.customerFollowUp.colOccurredAt'),
        dataIndex: 'occurred_at',
        width: 162,
        render: (_, r) => (r.occurred_at ? formatDateTime(r.occurred_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colFollowUpPerson'),
        dataIndex: 'created_by_name',
        width: 100,
        ellipsis: true,
        render: (_, r) => (String(r.created_by_name ?? '').trim() || '—'),
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colActivityType'),
        dataIndex: 'activity_type_code',
        width: 100,
        ellipsis: true,
        render: (_, r) => renderActivityTypeTag(r.activity_type_code),
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colContent'),
        dataIndex: 'content',
        width: 360,
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text ellipsis={{ tooltip: r.content ?? '—' }}>
            {r.content?.trim() ? r.content : '—'}
          </Typography.Text>
        ),
      },
    ],
    [t, renderActivityTypeTag],
  );

  const detailBasicColumns: ProDescriptionsItemProps<CustomerFollowUp>[] = useMemo(
    () =>
      alignDescriptionColumns([
      { title: t('app.kuaizhizao.customerFollowUp.colCustomer'), dataIndex: 'customer_name' },
      {
        title: t('app.kuaizhizao.customerFollowUp.colActivityType'),
        dataIndex: 'activity_type_code',
        render: (_, row) => renderActivityTypeTag(row.activity_type_code),
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colOccurredAt'),
        dataIndex: 'occurred_at',
        valueType: 'dateTime',
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colNextFollowUp'),
        dataIndex: 'next_follow_up_at',
        valueType: 'dateTime',
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colQuotation'),
        dataIndex: 'quotation_code',
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colSalesOrder'),
        dataIndex: 'sales_order_code',
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colFollowUpPerson'),
        dataIndex: 'created_by_name',
        render: (_, row) => (String(row.created_by_name ?? '').trim() || '—'),
      },
      {
        title: t('app.kuaizhizao.customerFollowUp.colFollowUpCount'),
        dataIndex: 'follow_up_count',
        render: (_, row) =>
          row.follow_up_count != null && Number.isFinite(Number(row.follow_up_count))
            ? Number(row.follow_up_count)
            : '—',
      },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ] as ProDescriptionsItemProps<CustomerFollowUp>[]),
    [t, renderActivityTypeTag],
  );

  useEffect(() => {
    getDictionaryOptions(DICT_CODE)
      .then((opts) => setActivityOptions(opts || []))
      .catch(() => setActivityOptions([]));
  }, []);

  useEffect(() => {
    void loadCustomerFormReferenceList(KUAIZHIZAO_DOC_HOST.customerFollowUp).then(setCustomerList);
  }, []);

  useEffect(() => {
    if (!detailDrawerVisible || detailRecord?.customer_id == null) {
      setRecentItems([]);
      return;
    }
    let cancelled = false;
    const cid = detailRecord.customer_id;
    const excludeId = detailRecord.id;
    setRecentLoading(true);
    customerFollowUpApi
      .list({ customer_id: cid, limit: 10 })
      .then((res) => {
        if (!cancelled) {
          const items = (res.items || []).filter((row) => row.id !== excludeId);
          setRecentItems(items);
        }
      })
      .catch(() => {
        if (!cancelled) setRecentItems([]);
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailDrawerVisible, detailRecord?.customer_id, detailRecord?.id]);

  const reloadTable = () => {
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  };

  const refreshOpenDetail = useCallback(() => {
    const id = detailIdRef.current;
    if (!detailDrawerVisible || id == null) return;
    customerFollowUpApi
      .get(id)
      .then(setDetailRecord)
      .catch(() => undefined);
  }, [detailDrawerVisible]);

  const openCreate = () => {
    setEditing(null);
    setFollowUpPreset(null);
    setModalOpen(true);
  };

  const openEdit = (record: CustomerFollowUp) => {
    setFollowUpPreset(null);
    setEditing(record);
    setModalOpen(true);
  };

  const openNewFollowUpFromDetail = () => {
    if (!detailRecord) return;
    setEditing(null);
    setFollowUpPreset(followUpPresetFromRecord(detailRecord));
    setModalOpen(true);
  };

  const openCreateFromRow = (record: CustomerFollowUp) => {
    setEditing(null);
    setFollowUpPreset(followUpPresetFromRecord(record));
    setModalOpen(true);
  };

  const handleClearRevisitReminder = async () => {
    if (!detailRecord?.id) return;
    try {
      await customerFollowUpApi.update(detailRecord.id, { next_follow_up_at: null });
      message.success(t('app.kuaizhizao.customerFollowUp.clearRevisitReminderDone'));
      const fresh = await customerFollowUpApi.get(detailRecord.id);
      setDetailRecord(fresh);
      reloadTable();
    } catch {
      message.error(t('common.operationFailed'));
    }
  };

  const handleDetail = async (id: number) => {
    try {
      const row = await customerFollowUpApi.get(id);
      detailIdRef.current = id;
      setDetailRecord(row);
      setDetailDrawerVisible(true);
    } catch {
      message.error(t('app.kuaizhizao.customerFollowUp.loadFailed'));
    }
  };

  const closeDetailDrawer = () => {
    setDetailDrawerVisible(false);
    setDetailRecord(null);
    detailIdRef.current = null;
  };

  const handleDelete = (record: CustomerFollowUp, options?: { closeDrawer?: boolean }) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.customerFollowUp.deleteConfirm'),
      onOk: async () => {
        try {
          await customerFollowUpApi.delete(record.id);
          message.success(t('common.deleteSuccess'));
          if (options?.closeDrawer) {
            closeDetailDrawer();
          }
          setSelectedRowKeys((keys) => keys.filter((k) => Number(k) !== record.id));
          reloadTable();
        } catch {
          message.error(t('common.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const key of keys) {
        await customerFollowUpApi.delete(Number(key));
      }
      message.success(t('common.deleteSuccess'));
      setSelectedRowKeys([]);
      reloadTable();
    } catch (error: any) {
      message.error(error?.message || t('common.deleteFailed'));
    }
  };

  useNewShortcut(openCreate);

  useEffect(() => {
    if (pendingOnlySkipReloadRef.current) {
      pendingOnlySkipReloadRef.current = false;
      return;
    }
    actionRef.current?.reload();
  }, [pendingOnlyFilter]);

  const columns: ProColumns<CustomerFollowUp>[] = alignProColumns<CustomerFollowUp>([
    {
      title: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      dataIndex: 'customer_id',
      hideInTable: true,
      order: 10,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        optionFilterProp: 'label',
        options: customerSearchOptions,
        placeholder: t('field.customer.name'),
      },
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      dataIndex: 'customer_name',
      width: 240,
      minWidth: 240,
      uniTableKeepWidth: true,
      uniTablePrimaryFlex: false,
      resizable: false,
      fixed: 'left',
      sorter: true,
      hideInSearch: true,
      render: (_, row) => {
        const soCode = String(row.sales_order_code ?? '').trim();
        const qCode = String(row.quotation_code ?? '').trim();
        const soId = row.sales_order_id != null ? Number(row.sales_order_id) : NaN;
        const qId = row.quotation_id != null ? Number(row.quotation_id) : NaN;
        const preferSo = Boolean(soCode) && Number.isFinite(soId) && soId > 0;
        const preferQ = !preferSo && Boolean(qCode) && Number.isFinite(qId) && qId > 0;
        return (
          <UniTableStackedPrimaryCell
            primary={row.customer_name || '-'}
            secondary={soCode || qCode || '-'}
            onSecondaryClick={
              preferSo
                ? () => {
                    linkedDetail?.openLinkedDocumentDetail('sales_order', soId);
                  }
                : preferQ
                  ? () => {
                      linkedDetail?.openLinkedDocumentDetail('quotation', qId);
                    }
                  : undefined
            }
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colActivityType'),
      dataIndex: 'activity_type_code',
      hideInTable: true,
      order: 20,
      valueType: 'select',
      valueEnum: activitySearchValueEnum,
      fieldProps: {
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: t('app.kuaizhizao.customerFollowUp.colActivityType'),
      },
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colActivityType'),
      dataIndex: 'activity_type_code',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      onCell: () => ({
        style: {
          maxWidth: 120,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }),
      render: (_, row) => (
        renderActivityTypeTag(row.activity_type_code)
      ),
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colContent'),
      dataIndex: 'content',
      // RemainderFlex：跟进内容长度不确定；身份仍用 content（rank），不另起 key
      minWidth: 160,
      uniTablePrimaryFlex: true,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, row) => (
        <Typography.Text ellipsis={{ tooltip: row.content ?? '—' }} style={{ maxWidth: '100%' }}>
          {row.content?.trim() ? row.content : '—'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colQuotation'),
      dataIndex: 'quotation_code',
      hideInTable: true,
      order: 30,
      fieldProps: { placeholder: t('app.kuaizhizao.customerFollowUp.colQuotation') },
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colSalesOrder'),
      dataIndex: 'sales_order_code',
      hideInTable: true,
      order: 31,
      fieldProps: { placeholder: t('app.kuaizhizao.customerFollowUp.colSalesOrder') },
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colOccurredAt'),
      dataIndex: 'occurred_at',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_, row) =>
        row.occurred_at ? formatDateTime(row.occurred_at, 'YYYY-MM-DD HH:mm') : '',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colOccurredAtRange'),
      dataIndex: 'occurred_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 32,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colNextFollowUp'),
      dataIndex: 'next_follow_up_at',
      width: 168,
      minWidth: 168,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_, row) => {
        const text = row.next_follow_up_at ? formatDateTime(row.next_follow_up_at, 'YYYY-MM-DD HH:mm') : '—';
        const overdue = isCustomerFollowUpRevisitOverdue(row);
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'nowrap',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{text}</span>
            {overdue ? (
              <MarkerTag color="error" style={{ marginInlineEnd: 0, paddingInline: 4, lineHeight: '18px', flexShrink: 0 }}>
                {t('app.kuaizhizao.customerFollowUp.tagOverdue')}
              </MarkerTag>
            ) : null}
          </span>
        );
      },
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colFollowUpCount'),
      dataIndex: 'follow_up_count',
      width: 96,
      minWidth: 96,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_, row) =>
        row.follow_up_count != null && Number.isFinite(Number(row.follow_up_count))
          ? Number(row.follow_up_count)
          : '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colFollowUpPerson'),
      key: 'follow_up_person',
      dataIndex: 'created_by_name',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, row) => (String(row.created_by_name ?? '').trim() || '—'),
    },
    ...buildDocumentAuditColumns<CustomerFollowUp>(t),
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="d" onClick={() => handleDetail(record.id)} />,
          <Button {...rowActionKind('update')} key="e" onClick={() => openEdit(record)} />,
          <Button {...rowActionAddFollowUpFromDocument('create')} key="nf" onClick={() => openCreateFromRow(record)} />,
          <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)} />,
        ];
        return parts;
      },
    },
  ], SALES_DOC_LIST_FIELD_RANK);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBasicColumns, detailRecord,
    'customer_follow_up',
  );

  return (
    <>
      <style>{`
        .customer-follow-up-row-overdue td.ant-table-cell {
          background: var(--ant-color-warning-bg) !important;
        }
      `}</style>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<CustomerFollowUp>
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.customer-follow-ups-width-v1"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.customerFollowUps')}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          headerTitle={t('app.kuaizhizao.menu.sales-management.customer-follow-ups')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          enableRowSelection
          rowClassName={(record) =>
            isCustomerFollowUpRevisitOverdue(record) ? 'customer-follow-up-row-overdue' : ''
          }
          options={{ reload: true, density: true, setting: true }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          beforeSearchButtons={
            <ThemedSegmented
              key="pending-scope"
              surfaceBackground
              size="medium"
              value={pendingOnlyFilter ? 'pending' : 'all'}
              onChange={(v) => setPendingOnlyFilter(v === 'pending')}
              options={[
                { label: t('app.kuaizhizao.customerFollowUp.listViewAll'), value: 'all' },
                { label: t('app.kuaizhizao.customerFollowUp.pendingOnly'), value: 'pending' },
              ]}
            />
          }
          toolBarRender={() => [
            <Button
              {...rowActionKind('create')}
              key="new"
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
            >
              {t('app.kuaizhizao.customerFollowUp.new') + NEW_SHORTCUT_HINT}
            </Button>,
          ]}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          request={async (params, sort, _filter, searchFormValues) => {
            const keyword =
              typeof searchFormValues?.keyword === 'string'
                ? searchFormValues.keyword.trim() || undefined
                : undefined;
            const occurredRange = searchFormValues?.occurred_at_range as [unknown, unknown] | undefined;
            let occurredFrom: string | undefined;
            let occurredTo: string | undefined;
            if (occurredRange && Array.isArray(occurredRange) && occurredRange[0]) {
              occurredFrom = formatDateTime(occurredRange[0] as string | Date, 'YYYY-MM-DD HH:mm:ss');
              occurredTo = occurredRange[1]
                ? formatDateTime(occurredRange[1] as string | Date, 'YYYY-MM-DD HH:mm:ss')
                : occurredFrom;
            }
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            try {
              const res = await customerFollowUpApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword,
                customer_id:
                  searchFormValues?.customer_id != null && searchFormValues.customer_id !== ''
                    ? Number(searchFormValues.customer_id)
                    : undefined,
                activity_type_code:
                  typeof searchFormValues?.activity_type_code === 'string'
                    ? searchFormValues.activity_type_code.trim() || undefined
                    : undefined,
                quotation_code:
                  typeof searchFormValues?.quotation_code === 'string'
                    ? searchFormValues.quotation_code.trim() || undefined
                    : undefined,
                sales_order_code:
                  typeof searchFormValues?.sales_order_code === 'string'
                    ? searchFormValues.sales_order_code.trim() || undefined
                    : undefined,
                occurred_from: occurredFrom,
                occurred_to: occurredTo,
                pending_only: pendingOnlyFilter || undefined,
                order_by: orderBy,
              });
              return {
                data: res.items || [],
                success: true,
                total: res.total ?? 0,
              };
            } catch {
              message.error(t('app.kuaizhizao.customerFollowUp.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.customerFollowUp.detailTitle', {
          suffix: detailRecord?.customer_name ? ` - ${detailRecord.customer_name}` : '',
        })}
        open={detailDrawerVisible}
        onClose={closeDetailDrawer}
        size={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detailRecord ? (
            <Space size="small">
              {detailRecord.next_follow_up_at ? (
                <Button onClick={() => void handleClearRevisitReminder()}>
                  {t('app.kuaizhizao.customerFollowUp.clearRevisitReminder')}
                </Button>
              ) : null}
              <Button type="primary" icon={<PlusOutlined />} onClick={openNewFollowUpFromDetail}>
                {t('app.kuaizhizao.customerFollowUp.new')}
              </Button>
              <Button icon={<EditOutlined />} onClick={() => openEdit(detailRecord)}>
                {t('common.edit')}
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(detailRecord, { closeDrawer: true })}>
                {t('common.delete')}
              </Button>
            </Space>
          ) : undefined
        }
        basic={
          detailRecord ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        collaborationTitleSuffix={
          showDetailLifecycleTitleSuffix ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('common.next')}：
              {detailNextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationLifecycle={
          detailRecord && detailLifecycle?.mainStages?.length ? (
            <UniLifecycleStepper
              steps={detailLifecycle.mainStages}
              status={detailLifecycle.status}
              showLabels
              nextStepSuggestions={detailLifecycle.nextStepSuggestions}
              hideNextStepSuggestions={hideDetailStepperNextRow}
            />
          ) : undefined
        }
        linesTitle={t('app.kuaizhizao.customerFollowUp.colContent')}
        lines={
          detailRecord ? (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {detailRecord.content?.trim() ? detailRecord.content : '—'}
            </Typography.Paragraph>
          ) : undefined
        }
        timelineTitle={t('app.kuaizhizao.customerFollowUp.recentSameCustomerTitle')}
        timeline={
          detailRecord ? (
            recentLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : recentItems.length === 0 ? (
              <Empty description={t('app.kuaizhizao.customerFollowUp.recentSameCustomerEmpty')} />
            ) : (
              <Table<CustomerFollowUp>
                size="small"
                rowKey="id"
                pagination={false}
                columns={recentColumns}
                dataSource={recentItems}
              />
            )
          ) : undefined
        }
      />

      <CustomerFollowUpFormModal
        open={modalOpen}
        editing={editing}
        preset={followUpPreset}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setFollowUpPreset(null);
        }}
        onSuccess={() => {
          reloadTable();
          refreshOpenDetail();
        }}
      />
    </>
  );
};

export default CustomerFollowUpsPage;
