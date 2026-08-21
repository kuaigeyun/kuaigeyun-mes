/**
 * 总账科目表
 */
import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormCheckbox,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Popconfirm, Radio, Space, Spin, Typography } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { glService, type GlAccount, type GlCoaSeedTemplate } from '../../../services/gl';

const NS = 'app.kuaicaiwu.gl.chartOfAccounts';

const asList = <T,>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  const obj = res as { data?: T[]; items?: T[] } | null;
  return obj?.data ?? obj?.items ?? [];
};

const ChartOfAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GlAccount | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedTemplatesLoading, setSeedTemplatesLoading] = useState(false);
  const [seedTemplates, setSeedTemplates] = useState<GlCoaSeedTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('cas_manufacturing');

  const accountTypeOptions = useMemo(
    () => [
      { label: t(`${NS}.type.asset`, { defaultValue: '资产' }), value: 'asset' },
      { label: t(`${NS}.type.liability`, { defaultValue: '负债' }), value: 'liability' },
      { label: t(`${NS}.type.equity`, { defaultValue: '权益' }), value: 'equity' },
      { label: t(`${NS}.type.cost`, { defaultValue: '成本' }), value: 'cost' },
      { label: t(`${NS}.type.profitLoss`, { defaultValue: '损益' }), value: 'profit_loss' },
    ],
    [t],
  );

  const balanceDirectionOptions = useMemo(
    () => [
      { label: t(`${NS}.direction.debit`, { defaultValue: '借' }), value: 'debit' },
      { label: t(`${NS}.direction.credit`, { defaultValue: '贷' }), value: 'credit' },
    ],
    [t],
  );

  const typeLabel = (type: string) =>
    accountTypeOptions.find((o) => o.value === type)?.label || type;

  const columns: ProColumns<GlAccount>[] = useMemo(
    () => [
      {
        title: t(`${NS}.col.account`, { defaultValue: '科目' }),
        key: 'account_stacked',
        dataIndex: 'account_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.account_name ?? '')}
            secondary={String(r.account_code ?? '')}
          />
        ),
      },
      {
        title: t(`${NS}.col.accountCode`, { defaultValue: '科目编码' }),
        dataIndex: 'account_code',
        hideInTable: true,
        fieldProps: { allowClear: true },
      },
      {
        title: t(`${NS}.col.accountType`, { defaultValue: '科目类型' }),
        dataIndex: 'account_type',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'select',
        fieldProps: { options: accountTypeOptions, allowClear: true },
        render: (_, r) => <MarkerTag>{typeLabel(r.account_type)}</MarkerTag>,
      },
      {
        title: t(`${NS}.col.balanceDirection`, { defaultValue: '余额方向' }),
        dataIndex: 'balance_direction',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) =>
          r.balance_direction === 'credit'
            ? t(`${NS}.direction.credit`, { defaultValue: '贷' })
            : t(`${NS}.direction.debit`, { defaultValue: '借' }),
      },
      {
        title: t(`${NS}.col.level`, { defaultValue: '级次' }),
        dataIndex: 'level',
        width: 70,
        minWidth: 70,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
      },
      {
        title: t(`${NS}.col.aux`, { defaultValue: '辅助核算' }),
        key: 'aux',
        width: 160,
        hideInSearch: true,
        render: (_, r) => {
          const tags: string[] = [];
          if (r.aux_customer) tags.push(t(`${NS}.aux.customer`, { defaultValue: '客户' }));
          if (r.aux_supplier) tags.push(t(`${NS}.aux.supplier`, { defaultValue: '供应商' }));
          if (r.aux_department) tags.push(t(`${NS}.aux.department`, { defaultValue: '部门' }));
          return tags.length ? tags.join(' ') : '—';
        },
      },
      {
        title: t(`${NS}.col.flags`, { defaultValue: '属性' }),
        key: 'flags',
        width: 180,
        hideInSearch: true,
        render: (_, r) => {
          const tags: React.ReactNode[] = [];
          if (r.is_cash_journal) {
            tags.push(
              <MarkerTag key="cash" color="warning">
                {t(`${NS}.flag.cash`, { defaultValue: '现金' })}
              </MarkerTag>,
            );
          }
          if (r.is_bank_journal) {
            tags.push(
              <MarkerTag key="bank" color="processing">
                {t(`${NS}.flag.bank`, { defaultValue: '银行' })}
              </MarkerTag>,
            );
          }
          if (r.is_controlled) {
            tags.push(
              <MarkerTag key="ctrl" color="error">
                {t(`${NS}.flag.controlled`, { defaultValue: '受控' })}
              </MarkerTag>,
            );
          }
          return tags.length ? <Space size={4}>{tags}</Space> : '—';
        },
      },
      {
        title: t('common.enabled', { defaultValue: '启用' }),
        dataIndex: 'is_active',
        width: 80,
        minWidth: 80,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) =>
          r.is_active ? (
            <MarkerTag color="success">{t('common.enabled', { defaultValue: '启用' })}</MarkerTag>
          ) : (
            <MarkerTag>{t('common.disabled', { defaultValue: '停用' })}</MarkerTag>
          ),
      },
      {
        title: t('common.actions', { defaultValue: '操作' }),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => [
          <a
            key="edit"
            onClick={() => {
              setEditing(record);
              setModalOpen(true);
            }}
          >
            {t('common.edit', { defaultValue: '编辑' })}
          </a>,
          <Popconfirm
            {...rowActionKind('delete')}
            key="del"
            title={t(`${NS}.confirmDelete`, { defaultValue: '确认删除该科目？' })}
            onConfirm={async () => {
              try {
                await glService.deleteAccount(record.id);
                messageApi.success(t('common.deleteSuccess', { defaultValue: '删除成功' }));
                actionRef.current?.reload();
              } catch (error) {
                messageApi.error(
                  getApiErrorMessage(error, t('common.deleteFailed', { defaultValue: '删除失败' })),
                );
              }
            }}
          >
            <a>{t('common.delete', { defaultValue: '删除' })}</a>
          </Popconfirm>,
        ],
      },
    ],
    [t, messageApi, accountTypeOptions],
  );

  const openSeedModal = async () => {
    setSeedModalOpen(true);
    setSeedTemplatesLoading(true);
    try {
      const res = await glService.listAccountSeedTemplates();
      const items = asList<GlCoaSeedTemplate>(res);
      setSeedTemplates(items);
      const recommended = items.find((x) => x.recommended) ?? items[0];
      if (recommended?.key) {
        setSelectedTemplateKey(recommended.key);
      }
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, t(`${NS}.seedTemplatesFailed`, { defaultValue: '加载科目模板失败' })),
      );
      setSeedModalOpen(false);
    } finally {
      setSeedTemplatesLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!selectedTemplateKey) {
      messageApi.warning(t(`${NS}.seedSelectRequired`, { defaultValue: '请选择科目模板' }));
      return;
    }
    setSeedLoading(true);
    try {
      const result = await glService.seedAccounts(selectedTemplateKey);
      const created = Number(result?.created ?? 0);
      const skipped = Number(result?.skipped ?? 0);
      const templateName = String(result?.template_name || selectedTemplateKey);
      messageApi.success(
        t(`${NS}.seedSuccess`, {
          defaultValue: '已导入「{{templateName}}」：新增 {{created}}，已存在跳过 {{skipped}}',
          templateName,
          created,
          skipped,
        }),
      );
      setSeedModalOpen(false);
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t(`${NS}.seedFailed`, { defaultValue: '导入失败' })));
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSave = async (values: Record<string, unknown>) => {
    const payload: Partial<GlAccount> = {
      account_code: String(values.account_code || '').trim(),
      account_name: String(values.account_name || '').trim(),
      account_type: String(values.account_type || ''),
      balance_direction: String(values.balance_direction || 'debit'),
      aux_customer: Boolean(values.aux_customer),
      aux_supplier: Boolean(values.aux_supplier),
      aux_department: Boolean(values.aux_department),
      is_cash_journal: Boolean(values.is_cash_journal),
      is_bank_journal: Boolean(values.is_bank_journal),
      is_controlled: Boolean(values.is_controlled),
      notes: values.notes ? String(values.notes) : null,
      is_active: true,
      is_leaf: true,
    };
    try {
      if (editing?.id) {
        await glService.updateAccount(editing.id, payload);
        messageApi.success(t('common.updateSuccess', { defaultValue: '更新成功' }));
      } else {
        await glService.createAccount(payload);
        messageApi.success(t('common.createSuccess', { defaultValue: '创建成功' }));
      }
      setModalOpen(false);
      setEditing(null);
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.saveFailed', { defaultValue: '保存失败' })));
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<GlAccount>
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.gl-management.chart-of-accounts.list-v1"
        columns={columns}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        request={async (params) => {
          try {
            const res = await glService.listAccounts({
              account_type: params.account_type || undefined,
            });
            let data = asList<GlAccount>(res);
            const codeKw = String(params.account_code || '').trim();
            if (codeKw) {
              data = data.filter(
                (r) =>
                  r.account_code?.includes(codeKw) ||
                  r.account_name?.includes(codeKw),
              );
            }
            return { data, success: true, total: data.length };
          } catch (error) {
            messageApi.error(
              getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })),
            );
            return { data: [], success: false, total: 0 };
          }
        }}
        showCreateButton
        createButtonText={t(`${NS}.create`, { defaultValue: '新建科目' })}
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        showImportButton={false}
        showExportButton={false}
        rightToolBarActionsBeforeExport={[
          <Button
            key="seed"
            icon={<ImportOutlined />}
            onClick={() => void openSeedModal()}
          >
            {t(`${NS}.seed`, { defaultValue: '导入标准科目模板' })}
          </Button>,
        ]}
      />

      <FormModalTemplate
        title={
          editing
            ? t(`${NS}.editTitle`, { defaultValue: '编辑科目' })
            : t(`${NS}.createTitle`, { defaultValue: '新建科目' })
        }
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        isEdit={Boolean(editing)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={
          editing
            ? {
                account_code: editing.account_code,
                account_name: editing.account_name,
                account_type: editing.account_type,
                balance_direction: editing.balance_direction || 'debit',
                aux_customer: editing.aux_customer,
                aux_supplier: editing.aux_supplier,
                aux_department: editing.aux_department,
                is_cash_journal: editing.is_cash_journal,
                is_bank_journal: editing.is_bank_journal,
                is_controlled: editing.is_controlled,
                notes: editing.notes,
              }
            : {
                balance_direction: 'debit',
                account_type: 'asset',
              }
        }
        onFinish={handleSave}
        grid
      >
        <ProFormText
          name="account_code"
          label={t(`${NS}.field.accountCode`, { defaultValue: '科目编码' })}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          colProps={{ span: 12 }}
          disabled={Boolean(editing)}
        />
        <ProFormText
          name="account_name"
          label={t(`${NS}.field.accountName`, { defaultValue: '科目名称' })}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="account_type"
          label={t(`${NS}.field.accountType`, { defaultValue: '科目类型' })}
          options={accountTypeOptions}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          colProps={{ span: 12 }}
          disabled={Boolean(editing)}
        />
        <ProFormSelect
          name="balance_direction"
          label={t(`${NS}.field.balanceDirection`, { defaultValue: '余额方向' })}
          options={balanceDirectionOptions}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          colProps={{ span: 12 }}
        />
        <ProFormCheckbox name="aux_customer" colProps={{ span: 8 }}>
          {t(`${NS}.aux.customer`, { defaultValue: '客户辅助' })}
        </ProFormCheckbox>
        <ProFormCheckbox name="aux_supplier" colProps={{ span: 8 }}>
          {t(`${NS}.aux.supplier`, { defaultValue: '供应商辅助' })}
        </ProFormCheckbox>
        <ProFormCheckbox name="aux_department" colProps={{ span: 8 }}>
          {t(`${NS}.aux.department`, { defaultValue: '部门辅助' })}
        </ProFormCheckbox>
        <ProFormCheckbox name="aux_employee" colProps={{ span: 8 }}>
          {t(`${NS}.aux.employee`, { defaultValue: '职员辅助' })}
        </ProFormCheckbox>
        <ProFormCheckbox name="aux_project" colProps={{ span: 8 }}>
          {t(`${NS}.aux.project`, { defaultValue: '项目辅助' })}
        </ProFormCheckbox>
        <ProFormCheckbox name="is_cash_journal" colProps={{ span: 8 }}>
          {t(`${NS}.flag.cashJournal`, { defaultValue: '现金科目' })}
        </ProFormCheckbox>
        <ProFormCheckbox name="is_bank_journal" colProps={{ span: 8 }}>
          {t(`${NS}.flag.bankJournal`, { defaultValue: '银行科目' })}
        </ProFormCheckbox>
        <ProFormCheckbox name="is_controlled" colProps={{ span: 8 }}>
          {t(`${NS}.flag.controlled`, { defaultValue: '受控科目' })}
        </ProFormCheckbox>
        <ProFormTextArea
          name="notes"
          label={t('common.remark', { defaultValue: '备注' })}
          colProps={{ span: 24 }}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <Modal
        title={t(`${NS}.seedModalTitle`, { defaultValue: '导入标准科目模板' })}
        open={seedModalOpen}
        onCancel={() => setSeedModalOpen(false)}
        onOk={() => void handleSeed()}
        confirmLoading={seedLoading}
        okText={t('common.import', { defaultValue: '导入' })}
        cancelText={t('common.cancel', { defaultValue: '取消' })}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
        mask={{ closable: !seedLoading }}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {t(`${NS}.seedModalHint`, {
            defaultValue: '请按适用的会计准则与行业选择一套模板。已存在编码会跳过，不会覆盖已修改科目。',
          })}
        </Typography.Paragraph>
        {seedTemplatesLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Spin description={t('common.loading', { defaultValue: '加载中' })} />
          </div>
        ) : (
          <Radio.Group
            value={selectedTemplateKey}
            onChange={(e) => setSelectedTemplateKey(String(e.target.value))}
            style={{ width: '100%' }}
          >
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              {seedTemplates.map((tpl) => (
                <Radio key={tpl.key} value={tpl.key} style={{ width: '100%', alignItems: 'flex-start' }}>
                  <div>
                    <Space size={8} wrap>
                      <span>{tpl.name}</span>
                      {tpl.recommended ? (
                        <MarkerTag>{t(`${NS}.seedRecommended`, { defaultValue: '推荐' })}</MarkerTag>
                      ) : null}
                      <Typography.Text type="secondary">
                        {t(`${NS}.seedAccountCount`, {
                          defaultValue: '{{count}} 个一级科目',
                          count: tpl.account_count,
                        })}
                      </Typography.Text>
                    </Space>
                    <div>
                      <Typography.Text type="secondary">{tpl.description}</Typography.Text>
                    </div>
                  </div>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        )}
      </Modal>
    </ListPageTemplate>
  );
};

export default ChartOfAccountsPage;
