/**
 * 自助式上线向导页面
 *
 * 系统上线：从0到可开单的步骤式引导（数据校验）
 * 按角色：为每个角色提供上线准备向导，包括数据准备、权限配置、操作培训等
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Tabs, Steps, Checkbox, Space, Typography, Tag, Button, List, Empty, Alert, theme, ConfigProvider, Row, Col, Menu, Popover, Progress, Modal, Table, Spin } from 'antd';
import { getTenantId } from '../../../utils/auth';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileSearch,
  PlayCircle,
  RefreshCw,
  Rocket,
  Target,
  Zap,
  CalendarClock,
  ArrowRight,
  Layers,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { App } from 'antd';
import {
  getRoleOnboardingGuide,
  getSystemGoLiveGuide,
  getOnboardingCounts,
  markInitialDataVerified,
  revokeInitialDataVerified,
} from '../../../services/onboarding';
import { useGuideStore } from '../../../components/onboarding-guide/store';
import { getUserList } from '../../../services/user';
import { listSalesOrders } from '../../../apps/kuaizhizao/services/sales-order';
import { listPurchaseOrders } from '../../../apps/kuaizhizao/services/purchase';

// 引入真实的业务接口
import { customerApi, supplierApi } from '../../../apps/master-data/services/supply-chain';
import { materialApi, bomApi } from '../../../apps/master-data/services/material';
import { warehouseApi, storageAreaApi, storageLocationApi } from '../../../apps/master-data/services/warehouse';
import { plantApi, workshopApi, productionLineApi, workstationApi, workCenterApi, workGroupApi } from '../../../apps/master-data/services/factory';
import { defectTypeApi, operationApi, processRouteApi, sopApi } from '../../../apps/master-data/services/process';
import { variantAttributeApi } from '../../../apps/master-data/services/variant-attribute';
import { batchRuleApi, serialRuleApi } from '../../../apps/master-data/services/batchSerialRules';
import { useThemeStore } from '../../../stores/themeStore';
import { ManufacturingIcons } from '../../../utils/manufacturingIcons';
import { getDepartmentTree } from '../../../services/department';
import { getPositionList } from '../../../services/position';
import { getRoleList } from '../../../services/role';
import { getCodeRuleList } from '../../../services/codeRule';
import { getDataDictionaryList } from '../../../services/dataDictionary';
import { getLanguageList } from '../../../services/language';
import { getCustomFieldList } from '../../../services/customField';
import { getMenus } from '../../../services/menu';
import { getApprovalProcessList } from '../../../services/approvalProcess';
import { getMessageTemplateList } from '../../../services/messageTemplate';
import { getPrintTemplateList } from '../../../services/printTemplate';
import { getFileList } from '../../../services/file';
import { getDataSourceList } from '../../../services/dataSource';
import { getApplicationConnectionList } from '../../../services/applicationConnection';
import { getDatasetList } from '../../../services/dataset';
import { getOperationLogs } from '../../../services/operationLog';
import { getLoginLogs } from '../../../services/loginLog';
import { getBackups } from '../../../services/dataBackup';
import { getInstalledApplicationList } from '../../../services/application';
import { useRedirectIfLaunchWizardOff } from '../../../hooks/useRedirectIfLaunchWizardOff';
import {
  buildMissionGuide,
  buildSystemLaunchChecklist,
  ROLE_TAB_NAME_KEYS,
  SYSTEM_STOCK_COUNT_ID_MAP,
} from './systemLaunchData';
import {
  buildRoleMissionMap,
  buildRoleDetailsMap,
  buildRoleDefaultChecklists,
  buildImplementerChecklist,
  localizeRoleChecklistItems,
} from './roleLaunchData';

const { Title, Paragraph, Text } = Typography;

/** 与侧栏/顶栏菜单 pathMap 对齐的 Lucide 图标尺寸（上线向导左栏） */
const ONBOARDING_MENU_ICON_SIZE = 16;

function onboardingMenuIcon(Icon: React.ComponentType<{ size?: number }>): React.ReactNode {
  return React.createElement(Icon, { size: ONBOARDING_MENU_ICON_SIZE });
}

/** 页面内统一 Lucide 图标（antd Button/Alert 等需要 ReactNode） */
function wizIcon(
  Icon: LucideIcon,
  size: number,
  style?: React.CSSProperties,
  color?: string
): React.ReactElement {
  return React.createElement(Icon, {
    size,
    strokeWidth: size <= 14 ? 1.75 : 2,
    style,
    color,
  });
}

/**
 * 角色向导：图标与「快制造 / 主数据 / 财务」等菜单一一对应，且互不重复（见 BasicLayout getMenuIcon pathMap）
 */
const ROLE_KEYS: Array<{ code: string; icon: React.ReactNode }> = [
  { code: 'sales', icon: onboardingMenuIcon(ManufacturingIcons.chartLine) },
  { code: 'purchase', icon: onboardingMenuIcon(ManufacturingIcons.shoppingBag) },
  { code: 'warehouse', icon: onboardingMenuIcon(ManufacturingIcons.warehouse) },
  { code: 'technician', icon: onboardingMenuIcon(ManufacturingIcons.workflow) },
  { code: 'planner', icon: onboardingMenuIcon(ManufacturingIcons.calendar) },
  { code: 'supervisor', icon: onboardingMenuIcon(ManufacturingIcons.users) },
  { code: 'operator', icon: onboardingMenuIcon(ManufacturingIcons.activity) },
  { code: 'quality', icon: onboardingMenuIcon(ManufacturingIcons.quality) },
  { code: 'equipment', icon: onboardingMenuIcon(ManufacturingIcons.wrench) },
  { code: 'finance', icon: onboardingMenuIcon(ManufacturingIcons.wallet) },
  { code: 'manager', icon: onboardingMenuIcon(ManufacturingIcons.trophy) },
  { code: 'implementer', icon: onboardingMenuIcon(ManufacturingIcons.package) },
];

/**
 * 系统上线向导 — 与列表卡片「智能存量」一致，供环形进度与阶段计算复用
 */
function getSystemLaunchStockCount(
  item: { id?: string },
  realCounts: Record<string, number>
): number {
  if (item.id != null && realCounts[item.id] !== undefined) return Number(realCounts[item.id]) || 0;
  if (item.id != null) {
    const mapped = SYSTEM_STOCK_COUNT_ID_MAP[item.id];
    if (mapped && realCounts[mapped] !== undefined) return Number(realCounts[mapped]) || 0;
  }
  return 0;
}

function isSystemLaunchListItemCompleted(
  item: any,
  realCounts: Record<string, number>,
  completedItems: Set<string>
): boolean {
  return (
    getSystemLaunchStockCount(item, realCounts) > 0 ||
    item.completed === true ||
    completedItems.has(item.id)
  );
}

/**
 * 自助式上线向导页面组件
 */
const OnboardingWizardPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const runGuide = useGuideStore((s) => s.runGuide);
  const { token } = theme.useToken();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const { initialized: cfgReady, enabled: launchWizardOn } = useRedirectIfLaunchWizardOff();

  // 注入局部样式以强制 Steps 标题撑开并实现右对齐
  const stepStyle = `
    .onboarding-steps .ant-steps-item-content {
      width: 100%;
      overflow: hidden;
    }
    .onboarding-steps .ant-steps-item-title {
      width: 100% !important;
      padding-right: 0 !important;
      display: block !important;
      margin-bottom: 8px !important;
    }
    .onboarding-steps .ant-steps-item-description {
      padding-top: 8px !important;
      padding-bottom: 12px !important;
    }
    .onboarding-action-btn {
      transition: all 0.3s ease !important;
    }
    .onboarding-action-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
      box-shadow: 0 6px 15px rgba(0,0,0,0.15) !important;
    }
    .onboarding-list-item {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .onboarding-list-item:hover {
      border-color: ${token.colorPrimary}40 !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }
    /* 完成态：避免 ant-btn-default 的灰底/hover 盖住 inline，读起来像禁用 */
    .onboarding-completed-btn.ant-btn {
      background: ${token.colorSuccessBg} !important;
      border: 1px solid ${token.colorSuccessBorder} !important;
      color: ${token.colorSuccess} !important;
      box-shadow: none !important;
      opacity: 1 !important;
    }
    .onboarding-completed-btn.ant-btn .anticon,
    .onboarding-completed-btn.ant-btn svg {
      color: ${token.colorSuccess} !important;
    }
    .onboarding-completed-btn.ant-btn:not(:disabled):hover,
    .onboarding-completed-btn.ant-btn:not(:disabled):focus-visible {
      background: ${token.colorSuccessBg} !important;
      border-color: ${token.colorSuccess} !important;
      color: ${token.colorSuccess} !important;
    }
  `;


  const enhancedMissionGuide = useMemo(() => buildMissionGuide(t), [t]);
  const enhancedChecklist = useMemo(() => buildSystemLaunchChecklist(t), [t]);
  const roleMissionMap = useMemo(() => buildRoleMissionMap(t), [t]);
  const roleDetailsMap = useMemo(() => buildRoleDetailsMap(t), [t]);
  const roleDefaultChecklists = useMemo(() => buildRoleDefaultChecklists(t), [t]);
  const implementerEnhancedChecklist = useMemo(() => buildImplementerChecklist(t), [t]);

  const allTabs = useMemo(
    () => [
      { code: 'implementer', name: t(ROLE_TAB_NAME_KEYS.implementer), icon: onboardingMenuIcon(ManufacturingIcons.package) },
      { code: 'system', name: t(ROLE_TAB_NAME_KEYS.system), icon: onboardingMenuIcon(ManufacturingIcons.compass) },
      ...ROLE_KEYS.filter((r) => r.code !== 'implementer').map((r) => ({
        code: r.code,
        name: t(ROLE_TAB_NAME_KEYS[r.code]),
        icon: r.icon,
      })),
    ],
    [t]
  );

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('system');
  const [guideData, setGuideData] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [systemGuideData, setSystemGuideData] = useState<any>(null);
  const [realCounts, setRealCounts] = useState<Record<string, number>>({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentDetailItem, setCurrentDetailItem] = useState<any>(null);
  /** 点击「刷新状态」时递增，触发 system/implementer 重新拉取 realCounts */
  const [realCountsRefreshKey, setRealCountsRefreshKey] = useState(0);

  /** 部门树节点数（total 优先，缺省时递归统计树根） */
  const countDepartmentRecords = (tree: any): number => {
    if (!tree || typeof tree !== 'object') return 0;
    const t = Number(tree.total);
    if (!Number.isNaN(t) && t > 0) return t;
    const walk = (nodes: any[] | undefined): number => {
      if (!nodes?.length) return 0;
      return nodes.reduce((acc, n) => acc + 1 + walk(n?.children), 0);
    };
    return walk(tree.items);
  };

  const getApiListCount = (res: any): number | undefined => {
    if (!res) return undefined;
    if (typeof res.total === 'number' && Number.isFinite(res.total)) return Number(res.total);
    const data = res.data !== undefined ? res.data : res;
    if (Array.isArray(data)) return data.length;
    if (data && typeof data.total === 'number') return Number(data.total);
    if (data && data.count !== undefined) return Number(data.count);
    if (data && Array.isArray(data.items)) return data.items.length;
    return 0;
  };

  /** 同 Tab 内若 60s 内已成功拉过，且未点「刷新状态」，跳过重拉避免反复触发慢接口。 */
  const COUNT_CACHE_TTL_MS = 60_000;
  const realCountsCacheRef = React.useRef<Record<string, number>>({});

  // 按 Tab 分流并改为「流式」——每个接口独立 setState，避免被最慢请求阻塞整张右栏；
  // 同时叠加 60s 缓存，切回原 Tab 不再重复拉。
  // 优先尝试后端聚合接口 /core/onboarding/counts（单次并行），失败再回退到多请求模式。
  useEffect(() => {
    if (activeTab !== 'system' && activeTab !== 'implementer') return;

    const cacheKey = activeTab;
    const lastTs = realCountsCacheRef.current[cacheKey] ?? 0;
    const isManualRefresh = realCountsRefreshKey > 0;
    const recentlyFetched = !isManualRefresh && Date.now() - lastTs < COUNT_CACHE_TTL_MS;
    if (recentlyFetched) return;

    let cancelled = false;

    // ---- 优先聚合接口 ----
    const aggregatedScope: 'system_launch' | 'implementer' =
      activeTab === 'system' ? 'system_launch' : 'implementer';
    let aggregatedSucceeded = false;
    // 手动刷新（点击「刷新状态」）时同时绕过后端 30s TTL 缓存
    getOnboardingCounts(aggregatedScope, isManualRefresh)
      .then((res) => {
        if (cancelled) return;
        const counts = res?.counts || {};
        const flags = res?.flags || {};
        // flags 也以 0/1 写入 realCounts，便于现有 (realCounts[id] ?? 0) > 0 的判定逻辑
        const flagAsCounts: Record<string, number> = {};
        Object.entries(flags).forEach(([k, v]) => {
          flagAsCounts[k] = v ? 1 : 0;
        });
        const merged = { ...flagAsCounts, ...counts };
        if (Object.keys(merged).length > 0) {
          aggregatedSucceeded = true;
          setRealCounts((prev) => ({ ...prev, ...merged }));
          realCountsCacheRef.current[cacheKey] = Date.now();
        }
      })
      .catch((err) => {
        console.warn('[Onboarding] aggregated counts unavailable, fall back to multi-request', err?.message);
      });

    // 100ms 内若聚合接口返回完整数据，则跳过后续多请求；否则保留并行回退避免视觉空白
    setTimeout(() => {
      if (cancelled) return;
      if (aggregatedSucceeded) return;
      kickoffStreamingFallback();
    }, 150);

    function kickoffStreamingFallback() {
      if (cancelled) return;

    /** 单源请求：完成即写回，独立失败不影响其他源 */
    const runSource = (
      name: string,
      task: () => Promise<Partial<Record<string, number>>>
    ) => {
      task()
        .then((partial) => {
          if (cancelled) return;
          setRealCounts((prev) => {
            const next: Record<string, number> = { ...prev };
            for (const [k, v] of Object.entries(partial)) {
              if (typeof v === 'number') next[k] = v;
            }
            return next;
          });
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn(`[Onboarding] count source "${name}" failed`, err?.message);
        });
    };

    if (activeTab === 'system') {
      runSource('customer', async () => {
        const r = await customerApi.list();
        const v = getApiListCount(r) ?? 0;
        return { partner_customers: v };
      });
      runSource('supplier', async () => {
        const r = await supplierApi.list();
        const v = getApiListCount(r) ?? 0;
        return { partner_suppliers: v };
      });
      runSource('partner_data_join', async () => {
        // 单独并发两个，再写聚合
        const [c, s] = await Promise.all([
          customerApi.list().catch(() => null),
          supplierApi.list().catch(() => null),
        ]);
        const cv = getApiListCount(c) ?? 0;
        const sv = getApiListCount(s) ?? 0;
        return { partner_data: cv + sv };
      });
      runSource('material', async () => {
        const r = await materialApi.list();
        const v = getApiListCount(r) ?? 0;
        return { material_main: v, material_data: v };
      });
      runSource('variantAttr', async () => ({
        material_variants: getApiListCount(await variantAttributeApi.list()) ?? 0,
      }));
      runSource('batchRule', async () => ({
        material_batch_rules: getApiListCount(await batchRuleApi.list()) ?? 0,
      }));
      runSource('serialRule', async () => ({
        material_serial_rules: getApiListCount(await serialRuleApi.list()) ?? 0,
      }));
      runSource('warehouse', async () => {
        const v = getApiListCount(await warehouseApi.list()) ?? 0;
        return { warehouse_main: v, warehouse_data: v };
      });
      runSource('storageArea', async () => ({
        warehouse_areas: getApiListCount(await storageAreaApi.list()) ?? 0,
      }));
      runSource('storageLocation', async () => ({
        warehouse_locations: getApiListCount(await storageLocationApi.list()) ?? 0,
      }));
      runSource('bom', async () => {
        const v = getApiListCount(await bomApi.getGroups()) ?? 0;
        return { process_bom: v, bom_config: v };
      });
      runSource('operation', async () => ({
        process_operations: getApiListCount(await operationApi.list()) ?? 0,
      }));
      runSource('route', async () => {
        const v = getApiListCount(await processRouteApi.list()) ?? 0;
        return { process_routes: v, process_routing: v };
      });
      runSource('defectType', async () => ({
        process_defects: getApiListCount(await defectTypeApi.list()) ?? 0,
      }));
      runSource('sop', async () => ({
        process_sop: getApiListCount(await sopApi.list()) ?? 0,
      }));
      runSource('factory_plants', async () => ({
        factory_plants: getApiListCount(await plantApi.list()) ?? 0,
      }));
      runSource('factory_workshops', async () => ({
        factory_workshops: getApiListCount(await workshopApi.list()) ?? 0,
      }));
      runSource('factory_lines', async () => ({
        factory_lines: getApiListCount(await productionLineApi.list()) ?? 0,
      }));
      runSource('factory_stations', async () => ({
        factory_stations: getApiListCount(await workstationApi.list()) ?? 0,
      }));
      runSource('factory_work_centers', async () => ({
        factory_work_centers: getApiListCount(await workCenterApi.list()) ?? 0,
      }));
      runSource('factory_work_groups', async () => ({
        factory_work_groups: getApiListCount(await workGroupApi.list()) ?? 0,
      }));
      runSource('factory_data_join', async () => {
        const [w, l, s] = await Promise.all([
          workshopApi.list().catch(() => null),
          productionLineApi.list().catch(() => null),
          workstationApi.list().catch(() => null),
        ]);
        const wv = getApiListCount(w) ?? 0;
        const lv = getApiListCount(l) ?? 0;
        const sv = getApiListCount(s) ?? 0;
        return { factory_data: wv || lv || sv ? 1 : 0 };
      });
      runSource('user_data', async () => {
        const r = await getUserList({ page: 1, page_size: 1 });
        const total = getApiListCount(r) ?? 0;
        return { user_data: Math.max(0, total - 1) };
      });
      runSource('order_data', async () => {
        const [s, p] = await Promise.all([
          listSalesOrders({ limit: 1 }).catch(() => null),
          listPurchaseOrders({ limit: 1 }).catch(() => null),
        ]);
        const sv = getApiListCount(s) ?? 0;
        const pv = getApiListCount(p) ?? 0;
        const total = sv + pv;
        return { order_data: total, first_order_run: total };
      });
    } else {
      // implementer
      runSource('user_data', async () => {
        const r = await getUserList({ page: 1, page_size: 1 });
        const total = getApiListCount(r) ?? 0;
        const v = Math.max(0, total - 1);
        return { user_data: v, imp_user: v };
      });
      runSource('imp_dept', async () => ({
        imp_dept: countDepartmentRecords(await getDepartmentTree()),
      }));
      runSource('imp_post', async () => ({
        imp_post: getApiListCount(await getPositionList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_role', async () => ({
        imp_role: getApiListCount(await getRoleList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_rule', async () => ({
        imp_rule: getApiListCount(await getCodeRuleList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_dict', async () => ({
        imp_dict: getApiListCount(await getDataDictionaryList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_lang', async () => ({
        imp_lang: getApiListCount(await getLanguageList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_field', async () => ({
        imp_field: getApiListCount(await getCustomFieldList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_menu', async () => {
        const r = await getMenus({ page: 1, page_size: 1 });
        return { imp_menu: Array.isArray(r) ? r.length : 0 };
      });
      runSource('imp_workflow', async () => {
        const r = await getApprovalProcessList({ skip: 0, limit: 1 });
        return { imp_workflow: Array.isArray(r) ? r.length : 0 };
      });
      runSource('imp_msg', async () => {
        const r = await getMessageTemplateList({ skip: 0, limit: 1 });
        return { imp_msg: Array.isArray(r) ? r.length : 0 };
      });
      runSource('imp_print', async () => {
        const r = await getPrintTemplateList({ skip: 0, limit: 1 });
        return { imp_print: Array.isArray(r) ? r.length : 0 };
      });
      runSource('imp_file', async () => ({
        imp_file: getApiListCount(await getFileList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_api', async () => ({
        imp_api: getApiListCount(await getDataSourceList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_connector', async () => ({
        imp_connector:
          getApiListCount(await getApplicationConnectionList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_dataset', async () => ({
        imp_dataset: getApiListCount(await getDatasetList({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_audit', async () => {
        const r = await getOperationLogs({ page: 1, page_size: 1 });
        const total = r && typeof r === 'object' && 'total' in r ? Number((r as any).total) || 0 : 0;
        return { imp_audit: Math.max(0, total) };
      });
      runSource('imp_login', async () => {
        const r = await getLoginLogs({ page: 1, page_size: 1 });
        const total = r && typeof r === 'object' && 'total' in r ? Number((r as any).total) || 0 : 0;
        return { imp_login: Math.max(0, total) };
      });
      runSource('imp_backup', async () => ({
        imp_backup: getApiListCount(await getBackups({ page: 1, page_size: 1 })) ?? 0,
      }));
      runSource('imp_app_center', async () => {
        const r = await getInstalledApplicationList();
        return { imp_app_center: Array.isArray(r) ? r.length : 0 };
      });
    }

      realCountsCacheRef.current[cacheKey] = Date.now();
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, realCountsRefreshKey]);

  /**
   * 加载系统上线向导
   */
  const loadSystemGuide = async () => {
    try {
      setLoading(true);
      const data = await getSystemGoLiveGuide();
      setSystemGuideData(data);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.onboardingWizard.loadSystemFailed'));
      setSystemGuideData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载角色上线向导数据
   */
  const loadRoleGuide = async (roleCode: string) => {
    try {
      setLoading(true);
      const response: any = await getRoleOnboardingGuide(undefined, roleCode);
      const data = response.guide || response;
      setGuideData(data);

      const tenantId = getTenantId();
      const storageKey = tenantId != null ? `onboarding_completed_t${tenantId}_${roleCode}` : `onboarding_completed_${roleCode}`;
      const savedCompleted = localStorage.getItem(storageKey);
      if (savedCompleted) {
        setCompletedItems(new Set(JSON.parse(savedCompleted)));
      } else {
        setCompletedItems(new Set());
      }
    } catch (error: any) {
      // 很多角色的 API 可能尚未开发完毕或暂不提供配置清单，为避免频繁弹窗报错，这里改为静默处理并让 UI 自动降级显示 Empty 状态
      console.warn(`[Onboarding] Role ${roleCode} guide data not found or API failed.`, error?.message);
      setGuideData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 切换 Tab
   */
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'system') {
      loadSystemGuide();
    } else {
      loadRoleGuide(key);
    }
  };

  /**
   * 切换完成状态
   */
  const handleItemToggle = (itemId: string) => {
    const newCompleted = new Set(completedItems);
    if (newCompleted.has(itemId)) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    setCompletedItems(newCompleted);
    const tenantId = getTenantId();
    const storageKey = tenantId != null ? `onboarding_completed_t${tenantId}_${activeTab}` : `onboarding_completed_${activeTab}`;
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newCompleted)));
  };

  /**
   * 计算完成进度
   */
  const calculateProgress = () => {
    if (!guideData || !guideData.checklist) return 0;
    let total = 0;
    let completed = 0;
    guideData.checklist.forEach((category: any) => {
      category.items.forEach((item: any) => {
        total++;
        if (completedItems.has(item.id)) {
          completed++;
        }
      });
    });
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  useEffect(() => {
    if (activeTab === 'system') {
      loadSystemGuide();
    } else if (activeTab === 'implementer') {
      // Logic handled via renderImplementerTab
    } else {
      loadRoleGuide(activeTab);
    }
  }, [activeTab]);

  const progress = calculateProgress();

  const systemChecklist = useMemo(() => {
    const apiChecklist = systemGuideData?.guide?.checklist || [];

    // 强制使用 ENHANCED_CHECKLIST 作为前端的基准骨架结构，确保“从0到1”的 4 阶段全链路引导不缺失
    return enhancedChecklist.map((enhancedCat) => ({
      ...enhancedCat,
      id: enhancedCat.id,
      name: enhancedCat.name,
      items: enhancedCat.items.map((enhancedItem) => {
          // 遍历后端所有分类，寻找匹配的任务项，以同步后端可能的完成状态
          let apiItem: any = null;
          for (const cat of apiChecklist) {
            const found = (cat.items || []).find((i: any) => i.id === enhancedItem.id || i.name === enhancedItem.name);
            if (found) {
              apiItem = found;
              break;
            }
          }
          
          return {
            ...enhancedItem,
            id: enhancedItem.id,
            name: enhancedItem.name,
            description: enhancedItem.description,
            jump_path: apiItem?.jump_path || enhancedItem.jump_path,
            required: apiItem?.required ?? enhancedItem.required,
            completed: apiItem?.completed ?? enhancedItem.completed,
          };
        }),
    }));
  }, [systemGuideData, enhancedChecklist]);
  
  const implementerChecklist = useMemo(() => {
    // 强制使用 IMPLEMENTER_ENHANCED_CHECKLIST 作为实施向导的骨架
    return implementerEnhancedChecklist.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        // 如果有子项，根据子项状态判断整体完成度（这里简化处理，手动勾选 group 也会记录）
        const hasSubItems = item.subItems && item.subItems.length > 0;
        let isGroupCompleted = completedItems.has(item.id);
        
        if (hasSubItems && !isGroupCompleted) {
          // 如果所有必填子项都已手动勾选或接口检测到存量，则视为完成
          const requiredSubs = item.subItems!.filter(s => s.required);
          if (requiredSubs.length > 0) {
            isGroupCompleted = requiredSubs.every(
              (s) => completedItems.has(s.id) || (realCounts[s.id] ?? 0) > 0
            );
          }
        }

        return {
          ...item,
          completed: isGroupCompleted
        };
      })
    }));
  }, [completedItems, realCounts, implementerEnhancedChecklist]);

  /** 仅统计「核心必办」大项；完成判定与列表卡片一致（存量 + 后端 completed + 手动勾选） */
  const sysProgress = useMemo(() => {
    let sysCompleted = 0;
    let sysTotal = 0;
    systemChecklist.forEach((cat: any) => {
      cat.items?.forEach((item: any) => {
        if (!item.required) return;
        sysTotal++;
        if (isSystemLaunchListItemCompleted(item, realCounts, completedItems)) sysCompleted++;
      });
    });
    return sysTotal > 0 ? Math.round((sysCompleted / sysTotal) * 100) : 0;
  }, [systemChecklist, completedItems, realCounts]);

  /** 系统设定向导：环形进度仅统计必填子项（与卡片内「进度 (必选)」口径一致，不含可选页） */
  const impProgress = useMemo(() => {
    let done = 0;
    let total = 0;
    implementerChecklist.forEach((cat: any) => {
      cat.items?.forEach((item: any) => {
        const subs = item.subItems || [];
        if (!subs.length) {
          if (item.required) {
            total += 1;
            if (item.completed) done += 1;
          }
          return;
        }
        subs.forEach((sub: any) => {
          if (!sub.required) return;
          total += 1;
          if (completedItems.has(sub.id) || (realCounts[sub.id] ?? 0) > 0) done += 1;
        });
      });
    });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [implementerChecklist, completedItems, realCounts]);



  /** 系统设定向导 (管理员专用) */
  const renderImplementerTab = () => {
    // 计算当前阶段
    const currentStep = implementerChecklist.findIndex((cat: any) => 
      (cat.items || []).some((item: any) => !item.completed)
    );
    const activeStep = currentStep === -1 ? implementerChecklist.length : currentStep;

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Card 
          style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, overflow: 'hidden' }}
          styles={{ body: { padding: 0 } }}
        >
          {/* Header */}
          <div style={{ 
            padding: '24px', 
            background: isDark ? `linear-gradient(135deg, ${token.colorPrimary}1A 0%, #141414 100%)` : `linear-gradient(135deg, ${token.colorInfoBg} 0%, #ffffff 100%)`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`, 
                color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, marginRight: 16,
                boxShadow: `0 4px 12px ${token.colorPrimary}40`
              }}>
                {onboardingMenuIcon(ManufacturingIcons.package)}
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t('pages.system.onboardingWizard.tabImplementer')}
                </Typography.Title>
                <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center' }}>
                  {wizIcon(Target, 16, { marginRight: 6, flexShrink: 0 }, token.colorPrimary)}
                  {roleMissionMap.implementer}
                </Text>
              </div>
            </div>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    {wizIcon(Archive, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                    {t('pages.system.onboardingWizard.adminCoreDuties')}
                  </Text>
                  <Text strong style={{ fontSize: 13, color: token.colorText }}>{t('pages.system.onboardingWizard.adminCoreDutiesValue')}</Text>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    {wizIcon(FileSearch, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                    {t('pages.system.onboardingWizard.deliveryAcceptance')}
                  </Text>
                  <Text strong style={{ fontSize: 13, color: token.colorText }}>{t('pages.system.onboardingWizard.deliveryAcceptanceValue')}</Text>
                </div>
              </Col>
            </Row>
            
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start' }}>
              {wizIcon(AlertCircle, 16, { marginTop: 4, marginRight: 8, flexShrink: 0 }, token.colorWarning)}
              <Text type="secondary" style={{ fontSize: 13 }}>
                <span style={{ color: token.colorWarning, fontWeight: 500 }}>{t('pages.system.onboardingWizard.expertTip')}</span>
                {t('pages.system.onboardingWizard.implementerExpertTip')}
              </Text>
            </div>
          </div>
          {/* List Section */}
          <div style={{ padding: '24px' }}>
            <Steps
              direction="vertical"
              size="small"
              className="onboarding-steps"
              current={activeStep}
              items={implementerChecklist.map((category: any, idx: number) => {
                const isCurrentStep = idx === activeStep;

                return {
                  title: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ 
                        fontSize: 14, 
                        fontWeight: 500,
                        color: isCurrentStep ? token.colorText : token.colorTextSecondary 
                      }}>
                        {category.name}
                      </span>
                    </div>
                  ),
                  status: 'finish',
                  description: (
                    <List
                      dataSource={category.items || []}
                      renderItem={(item: any) => {
                        const isCompleted = item.completed;
                        
                        return (
                          <List.Item
                            className="onboarding-list-item"
                            style={{
                              padding: '20px 24px',
                              marginBottom: 16,
                              borderRadius: token.borderRadiusLG,
                              border: `1px solid ${isCompleted ? 'rgba(82, 196, 26, 0.2)' : token.colorBorderSecondary}`,
                              background: isCompleted 
                                ? (isDark 
                                    ? 'linear-gradient(145deg, rgba(82, 196, 26, 0.05) 0%, rgba(0, 0, 0, 0) 100%)' 
                                    : 'linear-gradient(145deg, rgba(82, 196, 26, 0.04) 0%, rgba(255, 255, 255, 0.6) 100%)')
                                : token.colorBgContainer,
                            }}
                          >
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 24 }}>
                              <div style={{ display: 'flex', flex: 1, gap: 16, alignItems: 'flex-start' }}>
                                <Checkbox 
                                  checked={isCompleted}
                                  onChange={() => handleItemToggle(item.id)}
                                  style={{ marginTop: 4 }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text strong style={{ fontSize: 16, color: isCompleted ? token.colorSuccess : token.colorText }}>
                                      {item.name}
                                    </Text>
                                    {item.required && !isCompleted && (
                                      <Tag variant="filled" color="error" style={{ fontSize: 10, borderRadius: 4, paddingInline: 6 }}>{t('pages.system.onboardingWizard.required')}</Tag>
                                    )}
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.6', maxWidth: 500 }}>{item.description}</Text>
                                </div>
                              </div>

                              {/* Right: Status & Action */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.015)',
                                  borderRadius: 14,
                                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'}`,
                                  overflow: 'hidden'
                                }}>
                                  {(() => {
                                    let req = 0, opt = 0, done = 0;
                                    if (item.subItems && item.subItems.length > 0) {
                                      item.subItems.forEach((sub: any) => {
                                        if (sub.required) req++; else opt++;
                                        if (completedItems.has(sub.id) || realCounts[sub.id] > 0) done++;
                                      });
                                    } else {
                                      if (item.required) req = 1; else opt = 1;
                                      if (isCompleted) done = 1;
                                    }
                                    
                                    const StatItem = ({ label, value, subValue, icon: Icon, isError, iconColor, valueColor }: any) => (
                                      <div style={{ 
                                        padding: '8px 16px', 
                                        paddingRight: 24,
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 12,
                                        minWidth: 120
                                      }}>
                                        <div style={{ 
                                          width: 32, 
                                          height: 32, 
                                          borderRadius: 10, 
                                          background: iconColor ? `${iconColor}1A` : (isDark ? 'rgba(255,255,255,0.08)' : '#fff'),
                                          boxShadow: !iconColor && !isDark ? '0 2px 4px rgba(0,0,0,0.02)' : 'none',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: iconColor || token.colorPrimary
                                        }}>
                                          <Icon size={16} strokeWidth={2.5} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                          <span style={{ fontSize: 10, color: token.colorTextSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                            <span style={{ 
                                              fontSize: 18, 
                                              fontWeight: 700, 
                                              color: valueColor || (isError ? token.colorError : token.colorText), 
                                              fontFamily: 'Inter, system-ui, sans-serif' 
                                            }}>
                                              {value}
                                            </span>
                                            {subValue !== undefined && (
                                              <span style={{ fontSize: 12, color: token.colorTextTertiary, fontWeight: 500 }}>
                                                / {subValue}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <>
                                        <StatItem 
                                          label={t('pages.system.onboardingWizard.progressRequired')} 
                                          value={done} 
                                          subValue={req}
                                          isError={req > 0 && done === 0}
                                          iconColor="#EAB308"
                                          valueColor={done > 0 ? token.colorSuccess : (req > 0 ? token.colorError : undefined)}
                                          icon={Target} 
                                        />
                                        <div style={{ width: 1, height: 24, background: token.colorBorderSecondary, opacity: 0.3 }} />
                                        <StatItem 
                                          label={t('pages.system.onboardingWizard.allModules')} 
                                          value={req + opt} 
                                          icon={Layers} 
                                          iconColor={isDark ? '#8b5cf6' : '#7c3aed'}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>

                                {(item.jump_path || (item.subItems && item.subItems.length > 0)) && (
                                  <Button
                                    type={isCompleted ? 'default' : 'primary'}
                                    size="large"
                                    shape="round"
                                    icon={
                                      isCompleted
                                        ? wizIcon(CheckCircle2, 16, undefined, token.colorSuccess)
                                        : wizIcon(ArrowRight, 16)
                                    }
                                    onClick={() => {
                                      if (!isCompleted) {
                                        if (item.subItems) {
                                          setCurrentDetailItem(item);
                                          setDetailModalVisible(true);
                                        } else {
                                          navigate(item.jump_path);
                                        }
                                      }
                                    }}
                                    style={{ 
                                      borderRadius: 25, 
                                      paddingInline: 36,
                                      minWidth: 160,
                                      fontSize: 16, 
                                      height: 50,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      ...(isCompleted
                                        ? {
                                            background: token.colorSuccessBg,
                                            border: `1px solid ${token.colorSuccessBorder}`,
                                            color: token.colorSuccess,
                                            boxShadow: 'none',
                                            cursor: 'default',
                                          }
                                        : {
                                            background: `linear-gradient(90deg, #1890ff 0%, #0070f3 100%)`,
                                            border: 'none',
                                            boxShadow: `0 6px 16px rgba(0, 112, 243, 0.3)`,
                                            color: '#fff',
                                          }),
                                    }}
                                  >
                                    {isCompleted ? t('pages.system.onboardingWizard.completed') : t('pages.system.onboardingWizard.goNow')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  )
                };
              })}
            />
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorSuccessBg,
              borderRadius: `0 0 ${token.borderRadiusLG}px ${token.borderRadiusLG}px`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorSuccess)}
              <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess, margin: 0 }}>
                {t('pages.system.onboardingWizard.implementerEmpowermentTitle')}
              </Text>
            </div>
            <Text strong style={{ fontSize: 13, color: token.colorText, fontWeight: 500 }}>
              {t('pages.system.onboardingWizard.implementerEmpowermentValue')}
            </Text>
          </div>
        </Card>
      </div>
    );
  };

  /** 系统上线 Tab 内容 */
  const renderSystemTab = () => {
    if (loading && !systemGuideData) {
      return <Card loading={loading} />;
    }
    if (!systemGuideData) {
      return <Card><Empty description={t('pages.system.onboardingWizard.emptySystem')} /></Card>;
    }
    const { init_completed, guide } = systemGuideData;
    if (!init_completed) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Alert
            message={t('pages.system.onboardingWizard.alertInitTitle')}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  {t('pages.system.onboardingWizard.alertInitDesc')}
                </Paragraph>
                <Button type="primary" onClick={() => navigate('/init/wizard')}>
                  {t('pages.system.onboardingWizard.goToInit')}
                </Button>
              </div>
            }
            type="warning"
            showIcon
            icon={wizIcon(AlertTriangle, 18)}
          />
        </div>
      );
    }

    // 计算当前应该进行到哪一个阶段（第一个包含未完成项的阶段）
    const currentStep = systemChecklist.findIndex((cat: any) =>
      (cat.items || []).some((item: any) => !isSystemLaunchListItemCompleted(item, realCounts, completedItems))
    );
    const activeStep = currentStep === -1 ? systemChecklist.length : currentStep;

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 四阶段分层引导 */}
        <Card 
          style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, overflow: 'hidden' }}
          styles={{ body: { padding: 0 } }}
        >
          {/* 顶层整合 Header */}
          <div style={{ 
            padding: '24px', 
            background: isDark ? `linear-gradient(135deg, ${token.colorPrimary}1A 0%, #141414 100%)` : `linear-gradient(135deg, ${token.colorInfoBg} 0%, #ffffff 100%)`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`, 
                color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, marginRight: 16,
                boxShadow: `0 4px 12px ${token.colorPrimary}40`
              }}>
                {onboardingMenuIcon(ManufacturingIcons.compass)}
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t('pages.system.onboardingWizard.tabSystem')}
                </Typography.Title>
                <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center' }}>
                  {wizIcon(Target, 16, { marginRight: 6, flexShrink: 0 }, token.colorPrimary)}
                  {t('pages.system.onboardingWizard.system.mission')}
                </Text>
              </div>
            </div>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    {wizIcon(Archive, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                    {t('pages.system.onboardingWizard.prerequisiteData')}
                  </Text>
                  <Text strong style={{ fontSize: 13, color: token.colorText }}>{t('pages.system.onboardingWizard.system.prerequisiteData')}</Text>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    {wizIcon(FileSearch, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                    {t('pages.system.onboardingWizard.businessDocs')}
                  </Text>
                  <Text strong style={{ fontSize: 13, color: token.colorText }}>{t('pages.system.onboardingWizard.system.businessDocs')}</Text>
                </div>
              </Col>
            </Row>
            
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start' }}>
              {wizIcon(AlertCircle, 16, { marginTop: 4, marginRight: 8, flexShrink: 0 }, token.colorWarning)}
              <Text type="secondary" style={{ fontSize: 13 }}>
                <span style={{ color: token.colorWarning, fontWeight: 500 }}>{t('pages.system.onboardingWizard.implementationTipLabel')}</span>
                {t('pages.system.onboardingWizard.implementationTip')}
              </Text>
            </div>
          </div>

          {/* 清单部分 */}
          <div style={{ padding: '24px' }}>
            <Steps
              direction="vertical"
              size="small"
              className="onboarding-steps"
              current={activeStep}
              items={systemChecklist.map((category: any, idx: number) => {
                const isCurrentStep = idx === activeStep;

                return {
                  title: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ 
                        fontSize: 14, 
                        fontWeight: 500,
                        color: isCurrentStep ? token.colorText : token.colorTextSecondary 
                      }}>
                        {category.name}
                      </span>
                    </div>
                  ),
                  status: 'finish',
                  description: (
                    <List
                      dataSource={category.items || []}
                      renderItem={(item: any) => {
                        const realCount = getSystemLaunchStockCount(item, realCounts);
                        const isCompleted = isSystemLaunchListItemCompleted(item, realCounts, completedItems);
                        const enhanced = enhancedMissionGuide[item.id] || enhancedMissionGuide[item.check_key || ''];
                        
                        return (
                          <List.Item
                            className="onboarding-list-item"
                            style={{
                              padding: '20px 24px',
                              marginBottom: 16,
                              borderRadius: token.borderRadiusLG,
                              border: `1px solid ${isCompleted ? 'rgba(82, 196, 26, 0.2)' : token.colorBorderSecondary}`,
                              background: isCompleted 
                                ? (isDark 
                                    ? 'linear-gradient(145deg, rgba(82, 196, 26, 0.05) 0%, rgba(0, 0, 0, 0) 100%)' 
                                    : 'linear-gradient(145deg, rgba(82, 196, 26, 0.04) 0%, rgba(255, 255, 255, 0.6) 100%)')
                                : token.colorBgContainer,
                            }}
                          >
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 24 }}>
                              {/* Left: Info */}
                              <div style={{ display: 'flex', flex: 1, gap: 16, alignItems: 'flex-start' }}>
                                <Checkbox 
                                  checked={isCompleted}
                                  onChange={(e) => handleItemToggle(item.id)}
                                  style={{ marginTop: 4 }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text strong style={{ fontSize: 16, color: isCompleted ? token.colorSuccess : token.colorText }}>
                                      {item.name}
                                    </Text>
                                    {item.required && !isCompleted && (
                                      <Tag variant="filled" color="error" style={{ fontSize: 10, borderRadius: 4, paddingInline: 6 }}>{t('pages.system.onboardingWizard.required')}</Tag>
                                    )}
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.6', maxWidth: 500 }}>{item.description}</Text>
                                  
                                  {(enhanced?.dependency || enhanced?.tip) && (
                                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {enhanced?.dependency && (
                                        <Text type="danger" style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>
                                          {wizIcon(CalendarClock, 12, { marginRight: 6 })} {t('pages.system.onboardingWizard.prerequisite')}{enhanced.dependency}
                                        </Text>
                                      )}
                                      {enhanced?.tip && (
                                        <Text type="warning" style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>
                                          {wizIcon(AlertCircle, 12, { marginRight: 6 })} {t('pages.system.onboardingWizard.expertTip')}{enhanced.tip}
                                        </Text>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right: Status & Action */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.015)',
                                  borderRadius: 14,
                                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'}`,
                                  overflow: 'hidden'
                                }}>
                                  {(() => {
                                    let req = 0, opt = 0, done = 0;
                                    if (item.subItems && item.subItems.length > 0) {
                                      item.subItems.forEach((sub: any) => {
                                        if (sub.required) req++; else opt++;
                                        if (sub.required && (realCounts[sub.check_key] ?? 0) > 0) done++;
                                      });
                                    } else {
                                      if (item.required) req = 1; else opt = 1;
                                      if (realCounts[item.id] > 0) done = 1;
                                    }
                                    
                                    const StatItem = ({ label, value, subValue, icon: Icon, isError, iconColor, valueColor }: any) => (
                                      <div style={{ 
                                        padding: '8px 16px', 
                                        paddingRight: 24,
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 12,
                                        minWidth: 120
                                      }}>
                                        <div style={{ 
                                          width: 32, 
                                          height: 32, 
                                          borderRadius: 10, 
                                          background: iconColor ? `${iconColor}1A` : (isDark ? 'rgba(255,255,255,0.08)' : '#fff'),
                                          boxShadow: !iconColor && !isDark ? '0 2px 4px rgba(0,0,0,0.02)' : 'none',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: iconColor || token.colorPrimary
                                        }}>
                                          <Icon size={16} strokeWidth={2.5} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                          <span style={{ fontSize: 10, color: token.colorTextSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                            <span style={{ 
                                              fontSize: 18, 
                                              fontWeight: 700, 
                                              color: valueColor || (isError ? token.colorError : token.colorText), 
                                              fontFamily: 'Inter, system-ui, sans-serif' 
                                            }}>
                                              {value}
                                            </span>
                                            {subValue !== undefined && (
                                              <span style={{ fontSize: 12, color: token.colorTextTertiary, fontWeight: 500 }}>
                                                / {subValue}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <>
                                        <StatItem 
                                          label={t('pages.system.onboardingWizard.progressRequired')} 
                                          value={done} 
                                          subValue={req}
                                          isError={req > 0 && done === 0}
                                          iconColor="#EAB308"
                                          valueColor={done > 0 ? token.colorSuccess : (req > 0 ? token.colorError : undefined)}
                                          icon={Target} 
                                        />
                                        <div style={{ width: 1, height: 24, background: token.colorBorderSecondary, opacity: 0.3 }} />
                                        <StatItem 
                                          label={t('pages.system.onboardingWizard.allModules')} 
                                          value={req + opt} 
                                          icon={Layers} 
                                          iconColor={isDark ? '#8b5cf6' : '#7c3aed'}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>

                                {item.actionable === 'mark_initial_data_verified' ? (
                                  <Button
                                    type={isCompleted ? 'default' : 'primary'}
                                    size="large"
                                    shape="round"
                                    icon={isCompleted ? wizIcon(CheckCircle2, 16, undefined, token.colorSuccess) : wizIcon(ArrowRight, 16)}
                                    onClick={async () => {
                                      try {
                                        if (isCompleted) {
                                          await revokeInitialDataVerified();
                                          messageApi.success(t('pages.system.onboardingWizard.revokeVerifiedSuccess'));
                                        } else {
                                          await markInitialDataVerified();
                                          messageApi.success(t('pages.system.onboardingWizard.markVerifiedSuccess'));
                                        }
                                        setRealCounts((prev) => ({
                                          ...prev,
                                          initial_data_verified: isCompleted ? 0 : 1,
                                        }));
                                        setRealCountsRefreshKey((k) => k + 1);
                                      } catch (err: any) {
                                        messageApi.error(err?.message || t('pages.system.onboardingWizard.actionFailed'));
                                      }
                                    }}
                                    style={{
                                      borderRadius: 25,
                                      paddingInline: 36,
                                      minWidth: 160,
                                      fontSize: 16,
                                      height: 50,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      ...(isCompleted
                                        ? {
                                            background: token.colorSuccessBg,
                                            border: `1px solid ${token.colorSuccessBorder}`,
                                            color: token.colorSuccess,
                                            boxShadow: 'none',
                                          }
                                        : {
                                            background: `linear-gradient(90deg, #1890ff 0%, #0070f3 100%)`,
                                            border: 'none',
                                            boxShadow: `0 6px 16px rgba(0, 112, 243, 0.3)`,
                                            color: '#fff',
                                          }),
                                    }}
                                  >
                                    {isCompleted ? t('pages.system.onboardingWizard.verifiedRevoke') : t('pages.system.onboardingWizard.markVerified')}
                                  </Button>
                                ) : item.jump_path && (
                                  <Button
                                    type={isCompleted ? 'default' : 'primary'}
                                    size="large"
                                    shape="round"
                                    icon={isCompleted ? wizIcon(CheckCircle2, 16, undefined, token.colorSuccess) : wizIcon(ArrowRight, 16)}
                                    onClick={() => {
                                      if (!isCompleted) {
                                        if (item.subItems) {
                                          setCurrentDetailItem(item);
                                          setDetailModalVisible(true);
                                        } else {
                                          navigate(item.jump_path);
                                        }
                                      }
                                    }}
                                    style={{ 
                                      borderRadius: 25, 
                                      paddingInline: 36,
                                      minWidth: 160,
                                      fontSize: 16, 
                                      height: 50,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      ...(isCompleted
                                        ? {
                                            background: token.colorSuccessBg,
                                            border: `1px solid ${token.colorSuccessBorder}`,
                                            color: token.colorSuccess,
                                            boxShadow: 'none',
                                            cursor: 'default',
                                          }
                                        : {
                                            background: `linear-gradient(90deg, #1890ff 0%, #0070f3 100%)`,
                                            border: 'none',
                                            boxShadow: `0 6px 16px rgba(0, 112, 243, 0.3)`,
                                            color: '#fff',
                                          }),
                                    }}
                                  >
                                    {isCompleted ? t('pages.system.onboardingWizard.completed') : t('pages.system.onboardingWizard.goNow')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  ),
                };
              })}
            />
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorSuccessBg,
              borderRadius: `0 0 ${token.borderRadiusLG}px ${token.borderRadiusLG}px`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorSuccess)}
              <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess, margin: 0 }}>
                {t('pages.system.onboardingWizard.empowermentTitle')}
              </Text>
            </div>
            <Text strong style={{ fontSize: 13, color: token.colorText, fontWeight: 500 }}>
              {t('pages.system.onboardingWizard.system.empowermentValue')}
            </Text>
          </div>
        </Card>

      </div>
    );
  };

  /** 角色 Tab 内容 */
  const renderRoleTab = () => {
    if (activeTab === 'system') {
      return renderSystemTab();
    }
    if (activeTab === 'implementer') {
      return renderImplementerTab();
    }

    if (loading && !guideData) return <Card loading={loading} />;
    
    const apiRoleItems = guideData?.checklist?.[0]?.items || [];
    const roleChecklistItems = apiRoleItems.length > 0
      ? localizeRoleChecklistItems(apiRoleItems, activeTab, roleDefaultChecklists)
      : (roleDefaultChecklists[activeTab] || []);
    
    const currentRoleName = ROLE_TAB_NAME_KEYS[activeTab] ? t(ROLE_TAB_NAME_KEYS[activeTab]) : t('pages.system.onboardingWizard.roleChecklist');

    return (
        <Card
          style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, overflow: 'hidden' }}
          styles={{ body: { padding: 0 } }}
        >
          {/* 顶层整合 Header */}
          <div style={{ 
            padding: '24px', 
            background: isDark ? `linear-gradient(135deg, ${token.colorPrimary}1A 0%, #141414 100%)` : `linear-gradient(135deg, ${token.colorInfoBg} 0%, #ffffff 100%)`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`, 
                color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, marginRight: 16,
                boxShadow: `0 4px 12px ${token.colorPrimary}40`
              }}>
                {ROLE_KEYS.find(k => k.code === activeTab)?.icon || wizIcon(Rocket, 22, undefined, '#fff')}
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {currentRoleName}
                </Typography.Title>
                <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'flex', alignItems: 'center' }}>
                  {wizIcon(Target, 16, { marginRight: 6, flexShrink: 0 }, token.colorPrimary)}
                  {roleMissionMap[activeTab] || t('pages.system.onboardingWizard.roleMissionFallback')}
                </Text>
              </div>
            </div>

            {roleDetailsMap[activeTab] && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      {wizIcon(Archive, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                      {t('pages.system.onboardingWizard.prerequisiteData')}
                    </Text>
                    <Text strong style={{ fontSize: 13, color: token.colorText }}>{roleDetailsMap[activeTab].data}</Text>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}60`, height: '100%', backdropFilter: 'blur(8px)' }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      {wizIcon(FileSearch, 14, { marginRight: 6, verticalAlign: 'middle', display: 'inline-block' })}
                      {t('pages.system.onboardingWizard.businessDocs')}
                    </Text>
                    <Text strong style={{ fontSize: 13, color: token.colorText }}>{roleDetailsMap[activeTab].docs}</Text>
                  </div>
                </Col>
              </Row>
            )}
            
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start' }}>
              {wizIcon(AlertCircle, 16, { marginTop: 4, marginRight: 8, flexShrink: 0 }, token.colorWarning)}
              <Text type="secondary" style={{ fontSize: 13 }}>
                <span style={{ color: token.colorWarning, fontWeight: 500 }}>{t('pages.system.onboardingWizard.expertTip')}</span>
                {t('pages.system.onboardingWizard.roleExpertTip')}
              </Text>
            </div>
          </div>

          {/* 清单部分 */}
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={8}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{t('pages.system.onboardingWizard.coreOperationGuide')}</span>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
                  {t('pages.system.onboardingWizard.keyTaskCount', { count: roleChecklistItems.length })}
                </Text>
              </Space>
            </div>

            {roleChecklistItems.length === 0 ? (
              <Empty description={t('pages.system.onboardingWizard.emptyRole')} />
            ) : (
              <List
                style={{ paddingTop: 8 }}
                dataSource={roleChecklistItems}
                renderItem={(item: any) => {
                  const isCompleted = completedItems.has(item.id) || item.completed === true;
                  return (
                    <List.Item
                      className="onboarding-list-item"
                      style={{
                        padding: '20px 24px',
                        marginBottom: 16,
                        borderRadius: token.borderRadiusLG,
                        border: `1px solid ${isCompleted ? token.colorBorder : token.colorBorderSecondary}`,
                        background: isCompleted 
                          ? (isDark ? 'rgba(255, 255, 255, 0.02)' : '#fafafa')
                          : token.colorBgContainer,
                      }}
                    >
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 24 }}>
                        {/* Left: Info */}
                        <div style={{ display: 'flex', flex: 1, gap: 16, alignItems: 'flex-start' }}>
                          <Checkbox 
                            checked={isCompleted}
                            disabled={isCompleted}
                            style={{ marginTop: 4 }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleItemToggle(item.id);
                                messageApi.success(t('pages.system.onboardingWizard.markItemComplete', { name: item.name }));
                              }
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Text strong={item.required} style={{ fontSize: 16 }}>{item.name}</Text>
                              {item.required && <Tag variant="filled" color="error" style={{ fontSize: 10, borderRadius: 4, paddingInline: 6 }}>{t('pages.system.onboardingWizard.required')}</Tag>}
                              {isCompleted && wizIcon(CheckCircle2, 16, { color: token.colorSuccess })}
                            </div>
                            <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.6', maxWidth: 600 }}>
                              {item.description}
                            </Text>
                            <div style={{ marginTop: 4, opacity: 0.8 }}>
                              <Tag variant="filled" style={{ fontSize: 11, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                                {t('pages.system.onboardingWizard.businessStandard')}
                              </Tag>
                            </div>
                          </div>
                        </div>

                        {/* Right: Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {item.jump_path && (
                            <Button
                              type={isCompleted ? 'default' : 'primary'}
                              size="middle"
                              shape="round"
                              icon={
                                isCompleted
                                  ? wizIcon(CheckCircle2, 16, undefined, token.colorSuccess)
                                  : wizIcon(PlayCircle, 16)
                              }
                              onClick={() => !isCompleted && navigate(item.jump_path)}
                              className={
                                isCompleted ? 'onboarding-completed-btn' : 'onboarding-action-btn'
                              }
                              style={{ 
                                borderRadius: token.borderRadiusLG, 
                                paddingInline: 24,
                                minWidth: 120,
                                fontSize: 14, 
                                height: 36,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                ...(isCompleted
                                  ? {
                                      background: token.colorSuccessBg,
                                      border: `1px solid ${token.colorSuccessBorder}`,
                                      color: token.colorSuccess,
                                      boxShadow: 'none',
                                      cursor: 'default',
                                    }
                                  : {
                                      background: `linear-gradient(90deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`,
                                      border: 'none',
                                      boxShadow: `0 4px 12px ${token.colorPrimary}40`,
                                      color: '#fff',
                                    }),
                              }}
                            >
                              {isCompleted ? t('pages.system.onboardingWizard.completed') : t('pages.system.onboardingWizard.goNow')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>

          {roleDetailsMap[activeTab]?.value && (
            <div
              style={{
                padding: '16px 24px',
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorSuccessBg,
                borderRadius: `0 0 ${token.borderRadiusLG}px ${token.borderRadiusLG}px`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                {wizIcon(Zap, 16, { marginRight: 8, flexShrink: 0 }, token.colorSuccess)}
                <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess, margin: 0 }}>
                  {t('pages.system.onboardingWizard.empowermentTitle')}
                </Text>
              </div>
              <Text strong style={{ fontSize: 13, color: token.colorText, fontWeight: 500 }}>
                {roleDetailsMap[activeTab].value}
              </Text>
            </div>
          )}
        </Card>
    );
  };

  if (!cfgReady) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!launchWizardOn) {
    return null;
  }

  return (
    <div style={{ width: '100%', padding: 0, boxSizing: 'border-box' }}>
      <style>{stepStyle}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginTop: 0, marginBottom: 8, letterSpacing: '-0.02em', fontSize: '24px' }}>
            {t('pages.system.onboardingWizard.title')}
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 0 }}>
            {t('pages.system.onboardingWizard.subtitle')}
          </Paragraph>
        </div>
        
        {/* 右侧环形进度组件 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16, 
          background: token.colorBgContainer, 
          padding: '8px 8px 8px 24px', 
          borderRadius: 32,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Text strong style={{ fontSize: 14 }}>
              {activeTab === 'system' ? t('pages.system.onboardingWizard.systemProgress') : (activeTab === 'implementer' ? t('pages.system.onboardingWizard.implementerProgress') : t('pages.system.onboardingWizard.roleProgress'))}
            </Text>
            <Space size={4}>
              <Button 
                type="text" 
                size="small" 
                icon={wizIcon(RefreshCw, 15)} 
                onClick={() => {
                  if (activeTab === 'system') {
                    loadSystemGuide();
                    setRealCountsRefreshKey((k) => k + 1);
                  } else if (activeTab === 'implementer') {
                    setRealCountsRefreshKey((k) => k + 1);
                  } else {
                    loadRoleGuide(activeTab);
                  }
                }}
                style={{ fontSize: 12, color: token.colorTextSecondary, padding: 0, height: 'auto', lineHeight: 1 }}
              >
                {t('pages.system.onboardingWizard.refresh')}
              </Button>
            </Space>
          </div>
          <Progress 
            type="circle" 
            percent={activeTab === 'system' ? sysProgress : (activeTab === 'implementer' ? impProgress : progress)} 
            size={48} 
            strokeColor={token.colorSuccess}
            format={(percent) => (
              <span style={{ fontSize: 12, fontWeight: 600, color: token.colorSuccess }}>
                {percent}%
              </span>
            )}
          />
        </div>
      </div>

      <Row gutter={16}>
        {/* 左侧角色列表 */}
        <Col xs={24} sm={24} md={6} lg={5} xl={4}>
          <div style={{ 
            background: token.colorBgContainer, 
            borderRadius: token.borderRadiusLG, 
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
            position: 'sticky',
            top: 24
          }}>
            <Menu
              mode="vertical"
              selectedKeys={[activeTab]}
              onClick={({ key }) => handleTabChange(key)}
              style={{ border: 'none' }}
              items={allTabs.map((tab) => ({
                key: tab.code,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: 16 }}>{tab.icon}</span>
                    <span style={{ fontSize: 14 }}>{tab.name}</span>
                  </div>
                ),
              }))}
            />
          </div>
        </Col>

        {/* 右侧引导内容 */}
        <Col xs={24} sm={24} md={18} lg={19} xl={20}>
          <div style={{ minHeight: 600 }}>
            {activeTab === 'system' ? renderSystemTab() : renderRoleTab()}
          </div>
        </Col>
      </Row>

      {/* 详细功能指引 Modal */}
      <Modal
        title={<span>{currentDetailItem?.name} - {t('pages.system.onboardingWizard.modal.detailTitleSuffix')}</span>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            {t('pages.system.onboardingWizard.modal.back')}
          </Button>,
        ]}
        width={960}
        centered
        styles={{
          body: { padding: '0 24px 24px 0' },
        }}
      >
        <div style={{ paddingTop: 16, marginBottom: 16 }}>
          <Text type="secondary">
            {t('pages.system.onboardingWizard.modal.intro', { name: currentDetailItem?.name })}
          </Text>
        </div>
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <Table
            dataSource={currentDetailItem?.subItems || []}
            pagination={false}
            size="middle"
            rowKey="name"
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: t('pages.system.onboardingWizard.modal.columnFeature'),
                dataIndex: 'name',
                key: 'name',
                width: 160,
                fixed: 'left',
                render: (text, record: any) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {((record.check_key ? (realCounts[record.check_key] ?? 0) : (record.id ? (realCounts[record.id] ?? 0) : 0)) > 0 ||
                      (!!record.id && completedItems.has(record.id))) && (
                      <CheckCircle2 size={14} color={token.colorSuccess} style={{ flexShrink: 0 }} />
                    )}
                    <Text strong>{text}</Text>
                  </div>
                ),
              },
              {
                title: t('pages.system.onboardingWizard.modal.columnDesc'),
                dataIndex: 'description',
                key: 'description',
                render: (text) => (
                  <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {text}
                  </Text>
                ),
              },
              {
                title: t('pages.system.onboardingWizard.modal.columnRequired'),
                dataIndex: 'required',
                key: 'required',
                width: 96,
                align: 'center',
                render: (required) =>
                  required ? (
                    <Tag color="error" variant="filled" style={{ fontSize: 11 }}>
                      {t('pages.system.onboardingWizard.modal.required')}
                    </Tag>
                  ) : (
                    <Tag color="default" variant="filled" style={{ fontSize: 11 }}>
                      {t('pages.system.onboardingWizard.modal.optional')}
                    </Tag>
                  ),
              },
              {
                title: t('pages.system.onboardingWizard.modal.columnAction'),
                key: 'action',
                width: 132,
                align: 'center',
                fixed: 'right',
                render: (_, record: { jump_path?: string }) => (
                  <Typography.Link
                    onClick={() => {
                      setDetailModalVisible(false);
                      if (record.jump_path) navigate(record.jump_path);
                    }}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('pages.system.onboardingWizard.goNow')} {wizIcon(ArrowRight, 14)}
                  </Typography.Link>
                ),
              },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

export default OnboardingWizardPage;
