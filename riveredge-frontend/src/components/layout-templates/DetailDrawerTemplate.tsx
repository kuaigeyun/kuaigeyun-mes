/**
 * 详情 Drawer：优先使用结构化插槽（basic / collaboration / lines / timeline）。
 * 未使用插槽时兼容原有 columns + dataSource、customContent / plainBody、children。
 */

import type { CSSProperties } from 'react';
import React, { useMemo } from 'react';
import { Drawer, Descriptions, Spin, theme } from 'antd';
import type { DrawerProps } from 'antd';
import type { ReactNode } from 'react';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { DRAWER_CONFIG } from './constants';
import { getDrawerFloatingWrapperStyle } from './drawerFloatingChrome';
import { DetailDrawerSection } from './DetailDrawerSection';
import { DetailDrawerLinesScroll } from './DetailDrawerLinesScroll';
import {
  DetailDrawerInlineFullChain,
  type TraceBriefDocument,
} from './DetailDrawerInlineFullChain';
import { detailDrawerDescriptionItems } from './detailDrawerDescriptionItems';
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
  collaborationVisible?: boolean;

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
   * 协作区内嵌全链路（替代抽屉外左侧浮层）。
   * 与 collaborationRelations 同时传入时，全链路叠在 relations 之后。
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
  collaborationVisible,
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

  const isOpen = open ?? visible ?? false;

  const hasBasicContent = basic != null && basic !== false;
  const showBasic = basicVisible !== false && (basicVisible === true || hasBasicContent);

  const inlineFullChain = useMemo(() => {
    if (!traceDocument?.documentId) return null;
    return (
      <DetailDrawerInlineFullChain
        documentType={traceDocument.documentType}
        documentId={traceDocument.documentId}
        active={isOpen}
        selfDocumentId={traceDocument.selfDocumentId}
        height={traceDocument.height}
        renderBriefActions={traceDocument.renderBriefActions}
      />
    );
  }, [isOpen, traceDocument]);

  const stackedCollaboration = useMemo(() => {
    const base =
      collaboration ??
      stackCollaborationParts(collaborationMetrics, collaborationLifecycle, collaborationRelations);
    if (inlineFullChain == null || inlineFullChain === false) return base;
    return stackCollaborationParts(base, inlineFullChain);
  }, [
    collaboration,
    collaborationMetrics,
    collaborationLifecycle,
    collaborationRelations,
    inlineFullChain,
  ]);
  const hasCollaborationContent =
    (stackedCollaboration != null && stackedCollaboration !== false) ||
    (inlineFullChain != null && inlineFullChain !== false);
  const showCollaboration =
    collaborationVisible !== false &&
    (collaborationVisible === true || hasCollaborationContent);

  const hasLinesContent = lines != null && lines !== false;
  const showLines = linesVisible !== false && (linesVisible === true || hasLinesContent);

  const hasTimelineContent = timeline != null && timeline !== false;
  const showTimeline =
    timelineVisible !== false && (timelineVisible === true || hasTimelineContent);

  const usesStructuredSections =
    showBasic ||
    showCollaboration ||
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
        <DetailDrawerSection title={collaborationSectionTitle}>{stackedCollaboration}</DetailDrawerSection>
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

  const drawerBody = usesStructuredSections ? sectionedBody : legacyBody;
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
