/**
 * 客户跟进（销售极简 CRM）
 *
 * 布局与「销售退货」等列表页一致：ListPageTemplate + UniTable
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

import { customerFollowUpApi, type CustomerFollowUp } from '../../../services/customer-follow-up';
import { getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { CustomerFollowUpFormModal } from '../../../components/CustomerFollowUpFormModal';

const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';

const CustomerFollowUpsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFollowUp | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const activityLabelMap = useMemo(() => {
    const m: Record<string, string> = {};
    activityOptions.forEach((o) => {
      m[o.value] = o.label;
    });
    return m;
  }, [activityOptions]);

  useEffect(() => {
    getDictionaryOptions(DICT_CODE)
      .then((opts) => setActivityOptions(opts || []))
      .catch(() => setActivityOptions([]));
  }, []);

  const reloadTable = () => {
    invalidateMenuBadgeCounts();

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

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: keys.length }),
      onOk: async () => {
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
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          headerTitle={t('app.kuaizhizao.menu.sales-management.customer-follow-ups')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          enableRowSelection
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
            <Button
              key="batchDelete"
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={() => handleBatchDelete(selectedRowKeys)}
            >
              {t('common.batchDelete')}
            </Button>,
          ]}
          request={async (params, _sort, _filter, searchFormValues) => {
            const keyword =
              typeof searchFormValues?.keyword === 'string'
                ? searchFormValues.keyword.trim() || undefined
                : undefined;
            try {
              const res = await customerFollowUpApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword,
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
