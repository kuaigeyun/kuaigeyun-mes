/**
 * 主题编辑面板组件
 * 
 * 使用 Ant Design 原生主题配置，支持实时预览和应用
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Form, Input, ColorPicker, Switch, Button, Space, Divider, message, ConfigProvider, Card, Typography, Tooltip, Popover, Segmented, Spin } from 'antd';
import { SaveOutlined, ReloadOutlined, SunOutlined, MoonOutlined, DesktopOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { getSiteSetting, updateSiteSetting } from '../../services/siteSetting';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';
import { getToken } from '../../utils/auth';
import { useThemeStore, resolveThemeFromCloud, type ThemeStyle } from '../../stores/themeStore';
import { useConfigStore } from '../../stores/configStore';
import { clearTabsData } from '../../stores/tabsStorage';
import { getDrawerFloatingWrapperStyle } from '../layout-templates/drawerFloatingChrome';
import { clampBorderRadius, readBorderRadius } from '../../utils/themeBorderRadius';
import { clampFontSize, readFontSize } from '../../utils/themeFontSize';
import { ThemeBorderRadiusSlider, ThemeFontSizeSlider } from './ThemeStyleSliders';
import '../layout-templates/drawerSlideMotion.css';

const { Text } = Typography;

function colorFieldToHex(raw: unknown, fallback: string): string {
  if (!raw) return fallback;
  if (typeof raw === 'string') return raw;
  if (raw && typeof (raw as { toHexString?: () => string }).toHexString === 'function') {
    return (raw as { toHexString: () => string }).toHexString();
  }
  return fallback;
}

function normalizeBgColorField(raw: unknown, fallback = ''): string {
  if (!raw) return fallback;
  if (typeof raw === 'string') return raw;
  if (raw && typeof (raw as { toHexString?: () => string }).toHexString === 'function') {
    try {
      return (raw as { toHexString: () => string }).toHexString();
    } catch {
      return fallback;
    }
  }
  if (raw && typeof (raw as { toRgbString?: () => string }).toRgbString === 'function') {
    try {
      return (raw as { toRgbString: () => string }).toRgbString();
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** 与保存逻辑一致：供实时 applyTheme 与持久化共用 */
function buildThemeConfigFromForm(
  values: Record<string, unknown>,
  fallbackColorMode: 'light' | 'dark' | 'auto',
): {
  themeMode: 'light' | 'dark' | 'auto';
  themeConfigForPreference: {
    colorPrimary: string;
    borderRadius: number;
    fontSize: number;
    compact: boolean;
    themeStyle: ThemeStyle;
    siderBgColor: string;
    headerBgColor: string;
    tabsBgColor: string;
  };
} {
  const themeMode = (values.colorMode as 'light' | 'dark' | 'auto') || fallbackColorMode || 'light';
  const savingThemeStyle = (values.themeStyle as ThemeStyle) || 'vivid';
  const savingPlain = savingThemeStyle === 'plain';
  const colorPrimaryValue = colorFieldToHex(values.colorPrimary, '#1890ff');
  const siderBgColorValue = colorFieldToHex(values.siderBgColor, '');
  const headerBgColorValue = normalizeBgColorField(values.headerBgColor, '');
  const tabsBgColorValue = normalizeBgColorField(values.tabsBgColor, '');
  const isLight =
    themeMode === 'light' || (themeMode !== 'dark' && themeMode !== 'auto' && fallbackColorMode === 'light');

  return {
    themeMode,
    themeConfigForPreference: {
      colorPrimary: colorPrimaryValue,
      borderRadius: readBorderRadius(values.borderRadius),
      fontSize: readFontSize(values.fontSize),
      compact: false,
      themeStyle: savingThemeStyle,
      siderBgColor: savingPlain || !isLight ? '' : siderBgColorValue || '',
      headerBgColor: savingPlain ? '' : headerBgColorValue || '',
      tabsBgColor: savingPlain ? '' : tabsBgColorValue || '',
    },
  };
}

/**
 * 带提示按钮的标题组件属性
 */
interface TitleWithHintProps {
  /** 标题文本 */
  title: string;
  /** 提示内容 */
  hint?: React.ReactNode;
  /** 标题右侧内联提示（用于压缩卡片高度） */
  inlineTip?: React.ReactNode;
}

const TitleWithHint: React.FC<TitleWithHintProps> = ({ title, hint, inlineTip }) => {
  const { token } = theme.useToken();
  if (!hint) {
    return <span>{title}</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span>{title}</span>
      {inlineTip ? (
        <div style={{
          backgroundColor: token.colorWarningBg,
          padding: '4px 12px',
          borderRadius: 20, // 使用全圆角更现代
          display: 'inline-flex',
          alignItems: 'center',
          border: `1px solid ${token.colorWarningBorder}`,
          margin: '0 4px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)', // 增加微弱投影增强质感
        }}>
          <Text type="warning" style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>
            {inlineTip}
          </Text>
        </div>
      ) : null}
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

const ThemeEditor: React.FC<ThemeEditorProps> = ({ open, onClose, onThemeUpdate }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken(); // 获取当前实际使用的主题 token
  const themeDrawerFloatingWrapper = useMemo(
    () => getDrawerFloatingWrapperStyle('right', token),
    [token.borderRadiusLG, token.boxShadowSecondary]
  );
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<{
    algorithm: typeof theme.defaultAlgorithm | typeof theme.darkAlgorithm;
    token: {
      colorPrimary?: string;
      borderRadius?: number;
      fontSize?: number;
    };
  } | null>(null);
  const [colorMode, setColorMode] = useState<'light' | 'dark' | 'auto'>('light');
  const [tabsPersistenceValue, setTabsPersistenceValue] = useState<boolean>(false);
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
    { color: '#1890ff', labelKey: 'components.themeEditor.presetColor.classicBlue', label: '经典蓝' },      // Ant Design 默认蓝
    { color: '#13c2c2', labelKey: 'components.themeEditor.presetColor.cyanBlue', label: '青蓝' },        // 青色系
    { color: '#52c41a', labelKey: 'components.themeEditor.presetColor.green', label: '绿色' },        // 成功色
    { color: '#722ed1', labelKey: 'components.themeEditor.presetColor.purple', label: '紫色' },        // 紫色系
    { color: '#fa8c16', labelKey: 'components.themeEditor.presetColor.orange', label: '橙色' },        // 警告色
    { color: '#f5222d', labelKey: 'components.themeEditor.presetColor.red', label: '红色' },        // 错误色
  ];

  /** 简约模式：低饱和商务主色 */
  const presetPlainColors = [
    { color: '#1677ff', labelKey: 'components.themeEditor.presetPlainColor.businessBlue', label: '商务蓝' },
    { color: '#2f54eb', labelKey: 'components.themeEditor.presetPlainColor.indigo', label: '靛蓝' },
    { color: '#52c41a', labelKey: 'components.themeEditor.presetPlainColor.successGreen', label: '成功绿' },
    { color: '#f5222d', labelKey: 'components.themeEditor.presetPlainColor.dangerRed', label: '危险红' },
    { color: '#434343', labelKey: 'components.themeEditor.presetPlainColor.graphiteGray', label: '石墨灰' },
    { color: '#595959', labelKey: 'components.themeEditor.presetPlainColor.neutralGray', label: '中性灰' },
    { color: '#1d39c4', labelKey: 'components.themeEditor.presetPlainColor.navy', label: '藏青' },
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
    { color: '#ffffff', labelKey: 'components.themeEditor.presetBgColor.pureWhite', label: '纯白', category: 'light' },
    { color: '#fafafa', labelKey: 'components.themeEditor.presetBgColor.lightGray', label: '浅灰', category: 'light' },
    { color: '#f5f5f5', labelKey: 'components.themeEditor.presetBgColor.offWhite', label: '灰白', category: 'light' },
    // 深色系（3个）
    { color: '#001529', labelKey: 'components.themeEditor.presetBgColor.deepBlue', label: '深蓝', category: 'dark' },
    { color: '#141414', labelKey: 'components.themeEditor.presetBgColor.deepBlack', label: '深黑', category: 'dark' },
    { color: '#1f1f1f', labelKey: 'components.themeEditor.presetBgColor.deepGray', label: '深灰', category: 'dark' },
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
    { color: '#ffffff', labelKey: 'components.themeEditor.presetTabsBgColor.pureWhite', label: '纯白', category: 'light' },
    { color: '#fafafa', labelKey: 'components.themeEditor.presetTabsBgColor.lightGray', label: '浅灰', category: 'light' },
    { color: '#f5f5f5', labelKey: 'components.themeEditor.presetTabsBgColor.offWhite', label: '灰白', category: 'light' },
    { color: '#f0f0f0', labelKey: 'components.themeEditor.presetTabsBgColor.midGray', label: '中灰', category: 'light' },
    { color: '#fafbfc', labelKey: 'components.themeEditor.presetTabsBgColor.blueGray', label: '蓝灰', category: 'light' },
    { color: '#D4D4D4', labelKey: 'components.themeEditor.presetTabsBgColor.silverGray', label: '银灰', category: 'light' },
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
  const [themeStyleValue, setThemeStyleValue] = useState<ThemeStyle>('vivid');

  const activePresetColors = themeStyleValue === 'plain' ? presetPlainColors : presetColors;
  const isPlainStyle = themeStyleValue === 'plain';

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
   * 加载站点主题配置和用户偏好设置
   */
  const loadTheme = async () => {
    try {
      setLoading(true);

      const [, siteSetting] = await Promise.all([
        useUserPreferenceStore.getState().fetchPreferences({ force: true }),
        getSiteSetting().catch(() => null),
      ]);
      const prefs = useUserPreferenceStore.getState().preferences || {};
      const siteSettings =
        siteSetting?.settings && typeof siteSetting.settings === 'object'
          ? siteSetting.settings
          : null;

      /** 云端优先：用户偏好 theme_config > 站点 theme_config / theme_color */
      const { theme: userThemeMode, config: applied } = resolveThemeFromCloud(prefs, siteSettings);
      if (siteSettings) {
        useThemeStore.setState({ siteThemeSettings: siteSettings });
      }
      useThemeStore.getState().applyTheme(userThemeMode, applied, { persist: false });

      setColorMode(userThemeMode);

      const parseDim = (v: unknown, fallback: number): number => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : fallback;
      };

      const colorPrimaryValue = applied.colorPrimary || '#1890ff';

      const currentBorderRadius = clampBorderRadius(applied.borderRadius);
      const currentFontSize = clampFontSize(applied.fontSize);

      const tabsPersistence = 'tabs_persistence' in prefs ? Boolean(prefs.tabs_persistence) : false;
      const loadedThemeStyle = applied.themeStyle === 'plain' ? 'plain' : 'vivid';
      setThemeStyleValue(loadedThemeStyle);

      const formValues = {
        colorPrimary: colorPrimaryValue,
        borderRadius: currentBorderRadius,
        fontSize: currentFontSize,
        siderBgColor: applied.siderBgColor || '',
        headerBgColor: applied.headerBgColor || '',
        tabsBgColor: applied.tabsBgColor || '',
        colorMode: userThemeMode,
        tabsPersistence,
        layoutMode: 'mix',
        themeStyle: loadedThemeStyle,
      };

      form.setFieldsValue(formValues);

      setColorPrimaryValue(colorPrimaryValue);
      setSiderBgColorValue(applied.siderBgColor || '');
      setHeaderBgColorValue(applied.headerBgColor || '');
      setTabsBgColorValue(applied.tabsBgColor || '');
      setTabsPersistenceValue(tabsPersistence);

      // 应用预览主题
      applyPreviewTheme(form.getFieldsValue(), userThemeMode);
    } catch (error: any) {
      message.error(error?.message || t('components.themeEditor.message.loadFailed'));
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

    const algorithm = baseAlgorithm;

    const token = {
      colorPrimary: values.colorPrimary || '#1890ff',
      borderRadius: readBorderRadius(values.borderRadius),
      fontSize: readFontSize(values.fontSize),
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

    if (changedValues.themeStyle) {
      setThemeStyleValue(changedValues.themeStyle);
    }

    if (changedValues.borderRadius !== undefined) {
      allValues.borderRadius = clampBorderRadius(changedValues.borderRadius);
    }

    if (changedValues.fontSize !== undefined) {
      allValues.fontSize = clampFontSize(changedValues.fontSize);
    }

    const { themeMode, themeConfigForPreference } = buildThemeConfigFromForm(
      allValues,
      (allValues.colorMode as 'light' | 'dark' | 'auto') || colorMode,
    );
    useThemeStore.getState().applyTheme(themeMode, themeConfigForPreference, {
      persist: Boolean(changedValues.themeStyle && getToken()),
    });

    applyPreviewTheme(allValues, themeMode);
  };

  /**
   * 处理颜色模式切换（立即保存）
   */
  const handleColorModeChange = async (mode: 'light' | 'dark' | 'auto') => {
    try {
      form.setFieldValue('colorMode', mode);
      setColorMode(mode);
      applyPreviewTheme(form.getFieldsValue(), mode);

      // applyTheme 会更新 themeStore 并持久化到 userPreferenceStore
      useThemeStore.getState().applyTheme(mode, useThemeStore.getState().config, { persist: true });

      message.success(t('components.themeEditor.message.colorModeSwitched'));
    } catch (error: any) {
      message.error(error?.message || t('components.themeEditor.message.switchFailed'));
    }
  };

  /**
   * 同步主色到表单、预览与 themeStore（预设色与自定义色共用）
   */
  const applyColorPrimaryChange = (color: string, allValues?: Record<string, unknown>) => {
    const colorPrimaryValue = colorFieldToHex(color, '#1890ff');
    form.setFieldValue('colorPrimary', colorPrimaryValue);
    setColorPrimaryValue(colorPrimaryValue);
    const mergedValues = {
      ...(allValues ?? form.getFieldsValue()),
      colorPrimary: colorPrimaryValue,
    };
    const { themeMode, themeConfigForPreference } = buildThemeConfigFromForm(
      mergedValues,
      (mergedValues.colorMode as 'light' | 'dark' | 'auto') || colorMode,
    );
    useThemeStore.getState().applyTheme(themeMode, themeConfigForPreference, { persist: false });
    applyPreviewTheme(mergedValues, themeMode);
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    try {
      setSaving(true);

      // 获取表单的最终值（用户选择的结果）
      const values = await form.validateFields();
      values.colorPrimary = colorFieldToHex(
        form.getFieldValue('colorPrimary') ?? values.colorPrimary,
        '#1890ff',
      );


      // 重要：在 validateFields 之后，直接从表单获取当前值
      // 因为 Switch 组件的值可能在 validateFields 时丢失
      const tabsPersistenceValue = Boolean(form.getFieldValue('tabsPersistence'));

      const { themeMode, themeConfigForPreference } = buildThemeConfigFromForm(values, colorMode);

      const themeConfig: Record<string, unknown> = {
        ...themeConfigForPreference,
        layoutMode: 'mix',
        theme: themeMode,
      };
      const hasToken = !!getToken();
      if (hasToken) {
        // 用户已登录：通过 updatePreferences 持久化，app 内订阅会同步 themeStore
        try {
          await useUserPreferenceStore.getState().updatePreferences({
            theme: themeMode,
            theme_config: themeConfigForPreference,
            tabs_persistence: tabsPersistenceValue,
          });
        } catch (prefError: any) {
          // 新建租户等场景下偏好接口可能 404（当前用户无法创建偏好设置），仍应用主题到当前会话
          const isPreferenceUnavailable =
            prefError?.response?.status === 404 ||
            (typeof prefError?.message === 'string' && (
              prefError.message.includes('无法创建偏好设置') ||
              prefError.message.includes('非租户用户') ||
              prefError.message.includes('404')
            ));
          if (isPreferenceUnavailable) {
            const current = JSON.parse(
              JSON.stringify(useUserPreferenceStore.getState().preferences)
            );
            current.theme = themeMode;
            current.theme_config = themeConfigForPreference;
            current.tabs_persistence = tabsPersistenceValue;
            useUserPreferenceStore.setState({ preferences: current });
            useThemeStore.getState().applyTheme(themeMode, themeConfigForPreference, { persist: false });
            message.warning(t('components.themeEditor.message.appliedButNotSaved'));
          } else {
            throw prefError;
          }
        }
      }

      useThemeStore.getState().applyTheme(themeMode, themeConfigForPreference, { persist: false });

      // 保存站点主题配置
      const settings: Record<string, any> = {
        theme_config: themeConfig,
      };

      try {
        const updatedSiteSetting = await updateSiteSetting({ settings });
        if (updatedSiteSetting?.settings) {
          useThemeStore.setState({ siteThemeSettings: updatedSiteSetting.settings });
          useConfigStore.getState().hydrateFromSettings(updatedSiteSetting.settings);
        }
      } catch (error) {
        // 站点设置保存失败（如无权限或无租户上下文），仅记录日志，不阻断流程
        console.warn('Failed to save site theme settings:', error);
      }

      if (hasToken) {
        await useUserPreferenceStore.getState().fetchPreferences({ force: true });
        useThemeStore.getState().syncFromPreferences(
          useUserPreferenceStore.getState().preferences || {},
        );
      }

      message.success(t('components.themeEditor.message.applied'));

      // 调用回调
      if (onThemeUpdate) {
        onThemeUpdate(themeConfig);
      }

      // 关闭面板
      onClose();
    } catch (error: any) {
      console.error('Theme save error:', error);
      message.error(error?.message || t('components.themeEditor.message.saveFailed'));
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
        siderBgColor: '',
        headerBgColor: '',
        tabsBgColor: '',
        themeStyle: 'vivid' as ThemeStyle,
      };

      // 2. 更新本地表单和状态
      setTabsPersistenceValue(true);
      setColorMode('light');
      setColorPrimaryValue('#1890ff');
      setSiderBgColorValue('');
      setHeaderBgColorValue('');
      setTabsBgColorValue('');
      setThemeStyleValue('vivid');

      form.setFieldsValue({
        ...defaultThemeConfig,
        colorMode: 'light',
        tabsPersistence: true,
        layoutMode: 'mix',
        themeStyle: 'vivid',
      });

      // 3. 清除相关本地存储
      const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';
      localStorage.removeItem(THEME_CONFIG_STORAGE_KEY);
      clearTabsData();

      // 4. 更新服务器配置（如果已登录）
      const token = getToken();
      if (token) {
        await Promise.all([
          useUserPreferenceStore.getState().updatePreferences({
            theme: 'light',
            tabs_persistence: true,
            theme_config: defaultThemeConfig,
          }).catch(err => console.warn('Failed to reset user preferences:', err)),
          updateSiteSetting({
            settings: {
              theme_config: defaultThemeConfig
            }
          }).catch(err => console.warn('Failed to reset site settings:', err))
        ]);
      }

      // 5. 应用主题到 store
      useThemeStore.getState().applyTheme('light', defaultThemeConfig, { persist: false });

      // 6. 应用本地预览
      applyPreviewTheme(defaultThemeConfig, 'light');

      message.success(t('components.themeEditor.message.resetDone'));

      // 7. 关闭面板（根据用户需求：点击恢复默认后关闭抽屉）
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Reset failed:', error);
      message.error(t('components.themeEditor.message.resetFailed'));
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
      rootClassName="theme-editor-drawer drawer-slide-motion"
      placement="right"
      styles={{
        body: { overflowY: 'scroll' },
        wrapper: themeDrawerFloatingWrapper,
      }}
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{t('components.themeEditor.title')}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('components.themeEditor.subtitle')}</Text>
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
            {t('components.themeEditor.action.reset')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            {t('components.themeEditor.action.save')}
          </Button>
        </Space>
      }
    >
      <style>{`
        .theme-editor-drawer .ant-card {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        /* slide-in/out 见 layout-templates/drawerSlideMotion.css（drawer-slide-motion） */
        /* Slider 拖拽 Tooltip 见 global.less（.ant-slider-tooltip） */
      `}</style>
      {open && form && (
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleValuesChange}
            initialValues={{
              colorPrimary: '#1890ff',
              borderRadius: 6,
              fontSize: 14,
              colorMode: 'light',
              layoutMode: 'mix',
              themeStyle: 'vivid',
            }}
          >
            {/* 颜色模式 */}
            <Card
              size="small"
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '16px' } }}
            >
              <Form.Item name="colorMode" hidden>
                <Input />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
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
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{t('components.themeEditor.colorMode.light')}</div>
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
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{t('components.themeEditor.colorMode.dark')}</div>
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
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{t('components.themeEditor.colorMode.auto')}</div>
                  </div>
                </div>
              </Form.Item>
            </Card>

            {/* 主题风格 */}
            <Card
              size="small"
              title={t('ui.theme.style.label')}
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '16px' } }}
            >
              <Form.Item name="themeStyle" style={{ marginBottom: 8 }}>
                <Segmented
                  block
                  options={[
                    { label: t('ui.theme.style.vivid'), value: 'vivid' },
                    { label: t('ui.theme.style.plain'), value: 'plain' },
                  ]}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isPlainStyle ? t('ui.theme.style.plainDesc') : t('ui.theme.style.vividDesc')}
              </Text>
            </Card>

            {/* 主题颜色 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title={t('ui.theme.color')}
                  hint={t('components.themeEditor.primaryColor.hint')}
                />
              }
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '16px' } }}
            >
              {/* 快速选择 + 自定义颜色：并排展示，减少面板高度与滚动 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 150px',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                <div>
                  <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>{t('components.themeEditor.common.quickSelect')}</div>
                  <Space wrap size={10}>
                    {activePresetColors.map((preset, index) => (
                      <Tooltip key={index} title={preset.labelKey ? t(preset.labelKey, { defaultValue: preset.label || preset.color }) : (preset.label || preset.color)} placement="top">
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
                            applyColorPrimaryChange(preset.color);
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

                <Form.Item
                  name="colorPrimary"
                  label={t('components.themeEditor.common.customColor')}
                  style={{ marginBottom: 0 }}
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
                      applyColorPrimaryChange(color);
                    }}
                  />
                </Form.Item>
              </div>
            </Card>

            {/* 左侧菜单栏设置（多彩 + 浅色模式） */}
            {!isPlainStyle && (form.getFieldValue('colorMode') === 'light' || (!form.getFieldValue('colorMode') && colorMode === 'light')) && (
              <Card
                size="small"
                title={
                  <TitleWithHint
                    title={t('components.themeEditor.siderBg.title')}
                    hint={t('components.themeEditor.siderBg.hint')}
                    inlineTip={t('components.themeEditor.lightModeOnly')}
                  />
                }
                style={{ marginBottom: 16 }}
                styles={{ body: { padding: '16px' } }}
              >
                {/* 快速选择 + 自定义颜色：并排展示，减少面板高度与滚动 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 150px',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>{t('components.themeEditor.common.quickSelect')}</div>
                    <Space wrap size={10}>
                      {presetSiderAndHeaderColors
                        .map((preset, index) => (
                          <Tooltip key={index} title={preset.labelKey ? t(preset.labelKey, { defaultValue: preset.label || preset.color }) : (preset.label || preset.color)} placement="top">
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

                  <Form.Item
                  name="siderBgColor"
                  label={t('components.themeEditor.common.customColor')}
                  style={{ marginBottom: 0 }}
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
                </div>
              </Card>
            )}

            {/* 顶栏设置（多彩 + 浅色模式） */}
            {!isPlainStyle && (form.getFieldValue('colorMode') === 'light' || (!form.getFieldValue('colorMode') && colorMode === 'light')) && (
              <Card
                size="small"
                title={
                  <TitleWithHint
                    title={t('components.themeEditor.headerBg.title')}
                    hint={t('components.themeEditor.headerBg.hint')}
                    inlineTip={t('components.themeEditor.lightModeOnly')}
                  />
                }
                style={{ marginBottom: 16 }}
                styles={{ body: { padding: '16px' } }}
              >
                {/* 快速选择 + 自定义颜色：并排展示，减少面板高度与滚动 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 150px',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>{t('components.themeEditor.common.quickSelect')}</div>
                    <Space wrap size={10}>
                      {presetSiderAndHeaderColors
                        .map((preset, index) => (
                          <Tooltip key={index} title={preset.labelKey ? t(preset.labelKey, { defaultValue: preset.label || preset.color }) : (preset.label || preset.color)} placement="top">
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

                  <Form.Item
                    name="headerBgColor"
                    label={t('components.themeEditor.common.customColor')}
                    style={{ marginBottom: 0 }}
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
                </div>
              </Card>
            )}

            {/* 标签栏设置（多彩 + 浅色模式） */}
            {!isPlainStyle && (form.getFieldValue('colorMode') === 'light' || (!form.getFieldValue('colorMode') && colorMode === 'light')) && (
              <Card
                size="small"
                title={
                  <TitleWithHint
                    title={t('components.themeEditor.tabsBg.title')}
                    hint={t('components.themeEditor.tabsBg.hint')}
                    inlineTip={t('components.themeEditor.lightModeOnly')}
                  />
                }
                style={{ marginBottom: 16 }}
                styles={{ body: { padding: '16px' } }}
              >
                {/* 快速选择 + 自定义颜色：并排展示，减少面板高度与滚动 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 150px',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>{t('components.themeEditor.common.quickSelect')}</div>
                    <Space wrap size={10}>
                      {presetTabsColors
                        .map((preset, index) => (
                          <Tooltip key={index} title={preset.labelKey ? t(preset.labelKey, { defaultValue: preset.label || preset.color }) : (preset.label || preset.color)} placement="top">
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

                  <Form.Item
                    name="tabsBgColor"
                    label={t('components.themeEditor.common.customColor')}
                    style={{ marginBottom: 0 }}
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
                </div>
              </Card>
            )}

            {/* 界面样式 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title={t('components.themeEditor.interface.title')}
                  hint={t('components.themeEditor.interface.hint')}
                />
              }
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '16px' } }}
            >
              <ThemeBorderRadiusSlider />
            </Card>

            {/* 文字设置 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title={t('components.themeEditor.typography.title')}
                  hint={t('components.themeEditor.typography.hint')}
                />
              }
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '16px' } }}
            >
              <ThemeFontSizeSlider />
            </Card>

            {/* 主题配置 */}
            <Card
              size="small"
              title={
                <TitleWithHint
                  title={t('components.themeEditor.config.title')}
                  hint={t('components.themeEditor.config.hint')}
                />
              }
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '16px' } }}
            >
              <Form.Item
                name="tabsPersistence"
                label={t('components.themeEditor.tabsPersistence.label')}
                valuePropName="checked"
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('components.themeEditor.tabsPersistence.desc')}
                  </Text>
                }
              >
                <Switch />
              </Form.Item>

            </Card>
          </Form>

          <Divider style={{ margin: '24px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('components.themeEditor.preview.title')}</Text>
          </Divider>

          <ConfigProvider theme={previewTheme || undefined}>
            <Card
              size="small"
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ marginBottom: 20 }}>
                <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>
                  {t('components.themeEditor.preview.buttonSection')}
                </Text>
                <Space wrap>
                  <Button type="primary">{t('components.themeEditor.preview.button.primary')}</Button>
                  <Button>{t('components.themeEditor.preview.button.default')}</Button>
                  <Button type="dashed">{t('components.themeEditor.preview.button.dashed')}</Button>
                  <Button type="link">{t('components.themeEditor.preview.button.link')}</Button>
                </Space>
              </div>

              <div style={{ marginBottom: 20 }}>
                <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>
                  {t('components.themeEditor.preview.textSection')}
                </Text>
                <Card
                  size="small"
                  style={{
                    fontSize: `${readFontSize(previewTheme?.token?.fontSize)}px`,
                    borderRadius: `${readBorderRadius(previewTheme?.token?.borderRadius)}px`,
                  }}
                >
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('components.themeEditor.preview.sampleText')}</div>
                  <div style={{ fontSize: `${readFontSize(previewTheme?.token?.fontSize) - 2}px`, opacity: 0.65 }}>
                    {t('components.themeEditor.preview.current', {
                      fontSize: readFontSize(previewTheme?.token?.fontSize),
                      borderRadius: readBorderRadius(previewTheme?.token?.borderRadius),
                    })}
                  </div>
                </Card>
              </div>

              <div>
                <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>
                  {t('components.themeEditor.preview.colorSection')}
                </Text>
                <div style={{
                  width: '100%',
                  height: 60,
                  background: previewTheme?.token?.colorPrimary || '#1890ff',
                  borderRadius: `${readBorderRadius(previewTheme?.token?.borderRadius)}px`,
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
        </Spin>
      )}
    </Drawer>
  );
};

export default ThemeEditor;

