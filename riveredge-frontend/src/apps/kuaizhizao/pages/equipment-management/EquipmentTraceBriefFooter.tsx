/**
 * 设备管理 Uni-detail：关联简览底部「关闭 / 前往列表」按钮组（与各业务单据类型跳转共用）
 */

import React from 'react';
import { Button, Space } from 'antd';
import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { ROUTES } from '../../constants/routes';

export function EquipmentTraceBriefFooter(props: {
  brief: { document_type: string; document_id: number } | null;
  t: TFunction;
  navigate: NavigateFunction;
  closeDrawer: () => void;
  onDismissBrief: () => void;
}): React.ReactNode {
  const { brief, t, navigate, closeDrawer, onDismissBrief } = props;
  if (!brief) return null;
  const go = (path: string) => {
    closeDrawer();
    navigate(path);
  };
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
        {brief.document_type === 'purchase_order' ? (
          <Button type="primary" onClick={() => go(ROUTES.PURCHASE_ORDERS)}>
            {t('components.documentTrackingPanel.traceBriefOpenPurchaseOrder', { defaultValue: '前往采购订单' })}
          </Button>
        ) : null}
        {brief.document_type === 'sales_order' ? (
          <Button type="primary" onClick={() => go(ROUTES.SALES_ORDERS)}>
            {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
          </Button>
        ) : null}
        {brief.document_type === 'demand' ? (
          <Button type="primary" onClick={() => go(ROUTES.DEMAND_MANAGEMENT)}>
            {t('components.documentTrackingPanel.traceBriefOpenDemand', { defaultValue: '前往需求管理' })}
          </Button>
        ) : null}
        {brief.document_type === 'purchase_requisition' ? (
          <Button type="primary" onClick={() => go(ROUTES.PURCHASE_REQUISITIONS)}>
            {t('components.documentTrackingPanel.traceBriefOpenPurchaseRequisition', { defaultValue: '前往采购申请' })}
          </Button>
        ) : null}
        {brief.document_type === 'work_order' ? (
          <Button type="primary" onClick={() => go(ROUTES.WORK_ORDERS)}>
            {t('components.documentTrackingPanel.traceBriefOpenWorkOrder', { defaultValue: '前往工单' })}
          </Button>
        ) : null}
        {brief.document_type === 'maintenance_reminder' ? (
          <Button type="primary" onClick={() => go(ROUTES.MAINTENANCE_REMINDERS)}>
            {t('components.documentTrackingPanel.traceBriefOpenMaintenanceReminder', { defaultValue: '前往维护提醒' })}
          </Button>
        ) : null}
        {brief.document_type === 'equipment' ? (
          <Button type="primary" onClick={() => go(ROUTES.EQUIPMENT)}>
            {t('components.documentTrackingPanel.traceBriefOpenEquipment', { defaultValue: '前往设备台账' })}
          </Button>
        ) : null}
        {brief.document_type === 'equipment_fault' ? (
          <Button type="primary" onClick={() => go(ROUTES.EQUIPMENT_FAULTS)}>
            {t('components.documentTrackingPanel.traceBriefOpenEquipmentFault', { defaultValue: '前往设备故障' })}
          </Button>
        ) : null}
        {brief.document_type === 'maintenance_plan' ? (
          <Button type="primary" onClick={() => go(ROUTES.MAINTENANCE_PLANS)}>
            {t('components.documentTrackingPanel.traceBriefOpenMaintenancePlan', { defaultValue: '前往保养计划' })}
          </Button>
        ) : null}
        {brief.document_type === 'mold' ? (
          <Button type="primary" onClick={() => go(ROUTES.MOLDS)}>
            {t('components.documentTrackingPanel.traceBriefOpenMold', { defaultValue: '前往模具台账' })}
          </Button>
        ) : null}
        {brief.document_type === 'tool' ? (
          <Button type="primary" onClick={() => go(ROUTES.TOOL_LEDGER)}>
            {t('components.documentTrackingPanel.traceBriefOpenTool', { defaultValue: '前往工装台账' })}
          </Button>
        ) : null}
        {brief.document_type === 'incoming_inspection' ? (
          <Button type="primary" onClick={() => go(ROUTES.INCOMING_INSPECTION)}>
            {t('components.documentTrackingPanel.traceBriefOpenIncomingInspection', { defaultValue: '前往来料检验' })}
          </Button>
        ) : null}
        {brief.document_type === 'process_inspection' ? (
          <Button type="primary" onClick={() => go(ROUTES.PROCESS_INSPECTION)}>
            {t('components.documentTrackingPanel.traceBriefOpenProcessInspection', { defaultValue: '前往过程检验' })}
          </Button>
        ) : null}
        {brief.document_type === 'finished_goods_inspection' ? (
          <Button type="primary" onClick={() => go(ROUTES.FINISHED_GOODS_INSPECTION)}>
            {t('components.documentTrackingPanel.traceBriefOpenFinishedGoodsInspection', { defaultValue: '前往成品检验' })}
          </Button>
        ) : null}
      </Space>
    </div>
  );
}
