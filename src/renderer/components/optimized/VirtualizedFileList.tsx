/**
 * 虚拟化文件列表组件
 * 使用虚拟滚动优化大量文件的渲染性能
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Empty, Spin, Input, Select, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { renderOptimizer } from '../../performance/render-optimizer';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { CustomIcon } from '../CustomIcon';

const { Search } = Input;
const { Option } = Select;

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  lastModified: Date;
  icon?: string;
}

interface VirtualizedFileListProps {
  files: FileItem[];
  loading?: boolean;
  onFileSelect?: (file: FileItem) => void;
  onFileOpen?: (file: FileItem) => void;
  onRefresh?: () => void;
  height?: number;
  itemHeight?: number;
}

export const VirtualizedFileList: React.FC<VirtualizedFileListProps> = ({
  files,
  loading = false,
  onFileSelect,
  onFileOpen,
  onRefresh,
  height = 400,
  itemHeight = 60
}) => {
  const { t } = useTranslation(['file', 'common']);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // 性能监控
  const { startRenderMeasurement, endRenderMeasurement } =
    usePerformanceMonitor('VirtualizedFileList');

  // 过滤和搜索文件
  const filteredFiles = useMemo(() => {
    startRenderMeasurement();
    
    let result = files;

    // 搜索过滤
    if (searchTerm) {
      result = result.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.path.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 类型过滤
    if (filterType !== 'all') {
      result = result.filter(file => file.type === filterType);
    }

    endRenderMeasurement();
    return result;
  }, [files, searchTerm, filterType, startRenderMeasurement, endRenderMeasurement]);

  // 虚拟滚动计算
  const virtualScrollData = useMemo(() => {
    return renderOptimizer.calculateVirtualScrollItems(
      height,
      itemHeight,
      filteredFiles.length,
      scrollTop,
      5 // overscan
    );
  }, [height, itemHeight, filteredFiles.length, scrollTop]);

  // 可见的文件项
  const visibleFiles = useMemo(() => {
    const { startIndex, endIndex } = virtualScrollData;
    return filteredFiles.slice(startIndex, endIndex + 1).map((file, index) => ({
      ...file,
      virtualIndex: startIndex + index
    }));
  }, [filteredFiles, virtualScrollData]);

  // 优化的滚动处理
  const handleScroll = useCallback(
    renderOptimizer.createThrottle((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }, 16), // 60fps
    []
  );

  // 优化的搜索处理
  const handleSearch = useCallback(
    renderOptimizer.createDebounce((value: string) => {
      setSearchTerm(value);
      setScrollTop(0); // 重置滚动位置
    }, 300),
    []
  );

  // 文件选择处理
  const handleFileSelect = useCallback((file: FileItem) => {
    setSelectedFile(file.id);
    onFileSelect?.(file);
  }, [onFileSelect]);

  // 文件打开处理
  const handleFileOpen = useCallback((file: FileItem) => {
    onFileOpen?.(file);
  }, [onFileOpen]);

  // 获取文件类型选项
  const fileTypeOptions = useMemo(() => {
    const types = new Set(files.map(file => file.type));
    return Array.from(types).map(type => ({
      label: t(`file:types.${type}`, type),
      value: type
    }));
  }, [files, t]);

  // 渲染文件项
  const renderFileItem = useCallback((file: FileItem & { virtualIndex: number }) => {
    return (
      <div
        key={file.id}
        style={{
          height: itemHeight,
          padding: '8px 16px',
          borderBottom: '1px solid #f0f0f0',
          cursor: 'pointer',
          backgroundColor: selectedFile === file.id ? '#e6f7ff' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
        onClick={() => handleFileSelect(file)}
        onDoubleClick={() => handleFileOpen(file)}
      >
        <CustomIcon
          filePath={file.path}
          size={32}
        />
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: 500, 
            fontSize: '14px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {file.name}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#666',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {file.path}
          </div>
        </div>
        
        <div style={{ 
          fontSize: '12px', 
          color: '#999',
          textAlign: 'right',
          flexShrink: 0
        }}>
          <div>{(file.size / 1024).toFixed(1)} KB</div>
          <div>{file.lastModified.toLocaleDateString()}</div>
        </div>
      </div>
    );
  }, [itemHeight, selectedFile, handleFileSelect, handleFileOpen]);

  // 初始化性能监控
  useEffect(() => {
    renderOptimizer.initializeMonitoring();
    return () => renderOptimizer.cleanup();
  }, []);

  if (loading) {
    return (
      <Card style={{ height }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%' 
        }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card style={{ height }}>
        <Empty
          description={t('file:empty.description')}
          style={{ marginTop: '20%' }}
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <span>{t('file:list.title')} ({filteredFiles.length})</span>
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            size="small"
          >
            {t('common:refresh')}
          </Button>
        </Space>
      }
      extra={
        <Space>
          <Search
            placeholder={t('file:search.placeholder')}
            allowClear
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 120 }}
            size="small"
          >
            <Option value="all">{t('file:filter.all')}</Option>
            {fileTypeOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Space>
      }
      bodyStyle={{ padding: 0 }}
      style={{ height }}
    >
      <div
        ref={containerRef}
        style={{
          height: height - 60, // 减去header高度
          overflow: 'auto'
        }}
        onScroll={handleScroll}
      >
        {/* 虚拟滚动容器 */}
        <div style={{ height: filteredFiles.length * itemHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${virtualScrollData.offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            {visibleFiles.map(renderFileItem)}
          </div>
        </div>
      </div>
      
      {/* 性能信息（开发模式） */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          right: 0, 
          background: 'rgba(0,0,0,0.7)', 
          color: 'white', 
          padding: '4px 8px', 
          fontSize: '10px' 
        }}>
          渲染项: {virtualScrollData.visibleItems} / {filteredFiles.length}
        </div>
      )}
    </Card>
  );
};
