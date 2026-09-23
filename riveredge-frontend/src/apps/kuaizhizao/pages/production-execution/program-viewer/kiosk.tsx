/**
 * 加工程序查看 - 工位机触屏模式页面
 *
 * 专门为工控机设计的全屏触屏加工程序查看界面，适合车间固定工位使用。
 * 特点：大按钮、大字体、全屏模式、触屏优化布局、语法高亮、行号、搜索。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Space, message, Spin, Empty, Input, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, FullscreenOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { TouchScreenTemplate } from '../../../../../components/layout-templates/hmi';
import { CODE_FONT_FAMILY } from '../../../../../constants/fonts';
import { useTouchScreen } from '../../../../../hooks/useTouchScreen';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';

const { Search } = Input;

/**
 * 加工程序查看 - 工位机触屏模式页面
 */
const ProgramViewerKioskPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const touchScreen = useTouchScreen();
  const [loading, setLoading] = useState(false);
  const [programCode, setProgramCode] = useState<string>('');
  const [programName, setProgramName] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const codeRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<any>(null);

  // 从URL参数获取程序代码或程序URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const programCode = params.get('programCode');
    const programUrl = params.get('programUrl');
    const name = params.get('name') || params.get('programName');

    if (code) {
      setProgramCode(code);
      setProgramName(name || t('app.kuaizhizao.programViewer.defaultName'));
    } else if (programCode) {
      setProgramCode(programCode);
      setProgramName(name || t('app.kuaizhizao.programViewer.defaultName'));
    } else if (programUrl) {
      loadProgramFromUrl(programUrl);
    } else {
      messageApi.warning(t('app.kuaizhizao.programViewer.needCodeOrUrl'));
    }
  }, []);

  /**
   * 从URL加载程序
   */
  const loadProgramFromUrl = async (url: string) => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(t('app.kuaizhizao.programViewer.loadFailed'));
      }
      const text = await response.text();
      setProgramCode(text);
      setProgramName(t('app.kuaizhizao.programViewer.defaultName'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.programViewer.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理搜索
   */
  const handleSearch = useCallback((keyword: string) => {
    if (!keyword || !programCode) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const lines = programCode.split('\n');
    const results: number[] = [];
    const lowerKeyword = keyword.toLowerCase();

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerKeyword)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);

    if (results.length > 0) {
      scrollToLine(results[0]);
      messageApi.success(t('app.kuaizhizao.programViewer.searchFound', { count: results.length }));
    } else {
      messageApi.warning(t('app.kuaizhizao.programViewer.searchEmpty'));
    }
  }, [programCode, messageApi, t]);

  /**
   * 滚动到指定行
   */
  const scrollToLine = useCallback((lineNumber: number) => {
    if (codeRef.current) {
      const lineElement = codeRef.current.querySelector(`[data-line="${lineNumber}"]`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 高亮当前行
        lineElement.classList.add('highlighted-line');
        setTimeout(() => {
          lineElement.classList.remove('highlighted-line');
        }, 2000);
      }
    }
  }, []);

  /**
   * 处理下一个搜索结果
   */
  const handleNextSearch = useCallback(() => {
    if (searchResults.length === 0) return;

    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToLine(searchResults[nextIndex]);
  }, [searchResults, currentSearchIndex, scrollToLine]);

  /**
   * 处理上一个搜索结果
   */
  const handlePreviousSearch = useCallback(() => {
    if (searchResults.length === 0) return;

    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    scrollToLine(searchResults[prevIndex]);
  }, [searchResults, currentSearchIndex, scrollToLine]);

  /**
   * 将纯文本按 G/M/坐标等规则切成 React 节点（不经 HTML 字符串）
   */
  const tokenizePlain = useCallback((text: string): React.ReactNode[] => {
    const re =
      /\b(G\d{1,2})\b|\b(M\d{1,2})\b|\b([XYZUVW])(-?\d+\.?\d*)\b|(;.*$|\(.*?\))|\b(\d+\.?\d*)\b/gi;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let key = 0;
    for (const m of text.matchAll(re)) {
      const idx = m.index ?? 0;
      if (idx > last) nodes.push(text.slice(last, idx));
      if (m[1]) nodes.push(<span key={key++} className="g-code">{m[1]}</span>);
      else if (m[2]) nodes.push(<span key={key++} className="m-code">{m[2]}</span>);
      else if (m[3]) nodes.push(<span key={key++} className="coordinate">{m[3]}{m[4]}</span>);
      else if (m[5]) nodes.push(<span key={key++} className="comment">{m[5]}</span>);
      else if (m[6]) nodes.push(<span key={key++} className="number">{m[6]}</span>);
      last = idx + m[0].length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes.length > 0 ? nodes : [text || ' '];
  }, []);

  /**
   * 高亮代码：按行 React 节点渲染 + mark 插高亮（P3-06：禁止 HTML 字符串注入）
   */
  const highlightCode = useCallback((code: string, keyword: string = '') => {
    if (!code) return null;

    const lines = code.split('\n');
    const lowerKeyword = keyword.toLowerCase();

    const renderLineBody = (line: string): React.ReactNode => {
      if (!keyword || !lowerKeyword) {
        return <>{tokenizePlain(line)}</>;
      }
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedKeyword})`, 'gi');
      const parts = line.split(regex);
      return (
        <>
          {parts.map((part, i) =>
            part.toLowerCase() === lowerKeyword ? (
              <mark key={i}>{part}</mark>
            ) : (
              <React.Fragment key={i}>{tokenizePlain(part)}</React.Fragment>
            ),
          )}
        </>
      );
    };

    return lines.map((line, index) => {
      const isSearchMatch = Boolean(keyword && line.toLowerCase().includes(lowerKeyword));
      const isCurrentSearch =
        searchResults.length > 0 &&
        currentSearchIndex >= 0 &&
        searchResults[currentSearchIndex] === index;

      return (
        <div
          key={index}
          data-line={index}
          style={{
            display: 'flex',
            minHeight: '40px',
            lineHeight: '40px',
            fontSize: '24px',
            fontFamily: CODE_FONT_FAMILY,
            backgroundColor: isCurrentSearch ? '#fff3cd' : isSearchMatch ? '#f0f0f0' : 'transparent',
            padding: '4px 8px',
            borderLeft: isCurrentSearch ? '4px solid #ffc107' : '4px solid transparent',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              minWidth: '60px',
              textAlign: 'right',
              color: '#999',
              marginRight: '16px',
              userSelect: 'none',
            }}
          >
            {index + 1}
          </span>
          <span
            style={{
              flex: 1,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {renderLineBody(line)}
          </span>
        </div>
      );
    });
  }, [searchKeyword, searchResults, currentSearchIndex, tokenizePlain]);

  /**
   * 处理下载程序
   */
  const handleDownload = useCallback(() => {
    if (!programCode) {
      messageApi.warning(t('app.kuaizhizao.programViewer.noDownload'));
      return;
    }

    try {
      const blob = new Blob([programCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${programName || 'program'}-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      messageApi.success(t('app.kuaizhizao.programViewer.downloadSuccess'));
    } catch (error: any) {
      messageApi.error(t('app.kuaizhizao.programViewer.downloadFailed', { message: error.message || t('app.kuaizhizao.programViewer.unknownError') }));
    }
  }, [programCode, programName, messageApi, t]);

  /**
   * 处理进入全屏
   */
  const handleEnterFullscreen = useCallback(async () => {
    try {
      await touchScreen.enterFullscreen();
      messageApi.success(t('app.kuaizhizao.programViewer.fullscreenOk'));
    } catch (error: any) {
      messageApi.error(t('app.kuaizhizao.programViewer.fullscreenFailed', { message: error.message || t('app.kuaizhizao.programViewer.unknownError') }));
    }
  }, [touchScreen, messageApi, t]);

  return (
    <TouchScreenTemplate
      title={programName || t('app.kuaizhizao.programViewer.pageTitle')}
      fullscreen={true}
      footerButtons={[
        {
          title: t('app.kuaizhizao.programViewer.prev'),
          type: 'default',
          icon: <UpOutlined />,
          onClick: handlePreviousSearch,
          disabled: searchResults.length === 0 || currentSearchIndex < 0,
          block: false,
        },
        {
          title: t('app.kuaizhizao.programViewer.searchBtn', { label: searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0' }),
          type: 'default',
          icon: <SearchOutlined />,
          onClick: () => searchInputRef.current?.focus(),
          block: false,
        },
        {
          title: t('app.kuaizhizao.programViewer.next'),
          type: 'default',
          icon: <DownOutlined />,
          onClick: handleNextSearch,
          disabled: searchResults.length === 0 || currentSearchIndex < 0,
          block: false,
        },
        {
          title: t('app.kuaizhizao.programViewer.download'),
          type: 'default',
          icon: <DownloadOutlined />,
          onClick: handleDownload,
          block: false,
        },
        {
          title: t('app.kuaizhizao.programViewer.fullscreen'),
          type: 'primary',
          icon: <FullscreenOutlined />,
          onClick: handleEnterFullscreen,
          block: false,
        },
      ]}
    >
      <Spin spinning={loading}>
        {!programCode ? (
          <Empty description={t('app.kuaizhizao.programViewer.empty')} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 程序信息 */}
            <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f5f5f5' }}>
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <strong>{t('app.kuaizhizao.programViewer.nameLabel')}</strong>
                  <span>{programName || t('app.kuaizhizao.programViewer.defaultName')}</span>
                </div>
                <div>
                  <strong>{t('app.kuaizhizao.programViewer.lineCountLabel')}</strong>
                  <Tag color="blue">{programCode.split('\n').length}</Tag>
                </div>
                {searchResults.length > 0 && (
                  <div>
                    <strong>{t('app.kuaizhizao.programViewer.searchResultLabel')}</strong>
                    <Tag color="green">{t('app.kuaizhizao.programViewer.matchCount', { count: searchResults.length })}</Tag>
                  </div>
                )}
              </Space>
            </Card>

            {/* 搜索框 */}
            <Card size="small" style={{ marginBottom: 24 }}>
              <Search
                ref={searchInputRef}
                placeholder={t('app.kuaizhizao.programViewer.searchPlaceholder')}
                size="large"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onSearch={handleSearch}
                enterButton={<SearchOutlined />}
                style={{ fontSize: 24 }}
                allowClear
              />
            </Card>

            {/* 程序代码显示区域 */}
            <Card
              title={t('app.kuaizhizao.programViewer.codeTitle')}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 24 }}
              styles={{ body: { flex: 1, overflow: 'auto', padding: 0 } }}
            >
              <div
                ref={codeRef}
                style={{
                  width: '100%',
                  height: '100%',
                  overflow: 'auto',
                  backgroundColor: '#fafafa',
                  fontFamily: CODE_FONT_FAMILY,
                  fontSize: '24px',
                  lineHeight: '40px',
                }}
              >
                {highlightCode(programCode, searchKeyword)}
              </div>
            </Card>
          </div>
        )}
      </Spin>

      {/* 代码高亮样式 */}
      <style>{`
        .g-code {
          color: #1890ff;
          font-weight: 600;
        }
        .m-code {
          color: #52c41a;
          font-weight: 600;
        }
        .coordinate {
          color: #fa8c16;
          font-weight: 500;
        }
        .comment {
          color: #8c8c8c;
          font-style: italic;
        }
        .number {
          color: #722ed1;
        }
        mark {
          background-color: #fff3cd;
          color: #856404;
          padding: 2px 4px;
          border-radius: 2px;
        }
        .highlighted-line {
          animation: highlight 0.5s ease;
        }
        @keyframes highlight {
          0% { background-color: #fff3cd; }
          100% { background-color: transparent; }
        }
      `}</style>
    </TouchScreenTemplate>
  );
};

export default ProgramViewerKioskPage;
