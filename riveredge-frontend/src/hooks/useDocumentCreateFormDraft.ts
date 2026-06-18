import { useCallback, useEffect, useRef } from 'react';
import type { ProFormInstance } from '@ant-design/pro-components';
import { setDocumentFormDraft } from '../utils/documentFormDraftCache';

/**
 * 新建单据表单草稿：onValuesChange 实时写入 + 组件卸载前再快照一次（兜底 TAB 切换/移动端无缓存场景）。
 */
export function useDocumentCreateFormDraft(
  enabled: boolean,
  draftKey: string | null,
  formRef: React.RefObject<ProFormInstance | undefined>,
) {
  const enabledRef = useRef(enabled);
  const draftKeyRef = useRef(draftKey);
  enabledRef.current = enabled;
  draftKeyRef.current = draftKey;

  useEffect(() => {
    return () => {
      if (!enabledRef.current || !draftKeyRef.current) return;
      const values = formRef.current?.getFieldsValue(true);
      if (values && typeof values === 'object') {
        setDocumentFormDraft(draftKeyRef.current, values as Record<string, unknown>);
      }
    };
  }, [formRef]);

  return useCallback(
    (_changed: unknown, allValues: Record<string, unknown>) => {
      if (enabled && draftKey) {
        setDocumentFormDraft(draftKey, allValues);
      }
    },
    [enabled, draftKey],
  );
}
