/**
 * 参数配置布局模板
 *
 * 提供统一的参数配置布局，用于MRP/LRP参数配置等场景
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Card, Checkbox, Space, Button, Divider, theme, Typography } from 'antd';
import { ProForm, ProFormCheckbox } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { PAGE_SPACING, ANT_DESIGN_TOKENS } from './constants';

const { useToken } = theme;
const { Title, Text } = Typography;

/**
 * 参数分组
 */
export interface ParameterGroup {
  /** 分组标题 */
  title: string;
  /** 分组描述 */
  description?: string;
  /** 参数列表 */
  parameters: ParameterItem[];
}

/**
 * 参数项
 */
export interface ParameterItem {
  /** 参数键 */
  key: string;
  /** 参数标签 */
  label: string;
  /** 参数描述 */
  description?: string;
  /** 是否默认选中 */
  defaultChecked?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 参数配置模板属性
 */
export interface ParameterConfigTemplateProps {
  /** 参数分组列表 */
  groups: ParameterGroup[];
  /** 初始值 */
  initialValues?: Record<string, boolean>;
  /** 值变化回调 */
  onValuesChange?: (values: Record<string, boolean>) => void;
  /** 保存回调 */
  onSave?: (values: Record<string, boolean>) => void;
  /** 保存为模板回调 */
  onSaveAsTemplate?: (templateName: string, values: Record<string, boolean>) => void;
  /** 加载模板回调 */
  onLoadTemplate?: (templateName: string) => Record<string, boolean>;
  /** 预设模板列表 */
  presetTemplates?: Array<{ label: string; value: string }>;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 参数配置布局模板
 *
 * @example
 * ```tsx
 * <ParameterConfigTemplate
 *   groups={[
 *     {
 *       title: '库存相关参数',
 *       parameters: [
 *         { key: 'currentStock', label: '当前库存数量', defaultChecked: true },
 *       ],
 *     },
 *   ]}
 *   onSave={handleSave}
 * />
 * ```
 */
export const ParameterConfigTemplate: React.FC<ParameterConfigTemplateProps> = ({
  groups,
  initialValues,
  onValuesChange,
  onSave,
  onSaveAsTemplate,
  onLoadTemplate,
  presetTemplates = [],
  className,
  style,
}) => {
  const { t } = useTranslation();
  const { token } = useToken();

  return (
    <div
      className={className}
      style={{
        padding: `${PAGE_SPACING.PADDING}px`,
        ...style,
      }}
    >
      <ProForm
        initialValues={initialValues}
        onValuesChange={(_, values) => {
          onValuesChange?.(values);
        }}
        submitter={{
          render: (props, doms) => (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: ANT_DESIGN_TOKENS.SPACING.MD,
                borderTop: `1px solid ${token.colorBorder}`,
              }}
            >
              <Space>
                {presetTemplates.length > 0 && (
                  <Button onClick={() => {
                    // 模板选择逻辑
                  }}>
                    {t('components.layoutTemplates.parameter.loadTemplate')}
                  </Button>
                )}
              </Space>
              <Space>
                <Button onClick={() => props.form?.resetFields()}>
                  {t('components.layoutTemplates.parameter.reset')}
                </Button>
                {onSave && (
                  <Button
                    type="primary"
                    onClick={() => {
                      props.form?.validateFields().then((values) => {
                        onSave(values);
                      });
                    }}
                  >
                    {t('components.layoutTemplates.parameter.saveConfig')}
                  </Button>
                )}
                {onSaveAsTemplate && (
                  <Button
                    onClick={() => {
                      props.form?.validateFields().then((values) => {
                        const templateName = prompt(t('components.layoutTemplates.parameter.promptTemplateName'));
                        if (templateName) {
                          onSaveAsTemplate(templateName, values);
                        }
                      });
                    }}
                  >
                    {t('components.layoutTemplates.parameter.saveAsTemplate')}
                  </Button>
                )}
              </Space>
            </div>
          ),
        }}
      >
        {groups.map((group, groupIndex) => (
          <Card
            key={groupIndex}
            title={group.title}
            style={{
              marginBottom: groupIndex < groups.length - 1 ? PAGE_SPACING.BLOCK_GAP : 0,
            }}
          >
            {group.description && (
              <Text type="secondary" style={{ display: 'block', marginBottom: ANT_DESIGN_TOKENS.SPACING.MD }}>
                {group.description}
              </Text>
            )}
            <Space orientation="vertical" style={{ width: '100%' }}>
              {group.parameters.map((param) => (
                <ProFormCheckbox
                  key={param.key}
                  name={param.key}
                  label={param.label}
                  extra={param.description}
                  disabled={param.disabled}
                />
              ))}
            </Space>
          </Card>
        ))}
      </ProForm>
    </div>
  );
};

export default ParameterConfigTemplate;

