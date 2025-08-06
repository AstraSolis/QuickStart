import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Menu, Button, Typography, Drawer } from 'antd';
import {
  MenuOutlined,
  FileTextOutlined,
  BgColorsOutlined,
  SettingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from './contexts/ThemeContext';
import { useBackgroundRenderer } from './hooks/useBackgroundRenderer';
import i18n from './i18n';
import { FileList } from './components/FileList';
import { StylesPanel } from './components/StylesPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { AboutPanel } from './components/AboutPanel';
import { waitForElectronAPI } from './utils/electronAPI';

import './styles/App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

// 菜单项类型
type MenuKey = 'files' | 'styles' | 'settings' | 'about';

export const App: React.FC = () => {
  const { t } = useTranslation(['common', 'menu']);
  const { themeConfig } = useTheme();

  // 背景渲染Hook - 自动应用背景设置
  useBackgroundRenderer();

  // ElectronAPI 准备状态
  const [, setApiReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  // 强制应用侧边栏模糊效果
  const forceApplyBlurEffect = useCallback(() => {
    if (!themeConfig.glassEffect) return;

    setTimeout(() => {
      const drawerWrapper = document.querySelector('.sidebar-drawer .ant-drawer-content-wrapper') as HTMLElement;
      const drawerContent = document.querySelector('.sidebar-drawer .ant-drawer-content') as HTMLElement;

      if (drawerWrapper) {
        drawerWrapper.style.setProperty('background', 'var(--glass-background)', 'important');
        drawerWrapper.style.setProperty('backdrop-filter', 'var(--glass-backdrop-filter)', 'important');
        drawerWrapper.style.setProperty('-webkit-backdrop-filter', 'var(--glass-backdrop-filter)', 'important');
      }

      if (drawerContent) {
        drawerContent.style.setProperty('background', 'var(--glass-background)', 'important');
        drawerContent.style.setProperty('backdrop-filter', 'var(--glass-backdrop-filter)', 'important');
        drawerContent.style.setProperty('-webkit-backdrop-filter', 'var(--glass-backdrop-filter)', 'important');
      }
    }, 0); // 立即执行，确保在动画开始前应用
  }, [themeConfig.glassEffect]); // 默认折叠状态
  const [selectedMenu, setSelectedMenu] = useState<MenuKey>('files');
  const [isLoading, setIsLoading] = useState(true);
  const [i18nReady, setI18nReady] = useState(false);

  // 侧边栏引用
  const siderRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // i18n初始化检查
  useEffect(() => {
    const checkI18nReady = async () => {
      try {
        // 等待ElectronAPI可用
        let attempts = 0;
        const maxAttempts = 50; // 最多等待5秒

        while (attempts < maxAttempts && !window.electronAPI?.i18n?.getLanguage) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (window.electronAPI?.i18n?.getLanguage) {
          try {
            const mainLanguage = await window.electronAPI.i18n.getLanguage();
            console.log(`Renderer: Main process language is: ${mainLanguage}`);

            // 确保渲染进程的i18n语言与主进程同步
            if (mainLanguage && i18n.language !== mainLanguage) {
              console.log(`Renderer: Syncing language to: ${mainLanguage}`);
              await i18n.changeLanguage(mainLanguage);
            }

            setI18nReady(true);
          } catch (error) {
            console.warn('Renderer: Failed to get language from main process:', error);
            setI18nReady(true);
          }
        } else {
          console.warn('Renderer: ElectronAPI not available, proceeding with default language');
          setI18nReady(true);
        }
      } catch (error) {
        console.error('Renderer: Error during i18n initialization check:', error);
        setI18nReady(true); // 即使出错也继续
      }
    };

    checkI18nReady();
  }, []);

  // 应用初始化
  useEffect(() => {
    if (!i18nReady) return; // 等待i18n准备好

    const initializeApp = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('App component mounted');
        console.log('Theme config:', themeConfig);
        console.log('Translation function available:', !!t);
        console.log('I18n ready:', i18nReady);
      }

      try {
        console.log('Waiting for ElectronAPI...');
        const ready = await waitForElectronAPI(10000); // 等待最多10秒
        if (ready) {
          console.log('ElectronAPI is ready');
          setApiReady(true);
        } else {
          throw new Error('ElectronAPI not available after waiting');
        }
      } catch (error) {
        console.error('Failed to initialize ElectronAPI:', error);
        setApiError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        if (process.env.NODE_ENV === 'development') {
          console.log('App initialization completed');
        }
      }
    };

    initializeApp();
  }, [themeConfig, t, i18nReady]);

  // 切换侧边栏状态
  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  // 菜单项配置
  const menuItems = [
    {
      key: 'files',
      icon: <FileTextOutlined />,
      label: t('menu:main.files', '文件列表'),
    },
    {
      key: 'styles',
      icon: <BgColorsOutlined />,
      label: t('menu:main.styles', '样式设置'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: t('menu:main.settings', '应用设置'),
    },
    {
      key: 'about',
      icon: <InfoCircleOutlined />,
      label: t('menu:main.about', '关于'),
    },
  ];

  // 渲染内容区域
  const renderContent = () => {
    switch (selectedMenu) {
      case 'files':
        return <FileList />;
      case 'styles':
        return <StylesPanel />;
      case 'settings':
        return <SettingsPanel />;
      case 'about':
        return <AboutPanel />;
      default:
        return <FileList />;
    }
  };



  // 加载状态
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderTop: '3px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }} />
        <div style={{ fontSize: '16px', fontWeight: 500 }}>
          {t('app.loading', 'QuickStart 正在启动...')}
        </div>
        <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.8 }}>
          正在初始化系统组件...
        </div>
      </div>
    );
  }

  // API错误状态
  if (apiError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
        color: 'white',
        padding: '20px'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
          ⚠️ 系统初始化失败
        </div>
        <div style={{ fontSize: '16px', marginBottom: '20px', textAlign: 'center' }}>
          ElectronAPI 无法正常加载，请重启应用程序
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8, textAlign: 'center' }}>
          错误详情: {apiError}
        </div>
      </div>
    );
  }

  return (
    <div className="quickstart-app">
      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        {/* 头部 */}
        <Header className="app-header">
          <div className="header-left">
            <Button
              ref={menuButtonRef}
              type="text"
              icon={<MenuOutlined />}
              onClick={toggleSidebar}
              className="menu-trigger hamburger-button"
              style={{
                marginRight: '12px',
                fontSize: '16px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
            />
            <Title level={4} style={{ margin: 0, color: 'inherit' }}>
              {t('app.name', 'QuickStart')}
            </Title>
          </div>
        </Header>

        <Layout>
          {/* 侧边栏 - 使用Drawer实现弹出效果 */}
          <Drawer
            title={null}
            placement="left"
            onClose={() => setCollapsed(true)}
            afterOpenChange={(open) => {
              if (open) {
                forceApplyBlurEffect();
              }
            }}
            open={!collapsed}
            width={240}
            closable={false}
            mask={true}
            maskClosable={true}
            className={`sidebar-drawer ${themeConfig.glassEffect ? 'glass-effect' : ''}`}
            style={{
              background: themeConfig.glassEffect
                ? 'transparent'
                : themeConfig.customColors.surface,
            }}
            bodyStyle={{
              padding: 0,
              background: 'transparent',
            }}
          >
            <div ref={siderRef} className="sider-content">
              <Menu
                mode="inline"
                selectedKeys={[selectedMenu]}
                items={menuItems}
                onClick={({ key }) => {
                  setSelectedMenu(key as MenuKey);
                  setCollapsed(true); // 选择菜单项后自动隐藏侧边栏
                }}
                style={{ background: 'transparent', border: 'none' }}
              />
            </div>
          </Drawer>

          {/* 主内容区 */}
          <Content className="app-content">
            <div className="content-wrapper">
              {renderContent()}
            </div>
          </Content>
        </Layout>
      </Layout>




    </div>
  );
};
