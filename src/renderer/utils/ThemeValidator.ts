/**
 * 主题配置验证器
 * 提供主题文件格式验证、版本兼容性检查、错误诊断功能
 */

import type { ThemeConfig } from '../contexts/ThemeContext';

// 验证结果接口
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fixedConfig?: ThemeConfig;
}

// 验证错误接口
export interface ValidationError {
  code: string;
  message: string;
  path: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

// 验证警告接口
export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  suggestion: string;
}

// 支持的主题版本
const SUPPORTED_VERSIONS = ['1.0.0', '1.1.0', '1.2.0'];
const CURRENT_VERSION = '1.2.0';

// 必需字段定义
const REQUIRED_FIELDS = {
  version: 'string',
  mode: 'string',
  primaryColor: 'string',
  borderRadius: 'number',
  fontFamily: 'string',
  fontSize: 'number',
  glassEffect: 'boolean',
  glassOpacity: 'number',
  customColors: 'object',
};

// 自定义颜色必需字段
const REQUIRED_CUSTOM_COLORS = {
  surface: 'string',
  text: 'string',
  textSecondary: 'string',
  border: 'string',
  shadow: 'string',
};

// 颜色格式验证正则
const COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const RGBA_REGEX = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+)?\s*\)$/;

/**
 * 主题验证器类
 */
export class ThemeValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];

  /**
   * 验证主题配置
   */
  public validate(themeData: any): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // 基础类型检查
    if (!this.isObject(themeData)) {
      this.addError('INVALID_FORMAT', '主题文件必须是有效的JSON对象', '', '请确保文件是有效的JSON格式');
      return this.getResult();
    }

    // 版本检查
    this.validateVersion(themeData);

    // 必需字段检查
    this.validateRequiredFields(themeData);

    // 字段类型检查
    this.validateFieldTypes(themeData);

    // 颜色格式检查
    this.validateColors(themeData);

    // 数值范围检查
    this.validateRanges(themeData);

    // 自定义主题检查
    this.validateCustomThemes(themeData);

    // 生成修复后的配置
    const fixedConfig = this.generateFixedConfig(themeData);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      fixedConfig,
    };
  }

  /**
   * 验证版本
   */
  private validateVersion(themeData: any): void {
    if (!themeData.version) {
      this.addError('MISSING_VERSION', '缺少版本信息', 'version', '添加版本字段，建议使用 "1.2.0"');
      return;
    }

    if (typeof themeData.version !== 'string') {
      this.addError('INVALID_VERSION_TYPE', '版本信息必须是字符串', 'version', '将版本改为字符串格式');
      return;
    }

    if (!SUPPORTED_VERSIONS.includes(themeData.version)) {
      this.addWarning('UNSUPPORTED_VERSION', 
        `不支持的版本 "${themeData.version}"，支持的版本: ${SUPPORTED_VERSIONS.join(', ')}`, 
        'version', 
        `建议升级到版本 ${CURRENT_VERSION}`);
    }
  }

  /**
   * 验证必需字段
   */
  private validateRequiredFields(themeData: any): void {
    Object.entries(REQUIRED_FIELDS).forEach(([field, expectedType]) => {
      if (!(field in themeData)) {
        this.addError('MISSING_FIELD', `缺少必需字段 "${field}"`, field, `添加 ${field} 字段`);
      }
    });

    // 验证自定义颜色必需字段
    if (themeData.customColors && this.isObject(themeData.customColors)) {
      Object.entries(REQUIRED_CUSTOM_COLORS).forEach(([field, expectedType]) => {
        if (!(field in themeData.customColors)) {
          this.addError('MISSING_CUSTOM_COLOR', `缺少必需的自定义颜色 "${field}"`, `customColors.${field}`, `添加 ${field} 颜色`);
        }
      });
    }
  }

  /**
   * 验证字段类型
   */
  private validateFieldTypes(themeData: any): void {
    Object.entries(REQUIRED_FIELDS).forEach(([field, expectedType]) => {
      if (field in themeData && typeof themeData[field] !== expectedType) {
        this.addError('INVALID_TYPE', 
          `字段 "${field}" 类型错误，期望 ${expectedType}，实际 ${typeof themeData[field]}`, 
          field, 
          `将 ${field} 改为 ${expectedType} 类型`);
      }
    });

    // 验证模式值
    if (themeData.mode && !['light', 'dark', 'auto'].includes(themeData.mode)) {
      this.addError('INVALID_MODE', 
        `无效的模式值 "${themeData.mode}"，支持: light, dark, auto`, 
        'mode', 
        '使用有效的模式值');
    }
  }

  /**
   * 验证颜色格式
   */
  private validateColors(themeData: any): void {
    // 验证主色调
    if (themeData.primaryColor) {
      this.validateColorFormat(themeData.primaryColor, 'primaryColor');
    }

    // 验证自定义颜色
    if (themeData.customColors && this.isObject(themeData.customColors)) {
      Object.entries(themeData.customColors).forEach(([key, value]) => {
        if (typeof value === 'string') {
          this.validateColorFormat(value, `customColors.${key}`);
        }
      });
    }

    // 验证自定义主题中的颜色
    if (themeData.customThemes && this.isObject(themeData.customThemes)) {
      Object.entries(themeData.customThemes).forEach(([themeName, theme]: [string, any]) => {
        if (theme.colors && this.isObject(theme.colors)) {
          Object.entries(theme.colors).forEach(([colorKey, colorValue]) => {
            if (typeof colorValue === 'string') {
              this.validateColorFormat(colorValue, `customThemes.${themeName}.colors.${colorKey}`);
            }
          });
        }
      });
    }
  }

  /**
   * 验证单个颜色格式
   */
  private validateColorFormat(color: string, path: string): void {
    if (!COLOR_REGEX.test(color) && !RGBA_REGEX.test(color)) {
      this.addError('INVALID_COLOR_FORMAT', 
        `无效的颜色格式 "${color}"`, 
        path, 
        '使用有效的颜色格式，如 #ff0000 或 rgba(255, 0, 0, 1)');
    }
  }

  /**
   * 验证数值范围
   */
  private validateRanges(themeData: any): void {
    // 验证边框圆角
    if (typeof themeData.borderRadius === 'number') {
      if (themeData.borderRadius < 0 || themeData.borderRadius > 50) {
        this.addWarning('INVALID_BORDER_RADIUS_RANGE', 
          `边框圆角值 ${themeData.borderRadius} 超出推荐范围 (0-50)`, 
          'borderRadius', 
          '使用 0-50 之间的值');
      }
    }

    // 验证字体大小
    if (typeof themeData.fontSize === 'number') {
      if (themeData.fontSize < 10 || themeData.fontSize > 24) {
        this.addWarning('INVALID_FONT_SIZE_RANGE', 
          `字体大小 ${themeData.fontSize} 超出推荐范围 (10-24)`, 
          'fontSize', 
          '使用 10-24 之间的值');
      }
    }

    // 验证毛玻璃透明度
    if (typeof themeData.glassOpacity === 'number') {
      if (themeData.glassOpacity < 0 || themeData.glassOpacity > 1) {
        this.addError('INVALID_GLASS_OPACITY_RANGE', 
          `毛玻璃透明度 ${themeData.glassOpacity} 必须在 0-1 之间`, 
          'glassOpacity', 
          '使用 0-1 之间的值');
      }
    }
  }

  /**
   * 验证自定义主题
   */
  private validateCustomThemes(themeData: any): void {
    if (!themeData.customThemes) return;

    if (!this.isObject(themeData.customThemes)) {
      this.addError('INVALID_CUSTOM_THEMES_TYPE', 
        'customThemes 必须是对象', 
        'customThemes', 
        '将 customThemes 改为对象格式');
      return;
    }

    Object.entries(themeData.customThemes).forEach(([themeName, theme]: [string, any]) => {
      const basePath = `customThemes.${themeName}`;

      if (!this.isObject(theme)) {
        this.addError('INVALID_CUSTOM_THEME_TYPE', 
          `自定义主题 "${themeName}" 必须是对象`, 
          basePath, 
          '将主题改为对象格式');
        return;
      }

      // 验证主题名称
      if (!theme.name || typeof theme.name !== 'string') {
        this.addError('MISSING_THEME_NAME', 
          `自定义主题 "${themeName}" 缺少名称`, 
          `${basePath}.name`, 
          '添加主题名称');
      }

      // 验证主题结构
      const requiredThemeFields = ['colors', 'fonts', 'effects'];
      requiredThemeFields.forEach(field => {
        if (!theme[field] || !this.isObject(theme[field])) {
          this.addWarning('MISSING_THEME_FIELD', 
            `自定义主题 "${themeName}" 缺少 ${field} 配置`, 
            `${basePath}.${field}`, 
            `添加 ${field} 配置对象`);
        }
      });
    });
  }

  /**
   * 生成修复后的配置
   */
  private generateFixedConfig(themeData: any): ThemeConfig | undefined {
    if (this.errors.length > 0) return undefined;

    // 创建默认配置
    const defaultConfig: ThemeConfig = {
      version: CURRENT_VERSION,
      activeTheme: 'default',
      mode: 'auto',
      primaryColor: '#1890ff',
      borderRadius: 8,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 14,
      compactMode: false,
      glassEffect: true,
      glassOpacity: 0.8,
      customColors: {
        surface: '#fafafa',
        text: '#000000',
        textSecondary: '#666666',
        border: '#d9d9d9',
        shadow: 'rgba(0, 0, 0, 0.1)',
      },
      customThemes: {},
    };

    // 合并用户配置
    const fixedConfig = { ...defaultConfig, ...themeData };

    // 修复版本
    if (!SUPPORTED_VERSIONS.includes(fixedConfig.version)) {
      fixedConfig.version = CURRENT_VERSION;
    }

    // 修复数值范围
    if (fixedConfig.borderRadius < 0 || fixedConfig.borderRadius > 50) {
      fixedConfig.borderRadius = Math.max(0, Math.min(50, fixedConfig.borderRadius));
    }

    if (fixedConfig.fontSize < 10 || fixedConfig.fontSize > 24) {
      fixedConfig.fontSize = Math.max(10, Math.min(24, fixedConfig.fontSize));
    }

    if (fixedConfig.glassOpacity < 0 || fixedConfig.glassOpacity > 1) {
      fixedConfig.glassOpacity = Math.max(0, Math.min(1, fixedConfig.glassOpacity));
    }

    return fixedConfig;
  }

  /**
   * 添加错误
   */
  private addError(code: string, message: string, path: string, suggestion?: string): void {
    this.errors.push({
      code,
      message,
      path,
      severity: 'error',
      suggestion,
    });
  }

  /**
   * 添加警告
   */
  private addWarning(code: string, message: string, path: string, suggestion: string): void {
    this.warnings.push({
      code,
      message,
      path,
      suggestion,
    });
  }

  /**
   * 获取验证结果
   */
  private getResult(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * 检查是否为对象
   */
  private isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

// 导出单例实例
export const themeValidator = new ThemeValidator();
