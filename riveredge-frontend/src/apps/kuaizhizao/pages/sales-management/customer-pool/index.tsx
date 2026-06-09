import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag } from 'antd';
import {
  PlusOutlined,
  UserAddOutlined,
  UserSwitchOutlined,
  RollbackOutlined,
  SyncOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useCustomerPoolPermissions } from '../../../hooks/useCustomerPoolPermissions';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import dayjs from 'dayjs';

import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { getUserOptions } from '../../../../master-data/services/supply-chain';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { CustomerDetailDrawer } from '../../../../master-data/components/CustomerDetailDrawer';
import { CustomerFollowUpFormModal } from '../../../components/CustomerFollowUpFormModal';
import { customerPoolApi, type CustomerPoolItem, type CustomerPoolRule } from '../../../services/customer-pool';

const CustomerPoolPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const [scope, setScope] = useState<'pool' | 'mine' | 'all'>('all');
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const handleScopeChange = useCallback((next: 'pool' | 'mine' | 'all') => {
    if (next === scopeRef.current) return;
    scopeRef.current = next;
    setScope(next);
    actionRef.current?.reload();
  }, []);
  const {
    canClaim,
    canAssign,
    canRelease,
    canRecycle,
    canUpdateRules,
  } = useCustomerPoolPermissions();
  const { canCreate: canCreateCustomer, canUpdate: canUpdateCustomer } =
    useResourcePermissions('master-data:supply-chain:customer');
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUuid, setDetailUuid] = useState<string | null>(null);
  const [followUpCustomerId, setFollowUpCustomerId] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCustomer, setAssignCustomer] = useState<CustomerPoolItem | null>(null);
  const [assignUsers, setAssignUsers] = useState<Array<{ label: string; value: string | number }>>([]);
  const [salesmanOptions, setSalesmanOptions] = useState<Array<{ label: string; value: string | number }>>([]);
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

  const openEditCustomer = (uuid: string) => {
    setEditUuid(uuid);
    setEditOpen(true);
  };

  const openCreateCustomer = useCallback(() => {
    setEditUuid(null);
    setEditOpen(true);
  }, []);

  useNewShortcut(canCreateCustomer ? openCreateCustomer : undefined);

  const openDetailCustomer = (uuid: string) => {
    setDetailUuid(uuid);
    setDetailOpen(true);
  };

  const toQuotation = (customerId: number) => {
    navigate(`/apps/kuaizhizao/sales-management/quotations/new?customerId=${customerId}`);
  };

  const confirmReleaseCustomer = useCallback(
    (row: CustomerPoolItem) => {
      modal.confirm({
        title: '确认释放客户',
        content: `确定将「${row.name}」释放回公共客户池吗？释放后将不再归属当前业务员。`,
        okText: '确认释放',
        cancelText: '取消',
        onOk: async () => {
          try {
            await customerPoolApi.release(row.id);
            message.success('已释放回公海');
            actionRef.current?.reload();
          } catch (error: any) {
            message.error(error?.message || '释放失败');
            throw error;
          }
        },
      });
    },
    [message, modal],
  );

  const claimAndQuote = async (row: CustomerPoolItem) => {
    try {
      const owned = await customerPoolApi.claim(row.id);
      message.success('领取成功，可在主数据完善开票资料');
      actionRef.current?.reload();
      const customerId = Number(owned?.id ?? row.id);
      if (!Number.isFinite(customerId) || customerId <= 0) {
        message.warning('领取成功，但无法跳转报价单，请从列表手动创建');
        return;
      }
      toQuotation(customerId);
    } catch (error: any) {
      message.error(error?.message || '领取失败');
    }
  };

  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId) return;
    handleScopeChange('all');
    const next = new URLSearchParams(searchParams);
    next.delete('customerId');
    setSearchParams(next, { replace: true });
  }, [handleScopeChange, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const options = await getUserOptions();
        if (!cancelled) setSalesmanOptions(options || []);
      } catch {
        if (!cancelled) setSalesmanOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesmanValueEnum = useMemo(
    () =>
      Object.fromEntries(
        salesmanOptions.map((option) => [String(option.value), { text: option.label }]),
      ),
    [salesmanOptions],
  );

  const poolStatusValueEnum = useMemo(
    () => ({
      pool: { text: t('app.kuaizhizao.customerPool.scopePublic') },
      owned: { text: t('app.kuaizhizao.customerPool.scopePrivate') },
    }),
    [t],
  );

  const columns: ProColumns<CustomerPoolItem>[] = useMemo(
    () => [
      {
        title: '关键词',
        dataIndex: 'keyword',
        hideInTable: true,
        valueType: 'text',
        fieldProps: {
          allowClear: true,
          placeholder: t('app.kuaizhizao.customerFollowUp.keywordPlaceholder'),
        },
      },
      { title: t('field.customer.code'), dataIndex: 'code', width: 150, hideInSearch: true },
      { title: t('field.customer.name'), dataIndex: 'name', width: 220, ellipsis: true, hideInSearch: true },
      { title: t('field.customer.contactPerson'), dataIndex: 'contact_person', width: 120, hideInSearch: true },
      { title: t('field.customer.phone'), dataIndex: 'phone', width: 140, hideInSearch: true },
      {
        title: t('field.customer.salesman'),
        dataIndex: 'salesman_name',
        width: 120,
        hideInSearch: true,
        render: (_, row) => row.salesman_name || '—',
      },
      {
        title: t('field.customer.salesman'),
        dataIndex: 'salesmanId',
        hideInTable: true,
        valueType: 'select',
        valueEnum: salesmanValueEnum,
        fieldProps: {
          options: salesmanOptions,
          showSearch: true,
          optionFilterProp: 'label',
          filterOption: (input: string, option?: { label?: React.ReactNode }) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase()),
          allowClear: true,
          placeholder: t('field.customer.salesmanPlaceholder'),
        },
      },
      {
        title: t('field.customer.poolStatus'),
        dataIndex: 'poolStatus',
        hideInTable: true,
        valueType: 'select',
        valueEnum: poolStatusValueEnum,
        hideInSearch: scope !== 'all',
        fieldProps: { allowClear: true },
      },
      {
        title: t('field.customer.poolStatus'),
        dataIndex: 'pool_status',
        width: 100,
        hideInSearch: true,
        render: (_, row) => (
          row.pool_status === 'pool' ? (
            <Tag color="blue">{t('app.kuaizhizao.customerPool.scopePublic')}</Tag>
          ) : (
            <Tag color="green">{t('app.kuaizhizao.customerPool.scopePrivate')}</Tag>
          )
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
        minWidth: 260,
        hideInSearch: true,
        render: (_, row) => {
          const actions: React.ReactNode[] = [];
          if (row.uuid) {
            actions.push(
              <Button {...rowActionKind('read')}
                key="detail"
                type="link"
                size="small"
                onClick={() => openDetailCustomer(row.uuid)}
              >
                {t('common.detail')}
              </Button>
            );
            if (canUpdateCustomer) {
              actions.push(
                <Button {...rowActionKind('update')}
                  key="edit"
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditCustomer(row.uuid)}
                >
                  {t('field.customField.edit')}
                </Button>
              );
            }
          }
          if (row.pool_status === 'pool') {
            if (canClaim) {
              actions.push(
                <Button {...rowActionKind('claim')} key="claim" onClick={() => claimAndQuote(row)}>
                  领取并报价
                </Button>
              );
            }
            if (canAssign) {
              actions.push(
                <Button {...rowActionKind('assign')} key="assign" onClick={() => openAssignModal(row)}>
                  分配
                </Button>
              );
            }
          } else {
            actions.push(
              <Button {...rowActionKind('create')} key="follow-up" onClick={() => openFollowUp(row.id)}>
                新建跟进
              </Button>
            );
            actions.push(
              <Button {...rowActionKind('create')} key="quote" onClick={() => toQuotation(row.id)}>
                去报价
              </Button>
            );
            if (canRelease) {
              actions.push(
                <Button {...rowActionKind('release')}
                  key="release"
                  type="link"
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    confirmReleaseCustomer(row);
                  }}
                >
                  释放
                </Button>
              );
            }
            if (canRecycle) {
              actions.push(
                <Button {...rowActionKind('recycle')}
                  key="recycle"
                  type="link"
                  size="small"
                  icon={<SyncOutlined />}
                  onClick={async () => {
                    try {
                      await customerPoolApi.recycle(row.id);
                      message.success('已强制回收到公海');
                      actionRef.current?.reload();
                    } catch (error: any) {
                      message.error(error?.message || '回收失败');
                    }
                  }}
                >
                  强制回收
                </Button>
              );
            }
          }
          return actions;
        },
      },
    ],
    [canAssign, canClaim, canRecycle, canRelease, canUpdateCustomer, confirmReleaseCustomer, navigate, poolStatusValueEnum, salesmanOptions, salesmanValueEnum, scope, t],
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
          tanstackQuery={{ queryKeyPrefix: ['apps.kuaizhizao.pages.sales-management.customer-pool', scope] }}
          beforeSearchButtons={
            <ThemedSegmented
              surfaceBackground
              value={scope}
              onChange={(v) => handleScopeChange(v as 'pool' | 'mine' | 'all')}
              options={[
                { label: t('app.kuaizhizao.customerPool.scopeAll'), value: 'all' },
                { label: t('app.kuaizhizao.customerPool.scopePrivate'), value: 'mine' },
                { label: t('app.kuaizhizao.customerPool.scopePublic'), value: 'pool' },
              ]}
            />
          }
          toolBarRender={() => {
            const buttons: React.ReactNode[] = [];
            if (canCreateCustomer) {
              buttons.push(
                <Button {...rowActionKind('create')} key="create" type="primary" onClick={openCreateCustomer}>
                  {t('app.master-data.customers.create') + NEW_SHORTCUT_HINT}
                </Button>,
              );
            }
            if (canUpdateRules) {
              buttons.push(
                <Button {...rowActionKind('update')} key="rules" onClick={openRules}>
                  回收规则
                </Button>,
              );
            }
            return buttons;
          }}
          request={async (params, _sort, _filter, searchValues) => {
            try {
              const salesmanRaw = searchValues?.salesmanId;
              const salesmanId =
                salesmanRaw != null && salesmanRaw !== ''
                  ? Number(salesmanRaw)
                  : undefined;
              const poolStatusRaw = searchValues?.poolStatus;
              const poolStatus =
                poolStatusRaw === 'pool' || poolStatusRaw === 'owned' ? poolStatusRaw : undefined;
              const res = await customerPoolApi.list({
                scope: scopeRef.current,
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword: typeof searchValues?.keyword === 'string' ? searchValues.keyword.trim() || undefined : undefined,
                salesmanId: Number.isFinite(salesmanId) && salesmanId! > 0 ? salesmanId : undefined,
                poolStatus,
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
        size={420}
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

      <CustomerFormModal
        open={editOpen}
        editUuid={editUuid}
        onClose={() => {
          setEditOpen(false);
          setEditUuid(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      <CustomerDetailDrawer
        open={detailOpen}
        customerUuid={detailUuid}
        onClose={() => {
          setDetailOpen(false);
          setDetailUuid(null);
        }}
      />
    </>
  );
};

export default CustomerPoolPage;

