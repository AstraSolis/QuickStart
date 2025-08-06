/**
 * i18next翻译键一致性检查器主入口
 * 提供完整的翻译文件结构验证功能
 */

const { loadConfig, validateConfig } = require('./config');
const { extractAllKeys } = require('./key-extractor');
const { validateAllStructures } = require('./structure-validator');
const { generateConsoleReport, generateJsonReport, generateHtmlReport, saveReportToFile } = require('./report-generator');
const { formatDuration, ensureDirectoryExists } = require('./utils');

/**
 * 主检查器类
 */
class I18nChecker {
  constructor(options = {}) {
    this.config = loadConfig(options.configPath);
    this.options = options;
    this.startTime = null;
    this.stats = {
      totalKeys: 0,
      totalFiles: 0,
      processedLanguages: 0,
      processedNamespaces: 0
    };
  }

  /**
   * 执行完整的检查流程
   * @returns {Promise<Object>} 检查结果
   */
  async run() {
    this.startTime = Date.now();
    
    try {
      // 验证配置
      const configErrors = validateConfig(this.config);
      if (configErrors.length > 0) {
        throw new Error(`配置验证失败:\n${configErrors.join('\n')}`);
      }

      console.log('🔍 开始i18next翻译键一致性检查...\n');

      // 提取所有翻译键
      console.log('📂 正在提取翻译键...');
      const allKeys = extractAllKeys(this.config);
      this.calculateStats(allKeys);

      // 验证结构一致性
      console.log('🔍 正在验证结构一致性...');
      const issues = validateAllStructures(allKeys, this.config);

      // 生成报告
      const duration = Date.now() - this.startTime;
      console.log(`⏱️  检查完成，耗时: ${formatDuration(duration)}\n`);

      const result = {
        success: issues.length === 0,
        issues,
        stats: this.stats,
        duration,
        config: this.config
      };

      // 输出报告
      await this.generateReports(result);

      return result;
    } catch (error) {
      console.error(`❌ 检查过程中发生错误: ${error.message}`);
      throw error;
    }
  }

  /**
   * 计算统计信息
   * @param {Object} allKeys - 所有语言的键数据
   */
  calculateStats(allKeys) {
    let totalKeys = 0;
    let totalFiles = 0;
    
    for (const [language, languageData] of Object.entries(allKeys)) {
      if (languageData.error) continue;
      
      this.stats.processedLanguages++;
      
      for (const [namespace, namespaceData] of Object.entries(languageData.namespaces)) {
        if (namespaceData.error) continue;
        
        totalFiles++;
        
        const keys = Array.isArray(namespaceData.keys) ? namespaceData.keys :
                     Array.isArray(namespaceData) ? namespaceData : [];
        if (Array.isArray(keys)) {
          totalKeys += keys.filter(key => key.isLeaf).length;
        }
      }
    }
    
    this.stats.totalKeys = totalKeys;
    this.stats.totalFiles = totalFiles;
    this.stats.processedNamespaces = this.config.locales.namespaces.length;
  }

  /**
   * 生成各种格式的报告
   * @param {Object} result - 检查结果
   */
  async generateReports(result) {
    const { issues, stats, config } = result;

    // 控制台报告（总是生成）
    generateConsoleReport(issues, config, stats);

    // 根据配置生成其他格式的报告
    if (this.options.format) {
      await this.generateSpecificReport(result, this.options.format, this.options.output);
    } else if (config.report.format !== 'console') {
      await this.generateSpecificReport(result, config.report.format, config.report.outputPath);
    }
  }

  /**
   * 生成特定格式的报告
   * @param {Object} result - 检查结果
   * @param {string} format - 报告格式
   * @param {string} outputPath - 输出路径
   */
  async generateSpecificReport(result, format, outputPath) {
    const { issues, stats, config } = result;

    try {
      switch (format) {
        case 'json': {
          const jsonReport = generateJsonReport(issues, config, stats);
          const filePath = outputPath.endsWith('.json') ? outputPath : `${outputPath}.json`;
          saveReportToFile(jsonReport, filePath, 'json');
          break;
        }

        case 'html': {
          const htmlReport = generateHtmlReport(issues, config, stats);
          const filePath = outputPath.endsWith('.html') ? outputPath : `${outputPath}.html`;
          saveReportToFile(htmlReport, filePath, 'html');
          break;
        }

        default:
          console.warn(`⚠️  不支持的报告格式: ${format}`);
      }
    } catch (error) {
      console.error(`❌ 生成${format}报告失败: ${error.message}`);
    }
  }

  /**
   * 检查特定语言
   * @param {string} language - 语言代码
   * @returns {Promise<Object>} 检查结果
   */
  async checkLanguage(language) {
    if (!this.config.locales.languages.includes(language)) {
      throw new Error(`不支持的语言: ${language}`);
    }

    // 临时修改配置只检查指定语言
    const originalLanguages = this.config.locales.languages;
    this.config.locales.languages = [this.config.locales.referenceLang, language];

    try {
      const result = await this.run();
      return result;
    } finally {
      // 恢复原始配置
      this.config.locales.languages = originalLanguages;
    }
  }

  /**
   * 检查特定命名空间
   * @param {string} namespace - 命名空间
   * @returns {Promise<Object>} 检查结果
   */
  async checkNamespace(namespace) {
    if (!this.config.locales.namespaces.includes(namespace)) {
      throw new Error(`不支持的命名空间: ${namespace}`);
    }

    // 临时修改配置只检查指定命名空间
    const originalNamespaces = this.config.locales.namespaces;
    this.config.locales.namespaces = [namespace];

    try {
      const result = await this.run();
      return result;
    } finally {
      // 恢复原始配置
      this.config.locales.namespaces = originalNamespaces;
    }
  }

  /**
   * 获取检查统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 获取配置信息
   * @returns {Object} 配置信息
   */
  getConfig() {
    return { ...this.config };
  }
}

/**
 * 创建检查器实例
 * @param {Object} options - 选项
 * @returns {I18nChecker} 检查器实例
 */
function createChecker(options = {}) {
  return new I18nChecker(options);
}

/**
 * 快速检查函数
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 检查结果
 */
async function quickCheck(options = {}) {
  const checker = createChecker(options);
  return await checker.run();
}

/**
 * 检查并返回是否通过
 * @param {Object} options - 选项
 * @returns {Promise<boolean>} 是否通过检查
 */
async function validate(options = {}) {
  try {
    const result = await quickCheck(options);
    return result.success;
  } catch (error) {
    console.error(`验证失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取版本信息
 * @returns {string} 版本号
 */
function getVersion() {
  try {
    const packageJson = require('../../package.json');
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

module.exports = {
  I18nChecker,
  createChecker,
  quickCheck,
  validate,
  getVersion
};
