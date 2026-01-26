/**
 * 编码字段组件
 *
 * 支持自动生成编码和手动填写，根据编码规则配置自动处理。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-19
 */

import React, { useEffect, useState } from 'react';
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
}) => {
  const { message } = App.useApp();
  const [pageConfig, setPageConfig] = useState<CodeRulePageConfig | null>(null);
  const [loading, setLoading] = useState(false);

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

  // 加载页面配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getCodeRulePageConfig(pageCode);
        setPageConfig(config);
        
        // 如果是新建且启用自动生成，自动生成编码
        if (autoGenerateOnCreate && config?.autoGenerate && config?.ruleCode && !value) {
          // 使用测试生成（带重复检测），避免正式生成时序号被占用
          const entityTypeMap: Record<string, string> = {
            'master-data-material': 'material',
            'master-data-process-route': 'process_route',
          };
          const entityType = entityTypeMap[pageCode];
          
          try {
            const response = await testGenerateCode({
              rule_code: config.ruleCode,
              context,
              check_duplicate: true,
              entity_type: entityType,
            });
            if (response.code && onChange) {
              onChange(response.code);
            }
          } catch (error: any) {
            console.warn('自动生成编码失败:', error);
          }
        }
      } catch (error) {
        console.error('加载编码规则配置失败:', error);
      }
    };
    loadConfig();
  }, [pageCode, autoGenerateOnCreate, context, onChange, value]);

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
      />
    );
  }

  // 是否允许手动编辑
  const canEdit = pageConfig.allowManualEdit !== false;

  return (
    <ProFormText
      name={name}
      label={label || pageConfig.codeFieldLabel}
      rules={required ? [{ required: true, message: `请输入${label || pageConfig.codeFieldLabel}` }] : []}
      placeholder={canEdit ? `请输入${label || pageConfig.codeFieldLabel}，或点击按钮自动生成` : '系统自动生成'}
      disabled={disabled || (!canEdit && !!value)}
      onChange={(e) => onChange?.(e.target.value)}
      value={value}
      fieldProps={{
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
      }}
      extra={
        canEdit
          ? '可以手动填写，也可以点击"生成"按钮自动生成'
          : '系统自动生成，不可手动修改'
      }
    />
  );
};

export default CodeField;
