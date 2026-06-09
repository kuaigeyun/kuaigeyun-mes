import { getDepartmentTree, type DepartmentTreeItem } from '../../../services/department';
import { getPositionList } from '../../../services/position';
import { getRoleList } from '../../../services/role';
import { searchReferenceDisplay } from '../../../utils/referenceDisplay';

export type UserFormSelectOption = { label: string; value: string };

export type UserFormRoleMeta = {
  role_type?: string;
  external_partner_type?: string;
};

export type UserFormCoreReferenceOptions = {
  departmentOptions: UserFormSelectOption[];
  positionOptions: UserFormSelectOption[];
  roleOptions: UserFormSelectOption[];
  roleMetaByUuid: Record<string, UserFormRoleMeta>;
};

function buildDeptOptions(items: DepartmentTreeItem[], level = 0): UserFormSelectOption[] {
  const options: UserFormSelectOption[] = [];
  items.forEach((item) => {
    const prefix = '  '.repeat(level);
    options.push({
      label: `${prefix}${item.name}`,
      value: item.uuid,
    });
    if (item.children && item.children.length > 0) {
      options.push(...buildDeptOptions(item.children, level + 1));
    }
  });
  return options;
}

let coreCache: UserFormCoreReferenceOptions | null = null;
let coreInflight: Promise<UserFormCoreReferenceOptions> | null = null;

async function fetchCoreReferenceOptions(): Promise<UserFormCoreReferenceOptions> {
  const [deptResponse, posResponse, roleResponse] = await Promise.all([
    getDepartmentTree(),
    getPositionList({ page_size: 100 }),
    getRoleList({ page_size: 100 }),
  ]);

  return {
    departmentOptions: buildDeptOptions(deptResponse.items),
    positionOptions: posResponse.items.map((pos) => ({
      label: pos.name,
      value: pos.uuid,
    })),
    roleOptions: roleResponse.items.map((role) => ({
      label: role.name,
      value: role.uuid,
    })),
    roleMetaByUuid: roleResponse.items.reduce((acc, role) => {
      acc[role.uuid] = {
        role_type: role.role_type,
        external_partner_type: role.external_partner_type,
      };
      return acc;
    }, {} as Record<string, UserFormRoleMeta>),
  };
}

/** 列表页预加载 / 弹窗复用：同会话内只拉一次部门树+职位+角色 */
export async function getUserFormCoreReferenceOptions(options?: {
  force?: boolean;
}): Promise<UserFormCoreReferenceOptions> {
  if (!options?.force && coreCache) {
    return coreCache;
  }
  if (!options?.force && coreInflight) {
    return coreInflight;
  }

  coreInflight = fetchCoreReferenceOptions()
    .then((result) => {
      coreCache = result;
      return result;
    })
    .finally(() => {
      coreInflight = null;
    });

  return coreInflight;
}

export function primeUserFormCoreReferenceOptions(): void {
  void getUserFormCoreReferenceOptions().catch(() => {});
}

const partnerCache: Partial<Record<'supplier' | 'customer', UserFormSelectOption[]>> = {};
const partnerInflight: Partial<Record<'supplier' | 'customer', Promise<UserFormSelectOption[]>>> = {};

async function fetchPartnerOptions(dimension: 'supplier' | 'customer'): Promise<UserFormSelectOption[]> {
  const resource =
    dimension === 'supplier'
      ? 'master-data:supply-chain:supplier'
      : 'master-data:supply-chain:customer';
  const display = await searchReferenceDisplay({
    resource,
    hostResource: 'system:user',
    pageSize: 200,
  });
  return display.items
    .map((x) => ({
      label: x.label || `${x.name ?? ''}${x.code ? ` (${x.code})` : ''}`,
      value: x.code ?? '',
    }))
    .filter((x) => !!x.value);
}

/** 仅在外部角色需要供应商/客户绑定时按需加载 */
export async function getUserFormPartnerOptions(
  dimension: 'supplier' | 'customer',
): Promise<UserFormSelectOption[]> {
  const cached = partnerCache[dimension];
  if (cached) return cached;

  const inflight = partnerInflight[dimension];
  if (inflight) return inflight;

  const promise = fetchPartnerOptions(dimension)
    .then((options) => {
      partnerCache[dimension] = options;
      return options;
    })
    .finally(() => {
      delete partnerInflight[dimension];
    });

  partnerInflight[dimension] = promise;
  return promise;
}

export function roleUuidsNeedPartnerDimension(
  roleUuids: string[],
  roleMetaByUuid: Record<string, UserFormRoleMeta>,
  dimension: 'supplier' | 'customer',
): boolean {
  return roleUuids.some((uuid) => {
    const meta = roleMetaByUuid[uuid];
    return meta?.role_type === 'external' && meta.external_partner_type === dimension;
  });
}
