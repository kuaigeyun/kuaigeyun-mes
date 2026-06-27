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

/** 详情协作区「审核状态」行（与 UniLifecycleStepper 分离展示） */
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
  record: AuditPhaseRecord | null | undefined;
  /** @deprecated */
  auditEnabled?: boolean;
  children: React.ReactNode;
}

/** 详情协作区：审核状态 + 生命周期 Stepper（审核与业务主轴分离） */
export function DetailLifecycleCollaborationBlock({
  record,
  children,
}: DetailLifecycleCollaborationBlockProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DetailAuditPhaseRow record={record} />
      {children}
    </div>
  );
}
