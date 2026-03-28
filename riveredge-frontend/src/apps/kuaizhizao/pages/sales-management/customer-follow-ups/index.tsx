/**
 * 客户跟进（销售极简 CRM）
 *
 * 布局与「销售退货」等列表页一致：ListPageTemplate + UniTable
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Space, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

import { customerFollowUpApi, type CustomerFollowUp } from '../../../services/customer-follow-up';
import { customerApi, getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { CustomerFollowUpFormModal } from '../../../components/CustomerFollowUpFormModal';
import type { Customer } from '../../../../master-data/types/supply-chain';

const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';

const getCustomerId = (c: any): number | null => {
  const id = Number(c?.id ?? c?.customer_id);
  return Number.isFinite(id) ? id : null;
};

const getCustomerName = (c: any): string => {
  const code = String(c?.code ?? c?.customer_code ?? '').trim();
  const name = String(c?.name ?? c?.customer_name ?? '').trim();
  return `${code} ${name}`.trim();
};

const CustomerFollowUpsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFollowUp | null>(null);
  const filtersRef = useRef({
    customer_id: undefined as number | undefined,
    pending_only: false,
  });

  const activityLabelMap = useMemo(() => {
    const m: Record<string, string> = {};
    activityOptions.forEach((o) => {
      m[o.value] = o.label;
    });
    return m;
  }, [activityOptions]);

  const loadCustomersForFilter = async () => {
    try {
      const val = await customerApi.list({ limit: 1000, isActive: true } as any);
      let custData: any[] = [];
      if (Array.isArray(val)) {
        custData = val;
      } else if (val && typeof val === 'object') {
        custData = (val as any).items || (val as any).data || [];
      }
      const uniq = new Map<number, any>();
      for (const c of custData) {
        const id = getCustomerId(c);
        if (id == null) continue;
        if (!uniq.has(id)) uniq.set(id, c);
      }
      setCustomers(Array.from(uniq.values()) as Customer[]);
    } catch {
      setCustomers([]);
    }
  };

  useEffect(() => {
    loadCustomersForFilter();
    getDictionaryOptions(DICT_CODE)
      .then((opts) => setActivityOptions(opts || []))
      .catch(() => setActivityOptions([]));
  }, []);

  const reloadTable = () => {
    actionRef.current?.reload();
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: CustomerFollowUp) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleDelete = (record: CustomerFollowUp) => {
    Modal.confirm({
      title: t('app.kuaizhizao.customerFollowUp.deleteConfirm'),
      onOk: async () => {
        try {
          await customerFollowUpApi.delete(record.id);
          message.success(t('common.deleteSuccess'));
          reloadTable();
        } catch {
          message.error(t('common.deleteFailed'));
        }
      },
    });
  };

  useNewShortcut(openCreate);

  const columns: ProColumns<CustomerFollowUp>[] = [
    {
      title: t('app.kuaizhizao.customerFollowUp.keywordPlaceholder'),
      dataIndex: 'keyword',
      hideInTable: true,
      valueType: 'text',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      dataIndex: 'customer_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colActivityType'),
      dataIndex: 'activity_type_code',
      width: 120,
      hideInSearch: true,
      render: (_, row) => activityLabelMap[row.activity_type_code] || row.activity_type_code,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colContent'),
      dataIndex: 'content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colOccurredAt'),
      dataIndex: 'occurred_at',
      width: 170,
      hideInSearch: true,
      render: (_, row) =>
        row.occurred_at ? dayjs(row.occurred_at).format('YYYY-MM-DD HH:mm') : '',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colNextFollowUp'),
      dataIndex: 'next_follow_up_at',
      width: 170,
      hideInSearch: true,
      render: (_, row) =>
        row.next_follow_up_at ? dayjs(row.next_follow_up_at).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colQuotation'),
      dataIndex: 'quotation_code',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (v) => v || '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colSalesOrder'),
      dataIndex: 'sales_order_code',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (v) => v || '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colCreator'),
      dataIndex: 'created_by_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('common.actions'),
      width: 140,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            {t('common.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<CustomerFollowUp>
          headerTitle={t('app.kuaizhizao.menu.sales-management.customer-follow-ups')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          options={{ reload: true, density: true, setting: true }}
          scroll={{ x: 1200 }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          toolBarRender={() => [
            <Button key="new" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('app.kuaizhizao.customerFollowUp.new') + NEW_SHORTCUT_HINT}
            </Button>,
            <UniDropdown
              key="cust"
              allowClear
              showSearch
              placeholder={t('app.kuaizhizao.customerFollowUp.filterCustomer')}
              style={{ width: 200 }}
              options={customers
                .map((c: any) => {
                  const id = getCustomerId(c);
                  if (id == null) return null;
                  return { label: getCustomerName(c) || String(id), value: id };
                })
                .filter(Boolean) as Array<{ label: string; value: number }>}
              onChange={(v) => {
                filtersRef.current.customer_id = v != null ? Number(v) : undefined;
                reloadTable();
              }}
            />,
            <span key="pendingLabel">{t('app.kuaizhizao.customerFollowUp.pendingOnly')}</span>,
            <Switch
              key="pending"
              onChange={(v) => {
                filtersRef.current.pending_only = v;
                reloadTable();
              }}
            />,
          ]}
          request={async (params, _sort, _filter, searchFormValues) => {
            const f = filtersRef.current;
            const keyword =
              typeof searchFormValues?.keyword === 'string'
                ? searchFormValues.keyword.trim() || undefined
                : undefined;
            try {
              const res = await customerFollowUpApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword,
                customer_id: f.customer_id,
                pending_only: f.pending_only || undefined,
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

      <CustomerFollowUpFormModal
        open={modalOpen}
        editing={editing}
        preset={null}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSuccess={reloadTable}
      />
    </>
  );
};

export default CustomerFollowUpsPage;
