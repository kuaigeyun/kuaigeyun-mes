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
    finance_pending: { text: t('app.kuaioa.asset.statusFinancePending'), status: 'Warning' as const },
    written_off: { text: t('app.kuaioa.asset.statusWrittenOff'), status: 'Success' as const },
    scrapped: { text: t('app.kuaioa.asset.statusScrapped'), status: 'Error' as const },
  };
}

/** 员工档案在职/离职 */
export function buildOaEmployeeStatusEnum(t: TFunction) {
  return {
    active: { text: t('app.kuaioa.employee.status.active'), status: 'Success' as const },
    left: { text: t('app.kuaioa.employee.status.left'), status: 'Default' as const },
  };
}

export function buildLicenseTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaioa.license.type.vehicle_group_insurance'), value: 'vehicle_group_insurance' },
    { label: t('app.kuaioa.license.type.vehicle_annual_inspection'), value: 'vehicle_annual_inspection' },
    { label: t('app.kuaioa.license.type.system_external_audit'), value: 'system_external_audit' },
    { label: t('app.kuaioa.license.type.urban_drainage_permit'), value: 'urban_drainage_permit' },
    { label: t('app.kuaioa.license.type.year_end_rebate'), value: 'year_end_rebate' },
    { label: t('app.kuaioa.license.type.hygiene_permit'), value: 'hygiene_permit' },
    { label: t('app.kuaioa.license.type.waste_clearance_agreement'), value: 'waste_clearance_agreement' },
    { label: t('app.kuaioa.license.type.pollution_discharge_receipt'), value: 'pollution_discharge_receipt' },
    { label: t('app.kuaioa.license.type.trademark_registration'), value: 'trademark_registration' },
    { label: t('app.kuaioa.license.type.foreign_investment_approval'), value: 'foreign_investment_approval' },
    { label: t('app.kuaioa.license.type.metrology'), value: 'metrology' },
    { label: t('app.kuaioa.license.type.canteen_agreement'), value: 'canteen_agreement' },
    { label: t('app.kuaioa.license.type.business_license_annual'), value: 'business_license_annual' },
    { label: t('app.kuaioa.license.type.sewage_treatment'), value: 'sewage_treatment' },
    { label: t('app.kuaioa.license.type.greening'), value: 'greening' },
  ];
}

export function buildLicenseNotifyChannelOptions(t: TFunction) {
  return [
    { label: t('app.kuaioa.license.channel.internal'), value: 'internal' },
    { label: t('app.kuaioa.license.channel.email'), value: 'email' },
    { label: t('app.kuaioa.license.channel.sms'), value: 'sms' },
  ];
}

export function buildAssetPurchaseStageOptions(t: TFunction) {
  return [
    { label: t('app.kuaioa.asset.stage.procuring'), value: 'procuring' },
    { label: t('app.kuaioa.asset.stage.paid'), value: 'paid' },
    { label: t('app.kuaioa.asset.stage.inbound'), value: 'inbound' },
    { label: t('app.kuaioa.asset.stage.issued'), value: 'issued' },
    { label: t('app.kuaioa.asset.stage.carded'), value: 'carded' },
    { label: t('app.kuaioa.asset.stage.finance_audited'), value: 'finance_audited' },
    { label: t('app.kuaioa.asset.stage.written_off'), value: 'written_off' },
  ];
}

export function buildLeaveTypeOptions(t: TFunction) {
  return [
    { label: t('app.kuaioa.leave.type.personal'), value: 'personal' },
    { label: t('app.kuaioa.leave.type.sick'), value: 'sick' },
    { label: t('app.kuaioa.leave.type.wedding'), value: 'wedding' },
    { label: t('app.kuaioa.leave.type.funeral'), value: 'funeral' },
    { label: t('app.kuaioa.leave.type.maternity'), value: 'maternity' },
    { label: t('app.kuaioa.leave.type.paternity'), value: 'paternity' },
    { label: t('app.kuaioa.leave.type.annual'), value: 'annual' },
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
