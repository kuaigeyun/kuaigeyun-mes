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
}) => {
    const currentTab = tabs.find(tab => tab.key === activeTabKey);

    return (
        <ListPageTemplate
            statCards={statCards}
            className={className}
            style={style}
        >
            {header && <div style={{ marginBottom: 16 }}>{header}</div>}
            <Card
                tabList={tabs.map(tab => ({ key: tab.key, tab: tab.label }))}
                activeTabKey={activeTabKey}
                onTabChange={onTabChange}
                tabBarExtraContent={tabBarExtraContent}
                styles={{ body: { padding } }}
            >
                {currentTab?.children}
            </Card>
        </ListPageTemplate>
    );
};

export default MultiTabListPageTemplate;
