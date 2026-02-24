/**
 * 偏好设置页面
 * 
 * 用于用户查看和编辑偏好设置。
 * 支持主题、主题配置（颜色/圆角/字体/紧凑/背景色/标签持久化）、语言、通知设置、界面设置等。
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProForm, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, ColorPicker, Slider, Form, Row, Col, Divider, Typography } from 'antd';
import { useUserPreferenceStore } from '../../../stores/userPreferenceStore';
import { getLanguageList, Language } from '../../../services/language';
import { loadUserLanguage, refreshTranslations } from '../../../config/i18n';
import i18n from '../../../config/i18n';

/** 将 ColorPicker 的值规范为 hex 字符串 */
function normalizeColor(value: any, defaultVal: string = ''): string {
  if (!value) return defaultVal;
  if (typeof value === 'string') return value;
  if (value?.toHexString) return value.toHexString();
  if (value?.metaColor?.toHexString) return value.metaColor.toHexString();
  return defaultVal;
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
    compact: false,
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
    default_table_density: 'default',
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

  /**
   * 加载偏好设置和语言列表
   */
  useEffect(() => {
    loadLanguages();
    fetchPreferences();
  }, []);

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
          ...defaultPreferenceValues.theme_config,
          ...(preferences.theme_config || {}),
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
      theme_config: {
        colorPrimary: getPreference<string>('theme_config.colorPrimary', '#1890ff'),
        borderRadius: getPreference<number>('theme_config.borderRadius', 6),
        fontSize: getPreference<number>('theme_config.fontSize', 14),
        compact: getPreference<boolean>('theme_config.compact', false),
        siderBgColor: getPreference<string>('theme_config.siderBgColor', '') ?? '',
        headerBgColor: getPreference<string>('theme_config.headerBgColor', '') ?? '',
        tabsBgColor: getPreference<string>('theme_config.tabsBgColor', '') ?? '',
      },
      tabs_persistence: getPreference<boolean>('tabs_persistence', false),
      language: getPreference<string>('language', 'zh-CN'),
      notifications: {
        email: getPreference<boolean>('notifications.email', true),
        sms: getPreference<boolean>('notifications.sms', false),
        internal: getPreference<boolean>('notifications.internal', true),
        push: getPreference<boolean>('notifications.push', false),
      },
      ui: {
        layout: getPreference<string>('ui.layout', 'default'),
        font_size: getPreference<string>('ui.font_size', 'medium'),
        sidebar_collapsed: getPreference<boolean>('ui.sidebar_collapsed', false),
        default_page_size: getPreference<number>('ui.default_page_size', 20),
        default_table_density: getPreference<string>('ui.default_table_density', 'default'),
        max_tabs: getPreference<number>('ui.max_tabs', 20),
      },
    };
    form.setFieldsValue(defaultValues);
  }, [initialized, preferences, getPreference]);

  /**
   * 加载可用语言列表
   */
  const loadLanguages = async () => {
    try {
      const response = await getLanguageList({ is_active: true });
      setLanguages(response.items || []);
    } catch (error: any) {
      console.warn('Failed to load languages:', error);
      // 如果加载失败，使用默认语言列表
      setLanguages([]);
    }
  };

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
            borderRadius: tc.borderRadius ?? 6,
            fontSize: tc.fontSize ?? 14,
            compact: !!tc.compact,
            siderBgColor: normalizeColor(tc.siderBgColor, '') || '',
            headerBgColor: normalizeColor(tc.headerBgColor, '') || '',
            tabsBgColor: normalizeColor(tc.tabsBgColor, '') || '',
          },
        };
      }

      await updatePreferences(values);

      messageApi.success(t('pages.personal.preferences.updateSuccess'));

      // 如果语言变更，重新加载用户语言和翻译内容
      if (values.language && values.language !== i18n.language) {
        await loadUserLanguage();
        await refreshTranslations();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.personal.preferences.updateFailed'));
    }
  };

  const rowGutter: [number, number] = [24, 20];
  const sectionMargin = { marginBottom: 28 };

  return (
    <div style={{ padding: 0 }}>
      <Card title={t('pages.personal.preferences.title')} loading={storeLoading} styles={{ body: { padding: '24px 24px 16px' } }}>
        <ProForm
          formRef={formRef}
          initialValues={defaultPreferenceValues}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: { submitText: t('pages.personal.preferences.save') },
            render: (_, dom) => <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--ant-color-border)' }}>{dom}</div>,
          }}
          layout="vertical"
        >
          {/* 主题与外观 */}
          <Typography.Title level={5} style={{ marginBottom: 16, marginTop: 0 }}>{t('pages.personal.preferences.themeAndAppearance')}</Typography.Title>
          <div style={sectionMargin}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={24} md={8}>
                <SafeProFormSelect
                  name="theme"
                  label={t('pages.personal.preferences.colorMode')}
                  valueEnum={{ light: t('pages.personal.preferences.light'), dark: t('pages.personal.preferences.dark'), auto: t('pages.personal.preferences.auto') }}
                  placeholder={t('pages.personal.preferences.pleaseSelect')}
                />
              </Col>
            </Row>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12}>
                <Form.Item name={['theme_config', 'fontSize']} label={t('pages.personal.preferences.fontSize')}>
                  <Slider min={12} max={20} marks={{ 12: t('pages.personal.preferences.fontSmall'), 14: t('pages.personal.preferences.fontStandard'), 16: t('pages.personal.preferences.fontLarge'), 18: t('pages.personal.preferences.fontXl'), 20: t('pages.personal.preferences.fontXxl') }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name={['theme_config', 'borderRadius']} label={t('pages.personal.preferences.borderRadius')}>
                  <Slider min={0} max={16} marks={{ 0: t('pages.personal.preferences.square'), 6: t('pages.personal.preferences.medium'), 12: t('pages.personal.preferences.round'), 16: t('pages.personal.preferences.rounder') }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name={['theme_config', 'colorPrimary']}
                  label={t('pages.personal.preferences.themeColor')}
                  getValueFromEvent={(c: any) => normalizeColor(c, '#1890ff')}
                  normalize={(v: any) => normalizeColor(v, '#1890ff')}
                >
                  <ColorPicker showText format="hex" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name={['theme_config', 'siderBgColor']}
                  label={t('pages.personal.preferences.siderBgColor')}
                  extra={t('pages.personal.preferences.siderBgExtra')}
                  getValueFromEvent={(c: any) => normalizeColor(c, '')}
                  normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                >
                  <ColorPicker showText format="hex" allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name={['theme_config', 'headerBgColor']}
                  label={t('pages.personal.preferences.headerBgColor')}
                  getValueFromEvent={(c: any) => normalizeColor(c, '')}
                  normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                >
                  <ColorPicker showText format="hex" allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
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
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['theme_config', 'compact']} label={t('pages.personal.preferences.compactMode')} fieldProps={{ checkedChildren: t('pages.personal.preferences.on'), unCheckedChildren: t('pages.personal.preferences.off') }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name="tabs_persistence" label={t('pages.personal.preferences.tabsPersistence')} fieldProps={{ checkedChildren: t('pages.personal.preferences.on'), unCheckedChildren: t('pages.personal.preferences.off') }} />
              </Col>
            </Row>
          </div>

          {/* 语言 */}
          <Divider style={{ marginTop: 8 }} />
          <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.language')}</Typography.Title>
          <div style={sectionMargin}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={24} md={8}>
                <SafeProFormSelect
                  name="language"
                  label={t('pages.personal.preferences.interfaceLanguage')}
                  valueEnum={
                    languages.length > 0
                      ? languages.reduce((acc, lang) => {
                          acc[lang.code] = lang.native_name || lang.name;
                          return acc;
                        }, {} as Record<string, string>)
                      : { 'zh-CN': '简体中文', 'en-US': 'English' }
                  }
                  placeholder={t('pages.personal.preferences.pleaseSelectLanguage')}
                />
              </Col>
            </Row>
          </div>

          {/* 通知 */}
          <Divider style={{ marginTop: 8 }} />
          <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.notifications')}</Typography.Title>
          <div style={sectionMargin}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'email']} label={t('pages.personal.preferences.emailNotify')} fieldProps={{ checkedChildren: t('pages.personal.preferences.on'), unCheckedChildren: t('pages.personal.preferences.off') }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'sms']} label={t('pages.personal.preferences.smsNotify')} fieldProps={{ checkedChildren: t('pages.personal.preferences.on'), unCheckedChildren: t('pages.personal.preferences.off') }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'internal']} label={t('pages.personal.preferences.internalNotify')} fieldProps={{ checkedChildren: t('pages.personal.preferences.on'), unCheckedChildren: t('pages.personal.preferences.off') }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'push']} label={t('pages.personal.preferences.pushNotify')} fieldProps={{ checkedChildren: t('pages.personal.preferences.on'), unCheckedChildren: t('pages.personal.preferences.off') }} />
              </Col>
            </Row>
          </div>

          {/* 界面 */}
          <Divider style={{ marginTop: 8 }} />
          <Typography.Title level={5} style={{ marginBottom: 16 }}>{t('pages.personal.preferences.interface')}</Typography.Title>
          <div style={{ marginBottom: 8 }}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'layout']} label={t('pages.personal.preferences.layout')} valueEnum={{ default: t('pages.personal.preferences.layoutDefault'), compact: t('pages.personal.preferences.layoutCompact'), wide: t('pages.personal.preferences.layoutWide') }} placeholder={t('pages.personal.preferences.pleaseSelect')} />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'font_size']} label={t('pages.personal.preferences.fontSize')} valueEnum={{ small: t('pages.personal.preferences.fontSmall'), medium: t('pages.personal.preferences.fontStandard'), large: t('pages.personal.preferences.fontLarge') }} placeholder={t('pages.personal.preferences.pleaseSelect')} />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <ProFormSwitch name={['ui', 'sidebar_collapsed']} label={t('pages.personal.preferences.sidebarCollapsed')} fieldProps={{ checkedChildren: t('pages.personal.preferences.yes'), unCheckedChildren: t('pages.personal.preferences.no') }} />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'default_page_size']} label={t('pages.personal.preferences.tablePageSize')} valueEnum={{ 10: t('pages.personal.preferences.perPage10'), 20: t('pages.personal.preferences.perPage20'), 50: t('pages.personal.preferences.perPage50'), 100: t('pages.personal.preferences.perPage100') }} placeholder={t('pages.personal.preferences.pleaseSelect')} />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'default_table_density']} label={t('pages.personal.preferences.tableDensity')} valueEnum={{ default: t('pages.personal.preferences.densityDefault'), middle: t('pages.personal.preferences.densityMiddle'), small: t('pages.personal.preferences.densitySmall') }} placeholder={t('pages.personal.preferences.pleaseSelect')} />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <ProFormSelect
                  name={['ui', 'max_tabs']}
                  label={t('pages.personal.preferences.maxTabs')}
                  options={[
                    { label: '10', value: 10 },
                    { label: '20', value: 20 },
                    { label: '30', value: 30 },
                    { label: '50', value: 50 },
                  ]}
                  placeholder={t('pages.personal.preferences.pleaseSelect')}
                />
              </Col>
            </Row>
          </div>
        </ProForm>
      </Card>
    </div>
  );
};

export default UserPreferencesPage;

