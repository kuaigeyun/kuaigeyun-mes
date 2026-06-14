/**
 * 统一配置中心
 *
 * 提供「参数设置」「审核设置」「流程设置」「业务自动化」「消息提醒」五个功能 Tab。
 * 每个 Tab 内部按业务模块（销售、计划、采购、生产、质量、设备、仓储）组织。
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Form, Card, Button, Space, Layout, Menu, InputNumber, ColorPicker, Typography, Spin, Switch, Select, theme, Modal } from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined, AuditOutlined, ControlOutlined, BellOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import { NotificationRulesPanel } from '../../../components/business-notification-rules/NotificationRulesPanel';
import {
  getBusinessConfig,
  getBusinessConfigSchema,
  batchUpdateProcessParameters,
} from '../../../services/businessConfig';
import {
  PARAMETER_CATEGORIES,
  AUDIT_CATEGORIES,
  FLOW_CATEGORIES,
  AUTOMATION_CATEGORIES,
  type ConfigCategory,
} from './configTree';
import AuditSettingsPanel from './AuditSettingsPanel';
import { TRIAL_RUN_MODE_QUERY_KEY } from '../../../hooks/useTrialRunMode';
import { qualityApi } from '../../../apps/kuaizhizao/services/quality-execution';

import type { Color } from 'antd/es/color-picker';

const { Sider, Content } = Layout;
const { Text, Paragraph } = Typography;
const { useToken } = theme;

export const PARAM_GUIDANCE_I18N_KEY_MAP: Record<string, string> = {
  'work_order.material_shortage_block_level': 'pages.system.configCenter.param.work_order_material_shortage_block_level_guide',
  'purchase.tolerance_percentage': 'pages.system.configCenter.param.purchase_tolerance_percentage_guide',
};

export function getParamGuidanceI18nKey(paramKey: string): string | undefined {
  return PARAM_GUIDANCE_I18N_KEY_MAP[paramKey];
}

/** 质检参数：上级环节/模块关闭时禁用子项（与后端 validate_quality_business_parameters 一致） */
export function isQualityParamDisabled(paramKey: string, values: Record<string, any> | undefined): boolean {
  if (!values) return false;
  const incoming = values['quality.incoming_inspection'] !== false;
  const iqcStage = values['quality_stage.iqc_enabled'] !== false;
  const process = values['quality.process_inspection'] !== false;
  const ipqcStage = values['quality_stage.ipqc_enabled'] !== false;
  const finished = values['quality.finished_inspection'] !== false;
  const fqcStage = values['quality_stage.fqc_enabled'] !== false;
  const oqcStage = values['quality_stage.oqc_enabled'] !== false;

  if (
    paramKey === 'quality.require_incoming_inspection_for_receipt'
    || paramKey === 'quality.auto_create_iqc_on_purchase_receipt'
    || paramKey === 'quality.require_incoming_inspection_for_customer_material'
  ) {
    return !(incoming && iqcStage);
  }
  if (
    paramKey === 'quality.require_fqc_before_finished_goods_receipt'
    || paramKey === 'quality.auto_create_fqc_on_last_reporting'
  ) {
    return !(finished && fqcStage);
  }
  if (
    paramKey === 'quality.auto_create_oqc_on_shipment_notice_notify'
    || paramKey === 'quality.auto_create_oqc_on_sales_delivery'
  ) {
    return !oqcStage;
  }
  return false;
}

/** 财务参数：收入/应付确认策略与自动生成开关互斥（与后端 coerce_finance_parameter_dict 一致） */
export function isFinanceParamDisabled(paramKey: string, values: Record<string, any> | undefined): boolean {
  if (!values) return false;
  const revenueRecognition = values['finance.revenue_recognition'] ?? 'on_shipment';
  const payableRecognition = values['finance.payable_recognition'] ?? 'on_receipt';

  if (paramKey === 'finance.auto_generate_receivable_from_sales_invoice') {
    return revenueRecognition !== 'on_invoice';
  }
  if (paramKey === 'finance.auto_generate_payable_from_purchase_invoice') {
    return payableRecognition !== 'on_purchase_invoice';
  }
  return false;
}

/** 从 business_config 提取 parameters 下的值到扁平 key */
function flattenBusinessParams(parameters: Record<string, Record<string, any>>): Record<string, any> {
  const flat: Record<string, any> = {};
  if (!parameters) return flat;
  for (const [cat, params] of Object.entries(parameters)) {
    if (!params || typeof params !== 'object') continue;
    for (const [key, value] of Object.entries(params)) {
      flat[`${cat}.${key}`] = value;
    }
  }
  return flat;
}

/** 将扁平 form 值转回 business_config parameters 结构 */
function toBusinessParams(flat: Record<string, any>, bizParamKeys: string[]): Record<string, Record<string, any>> {
  const params: Record<string, Record<string, any>> = {};
  for (const key of bizParamKeys) {
    if (flat[key] === undefined) continue;
    const dot = key.indexOf('.');
    const cat = dot > 0 ? key.slice(0, dot) : key;
    const paramKey = dot > 0 ? key.slice(dot + 1) : key;
    if (!params[cat]) params[cat] = {};
    params[cat][paramKey] = flat[key];
  }
  return params;
}

const BUSINESS_CONFIG_QUERY_KEY = ['businessConfig'] as const;
const BUSINESS_CONFIG_SCHEMA_QUERY_KEY = ['businessConfigSchema'] as const;

const ConfigCenterPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = useMemo(() => ['parameters', 'audit', 'automation', 'notification'], []);
  // 兼容历史链接：tab=flow 归并到 parameters
  const normalizedInitialTab = tabFromUrl === 'flow' ? 'parameters' : tabFromUrl;
  const initialTab = validTabs.includes(normalizedInitialTab || '') ? normalizedInitialTab! : 'parameters';
  const [activeMainTab, setActiveMainTab] = useState<string>(initialTab);

  const [form] = Form.useForm();
  const qualityFormValues = Form.useWatch([], form);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<any>(null);
  const [containerHeight, setContainerHeight] = useState<number>(400);

  // 为 4 个主 Tab 分别记录选中的侧边栏模块 ID
  const [selectedParamCat, setSelectedParamCat] = useState<string>(PARAMETER_CATEGORIES[0].id);
  const [selectedAuditCat, setSelectedAuditCat] = useState<string>(AUDIT_CATEGORIES[0].id);
  const [selectedAutoCat, setSelectedAutoCat] = useState<string>(AUTOMATION_CATEGORIES[0].id);
  const { data: bizRes, isLoading: configLoading, isFetching, refetch: refetchBusinessConfig } = useQuery({
    queryKey: BUSINESS_CONFIG_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 60_000,
  });

  const { data: schemaRes } = useQuery({
    queryKey: BUSINESS_CONFIG_SCHEMA_QUERY_KEY,
    queryFn: getBusinessConfigSchema,
    staleTime: 300_000,
  });
  const loading = configLoading && !bizRes;

  const parameterImplementation = schemaRes?.parameterImplementation || {};
  const isImplementedParam = (sourcePath: string): boolean => {
    if (!sourcePath.startsWith('parameters.')) return true;
    const parts = sourcePath.replace('parameters.', '').split('.');
    if (parts.length !== 2) return true;
    const [categoryKey, parameterKey] = parts;
    const categoryImpl = parameterImplementation[categoryKey];
    if (!categoryImpl) return true;
    return categoryImpl[parameterKey] !== false;
  };
  const mergedParameterCategories = useMemo<ConfigCategory[]>(() => {
    // 将“参数设置 + 流程设置”在同一 Tab 内融合展示，按模块合并并按 key 去重。
    const fromFlow = PARAMETER_CATEGORIES.map((c) => ({ ...c, params: [] as typeof c.params }));
    const mergedByCat = new Map<string, ConfigCategory>();
    for (const c of fromFlow) mergedByCat.set(c.id, { ...c, params: [] });
    // 原参数
    for (const c of PARAMETER_CATEGORIES) {
      const target = mergedByCat.get(c.id) || { ...c, params: [] };
      const seen = new Set(target.params.map((p) => p.key));
      for (const p of c.params) {
        if (!seen.has(p.key)) {
          target.params.push(p);
          seen.add(p.key);
        }
      }
      mergedByCat.set(c.id, target);
    }
    // 流程参数（来自 configTree 的 FLOW_CATEGORIES）
    // 这里通过 schema 实际下发的 processRegistry 动态注入会更复杂；当前沿用静态树定义并做去重。
    for (const c of FLOW_CATEGORIES) {
      const target = mergedByCat.get(c.id) || { ...c, params: [] };
      const seen = new Set(target.params.map((p) => p.key));
      for (const p of c.params) {
        if (!seen.has(p.key)) {
          target.params.push(p);
          seen.add(p.key);
        }
      }
      mergedByCat.set(c.id, target);
    }
    return Array.from(mergedByCat.values());
  }, []);

  const renderText = (key: string | undefined, fallback?: string) => {
    if (!key) return fallback || '';
    if (i18n.exists(key)) return t(key);
    return fallback || key;
  };
  const getParamGuidance = (paramKey: string): string => {
    const key = getParamGuidanceI18nKey(paramKey);
    return key ? renderText(key, '') : '';
  };

  useEffect(() => {
    const tVal = searchParams.get('tab');
    const normalized = tVal === 'flow' ? 'parameters' : tVal;
    if (normalized && validTabs.includes(normalized) && activeMainTab !== normalized) setActiveMainTab(normalized);
    const moduleId = searchParams.get('module');
    if (moduleId) {
      setSelectedParamCat(moduleId);
      setSelectedAutoCat(moduleId);
    }
  }, [searchParams, activeMainTab, validTabs]);

  useEffect(() => {
    const updateHeight = () => {
      if (!containerRef.current) return;
      const top = containerRef.current.getBoundingClientRect().top;
      const next = Math.max(400, Math.floor(window.innerHeight - top - 16));
      setContainerHeight(next);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [activeMainTab]);

  useEffect(() => {
    const initialValues = flattenBusinessParams(bizRes?.parameters || {});
    form.setFieldsValue(initialValues);
    void qualityApi.stageToggles.get().then((toggles) => {
      form.setFieldsValue({
        'quality_stage.iqc_enabled': toggles.iqc_enabled,
        'quality_stage.ipqc_enabled': toggles.ipqc_enabled,
        'quality_stage.fqc_enabled': toggles.fqc_enabled,
        'quality_stage.oqc_enabled': toggles.oqc_enabled,
      });
    }).catch(() => {});
  }, [bizRes, form]);

  const handleSave = async (categories: ConfigCategory[]) => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true);
      setSaving(true);

      const bizKeys: string[] = [];
      for (const cat of categories) {
        for (const param of cat.params) {
          if (param.source === 'business_config' && isImplementedParam(param.sourcePath)) {
            bizKeys.push(param.key);
          }
        }
      }

      const bizParams = toBusinessParams(values, bizKeys);
      if (Object.keys(bizParams).length > 0) {
        await batchUpdateProcessParameters({ parameters: bizParams });
      }

      const stageFieldMap: Record<string, keyof import('../../../apps/kuaizhizao/services/quality-execution').QualityInspectionStageToggles> = {
        'quality_stage.iqc_enabled': 'iqc_enabled',
        'quality_stage.ipqc_enabled': 'ipqc_enabled',
        'quality_stage.fqc_enabled': 'fqc_enabled',
        'quality_stage.oqc_enabled': 'oqc_enabled',
      };
      const stageUpdate: Partial<import('../../../apps/kuaizhizao/services/quality-execution').QualityInspectionStageToggles> = {};
      for (const cat of categories) {
        for (const param of cat.params) {
          if (param.source !== 'quality_stage_toggle') continue;
          const apiKey = stageFieldMap[param.key];
          if (apiKey && param.key in values) {
            stageUpdate[apiKey] = Boolean(values[param.key]);
          }
        }
      }
      if (Object.keys(stageUpdate).length > 0) {
        await qualityApi.stageToggles.update(stageUpdate);
      }
      messageApi.success(t('pages.system.configCenter.saveSuccess'));
      await refetchBusinessConfig();
      await queryClient.invalidateQueries({ queryKey: TRIAL_RUN_MODE_QUERY_KEY });
    } catch (error: any) {
      if (!error?.errorFields) messageApi.error(error.message || t('pages.system.configCenter.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const renderTabContent = (
    categories: ConfigCategory[],
    selectedCatId: string,
    onSelectCat: (id: string) => void,
    icon: React.ReactNode,
  ) => {
    const currentCat = categories.find(c => c.id === selectedCatId) || categories[0];

    return (
      <Layout style={{ minHeight: 400, height: '100%', minWidth: 0, background: 'transparent' }}>
        <Sider
          width={200}
          className="config-center-category-sider"
          style={{ background: token.colorBgContainer, borderRadius: 8, padding: '16px 0' }}
        >
          <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorder}`, marginBottom: 8 }}>
            <Space>{icon}<Text strong>{t('pages.system.configCenter.categoryTitle')}</Text></Space>
          </div>
          <Menu
            selectedKeys={[selectedCatId]}
            mode="inline"
            style={{ border: 'none', background: 'transparent' }}
            items={categories.map(c => ({ key: c.id, label: renderText(c.nameKey, c.id) }))}
            onClick={({ key }) => onSelectCat(key)}
          />
        </Sider>
        <Content style={{ padding: '14px 0 0 24px', height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="config-center-scrollable-content">
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>{renderText(currentCat.nameKey, currentCat.id)}</Text>
              {currentCat.descriptionKey && <Paragraph type="secondary" style={{ marginTop: 4 }}>{renderText(currentCat.descriptionKey, '')}</Paragraph>}
            </div>

            <Spin spinning={loading}>
                  <Form
                    form={form}
                    layout="vertical"
                    onValuesChange={(changedValues) => {
                      if (
                        changedValues['quality.require_incoming_inspection_for_receipt'] === true
                        && !form.getFieldValue('quality.auto_create_iqc_on_purchase_receipt')
                      ) {
                        Modal.confirm({
                          title: t('pages.system.configCenter.quality.gateRecommendAutoIqcTitle'),
                          content: t('pages.system.configCenter.quality.gateRecommendAutoIqcContent'),
                          okText: t('pages.system.configCenter.quality.gateRecommendAutoIqcEnableBoth'),
                          cancelText: t('pages.system.configCenter.quality.gateRecommendAutoIqcSkip'),
                          onOk: () => form.setFieldValue('quality.auto_create_iqc_on_purchase_receipt', true),
                        });
                      }
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
                      {currentCat.params
                        .filter((param) => param.source === 'quality_stage_toggle' || isImplementedParam(param.sourcePath))
                        .map(param => {
                        const implemented = isImplementedParam(param.sourcePath);
                        const switchDisabled = !implemented
                          || isQualityParamDisabled(param.key, qualityFormValues)
                          || isFinanceParamDisabled(param.key, qualityFormValues);
                        return (
                          <Card key={param.key} size="small">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1, marginRight: 16 }}>
                                <Text strong>{renderText(param.nameKey, param.key)}</Text>
                                <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>{renderText(param.descriptionKey, '')}</Paragraph>
                                {!!getParamGuidance(param.key) && <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4 }}>{getParamGuidance(param.key)}</Paragraph>}
                              </div>
                              <Form.Item
                                name={[param.key]}
                                noStyle
                                valuePropName={param.type === 'boolean' ? 'checked' : undefined}
                                getValueFromEvent={
                                  param.type === 'color'
                                    ? (c: Color) => (typeof c?.toHexString === 'function' ? c.toHexString() : c)
                                    : undefined
                                }
                              >
                                {param.type === 'boolean' ? <Switch disabled={switchDisabled} /> :
                                 param.type === 'number' ? <InputNumber size="middle" min={param.min} max={param.max} style={{ width: 120 }} disabled={!implemented} /> :
                                 param.type === 'select' ? <Select size="middle" options={param.selectOptions?.map(o => ({ value: o.value, label: renderText(o.labelKey, o.value) }))} style={{ minWidth: 160 }} disabled={!implemented} /> :
                                 param.type === 'color' ? <ColorPicker showText disabled={!implemented} /> : null}
                              </Form.Item>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </Form>
                </Spin>

            <Space style={{ marginTop: 24 }}>
              <Button icon={<ReloadOutlined />} onClick={() => refetchBusinessConfig()} loading={isFetching}>{t('pages.system.configCenter.refresh')}</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave(categories)} loading={saving}>{t('pages.system.configCenter.save')}</Button>
            </Space>
          </div>
        </Content>
      </Layout>
    );
  };

  const renderNotificationTab = () => <NotificationRulesPanel showPageHeader={false} />;

  return (
    <div className="config-center-page" ref={containerRef} style={{ height: containerHeight, minHeight: 400, borderRadius: 8, overflow: 'hidden' }}>
      <MultiTabListPageTemplate
        style={{ height: '100%' }}
        activeTabKey={activeMainTab}
        onTabChange={setActiveMainTab}
        tabs={[
          { key: 'parameters', label: <Space><SettingOutlined />{t('pages.system.configCenter.tabParameters')}</Space>, children: renderTabContent(mergedParameterCategories, selectedParamCat, setSelectedParamCat, <SettingOutlined />) },
          { key: 'audit', label: <Space><AuditOutlined />{t('pages.system.configCenter.tabAudit')}</Space>, children: <AuditSettingsPanel selectedCatId={selectedAuditCat} onSelectCat={setSelectedAuditCat} /> },
          { key: 'automation', label: <Space><ControlOutlined />{t('pages.system.configCenter.tabAutomation')}</Space>, children: renderTabContent(AUTOMATION_CATEGORIES, selectedAutoCat, setSelectedAutoCat, <ControlOutlined />) },
          { key: 'notification', label: <Space><BellOutlined />{t('pages.system.configCenter.notification.title')}</Space>, children: renderNotificationTab() },
        ]}
        padding={24}
      />
    </div>
  );
};

export default ConfigCenterPage;
