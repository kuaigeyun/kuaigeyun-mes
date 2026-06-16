/**
 * 设备管理 Uni-detail：关联简览底部「关闭 / 前往列表」按钮组（与各业务单据类型跳转共用）
 */

import React from 'react';
import { Button, Space } from 'antd';
import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { ROUTES } from '../../constants/routes';

export interface EquipmentTraceBriefDoc {
  document_type: string;
  document_id: number;
}

/** 用于 DetailDrawerTemplate.traceDocument.renderBriefActions（内嵌全链路已含「关闭简览」） */
export function EquipmentTraceBriefPrimaryActions(props: {
  doc: EquipmentTraceBriefDoc;
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
      {brief.document_type === 'purchase_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PURCHASE_ORDERS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenPurchaseOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'sales_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.SALES_ORDERS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenSalesOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'demand' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.DEMAND_MANAGEMENT)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenDemand')}
        </Button>
      ) : null}
      {brief.document_type === 'purchase_requisition' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PURCHASE_REQUISITIONS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenPurchaseRequisition')}
        </Button>
      ) : null}
      {brief.document_type === 'work_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WORK_ORDERS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenWorkOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'maintenance_reminder' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MAINTENANCE_REMINDERS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenMaintenanceReminder')}
        </Button>
      ) : null}
      {brief.document_type === 'equipment' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.EQUIPMENT)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenEquipment')}
        </Button>
      ) : null}
      {brief.document_type === 'equipment_fault' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.EQUIPMENT_FAULTS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenEquipmentFault')}
        </Button>
      ) : null}
      {brief.document_type === 'maintenance_plan' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MAINTENANCE_PLANS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenMaintenancePlan')}
        </Button>
      ) : null}
      {brief.document_type === 'mold' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MOLDS)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenMold')}
        </Button>
      ) : null}
      {brief.document_type === 'tool' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.TOOL_LEDGER)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenTool')}
        </Button>
      ) : null}
      {brief.document_type === 'incoming_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.INCOMING_INSPECTION)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenIncomingInspection')}
        </Button>
      ) : null}
      {brief.document_type === 'process_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PROCESS_INSPECTION)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenProcessInspection')}
        </Button>
      ) : null}
      {brief.document_type === 'finished_goods_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.FINISHED_GOODS_INSPECTION)}>
          {t('app.kuaizhizao.equipmentTrace.traceBriefOpenFinishedGoodsInspection')}
        </Button>
      ) : null}
    </>
  );
}

export function EquipmentTraceBriefFooter(props: {
  brief: EquipmentTraceBriefDoc | null;
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
        <Button onClick={onDismissBrief}>{t('app.kuaizhizao.equipmentTrace.traceBriefDismiss')}</Button>
        <EquipmentTraceBriefPrimaryActions doc={brief} t={t} navigate={navigate} closeDrawer={closeDrawer} />
      </Space>
    </div>
  );
}
