import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  List,
  Button,
  Space,
  Typography,

  Upload,
  message,
  Tooltip,
  Tag
} from 'antd';
import {
  PlusOutlined,
  FolderOpenOutlined,
  FileOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  InboxOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useLayoutConfig } from '../hooks/useConfig';
import { waitForElectronAPI } from '../utils/electronAPI';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// 文件项类型定义 (SQLite版本)
interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  description?: string;
  launchArgs?: string;
  requireAdmin: boolean;
  category?: {
    id: number;
    name: string;
    color?: string;
    icon?: string;
  };
  tags?: string[];
  iconPath?: string;
  size?: number;
  lastModified: Date;
  addedAt: Date;
  lastLaunched?: Date;
  launchCount: number;
  isFavorite: boolean;
  isPinned: boolean;
  sortOrder: number;
  isEnabled: boolean;
}

// 数据库返回的文件项类型（日期为字符串）
interface FileItemFromDB {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  description?: string;
  launchArgs?: string;
  requireAdmin: boolean;
  category?: {
    id: number;
    name: string;
    color?: string;
    icon?: string;
  };
  tags?: string[];
  iconPath?: string;
  size?: number;
  lastModified: string; // 数据库中为字符串
  addedAt: string; // 数据库中为字符串
  lastLaunched?: string; // 数据库中为字符串
  launchCount: number;
  isFavorite: boolean;
  isPinned: boolean;
  sortOrder: number;
  isEnabled: boolean;
}

// Electron File对象扩展（包含path属性）
interface ElectronFile extends File {
  path: string;
}

// Upload组件的info参数类型
interface UploadChangeInfo {
  fileList: Array<{
    originFileObj?: File;
    uid: string;
    name: string;
    status?: 'uploading' | 'done' | 'error' | 'removed';
    response?: unknown;
    error?: unknown;
    linkProps?: unknown;
    xhr?: unknown;
  }>;
}

export const FileList: React.FC = () => {
  const { t } = useTranslation(['file', 'common']);
  const { themeConfig } = useTheme();
  const { config: layoutConfig } = useLayoutConfig();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 加载文件列表
  const loadFileList = useCallback(async () => {
    try {
      setRefreshing(true);

      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const result = await window.electronAPI.file.getList();

      // 检查返回格式
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success && result.data) {
          const files = result.data as FileItemFromDB[] ?? [];
          setFileList(files.map((file: FileItemFromDB): FileItem => ({
            ...file,
            lastModified: new Date(file.lastModified),
            addedAt: new Date(file.addedAt),
            lastLaunched: file.lastLaunched ? new Date(file.lastLaunched) : undefined,
          })));
        } else {
          throw new Error(result.error ?? 'Failed to load file list');
        }
      } else {
        // 兼容旧格式（直接返回数组）
        const files = (Array.isArray(result) ? result : []) as FileItemFromDB[];
        setFileList(files.map((file: FileItemFromDB): FileItem => ({
          ...file,
          lastModified: new Date(file.lastModified),
          addedAt: new Date(file.addedAt),
          lastLaunched: file.lastLaunched ? new Date(file.lastLaunched) : undefined,
        })));
      }
    } catch (error) {
      message.error(t('file:messages.loadFailed'));
      console.error('Load file list error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  // 组件挂载时加载文件列表
  useEffect(() => {
    loadFileList();
  }, [loadFileList]);

  // 添加文件
  const handleAddFile = async () => {
    try {
      setLoading(true);

      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const filePath = await window.electronAPI.file.selectFile();
      if (filePath) {
        const result = await window.electronAPI.file.add(filePath);
        if (result.success && result.data) {
          message.success(t('common:messages.fileAddSuccess'));
          await loadFileList(); // 重新加载列表
        } else {
          message.error(t('common:messages.fileAddFailed'));
        }
      }
    } catch (error) {
      message.error(t('common:messages.fileAddFailed'));
      console.error('Add file error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加文件夹
  const handleAddFolder = async () => {
    try {
      setLoading(true);

      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const folderPath = await window.electronAPI.file.selectFolder();
      if (folderPath) {
        const result = await window.electronAPI.file.add(folderPath);
        if (result.success && result.data) {
          message.success(t('common:messages.folderAddSuccess'));
          await loadFileList(); // 重新加载列表
        } else {
          message.error(t('common:messages.folderAddFailed'));
        }
      }
    } catch (error) {
      message.error(t('common:messages.folderAddFailed'));
      console.error('Add folder error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 启动文件
  const handleLaunchFile = async (file: FileItem) => {
    try {
      setLoading(true);

      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const result = await window.electronAPI.file.launch(file.id);

      // 检查返回格式
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          message.success(t('file:messages.launchSuccess', { name: file.name }));
          await loadFileList(); // 重新加载列表以更新启动次数
        } else {
          message.error(result.error ?? t('file:messages.launchFailed', { name: file.name }));
        }
      } else {
        // 兼容旧格式（直接返回boolean）
        if (result) {
          message.success(t('file:messages.launchSuccess', { name: file.name }));
          await loadFileList(); // 重新加载列表以更新启动次数
        } else {
          message.error(t('file:messages.launchFailed', { name: file.name }));
        }
      }
    } catch (error) {
      message.error(t('file:messages.launchError'));
      console.error('Launch file error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 删除文件
  const handleDeleteFile = async (fileId: string) => {
    try {
      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const result = await window.electronAPI.file.remove(fileId);

      // 检查返回格式
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          message.success(t('common:messages.fileRemoveSuccess'));
          await loadFileList(); // 重新加载列表
        } else {
          message.error(result.error ?? t('common:messages.fileRemoveFailed'));
        }
      } else {
        // 兼容旧格式（直接返回boolean）
        if (result) {
          message.success(t('common:messages.fileRemoveSuccess'));
          await loadFileList(); // 重新加载列表
        } else {
          message.error(t('common:messages.fileRemoveFailed'));
        }
      }
    } catch (error) {
      message.error(t('common:messages.fileRemoveError'));
      console.error('Delete file error:', error);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // 处理拖拽文件
  const handleDragFiles = async (files: File[]) => {
    try {
      setLoading(true);

      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const filePaths = files
        .map(file => (file as ElectronFile).path)
        .filter((path): path is string => Boolean(path));
      if (filePaths.length > 0) {
        const result = await window.electronAPI.file.addMultiple(filePaths);
        if (result.success && result.data) {
          const addedFiles = result.data as FileItemFromDB[];
          if (addedFiles.length > 0) {
            message.success(t('file:messages.dragFilesSuccess', { count: addedFiles.length }));
            await loadFileList(); // 重新加载列表
          } else {
            message.error(t('file:messages.dragFilesFailed'));
          }
        } else {
          message.error(t('file:messages.dragFilesFailed'));
        }
      } else {
        message.warning(t('file:messages.dragFilesWarning'));
      }
    } catch (error) {
      message.error(t('file:messages.dragFilesError'));
      console.error('Handle drag files error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 拖拽上传配置
  const uploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: () => false, // 阻止自动上传
    onChange: (info: UploadChangeInfo) => {
      const { fileList: uploadFileList } = info;
      const files = uploadFileList
        .map(item => item.originFileObj)
        .filter((file): file is File => Boolean(file));
      if (files.length > 0) {
        handleDragFiles(files);
      }
    },
  };

  return (
    <div className="file-list-container page-container">
      <Card
        className="apple-card"
        style={{
          background: themeConfig.glassEffect
            ? 'var(--glass-background)'
            : 'rgba(255, 255, 255, 0.8)', // 半透明背景，不完全遮挡
          backdropFilter: themeConfig.glassEffect
            ? 'var(--glass-backdrop-filter)'
            : 'blur(10px)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('file:ui.title')}
          </Title>
          <Text type="secondary">
            {t('file:ui.description')}
          </Text>
        </div>

        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddFile}
            loading={loading}
            className="apple-button"
          >
            {t('file:actions.addFile')}
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleAddFolder}
            loading={loading}
            className="apple-button"
          >
            {t('file:actions.addFolder')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadFileList}
            loading={refreshing}
            className="apple-button"
          >
            {t('file:actions.refresh')}
          </Button>
        </Space>

        {fileList.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Dragger {...uploadProps} style={{ border: 'none', background: 'transparent' }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 48, color: themeConfig.primaryColor }} />
              </p>
              <p className="ant-upload-text">
                {t('file:messages.dragDropHint')}
              </p>
              <p className="ant-upload-hint">
                {t('file:messages.dragDropSupport')}
              </p>
            </Dragger>
          </Card>
        ) : (
          <List
            dataSource={fileList}
            renderItem={(file) => (
              <List.Item
                key={file.id}
                actions={[
                  <Tooltip title={t('file:messages.launchTooltip')}>
                    <Button
                      type="text"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleLaunchFile(file)}
                      loading={loading}
                      style={{ color: themeConfig.primaryColor }}
                    />
                  </Tooltip>,
                  <Tooltip title={t('file:messages.deleteTooltip')}>
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteFile(file.id)}
                      danger
                    />
                  </Tooltip>,
                ]}
                style={{
                  padding: '12px 16px',
                  borderRadius: themeConfig.borderRadius,
                  marginBottom: 8,
                  background: themeConfig.glassEffect
                    ? 'rgba(255, 255, 255, 0.1)'
                    : themeConfig.customColors.surface,
                  border: `1px solid ${themeConfig.customColors.border}`,
                  transition: 'all 0.3s ease',
                }}
                className="file-list-item"
              >
                <List.Item.Meta
                  avatar={
                    file.type === 'folder' ? (
                      <FolderOpenOutlined style={{ fontSize: 24, color: '#faad14' }} />
                    ) : (
                      <FileOutlined style={{ fontSize: 24, color: themeConfig.primaryColor }} />
                    )
                  }
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong>{file.name}</Text>
                      <Tag color={file.type === 'folder' ? 'orange' : 'blue'}>
                        {t(`file:types.${file.type}`)}
                      </Tag>
                    </div>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {file.path}
                      </Text>
                      <br />
                      <Space size="small" direction="vertical" style={{ width: '100%' }}>
                        <Space size="small">
                          {layoutConfig?.fileList?.showModifiedTime !== false && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('file:ui.modifiedTime', { date: file.lastModified.toLocaleDateString() })}
                            </Text>
                          )}
                          {layoutConfig?.fileList?.showSize !== false && file.size && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('file:ui.fileSize', { size: formatFileSize(file.size) })}
                            </Text>
                          )}
                        </Space>
                        <Space size="small">
                          {layoutConfig?.fileList?.showAddedTime !== false && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('file:ui.addedTime', { date: file.addedAt.toLocaleDateString() })}
                            </Text>
                          )}
                          {layoutConfig?.fileList?.showLaunchCount !== false && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('file:ui.launchCount', { count: file.launchCount })}
                            </Text>
                          )}
                          {file.lastLaunched && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('file:ui.lastLaunched', { date: file.lastLaunched.toLocaleDateString() })}
                            </Text>
                          )}
                        </Space>
                      </Space>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};
