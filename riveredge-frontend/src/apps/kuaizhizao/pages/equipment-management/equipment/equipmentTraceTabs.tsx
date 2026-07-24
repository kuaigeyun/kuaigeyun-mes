import React, { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { Button, Table, Tag } from 'antd';
import type { TabsProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  equipmentFaultLevelTagColor,
  equipmentOpsStatusTagColor,
} from '../../../utils/equipmentListCore';
import type { EquipmentDetailTabKey } from './equipmentPaths';

function renderOpsStatusTag(status: string) {
  return <Tag color={equipmentOpsStatusTagColor(status)}>{status || '-'}</Tag>;
}

export interface EquipmentTraceData {
  equipment?: { uuid?: string; code?: string; name?: string; status?: string };
  maintenance_plans?: Record<string, unknown>[];
  maintenance_executions?: Record<string, unknown>[];
  equipment_faults?: Record<string, unknown>[];
  equipment_repairs?: Record<string, unknown>[];
  equipment_calibrations?: Record<string, unknown>[];
  spot_checks?: Record<string, unknown>[];
  route_patrols?: Record<string, unknown>[];
  spare_part_requisitions?: Record<string, unknown>[];
  scrap_applications?: Record<string, unknown>[];
}

export function useEquipmentTraceColumns(t: TFunction) {
  const traceMaintenancePlanColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColPlanNo'), dataIndex: 'plan_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColPlanName'), dataIndex: 'plan_name', width: 200 },
      { title: t('app.kuaizhizao.equipment.traceColPlanType'), dataIndex: 'plan_type', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColMaintenanceType'), dataIndex: 'maintenance_type', width: 120 },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      { title: t('app.kuaizhizao.equipment.traceColPlannedStartDate'), dataIndex: 'planned_start_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColPlannedEndDate'), dataIndex: 'planned_end_date', width: 120 },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceMaintenanceExecutionColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColExecutionNo'), dataIndex: 'execution_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColExecutionDate'), dataIndex: 'execution_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColExecutor'), dataIndex: 'executor_name', width: 100 },
      {
        title: t('app.kuaizhizao.equipment.traceColExecutionResult'),
        dataIndex: 'execution_result',
        width: 120,
        render: renderOpsStatusTag,
      },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      {
        title: t('app.kuaizhizao.equipment.traceColMaintenanceCost'),
        dataIndex: 'maintenance_cost',
        width: 100,
        render: (cost: number) => (cost ? `¥${cost}` : '-'),
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceFaultColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColFaultNo'), dataIndex: 'fault_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColFaultDate'), dataIndex: 'fault_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColFaultType'), dataIndex: 'fault_type', width: 120 },
      {
        title: t('app.kuaizhizao.equipment.traceColFaultLevel'),
        dataIndex: 'fault_level',
        width: 100,
        render: (level: string) => <Tag color={equipmentFaultLevelTagColor(level)}>{level || '-'}</Tag>,
      },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      {
        title: t('app.kuaizhizao.equipment.traceColRepairRequired'),
        dataIndex: 'repair_required',
        width: 100,
        render: (required: boolean) => (
          <Tag color={required ? 'warning' : 'success'}>
            {required ? t('app.kuaizhizao.equipment.yes') : t('app.kuaizhizao.equipment.no')}
          </Tag>
        ),
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceRepairColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColRepairNo'), dataIndex: 'repair_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColRepairDate'), dataIndex: 'repair_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRepairType'), dataIndex: 'repair_type', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRepairer'), dataIndex: 'repairer_name', width: 100 },
      { title: t('app.kuaizhizao.equipment.traceColRepairDuration'), dataIndex: 'repair_duration', width: 120 },
      {
        title: t('app.kuaizhizao.equipment.traceColRepairCost'),
        dataIndex: 'repair_cost',
        width: 100,
        render: (cost: number) => (cost ? `¥${cost}` : '-'),
      },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      {
        title: t('app.kuaizhizao.equipment.traceColRepairResult'),
        dataIndex: 'repair_result',
        width: 120,
        render: renderOpsStatusTag,
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceCalibrationColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColCalibrationDate'), dataIndex: 'calibration_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColResult'), dataIndex: 'result', width: 100, render: renderOpsStatusTag },
      { title: t('app.kuaizhizao.equipment.traceColCertificateNo'), dataIndex: 'certificate_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColExpiryDate'), dataIndex: 'expiry_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRemark'), dataIndex: 'remark', ellipsis: true },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceSpotCheckColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColDocumentNo'), dataIndex: 'document_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColCheckDate'), dataIndex: 'check_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColInspector'), dataIndex: 'inspector_name', width: 100 },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      {
        title: t('app.kuaizhizao.equipment.traceColHasAbnormality'),
        dataIndex: 'has_abnormality',
        width: 100,
        render: (v: boolean) => (
          <Tag color={v ? 'error' : 'success'}>
            {v ? t('app.kuaizhizao.equipment.yes') : t('app.kuaizhizao.equipment.no')}
          </Tag>
        ),
      },
      { title: t('app.kuaizhizao.equipment.traceColAbnormalityDesc'), dataIndex: 'abnormality_description', ellipsis: true },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceRoutePatrolColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColDocumentNo'), dataIndex: 'document_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColRouteCode'), dataIndex: 'route_code', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRouteName'), dataIndex: 'route_name', width: 160 },
      { title: t('app.kuaizhizao.equipment.traceColPatrolDate'), dataIndex: 'patrol_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColInspector'), dataIndex: 'inspector_name', width: 100 },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      {
        title: t('app.kuaizhizao.equipment.traceColHasAbnormality'),
        dataIndex: 'has_abnormality',
        width: 100,
        render: (v: boolean) => (
          <Tag color={v ? 'error' : 'success'}>
            {v ? t('app.kuaizhizao.equipment.yes') : t('app.kuaizhizao.equipment.no')}
          </Tag>
        ),
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceSparePartColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColRequisitionNo'), dataIndex: 'requisition_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColPurpose'), dataIndex: 'purpose', width: 160, ellipsis: true },
      { title: t('app.kuaizhizao.equipment.traceColApplicant'), dataIndex: 'applicant_name', width: 100 },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      { title: t('app.kuaizhizao.equipment.traceColApprovedAt'), dataIndex: 'approved_at', width: 160 },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceScrapColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColApplicationNo'), dataIndex: 'application_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColScrapReason'), dataIndex: 'reason', ellipsis: true },
      { title: t('app.kuaizhizao.equipment.traceColScrapDate'), dataIndex: 'scrap_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColApplicant'), dataIndex: 'applicant_name', width: 100 },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: renderOpsStatusTag },
      { title: t('app.kuaizhizao.equipment.traceColApprovedAt'), dataIndex: 'approved_at', width: 160 },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  return {
    traceMaintenancePlanColumns,
    traceMaintenanceExecutionColumns,
    traceFaultColumns,
    traceRepairColumns,
    traceCalibrationColumns,
    traceSpotCheckColumns,
    traceRoutePatrolColumns,
    traceSparePartColumns,
    traceScrapColumns,
  };
}

interface BuildDetailTabItemsOptions {
  t: TFunction;
  traceData: EquipmentTraceData;
  columns: ReturnType<typeof useEquipmentTraceColumns>;
  onCreateCalibration?: () => void;
  onNavigateOps?: (path: string) => void;
}

export function buildEquipmentDetailTabItems(options: BuildDetailTabItemsOptions): TabsProps['items'] {
  const { t, traceData, columns, onCreateCalibration, onNavigateOps } = options;
  const {
    traceMaintenancePlanColumns,
    traceMaintenanceExecutionColumns,
    traceFaultColumns,
    traceRepairColumns,
    traceCalibrationColumns,
    traceSpotCheckColumns,
    traceRoutePatrolColumns,
    traceSparePartColumns,
    traceScrapColumns,
  } = columns;

  const opsLink = (labelKey: string, path: string) =>
    onNavigateOps ? (
      <div style={{ marginBottom: 12 }}>
        <Button type="link" size="small" onClick={() => onNavigateOps(path)}>
          {t(labelKey)}
        </Button>
      </div>
    ) : null;

  return [
    {
      key: 'spot_checks',
      label: t('app.kuaizhizao.equipment.detailTabSpotChecks', { count: traceData.spot_checks?.length || 0 }),
      children: (
        <>
          {opsLink('app.kuaizhizao.equipment.goToSpotChecks', '/apps/kuaizhizao/equipment-management/spot-checks')}
          <Table
            dataSource={traceData.spot_checks || []}
            columns={traceSpotCheckColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        </>
      ),
    },
    {
      key: 'route_patrols',
      label: t('app.kuaizhizao.equipment.detailTabRoutePatrols', { count: traceData.route_patrols?.length || 0 }),
      children: (
        <>
          {opsLink('app.kuaizhizao.equipment.goToRoutePatrols', '/apps/kuaizhizao/equipment-management/route-patrols')}
          <Table
            dataSource={traceData.route_patrols || []}
            columns={traceRoutePatrolColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        </>
      ),
    },
    {
      key: 'faults_repairs',
      label: t('app.kuaizhizao.equipment.detailTabFaultsRepairs', {
        count: (traceData.equipment_faults?.length || 0) + (traceData.equipment_repairs?.length || 0),
      }),
      children: (
        <>
          {opsLink('app.kuaizhizao.equipment.goToFaults', '/apps/kuaizhizao/equipment-management/equipment-faults')}
          <Table
            title={() => t('app.kuaizhizao.equipment.tabFaults', { count: traceData.equipment_faults?.length || 0 })}
            dataSource={traceData.equipment_faults || []}
            columns={traceFaultColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
            scroll={{ x: true }}
            style={{ marginBottom: 16 }}
          />
          {opsLink('app.kuaizhizao.equipment.goToRepairs', '/apps/kuaizhizao/equipment-management/equipment-repairs')}
          <Table
            title={() => t('app.kuaizhizao.equipment.tabRepairs', { count: traceData.equipment_repairs?.length || 0 })}
            dataSource={traceData.equipment_repairs || []}
            columns={traceRepairColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        </>
      ),
    },
    {
      key: 'maintenance',
      label: t('app.kuaizhizao.equipment.detailTabMaintenance', {
        count: (traceData.maintenance_plans?.length || 0) + (traceData.maintenance_executions?.length || 0),
      }),
      children: (
        <>
          {opsLink('app.kuaizhizao.equipment.goToMaintenancePlans', '/apps/kuaizhizao/equipment-management/maintenance-plans')}
          <Table
            title={() => t('app.kuaizhizao.equipment.tabMaintenancePlans', { count: traceData.maintenance_plans?.length || 0 })}
            dataSource={traceData.maintenance_plans || []}
            columns={traceMaintenancePlanColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
            scroll={{ x: true }}
            style={{ marginBottom: 16 }}
          />
          {opsLink('app.kuaizhizao.equipment.goToMaintenanceExecutions', '/apps/kuaizhizao/equipment-management/maintenance-executions')}
          <Table
            title={() =>
              t('app.kuaizhizao.equipment.tabMaintenanceExecutions', { count: traceData.maintenance_executions?.length || 0 })
            }
            dataSource={traceData.maintenance_executions || []}
            columns={traceMaintenanceExecutionColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
            scroll={{ x: true }}
            style={{ marginBottom: 16 }}
          />
          {onCreateCalibration ? (
            <div style={{ marginBottom: 12 }}>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onCreateCalibration}>
                {t('app.kuaizhizao.equipment.createCalibration')}
              </Button>
            </div>
          ) : null}
          <Table
            title={() => t('app.kuaizhizao.equipment.tabCalibrations', { count: traceData.equipment_calibrations?.length || 0 })}
            dataSource={traceData.equipment_calibrations || []}
            columns={traceCalibrationColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        </>
      ),
    },
    {
      key: 'spare_parts',
      label: t('app.kuaizhizao.equipment.detailTabSpareParts', { count: traceData.spare_part_requisitions?.length || 0 }),
      children: (
        <>
          {opsLink('app.kuaizhizao.equipment.goToSpareRequisitions', '/apps/kuaizhizao/equipment-management/spare-part-requisitions')}
          <Table
            dataSource={traceData.spare_part_requisitions || []}
            columns={traceSparePartColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        </>
      ),
    },
    {
      key: 'scrap',
      label: t('app.kuaizhizao.equipment.detailTabScrap', { count: traceData.scrap_applications?.length || 0 }),
      children: (
        <>
          {opsLink('app.kuaizhizao.equipment.goToScrap', '/apps/kuaizhizao/equipment-management/equipment-scrap')}
          <Table
            dataSource={traceData.scrap_applications || []}
            columns={traceScrapColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        </>
      ),
    },
  ];
}

export function resolveEquipmentDetailTabKey(raw: string | null): EquipmentDetailTabKey {
  const allowed: EquipmentDetailTabKey[] = [
    'info',
    'spot_checks',
    'route_patrols',
    'faults_repairs',
    'maintenance',
    'spare_parts',
    'scrap',
  ];
  if (raw && allowed.includes(raw as EquipmentDetailTabKey)) {
    return raw as EquipmentDetailTabKey;
  }
  return 'info';
}
