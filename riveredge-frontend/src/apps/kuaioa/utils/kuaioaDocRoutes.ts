/** 轻办公审批实体 → 列表页路由（工作台跳转用） */



const KUAIOA_DOC_LIST_PATH: Record<string, string> = {

  kuaioa_form_request: '/apps/kuaioa/approval/form-requests',

  kuaioa_asset_purchase: '/apps/kuaioa/assets/purchases',

  kuaioa_leave: '/apps/kuaioa/hr/leave',

  kuaioa_seal: '/apps/kuaioa/admin/seal',

  kuaioa_special_price: '/apps/kuaioa/collaboration/special-price',

  kuaioa_concession: '/apps/kuaioa/collaboration/concession',

  kuaioa_process_deviation: '/apps/kuaioa/collaboration/process-deviation',

};



export function resolveKuaioaDocListPath(entityType?: string | null): string | undefined {

  if (!entityType) return undefined;

  return KUAIOA_DOC_LIST_PATH[entityType];

}



export function buildKuaioaDocListUrl(

  entityType?: string | null,

  entityId?: number | string | null,

): string | undefined {

  const base = resolveKuaioaDocListPath(entityType);

  if (!base || entityId == null || entityId === '') return base;

  return `${base}?id=${entityId}`;

}



export const KUAIOA_WORKBENCH_QUICK_ENTRIES = [

  {

    key: 'form-request',

    labelKey: 'app.kuaioa.menu.form-requests',

    path: '/apps/kuaioa/approval/form-requests',

  },

  {

    key: 'leave',

    labelKey: 'app.kuaioa.menu.leave',

    path: '/apps/kuaioa/hr/leave',

  },

  {

    key: 'seal',

    labelKey: 'app.kuaioa.menu.seal',

    path: '/apps/kuaioa/admin/seal',

  },

  {

    key: 'special-price',

    labelKey: 'app.kuaioa.menu.special-price',

    path: '/apps/kuaioa/collaboration/special-price',

  },

  {

    key: 'personal-tasks',

    labelKey: 'menu.personal.tasks',

    path: '/personal/tasks',

  },

] as const;

