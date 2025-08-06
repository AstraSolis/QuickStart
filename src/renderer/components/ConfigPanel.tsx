/**
 * 配置管理面板组件
 * 提供配置的可视化管理界面
 */

import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Button,
  Space,
  Divider,
  Typography,
  message,
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useConfigPaths,
  useConfigSync,
} from '../hooks/useConfig';
import { ConfigBackupPanel } from './ConfigBackupPanel';

const { Title, Text, Paragraph } = Typography;

export const ConfigPanel: React.FC = () => {
  const { t } = useTranslation(['config', 'common']);
  const [activeTab, setActiveTab] = useState('backup-management');

  // 配置Hooks
  const configPaths = useConfigPaths();
  const configSync = useConfigSync();



  // 打开配置目录
  const handleOpenConfigDir = async () => {
    try {
      if (configPaths.configPath && window.electronAPI) {
        await window.electronAPI.system.showInFolder(configPaths.configPath);
      }
    } catch (error) {
      message.error(t('config:messages.cannotOpenConfigDir'));
      console.error('Open config dir error:', error);
    }
  };







  const tabItems = [
    {
      key: 'backup-management',
      label: t('config:tabs.backupManagement'),
      icon: <ReloadOutlined />,
      children: <ConfigBackupPanel />,
    },
  ];

  return (
    <div className="config-panel-container page-container">
      <Card className="apple-card">
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('config:panel.title')}
          </Title>
          <Text type="secondary">
            {t('config:panel.description')}
          </Text>
        </div>

        {/* 操作按钮 */}
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleOpenConfigDir}
            disabled={!configPaths.configPath}
          >
            {t('config:actions.openConfigDir')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={configSync.resetAllConfigs}
            loading={configSync.syncing}
            danger
          >
            {t('config:actions.resetAllConfigs')}
          </Button>
        </Space>

        {/* 配置路径信息 */}
        {configPaths.appDataPath && (
          <Alert
            message={t('config:info.configLocation')}
            description={
              <div>
                <Paragraph copyable={{ text: configPaths.appDataPath }}>
                  {t('config:info.appDataDir')}: {configPaths.appDataPath}
                </Paragraph>
                <Paragraph copyable={{ text: configPaths.configPath ?? '' }}>
                  {t('config:info.configDir')}: {configPaths.configPath}
                </Paragraph>
              </div>
            }
            type="info"
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        <Divider />

        {/* 配置标签页 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="small"
        />
      </Card>
    </div>
  );
};
