import { listHaoligoNotifyUserOptions } from '../services/haoligo';

export async function searchHaoligoUserIdOptions(args: {
  keyword?: string;
  pageSize?: number;
  selectedIds?: number[];
  labelById?: Map<number, string>;
}): Promise<{ label: string; value: number }[]> {
  const {
    keyword,
    pageSize = 50,
    selectedIds = [],
    labelById = new Map<number, string>(),
  } = args;
  const users = await listHaoligoNotifyUserOptions({
    keyword,
    limit: Math.max(1, Math.min(200, pageSize)),
    selected_user_ids: selectedIds.filter((id) => Number.isFinite(id) && id > 0),
  });
  const options = users.map((u) => ({ label: u.label, value: u.id }));
  for (const opt of options) {
    labelById.set(opt.value, opt.label);
  }
  return options;
}

export async function resolveHaoligoUserIdLabels(userIds: number[]): Promise<Map<number, string>> {
  const ids = userIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return new Map<number, string>();
  const users = await listHaoligoNotifyUserOptions({
    limit: Math.min(200, Math.max(50, ids.length)),
    selected_user_ids: ids,
  });
  const labels = new Map<number, string>();
  for (const user of users) {
    labels.set(user.id, user.label);
  }
  return labels;
}
