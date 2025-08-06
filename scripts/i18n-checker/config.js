/**
 * i18next翻译键一致性检查配置
 */

const path = require('path');

// 项目根目录
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// 默认配置
const DEFAULT_CONFIG = {
  // 语言文件配置
  locales: {
    // 语言文件根目录
    baseDir: path.join(PROJECT_ROOT, 'src/locales'),
    
    // 支持的语言列表
    languages: ['zh-CN', 'en', 'ru', 'fr'],
    
    // 基准语言（用于比较的参考语言）
    referenceLang: 'zh-CN',
    
    // 命名空间列表
    namespaces: ['common', 'menu', 'theme', 'settings', 'errors', 'file', 'about', 'config', 'startup'],
    
    // 文件扩展名
    fileExtension: '.json'
  },

  // 检查规则配置
  rules: {
    // 严重级别阈值
    severity: {
      missingKey: 'HIGH',      // 缺失翻译键
      extraKey: 'MEDIUM',      // 多余翻译键
      typeMismatch: 'HIGH',    // 类型不匹配
      structureMismatch: 'CRITICAL' // 结构不匹配
    },
    
    // 忽略的键模式（正则表达式）
    ignorePatterns: [
      // 忽略开发时的临时键
      /^temp\./,
      /^debug\./,
      // 忽略注释键
      /^_comment/
    ],
    
    // 忽略的命名空间
    ignoreNamespaces: [],
    
    // 忽略的语言
    ignoreLanguages: []
  },

  // 报告配置
  report: {
    // 输出格式：console, json, html
    format: 'console',
    
    // 输出文件路径（仅用于json和html格式）
    outputPath: path.join(PROJECT_ROOT, 'reports/i18n-check-report'),
    
    // 是否显示详细信息
    verbose: false,
    
    // 是否显示成功的检查项
    showSuccess: false,
    
    // 是否按严重级别分组
    groupBySeverity: true,
    
    // 是否按语言分组
    groupByLanguage: false,
    
    // 是否按命名空间分组
    groupByNamespace: false
  },

  // 修复配置
  fix: {
    // 是否启用自动修复
    enabled: false,
    
    // 是否创建备份
    createBackup: true,
    
    // 备份目录
    backupDir: path.join(PROJECT_ROOT, 'backups/i18n'),
    
    // 自动修复的问题类型
    autoFixTypes: ['MISSING_KEY'],
    
    // 缺失键的占位符模板
    missingKeyPlaceholder: '{{NEEDS_TRANSLATION}}',
    
    // 是否交互式修复
    interactive: true
  },

  // 性能配置
  performance: {
    // 并发处理的文件数量
    concurrency: 4,
    
    // 是否启用缓存
    enableCache: true,
    
    // 缓存目录
    cacheDir: path.join(PROJECT_ROOT, '.cache/i18n-checker')
  }
};

/**
 * 加载配置文件
 * @param {string} configPath - 配置文件路径
 * @returns {Object} 合并后的配置
 */
function loadConfig(configPath) {
  let userConfig = {};
  
  if (configPath) {
    try {
      userConfig = require(path.resolve(configPath));
    } catch (error) {
      console.warn(`警告: 无法加载配置文件 ${configPath}, 使用默认配置`);
    }
  }
  
  // 深度合并配置
  return mergeDeep(DEFAULT_CONFIG, userConfig);
}

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function mergeDeep(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * 验证配置
 * @param {Object} config - 配置对象
 * @returns {Array} 验证错误列表
 */
function validateConfig(config) {
  const errors = [];
  
  // 验证必需的配置项
  if (!config.locales.baseDir) {
    errors.push('locales.baseDir 是必需的');
  }
  
  if (!config.locales.languages || config.locales.languages.length === 0) {
    errors.push('locales.languages 必须包含至少一种语言');
  }
  
  if (!config.locales.referenceLang) {
    errors.push('locales.referenceLang 是必需的');
  }
  
  if (config.locales.referenceLang && !config.locales.languages.includes(config.locales.referenceLang)) {
    errors.push('locales.referenceLang 必须在 locales.languages 列表中');
  }
  
  // 验证严重级别
  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  for (const [rule, severity] of Object.entries(config.rules.severity)) {
    if (!validSeverities.includes(severity)) {
      errors.push(`rules.severity.${rule} 必须是以下值之一: ${validSeverities.join(', ')}`);
    }
  }
  
  return errors;
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  validateConfig,
  mergeDeep
};
