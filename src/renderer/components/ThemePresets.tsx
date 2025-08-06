/**
 * 主题预设组件
 * 提供预定义的主题配置选择
 */

import React from 'react';
import { Card, Row, Col, Button, Typography, Space, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeConfig } from '../contexts/ThemeContext';

const { Text, Title } = Typography;

// 主题预设数据
const themePresets: Array<{
  name: string;
  nameKey: string;
  config: Partial<ThemeConfig>;
  description: string;
  descKey: string;
}> = [
  {
    name: '默认蓝色',
    nameKey: 'theme:presets.defaultBlue',
    config: {
      primaryColor: '#1890ff',
      mode: 'light',
      customColors: {
        surface: '#fafafa',
        text: '#000000',
        textSecondary: '#666666',
        border: '#d9d9d9',
        shadow: 'rgba(0, 0, 0, 0.1)',
      },
    },
    description: '经典的蓝色主题，适合商务场景',
    descKey: 'theme:presets.defaultBlueDesc',
  },
  {
    name: '优雅紫色',
    nameKey: 'theme:presets.elegantPurple',
    config: {
      primaryColor: '#722ed1',
      mode: 'light',
      customColors: {
        surface: '#fafafa',
        text: '#000000',
        textSecondary: '#666666',
        border: '#d9d9d9',
        shadow: 'rgba(0, 0, 0, 0.1)',
      },
    },
    description: '优雅的紫色主题，富有创意感',
    descKey: 'theme:presets.elegantPurpleDesc',
  },
  {
    name: '自然绿色',
    nameKey: 'theme:presets.naturalGreen',
    config: {
      primaryColor: '#52c41a',
      mode: 'light',
      customColors: {
        surface: '#fafafa',
        text: '#000000',
        textSecondary: '#666666',
        border: '#d9d9d9',
        shadow: 'rgba(0, 0, 0, 0.1)',
      },
    },
    description: '清新的绿色主题，贴近自然',
    descKey: 'theme:presets.naturalGreenDesc',
  },
  {
    name: '活力橙色',
    nameKey: 'theme:presets.vibrantOrange',
    config: {
      primaryColor: '#fa8c16',
      mode: 'light',
      customColors: {
        surface: '#fafafa',
        text: '#000000',
        textSecondary: '#666666',
        border: '#d9d9d9',
        shadow: 'rgba(0, 0, 0, 0.1)',
      },
    },
    description: '充满活力的橙色主题',
    descKey: 'theme:presets.vibrantOrangeDesc',
  },
  {
    name: '深邃暗黑',
    nameKey: 'theme:presets.deepDark',
    config: {
      primaryColor: '#1890ff',
      mode: 'dark',
      customColors: {
        surface: '#1c1c1e',
        text: '#ffffff',
        textSecondary: '#8e8e93',
        border: '#38383a',
        shadow: 'rgba(0, 0, 0, 0.5)',
      },
    },
    description: '专业的暗黑主题，护眼舒适',
    descKey: 'theme:presets.deepDarkDesc',
  },
  {
    name: '玫瑰金',
    nameKey: 'theme:presets.roseGold',
    config: {
      primaryColor: '#eb2f96',
      mode: 'light',
      customColors: {
        surface: '#fafafa',
        text: '#000000',
        textSecondary: '#666666',
        border: '#d9d9d9',
        shadow: 'rgba(0, 0, 0, 0.1)',
      },
    },
    description: '时尚的玫瑰金主题',
    descKey: 'theme:presets.roseGoldDesc',
  },
];

// 组件属性接口
export interface ThemePresetsProps {
  /** 是否为移动端 */
  isMobile?: boolean;
  /** 主题应用处理函数 */
  onApplyTheme: (config: Partial<ThemeConfig>) => void;
}

/**
 * 主题预设组件
 */
export const ThemePresets: React.FC<ThemePresetsProps> = ({
  isMobile = false,
  onApplyTheme,
}) => {
  const { t } = useTranslation(['theme']);
  const { themeConfig } = useTheme();

  // 检查是否为当前主题
  const isCurrentTheme = (preset: typeof themePresets[0]) => {
    return preset.config.primaryColor === themeConfig.primaryColor &&
           preset.config.mode === themeConfig.mode;
  };

  return (
    <Card size="small" title={t('theme:ui.themePresets', '主题预设')}>
      <Row gutter={[12, 12]}>
        {themePresets.map((preset, index) => {
          const isCurrent = isCurrentTheme(preset);
          const colSpan = isMobile ? 12 : 8;
          
          return (
            <Col span={colSpan} key={index}>
              <Card
                size="small"
                hoverable={!isCurrent}
                style={{
                  border: isCurrent ? `2px solid ${preset.config.primaryColor}` : undefined,
                  cursor: isCurrent ? 'default' : 'pointer',
                }}
                onClick={() => !isCurrent && onApplyTheme(preset.config)}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {/* 主题颜色预览 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: preset.config.primaryColor,
                        borderRadius: '50%',
                        border: '2px solid #fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                    <Text strong style={{ fontSize: isMobile ? '12px' : '14px' }}>
                      {t(preset.nameKey, preset.name)}
                    </Text>
                    {isCurrent && (
                      <Tag color="success">
                        {t('theme:presets.current', '当前')}
                      </Tag>
                    )}
                  </div>
                  
                  {/* 主题描述 */}
                  <Text 
                    type="secondary" 
                    style={{ 
                      fontSize: isMobile ? '11px' : '12px',
                      lineHeight: 1.4,
                    }}
                  >
                    {t(preset.descKey, preset.description)}
                  </Text>
                  
                  {/* 模式标签 */}
                  <div>
                    <Tag
                      color={preset.config.mode === 'dark' ? 'purple' : 'gold'}
                    >
                      {preset.config.mode === 'dark' ? t('theme:mode.dark', '深色模式') : t('theme:mode.light', '浅色模式')}
                    </Tag>
                  </div>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
      
      {/* 自定义主题提示 */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: isMobile ? '11px' : '12px' }}>
          {t('theme:presets.customHint', '点击预设快速应用，或在上方自定义您的专属主题')}
        </Text>
      </div>
    </Card>
  );
};

export default ThemePresets;
