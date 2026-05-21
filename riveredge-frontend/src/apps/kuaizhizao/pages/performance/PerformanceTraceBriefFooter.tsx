/**
 * 绩效管理 Uni-detail：关联简览底部跳转（对齐仓储/设备常用单据类型，并补充绩效主数据）
 */

import React from 'react';
import { Button, Space } from 'antd';
import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { ROUTES } from '../../constants/routes';

export interface PerformanceTraceBriefDoc {
  document_type: string;
  document_id: number;
}

/** 用于 DetailDrawerTemplate.traceDocument.renderBriefActions（内嵌全链路已含「关闭简览」） */
export function PerformanceTraceBriefPrimaryActions(props: {
  doc: PerformanceTraceBriefDoc;
  t: TFunction;
  navigate: NavigateFunction;
  closeDrawer: () => void;
}): React.ReactNode {
  const { doc: brief, t, navigate, closeDrawer } = props;
  const go = (path: string) => {
    closeDrawer();
    navigate(path);
  };
  return (
    <>
      {brief.document_type === 'performance_skill' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PERF_SKILLS)}>
          {t('components.documentTrackingPanel.traceBriefOpenPerformanceSkill', { defaultValue: '前往技能管理' })}
        </Button>
      ) : null}
      {brief.document_type === 'performance_holiday' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PERF_HOLIDAYS)}>
          {t('components.documentTrackingPanel.traceBriefOpenPerformanceHoliday', { defaultValue: '前往假期管理' })}
        </Button>
      ) : null}
      {brief.document_type === 'performance_summary' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PERF_SUMMARIES)}>
          {t('components.documentTrackingPanel.traceBriefOpenPerformanceSummary', { defaultValue: '前往绩效汇总' })}
        </Button>
      ) : null}
      {brief.document_type === 'reporting_record' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.REPORTING)}>
          {t('components.documentTrackingPanel.traceBriefOpenReporting', { defaultValue: '前往生产报工' })}
        </Button>
      ) : null}
      {brief.document_type === 'purchase_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PURCHASE_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenPurchaseOrder', { defaultValue: '前往采购订单' })}
        </Button>
      ) : null}
      {brief.document_type === 'sales_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.SALES_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'demand' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.DEMAND_MANAGEMENT)}>
          {t('components.documentTrackingPanel.traceBriefOpenDemand', { defaultValue: '前往需求管理' })}
        </Button>
      ) : null}
      {brief.document_type === 'purchase_requisition' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PURCHASE_REQUISITIONS)}>
          {t('components.documentTrackingPanel.traceBriefOpenPurchaseRequisition', { defaultValue: '前往采购申请' })}
        </Button>
      ) : null}
      {brief.document_type === 'work_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WORK_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenWorkOrder', { defaultValue: '前往工单' })}
        </Button>
      ) : null}
      {brief.document_type === 'receipt_notice' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.RECEIPT_NOTICES)}>
          {t('components.documentTrackingPanel.traceBriefOpenReceiptNotice', { defaultValue: '前往收货通知' })}
        </Button>
      ) : null}
      {brief.document_type === 'other_inbound' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_OTHER_INBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenOtherInbound', { defaultValue: '前往其他入库' })}
        </Button>
      ) : null}
      {brief.document_type === 'purchase_receipt' ||
      brief.document_type === 'finished_goods_receipt' ||
      brief.document_type === 'semi_finished_goods_receipt' ||
      brief.document_type === 'production_return' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_INBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenInbound', { defaultValue: '前往入库管理' })}
        </Button>
      ) : null}
      {brief.document_type === 'production_picking' || brief.document_type === 'sales_delivery' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_OUTBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenOutbound', { defaultValue: '前往出库管理' })}
        </Button>
      ) : null}
      {brief.document_type === 'other_outbound' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_OTHER_OUTBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenOtherOutbound', { defaultValue: '前往其他出库' })}
        </Button>
      ) : null}
      {brief.document_type === 'material_borrow' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_MATERIAL_BORROWS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaterialBorrow', { defaultValue: '前往借料管理' })}
        </Button>
      ) : null}
      {brief.document_type === 'material_return' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_MATERIAL_RETURNS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaterialReturn', { defaultValue: '前往还料管理' })}
        </Button>
      ) : null}
      {brief.document_type === 'maintenance_reminder' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MAINTENANCE_REMINDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaintenanceReminder', { defaultValue: '前往维护提醒' })}
        </Button>
      ) : null}
      {brief.document_type === 'equipment' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.EQUIPMENT)}>
          {t('components.documentTrackingPanel.traceBriefOpenEquipment', { defaultValue: '前往设备台账' })}
        </Button>
      ) : null}
      {brief.document_type === 'equipment_fault' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.EQUIPMENT_FAULTS)}>
          {t('components.documentTrackingPanel.traceBriefOpenEquipmentFault', { defaultValue: '前往设备故障' })}
        </Button>
      ) : null}
      {brief.document_type === 'maintenance_plan' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MAINTENANCE_PLANS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaintenancePlan', { defaultValue: '前往保养计划' })}
        </Button>
      ) : null}
      {brief.document_type === 'mold' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MOLDS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMold', { defaultValue: '前往模具台账' })}
        </Button>
      ) : null}
      {brief.document_type === 'tool' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.TOOL_LEDGER)}>
          {t('components.documentTrackingPanel.traceBriefOpenTool', { defaultValue: '前往工装台账' })}
        </Button>
      ) : null}
      {brief.document_type === 'incoming_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.INCOMING_INSPECTION)}>
          {t('components.documentTrackingPanel.traceBriefOpenIncomingInspection', { defaultValue: '前往来料检验' })}
        </Button>
      ) : null}
      {brief.document_type === 'process_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PROCESS_INSPECTION)}>
          {t('components.documentTrackingPanel.traceBriefOpenProcessInspection', { defaultValue: '前往过程检验' })}
        </Button>
      ) : null}
      {brief.document_type === 'finished_goods_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.FINISHED_GOODS_INSPECTION)}>
          {t('components.documentTrackingPanel.traceBriefOpenFinishedGoodsInspection', { defaultValue: '前往成品检验' })}
        </Button>
      ) : null}
    </>
  );
}

export function PerformanceTraceBriefFooter(props: {
  brief: PerformanceTraceBriefDoc | null;
  t: TFunction;
  navigate: NavigateFunction;
  closeDrawer: () => void;
  onDismissBrief: () => void;
}): React.ReactNode {
  const { brief, t, navigate, closeDrawer, onDismissBrief } = props;
  if (!brief) return null;
  return (
    <div
      style={{
        flexShrink: 0,
        marginTop: 8,
        paddingTop: 10,
        borderTop: '1px solid var(--ant-color-border)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <Space wrap>
        <Button onClick={onDismissBrief}>{t('components.documentTrackingPanel.traceBriefDismiss')}</Button>
        <PerformanceTraceBriefPrimaryActions doc={brief} t={t} navigate={navigate} closeDrawer={closeDrawer} />
      </Space>
    </div>
  );
}
