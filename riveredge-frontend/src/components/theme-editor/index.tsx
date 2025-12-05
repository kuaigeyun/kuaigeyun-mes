/**
 * 主题编辑面板组件
 * 
 * 使用 Ant Design 原生主题配置，支持实时预览和应用
 */

import React, { useState, useEffect } from 'react';
import { Drawer, Form, ColorPicker, Switch, Button, Space, Divider, message, ConfigProvider, Card, Typography, Slider } from 'antd';
import { SaveOutlined, ReloadOutlined, SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { getSiteSetting, updateSiteSetting } from '../../services/siteSetting';
import { getUserPreference, updateUserPreference } from '../../services/userPreference';

const { Text, Paragraph } = Typography;

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
  const [colorMode, setColorMode] = useState<'light' | 'dark' | 'auto'>('light'); // 颜色模式：浅色/深色/跟随系统

  // 预设主题颜色
  const presetColors = [
    { color: '#1890ff' },
    { color: '#52c41a' },
    { color: '#722ed1' },
    { color: '#ff4d4f' },
    { color: '#fa8c16' },
    { color: '#595959' },
  ];

  // 预设菜单栏背景颜色（包含浅色和深色选项，共6个）
  const presetSiderBgColors = [
    { color: '#ffffff', label: '纯白' },
    { color: '#f5f5f5', label: '灰白' },
    { color: '#fafbfc', label: '蓝灰' },
    { color: '#001529', label: '深蓝' },
    { color: '#1f1f1f', label: '深灰' },
    { color: '#141414', label: '深黑' },
  ];

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
      
      form.setFieldsValue({
        colorPrimary: colorPrimaryValue,
        borderRadius: currentBorderRadius,
        fontSize: currentFontSize,
        compact: themeConfig.compact || false,
        siderBgColor: themeConfig.siderBgColor || '', // 左侧菜单栏背景色（仅浅色模式）
        colorMode: userThemeMode, // 颜色模式
      });
      
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
    // 确保 colorPrimary 是字符串格式
    if (changedValues.colorPrimary) {
      const colorValue = typeof changedValues.colorPrimary === 'string' 
        ? changedValues.colorPrimary 
        : changedValues.colorPrimary.toHexString?.() || '#1890ff';
      allValues.colorPrimary = colorValue;
    }
    
    // 如果颜色模式改变，更新状态
    if (changedValues.colorMode) {
      setColorMode(changedValues.colorMode);
    }
    
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
      
      // 使用用户最终选择的颜色值
      const themeConfig: any = {
        colorPrimary: colorPrimaryValue,
        borderRadius: values.borderRadius || 6,
        fontSize: values.fontSize || 14,
        compact: values.compact || false,
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
      
      // 保存站点主题配置
      const settings: Record<string, any> = {
        theme_config: themeConfig,
      };
      
      await updateSiteSetting({ settings });
      
      // 临时方案：同时保存到本地存储（后续会做偏好设置）
      const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';
      localStorage.setItem(THEME_CONFIG_STORAGE_KEY, JSON.stringify(themeConfig));
      
      message.success('主题配置保存成功');
      
      // 先触发站点主题更新事件，传递用户最终选择的配置（优先应用）
      window.dispatchEvent(new CustomEvent('siteThemeUpdated', {
        detail: { themeConfig }
      }));
      
      // 然后保存用户颜色模式偏好（浅色/深色/跟随系统）
      // 延迟触发用户偏好更新事件，避免覆盖刚保存的主题配置
      if (values.colorMode) {
        const preferences: Record<string, any> = {
          theme: values.colorMode,
        };
        await updateUserPreference({ preferences });
        
        // 延迟触发，确保主题配置已经应用
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('userPreferenceUpdated', {
            detail: { preferences }
          }));
        }, 50);
      }
      
      // 调用回调
      if (onThemeUpdate) {
        onThemeUpdate(themeConfig);
      }
      
      // 关闭面板
      onClose();
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    form.setFieldsValue({
      colorPrimary: '#1890ff',
      borderRadius: 6,
      fontSize: 14,
      compact: false,
      colorMode: 'light',
      siderBgColor: '', // 重置时设置为空字符串，表示使用默认背景色（无色）
    });
    setColorMode('light');
    applyPreviewTheme(form.getFieldsValue(), 'light');
  };

  // 当面板打开时加载主题配置
  useEffect(() => {
    if (open) {
      loadTheme();
    }
  }, [open]);

  return (
    <Drawer
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>个性化主题</div>
          <Text type="secondary" style={{ fontSize: 12 }}>自定义您的界面外观，让工作更舒适</Text>
        </div>
      }
      open={open}
      onClose={onClose}
      closable={false}
      width={520}
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
          title="主题颜色" 
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '16px' }}
        >
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            选择您喜欢的主题颜色，这将应用于按钮、链接和选中状态等界面元素
          </Paragraph>
          
          {/* 预设颜色 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>快速选择</div>
            <Space wrap>
              {presetColors.map((preset, index) => (
                <div
                  key={index}
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
              ))}
            </Space>
          </div>
          
          {/* 自定义颜色 */}
          <Form.Item
            name="colorPrimary"
            label="自定义颜色"
            getValueFromEvent={(color) => {
              if (!color) return '#1890ff';
              if (typeof color === 'string') return color;
              if (color && typeof color.toHexString === 'function') return color.toHexString();
              if (color && color.metaColor && typeof color.metaColor.toHexString === 'function') {
                return color.metaColor.toHexString();
              }
              return '#1890ff';
            }}
            normalize={(value) => {
              if (!value) return '#1890ff';
              if (typeof value === 'string') return value;
              if (value && typeof value.toHexString === 'function') return value.toHexString();
              if (value && value.metaColor && typeof value.metaColor.toHexString === 'function') {
                return value.metaColor.toHexString();
              }
              return '#1890ff';
            }}
          >
            <ColorPicker 
              showText 
              format="hex"
              value={form.getFieldValue('colorPrimary') || token.colorPrimary || '#1890ff'}
              onChange={(color) => {
                const colorValue = typeof color === 'string' 
                  ? color 
                  : (color && typeof color.toHexString === 'function' 
                    ? color.toHexString() 
                    : token.colorPrimary || '#1890ff');
                form.setFieldValue('colorPrimary', colorValue);
              }}
            />
          </Form.Item>
        </Card>

        {/* 左侧菜单栏设置（仅浅色模式支持自定义背景色） */}
        {(form.getFieldValue('colorMode') === 'light' || (!form.getFieldValue('colorMode') && colorMode === 'light')) && (
          <Card 
            size="small" 
            title="左侧菜单栏" 
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: '16px' }}
          >
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
              自定义左侧菜单栏的背景颜色（仅在浅色模式下生效）
            </Paragraph>
            
            {/* 预设颜色 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>快速选择</div>
              <Space wrap>
                {presetSiderBgColors.map((preset, index) => (
                  <div
                    key={index}
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
                    title={preset.label}
                  />
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
                if (color && typeof color.toHexString === 'function') return color.toHexString();
                if (color && color.metaColor && typeof color.metaColor.toHexString === 'function') {
                  return color.metaColor.toHexString();
                }
                return '';
              }}
              normalize={(value) => {
                if (!value) return '';
                if (typeof value === 'string') return value;
                if (value && typeof value.toHexString === 'function') return value.toHexString();
                if (value && value.metaColor && typeof value.metaColor.toHexString === 'function') {
                  return value.metaColor.toHexString();
                }
                return '';
              }}
            >
              <ColorPicker 
                showText 
                format="hex"
                value={form.getFieldValue('siderBgColor') || ''}
                onChange={(color) => {
                  // 处理清除按钮点击（color 为 null 或 undefined）
                  if (!color || color === null) {
                    form.setFieldValue('siderBgColor', '');
                    return;
                  }
                  
                  const colorValue = typeof color === 'string' 
                    ? color 
                    : (color && typeof color.toHexString === 'function' 
                      ? color.toHexString() 
                      : '');
                  form.setFieldValue('siderBgColor', colorValue);
                }}
                allowClear
                placeholder="使用默认背景色"
              />
            </Form.Item>
          </Card>
        )}

        {/* 界面样式 */}
        <Card 
          size="small" 
          title="界面样式" 
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '16px' }}
        >
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            调整界面的圆角和间距，让界面更符合您的使用习惯
          </Paragraph>
          
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
          
          <Form.Item
            name="compact"
            label="紧凑模式"
            valuePropName="checked"
          >
            <div>
              <Switch />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                启用后，界面元素间距更小，可显示更多内容
              </Text>
            </div>
          </Form.Item>
        </Card>

        {/* 文字设置 */}
        <Card 
          size="small" 
          title="文字设置" 
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '16px' }}
        >
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            调整文字大小，让阅读更舒适
          </Paragraph>
          
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
    </Drawer>
  );
};

export default ThemeEditor;

