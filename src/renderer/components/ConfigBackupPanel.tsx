/**
 * 配置备份管理面板
 * 提供配置备份的查看、恢复和管理功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  message,
  Popconfirm,
  Tag,
  Tooltip,
  Select,
  Row,
  Col,
  Statistic,
  Alert,
} from 'antd';
import {
  HistoryOutlined,
  RollbackOutlined,

  DownloadOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { BackupInfo as SharedBackupInfo } from '@shared/ipc-types';

const { Title, Text } = Typography;
const { Option } = Select;

// 备份信息接口
interface BackupInfo {
  filename: string;
  metadata: {
    version: string;
    timestamp: number;
    configType: string;
    checksum: string;
    description?: string;
  };
  filePath: string;
  size: number;
}

export const ConfigBackupPanel: React.FC = () => {
  const { t } = useTranslation(['config', 'common']);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConfigType, setSelectedConfigType] = useState<string>('');

  // 加载备份列表
  const loadBackups = useCallback(async (configType?: string) => {
    try {
      setLoading(true);
      if (window.electronAPI) {
        const backupList = await window.electronAPI.config.getBackupList(configType);
        // 转换共享类型到本地类型
        const convertedBackups: BackupInfo[] = (backupList.backups || []).map((backup: SharedBackupInfo) => ({
          filename: backup.name,
          metadata: {
            version: '1.0',
            timestamp: new Date(backup.createdAt).getTime(),
            configType: backup.type,
            checksum: backup.id,
            description: backup.description
          },
          filePath: backup.id,
          size: backup.size
        }));
        setBackups(convertedBackups);
      }
    } catch (error) {
      message.error(t('config:messages.loadBackupsFailed'));
      console.error('Load backups error:', error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 恢复配置
  const handleRestore = async (backup: BackupInfo) => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.config.restoreFromBackup(
          backup.filePath,
          backup.metadata.configType
        );

        if (success) {
          message.success(t('config:messages.restoreSuccess', '配置恢复成功'));
          // 刷新备份列表
          await loadBackups(selectedConfigType);
        } else {
          message.error(t('config:messages.restoreFailed', '配置恢复失败'));
        }
      }
    } catch (error) {
      message.error(t('config:messages.restoreError', '恢复配置时发生错误'));
      console.error('Restore config error:', error);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 获取配置类型颜色
  const getConfigTypeColor = (configType: string): string => {
    const colors: { [key: string]: string } = {
      'app-settings': 'blue',
      'theme-config': 'purple',
      'layout-config': 'green',
      'i18n-config': 'orange',
      'user-preferences': 'cyan',
    };
    return colors[configType] || 'default';
  };

  // 表格列定义
  const columns = [
    {
      title: t('config:table.configType'),
      dataIndex: ['metadata', 'configType'],
      key: 'configType',
      render: (configType: string) => (
        <Tag color={getConfigTypeColor(configType)}>
          {configType}
        </Tag>
      ),
    },
    {
      title: t('config:table.timestamp'),
      dataIndex: ['metadata', 'timestamp'],
      key: 'timestamp',
      render: (timestamp: number) => formatTime(timestamp),
      sorter: (a: BackupInfo, b: BackupInfo) => a.metadata.timestamp - b.metadata.timestamp,
    },
    {
      title: t('config:table.description'),
      dataIndex: ['metadata', 'description'],
      key: 'description',
      render: (description?: string) => description ?? t('common:app.autoBackup', '自动备份'),
    },
    {
      title: t('config:table.size'),
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatFileSize(size),
    },
    {
      title: t('config:table.checksum'),
      dataIndex: ['metadata', 'checksum'],
      key: 'checksum',
      render: (checksum: string) => (
        <Tooltip title={checksum}>
          <Text code style={{ fontSize: '12px' }}>
            {checksum.substring(0, 8)}...
          </Text>
        </Tooltip>
      ),
    },
    {
      title: t('config:table.actions'),
      key: 'actions',
      render: (_: unknown, backup: BackupInfo) => (
        <Space>
          <Tooltip title={t('config:backup.restoreTooltip')}>
            <Popconfirm
              title={t('config:backup.confirmRestore')}
              description={t('config:backup.restoreWarning')}
              onConfirm={() => handleRestore(backup)}
              okText={t('config:common.confirm')}
              cancelText={t('config:common.cancel')}
            >
              <Button
                type="primary"
                size="small"
                icon={<RollbackOutlined />}
              >
                {t('config:actions.restore')}
              </Button>
            </Popconfirm>
          </Tooltip>
          <Tooltip title={t('config:backup.downloadTooltip')}>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => {
                // TODO: 实现下载功能
                message.info(t('common:messages.downloadInProgress', '下载功能开发中...'));
              }}
            >
              {t('config:actions.download')}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 统计信息
  const stats = {
    totalBackups: backups.length,
    totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
    configTypes: [...new Set(backups.map(b => b.metadata.configType))].length,
    latestBackup: backups.length > 0 ? Math.max(...backups.map(b => b.metadata.timestamp)) : 0,
  };

  // 初始化加载
  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  // 配置类型变更时重新加载
  useEffect(() => {
    loadBackups(selectedConfigType || undefined);
  }, [selectedConfigType, loadBackups]);

  return (
    <div className="config-backup-panel">
      <Card className="apple-card">
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>
            <HistoryOutlined style={{ marginRight: 8 }} />
            {t('config:backup.title')}
          </Title>
          <Text type="secondary">
            {t('config:backup.description')}
          </Text>
        </div>

        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title={t('config:backup.totalBackups')}
              value={stats.totalBackups}
              prefix={<HistoryOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('config:backup.totalSize')}
              value={formatFileSize(stats.totalSize)}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('config:backup.configTypes')}
              value={stats.configTypes}
              suffix={t('config:common.types')}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('config:backup.latestBackup')}
              value={stats.latestBackup ? formatTime(stats.latestBackup) : t('config:backup.noBackups')}
              valueStyle={{ fontSize: '14px' }}
            />
          </Col>
        </Row>

        {/* 操作栏 */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Select
                placeholder={t('config:backup.selectConfigType')}
                style={{ width: 200 }}
                value={selectedConfigType}
                onChange={setSelectedConfigType}
                allowClear
              >
                <Option value="app-settings">{t('config:configTypes.appSettings')}</Option>
                <Option value="theme-config">{t('config:configTypes.themeConfig')}</Option>
                <Option value="layout-config">{t('config:configTypes.layoutConfig')}</Option>
                <Option value="i18n-config">{t('config:configTypes.i18nConfig')}</Option>
                <Option value="user-preferences">{t('config:configTypes.userPreferences')}</Option>
              </Select>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => loadBackups(selectedConfigType || undefined)}
                loading={loading}
              >
                {t('config:actions.refresh')}
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 提示信息 */}
        <Alert
          message={t('config:backup.infoTitle')}
          description={t('config:backup.infoDescription')}
          type="info"
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
          showIcon
        />

        {/* 备份列表表格 */}
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="filename"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              t('config:backup.paginationText', { start: range[0], end: range[1], total }),
          }}
          scroll={{ x: 800 }}
          size="small"
        />
      </Card>
    </div>
  );
};
