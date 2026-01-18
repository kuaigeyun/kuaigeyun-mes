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
import { TouchScreenTemplate, TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { useTouchScreen } from '../../../../../hooks/useTouchScreen';
import { App } from 'antd';

const { Search } = Input;

/**
 * 加工程序查看 - 工位机触屏模式页面
 */
const ProgramViewerKioskPage: React.FC = () => {
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
      setProgramName(name || '加工程序');
    } else if (programCode) {
      setProgramCode(programCode);
      setProgramName(name || '加工程序');
    } else if (programUrl) {
      loadProgramFromUrl(programUrl);
    } else {
      messageApi.warning('请提供程序代码或程序URL');
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
        throw new Error('加载程序失败');
      }
      const text = await response.text();
      setProgramCode(text);
      setProgramName('加工程序');
    } catch (error: any) {
      messageApi.error(error.message || '加载程序失败');
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
      messageApi.success(`找到 ${results.length} 个匹配项`);
    } else {
      messageApi.warning('未找到匹配项');
    }
  }, [programCode, messageApi]);

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
   * 高亮代码（简单的G代码高亮）
   */
  const highlightCode = useCallback((code: string, keyword: string = '') => {
    if (!code) return '';

    const lines = code.split('\n');
    const lowerKeyword = keyword.toLowerCase();

    return lines.map((line, index) => {
      let highlightedLine = line;

      // 高亮搜索关键词
      if (keyword && lowerKeyword) {
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedLine = highlightedLine.replace(regex, '<mark>$1</mark>');
      }

      // 简单的G代码高亮
      // G代码（G00-G99）
      highlightedLine = highlightedLine.replace(/\b(G\d{1,2})\b/gi, '<span class="g-code">$1</span>');
      // M代码（M00-M99）
      highlightedLine = highlightedLine.replace(/\b(M\d{1,2})\b/gi, '<span class="m-code">$1</span>');
      // 坐标（X, Y, Z等）
      highlightedLine = highlightedLine.replace(/\b([XYZUVW])(-?\d+\.?\d*)\b/gi, '<span class="coordinate">$1$2</span>');
      // 注释（; 或 ( )）
      highlightedLine = highlightedLine.replace(/(;.*$|\(.*?\))/g, '<span class="comment">$1</span>');
      // 数字
      highlightedLine = highlightedLine.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');

      const isSearchMatch = keyword && line.toLowerCase().includes(lowerKeyword);
      const isCurrentSearch = searchResults.length > 0 && currentSearchIndex >= 0 && searchResults[currentSearchIndex] === index;

      return (
        <div
          key={index}
          data-line={index}
          style={{
            display: 'flex',
            minHeight: '40px',
            lineHeight: '40px',
            fontSize: '24px',
            fontFamily: 'monospace',
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
            dangerouslySetInnerHTML={{ __html: highlightedLine || ' ' }}
          />
        </div>
      );
    });
  }, [searchKeyword, searchResults, currentSearchIndex]);

  /**
   * 处理下载程序
   */
  const handleDownload = useCallback(() => {
    if (!programCode) {
      messageApi.warning('没有程序可下载');
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
      messageApi.success('程序下载成功');
    } catch (error: any) {
      messageApi.error(`下载程序失败: ${error.message || '未知错误'}`);
    }
  }, [programCode, programName, messageApi]);

  /**
   * 处理进入全屏
   */
  const handleEnterFullscreen = useCallback(async () => {
    try {
      await touchScreen.enterFullscreen();
      messageApi.success('已进入全屏模式');
    } catch (error: any) {
      messageApi.error(`进入全屏失败: ${error.message || '未知错误'}`);
    }
  }, [touchScreen, messageApi]);

  return (
    <TouchScreenTemplate
      title={programName || '加工程序查看'}
      fullscreen={true}
      footerButtons={[
        {
          title: '上一个',
          type: 'default',
          icon: <UpOutlined />,
          onClick: handlePreviousSearch,
          disabled: searchResults.length === 0 || currentSearchIndex < 0,
          block: false,
        },
        {
          title: `搜索 (${searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0'})`,
          type: 'default',
          icon: <SearchOutlined />,
          onClick: () => searchInputRef.current?.focus(),
          block: false,
        },
        {
          title: '下一个',
          type: 'default',
          icon: <DownOutlined />,
          onClick: handleNextSearch,
          disabled: searchResults.length === 0 || currentSearchIndex < 0,
          block: false,
        },
        {
          title: '下载',
          type: 'default',
          icon: <DownloadOutlined />,
          onClick: handleDownload,
          block: false,
        },
        {
          title: '全屏',
          type: 'primary',
          icon: <FullscreenOutlined />,
          onClick: handleEnterFullscreen,
          block: false,
        },
      ]}
    >
      <Spin spinning={loading}>
        {!programCode ? (
          <Empty description="未找到程序数据" />
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
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <strong>程序名称：</strong>
                  <span>{programName || '加工程序'}</span>
                </div>
                <div>
                  <strong>总行数：</strong>
                  <Tag color="blue">{programCode.split('\n').length}</Tag>
                </div>
                {searchResults.length > 0 && (
                  <div>
                    <strong>搜索结果：</strong>
                    <Tag color="green">{searchResults.length} 个匹配项</Tag>
                  </div>
                )}
              </Space>
            </Card>

            {/* 搜索框 */}
            <Card size="small" style={{ marginBottom: 24 }}>
              <Search
                ref={searchInputRef}
                placeholder="搜索程序内容（支持G代码、M代码、坐标等）"
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
              title="程序代码"
              style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 24 }}
              bodyStyle={{ flex: 1, overflow: 'auto', padding: 0 }}
            >
              <div
                ref={codeRef}
                style={{
                  width: '100%',
                  height: '100%',
                  overflow: 'auto',
                  backgroundColor: '#fafafa',
                  fontFamily: 'monospace',
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
