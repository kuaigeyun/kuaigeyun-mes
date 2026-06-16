import type { TFunction } from 'i18next';

import i18n from '../../../config/i18n';
import { getDepartmentTree, type DepartmentTreeItem } from '../../../services/department';
import { getPositionList } from '../../../services/position';
import { getRoleList } from '../../../services/role';
import { searchReferenceDisplay } from '../../../utils/referenceDisplay';
import {
  resolvePresetDepartmentName,
  resolvePresetPositionName,
  resolvePresetRoleName,
} from '../../../utils/presetEntityI18n';

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

function buildDeptOptions(
  items: DepartmentTreeItem[],
  t: TFunction,
  level = 0,
): UserFormSelectOption[] {
  const options: UserFormSelectOption[] = [];
  items.forEach((item) => {
    const prefix = '  '.repeat(level);
    options.push({
      label: `${prefix}${resolvePresetDepartmentName(item, t)}`,
      value: item.uuid,
    });
    if (item.children && item.children.length > 0) {
      options.push(...buildDeptOptions(item.children, t, level + 1));
    }
  });
  return options;
}

let coreInflight: { lang: string; promise: Promise<UserFormCoreReferenceOptions> } | null = null;

async function fetchCoreReferenceOptions(t: TFunction): Promise<UserFormCoreReferenceOptions> {
  const [deptResponse, posResponse, roleResponse] = await Promise.all([
    getDepartmentTree(),
    getPositionList({ page_size: 100 }),
    getRoleList({ page_size: 100 }),
  ]);

  return {
    departmentOptions: buildDeptOptions(deptResponse.items, t),
    positionOptions: posResponse.items.map((pos) => ({
      label: resolvePresetPositionName(pos, t),
      value: pos.uuid,
    })),
    roleOptions: roleResponse.items.map((role) => ({
      label: resolvePresetRoleName(role, t),
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

/** 每次调用均请求最新部门树、职位、角色（仅合并同一时刻、同一语言的并发请求） */
export async function getUserFormCoreReferenceOptions(
  t: TFunction,
): Promise<UserFormCoreReferenceOptions> {
  const lang = i18n.language;
  if (coreInflight?.lang === lang) {
    return coreInflight.promise;
  }

  const promise = fetchCoreReferenceOptions(t).finally(() => {
    if (coreInflight?.lang === lang) {
      coreInflight = null;
    }
  });
  coreInflight = { lang, promise };

  return promise;
}

const partnerInflight: Partial<Record<'supplier' | 'customer', Promise<UserFormSelectOption[]>>> = {};

async function fetchPartnerOptions(dimension: 'supplier' | 'customer'): Promise<UserFormSelectOption[]> {
  const resource =
    dimension === 'supplier'
      ? 'master-data:supply-chain:supplier'
      : 'master-data:supply-chain:customer';
  const display = await searchReferenceDisplay({
    resource,
    pageSize: 200,
  });
  return display.items
    .map((x) => ({
      label: x.label || `${x.name ?? ''}${x.code ? ` (${x.code})` : ''}`,
      value: x.code ?? '',
    }))
    .filter((x) => !!x.value);
}

/** 外部角色绑定供应商/客户时按需加载（每次调用均请求最新数据） */
export async function getUserFormPartnerOptions(
  dimension: 'supplier' | 'customer',
): Promise<UserFormSelectOption[]> {
  const inflight = partnerInflight[dimension];
  if (inflight) return inflight;

  const promise = fetchPartnerOptions(dimension).finally(() => {
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
