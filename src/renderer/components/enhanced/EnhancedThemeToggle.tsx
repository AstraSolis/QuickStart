/**
 * 增强的主题切换组件
 * 提供流畅的主题切换动画和用户体验
 */

import React, { useState, useCallback, useRef } from 'react';
import { Button, Tooltip, Switch, Dropdown, Space, type MenuProps } from 'antd';
import { 
  SunOutlined, 
  MoonOutlined, 
  BgColorsOutlined,
  SettingOutlined,
  CheckOutlined
} from '@ant-design/icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { renderOptimizer } from '../../performance/render-optimizer';

interface ThemePreset {
  id: string;
  name: string;
  primaryColor: string;
  mode: 'light' | 'dark';
  preview: {
    background: string;
    surface: string;
    text: string;
  };
}

interface EnhancedThemeToggleProps {
  size?: 'small' | 'middle' | 'large';
  showPresets?: boolean;
  showAnimation?: boolean;
  position?: 'top' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}

export const EnhancedThemeToggle: React.FC<EnhancedThemeToggleProps> = ({
  size = 'middle',
  showPresets = true,
  showAnimation = true,
  position = 'bottom'
}) => {
  const { t } = useTranslation(['theme', 'common']);
  const { themeConfig, updateTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const animationRef = useRef<HTMLDivElement>(null);

  // 主题预设
  const themePresets: ThemePreset[] = [
    {
      id: 'default-light',
      name: t('theme:presets.defaultLight'),
      primaryColor: '#1890ff',
      mode: 'light',
      preview: { background: '#ffffff', surface: '#f5f5f5', text: '#000000' }
    },
    {
      id: 'default-dark',
      name: t('theme:presets.defaultDark'),
      primaryColor: '#1890ff',
      mode: 'dark',
      preview: { background: '#141414', surface: '#1f1f1f', text: '#ffffff' }
    },
    {
      id: 'green-light',
      name: t('theme:presets.greenLight'),
      primaryColor: '#52c41a',
      mode: 'light',
      preview: { background: '#ffffff', surface: '#f6ffed', text: '#000000' }
    },
    {
      id: 'purple-dark',
      name: t('theme:presets.purpleDark'),
      primaryColor: '#722ed1',
      mode: 'dark',
      preview: { background: '#141414', surface: '#1f1f1f', text: '#ffffff' }
    },
    {
      id: 'orange-light',
      name: t('theme:presets.orangeLight'),
      primaryColor: '#fa8c16',
      mode: 'light',
      preview: { background: '#ffffff', surface: '#fff7e6', text: '#000000' }
    }
  ];

  // 优化的主题切换动画
  const performThemeTransition = useCallback(async (newTheme: Partial<typeof themeConfig>) => {
    if (!showAnimation) {
      updateTheme(newTheme);
      return;
    }

    setIsAnimating(true);

    // 创建过渡效果
    const transitionElement = document.createElement('div');
    transitionElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: ${newTheme.mode === 'dark' ? '#000000' : '#ffffff'};
      opacity: 0;
      z-index: 9999;
      pointer-events: none;
      transition: opacity 0.3s ease-in-out;
    `;
    
    document.body.appendChild(transitionElement);

    // 淡入效果
    requestAnimationFrame(() => {
      transitionElement.style.opacity = '0.8';
    });

    // 延迟应用主题
    setTimeout(() => {
      updateTheme(newTheme);
      
      // 淡出效果
      setTimeout(() => {
        transitionElement.style.opacity = '0';
        
        setTimeout(() => {
          document.body.removeChild(transitionElement);
          setIsAnimating(false);
        }, 300);
      }, 100);
    }, 150);
  }, [updateTheme, showAnimation, themeConfig]);

  // 优化的模式切换
  const handleModeToggle = useCallback(
    renderOptimizer.createDebounce(() => {
      const newMode = themeConfig.mode === 'light' ? 'dark' : 'light';
      performThemeTransition({ mode: newMode });
    }, 100),
    [themeConfig.mode, performThemeTransition]
  );

  // 应用主题预设
  const applyThemePreset = useCallback((preset: ThemePreset) => {
    performThemeTransition({
      mode: preset.mode,
      primaryColor: preset.primaryColor,
      activeTheme: preset.id
    });
    setDropdownVisible(false);
  }, [performThemeTransition]);

  // 渲染主题预设项
  const renderPresetItem = useCallback((preset: ThemePreset) => (
    <div
      key={preset.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'background-color 0.2s',
        position: 'relative'
      }}
      onClick={() => applyThemePreset(preset)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* 预览色块 */}
      <div style={{ display: 'flex', gap: '2px' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            backgroundColor: preset.preview.background,
            border: '1px solid #d9d9d9'
          }}
        />
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            backgroundColor: preset.primaryColor
          }}
        />
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            backgroundColor: preset.preview.surface,
            border: '1px solid #d9d9d9'
          }}
        />
      </div>
      
      {/* 主题名称 */}
      <span style={{ flex: 1, fontSize: '14px' }}>
        {preset.name}
      </span>
      
      {/* 当前主题标识 */}
      {themeConfig.activeTheme === preset.id && (
        <CheckOutlined style={{ color: preset.primaryColor, fontSize: '12px' }} />
      )}
    </div>
  ), [applyThemePreset, themeConfig.activeTheme]);

  // 下拉菜单项
  const menuItems: MenuProps['items'] = showPresets ? [
    {
      key: 'presets',
      label: (
        <div style={{ minWidth: '200px' }}>
          <div style={{ 
            padding: '8px 12px', 
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 500,
            fontSize: '13px',
            color: '#666'
          }}>
            {t('theme:presets.title')}
          </div>
          {themePresets.map(renderPresetItem)}
        </div>
      ),
      disabled: true
    }
  ] : [];

  return (
    <div ref={animationRef} style={{ position: 'relative' }}>
      <Space size="small">
        {/* 模式切换开关 */}
        <Tooltip title={t('theme:mode.toggle')}>
          <Switch
            checked={themeConfig.mode === 'dark'}
            onChange={handleModeToggle}
            size={size === 'middle' ? 'default' : size as 'small' | 'default'}
            loading={isAnimating}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
            style={{
              backgroundColor: themeConfig.mode === 'dark' ? '#722ed1' : '#1890ff'
            }}
          />
        </Tooltip>

        {/* 主题预设下拉菜单 */}
        {showPresets && (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement={position}
            open={dropdownVisible}
            onOpenChange={setDropdownVisible}
          >
            <Tooltip title={t('theme:presets.select')}>
              <Button
                icon={<BgColorsOutlined />}
                size={size}
                type="text"
                loading={isAnimating}
                style={{
                  color: themeConfig.primaryColor,
                  borderColor: themeConfig.primaryColor
                }}
              />
            </Tooltip>
          </Dropdown>
        )}

        {/* 主题设置按钮 */}
        <Tooltip title={t('theme:settings.title')}>
          <Button
            icon={<SettingOutlined />}
            size={size}
            type="text"
            onClick={() => {
              // 触发主题设置面板
              // 这里可以集成到主应用的路由或状态管理中
            }}
          />
        </Tooltip>
      </Space>

      {/* 动画遮罩 */}
      {isAnimating && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #f3f3f3',
              borderTop: `2px solid ${themeConfig.primaryColor}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
        </div>
      )}

      {/* CSS动画 */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
