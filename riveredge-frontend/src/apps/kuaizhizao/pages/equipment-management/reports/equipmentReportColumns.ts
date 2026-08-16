import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import { reportDocumentStatusText, reportPercent } from '../../../utils/reportPresentation';

export function buildEquipmentMaintDetailColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.equipmentReports.colMaintCode'),
      dataIndex: 'maint_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
      dataIndex: 'equipment_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
      dataIndex: 'equipment_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colWorkContent'),
      dataIndex: 'work_content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colExecutor'),
      dataIndex: 'maint_person',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colCompletedAt'),
      dataIndex: 'completed_at',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      render: (_, row) => reportDocumentStatusText(t, row.status),
    },
  ];
}

export function buildEquipmentMaintPlanColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.equipmentReports.colPlanNo'),
      dataIndex: 'plan_no',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colPlanName'),
      dataIndex: 'plan_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
      dataIndex: 'equipment_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
      dataIndex: 'equipment_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colPlanDate'),
      dataIndex: 'plan_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colActualDate'),
      dataIndex: 'actual_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colExecutor'),
      dataIndex: 'executor',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      render: (_, row) => reportDocumentStatusText(t, row.status),
    },
  ];
}

export function buildEquipmentFaultAnalysisColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
      dataIndex: 'equipment_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
      dataIndex: 'equipment_name',
      ellipsis: true,
      width: 180,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colFaultType'),
      dataIndex: 'fault_type',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colFaultCount'),
      dataIndex: 'count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colShare'),
      dataIndex: 'share_rate',
      width: 90,
      hideInSearch: true,
      align: 'right',
      render: (_, row) => reportPercent(row.share_rate),
    },
  ];
}

export function buildEquipmentStatusLogColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
      dataIndex: 'equipment_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
      dataIndex: 'equipment_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colStatusChange'),
      dataIndex: 'status_change',
      width: 120,
      hideInSearch: true,
      render: (_, row) => reportDocumentStatusText(t, row.status_change),
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEventTime'),
      dataIndex: 'event_time',
      valueType: 'dateTime',
      width: 170,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colDurationMins'),
      dataIndex: 'duration_mins',
      valueType: 'digit',
      width: 120,
      hideInSearch: true,
      align: 'right',
    },
  ];
}

export function buildEquipmentSpotCheckColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
      dataIndex: 'equipment_code',
      width: 140,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
      dataIndex: 'equipment_name',
      ellipsis: true,
      width: 180,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colTotalCount'),
      dataIndex: 'total_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colCompletedCount'),
      dataIndex: 'completed_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colAbnormalityCount'),
      dataIndex: 'abnormality_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colCompletionRate'),
      dataIndex: 'completion_rate',
      width: 100,
      hideInSearch: true,
      align: 'right',
      render: (_, row) => reportPercent(row.completion_rate),
    },
  ];
}

export function buildEquipmentRoutePatrolColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.equipmentReports.colRouteCode'),
      dataIndex: 'route_code',
      width: 140,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colRouteName'),
      dataIndex: 'route_name',
      ellipsis: true,
      width: 180,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colTotalCount'),
      dataIndex: 'total_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colCompletedCount'),
      dataIndex: 'completed_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colAbnormalityCount'),
      dataIndex: 'abnormality_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colCompletionRate'),
      dataIndex: 'completion_rate',
      width: 100,
      hideInSearch: true,
      align: 'right',
      render: (_, row) => reportPercent(row.completion_rate),
    },
  ];
}

export function buildEquipmentMttrColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
      dataIndex: 'equipment_code',
      width: 140,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
      dataIndex: 'equipment_name',
      ellipsis: true,
      width: 180,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colFaultCount'),
      dataIndex: 'fault_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colRepairCount'),
      dataIndex: 'repair_count',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colMttrHours'),
      dataIndex: 'mttr_hours',
      width: 120,
      hideInSearch: true,
      align: 'right',
      sorter: true,
      render: (_, r) => (r.mttr_hours != null ? String(r.mttr_hours) : '-'),
    },
    {
      title: t('app.kuaizhizao.equipmentReports.colMtbfHours'),
      dataIndex: 'mtbf_hours',
      width: 120,
      hideInSearch: true,
      align: 'right',
      sorter: true,
      render: (_, r) => (r.mtbf_hours != null ? String(r.mtbf_hours) : '-'),
    },
  ];
}
