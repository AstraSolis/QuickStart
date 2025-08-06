/**
 * QuickStart 日志查看器面板
 *
 * 提供日志查看、过滤、搜索和导出功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Alert,
  Spin,
  Result
} from 'antd';
import {
  ReloadOutlined,
  ExportOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { LogEntry } from '../../shared/ipc-types';

const { Title } = Typography;

interface LogsPanelProps {
  className?: string;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ className }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 加载日志数据
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 检查electronAPI是否可用
      if (!window.electronAPI?.logs) {
        throw new Error(t('logs_panel.error.load_failed', 'Failed to load logs'));
      }

      const response = await window.electronAPI.logs.query({
        limit: 100,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      });

      if (response.success && response.data) {
        setLogs(response.data);
        console.info('Logs loaded successfully');
      } else {
        setError(response.error ?? t('logs_panel.error.load_failed', 'Failed to load logs'));
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setError(error instanceof Error ? error.message : t('logs_panel.error.load_failed', 'Failed to load logs'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 初始化加载
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className={`logs-panel-container page-container ${className ?? ''}`}>
      <Card
        className="apple-card"
        style={{
          background: 'var(--glass-background)',
          backdropFilter: 'var(--glass-backdrop-filter)',
        }}
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <FileSearchOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
          <Title level={3}>{t('logs_panel.title', 'Log Viewer')}</Title>

          {error ? (
            <Alert
              message={t('logs_panel.error.load_failed', 'Failed to load logs')}
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          ) : loading ? (
            <Spin size="large" />
          ) : (
            <Result
              icon={<FileSearchOutlined />}
              title={t('logs_panel.info.system_ready', 'Log system is ready')}
              subTitle={t('logs_panel.info.logs_loaded', 'Loaded {{count}} log entries', { count: logs.length })}
              extra={
                <Space>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={loadLogs}
                    loading={loading}
                  >
                    {t('logs_panel.actions.refresh', 'Refresh Logs')}
                  </Button>
                  <Button
                    icon={<ExportOutlined />}
                    onClick={() => {
                      if (window.electronAPI?.logs?.export) {
                        window.electronAPI.logs.export({}).then((response: { success: boolean; filePath?: string; error?: string }) => {
                          if (response.success) {
                            console.log(t('logs_panel.info.export_success', 'Logs exported successfully'));
                          }
                        }).catch(console.error);
                      }
                    }}
                  >
                    {t('logs_panel.actions.export', 'Export Logs')}
                  </Button>
                </Space>
              }
            />
          )}

          {logs.length > 0 && (
            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <Title level={4}>{t('logs:logs_panel.ui.recent_logs', '最近日志')}</Title>
              <div style={{
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                padding: '12px',
                background: 'var(--color-background)',
                minHeight: '200px'
              }}>
                {logs.slice(0, 10).map((log: LogEntry, index: number) => (
                  <div key={index} style={{ marginBottom: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
                    <span style={{ color: '#666' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span style={{ margin: '0 8px', color: log.level >= 4 ? '#ff4d4f' : log.level === 3 ? '#faad14' : '#52c41a' }}>
                      [{['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'][log.level] || 'INFO'}]
                    </span>
                    <span style={{ color: '#1890ff' }}>{log.source}</span>
                    <span style={{ margin: '0 8px' }}>-</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LogsPanel;
