/**
 * 业务配置
 *
 * 提供「流程设置」「参数设置」两个参数 Tab。
 * 注：旧版「蓝图设置」已下线；
 *   - 功能是否开启 → 由「菜单管理」控制（菜单隐藏即视为关闭）
 *   - 单据是否人工审核 → 在「审批流程」中启用对应流程（默认关闭）；本页仅配置流转/前置条件等
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { App, Form, Card, Button, Space, Layout, Menu, InputNumber, ColorPicker, Typography, Spin, Switch, Select, theme, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined, ControlOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import {
  getBusinessConfig,
  getBusinessConfigSchema,
  batchUpdateProcessParameters,
} from '../../../services/businessConfig';
import {
  PARAMETER_CATEGORIES,
  PROCESS_CATEGORIES,
  type ConfigCategory,
  type ParamMeta,
  type ParamSelectOption,
} from './configTree';

type RegistryControlField = {
  type?: ParamMeta['type'];
  min?: number;
  max?: number;
  options?: ParamSelectOption[];
};
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

function flattenRegistryKeys(registry?: Record<string, string[]>): Set<string> {
  const set = new Set<string>();
  if (!registry) return set;
  for (const [category, keys] of Object.entries(registry)) {
    for (const key of keys || []) {
      set.add(`${category}.${key}`);
    }
  }
  return set;
}

function buildProcessCategoriesFromRegistry(
  registry: Record<string, string[]> | undefined,
  fallbackCategories: ConfigCategory[],
  categoryMeta?: Record<string, { labelKey?: string; descriptionKey?: string }>,
  paramMeta?: Record<string, Record<string, { labelKey?: string; descriptionKey?: string }>>,
  controlMeta?: Record<string, Record<string, RegistryControlField>>
): ConfigCategory[] {
  if (!registry || Object.keys(registry).length === 0) return fallbackCategories;

  const fallbackCategoryById = new Map<string, ConfigCategory>(
    fallbackCategories.map((c) => [c.id, c])
  );
  const fallbackParamByKey = new Map<string, ParamMeta>();
  for (const category of fallbackCategories) {
    for (const param of category.params) {
      fallbackParamByKey.set(param.key, param);
    }
  }

  const categories: ConfigCategory[] = [];
  const categoryByNameKey = new Map<string, ConfigCategory>();

  for (const [categoryKey, keys] of Object.entries(registry)) {
    const processCategoryId = `process_${categoryKey}`;
    const fallbackCategory = fallbackCategoryById.get(processCategoryId);
    const nameKey = categoryMeta?.[categoryKey]?.labelKey || fallbackCategory?.nameKey || categoryKey;
    const descriptionKey = categoryMeta?.[categoryKey]?.descriptionKey || fallbackCategory?.descriptionKey;

    const params: ParamMeta[] = (keys || []).map((key) => {
      const fullKey = `${categoryKey}.${key}`;
      const fallbackParam = fallbackParamByKey.get(fullKey);
      const currentMeta = paramMeta?.[categoryKey]?.[key];
      const currentControl = controlMeta?.[categoryKey]?.[key];
      if (fallbackParam) {
        return {
          ...fallbackParam,
          nameKey: currentMeta?.labelKey || fallbackParam.nameKey,
          descriptionKey: currentMeta?.descriptionKey || fallbackParam.descriptionKey,
          type: currentControl?.type || fallbackParam.type,
          min: currentControl?.min ?? fallbackParam.min,
          max: currentControl?.max ?? fallbackParam.max,
          selectOptions: currentControl?.options ?? fallbackParam.selectOptions,
        };
      }
      return {
        key: fullKey,
        nameKey: currentMeta?.labelKey || fullKey,
        descriptionKey: currentMeta?.descriptionKey || `${fullKey}.desc`,
        source: 'business_config',
        sourcePath: `parameters.${fullKey}`,
        type: currentControl?.type || 'boolean',
        min: currentControl?.min,
        max: currentControl?.max,
        selectOptions: currentControl?.options,
      };
    });

    if (categoryByNameKey.has(nameKey)) {
      categoryByNameKey.get(nameKey)!.params.push(...params);
    } else {
      const newCat: ConfigCategory = {
        id: processCategoryId,
        nameKey,
        descriptionKey,
        params,
      };
      categories.push(newCat);
      categoryByNameKey.set(nameKey, newCat);
    }
  }

  return categories;
}

function buildParameterCategoriesFromRegistry(
  registry: Record<string, string[]> | undefined,
  fallbackCategories: ConfigCategory[],
  categoryMeta?: Record<string, { labelKey?: string; descriptionKey?: string }>,
  paramMeta?: Record<string, Record<string, { labelKey?: string; descriptionKey?: string }>>,
  controlMeta?: Record<string, Record<string, RegistryControlField>>
): ConfigCategory[] {
  if (!registry || Object.keys(registry).length === 0) return fallbackCategories;

  const fallbackCategoryByBusinessGroup = new Map<string, ConfigCategory>();
  const fallbackParamByKey = new Map<string, ParamMeta>();
  for (const category of fallbackCategories) {
    for (const param of category.params) {
      fallbackParamByKey.set(param.key, param);
      const group = param.key.split('.')[0];
      if (group && !fallbackCategoryByBusinessGroup.has(group)) {
        fallbackCategoryByBusinessGroup.set(group, category);
      }
    }
  }

  const categories: ConfigCategory[] = [];
  const categoryByNameKey = new Map<string, ConfigCategory>();

  for (const [categoryKey, keys] of Object.entries(registry)) {
    const categoryId = `param_${categoryKey}`;
    const fallbackCategory = fallbackCategoryByBusinessGroup.get(categoryKey);
    const nameKey = categoryMeta?.[categoryKey]?.labelKey || fallbackCategory?.nameKey || categoryKey;
    const descriptionKey = categoryMeta?.[categoryKey]?.descriptionKey || fallbackCategory?.descriptionKey;

    const params: ParamMeta[] = (keys || []).map((key) => {
      const fullKey = `${categoryKey}.${key}`;
      const fallbackParam = fallbackParamByKey.get(fullKey);
      const currentMeta = paramMeta?.[categoryKey]?.[key];
      const currentControl = controlMeta?.[categoryKey]?.[key];
      if (fallbackParam) {
        return {
          ...fallbackParam,
          nameKey: currentMeta?.labelKey || fallbackParam.nameKey,
          descriptionKey: currentMeta?.descriptionKey || fallbackParam.descriptionKey,
          type: currentControl?.type || fallbackParam.type,
          min: currentControl?.min ?? fallbackParam.min,
          max: currentControl?.max ?? fallbackParam.max,
          selectOptions: currentControl?.options ?? fallbackParam.selectOptions,
        };
      }
      return {
        key: fullKey,
        nameKey: currentMeta?.labelKey || fullKey,
        descriptionKey: currentMeta?.descriptionKey || `${fullKey}.desc`,
        source: 'business_config',
        sourcePath: `parameters.${fullKey}`,
        type: currentControl?.type || 'boolean',
        min: currentControl?.min,
        max: currentControl?.max,
        selectOptions: currentControl?.options,
      };
    });

    if (categoryByNameKey.has(nameKey)) {
      categoryByNameKey.get(nameKey)!.params.push(...params);
    } else {
      const newCat: ConfigCategory = {
        id: categoryId,
        nameKey,
        descriptionKey,
        params,
      };
      categories.push(newCat);
      categoryByNameKey.set(nameKey, newCat);
    }
  }

  return categories;
}

function humanizeKey(raw: string): string {
  return raw
    .replace(/\./g, ' / ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BUSINESS_CONFIG_QUERY_KEY = ['businessConfig'] as const;
const BUSINESS_CONFIG_SCHEMA_QUERY_KEY = ['businessConfigSchema'] as const;

const ConfigCenterPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['process', 'parameters'];
  // 蓝图 Tab 下线后，blueprint/graph 旧链接一律落回「流程设置」
  const initialTab = validTabs.includes(tabFromUrl || '') ? tabFromUrl! : 'process';
  const [activeMainTab, setActiveMainTab] = useState<string>(initialTab);
  const [form] = Form.useForm();
  const [processForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [processSaving, setProcessSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(PARAMETER_CATEGORIES[0]?.id ?? 'production');
  const [selectedProcessCategory, setSelectedProcessCategory] = useState<string>(PROCESS_CATEGORIES[0]?.id ?? 'process_sales');

  const { data: bizRes, isLoading: configLoading, isFetching, isError: configError, refetch: refetchBusinessConfig } = useQuery({
    queryKey: BUSINESS_CONFIG_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const { data: schemaRes } = useQuery({
    queryKey: BUSINESS_CONFIG_SCHEMA_QUERY_KEY,
    queryFn: getBusinessConfigSchema,
    staleTime: 300_000,
  });
  const loading = configLoading && !bizRes;

  const processCategories = useMemo(
    () => buildProcessCategoriesFromRegistry(
      schemaRes?.processRegistry,
      PROCESS_CATEGORIES,
      schemaRes?.processRegistryMeta,
      schemaRes?.processRegistryParamMeta,
      schemaRes?.processRegistryControlMeta
    ),
    [schemaRes?.processRegistry, schemaRes?.processRegistryMeta, schemaRes?.processRegistryParamMeta, schemaRes?.processRegistryControlMeta]
  );
  const parameterCategories = useMemo(
    () => buildParameterCategoriesFromRegistry(
      schemaRes?.parameterRegistry,
      PARAMETER_CATEGORIES,
      schemaRes?.parameterRegistryMeta,
      schemaRes?.parameterRegistryParamMeta,
      schemaRes?.parameterRegistryControlMeta
    ),
    [schemaRes?.parameterRegistry, schemaRes?.parameterRegistryMeta, schemaRes?.parameterRegistryParamMeta, schemaRes?.parameterRegistryControlMeta]
  );
  const category = parameterCategories.find((c) => c.id === selectedCategory);
  const processCategory = processCategories.find((c) => c.id === selectedProcessCategory);
  const parameterImplementation = schemaRes?.parameterImplementation || {};
  const processRegistryKeySet = flattenRegistryKeys(schemaRes?.processRegistry);
  const parameterRegistryKeySet = flattenRegistryKeys(schemaRes?.parameterRegistry);
  const isImplementedParam = (sourcePath: string): boolean => {
    if (!sourcePath.startsWith('parameters.')) return true;
    const parts = sourcePath.replace('parameters.', '').split('.');
    if (parts.length !== 2) return true;
    const [categoryKey, parameterKey] = parts;
    const categoryImpl = parameterImplementation[categoryKey];
    if (!categoryImpl) return true;
    return categoryImpl[parameterKey] !== false;
  };

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && validTabs.includes(t) && activeMainTab !== t) setActiveMainTab(t);
    else if ((t === 'blueprint' || t === 'graph') && activeMainTab !== 'process') setActiveMainTab('process');
  }, [searchParams]);

  useEffect(() => {
    if (!processCategories.length) return;
    const existed = processCategories.some((c) => c.id === selectedProcessCategory);
    if (!existed) {
      setSelectedProcessCategory(processCategories[0].id);
    }
  }, [processCategories, selectedProcessCategory]);

  useEffect(() => {
    if (!parameterCategories.length) return;
    const existed = parameterCategories.some((c) => c.id === selectedCategory);
    if (!existed) {
      setSelectedCategory(parameterCategories[0].id);
    }
  }, [parameterCategories, selectedCategory]);

  const renderText = (key: string | undefined, fallback?: string) => {
    if (!key) return fallback || '';
    if (i18n.exists(key)) return t(key);
    return fallback || key;
  };

  const getParamGuidance = (paramKey: string): string => {
    const key = getParamGuidanceI18nKey(paramKey);
    if (!key) return '';
    return renderText(key, '');
  };

  // 有缓存或接口返回后立即填表，避免先空白再重载
  useEffect(() => {
    if (!bizRes) return;
    const initialValues: Record<string, any> = {};
    const bizParams = flattenBusinessParams(bizRes?.parameters || {});
    for (const [k, v] of Object.entries(bizParams)) {
      initialValues[k] = v;
    }
    const bizDefaults: Record<string, any> = {
      'procurement.require_purchase_requisition': false,
      'planning.require_production_plan': false,
      'purchase.auto_approval': false,
      'purchase.tolerance_percentage': 0,
      'reporting.auto_approve': false,
      'work_order.material_shortage_block_level': 1,
      'warehouse.location_management': false,
      'warehouse.auto_outbound': true,
    };
    for (const [k, v] of Object.entries(bizDefaults)) {
      if (initialValues[k] === undefined) initialValues[k] = v;
    }
    form.setFieldsValue(initialValues);
    processForm.setFieldsValue(initialValues);
  }, [bizRes]);

  useEffect(() => {
    if (configError && !bizRes) {
      messageApi.error(t('pages.system.configCenter.loadFailed'));
    }
  }, [configError, bizRes]);

  const handleSaveParameters = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true) as Record<string, any>;
      setSaving(true);

      const bizKeys: string[] = [];
      for (const cat of parameterCategories) {
        for (const param of cat.params) {
          const inRegistry = parameterRegistryKeySet.size === 0 || parameterRegistryKeySet.has(param.key);
          if (param.source === 'business_config' && isImplementedParam(param.sourcePath) && inRegistry) bizKeys.push(param.key);
        }
      }

      const bizParams = toBusinessParams(values, bizKeys);
      if (Object.keys(bizParams).length > 0) {
        await batchUpdateProcessParameters({ parameters: bizParams });
      }

      messageApi.success(t('pages.system.configCenter.saveSuccess'));
      await refetchBusinessConfig();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error.message || t('pages.system.configCenter.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProcess = async () => {
    try {
      await processForm.validateFields();
      const values = processForm.getFieldsValue(true) as Record<string, any>;
      setProcessSaving(true);

      const bizKeys: string[] = [];
      for (const cat of processCategories) {
        for (const param of cat.params) {
          const inRegistry = processRegistryKeySet.size === 0 || processRegistryKeySet.has(param.key);
          if (isImplementedParam(param.sourcePath) && inRegistry) bizKeys.push(param.key);
        }
      }

      const bizParams = toBusinessParams(values, bizKeys);
      if (Object.keys(bizParams).length > 0) {
        await batchUpdateProcessParameters({ parameters: bizParams });
      }

      messageApi.success(t('pages.system.configCenter.saveSuccess'));
      await refetchBusinessConfig();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error.message || t('pages.system.configCenter.saveFailed'));
    } finally {
      setProcessSaving(false);
    }
  };

  const parametersTabContent = (
    <>
      <Layout style={{ minHeight: 400, background: 'transparent' }}>
      <Sider
        width={200}
        style={{
          background: token.colorBgContainer,
          borderRadius: 8,
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorder}`, marginBottom: 8 }}>
          <Space>
            <SettingOutlined style={{ fontSize: 18 }} />
            <Text strong>{t('pages.system.configCenter.categoryTitle')}</Text>
          </Space>
        </div>
        <Menu
          selectedKeys={[selectedCategory]}
          mode="inline"
          style={{ border: 'none', background: 'transparent' }}
          items={parameterCategories.map((c) => ({
            key: c.id,
            label: renderText(c.nameKey, humanizeKey(c.id.replace(/^param_/, ''))),
          }))}
          onClick={({ key }) => setSelectedCategory(key)}
        />
      </Sider>
      <Content style={{ padding: '0 0 0 24px', overflow: 'visible' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            {category ? renderText(category.nameKey, humanizeKey(category.id.replace(/^param_/, ''))) : ''}
          </Text>
          {category?.descriptionKey && (
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              {renderText(category.descriptionKey, '')}
            </Paragraph>
          )}
        </div>

        <Spin spinning={loading}>
          <Form form={form} layout="vertical">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {category?.params.map((param) => (
                <Card key={param.key} size="small" style={{ marginBottom: 0 }}>
                  {(() => {
                    const implemented = isImplementedParam(param.sourcePath);
                    return (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong>{renderText(param.nameKey, humanizeKey(param.key))}</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                        {renderText(param.descriptionKey, '')}
                      </Paragraph>
                      {!!getParamGuidance(param.key) && (
                        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                          {getParamGuidance(param.key)}
                        </Paragraph>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
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
                        {param.type === 'boolean' ? (
                          <Switch disabled={!implemented} />
                        ) : param.type === 'number' ? (
                          <InputNumber min={param.min} max={param.max} precision={0} style={{ width: 140 }} disabled={!implemented} />
                        ) : param.type === 'select' && param.selectOptions?.length ? (
                          <Select
                            style={{ minWidth: 200 }}
                            disabled={!implemented}
                            options={param.selectOptions.map((o) => ({
                              value: o.value,
                              label: renderText(o.labelKey, o.value),
                            }))}
                          />
                        ) : param.type === 'color' ? (
                          <ColorPicker showText disabled={!implemented} />
                        ) : null}
                      </Form.Item>
                    </div>
                  </div>
                    );
                  })()}
                  {!isImplementedParam(param.sourcePath) && (
                    <Paragraph type="warning" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
                      该配置项暂未在后端实装，已禁用编辑。
                    </Paragraph>
                  )}
                </Card>
              ))}
            </div>
          </Form>
        </Spin>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetchBusinessConfig()} loading={isFetching}>
              {t('pages.system.configCenter.refresh')}
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveParameters} loading={saving}>
              {t('pages.system.configCenter.save')}
            </Button>
          </Space>
        </div>
      </Content>
    </Layout>
    </>
  );

  const processTabContent = (
    <>
      <Layout style={{ minHeight: 400, background: 'transparent' }}>
      <Sider
        width={200}
        style={{
          background: token.colorBgContainer,
          borderRadius: 8,
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorder}`, marginBottom: 8 }}>
          <Space>
            <NodeIndexOutlined style={{ fontSize: 18 }} />
            <Text strong>{t('pages.system.configCenter.categoryTitle')}</Text>
          </Space>
        </div>
        <Menu
          selectedKeys={[selectedProcessCategory]}
          mode="inline"
          style={{ border: 'none', background: 'transparent' }}
          items={processCategories.map((c) => ({
            key: c.id,
            label: renderText(c.nameKey, humanizeKey(c.id.replace(/^process_/, ''))),
          }))}
          onClick={({ key }) => setSelectedProcessCategory(key)}
        />
      </Sider>
      <Content style={{ padding: '0 0 0 24px', overflow: 'visible' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            {processCategory ? renderText(processCategory.nameKey, humanizeKey(processCategory.id.replace(/^process_/, ''))) : ''}
          </Text>
          {processCategory?.descriptionKey && (
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              {renderText(processCategory.descriptionKey, '')}
            </Paragraph>
          )}
        </div>

        <Alert
          type="info"
          showIcon
          message={t('pages.system.configCenter.processAuditGuidanceTitle')}
          description={t('pages.system.configCenter.processAuditGuidanceDesc')}
          style={{ marginBottom: 16 }}
        />

        <Spin spinning={loading}>
          <Form form={processForm} layout="vertical">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {processCategory?.params.map((param) => (
                <Card key={param.key} size="small" style={{ marginBottom: 0 }}>
                  {(() => {
                    const implemented = isImplementedParam(param.sourcePath);
                    return (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong>{renderText(param.nameKey, humanizeKey(param.key))}</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                        {renderText(param.descriptionKey, '')}
                      </Paragraph>
                      {!!getParamGuidance(param.key) && (
                        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                          {getParamGuidance(param.key)}
                        </Paragraph>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
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
                        {param.type === 'boolean' ? (
                          <Switch disabled={!implemented} />
                        ) : param.type === 'number' ? (
                          <InputNumber min={param.min} max={param.max} precision={0} style={{ width: 140 }} disabled={!implemented} />
                        ) : param.type === 'select' && param.selectOptions?.length ? (
                          <Select
                            style={{ minWidth: 200 }}
                            disabled={!implemented}
                            options={param.selectOptions.map((o) => ({
                              value: o.value,
                              label: renderText(o.labelKey, o.value),
                            }))}
                          />
                        ) : param.type === 'color' ? (
                          <ColorPicker showText disabled={!implemented} />
                        ) : null}
                      </Form.Item>
                    </div>
                  </div>
                    );
                  })()}
                  {!isImplementedParam(param.sourcePath) && (
                    <Paragraph type="warning" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
                      该流程项暂未在后端实装，已禁用编辑。
                    </Paragraph>
                  )}
                </Card>
              ))}
            </div>
          </Form>
        </Spin>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetchBusinessConfig()} loading={isFetching}>
              {t('pages.system.configCenter.refresh')}
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveProcess} loading={processSaving}>
              {t('pages.system.configCenter.save')}
            </Button>
          </Space>
        </div>
      </Content>
    </Layout>
    </>
  );

  return (
    <div
        className="config-center-page"
        style={{
          background: token.colorBgContainer,
          minHeight: '100%',
          borderRadius: typeof token.borderRadiusLG === 'number' ? token.borderRadiusLG : (token.borderRadiusLG ?? 8),
          overflow: 'hidden',
        }}
      >
      <style>{`
        /* 最外层带 tabs 的卡片保留圆角 */
        .config-center-page .ant-card.ant-card-bordered.ant-card-contain-tabs {
          border-radius: ${typeof token.borderRadiusLG === 'number' ? `${token.borderRadiusLG}px` : token.borderRadiusLG ?? '8px'} !important;
        }
        /* 修正 ant-card-body 多出的 16px 高度：将 padding 从默认 24px 调整为 16px */
        .config-center-page .ant-card .ant-card-body {
          padding: 16px !important;
        }
        /* 隔离左侧 Sider 背景，避免继承主菜单深色，强制使用浅色 */
        .config-center-page .ant-layout-sider,
        .config-center-page .ant-layout-sider .ant-layout-sider-children,
        .config-center-page .ant-layout .ant-layout-sider {
          background: ${token.colorBgContainer} !important;
        }
        /* 确保卡片主体也有背景，与内容区隔离 */
        .config-center-page .ant-card {
          background: ${token.colorBgContainer} !important;
        }
      `}</style>
      <MultiTabListPageTemplate
        activeTabKey={activeMainTab}
        onTabChange={setActiveMainTab}
        tabs={[
          {
            key: 'process',
            label: (
              <Space>
                <NodeIndexOutlined />
                <span>{t('pages.system.configCenter.tabProcess')}</span>
              </Space>
            ),
            children: processTabContent,
          },
          {
            key: 'parameters',
            label: (
              <Space>
                <ControlOutlined />
                <span>{t('pages.system.configCenter.tabParameters')}</span>
              </Space>
            ),
            children: parametersTabContent,
          },
        ]}
        padding={24}
      />
    </div>
  );
};

export default ConfigCenterPage;
