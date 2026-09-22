import { listEmployees } from '../services/employees';

/** 从在职员工档案汇总车间名，供薪酬/人事筛选与表单下拉。 */
export async function loadOaWorkshopNameOptions(): Promise<
  Array<{ label: string; value: string }>
> {
  const res = await listEmployees();
  const names = Array.from(
    new Set(
      res.items.map((e) => String(e.workshop_name ?? '').trim()).filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return names.map((name) => ({ label: name, value: name }));
}
