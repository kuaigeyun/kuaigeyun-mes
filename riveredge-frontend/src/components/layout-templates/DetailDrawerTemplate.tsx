/**
 * 详情 Drawer：优先使用结构化插槽（basic / collaboration / lines / timeline）。
 * 未使用插槽时兼容原有 columns + dataSource、customContent / plainBody、children。
 */

import type { CSSProperties } from 'react';
import React, { useMemo } from 'react';
import { Drawer, Descriptions, theme } from 'antd';
import type { DrawerProps } from 'antd';
import type { ReactNode } from 'react';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { DRAWER_CONFIG } from './constants';
import { getDrawerFloatingWrapperStyle } from './drawerFloatingChrome';
import { DetailDrawerSection } from './DetailDrawerSection';
import { detailDrawerDescriptionItems } from './detailDrawerDescriptionItems';

export interface DetailDrawerTemplateProps<T = Record<string, unknown>> {
  title: ReactNode;
  open?: boolean;
  visible?: boolean;
  onClose: () => void;
  width?: number | string;
  size?: number | string;
  loading?: boolean;
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
  dataSource?: T;
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
}

function stackCollaborationParts(
  metrics?: ReactNode,
  lifecycle?: ReactNode,
  relations?: ReactNode
): ReactNode {
  const parts = [metrics, lifecycle, relations].filter((p) => p != null && p !== false);
  if (parts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {parts.map((node, index) => (
        <React.Fragment key={index}>{node}</React.Fragment>
      ))}
    </div>
  );
}

export const DetailDrawerTemplate = <T extends Record<string, unknown> = Record<string, unknown>,>({
  title,
  open,
  visible,
  onClose,
  width = DRAWER_CONFIG.HALF_WIDTH,
  size,
  loading = false,
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
  column = 2,
  customContent,
  children,
  placement,
  disableFloatingChrome = false,
}: DetailDrawerTemplateProps<T>) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const drawerSize = size ?? width;
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

  const hasBasicContent = basic != null && basic !== false;
  const showBasic = basicVisible !== false && (basicVisible === true || hasBasicContent);

  const stackedCollaboration = useMemo(
    () =>
      collaboration ??
      stackCollaborationParts(collaborationMetrics, collaborationLifecycle, collaborationRelations),
    [collaboration, collaborationMetrics, collaborationLifecycle, collaborationRelations]
  );
  const hasCollaborationContent = stackedCollaboration != null && stackedCollaboration !== false;
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
        <DetailDrawerSection title={resolvedLinesTitle}>{lines}</DetailDrawerSection>
      ) : null}
      {showTimeline ? (
        <DetailDrawerSection title={resolvedTimelineTitle}>{timeline}</DetailDrawerSection>
      ) : null}
    </>
  );

  const drawerBody = usesStructuredSections ? sectionedBody : legacyBody;

  return (
    <Drawer
      title={title}
      open={open ?? visible}
      onClose={onClose}
      placement={resolvedPlacement}
      size={
        drawerSize === 'default' || drawerSize === 'large'
          ? (drawerSize as 'default' | 'large')
          : undefined
      }
      styles={{
        ...styles,
        wrapper: {
          ...drawerFloatingWrapperStyle,
          ...(typeof drawerSize === 'number' ||
          (typeof drawerSize === 'string' && !['default', 'large'].includes(drawerSize))
            ? { width: drawerSize }
            : {}),
          ...styles?.wrapper,
        },
      }}
      loading={loading}
      className={className}
      extra={extra}
      zIndex={zIndex}
    >
      {banner}
      {drawerBody}
    </Drawer>
  );
};

export default DetailDrawerTemplate;
