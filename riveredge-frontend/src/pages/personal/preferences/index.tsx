/**
 * 偏好设置页面
 * 
 * 用于用户查看和编辑偏好设置。
 * 支持主题、主题配置（颜色/圆角/字体/背景色/标签持久化）、语言、通知设置、界面设置等。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ProForm, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, ColorPicker, Form, Row, Col, Typography, Space } from 'antd';
import { useUserPreferenceStore, readCachedPreferencesForCurrentUser } from '../../../stores/userPreferenceStore';
import { getLanguageList, Language } from '../../../services/language';
import type { Color } from 'antd/es/color-picker';
import { clampBorderRadius, readBorderRadius } from '../../../utils/themeBorderRadius';
import { clampFontSize, readFontSize } from '../../../utils/themeFontSize';
import { ThemeStyleSliders } from '../../../components/theme-editor/ThemeStyleSliders';


/** 将 ColorPicker 的值规范为 hex 字符串 */
function normalizeColor(value: string | Color | null | undefined, defaultVal: string = ''): string {
  if (!value) return defaultVal;
  if (typeof value === 'string') return value;
  const colorObj = value as any;
  if (colorObj.toHexString) return colorObj.toHexString();
  if (colorObj.metaColor?.toHexString) return colorObj.metaColor.toHexString();
  return defaultVal;
}

/** 与 UniTable 一致：仅 large | middle | small，默认紧凑（small），兼容历史 default */
function normalizeProTableDensity(v: unknown): 'large' | 'middle' | 'small' {
  if (v === 'large' || v === 'middle' || v === 'small') return v;
  return 'small';
}

function normalizeThemeConfigFields(
  tc: Record<string, unknown> | null | undefined,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...fallback, ...(tc || {}) };
  return {
    ...merged,
    borderRadius: readBorderRadius(merged.borderRadius, 6),
    fontSize: readFontSize(merged.fontSize, 14),
  };
}

/**
 * 偏好设置页面组件
 */
/** 默认偏好（首屏或未加载时表单先显示这些值，避免空白需刷新） */
const defaultPreferenceValues: Record<string, any> = {
  theme: 'light',
  theme_config: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
    fontSize: 14,
    siderBgColor: '',
    headerBgColor: '',
    tabsBgColor: '',
  },
  tabs_persistence: false,
  language: 'zh-CN',
  notifications: { email: false, sms: false, internal: true, push: false },
  ui: {
    layout: 'default',
    font_size: 'medium',
    sidebar_collapsed: false,
    default_page_size: 20,
    default_table_density: 'small',
    max_tabs: 20,
  },
};

const UserPreferencesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = React.useRef<ProFormInstance>();
  const preferences = useUserPreferenceStore((s) => s.preferences);
  const fetchPreferences = useUserPreferenceStore((s) => s.fetchPreferences);
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);
  const getPreference = useUserPreferenceStore((s) => s.getPreference);
  const storeLoading = useUserPreferenceStore((s) => s.loading);
  const initialized = useUserPreferenceStore((s) => s.initialized);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [formInitialValues] = useState<Record<string, any>>(() => {
    const cached = readCachedPreferencesForCurrentUser();
    if (!cached || Object.keys(cached).length === 0) return defaultPreferenceValues;
    return {
      ...defaultPreferenceValues,
      ...cached,
      theme_config: normalizeThemeConfigFields(
        cached.theme_config as Record<string, unknown> | undefined,
        defaultPreferenceValues.theme_config,
      ),
      ui: {
        ...defaultPreferenceValues.ui,
        ...(cached.ui || {}),
        layout: 'default',
        default_table_density: normalizeProTableDensity((cached.ui || {}).default_table_density),
      },
      notifications: { ...defaultPreferenceValues.notifications, ...(cached.notifications || {}) },
    };
  });

  /**
   * 加载可用语言列表
   */
  const loadLanguages = useCallback(async () => {
    try {
      const response = await getLanguageList({ is_active: true });
      setLanguages(response.items || []);
    } catch (error: any) {
      if (typeof window !== 'undefined') {
        window.console.warn('Failed to load languages:', error);
      }
      // 如果加载失败，使用默认语言列表
      setLanguages([]);
    }
  }, []);

  /**
   * 加载偏好设置和语言列表
   */
  useEffect(() => {
    // 延迟拉取数据，避免同步渲染周期中的状态更新
    const timer = window.setTimeout(() => {
      loadLanguages();
      fetchPreferences();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLanguages, fetchPreferences]);

  /**
   * 当偏好加载完成（initialized）后填充表单：有偏好用偏好，无偏好用 getPreference 的默认值（含系统配置），避免默认偏好不显示需刷新的问题
   */
  useEffect(() => {
    if (!initialized) return;
    const form = formRef.current;
    if (!form) return;

    if (preferences && Object.keys(preferences).length > 0) {
      // 与默认值合并，避免 theme_config 等只保存了部分字段时其余为空
      const merged = {
        ...defaultPreferenceValues,
        ...preferences,
        theme_config: {
          ...normalizeThemeConfigFields(
            preferences.theme_config as Record<string, unknown> | undefined,
            defaultPreferenceValues.theme_config,
          ),
          compact: false,
        },
        ui: {
          ...defaultPreferenceValues.ui,
          ...(preferences.ui || {}),
        },
        notifications: {
          ...defaultPreferenceValues.notifications,
          ...(preferences.notifications || {}),
        },
      };
      form.setFieldsValue(merged);
      return;
    }

    // 无用户偏好时，用 getPreference 填充默认值（含 ui.* 的系统配置回退）
    const defaultValues = {
      theme: getPreference<string>('theme', 'light'),
      theme_config: normalizeThemeConfigFields(
        {
          colorPrimary: getPreference<string>('theme_config.colorPrimary', '#1890ff'),
          borderRadius: getPreference<number>('theme_config.borderRadius', 6),
          fontSize: getPreference<number>('theme_config.fontSize', 14),
          themeStyle: getPreference<string>('theme_config.themeStyle', 'vivid'),
          siderBgColor: getPreference<string>('theme_config.siderBgColor', '') ?? '',
          headerBgColor: getPreference<string>('theme_config.headerBgColor', '') ?? '',
          tabsBgColor: getPreference<string>('theme_config.tabsBgColor', '') ?? '',
        },
        defaultPreferenceValues.theme_config,
      ),
      tabs_persistence: getPreference<boolean>('tabs_persistence', false),
      language: getPreference<string>('language', 'zh-CN'),
      notifications: {
        email: getPreference<boolean>('notifications.email', true),
        sms: getPreference<boolean>('notifications.sms', false),
        internal: getPreference<boolean>('notifications.internal', true),
        push: getPreference<boolean>('notifications.push', false),
      },
      ui: {
        layout: 'default',
        font_size: getPreference<string>('ui.font_size', 'medium'),
        sidebar_collapsed: getPreference<boolean>('ui.sidebar_collapsed', false),
        default_page_size: getPreference<number>('ui.default_page_size', 20),
        default_table_density: normalizeProTableDensity(
          getPreference<string | undefined>('ui.default_table_density', undefined) ?? 'small',
        ),
        max_tabs: getPreference<number>('ui.max_tabs', 20),
      },
    };
    form.setFieldsValue(defaultValues);
  }, [initialized, preferences, getPreference]);


  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      // 规范化 theme_config 中的颜色值
      const tc = values.theme_config;
      if (tc) {
        values = {
          ...values,
          theme_config: {
            ...tc,
            colorPrimary: normalizeColor(tc.colorPrimary, '#1890ff'),
            borderRadius: clampBorderRadius(tc.borderRadius, 6),
            fontSize: clampFontSize(tc.fontSize, 14),
            compact: false,
            themeStyle: tc.themeStyle ?? preferences?.theme_config?.themeStyle ?? 'vivid',
            siderBgColor: normalizeColor(tc.siderBgColor, '') || '',
            headerBgColor: normalizeColor(tc.headerBgColor, '') || '',
            tabsBgColor: normalizeColor(tc.tabsBgColor, '') || '',
          },
        };
      }

      const prevUi =
        preferences && typeof preferences.ui === 'object' && preferences.ui !== null
          ? preferences.ui
          : {};
      const submittedUi = (values.ui && typeof values.ui === 'object') ? values.ui : {};
      values = {
        ...values,
        ui: {
          ...prevUi,
          ...submittedUi,
          layout: 'default',
          default_table_density: normalizeProTableDensity(
            submittedUi.default_table_density ?? prevUi.default_table_density ?? 'small',
          ),
        },
      };

      await updatePreferences(values);

      messageApi.success(t('pages.personal.preferences.updateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.personal.preferences.updateFailed'));
    }
  };

  const sectionMargin = { marginBottom: 28 };

  return (
    <div style={{ padding: 0 }}>
      <Card title={t('pages.personal.preferences.title')} loading={storeLoading} styles={{ body: { padding: '24px 24px 16px' } }}>
        <ProForm
          formRef={formRef}
          initialValues={formInitialValues}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: { submitText: t('pages.personal.preferences.save') },
            render: (_, dom) => <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--ant-color-border)' }}><Space>{dom}</Space></div>,
          }}
          layout="vertical"
        >
          <Row gutter={[24, 24]}>
            {/* 左栏：主题与外观 */}
            <Col xs={24} lg={12}>
              <Card type="inner" title={t('pages.personal.preferences.themeAndAppearance')} styles={{ body: { padding: '24px' } }}>
                {/* 核心显示 */}
                <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.colorMode')}</Typography.Title>
                <div style={sectionMargin}>
                  <SafeProFormSelect
                    name="theme"
                    noStyle
                    valueEnum={{ light: t('pages.personal.preferences.light'), dark: t('pages.personal.preferences.dark'), auto: t('pages.personal.preferences.auto') }}
                    placeholder={t('pages.personal.preferences.pleaseSelect')}
                  />
                </div>

                {/* 样式微调 */}
                <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.styleCustomization')}</Typography.Title>
                <div style={sectionMargin}>
                  <ThemeStyleSliders
                    fontSizeName={['theme_config', 'fontSize']}
                    borderRadiusName={['theme_config', 'borderRadius']}
                  />
                </div>

                {/* 颜色方案 */}
                <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.colorScheme')}</Typography.Title>
                <div style={{ marginBottom: 20 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Form.Item
                        name={['theme_config', 'colorPrimary']}
                        label={t('pages.personal.preferences.themeColor')}
                        getValueFromEvent={(c: any) => normalizeColor(c, '#1890ff')}
                        normalize={(v: any) => normalizeColor(v, '#1890ff')}
                      >
                        <ColorPicker showText format="hex" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={['theme_config', 'siderBgColor']}
                        label={t('pages.personal.preferences.siderBgColor')}
                        getValueFromEvent={(c: any) => normalizeColor(c, '')}
                        normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                      >
                        <ColorPicker showText format="hex" allowClear />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={['theme_config', 'headerBgColor']}
                        label={t('pages.personal.preferences.headerBgColor')}
                        getValueFromEvent={(c: any) => normalizeColor(c, '')}
                        normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                      >
                        <ColorPicker showText format="hex" allowClear />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={['theme_config', 'tabsBgColor']}
                        label={t('pages.personal.preferences.tabsBgColor')}
                        getValueFromEvent={(c: any) => normalizeColor(c, '')}
                        normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                      >
                        <ColorPicker showText format="hex" allowClear />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>

                {/* 辅助开关 */}
                <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.miscOptions')}</Typography.Title>
                <Row gutter={24}>
                  <Col span={24}>
                    <ProFormSwitch 
                      name="tabs_persistence" 
                      label={t('pages.personal.preferences.tabsPersistence')} 
                      fieldProps={{ checkedChildren: t('pages.personal.preferences.on'), unCheckedChildren: t('pages.personal.preferences.off') }} 
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* 右栏：语言、通知、界面 */}
            <Col xs={24} lg={12}>
              <Card type="inner" title={t('pages.personal.preferences.otherSettings')} styles={{ body: { padding: '24px' } }}>
                {/* 语言 */}
                <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.language')}</Typography.Title>
                <div style={sectionMargin}>
                  <SafeProFormSelect
                    name="language"
                    noStyle
                    valueEnum={
                      languages.length > 0
                        ? languages.reduce((acc, lang) => {
                            acc[lang.code] = lang.native_name || lang.name;
                            return acc;
                          }, {} as Record<string, string>)
                        : {
                            'zh-CN': t('common.languages.zhCN'),
                            'en-US': t('common.languages.enUS'),
                            'zh-Hant': t('common.languages.zhTW'),
                            'ja-JP': t('common.languages.jaJP'),
                            'vi-VN': t('common.languages.viVN'),
                          }
                    }
                    placeholder={t('pages.personal.preferences.pleaseSelectLanguage')}
                  />
                </div>

                {/* 通知 */}
                <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.notifications')}</Typography.Title>
                <div style={sectionMargin}>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <ProFormSwitch name={['notifications', 'email']} label={t('pages.personal.preferences.emailNotify')} fieldProps={{ size: 'small' }} />
                    </Col>
                    <Col span={12}>
                      <ProFormSwitch name={['notifications', 'sms']} label={t('pages.personal.preferences.smsNotify')} fieldProps={{ size: 'small' }} />
                    </Col>
                    <Col span={12}>
                      <ProFormSwitch name={['notifications', 'internal']} label={t('pages.personal.preferences.internalNotify')} fieldProps={{ size: 'small' }} />
                    </Col>
                    <Col span={12}>
                      <ProFormSwitch name={['notifications', 'push']} label={t('pages.personal.preferences.pushNotify')} fieldProps={{ size: 'small' }} />
                    </Col>
                  </Row>
                </div>

                {/* 界面 */}
                <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.interface')}</Typography.Title>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <SafeProFormSelect 
                      name={['ui', 'default_page_size']} 
                      label={t('pages.personal.preferences.tablePageSize')} 
                      valueEnum={{ 10: t('pages.personal.preferences.perPage10'), 20: t('pages.personal.preferences.perPage20'), 50: t('pages.personal.preferences.perPage50'), 100: t('pages.personal.preferences.perPage100') }} 
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormSelect
                      name={['ui', 'max_tabs']}
                      label={t('pages.personal.preferences.maxTabs')}
                      options={[
                        { label: '10', value: 10 },
                        { label: '20', value: 20 },
                        { label: '30', value: 30 },
                        { label: '50', value: 50 },
                      ]}
                    />
                  </Col>
                  <Col span={24}>
                    <ProFormSwitch 
                      name={['ui', 'sidebar_collapsed']} 
                      label={t('pages.personal.preferences.sidebarCollapsed')} 
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 8 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('pages.personal.preferences.tableColumnsHint')}
                  </Typography.Text>
                </div>
              </Card>
            </Col>
          </Row>
        </ProForm>
      </Card>
    </div>
  );
};

export default UserPreferencesPage;
