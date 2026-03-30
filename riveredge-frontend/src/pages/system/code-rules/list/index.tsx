/**
 * 编号规则管理页面
 * 
 * 用于系统管理员为功能页面配置编号规则。
 * 支持为每个功能页面直接配置编号规则，实现自动编号功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Alert, Input, theme, Card, Space, Collapse, Spin } from 'antd';
import { SearchOutlined, DatabaseOutlined } from '@ant-design/icons';
import {
  createCodeRule,
  updateCodeRule,
  getCodeRulePages,
  restorePresetRules,
  enableAllRules,
  CodeRule,
  CreateCodeRuleData,
  UpdateCodeRuleData,
  CodeRulePageConfig,
} from '../../../../services/codeRule';
import { runInitItems } from '../../../../services/tenantInit';
import { apiRequest } from '../../../../services/api';
import { getApplicationList } from '../../../../services/application';
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
import { getCodeRulePageConfigsKey } from '../../../../utils/codeRulePage';

// 去除未使用的 Text, Paragraph

/**
 * 编号规则管理列表页面组件
 */
const CodeRuleListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();

  // 功能页面配置状态（左右结构）
  const [pageConfigs, setPageConfigs] = useState<CodeRulePageConfig[]>([]);
  const [allRules, setAllRules] = useState<CodeRule[]>([]); // 存储所有规则（包括禁用）
  const [selectedPageCode, setSelectedPageCode] = useState<string | null>(null);
  const [pageSearchValue, setPageSearchValue] = useState<string>('');
  const [pageConfigsLoading, setPageConfigsLoading] = useState(true);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [enableAllLoading, setEnableAllLoading] = useState(false);
  const [restoreSingleLoading, setRestoreSingleLoading] = useState(false);

  // 页面规则配置表单状态
  const pageRuleFormRef = useRef<ProFormInstance>();
  const [pageRuleFormLoading, setPageRuleFormLoading] = useState(false);

  // 规则组件状态（唯一数据源）
  const [ruleComponents, setRuleComponents] = useState<CodeRuleComponent[]>([]);

  /**
   * 获取所有编号规则（包括禁用的）
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
      console.error('获取编号规则列表失败:', error);
      return [];
    }
  };

  /**
   * 根据已启用应用过滤页面：只展示已安装且启用的应用下的页面
   */
  const filterPagesByEnabledApps = (pages: CodeRulePageConfig[], apps: any[]): CodeRulePageConfig[] => {
    const enabledPrefixes = apps.map((a) => a.route_path || `/apps/${a.code}`).filter(Boolean);
    if (enabledPrefixes.length === 0) return [];
    return pages.filter(
      (p) =>
        enabledPrefixes.some(
          (prefix) => p.pagePath === prefix || p.pagePath.startsWith(prefix + '/'),
        ),
    );
  };

  /**
   * 加载所有编号规则列表（可用于初始加载或操作后刷新）
   */
  const loadCodeRules = async (reloadPage?: boolean) => {
    try {
      const rules = await getAllCodeRules();
      setAllRules(rules);
      // 如果指定了重新加载页面且当前有选中的页面，重新加载该页面的规则数据到表单
      if (reloadPage && selectedPageCode) {
        handleSelectPage(selectedPageCode, rules);
      }
      return rules;
    } catch (error: any) {
      console.error('加载编号规则列表失败:', error);
      return [];
    }
  };

  /**
   * 加载页面配置列表（并行加载应用列表和规则）
   */
  const loadPageConfigsAndRules = async () => {
    try {
      setPageConfigsLoading(true);
      // 并行加载所有基础数据，显著缩短首页加载白屏时间
      const [allPages, apps, _rules] = await Promise.all([
        getCodeRulePages(),
        getApplicationList({ is_installed: true, is_active: true }),
        loadCodeRules(false)
      ]);
      
      const pages = filterPagesByEnabledApps(allPages, apps);

      // 合并保存的配置和默认配置，确保所有页面都存在
      const savedConfigs = localStorage.getItem(getCodeRulePageConfigsKey());
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

          // 默认选中第一个页面（仅当没有选中页面时）；若当前选中项已不在列表中（应用被禁用），则重置为第一项并初始化表单
          if (mergedConfigs.length > 0) {
            const stillInList =
              selectedPageCode && mergedConfigs.some((p) => p.pageCode === selectedPageCode);
            if (!stillInList) setSelectedPageCode(mergedConfigs[0].pageCode);
            const needInitFirst = !selectedPageCode || !stillInList;
            if (needInitFirst) {
              const firstPageCode = mergedConfigs[0].pageCode;
              setTimeout(() => {
                const firstPageConfig = mergedConfigs.find(p => p.pageCode === firstPageCode);
                if (firstPageConfig?.ruleCode) {
                  setTimeout(() => handleSelectPage(firstPageCode), 200);
                } else {
                  resetPageRuleForm(firstPageCode);
                }
              }, 100);
            }
          }
        } catch (error) {
          console.error('加载功能页面配置失败:', error);
          setPageConfigs(pages);
        }
      } else {
        setPageConfigs(pages);
        // 如果没有保存的配置，默认选中第一个页面
        if (pages.length > 0) {
          const stillInList = selectedPageCode && pages.some((p) => p.pageCode === selectedPageCode);
          if (!stillInList) setSelectedPageCode(pages[0].pageCode);
          const needInitFirst = !selectedPageCode || !stillInList;
          if (needInitFirst) {
            const firstPageCode = pages[0].pageCode;
            setTimeout(() => {
              const firstPageConfig = pages.find(p => p.pageCode === firstPageCode);
              if (firstPageConfig?.ruleCode) {
                setTimeout(() => handleSelectPage(firstPageCode), 200);
              } else {
                resetPageRuleForm(firstPageCode);
              }
            }, 100);
          }
        }
      }
    } catch (error: any) {
      console.error('加载页面配置列表失败:', error);
      messageApi.error(t('pages.system.codeRules.loadPageConfigFailed'));
    } finally {
      setPageConfigsLoading(false);
    }
  };


  // 初始化加载页面配置和编号规则
  useEffect(() => {
    loadPageConfigsAndRules();
  }, []);

  const handleSelectPage = async (pageCode: string, rulesList?: CodeRule[]) => {
    setSelectedPageCode(pageCode);

    // 等待一小会儿确保状态更新或直接使用传入的规则列表
    setTimeout(async () => {
      // 加载该页面对应的编号规则
      const pageConfig = pageConfigs.find(p => p.pageCode === pageCode);
      const ruleCode = pageConfig?.ruleCode || pageCode.toUpperCase().replace(/-/g, '_');
      if (ruleCode) {
        try {
          // 优先使用传入的列表，否则使用 state
          const currentRules = rulesList || allRules;
          const rule = currentRules.find(r => r.code === ruleCode);
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

            if (rule.rule_components && Array.isArray(rule.rule_components) && rule.rule_components.length > 0) {
              setRuleComponents(rule.rule_components);
            } else if (rule.expression) {
              setRuleComponents(CodeRuleComponentService.expressionToComponents(rule.expression));
            } else {
              setRuleComponents([createDefaultAutoCounterComponent(0)]);
            }
          } else {
            // 如果规则不存在，使用预设的默认规则组件（根据页面类型）
            // 基础数据：功能缩写+流水号
            // 业务单据：功能缩写+年月日+流水号
            const isBusinessDocument = pageCode.startsWith('kuaizhizao-');
            let defaultComponents: CodeRuleComponent[];

            const abbreviation = pageConfig?.fixedTextPreset ?? 'ZM';
            if (isBusinessDocument) {
              // 业务单据：拼音缩写+YYYYMMDD+4位流水
              defaultComponents = [
                { type: 'fixed_text', order: 0, text: abbreviation } as FixedTextComponent,
                createDefaultDateComponent(1, 'YYYYMMDD'),
                createDefaultAutoCounterComponent(2, 4, 'daily'),
              ];
            } else {
              // 基础数据：拼音缩写+4位流水
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

            const defaultExpression = CodeRuleComponentService.componentsToExpression(defaultComponents);
            pageRuleFormRef.current?.setFieldsValue({
              name: t('pages.system.codeRules.ruleNameTemplate', { pageName: pageConfig?.pageName || '' }),
              code: ruleCode, // 使用生成的规则代码
              expression: defaultExpression,
              description: t('pages.system.codeRules.ruleDescTemplate', { pageName: pageConfig?.pageName || '' }),
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
      name: t('pages.system.codeRules.ruleNameTemplate', { pageName: pageConfig?.pageName || '' }),
      code: defaultRuleCode,
      expression: defaultExpression,
      description: t('pages.system.codeRules.ruleDescTemplate', { pageName: pageConfig?.pageName || '' }),
      seq_start: 1,
      seq_step: 1,
      seq_reset_rule: 'never',
      is_active: true,
    });
    const defaultComponents = CodeRuleComponentService.expressionToComponents(defaultExpression);
    setRuleComponents(defaultComponents);
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

      if (ruleComponents.length > 0) {
        saveData.rule_components = ruleComponents;
        saveData.expression = CodeRuleComponentService.componentsToExpression(ruleComponents);
        const counterComponent = ruleComponents.find(c => c.type === 'auto_counter') as any;
        if (counterComponent) {
          saveData.seq_start = counterComponent.initial_value || 1;
          saveData.seq_reset_rule = counterComponent.reset_cycle || 'never';
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
          messageApi.success(t('pages.system.codeRules.updateRuleSuccess'));
        } catch (updateError: any) {
          // 更新失败，显示错误信息
          const errorMessage = updateError?.message || updateError?.error?.message || String(updateError);
          console.error('更新规则失败:', updateError);
          messageApi.error(`${t('pages.system.codeRules.updateRuleFailed')}: ${errorMessage}`);
          throw updateError;
        }
      } else {
        // 规则不存在，尝试创建新规则
        try {
          await createCodeRule(saveData as CreateCodeRuleData);
          messageApi.success(t('pages.system.codeRules.createRuleSuccess'));
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
                messageApi.success(t('pages.system.codeRules.updateRuleSuccess'));
              } catch (updateError: any) {
                const updateErrorMessage = updateError?.message || updateError?.error?.message || String(updateError);
                console.error('更新规则失败:', updateError);
                messageApi.error(`${t('pages.system.codeRules.updateRuleFailed')}: ${updateErrorMessage}`);
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
              messageApi.error(t('pages.system.codeRules.ruleCodeExistsHint', { code: values.code }));
              throw createError;
            }
          } else {
            // 其他错误直接抛出
            console.error('创建规则失败:', createError);
            messageApi.error(`${t('pages.system.codeRules.createRuleFailed')}: ${errorMessage}`);
            throw createError;
          }
        }
      }

      // 重新加载规则列表（不重新加载页面，避免循环）
      await loadCodeRules(false);

      // 更新页面配置，关联规则代码，并根据用户保存的 is_active 同步启用状态
      handleUpdatePageConfig(selectedPageCode, {
        autoGenerate: values.is_active ?? true,
        ruleCode: values.code,
      });

      // 重新加载当前页面的规则，确保表单显示最新数据
      setTimeout(() => {
        handleSelectPage(selectedPageCode);
      }, 200);

    } catch (error: any) {
      const errorMessage = error?.message || error?.error?.message || t('pages.system.codeRules.saveRuleFailed');
      messageApi.error(errorMessage);
      console.error('保存规则失败:', error);
    } finally {
      setPageRuleFormLoading(false);
    }
  };

  /**
   * 使用 useMemo 缓存过滤后的功能页面列表和模块分组，提升侧边栏性能
   */
  const filteredPages = React.useMemo(() => {
    if (!pageConfigs || pageConfigs.length === 0) return [];
    if (!pageSearchValue.trim()) return pageConfigs;
    const searchLower = pageSearchValue.toLowerCase();
    return pageConfigs.filter(page =>
      page?.pageName?.toLowerCase().includes(searchLower) ||
      page?.codeFieldLabel?.toLowerCase().includes(searchLower) ||
      page?.pagePath?.toLowerCase().includes(searchLower) ||
      page?.module?.toLowerCase().includes(searchLower)
    );
  }, [pageConfigs, pageSearchValue]);

  const modules = React.useMemo(() => {
    const mods = new Set<string>();
    pageConfigs.forEach(page => {
      if (page.module) mods.add(page.module);
    });
    return Array.from(mods);
  }, [pageConfigs]);

  const selectedPage = React.useMemo(() => {
    if (!selectedPageCode) return undefined;
    return pageConfigs.find(page => page.pageCode === selectedPageCode);
  }, [pageConfigs, selectedPageCode]);

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
      localStorage.setItem(getCodeRulePageConfigsKey(), JSON.stringify(configsToSave));
      return updated;
    });
    messageApi.success(t('pages.system.codeRules.configSaved'));
  };



  return (
    <>
      <div
        className="code-rule-management-page"
        style={{
          display: 'flex',
          height: '100%',
          margin: 0,
          boxSizing: 'border-box',
          borderRadius: token.borderRadiusLG || token.borderRadius,
          overflow: 'hidden',
        }}
      >
        {/* 功能页面编号规则配置 - 左右结构 */}
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
                placeholder={t('pages.system.codeRules.searchPagePlaceholder')}
                prefix={<SearchOutlined />}
                value={pageSearchValue}
                onChange={(e) => setPageSearchValue(e.target.value)}
                allowClear
                size="middle"
              />
            </div>
            {/* 恢复全部、启用全部 按钮 */}
            <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="primary"
                  block
                  loading={restoreLoading}
                  onClick={async () => {
                    try {
                      setRestoreLoading(true);
                      const res = await runInitItems(['code_rule']);
                      const created = (res.results?.code_rule as any)?.created ?? 0;
                      messageApi.success(res.message || t('pages.system.codeRules.restoreAllSuccess', { count: created }));
                      await loadCodeRules(true);
                      if (selectedPageCode) handleSelectPage(selectedPageCode);
                    } catch (e: any) {
                      messageApi.error(e?.message || t('pages.system.codeRules.restoreAllFailed'));
                    } finally {
                      setRestoreLoading(false);
                    }
                  }}
                >
                  {t('pages.system.codeRules.restoreAll')}
                </Button>
                <Button
                  type="primary"
                  block
                  loading={enableAllLoading}
                  onClick={async () => {
                    try {
                      setEnableAllLoading(true);
                      const res = await enableAllRules();
                      messageApi.success(t('pages.system.codeRules.enableAllSuccess', { count: res?.enabled ?? 0 }));
                      await loadCodeRules(true);
                      // 同步页面配置：启用全部后，将所有有规则关联的页面的 autoGenerate 设为 true
                      const allRules = await getAllCodeRules();
                      const activeRuleCodes = new Set(allRules.filter(r => r.is_active).map(r => r.code));
                      setPageConfigs(prev => {
                        const updated = prev.map(page => {
                          const ruleCode = page.ruleCode ?? page.pageCode.toUpperCase().replace(/-/g, '_');
                          const hasActiveRule = activeRuleCodes.has(ruleCode);
                          return hasActiveRule ? { ...page, autoGenerate: true } : page;
                        });
                        const configsToSave = updated.map(p => {
                          const ruleCode = p.ruleCode ?? p.pageCode.toUpperCase().replace(/-/g, '_');
                          return {
                            pageCode: p.pageCode,
                            ruleCode: p.ruleCode ?? ruleCode,
                            autoGenerate: p.autoGenerate,
                          };
                        });
                        localStorage.setItem(getCodeRulePageConfigsKey(), JSON.stringify(configsToSave));
                        return updated;
                      });
                      if (selectedPageCode) handleSelectPage(selectedPageCode);
                    } catch (e: any) {
                      messageApi.error(e?.message || t('pages.system.codeRules.enableAllFailed'));
                    } finally {
                      setEnableAllLoading(false);
                    }
                  }}
                >
                  {t('pages.system.codeRules.enableAll')}
                </Button>
              </div>
            </div>

            {/* 功能页面列表 */}
            <div className="scrollbar-like-modal" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px' }}>
              {pageConfigsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px', color: token.colorTextSecondary }}>
                    {t('pages.system.codeRules.loadingPageConfig')}
                  </div>
                </div>
              ) : (
                <>
                  {/* 提示：仅当列表较少或为空时展示，避免干扰；详细排查步骤折叠 */}
                  {pageConfigs.length < 10 && (
                    <Alert
                      message={t('pages.system.codeRules.tip')}
                      description={
                        <div style={{ fontSize: '12px' }}>
                          <p style={{ margin: 0, marginBottom: '6px' }}>
                            {t('pages.system.codeRules.tipAppFilter')}
                          </p>
                          <Collapse
                            size="small"
                            items={[
                              {
                                key: '1',
                                label: t('pages.system.codeRules.tipExpandLabel'),
                                children: (
                                  <>
                                    <p style={{ margin: '0 0 6px 0' }}>{t('pages.system.codeRules.tipDescription')}</p>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                      <li>{t('pages.system.codeRules.tipCheck1')} <code>isAutoGenerateEnabled</code> / <code>getPageRuleCode</code></li>
                                      <li>{t('pages.system.codeRules.tipCheck2')} <code>code_rule_pages.py</code></li>
                                      <li>{t('pages.system.codeRules.tipCheck3')} <code>codeRulePages.ts</code></li>
                                    </ul>
                                    <p style={{ margin: '6px 0 0 0', color: token.colorTextSecondary }}>💡 {t('pages.system.codeRules.tipSuggestion')}</p>
                                  </>
                                ),
                              },
                            ]}
                            style={{ marginTop: '6px', background: 'transparent', border: 'none' }}
                          />
                        </div>
                      }
                      type="info"
                      showIcon
                      closable
                      style={{ marginBottom: '12px' }}
                    />
                  )}
                  {modules.map(module => {
                    const modulePages = filteredPages.filter(page => page?.module === module);
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
                                <Tag color="success" style={{ marginLeft: '8px' }}>
                                  {t('pages.system.codeRules.enabled')}
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
                  <Space>
                    <Button
                      loading={restoreSingleLoading}
                      onClick={async () => {
                        if (!selectedPageCode) {
                          messageApi.warning(t('pages.system.codeRules.selectPageToRestore'));
                          return;
                        }
                        try {
                          setRestoreSingleLoading(true);
                          await restorePresetRules('page', selectedPageCode);
                          messageApi.success(t('pages.system.codeRules.restorePresetSuccess'));
                          await loadCodeRules(true);
                          handleSelectPage(selectedPageCode);
                        } catch (e: any) {
                          messageApi.error(e?.message || t('pages.system.codeRules.restorePresetFailed'));
                        } finally {
                          setRestoreSingleLoading(false);
                        }
                      }}
                    >
                      {t('pages.system.codeRules.restoreSingle')}
                    </Button>
                    <Button
                      type="primary"
                      loading={pageRuleFormLoading}
                      onClick={handleSavePageRule}
                    >
                      {t('pages.system.codeRules.saveRule')}
                    </Button>
                  </Space>
                </div>

                {/* 配置表单 */}
                <div className="scrollbar-like-modal" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px' }}>
                  <Card
                    title={t('pages.system.codeRules.configTitle')}
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
                          {t('pages.system.codeRules.codeField')}
                        </div>
                        <div style={{ fontWeight: 500 }}>
                          {selectedPage.codeFieldLabel} ({selectedPage.codeField})
                        </div>
                      </div>

                      {/* 隐藏字段：规则名称和规则代码，自动填充 */}
                      <ProFormText
                        name="name"
                        hidden
                        rules={[{ required: true, message: t('pages.system.codeRules.ruleNameRequired') }]}
                      />

                      <ProFormText
                        name="code"
                        hidden
                        rules={[{ required: true, message: t('pages.system.codeRules.ruleCodeRequired') }]}
                      />

                      <div>
                        <label style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                          {t('pages.system.codeRules.expressionLabel')}
                        </label>
                        <div style={{ marginBottom: '16px' }}>
                          <CodeRuleComponentBuilder
                            value={ruleComponents}
                            onChange={(components) => {
                              setRuleComponents(components);
                              pageRuleFormRef.current?.setFieldValue(
                                'expression',
                                CodeRuleComponentService.componentsToExpression(components)
                              );
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
                        <ProFormText name="expression" hidden />
                      </div>

                      <ProFormTextArea name="description" hidden />

                      <div style={{
                        padding: '12px',
                        backgroundColor: token.colorFillAlter,
                        borderRadius: token.borderRadius,
                        marginBottom: '16px'
                      }}>
                        <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                          {t('pages.system.codeRules.seqIntegratedHint')}
                        </div>
                      </div>

                      <ProFormSwitch
                        name="is_active"
                        label={t('pages.system.codeRules.isActive')}
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
                {t('pages.system.codeRules.selectPageHint')}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeRuleListPage;

