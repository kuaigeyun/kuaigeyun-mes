import type { TFunction } from 'i18next';

/** 审批流程状态（草稿/待审批/已通过/已驳回/已撤销） */
export function buildOaApprovalStatusEnum(t: TFunction) {
  return {
    draft: { text: t('app.kuaioa.status.draft'), status: 'Default' as const },
    pending: { text: t('app.kuaioa.status.pending'), status: 'Processing' as const },
    approved: { text: t('app.kuaioa.status.approved'), status: 'Success' as const },
    rejected: { text: t('app.kuaioa.status.rejected'), status: 'Error' as const },
    cancelled: { text: t('app.kuaioa.status.cancelled'), status: 'Warning' as const },
  };
}

export function buildOaAnnouncementStatusEnum(t: TFunction) {
  return {
    draft: { text: t('app.kuaioa.status.draft'), status: 'Default' as const },
    published: { text: t('app.kuaioa.announcement.statusPublished'), status: 'Success' as const },
  };
}

export function buildOaAssetStatusEnum(t: TFunction) {
  return {
    in_stock: { text: t('app.kuaioa.asset.statusInStock'), status: 'Default' as const },
    in_use: { text: t('app.kuaioa.asset.statusInUse'), status: 'Processing' as const },
    scrapped: { text: t('app.kuaioa.asset.statusScrapped'), status: 'Error' as const },
  };
}

export function buildLeaveTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaioa.leave.type.annual'), value: 'annual' },
    { label: t('app.kuaioa.leave.type.sick'), value: 'sick' },
    { label: t('app.kuaioa.leave.type.personal'), value: 'personal' },
    { label: t('app.kuaioa.leave.type.business_trip'), value: 'business_trip' },
  ];
}

export function buildSealTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaioa.seal.type.official'), value: 'official' },
    { label: t('app.kuaioa.seal.type.contract'), value: 'contract' },
    { label: t('app.kuaioa.seal.type.finance'), value: 'finance' },
  ];
}

export function buildTrainingPlanTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaioa.trainingPlan.type.onboarding'), value: 'onboarding' },
    { label: t('app.kuaioa.trainingPlan.type.preJob'), value: 'pre_job' },
    { label: t('app.kuaioa.trainingPlan.type.special'), value: 'special' },
  ];
}
