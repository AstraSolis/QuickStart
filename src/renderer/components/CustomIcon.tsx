/**
 * 自定义图标组件
 * 支持颜色、大小、样式的动态调整，集成CSS变量和CSS滤镜
 */

import React, { useMemo } from 'react';
import type { CSSProperties, ComponentType } from 'react';
import { Tooltip } from 'antd';
import { fileIconMapper, type FileIconConfig } from '../utils/FileIconMapper';
import { useTheme } from '../contexts/ThemeContext';

// 图标尺寸预设
export enum IconSize {
  SMALL = 'small',
  MEDIUM = 'medium', 
  LARGE = 'large',
  EXTRA_LARGE = 'extra-large',
}

// 图标样式预设
export enum IconStyle {
  NORMAL = 'normal',
  OUTLINED = 'outlined',
  FILLED = 'filled',
  ROUNDED = 'rounded',
}

// 图标效果预设
export enum IconEffect {
  NONE = 'none',
  SHADOW = 'shadow',
  GLOW = 'glow',
  BLUR = 'blur',
  BRIGHTNESS = 'brightness',
  CONTRAST = 'contrast',
  SATURATE = 'saturate',
}

// 组件属性接口
export interface CustomIconProps {
  /** 文件路径，用于自动识别图标类型 */
  filePath?: string;
  /** 是否为目录 */
  isDirectory?: boolean;
  /** 自定义图标组件 */
  icon?: ComponentType<any>;
  /** 图标颜色 */
  color?: string;
  /** 图标尺寸 */
  size?: IconSize | number;
  /** 图标样式 */
  style?: IconStyle;
  /** 图标效果 */
  effect?: IconEffect;
  /** 效果强度 (0-100) */
  effectIntensity?: number;
  /** 是否启用悬停效果 */
  hoverEffect?: boolean;
  /** 是否显示工具提示 */
  showTooltip?: boolean;
  /** 自定义工具提示内容 */
  tooltipContent?: string;
  /** 自定义CSS类名 */
  className?: string;
  /** 自定义内联样式 */
  customStyle?: CSSProperties;
  /** 点击事件处理 */
  onClick?: (event: React.MouseEvent) => void;
  /** 双击事件处理 */
  onDoubleClick?: (event: React.MouseEvent) => void;
}

// 尺寸映射
const SIZE_MAP: Record<IconSize, number> = {
  [IconSize.SMALL]: 16,
  [IconSize.MEDIUM]: 20,
  [IconSize.LARGE]: 24,
  [IconSize.EXTRA_LARGE]: 32,
};

/**
 * 自定义图标组件
 */
export const CustomIcon: React.FC<CustomIconProps> = ({
  filePath,
  isDirectory = false,
  icon: customIcon,
  color: customColor,
  size = IconSize.MEDIUM,
  style = IconStyle.NORMAL,
  effect = IconEffect.NONE,
  effectIntensity = 50,
  hoverEffect = true,
  showTooltip = true,
  tooltipContent,
  className = '',
  customStyle = {},
  onClick,
  onDoubleClick,
}) => {
  const { themeConfig } = useTheme();

  // 获取图标配置
  const iconConfig: FileIconConfig = useMemo(() => {
    if (customIcon) {
      return {
        icon: customIcon,
        color: customColor || themeConfig.primaryColor,
        category: 'other',
        description: '自定义图标',
      };
    }

    if (filePath) {
      return fileIconMapper.getIconConfig(filePath, isDirectory);
    }

    return {
      icon: customIcon || (() => null),
      color: customColor || themeConfig.primaryColor,
      category: 'other',
      description: '默认图标',
    };
  }, [filePath, isDirectory, customIcon, customColor, themeConfig.primaryColor]);

  // 计算图标尺寸
  const iconSize = useMemo(() => {
    return typeof size === 'number' ? size : SIZE_MAP[size];
  }, [size]);

  // 生成CSS滤镜
  const generateFilter = useMemo(() => {
    const filters: string[] = [];
    const intensity = Math.max(0, Math.min(100, effectIntensity)) / 100;

    switch (effect) {
      case IconEffect.SHADOW:
        filters.push(`drop-shadow(2px 2px 4px rgba(0, 0, 0, ${0.3 * intensity}))`);
        break;
      case IconEffect.GLOW:
        filters.push(`drop-shadow(0 0 ${8 * intensity}px ${iconConfig.color})`);
        break;
      case IconEffect.BLUR:
        filters.push(`blur(${2 * intensity}px)`);
        break;
      case IconEffect.BRIGHTNESS:
        filters.push(`brightness(${1 + intensity})`);
        break;
      case IconEffect.CONTRAST:
        filters.push(`contrast(${1 + intensity})`);
        break;
      case IconEffect.SATURATE:
        filters.push(`saturate(${1 + intensity})`);
        break;
      default:
        break;
    }

    return filters.length > 0 ? filters.join(' ') : 'none';
  }, [effect, effectIntensity, iconConfig.color]);

  // 生成样式
  const iconStyle: CSSProperties = useMemo(() => {
    const baseStyle: CSSProperties = {
      fontSize: iconSize,
      color: customColor || iconConfig.color,
      filter: generateFilter,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: onClick || onDoubleClick ? 'pointer' : 'default',
      userSelect: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    };

    // 应用样式预设
    switch (style) {
      case IconStyle.OUTLINED:
        baseStyle.strokeWidth = 2;
        baseStyle.fill = 'none';
        baseStyle.stroke = 'currentColor';
        break;
      case IconStyle.FILLED:
        baseStyle.fill = 'currentColor';
        break;
      case IconStyle.ROUNDED:
        baseStyle.borderRadius = '50%';
        baseStyle.padding = '2px';
        baseStyle.backgroundColor = `${iconConfig.color}15`;
        break;
      default:
        break;
    }

    // 悬停效果通过CSS类处理，不在内联样式中设置伪选择器

    return { ...baseStyle, ...customStyle };
  }, [
    iconSize,
    customColor,
    iconConfig.color,
    generateFilter,
    onClick,
    onDoubleClick,
    style,
    hoverEffect,
    customStyle,
  ]);

  // 生成工具提示内容
  const tooltipText = useMemo(() => {
    if (tooltipContent) return tooltipContent;
    if (filePath) {
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      return `${fileName} (${iconConfig.description})`;
    }
    return iconConfig.description;
  }, [tooltipContent, filePath, iconConfig.description]);

  // 渲染图标
  const IconComponent = iconConfig.icon;
  
  const iconElement = (
    <span
      className={`custom-icon ${className}`}
      style={iconStyle}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <IconComponent />
    </span>
  );

  // 包装工具提示
  if (showTooltip && tooltipText) {
    return (
      <Tooltip title={tooltipText} placement="top">
        {iconElement}
      </Tooltip>
    );
  }

  return iconElement;
};

/**
 * 文件图标组件 - CustomIcon的便捷封装
 */
export interface FileIconProps extends Omit<CustomIconProps, 'filePath' | 'isDirectory'> {
  /** 文件路径 */
  path: string;
  /** 是否为目录 */
  isDirectory?: boolean;
}

export const FileIcon: React.FC<FileIconProps> = ({ path, isDirectory, ...props }) => {
  return (
    <CustomIcon
      filePath={path}
      isDirectory={isDirectory}
      {...props}
    />
  );
};

/**
 * 图标预览组件 - 用于图标选择器
 */
export interface IconPreviewProps {
  /** 图标配置 */
  config: FileIconConfig;
  /** 是否选中 */
  selected?: boolean;
  /** 点击事件 */
  onClick?: () => void;
}

export const IconPreview: React.FC<IconPreviewProps> = ({
  config,
  selected = false,
  onClick,
}) => {
  const previewStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px',
    borderRadius: '6px',
    border: selected ? '2px solid #1890ff' : '2px solid transparent',
    backgroundColor: selected ? '#f0f8ff' : 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '60px',
  };

  return (
    <div style={previewStyle} onClick={onClick}>
      <CustomIcon
        icon={config.icon}
        color={config.color}
        size={IconSize.LARGE}
        showTooltip={false}
      />
      <span style={{ 
        fontSize: '12px', 
        marginTop: '4px', 
        textAlign: 'center',
        color: '#666',
      }}>
        {config.description}
      </span>
    </div>
  );
};

// 导出类型
export type { FileIconConfig };
