/**
 * 优化后的样式面板组件
 * 使用模块化的子组件，提高代码可维护性
 */

import React, { useState } from 'react';
import { Row, Col, Grid, Drawer, Button, Tabs } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

// 导入子组件
import { ThemeColorPicker } from './theme/ThemeColorPicker';
import { ThemeExportImport } from './theme/ThemeExportImport';
import { BackgroundSettingsPanel } from './BackgroundSettingsPanel';
import AdvancedEffectsPanel from './AdvancedEffectsPanel';
import PerformanceMonitorPanel from './PerformanceMonitorPanel';

const { useBreakpoint } = Grid;

export const StylesPanelOptimized: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { themeConfig, updateTheme, resetTheme, toggleMode } = useTheme();

  // 响应式断点
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;

  // 移动端状态管理
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);
  const [iconUploaderVisible, setIconUploaderVisible] = useState(false);

  // 标签页配置
  const tabItems = [
    {
      key: 'colors',
      label: t('theme:tabs.colors'),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <ThemeColorPicker isMobile={isMobile} />
          </Col>
          <Col xs={24} lg={12}>
            {/* ColorSettings 组件暂时移除，等待修复 */}
            <div>颜色设置面板</div>
          </Col>
        </Row>
      ),
    },
    {
      key: 'background',
      label: t('theme:tabs.background'),
      children: <BackgroundSettingsPanel />,
    },
    {
      key: 'presets',
      label: t('theme:tabs.presets'),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            {/* ThemePresets 组件暂时移除，等待修复 */}
            <div>主题预设面板</div>
          </Col>
          <Col xs={24} lg={8}>
            {/* ThemeActions 组件暂时移除，等待修复 */}
            <div>主题操作面板</div>
          </Col>
        </Row>
      ),
    },
    {
      key: 'advanced',
      label: t('theme:tabs.advanced'),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <AdvancedEffectsPanel />
          </Col>
          <Col xs={24} lg={12}>
            <PerformanceMonitorPanel />
          </Col>
        </Row>
      ),
    },
    {
      key: 'importExport',
      label: t('theme:tabs.importExport'),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <ThemeExportImport isMobile={isMobile} />
          </Col>
          <Col xs={24} lg={12}>
            {/* ThemeImportExportModals 组件暂时移除，等待修复 */}
            <div>主题导入导出模态框</div>
          </Col>
        </Row>
      ),
    },
  ];

  // 桌面端渲染
  const renderDesktop = () => (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{t('theme:title')}</h2>
        <Button
          icon={<EyeOutlined />}
          onClick={() => setIconUploaderVisible(true)}
        >
          {t('theme:iconUploader.button')}
        </Button>
      </div>

      <Tabs
        defaultActiveKey="colors"
        items={tabItems}
        size="large"
        tabPosition={isTablet ? 'top' : 'left'}
      />
    </div>
  );

  // 移动端渲染
  const renderMobile = () => (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{t('theme:title')}</h3>
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setIconUploaderVisible(true)}
        >
          {t('theme:iconUploader.button')}
        </Button>
      </div>

      <Tabs
        defaultActiveKey="colors"
        items={tabItems}
        size="small"
        tabPosition="top"
      />
    </div>
  );

  return (
    <>
      {isMobile ? renderMobile() : renderDesktop()}

      {/* 图标上传器 */}
      <Drawer
        title={t('theme:iconUploader.title')}
        placement="right"
        onClose={() => setIconUploaderVisible(false)}
        open={iconUploaderVisible}
        width={isMobile ? '90%' : 400}
      >
        {/* IconUploader 组件暂时移除，等待修复 */}
        <div>图标上传器</div>
      </Drawer>
    </>
  );
};
