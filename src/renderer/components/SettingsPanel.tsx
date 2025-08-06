import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Switch,

  Space,
  Divider,
  message,

  InputNumber,
  Tabs,
  Spin,
  Alert
} from 'antd';
import {
  SettingOutlined,
  GlobalOutlined,
  RocketOutlined,
  // SafetyOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useI18nContext } from '../../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSettings, useUserPreferences, useLayoutConfig } from '../hooks/useConfig';
import { ConfigPanel } from './ConfigPanel';
import { LanguageSelector } from './LanguageSelector';
import type { AppSettingsSchema, UserPreferencesSchema } from '@shared/config-schemas';

const { Title, Text } = Typography;


export const SettingsPanel: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { themeConfig } = useTheme();
  const { currentLanguage } = useI18nContext();
  const { config: appSettings, updateConfig: updateAppSettings, loading: appSettingsLoading, error: appSettingsError } = useAppSettings();
  const { config: userPreferences, updateConfig: updateUserPreferences, loading: userPreferencesLoading, error: userPreferencesError } = useUserPreferences();
  const { config: layoutConfig, updateConfig: updateLayoutConfig, loading: layoutLoading, error: layoutError } = useLayoutConfig();
  const [activeTab, setActiveTab] = useState('general');

  // Handle setting changes - save to config system in real time
  const handleSettingChange = async (settingPath: string, value: unknown, configType: 'app-settings' | 'user-preferences' | 'layout-config' = 'app-settings') => {
    try {
      const currentConfig = configType === 'app-settings' ? appSettings :
                           configType === 'user-preferences' ? userPreferences : layoutConfig;
      const updateFunction = configType === 'app-settings' ? updateAppSettings :
                            configType === 'user-preferences' ? updateUserPreferences : updateLayoutConfig;

      if (!currentConfig) {
        console.error(`${configType} not loaded`);
        return;
      }

      // Build update object based on setting path, preserving existing config structure
      const pathParts = settingPath.split('.');
      const updateObj: Partial<AppSettingsSchema | UserPreferencesSchema> = {};

      if (pathParts.length === 1) {
        // Top-level property
        (updateObj as Record<string, unknown>)[pathParts[0]] = value;
      } else if (pathParts.length === 2) {
        // Second-level property, need to preserve other properties at the same level
        const [category, property] = pathParts;
        const currentCategory = (currentConfig as unknown as Record<string, unknown>)[category];
        (updateObj as Record<string, unknown>)[category] = {
          ...(typeof currentCategory === 'object' && currentCategory !== null ? currentCategory : {}),
          [property]: value // Only update specified property
        };
      } else {
        // Deeper level nesting (if needed)
        console.warn('Deep nested settings not implemented:', settingPath);
        return;
      }

      console.log('Updating setting:', settingPath, '=', value, 'in', configType);
      console.log('Update object:', updateObj);

      // Save to config system
      const success = await updateFunction(updateObj);

      if (success) {
        message.success(t('common:messages.settingUpdated'));
      } else {
        message.error(t('common:messages.settingUpdateFailed'));
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      message.error(t('common:messages.settingUpdateError'));
    }
  };

  // General settings component
  const GeneralSettings = () => {
    // Show loading state
    if (appSettingsLoading || userPreferencesLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">{t('settings:messages.loadingSettings')}</Text>
          </div>
        </div>
      );
    }

    // Show error state
    if (appSettingsError || userPreferencesError) {
      return (
        <Alert
          message={t('settings:messages.loadSettingsFailed')}
          description={appSettingsError ?? userPreferencesError}
          type="error"
          showIcon
        />
      );
    }

    // If no config data, show warning
    if (!appSettings || !userPreferences) {
      return (
        <Alert
          message={t('settings:messages.cannotLoadSettings')}
          description={t('settings:messages.checkConfigSystem')}
          type="warning"
          showIcon
        />
      );
    }

    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('settings:title')}
          </Title>
          <Text type="secondary">
            {t('settings:general.title')}
          </Text>
        </div>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Window Settings */}
          <Card size="small" title={<><SettingOutlined /> {t('settings:window.title')}</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:window.maximizeOnStart')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.window?.maximized || false}
                    onChange={(checked) => handleSettingChange('window.maximized', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:window.maximizeOnStartDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:window.alwaysOnTop')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.window?.alwaysOnTop || false}
                    onChange={(checked) => handleSettingChange('window.alwaysOnTop', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:window.alwaysOnTopDesc')}
                  </Text>
                </Col>
              </Row>
            </Space>
          </Card>

          {/* Startup Settings */}
          <Card size="small" title={<><RocketOutlined /> {t('settings:startup.title')}</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:startup.autoLaunch')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.startup?.autoLaunch || false}
                    onChange={(checked) => handleSettingChange('startup.autoLaunch', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:startup.autoLaunchDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:startup.minimizeToTray')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.startup?.minimizeToTray || false}
                    onChange={(checked) => handleSettingChange('startup.minimizeToTray', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:startup.minimizeToTrayDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:startup.showSplashScreen')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.startup?.showSplashScreen || false}
                    onChange={(checked) => handleSettingChange('startup.showSplashScreen', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:startup.showSplashScreenDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:startup.checkUpdates')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.startup?.checkForUpdates || false}
                    onChange={(checked) => handleSettingChange('startup.checkForUpdates', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:startup.checkUpdatesDesc')}
                  </Text>
                </Col>
              </Row>
            </Space>
          </Card>



          {/* Performance Settings */}
          <Card size="small" title={<><ThunderboltOutlined /> {t('settings:performance.title')}</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:performance.hardwareAcceleration')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.performance?.enableHardwareAcceleration || false}
                    onChange={(checked) => handleSettingChange('performance.enableHardwareAcceleration', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:performance.hardwareAccelerationDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:performance.cacheSize')}:</Text>
                </Col>
                <Col span={16}>
                  <InputNumber
                    min={50}
                    max={500}
                    value={appSettings.performance?.maxCacheSize || 100}
                    onChange={(value) => handleSettingChange('performance.maxCacheSize', value)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:performance.cacheSizeDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:performance.enableVirtualization')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={appSettings.performance?.enableVirtualization || false}
                    onChange={(checked) => handleSettingChange('performance.enableVirtualization', checked)}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:performance.enableVirtualizationDesc')}
                  </Text>
                </Col>
              </Row>
            </Space>
          </Card>





        </Space>
      </div>
    );
  };

  // Language settings component - 重构为使用新的i18n系统
  const LanguageSettings = () => (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Interface Language Settings */}
        <Card size="small" title={t('language.title')}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('language.interface')}:</Text>
              </Col>
              <Col span={18}>
                <LanguageSelector
                  size="middle"
                  showIcon={true}
                  showLabel={false}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>

            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('language.current')}:</Text>
              </Col>
              <Col span={18}>
                <Text type="secondary">{currentLanguage}</Text>
              </Col>
            </Row>

            <Divider />
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('language.fallback')}:</Text>
              </Col>
              <Col span={18}>
                <Text type="secondary">zh-CN</Text>
              </Col>
            </Row>

            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('language.supported')}:</Text>
              </Col>
              <Col span={18}>
                <Text type="secondary">zh-CN, en, ru, fr</Text>
              </Col>
            </Row>
          </Space>
        </Card>

        {/* Format Settings */}
        <Card size="small" title={t('language.formats')}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('language.dateFormat')}:</Text>
              </Col>
              <Col span={18}>
                <Text type="secondary">YYYY-MM-DD</Text>
              </Col>
            </Row>

            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('language.timeFormat')}:</Text>
              </Col>
              <Col span={18}>
                <Text type="secondary">HH:mm:ss</Text>
              </Col>
            </Row>

            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('language.numberFormat')}:</Text>
              </Col>
              <Col span={18}>
                <Text type="secondary">
                  {t('language.decimal')}: . | {t('language.thousands')}: , | {t('language.currency')}: ¥
                </Text>
              </Col>
            </Row>
          </Space>
        </Card>
      </Space>
    </div>
  );

  // User Preferences settings component
  const UserPreferencesSettings = () => {
    // Show loading state
    if (userPreferencesLoading || layoutLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">{t('settings:messages.loadingSettings')}</Text>
          </div>
        </div>
      );
    }

    // Show error state
    if (userPreferencesError || layoutError) {
      return (
        <Alert
          message={t('settings:messages.loadSettingsFailed')}
          description={userPreferencesError ?? layoutError}
          type="error"
          showIcon
        />
      );
    }

    // If no config data, show warning
    if (!userPreferences || !layoutConfig) {
      return (
        <Alert
          message={t('settings:messages.cannotLoadSettings')}
          description={t('settings:messages.checkConfigSystem')}
          type="warning"
          showIcon
        />
      );
    }

    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('settings:userPreferences.title')}
          </Title>
          <Text type="secondary">
            {t('settings:userPreferences.description')}
          </Text>
        </div>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Global Preferences */}
          <Card size="small" title={<><UserOutlined /> {t('settings:userPreferences.global.title')}</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.confirmBeforeDelete')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={userPreferences.general?.confirmBeforeDelete || false}
                    onChange={(checked) => handleSettingChange('general.confirmBeforeDelete', checked, 'user-preferences')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.confirmBeforeDeleteDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.confirmBeforeExit')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={userPreferences.general?.confirmBeforeExit || false}
                    onChange={(checked) => handleSettingChange('general.confirmBeforeExit', checked, 'user-preferences')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.confirmBeforeExitDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.rememberWindowState')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={userPreferences.general?.rememberWindowState || false}
                    onChange={(checked) => handleSettingChange('general.rememberWindowState', checked, 'user-preferences')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.rememberWindowStateDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.enableNotifications')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={userPreferences.general?.enableNotifications || false}
                    onChange={(checked) => handleSettingChange('general.enableNotifications', checked, 'user-preferences')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.enableNotificationsDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.enableDragDrop')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={userPreferences.fileOperations?.enableDragDrop || false}
                    onChange={(checked) => handleSettingChange('fileOperations.enableDragDrop', checked, 'user-preferences')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.enableDragDropDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.showFileExtensions')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={userPreferences.fileOperations?.showFileExtensions || false}
                    onChange={(checked) => handleSettingChange('fileOperations.showFileExtensions', checked, 'user-preferences')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.showFileExtensionsDesc')}
                  </Text>
                </Col>
              </Row>
            </Space>
          </Card>

          {/* File List Preferences */}
          <Card size="small" title={<><FileTextOutlined /> {t('settings:userPreferences.fileList.title')}</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.fileList.showSize')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={layoutConfig.fileList?.showSize !== false}
                    onChange={(checked) => handleSettingChange('fileList.showSize', checked, 'layout-config')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.fileList.showSizeDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.fileList.showModifiedTime')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={layoutConfig.fileList?.showModifiedTime !== false}
                    onChange={(checked) => handleSettingChange('fileList.showModifiedTime', checked, 'layout-config')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.fileList.showModifiedTimeDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.fileList.showAddedTime')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={layoutConfig.fileList?.showAddedTime !== false}
                    onChange={(checked) => handleSettingChange('fileList.showAddedTime', checked, 'layout-config')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.fileList.showAddedTimeDesc')}
                  </Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('settings:userPreferences.fileList.showLaunchCount')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={layoutConfig.fileList?.showLaunchCount !== false}
                    onChange={(checked) => handleSettingChange('fileList.showLaunchCount', checked, 'layout-config')}
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t('settings:userPreferences.fileList.showLaunchCountDesc')}
                  </Text>
                </Col>
              </Row>
            </Space>
          </Card>
        </Space>
      </div>
    );
  };

  const tabItems = [
    {
      key: 'general',
      label: t('tabs.general'),
      icon: <SettingOutlined />,
      children: <GeneralSettings />,
    },
    {
      key: 'userPreferences',
      label: t('tabs.userPreferences'),
      icon: <UserOutlined />,
      children: <UserPreferencesSettings />,
    },
    {
      key: 'language',
      label: t('tabs.language'),
      icon: <GlobalOutlined />,
      children: <LanguageSettings />,
    },
    {
      key: 'config',
      label: t('tabs.config'),
      icon: <ToolOutlined />,
      children: <ConfigPanel />,
    },
  ];

  return (
    <div className="settings-panel-container page-container">
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
