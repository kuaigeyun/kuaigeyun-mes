/**
 * 客户跟进（销售极简 CRM）
 *
 * 布局与「销售退货」等列表页一致：ListPageTemplate + UniTable
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { customerFollowUpApi, type CustomerFollowUp } from '../../../services/customer-follow-up';
import { listQuotations, type Quotation } from '../../../services/quotation';
import { listSalesOrders, type SalesOrder } from '../../../services/sales-order';
import { customerApi, getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import type { Customer } from '../../../../master-data/types/supply-chain';

const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';

const CustomerFollowUpsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFollowUp | null>(null);
  const [form] = Form.useForm();
  const modalCustomerId = Form.useWatch('customer_id', form);
  const [quotationList, setQuotationList] = useState<Quotation[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<SalesOrder[]>([]);
  const [docListsLoading, setDocListsLoading] = useState(false);
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

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    setDocListsLoading(true);
    (async () => {
      try {
        const [qRes, oRes] = await Promise.all([
          listQuotations({ limit: 500 }),
          listSalesOrders({ limit: 500 }),
        ]);
        if (cancelled) return;
        setQuotationList(Array.isArray(qRes.data) ? qRes.data : []);
        setSalesOrderList(Array.isArray(oRes.data) ? oRes.data : []);
      } catch {
        if (!cancelled) {
          setQuotationList([]);
          setSalesOrderList([]);
        }
      } finally {
        if (!cancelled) setDocListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  const quotationOptions = useMemo(() => {
    if (modalCustomerId == null) return [];
    return quotationList
      .filter((q) => q.id != null && q.customer_id === modalCustomerId)
      .map((q) => ({
        value: q.id as number,
        label: [q.quotation_code, q.customer_name].filter(Boolean).join(' · ') || `#${q.id}`,
      }));
  }, [quotationList, modalCustomerId]);

  const salesOrderOptions = useMemo(() => {
    if (modalCustomerId == null) return [];
    return salesOrderList
      .filter((o) => o.id != null && o.customer_id === modalCustomerId)
      .map((o) => ({
        value: o.id as number,
        label: [o.order_code, o.customer_name].filter(Boolean).join(' · ') || `#${o.id}`,
      }));
  }, [salesOrderList, modalCustomerId]);

  const quotationSelectOptions = useMemo(() => {
    if (
      editing?.quotation_id != null &&
      !quotationOptions.some((o) => o.value === editing.quotation_id)
    ) {
      return [
        ...quotationOptions,
        {
          value: editing.quotation_id,
          label: editing.quotation_code || `#${editing.quotation_id}`,
        },
      ];
    }
    return quotationOptions;
  }, [quotationOptions, editing]);

  const salesOrderSelectOptions = useMemo(() => {
    if (
      editing?.sales_order_id != null &&
      !salesOrderOptions.some((o) => o.value === editing.sales_order_id)
    ) {
      return [
        ...salesOrderOptions,
        {
          value: editing.sales_order_id,
          label: editing.sales_order_code || `#${editing.sales_order_id}`,
        },
      ];
    }
    return salesOrderOptions;
  }, [salesOrderOptions, editing]);

  const loadDictAndCustomers = async () => {
    try {
      const [cust, dictOpts] = await Promise.all([
        customerApi.list({ limit: 2000, isActive: true } as any),
        getDictionaryOptions(DICT_CODE),
      ]);
      setCustomers(Array.isArray(cust) ? cust : []);
      setActivityOptions(dictOpts);
    } catch {
      setCustomers([]);
      setActivityOptions([]);
    }
  };

  useEffect(() => {
    loadDictAndCustomers();
  }, []);

  const reloadTable = () => {
    actionRef.current?.reload();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      occurred_at: dayjs(),
    });
    setModalOpen(true);
  };

  const openEdit = (record: CustomerFollowUp) => {
    setEditing(record);
    form.setFieldsValue({
      customer_id: record.customer_id,
      activity_type_code: record.activity_type_code,
      content: record.content,
      occurred_at: record.occurred_at ? dayjs(record.occurred_at) : dayjs(),
      next_follow_up_at: record.next_follow_up_at ? dayjs(record.next_follow_up_at) : undefined,
      quotation_id: record.quotation_id ?? undefined,
      sales_order_id: record.sales_order_id ?? undefined,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const customer = customers.find((c) => c.id === v.customer_id);
      if (!customer) {
        message.error(t('app.kuaizhizao.customerFollowUp.customerRequired'));
        return;
      }
      const occurred = (v.occurred_at as dayjs.Dayjs).toISOString();
      const next =
        v.next_follow_up_at != null && v.next_follow_up_at !== ''
          ? (v.next_follow_up_at as dayjs.Dayjs).toISOString()
          : null;
      if (editing) {
        await customerFollowUpApi.update(editing.id, {
          customer_name: customer.name,
          activity_type_code: v.activity_type_code,
          content: v.content,
          occurred_at: occurred,
          next_follow_up_at: next,
          quotation_id: v.quotation_id ?? null,
          sales_order_id: v.sales_order_id ?? null,
        });
        message.success(t('pages.system.siteSettings.saveSuccess'));
      } else {
        await customerFollowUpApi.create({
          customer_id: v.customer_id,
          activity_type_code: v.activity_type_code,
          content: v.content,
          occurred_at: occurred,
          next_follow_up_at: next,
          quotation_id: v.quotation_id ?? null,
          sales_order_id: v.sales_order_id ?? null,
        });
        message.success(t('common.createSuccess'));
      }
      setModalOpen(false);
      reloadTable();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || t('common.operationFailed'));
    }
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
            <Select
              key="cust"
              allowClear
              placeholder={t('app.kuaizhizao.customerFollowUp.filterCustomer')}
              style={{ width: 200 }}
              options={customers.map((c) => ({ label: `${c.code} ${c.name}`, value: c.id }))}
              onChange={(v) => {
                filtersRef.current.customer_id = v ?? undefined;
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
            <Button key="new" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('app.kuaizhizao.customerFollowUp.new')}
            </Button>,
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

      <Modal
        title={
          editing
            ? t('app.kuaizhizao.customerFollowUp.editTitle')
            : t('app.kuaizhizao.customerFollowUp.createTitle')
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={[20, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="customer_id"
                label={t('app.kuaizhizao.customerFollowUp.fieldCustomer')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={!!editing}
                  options={customers.map((c) => ({
                    label: `${c.code} ${c.name}`,
                    value: c.id,
                  }))}
                  onChange={() => {
                    form.setFieldsValue({ quotation_id: undefined, sales_order_id: undefined });
                  }}
                />
              </Form.Item>
              <Form.Item
                name="activity_type_code"
                label={t('app.kuaizhizao.customerFollowUp.fieldActivityType')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select options={activityOptions} />
              </Form.Item>
              <Form.Item
                name="occurred_at"
                label={t('app.kuaizhizao.customerFollowUp.fieldOccurredAt')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
              <Form.Item name="next_follow_up_at" label={t('app.kuaizhizao.customerFollowUp.fieldNextFollowUp')}>
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
              <Form.Item name="quotation_id" label={t('app.kuaizhizao.customerFollowUp.fieldLinkedQuotation')}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={docListsLoading}
                  disabled={modalCustomerId == null}
                  placeholder={
                    modalCustomerId == null
                      ? t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
                      : t('app.kuaizhizao.customerFollowUp.optionalSelectDocument')
                  }
                  options={quotationSelectOptions}
                />
              </Form.Item>
              <Form.Item name="sales_order_id" label={t('app.kuaizhizao.customerFollowUp.fieldLinkedSalesOrder')}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={docListsLoading}
                  disabled={modalCustomerId == null}
                  placeholder={
                    modalCustomerId == null
                      ? t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
                      : t('app.kuaizhizao.customerFollowUp.optionalSelectDocument')
                  }
                  options={salesOrderSelectOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="content"
                label={t('app.kuaizhizao.customerFollowUp.fieldContent')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Input.TextArea rows={10} style={{ resize: 'vertical' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default CustomerFollowUpsPage;
