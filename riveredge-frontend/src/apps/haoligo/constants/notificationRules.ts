/** 好力 GO 业务消息提醒：单据类型（与后端 trigger_document 一致） */



export const HAOLIGO_NOTIFICATION_DOCUMENT_OPTIONS = [

  { value: 'haoligo_mold_trial', labelKey: 'app.haoligo.settings.notifications.document.mold_trial', fallback: '试模单' },

  {

    value: 'haoligo_outsource_maintenance',

    labelKey: 'app.haoligo.settings.notifications.document.outsource_maintenance',

    fallback: '外协维保单',

  },

  {

    value: 'haoligo_mold_maintenance',

    labelKey: 'app.haoligo.settings.notifications.document.mold_maintenance',

    fallback: '厂内维保/维修单',

  },

  {

    value: 'haoligo_mold_maintenance_complete',

    labelKey: 'app.haoligo.settings.notifications.document.mold_maintenance_complete',

    fallback: '厂内维保完修单',

  },

  {

    value: 'haoligo_mold_outsource_maintenance_complete',

    labelKey: 'app.haoligo.settings.notifications.document.outsource_maintenance_complete',

    fallback: '外协维保完修单',

  },

  {

    value: 'haoligo_equipment_spot_check',

    labelKey: 'app.haoligo.settings.notifications.document.equipment_spot_check',

    fallback: '设备点检单',

  },

  {

    value: 'haoligo_equipment_route_patrol',

    labelKey: 'app.haoligo.settings.notifications.document.equipment_route_patrol',

    fallback: '设备巡检单',

  },

  {

    value: 'haoligo_equipment_upkeep_sheet',

    labelKey: 'app.haoligo.settings.notifications.document.equipment_upkeep_sheet',

    fallback: '设备维保单',

  },

  {

    value: 'haoligo_equipment_upkeep_complete',

    labelKey: 'app.haoligo.settings.notifications.document.equipment_upkeep_complete',

    fallback: '设备维保完修单',

  },

  {

    value: 'haoligo_patrol_issue_register',

    labelKey: 'app.haoligo.settings.notifications.document.patrol_issue_register',

    fallback: '问题登记',

  },

] as const;



export const HAOLIGO_NOTIFICATION_DOCUMENTS = new Set(

  HAOLIGO_NOTIFICATION_DOCUMENT_OPTIONS.map((it) => it.value),

);



export const HAOLIGO_NOTIFICATION_ACTION_OPTIONS: Record<

  string,

  Array<{ value: string; labelKey: string; fallback: string }>

> = {

  haoligo_mold_trial: [

    {

      value: 'submitted',

      labelKey: 'app.haoligo.settings.notifications.action.mold_trial.submitted',

      fallback: '提交待审',

    },

    {

      value: 'trial_failure_pending',

      labelKey: 'app.haoligo.settings.notifications.action.mold_trial.trial_failure_pending',

      fallback: '试模不合格·待处理',

    },

    {

      value: 'trial_failure_repair',

      labelKey: 'app.haoligo.settings.notifications.action.mold_trial.trial_failure_repair',

      fallback: '试模不合格·立即送修',

    },

    {

      value: 'approved',

      labelKey: 'app.haoligo.settings.notifications.action.mold_trial.approved',

      fallback: '审核通过',

    },

    {

      value: 'rejected',

      labelKey: 'app.haoligo.settings.notifications.action.mold_trial.rejected',

      fallback: '审核驳回',

    },

  ],

  haoligo_outsource_maintenance: [

    {

      value: 'submitted',

      labelKey: 'app.haoligo.settings.notifications.action.outsource_maintenance.submitted',

      fallback: '提交待审',

    },

    {

      value: 'approved',

      labelKey: 'app.haoligo.settings.notifications.action.outsource_maintenance.approved',

      fallback: '审核通过',

    },

    {

      value: 'rejected',

      labelKey: 'app.haoligo.settings.notifications.action.outsource_maintenance.rejected',

      fallback: '审核驳回',

    },

  ],

  haoligo_mold_maintenance: [

    {

      value: 'submitted',

      labelKey: 'app.haoligo.settings.notifications.action.mold_maintenance.submitted',

      fallback: '提交待审',

    },

    {

      value: 'approved',

      labelKey: 'app.haoligo.settings.notifications.action.mold_maintenance.approved',

      fallback: '审核通过',

    },

    {

      value: 'rejected',

      labelKey: 'app.haoligo.settings.notifications.action.mold_maintenance.rejected',

      fallback: '审核驳回',

    },

  ],

  haoligo_mold_maintenance_complete: [

    {

      value: 'created',

      labelKey: 'app.haoligo.settings.notifications.action.mold_maintenance_complete.created',

      fallback: '创建',

    },

  ],

  haoligo_mold_outsource_maintenance_complete: [

    {

      value: 'submitted',

      labelKey: 'app.haoligo.settings.notifications.action.outsource_complete.submitted',

      fallback: '提交待审',

    },

    {

      value: 'approved',

      labelKey: 'app.haoligo.settings.notifications.action.outsource_complete.approved',

      fallback: '审核通过',

    },

    {

      value: 'rejected',

      labelKey: 'app.haoligo.settings.notifications.action.outsource_complete.rejected',

      fallback: '审核驳回',

    },

  ],

  haoligo_equipment_spot_check: [

    {

      value: 'reported',

      labelKey: 'app.haoligo.settings.notifications.action.equipment_spot_check.reported',

      fallback: '点检上报',

    },

  ],

  haoligo_equipment_route_patrol: [

    {

      value: 'reported',

      labelKey: 'app.haoligo.settings.notifications.action.equipment_route_patrol.reported',

      fallback: '巡检上报',

    },

  ],

  haoligo_equipment_upkeep_sheet: [

    {

      value: 'created',

      labelKey: 'app.haoligo.settings.notifications.action.equipment_upkeep_sheet.created',

      fallback: '创建',

    },

  ],

  haoligo_equipment_upkeep_complete: [

    {

      value: 'created',

      labelKey: 'app.haoligo.settings.notifications.action.equipment_upkeep_complete.created',

      fallback: '创建',

    },

  ],

  haoligo_patrol_issue_register: [

    {

      value: 'reported',

      labelKey: 'app.haoligo.settings.notifications.action.patrol_issue_register.reported',

      fallback: '问题登记上报',

    },

    {

      value: 'remediated',

      labelKey: 'app.haoligo.settings.notifications.action.patrol_issue_register.remediated',

      fallback: '治理完成',

    },

  ],

};



export const HAOLIGO_NOTIFICATION_RECIPIENT_SCOPES = [

  {

    value: 'supplier_bound',

    labelKey: 'app.haoligo.settings.notifications.scope.supplier_bound',

    fallback: '外协单位绑定用户',

  },

  {

    value: 'trial_operator',

    labelKey: 'app.haoligo.settings.notifications.scope.trial_operator',

    fallback: '试模人员',

  },

  { value: 'reporter', labelKey: 'app.haoligo.settings.notifications.scope.reporter', fallback: '上报人' },

];



export function isHaoligoNotificationDocument(documentCode: string): boolean {

  return HAOLIGO_NOTIFICATION_DOCUMENTS.has(documentCode);

}


