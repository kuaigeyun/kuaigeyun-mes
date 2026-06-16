/**
 * 仓储管理 Uni-detail：关联简览底部「关闭 / 前往列表」（与 EquipmentTraceBriefFooter 业务类型对齐并补充仓储单据）
 */

import React from 'react';
import { Button, Space } from 'antd';
import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { ROUTES } from '../../constants/routes';

export interface WarehouseTraceBriefDoc {
  document_type: string;
  document_id: number;
}

/** 用于 DetailDrawerTemplate.traceDocument.renderBriefActions（内嵌全链路已含「关闭简览」） */
export function WarehouseTraceBriefPrimaryActions(props: {
  doc: WarehouseTraceBriefDoc;
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
          {t('components.documentTrackingPanel.traceBriefOpenPurchaseOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'purchase_return' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PURCHASE_RETURNS)}>
          {t('components.documentTrackingPanel.traceBriefOpenPurchaseReturn')}
        </Button>
      ) : null}
      {brief.document_type === 'sales_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.SALES_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'sales_forecast' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.SALES_FORECASTS)}>
          {t('components.documentTrackingPanel.traceBriefOpenSalesForecast')}
        </Button>
      ) : null}
      {brief.document_type === 'sales_return' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.SALES_RETURNS)}>
          {t('components.documentTrackingPanel.traceBriefOpenSalesReturn')}
        </Button>
      ) : null}
      {brief.document_type === 'shipment_notice' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.SHIPMENT_NOTICES)}>
          {t('components.documentTrackingPanel.traceBriefOpenShipmentNotice')}
        </Button>
      ) : null}
      {brief.document_type === 'demand' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.DEMAND_MANAGEMENT)}>
          {t('components.documentTrackingPanel.traceBriefOpenDemand')}
        </Button>
      ) : null}
      {brief.document_type === 'demand_computation' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.DEMAND_COMPUTATION)}>
          {t('components.documentTrackingPanel.traceBriefOpenDemandComputation')}
        </Button>
      ) : null}
      {brief.document_type === 'quotation' ? (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            closeDrawer();
            navigate(ROUTES.QUOTATIONS, { state: { openQuotationDetailId: brief.document_id } });
          }}
        >
          {t('components.documentTrackingPanel.traceBriefOpenQuotation')}
        </Button>
      ) : null}
      {brief.document_type === 'purchase_requisition' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PURCHASE_REQUISITIONS)}>
          {t('components.documentTrackingPanel.traceBriefOpenPurchaseRequisition')}
        </Button>
      ) : null}
      {brief.document_type === 'outsource_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.OUTSOURCE_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenOutsourceOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'outsource_work_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.OUTSOURCE_WORK_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenOutsourceWorkOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'rework_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.REWORK_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenReworkOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'reporting_record' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.REPORTING)}>
          {t('components.documentTrackingPanel.traceBriefOpenReporting')}
        </Button>
      ) : null}
      {brief.document_type === 'packing_binding' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PACKING_BINDING)}>
          {t('components.documentTrackingPanel.traceBriefOpenPackingBinding')}
        </Button>
      ) : null}
      {brief.document_type === 'work_order' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WORK_ORDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenWorkOrder')}
        </Button>
      ) : null}
      {brief.document_type === 'receipt_notice' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.RECEIPT_NOTICES)}>
          {t('components.documentTrackingPanel.traceBriefOpenReceiptNotice')}
        </Button>
      ) : null}
      {brief.document_type === 'other_inbound' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_OTHER_INBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenOtherInbound')}
        </Button>
      ) : null}
      {brief.document_type === 'purchase_receipt' ||
      brief.document_type === 'finished_goods_receipt' ||
      brief.document_type === 'semi_finished_goods_receipt' ||
      brief.document_type === 'production_return' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_INBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenInbound')}
        </Button>
      ) : null}
      {brief.document_type === 'production_picking' || brief.document_type === 'sales_delivery' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_OUTBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenOutbound')}
        </Button>
      ) : null}
      {brief.document_type === 'other_outbound' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_OTHER_OUTBOUND)}>
          {t('components.documentTrackingPanel.traceBriefOpenOtherOutbound')}
        </Button>
      ) : null}
      {brief.document_type === 'material_borrow' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_MATERIAL_BORROWS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaterialBorrow')}
        </Button>
      ) : null}
      {brief.document_type === 'material_return' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.WM_MATERIAL_RETURNS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaterialReturn')}
        </Button>
      ) : null}
      {brief.document_type === 'maintenance_reminder' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MAINTENANCE_REMINDERS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaintenanceReminder')}
        </Button>
      ) : null}
      {brief.document_type === 'equipment' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.EQUIPMENT)}>
          {t('components.documentTrackingPanel.traceBriefOpenEquipment')}
        </Button>
      ) : null}
      {brief.document_type === 'equipment_fault' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.EQUIPMENT_FAULTS)}>
          {t('components.documentTrackingPanel.traceBriefOpenEquipmentFault')}
        </Button>
      ) : null}
      {brief.document_type === 'maintenance_plan' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MAINTENANCE_PLANS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMaintenancePlan')}
        </Button>
      ) : null}
      {brief.document_type === 'mold' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.MOLDS)}>
          {t('components.documentTrackingPanel.traceBriefOpenMold')}
        </Button>
      ) : null}
      {brief.document_type === 'tool' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.TOOL_LEDGER)}>
          {t('components.documentTrackingPanel.traceBriefOpenTool')}
        </Button>
      ) : null}
      {brief.document_type === 'incoming_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.INCOMING_INSPECTION)}>
          {t('components.documentTrackingPanel.traceBriefOpenIncomingInspection')}
        </Button>
      ) : null}
      {brief.document_type === 'process_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.PROCESS_INSPECTION)}>
          {t('components.documentTrackingPanel.traceBriefOpenProcessInspection')}
        </Button>
      ) : null}
      {brief.document_type === 'finished_goods_inspection' ? (
        <Button type="primary" size="small" onClick={() => go(ROUTES.FINISHED_GOODS_INSPECTION)}>
          {t('components.documentTrackingPanel.traceBriefOpenFinishedGoodsInspection')}
        </Button>
      ) : null}
    </>
  );
}

export function WarehouseTraceBriefFooter(props: {
  brief: WarehouseTraceBriefDoc | null;
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
        <WarehouseTraceBriefPrimaryActions doc={brief} t={t} navigate={navigate} closeDrawer={closeDrawer} />
      </Space>
    </div>
  );
}
