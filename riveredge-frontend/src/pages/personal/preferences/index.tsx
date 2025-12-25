/**
 * 偏好设置页面
 * 
 * 用于用户查看和编辑偏好设置。
 * 支持主题、语言、通知设置、界面设置等。
 */

import React, { useState, useEffect } from 'react';
import { ProForm, ProFormSelect, ProFormSwitch, ProFormInstance, ProFormGroup } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, message } from 'antd';
import {
  getUserPreference,
  updateUserPreference,
  UserPreference,
  UpdateUserPreferenceData,
} from '../../../services/userPreference';
import { getLanguageList, Language } from '../../../services/language';
import { loadUserLanguage, refreshTranslations } from '../../../config/i18n';
import i18n from '../../../config/i18n';

/**
 * 偏好设置页面组件
 */
const UserPreferencesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = React.useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);
  const [preferenceData, setPreferenceData] = useState<UserPreference | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);

  /**
   * 加载偏好设置和语言列表
   */
  useEffect(() => {
    loadLanguages();
    loadPreferences();
  }, []);

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

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const data = await getUserPreference();
      setPreferenceData(data);
      
      // 设置表单值
      const prefs = data.preferences || {};
      formRef.current?.setFieldsValue({
        theme: prefs.theme || 'light',
        language: prefs.language || 'zh-CN',
        email_notification: prefs.notifications?.email !== false,
        sms_notification: prefs.notifications?.sms === true,
        internal_notification: prefs.notifications?.internal !== false,
        push_notification: prefs.notifications?.push !== false,
        layout: prefs.ui_settings?.layout || 'default',
        font_size: prefs.ui_settings?.font_size || 'medium',
        sidebar_collapsed: prefs.ui_settings?.sidebar_collapsed === true,
      });
    } catch (error: any) {
      messageApi.error(error.message || '加载偏好设置失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 构建偏好设置对象
      const preferences: Record<string, any> = {
        theme: values.theme,
        language: values.language,
        notifications: {
          email: values.email_notification,
          sms: values.sms_notification,
          internal: values.internal_notification,
          push: values.push_notification,
        },
        ui_settings: {
          layout: values.layout,
          font_size: values.font_size,
          sidebar_collapsed: values.sidebar_collapsed,
        },
      };
      
      const data: UpdateUserPreferenceData = {
        preferences,
      };
      
      await updateUserPreference(data);
      messageApi.success('偏好设置更新成功');
      
      // 如果语言变更，重新加载用户语言和翻译内容
      if (values.language && values.language !== i18n.language) {
        await loadUserLanguage();
        await refreshTranslations();
      }
      
      // 如果主题变更，通知应用重新加载偏好设置（触发主题更新）
      if (values.theme) {
        // 通过触发 window 事件通知应用组件重新加载偏好设置
        window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
          detail: { preferences: preferences }
        }));
      }
      
      // 重新加载偏好设置
      await loadPreferences();
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      <Card title="偏好设置" loading={loading}>
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: '保存',
            },
          }}
          layout="vertical"
        >
          <ProFormGroup title="主题设置">
            <SafeProFormSelect
              name="theme"
              label="主题"
              valueEnum={{
                light: '亮色',
                dark: '暗色',
                auto: '自动',
              }}
              placeholder="请选择主题"
            />
          </ProFormGroup>
          
          <ProFormGroup title="语言设置">
            <SafeProFormSelect
              name="language"
              label="语言"
              valueEnum={
                languages.length > 0
                  ? languages.reduce((acc, lang) => {
                      acc[lang.code] = lang.native_name || lang.name;
                      return acc;
                    }, {} as Record<string, string>)
                  : {
                      'zh-CN': '简体中文',
                      'en-US': 'English',
                    }
              }
              placeholder="请选择语言"
            />
          </ProFormGroup>
          
          <ProFormGroup title="通知设置">
            <ProFormSwitch
              name="email_notification"
              label="邮件通知"
              fieldProps={{
                checkedChildren: '开启',
                unCheckedChildren: '关闭',
              }}
            />
            <ProFormSwitch
              name="sms_notification"
              label="短信通知"
              fieldProps={{
                checkedChildren: '开启',
                unCheckedChildren: '关闭',
              }}
            />
            <ProFormSwitch
              name="internal_notification"
              label="站内信通知"
              fieldProps={{
                checkedChildren: '开启',
                unCheckedChildren: '关闭',
              }}
            />
            <ProFormSwitch
              name="push_notification"
              label="推送通知"
              fieldProps={{
                checkedChildren: '开启',
                unCheckedChildren: '关闭',
              }}
            />
          </ProFormGroup>
          
          <ProFormGroup title="界面设置">
            <SafeProFormSelect
              name="layout"
              label="布局"
              valueEnum={{
                default: '默认',
                compact: '紧凑',
                wide: '宽屏',
              }}
              placeholder="请选择布局"
            />
            <SafeProFormSelect
              name="font_size"
              label="字体大小"
              valueEnum={{
                small: '小',
                medium: '中',
                large: '大',
              }}
              placeholder="请选择字体大小"
            />
            <ProFormSwitch
              name="sidebar_collapsed"
              label="侧边栏默认收起"
              fieldProps={{
                checkedChildren: '是',
                unCheckedChildren: '否',
              }}
            />
          </ProFormGroup>
        </ProForm>
      </Card>
    </div>
  );
};

export default UserPreferencesPage;

