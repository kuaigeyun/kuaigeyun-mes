/**
 * 简化版主题颜色编辑器组件
 * 
 * 仅用于登录页面，只允许修改主题颜色
 * 使用 Popover 显示，简洁紧凑
 */

import React, { useState, useEffect } from 'react';
import { Popover, Space, App } from 'antd';
import { theme } from 'antd';
import { getSiteSetting, updateSiteSetting } from '../../services/siteSetting';
import { getToken } from '../../utils/auth';
import { useThemeStore } from '../../stores/themeStore';

/**
 * 简化版主题颜色编辑器组件属性
 */
interface ThemeColorEditorProps {
  /** 触发元素 */
  children: React.ReactNode;
  /** 主题配置更新回调 */
  onThemeUpdate?: (colorPrimary: string) => void;
}

/**
 * localStorage 键名
 */
const THEME_COLOR_STORAGE_KEY = 'riveredge_theme_color_preview';

function themeColorToHex(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (
    value &&
    typeof value === 'object' &&
    'toHexString' in value &&
    typeof (value as { toHexString: unknown }).toHexString === 'function'
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }
  return fallback;
}

/**
 * 简化版主题颜色编辑器组件
 */
const ThemeColorEditor: React.FC<ThemeColorEditorProps> = ({ children, onThemeUpdate }) => {
  const { token } = theme.useToken(); // 获取当前实际使用的主题 token
  const { message } = App.useApp(); // 使用 App.useApp() 避免警告
  const [selectedColor, setSelectedColor] = useState<string>('#1890ff');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 预设主题颜色（只保留颜色值，不包含名称和描述）
  const presetColors = [
    '#1890ff', // 经典蓝
    '#52c41a', // 活力绿
    '#722ed1', // 优雅紫
    '#ff4d4f', // 热情红
    '#fa8c16', // 温暖橙
    '#595959', // 沉稳灰
  ];

  /**
   * 加载站点主题配置
   */
  const loadTheme = async () => {
    try {
      setLoading(true);
      
      // 检查是否有 token（是否已登录）
      const hasToken = !!getToken();
      
      let raw: unknown = null;

      if (hasToken) {
        try {
          const siteSetting = await getSiteSetting();
          const themeConfig = siteSetting?.settings?.theme_config || {};
          const legacyThemeColor = siteSetting?.settings?.theme_color;
          raw = legacyThemeColor ?? themeConfig.colorPrimary ?? null;
        } catch {
          // 如果后端加载失败，忽略错误，继续使用 localStorage 或默认值
        }
      }

      if (raw == null || raw === '') {
        raw = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
      }

      if (raw == null || raw === '') {
        raw = token.colorPrimary;
      }

      const hex = themeColorToHex(raw, token.colorPrimary || '#1890ff');
      setSelectedColor(hex);
    } catch (error: any) {
      // 如果加载失败，使用默认颜色
      setSelectedColor(token.colorPrimary || '#1890ff');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理颜色选择
   */
  const handleColorSelect = async (color: string) => {
    try {
      setSaving(true);
      
      const colorPrimaryValue = themeColorToHex(color, '#1890ff');

      // 检查是否有 token（是否已登录）
      const hasToken = !!getToken();
      
      if (hasToken) {
        // 已登录：保存到后端
        try {
          // 获取现有的主题配置，只更新颜色
          const siteSetting = await getSiteSetting().catch(() => null);
          const existingThemeConfig = siteSetting?.settings?.theme_config || {};
          
          const themeConfig = {
            ...existingThemeConfig,
            colorPrimary: colorPrimaryValue,
          };
          
          const settings: Record<string, any> = {
            theme_config: themeConfig,
          };
          
          const updatedSiteSetting = await updateSiteSetting({ settings });
          if (updatedSiteSetting?.settings) {
            useThemeStore.setState({ siteThemeSettings: updatedSiteSetting.settings });
          }

          const currentConfig = useThemeStore.getState().config;
          useThemeStore.getState().applyTheme(
            useThemeStore.getState().theme,
            { ...currentConfig, colorPrimary: colorPrimaryValue },
            { persist: true },
          );

          message.success('主题颜色已更新');
        } catch (error: any) {
          localStorage.setItem(THEME_COLOR_STORAGE_KEY, colorPrimaryValue);
          const currentConfig = useThemeStore.getState().config;
          useThemeStore.getState().applyTheme(
            useThemeStore.getState().theme,
            { ...currentConfig, colorPrimary: colorPrimaryValue },
            { persist: true },
          );
          message.warning('主题颜色已保存为预览（登录后将同步到服务器）');
        }
      } else {
        // 未登录：保存到 localStorage 并应用主题到 store（预览）
        localStorage.setItem(THEME_COLOR_STORAGE_KEY, colorPrimaryValue);
        useThemeStore.getState().applyTheme('light', { colorPrimary: colorPrimaryValue }, { persist: false });
      }
      
      setSelectedColor(colorPrimaryValue);
      
      // 调用回调（无论是否登录都更新界面）
      if (onThemeUpdate) {
        onThemeUpdate(colorPrimaryValue);
      }
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };


  // 从 themeStore 同步颜色（当其他途径更新主题时）
  const storeColorPrimary = useThemeStore((s) => s.config.colorPrimary);
  useEffect(() => {
    if (storeColorPrimary && storeColorPrimary !== selectedColor) {
      setSelectedColor(storeColorPrimary);
    }
  }, [storeColorPrimary]);

  // 组件挂载时加载主题配置
  useEffect(() => {
    loadTheme();
  }, []);

  const content = (
    <div style={{ padding: '4px 0 0 0', minWidth: '180px' }}>
      {/* 预设颜色 */}
      <Space wrap size={8}>
        {presetColors.map((color) => (
          <div
            key={color}
            onClick={() => handleColorSelect(color)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: color,
              border: selectedColor === color ? `3px solid ${color}` : '2px solid #d9d9d9',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: selectedColor === color ? `0 0 0 2px rgba(0,0,0,0.1)` : 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.2)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = selectedColor === color ? `0 0 0 2px rgba(0,0,0,0.1)` : 'none';
            }}
          />
        ))}
      </Space>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      overlayStyle={{ padding: 0 }}
    >
      {children}
    </Popover>
  );
};

export default ThemeColorEditor;

