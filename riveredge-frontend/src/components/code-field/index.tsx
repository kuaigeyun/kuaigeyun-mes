/**
 * 编码字段组件
 *
 * 支持自动生成编码和手动填写，根据编码规则配置自动处理。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-19
 */

import React, { useEffect, useState, useRef } from 'react';
import { ProFormText } from '@ant-design/pro-components';
import { Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { getCodeRulePageConfig, generateCode, testGenerateCode } from '../../services/codeRule';
import type { CodeRulePageConfig } from '../../services/codeRule';

interface CodeFieldProps {
  /** 页面代码（如：kuaizhizao-sales-order） */
  pageCode: string;
  /** 字段名称（如：order_code） */
  name: string;
  /** 字段标签（如：订单编码） */
  label?: string;
  /** 是否必填 */
  required?: boolean;
  /** 表单值变化回调 */
  onChange?: (value: string) => void;
  /** 表单字段值 */
  value?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 上下文变量（用于编码规则中的字段引用） */
  context?: Record<string, any>;
  /** 是否在新建时自动生成 */
  autoGenerateOnCreate?: boolean;
  /** 是否显示生成按钮 */
  showGenerateButton?: boolean;
  /** 列属性（用于布局） */
  colProps?: { span?: number };
  /** 字段属性 */
  fieldProps?: Record<string, any>;
}

const CodeField: React.FC<CodeFieldProps> = ({
  pageCode,
  name,
  label,
  required = false,
  onChange,
  value,
  disabled = false,
  context = {},
  autoGenerateOnCreate = true,
  showGenerateButton = true,
  colProps,
  fieldProps = {},
}) => {
  const { message } = App.useApp();
  const [pageConfig, setPageConfig] = useState<CodeRulePageConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const hasGeneratedRef = useRef(false); // 防止重复生成编码

  /**
   * 生成编码
   */
  const handleGenerateCode = React.useCallback(async (config: CodeRulePageConfig, isTest = false) => {
    if (!config?.ruleCode) {
      message.warning('未配置编码规则');
      return;
    }

    try {
      setLoading(true);
      
      // 使用测试生成（不更新序号）或正式生成（更新序号）
      // 根据 pageCode 确定实体类型
      const entityTypeMap: Record<string, string> = {
        'master-data-material': 'material',
        'master-data-process-route': 'process_route',
        'master-data-engineering-bom': 'bom',
      };
      const entityType = entityTypeMap[pageCode];
      
      const response = isTest
        ? await testGenerateCode({
            rule_code: config.ruleCode,
            context,
            check_duplicate: true,
            entity_type: entityType,
          })
        : await generateCode({
            rule_code: config.ruleCode,
            context,
          });
      
      if (response.code && onChange) {
        onChange(response.code);
      }
    } catch (error: any) {
      console.error('生成编码失败:', error);
      message.error(error.message || '生成编码失败');
    } finally {
      setLoading(false);
    }
  }, [context, message, onChange]);

  // 生成编码的辅助函数
  const generateCodeWithContext = React.useCallback(async (config: CodeRulePageConfig, currentContext: Record<string, any>) => {
    if (!config?.autoGenerate || !config?.ruleCode) {
      return;
    }

    // 使用测试生成（带重复检测），避免正式生成时序号被占用
    const entityTypeMap: Record<string, string> = {
      'master-data-material': 'material',
      'master-data-process-route': 'process_route',
      'master-data-engineering-bom': 'bom',
    };
    const entityType = entityTypeMap[pageCode];
    
    // 如果没有对应的实体类型映射，不调用 API
    if (!entityType) {
      return;
    }
    
    try {
      const response = await testGenerateCode({
        rule_code: config.ruleCode,
        context: currentContext,
        check_duplicate: true,
        entity_type: entityType,
      });
      // 如果返回的编码为空，说明规则不存在或未启用，静默处理
      if (response.code) {
        if (onChange) {
          onChange(response.code);
        }
      } else {
        // 规则不存在或未启用，静默处理
        console.info(`编码规则 ${config.ruleCode} 不存在或未启用，跳过自动生成`);
      }
    } catch (error: any) {
      // 处理其他错误（网络错误等）
      const errorMessage = error?.response?.data?.detail || error?.message || error;
      console.warn('自动生成编码失败:', errorMessage);
    }
  }, [pageCode, onChange]);

  // 加载页面配置
  useEffect(() => {
    // 重置生成标志，当 pageCode 或 autoGenerateOnCreate 变化时
    hasGeneratedRef.current = false;
    
    const loadConfig = async () => {
      try {
        const config = await getCodeRulePageConfig(pageCode);
        setPageConfig(config);
        
        // 如果是新建且启用自动生成，自动生成编码
        // 注意：只在配置存在、规则代码存在、且当前值为空时才生成
        if (autoGenerateOnCreate && config?.autoGenerate && config?.ruleCode && !hasGeneratedRef.current) {
          // 检查当前值，如果已有值则不自动生成（避免覆盖用户输入）
          if (value) {
            return;
          }
          
          // 标记已生成，防止重复调用
          hasGeneratedRef.current = true;
          
          // 生成编码
          await generateCodeWithContext(config, context);
        }
      } catch (error) {
        console.error('加载编码规则配置失败:', error);
      }
    };
    loadConfig();
    // 只依赖 pageCode 和 autoGenerateOnCreate，避免无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCode, autoGenerateOnCreate]);

  // 当context变化时，如果配置了自动生成且当前值为空，重新生成编码
  // 注意：只在新建模式下，且context有实际内容时才重新生成
  useEffect(() => {
    if (!autoGenerateOnCreate || !pageConfig?.autoGenerate || !pageConfig?.ruleCode) {
      return;
    }
    
    // 如果已有值，不自动重新生成（避免覆盖用户输入）
    if (value) {
      return;
    }
    
    // 如果context为空，不生成（等待用户输入）
    if (!context || Object.keys(context).length === 0) {
      return;
    }
    
    // 延迟执行，避免在初始化时立即触发
    const timer = setTimeout(() => {
      generateCodeWithContext(pageConfig, context);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [context, pageConfig, autoGenerateOnCreate, value, generateCodeWithContext]);

  // 如果未配置编码规则，使用普通文本输入框
  if (!pageConfig || !pageConfig.autoGenerate) {
    return (
      <ProFormText
        name={name}
        label={label || pageConfig?.codeFieldLabel || '编码'}
        rules={required ? [{ required: true, message: `请输入${label || '编码'}` }] : []}
        placeholder={`请输入${label || '编码'}`}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        value={value}
        colProps={colProps}
        fieldProps={fieldProps}
      />
    );
  }

  // 是否允许手动编辑
  const canEdit = pageConfig.allowManualEdit !== false;

  // 合并 fieldProps，如果 showGenerateButton 为 false，则不添加生成按钮
  const mergedFieldProps = {
    ...fieldProps,
    ...(showGenerateButton ? {
      addonAfter: (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => handleGenerateCode(pageConfig, false)}
            disabled={disabled}
          >
            生成
          </Button>
        </Space>
      ),
    } : {}),
  };

  return (
    <ProFormText
      name={name}
      label={label || pageConfig.codeFieldLabel}
      rules={required ? [{ required: true, message: `请输入${label || pageConfig.codeFieldLabel}` }] : []}
      placeholder={canEdit ? (showGenerateButton ? `请输入${label || pageConfig.codeFieldLabel}，或点击按钮自动生成` : `请输入${label || pageConfig.codeFieldLabel}`) : '系统自动生成'}
      disabled={disabled || (!canEdit && !!value)}
      onChange={(e) => onChange?.(e.target.value)}
      value={value}
      colProps={colProps}
      fieldProps={mergedFieldProps}
      extra={
        showGenerateButton
          ? (canEdit ? '可以手动填写，也可以点击"生成"按钮自动生成' : '系统自动生成，不可手动修改')
          : (canEdit ? '可以手动填写，系统会在提交时自动生成' : '系统自动生成，不可手动修改')
      }
    />
  );
};

export default CodeField;
