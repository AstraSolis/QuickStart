/**
 * 高级视觉效果设置面板
 * 提供渐变、阴影、边框、纹理等高级视觉效果的配置界面
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Switch,
  Select,
  Slider,
  ColorPicker,
  Space,
  Button,
  Divider,
  Tabs,
  InputNumber,
  message,
} from 'antd';
import {
  BgColorsOutlined,
  BorderOutlined,
  HighlightOutlined,
  PictureOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  advancedEffectsManager,
  GradientType,
  GradientDirection,
  ShadowType,
  BorderStyle,
  TextureType,
  type AdvancedEffectsConfig,
  type GradientConfig,
  type ShadowConfig,
  type BorderConfig,
  type TextureConfig,
} from '../utils/AdvancedEffectsManager';
import type { Color } from 'antd/es/color-picker';

const { Title, Text } = Typography;
const { Option } = Select;

// 组件属性接口
export interface AdvancedEffectsPanelProps {
  /** 是否为移动端 */
  isMobile?: boolean;
}

/**
 * 高级视觉效果设置面板
 */
export const AdvancedEffectsPanel: React.FC<AdvancedEffectsPanelProps> = ({
  isMobile = false,
}) => {
  const { t } = useTranslation(['theme']);
  const { themeConfig, updateTheme } = useTheme();

  // 效果配置状态
  const [effectsConfig, setEffectsConfig] = useState<AdvancedEffectsConfig>({
    enabled: false,
    gradient: {
      type: GradientType.LINEAR,
      direction: GradientDirection.TO_RIGHT,
      colors: [
        { color: themeConfig.primaryColor, position: 0 },
        { color: '#ffffff', position: 100 },
      ],
    },
    shadow: {
      type: ShadowType.MEDIUM,
      offsetX: 0,
      offsetY: 4,
      blurRadius: 6,
      spreadRadius: 0,
      color: 'rgba(0, 0, 0, 0.1)',
      inset: false,
    },
    border: {
      style: BorderStyle.SOLID,
      width: 1,
      color: themeConfig.customColors.border,
      radius: themeConfig.borderRadius,
    },
    texture: {
      type: TextureType.NONE,
      opacity: 0.3,
      scale: 1,
    },
  });

  // 更新效果配置
  const updateEffectsConfig = useCallback((updates: Partial<AdvancedEffectsConfig>) => {
    setEffectsConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // 更新渐变配置
  const updateGradientConfig = useCallback((updates: Partial<GradientConfig>) => {
    setEffectsConfig(prev => ({
      ...prev,
      gradient: { ...prev.gradient!, ...updates },
    }));
  }, []);

  // 更新阴影配置
  const updateShadowConfig = useCallback((updates: Partial<ShadowConfig>) => {
    setEffectsConfig(prev => ({
      ...prev,
      shadow: { ...prev.shadow!, ...updates },
    }));
  }, []);

  // 更新边框配置
  const updateBorderConfig = useCallback((updates: Partial<BorderConfig>) => {
    setEffectsConfig(prev => ({
      ...prev,
      border: { ...prev.border!, ...updates },
    }));
  }, []);

  // 更新纹理配置
  const updateTextureConfig = useCallback((updates: Partial<TextureConfig>) => {
    setEffectsConfig(prev => ({
      ...prev,
      texture: { ...prev.texture!, ...updates },
    }));
  }, []);

  // 应用预设效果
  const applyPreset = useCallback((presetName: string) => {
    const presets = advancedEffectsManager.getPresetConfigs();
    const preset = presets[presetName];
    if (preset) {
      setEffectsConfig(preset);
      message.success(t('theme:effects.presetApplied'));
    }
  }, [t]);

  // 重置效果
  const resetEffects = useCallback(() => {
    setEffectsConfig({
      enabled: false,
      gradient: {
        type: GradientType.LINEAR,
        direction: GradientDirection.TO_RIGHT,
        colors: [
          { color: themeConfig.primaryColor, position: 0 },
          { color: '#ffffff', position: 100 },
        ],
      },
      shadow: {
        type: ShadowType.MEDIUM,
        offsetX: 0,
        offsetY: 4,
        blurRadius: 6,
        spreadRadius: 0,
        color: 'rgba(0, 0, 0, 0.1)',
        inset: false,
      },
      border: {
        style: BorderStyle.SOLID,
        width: 1,
        color: themeConfig.customColors.border,
        radius: themeConfig.borderRadius,
      },
      texture: {
        type: TextureType.NONE,
        opacity: 0.3,
        scale: 1,
      },
    });
    message.success(t('theme:effects.reset'));
  }, [themeConfig, t]);

  // 渲染渐变设置
  const renderGradientSettings = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Row gutter={16} align="middle">
        <Col span={isMobile ? 24 : 8}>
          <Text>{t('theme:effects.gradientType')}:</Text>
        </Col>
        <Col span={isMobile ? 24 : 16}>
          <Select
            value={effectsConfig.gradient?.type}
            onChange={(value) => updateGradientConfig({ type: value })}
            style={{ width: '100%' }}
          >
            <Option value={GradientType.LINEAR}>{t('theme:effects.linear')}</Option>
            <Option value={GradientType.RADIAL}>{t('theme:effects.radial')}</Option>
            <Option value={GradientType.CONIC}>{t('theme:effects.conic')}</Option>
          </Select>
        </Col>
      </Row>

      {effectsConfig.gradient?.type === GradientType.LINEAR && (
        <Row gutter={16} align="middle">
          <Col span={isMobile ? 24 : 8}>
            <Text>{t('theme:effects.direction')}:</Text>
          </Col>
          <Col span={isMobile ? 24 : 16}>
            <Select
              value={effectsConfig.gradient.direction}
              onChange={(value) => updateGradientConfig({ direction: value })}
              style={{ width: '100%' }}
            >
              <Option value={GradientDirection.TO_RIGHT}>{t('theme:effects.toRight')}</Option>
              <Option value={GradientDirection.TO_LEFT}>{t('theme:effects.toLeft')}</Option>
              <Option value={GradientDirection.TO_BOTTOM}>{t('theme:effects.toBottom')}</Option>
              <Option value={GradientDirection.TO_TOP}>{t('theme:effects.toTop')}</Option>
            </Select>
          </Col>
        </Row>
      )}

      <Row gutter={16} align="middle">
        <Col span={isMobile ? 24 : 8}>
          <Text>{t('theme:effects.startColor')}:</Text>
        </Col>
        <Col span={isMobile ? 24 : 16}>
          <ColorPicker
            value={effectsConfig.gradient?.colors[0]?.color}
            onChange={(color: Color) => {
              const colors = [...(effectsConfig.gradient?.colors || [])];
              colors[0] = { ...colors[0], color: color.toHexString() };
              updateGradientConfig({ colors });
            }}
            showText={!isMobile}
            style={{ width: isMobile ? '100%' : 'auto' }}
          />
        </Col>
      </Row>

      <Row gutter={16} align="middle">
        <Col span={isMobile ? 24 : 8}>
          <Text>{t('theme:effects.endColor')}:</Text>
        </Col>
        <Col span={isMobile ? 24 : 16}>
          <ColorPicker
            value={effectsConfig.gradient?.colors[1]?.color}
            onChange={(color: Color) => {
              const colors = [...(effectsConfig.gradient?.colors || [])];
              colors[1] = { ...colors[1], color: color.toHexString() };
              updateGradientConfig({ colors });
            }}
            showText={!isMobile}
            style={{ width: isMobile ? '100%' : 'auto' }}
          />
        </Col>
      </Row>
    </Space>
  );

  // 渲染阴影设置
  const renderShadowSettings = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Row gutter={16} align="middle">
        <Col span={isMobile ? 24 : 8}>
          <Text>{t('theme:effects.shadowType')}:</Text>
        </Col>
        <Col span={isMobile ? 24 : 16}>
          <Select
            value={effectsConfig.shadow?.type}
            onChange={(value) => updateShadowConfig({ type: value })}
            style={{ width: '100%' }}
          >
            <Option value={ShadowType.NONE}>{t('theme:effects.none')}</Option>
            <Option value={ShadowType.SUBTLE}>{t('theme:effects.subtle')}</Option>
            <Option value={ShadowType.MEDIUM}>{t('theme:effects.medium')}</Option>
            <Option value={ShadowType.STRONG}>{t('theme:effects.strong')}</Option>
            <Option value={ShadowType.GLOW}>{t('theme:effects.glow')}</Option>
            <Option value={ShadowType.CUSTOM}>{t('theme:effects.custom')}</Option>
          </Select>
        </Col>
      </Row>

      {effectsConfig.shadow?.type === ShadowType.CUSTOM && (
        <>
          <Row gutter={16} align="middle">
            <Col span={isMobile ? 24 : 8}>
              <Text>{t('theme:effects.blurRadius')}:</Text>
            </Col>
            <Col span={isMobile ? 24 : 16}>
              <Slider
                min={0}
                max={50}
                value={effectsConfig.shadow.blurRadius}
                onChange={(value) => updateShadowConfig({ blurRadius: value })}
              />
            </Col>
          </Row>

          <Row gutter={16} align="middle">
            <Col span={isMobile ? 24 : 8}>
              <Text>{t('theme:effects.shadowColor')}:</Text>
            </Col>
            <Col span={isMobile ? 24 : 16}>
              <ColorPicker
                value={effectsConfig.shadow.color}
                onChange={(color: Color) => updateShadowConfig({ color: color.toHexString() })}
                showText={!isMobile}
                style={{ width: isMobile ? '100%' : 'auto' }}
              />
            </Col>
          </Row>
        </>
      )}
    </Space>
  );

  // 渲染纹理设置
  const renderTextureSettings = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Row gutter={16} align="middle">
        <Col span={isMobile ? 24 : 8}>
          <Text>{t('theme:effects.textureType')}:</Text>
        </Col>
        <Col span={isMobile ? 24 : 16}>
          <Select
            value={effectsConfig.texture?.type}
            onChange={(value) => updateTextureConfig({ type: value })}
            style={{ width: '100%' }}
          >
            <Option value={TextureType.NONE}>{t('theme:effects.none')}</Option>
            <Option value={TextureType.PAPER}>{t('theme:effects.paper')}</Option>
            <Option value={TextureType.FABRIC}>{t('theme:effects.fabric')}</Option>
            <Option value={TextureType.WOOD}>{t('theme:effects.wood')}</Option>
            <Option value={TextureType.METAL}>{t('theme:effects.metal')}</Option>
            <Option value={TextureType.NOISE}>{t('theme:effects.noise')}</Option>
            <Option value={TextureType.DOTS}>{t('theme:effects.dots')}</Option>
            <Option value={TextureType.LINES}>{t('theme:effects.lines')}</Option>
            <Option value={TextureType.GRID}>{t('theme:effects.grid')}</Option>
          </Select>
        </Col>
      </Row>

      {effectsConfig.texture?.type !== TextureType.NONE && (
        <>
          <Row gutter={16} align="middle">
            <Col span={isMobile ? 24 : 8}>
              <Text>{t('theme:effects.opacity')}:</Text>
            </Col>
            <Col span={isMobile ? 24 : 16}>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={effectsConfig.texture?.opacity || 0.3}
                onChange={(value) => updateTextureConfig({ opacity: value })}
              />
            </Col>
          </Row>

          <Row gutter={16} align="middle">
            <Col span={isMobile ? 24 : 8}>
              <Text>{t('theme:effects.scale')}:</Text>
            </Col>
            <Col span={isMobile ? 24 : 16}>
              <Slider
                min={0.1}
                max={5}
                step={0.1}
                value={effectsConfig.texture?.scale || 1}
                onChange={(value) => updateTextureConfig({ scale: value })}
              />
            </Col>
          </Row>
        </>
      )}
    </Space>
  );

  const tabItems = [
    {
      key: 'gradient',
      label: t('theme:effects.gradient'),
      icon: <BgColorsOutlined />,
      children: renderGradientSettings(),
    },
    {
      key: 'shadow',
      label: t('theme:effects.shadow'),
      icon: <HighlightOutlined />,
      children: renderShadowSettings(),
    },
    {
      key: 'texture',
      label: t('theme:effects.texture'),
      icon: <PictureOutlined />,
      children: renderTextureSettings(),
    },
  ];

  return (
    <Card size="small" title={t('theme:effects.title')}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 效果开关 */}
        <Row gutter={16} align="middle">
          <Col span={isMobile ? 16 : 12}>
            <Text strong>{t('theme:effects.enable')}:</Text>
          </Col>
          <Col span={isMobile ? 8 : 12}>
            <Switch
              checked={effectsConfig.enabled}
              onChange={(checked) => updateEffectsConfig({ enabled: checked })}
            />
          </Col>
        </Row>

        {effectsConfig.enabled && (
          <>
            <Divider />
            
            {/* 预设效果 */}
            <div>
              <Text strong>{t('theme:effects.presets')}:</Text>
              <Space wrap style={{ marginTop: 8 }}>
                <Button size="small" onClick={() => applyPreset('sunset')}>
                  {t('theme:effects.sunset')}
                </Button>
                <Button size="small" onClick={() => applyPreset('ocean')}>
                  {t('theme:effects.ocean')}
                </Button>
                <Button size="small" onClick={() => applyPreset('forest')}>
                  {t('theme:effects.forest')}
                </Button>
                <Button size="small" icon={<ReloadOutlined />} onClick={resetEffects}>
                  {t('theme:effects.reset')}
                </Button>
              </Space>
            </div>

            <Divider />

            {/* 效果设置标签页 */}
            <Tabs
              items={tabItems}
              size="small"
              tabPosition={isMobile ? 'top' : 'top'}
            />

            {/* 预览区域 */}
            <div>
              <Text strong>{t('theme:effects.preview')}:</Text>
              <div
                style={{
                  width: '100%',
                  height: '100px',
                  marginTop: 8,
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: effectsConfig.gradient ? 
                    advancedEffectsManager.generateGradientCSS(effectsConfig.gradient) : 
                    'transparent',
                  boxShadow: effectsConfig.shadow ? 
                    advancedEffectsManager.generateShadowCSS(effectsConfig.shadow) : 
                    'none',
                  backgroundImage: effectsConfig.texture ? 
                    advancedEffectsManager.generateTextureCSS(effectsConfig.texture) : 
                    'none',
                }}
              >
                <Text>{t('theme:effects.previewText')}</Text>
              </div>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
};

export default AdvancedEffectsPanel;
