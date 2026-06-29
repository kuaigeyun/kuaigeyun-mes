/**
 * 多标签页列表页面布局模板
 * 
 * 结合了 ListPageTemplate 的统计卡片功能和 Ant Design Card 的标签页切换功能
 * 专门用于像“计划排程”这样需要在同一个页面内切换多个相关列表布局的场景
 * 
 * Author: Antigravity
 * Date: 2026-02-02
 */

import React, { ReactNode } from 'react';
import { Card } from 'antd';
import ListPageTemplate, { StatCard } from './ListPageTemplate';

const MULTI_TAB_PAGE_ROOT_CLASS = 'multi-tab-list-page-template';

export interface TabItem {
    /** 标签唯一标识 */
    key: string;
    /** 标签标题 */
    label: ReactNode;
    /** 标签页内容 */
    children: ReactNode;
}

export interface MultiTabListPageTemplateProps {
    /** 统计卡片数据（可选） */
    statCards?: StatCard[];
    /** 当前激活的标签 Key */
    activeTabKey: string;
    /** 标签切换时的回调 */
    onTabChange: (key: string) => void;
    /** 标签页配置 */
    tabs: TabItem[];
    /** 自定义样式类名 */
    className?: string;
    /** 自定义样式 */
    style?: React.CSSProperties;
    /** 卡片主体内边距，默认为 16 */
    padding?: number | string;
    /** 页面头部内容（如图标、标题、操作按钮等），显示在卡片上方 */
    header?: ReactNode;
    /** 标签栏右侧附加内容（如操作按钮），显示在 Tab 标题栏右侧 */
    tabBarExtraContent?: ReactNode;
    /**
     * 为 true 时保留所有标签内容挂载（仅隐藏非当前项），避免切换时子树卸载导致列表状态丢失。
     * 默认 false，保持仅渲染当前标签（兼容既有页面性能）。
     */
    preserveMounted?: boolean;
    /** 透传 ListPageTemplate：主内容优先挂载，见 ListPageTemplate 说明 */
    prioritizeMainContentPaint?: boolean;
}

/**
 * 多标签页列表页面布局模板
 */
export const MultiTabListPageTemplate: React.FC<MultiTabListPageTemplateProps> = ({
    statCards,
    activeTabKey,
    onTabChange,
    tabs,
    className,
    style,
    padding = 16,
    header,
    tabBarExtraContent,
    preserveMounted = false,
    prioritizeMainContentPaint,
}) => {
    const currentTab = tabs.find(tab => tab.key === activeTabKey);

    const bodyInner = preserveMounted ? (
        <>
            {tabs.map((tab) => (
                <div
                    key={tab.key}
                    style={{
                        display: tab.key === activeTabKey ? 'block' : 'none',
                        ...(typeof padding === 'number' ? { padding } : { padding }),
                    }}
                >
                    {tab.children}
                </div>
            ))}
        </>
    ) : (
        currentTab?.children
    );

    return (
        <ListPageTemplate
            statCards={statCards}
            className={[MULTI_TAB_PAGE_ROOT_CLASS, className].filter(Boolean).join(' ')}
            style={style}
            prioritizeMainContentPaint={prioritizeMainContentPaint}
            fillMain
            tableScrollLayout="multiTab"
        >
            {header ? <div style={{ marginBottom: 16, flexShrink: 0 }}>{header}</div> : null}
            <Card
                className="multi-tab-list-page-card"
                style={{ flex: 1, minHeight: 0 }}
                tabList={tabs.map(tab => ({ key: tab.key, tab: tab.label }))}
                activeTabKey={activeTabKey}
                onTabChange={onTabChange}
                tabBarExtraContent={tabBarExtraContent}
                tabProps={{ size: 'middle' }}
                classNames={{ body: 'scrollbar-like-modal multi-tab-list-page-card-body' }}
                styles={{ body: preserveMounted ? { padding: 0 } : { padding } }}
            >
                {bodyInner}
            </Card>
        </ListPageTemplate>
    );
};

export default MultiTabListPageTemplate;
