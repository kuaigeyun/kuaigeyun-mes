/**
 * 主题编辑面板组件
 * 
 * 使用 Ant Design 原生主题配置，支持实时预览和应用
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Form, ColorPicker, Switch, Button, Space, Divider, message, ConfigProvider, Card, Typography, Slider, Tooltip, Popover } from 'antd';
import { SaveOutlined, ReloadOutlined, SunOutlined, MoonOutlined, DesktopOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { getSiteSetting, updateSiteSetting } from '../../services/siteSetting';
import { getUserPreference, updateUserPreference } from '../../services/userPreference';
import { getToken } from '../../utils/auth';

const { Text } = Typography;

/**
 * 主题编辑面板组件属性
 */
interface ThemeEditorProps {
  /** 是否显示面板 */
  open: boolean;
  /** 关闭面板回调 */
  onClose: () => void;
  /** 主题配置更新回调 */
  onThemeUpdate?: (themeConfig: any) => void;
}

/**
 * 主题编辑面板组件
 */
const ThemeEditor: React.FC<ThemeEditorProps> = ({ open, onClose, onThemeUpdate }) => {
  const { token } = theme.useToken(); // 获取当前实际使用的主题 token
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<{
    algorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm | typeof theme.compactAlgorithm | Array<typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm | typeof theme.compactAlgorithm>;
    token: {
      colorPrimary?: string;
      borderRadius?: number;
      fontSize?: number;
    };
  } | null>(null);
  const [colorMode, setColorMode] = useState<'light' | 'dark' | 'auto'>('light');
  const [tabsPersistenceValue, setTabsPersistenceValue] = useState<boolean>(false);
  const [compactValue, setCompactValue] = useState<boolean>(false); // 颜色模式：浅色/深色/跟随系统

  /**
   * B端主流配色最佳实践 - 统一预设颜色配置
   * 
   * 设计原则：
   * 1. 主题色：使用专业、稳重的蓝色系为主，辅以其他常用品牌色
   * 2. 背景色：浅色系（适合浅色模式）和深色系（适合深色模式）分别提供
   * 3. 统一性：所有背景色预设保持一致，便于用户统一配置
   */

  // 预设主题颜色（B端主流配色）
  const presetColors = [
    { color: '#1890ff', label: '经典蓝' },      // Ant Design 默认蓝
    { color: '#1677ff', label: '现代蓝' },      // Ant Design 5.x 新蓝
    { color: '#0958d9', label: '深蓝' },        // 深蓝色
    { color: '#13c2c2', label: '青蓝' },        // 青色系
    { color: '#52c41a', label: '绿色' },        // 成功色
    { color: '#722ed1', label: '紫色' },        // 紫色系
    { color: '#eb2f96', label: '粉色' },        // 粉色系
    { color: '#fa8c16', label: '橙色' },        // 警告色
    { color: '#f5222d', label: '红色' },        // 错误色
  ];

  /**
   * 计算颜色的亮度值（用于排序）
   * @param color - 颜色值（十六进制格式）
   * @returns 亮度值（0-255）
   */
  const calculateColorBrightness = (color: string): number => {
    if (!color || typeof color !== 'string' || !color.startsWith('#')) return 255;
    const hex = color.slice(1);
    const fullHex = hex.length === 3
      ? hex.split('').map(c => c + c).join('')
      : hex;
    const r = parseInt(fullHex.slice(0, 2), 16);
    const g = parseInt(fullHex.slice(2, 4), 16);
    const b = parseInt(fullHex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  // 左侧菜单栏和顶栏的预设颜色（3个浅色 + 3个深色，按颜色深度排序）
  // 浅色按从浅到深排序（亮度从高到低）
  // 深色按从深到浅排序（亮度从低到高）
  const presetSiderAndHeaderColors = [
    // 浅色系（3个）
    { color: '#ffffff', label: '纯白', category: 'light' },
    { color: '#fafafa', label: '浅灰', category: 'light' },
    { color: '#f5f5f5', label: '灰白', category: 'light' },
    // 深色系（3个）
    { color: '#001529', label: '深蓝', category: 'dark' },
    { color: '#141414', label: '深黑', category: 'dark' },
    { color: '#1f1f1f', label: '深灰', category: 'dark' },
  ]
    .map(item => ({
      ...item,
      brightness: calculateColorBrightness(item.color)
    }))
    .sort((a, b) => {
      // 浅色按从浅到深排序（亮度从高到低）
      if (a.category === 'light' && b.category === 'light') {
        return b.brightness - a.brightness;
      }
      // 深色按从深到浅排序（亮度从低到高）
      if (a.category === 'dark' && b.category === 'dark') {
        return a.brightness - b.brightness;
      }
      // 浅色在前，深色在后
      if (a.category === 'light' && b.category === 'dark') return -1;
      if (a.category === 'dark' && b.category === 'light') return 1;
      return 0;
    });

  // 标签栏的预设颜色（6个浅色，按颜色深度排序，从浅到深）
  const presetTabsColors = [
    { color: '#ffffff', label: '纯白', category: 'light' },
    { color: '#fafafa', label: '浅灰', category: 'light' },
    { color: '#f5f5f5', label: '灰白', category: 'light' },
    { color: '#f0f0f0', label: '中灰', category: 'light' },
    { color: '#fafbfc', label: '蓝灰', category: 'light' },
    { color: '#f0f2f5', label: '浅蓝灰', category: 'light' },
  ]
    .map(item => ({
      ...item,
      brightness: calculateColorBrightness(item.color)
    }))
    .sort((a, b) => b.brightness - a.brightness); // 按从浅到深排序（亮度从高到低）

  // 使用 useState 管理表单值变化（避免在 Form 外部使用 Form.useWatch）
  const [colorPrimaryValue, setColorPrimaryValue] = useState<string>('#1890ff');
  const [siderBgColorValue, setSiderBgColorValue] = useState<string>('');
  const [headerBgColorValue, setHeaderBgColorValue] = useState<string>('');
  const [tabsBgColorValue, setTabsBgColorValue] = useState<string>('');

  /**
   * 规范化颜色值为字符串格式（用于 ColorPicker 的 value 属性）
   */
  const normalizeColorValue = (color: any, defaultValue: string = '#1890ff'): string => {
    if (!color) return defaultValue;
    if (typeof color === 'string') return color;

    // 处理颜色对象：优先使用 toHexString 方法
    if (color && typeof color.toHexString === 'function') {
      try {
        return color.toHexString();
      } catch (e) {
        console.warn('Color toHexString failed:', e);
      }
    }

    // 处理包含 metaColor 的颜色对象
    if (color && color.metaColor) {
      if (typeof color.metaColor.toHexString === 'function') {
        try {
          return color.metaColor.toHexString();
        } catch (e) {
          console.warn('Color metaColor toHexString failed:', e);
        }
      }
      // 如果 metaColor 有 r, g, b 属性，手动转换为 hex
      if (typeof color.metaColor.r === 'number' && typeof color.metaColor.g === 'number' && typeof color.metaColor.b === 'number') {
        const r = Math.round(color.metaColor.r).toString(16).padStart(2, '0');
        const g = Math.round(color.metaColor.g).toString(16).padStart(2, '0');
        const b = Math.round(color.metaColor.b).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }

    return defaultValue;
  };

  // 规范化后的颜色值（使用 useMemo 确保始终是字符串）
  const normalizedColorPrimary = useMemo(() => {
    const normalized = normalizeColorValue(colorPrimaryValue, token.colorPrimary || '#1890ff');
    // 确保返回值是有效的字符串，避免传递 undefined 或 null
    return normalized || token.colorPrimary || '#1890ff';
  }, [colorPrimaryValue, token.colorPrimary]);

  const normalizedSiderBgColor = useMemo(() => {
    const normalized = normalizeColorValue(siderBgColorValue, '');
    // 确保返回值是有效的字符串，避免传递 undefined 或 null
    return normalized || '';
  }, [siderBgColorValue]);

  // 规范化顶栏和标签栏背景色（统一使用 hex，含透明度时为 8 位 hex #RRGGBBAA）
  const normalizeBackgroundColor = (color: any, defaultValue: string = ''): string => {
    if (!color) return defaultValue;
    if (typeof color === 'string') return color;
    if (color && typeof color.toHexString === 'function') {
      try {
        return color.toHexString();
      } catch (e) {
        console.warn('Color toHexString failed:', e);
      }
    }
    if (color && typeof color.toRgbString === 'function') {
      try {
        return color.toRgbString();
      } catch (e) {
        console.warn('Color toRgbString failed:', e);
      }
    }
    return defaultValue;
  };

  const normalizedHeaderBgColor = useMemo(() => {
    return normalizeBackgroundColor(headerBgColorValue, '') || '';
  }, [headerBgColorValue]);

  const normalizedTabsBgColor = useMemo(() => {
    return normalizeBackgroundColor(tabsBgColorValue, '') || '';
  }, [tabsBgColorValue]);

  /**
   * 带提示按钮的标题组件
   */
  interface TitleWithHintProps {
    /** 标题文本 */
    title: string;
    /** 提示内容 */
    hint?: React.ReactNode;
  }

  const TitleWithHint: React.FC<TitleWithHintProps> = ({ title, hint }) => {
    if (!hint) {
      return <span>{title}</span>;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{title}</span>
        <Popover
          content={
            <div style={{
              fontSize: 12,
              color: token.colorTextSecondary,
              lineHeight: 1.6,
              maxWidth: 300
            }}>
              {hint}
            </div>
          }
          title={null}
          trigger="click"
          placement="topLeft"
          overlayStyle={{ maxWidth: 320 }}
        >
          <Button
            type="text"
            size="small"
            icon={<QuestionCircleOutlined style={{ fontSize: 14 }} />}
            style={{
              padding: '2px 4px',
              height: 20,
              width: 20,
              minWidth: 20,
              color: token.colorTextTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </Popover>
      </div>
    );
  };


  /**
   * 加载站点主题配置和用户偏好设置
   */
  const loadTheme = async () => {
    try {
      setLoading(true);

      // 并行加载站点主题配置和用户偏好设置
      const [siteSetting, userPreference] = await Promise.all([
        getSiteSetting().catch(() => null),
        getUserPreference().catch(() => null),
      ]);

      const themeConfig = siteSetting?.settings?.theme_config || {};
      const legacyThemeColor = siteSetting?.settings?.theme_color;

      // 获取用户颜色模式偏好（浅色/深色/跟随系统）
      const userThemeMode = userPreference?.preferences?.theme || 'light';
      setColorMode(userThemeMode);

      // 设置表单初始值
      // 优先使用后端保存的颜色，如果没有则使用当前实际使用的主题颜色
      let colorPrimaryValue = legacyThemeColor || themeConfig.colorPrimary;

      // 如果后端没有保存颜色，使用当前实际使用的主题颜色
      if (!colorPrimaryValue) {
        colorPrimaryValue = token.colorPrimary || '#1890ff';
      }

      // 确保 colorPrimary 是字符串格式
      if (typeof colorPrimaryValue !== 'string') {
        // 如果是对象，尝试转换为字符串
        if (colorPrimaryValue && typeof colorPrimaryValue.toHexString === 'function') {
          colorPrimaryValue = colorPrimaryValue.toHexString();
        } else {
          colorPrimaryValue = token.colorPrimary || '#1890ff';
        }
      }

      // 获取当前实际使用的其他主题值（如果没有保存的配置）
      const currentBorderRadius = themeConfig.borderRadius ?? token.borderRadius ?? 6;
      const currentFontSize = themeConfig.fontSize ?? token.fontSize ?? 14;

      // 读取标签栏持久化配置：优先从本地存储读取，其次从用户偏好设置读取，默认关闭
      let tabsPersistence = false;

      // 优先从本地存储读取
      const localTabsPersistence = localStorage.getItem('riveredge_tabs_persistence');
      if (localTabsPersistence !== null) {
        tabsPersistence = localTabsPersistence === 'true';
      } else if (userPreference?.preferences && 'tabs_persistence' in userPreference.preferences) {
        // 如果本地存储没有，从用户偏好设置读取
        tabsPersistence = Boolean(userPreference.preferences.tabs_persistence);
        // 同步到本地存储
        localStorage.setItem('riveredge_tabs_persistence', String(tabsPersistence));
      }


      // 设置表单初始值
      const formValues = {
        colorPrimary: colorPrimaryValue,
        borderRadius: currentBorderRadius,
        fontSize: currentFontSize,
        compact: themeConfig.compact || false,
        siderBgColor: themeConfig.siderBgColor || '',
        headerBgColor: themeConfig.headerBgColor || '',
        tabsBgColor: themeConfig.tabsBgColor || '',
        colorMode: userThemeMode,
        tabsPersistence: tabsPersistence,
        layoutMode: 'mix', // 固定使用 MIX 布局模式
      };

      form.setFieldsValue(formValues);

      // 初始化状态变量
      setColorPrimaryValue(colorPrimaryValue);
      setSiderBgColorValue(themeConfig.siderBgColor || '');
      setHeaderBgColorValue(themeConfig.headerBgColor || '');
      setTabsBgColorValue(themeConfig.tabsBgColor || '');
      setTabsPersistenceValue(tabsPersistence);
      setCompactValue(themeConfig.compact || false);

      // 应用预览主题
      applyPreviewTheme(form.getFieldsValue(), userThemeMode);
    } catch (error: any) {
      message.error(error?.message || '加载主题配置失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 应用预览主题
   */
  const applyPreviewTheme = (values: any, mode?: 'light' | 'dark' | 'auto') => {
    // 确定颜色模式算法
    const colorModeValue = mode || values.colorMode || colorMode;
    let baseAlgorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm = theme.defaultAlgorithm;

    if (colorModeValue === 'dark') {
      baseAlgorithm = theme.darkAlgorithm;
    } else if (colorModeValue === 'auto') {
      // 跟随系统：根据系统偏好决定
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      baseAlgorithm = prefersDark ? theme.darkAlgorithm : theme.defaultAlgorithm;
    } else {
      baseAlgorithm = theme.defaultAlgorithm;
    }

    // 如果启用了紧凑模式，组合紧凑算法
    const algorithm = values.compact
      ? [baseAlgorithm, theme.compactAlgorithm]
      : baseAlgorithm;

    const token = {
      colorPrimary: values.colorPrimary || '#1890ff',
      borderRadius: values.borderRadius || 6,
      fontSize: values.fontSize || 14,
    };

    setPreviewTheme({ algorithm, token });
  };

  /**
   * 处理表单值变化（实时预览）
   */
  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.tabsPersistence !== undefined) {
      setTabsPersistenceValue(changedValues.tabsPersistence);
    }
    if (changedValues.compact !== undefined) {
      setCompactValue(changedValues.compact);
    }
    // 确保 colorPrimary 是字符串格式
    if (changedValues.colorPrimary) {
      const colorValue = typeof changedValues.colorPrimary === 'string'
        ? changedValues.colorPrimary
        : changedValues.colorPrimary.toHexString?.() || '#1890ff';
      allValues.colorPrimary = colorValue;
      setColorPrimaryValue(colorValue);
    }

    // 如果 siderBgColor 改变，更新状态
    if (changedValues.siderBgColor !== undefined) {
      const siderBgValue = typeof changedValues.siderBgColor === 'string'
        ? changedValues.siderBgColor
        : changedValues.siderBgColor?.toHexString?.() || '';
      allValues.siderBgColor = siderBgValue;
      setSiderBgColorValue(siderBgValue);
    }

    // 如果 headerBgColor 改变，更新状态（支持 rgba 格式的透明度）
    if (changedValues.headerBgColor !== undefined) {
      const headerBgValue = normalizeBackgroundColor(changedValues.headerBgColor, '');
      allValues.headerBgColor = headerBgValue;
      setHeaderBgColorValue(headerBgValue);
    }

    // 如果 tabsBgColor 改变，更新状态（支持 rgba 格式的透明度）
    if (changedValues.tabsBgColor !== undefined) {
      const tabsBgValue = normalizeBackgroundColor(changedValues.tabsBgColor, '');
      allValues.tabsBgColor = tabsBgValue;
      setTabsBgColorValue(tabsBgValue);
    }

    // 如果颜色模式改变，更新状态
    if (changedValues.colorMode) {
      setColorMode(changedValues.colorMode);
    }

    // 布局模式固定为 'mix'，不需要处理

    applyPreviewTheme(allValues, allValues.colorMode);
  };

  /**
   * 处理颜色模式切换（立即保存）
   */
  const handleColorModeChange = async (mode: 'light' | 'dark' | 'auto') => {
    try {
      // 更新表单值
      form.setFieldValue('colorMode', mode);
      setColorMode(mode);

      // 立即应用预览
      applyPreviewTheme(form.getFieldsValue(), mode);

      // 立即保存用户颜色模式偏好
      const preferences: Record<string, any> = {
        theme: mode,
      };
      await updateUserPreference({ preferences });

      // 触发用户偏好更新事件
      window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
        detail: { preferences }
      }));

      message.success('颜色模式已切换');
    } catch (error: any) {
      message.error(error?.message || '切换失败');
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    try {
      setSaving(true);

      // 获取表单的最终值（用户选择的结果）
      const values = await form.validateFields();


      // 重要：在 validateFields 之后，直接从表单获取当前值
      // 因为 Switch 组件的值可能在 validateFields 时丢失
      const tabsPersistenceValue = Boolean(form.getFieldValue('tabsPersistence'));


      // 构建站点主题配置对象（使用 Ant Design 原生配置格式）
      // 确保 colorPrimary 是字符串格式
      let colorPrimaryValue = values.colorPrimary || '#1890ff';
      if (typeof colorPrimaryValue !== 'string') {
        if (colorPrimaryValue && typeof colorPrimaryValue.toHexString === 'function') {
          colorPrimaryValue = colorPrimaryValue.toHexString();
        } else {
          colorPrimaryValue = '#1890ff';
        }
      }

      // 确保 siderBgColor 是字符串格式（如果存在）
      let siderBgColorValue = values.siderBgColor || '';
      if (siderBgColorValue && typeof siderBgColorValue !== 'string') {
        if (siderBgColorValue && typeof siderBgColorValue.toHexString === 'function') {
          siderBgColorValue = siderBgColorValue.toHexString();
        } else {
          siderBgColorValue = '';
        }
      }

      // 确保 headerBgColor 是字符串格式（支持 rgba 格式的透明度）
      let headerBgColorValue = normalizeBackgroundColor(values.headerBgColor, '') || '';

      // 确保 tabsBgColor 是字符串格式（支持 rgba 格式的透明度）
      let tabsBgColorValue = normalizeBackgroundColor(values.tabsBgColor, '') || '';

      // 使用用户最终选择的颜色值
      const themeConfig: any = {
        colorPrimary: colorPrimaryValue,
        borderRadius: values.borderRadius || 6,
        fontSize: values.fontSize || 14,
        compact: values.compact || false,
        layoutMode: 'mix', // 固定使用 MIX 布局模式
        theme: values.colorMode, // 保存当前颜色模式，用于 App.tsx 同步加载
      };


      // 保存左侧菜单栏背景色（仅在浅色模式下保存，包括空字符串，用于清除自定义背景色）
      if (values.colorMode === 'light' || (!values.colorMode && colorMode === 'light')) {
        if (siderBgColorValue) {
          themeConfig.siderBgColor = siderBgColorValue;
        } else {
          // 如果为空，也保存空字符串，表示使用默认背景色
          themeConfig.siderBgColor = '';
        }
      } else {
        // 深色模式下，不保存自定义背景色（使用深色模式的默认背景色）
        themeConfig.siderBgColor = '';
      }

      // 保存顶栏背景色（浅色和深色模式都支持，支持透明度）
      if (headerBgColorValue) {
        themeConfig.headerBgColor = headerBgColorValue;
      } else {
        // 如果为空，也保存空字符串，表示使用默认背景色
        themeConfig.headerBgColor = '';
      }

      // 保存标签栏背景色（浅色和深色模式都支持，支持透明度）
      if (tabsBgColorValue) {
        themeConfig.tabsBgColor = tabsBgColorValue;
      } else {
        // 如果为空，也保存空字符串，表示使用默认背景色
        themeConfig.tabsBgColor = '';
      }

      // 保存标签栏持久化配置
      // 如果用户已登录，保存到用户偏好设置；否则保存到本地存储
      const hasToken = !!getToken();

      if (hasToken) {
        // 用户已登录，保存到用户偏好设置
        // 需要先获取现有的用户偏好设置，然后合并更新
        try {
          const currentPreference = await getUserPreference().catch(() => null);
          const currentPreferences = currentPreference?.preferences || {};

          // 合并更新：保留现有的偏好设置，只更新标签栏持久化和颜色模式
          const updatedPreferences: Record<string, any> = {
            ...currentPreferences,
            tabs_persistence: tabsPersistenceValue,
          };

          // 添加颜色模式配置（如果存在）
          if (values.colorMode) {
            updatedPreferences.theme = values.colorMode;
          }

          await updateUserPreference({ preferences: updatedPreferences });

          // 立即保存到本地存储（必须在保存到后端之后，确保值正确）
          // 这是最重要的，因为读取时优先从本地存储读取
          localStorage.setItem('riveredge_tabs_persistence', String(tabsPersistenceValue));
          // 触发用户偏好更新事件，通知 UniTabs 组件更新配置
          window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
            detail: { preferences: updatedPreferences }
          }));
        } catch (error: any) {
          // 如果保存失败，降级到本地存储
          localStorage.setItem('riveredge_tabs_persistence', String(tabsPersistenceValue));

          // 即使保存失败，也触发事件通知组件更新（使用本地存储的值）
          window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
            detail: { preferences: { tabs_persistence: tabsPersistenceValue } }
          }));
        }
      } else {
        // 用户未登录，保存到本地存储
        localStorage.setItem('riveredge_tabs_persistence', String(tabsPersistenceValue));

        // 触发事件通知组件更新（使用本地存储的值）
        window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
          detail: { preferences: { tabs_persistence: tabsPersistenceValue } }
        }));
      }

      // 无论登录与否，都保存到本地存储作为兜底方案
      // 重要：这确保了即使 API 失败（如平台管理员无租户上下文），主题也能在本地生效
      const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';
      localStorage.setItem(THEME_CONFIG_STORAGE_KEY, JSON.stringify(themeConfig));
      localStorage.setItem('riveredge_tabs_persistence', String(tabsPersistenceValue));

      // 保存站点主题配置
      const settings: Record<string, any> = {
        theme_config: themeConfig,
      };

      try {
        await updateSiteSetting({ settings });
      } catch (error) {
        // 站点设置保存失败（如无权限或无租户上下文），仅记录日志，不阻断流程
        console.warn('Failed to save site theme settings:', error);
      }

      message.success('主题配置已应用');

      // 先触发站点主题更新事件，传递用户最终选择的配置（优先应用）
      window.dispatchEvent(new CustomEvent('siteThemeUpdated', {
        detail: { themeConfig } // 传递完整配置
      }));

      // 调用回调
      if (onThemeUpdate) {
        onThemeUpdate(themeConfig);
      }

      // 关闭面板
      onClose();
    } catch (error: any) {
      console.error('Theme save error:', error);
      message.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 处理重置
   */
  const handleReset = async () => {
    try {
      setLoading(true);

      // 1. 设置默认值
      const defaultThemeConfig = {
        colorPrimary: '#1890ff',
        borderRadius: 6,
        fontSize: 14,
        compact: false,
        siderBgColor: '',
        headerBgColor: '',
        tabsBgColor: '',
      };

      // 2. 更新本地表单和状态
      setTabsPersistenceValue(false);
      setCompactValue(false);
      setColorMode('light');
      setColorPrimaryValue('#1890ff');
      setSiderBgColorValue('');
      setHeaderBgColorValue('');
      setTabsBgColorValue('');

      form.setFieldsValue({
        ...defaultThemeConfig,
        colorMode: 'light',
        tabsPersistence: false,
        layoutMode: 'mix',
      });

      // 3. 清除相关本地存储
      const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';
      localStorage.removeItem(THEME_CONFIG_STORAGE_KEY);
      localStorage.removeItem('riveredge_tabs_persistence');
      localStorage.removeItem('riveredge_saved_tabs');
      localStorage.removeItem('riveredge_saved_active_key');

      // 4. 更新服务器配置（如果已登录）
      const token = getToken();
      if (token) {
        // 等待更新完成，确保后续同步获取的是新配置
        await Promise.all([
          updateUserPreference({
            preferences: {
              theme: 'light',
              tabs_persistence: false,
            }
          }).catch(err => console.warn('Failed to reset user preferences:', err)),
          updateSiteSetting({
            settings: {
              theme_config: defaultThemeConfig
            }
          }).catch(err => console.warn('Failed to reset site settings:', err))
        ]);
      }

      // 5. 触发全局事件通知应用更新
      // 通知用户偏好更新（包含主题和标签持久化）
      window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
        detail: {
          preferences: {
            theme: 'light',
            tabs_persistence: false
          }
        }
      }));

      // 通知站点主体更新
      window.dispatchEvent(new CustomEvent('siteThemeUpdated', {
        detail: { themeConfig: defaultThemeConfig }
      }));

      // 6. 应用本地预览
      applyPreviewTheme(defaultThemeConfig, 'light');

      message.success('已恢复默认配置并关闭面板');

      // 7. 关闭面板（根据用户需求：点击恢复默认后关闭抽屉）
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Reset failed:', error);
      message.error('恢复默认配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 当面板打开时加载主题配置
  useEffect(() => {
    if (open) {
      loadTheme();
    }
  }, [open]);

  return (
    <Drawer
      className="theme-editor-drawer"
      bodyStyle={{ overflowY: 'scroll' }}
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>个性化主题</div>
          <Text type="secondary" style={{ fontSize: 12 }}>自定义您的界面外观，让工作更舒适</Text>
        </div>
      }
      open={open}
      onClose={onClose}
      closable={false}
      size={520}
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            loading={loading}
          >
            恢复默认
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存设置
          </Button>
        </Space>
      }
    >
      <style>{`
        .theme-editor-drawer .ant-card {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
      `}</style>
      {open && form && (
        <>
          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleValuesChange}
            initialValues={{
              colorPrimary: '#1890ff',
              borderRadius: 6,
              fontSize: 14,
              compact: false,
              colorMode: 'light',
              layoutMode: 'mix',
            }}
          >
            {/* 颜色模式 */}
            <Card
              size="small"
              style={{ marginBottom: 16 }}
              bodyStyle={{ padding: '16px' }}
            >
              <Form.Item
                name="colorMode"
                style={{ marginBottom: 0 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {/* 浅色模式 */}
                  <div
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: '16px',
                      borderRadius: 8,
                      transition: 'all 0.2s',
                      backgroundColor: form.getFieldValue('colorMode') === 'light'
                        ? `${token.colorPrimary || '#1890ff'}15`
                        : 'transparent',
                    }}
                    onClick={() => {
                      handleColorModeChange('light');
                    }}
                    onMouseEnter={(e) => {
                      if (form.getFieldValue('colorMode') !== 'light') {
                        // 深色模式下使用更深的背景色
                        const isDark = colorMode === 'dark' || (colorMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (form.getFieldValue('colorMode') !== 'light') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <SunOutlined
                      style={{
                        fontSize: 32,
                        color: form.getFieldValue('colorMode') === 'light'
                          ? token.colorPrimary || '#1890ff'
                          : '#8c8c8c',
                        marginBottom: 8,
                        display: 'block',
                      }}
                    />
                    <div style={{ fontWeight: 500, fontSize: 14 }}>浅色模式</div>
                  </div>

                  {/* 深色模式 */}
                  <div
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: '16px',
                      borderRadius: 8,
                      transition: 'all 0.2s',
                      backgroundColor: form.getFieldValue('colorMode') === 'dark'
                        ? `${token.colorPrimary || '#1890ff'}15`
                        : 'transparent',
                    }}
                    onClick={() => {
                      handleColorModeChange('dark');
                    }}
                    onMouseEnter={(e) => {
                      if (form.getFieldValue('colorMode') !== 'dark') {
                        // 深色模式下使用更深的背景色
                        const isDark = colorMode === 'dark' || (colorMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (form.getFieldValue('colorMode') !== 'dark') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <MoonOutlined
                      style={{
                        fontSize: 32,
                        color: form.getFieldValue('colorMode') === 'dark'
                          ? token.colorPrimary || '#1890ff'
                          : '#8c8c8c',
                        marginBottom: 8,
                        display: 'block',
                      }}
                    />
                    <div style={{ fontWeight: 500, fontSize: 14 }}>深色模式</div>
                  </div>

                  {/* 跟随系统 */}
                  <div
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: '16px',
                      borderRadius: 8,
                      transition: 'all 0.2s',
                      backgroundColor: form.getFieldValue('colorMode') === 'auto'
                        ? `${token.colorPrimary || '#1890ff'}15`
                        : 'transparent',
                    }}
                    onClick={() => {
                      handleColorModeChange('auto');
                    }}
                    onMouseEnter={(e) => {
                      if (form.getFieldValue('colorMode') !== 'auto') {
                        // 深色模式下使用更深的背景色
                        const isDark = colorMode === 'dark' || (colorMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (form.getFieldValue('colorMode') !== 'auto') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <DesktopOutlined
                      style={{
                        fontSize: 32,
                        color: form.getFieldValue('colorMode') === 'auto'
                          ? token.colorPrimary || '#1890ff'
                          : '#8c8c8c',
                        marginBottom: 8,
                        display: 'block',
                      }}
                    />
                    <div style={{ fontWeight: 500, fontSize: 14 }}>跟随系统</div>
                  </div>
                </div>
              </Form.Item>
            </Card>

            {/* 主题颜色 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title="主题颜色"
                  hint="选择您喜欢的主题颜色，这将应用于按钮、链接和选中状态等界面元素"
                />
              }
              style={{ marginBottom: 16 }}
              bodyStyle={{ padding: '16px' }}
            >
              {/* 预设颜色 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>快速选择</div>
                <Space wrap>
                  {presetColors.map((preset, index) => (
                    <Tooltip key={index} title={preset.label || preset.color} placement="top">
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: preset.color,
                          border: form.getFieldValue('colorPrimary') === preset.color
                            ? `2px solid ${preset.color}`
                            : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: form.getFieldValue('colorPrimary') === preset.color
                            ? `0 0 0 2px ${preset.color}40`
                            : 'none',
                        }}
                        onClick={() => {
                          form.setFieldValue('colorPrimary', preset.color);
                        }}
                        onMouseEnter={(e) => {
                          if (form.getFieldValue('colorPrimary') !== preset.color) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = `0 0 0 2px ${preset.color}40`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (form.getFieldValue('colorPrimary') !== preset.color) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </Tooltip>
                  ))}
                </Space>
              </div>

              {/* 自定义颜色 */}
              <Form.Item
                name="colorPrimary"
                label="自定义颜色"
                getValueFromEvent={(color) => {
                  return normalizeColorValue(color, '#1890ff');
                }}
                normalize={(value) => {
                  return normalizeColorValue(value, '#1890ff');
                }}
              >
                <ColorPicker
                  showText
                  format="hex"
                  value={normalizedColorPrimary}
                  onChange={(color) => {
                    const colorValue = normalizeColorValue(color, token.colorPrimary || '#1890ff');
                    form.setFieldValue('colorPrimary', colorValue);
                  }}
                />
              </Form.Item>
            </Card>

            {/* 左侧菜单栏设置（仅浅色模式支持自定义背景色） */}
            {(form.getFieldValue('colorMode') === 'light' || (!form.getFieldValue('colorMode') && colorMode === 'light')) && (
              <Card
                size="small"
                title={
                  <TitleWithHint
                    title="左侧菜单栏"
                    hint="自定义左侧菜单栏的背景颜色"
                  />
                }
                style={{ marginBottom: 16 }}
                bodyStyle={{ padding: '16px' }}
              >
                {/* 重要提示：仅在浅色模式下生效 - 直接展示 */}
                <div style={{
                  marginBottom: 12,
                  padding: '6px 10px',
                  backgroundColor: token.colorWarningBg || '#fff7e6',
                  borderRadius: 6,
                  fontSize: 12,
                  color: token.colorWarning || '#fa8c16',
                  border: `1px solid ${token.colorWarningBorder || '#ffe7ba'}`
                }}>
                  <Text type="warning" style={{ fontSize: 12 }}>
                    提示：仅在浅色模式下生效
                  </Text>
                </div>
                {/* 预设颜色 - 左侧菜单栏使用3个浅色+3个深色预设（按深度排序） */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>快速选择</div>
                  <Space wrap>
                    {presetSiderAndHeaderColors
                      .map((preset, index) => (
                        <Tooltip key={index} title={preset.label || preset.color} placement="top">
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: preset.color,
                              border: form.getFieldValue('siderBgColor') === preset.color
                                ? `2px solid ${preset.color}`
                                : '2px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: form.getFieldValue('siderBgColor') === preset.color
                                ? `0 0 0 2px ${preset.color}40`
                                : 'none',
                              position: 'relative',
                            }}
                            onClick={() => {
                              form.setFieldValue('siderBgColor', preset.color);
                            }}
                            onMouseEnter={(e) => {
                              if (form.getFieldValue('siderBgColor') !== preset.color) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${preset.color}40`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (form.getFieldValue('siderBgColor') !== preset.color) {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                              }
                            }}
                          />
                        </Tooltip>
                      ))}
                  </Space>
                </div>

                {/* 自定义颜色 */}
                <Form.Item
                  name="siderBgColor"
                  label="自定义颜色"
                  getValueFromEvent={(color) => {
                    if (!color) return '';
                    if (typeof color === 'string') return color;
                    // 处理颜色对象：优先使用 toHexString 方法
                    if (color && typeof color.toHexString === 'function') {
                      try {
                        return color.toHexString();
                      } catch (e) {
                        console.warn('Color toHexString failed:', e);
                      }
                    }
                    // 处理包含 metaColor 的颜色对象
                    if (color && color.metaColor) {
                      if (typeof color.metaColor.toHexString === 'function') {
                        try {
                          return color.metaColor.toHexString();
                        } catch (e) {
                          console.warn('Color metaColor toHexString failed:', e);
                        }
                      }
                      // 如果 metaColor 有 r, g, b 属性，手动转换为 hex
                      if (typeof color.metaColor.r === 'number' && typeof color.metaColor.g === 'number' && typeof color.metaColor.b === 'number') {
                        const r = Math.round(color.metaColor.r).toString(16).padStart(2, '0');
                        const g = Math.round(color.metaColor.g).toString(16).padStart(2, '0');
                        const b = Math.round(color.metaColor.b).toString(16).padStart(2, '0');
                        return `#${r}${g}${b}`;
                      }
                    }
                    return '';
                  }}
                  normalize={(value) => {
                    if (!value) return '';
                    if (typeof value === 'string') return value;
                    // 处理颜色对象：优先使用 toHexString 方法
                    if (value && typeof value.toHexString === 'function') {
                      try {
                        return value.toHexString();
                      } catch (e) {
                        console.warn('Color toHexString failed:', e);
                      }
                    }
                    // 处理包含 metaColor 的颜色对象
                    if (value && value.metaColor) {
                      if (typeof value.metaColor.toHexString === 'function') {
                        try {
                          return value.metaColor.toHexString();
                        } catch (e) {
                          console.warn('Color metaColor toHexString failed:', e);
                        }
                      }
                      // 如果 metaColor 有 r, g, b 属性，手动转换为 hex
                      if (typeof value.metaColor.r === 'number' && typeof value.metaColor.g === 'number' && typeof value.metaColor.b === 'number') {
                        const r = Math.round(value.metaColor.r).toString(16).padStart(2, '0');
                        const g = Math.round(value.metaColor.g).toString(16).padStart(2, '0');
                        const b = Math.round(value.metaColor.b).toString(16).padStart(2, '0');
                        return `#${r}${g}${b}`;
                      }
                    }
                    return '';
                  }}
                >
                  <ColorPicker
                    showText
                    format="hex"
                    value={normalizedSiderBgColor}
                    onChange={(color) => {
                      // 处理清除按钮点击（color 为 null 或 undefined）
                      if (!color || color === null) {
                        form.setFieldValue('siderBgColor', '');
                        return;
                      }
                      const colorValue = normalizeColorValue(color, '');
                      form.setFieldValue('siderBgColor', colorValue);
                    }}
                    allowClear
                  />
                </Form.Item>
              </Card>
            )}

            {/* 顶栏设置（仅浅色模式支持自定义背景色） */}
            {(form.getFieldValue('colorMode') === 'light' || (!form.getFieldValue('colorMode') && colorMode === 'light')) && (
              <Card
                size="small"
                title={
                  <TitleWithHint
                    title="顶栏背景色"
                    hint="自定义顶栏的背景颜色，使用 hex 格式（如：#ffffff，带透明度为 8 位 #rrggbbaa）"
                  />
                }
                style={{ marginBottom: 16 }}
                bodyStyle={{ padding: '16px' }}
              >
                {/* 重要提示：仅在浅色模式下生效 - 直接展示 */}
                <div style={{
                  marginBottom: 12,
                  padding: '6px 10px',
                  backgroundColor: token.colorWarningBg || '#fff7e6',
                  borderRadius: 6,
                  fontSize: 12,
                  color: token.colorWarning || '#fa8c16',
                  border: `1px solid ${token.colorWarningBorder || '#ffe7ba'}`
                }}>
                  <Text type="warning" style={{ fontSize: 12 }}>
                    提示：仅在浅色模式下生效
                  </Text>
                </div>

                {/* 预设颜色 - 顶栏使用3个浅色+3个深色预设（按深度排序） */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>快速选择</div>
                  <Space wrap>
                    {presetSiderAndHeaderColors
                      .map((preset, index) => (
                        <Tooltip key={index} title={preset.label || preset.color} placement="top">
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: preset.color,
                              border: form.getFieldValue('headerBgColor') === preset.color
                                ? `2px solid ${preset.color}`
                                : '2px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: form.getFieldValue('headerBgColor') === preset.color
                                ? `0 0 0 2px ${preset.color}40`
                                : 'none',
                              position: 'relative',
                            }}
                            onClick={() => {
                              form.setFieldValue('headerBgColor', preset.color);
                            }}
                            onMouseEnter={(e) => {
                              if (form.getFieldValue('headerBgColor') !== preset.color) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${preset.color}40`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (form.getFieldValue('headerBgColor') !== preset.color) {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                              }
                            }}
                          />
                        </Tooltip>
                      ))}
                  </Space>
                </div>

                {/* 自定义颜色 */}
                <Form.Item
                  name="headerBgColor"
                  label="自定义颜色"
                  getValueFromEvent={(color) => {
                    if (!color) return '';
                    if (typeof color === 'string') return color;
                    if (color && typeof color.toHexString === 'function') {
                      try {
                        return color.toHexString();
                      } catch (e) {
                        console.warn('Color toHexString failed:', e);
                      }
                    }
                    return '';
                  }}
                >
                  <ColorPicker
                    showText
                    format="hex"
                    value={normalizedHeaderBgColor || undefined}
                    onChange={(color) => {
                      if (!color || color === null) {
                        form.setFieldValue('headerBgColor', '');
                        return;
                      }
                      const colorValue = normalizeBackgroundColor(color, '');
                      form.setFieldValue('headerBgColor', colorValue);
                    }}
                    allowClear
                  />
                </Form.Item>
              </Card>
            )}

            {/* 标签栏设置（仅浅色模式支持自定义背景色） */}
            {(form.getFieldValue('colorMode') === 'light' || (!form.getFieldValue('colorMode') && colorMode === 'light')) && (
              <Card
                size="small"
                title={
                  <TitleWithHint
                    title="标签栏背景色"
                    hint="自定义标签栏的背景颜色，使用 hex 格式（如：#ffffff，带透明度为 8 位 #rrggbbaa）"
                  />
                }
                style={{ marginBottom: 16 }}
                bodyStyle={{ padding: '16px' }}
              >
                {/* 重要提示：仅在浅色模式下生效 - 直接展示 */}
                <div style={{
                  marginBottom: 12,
                  padding: '6px 10px',
                  backgroundColor: token.colorWarningBg || '#fff7e6',
                  borderRadius: 6,
                  fontSize: 12,
                  color: token.colorWarning || '#fa8c16',
                  border: `1px solid ${token.colorWarningBorder || '#ffe7ba'}`
                }}>
                  <Text type="warning" style={{ fontSize: 12 }}>
                    提示：仅在浅色模式下生效
                  </Text>
                </div>

                {/* 预设颜色 - 标签栏使用6个浅色预设（按深度排序） */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>快速选择</div>
                  <Space wrap>
                    {presetTabsColors
                      .map((preset, index) => (
                        <Tooltip key={index} title={preset.label || preset.color} placement="top">
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: preset.color,
                              border: form.getFieldValue('tabsBgColor') === preset.color
                                ? `2px solid ${preset.color}`
                                : '2px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: form.getFieldValue('tabsBgColor') === preset.color
                                ? `0 0 0 2px ${preset.color}40`
                                : 'none',
                              position: 'relative',
                            }}
                            onClick={() => {
                              form.setFieldValue('tabsBgColor', preset.color);
                            }}
                            onMouseEnter={(e) => {
                              if (form.getFieldValue('tabsBgColor') !== preset.color) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${preset.color}40`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (form.getFieldValue('tabsBgColor') !== preset.color) {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                              }
                            }}
                          />
                        </Tooltip>
                      ))}
                  </Space>
                </div>

                {/* 自定义颜色 */}
                <Form.Item
                  name="tabsBgColor"
                  label="自定义颜色"
                  getValueFromEvent={(color) => {
                    if (!color) return '';
                    if (typeof color === 'string') return color;
                    if (color && typeof color.toHexString === 'function') {
                      try {
                        return color.toHexString();
                      } catch (e) {
                        console.warn('Color toHexString failed:', e);
                      }
                    }
                    return '';
                  }}
                >
                  <ColorPicker
                    showText
                    format="hex"
                    value={normalizedTabsBgColor || undefined}
                    onChange={(color) => {
                      if (!color || color === null) {
                        form.setFieldValue('tabsBgColor', '');
                        return;
                      }
                      const colorValue = normalizeBackgroundColor(color, '');
                      form.setFieldValue('tabsBgColor', colorValue);
                    }}
                    allowClear
                  />
                </Form.Item>
              </Card>
            )}

            {/* 界面样式 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title="界面样式"
                  hint="调整界面的圆角和间距，让界面更符合您的使用习惯"
                />
              }
              style={{ marginBottom: 16 }}
              bodyStyle={{ padding: '16px' }}
            >
              <Form.Item
                name="borderRadius"
                label={
                  <div>
                    <div>圆角大小</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                      控制按钮、卡片等元素的圆角程度（{form.getFieldValue('borderRadius') || 6}px）
                    </Text>
                  </div>
                }
              >
                <Slider
                  min={0}
                  max={16}
                  marks={{
                    0: '直角',
                    6: '适中',
                    12: '圆润',
                    16: '很圆',
                  }}
                />
              </Form.Item>
            </Card>

            {/* 文字设置 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title="文字设置"
                  hint="调整文字大小，让阅读更舒适"
                />
              }
              style={{ marginBottom: 16 }}
              bodyStyle={{ padding: '16px' }}
            >
              <Form.Item
                name="fontSize"
                label={
                  <div>
                    <div>字体大小</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                      调整界面文字的基础大小（{form.getFieldValue('fontSize') || 14}px）
                    </Text>
                  </div>
                }
              >
                <Slider
                  min={12}
                  max={20}
                  marks={{
                    12: '小',
                    14: '标准',
                    16: '大',
                    18: '很大',
                    20: '特大',
                  }}
                />
              </Form.Item>
            </Card>

            {/* 主题配置 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title="主题配置"
                  hint="调整主题相关的配置选项"
                />
              }
              style={{ marginBottom: 16 }}
              bodyStyle={{ padding: '16px' }}
            >
              <Form.Item
                name="compact"
                label="紧凑模式"
                valuePropName="checked"
              >
                <div>
                  <Switch checked={compactValue} onChange={(checked) => {
                    setCompactValue(checked);
                    form.setFieldsValue({ compact: checked });
                  }} />
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    启用后，界面元素间距更小，可显示更多内容
                  </Text>
                </div>
              </Form.Item>

              <Form.Item
                name="tabsPersistence"
                label="标签栏持久化"
                valuePropName="checked"
              >
                <div>
                  <Switch checked={tabsPersistenceValue} onChange={(checked) => {
                    setTabsPersistenceValue(checked);
                    form.setFieldsValue({ tabsPersistence: checked });
                  }} />
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    启用后，关闭浏览器后重新打开，已打开的标签页会自动恢复；关闭后只保留仪表板、钉住标签和当前页面
                  </Text>
                </div>
              </Form.Item>

            </Card>
          </Form>

          <Divider style={{ margin: '24px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>实时预览</Text>
          </Divider>

          <ConfigProvider theme={previewTheme || undefined}>
            <Card
              size="small"
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ marginBottom: 20 }}>
                <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>
                  按钮样式预览
                </Text>
                <Space wrap>
                  <Button type="primary">主要按钮</Button>
                  <Button>默认按钮</Button>
                  <Button type="dashed">虚线按钮</Button>
                  <Button type="link">链接按钮</Button>
                </Space>
              </div>

              <div style={{ marginBottom: 20 }}>
                <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>
                  文字样式预览
                </Text>
                <Card
                  size="small"
                  style={{
                    fontSize: `${previewTheme?.token?.fontSize || 14}px`,
                    borderRadius: `${previewTheme?.token?.borderRadius || 6}px`,
                  }}
                >
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>这是一段预览文本</div>
                  <div style={{ fontSize: `${(previewTheme?.token?.fontSize || 14) - 2}px`, opacity: 0.65 }}>
                    当前字体大小：{previewTheme?.token?.fontSize || 14}px，圆角大小：{previewTheme?.token?.borderRadius || 6}px
                  </div>
                </Card>
              </div>

              <div>
                <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>
                  主题色预览
                </Text>
                <div style={{
                  width: '100%',
                  height: 60,
                  background: previewTheme?.token?.colorPrimary || '#1890ff',
                  borderRadius: `${previewTheme?.token?.borderRadius || 6}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: 14,
                }}>
                  {previewTheme?.token?.colorPrimary || '#1890ff'}
                </div>
              </div>
            </Card>
          </ConfigProvider>
        </>
      )}
    </Drawer>
  );
};

export default ThemeEditor;

