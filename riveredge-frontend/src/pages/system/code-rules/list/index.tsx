/**
 * 编码规则管理页面
 * 
 * 用于系统管理员为功能页面配置编码规则。
 * 支持为每个功能页面直接配置编码规则，实现自动编码功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Button, Tag, Alert, Typography, Input, theme, Card, Space, Radio, Divider, Collapse, Spin } from 'antd';
import { PAGE_SPACING } from '../../../../components/layout-templates/constants';
import { SearchOutlined, DatabaseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  getCodeRuleList,
  createCodeRule,
  updateCodeRule,
  getCodeRulePages,
  CodeRule,
  CreateCodeRuleData,
  UpdateCodeRuleData,
  CodeRulePageConfig,
} from '../../../../services/codeRule';
import { PAGE_CODE_TO_FIXED_TEXT_PRESET } from '../../../../config/codeRulePages';
import { apiRequest } from '../../../../services/api';
import CodeRuleComponentBuilder from '../../../../components/code-rule-component-builder';
import {
  CodeRuleComponent,
  createDefaultAutoCounterComponent,
  createDefaultDateComponent,
  FixedTextComponent,
} from '../../../../types/codeRuleComponent';
import {
  CodeRuleComponentService,
} from '../../../../utils/codeRuleComponent';

const { Text, Paragraph } = Typography;

/**
 * 编码规则管理列表页面组件
 */
const CodeRuleListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();

  // 功能页面配置状态（左右结构）
  const [pageConfigs, setPageConfigs] = useState<CodeRulePageConfig[]>([]);
  const [codeRules, setCodeRules] = useState<CodeRule[]>([]);
  const [selectedPageCode, setSelectedPageCode] = useState<string | null>(null);
  const [pageSearchValue, setPageSearchValue] = useState<string>('');
  const [pageConfigsLoading, setPageConfigsLoading] = useState(true);

  // 页面规则配置表单状态
  const pageRuleFormRef = useRef<ProFormInstance>();
  const [pageRuleFormLoading, setPageRuleFormLoading] = useState(false);

  // 表达式构建器状态（旧格式，向后兼容）
  const [expressionMode, setExpressionMode] = useState<'component' | 'advanced'>('component');
  const [expressionBuilder, setExpressionBuilder] = useState({
    prefix: '',
    dateFormat: 'YYYYMMDD',
    separator: '-',
    seqFormat: '4',
    suffix: '',
    fields: [] as string[], // 选中的字段列表
  });

  // 规则组件状态（新格式）
  const [ruleComponents, setRuleComponents] = useState<CodeRuleComponent[]>([]);

  /**
   * 根据构建器配置生成表达式
   */
  const buildExpressionFromBuilder = (builder: typeof expressionBuilder): string => {
    const parts: string[] = [];

    // 前缀
    if (builder.prefix) {
      parts.push(builder.prefix);
    }

    // 字段引用（在前缀之后、日期之前）
    if (builder.fields && builder.fields.length > 0) {
      builder.fields.forEach(field => {
        if (parts.length > 0 && builder.separator) {
          parts.push(builder.separator);
        }
        parts.push(`{FIELD:${field}}`);
      });
    }

    // 日期格式
    if (builder.dateFormat !== 'none') {
      if (parts.length > 0 && builder.separator) {
        parts.push(builder.separator);
      }
      const dateMap: Record<string, string> = {
        'YYYYMMDD': '{YYYY}{MM}{DD}',
        'YYYYMM': '{YYYY}{MM}',
        'YYYY': '{YYYY}',
        'YYMMDD': '{YY}{MM}{DD}',
        'YYMM': '{YY}{MM}',
        'YY': '{YY}',
      };
      parts.push(dateMap[builder.dateFormat] || '');
    }

    // 分隔符和序号
    if (builder.seqFormat && builder.seqFormat !== 'none') {
      if (parts.length > 0 && builder.separator) {
        parts.push(builder.separator);
      }
      const seqWidth = parseInt(builder.seqFormat);
      if (seqWidth > 0) {
        parts.push(`{SEQ:${seqWidth}}`);
      } else {
        parts.push('{SEQ}');
      }
    }

    // 后缀
    if (builder.suffix) {
      if (parts.length > 0 && builder.separator) {
        parts.push(builder.separator);
      }
      parts.push(builder.suffix);
    }

    return parts.join('');
  };

  /**
   * 解析表达式到构建器配置
   */
  const parseExpressionToBuilder = (expression: string): typeof expressionBuilder => {
    // 简单的解析逻辑，尝试识别常见模式
    const builder = {
      prefix: '',
      dateFormat: 'YYYYMMDD',
      separator: '-',
      seqFormat: '4',
      suffix: '',
      fields: [] as string[],
    };

    // 解析字段引用 {FIELD:field_name}
    const fieldPattern = /\{FIELD:([^}]+)\}/g;
    const fieldMatches = expression.matchAll(fieldPattern);
    const fields: string[] = [];
    for (const match of fieldMatches) {
      fields.push(match[1]);
    }
    builder.fields = fields;

    // 匹配日期格式
    if (expression.includes('{YYYY}{MM}{DD}')) {
      builder.dateFormat = 'YYYYMMDD';
    } else if (expression.includes('{YYYY}{MM}')) {
      builder.dateFormat = 'YYYYMM';
    } else if (expression.includes('{YYYY}')) {
      builder.dateFormat = 'YYYY';
    } else if (expression.includes('{YY}{MM}{DD}')) {
      builder.dateFormat = 'YYMMDD';
    } else if (expression.includes('{YY}{MM}')) {
      builder.dateFormat = 'YYMM';
    } else if (expression.includes('{YY}')) {
      builder.dateFormat = 'YY';
    } else {
      builder.dateFormat = 'none';
    }

    // 匹配序号格式
    const seqMatch = expression.match(/\{SEQ:(\d+)\}/);
    if (seqMatch) {
      builder.seqFormat = seqMatch[1];
    } else if (expression.includes('{SEQ}')) {
      builder.seqFormat = '0';
    } else {
      builder.seqFormat = 'none';
    }

    // 提取前缀和后缀（简单处理）
    const datePattern = /\{Y{2,4}\}\{M{2}\}\{D{2}\}|\{Y{2,4}\}\{M{2}\}|\{Y{2,4}\}/;
    const seqPattern = /\{SEQ(?::\d+)?\}/;
    const beforeDate = expression.split(datePattern)[0];
    const afterSeq = expression.split(seqPattern).pop() || '';

    if (beforeDate && !beforeDate.match(/[\{\}]/)) {
      builder.prefix = beforeDate.replace(/[-_]/g, '').trim();
    }
    if (afterSeq && !afterSeq.match(/[\{\}]/)) {
      builder.suffix = afterSeq.replace(/[-_]/g, '').trim();
    }

    // 提取分隔符
    const separatorMatch = expression.match(/[-\_]/);
    if (separatorMatch) {
      builder.separator = separatorMatch[0];
    }

    return builder;
  };

  /**
   * 获取所有编码规则（包括禁用的）
   */
  const getAllCodeRules = async (): Promise<CodeRule[]> => {
    try {
      // 后端 API 返回的是 List[CodeRuleResponse]（直接是数组），不是分页格式
      // 直接调用 API 获取列表，使用 skip 和 limit 参数
      const response = await apiRequest<CodeRule[]>('/core/code-rules', {
        params: {
          skip: 0,
          limit: 1000,
          // 不传递 is_active 参数，获取所有规则（包括禁用的）
        },
      });

      // 后端直接返回数组
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('获取编码规则列表失败:', error);
      return [];
    }
  };

  /**
   * 加载页面配置列表
   */
  const loadPageConfigs = async () => {
    try {
      setPageConfigsLoading(true);
      const pages = await getCodeRulePages();

      // 合并保存的配置和默认配置，确保所有页面都存在
      const savedConfigs = localStorage.getItem('codeRulePageConfigs');
      if (savedConfigs) {
        try {
          const parsed = JSON.parse(savedConfigs);
          const mergedConfigs = pages.map(defaultPage => {
            const savedPage = parsed.find((p: any) => p.pageCode === defaultPage.pageCode);
            if (savedPage) {
              // 合并保存的配置，确保保存的字段（如 ruleCode, autoGenerate）覆盖默认配置
              return {
                ...defaultPage,
                // 只覆盖保存的字段，其他字段使用默认值
                ruleCode: savedPage.ruleCode ?? defaultPage.ruleCode,
                autoGenerate: savedPage.autoGenerate ?? defaultPage.autoGenerate,
              };
            }
            return defaultPage;
          });
          setPageConfigs(mergedConfigs);

          // 默认选中第一个页面（仅当没有选中页面时）
          if (mergedConfigs.length > 0) {
            setPageConfigs(mergedConfigs);
            const currentSelected = selectedPageCode || null;
            if (!currentSelected) {
              const firstPageCode = mergedConfigs[0].pageCode;
              setSelectedPageCode(firstPageCode);
              // 延迟初始化表单，确保 codeRules 加载完成后再加载规则
              setTimeout(() => {
                const firstPageConfig = mergedConfigs.find(p => p.pageCode === firstPageCode);
                if (firstPageConfig?.ruleCode) {
                  setTimeout(() => {
                    handleSelectPage(firstPageCode);
                  }, 200);
                } else {
                  resetPageRuleForm(firstPageCode);
                }
              }, 100);
            }
          } else {
            setPageConfigs(mergedConfigs);
          }
        } catch (error) {
          console.error('加载功能页面配置失败:', error);
          setPageConfigs(pages);
        }
      } else {
        setPageConfigs(pages);

        // 如果没有保存的配置，默认选中第一个页面（仅当没有选中页面时）
        if (pages.length > 0) {
          const currentSelected = selectedPageCode || null;
          if (!currentSelected) {
            const firstPageCode = pages[0].pageCode;
            setSelectedPageCode(firstPageCode);
            // 延迟初始化表单，等待 codeRules 加载完成后再加载规则
            setTimeout(() => {
              const firstPageConfig = pages.find(p => p.pageCode === firstPageCode);
              if (firstPageConfig?.ruleCode) {
                setTimeout(() => {
                  handleSelectPage(firstPageCode);
                }, 200);
              } else {
                resetPageRuleForm(firstPageCode);
              }
            }, 100);
          }
        }
      }
    } catch (error: any) {
      console.error('加载页面配置列表失败:', error);
      messageApi.error('加载页面配置失败');
    } finally {
      setPageConfigsLoading(false);
    }
  };

  /**
   * 加载编码规则列表（用于功能页面配置，只加载激活的规则用于显示）
   */
  const loadCodeRules = async (reloadPage?: boolean) => {
    try {
      const allRules = await getAllCodeRules();
      // 只保存激活的规则到 state（用于显示）
      const activeRules = allRules.filter(rule => rule.is_active);
      setCodeRules(activeRules);

      // 如果指定了重新加载页面且当前有选中的页面，重新加载该页面的规则
      if (reloadPage && selectedPageCode) {
        setTimeout(() => {
          handleSelectPage(selectedPageCode);
        }, 100);
      }
    } catch (error: any) {
      console.error('加载编码规则列表失败:', error);
    }
  };

  // 初始化加载页面配置和编码规则
  useEffect(() => {
    loadPageConfigs();
    loadCodeRules();
  }, []);

  /**
   * 处理选择功能页面
   */
  const handleSelectPage = async (pageCode: string) => {
    setSelectedPageCode(pageCode);

    // 延迟加载规则，确保规则列表已加载
    setTimeout(async () => {
      // 加载该页面对应的编码规则
      const pageConfig = pageConfigs.find(p => p.pageCode === pageCode);
      // 如果没有指定 ruleCode，使用 pageCode 生成（与后端逻辑一致）
      const ruleCode = pageConfig?.ruleCode || pageCode.toUpperCase().replace(/-/g, '_');
      if (ruleCode) {
        try {
          // 从所有规则中查找（包括禁用的规则）
          const allRules = await getAllCodeRules();
          const rule = allRules.find(r => r.code === ruleCode);
          if (rule) {
            // 如果规则存在，加载规则数据到表单
            pageRuleFormRef.current?.setFieldsValue({
              name: rule.name,
              code: rule.code,
              expression: rule.expression,
              description: rule.description,
              seq_start: rule.seq_start,
              seq_step: rule.seq_step,
              seq_reset_rule: rule.seq_reset_rule,
              is_active: rule.is_active,
            });

            // 优先使用新格式（rule_components），如果没有则解析表达式
            if (rule.rule_components && Array.isArray(rule.rule_components) && rule.rule_components.length > 0) {
              setRuleComponents(rule.rule_components);
              setExpressionMode('component');
            } else if (rule.expression) {
              // 解析旧表达式格式为组件格式
              const components = CodeRuleComponentService.expressionToComponents(rule.expression);
              setRuleComponents(components);
              setExpressionMode('component');
              // 同时保留旧格式的解析（向后兼容）
              const parsed = parseExpressionToBuilder(rule.expression);
              setExpressionBuilder(parsed);
            } else {
              // 如果没有表达式，使用默认组件
              const defaultComponents = [createDefaultAutoCounterComponent(0)];
              setRuleComponents(defaultComponents);
              setExpressionMode('component');
            }
          } else {
            // 如果规则不存在，使用预设的默认规则组件（根据页面类型）
            // 基础数据：功能缩写+流水号
            // 业务单据：功能缩写+年月日+流水号
            const isBusinessDocument = pageCode.startsWith('kuaizhizao-');
            let defaultComponents: CodeRuleComponent[];

            if (isBusinessDocument) {
              // 业务单据：功能缩写+年月日+流水号
              defaultComponents = [
                createDefaultDateComponent(0, 'YYYYMMDD'),
                createDefaultAutoCounterComponent(1, 4, 'daily'),
              ];
            } else {
              // 基础数据：汉语拼音缩写+流水号
              const abbreviation = PAGE_CODE_TO_FIXED_TEXT_PRESET[pageCode] ?? 'ZM';
              defaultComponents = [
                {
                  type: 'fixed_text',
                  order: 0,
                  text: abbreviation,
                } as FixedTextComponent,
                createDefaultAutoCounterComponent(1, 4, 'never'),
              ];
            }

            setRuleComponents(defaultComponents);
            setExpressionMode('component');

            // 生成表达式（向后兼容）
            const defaultExpression = CodeRuleComponentService.componentsToExpression(defaultComponents);
            pageRuleFormRef.current?.setFieldsValue({
              name: `${pageConfig?.pageName || ''}编码规则`,
              code: ruleCode, // 使用生成的规则代码
              expression: defaultExpression,
              description: `自动为${pageConfig?.pageName || ''}生成编码`,
              seq_start: 1,
              seq_step: 1,
              seq_reset_rule: isBusinessDocument ? 'daily' : 'never',
              is_active: true,
            });
          }
        } catch (error) {
          console.error('加载规则失败:', error);
          resetPageRuleForm(pageCode);
        }
      } else {
        // 如果没有关联规则，重置表单
        resetPageRuleForm(pageCode);
      }
    }, 100);
  };

  /**
   * 重置页面规则表单
   */
  const resetPageRuleForm = (pageCode: string) => {
    // 从 pageConfigs 中查找页面配置
    const pageConfig = pageConfigs.find(p => p.pageCode === pageCode) ||
      pageConfigs.find(p => p.pageCode === pageCode);
    const defaultRuleCode = `auto-${pageCode}`;
    const defaultExpression = '{YYYY}{MM}{DD}-{SEQ:4}';
    pageRuleFormRef.current?.setFieldsValue({
      name: `${pageConfig?.pageName || ''}编码规则`,
      code: defaultRuleCode,
      expression: defaultExpression,
      description: `自动为${pageConfig?.pageName || ''}生成编码`,
      seq_start: 1,
      seq_step: 1,
      seq_reset_rule: 'never',
      is_active: true,
    });
    // 初始化规则组件（新格式）
    const defaultComponents = CodeRuleComponentService.expressionToComponents(defaultExpression);
    setRuleComponents(defaultComponents);
    setExpressionMode('component');
    // 同时保留旧格式的解析（向后兼容）
    const parsed = parseExpressionToBuilder(defaultExpression);
    setExpressionBuilder(parsed);
  };

  /**
   * 处理保存页面规则配置
   */
  const handleSavePageRule = async () => {
    if (!selectedPageCode) return;

    try {
      setPageRuleFormLoading(true);
      const values = await pageRuleFormRef.current?.validateFields();

      if (!values) return;

      const pageConfig = pageConfigs.find(p => p.pageCode === selectedPageCode);
      if (!pageConfig) return;

      // 准备保存数据
      const saveData: CreateCodeRuleData | UpdateCodeRuleData = {
        ...values,
      };

      // 如果使用组件模式，将组件转换为表达式（向后兼容），同时保存组件格式
      if (expressionMode === 'component' && ruleComponents.length > 0) {
        // 保存新格式（rule_components）
        saveData.rule_components = ruleComponents;
        // 同时生成表达式（向后兼容）
        const expression = CodeRuleComponentService.componentsToExpression(ruleComponents);
        saveData.expression = expression;

        // 从自动计数组件读取seq_start和seq_reset_rule（向后兼容）
        const counterComponent = ruleComponents.find(c => c.type === 'auto_counter') as any;
        if (counterComponent) {
          saveData.seq_start = counterComponent.initial_value || 1;
          saveData.seq_reset_rule = counterComponent.reset_cycle || 'never';
        }
      } else if (values.expression) {
        // 如果使用高级模式，尝试将表达式解析为组件格式
        const components = CodeRuleComponentService.expressionToComponents(values.expression);
        if (components.length > 0) {
          saveData.rule_components = components;
        }
      }

      // 获取所有规则（包括禁用的），用于检查规则是否已存在
      const allRules = await getAllCodeRules();

      // 检查规则是否已存在（通过规则代码查找，包括所有状态的规则）
      const existingRule = allRules.find(r => r.code === values.code);

      if (existingRule) {
        // 规则已存在，更新现有规则
        try {
          await updateCodeRule(existingRule.uuid, saveData as UpdateCodeRuleData);
          messageApi.success('规则更新成功');
        } catch (updateError: any) {
          // 更新失败，显示错误信息
          const errorMessage = updateError?.message || updateError?.error?.message || String(updateError);
          console.error('更新规则失败:', updateError);
          messageApi.error(`更新规则失败: ${errorMessage}`);
          throw updateError;
        }
      } else {
        // 规则不存在，尝试创建新规则
        try {
          await createCodeRule(saveData as CreateCodeRuleData);
          messageApi.success('规则创建成功');
        } catch (createError: any) {
          // 如果创建失败，可能是规则代码已存在（并发情况或其他原因）
          const errorMessage = createError?.message || createError?.error?.message || String(createError);
          const isDuplicateError = errorMessage.includes('已存在') ||
            errorMessage.includes('exists') ||
            errorMessage.includes('duplicate') ||
            errorMessage.includes('unique');

          if (isDuplicateError) {
            // 重新获取所有规则，可能规则刚刚被创建或之前查询有遗漏
            const reloadRules = await getAllCodeRules();
            const ruleAfterReload = reloadRules.find(r => r.code === values.code);

            if (ruleAfterReload) {
              // 如果找到了，更新它
              try {
                await updateCodeRule(ruleAfterReload.uuid, saveData as UpdateCodeRuleData);
                messageApi.success('规则更新成功');
              } catch (updateError: any) {
                const updateErrorMessage = updateError?.message || updateError?.error?.message || String(updateError);
                console.error('更新规则失败:', updateError);
                messageApi.error(`更新规则失败: ${updateErrorMessage}`);
                throw updateError;
              }
            } else {
              // 如果还是找不到，可能是数据库约束问题或其他原因
              console.error('规则代码已存在但无法找到:', {
                ruleCode: values.code,
                allRulesCount: reloadRules.length,
                allRuleCodes: reloadRules.map(r => r.code),
                error: createError
              });
              messageApi.error(`规则代码 "${values.code}" 已存在，但无法找到该规则。请刷新页面后重试。`);
              throw createError;
            }
          } else {
            // 其他错误直接抛出
            console.error('创建规则失败:', createError);
            messageApi.error(`创建规则失败: ${errorMessage}`);
            throw createError;
          }
        }
      }

      // 重新加载规则列表（不重新加载页面，避免循环）
      await loadCodeRules(false);

      // 更新页面配置，关联规则代码并启用自动编码
      handleUpdatePageConfig(selectedPageCode, {
        autoGenerate: true,
        ruleCode: values.code,
      });

      // 重新加载当前页面的规则，确保表单显示最新数据
      setTimeout(() => {
        handleSelectPage(selectedPageCode);
      }, 200);

    } catch (error: any) {
      const errorMessage = error?.message || error?.error?.message || '保存规则失败';
      messageApi.error(errorMessage);
      console.error('保存规则失败:', error);
    } finally {
      setPageRuleFormLoading(false);
    }
  };

  /**
   * 获取过滤后的功能页面列表
   */
  const getFilteredPages = () => {
    if (!pageConfigs || pageConfigs.length === 0) {
      return [];
    }
    if (!pageSearchValue.trim()) {
      return pageConfigs;
    }
    const searchLower = pageSearchValue.toLowerCase();
    return pageConfigs.filter(page =>
      page?.pageName?.toLowerCase().includes(searchLower) ||
      page?.codeFieldLabel?.toLowerCase().includes(searchLower) ||
      page?.pagePath?.toLowerCase().includes(searchLower) ||
      page?.module?.toLowerCase().includes(searchLower)
    );
  };

  /**
   * 获取所有模块列表
   */
  const getCodeRuleModules = (): string[] => {
    const modules = new Set<string>();
    pageConfigs.forEach(page => {
      if (page.module) {
        modules.add(page.module);
      }
    });
    return Array.from(modules);
  };

  /**
   * 根据模块分组页面配置
   */
  const getCodeRulePagesByModule = (): Record<string, CodeRulePageConfig[]> => {
    const grouped: Record<string, CodeRulePageConfig[]> = {};
    pageConfigs.forEach(page => {
      if (!grouped[page.module]) {
        grouped[page.module] = [];
      }
      grouped[page.module].push(page);
    });
    return grouped;
  };

  /**
   * 获取当前选中的页面配置
   */
  const getSelectedPageConfig = (): CodeRulePageConfig | undefined => {
    if (!selectedPageCode) return undefined;
    return pageConfigs.find(page => page.pageCode === selectedPageCode);
  };

  /**
   * 处理更新功能页面配置
   */
  const handleUpdatePageConfig = (pageCode: string, updates: Partial<CodeRulePageConfig>) => {
    setPageConfigs(prev => {
      const updated = prev.map(page =>
        page.pageCode === pageCode ? { ...page, ...updates } : page
      );
      // 保存到 localStorage（实际应该保存到后端）
      // 只保存需要持久化的字段，避免保存过多数据
      const configsToSave = updated.map(page => ({
        pageCode: page.pageCode,
        ruleCode: page.ruleCode,
        autoGenerate: page.autoGenerate,
      }));
      localStorage.setItem('codeRulePageConfigs', JSON.stringify(configsToSave));
      return updated;
    });
    messageApi.success('配置已保存');
  };


  // 获取过滤后的页面列表和选中的页面配置
  const filteredPages = getFilteredPages();
  const selectedPage = getSelectedPageConfig();

  return (
    <>
      {/* 设置 Radio.Button 默认高度为 32px */}
      <style>{`
        .code-rule-management-page .ant-radio-button-wrapper {
          height: 32px !important;
          line-height: 30px !important;
        }
        .code-rule-management-page .ant-radio-button-wrapper span {
          line-height: 30px !important;
        }
      `}</style>
      <div
        className="code-rule-management-page"
        style={{
          display: 'flex',
          height: '100%',
          padding: `0 ${PAGE_SPACING?.PADDING || 16}px ${PAGE_SPACING?.PADDING || 16}px ${PAGE_SPACING?.PADDING || 16}px`,
          margin: 0,
          boxSizing: 'border-box',
          borderRadius: token.borderRadiusLG || token.borderRadius,
          overflow: 'hidden',
        }}
      >
        {/* 功能页面编码规则配置 - 左右结构 */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            borderRadius: token.borderRadiusLG || token.borderRadius,
            overflow: 'hidden',
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          {/* 左侧功能页面列表：固定宽度不参与收缩，由右侧区域伸缩 */}
          <div
            style={{
              width: '300px',
              minWidth: '300px',
              flexShrink: 0,
              borderRight: `1px solid ${token.colorBorder}`,
              backgroundColor: token.colorFillAlter || '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderTopLeftRadius: token.borderRadiusLG || token.borderRadius,
              borderBottomLeftRadius: token.borderRadiusLG || token.borderRadius,
            }}
          >
            {/* 搜索栏 */}
            <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
              <Input
                placeholder="搜索功能页面"
                prefix={<SearchOutlined />}
                value={pageSearchValue}
                onChange={(e) => setPageSearchValue(e.target.value)}
                allowClear
                size="middle"
              />
            </div>

            {/* 功能页面列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {pageConfigsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px', color: token.colorTextSecondary }}>
                    加载页面配置中...
                  </div>
                </div>
              ) : (
                <>
                  {/* 提示：如果页面配置数量较少，提示可能遗漏的页面 */}
                  {pageConfigs.length < 30 && (
                    <Alert
                      message="提示"
                      description={
                        <div>
                          <p style={{ margin: 0, marginBottom: '8px' }}>
                            如果发现新增的单据页面未显示在此列表中，请检查：
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                            <li>是否在页面代码中使用了 <code>isAutoGenerateEnabled</code> 或 <code>getPageRuleCode</code></li>
                            <li>是否在后端配置文件 <code>code_rule_pages.py</code> 中添加了页面配置</li>
                            <li>是否在前端配置文件 <code>codeRulePages.ts</code> 中添加了页面配置</li>
                          </ul>
                          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: token.colorTextSecondary }}>
                            💡 建议：新增单据页面时，请同步更新编码规则配置文件
                          </p>
                        </div>
                      }
                      type="info"
                      showIcon
                      closable
                      style={{ marginBottom: '12px', fontSize: '12px' }}
                    />
                  )}
                  {getCodeRuleModules().map(module => {
                    const modulePages = (filteredPages || []).filter(page => page?.module === module);
                    if (modulePages.length === 0) return null;

                    return (
                      <div key={module} style={{ marginBottom: '16px' }}>
                        <div
                          style={{
                            padding: '8px 12px',
                            fontWeight: 500,
                            fontSize: '14px',
                            color: token.colorTextHeading,
                            backgroundColor: token.colorFillSecondary,
                            borderRadius: token.borderRadius,
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <DatabaseOutlined />
                          {module}
                        </div>
                        {modulePages.map(page => {
                          const isSelected = selectedPageCode === page.pageCode;
                          const currentPageConfig = pageConfigs.find(p => p.pageCode === page.pageCode);
                          return (
                            <div
                              key={page.pageCode}
                              onClick={() => handleSelectPage(page.pageCode)}
                              style={{
                                padding: '12px',
                                marginBottom: '4px',
                                cursor: 'pointer',
                                borderRadius: token.borderRadius,
                                backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
                                border: isSelected ? `1px solid ${token.colorPrimary}` : `1px solid transparent`,
                                transition: 'all 0.2s',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = token.colorFillSecondary;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: isSelected ? 500 : 400, marginBottom: '4px' }}>
                                  {page.pageName}
                                </div>
                                <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                                  {page.codeFieldLabel}
                                </div>
                              </div>
                              {currentPageConfig?.autoGenerate && (
                                <Tag color="success" size="small" style={{ marginLeft: '8px' }}>
                                  已启用
                                </Tag>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* 右侧配置区域：占据剩余空间，不足时可收缩并滚动 */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: token.colorBgContainer,
              borderTopRightRadius: token.borderRadiusLG || token.borderRadius,
              borderBottomRightRadius: token.borderRadiusLG || token.borderRadius,
            }}
          >
            {selectedPage ? (
              <>
                {/* 顶部标题栏 */}
                <div
                  style={{
                    borderBottom: `1px solid ${token.colorBorder}`,
                    padding: '16px',
                    backgroundColor: token.colorFillAlter,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                      {selectedPage.pageName}
                    </div>
                    <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                      {selectedPage.pagePath}
                    </div>
                  </div>
                  <Button
                    type="primary"
                    loading={pageRuleFormLoading}
                    onClick={handleSavePageRule}
                  >
                    保存规则
                  </Button>
                </div>

                {/* 配置表单 */}
                <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                  <Card
                    title="编码规则配置"
                    size="small"
                  >
                    <ProForm
                      formRef={pageRuleFormRef}
                      submitter={false}
                      layout="vertical"
                      initialValues={{
                        seq_start: 1,
                        seq_step: 1,
                        seq_reset_rule: 'never',
                        is_active: true,
                      }}
                    >
                      <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: token.colorFillAlter, borderRadius: token.borderRadius }}>
                        <div style={{ fontSize: '12px', color: token.colorTextSecondary, marginBottom: '4px' }}>
                          编码字段
                        </div>
                        <div style={{ fontWeight: 500 }}>
                          {selectedPage.codeFieldLabel} ({selectedPage.codeField})
                        </div>
                      </div>

                      {/* 隐藏字段：规则名称和规则代码，自动填充 */}
                      <ProFormText
                        name="name"
                        hidden
                        rules={[{ required: true, message: '请输入规则名称' }]}
                      />

                      <ProFormText
                        name="code"
                        hidden
                        rules={[{ required: true, message: '请输入规则代码' }]}
                      />

                      <div>
                        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontWeight: 500 }}>规则表达式</label>
                          <Radio.Group
                            value={expressionMode}
                            onChange={(e) => {
                              setExpressionMode(e.target.value);
                              if (e.target.value === 'component') {
                                // 切换到组件模式时，尝试解析当前表达式为组件
                                const currentExpression = pageRuleFormRef.current?.getFieldValue('expression') || '';
                                if (currentExpression) {
                                  const components = CodeRuleComponentService.expressionToComponents(currentExpression);
                                  setRuleComponents(components);
                                  // 同时更新旧格式的构建器（向后兼容）
                                  const parsed = parseExpressionToBuilder(currentExpression);
                                  setExpressionBuilder(parsed);
                                } else if (ruleComponents.length === 0) {
                                  // 如果没有组件，创建默认组件
                                  const defaultComponents = [createDefaultAutoCounterComponent(0)];
                                  setRuleComponents(defaultComponents);
                                }
                              }
                            }}
                            size="small"
                          >
                            <Radio.Button value="component">组件配置</Radio.Button>
                            <Radio.Button value="advanced">高级模式</Radio.Button>
                          </Radio.Group>
                        </div>

                        {expressionMode === 'component' ? (
                          <div style={{ marginBottom: '16px' }}>
                            <CodeRuleComponentBuilder
                              value={ruleComponents}
                              onChange={(components) => {
                                setRuleComponents(components);
                                // 同时更新表达式（向后兼容）
                                const expression = CodeRuleComponentService.componentsToExpression(components);
                                pageRuleFormRef.current?.setFieldValue('expression', expression);
                              }}
                              availableFields={(() => {
                                const currentPageConfig = pageConfigs.find(p => p.pageCode === selectedPageCode);
                                return (currentPageConfig?.availableFields || []).map(field => ({
                                  field_name: field.fieldName,
                                  field_label: field.fieldLabel,
                                  field_type: field.fieldType,
                                }));
                              })()}
                            />
                          </div>
                        ) : (
                          <div style={{
                            padding: '20px',
                            backgroundColor: token.colorFillAlter,
                            borderRadius: token.borderRadius,
                            marginBottom: '8px',
                            border: `1px solid ${token.colorBorderSecondary}`
                          }}>
                            {/* 高级模式：直接编辑表达式 */}
                            <ProFormTextArea
                              name="expression"
                              label="规则表达式"
                              rules={[{ required: true, message: '请输入规则表达式' }]}
                              placeholder="例如：{YYYY}{MM}{DD}-{SEQ:4}"
                              fieldProps={{ rows: 3 }}
                              extra="支持变量：{YYYY}、{YY}、{MM}、{DD}、{SEQ:位数}、{FIELD:字段名}"
                            />
                          </div>
                        )}

                        {/* 隐藏的表达式字段，用于表单验证 */}
                        <ProFormText name="expression" hidden />
                      </div>

                      {/* 隐藏字段：规则描述，自动填充 */}
                      <ProFormTextArea
                        name="description"
                        hidden
                      />

                      {/* 序号配置（向后兼容，从自动计数组件读取） */}
                      {expressionMode === 'component' ? (
                        <div style={{
                          padding: '12px',
                          backgroundColor: token.colorFillAlter,
                          borderRadius: token.borderRadius,
                          marginBottom: '16px'
                        }}>
                          <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                            序号配置已集成到"自动计数"组件中，请在组件配置中设置
                          </div>
                        </div>
                      ) : (
                        <Space style={{ width: '100%' }} size="large">
                          <ProFormDigit
                            name="seq_start"
                            label="序号起始值"
                            fieldProps={{ min: 0 }}
                            width="md"
                          />
                          <ProFormDigit
                            name="seq_step"
                            label="序号步长"
                            fieldProps={{ min: 1 }}
                            width="md"
                          />
                          <SafeProFormSelect
                            name="seq_reset_rule"
                            label="序号重置规则"
                            options={[
                              { label: '不重置', value: 'never' },
                              { label: '每日重置', value: 'daily' },
                              { label: '每月重置', value: 'monthly' },
                              { label: '每年重置', value: 'yearly' },
                            ]}
                            width="md"
                          />
                        </Space>
                      )}

                      <ProFormSwitch
                        name="is_active"
                        label="是否启用"
                      />
                    </ProForm>
                  </Card>
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorTextSecondary,
                }}
              >
                请从左侧选择一个功能页面进行配置
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeRuleListPage;

