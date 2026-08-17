/**
 * 详情 Drawer：优先使用结构化插槽（basic / collaboration / supplementary / lines / timeline）。
 * 未使用插槽时兼容原有 columns + dataSource、customContent / plainBody、children。
 *
 * 传入 traceDocument / historyTab 时：全链路、重算/下推历史独立为 Tab，
 * 默认不挂载；用户切到该 Tab 后才开始加载，以加快抽屉首屏。
 */

import type { CSSProperties } from 'react';
import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, Descriptions, Spin, Tabs, theme } from 'antd';
import type { DrawerProps } from 'antd';
import type { ReactNode } from 'react';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { DRAWER_CONFIG } from './constants';
import { getDrawerFloatingWrapperStyle } from './drawerFloatingChrome';
import { DetailDrawerSection } from './DetailDrawerSection';
import { DetailDrawerLinesScroll } from './DetailDrawerLinesScroll';
import { DetailDrawerInlineFullChain,
  type TraceBriefDocument,
} from './DetailDrawerInlineFullChain';
import { detailDrawerDescriptionItems } from './detailDrawerDescriptionItems';
import { DetailAuditPhaseTitleExtra } from '../uni-audit/DetailAuditPhaseRow';
import type { AuditPhaseRecord } from '../uni-audit/AuditPhaseBadge';
import { useDetailDrawerFeatures } from '../../hooks/useDetailDrawerFeatures';
import './drawerSlideMotion.css';

export interface DetailDrawerTemplateProps<T extends Record<string, any> = Record<string, unknown>> {
  title: ReactNode;
  open?: boolean;
  visible?: boolean;
  onClose: () => void;
  width?: number | string;
  size?: number | string;
  /**
   * 为 true 时在正文上方叠加载层（仍渲染 basic / children），便于滑入动画期间展示列表快照并并行拉详情。
   * 不使用 Drawer 内置 Skeleton，避免整块替换导致无法乐观展示。
   */
  loading?: boolean;
  /** Ant Design Drawer 底栏（固定在抽屉底部，适合放主操作如下推） */
  footer?: ReactNode;
  extra?: ReactNode;
  className?: string;
  styles?: Partial<
    Record<
      'root' | 'mask' | 'header' | 'title' | 'extra' | 'section' | 'body' | 'footer' | 'wrapper' | 'dragger' | 'close',
      CSSProperties
    >
  >;
  zIndex?: number;

  banner?: ReactNode;

  /** 无分区整块正文（不参与结构化插槽） */
  plainBody?: ReactNode;

  basic?: ReactNode;
  basicTitle?: ReactNode;
  basicVisible?: boolean;
  /**
   * 基本信息右侧附加栏（二维码等）。与 Descriptions 并排，形成末栏。
   * 请勿再在 basic 内绝对定位或把二维码堆在字段下方。
   */
  basicExtra?: ReactNode;

  collaboration?: ReactNode;
  collaborationMetrics?: ReactNode;
  collaborationLifecycle?: ReactNode;
  collaborationRelations?: ReactNode;
  collaborationTitle?: ReactNode;
  /** 显示在协作/生命周期区块标题同一行的附加说明（如「下一步：…」） */
  collaborationTitleSuffix?: ReactNode;
  /** 显示在协作/生命周期区块标题行右侧（如审核状态；未传时可由 collaborationAuditRecord 自动生成） */
  collaborationTitleExtra?: ReactNode;
  /** 协作区审核态数据源；有 audit 时在标题右侧展示审核状态 */
  collaborationAuditRecord?: AuditPhaseRecord | null;
  collaborationVisible?: boolean;

  /** 生命周期与明细之间的附加区块（如询价单受邀供应商） */
  supplementary?: ReactNode;
  supplementaryTitle?: ReactNode;
  supplementaryVisible?: boolean;

  lines?: ReactNode;
  linesTitle?: ReactNode;
  linesVisible?: boolean;

  timeline?: ReactNode;
  timelineTitle?: ReactNode;
  timelineVisible?: boolean;

  /** 兼容：仅标题区 + Descriptions（请逐步改为 basic + detailDrawerDescriptionItems） */
  dataSource?: T | null;
  columns?: ProDescriptionsItemProps<T>[];
  column?: number;

  /** @deprecated 请改用 plainBody */
  customContent?: ReactNode;

  /** 兼容：任意自定义片段（请逐步改为插槽） */
  children?: ReactNode;

  /** 抽屉停靠侧（默认 right）；影响悬浮外边距施加在哪一侧 */
  placement?: DrawerProps['placement'];
  /** 为 true 时不施加悬浮外边距与圆角（仅占满贴边抽屉） */
  disableFloatingChrome?: boolean;
  /** 打开/关闭动画结束后回调（与 Ant Design Drawer 一致） */
  afterOpenChange?: DrawerProps['afterOpenChange'];

  /**
   * 全链路跟踪（含节点简易明细）：独立 Tab，默认不加载，切到该 Tab 后才挂载。
   * 请勿再在 collaborationLifecycle 内嵌 DetailDrawerInlineFullChain。
   */
  traceDocument?: {
    documentType: string;
    documentId: number;
    selfDocumentId?: number;
    height?: number;
    renderBriefActions?: (doc: TraceBriefDocument) => ReactNode;
  } | null;

  /**
   * 重算 / 下推历史：独立 Tab，默认不加载，切到该 Tab 后才挂载。
   * 请勿再塞进 supplementary 或详情区内嵌 Tabs。
   */
  historyTab?: {
    label?: ReactNode;
    children: ReactNode;
    /** 换单时重置 Tab 与懒挂载（与 traceDocument.documentId 同职责） */
    documentId?: number;
  } | null;
}

function stackCollaborationParts(...nodes: (ReactNode | undefined)[]): ReactNode {
  const parts = nodes.filter((p) => p != null && p !== false);
  if (parts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {parts.map((node, index) => (
        <React.Fragment key={index}>{node}</React.Fragment>
      ))}
    </div>
  );
}

function withBasicSideExtra(basic: ReactNode, extra: ReactNode | undefined): ReactNode {
  if (extra == null || extra === false) return basic;
  const width = DRAWER_CONFIG.BASIC_SIDE_EXTRA_WIDTH;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>{basic}</div>
      <div
        style={{
          flex: `0 0 ${width}px`,
          width,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {extra}
      </div>
    </div>
  );
}

const DETAIL_TAB_KEY = 'detail';
const HISTORY_TAB_KEY = 'history';
const FULL_CHAIN_TAB_KEY = 'fullChain';

export const DetailDrawerTemplate = <T extends Record<string, any> = Record<string, unknown>,>({
  title,
  open,
  visible,
  onClose,
  width = DRAWER_CONFIG.HALF_WIDTH,
  size,
  loading = false,
  footer,
  extra,
  className,
  styles,
  zIndex,
  banner,
  plainBody,
  basic,
  basicTitle,
  basicVisible,
  basicExtra,
  collaboration,
  collaborationMetrics,
  collaborationLifecycle,
  collaborationRelations,
  collaborationTitle,
  collaborationTitleSuffix,
  collaborationTitleExtra,
  collaborationAuditRecord,
  collaborationVisible,
  supplementary,
  supplementaryTitle,
  supplementaryVisible,
  lines,
  linesTitle,
  linesVisible,
  timeline,
  timelineTitle,
  timelineVisible,
  dataSource,
  columns = [],
  column = 3,
  customContent,
  children,
  placement,
  disableFloatingChrome = false,
  afterOpenChange,
  traceDocument,
  historyTab,
}: DetailDrawerTemplateProps<T>) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { fullChainEnabled, fullChainShowCreatedAt, operationLogEnabled } = useDetailDrawerFeatures();
  const drawerSize = size ?? width;
  const isPresetDrawerSize = drawerSize === 'default' || drawerSize === 'large';
  const isNumericDrawerSize = typeof drawerSize === 'number';
  const resolvedPlacement = placement ?? 'right';

  const drawerFloatingWrapperStyle = useMemo(
    (): CSSProperties =>
      getDrawerFloatingWrapperStyle(resolvedPlacement, token, { disabled: disableFloatingChrome }),
    [disableFloatingChrome, resolvedPlacement, token.borderRadiusLG, token.boxShadowSecondary]
  );

  const resolvedBasicTitle = basicTitle ?? t('app.uniDetail.sectionBasic');
  const resolvedCollaborationTitle = collaborationTitle ?? t('app.uniDetail.sectionCollaboration');
  const collaborationSectionTitle =
    collaborationTitleSuffix != null ? (
      <span
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 8,
          rowGap: 4,
        }}
      >
        <span>{resolvedCollaborationTitle}</span>
        {collaborationTitleSuffix}
      </span>
    ) : (
      resolvedCollaborationTitle
    );
  const resolvedLinesTitle = linesTitle ?? t('app.uniDetail.sectionLines');
  const resolvedTimelineTitle = timelineTitle ?? t('app.uniDetail.sectionTimeline');

  const resolvedCollaborationTitleExtra = useMemo(() => {
    if (collaborationTitleExtra != null) return collaborationTitleExtra;
    if (collaborationAuditRecord?.audit) {
      return <DetailAuditPhaseTitleExtra record={collaborationAuditRecord} />;
    }
    return undefined;
  }, [collaborationAuditRecord, collaborationTitleExtra]);

  const isOpen = open ?? visible ?? false;
  const hasTraceDocument = fullChainEnabled && Boolean(traceDocument?.documentId);
  const hasHistoryTab = historyTab != null && historyTab.children != null && historyTab.children !== false;

  const [activeTab, setActiveTab] = useState<string>(DETAIL_TAB_KEY);
  /** 仅在用户首次切到对应 Tab 后挂载，避免抽屉打开即拉历史/全链路 */
  const [historyMounted, setHistoryMounted] = useState(false);
  const [fullChainMounted, setFullChainMounted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab(DETAIL_TAB_KEY);
      setHistoryMounted(false);
      setFullChainMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveTab(DETAIL_TAB_KEY);
    setHistoryMounted(false);
    setFullChainMounted(false);
  }, [traceDocument?.documentType, traceDocument?.documentId, historyTab?.documentId]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === HISTORY_TAB_KEY) {
      setHistoryMounted(true);
    }
    if (key === FULL_CHAIN_TAB_KEY) {
      setFullChainMounted(true);
    }
  };

  const hasBasicContent = basic != null && basic !== false;
  const showBasic = basicVisible !== false && (basicVisible === true || hasBasicContent);

  const stackedCollaboration = useMemo(
    () =>
      collaboration ??
      stackCollaborationParts(collaborationMetrics, collaborationLifecycle, collaborationRelations),
    [collaboration, collaborationMetrics, collaborationLifecycle, collaborationRelations],
  );
  const hasCollaborationContent = stackedCollaboration != null && stackedCollaboration !== false;
  const showCollaboration =
    collaborationVisible !== false &&
    (collaborationVisible === true || hasCollaborationContent);

  const hasSupplementaryContent = supplementary != null && supplementary !== false;
  const showSupplementary =
    supplementaryVisible !== false &&
    (supplementaryVisible === true || hasSupplementaryContent);

  const hasLinesContent = lines != null && lines !== false;
  const showLines = linesVisible !== false && (linesVisible === true || hasLinesContent);

  const hasTimelineContent = timeline != null && timeline !== false;
  const showTimeline =
    operationLogEnabled &&
    timelineVisible !== false &&
    (timelineVisible === true || hasTimelineContent);

  const usesStructuredSections =
    showBasic ||
    showCollaboration ||
    showSupplementary ||
    showLines ||
    showTimeline;

  const hasLegacyColumns = Array.isArray(columns) && columns.length > 0;

  const legacyDescriptions =
    hasLegacyColumns ? (
      <Descriptions
        column={column}
        size="small"
        items={detailDrawerDescriptionItems(columns, dataSource ?? undefined)}
      />
    ) : null;

  const overlay = plainBody ?? customContent;
  const legacyBody = (
    <>
      {overlay ?? legacyDescriptions}
      {children}
    </>
  );

  const sectionedBody = (
    <>
      {showBasic ? (
        <DetailDrawerSection titleAccent title={resolvedBasicTitle}>
          {withBasicSideExtra(basic, basicExtra)}
        </DetailDrawerSection>
      ) : null}
      {showCollaboration ? (
        <DetailDrawerSection
          titleAccent
          title={collaborationSectionTitle}
          titleExtra={resolvedCollaborationTitleExtra}
        >
          {stackedCollaboration}
        </DetailDrawerSection>
      ) : null}
      {showSupplementary ? (
        <DetailDrawerSection titleAccent title={supplementaryTitle}>
          {supplementary}
        </DetailDrawerSection>
      ) : null}
      {showLines ? (
        <DetailDrawerSection titleAccent title={resolvedLinesTitle}>
          <DetailDrawerLinesScroll>{lines}</DetailDrawerLinesScroll>
        </DetailDrawerSection>
      ) : null}
      {showTimeline ? (
        <DetailDrawerSection titleAccent title={resolvedTimelineTitle}>
          {timeline}
        </DetailDrawerSection>
      ) : null}
      {/* 兼容：已使用分区插槽但仍传入 plainBody/customContent/children 时，叠在分区之后 */}
      {plainBody ?? customContent}
      {children}
    </>
  );

  const detailBody = usesStructuredSections ? sectionedBody : legacyBody;

  const fullChainPane =
    hasTraceDocument && fullChainMounted && traceDocument ? (
      <DetailDrawerInlineFullChain
        documentType={traceDocument.documentType}
        documentId={traceDocument.documentId}
        active={isOpen && activeTab === FULL_CHAIN_TAB_KEY}
        selfDocumentId={traceDocument.selfDocumentId}
        height={traceDocument.height}
        renderBriefActions={traceDocument.renderBriefActions}
        showCreatedAt={fullChainShowCreatedAt}
      />
    ) : null;

  const showTabs = hasTraceDocument || hasHistoryTab;
  const tabItems = [
    {
      key: DETAIL_TAB_KEY,
      label: t('app.uniDetail.tabDetail'),
      children: detailBody,
    },
    ...(hasHistoryTab && historyTab
      ? [
          {
            key: HISTORY_TAB_KEY,
            label: historyTab.label ?? t('app.uniDetail.tabHistory'),
            children: historyMounted ? historyTab.children : <div style={{ minHeight: 120 }} />,
          },
        ]
      : []),
    ...(hasTraceDocument
      ? [
          {
            key: FULL_CHAIN_TAB_KEY,
            label: t('app.uniDetail.sectionFullChain'),
            children: fullChainPane ?? <div style={{ minHeight: 120 }} />,
          },
        ]
      : []),
  ];

  const drawerBody = showTabs ? (
    <Tabs
      activeKey={activeTab}
      onChange={handleTabChange}
      size="small"
      style={{ marginTop: -4 }}
      items={tabItems}
    />
  ) : (
    detailBody
  );
  const showLoadingOverlay = !!loading && isOpen;

  return (
    <Drawer
      title={title}
      open={isOpen}
      onClose={onClose}
      placement={resolvedPlacement}
      rootClassName="drawer-slide-motion"
      destroyOnHidden={false}
      loading={false}
      size={
        isPresetDrawerSize
          ? (drawerSize as 'default' | 'large')
          : isNumericDrawerSize
            ? drawerSize
            : undefined
      }
      styles={{
        ...styles,
        wrapper: {
          ...drawerFloatingWrapperStyle,
          ...(!isPresetDrawerSize && !isNumericDrawerSize && drawerSize
            ? { width: drawerSize }
            : {}),
          ...styles?.wrapper,
        },
      }}
      className={className}
      footer={footer}
      extra={extra}
      zIndex={zIndex}
      afterOpenChange={afterOpenChange}
    >
      {banner ? <div style={{ marginBottom: token.marginMD }}>{banner}</div> : null}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: showLoadingOverlay ? 120 : undefined,
        }}
      >
        {showLoadingOverlay ? (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 3,
                background: token.colorBgContainer,
                opacity: 0.55,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'progress',
              }}
            >
              <Spin />
            </div>
          </>
        ) : null}
        {drawerBody}
      </div>
    </Drawer>
  );
};

export default DetailDrawerTemplate;
