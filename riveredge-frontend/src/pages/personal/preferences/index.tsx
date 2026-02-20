/**
 * 偏好设置页面
 * 
 * 用于用户查看和编辑偏好设置。
 * 支持主题、主题配置（颜色/圆角/字体/紧凑/背景色/标签持久化）、语言、通知设置、界面设置等。
 */

import React, { useState, useEffect } from 'react';
import { ProForm, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, ColorPicker, Slider, Form, Row, Col, Divider, Typography } from 'antd';
import { useUserPreferenceStore } from '../../../stores/userPreferenceStore';
import { useThemeStore } from '../../../stores/themeStore';
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
      // 若包含主题配置，先应用到 themeStore（单一数据源），再持久化到 API
      const tc = values.theme_config;
      if (tc) {
        const mergedConfig = {
          colorPrimary: normalizeColor(tc.colorPrimary, '#1890ff'),
          borderRadius: tc.borderRadius ?? 6,
          fontSize: tc.fontSize ?? 14,
          compact: !!tc.compact,
          siderBgColor: normalizeColor(tc.siderBgColor, '') || '',
          headerBgColor: normalizeColor(tc.headerBgColor, '') || '',
          tabsBgColor: normalizeColor(tc.tabsBgColor, '') || '',
        };
        useThemeStore.getState().applyTheme((values.theme as 'light' | 'dark' | 'auto') || 'light', mergedConfig);
      }

      await updatePreferences(values);

      messageApi.success('偏好设置更新成功');

      // 如果语言变更，重新加载用户语言和翻译内容
      if (values.language && values.language !== i18n.language) {
        await loadUserLanguage();
        await refreshTranslations();
      }
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
    }
  };

  const rowGutter: [number, number] = [24, 20];
  const sectionMargin = { marginBottom: 28 };

  return (
    <div style={{ padding: 0 }}>
      <Card title="偏好设置" loading={storeLoading} styles={{ body: { padding: '24px 24px 16px' } }}>
        <ProForm
          formRef={formRef}
          initialValues={defaultPreferenceValues}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: { submitText: '保存' },
            render: (_, dom) => <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--ant-color-border)' }}>{dom}</div>,
          }}
          layout="vertical"
        >
          {/* 主题与外观 */}
          <Typography.Title level={5} style={{ marginBottom: 16, marginTop: 0 }}>主题与外观</Typography.Title>
          <div style={sectionMargin}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={24} md={8}>
                <SafeProFormSelect
                  name="theme"
                  label="颜色模式"
                  valueEnum={{ light: '亮色', dark: '暗色', auto: '自动' }}
                  placeholder="请选择"
                />
              </Col>
            </Row>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12}>
                <Form.Item name={['theme_config', 'fontSize']} label="字体大小">
                  <Slider min={12} max={20} marks={{ 12: '小', 14: '标准', 16: '大', 18: '很大', 20: '特大' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name={['theme_config', 'borderRadius']} label="圆角大小">
                  <Slider min={0} max={16} marks={{ 0: '直角', 6: '适中', 12: '圆润', 16: '很圆' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name={['theme_config', 'colorPrimary']}
                  label="主题色"
                  getValueFromEvent={(c: any) => normalizeColor(c, '#1890ff')}
                  normalize={(v: any) => normalizeColor(v, '#1890ff')}
                >
                  <ColorPicker showText format="hex" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name={['theme_config', 'siderBgColor']}
                  label="菜单栏背景色"
                  extra="仅浅色模式"
                  getValueFromEvent={(c: any) => normalizeColor(c, '')}
                  normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                >
                  <ColorPicker showText format="hex" allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name={['theme_config', 'headerBgColor']}
                  label="顶栏背景色"
                  getValueFromEvent={(c: any) => normalizeColor(c, '')}
                  normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                >
                  <ColorPicker showText format="hex" allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name={['theme_config', 'tabsBgColor']}
                  label="标签栏背景色"
                  getValueFromEvent={(c: any) => normalizeColor(c, '')}
                  normalize={(v: any) => (v == null || v === '') ? '' : normalizeColor(v, '')}
                >
                  <ColorPicker showText format="hex" allowClear />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['theme_config', 'compact']} label="紧凑模式" fieldProps={{ checkedChildren: '开启', unCheckedChildren: '关闭' }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name="tabs_persistence" label="标签栏持久化" fieldProps={{ checkedChildren: '开启', unCheckedChildren: '关闭' }} />
              </Col>
            </Row>
          </div>

          {/* 语言 */}
          <Divider style={{ marginTop: 8 }} />
          <Typography.Title level={5} style={{ marginBottom: 16 }}>语言</Typography.Title>
          <div style={sectionMargin}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={24} md={8}>
                <SafeProFormSelect
                  name="language"
                  label="界面语言"
                  valueEnum={
                    languages.length > 0
                      ? languages.reduce((acc, lang) => {
                          acc[lang.code] = lang.native_name || lang.name;
                          return acc;
                        }, {} as Record<string, string>)
                      : { 'zh-CN': '简体中文', 'en-US': 'English' }
                  }
                  placeholder="请选择语言"
                />
              </Col>
            </Row>
          </div>

          {/* 通知 */}
          <Divider style={{ marginTop: 8 }} />
          <Typography.Title level={5} style={{ marginBottom: 16 }}>通知</Typography.Title>
          <div style={sectionMargin}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'email']} label="邮件通知" fieldProps={{ checkedChildren: '开启', unCheckedChildren: '关闭' }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'sms']} label="短信通知" fieldProps={{ checkedChildren: '开启', unCheckedChildren: '关闭' }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'internal']} label="站内信通知" fieldProps={{ checkedChildren: '开启', unCheckedChildren: '关闭' }} />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSwitch name={['notifications', 'push']} label="推送通知" fieldProps={{ checkedChildren: '开启', unCheckedChildren: '关闭' }} />
              </Col>
            </Row>
          </div>

          {/* 界面 */}
          <Divider style={{ marginTop: 8 }} />
          <Typography.Title level={5} style={{ marginBottom: 16 }}>界面</Typography.Title>
          <div style={{ marginBottom: 8 }}>
            <Row gutter={rowGutter}>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'layout']} label="布局" valueEnum={{ default: '默认', compact: '紧凑', wide: '宽屏' }} placeholder="请选择" />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'font_size']} label="字体大小" valueEnum={{ small: '小', medium: '中', large: '大' }} placeholder="请选择" />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <ProFormSwitch name={['ui', 'sidebar_collapsed']} label="侧边栏默认收起" fieldProps={{ checkedChildren: '是', unCheckedChildren: '否' }} />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'default_page_size']} label="表格每页条数" valueEnum={{ 10: '10 条/页', 20: '20 条/页', 50: '50 条/页', 100: '100 条/页' }} placeholder="请选择" />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <SafeProFormSelect name={['ui', 'default_table_density']} label="表格密度" valueEnum={{ default: '默认', middle: '中等', small: '紧凑' }} placeholder="请选择" />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <ProFormSelect
                  name={['ui', 'max_tabs']}
                  label="最大标签页数"
                  options={[
                    { label: '10', value: 10 },
                    { label: '20', value: 20 },
                    { label: '30', value: 30 },
                    { label: '50', value: 50 },
                  ]}
                  placeholder="请选择"
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

