/**
 * 详情 Drawer：优先使用结构化插槽（basic / collaboration / supplementary / lines / timeline）。
 * 未使用插槽时兼容原有 columns + dataSource、customContent / plainBody、children。
 *
 * 传入 traceDocument 时：全链路（含节点简易明细）独立为「全链路跟踪」Tab，
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

const DETAIL_TAB_KEY = 'detail';
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
}: DetailDrawerTemplateProps<T>) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
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
  const hasTraceDocument = Boolean(traceDocument?.documentId);

  const [activeTab, setActiveTab] = useState<string>(DETAIL_TAB_KEY);
  /** 仅在用户首次切到全链路 Tab 后挂载，避免抽屉打开即拉图 */
  const [fullChainMounted, setFullChainMounted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab(DETAIL_TAB_KEY);
      setFullChainMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveTab(DETAIL_TAB_KEY);
    setFullChainMounted(false);
  }, [traceDocument?.documentType, traceDocument?.documentId]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
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
    timelineVisible !== false && (timelineVisible === true || hasTimelineContent);

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
        <DetailDrawerSection title={resolvedBasicTitle}>{basic}</DetailDrawerSection>
      ) : null}
      {showCollaboration ? (
        <DetailDrawerSection
          title={collaborationSectionTitle}
          titleExtra={resolvedCollaborationTitleExtra}
        >
          {stackedCollaboration}
        </DetailDrawerSection>
      ) : null}
      {showSupplementary ? (
        <DetailDrawerSection title={supplementaryTitle}>{supplementary}</DetailDrawerSection>
      ) : null}
      {showLines ? (
        <DetailDrawerSection title={resolvedLinesTitle}>
          <DetailDrawerLinesScroll>{lines}</DetailDrawerLinesScroll>
        </DetailDrawerSection>
      ) : null}
      {showTimeline ? (
        <DetailDrawerSection title={resolvedTimelineTitle}>{timeline}</DetailDrawerSection>
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
      />
    ) : null;

  const drawerBody = hasTraceDocument ? (
    <Tabs
      activeKey={activeTab}
      onChange={handleTabChange}
      size="small"
      style={{ marginTop: -4 }}
      items={[
        {
          key: DETAIL_TAB_KEY,
          label: t('app.uniDetail.tabDetail'),
          children: detailBody,
        },
        {
          key: FULL_CHAIN_TAB_KEY,
          label: t('app.uniDetail.sectionFullChain'),
          children: fullChainPane ?? (
            <div style={{ minHeight: 120 }} />
          ),
        },
      ]}
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
