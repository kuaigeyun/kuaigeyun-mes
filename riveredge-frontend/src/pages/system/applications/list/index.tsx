/**
 * 应用中心列表页面
 * 
 * 用于系统管理员查看和管理组织内的应用。
 * 支持应用的 CRUD 操作、安装/卸载、启用/禁用功能。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ProFormInstance, ProFormText, ProFormTextArea, ProFormDigit, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Card, Descriptions, Dropdown, Modal, Popconfirm, Space, Switch, Tag, Typography, Alert, Divider, Menu, Breadcrumb, Tooltip, message, Row, Col, Tree, Select, Table } from 'antd';
import { ThemedSegmented } from '../../../../components/themed-segmented';
const { Title, Paragraph, Text } = Typography;
import { flushDrawerOpen, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, TwoColumnLayout } from '../../../../components/layout-templates';
import { ApplicationClientReleasesPanel } from './ApplicationClientReleasesPanel';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import { UniTable } from '../../../../components/uni-table';
import { UniWiki, WikiItem, WikiTreeData } from '../../../../components';
import { theme } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import { useThemeStore } from '../../../../stores/themeStore';
import {
  EyeOutlined,
  DownloadOutlined,
  StopOutlined,
  DownOutlined,
  SettingOutlined,
  AppstoreOutlined,
  UserOutlined,
  ShopOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  ApiOutlined,
  LockOutlined,
  SyncOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  PrinterOutlined,
  LikeOutlined,
  DislikeOutlined,
  LeftOutlined,
  RightOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { ManufacturingIcons } from '../../../../utils/manufacturingIcons';
import { ManufacturingAppStack, MANUFACTURING_STACK_CODES } from './ManufacturingAppStack';
import './manufacturing-app-stack.less';
import './application-card.less';
import { useGlobalStore } from '../../../../stores';
import {
  getApplicationList,
  getApplicationByUuid,
  getInstalledApplicationList,
  installApplication,
  uninstallApplication,
  enableApplication,
  disableApplication,
  activateProApplication,
  updateApplication,
  syncApplicationManifest,
  scanApplications,
  Application,
} from '../../../../services/application';
import {
  bindDedicatedAppToTenant,
  listDedicatedBindingsForApp,
  searchTenantsForDedicatedBinding,
  unbindDedicatedAppFromTenant,
  type DedicatedBindingRow,
} from '../../../../services/applicationDedicatedBindings';
import { syncAllMenus } from '../../../../services/menu';
import { apiRequest } from '../../../../services/api';
import { rowActionKind, rowActionLabelKeep, rowActionToneDestructive } from '../../../../components/uni-action';
import {
  resolveApplicationDescription,
  resolveApplicationDisplayName,
} from '../../../../utils/menuTranslation';

/** 应用中心行/卡片操作图标（表格与卡片共用，避免 uni-action 按 manifest action 覆盖） */
const APP_ACTION_ICON = {
  view: EyeOutlined,
  settings: SettingOutlined,
  syncMenu: SyncOutlined,
  resetData: ReloadOutlined,
  dedicatedBinding: TeamOutlined,
  install: DownloadOutlined,
  uninstall: StopOutlined,
} as const;

/** 应用中心「其他」分类（占位应用 + 已上线扩展应用） */
const OTHER_PLACEHOLDER_CODES = [
  'kuaicrm',
  'kuaisrm',
  'kuaiasms',
  'kuaitms',
  'kuailtms',
  'kuaiip',
  'kuaiems',
  'kuaiiot',
];
const INDUSTRY_VALUE_PACK_CODES = [
  'kuaimachinery',
  'kuaimolding',
  'kuaielectronics',
  'kuaiautoparts',
  'kuaimedical',
  'kuaifood',
  'kuaipackaging',
  'kuaihardware',
  'kuaidiecasting',
  'kuaiwiring',
  'kuaimotor',
  'kuaibattery',
  'kuainewequipment',
  'kuaisheetmetal',
  'kuaimold',
  'kuaisemiconductor',
];
const APP_SORT_ORDER_OVERRIDES: Record<string, number> = {
  // 通用应用
  kuaiplm: 25,
  kuaicaiwu: 40,
  kuaireport: 46,
  // 其他类：从 100 开始
  kuaicrm: 100,
  kuaisrm: 102,
  kuaiasms: 103,
  kuaitms: 104,
  kuailtms: 105,
  kuaiip: 106,
  kuaiems: 107,
  kuaiiot: 108,
  // 行业增值包：从 200 开始
  kuaimachinery: 200,
  kuaimolding: 201,
  kuaielectronics: 202,
  kuaiautoparts: 203,
  kuaimedical: 204,
  kuaifood: 205,
  kuaipackaging: 206,
  kuaihardware: 207,
  kuaidiecasting: 208,
  kuaiwiring: 209,
  kuaimotor: 210,
  kuaibattery: 211,
  kuainewequipment: 212,
  kuaisheetmetal: 213,
  kuaimold: 214,
  kuaisemiconductor: 215,
};

const APP_DESCRIPTION_OVERRIDES: Record<string, string> = {
  // 快财务当前聚焦管理会计，不包含总账
  kuaicaiwu: '聚焦管理会计与经营分析协同平台（不含总账）',
};

type AppCategoryFilter = 'all' | 'general' | 'industry' | 'basic' | 'pro' | 'other' | 'dedicated';

const PRO_KNOWN_CODES = [
  'kuaiiot',
  'kuaiai',
  'bi',
  'kuaicrm',
  'kuaisrm',
  ...INDUSTRY_VALUE_PACK_CODES,
  ...OTHER_PLACEHOLDER_CODES,
];

/** 应用中心需一次性拉齐清单再前端分类，否则 sort_order 靠后的应用（如定制应用）会落在分页之外 */
const APPLICATION_CENTER_LIST_LIMIT = 500;

const matchAppCategory = (app: any, filter: AppCategoryFilter): boolean => {
  const code = String(app?.code || '');
  const isDedicated = Boolean(app?.is_dedicated ?? app?.isDedicated);
  const isIndustry = INDUSTRY_VALUE_PACK_CODES.includes(code);
  const isOther = OTHER_PLACEHOLDER_CODES.includes(code);
  const isPro = Boolean(app?.is_pro) || PRO_KNOWN_CODES.includes(code);
  // “基础版”定义：不属于 PRO 的应用（并排除行业包/其他类）
  const isBasic = !isPro && !isIndustry && !isOther;
  const isGeneral = !isIndustry && !isOther;

  switch (filter) {
    case 'all':
      return true;
    case 'dedicated':
      return isDedicated;
    case 'general':
      return isGeneral && !isDedicated;
    case 'industry':
      return isIndustry && !isDedicated;
    case 'basic':
      return isBasic && !isDedicated;
    case 'pro':
      return isPro && !isDedicated;
    case 'other':
      return isOther && !isDedicated;
    default:
      return true;
  }
};

const isDedicatedApplication = (app: Application | Record<string, unknown>): boolean =>
  Boolean((app as Application).is_dedicated ?? (app as any).isDedicated);

/** 卡片内图标尺寸（缩小以显得更紧凑） */
const CARD_ICON_SIZE = 40;
/** 卡片封面区高度（含标题、类型徽章与描述） */
const CARD_COVER_HEIGHT = 136;
/** 封面区上下内边距（无角标时） */
const CARD_COVER_PADDING_Y = 16;
/** 角标（免费/专业版）占位，避免与「已安装」重叠，同时作为有角标时的上下内边距 */
const CARD_TIER_BADGE_CLEARANCE = 22;
/** 卡片第二、三行共用垂直内边距，保持行高一致 */
const CARD_ROW_PADDING_Y = 12;
const CARD_ROW_PADDING_X = 16;

/**
 * 根据应用代码和图标配置获取图标组件
 *
 * @param code - 应用代码
 * @param icon - 图标配置（可以是图片路径或 lucide 图标名称）
 * @param size - 图标尺寸（默认 72，卡片内使用 CARD_ICON_SIZE）
 */
const getApplicationIcon = (code: string, icon?: string | null, size: number = 72) => {
  if (icon && (icon.startsWith('/') || icon.startsWith('http'))) {
    return <img src={icon} alt={code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (icon && ManufacturingIcons[icon as keyof typeof ManufacturingIcons]) {
    const IconComponent = ManufacturingIcons[icon as keyof typeof ManufacturingIcons];
    return React.createElement(IconComponent, { size });
  }
  const iconMap: Record<string, React.ReactNode> = {
    kuaimes: React.createElement(ManufacturingIcons.workflow, { size }),
    kuaizhizao: React.createElement(ManufacturingIcons.factory, { size }),
    kuaierp: React.createElement(ManufacturingIcons.shoppingCart, { size }),
    kuaicaiwu: React.createElement(ManufacturingIcons.calculator, { size }),
    kuaireport: React.createElement(ManufacturingIcons.fileBarChart, { size }),
    'master-data': React.createElement(ManufacturingIcons.database, { size }),
    kuaiai: React.createElement(ManufacturingIcons.sparkles, { size }),
    kuaiiot: React.createElement(ManufacturingIcons['cloud-server'], { size }),
    kuaicrm: React.createElement(ManufacturingIcons.handshake, { size }),
    kuaiplm: React.createElement(ManufacturingIcons.layers, { size }),
    kuaisrm: React.createElement(ManufacturingIcons.gitBranch, { size }),
    kuaitms: React.createElement(ManufacturingIcons.car, { size }),
    kuaiasms: React.createElement(ManufacturingIcons.headphones, { size }),
    kuailtms: React.createElement(ManufacturingIcons.experiment, { size }),
    kuaiip: React.createElement(ManufacturingIcons['shield-check'], { size }),
    kuaiems: React.createElement(ManufacturingIcons.thunderbolt, { size }),
    kuaimachinery: React.createElement(ManufacturingIcons.tool, { size }),
    kuaimolding: React.createElement(ManufacturingIcons.process, { size }),
    kuaielectronics: React.createElement(ManufacturingIcons.electronics, { size }),
    kuaiautoparts: React.createElement(ManufacturingIcons.car, { size }),
    kuaimedical: React.createElement(ManufacturingIcons.shield, { size }),
    kuaifood: React.createElement(ManufacturingIcons.shoppingBag, { size }),
    kuaipackaging: React.createElement(ManufacturingIcons.boxes, { size }),
    kuaihardware: React.createElement(ManufacturingIcons.hammer, { size }),
    kuaidiecasting: React.createElement(ManufacturingIcons.factoryBuilding, { size }),
    kuaiwiring: React.createElement(ManufacturingIcons.network, { size }),
    kuaimotor: React.createElement(ManufacturingIcons.machine, { size }),
    kuaibattery: React.createElement(ManufacturingIcons.power, { size }),
    kuainewequipment: React.createElement(ManufacturingIcons.automation, { size }),
    kuaisheetmetal: React.createElement(ManufacturingIcons.mdConstruction, { size }),
    kuaimold: React.createElement(ManufacturingIcons.mdPrecision, { size }),
    kuaisemiconductor: React.createElement(ManufacturingIcons.microchip, { size }),
    crm: React.createElement(ManufacturingIcons.handshake, { size }),
    erp: React.createElement(ManufacturingIcons.shoppingCart, { size }),
    mes: React.createElement(ManufacturingIcons.factory, { size }),
    wms: React.createElement(ManufacturingIcons.warehouse, { size }),
    oa: React.createElement(ManufacturingIcons.fileText, { size }),
    scm: React.createElement(ManufacturingIcons.apartment, { size }),
    bi: React.createElement(ManufacturingIcons.chartBar, { size }),
    hr: React.createElement(ManufacturingIcons.users, { size }),
    haoligo: React.createElement(ManufacturingIcons.smartphone, { size }),
  };
  return iconMap[code] || React.createElement(ManufacturingIcons.appstore, { size });
};

/**
 * 深色模式卡片头：用主色少量混入填充层，保留应用辨识度且贴近 antd 暗色表面。
 * 浅色模式仍使用下方 `gradients` 高明度渐变。
 */
const CARD_HEADER_TINT: Record<string, string> = {
  kuaizhizao: '#38bdf8',
  kuaicaiwu: '#fbbf24',
  kuaireport: '#4ade80',
  'master-data': '#a78bfa',
  kuaiai: '#fb7185',
  kuaiiot: '#2dd4bf',
  kuaierp: '#fb923c',
  kuaimes: '#38bdf8',
  bi: '#4ade80',
  kuaicrm: '#fb923c',
  kuaiplm: '#a78bfa',
  kuaisrm: '#2dd4bf',
  kuaitms: '#60a5fa',
  kuaiasms: '#fb923c',
  kuailtms: '#a78bfa',
  kuaiip: '#94a3b8',
  kuaiems: '#22d3ee',
  kuaimachinery: '#60a5fa',
  kuaimolding: '#a78bfa',
  kuaielectronics: '#22d3ee',
  kuaiautoparts: '#fb923c',
  kuaimedical: '#4ade80',
  kuaifood: '#fbbf24',
  kuaipackaging: '#94a3b8',
  kuaihardware: '#60a5fa',
  kuaidiecasting: '#94a3b8',
  kuaiwiring: '#22d3ee',
  kuaimotor: '#fb923c',
  kuaibattery: '#4ade80',
  kuainewequipment: '#a78bfa',
  kuaisheetmetal: '#94a3b8',
  kuaimold: '#2dd4bf',
  kuaisemiconductor: '#818cf8',
};

const getCardGradient = (code: string, isActive: boolean, token: GlobalToken, isDark: boolean): string => {
  if (!isActive) {
    if (isDark) {
      return `linear-gradient(135deg, ${token.colorFillSecondary} 0%, ${token.colorFill} 100%)`;
    }
    return 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
  }
  if (isDark) {
    const tint = CARD_HEADER_TINT[code];
    if (tint) {
      return `linear-gradient(135deg, color-mix(in srgb, ${tint} 28%, ${token.colorFillSecondary}) 0%, color-mix(in srgb, ${tint} 12%, ${token.colorFill}) 100%)`;
    }
    return `linear-gradient(135deg, ${token.colorFillTertiary} 0%, ${token.colorFill} 100%)`;
  }
  const gradients: Record<string, string> = {
    // 采用更明快、高明度的渐变色，提升活力感
    kuaizhizao: 'linear-gradient(135deg, #f0f9ff 0%, #bae6fd 100%)',  // 天蓝色
    kuaicaiwu: 'linear-gradient(135deg, #fffbeb 0%, #fde68a 100%)',   // 琥珀金
    kuaireport: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',  // 翡翠绿
    'master-data': 'linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)', // 丁香紫
    kuaiai: 'linear-gradient(135deg, #fff1f2 0%, #fecdd3 100%)',      // 玫瑰粉
    kuaiiot: 'linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)',     // 青绿色
    kuaierp: 'linear-gradient(135deg, #fffbeb 0%, #fed7aa 100%)',     // 温暖橙黄（进销存）
    kuaimes: 'linear-gradient(135deg, #f0f9ff 0%, #bae6fd 100%)',     // 天蓝色
    bi: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',          // 翡翠绿
    kuaicrm: 'linear-gradient(135deg, #fff7ed 0%, #fdba74 100%)',     // 橙色
    kuaiplm: 'linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)',     // 丁香紫
    kuaisrm: 'linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)',     // 青绿色
    kuaitms: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)',     // 物流蓝
    kuaiasms: 'linear-gradient(135deg, #fff7ed 0%, #fdba74 100%)',    // 服务橙
    kuailtms: 'linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)',    // 实验紫
    kuaiip: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',      // 知产灰
    kuaiems: 'linear-gradient(135deg, #ecfeff 0%, #a5f3fc 100%)',     // 能源青
    kuaimachinery: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)', // 机械蓝
    kuaimolding: 'linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)',    // 注塑紫
    kuaielectronics: 'linear-gradient(135deg, #ecfeff 0%, #a5f3fc 100%)', // 电子青
    kuaiautoparts: 'linear-gradient(135deg, #fff7ed 0%, #fdba74 100%)',   // 汽配橙
    kuaimedical: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',     // 医疗绿
    kuaifood: 'linear-gradient(135deg, #fffbeb 0%, #fde68a 100%)',        // 食品金
    kuaipackaging: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',   // 包装灰
    kuaihardware: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)',    // 五金蓝
    kuaidiecasting: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)',  // 压铸钢灰
    kuaiwiring: 'linear-gradient(135deg, #ecfeff 0%, #a5f3fc 100%)',      // 线束青
    kuaimotor: 'linear-gradient(135deg, #fff7ed 0%, #fdba74 100%)',       // 电机橙
    kuaibattery: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',     // 电池绿
    kuainewequipment: 'linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)', // 新能源设备紫
    kuaisheetmetal: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',  // 钣金灰
    kuaimold: 'linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)',        // 模具青
    kuaisemiconductor: 'linear-gradient(135deg, #eff6ff 0%, #c7d2fe 100%)', // 半导体蓝紫
  };
  return gradients[code] || 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
};

/**
 * 帮助视图内容组件 (Wiki 左右分栏样式)
 */
const ApplicationHelpView: React.FC = () => {
  const { t } = useTranslation();
  const wikiItems: WikiItem[] = [
    {
      key: '1',
      label: '1. 概述',
      breadcrumbs: ['帮助目录', '概述'],
      content: (
        <>
          <Title level={2}>1. 概述</Title>
          <Paragraph>
            <Text strong>应用中心</Text>是系统管理员集中管理组织内所有系统模块和业务插件的核心控制台。通过应用中心，管理员可以轻松完成应用的发现、安装、卸载、授权、启停控制以及菜单清单的同步，实现企业数字化底座的灵活扩展与生命周期管理。
          </Paragraph>
          <Alert title="仅具有系统管理员权限的用户可访问和操作应用中心。" type="info" showIcon />
        </>
      )
    },
    {
      key: '2',
      label: '2. 核心概念',
      breadcrumbs: ['帮助目录', '核心概念'],
      content: (
        <>
          <Title level={2}>2. 核心概念</Title>
          <Paragraph>在开始操作之前，了解以下核心概念有助于您更好地使用应用中心：</Paragraph>
          <ul>
            <li style={{ marginBottom: 12 }}><Text strong>系统应用 (System App)</Text>：系统内置的基础支撑应用（如主数据 Master-Data 等），这类应用为系统正常运行提供核心服务，<Text type="danger">不可被卸载</Text>。</li>
            <li style={{ marginBottom: 12 }}><Text strong>专业版应用 (Pro App)</Text>：包含高级功能的应用（如快报表、快数采、BI 等）。此类应用在首次启用前，需要输入有效的 <Text mark>License Key</Text> 进行授权激活。</li>
            <li><Text strong>应用清单 (Manifest)</Text>：描述应用基础信息、路由和菜单结构的配置文件。系统通过解析应用清单来生成您看到的左侧导航菜单。</li>
          </ul>
        </>
      )
    },
    {
      key: '3.1',
      label: '3.1 安装与卸载',
      breadcrumbs: ['帮助目录', '操作指南', '安装与卸载'],
      content: (
        <>
          <Title level={2}>3.1 应用的安装与卸载</Title>
          <ul>
            <li style={{ marginBottom: 12 }}><Text strong>安装应用</Text>：在应用列表中找到处于“未安装”状态的应用，点击卡片上的 <b>[安装]</b> 按钮（或下载图标）。安装成功后，应用将注册到您的系统中。</li>
            <li><Text strong>卸载应用</Text>：对于不再需要的已安装应用，点击卡片上的 <b>[更多操作]</b> -{'>'} <b>[卸载]</b>。</li>
          </ul>
          <Alert title="注意：卸载应用可能会导致关联的业务数据不可见。此外，“系统应用”的卸载按钮为禁用状态，无法卸载。" type="warning" showIcon style={{ marginTop: 24 }} />
        </>
      )
    },
    {
      key: '3.2',
      label: '3.2 启用与授权',
      breadcrumbs: ['帮助目录', '操作指南', '启用与授权'],
      content: (
        <>
          <Title level={2}>3.2 应用的启用与授权</Title>
          <ul>
            <li style={{ marginBottom: 12 }}><Text strong>启用 / 禁用</Text>：在应用卡片底部或表格行内切换 <b>[状态]</b> 开关。禁用的应用将不会在左侧菜单栏向普通用户展示。</li>
            <li><Text strong>激活专业版应用</Text>：在尝试启用专业版应用（如 快数采 kuaiiot、KU-AI kuaiai）时，系统会自动弹出授权验证窗口。您需要输入正确的授权码（License Key），校验通过后应用才会成功启用。</li>
          </ul>
        </>
      )
    },
    {
      key: '3.3',
      label: '3.3 扫描本地应用',
      breadcrumbs: ['帮助目录', '操作指南', '扫描本地应用'],
      content: (
        <>
          <Title level={2}>3.3 扫描本地应用</Title>
          <Paragraph>当开发人员在本地新增了应用代码（放置于 <code>src/apps</code> 目录下）时，需要将其注册到系统中：</Paragraph>
          <ol>
            <li style={{ marginBottom: 8 }}>点击页面顶部的 <b>[扫描应用]</b> 按钮。</li>
            <li>系统会自动扫描发现新应用并将其基础信息注册到应用中心。</li>
          </ol>
          <Alert title="“扫描应用”仅更新了应用的基础清单数据库。扫描完成后，请务必执行 [一键同步菜单] 操作，否则左侧导航菜单不会更新。" type="info" showIcon style={{ marginTop: 24 }} />
        </>
      )
    },
    {
      key: '3.4',
      label: '3.4 菜单同步管理',
      breadcrumbs: ['帮助目录', '操作指南', '菜单同步管理'],
      content: (
        <>
          <Title level={2}>3.4 菜单同步管理</Title>
          <ul>
            <li style={{ marginBottom: 12 }}><Text strong>一键同步菜单</Text>：当进行了本地应用扫描或后端代码有菜单更新时，点击顶部的 <b>[一键同步菜单]</b>。系统会执行两步操作：① 批量拉取所有已安装应用的最新清单；② 将这些清单中的菜单全量写入核心数据库，并自动刷新您的侧边栏。</li>
            <li><Text strong>单应用同步</Text>：如果您确认只有某个特定应用发生了菜单变更，可以点击该应用卡片上的 <b>[更多操作]</b> -{'>'} <b>[同步菜单]</b> 进行定向同步。</li>
          </ul>
        </>
      )
    },
    {
      key: '3.5',
      label: '3.5 高级配置与管理',
      breadcrumbs: ['帮助目录', '操作指南', '高级配置与管理'],
      content: (
        <>
          <Title level={2}>3.5 应用高级配置与管理</Title>
          <ul>
            <li style={{ marginBottom: 12 }}><Text strong>查看详情</Text>：点击应用卡片上的 <b>[查看]</b> 按钮，系统会从右侧弹出抽屉，展示应用的描述、版本号等详细信息。</li>
            <li style={{ marginBottom: 12 }}><Text strong>应用配置</Text>：点击 <b>[更多操作]</b> -{'>'} <b>[应用配置]</b>，可修改该应用在系统中的显示名称、显示排序等基本参数。</li>
            <li><Text strong>重置数据</Text>：针对特定应用（如快制造 kuaizhizao），在 <b>[更多操作]</b> 中提供了 <b>[重置数据]</b> 功能。</li>
          </ul>
          <Alert title={t('pages.system.applications.resetHighRiskWarning', { defaultValue: '高危操作警告：“重置数据”将清空或初始化该应用的核心业务数据，请在执行前务必确认或联系技术支持。' })} type="error" showIcon style={{ marginTop: 24 }} />
        </>
      )
    },
    {
      key: '4',
      label: '4. 常见问题 (FAQ)',
      breadcrumbs: ['帮助目录', '常见问题 (FAQ)'],
      content: (
        <>
          <Title level={2}>4. 常见问题 (FAQ)</Title>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Card size="small" title="Q: 为什么“卸载”按钮是禁用的？">
              <Text>A: 该应用带有 <code>System</code> 标签，代表它是系统级应用，为保障系统核心运行稳定，系统底层安全机制禁止对其执行卸载操作。</Text>
            </Card>
            <Card size="small" title="Q: 我刚点击了“扫描应用”并提示成功，为什么左侧菜单栏还是没有出现新应用的入口？">
              <Text>A: “扫描应用”仅将应用的配置注册到系统。请您接着点击顶部的 <b>[一键同步菜单]</b>，系统才会将菜单结构完整写入数据库并触发界面的刷新。</Text>
            </Card>
            <Card size="small" title="Q: 启用快数采（kuaiiot）时为什么提示需要授权？">
              <Text>A: 快数采等属于 Pro 级别的专业应用，需要向供应商获取有效的 License Key，校验并激活通过后方可开放使用。</Text>
            </Card>
          </Space>
        </>
      )
    },
  ];

  const treeData: WikiTreeData[] = [
    { key: '1', title: '1. 概述' },
    { key: '2', title: '2. 核心概念' },
    {
      key: '3',
      title: '3. 操作指南',
      children: [
        { key: '3.1', title: '3.1 安装与卸载' },
        { key: '3.2', title: '3.2 启用与授权' },
        { key: '3.3', title: '3.3 扫描本地应用' },
        { key: '3.4', title: '3.4 菜单同步管理' },
        { key: '3.5', title: '3.5 高级配置与管理' },
      ],
    },
    { key: '4', title: '4. 常见问题 (FAQ)' },
  ];

  return <UniWiki items={wikiItems} treeData={treeData} defaultExpandedKeys={['3']} />;
};

/**
 * 应用中心列表页面组件
 */
const ApplicationListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const queryClient = useQueryClient();
  /** 后端写入菜单或清单后失效侧边栏与工作台菜单缓存（与 increment + invalidate 双通道，避免漏刷新） */
  const refreshApplicationMenusAfterBackendMenuChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['navigationMenuTree'] });
    queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] });
    useGlobalStore.getState().incrementApplicationMenuVersion();
  }, [queryClient]);
  /** 与「一键同步菜单」第二步一致：按库内清单把菜单写入 core_menus，再刷新前端缓存（避免仅更新了 core_applications 但菜单表滞后） */
  const finalizeManifestSyncForSidebar = useCallback(async () => {
    try {
      await syncAllMenus();
    } catch {
      /* 仍刷新侧边栏：清单接口往往已写入菜单；全量入库失败时不阻断 UI */
    }
    refreshApplicationMenusAfterBackendMenuChange();
  }, [refreshApplicationMenusAfterBackendMenuChange]);
  const actionRef = useRef<ActionType>(null);
  const editFormRef = useRef<ProFormInstance>(null);
  const proKeyFormRef = useRef<ProFormInstance>(null);
  const applicationDetailReqRef = useRef(0);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // 编辑状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [proKeyModalVisible, setProKeyModalVisible] = useState(false);
  const [proKeySubmitting, setProKeySubmitting] = useState(false);
  const [proKeyTargetApp, setProKeyTargetApp] = useState<Application | null>(null);
  const [pendingEnableAfterActivation, setPendingEnableAfterActivation] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTargetApp, setResetTargetApp] = useState<Application | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetStage, setResetStage] = useState(1); // 1, 2, 3
  const resetConfirmPhrase = t('pages.system.applications.resetConfirmPhrase');
  const [dedicatedBindingModalOpen, setDedicatedBindingModalOpen] = useState(false);
  const [dedicatedBindingApp, setDedicatedBindingApp] = useState<Application | null>(null);
  const [dedicatedBindingRows, setDedicatedBindingRows] = useState<DedicatedBindingRow[]>([]);
  const [dedicatedBindingLoading, setDedicatedBindingLoading] = useState(false);
  const [tenantBindSearchLoading, setTenantBindSearchLoading] = useState(false);
  const [tenantBindOptions, setTenantBindOptions] = useState<{ value: number; label: string }[]>([]);
  const [tenantBindSelectValue, setTenantBindSelectValue] = useState<number | undefined>();
  const tenantBindSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (tenantBindSearchTimerRef.current) clearTimeout(tenantBindSearchTimerRef.current);
  }, []);
  const [appCategoryFilter, setAppCategoryFilter] = useState<AppCategoryFilter>('general');
  /** 平台管理员默认看「全部」，否则「通用」分类会隐藏定制应用 */
  const infraCategoryDefaultAppliedRef = useRef(false);
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canManageAppLifecycle = Boolean(currentUser?.is_infra_admin);

  /** static 目录通过 Vite publicDir 挂载到站点根路径，见 vite.config `publicDir` */
  const customAppsContactQrSrc = `${import.meta.env.BASE_URL}img/qr_code.png`;

  /** 「定制应用」分类无数据时的占位（引导定制服务与商务联系） */
  const renderCustomAppsCategoryEmpty = () => (
    <div
      style={{
        marginTop: 48,
        padding: '0 24px 48px',
        textAlign: 'center',
        maxWidth: 560,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
            {t('pages.system.applications.customAppsEmptyTitle')}
          </Text>
          <Paragraph type="secondary" style={{ marginBottom: 0, lineHeight: 1.7 }}>
            {t('pages.system.applications.customAppsEmptyDescription')}
          </Paragraph>
        </div>
        <div>
          <img
            src={customAppsContactQrSrc}
            alt={t('pages.system.applications.customAppsEmptyQrAlt')}
            width={200}
            height={200}
            style={{
              width: 200,
              height: 'auto',
              maxWidth: 'min(240px, 85vw)',
              borderRadius: themeToken.borderRadiusLG,
              border: `1px solid ${themeToken.colorBorderSecondary}`,
              boxShadow: themeToken.boxShadowTertiary,
              display: 'block',
              margin: '0 auto',
              objectFit: 'contain',
            }}
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
            {t('pages.system.applications.customAppsEmptyQrHint')}
          </Text>
        </div>
      </Space>
    </div>
  );

  useEffect(() => {
    if (infraCategoryDefaultAppliedRef.current || !currentUser?.is_infra_admin) return;
    infraCategoryDefaultAppliedRef.current = true;
    setAppCategoryFilter('all');
  }, [currentUser?.is_infra_admin]);

  // 分类切换后再触发刷新，避免与 setState 同帧导致 request 读取旧值
  useEffect(() => {
    actionRef.current?.reload();
  }, [appCategoryFilter]);


  /**
   * 处理扫描应用（从 src/apps 发现并注册）
   */
  const handleScanApplications = async () => {
    try {
      setScanning(true);
      const apps = await scanApplications();
      messageApi.success(t('pages.system.applications.scanSuccess', { count: apps?.length ?? 0, defaultValue: `已扫描并注册 ${apps?.length ?? 0} 个应用` }));
      messageApi.info({
        content: t('pages.system.applications.scanMenuHint', {
          defaultValue: '扫描只更新应用清单。若菜单或权限未刷新，请点击「一键同步菜单」。',
        }),
        duration: 6,
      });
      actionRef.current?.reload();
      refreshApplicationMenusAfterBackendMenuChange();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.scanFailed', { defaultValue: '扫描应用失败' }));
    } finally {
      setScanning(false);
    }
  };

  /**
   * 一键同步所有已安装应用的菜单
   */
  const handleSyncAllMenus = async () => {
    try {
      setSyncAllLoading(true);
      const apps = await getInstalledApplicationList({ is_active: true });
      const codes = apps.map((a) => a.code).filter(Boolean);
      if (codes.length === 0) {
        messageApi.info(t('pages.system.applications.syncAllNoApps', { defaultValue: '暂无已安装的应用' }));
        return;
      }
      messageApi.loading({
        content: t('pages.system.applications.syncAllLoading', {
          defaultValue: '正在同步菜单，请稍候…',
        }),
        key: 'sync-all',
      });
      let successCount = 0;
      const errors: string[] = [];
      const unknown = () => t('pages.system.applications.syncAllErrUnknown', { defaultValue: '未知错误' });
      for (const code of codes) {
        try {
          const result = await syncApplicationManifest(code);
          if (result.success) successCount += 1;
          else {
            errors.push(
              t('pages.system.applications.syncAllErrManifest', {
                code,
                detail: (result.message || '').trim() || unknown(),
              })
            );
          }
        } catch (e: any) {
          errors.push(
            t('pages.system.applications.syncAllErrManifest', {
              code,
              detail: (e?.message || String(e)).trim() || unknown(),
            })
          );
        }
      }
      // 再执行一次「同步全部菜单」，确保菜单与数据库完全一致（解决 manifest 更新后菜单未显示的问题）
      try {
        await syncAllMenus();
      } catch (e: any) {
        errors.push(
          t('pages.system.applications.syncAllErrMenusDb', {
            detail: (e?.message || String(e)).trim() || unknown(),
          })
        );
      }
      if (errors.length > 0) {
        messageApi.warning({
          content: (
            <span style={{ whiteSpace: 'pre-line' }}>
              {t('pages.system.applications.syncAllPartial', {
                success: successCount,
                total: codes.length,
                errors: errors.slice(0, 3).join('\n'),
              })}
            </span>
          ),
          key: 'sync-all',
          duration: 10,
        });
      } else {
        messageApi.success({
          content: t('pages.system.applications.syncAllSuccess', {
            count: successCount,
            defaultValue: `已完成 ${successCount} 个应用的菜单同步，导航菜单已更新。`,
          }),
          key: 'sync-all',
        });
      }
      actionRef.current?.reload();
      refreshApplicationMenusAfterBackendMenuChange();
    } catch (error: any) {
      messageApi.error({
        content: error?.message || t('pages.system.applications.syncAllFailed', { defaultValue: '菜单同步失败' }),
        key: 'sync-all',
      });
    } finally {
      setSyncAllLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Application) => {
    const req = ++applicationDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getApplicationByUuid(record.uuid);
      if (applicationDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (applicationDetailReqRef.current === req) {
        messageApi.error(error.message || t('pages.system.applications.getDetailFailed'));
      }
    } finally {
      if (applicationDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };


  /**
   * 处理安装应用
   */
  const handleInstall = async (record: Application) => {
    if (!canManageAppLifecycle) {
      messageApi.warning(t('pages.system.applications.platformAdminOnlyLifecycle'));
      return;
    }
    try {
      await installApplication(record.uuid);
      messageApi.success(t('pages.system.applications.installSuccess'));
      actionRef.current?.reload();
      refreshApplicationMenusAfterBackendMenuChange();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.installFailed'));
    }
  };

  /**
   * 处理卸载应用
   */
  const handleUninstall = async (record: Application) => {
    if (!canManageAppLifecycle) {
      messageApi.warning(t('pages.system.applications.platformAdminOnlyLifecycle'));
      return;
    }
    try {
      await uninstallApplication(record.uuid);
      messageApi.success(t('pages.system.applications.uninstallSuccess'));
      actionRef.current?.reload();
      refreshApplicationMenusAfterBackendMenuChange();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.uninstallFailed'));
    }
  };

  /**
   * 互斥应用组配置
   * kuaizhizao（快制造）与 [kuaierp（进销存）, kuaimes（快车间）] 互斥
   */
  const MUTEX_GROUPS = [
    { group: 'erp-split', members: ['kuaierp', 'kuaimes'] },
    { group: 'all-in-one', members: ['kuaizhizao'] },
  ];

  /** 获取与指定应用互斥的对端应用 code 列表 */
  const getMutuallyExclusiveCodes = (code: string): string[] => {
    if (['kuaierp', 'kuaimes'].includes(code)) return ['kuaizhizao'];
    if (code === 'kuaizhizao') return ['kuaierp', 'kuaimes'];
    return [];
  };

  /**
   * 处理启用/禁用应用
   */
  const handleToggleActive = async (record: Application, checked: boolean) => {
    if (!canManageAppLifecycle) {
      messageApi.warning(t('pages.system.applications.platformAdminOnlyLifecycle'));
      return;
    }
    try {
      if (checked) {
        const isProApp = record.is_pro || record.code === 'bi' || record.code === 'kuaiiot';
        if (isProApp && !record.can_access) {
          setProKeyTargetApp(record);
          setPendingEnableAfterActivation(true);
          setProKeyModalVisible(true);
          setTimeout(() => {
            proKeyFormRef.current?.setFieldsValue({ license_key: '' });
          }, 0);
          return;
        }

        // 检查互斥应用是否有已启用的
        const exclusiveCodes = getMutuallyExclusiveCodes(record.code);
        if (exclusiveCodes.length > 0) {
          // 获取当前列表来判断对端是否已启用
          const allApps = await getApplicationList({ skip: 0, limit: 200 });
          const activeExclusives = (allApps || []).filter(
            (a) => exclusiveCodes.includes(a.code) && a.is_active && a.is_installed
          );
          if (activeExclusives.length > 0) {
            const exclusiveNames = activeExclusives.map((a) => a.name).join('、');
            const targetGroupLabel = ['kuaierp', 'kuaimes'].includes(record.code)
              ? t('pages.system.applications.modeErpMes')
              : t('pages.system.applications.modeKuaizhizao');
            const mutualGroupLabel = record.code === 'kuaizhizao'
              ? t('pages.system.applications.modeErpMesName')
              : t('pages.system.applications.modeKuaizhizaoName');
            await new Promise<void>((resolve, reject) => {
              modalApi.confirm({
                title: t('pages.system.applications.mutualExclusiveSwitchTitle'),
                content: (
                  <div>
                    <p>{t('pages.system.applications.mutualExclusiveSwitchingTo', { target: targetGroupLabel })}</p>
                    <p>
                      {t('pages.system.applications.mutualExclusiveCurrentlyEnabled')}{' '}
                      <strong>{exclusiveNames}</strong>（{mutualGroupLabel}）
                      {t('pages.system.applications.mutualExclusiveWillAutoDisable')}
                    </p>
                    <p style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>
                      {t('pages.system.applications.mutualExclusiveDataShared')}
                    </p>
                  </div>
                ),
                okText: t('pages.system.applications.mutualExclusiveConfirm'),
                cancelText: t('common.cancel'),
                onOk: () => resolve(),
                onCancel: () => reject(new Error('user_cancel')),
              });
            });
            // 先禁用对端
            for (const app of activeExclusives) {
              await disableApplication(app.uuid);
            }
          }
        }

        await enableApplication(record.uuid);
        messageApi.success(t('pages.system.applications.enableSuccess'));
      } else {
        await disableApplication(record.uuid);
        messageApi.success(t('pages.system.applications.disableSuccess'));
      }
      actionRef.current?.reload();
      refreshApplicationMenusAfterBackendMenuChange();
    } catch (error: any) {
      if (error?.message === 'user_cancel') return;
      messageApi.error(error.message || t('pages.system.applications.operationFailed'));
    }
  };

  const handleActivateProKey = async (values: { license_key: string }) => {
    if (!proKeyTargetApp) return;
    if (!canManageAppLifecycle) {
      messageApi.warning(t('pages.system.applications.platformAdminOnlyLifecycle'));
      return;
    }
    try {
      setProKeySubmitting(true);
      await activateProApplication(proKeyTargetApp.uuid, values.license_key);
      if (pendingEnableAfterActivation) {
        await enableApplication(proKeyTargetApp.uuid);
      }
      messageApi.success(
        pendingEnableAfterActivation
          ? t('pages.system.applications.proActivateAndEnableSuccess', { defaultValue: 'License Key 校验通过，应用已启用' })
          : t('pages.system.applications.proActivateSuccess', { defaultValue: 'License Key 校验通过，已完成授权' })
      );
      setProKeyModalVisible(false);
      setPendingEnableAfterActivation(false);
      actionRef.current?.reload();
      refreshApplicationMenusAfterBackendMenuChange();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.proActivateFailed', { defaultValue: 'License Key 校验失败' }));
    } finally {
      setProKeySubmitting(false);
    }
  };

  /**
   * 处理更新应用配置（名称、排序等）
   */
  const handleUpdateAppConfig = async (record: Application, updateData: Partial<Application>) => {
    try {
      setSubmitting(true);
      await updateApplication(record.uuid, updateData);
      messageApi.success(t('pages.system.applications.configUpdateSuccess'));
      setEditModalVisible(false);
      actionRef.current?.reload();
      refreshApplicationMenusAfterBackendMenuChange();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.applications.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const openDedicatedBindingModal = useCallback((app: Application) => {
    setDedicatedBindingApp(app);
    setTenantBindSelectValue(undefined);
    setTenantBindOptions([]);
    setDedicatedBindingModalOpen(true);
  }, []);

  const loadDedicatedBindings = useCallback(async () => {
    const code = dedicatedBindingApp?.code;
    if (!code) return;
    setDedicatedBindingLoading(true);
    try {
      const rows = await listDedicatedBindingsForApp(code);
      setDedicatedBindingRows(rows);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.dedicatedBindingLoadFailed'));
    } finally {
      setDedicatedBindingLoading(false);
    }
  }, [dedicatedBindingApp?.code, messageApi, t]);

  useEffect(() => {
    if (dedicatedBindingModalOpen && dedicatedBindingApp?.code) {
      void loadDedicatedBindings();
    }
  }, [dedicatedBindingModalOpen, dedicatedBindingApp?.code, loadDedicatedBindings]);

  const handleTenantBindSearch = useCallback((q: string) => {
    if (tenantBindSearchTimerRef.current) clearTimeout(tenantBindSearchTimerRef.current);
    tenantBindSearchTimerRef.current = setTimeout(async () => {
      setTenantBindSearchLoading(true);
      try {
        const res = await searchTenantsForDedicatedBinding({
          name: q.trim() || undefined,
          page: 1,
          page_size: 50,
        });
        setTenantBindOptions(
          res.items.map((it) => ({ value: it.id, label: `${it.name} (#${it.id})` })),
        );
      } catch {
        setTenantBindOptions([]);
      } finally {
        setTenantBindSearchLoading(false);
      }
    }, 350);
  }, []);

  const handleBindDedicatedTenant = async () => {
    if (!dedicatedBindingApp?.code || tenantBindSelectValue == null) {
      messageApi.warning(t('pages.system.applications.dedicatedBindingPickTenant'));
      return;
    }
    try {
      await bindDedicatedAppToTenant(dedicatedBindingApp.code, tenantBindSelectValue);
      messageApi.success(t('pages.system.applications.dedicatedBindingBindSuccess'));
      await loadDedicatedBindings();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.dedicatedBindingBindFailed'));
    }
  };

  const handleBindCurrentTenant = async () => {
    const tid = currentUser?.tenant_id;
    if (!dedicatedBindingApp?.code || tid == null) {
      messageApi.warning(t('pages.system.applications.dedicatedBindingNoCurrentTenant'));
      return;
    }
    try {
      await bindDedicatedAppToTenant(dedicatedBindingApp.code, tid);
      messageApi.success(t('pages.system.applications.dedicatedBindingBindSuccess'));
      await loadDedicatedBindings();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.dedicatedBindingBindFailed'));
    }
  };

  const handleUnbindDedicatedTenant = async (tenantId: number) => {
    if (!dedicatedBindingApp?.code) return;
    try {
      await unbindDedicatedAppFromTenant(dedicatedBindingApp.code, tenantId);
      messageApi.success(t('pages.system.applications.dedicatedBindingUnbindSuccess'));
      await loadDedicatedBindings();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.applications.dedicatedBindingUnbindFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Application>[] = [
    {
      title: t('pages.system.applications.name'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      render: (_val: any, record: Application) => (
        <span>{resolveApplicationDisplayName(record, t)}</span>
      ),
    },
    {
      title: t('pages.system.applications.code'),
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('pages.system.applications.description'),
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
      render: (_val: any, record: Application) => (
        <span>{resolveApplicationDescription(record, t)}</span>
      ),
    },
    {
      title: t('pages.system.applications.sortOrder'),
      dataIndex: 'sort_order',
      width: 100,
      sorter: (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
    },
    {
      title: t('pages.system.applications.isSystem'),
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.customField.yes'), status: 'Default' },
        false: { text: t('field.customField.no'), status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.installStatus'),
      dataIndex: 'is_installed',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.applications.installed'), status: 'Success' },
        false: { text: t('pages.system.applications.notInstalled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_installed ? 'success' : 'default'}>
          {record.is_installed ? t('pages.system.applications.installed') : t('pages.system.applications.notInstalled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.activeStatus'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.applications.enabled'), status: 'Success' },
        false: { text: t('pages.system.applications.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.version'),
      dataIndex: 'version',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('pages.system.applications.actions'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const canSync = record.is_installed && record.is_active;
        const actions: React.ReactNode[] = [
          <Button
            key="view"
            {...rowActionKind('read')}
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('pages.system.applications.view')}
          </Button>
        ];

        // 更多操作同步自 Card View 的 menuItems 逻辑
        actions.push(
          <Button
            key="edit"
            {...rowActionKind('skip')}
            {...rowActionLabelKeep()}
            type="link"
            size="small"
            icon={<APP_ACTION_ICON.settings />}
            onClick={() => {
              setEditingApp(record);
              setEditModalVisible(true);
            }}
          >
            {t('pages.system.applications.appSettings')}
          </Button>
        );

        if (canSync) {
          actions.push(
            <Popconfirm
              key="sync"
              {...rowActionKind('skip')}
              title={t('pages.system.applications.syncMenu')}
              description={t('pages.system.applications.syncMenuConfirm')}
              onConfirm={async () => {
                messageApi.loading({ content: t('pages.system.applications.syncMenuLoading'), key: 'sync-manifest' });
                try {
                  const result = await syncApplicationManifest(record.code);
                  if (result.success) {
                    messageApi.success({ content: result.message || t('pages.system.applications.syncMenuSuccess'), key: 'sync-manifest' });
                    actionRef.current?.reload();
                    await finalizeManifestSyncForSidebar();
                  } else {
                    throw new Error(result.message || t('pages.system.applications.syncFailed'));
                  }
                } catch (error: any) {
                  messageApi.error({ content: error.message || t('pages.system.applications.syncFailed'), key: 'sync-manifest' });
                }
              }}
            >
              <Button
                {...rowActionLabelKeep()}
                type="link"
                size="small"
                icon={<APP_ACTION_ICON.syncMenu />}
              >
                {t('pages.system.applications.syncMenu')}
              </Button>
            </Popconfirm>
          );
        }

        if (isDedicatedApplication(record) && currentUser?.is_infra_admin) {
          actions.push(
            <Button
              key="dedicated-binding"
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              type="link"
              size="small"
              icon={<APP_ACTION_ICON.dedicatedBinding />}
              onClick={() => openDedicatedBindingModal(record)}
            >
              {t('pages.system.applications.dedicatedOrgBinding')}
            </Button>,
          );
        }

        if (record.is_installed) {
          if (record.code === "kuaizhizao") {
            actions.push(
              <Button
                key="reset"
                {...rowActionKind('skip')}
                {...rowActionLabelKeep()}
                {...rowActionToneDestructive()}
                type="link"
                size="small"
                icon={<APP_ACTION_ICON.resetData />}
                onClick={() => {
                  setResetTargetApp(record);
                  setResetStage(1);
                  setResetConfirmText('');
                  setResetModalVisible(true);
                }}
              >
                {t('pages.system.applications.resetData', { defaultValue: '重置数据' })}
              </Button>
            );
          }

          actions.push(
            <Popconfirm
              key="uninstall"
              {...rowActionKind('skip')}
              title={t('pages.system.applications.uninstallConfirm')}
              onConfirm={() => handleUninstall(record)}
              disabled={record.is_system || !canManageAppLifecycle}
            >
              <Button
                {...rowActionLabelKeep()}
                {...rowActionToneDestructive()}
                type="link"
                size="small"
                disabled={record.is_system || !canManageAppLifecycle}
                icon={<APP_ACTION_ICON.uninstall />}
              >
                {t('pages.system.applications.uninstall')}
              </Button>
            </Popconfirm>
          );
        } else {
          actions.push(
            <Popconfirm
              key="install"
              {...rowActionKind('skip')}
              title={t('pages.system.applications.installConfirm')}
              onConfirm={() => handleInstall(record)}
              disabled={!canManageAppLifecycle}
            >
              <Button
                {...rowActionLabelKeep()}
                type="link"
                size="small"
                disabled={!canManageAppLifecycle}
                icon={<APP_ACTION_ICON.install />}
              >
                {t('pages.system.applications.install')}
              </Button>
            </Popconfirm>
          );
        }

        return actions;
      },
    },
  ];

  /**
   * 渲染应用卡片
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const renderApplicationCard = (
    application: Application,
    _index: number,
    options?: { inManufacturingStack?: boolean },
  ) => {
    const inManufacturingStack = options?.inManufacturingStack === true;
    const cardRadius = inManufacturingStack
      ? `0 ${themeToken.borderRadiusLG}px ${themeToken.borderRadiusLG}px 0`
      : themeToken.borderRadiusLG;
    const isPro =
      application.is_pro ||
      [
        'bi',
        'kuaiiot',
        'kuaiai',
        'kuaicrm',
        'kuaisrm',
        'kuaiasms',
        ...OTHER_PLACEHOLDER_CODES,
        ...INDUSTRY_VALUE_PACK_CODES,
      ].includes(application.code);
    const isFree = ['master-data', 'kuaizhizao', 'kuaierp', 'kuaimes', 'kuaiplm', 'kuaicaiwu', 'kuaireport'].includes(
      application.code,
    );
    const hasTierBadge = isPro || isFree;
    const coverPaddingY = hasTierBadge ? CARD_TIER_BADGE_CLEARANCE : CARD_COVER_PADDING_Y;
    const menuItems = [
      {
        key: 'view',
        label: t('pages.system.applications.viewDetail'),
        icon: <APP_ACTION_ICON.view />,
        onClick: () => handleView(application),
      },
      {
        key: 'edit-app',
        label: t('pages.system.applications.appSettings'),
        icon: <APP_ACTION_ICON.settings />,
        onClick: () => {
          setEditingApp(application);
          setEditModalVisible(true);
        },
      },
      {
        key: 'sync-manifest',
        label: (
          <Popconfirm
            title={t('pages.system.applications.syncMenu')}
            description={t('pages.system.applications.syncMenuConfirm')}
            onConfirm={async () => {
              messageApi.loading({ content: t('pages.system.applications.syncMenuLoading'), key: 'sync-manifest' });
              try {
                const result = await syncApplicationManifest(application.code);

                if (result.success) {
                  messageApi.success({
                    content: result.message || t('pages.system.applications.syncMenuSuccess'),
                    key: 'sync-manifest'
                  });

                  actionRef.current?.reload();

                  await finalizeManifestSyncForSidebar();
                } else {
                  throw new Error(result.message || t('pages.system.applications.syncFailed'));
                }

              } catch (error: any) {
                messageApi.error({
                  content: error.message || t('pages.system.applications.syncFailed'),
                  key: 'sync-manifest'
                });
              }
            }}
          >
            <div 
              style={{ margin: '-5px -12px', padding: '5px 12px' }} 
              onClick={(e) => e.stopPropagation()}
            >
              {t('pages.system.applications.syncMenu')}
            </div>
          </Popconfirm>
        ),
        icon: <APP_ACTION_ICON.syncMenu />,
      },
      ...(isDedicatedApplication(application) && currentUser?.is_infra_admin
        ? [
            {
              key: 'dedicated-binding',
              label: t('pages.system.applications.dedicatedOrgBinding'),
              icon: <APP_ACTION_ICON.dedicatedBinding />,
              onClick: () => openDedicatedBindingModal(application),
            },
          ]
        : []),

      application.code === "kuaizhizao" ? {
        key: 'reset-data',
        label: t('pages.system.applications.resetData', { defaultValue: '重置数据' }),
        icon: <APP_ACTION_ICON.resetData />,
        danger: true,
        onClick: () => {
          setResetTargetApp(application);
          setResetStage(1);
          setResetConfirmText('');
          setResetModalVisible(true);
        },
      } : null,
      {
        type: 'divider' as const,
      },
      !application.is_installed
        ? {
          key: 'install',
          label: (
            <Popconfirm
              title={t('pages.system.applications.installConfirm')}
              onConfirm={() => handleInstall(application)}
              disabled={!canManageAppLifecycle}
            >
              <div 
                style={{ margin: '-5px -12px', padding: '5px 12px' }} 
                onClick={(e) => e.stopPropagation()}
              >
                {t('pages.system.applications.install')}
              </div>
            </Popconfirm>
          ),
          icon: <APP_ACTION_ICON.install />,
          disabled: !canManageAppLifecycle,
        }
        : {
          key: 'uninstall',
          label: (
            <Popconfirm
              title={t('pages.system.applications.uninstallConfirm')}
              onConfirm={() => handleUninstall(application)}
              disabled={application.is_system || !canManageAppLifecycle}
            >
              <div 
                style={{ margin: '-5px -12px', padding: '5px 12px' }} 
                onClick={(e) => e.stopPropagation()}
              >
                {t('pages.system.applications.uninstall')}
              </div>
            </Popconfirm>
          ),
          icon: <APP_ACTION_ICON.uninstall />,
          danger: true,
          disabled: application.is_system || !canManageAppLifecycle,
        },
    ];

    return (
      <Card
        key={application.uuid}
        hoverable
        className="application-center-card"
        styles={{
          body: {
            padding: `${CARD_ROW_PADDING_Y}px ${CARD_ROW_PADDING_X}px`,
            background: themeToken.colorBgContainer,
          },
          actions: {
            background: themeToken.colorBgContainer,
            borderTop: `1px solid ${themeToken.colorBorderSecondary}`,
            margin: 0,
          },
        }}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: cardRadius,
          border: inManufacturingStack ? 'none' : `1px solid ${themeToken.colorBorderSecondary}`,
          overflow: 'hidden',
          boxShadow: inManufacturingStack ? 'none' : isDark ? themeToken.boxShadowSecondary : undefined,
          ['--app-center-card-row-padding-y' as string]: `${CARD_ROW_PADDING_Y}px`,
        }}
        cover={
          <div
            style={{
              position: 'relative',
              height: CARD_COVER_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              background: getCardGradient(
                application.code,
                !!(application.is_active && application.is_installed),
                themeToken,
                isDark,
              ),
              padding: `${coverPaddingY}px 20px`,
              borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
              borderTopLeftRadius: inManufacturingStack ? 0 : themeToken.borderRadiusLG,
              borderTopRightRadius: themeToken.borderRadiusLG,
            }}
          >
            {(() => {
              return (
                <>
                  {/* 角标 */}
                  {hasTierBadge && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        padding: '2px 12px',
                        borderBottomLeftRadius: themeToken.borderRadiusLG,
                        background: isPro ? themeToken.colorWarning : themeToken.colorSuccess,
                        color: themeToken.colorTextLightSolid,
                        fontSize: 11,
                        fontWeight: 600,
                        zIndex: 1,
                        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.35)' : '-2px 2px 5px rgba(0,0,0,0.05)',
                      }}
                    >
                      {isPro ? t('pages.system.applications.tierPro') : t('pages.system.applications.tierFree')}
                    </div>
                  )}

                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        application.is_active && application.is_installed
                          ? themeToken.colorBgContainer
                          : themeToken.colorFillTertiary,
                      boxShadow: isDark
                        ? '0 2px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25)'
                        : '0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      marginRight: 16,
                    }}
                  >
                    {(() => {
                      const iconElement = getApplicationIcon(application.code, application.icon, CARD_ICON_SIZE);
                      if (React.isValidElement(iconElement) && iconElement.type === 'img') {
                        return React.cloneElement(iconElement as React.ReactElement, {
                          style: { width: CARD_ICON_SIZE, height: CARD_ICON_SIZE, objectFit: 'contain' },
                        });
                      }
                      return React.cloneElement(iconElement as React.ReactElement, {
                        style: {
                          fontSize: CARD_ICON_SIZE,
                          color:
                            application.is_active && application.is_installed
                              ? themeToken.colorPrimary
                              : themeToken.colorTextQuaternary,
                        },
                      });
                    })()}
                  </div>
                  
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    {(() => {
                      const badgeBaseStyle: React.CSSProperties = {
                        height: 18,
                        padding: '0 5px',
                        fontSize: 10,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                        border: 'none',
                        flexShrink: 0,
                      };

                      const renderBadge = (
                        text: string,
                        light: { bg: string; color: string },
                        icon?: React.ReactNode,
                        dark?: { bg: string; color: string },
                      ) => {
                        const col = isDark && dark ? dark : light;
                        return (
                          <span style={{ ...badgeBaseStyle, backgroundColor: col.bg, color: col.color }}>
                            {icon && <span style={{ display: 'inline-flex', marginRight: 4 }}>{icon}</span>}
                            {text}
                          </span>
                        );
                      };

                      const typeBadges = (
                        <>
                          {application.code === 'master-data' &&
                            renderBadge(
                              'BASE',
                              { bg: '#f0f5ff', color: '#2f54eb' },
                              undefined,
                              { bg: themeToken.colorInfoBg, color: themeToken.colorInfoText },
                            )}
                          {!INDUSTRY_VALUE_PACK_CODES.includes(application.code) &&
                            [
                              'kuaizhizao',
                              'kuaierp',
                              'kuaimes',
                              'kuaicaiwu',
                              'kuaireport',
                              'bi',
                              'kuaicrm',
                              'kuaiplm',
                              'kuaisrm',
                              'kuaiasms',
                              ...OTHER_PLACEHOLDER_CODES,
                              ...INDUSTRY_VALUE_PACK_CODES,
                            ].includes(application.code) &&
                            renderBadge(
                              'APP',
                              { bg: '#f9f0ff', color: '#722ed1' },
                              undefined,
                              {
                                bg: `color-mix(in srgb, #722ed1 22%, ${themeToken.colorFillTertiary})`,
                                color: '#e9d5ff',
                              },
                            )}
                          {application.code === 'kuaiai' &&
                            renderBadge(
                              'AI',
                              { bg: '#fff7e6', color: '#fa8c16' },
                              undefined,
                              { bg: themeToken.colorWarningBg, color: themeToken.colorWarningText },
                            )}
                          {['kuaizhizao'].includes(application.code) &&
                            renderBadge(
                              t('pages.system.applications.editionIntegratedTag'),
                              { bg: '#fff7e6', color: '#d46b08' },
                              undefined,
                              { bg: themeToken.colorWarningBg, color: themeToken.colorWarningText },
                            )}
                          {['kuaierp', 'kuaimes'].includes(application.code) &&
                            renderBadge(
                              t('pages.system.applications.editionSplitTag'),
                              { bg: '#f0f9ff', color: '#1677ff' },
                              undefined,
                              { bg: themeToken.colorInfoBg, color: themeToken.colorInfoText },
                            )}
                          {INDUSTRY_VALUE_PACK_CODES.includes(application.code) &&
                            renderBadge(
                              t('pages.system.applications.valuePackTag'),
                              { bg: '#fff7e6', color: '#ad6800' },
                              undefined,
                              { bg: themeToken.colorWarningBg, color: themeToken.colorWarningText },
                            )}
                          {application.is_dedicated &&
                            renderBadge(
                              t('pages.system.applications.dedicatedTag'),
                              { bg: '#f4f0ff', color: '#531dab' },
                              undefined,
                              { bg: themeToken.colorFillTertiary, color: '#d3adf7' },
                            )}
                          {OTHER_PLACEHOLDER_CODES.includes(application.code) &&
                            renderBadge(
                              t('pages.system.applications.otherCategoryTag'),
                              { bg: '#f6ffed', color: '#389e0d' },
                              undefined,
                              { bg: themeToken.colorSuccessBg, color: themeToken.colorSuccessText },
                            )}
                          {(application.is_pro || ['bi', 'kuaiiot'].includes(application.code)) && !application.can_access && (
                            <Tooltip title={t('pages.system.applications.proLockedTag')}>
                              <span
                                style={{
                                  height: 18,
                                  width: 18,
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  backgroundColor: themeToken.colorFillTertiary,
                                  color: themeToken.colorTextSecondary,
                                  cursor: 'help',
                                }}
                              >
                                <LockOutlined style={{ fontSize: 11 }} />
                              </span>
                            </Tooltip>
                          )}
                        </>
                      );

                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, overflow: 'hidden' }}>
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 16,
                                color: themeToken.colorTextHeading,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flexShrink: 1,
                                minWidth: 0,
                              }}
                            >
                              {resolveApplicationDisplayName(application, t)}
                            </span>
                            <div style={{ flex: 1, minWidth: 8 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              {application.is_installed
                                ? renderBadge(
                                    t('pages.system.applications.installed'),
                                    { bg: '#f6ffed', color: '#52c41a' },
                                    undefined,
                                    { bg: themeToken.colorSuccessBg, color: themeToken.colorSuccessText },
                                  )
                                : renderBadge(
                                    t('pages.system.applications.notInstalled'),
                                    { bg: '#fff1f0', color: '#f5222d' },
                                    undefined,
                                    { bg: themeToken.colorErrorBg, color: themeToken.colorErrorText },
                                  )}
                              {application.is_system &&
                                renderBadge(
                                  t('pages.system.applications.systemTag'),
                                  { bg: '#fafafa', color: '#8c8c8c' },
                                  undefined,
                                  { bg: themeToken.colorFillTertiary, color: themeToken.colorTextTertiary },
                                )}
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 4,
                              marginBottom: 6,
                            }}
                          >
                            {typeBadges}
                          </div>
                        </>
                      );
                    })()}

                    <div
                      style={{
                        color: themeToken.colorTextSecondary,
                        fontSize: 13,
                        lineHeight: '18px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {resolveApplicationDescription(application, t, t('pages.system.applications.noDescription'))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        }
        actions={[
          <div
            key="active"
            style={{
              padding: `0 ${CARD_ROW_PADDING_X}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              lineHeight: 1,
            }}
          >
            <span style={{ fontSize: 12, color: themeToken.colorTextSecondary }}>{t('pages.system.applications.activeStatus')}</span>
            <Tooltip title={!canManageAppLifecycle ? t('pages.system.applications.platformAdminOnlyLifecycle') : undefined}>
              <span style={{ display: 'inline-flex' }}>
                <Switch
                  checked={application.is_active}
                  onChange={(checked) => handleToggleActive(application, checked)}
                  disabled={!application.is_installed || !canManageAppLifecycle}
                  checkedChildren={t('pages.system.applications.enabled')}
                  unCheckedChildren={t('pages.system.applications.disabled')}
                />
              </span>
            </Tooltip>
          </div>,
          <div
            key="more"
            style={{
              padding: `0 ${CARD_ROW_PADDING_X}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            <Dropdown {...rowActionKind('skip')} menu={{ items: menuItems }} trigger={['click']}>
              <Button type="text" icon={<DownOutlined />} style={{ width: '100%' }}>
                {t('pages.system.applications.moreActions')}
              </Button>
            </Dropdown>
          </div>,
        ]}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: themeToken.colorTextTertiary,
          }}
        >
          <span>{t('pages.system.applications.codeLabel')}: {application.code}</span>
          {application.version && (
            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
              v{application.version}
            </Tag>
          )}
        </div>
      </Card>
    );
  };


  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<Application>[] = [
    { title: t('pages.system.applications.name'), dataIndex: 'name', render: (_val: any, record: Application) => <span>{resolveApplicationDisplayName(record, t)}</span> },
    { title: t('pages.system.applications.code'), dataIndex: 'code' },
    { title: t('pages.system.applications.description'), dataIndex: 'description', render: (_val: any, record: Application) => <span>{resolveApplicationDescription(record, t)}</span> },
    { title: t('pages.system.applications.version'), dataIndex: 'version' },
    { title: t('pages.system.applications.changelog'), dataIndex: 'changelog', render: (val: any) => <span>{val || '-'}</span> },
    { title: t('pages.system.applications.routePath'), dataIndex: 'route_path' },
    { title: t('pages.system.applications.entryPoint'), dataIndex: 'entry_point' },
    { title: t('pages.system.applications.permissionCode'), dataIndex: 'permission_code' },
    {
      title: t('pages.system.applications.isSystem'),
      dataIndex: 'is_system',
      render: (dom: any) =>
        dom ? (
          <Tag color="purple">{t('field.customField.yes')}</Tag>
        ) : (
          <Tag>{t('field.customField.no')}</Tag>
        ),
    },
    {
      title: t('pages.system.applications.isDedicatedLabel'),
      dataIndex: 'is_dedicated',
      render: (dom: any) =>
        dom ? (
          <Tag color="geekblue">{t('field.customField.yes')}</Tag>
        ) : (
          <Tag>{t('field.customField.no')}</Tag>
        ),
    },
    {
      title: t('pages.system.applications.installStatus'),
      dataIndex: 'is_installed',
      render: (dom: any) => (
        <Tag color={dom ? 'success' : 'default'}>
          {dom ? t('pages.system.applications.installed') : t('pages.system.applications.notInstalled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.applications.activeStatus'),
      dataIndex: 'is_active',
      render: (dom: any) => (
        <Tag color={dom ? 'success' : 'default'}>
          {dom ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    { title: t('pages.system.applications.sortOrder'), dataIndex: 'sort_order' },
    { title: t('pages.system.applications.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.applications.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Application>
          columnPersistenceId="pages.system.applications.list"
          tanstackQuery={{ queryKeyPrefix: ['pages.system.applications.list', appCategoryFilter] }}
          key={`application-list-${appCategoryFilter}`}
          headerTitle={t('pages.system.applications.headerTitle')}
          actionRef={actionRef}
          columns={columns}
          {...(appCategoryFilter === 'dedicated'
            ? { locale: { emptyText: renderCustomAppsCategoryEmpty() } }
            : {})}
          request={async (params, _sort, _filter, searchFormValues) => {
            try {
              // 拉全量再筛选分类；勿按表格分页请求后端，否则靠后的应用永远不会进入前端
              const apiParams: any = {
                skip: 0,
                limit: APPLICATION_CENTER_LIST_LIMIT,
              };

              // 添加筛选条件
              if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
                apiParams.is_active = searchFormValues.is_active === 'true' || searchFormValues.is_active === true;
              }
              if (searchFormValues?.is_installed !== undefined && searchFormValues.is_installed !== '' && searchFormValues.is_installed !== null) {
                apiParams.is_installed = searchFormValues.is_installed === 'true' || searchFormValues.is_installed === true;
              }

              const allData = await getApplicationList(apiParams);

              // 纯前端预告应用（无后端数据库记录），sort_order 与迁移 212 保持一致
              const placeholders: any[] = [
                {
                  uuid: 'placeholder-kuaicrm',
                  code: 'kuaicrm',
                  name: t('pages.system.applications.mock.kuaicrm.name', { defaultValue: '快客户' }),
                  description: t('pages.system.applications.mock.kuaicrm.desc', { defaultValue: '新一代智能客户关系管理系统，敬请期待' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 100,
                  version: 'Beta',
                },
                {
                  uuid: 'placeholder-kuaisrm',
                  code: 'kuaisrm',
                  name: t('pages.system.applications.mock.kuaisrm.name', { defaultValue: '快协同' }),
                  description: t('pages.system.applications.mock.kuaisrm.desc', { defaultValue: '新一代供应链与供应商协同平台，敬请期待' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 102,
                  version: 'Beta',
                },
                {
                  uuid: 'placeholder-kuaimachinery',
                  code: 'kuaimachinery',
                  name: t('pages.system.applications.mock.kuaimachinery.name', { defaultValue: '机械加工增值包' }),
                  description: t('pages.system.applications.mock.kuaimachinery.desc', { defaultValue: '基于快制造的机械加工行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 200,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaimolding',
                  code: 'kuaimolding',
                  name: t('pages.system.applications.mock.kuaimolding.name', { defaultValue: '注塑增值包' }),
                  description: t('pages.system.applications.mock.kuaimolding.desc', { defaultValue: '基于快制造的注塑行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 201,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaielectronics',
                  code: 'kuaielectronics',
                  name: t('pages.system.applications.mock.kuaielectronics.name', { defaultValue: '电子增值包' }),
                  description: t('pages.system.applications.mock.kuaielectronics.desc', { defaultValue: '基于快制造的电子行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 202,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaiautoparts',
                  code: 'kuaiautoparts',
                  name: t('pages.system.applications.mock.kuaiautoparts.name', { defaultValue: '汽配增值包' }),
                  description: t('pages.system.applications.mock.kuaiautoparts.desc', { defaultValue: '基于快制造的汽配行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 203,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaimedical',
                  code: 'kuaimedical',
                  name: t('pages.system.applications.mock.kuaimedical.name', { defaultValue: '医疗器械增值包' }),
                  description: t('pages.system.applications.mock.kuaimedical.desc', { defaultValue: '基于快制造的医疗器械行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 204,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaifood',
                  code: 'kuaifood',
                  name: t('pages.system.applications.mock.kuaifood.name', { defaultValue: '食品饮料增值包' }),
                  description: t('pages.system.applications.mock.kuaifood.desc', { defaultValue: '基于快制造的食品饮料行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 205,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaipackaging',
                  code: 'kuaipackaging',
                  name: t('pages.system.applications.mock.kuaipackaging.name', { defaultValue: '包装印刷增值包' }),
                  description: t('pages.system.applications.mock.kuaipackaging.desc', { defaultValue: '基于快制造的包装印刷行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 206,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaihardware',
                  code: 'kuaihardware',
                  name: t('pages.system.applications.mock.kuaihardware.name', { defaultValue: '五金冲压增值包' }),
                  description: t('pages.system.applications.mock.kuaihardware.desc', { defaultValue: '基于快制造的五金冲压行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 207,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaidiecasting',
                  code: 'kuaidiecasting',
                  name: t('pages.system.applications.mock.kuaidiecasting.name', { defaultValue: '压铸增值包' }),
                  description: t('pages.system.applications.mock.kuaidiecasting.desc', { defaultValue: '基于快制造的压铸行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 208,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaiwiring',
                  code: 'kuaiwiring',
                  name: t('pages.system.applications.mock.kuaiwiring.name', { defaultValue: '线束增值包' }),
                  description: t('pages.system.applications.mock.kuaiwiring.desc', { defaultValue: '基于快制造的线束行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 209,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaimotor',
                  code: 'kuaimotor',
                  name: t('pages.system.applications.mock.kuaimotor.name', { defaultValue: '电机增值包' }),
                  description: t('pages.system.applications.mock.kuaimotor.desc', { defaultValue: '基于快制造的电机行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 210,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaibattery',
                  code: 'kuaibattery',
                  name: t('pages.system.applications.mock.kuaibattery.name', { defaultValue: '电池增值包' }),
                  description: t('pages.system.applications.mock.kuaibattery.desc', { defaultValue: '基于快制造的电池行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 211,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuainewequipment',
                  code: 'kuainewequipment',
                  name: t('pages.system.applications.mock.kuainewequipment.name', { defaultValue: '新能源设备增值包' }),
                  description: t('pages.system.applications.mock.kuainewequipment.desc', { defaultValue: '基于快制造的新能源设备行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 212,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaisheetmetal',
                  code: 'kuaisheetmetal',
                  name: t('pages.system.applications.mock.kuaisheetmetal.name', { defaultValue: '钣金增值包' }),
                  description: t('pages.system.applications.mock.kuaisheetmetal.desc', { defaultValue: '基于快制造的钣金行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 213,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaimold',
                  code: 'kuaimold',
                  name: t('pages.system.applications.mock.kuaimold.name', { defaultValue: '模具增值包' }),
                  description: t('pages.system.applications.mock.kuaimold.desc', { defaultValue: '基于快制造的模具行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 214,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaisemiconductor',
                  code: 'kuaisemiconductor',
                  name: t('pages.system.applications.mock.kuaisemiconductor.name', { defaultValue: '半导体增值包' }),
                  description: t('pages.system.applications.mock.kuaisemiconductor.desc', { defaultValue: '基于快制造的半导体行业专属能力包，欢迎客户联合共创' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 215,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaitms',
                  code: 'kuaitms',
                  name: t('pages.system.applications.mock.kuailogistics.name', { defaultValue: '快物流' }),
                  description: t('pages.system.applications.mock.kuailogistics.desc', { defaultValue: '物流与运力协同管理平台，敬请期待' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 104,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaiasms',
                  code: 'kuaiasms',
                  name: t('pages.system.applications.mock.kuaiaftersales.name', { defaultValue: '快售后' }),
                  description: t('pages.system.applications.mock.kuaiaftersales.desc', { defaultValue: '售后服务与闭环追踪管理平台，敬请期待' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 103,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuailtms',
                  code: 'kuailtms',
                  name: t('pages.system.applications.mock.kuaiexperiment.name', { defaultValue: '快实验' }),
                  description: t('pages.system.applications.mock.kuaiexperiment.desc', { defaultValue: '实验流程与结果追溯管理平台，敬请期待' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 105,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaiip',
                  code: 'kuaiip',
                  name: t('pages.system.applications.mock.kuaiip.name', { defaultValue: '快知产' }),
                  description: t('pages.system.applications.mock.kuaiip.desc', { defaultValue: '知识产权全周期管理平台，敬请期待' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 106,
                  version: 'PRO',
                },
                {
                  uuid: 'placeholder-kuaiems',
                  code: 'kuaiems',
                  name: t('pages.system.applications.mock.kuaienergy.name', { defaultValue: '快能源' }),
                  description: t('pages.system.applications.mock.kuaienergy.desc', { defaultValue: '能源数据监控与能效分析平台，敬请期待' }),
                  is_pro: true,
                  can_access: false,
                  is_installed: false,
                  is_active: false,
                  is_system: false,
                  sort_order: 107,
                  version: 'PRO',
                },
              ];

              let filteredData = [...(allData || []), ...placeholders].map(app => {
                const overriddenSortOrder = APP_SORT_ORDER_OVERRIDES[app.code as string];
                const overriddenDescription = APP_DESCRIPTION_OVERRIDES[app.code as string];
                const appWithSort = overriddenSortOrder !== undefined
                  ? { ...app, sort_order: overriddenSortOrder }
                  : app;
                const appWithDisplay = overriddenDescription !== undefined
                  ? { ...appWithSort, description: overriddenDescription }
                  : appWithSort;
                // BI 占位仍按未授权 PRO 展示（无 manifest 时前端兜底）
                if (appWithDisplay.code === 'bi') {
                  return { ...appWithDisplay, is_pro: true, can_access: false };
                }
                return appWithDisplay;
              });

              // 前端筛选（因为后端可能不支持某些筛选）
              if (searchFormValues?.is_system !== undefined && searchFormValues.is_system !== '' && searchFormValues.is_system !== null) {
                filteredData = filteredData.filter(item => item.is_system === (searchFormValues.is_system === 'true' || searchFormValues.is_system === true));
              }

              // 搜索关键词筛选（name 或 code）
              if (searchFormValues?.name) {
                const keyword = String(searchFormValues.name).toLowerCase();
                filteredData = filteredData.filter(item =>
                  item.name.toLowerCase().includes(keyword) ||
                  item.code.toLowerCase().includes(keyword) ||
                  (item.description && item.description.toLowerCase().includes(keyword))
                );
              }

              filteredData = filteredData.filter(item => matchAppCategory(item, appCategoryFilter));

              // 按后端 sort_order 字段排序（数据库迁移 212 保证所有应用都有正确排序值）
              filteredData.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

              return {
                data: filteredData,
                success: true,
                total: filteredData.length,
              };
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.applications.loadListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          beforeSearchButtons={
            <ThemedSegmented
              surfaceBackground
              size="middle"
              value={appCategoryFilter}
              options={[
                { label: t('pages.system.applications.categoryAll'), value: 'all' },
                { label: t('pages.system.applications.categoryGeneral'), value: 'general' },
                { label: t('pages.system.applications.categoryOther'), value: 'other' },
                { label: t('pages.system.applications.categoryIndustry'), value: 'industry' },
                { label: t('pages.system.applications.categoryDedicated'), value: 'dedicated' },
                { label: t('pages.system.applications.categoryBasic'), value: 'basic' },
                { label: t('pages.system.applications.categoryPro'), value: 'pro' },
              ]}
              onChange={(value) => {
                setAppCategoryFilter(value as AppCategoryFilter);
              }}
            />
          }
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const apiParams: any = { skip: 0, limit: 10000 };
              const allData = await getApplicationList(apiParams);
              let items = allData || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('pages.system.applications.noDataExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `applications-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.applications.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.applications.exportFailed'));
            }
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          toolBarRender={() => [
            <Button {...rowActionKind('read')}
              key="scan"
              type="primary"
              icon={<AppstoreOutlined />}
              loading={scanning}
              onClick={handleScanApplications}
            >
              {t('pages.system.applications.scanApplications', { defaultValue: '扫描应用' })}
            </Button>,
            <Button {...rowActionKind('update')}
              key="sync-all"
              icon={<SyncOutlined />}
              loading={syncAllLoading}
              onClick={handleSyncAllMenus}
            >
              {t('pages.system.applications.syncAllMenus', { defaultValue: '一键同步菜单' })}
            </Button>,
          ]}
          viewTypes={['card', 'table', 'help']}
          defaultViewType="card"
          helpViewConfig={{ content: <ApplicationHelpView /> }}
          cardViewConfig={{
            renderCard: renderApplicationCard,
            columns: { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
            emptyCard: appCategoryFilter === 'dedicated' ? renderCustomAppsCategoryEmpty() : undefined,
            cardStackGroups: [
              {
                codes: [...MANUFACTURING_STACK_CODES],
                renderStack: (items, renderCard) => (
                  <ManufacturingAppStack apps={items} renderCard={renderCard} />
                ),
              },
            ],
          }}
        />
      </ListPageTemplate>

      <Modal
        title={t('pages.system.applications.resetData', { defaultValue: '重置数据' })}
        open={resetModalVisible}
        onCancel={() => setResetModalVisible(false)}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <div style={{ padding: '8px 0' }}>
          {resetStage === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 500, color: '#ff4d4f' }}>
                {t('pages.system.applications.resetWarnTitle', { defaultValue: '⚠️ 极大风险操作：数据重置' })}
              </div>
              <p style={{ color: '#666', marginBottom: 24, padding: '0 20px', lineHeight: '1.6' }}>
                {t('pages.system.applications.resetWarn1', { defaultValue: '重置操作将物理抹除“快制造”应用下所有的销售订单、生产工单、库存流水、需求计划等业务数据。此操作不可撤销！' })}
              </p>
              <Button 
                type="primary" 
                danger 
                size="large" 
                block
                onClick={() => setResetStage(2)}
              >
                {t('pages.system.applications.resetNext', { defaultValue: '我已了解风险，下一步' })}
              </Button>
            </div>
          )}

          {resetStage === 2 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#f5222d' }}>
                {t('pages.system.applications.resetWarnTitle2', { defaultValue: '再次确认：您确定要继续吗？' })}
              </div>
              <p style={{ color: '#333', marginBottom: 24, fontWeight: 500 }}>
                {t('pages.system.applications.resetWarn2', { defaultValue: '一旦点击下一步，数据将无法通过常规手段恢复。建议您确保当前没有正在进行的业务，并告知相关团队成员。' })}
              </p>
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                <Button 
                  type="primary" 
                  danger 
                  size="large" 
                  block
                  onClick={() => setResetStage(3)}
                >
                  {t('pages.system.applications.resetConfirmNext', { defaultValue: '我很确定，继续重置' })}
                </Button>
                <Button block onClick={() => setResetModalVisible(false)}>
                  {t('pages.system.applications.resetCancel', { defaultValue: '我再想想，取消重置' })}
                </Button>
              </Space>
            </div>
          )}

          {resetStage === 3 && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 16, fontWeight: 500, color: '#262626' }}>
                {t('pages.system.applications.resetFinalCheck', { defaultValue: '终极安全校验' })}
              </div>
              <p style={{ color: '#666', marginBottom: 12 }}>
                {t('pages.system.applications.resetTypeConfirm', { defaultValue: '请在下方准确输入以下内容以确认操作：' })}
              </p>
              <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '8px 12px', borderRadius: 4, marginBottom: 16, fontWeight: 'bold', color: '#856404' }}>
                {resetConfirmPhrase}
              </div>
              <ProFormText
                placeholder={t('pages.system.applications.resetInputPlaceholder', { defaultValue: '请输入确认文本' })}
                fieldProps={{
                  value: resetConfirmText,
                  onChange: (e) => setResetConfirmText(e.target.value),
                }}
              />
              <div style={{ marginTop: 24 }}>
                <Button 
                  type="primary" 
                  danger 
                  size="large" 
                  block
                  loading={submitting}
                  disabled={resetConfirmText !== resetConfirmPhrase}
                  onClick={async () => {
                    if (resetConfirmText !== resetConfirmPhrase) return;
                    try {
                      setSubmitting(true);
                      const result = await apiRequest<{ success: boolean; message?: string }>(
                        '/apps/kuaizhizao/management/reset-data',
                        { method: 'POST' },
                      );
                      if (result?.success) {
                        messageApi.success(result.message || '重置成功并已自动备份');
                        setResetModalVisible(false);
                        actionRef.current?.reload();
                      } else {
                        messageApi.error(result?.message || '重置失败');
                      }
                    } catch (error: unknown) {
                      messageApi.error((error as Error).message || '重置失败');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {t('pages.system.applications.resetStart', { defaultValue: '启动全量物理重置（且自动备份）' })}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={t('pages.system.applications.dedicatedBindingModalTitle', {
          name: dedicatedBindingApp
            ? resolveApplicationDisplayName(dedicatedBindingApp, t)
            : '',
        })}
        open={dedicatedBindingModalOpen}
        onCancel={() => {
          setDedicatedBindingModalOpen(false);
          setDedicatedBindingApp(null);
        }}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('pages.system.applications.dedicatedBindingHint')} />
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('pages.system.applications.dedicatedBindingBoundList')}</div>
        <Table<DedicatedBindingRow>
          size="small"
          rowKey={(r) => `${r.app_code}-${r.tenant_id}`}
          loading={dedicatedBindingLoading}
          pagination={false}
          dataSource={dedicatedBindingRows}
          columns={[
            {
              title: t('pages.system.applications.dedicatedBindingTenantIdCol'),
              dataIndex: 'tenant_id',
              width: 100,
            },
            {
              title: t('pages.system.applications.dedicatedBindingTenantCol'),
              dataIndex: 'tenant_name',
              ellipsis: true,
              render: (name: string | null | undefined, row) => name || `— (#${row.tenant_id})`,
            },
            {
              title: t('pages.system.applications.dedicatedBindingCreatedAt'),
              dataIndex: 'created_at',
              width: 200,
              render: (v: string) => {
                try {
                  return new Date(v).toLocaleString();
                } catch {
                  return v;
                }
              },
            },
            {
              title: t('pages.system.applications.actions'),
              key: 'actions',
              width: 100,
              render: (_, row) => (
                <Popconfirm
                  title={t('pages.system.applications.dedicatedBindingUnbindConfirm')}
                  onConfirm={() => handleUnbindDedicatedTenant(row.tenant_id)}
                >
                  <Button type="link" size="small" danger>
                    {t('pages.system.applications.dedicatedBindingUnbind')}
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
        <Divider />
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('pages.system.applications.dedicatedBindingAddSection')}</div>
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Select
            showSearch
            allowClear
            filterOption={false}
            placeholder={t('pages.system.applications.dedicatedBindingTenantPlaceholder')}
            loading={tenantBindSearchLoading}
            options={tenantBindOptions}
            value={tenantBindSelectValue}
            onChange={(v) => setTenantBindSelectValue(v ?? undefined)}
            onSearch={handleTenantBindSearch}
            onDropdownVisibleChange={(open) => {
              if (open && tenantBindOptions.length === 0) handleTenantBindSearch('');
            }}
            style={{ width: '100%' }}
          />
          <Space wrap>
            <Button type="primary" onClick={() => void handleBindDedicatedTenant()}>
              {t('pages.system.applications.dedicatedBindingBind')}
            </Button>
            <Button onClick={() => void handleBindCurrentTenant()} disabled={currentUser?.tenant_id == null}>
              {t('pages.system.applications.dedicatedBindingBindCurrent')}
            </Button>
          </Space>
        </Space>
      </Modal>

      {/* 查看详情 Drawer */}
      <UniDetail
        title={t('pages.system.applications.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, detailData)} />
          ) : null}
        lines={detailData?.code ? <ApplicationClientReleasesPanel appCode={detailData.code} /> : null}
        linesTitle={t('pages.system.applications.clientReleasesSectionTitle')}
        linesVisible={Boolean(detailData?.code)}
      />

      {/* 应用设置 Modal - 使用 FormModalTemplate */}
      <FormModalTemplate
        key={editingApp?.uuid ?? 'edit'}
        title={t('pages.system.applications.editModalTitle', { name: editingApp?.name ?? '' })}
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onFinish={async (values: any) => {
          if (editingApp) {
            const isCustomSort = values.sort_order !== (editingApp.sort_order ?? 0) || editingApp.is_custom_sort;
            await handleUpdateAppConfig(editingApp, {
              sort_order: values.sort_order,
              is_custom_sort: isCustomSort,
            });
          }
        }}
        isEdit={true}
        loading={submitting}
        formRef={editFormRef}
        width={MODAL_CONFIG.SMALL_WIDTH}
        initialValues={
          editingApp
            ? {
                name: resolveApplicationDisplayName(editingApp, t),
                description: resolveApplicationDescription(editingApp, t),
                sort_order: editingApp.sort_order ?? 0,
              }
            : undefined
        }
        extraFooter={
          editingApp ? (
            <Button
              danger
              onClick={() => {
                modalApi.confirm({
                  title: t('pages.system.applications.restoreDefault'),
                  content: t('pages.system.applications.restoreDefaultConfirm'),
                  onOk: async () => {
                    setSubmitting(true);
                    try {
                      await updateApplication(editingApp.uuid, {
                        is_custom_sort: false,
                      });
                      await syncApplicationManifest(editingApp.code);
                      await finalizeManifestSyncForSidebar();
                      messageApi.success(t('pages.system.applications.restoreSuccess'));
                      setEditModalVisible(false);
                      actionRef.current?.reload();
                    } catch (error: any) {
                      messageApi.error(error.message || t('pages.system.applications.restoreFailed'));
                    } finally {
                      setSubmitting(false);
                    }
                  },
                });
              }}
            >
              {t('pages.system.applications.restoreDefault')}
            </Button>
          ) : null
        }
      >
        <ProFormText
          name="name"
          label={t('pages.system.applications.nameLabel')}
          fieldProps={{ disabled: true }}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.applications.descriptionLabel')}
          fieldProps={{ disabled: true, rows: 3 }}
        />
        <ProFormDigit
          name="sort_order"
          label={t('pages.system.applications.sortOrderHint')}
          fieldProps={{ min: 0 }}
        />
        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>
          {t('pages.system.applications.editHint')}
        </div>
      </FormModalTemplate>

      {/* 应用升版 Modal - 使用 FormModalTemplate */}
      <FormModalTemplate
        key={proKeyTargetApp?.uuid ?? 'pro-key'}
        title={t('pages.system.applications.proKeyModalTitle', { defaultValue: '输入 License Key（许可证密钥）' })}
        open={proKeyModalVisible}
        onClose={() => {
          setProKeyModalVisible(false);
          setPendingEnableAfterActivation(false);
        }}
        onFinish={handleActivateProKey}
        isEdit={true}
        loading={proKeySubmitting}
        formRef={proKeyFormRef}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormText.Password
          name="license_key"
          label={t('pages.system.applications.proKeyLabel', { defaultValue: 'License Key（许可证密钥）' })}
          placeholder={t('pages.system.applications.proKeyPlaceholder', { defaultValue: '请输入 License Key' })}
          rules={[
            { required: true, message: t('common.required', { defaultValue: '必填' }) },
            { min: 8, message: t('pages.system.applications.proKeyMinLength', { defaultValue: 'License Key 长度至少 8 位' }) },
          ]}
          fieldProps={{
            autoComplete: 'off',
          }}
        />
        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>
          {t('pages.system.applications.proKeyHint', { defaultValue: '系统仅保存 License Key 摘要（不可逆），用于后续授权校验。' })}
        </div>
      </FormModalTemplate>


    </>
  );
};

export default ApplicationListPage;

