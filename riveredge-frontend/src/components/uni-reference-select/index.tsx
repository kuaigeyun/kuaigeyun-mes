/**
 * 通用引用资源下拉（基于 /core/reference/display-*）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { UniDropdown, type UniDropdownProps } from './uni-dropdown';
import {
  ReferenceDisplayAccessError,
  formatReferenceDisplayLabel,
  referenceDisplayToIdOptions,
  searchReferenceDisplay,
} from '../utils/referenceDisplay';

export type UniReferenceSelectProps = Omit<
  UniDropdownProps,
  'options' | 'loading' | 'advancedSearch'
> & {
  /** 全局 resource_key，如 master-data:supply-chain:customer */
  resource: string;
  /** 宿主 {app}:{module}，供隐式 display 鉴权 */
  hostResource?: string;
  pageSize?: number;
  autoLoad?: boolean;
  onAccessDenied?: (error: ReferenceDisplayAccessError) => void;
};

export const UniReferenceSelect: React.FC<UniReferenceSelectProps> = ({
  resource,
  hostResource,
  pageSize = 200,
  autoLoad = true,
  onAccessDenied,
  ...rest
}) => {
  const { message: messageApi } = App.useApp();
  const [options, setOptions] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ReferenceDisplayAccessError) {
        setAccessDenied(true);
        setOptions([]);
        onAccessDenied?.(err);
        messageApi.warning(err.message);
        return;
      }
      messageApi.error(err instanceof Error ? err.message : '引用资源加载失败');
      setOptions([]);
    },
    [messageApi, onAccessDenied],
  );

  const loadOptions = useCallback(
    async (keyword?: string) => {
      setLoading(true);
      try {
        const res = await searchReferenceDisplay({
          resource,
          hostResource,
          keyword,
          pageSize,
        });
        setAccessDenied(false);
        setOptions(referenceDisplayToIdOptions(res.items));
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError, hostResource, pageSize, resource],
  );

  useEffect(() => {
    if (autoLoad) {
      void loadOptions();
    }
  }, [autoLoad, loadOptions]);

  const advancedSearch = useMemo(
    () => ({
      label: '搜索',
      fields: [{ name: 'keyword', label: '关键词' }],
      onSearch: async (values: { keyword?: string }) => {
        try {
          const res = await searchReferenceDisplay({
            resource,
            hostResource,
            keyword: values.keyword,
            pageSize,
          });
          return referenceDisplayToIdOptions(res.items).map((o) => ({
            ...o,
            label: o.label || formatReferenceDisplayLabel({ label: o.label, id: o.value }),
          }));
        } catch (err) {
          if (err instanceof ReferenceDisplayAccessError) {
            handleError(err);
            return [];
          }
          return [];
        }
      },
    }),
    [handleError, hostResource, pageSize, resource],
  );

  return (
    <UniDropdown
      {...rest}
      showSearch
      allowClear
      loading={loading}
      options={options}
      disabled={rest.disabled || accessDenied}
      notFoundContent={accessDenied ? '无引用权限' : undefined}
      advancedSearch={advancedSearch}
    />
  );
};
