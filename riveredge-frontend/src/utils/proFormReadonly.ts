import { useContext } from 'react';
import { ProForm } from '@ant-design/pro-components';

/** 合并 ProForm 只读上下文与字段级 readonly（详情页常只设 ProForm.readonly） */
export function useProFormReadonlyMode(explicitReadonly?: boolean): boolean {
  const ctx = useContext(ProForm.EditOrReadOnlyContext);
  return explicitReadonly === true || ctx?.mode === 'read';
}
