import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  ColorPicker,
  Slider,
  Switch,
  Select,
  Space,
  Button,
  Divider,
  message,
  Tabs,
  Grid,
  Drawer,
  Collapse,
} from 'antd';
import {
  // BgColorsOutlined,
  // FontSizeOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  PictureOutlined,
  SettingOutlined,
  SkinOutlined,
  MenuOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeConfig } from '../contexts/ThemeContext';
import { BackgroundSettingsPanel } from './BackgroundSettingsPanel';
import IconUploader from './IconUploader';
import ColorSettings from './ColorSettings';
import ThemePresets from './ThemePresets';
import ThemeActions from './ThemeActions';
import ThemeImportExportModals from './ThemeImportExportModals';
import AdvancedEffectsPanel from './AdvancedEffectsPanel';
import PerformanceMonitorPanel from './PerformanceMonitorPanel';
import { useThemeOperations } from '../hooks/useThemeOperations';
import { useLayoutOperations } from '../hooks/useLayoutOperations';
import type { Color } from 'antd/es/color-picker';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const { Panel } = Collapse;

export const StylesPanel: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { themeConfig, updateTheme, resetTheme, toggleMode } = useTheme();

  // 响应式断点
  const screens = useBreakpoint();
  const isMobile = !screens.md; // md以下为移动端
  const isTablet = screens.md && !screens.lg; // md到lg之间为平板

  // 移动端状态管理
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);
  const [iconUploaderVisible, setIconUploaderVisible] = useState(false);
  const [activeCollapseKeys, setActiveCollapseKeys] = useState<string[]>(['colors']);

  // 使用自定义Hook
  const themeOperations = useThemeOperations();

  // 字体选项 - 从翻译文件获取
  const fontOptions = [
    { label: t('theme:fonts.options.appleSystem'), value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    { label: t('theme:fonts.options.microsoftYaHei'), value: '"Microsoft YaHei", sans-serif' },
    { label: t('theme:fonts.options.pingFangSC'), value: '"PingFang SC", sans-serif' },
    { label: t('theme:fonts.options.helveticaNeue'), value: '"Helvetica Neue", Arial, sans-serif' },
    { label: t('theme:fonts.options.sfProDisplay'), value: '"SF Pro Display", sans-serif' },
    { label: t('theme:fonts.options.segoeUI'), value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  ];

  // 处理颜色变化
  const handleColorChange = (colorKey: string, color: Color) => {
    const hexColor = color.toHexString();
    if (colorKey === 'primary') {
      updateTheme({ primaryColor: hexColor });
    } else {
      updateTheme({
        customColors: {
          ...themeConfig.customColors,
          [colorKey]: hexColor,
        },
      });
    }
  };

  // 导出主题配置
  const handleExportTheme = () => {
    try {
      // 添加导出时间戳和版本信息
      const exportData = {
        ...themeConfig,
        exportInfo: {
          timestamp: new Date().toISOString(),
          version: themeConfig.version || '1.2.0',
          appVersion: '1.0.0', // 可以从package.json获取
          exportedBy: 'QuickStart Theme Manager',
        },
      };

      const themeData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([themeData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 生成更有意义的文件名
      const timestamp = new Date().toISOString().split('T')[0];
      const themeName = themeConfig.activeTheme || 'custom';
      a.download = `quickstart-theme-${themeName}-${timestamp}.json`;

      a.click();
      URL.revokeObjectURL(url);

      message.success(t('theme:messages.exportSuccess'));
    } catch (error) {
      console.error('Theme export failed:', error);
      message.error(t('theme:messages.exportFailed'));
    }
  };





  // 主题预设
  const themePresets = [
    {
      name: t('theme:presets.iosBlue'),
      config: {
        primaryColor: '#007AFF',
        glassEffect: true,
        borderRadius: 12,
        customColors: {
          surface: '#f2f2f7',
          text: '#000000',
          textSecondary: '#8e8e93',
          border: '#c6c6c8',
          shadow: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    {
      name: t('theme:presets.macosGreen'),
      config: {
        primaryColor: '#30D158',
        glassEffect: true,
        borderRadius: 8,
        customColors: {
          surface: '#f5f5f7',
          text: '#1d1d1f',
          textSecondary: '#86868b',
          border: '#d2d2d7',
          shadow: 'rgba(0, 0, 0, 0.08)',
        },
      },
    },
    {
      name: t('theme:presets.appleOrange'),
      config: {
        primaryColor: '#FF9500',
        glassEffect: true,
        borderRadius: 10,
        customColors: {
          surface: '#fafafa',
          text: '#1d1d1f',
          textSecondary: '#86868b',
          border: '#d2d2d7',
          shadow: 'rgba(255, 149, 0, 0.1)',
        },
      },
    },
    {
      name: t('theme:presets.deepSpaceGray'),
      config: {
        mode: 'dark' as const,
        primaryColor: '#0A84FF',
        glassEffect: true,
        borderRadius: 12,
        customColors: {
          surface: '#1c1c1e',
          text: '#ffffff',
          textSecondary: '#8e8e93',
          border: '#38383a',
          shadow: 'rgba(0, 0, 0, 0.5)',
        },
      },
    },
    {
      name: t('theme:presets.midnightBlue'),
      config: {
        mode: 'dark' as const,
        primaryColor: '#64D2FF',
        glassEffect: true,
        borderRadius: 8,
        customColors: {
          surface: '#2c2c2e',
          text: '#ffffff',
          textSecondary: '#a1a1a6',
          border: '#48484a',
          shadow: 'rgba(0, 0, 0, 0.6)',
        },
      },
    },
  ];

  // 响应式列配置
  const getResponsiveColProps = () => {
    if (isMobile) {
      return { xs: 24, sm: 24 }; // 移动端全宽
    } else if (isTablet) {
      return { xs: 24, sm: 12, md: 12 }; // 平板端两列
    } else {
      return { xs: 24, sm: 12, md: 8, lg: 6 }; // 桌面端多列
    }
  };

  const tabItems = [
    {
      key: 'global',
      label: t('theme:global.title'),
      icon: <SettingOutlined />,
      children: isMobile ? (
        // 移动端使用折叠面板
        <Collapse
          activeKey={activeCollapseKeys}
          onChange={setActiveCollapseKeys}
          ghost
          size="small"
        >
          <Panel header={t('theme:global.colors')} key="colors">
            <ColorSettings
              isMobile={isMobile}
              onColorChange={themeOperations.handleColorChange}
            />
          </Panel>

          <Panel header={t('theme:global.mode')} key="mode">
            <Card size="small">
              <Row gutter={[16, 8]} align="middle">
                <Col span={12}>
                  <Text>{t('theme:global.darkMode')}:</Text>
                </Col>
                <Col span={12}>
                  <Switch
                    checked={themeConfig.mode === 'dark'}
                    onChange={toggleMode}
                  />
                </Col>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {t('theme:global.modeDesc')}
                  </Text>
                </Col>
              </Row>
            </Card>
          </Panel>

          <Panel header={t('theme:global.font')} key="font">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small" title={t('theme:global.fontSize')}>
                <Row gutter={[16, 8]}>
                  <Col span={24}>
                    <Slider
                      min={12}
                      max={18}
                      value={themeConfig.fontSize}
                      onChange={(value) => updateTheme({ fontSize: value })}
                      marks={{
                        12: '12px',
                        14: '14px',
                        16: '16px',
                        18: '18px',
                      }}
                    />
                  </Col>
                  <Col span={24} style={{ textAlign: 'center' }}>
                    <Text type="secondary">{themeConfig.fontSize}px</Text>
                  </Col>
                </Row>
              </Card>

              <Card size="small" title={t('theme:global.borderRadius')}>
                <Row gutter={[16, 8]}>
                  <Col span={24}>
                    <Slider
                      min={0}
                      max={16}
                      value={themeConfig.borderRadius}
                      onChange={(value) => updateTheme({ borderRadius: value })}
                      marks={{
                        0: '0px',
                        4: '4px',
                        8: '8px',
                        12: '12px',
                        16: '16px',
                      }}
                    />
                  </Col>
                  <Col span={24} style={{ textAlign: 'center' }}>
                    <Text type="secondary">{themeConfig.borderRadius}px</Text>
                  </Col>
                </Row>
              </Card>
            </Space>
          </Panel>

          <Panel header={t('theme:ui.themePresets')} key="presets">
            <ThemePresets
              isMobile={isMobile}
              onApplyTheme={updateTheme}
            />
          </Panel>
        </Collapse>
      ) : (
        // 桌面端使用原有布局
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 颜色设置 */}
          <ColorSettings
            isMobile={isMobile}
            onColorChange={themeOperations.handleColorChange}
          />

          {/* 明暗模式切换 */}
          <Card size="small" title={t('theme:global.mode')}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text>{t('theme:global.darkMode')}:</Text>
              </Col>
              <Col span={6}>
                <Switch
                  checked={themeConfig.mode === 'dark'}
                  onChange={toggleMode}
                />
              </Col>
              <Col span={12}>
                <Text type="secondary">{t('theme:global.modeDesc')}</Text>
              </Col>
            </Row>
          </Card>

          {/* 字体设置 */}
          <Card size="small" title={t('theme:global.font')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16} align="middle">
                <Col span={6}>
                  <Text>{t('theme:global.fontSize')}:</Text>
                </Col>
                <Col span={12}>
                  <Slider
                    min={12}
                    max={18}
                    value={themeConfig.fontSize}
                    onChange={(value) => updateTheme({ fontSize: value })}
                    marks={{
                      12: '12px',
                      14: '14px',
                      16: '16px',
                      18: '18px',
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Text type="secondary">{themeConfig.fontSize}px</Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={6}>
                  <Text>{t('theme:global.borderRadius')}:</Text>
                </Col>
                <Col span={12}>
                  <Slider
                    min={0}
                    max={16}
                    value={themeConfig.borderRadius}
                    onChange={(value) => updateTheme({ borderRadius: value })}
                    marks={{
                      0: '0px',
                      4: '4px',
                      8: '8px',
                      12: '12px',
                      16: '16px',
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Text type="secondary">{themeConfig.borderRadius}px</Text>
                </Col>
              </Row>
            </Space>
          </Card>

          {/* 主题预设 */}
          <ThemePresets
            isMobile={isMobile}
            onApplyTheme={updateTheme}
          />
        </Space>
      ),
    },
    {
      key: 'colors',
      label: t('theme:colors.title', '界面颜色'),
      icon: <SkinOutlined />,
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 界面颜色设置 */}
          <Card size="small" title={t('theme:colors.interface', '界面颜色')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {Object.entries(themeConfig.customColors).map(([key, value]) => (
                <Row key={key} gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t(`theme:colors.labels.${key}`, key)}:</Text>
                  </Col>
                  <Col span={8}>
                    <ColorPicker
                      value={value}
                      onChange={(color) => handleColorChange(key, color)}
                      showText
                      trigger="click"
                    />
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {t(`theme:colors.descriptions.${key}`, '')}
                    </Text>
                  </Col>
                </Row>
              ))}
            </Space>
          </Card>
        </Space>
      ),
    },
    {
      key: 'interface-effects',
      label: t('theme:ui.interfaceEffects'),
      icon: <EyeOutlined />,
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small" title={t('theme:ui.interfaceEffects')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('theme:effects.glassEffect')}</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={themeConfig.glassEffect}
                    onChange={(checked) => updateTheme({ glassEffect: checked })}
                  />
                </Col>
              </Row>

              {themeConfig.glassEffect && (
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t('theme:effects.transparency')}</Text>
                  </Col>
                  <Col span={12}>
                    <Slider
                      min={0.1}
                      max={1}
                      step={0.1}
                      value={themeConfig.glassOpacity}
                      onChange={(value) => updateTheme({ glassOpacity: value })}
                    />
                  </Col>
                  <Col span={4}>
                    <Text>{Math.round(themeConfig.glassOpacity * 100)}%</Text>
                  </Col>
                </Row>
              )}

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('theme:effects.borderRadius')}</Text>
                </Col>
                <Col span={12}>
                  <Slider
                    min={0}
                    max={20}
                    value={themeConfig.borderRadius}
                    onChange={(value) => updateTheme({ borderRadius: value })}
                  />
                </Col>
                <Col span={4}>
                  <Text>{themeConfig.borderRadius}px</Text>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('theme:effects.compactMode')}</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={themeConfig.compactMode}
                    onChange={(checked) => updateTheme({ compactMode: checked })}
                  />
                </Col>
              </Row>
            </Space>
          </Card>
        </Space>
      ),
    },

    {
      key: 'background',
      label: t('theme:background.title'),
      icon: <PictureOutlined />,
      children: <BackgroundSettingsPanel />,
    },
    {
      key: 'advanced-effects',
      label: t('theme:effects.title'),
      icon: <SkinOutlined />,
      children: <AdvancedEffectsPanel isMobile={isMobile} />,
    },
    {
      key: 'performance',
      label: t('theme:performance.title', '性能监控'),
      icon: <EyeOutlined />,
      children: <PerformanceMonitorPanel isMobile={isMobile} />,
    },
  ];

  // 移动端渲染
  if (isMobile) {
    return (
      <>
        <div className="styles-panel-container page-container">
          {/* 移动端头部 */}
          <Card
            className="apple-card"
            style={{
              background: themeConfig.glassEffect
                ? 'var(--glass-background)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: themeConfig.glassEffect
                ? 'var(--glass-backdrop-filter)'
                : 'blur(10px)',
              marginBottom: 16,
            }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  {t('theme:ui.title')}
                </Title>
              </Col>
              <Col>
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => setMobileDrawerVisible(true)}
                  size="large"
                />
              </Col>
            </Row>
          </Card>

          {/* 移动端主要内容 */}
          <Card
            className="apple-card"
            style={{
              background: themeConfig.glassEffect
                ? 'var(--glass-background)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: themeConfig.glassEffect
                ? 'var(--glass-backdrop-filter)'
                : 'blur(10px)',
            }}
          >
            <Tabs
              items={tabItems}
              size="small"
              tabPosition="top"
              style={{ minHeight: 300 }}
            />
          </Card>
        </div>

        {/* 移动端抽屉菜单 */}
        <Drawer
          title={t('theme:ui.mobileMenu', '样式设置菜单')}
          placement="right"
          onClose={() => setMobileDrawerVisible(false)}
          open={mobileDrawerVisible}
          width="80%"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              block
              icon={<AppstoreOutlined />}
              onClick={() => {
                setIconUploaderVisible(true);
                setMobileDrawerVisible(false);
              }}
            >
              {t('theme:iconUpload.title', '自定义图标')}
            </Button>
            <Button
              block
              icon={<DownloadOutlined />}
              onClick={() => {
                handleExportTheme();
                setMobileDrawerVisible(false);
              }}
            >
              {t('theme:actions.export')}
            </Button>
            <Button
              block
              icon={<UploadOutlined />}
              onClick={() => {
                themeOperations.handleImportTheme();
                setMobileDrawerVisible(false);
              }}
            >
              {t('theme:actions.import')}
            </Button>
            <Button
              block
              icon={<ReloadOutlined />}
              onClick={() => {
                resetTheme();
                setMobileDrawerVisible(false);
              }}
              danger
            >
              {t('theme:actions.reset')}
            </Button>
          </Space>
        </Drawer>

        {/* 图标上传器 */}
        <IconUploader
          visible={iconUploaderVisible}
          onClose={() => setIconUploaderVisible(false)}
        />
      </>
    );
  }

  // 桌面端渲染
  return (
    <div className="styles-panel-container page-container">
      <Card
        className="apple-card"
        style={{
          background: themeConfig.glassEffect
            ? 'var(--glass-background)'
            : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: themeConfig.glassEffect
            ? 'var(--glass-backdrop-filter)'
            : 'blur(10px)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('theme:ui.title')}
          </Title>
          <Text type="secondary">
            {t('theme:ui.description')}
          </Text>
        </div>

        {/* 操作按钮 */}
        <div style={{ marginBottom: 16 }}>
          <ThemeActions
            isMobile={isMobile}
            onExportTheme={themeOperations.handleExportTheme}
            onImportTheme={themeOperations.handleImportTheme}
            onResetTheme={resetTheme}
            onOpenIconUploader={() => setIconUploaderVisible(true)}
            mobileDrawerVisible={mobileDrawerVisible}
            setMobileDrawerVisible={setMobileDrawerVisible}
          />
        </div>

        <Divider />

        {/* 主要设置区域 */}
        <Tabs
          items={tabItems}
          size={isTablet ? "small" : "middle"}
          style={{ minHeight: 400 }}
        />
      </Card>

      {/* 图标上传器 */}
      <IconUploader
        visible={iconUploaderVisible}
        onClose={() => setIconUploaderVisible(false)}
      />

      {/* 主题导入导出模态框 */}
      <ThemeImportExportModals
        themeConfig={themeConfig}
        themeImportModalVisible={themeOperations.themeImportModalVisible}
        setThemeImportModalVisible={themeOperations.setThemeImportModalVisible}
        themePreviewModalVisible={themeOperations.themePreviewModalVisible}
        setThemePreviewModalVisible={themeOperations.setThemePreviewModalVisible}
        previewThemeConfig={themeOperations.previewThemeConfig}
        setPreviewThemeConfig={themeOperations.setPreviewThemeConfig}
        onThemeFileUpload={themeOperations.handleThemeFileUpload}
        onApplyPreviewTheme={themeOperations.handleApplyPreviewTheme}
      />
    </div>
  );
};
