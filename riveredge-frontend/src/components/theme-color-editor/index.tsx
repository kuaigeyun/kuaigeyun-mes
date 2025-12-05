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
      
      let colorPrimaryValue: string | null = null;
      
      if (hasToken) {
        // 已登录：从后端加载
        try {
          const siteSetting = await getSiteSetting();
          const themeConfig = siteSetting?.settings?.theme_config || {};
          const legacyThemeColor = siteSetting?.settings?.theme_color;
          colorPrimaryValue = legacyThemeColor || themeConfig.colorPrimary || null;
        } catch (error) {
          // 如果后端加载失败，忽略错误，继续使用 localStorage 或默认值
        }
      }
      
      // 如果后端没有颜色，尝试从 localStorage 读取（未登录时的预览颜色）
      if (!colorPrimaryValue) {
        const storedColor = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
        if (storedColor) {
          colorPrimaryValue = storedColor;
        }
      }
      
      // 如果都没有，使用当前实际使用的主题颜色或默认值
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
      
      setSelectedColor(colorPrimaryValue);
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
      
      // 确保 colorPrimary 是字符串格式
      let colorPrimaryValue = color || '#1890ff';
      if (typeof colorPrimaryValue !== 'string') {
        if (colorPrimaryValue && typeof colorPrimaryValue.toHexString === 'function') {
          colorPrimaryValue = colorPrimaryValue.toHexString();
        } else {
          colorPrimaryValue = '#1890ff';
        }
      }
      
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
          
          await updateSiteSetting({ settings });
          
          // 触发主题更新事件
          window.dispatchEvent(new CustomEvent('siteThemeUpdated', {
            detail: { themeConfig }
          }));
          
          message.success('主题颜色已更新');
        } catch (error: any) {
          // 如果后端保存失败，仍然保存到 localStorage 作为预览
          localStorage.setItem(THEME_COLOR_STORAGE_KEY, colorPrimaryValue);
          message.warning('主题颜色已保存为预览（登录后将同步到服务器）');
        }
      } else {
        // 未登录：保存到 localStorage 作为预览（不显示提示，静默保存）
        localStorage.setItem(THEME_COLOR_STORAGE_KEY, colorPrimaryValue);
        // 不显示提示，让用户专注于预览效果
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


  // 组件挂载时加载主题配置
  useEffect(() => {
    loadTheme();
    
    // 监听主题更新事件
    const handleThemeUpdate = () => {
      loadTheme();
    };
    window.addEventListener('siteThemeUpdated', handleThemeUpdate);
    return () => {
      window.removeEventListener('siteThemeUpdated', handleThemeUpdate);
    };
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

