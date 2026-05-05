/**
 * UniDropdown - 管理型下拉增强组件
 *
 * 在 Select 下拉列表下方增加「快速新建」「高级搜索」入口，可复用、可配置。
 * 支持按文案模糊搜索与拼音/拼音首字母搜索（依赖 pinyin-pro）。
 * 与 Form.Item 配合使用：<Form.Item name="customer_id"><UniDropdown options={...} quickCreate={...} advancedSearch={...} /></Form.Item>
 */

import React, { useState, useCallback, useEffect, useRef, forwardRef, useMemo, useImperativeHandle } from 'react';
import { Select, theme } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';
import type { QuickCreateConfig, AdvancedSearchConfig } from './types';
import { AdvancedSearchModal } from './AdvancedSearchModal';

export interface UniDropdownProps extends Omit<SelectProps, 'dropdownRender' | 'popupRender'> {
  /** 快速新建配置，不传则不显示 */
  quickCreate?: QuickCreateConfig;
  /** 高级搜索配置，不传则不显示 */
  advancedSearch?: AdvancedSearchConfig;
}

/** 下拉选项左对齐（Modal/居中容器内常继承 text-align:center，需显式覆盖） */
function mergeSelectPopupStyles(stylesProp: SelectProps['styles'] | undefined): SelectProps['styles'] {
  return {
    ...stylesProp,
    popup: {
      ...stylesProp?.popup,
      root: { textAlign: 'left', ...stylesProp?.popup?.root },
      list: { textAlign: 'left', ...stylesProp?.popup?.list },
      listItem: {
        justifyContent: 'flex-start',
        textAlign: 'left',
        ...stylesProp?.popup?.listItem,
      },
    },
  };
}

export const UniDropdown = forwardRef<any, UniDropdownProps>(({
  quickCreate,
  advancedSearch,
  onChange,
  filterOption,
  optionFilterProp,
  style,
  styles: stylesProp,
  ...selectProps
}, ref) => {
  const { token } = theme.useToken();
  const mergedStyles = useMemo(() => mergeSelectPopupStyles(stylesProp), [stylesProp]);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const pinyinMatchRef = useRef<((text: string, pattern: string) => any) | null>(null);
  const innerSelectRef = useRef<any>(null);
  const anchorWrapRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => innerSelectRef.current);

  // 动态加载 pinyin-pro，避免首屏同步引入
  useEffect(() => {
    import('pinyin-pro').then(m => { pinyinMatchRef.current = m.match; }).catch(() => {});
  }, []);

  // 模糊搜索：按 label 文案匹配 + 拼音/拼音首字母匹配（pinyin-pro 动态加载）
  const effectiveFilterOption =
    filterOption !== undefined
      ? filterOption
      : (input: string, option: any) => {
          const rawLabel = option?.label;
          const labelStr = typeof rawLabel === 'string' ? rawLabel : String(rawLabel ?? '');
          const inputTrim = (input || '').trim();
          if (!inputTrim) return true;
          const inputLower = inputTrim.toLowerCase();
          if (labelStr.toLowerCase().includes(inputLower)) return true;
          const matchFn = pinyinMatchRef.current;
          if (matchFn) {
            try {
              const result = matchFn(labelStr, inputTrim);
              return result != null && result.length > 0;
            } catch {
              return false;
            }
          }
          return false;
        };
  const effectiveOptionFilterProp = optionFilterProp ?? 'label';

  const handleAdvancedSearchSelect = useCallback(
    (value: any, label: string) => {
      onChange?.(value, { value, label });
      setAdvancedSearchOpen(false);
    },
    [onChange]
  );

  const popupRender = useCallback(
    (menu: React.ReactElement) => {
      const hasFooter = quickCreate || advancedSearch;
      if (!hasFooter) {
        return menu;
      }
      const footerStyle: React.CSSProperties = {
        borderTop: `1px solid ${token.colorBorder}`,
        padding: '4px 0',
        background: token.colorBgContainer,
      };
      const itemStyle: React.CSSProperties = {
        padding: '6px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: token.colorTextSecondary,
      };
      return (
        <>
          {menu}
          <div style={footerStyle}>
            {quickCreate && (
              <div
                role="button"
                tabIndex={0}
                style={itemStyle}
                onClick={() => {
                  innerSelectRef.current?.blur?.();
                  requestAnimationFrame(() => {
                    quickCreate.onClick(anchorWrapRef.current ?? undefined);
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    innerSelectRef.current?.blur?.();
                    requestAnimationFrame(() => {
                      quickCreate.onClick(anchorWrapRef.current ?? undefined);
                    });
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                  e.currentTarget.style.color = token.colorText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = token.colorTextSecondary;
                }}
              >
                <PlusOutlined />
                {quickCreate.label ?? '快速新建'}
              </div>
            )}
            {advancedSearch && (
              <div
                role="button"
                tabIndex={0}
                style={itemStyle}
                onClick={() => setAdvancedSearchOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setAdvancedSearchOpen(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                  e.currentTarget.style.color = token.colorText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = token.colorTextSecondary;
                }}
              >
                <SearchOutlined />
                {advancedSearch.label ?? '高级搜索'}
              </div>
            )}
          </div>
        </>
      );
    },
    [quickCreate, advancedSearch, token]
  );

  return (
    <>
      <div ref={anchorWrapRef} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <Select
          {...selectProps}
          styles={mergedStyles}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', ...style }}
          filterOption={effectiveFilterOption}
          optionFilterProp={effectiveOptionFilterProp}
          onChange={onChange}
          popupRender={popupRender}
          ref={innerSelectRef}
        />
      </div>
      {advancedSearch && (
        <AdvancedSearchModal
          open={advancedSearchOpen}
          onClose={() => setAdvancedSearchOpen(false)}
          title={advancedSearch.label ?? '高级搜索'}
          fields={advancedSearch.fields}
          onSearch={advancedSearch.onSearch}
          onSelect={handleAdvancedSearchSelect}
        />
      )}
    </>
  );
});

export type { QuickCreateConfig, AdvancedSearchConfig, AdvancedSearchField } from './types';
export { AdvancedSearchModal } from './AdvancedSearchModal';
export { QuickCreateAnchorPopover } from './QuickCreateAnchorPopover';
