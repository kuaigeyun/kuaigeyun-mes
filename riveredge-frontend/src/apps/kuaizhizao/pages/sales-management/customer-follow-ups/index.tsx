/**
 * 客户跟进（销售极简 CRM）
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { customerFollowUpApi, type CustomerFollowUp } from '../../../services/customer-follow-up';
import { customerApi, getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import type { Customer } from '../../../../master-data/types/supply-chain';

const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';

const CustomerFollowUpsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<CustomerFollowUp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFollowUp | null>(null);
  const [form] = Form.useForm();
  const filtersRef = useRef({
    keyword: '' as string,
    customer_id: undefined as number | undefined,
    pending_only: false,
    occurred_from: undefined as string | undefined,
    occurred_to: undefined as string | undefined,
  });

  const activityLabelMap = useMemo(() => {
    const m: Record<string, string> = {};
    activityOptions.forEach((o) => {
      m[o.value] = o.label;
    });
    return m;
  }, [activityOptions]);

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

  const fetchList = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const f = filtersRef.current;
      const res = await customerFollowUpApi.list({
        skip: (p - 1) * ps,
        limit: ps,
        keyword: f.keyword || undefined,
        customer_id: f.customer_id,
        pending_only: f.pending_only || undefined,
        occurred_from: f.occurred_from,
        occurred_to: f.occurred_to,
      });
      setDataSource(res.items || []);
      setTotal(res.total ?? 0);
    } catch (e) {
      message.error(t('app.kuaizhizao.customerFollowUp.loadFailed'));
      setDataSource([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

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
      fetchList(page, pageSize);
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
          fetchList(page, pageSize);
        } catch {
          message.error(t('common.deleteFailed'));
        }
      },
    });
  };

  const columns: ColumnsType<CustomerFollowUp> = [
    {
      title: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      dataIndex: 'customer_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colActivityType'),
      dataIndex: 'activity_type_code',
      width: 120,
      render: (code: string) => activityLabelMap[code] || code,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colContent'),
      dataIndex: 'content',
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colOccurredAt'),
      dataIndex: 'occurred_at',
      width: 170,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : ''),
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colNextFollowUp'),
      dataIndex: 'next_follow_up_at',
      width: 170,
      render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colQuotation'),
      dataIndex: 'quotation_code',
      width: 120,
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colSalesOrder'),
      dataIndex: 'sales_order_code',
      width: 120,
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colCreator'),
      dataIndex: 'created_by_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 140,
      fixed: 'right',
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
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>{t('app.kuaizhizao.menu.sales-management.customer-follow-ups')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t('app.kuaizhizao.customerFollowUp.new')}
        </Button>
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder={t('app.kuaizhizao.customerFollowUp.keywordPlaceholder')}
          style={{ width: 220 }}
          onSearch={(v) => {
            filtersRef.current.keyword = v.trim();
            setPage(1);
            fetchList(1, pageSize);
          }}
        />
        <Select
          allowClear
          placeholder={t('app.kuaizhizao.customerFollowUp.filterCustomer')}
          style={{ width: 200 }}
          options={customers.map((c) => ({ label: `${c.code} ${c.name}`, value: c.id }))}
          onChange={(v) => {
            filtersRef.current.customer_id = v ?? undefined;
            setPage(1);
            fetchList(1, pageSize);
          }}
        />
        <span>{t('app.kuaizhizao.customerFollowUp.pendingOnly')}</span>
        <Switch
          onChange={(v) => {
            filtersRef.current.pending_only = v;
            setPage(1);
            fetchList(1, pageSize);
          }}
        />
      </Space>

      <Table<CustomerFollowUp>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={dataSource}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps || 20);
          },
        }}
      />

      <Modal
        title={
          editing
            ? t('app.kuaizhizao.customerFollowUp.editTitle')
            : t('app.kuaizhizao.customerFollowUp.createTitle')
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
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
            name="content"
            label={t('app.kuaizhizao.customerFollowUp.fieldContent')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input.TextArea rows={4} />
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
          <Form.Item name="quotation_id" label={t('app.kuaizhizao.customerFollowUp.fieldQuotationId')}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder={t('app.kuaizhizao.customerFollowUp.optionalIdHint')} />
          </Form.Item>
          <Form.Item name="sales_order_id" label={t('app.kuaizhizao.customerFollowUp.fieldSalesOrderId')}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder={t('app.kuaizhizao.customerFollowUp.optionalIdHint')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomerFollowUpsPage;
