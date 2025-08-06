/**
 * 高级视觉效果管理器
 * 提供渐变背景、高级阴影、边框效果、背景纹理等高级视觉效果
 */

// 渐变类型枚举
export enum GradientType {
  LINEAR = 'linear',
  RADIAL = 'radial',
  CONIC = 'conic',
}

// 渐变方向枚举
export enum GradientDirection {
  TO_RIGHT = 'to right',
  TO_LEFT = 'to left',
  TO_BOTTOM = 'to bottom',
  TO_TOP = 'to top',
  TO_BOTTOM_RIGHT = 'to bottom right',
  TO_BOTTOM_LEFT = 'to bottom left',
  TO_TOP_RIGHT = 'to top right',
  TO_TOP_LEFT = 'to top left',
}

// 阴影类型枚举
export enum ShadowType {
  NONE = 'none',
  SUBTLE = 'subtle',
  MEDIUM = 'medium',
  STRONG = 'strong',
  GLOW = 'glow',
  INSET = 'inset',
  CUSTOM = 'custom',
}

// 边框样式枚举
export enum BorderStyle {
  NONE = 'none',
  SOLID = 'solid',
  DASHED = 'dashed',
  DOTTED = 'dotted',
  DOUBLE = 'double',
  GROOVE = 'groove',
  RIDGE = 'ridge',
  INSET = 'inset',
  OUTSET = 'outset',
}

// 纹理类型枚举
export enum TextureType {
  NONE = 'none',
  PAPER = 'paper',
  FABRIC = 'fabric',
  WOOD = 'wood',
  METAL = 'metal',
  NOISE = 'noise',
  DOTS = 'dots',
  LINES = 'lines',
  GRID = 'grid',
}

// 渐变配置接口
export interface GradientConfig {
  type: GradientType;
  direction?: GradientDirection;
  colors: Array<{
    color: string;
    position: number; // 0-100
  }>;
  angle?: number; // 0-360 for linear gradients
  centerX?: number; // 0-100 for radial gradients
  centerY?: number; // 0-100 for radial gradients
}

// 阴影配置接口
export interface ShadowConfig {
  type: ShadowType;
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  color: string;
  inset: boolean;
}

// 边框配置接口
export interface BorderConfig {
  style: BorderStyle;
  width: number;
  color: string;
  radius: number;
}

// 纹理配置接口
export interface TextureConfig {
  type: TextureType;
  opacity: number; // 0-1
  scale: number; // 0.1-5
  color?: string;
}

// 高级效果配置接口
export interface AdvancedEffectsConfig {
  gradient?: GradientConfig;
  shadow?: ShadowConfig;
  border?: BorderConfig;
  texture?: TextureConfig;
  enabled: boolean;
}

/**
 * 高级视觉效果管理器类
 */
export class AdvancedEffectsManager {
  private static instance: AdvancedEffectsManager;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): AdvancedEffectsManager {
    if (!AdvancedEffectsManager.instance) {
      AdvancedEffectsManager.instance = new AdvancedEffectsManager();
    }
    return AdvancedEffectsManager.instance;
  }

  /**
   * 生成渐变CSS
   */
  public generateGradientCSS(config: GradientConfig): string {
    const { type, direction, colors, angle, centerX = 50, centerY = 50 } = config;
    
    const colorStops = colors
      .map(({ color, position }) => `${color} ${position}%`)
      .join(', ');

    switch (type) {
      case GradientType.LINEAR:
        if (angle !== undefined) {
          return `linear-gradient(${angle}deg, ${colorStops})`;
        }
        return `linear-gradient(${direction || GradientDirection.TO_RIGHT}, ${colorStops})`;
      
      case GradientType.RADIAL:
        return `radial-gradient(circle at ${centerX}% ${centerY}%, ${colorStops})`;
      
      case GradientType.CONIC:
        return `conic-gradient(from ${angle || 0}deg at ${centerX}% ${centerY}%, ${colorStops})`;
      
      default:
        return 'none';
    }
  }

  /**
   * 生成阴影CSS
   */
  public generateShadowCSS(config: ShadowConfig): string {
    const { type, offsetX, offsetY, blurRadius, spreadRadius, color, inset } = config;
    
    if (type === ShadowType.NONE) {
      return 'none';
    }

    const insetKeyword = inset ? 'inset ' : '';
    
    switch (type) {
      case ShadowType.SUBTLE:
        return `${insetKeyword}0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)`;
      
      case ShadowType.MEDIUM:
        return `${insetKeyword}0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)`;
      
      case ShadowType.STRONG:
        return `${insetKeyword}0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)`;
      
      case ShadowType.GLOW:
        return `${insetKeyword}0 0 ${blurRadius}px ${spreadRadius}px ${color}`;
      
      case ShadowType.CUSTOM:
        return `${insetKeyword}${offsetX}px ${offsetY}px ${blurRadius}px ${spreadRadius}px ${color}`;
      
      default:
        return 'none';
    }
  }

  /**
   * 生成边框CSS
   */
  public generateBorderCSS(config: BorderConfig): string | Record<string, string> {
    const { style, width, color, radius } = config;

    if (style === BorderStyle.NONE) {
      return 'none';
    }

    return {
      border: `${width}px ${style} ${color}`,
      borderRadius: `${radius}px`,
    };
  }

  /**
   * 生成纹理CSS
   */
  public generateTextureCSS(config: TextureConfig): string {
    const { type, opacity, scale, color = '#000000' } = config;
    
    if (type === TextureType.NONE) {
      return 'none';
    }

    const baseOpacity = opacity * 0.1; // 降低基础透明度
    
    switch (type) {
      case TextureType.PAPER:
        return `
          radial-gradient(circle at 20% 50%, rgba(120, 119, 198, ${baseOpacity}) 0%, transparent 50%),
          radial-gradient(circle at 80% 50%, rgba(255, 119, 198, ${baseOpacity}) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(120, 219, 255, ${baseOpacity}) 0%, transparent 50%)
        `;
      
      case TextureType.FABRIC:
        return `
          repeating-linear-gradient(45deg, transparent, transparent 2px, ${color} 2px, ${color} 4px),
          repeating-linear-gradient(-45deg, transparent, transparent 2px, ${color} 2px, ${color} 4px)
        `;
      
      case TextureType.WOOD:
        return `
          repeating-linear-gradient(90deg, 
            rgba(139, 69, 19, ${baseOpacity}) 0px, 
            rgba(160, 82, 45, ${baseOpacity}) 10px, 
            rgba(139, 69, 19, ${baseOpacity}) 20px)
        `;
      
      case TextureType.METAL:
        return `
          linear-gradient(135deg, 
            rgba(192, 192, 192, ${baseOpacity}) 0%, 
            rgba(169, 169, 169, ${baseOpacity}) 25%, 
            rgba(211, 211, 211, ${baseOpacity}) 50%, 
            rgba(169, 169, 169, ${baseOpacity}) 75%, 
            rgba(192, 192, 192, ${baseOpacity}) 100%)
        `;
      
      case TextureType.NOISE:
        // 使用CSS生成噪点效果
        return `
          radial-gradient(circle at 25% 25%, ${color} 1px, transparent 1px),
          radial-gradient(circle at 75% 75%, ${color} 1px, transparent 1px),
          radial-gradient(circle at 25% 75%, ${color} 1px, transparent 1px),
          radial-gradient(circle at 75% 25%, ${color} 1px, transparent 1px)
        `;
      
      case TextureType.DOTS:
        const dotSize = scale * 2;
        const spacing = scale * 20;
        return `
          radial-gradient(circle at center, ${color} ${dotSize}px, transparent ${dotSize}px),
          background-size: ${spacing}px ${spacing}px
        `;
      
      case TextureType.LINES:
        const lineWidth = scale;
        const lineSpacing = scale * 10;
        return `
          repeating-linear-gradient(0deg, 
            transparent, 
            transparent ${lineSpacing}px, 
            ${color} ${lineSpacing}px, 
            ${color} ${lineSpacing + lineWidth}px)
        `;
      
      case TextureType.GRID:
        const gridSize = scale * 20;
        return `
          linear-gradient(${color} 1px, transparent 1px),
          linear-gradient(90deg, ${color} 1px, transparent 1px),
          background-size: ${gridSize}px ${gridSize}px
        `;
      
      default:
        return 'none';
    }
  }

  /**
   * 应用高级效果到元素
   */
  public applyEffects(element: HTMLElement, config: AdvancedEffectsConfig): void {
    if (!config.enabled) {
      this.removeEffects(element);
      return;
    }

    const styles: Partial<CSSStyleDeclaration> = {};

    // 应用渐变
    if (config.gradient) {
      const gradientCSS = this.generateGradientCSS(config.gradient);
      styles.background = gradientCSS;
    }

    // 应用阴影
    if (config.shadow) {
      const shadowCSS = this.generateShadowCSS(config.shadow);
      styles.boxShadow = shadowCSS;
    }

    // 应用边框
    if (config.border) {
      const borderCSS = this.generateBorderCSS(config.border);
      if (typeof borderCSS === 'object') {
        Object.assign(styles, borderCSS);
      }
    }

    // 应用纹理
    if (config.texture) {
      const textureCSS = this.generateTextureCSS(config.texture);
      if (textureCSS !== 'none') {
        styles.backgroundImage = textureCSS;
      }
    }

    // 应用样式到元素
    Object.assign(element.style, styles);
  }

  /**
   * 移除高级效果
   */
  public removeEffects(element: HTMLElement): void {
    element.style.background = '';
    element.style.backgroundImage = '';
    element.style.boxShadow = '';
    element.style.border = '';
    element.style.borderRadius = '';
  }

  /**
   * 获取预设效果配置
   */
  public getPresetConfigs(): Record<string, AdvancedEffectsConfig> {
    return {
      sunset: {
        enabled: true,
        gradient: {
          type: GradientType.LINEAR,
          direction: GradientDirection.TO_BOTTOM_RIGHT,
          colors: [
            { color: '#ff7e5f', position: 0 },
            { color: '#feb47b', position: 100 },
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
      },
      ocean: {
        enabled: true,
        gradient: {
          type: GradientType.RADIAL,
          colors: [
            { color: '#667eea', position: 0 },
            { color: '#764ba2', position: 100 },
          ],
          centerX: 50,
          centerY: 50,
        },
        texture: {
          type: TextureType.NOISE,
          opacity: 0.3,
          scale: 1,
        },
      },
      forest: {
        enabled: true,
        gradient: {
          type: GradientType.LINEAR,
          direction: GradientDirection.TO_BOTTOM,
          colors: [
            { color: '#134e5e', position: 0 },
            { color: '#71b280', position: 100 },
          ],
        },
        border: {
          style: BorderStyle.SOLID,
          width: 2,
          color: '#2d5a27',
          radius: 12,
        },
      },
    };
  }
}

// 导出单例实例
export const advancedEffectsManager = AdvancedEffectsManager.getInstance();
