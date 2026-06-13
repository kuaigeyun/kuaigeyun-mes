import { useCallback, useRef, useState } from 'react';
import type { ProFormInstance } from '@ant-design/pro-components';
import type { UniUserIdSelectPreset } from '../../../components/uni-user-id-select';
import { getDepartmentTree, type DepartmentTreeItem } from '../../../services/department';
import { useGlobalStore } from '../../../stores';
import {
  collectLeafDepartmentOptions,
  resolveDefaultLeafDeptUuid,
} from '../utils/departmentFormHelpers';
import { formatUserDisplayLabel } from '../../../utils/userDisplay';
import {
  resolveHaoligoUserIdLabels,
  searchHaoligoUserIdOptions,
} from '../utils/haoligoUserPicker';

export function useApplicantUserIdField(formRef: React.RefObject<ProFormInstance | null>) {
  const applicantDeptUuidByUserIdRef = useRef<Map<number, string>>(new Map());
  const departmentTreeRef = useRef<DepartmentTreeItem[]>([]);

  const [applicantPresetUsers, setApplicantPresetUsers] = useState<UniUserIdSelectPreset[]>([]);
  const [leafDeptOptions, setLeafDeptOptions] = useState<{ label: string; value: string }[]>([]);

  const loadLeafDepartments = useCallback(async () => {
    try {
      const tree = await getDepartmentTree({ is_active: true });
      const items = tree.items || [];
      departmentTreeRef.current = items;
      setLeafDeptOptions(collectLeafDepartmentOptions(items));
    } catch {
      departmentTreeRef.current = [];
      setLeafDeptOptions([]);
    }
  }, []);

  const syncDefaultDepartmentForApplicant = useCallback((userId: number | undefined) => {
    const inst = formRef.current;
    if (!inst) return;
    if (userId == null || !Number.isFinite(userId)) {
      inst.setFieldsValue({ department_uuid: undefined });
      return;
    }
    const tree = departmentTreeRef.current;
    let userDeptUuid = (applicantDeptUuidByUserIdRef.current.get(userId) || '').trim();
    if (!userDeptUuid) {
      const cu = useGlobalStore.getState().currentUser;
      if (cu?.id === userId && cu.department?.uuid) userDeptUuid = cu.department.uuid.trim();
    }
    const leaf = resolveDefaultLeafDeptUuid(tree, userDeptUuid || undefined);
    inst.setFieldsValue({ department_uuid: leaf || undefined });
  }, [formRef]);

  const onApplicantPicked = useCallback(
    (user: { id: number; department_uuid?: string | null } | undefined) => {
      if (user?.id != null && user.department_uuid) {
        const m = new Map(applicantDeptUuidByUserIdRef.current);
        m.set(user.id, user.department_uuid.trim());
        applicantDeptUuidByUserIdRef.current = m;
      }
      syncDefaultDepartmentForApplicant(user?.id);
    },
    [syncDefaultDepartmentForApplicant],
  );

  const applyApplicantPreset = useCallback((preset: UniUserIdSelectPreset) => {
    const deptMap = new Map(applicantDeptUuidByUserIdRef.current);
    if (preset.department_uuid) deptMap.set(preset.id, preset.department_uuid);
    applicantDeptUuidByUserIdRef.current = deptMap;
    setApplicantPresetUsers([preset]);
  }, []);

  const mergeApplicantPresets = useCallback((extras?: UniUserIdSelectPreset[]) => {
    const cu = useGlobalStore.getState().currentUser;
    const merged = new Map<number, UniUserIdSelectPreset>();
    if (cu?.id != null) {
      merged.set(cu.id, {
        id: cu.id,
        label: formatUserDisplayLabel(cu),
        department_uuid: cu.department?.uuid,
      });
      const deptMap = new Map(applicantDeptUuidByUserIdRef.current);
      if (cu.department?.uuid) deptMap.set(cu.id, cu.department.uuid.trim());
      applicantDeptUuidByUserIdRef.current = deptMap;
    }
    for (const p of extras || []) {
      if (p.id != null) merged.set(p.id, p);
    }
    return [...merged.values()];
  }, []);

  const preloadTenantFormOptions = useCallback(
    async (extras?: UniUserIdSelectPreset[]) => {
      const presets = mergeApplicantPresets(extras);
      const deptMap = new Map(applicantDeptUuidByUserIdRef.current);
      for (const ex of presets) {
        if (ex.department_uuid) deptMap.set(ex.id, ex.department_uuid);
      }
      applicantDeptUuidByUserIdRef.current = deptMap;
      setApplicantPresetUsers(presets);
      await loadLeafDepartments();
    },
    [loadLeafDepartments, mergeApplicantPresets],
  );

  const getCreateApplicantDefaults = useCallback(() => {
    const tree = departmentTreeRef.current;
    const cu = useGlobalStore.getState().currentUser;
    const uid = cu?.id;
    let deptUuid: string | undefined;
    if (uid != null) {
      const uu = (applicantDeptUuidByUserIdRef.current.get(uid) || cu?.department?.uuid || '').trim();
      deptUuid = resolveDefaultLeafDeptUuid(tree, uu || undefined);
    }
    return { applicant_user_id: uid, department_uuid: deptUuid };
  }, []);

  const resetApplicantToCurrentUser = useCallback(() => {
    const inst = formRef.current;
    if (!inst) return;
    const defaults = getCreateApplicantDefaults();
    inst.setFieldsValue(defaults);
  }, [formRef, getCreateApplicantDefaults]);

  const resolveInitDepartmentUuid = useCallback(
    (applicantUserId: number | null | undefined, departmentUuid: string | null | undefined) => {
      let initDept = (departmentUuid || '').trim();
      if (!initDept && applicantUserId != null) {
        const uu = (applicantDeptUuidByUserIdRef.current.get(applicantUserId) || '').trim();
        initDept = resolveDefaultLeafDeptUuid(departmentTreeRef.current, uu) || '';
      }
      return initDept || undefined;
    },
    [],
  );

  const presetFromApplicantRow = useCallback(
    (row: {
      applicant_user_id?: number | null;
      applicant_name?: string | null;
      department_uuid?: string | null;
    }): UniUserIdSelectPreset | undefined => {
      if (row.applicant_user_id == null) return undefined;
      return {
        id: row.applicant_user_id,
        label: (row.applicant_name || '').trim() || `用户#${row.applicant_user_id}`,
        department_uuid: (row.department_uuid || '').trim() || undefined,
      };
    },
    [],
  );

  const enrichApplicantPresetFromRow = useCallback(
    async (row: {
      applicant_user_id?: number | null;
      applicant_name?: string | null;
      department_uuid?: string | null;
    }): Promise<UniUserIdSelectPreset | undefined> => {
      if (row.applicant_user_id == null) return undefined;
      const snapshot = (row.applicant_name || '').trim();
      if (snapshot) return presetFromApplicantRow(row);
      const labels = await resolveHaoligoUserIdLabels([row.applicant_user_id]);
      const resolved = labels.get(row.applicant_user_id);
      return {
        id: row.applicant_user_id,
        label: resolved || `用户#${row.applicant_user_id}`,
        department_uuid: (row.department_uuid || '').trim() || undefined,
      };
    },
    [presetFromApplicantRow],
  );

  const searchApplicantUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) =>
      searchHaoligoUserIdOptions({
        keyword,
        pageSize: 50,
        selectedIds,
      }),
    [],
  );

  return {
    applicantPresetUsers,
    leafDeptOptions,
    departmentTreeRef,
    applicantDeptUuidByUserIdRef,
    loadLeafDepartments,
    onApplicantPicked,
    applyApplicantPreset,
    preloadTenantFormOptions,
    getCreateApplicantDefaults,
    resetApplicantToCurrentUser,
    resolveInitDepartmentUuid,
    presetFromApplicantRow,
    enrichApplicantPresetFromRow,
    syncDefaultDepartmentForApplicant,
    searchApplicantUsers,
  };
}
