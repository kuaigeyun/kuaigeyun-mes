import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag } from 'antd';
import { PlusOutlined, UserAddOutlined, UserSwitchOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { renderRowActionsOverflow } from '../../../../../components/uni-action';
import { getUserOptions } from '../../../../master-data/services/supply-chain';
import { CustomerFollowUpFormModal } from '../../../components/CustomerFollowUpFormModal';
import { customerPoolApi, type CustomerPoolItem, type CustomerPoolRule } from '../../../services/customer-pool';

const CustomerPoolPage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [scope, setScope] = useState<'pool' | 'mine' | 'all'>('pool');
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpCustomerId, setFollowUpCustomerId] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCustomer, setAssignCustomer] = useState<CustomerPoolItem | null>(null);
  const [assignUsers, setAssignUsers] = useState<Array<{ label: string; value: string | number }>>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rules, setRules] = useState<CustomerPoolRule | null>(null);
  const [assignForm] = Form.useForm<{ salesman_id: number; reason?: string }>();
  const [rulesForm] = Form.useForm<CustomerPoolRule>();

  const loadRules = async () => {
    const data = await customerPoolApi.getRules();
    setRules(data);
    rulesForm.setFieldsValue(data);
  };

  const openRules = async () => {
    try {
      await loadRules();
      setRulesOpen(true);
    } catch {
      message.error('加载客户池规则失败');
    }
  };

  const openAssignModal = async (row: CustomerPoolItem) => {
    setAssignCustomer(row);
    setAssignOpen(true);
    assignForm.resetFields();
    try {
      const options = await getUserOptions();
      setAssignUsers(options || []);
    } catch {
      setAssignUsers([]);
    }
  };

  const openFollowUp = (customerId: number) => {
    setFollowUpCustomerId(customerId);
    setFollowUpOpen(true);
  };

  const toQuotation = (customerId: number) => {
    navigate('/apps/kuaizhizao/sales-management/quotations', {
      state: { openCreateWithCustomerId: customerId },
    });
  };

  const claimAndQuote = async (row: CustomerPoolItem) => {
    try {
      const owned = await customerPoolApi.claim(row.id);
      message.success('领取成功');
      actionRef.current?.reload();
      toQuotation(owned.id);
    } catch (error: any) {
      message.error(error?.message || '领取失败');
    }
  };

  const columns: ProColumns<CustomerPoolItem>[] = useMemo(
    () => [
      { title: '关键词', dataIndex: 'keyword', hideInTable: true, valueType: 'text' },
      { title: '客户编码', dataIndex: 'code', width: 150 },
      { title: '客户名称', dataIndex: 'name', width: 220, ellipsis: true },
      { title: '联系人', dataIndex: 'contact_person', width: 120, hideInSearch: true },
      { title: '联系电话', dataIndex: 'phone', width: 140, hideInSearch: true },
      {
        title: '归属业务员',
        dataIndex: 'salesman_name',
        width: 120,
        hideInSearch: true,
        render: (_, row) => row.salesman_name || '—',
      },
      {
        title: '池状态',
        dataIndex: 'pool_status',
        width: 100,
        hideInSearch: true,
        render: (_, row) => (
          row.pool_status === 'pool' ? <Tag color="blue">公海</Tag> : <Tag color="green">我的客户</Tag>
        ),
      },
      {
        title: '最近跟进',
        dataIndex: 'last_follow_up_at',
        width: 165,
        hideInSearch: true,
        render: (_, row) => (row.last_follow_up_at ? dayjs(row.last_follow_up_at).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: '预计回收',
        dataIndex: 'recycle_at',
        width: 165,
        hideInSearch: true,
        render: (_, row) => (row.recycle_at ? dayjs(row.recycle_at).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: '操作',
        dataIndex: 'option',
        fixed: 'right',
        minWidth: 220,
        hideInSearch: true,
        render: (_, row) => {
          const actions: React.ReactNode[] = [];
          if (row.pool_status === 'pool') {
            actions.push(
              <Button key="claim" type="link" size="small" icon={<UserAddOutlined />} onClick={() => claimAndQuote(row)}>
                领取并报价
              </Button>
            );
            actions.push(
              <Button key="assign" type="link" size="small" icon={<UserSwitchOutlined />} onClick={() => openAssignModal(row)}>
                分配
              </Button>
            );
          } else {
            actions.push(
              <Button key="follow-up" type="link" size="small" icon={<PlusOutlined />} onClick={() => openFollowUp(row.id)}>
                新建跟进
              </Button>
            );
            actions.push(
              <Button key="quote" type="link" size="small" onClick={() => toQuotation(row.id)}>
                去报价
              </Button>
            );
            actions.push(
              <Button
                key="release"
                type="link"
                size="small"
                icon={<RollbackOutlined />}
                onClick={async () => {
                  try {
                    await customerPoolApi.release(row.id);
                    message.success('已释放回公海');
                    actionRef.current?.reload();
                  } catch (error: any) {
                    message.error(error?.message || '释放失败');
                  }
                }}
              >
                释放
              </Button>
            );
          }
          return renderRowActionsOverflow(actions, `pool-${row.id}`);
        },
      },
    ],
    [message],
  );

  return (
    <>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<CustomerPoolItem>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          headerTitle="客户池"
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.customer-pool"
          beforeSearchButtons={
            <ThemedSegmented
              size="middle"
              value={scope}
              onChange={(v) => setScope(v as 'pool' | 'mine' | 'all')}
              options={[
                { label: '公海客户', value: 'pool' },
                { label: '我的客户', value: 'mine' },
                { label: '全部视图', value: 'all' },
              ]}
            />
          }
          toolBarRender={() => [
            <Button key="rules" onClick={openRules}>
              回收规则
            </Button>,
          ]}
          request={async (params, _sort, _filter, searchValues) => {
            try {
              const res = await customerPoolApi.list({
                scope,
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword: typeof searchValues?.keyword === 'string' ? searchValues.keyword.trim() || undefined : undefined,
              });
              return { data: res.items || [], total: res.total || 0, success: true };
            } catch {
              message.error('加载客户池失败');
              return { data: [], total: 0, success: false };
            }
          }}
        />
      </ListPageTemplate>

      <Modal
        title="分配客户"
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false);
          setAssignCustomer(null);
        }}
        onOk={async () => {
          try {
            const values = await assignForm.validateFields();
            if (!assignCustomer) return;
            await customerPoolApi.assign(assignCustomer.id, values.salesman_id, values.reason);
            message.success('分配成功');
            setAssignOpen(false);
            setAssignCustomer(null);
            actionRef.current?.reload();
          } catch (error: any) {
            if (!error?.errorFields) message.error(error?.message || '分配失败');
          }
        }}
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item name="salesman_id" label="分配给业务员" rules={[{ required: true, message: '请选择业务员' }]}>
            <Select showSearch options={assignUsers} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <Input placeholder="可选，记录分配原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="客户池规则"
        open={rulesOpen}
        width={420}
        onClose={() => setRulesOpen(false)}
        extra={
          <Button
            type="primary"
            loading={rulesSaving}
            onClick={async () => {
              try {
                const values = await rulesForm.validateFields();
                setRulesSaving(true);
                const saved = await customerPoolApi.updateRules(values);
                setRules(saved);
                message.success('规则保存成功');
                setRulesOpen(false);
              } catch (error: any) {
                if (!error?.errorFields) message.error(error?.message || '规则保存失败');
              } finally {
                setRulesSaving(false);
              }
            }}
          >
            保存
          </Button>
        }
      >
        <Form form={rulesForm} layout="vertical" initialValues={rules || undefined}>
          <Form.Item name="recycle_enabled" label="启用自动回收" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="recycle_after_days" label="未跟进回收天数" rules={[{ required: true, message: '请输入天数' }]}>
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max_owned_customers" label="个人持有上限（0=不限制）" rules={[{ required: true, message: '请输入上限' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="allow_claim_others" label="允许领取他人名下客户" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      <CustomerFollowUpFormModal
        open={followUpOpen}
        editing={null}
        preset={followUpCustomerId ? { customer_id: followUpCustomerId } : null}
        onClose={() => {
          setFollowUpOpen(false);
          setFollowUpCustomerId(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />
    </>
  );
};

export default CustomerPoolPage;

