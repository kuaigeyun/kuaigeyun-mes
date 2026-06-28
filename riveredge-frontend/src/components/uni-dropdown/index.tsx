/**
 * UniDropdown - 管理型下拉增强组件
 *
 * 在 Select 下拉列表下方增加「快速新建」「高级搜索」入口，可复用、可配置。
 * 支持按文案模糊搜索与拼音/拼音首字母搜索（依赖 pinyin-pro，全局单例懒加载）。
 * 与 Form.Item 配合使用：<Form.Item name="customer_id"><UniDropdown options={...} quickCreate={...} advancedSearch={...} /></Form.Item>
 */

import React, { useState, useCallback, useRef, forwardRef, useMemo, useImperativeHandle } from 'react';
import { Select, Button, theme } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';
import type { QuickCreateConfig, QuickEditConfig, AdvancedSearchConfig } from './types';
import { AdvancedSearchModal } from './AdvancedSearchModal';
import { ensurePinyinMatchLoaded } from '../../utils/pinyin';

export interface UniDropdownProps extends Omit<SelectProps, 'dropdownRender' | 'popupRender' | 'optionRender'> {
  /** 快速新建配置，不传则不显示 */
  quickCreate?: QuickCreateConfig;
  /** 多个快速新建入口（与 quickCreate 可同时存在，均会展示） */
  quickCreates?: QuickCreateConfig[];
  /** 选项行快速编辑（右侧编辑图标），不传则不显示 */
  quickEdit?: QuickEditConfig;
  /** 高级搜索配置，不传则不显示 */
  advancedSearch?: AdvancedSearchConfig;
  /** 自定义选项渲染（与 quickEdit 并存时，编辑按钮在右侧） */
  optionRender?: SelectProps['optionRender'];
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

const VIRTUAL_OPTION_THRESHOLD = 30;

export const UniDropdown = forwardRef<any, UniDropdownProps>(({
  quickCreate,
  quickCreates,
  quickEdit,
  advancedSearch,
  onChange,
  onOpenChange,
  filterOption,
  optionFilterProp,
  optionRender: optionRenderProp,
  style,
  styles: stylesProp,
  virtual: virtualProp,
  options: optionsProp,
  ...selectProps
}, ref) => {
  const { token } = theme.useToken();
  const mergedStyles = useMemo(() => mergeSelectPopupStyles(stylesProp), [stylesProp]);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const pinyinMatchRef = useRef<((text: string, pattern: string) => unknown) | null>(null);
  const pinyinLoadStartedRef = useRef(false);
  const innerSelectRef = useRef<any>(null);
  const anchorWrapRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => innerSelectRef.current);

  const warmupPinyin = useCallback(() => {
    if (pinyinLoadStartedRef.current) return;
    pinyinLoadStartedRef.current = true;
    ensurePinyinMatchLoaded()
      .then((fn) => {
        if (fn) pinyinMatchRef.current = fn;
      })
      .catch(() => {});
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) warmupPinyin();
      onOpenChange?.(open);
    },
    [onOpenChange, warmupPinyin],
  );

  // 模糊搜索：按 label 文案匹配 + 拼音/拼音首字母匹配（pinyin-pro 懒加载）
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
              return result != null && (result as unknown[]).length > 0;
            } catch {
              return false;
            }
          }
          return false;
        };
  const effectiveOptionFilterProp = optionFilterProp ?? 'label';

  const optionCount = Array.isArray(optionsProp) ? optionsProp.length : 0;
  const effectiveVirtual = virtualProp ?? (optionCount > VIRTUAL_OPTION_THRESHOLD);

  const effectiveOptionRender = useMemo(() => {
    if (!quickEdit) return optionRenderProp;
    return (option: Parameters<NonNullable<SelectProps['optionRender']>>[0], info: Parameters<NonNullable<SelectProps['optionRender']>>[1]) => {
      const labelNode = optionRenderProp ? optionRenderProp(option, info) : <span>{option.label}</span>;
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
            minWidth: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelNode}</div>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            title={quickEdit.label ?? '快速编辑'}
            aria-label={quickEdit.label ?? '快速编辑'}
            style={{ flexShrink: 0, color: token.colorTextSecondary }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              innerSelectRef.current?.blur?.();
              requestAnimationFrame(() => {
                quickEdit.onEdit(option.value, option, anchorWrapRef.current ?? undefined);
              });
            }}
          />
        </div>
      );
    };
  }, [optionRenderProp, quickEdit, token.colorTextSecondary]);

  const handleAdvancedSearchSelect = useCallback(
    (value: any, label: string) => {
      onChange?.(value, { value, label });
      setAdvancedSearchOpen(false);
    },
    [onChange],
  );

  const quickCreateEntries = useMemo(() => {
    const entries: QuickCreateConfig[] = [];
    if (quickCreate) entries.push(quickCreate);
    if (quickCreates?.length) entries.push(...quickCreates);
    return entries;
  }, [quickCreate, quickCreates]);

  const popupRender = useCallback(
    (menu: React.ReactElement) => {
      const hasFooter = quickCreateEntries.length > 0 || advancedSearch;
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
      const runQuickCreate = (cfg: QuickCreateConfig) => {
        innerSelectRef.current?.blur?.();
        requestAnimationFrame(() => {
          cfg.onClick(anchorWrapRef.current ?? undefined);
        });
      };
      return (
        <>
          {menu}
          <div style={footerStyle}>
            {quickCreateEntries.map((cfg, index) => (
              <div
                key={`${cfg.label ?? 'quick-create'}-${index}`}
                role="button"
                tabIndex={0}
                style={itemStyle}
                onClick={() => runQuickCreate(cfg)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runQuickCreate(cfg);
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
                {cfg.label ?? '快速新建'}
              </div>
            ))}
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
    [quickCreateEntries, advancedSearch, token],
  );

  return (
    <>
      <div ref={anchorWrapRef} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <Select
          {...selectProps}
          options={optionsProp}
          virtual={effectiveVirtual}
          styles={mergedStyles}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', ...style }}
          filterOption={effectiveFilterOption}
          optionFilterProp={effectiveOptionFilterProp}
          onChange={onChange}
          onOpenChange={handleOpenChange}
          popupRender={popupRender}
          optionRender={effectiveOptionRender}
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

export type { QuickCreateConfig, QuickEditConfig, AdvancedSearchConfig, AdvancedSearchField } from './types';
export { AdvancedSearchModal } from './AdvancedSearchModal';
export { QuickCreateAnchorPopover } from './QuickCreateAnchorPopover';
