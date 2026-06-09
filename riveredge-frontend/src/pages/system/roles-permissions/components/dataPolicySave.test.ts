import { describe, expect, it } from 'vitest';
import { buildDataPolicySavePayload } from './dataPolicySave';
import type { DataPermissionPolicy } from '../../../../services/role';

const granted = new Set(['app:a', 'app:b', 'app:c']);

function policy(resource: string, scope: DataPermissionPolicy['scope_type']): DataPermissionPolicy {
  return {
    uuid: `u-${resource}`,
    role_uuid: 'role-1',
    resource,
    scope_type: scope,
  };
}

describe('buildDataPolicySavePayload', () => {
  it('applies batch scope to selected resources', () => {
    const payload = buildDataPolicySavePayload({
      dataPolicies: [policy('app:a', 'scope_self')],
      selectedResources: ['app:a', 'app:b'],
      visibleResources: ['app:a', 'app:b', 'app:c'],
      batchScope: 'scope_all',
      grantedKeys: granted,
    });
    expect(payload).toEqual([
      { resource: 'app:a', scope_type: 'scope_all', scope_payload: undefined },
      { resource: 'app:b', scope_type: 'scope_all', scope_payload: undefined },
    ]);
  });

  it('applies batch scope to all visible when none selected and batch is not self', () => {
    const payload = buildDataPolicySavePayload({
      dataPolicies: [policy('app:a', 'scope_self')],
      selectedResources: [],
      visibleResources: ['app:a', 'app:b'],
      batchScope: 'scope_all',
      grantedKeys: granted,
    });
    expect(payload).toEqual([
      { resource: 'app:a', scope_type: 'scope_all', scope_payload: undefined },
      { resource: 'app:b', scope_type: 'scope_all', scope_payload: undefined },
    ]);
  });

  it('keeps existing policies only when batch is self and nothing selected', () => {
    const payload = buildDataPolicySavePayload({
      dataPolicies: [policy('app:a', 'scope_self')],
      selectedResources: [],
      visibleResources: ['app:a', 'app:b'],
      batchScope: 'scope_self',
      grantedKeys: granted,
    });
    expect(payload).toEqual([{ resource: 'app:a', scope_type: 'scope_self', scope_payload: undefined }]);
  });
});
