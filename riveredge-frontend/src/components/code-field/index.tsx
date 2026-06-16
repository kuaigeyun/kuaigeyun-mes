/**
 * 编号字段组件
 *
 * 支持自动生成编号和手动填写，根据编号规则配置自动处理。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-19
 */

import React, { useEffect, useState, useRef } from 'react';
import { ProFormText } from '@ant-design/pro-components';
import { Button, Form, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { getCodeRulePageConfig, generateCode, testGenerateCode } from '../../services/codeRule';
import type { CodeRulePageConfig } from '../../services/codeRule';

interface CodeFieldProps {
  /** 页面代码（如：kuaizhizao-sales-order） */
  pageCode: string;
  /** 字段名称（如：order_code） */
  name: string;
  /** 字段标签（如：订单编号） */
  label?: string;
  /** 是否必填 */
  required?: boolean;
  /** 表单值变化回调 */
  onChange?: (value: string) => void;
  /** 表单字段值 */
  value?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 上下文变量（用于编号规则中的字段引用） */
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
  showGenerateButton = false,
  colProps,
  fieldProps = {},
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const form = Form.useFormInstance();
  const [pageConfig, setPageConfig] = useState<CodeRulePageConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const hasGeneratedRef = useRef(false); // 防止重复生成编号

  const updateFormValue = React.useCallback((code: string) => {
    if (onChange) {
      onChange(code);
    } else if (form) {
      form.setFieldsValue({ [name]: code });
    }
  }, [form, name, onChange]);

  /**
   * 生成编号
   */
  const handleGenerateCode = React.useCallback(async (config: CodeRulePageConfig, isTest = false) => {
    if (!config?.ruleCode) {
      message.warning(t('components.codeField.ruleNotConfigured'));
      return;
    }

    try {
      setLoading(true);
      
      // 使用测试生成（不更新序号）或正式生成（更新序号）
      const entityTypeMap: Record<string, string> = {
        'master-data-material': 'material',
        'master-data-process-route': 'process_route',
        'master-data-engineering-bom': 'bom',
        'master-data-factory-work-center': 'work_center',
        'kuaizhizao-sales-order': 'sales_order',
        'kuaizhizao-production-work-order': 'work_order',
        'kuaizhizao-equipment-management-equipment': 'equipment',
        'kuaizhizao-equipment-management-mold': 'mold',
        'kuaizhizao-equipment-management-tool': 'tool',
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
      
      if (response.code) {
        updateFormValue(response.code);
      }
    } catch (error: any) {
      console.error('生成编号失败:', error);
      message.error(error.message || t('components.codeField.generateFailed'));
    } finally {
      setLoading(false);
    }
  }, [context, message, t, updateFormValue]);

  // 生成编号的辅助函数
  const generateCodeWithContext = React.useCallback(async (config: CodeRulePageConfig, currentContext: Record<string, any>) => {
    if (!config?.autoGenerate || !config?.ruleCode) {
      return;
    }

    // 使用测试生成（带重复检测），避免正式生成时序号被占用
    const entityTypeMap: Record<string, string> = {
      'master-data-material': 'material',
      'master-data-process-route': 'process_route',
      'master-data-engineering-bom': 'bom',
      'master-data-factory-work-center': 'work_center',
      'kuaizhizao-sales-order': 'sales_order',
      'kuaizhizao-production-work-order': 'work_order',
      'kuaizhizao-equipment-management-equipment': 'equipment',
      'kuaizhizao-equipment-management-mold': 'mold',
      'kuaizhizao-equipment-management-tool': 'tool',
    };
    const entityType = entityTypeMap[pageCode];
    
    // 若无实体类型映射，仍可调用生成接口（不传 entity_type，仅预生成不校验重复）
    // 有映射时传 entity_type 以做重复校验
    
    try {
      const response = await testGenerateCode({
        rule_code: config.ruleCode,
        context: currentContext,
        check_duplicate: true,
        entity_type: entityType,
      });
      if (response.code) {
        updateFormValue(response.code);
      } else {
        // 规则不存在或未启用，静默处理
        console.info(`编号规则 ${config.ruleCode} 不存在或未启用，跳过自动生成`);
      }
    } catch (error: any) {
      // 处理其他错误（网络错误等）
      const errorMessage = error?.response?.data?.detail || error?.message || error;
      console.warn('自动生成编号失败:', errorMessage);
    }
  }, [pageCode, updateFormValue]);

  // 加载页面配置
  useEffect(() => {
    // 重置生成标志，当 pageCode 或 autoGenerateOnCreate 变化时
    hasGeneratedRef.current = false;
    
    const loadConfig = async () => {
      try {
        const config = await getCodeRulePageConfig(pageCode);
        setPageConfig(config);
        
        // 如果是新建且启用自动生成，自动生成编号
        // 注意：只在配置存在、规则代码存在、且当前值为空时才生成
        if (autoGenerateOnCreate && config?.autoGenerate && config?.ruleCode && !hasGeneratedRef.current) {
          // 检查当前值，如果已有值则不自动生成（避免覆盖用户输入）
          if (value) {
            return;
          }
          
          // 标记已生成，防止重复调用
          hasGeneratedRef.current = true;
          
          // 生成编号
          await generateCodeWithContext(config, context);
        }
      } catch (error) {
        console.error('加载编号规则配置失败:', error);
      }
    };
    loadConfig();
    // 只依赖 pageCode 和 autoGenerateOnCreate，避免无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCode, autoGenerateOnCreate]);

  // 当context变化时，如果配置了自动生成且当前值为空，重新生成编号
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

  // 如果未配置编号规则，使用普通文本输入框
  if (!pageConfig || !pageConfig.autoGenerate) {
    const fieldLabel = label || pageConfig?.codeFieldLabel || t('components.codeField.defaultLabel');
    return (
      <ProFormText
        name={name}
        label={fieldLabel}
        rules={required ? [{ required: true, message: t('components.codeField.required', { label: fieldLabel }) }] : []}
        placeholder={t('components.codeField.enterPlaceholder', { label: fieldLabel })}
        disabled={disabled}
        colProps={colProps}
        fieldProps={{
          ...fieldProps,
          value: value,
          onChange: (e: any) => onChange?.(e.target.value),
        }}
      />
    );
  }

  // 是否允许手动编辑
  const canEdit = pageConfig.allowManualEdit !== false;

  const fieldLabel = label || pageConfig.codeFieldLabel || t('components.codeField.defaultLabel');

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
            {t('components.codeField.generate')}
          </Button>
        </Space>
      ),
    } : {}),
  };

  return (
    <ProFormText
      name={name}
      label={fieldLabel}
      rules={required ? [{ required: true, message: t('components.codeField.required', { label: fieldLabel }) }] : []}
      placeholder={t('components.codeField.enterPlaceholder', { label: fieldLabel })}
      disabled={disabled || (!canEdit && !!value)}
      colProps={colProps}
      fieldProps={{
        ...mergedFieldProps,
        value: value,
        onChange: (e: any) => onChange?.(e.target.value),
      }}
      extra={undefined}
    />
  );
};

export default CodeField;
