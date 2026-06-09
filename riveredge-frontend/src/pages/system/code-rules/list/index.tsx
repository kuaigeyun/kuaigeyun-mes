/**
 * 编号规则管理页面
 * 
 * 用于系统管理员为功能页面配置编号规则。
 * 支持为每个功能页面直接配置编号规则，实现自动编号功能。
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Alert, Input, theme, Space, Collapse, Spin } from 'antd';
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
import {
  buildMenuPathNameMap,
  enrichPagesWithMenuNames,
} from '../../../../utils/featurePageDisplay';
import { useNavigationMenuTreeQuery } from '../../../../hooks/useNavigationMenuTreeQuery';
import { useTrialRunMode } from '../../../../hooks/useTrialRunMode';

// 去除未使用的 Text, Paragraph

/**
 * 单个功能页面列表项（memo 化，避免选中态变化导致整张列表重渲染）
 */
interface PageListItemProps {
  page: CodeRulePageConfig;
  isSelected: boolean;
  enabledTagText: string;
  colors: {
    primary: string;
    primaryBg: string;
    fillSecondary: string;
    textSecondary: string;
    borderRadius: number;
  };
  onSelect: (pageCode: string) => void;
}

const PageListItem: React.FC<PageListItemProps> = React.memo(
  ({ page, isSelected, enabledTagText, colors, onSelect }: PageListItemProps) => {
    const handleClick = useCallback(() => onSelect(page.pageCode), [onSelect, page.pageCode]);
    return (
      <div
        className={`code-rule-page-item${isSelected ? ' is-selected' : ''}`}
        onClick={handleClick}
        style={{
          padding: '12px',
          marginBottom: '4px',
          cursor: 'pointer',
          borderRadius: colors.borderRadius,
          backgroundColor: isSelected ? colors.primaryBg : 'transparent',
          border: `1px solid ${isSelected ? colors.primary : 'transparent'}`,
          transition: 'background-color 0.15s, border-color 0.15s',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: isSelected ? 500 : 400,
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {page.pageName}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {page.codeFieldLabel}
          </div>
        </div>
        {page.autoGenerate && (
          <Tag color="success" style={{ marginLeft: '8px' }}>
            {enabledTagText}
          </Tag>
        )}
      </div>
    );
  },
);
PageListItem.displayName = 'PageListItem';

/**
 * 编号规则管理列表页面组件
 */
const CodeRuleListPage: React.FC = () => {
  const { t } = useTranslation();
  const trialRunMode = useTrialRunMode();
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

  const { data: menuTree } = useNavigationMenuTreeQuery();

  const menuPathNameMap = useMemo(
    () => buildMenuPathNameMap(menuTree || [], t),
    [menuTree, t],
  );

  const displayPageConfigs = useMemo(
    () => enrichPagesWithMenuNames(pageConfigs, menuPathNameMap, t),
    [pageConfigs, menuPathNameMap, t],
  );

  // 页面规则配置表单状态
  const pageRuleFormRef = useRef<ProFormInstance>();
  const [pageRuleFormLoading, setPageRuleFormLoading] = useState(false);

  // 规则组件状态（唯一数据源）
  const [ruleComponents, setRuleComponents] = useState<CodeRuleComponent[]>([]);

  /**
   * 重置页面规则表单（移至 handleSelectPage 之前避免引用错误）
   * 可显式传入 configsList 以绕过 React state 未提交时取值失败的问题
   */
  const resetPageRuleForm = (pageCode: string, configsList?: CodeRulePageConfig[]) => {
    const currentConfigs = configsList ?? pageConfigs;
    const pageConfig = currentConfigs.find(p => p.pageCode === pageCode);
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
   * 处理选择功能页面
   * 依赖 state 的两处（allRules、pageConfigs）都允许用参数显式传入，
   * 从而在 "setState 还未提交" 的同步流程里也能拿到最新值，替代此前的 setTimeout 妥协写法。
   */
  const handleSelectPage = (
    pageCode: string,
    rulesList?: CodeRule[],
    configsList?: CodeRulePageConfig[],
  ) => {
    setSelectedPageCode(pageCode);

    const currentRules = rulesList ?? allRules;
    const currentConfigs = configsList ?? pageConfigs;

    // 加载该页面对应的编号规则
    const pageConfig = currentConfigs.find(p => p.pageCode === pageCode);
    const ruleCode = pageConfig?.ruleCode || pageCode.toUpperCase().replace(/-/g, '_');

    if (ruleCode) {
      try {
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
          const isBusinessDocument = pageCode.startsWith('kuaizhizao-');
          let defaultComponents: CodeRuleComponent[];

          const abbreviation = pageConfig?.fixedTextPreset ?? 'ZM';
          if (isBusinessDocument) {
            defaultComponents = [
              { type: 'fixed_text', order: 0, text: abbreviation } as FixedTextComponent,
              createDefaultDateComponent(1, 'YYYYMMDD'),
              createDefaultAutoCounterComponent(2, 4, 'daily'),
            ];
          } else {
            defaultComponents = [
              { type: 'fixed_text', order: 0, text: abbreviation } as FixedTextComponent,
              createDefaultAutoCounterComponent(1, 4, 'never'),
            ];
          }

          setRuleComponents(defaultComponents);

          const defaultExpression = CodeRuleComponentService.componentsToExpression(defaultComponents);
          pageRuleFormRef.current?.setFieldsValue({
            name: t('pages.system.codeRules.ruleNameTemplate', { pageName: pageConfig?.pageName || '' }),
            code: ruleCode,
            expression: defaultExpression,
            description: t('pages.system.codeRules.ruleDescTemplate', { pageName: pageConfig?.pageName || '' }),
            seq_start: 1,
            seq_step: 1,
            seq_reset_rule: isBusinessDocument ? 'daily' : 'never',
            is_active: true,
          });
        }
      } catch (error) {
        window.console.error('Failed to load rule:', error);
        resetPageRuleForm(pageCode, currentConfigs);
      }
    } else {
      // 如果没有关联规则，重置表单
      resetPageRuleForm(pageCode, currentConfigs);
    }
  };

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
    } catch (error: unknown) {
      window.console.error('Failed to fetch code rule list:', error);
      return [];
    }
  };

  /**
   * 根据已启用应用过滤页面：只展示已安装且启用的应用下的页面
   */
  const filterPagesByEnabledApps = (pages: CodeRulePageConfig[], apps: unknown[]): CodeRulePageConfig[] => {
    const enabledPrefixes = (apps as any[]).map((a) => a.route_path || `/apps/${a.code}`).filter(Boolean);
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
    } catch (error) {
      window.console.error('Failed to load code rule list:', error);
      return [];
    }
  };

  /**
   * 加载页面配置列表（并行加载应用列表和规则）
   *
   * 初始化选中项时不再使用 setTimeout 等 state 提交，
   * 而是把刚计算出来的 configs/rules 显式传给 handleSelectPage / resetPageRuleForm。
   */
  const loadPageConfigsAndRules = async () => {
    try {
      setPageConfigsLoading(true);
      const [allPages, apps, rules] = await Promise.all([
        getCodeRulePages(),
        getApplicationList({ is_installed: true, is_active: true }),
        loadCodeRules(false),
      ]);

      const pages = filterPagesByEnabledApps(allPages, apps);

      // 合并保存的配置和默认配置，确保所有页面都存在
      let nextConfigs: CodeRulePageConfig[] = pages;
      const savedConfigs = window.localStorage.getItem(getCodeRulePageConfigsKey());
      if (savedConfigs) {
        try {
          const parsed = JSON.parse(savedConfigs);
          nextConfigs = pages.map(defaultPage => {
            const savedPage = parsed.find((p: any) => p.pageCode === defaultPage.pageCode);
            if (savedPage) {
              return {
                ...defaultPage,
                ruleCode: savedPage.ruleCode ?? defaultPage.ruleCode,
                autoGenerate: savedPage.autoGenerate ?? defaultPage.autoGenerate,
              };
            }
            return defaultPage;
          });
        } catch (error) {
          console.error('Failed to load feature page configs:', error);
          nextConfigs = pages;
        }
      }

      setPageConfigs(nextConfigs);

      // 默认选中第一个页面（仅当没有选中或当前选中项已不在列表中时）
      if (nextConfigs.length > 0) {
        const stillInList =
          !!selectedPageCode && nextConfigs.some(p => p.pageCode === selectedPageCode);
        if (!stillInList) {
          const firstPageCode = nextConfigs[0].pageCode;
          // 直接用本次算出的 configs / rules 同步驱动，setFieldsValue 是命令式的，
          // 不依赖 state 已提交
          handleSelectPage(firstPageCode, rules, nextConfigs);
        }
      }
    } catch (error) {
      window.console.error('Failed to load page config list:', error);
      messageApi.error(t('pages.system.codeRules.loadPageConfigFailed'));
    } finally {
      setPageConfigsLoading(false);
    }
  };


  // 初始化加载页面配置和编号规则
  useEffect(() => {
    loadPageConfigsAndRules();
  }, []);




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
          console.error('Failed to update rule:', updateError);
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
                console.error('Failed to update rule:', updateError);
                messageApi.error(`${t('pages.system.codeRules.updateRuleFailed')}: ${updateErrorMessage}`);
                throw updateError;
              }
            } else {
              // 如果还是找不到，可能是数据库约束问题或其他原因
              console.error('Rule code exists but cannot be found:', {
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
            console.error('Failed to create rule:', createError);
            messageApi.error(`${t('pages.system.codeRules.createRuleFailed')}: ${errorMessage}`);
            throw createError;
          }
        }
      }

      // 重新加载规则列表（不重新加载页面，避免循环）
      const freshRules = await loadCodeRules(false);

      // 更新页面配置，关联规则代码，并根据用户保存的 is_active 同步启用状态。
      // 直接在本地计算出新 configs，避免依赖 setPageConfigs 异步提交，
      // 从而可以同步把 freshRules / freshConfigs 传给 handleSelectPage，取消 setTimeout 妥协。
      const updates: Partial<CodeRulePageConfig> = {
        autoGenerate: values.is_active ?? true,
        ruleCode: values.code,
      };
      const freshConfigs = pageConfigs.map(page =>
        page.pageCode === selectedPageCode ? { ...page, ...updates } : page,
      );
      const configsToSave = freshConfigs.map(page => ({
        pageCode: page.pageCode,
        ruleCode: page.ruleCode,
        autoGenerate: page.autoGenerate,
      }));
      window.localStorage.setItem(getCodeRulePageConfigsKey(), JSON.stringify(configsToSave));
      setPageConfigs(freshConfigs);
      messageApi.success(t('pages.system.codeRules.configSaved'));

      // 立即用最新数据刷新表单，无需等 state 提交
      handleSelectPage(selectedPageCode, freshRules, freshConfigs);

    } catch (error: unknown) {
      const err = error as Error;
      const errorMessage = err?.message || t('pages.system.codeRules.saveRuleFailed');
      messageApi.error(errorMessage);
      window.console.error('Failed to save rule:', error);
    } finally {
      setPageRuleFormLoading(false);
    }
  };

  /**
   * 一次遍历同时完成过滤 + 按模块分组，避免 O(模块数 × 页面数) 的二次过滤
   */
  const groupedPages = useMemo(() => {
    if (!displayPageConfigs || displayPageConfigs.length === 0) {
      return [] as { module: string; pages: CodeRulePageConfig[] }[];
    }
    const keyword = pageSearchValue.trim().toLowerCase();
    const groups = new Map<string, CodeRulePageConfig[]>();
    for (const page of displayPageConfigs) {
      if (!page) continue;
      if (keyword) {
        const hit =
          page.pageName?.toLowerCase().includes(keyword) ||
          page.codeFieldLabel?.toLowerCase().includes(keyword) ||
          page.pagePath?.toLowerCase().includes(keyword) ||
          page.module?.toLowerCase().includes(keyword);
        if (!hit) continue;
      }
      const mod = page.module || '';
      if (!mod) continue;
      const list = groups.get(mod);
      if (list) {
        list.push(page);
      } else {
        groups.set(mod, [page]);
      }
    }
    return Array.from(groups, ([module, pages]) => ({ module, pages }));
  }, [displayPageConfigs, pageSearchValue]);

  const selectedPage = useMemo(() => {
    if (!selectedPageCode) return undefined;
    return displayPageConfigs.find(page => page.pageCode === selectedPageCode);
  }, [displayPageConfigs, selectedPageCode]);

  /**
   * 稳定的回调引用，配合 PageListItem 的 React.memo 实现按需重渲染
   */
  const handleSelectPageStable = useCallback(
    (pageCode: string) => handleSelectPage(pageCode),
    // handleSelectPage 是组件内闭包，依赖 allRules / pageConfigs；
    // 这里把依赖暴露出去保证拿到最新数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRules, pageConfigs],
  );

  /**
   * 列表项颜色 / 圆角集中传给子组件，使引用稳定，避免无关重渲染
   */
  const itemColors = useMemo(
    () => ({
      primary: token.colorPrimary,
      primaryBg: token.colorPrimaryBg,
      fillSecondary: token.colorFillSecondary,
      textSecondary: token.colorTextSecondary,
      borderRadius: token.borderRadius,
    }),
    [
      token.colorPrimary,
      token.colorPrimaryBg,
      token.colorFillSecondary,
      token.colorTextSecondary,
      token.borderRadius,
    ],
  );

  const enabledTagText = t('pages.system.codeRules.enabled');

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG || token.borderRadius,
        overflow: 'hidden',
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
            {trialRunMode && (
            <Button
              type="primary"
              block
              loading={restoreLoading}
              onClick={async () => {
                try {
                  setRestoreLoading(true);
                  // 须走编码规则专用接口：会为各页创建或覆盖为预设 rule_components（租户初始化里的 code_rule 项对已存在规则往往不更新）
                  const res = await restorePresetRules('all');
                  const count = res.restored?.length ?? 0;
                  const msg = res.message || t('pages.system.codeRules.restoreAllSuccess', { count });
                  if (count === 0) {
                    messageApi.warning(msg);
                  } else {
                    messageApi.success(msg);
                  }
                  await loadCodeRules(true);
                } catch (e: any) {
                  messageApi.error(e?.message || t('pages.system.codeRules.restoreAllFailed'));
                } finally {
                  setRestoreLoading(false);
                }
              }}
            >
              {t('pages.system.codeRules.restoreAll')}
            </Button>
            )}
            <Button
              type="primary"
              block
              loading={enableAllLoading}
              onClick={async () => {
                try {
                  setEnableAllLoading(true);
                  const res = await enableAllRules();
                  messageApi.success(t('pages.system.codeRules.enableAllSuccess', { count: res?.enabled ?? 0 }));
                  const rules = await loadCodeRules(true);
                  const activeRuleCodes = new Set((rules ?? []).filter(r => r.is_active).map(r => r.code));
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
                    window.localStorage.setItem(getCodeRulePageConfigsKey(), JSON.stringify(configsToSave));
                    return updated;
                  });
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
              {groupedPages.map(({ module, pages }) => (
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
                  {pages.map(page => (
                    <PageListItem
                      key={page.pageCode}
                      page={page}
                      isSelected={selectedPageCode === page.pageCode}
                      enabledTagText={enabledTagText}
                      colors={itemColors}
                      onSelect={handleSelectPageStable}
                    />
                  ))}
                </div>
              ))}
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
        }}
      >
        {selectedPage ? (
          <>
            {/* 统一头部标题与操作工具栏 */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: token.colorFillAlter,
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
                {trialRunMode && (
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
                    } catch (e: any) {
                      messageApi.error(e?.message || t('pages.system.codeRules.restorePresetFailed'));
                    } finally {
                      setRestoreSingleLoading(false);
                    }
                  }}
                >
                  {t('pages.system.codeRules.restoreSingle')}
                </Button>
                )}
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
              <div style={{ marginBottom: '24px' }}>
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
              </div>
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
              backgroundColor: token.colorFillAlter,
            }}
          >
            {t('pages.system.codeRules.selectPageHint')}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeRuleListPage;
