import { useEffect, useCallback, useRef } from 'react';
import { useBackgroundConfig } from './useBackgroundConfig';
import type { BackgroundConfigSchema } from '../../shared/config-schemas';

// 背景样式类型定义
interface BackgroundImageStyle {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
  filter: string;
  transform: string;
}

type BackgroundStyle = string | BackgroundImageStyle;

/**
 * 背景渲染Hook
 * 负责将背景配置应用到DOM中
 */
export function useBackgroundRenderer() {
  const { config, loading, error } = useBackgroundConfig();

  // 使用ref来存储上一次的配置，避免不必要的DOM操作
  const prevConfigRef = useRef<BackgroundConfigSchema | null>(null);

  // 比较配置是否发生了实质性变化
  const hasConfigChanged = useCallback((newConfig: BackgroundConfigSchema, oldConfig: BackgroundConfigSchema | null): boolean => {
    if (!oldConfig) return true;

    // 比较关键属性
    if (newConfig.enabled !== oldConfig.enabled) return true;
    if (newConfig.type !== oldConfig.type) return true;

    // 根据类型比较具体配置
    switch (newConfig.type) {
      case 'color':
        return JSON.stringify(newConfig.color) !== JSON.stringify(oldConfig.color);
      case 'gradient':
        return JSON.stringify(newConfig.gradient) !== JSON.stringify(oldConfig.gradient);
      case 'image':
        return JSON.stringify(newConfig.image) !== JSON.stringify(oldConfig.image);
      default:
        return false;
    }
  }, []);

  // 生成背景样式
  const generateBackgroundStyle = useCallback((config: BackgroundConfigSchema): BackgroundStyle => {
    if (!config.enabled || config.type === 'none') {
      return 'none';
    }

    switch (config.type) {
      case 'color': {
        const { value, opacity } = config.color;
        const rgb = hexToRgb(value);
        if (rgb) {
          return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
        }
        return value;
      }

      case 'gradient': {
        const { type, direction, colors, opacity } = config.gradient;
        if (!colors || !Array.isArray(colors) || colors.length === 0) {
          return 'none';
        }
        const colorStops = colors
          .map(({ color, position }) => `${color} ${position}%`)
          .join(', ');
        
        if (type === 'linear') {
          return `linear-gradient(${direction}deg, ${colorStops})`;
        } else if (type === 'radial') {
          return `radial-gradient(circle, ${colorStops})`;
        }
        return 'none';
      }

      case 'image': {
        const { path, displayMode, opacity, blur, brightness, contrast, saturation, position, scale, rotation } = config.image;

        if (!path) return 'none';

        // 构建CSS滤镜
        const filters = [];
        if (blur > 0) filters.push(`blur(${blur}px)`);
        if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
        if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
        if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
        if (opacity < 1) filters.push(`opacity(${opacity})`);

        // 处理图片路径 - 确保正确的URL格式
        let imageUrl = path;
        if (path.startsWith('data:')) {
          // Data URL，直接使用
          imageUrl = path;
        } else if (path.startsWith('http://') || path.startsWith('https://')) {
          // 网络URL，直接使用
          imageUrl = path;
        } else if (path.startsWith('file://')) {
          // 已经是file协议，直接使用
          imageUrl = path;
        } else {
          // 本地文件路径，转换为file协议URL
          // 处理Windows路径分隔符
          const normalizedPath = path.replace(/\\/g, '/');
          imageUrl = `file:///${normalizedPath}`;
        }

        // 开发调试信息：背景图片URL转换过程，使用英文是合理的
        console.log('Background image URL conversion:', { originalPath: path, convertedUrl: imageUrl });

        // 构建背景样式
        const backgroundImage = `url("${imageUrl}")`;
        const backgroundSize = getBackgroundSize(displayMode);
        const backgroundPosition = `${position.x}% ${position.y}%`;
        const backgroundRepeat = displayMode === 'tile' ? 'repeat' : 'no-repeat';

        return {
          backgroundImage,
          backgroundSize,
          backgroundPosition,
          backgroundRepeat,
          filter: filters.length > 0 ? filters.join(' ') : 'none',
          transform: scale !== 1 || rotation !== 0 ? `scale(${scale}) rotate(${rotation}deg)` : 'none'
        } as BackgroundImageStyle;
      }

      default:
        return 'none';
    }
  }, []);

  // 应用背景到DOM
  const applyBackground = useCallback((config: BackgroundConfigSchema) => {
    const root = document.documentElement;
    const body = document.body;

    console.log('Applying background to DOM:', {
      enabled: config.enabled,
      type: config.type,
      imagePath: config.type === 'image' ? config.image.path : 'N/A'
    });

    if (!config.enabled || config.type === 'none') {
      // 清除背景
      // 开发调试信息：背景样式清除过程，使用英文是合理的
      console.log('Clearing background styles');
      root.style.removeProperty('--app-background');
      root.style.removeProperty('--app-background-image');
      root.style.removeProperty('--app-background-size');
      root.style.removeProperty('--app-background-position');
      root.style.removeProperty('--app-background-repeat');
      root.style.removeProperty('--app-background-filter');
      root.style.removeProperty('--app-background-transform');
      body.style.background = '';
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundRepeat = '';
      body.style.filter = '';
      body.style.backgroundAttachment = '';
      return;
    }

    const backgroundStyle = generateBackgroundStyle(config);

    if (config.type === 'image' && typeof backgroundStyle === 'object' && backgroundStyle !== null) {
      const imageStyle = backgroundStyle;
      console.log('Applying image background:', imageStyle);

      // 图片背景需要特殊处理
      root.style.setProperty('--app-background-image', imageStyle.backgroundImage);
      root.style.setProperty('--app-background-size', imageStyle.backgroundSize);
      root.style.setProperty('--app-background-position', imageStyle.backgroundPosition);
      root.style.setProperty('--app-background-repeat', imageStyle.backgroundRepeat);
      root.style.setProperty('--app-background-filter', imageStyle.filter);
      root.style.setProperty('--app-background-transform', imageStyle.transform);

      // 应用到body
      body.style.backgroundImage = imageStyle.backgroundImage;
      body.style.backgroundSize = imageStyle.backgroundSize;
      body.style.backgroundPosition = imageStyle.backgroundPosition;
      body.style.backgroundRepeat = imageStyle.backgroundRepeat;
      body.style.filter = imageStyle.filter;
      body.style.backgroundAttachment = 'fixed';

      console.log('Image background applied to body:', {
        backgroundImage: body.style.backgroundImage,
        backgroundSize: body.style.backgroundSize,
        backgroundPosition: body.style.backgroundPosition,
        backgroundRepeat: body.style.backgroundRepeat,
        filter: body.style.filter,
        backgroundAttachment: body.style.backgroundAttachment
      });
    } else if (typeof backgroundStyle === 'string') {
      // 纯色或渐变背景
      console.log('Applying color/gradient background:', backgroundStyle);
      root.style.setProperty('--app-background', backgroundStyle);
      body.style.background = backgroundStyle;
      body.style.backgroundAttachment = 'fixed';
    }
  }, [generateBackgroundStyle]);

  // 监听配置变化并应用背景 - 优化版本，只在配置真正变化时更新
  useEffect(() => {
    if (config && !loading && !error) {
      // 检查配置是否真的发生了变化
      if (hasConfigChanged(config, prevConfigRef.current)) {
        console.log('Background config changed, applying new background...', {
          type: config.type,
          enabled: config.enabled,
          imagePath: config.type === 'image' ? config.image.path : 'N/A'
        });
        applyBackground(config);
        prevConfigRef.current = config;
      } else {
        console.log('Background config unchanged, skipping update');
      }
    } else {
      console.log('Background renderer waiting...', { config: !!config, loading, error });
    }
  }, [config, loading, error, applyBackground, hasConfigChanged]);

  // 组件卸载时清理背景
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      const body = document.body;
      
      // 清除所有背景相关样式
      root.style.removeProperty('--app-background');
      root.style.removeProperty('--app-background-image');
      root.style.removeProperty('--app-background-size');
      root.style.removeProperty('--app-background-position');
      root.style.removeProperty('--app-background-repeat');
      root.style.removeProperty('--app-background-filter');
      root.style.removeProperty('--app-background-transform');
      body.style.background = '';
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundRepeat = '';
      body.style.filter = '';
      body.style.backgroundAttachment = '';
    };
  }, []);

  return {
    config,
    loading,
    error,
    applyBackground,
    generateBackgroundStyle
  };
}

// 辅助函数：将十六进制颜色转换为RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// 辅助函数：获取背景尺寸
function getBackgroundSize(displayMode: string): string {
  switch (displayMode) {
    case 'stretch':
      return '100% 100%';
    case 'tile':
      return 'auto';
    case 'center':
      return 'auto';
    case 'cover':
      return 'cover';
    case 'contain':
      return 'contain';
    default:
      return 'cover';
  }
}
