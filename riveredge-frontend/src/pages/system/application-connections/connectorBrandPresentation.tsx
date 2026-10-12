/**
 * 应用连接器市场 / 列表：原厂 Logo 与品牌主题色底纹
 */

import React from 'react';
import feishuLogo from '../../../assets/connectors/feishu-app.png';
import dingtalkLogo from '../../../assets/connectors/dingtalk-logo.png';
import wecomLogo from '../../../assets/connectors/wecom.svg';
import workbuddyLogo from '../../../assets/connectors/workbuddy-square.png';
import openaiLogo from '../../../assets/connectors/openai.svg';
import qwenLogo from '../../../assets/connectors/qwen.svg';
import alibabacloudLogo from '../../../assets/connectors/alibabacloud.svg';
import sapLogo from '../../../assets/connectors/sap.svg';
import oracleLogo from '../../../assets/connectors/oracle.svg';
import microsoftLogo from '../../../assets/connectors/microsoft.svg';
import salesforceLogo from '../../../assets/connectors/salesforce.svg';
import amazonawsLogo from '../../../assets/connectors/amazonaws.svg';
import deepseekLogo from '../../../assets/connectors/deepseek-app.png';
import kingdeeIcon from '../../../assets/connectors/kingdee.ico';
import yonyouIcon from '../../../assets/connectors/yonyou-icon.png';
import digiwinLogo from '../../../assets/connectors/digiwin.png';
import digiwinIcon from '../../../assets/connectors/digiwin.ico';
import inspurLogo from '../../../assets/connectors/inspur.png';
import graspIcon from '../../../assets/connectors/grasp.ico';
import superIcon from '../../../assets/connectors/super.ico';
import sunlikeLogo from '../../../assets/connectors/sunlike.png';
import odooLogo from '../../../assets/connectors/odoo.svg';
import erpnextLogo from '../../../assets/connectors/erpnext.svg';
import huaweiLogo from '../../../assets/connectors/huawei.svg';
import tencentCloudLogo from '../../../assets/connectors/tencent-cloud.png';
import landrayIcon from '../../../assets/connectors/landray.png';
import weaverIcon from '../../../assets/connectors/weaver.ico';
import seeyonIcon from '../../../assets/connectors/seeyon.ico';
import chanjetLogo from '../../../assets/connectors/chanjet-logo.png';
import moonshotIcon from '../../../assets/connectors/moonshot.ico';
import siliconflowIcon from '../../../assets/connectors/siliconflow.png';
import zhipuIcon from '../../../assets/connectors/zhipu.png';
import amapIcon from '../../../assets/connectors/amap.ico';
import qiniuIcon from '../../../assets/connectors/qiniu.ico';
import minioLogo from '../../../assets/connectors/minio.svg';
import rustfsLogo from '../../../assets/connectors/rustfs.svg';
import xiaoshouyiLogo from '../../../assets/connectors/xiaoshouyi.png';
import supraCrmLogo from '../../../assets/connectors/supra_crm.png';
import rootcloudLogo from '../../../assets/connectors/rootcloud.png';
import casicloudLogo from '../../../assets/connectors/casicloud.png';
import thingsboardLogo from '../../../assets/connectors/thingsboard.png';
import jetlinksLogo from '../../../assets/connectors/jetlinks.svg';
import fluxWmsLogo from '../../../assets/connectors/flux_wms.png';
import kejianWmsLogo from '../../../assets/connectors/kejian_wms.png';
import fenxiangIcon from '../../../assets/connectors/fenxiang.ico';
import qidianIcon from '../../../assets/connectors/qidian.ico';
import cloudhubIcon from '../../../assets/connectors/cloudhub.ico';
import tongdaIcon from '../../../assets/connectors/tongda.ico';
import caxaIcon from '../../../assets/connectors/caxa.ico';
import kuaidi100Icon from '../../../assets/connectors/kuaidi100.ico';
import kdniaoIcon from '../../../assets/connectors/kdniao.ico';
import siemensLogo from '../../../assets/connectors/siemens.svg';
import windchillLogo from '../../../assets/connectors/windchill.svg';
import sipmLogo from '../../../assets/connectors/sipm.png';
import sanpinPlmLogo from '../../../assets/connectors/sanpin_plm.png';
import intesimPlmLogo from '../../../assets/connectors/intesim_plm.png';

export type ConnectorBrandVariant = 'onColor' | 'onLight' | 'appIcon';

export type ConnectorBrandPresentation = {
  logoSrc?: string;
  tileBackground: string;
  iconColor: string;
  variant: ConnectorBrandVariant;
  /** 单色矢量标（simple-icons 等）：onColor 底上反白，避免黑标+色底 */
  logoMonochrome?: boolean;
  /** onLight 字标在圆内的缩放（默认 0.68） */
  logoContainScale?: number;
  /** appIcon 且素材本身已是满铺圆角方标时为 true；false/未设则套圆角方形容器 + contain */
  logoFillsTile?: boolean;
  /** 宽字标 width/height（如 220×100 → 2.2），onLight 时按宽铺满容器 */
  logoAspectRatio?: number;
};

const MONOCHROME_LOGO_ON_COLOR_FILTER = 'brightness(0) invert(1)';
const CONNECTOR_LOGO_ON_LIGHT_TILE = '#FFFFFF';
const CONNECTOR_LOGO_TILE_BORDER = '1px solid rgba(0, 0, 0, 0.06)';
/** 市场/列表卡片 Logo 圆角方形容器轻投影 */
const CONNECTOR_BRAND_ICON_TILE_SHADOW = '0 2px 8px rgba(15, 23, 42, 0.08)';
/** 小 favicon 类 appIcon 在白底圆角方形容器内的留白比例 */
const CONNECTOR_APP_ICON_CONTAIN_SCALE = 0.74;

function usesNativeAppIconFill(brand: ConnectorBrandPresentation): boolean {
  return brand.variant === 'appIcon' && brand.logoFillsTile === true;
}

function resolveBrandTileBackground(brand: ConnectorBrandPresentation): string {
  const raw = brand.tileBackground?.trim();
  if (brand.variant === 'appIcon') {
    if (usesNativeAppIconFill(brand)) return 'transparent';
    if (raw && raw !== 'transparent') return raw;
    return CONNECTOR_LOGO_ON_LIGHT_TILE;
  }
  if (brand.variant === 'onLight') return CONNECTOR_LOGO_ON_LIGHT_TILE;
  return raw && raw !== 'transparent' ? raw : brand.tileBackground;
}

function resolveBrandTileBorder(brand: ConnectorBrandPresentation): string | undefined {
  if (usesNativeAppIconFill(brand)) return undefined;
  if (brand.variant === 'onLight') return CONNECTOR_LOGO_TILE_BORDER;
  if (brand.variant === 'appIcon') {
    const bg = resolveBrandTileBackground(brand);
    if (bg === CONNECTOR_LOGO_ON_LIGHT_TILE) return CONNECTOR_LOGO_TILE_BORDER;
  }
  return undefined;
}

/** 精确 id → 原厂 Logo + 主题色 */
const CONNECTOR_BRAND_BY_ID: Record<string, ConnectorBrandPresentation> = {
  feishu: {
    logoSrc: feishuLogo,
    tileBackground: 'transparent',
    iconColor: '#3370FF',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  dingtalk: {
    logoSrc: dingtalkLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#0075FF',
    variant: 'appIcon',
    logoContainScale: 0.72,
  },
  wecom: {
    logoSrc: wecomLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#2BAD13',
    variant: 'appIcon',
    logoContainScale: 0.72,
  },
  kuaiai_workbuddy: {
    logoSrc: workbuddyLogo,
    tileBackground: 'transparent',
    iconColor: '#01C886',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  openai: {
    logoSrc: openaiLogo,
    tileBackground: '#10A37F',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  qwen: {
    logoSrc: qwenLogo,
    tileBackground: '#FF6A00',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  deepseek: {
    logoSrc: deepseekLogo,
    tileBackground: 'transparent',
    iconColor: '#4D6BFE',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  zhipu: {
    logoSrc: zhipuIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#385EFF',
    variant: 'appIcon',
  },
  moonshot: {
    logoSrc: moonshotIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#FFFFFF',
    variant: 'appIcon',
  },
  siliconflow: {
    logoSrc: siliconflowIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#FFFFFF',
    variant: 'appIcon',
  },
  amap: {
    logoSrc: amapIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#00AE66',
    variant: 'appIcon',
  },
  salesforce: {
    logoSrc: salesforceLogo,
    tileBackground: '#00A1E0',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  dynamics_365: {
    logoSrc: microsoftLogo,
    tileBackground: '#0078D4',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  odoo: {
    logoSrc: odooLogo,
    tileBackground: '#714B67',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  erpnext: {
    logoSrc: erpnextLogo,
    tileBackground: '#0089FF',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  chanjet_tplus: {
    logoSrc: chanjetLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#E62129',
    variant: 'onLight',
    logoContainScale: 0.9,
    logoAspectRatio: 2.2,
  },
  grasp_huihuang: {
    logoSrc: graspIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#E60012',
    variant: 'appIcon',
  },
  super_erp: {
    logoSrc: superIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#006CB8',
    variant: 'appIcon',
  },
  alicloud_oss: {
    logoSrc: alibabacloudLogo,
    tileBackground: '#FF6A00',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  alicloud_iot: {
    logoSrc: alibabacloudLogo,
    tileBackground: '#FF6A00',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  aliyun_market: {
    logoSrc: alibabacloudLogo,
    tileBackground: '#FF6A00',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  tencent_cos: {
    logoSrc: tencentCloudLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#006EFF',
    variant: 'appIcon',
    logoContainScale: 0.72,
  },
  tencent_market: {
    logoSrc: tencentCloudLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#006EFF',
    variant: 'appIcon',
    logoContainScale: 0.72,
  },
  huaweicloud_obs: {
    logoSrc: huaweiLogo,
    tileBackground: '#CF0A2C',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  huaweicloud_iot: {
    logoSrc: huaweiLogo,
    tileBackground: '#CF0A2C',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  rootcloud: {
    logoSrc: rootcloudLogo,
    tileBackground: 'transparent',
    iconColor: '#00A870',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  casicloud: {
    logoSrc: casicloudLogo,
    tileBackground: 'transparent',
    iconColor: '#F57C00',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  thingsboard: {
    logoSrc: thingsboardLogo,
    tileBackground: 'transparent',
    iconColor: '#305680',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  jetlinks: {
    logoSrc: jetlinksLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#0E6EFF',
    variant: 'appIcon',
    logoContainScale: 0.72,
  },
  flux_wms: {
    logoSrc: fluxWmsLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#E60012',
    variant: 'onLight',
    logoContainScale: 0.9,
    logoAspectRatio: 378 / 121,
  },
  kejian_wms: {
    logoSrc: kejianWmsLogo,
    tileBackground: 'transparent',
    iconColor: '#F58220',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  aws_s3: {
    logoSrc: amazonawsLogo,
    tileBackground: '#232F3E',
    iconColor: '#FF9900',
    variant: 'onColor',
    logoMonochrome: true,
  },
  minio: {
    logoSrc: minioLogo,
    tileBackground: '#C72C48',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  rustfs: {
    logoSrc: rustfsLogo,
    tileBackground: '#DE4C2B',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  qiniu_kodo: {
    logoSrc: qiniuIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#0066FF',
    variant: 'appIcon',
  },
  kuaidi100: {
    logoSrc: kuaidi100Icon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#0082FF',
    variant: 'appIcon',
  },
  kdniao: {
    logoSrc: kdniaoIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#009944',
    variant: 'appIcon',
  },
  xiaoshouyi: {
    logoSrc: xiaoshouyiLogo,
    tileBackground: 'transparent',
    iconColor: '#0070E0',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  supra_crm: {
    logoSrc: supraCrmLogo,
    tileBackground: 'transparent',
    iconColor: '#2F76E8',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  fenxiang: {
    logoSrc: fenxiangIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#FFB800',
    variant: 'appIcon',
  },
  qidian: {
    logoSrc: qidianIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#006EFF',
    variant: 'appIcon',
  },
  cloudhub: {
    logoSrc: cloudhubIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#4598F0',
    variant: 'appIcon',
  },
  tongda_oa: {
    logoSrc: tongdaIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#006CB8',
    variant: 'appIcon',
  },
  caxa: {
    logoSrc: caxaIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#E60012',
    variant: 'appIcon',
  },
  sipm: {
    logoSrc: sipmLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#006CB8',
    variant: 'onLight',
    logoContainScale: 0.72,
  },
  sanpin_plm: {
    logoSrc: sanpinPlmLogo,
    tileBackground: 'transparent',
    iconColor: '#006CB8',
    variant: 'appIcon',
    logoFillsTile: true,
  },
  inteplm: {
    logoSrc: intesimPlmLogo,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#008C8C',
    variant: 'onLight',
    logoContainScale: 0.9,
    logoAspectRatio: 200 / 78,
  },
  teamcenter: {
    logoSrc: siemensLogo,
    tileBackground: '#009999',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoMonochrome: true,
  },
  windchill: {
    logoSrc: windchillLogo,
    tileBackground: '#323232',
    iconColor: '#FFFFFF',
    variant: 'onColor',
    logoContainScale: 0.58,
  },
  kuaiai_ocr: {
    logoSrc: siliconflowIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#6366F1',
    variant: 'appIcon',
  },
  weaver: {
    logoSrc: weaverIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#E60012',
    variant: 'appIcon',
  },
  seeyon: {
    logoSrc: seeyonIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#C8161D',
    variant: 'appIcon',
  },
  landray: {
    logoSrc: landrayIcon,
    tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
    iconColor: '#0066CC',
    variant: 'appIcon',
  },
};

/** 前缀 → Logo + 主题（ERP / 云厂商等） */
const CONNECTOR_BRAND_BY_PREFIX: Array<{
  prefix: string;
  presentation: ConnectorBrandPresentation;
}> = [
  {
    prefix: 'kingdee_',
    presentation: {
      logoSrc: kingdeeIcon,
      tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
      iconColor: '#006CB8',
      variant: 'appIcon',
    },
  },
  {
    prefix: 'yonyou_',
    presentation: {
      logoSrc: yonyouIcon,
      tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
      iconColor: '#E60012',
      variant: 'appIcon',
    },
  },
  {
    prefix: 'sap_',
    presentation: {
      logoSrc: sapLogo,
      tileBackground: '#008FD3',
      iconColor: '#FFFFFF',
      variant: 'onColor',
      logoMonochrome: true,
    },
  },
  {
    prefix: 'oracle_',
    presentation: {
      logoSrc: oracleLogo,
      tileBackground: '#F80000',
      iconColor: '#FFFFFF',
      variant: 'onColor',
      logoMonochrome: true,
    },
  },
  {
    prefix: 'digiwin_',
    presentation: {
      logoSrc: digiwinIcon,
      tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
      iconColor: '#003B8E',
      variant: 'appIcon',
    },
  },
  {
    prefix: 'inspur_',
    presentation: {
      logoSrc: inspurLogo,
      tileBackground: '#005BAC',
      iconColor: '#FFFFFF',
      variant: 'onColor',
      logoContainScale: 0.62,
    },
  },
  {
    prefix: 'sunlike_',
    presentation: {
      logoSrc: sunlikeLogo,
      tileBackground: CONNECTOR_LOGO_ON_LIGHT_TILE,
      iconColor: '#006CB8',
      variant: 'onLight',
      logoContainScale: 0.72,
    },
  },
  {
    prefix: 'huaweicloud_',
    presentation: {
      logoSrc: huaweiLogo,
      tileBackground: '#CF0A2C',
      iconColor: '#FFFFFF',
      variant: 'onColor',
      logoMonochrome: true,
    },
  },
];

export function resolveConnectorBrandPresentation(connectorId: string): ConnectorBrandPresentation | undefined {
  const id = String(connectorId || '').trim();
  if (!id) return undefined;
  if (CONNECTOR_BRAND_BY_ID[id]) return CONNECTOR_BRAND_BY_ID[id];
  for (const row of CONNECTOR_BRAND_BY_PREFIX) {
    if (id.startsWith(row.prefix)) return row.presentation;
  }
  return undefined;
}

function isNeutralIconTileBackground(bg: string | undefined): boolean {
  const normalized = bg?.trim().toLowerCase();
  if (!normalized || normalized === 'transparent') return true;
  return normalized === '#fff' || normalized === '#ffffff' || normalized === CONNECTOR_LOGO_ON_LIGHT_TILE.toLowerCase();
}

/** 市场卡片顶栏色晕：优先品牌底/主题色（白底 icon 容器用 iconColor，避免顶晕不可见） */
export function resolveConnectorMarketCardAccent(connectorId: string): string | undefined {
  const brand = resolveConnectorBrandPresentation(connectorId);
  if (!brand) return undefined;
  const bg = brand.tileBackground?.trim();
  if (bg && !isNeutralIconTileBackground(bg)) return bg;
  return brand.iconColor;
}

/** @deprecated 使用 resolveConnectorBrandPresentation */
export function getConnectorBrandTile(connectorId: string) {
  const p = resolveConnectorBrandPresentation(connectorId);
  if (!p?.logoSrc) return undefined;
  return {
    logoSrc: p.logoSrc,
    tileBackground: p.tileBackground,
    variant: p.variant,
  };
}

export interface AppConnectorBrandIconProps {
  connectorId: string;
  fallbackIcon?: React.ReactNode;
  size?: number;
}

/** 市场卡片与列表：圆角方形容器（与卡片风格一致） */
export function connectorBrandTileRadius(size: number): number {
  return Math.max(8, Math.round(size * 0.22));
}

export function AppConnectorBrandIcon({
  connectorId,
  fallbackIcon,
  size = 44,
}: AppConnectorBrandIconProps) {
  const brand = resolveConnectorBrandPresentation(connectorId);
  const tileRadius = connectorBrandTileRadius(size);
  const nativeAppIconFill = brand ? usesNativeAppIconFill(brand) : false;
  const logoScale = nativeAppIconFill
    ? brand?.logoContainScale ?? 1
    : brand?.variant === 'appIcon'
      ? brand.logoContainScale ?? CONNECTOR_APP_ICON_CONTAIN_SCALE
      : brand?.logoContainScale ?? (brand?.variant === 'onLight' ? 0.68 : brand?.logoSrc ? 0.58 : 0.5);
  const logoSize = nativeAppIconFill ? size : Math.round(size * logoScale);
  const wideLogoRatio =
    brand?.variant === 'onLight' && brand.logoAspectRatio && brand.logoAspectRatio > 1
      ? brand.logoAspectRatio
      : undefined;
  const wideLogoWidth = wideLogoRatio
    ? Math.round((size - 6) * (brand?.logoContainScale ?? 0.68))
    : logoSize;
  const wideLogoHeight = wideLogoRatio
    ? Math.max(12, Math.round(wideLogoWidth / wideLogoRatio))
    : logoSize;

  if (brand?.logoSrc) {
    const onLight = brand.variant === 'onLight';
    const appIcon = brand.variant === 'appIcon';
    const tileBackground = resolveBrandTileBackground(brand);
    const tileBorder = resolveBrandTileBorder(brand);
    const useWhiteMonochromeLogo = !appIcon && !onLight && brand.logoMonochrome === true;
    return (
      <span
        className={`app-connector-brand-icon app-connector-brand-icon--logo${
          onLight || (appIcon && tileBackground === CONNECTOR_LOGO_ON_LIGHT_TILE)
            ? ' app-connector-brand-icon--on-light'
            : ''
        }${appIcon ? ' app-connector-brand-icon--app-icon' : ''}${
          nativeAppIconFill ? ' app-connector-brand-icon--app-icon-native' : ''
        }${useWhiteMonochromeLogo ? ' app-connector-brand-icon--mono-on-color' : ''
        }`}
        style={{
          width: size,
          height: size,
          borderRadius: tileRadius,
          background: tileBackground,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: nativeAppIconFill ? 'hidden' : 'visible',
          boxShadow: CONNECTOR_BRAND_ICON_TILE_SHADOW,
          ...(tileBorder ? { border: tileBorder } : undefined),
        }}
      >
        <img
          src={brand.logoSrc}
          alt=""
          width={wideLogoRatio ? wideLogoWidth : logoSize}
          height={wideLogoRatio ? wideLogoHeight : logoSize}
          style={{
            display: 'block',
            objectFit: nativeAppIconFill ? 'cover' : 'contain',
            ...(nativeAppIconFill ? { borderRadius: tileRadius } : undefined),
            ...(nativeAppIconFill
              ? { filter: `drop-shadow(0 2px 6px rgba(15, 23, 42, 0.1))` }
              : undefined),
            ...(useWhiteMonochromeLogo ? { filter: MONOCHROME_LOGO_ON_COLOR_FILTER } : undefined),
          }}
        />
      </span>
    );
  }

  if (brand) {
    const themeTileBackground = resolveBrandTileBackground(brand);
    const themeTileBorder = resolveBrandTileBorder(brand);
    return (
      <span
        className="app-connector-brand-icon app-connector-brand-icon--theme"
        style={{
          width: size,
          height: size,
          borderRadius: tileRadius,
          background: themeTileBackground,
          color: brand.iconColor,
          ...(themeTileBorder ? { border: themeTileBorder } : undefined),
          boxShadow: CONNECTOR_BRAND_ICON_TILE_SHADOW,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: Math.round(size * 0.5),
          lineHeight: 1,
        }}
      >
        {fallbackIcon}
      </span>
    );
  }

  return (
    <span
      className="app-connector-brand-icon app-connector-brand-icon--fallback"
      style={{
        width: size,
        height: size,
        borderRadius: tileRadius,
        background: CONNECTOR_LOGO_ON_LIGHT_TILE,
        border: CONNECTOR_LOGO_TILE_BORDER,
        boxShadow: CONNECTOR_BRAND_ICON_TILE_SHADOW,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: Math.round(size * 0.5),
        lineHeight: 1,
      }}
    >
      {fallbackIcon}
    </span>
  );
}
