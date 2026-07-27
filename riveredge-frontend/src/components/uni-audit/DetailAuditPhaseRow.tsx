import React from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { AuditPhaseBadge, type AuditPhaseRecord } from './AuditPhaseBadge';

export interface DetailAuditPhaseRowProps {
  record: AuditPhaseRecord | null | undefined;
  /** @deprecated 审核关闭=自动通过，详情区始终展示审核状态 */
  auditEnabled?: boolean;
  label?: string;
}

/** 详情协作区标题行右侧：审核状态 + 徽章 */
export function DetailAuditPhaseTitleExtra({
  record,
  label,
}: DetailAuditPhaseRowProps) {
  const { t } = useTranslation();

  if (!record?.audit) return null;

  const title = label ?? t('components.uniAudit.colAuditStatus', { defaultValue: '审核状态' });

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {title}
      </Typography.Text>
      <AuditPhaseBadge record={record} variant="column" />
    </div>
  );
}

/** @deprecated 请改用 DetailDrawerTemplate.collaborationAuditRecord / DetailDrawerSection.titleExtra */
export function DetailAuditPhaseRow({
  record,
  label,
}: DetailAuditPhaseRowProps) {
  const { t } = useTranslation();

  const title = label ?? t('components.uniAudit.colAuditStatus', { defaultValue: '审核状态' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Typography.Text type="secondary" style={{ flexShrink: 0 }}>
        {title}
      </Typography.Text>
      <AuditPhaseBadge record={record} variant="column" />
    </div>
  );
}

export interface DetailLifecycleCollaborationBlockProps {
  record?: AuditPhaseRecord | null | undefined;
  /** @deprecated */
  auditEnabled?: boolean;
  children: React.ReactNode;
}

/** @deprecated 审核状态已移至生命周期区块标题右侧；此组件仅保留 children 包裹 */
export function DetailLifecycleCollaborationBlock({
  children,
}: DetailLifecycleCollaborationBlockProps) {
  return <>{children}</>;
}
