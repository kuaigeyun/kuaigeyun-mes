/**
 * 总账账套参数与摘要
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ProForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Alert, Button, Card, Input, InputNumber, List, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { glService, type GlAccount } from '../../../services/gl';

const NS = 'app.kuaicaiwu.gl.settings';

const asList = <T,>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  const obj = res as { data?: T[]; items?: T[] } | null;
  return obj?.data ?? obj?.items ?? [];
};

type GlSettings = {
  account_code_rule?: string;
  base_currency?: string;
  require_reviewer_different?: boolean;
  deficit_control?: boolean;
  allow_gl_entry_on_controlled?: boolean;
  cash_account_ids?: number[];
  bank_account_ids?: number[];
  enable_voucher_words?: boolean;
  require_transfer_before_close?: boolean;
  current_year?: number;
  current_month?: number;
  initialized?: boolean;
};

type SummaryRow = { id: number; content: string; sort_order?: number };

const GlSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = ProForm.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [settings, setSettings] = useState<GlSettings | null>(null);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [initYear, setInitYear] = useState<number>(new Date().getFullYear());
  const [initMonth, setInitMonth] = useState<number>(new Date().getMonth() + 1);
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [cashFlowItems, setCashFlowItems] = useState<Record<string, unknown>[]>([]);
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        label: `${a.account_code} ${a.account_name}`,
        value: a.id,
      })),
    [accounts],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, accountsRes, summariesRes, projectsRes, cfRes] = await Promise.all([
        glService.getSettings(),
        glService.listAccounts({ is_active: true }),
        glService.listSummaries(),
        glService.listProjects(),
        glService.listCashFlowItems(),
      ]);
      const s = (settingsRes || {}) as GlSettings;
      setSettings(s);
      setAccounts(asList<GlAccount>(accountsRes));
      setSummaries(asList<SummaryRow>(summariesRes));
      setProjects(asList<Record<string, unknown>>(projectsRes));
      setCashFlowItems(asList<Record<string, unknown>>(cfRes));
      setInitYear(Number(s.current_year) || new Date().getFullYear());
      setInitMonth(Number(s.current_month) || new Date().getMonth() + 1);
      form.setFieldsValue({
        account_code_rule: s.account_code_rule || '4-2-2',
        base_currency: s.base_currency || 'CNY',
        require_reviewer_different: Boolean(s.require_reviewer_different),
        deficit_control: Boolean(s.deficit_control),
        allow_gl_entry_on_controlled: Boolean(s.allow_gl_entry_on_controlled),
        enable_voucher_words: s.enable_voucher_words !== false,
        require_transfer_before_close: Boolean(s.require_transfer_before_close),
        cash_account_ids: s.cash_account_ids || [],
        bank_account_ids: s.bank_account_ids || [],
      });
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
    } finally {
      setLoading(false);
    }
  }, [form, messageApi, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const updated = (await glService.updateSettings({
        account_code_rule: values.account_code_rule,
        base_currency: values.base_currency,
        require_reviewer_different: Boolean(values.require_reviewer_different),
        deficit_control: Boolean(values.deficit_control),
        allow_gl_entry_on_controlled: Boolean(values.allow_gl_entry_on_controlled),
        cash_account_ids: values.cash_account_ids || [],
        bank_account_ids: values.bank_account_ids || [],
      })) as GlSettings;
      setSettings(updated);
      messageApi.success(t('common.saveSuccess', { defaultValue: '保存成功' }));
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.saveFailed', { defaultValue: '保存失败' })));
    } finally {
      setSaving(false);
    }
  };

  const handleFinishInit = async () => {
    if (!initYear || !initMonth || initMonth < 1 || initMonth > 12) {
      messageApi.error(t(`${NS}.invalidPeriod`, { defaultValue: '请填写有效的会计年月' }));
      return;
    }
    setInitLoading(true);
    try {
      const updated = (await glService.finishInit(initYear, initMonth)) as GlSettings;
      setSettings(updated);
      messageApi.success(t(`${NS}.finishInitSuccess`, { defaultValue: '已结束初始化并开账' }));
      await loadAll();
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, t(`${NS}.finishInitFailed`, { defaultValue: '开账失败' })),
      );
    } finally {
      setInitLoading(false);
    }
  };

  const handleAddSummary = async () => {
    const content = summaryText.trim();
    if (!content) {
      messageApi.warning(t(`${NS}.summaryRequired`, { defaultValue: '请输入摘要内容' }));
      return;
    }
    try {
      await glService.createSummary(content);
      setSummaryText('');
      messageApi.success(t(`${NS}.summaryAdded`, { defaultValue: '摘要已添加' }));
      const summariesRes = await glService.listSummaries();
      setSummaries(asList<SummaryRow>(summariesRes));
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, t(`${NS}.summaryAddFailed`, { defaultValue: '添加失败' })),
      );
    }
  };

  return (
    <ListPageTemplate>
      <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
        {settings?.initialized ? (
          <Alert
            type="success"
            showIcon
            title={t(`${NS}.initialized`, {
              defaultValue: '账套已开账，当前会计期间 {{year}}年{{month}}月',
              year: settings.current_year,
              month: settings.current_month,
            })}
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            title={t(`${NS}.notInitialized`, {
              defaultValue: '账套尚未开账，请完成科目与期初后结束初始化',
            })}
          />
        )}

        <Card
          title={t(`${NS}.cardSettings`, { defaultValue: '账套参数' })}
          loading={loading}
          extra={
            <Typography.Text type="secondary">
              {t(`${NS}.currentPeriod`, {
                defaultValue: '当前期间 {{year}}/{{month}}',
                year: settings?.current_year ?? '—',
                month: settings?.current_month ?? '—',
              })}
            </Typography.Text>
          }
        >
          <ProForm
            form={form}
            layout="vertical"
            grid
            submitter={{
              searchConfig: {
                submitText: t('common.save', { defaultValue: '保存' }),
              },
              resetButtonProps: false,
              submitButtonProps: { loading: saving },
            }}
            onFinish={handleSave}
          >
            <ProFormText
              name="account_code_rule"
              label={t(`${NS}.field.accountCodeRule`, { defaultValue: '科目编码规则' })}
              colProps={{ span: 12 }}
              placeholder="4-2-2"
            />
            <ProFormText
              name="base_currency"
              label={t(`${NS}.field.baseCurrency`, { defaultValue: '本位币' })}
              colProps={{ span: 12 }}
              placeholder="CNY"
            />
            <ProFormSwitch
              name="require_reviewer_different"
              label={t(`${NS}.field.requireReviewerDifferent`, {
                defaultValue: '审核人不可与制单人相同',
              })}
              colProps={{ span: 8 }}
            />
            <ProFormSwitch
              name="deficit_control"
              label={t(`${NS}.field.deficitControl`, { defaultValue: '赤字控制' })}
              colProps={{ span: 8 }}
            />
            <ProFormSwitch
              name="allow_gl_entry_on_controlled"
              label={t(`${NS}.field.allowGlEntryOnControlled`, {
                defaultValue: '允许受控科目手工录入',
              })}
              colProps={{ span: 8 }}
            />
            <ProFormSwitch
              name="enable_voucher_words"
              label={t(`${NS}.field.enableVoucherWords`, { defaultValue: '启用收付转凭证字' })}
              colProps={{ span: 8 }}
            />
            <ProFormSwitch
              name="require_transfer_before_close"
              label={t(`${NS}.field.requireTransferBeforeClose`, {
                defaultValue: '结账前检查必跑转账',
              })}
              colProps={{ span: 8 }}
            />
            <ProFormSelect
              name="cash_account_ids"
              label={t(`${NS}.field.cashAccountIds`, { defaultValue: '现金科目' })}
              mode="multiple"
              options={accountOptions}
              colProps={{ span: 12 }}
              fieldProps={{ optionFilterProp: 'label', showSearch: true }}
            />
            <ProFormSelect
              name="bank_account_ids"
              label={t(`${NS}.field.bankAccountIds`, { defaultValue: '银行科目' })}
              mode="multiple"
              options={accountOptions}
              colProps={{ span: 12 }}
              fieldProps={{ optionFilterProp: 'label', showSearch: true }}
            />
          </ProForm>
        </Card>

        <Card title={t(`${NS}.cardFinishInit`, { defaultValue: '结束初始化 / 开账' })}>
          <Space wrap size="medium">
            <Space.Compact>
              <InputNumber
                size="medium"
                precision={0}
                value={initYear}
                onChange={(v) => setInitYear(Number(v) || new Date().getFullYear())}
                style={{ width: 120 }}
                placeholder={t(`${NS}.year`, { defaultValue: '年' })}
              />
              <InputNumber
                size="medium"
                min={1}
                max={12}
                precision={0}
                value={initMonth}
                onChange={(v) => setInitMonth(Number(v) || 1)}
                style={{ width: 100 }}
                placeholder={t(`${NS}.month`, { defaultValue: '月' })}
              />
            </Space.Compact>
            <Button
              type="primary"
              loading={initLoading}
              disabled={Boolean(settings?.initialized)}
              onClick={() => void handleFinishInit()}
            >
              {t(`${NS}.finishInit`, { defaultValue: '结束初始化/开账' })}
            </Button>
          </Space>
        </Card>

        <Card title={t(`${NS}.cardSummaries`, { defaultValue: '常用摘要' })}>
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              placeholder={t(`${NS}.summaryPlaceholder`, { defaultValue: '输入摘要内容' })}
              onPressEnter={() => void handleAddSummary()}
            />
            <Button type="primary" onClick={() => void handleAddSummary()}>
              {t(`${NS}.addSummary`, { defaultValue: '添加摘要' })}
            </Button>
          </Space.Compact>
          <List
            size="small"
            bordered
            dataSource={summaries}
            locale={{ emptyText: t(`${NS}.noSummaries`, { defaultValue: '暂无摘要' }) }}
            renderItem={(item) => <List.Item>{item.content}</List.Item>}
          />
        </Card>

        <Card title={t(`${NS}.cardProjects`, { defaultValue: '项目辅助字典' })}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input
              placeholder={t(`${NS}.projectCode`, { defaultValue: '项目编码' })}
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              style={{ width: 140 }}
            />
            <Input
              placeholder={t(`${NS}.projectName`, { defaultValue: '项目名称' })}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={{ width: 180 }}
            />
            <Button
              type="primary"
              onClick={() =>
                void (async () => {
                  try {
                    await glService.upsertProject({
                      project_code: projectCode,
                      project_name: projectName || projectCode,
                    });
                    setProjectCode('');
                    setProjectName('');
                    messageApi.success(t('common.saveSuccess', { defaultValue: '保存成功' }));
                    await loadAll();
                  } catch (error) {
                    messageApi.error(
                      getApiErrorMessage(error, t('common.saveFailed', { defaultValue: '保存失败' })),
                    );
                  }
                })()
              }
            >
              {t(`${NS}.addProject`, { defaultValue: '保存项目' })}
            </Button>
          </Space>
          <List
            size="small"
            bordered
            dataSource={projects}
            locale={{ emptyText: t(`${NS}.noProjects`, { defaultValue: '暂无项目' }) }}
            renderItem={(item) => (
              <List.Item>
                {String(item.project_code)} {String(item.project_name)}
              </List.Item>
            )}
          />
        </Card>

        <Card title={t(`${NS}.cardCashFlow`, { defaultValue: '现金流量项目' })}>
          <Button
            style={{ marginBottom: 12 }}
            onClick={() =>
              void (async () => {
                try {
                  const res = await glService.seedCashFlowItems();
                  messageApi.success(
                    t(`${NS}.seedCashFlowOk`, {
                      defaultValue: '已种子 {{count}} 项',
                      count: (res as any)?.created ?? 0,
                    }),
                  );
                  await loadAll();
                } catch (error) {
                  messageApi.error(
                    getApiErrorMessage(error, t('common.operationFailed', { defaultValue: '操作失败' })),
                  );
                }
              })()
            }
          >
            {t(`${NS}.seedCashFlow`, { defaultValue: '加载标准现金流量项目' })}
          </Button>
          <List
            size="small"
            bordered
            dataSource={cashFlowItems}
            locale={{ emptyText: t(`${NS}.noCashFlow`, { defaultValue: '暂无现金流量项目' }) }}
            renderItem={(item) => (
              <List.Item>
                {String(item.item_code)} {String(item.item_name)}（{String(item.category)}/
                {String(item.direction)}）
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </ListPageTemplate>
  );
};

export default GlSettingsPage;
