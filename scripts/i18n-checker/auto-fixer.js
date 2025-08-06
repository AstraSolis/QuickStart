/**
 * 自动修复器
 * 用于自动修复i18next翻译键不一致问题
 */

const fs = require('fs');
const path = require('path');
const { ISSUE_TYPES } = require('./structure-validator');
const { readJsonFile, writeJsonFile, createBackup, ensureDirectoryExists } = require('./utils');

/**
 * 自动修复器类
 */
class AutoFixer {
  constructor(config) {
    this.config = config;
    this.fixLog = [];
    this.backupPaths = [];
  }

  /**
   * 修复所有可自动修复的问题
   * @param {ValidationIssue[]} issues - 问题列表
   * @returns {Promise<Object>} 修复结果
   */
  async fixIssues(issues) {
    const result = {
      fixed: [],
      skipped: [],
      failed: [],
      backups: []
    };

    if (!this.config.fix.enabled) {
      console.log('⚠️  自动修复功能已禁用');
      return result;
    }

    console.log('🔧 开始自动修复翻译键问题...\n');

    // 按语言和命名空间分组问题
    const groupedIssues = this.groupIssuesByFile(issues);

    for (const [fileKey, fileIssues] of Object.entries(groupedIssues)) {
      try {
        const fixResult = await this.fixFileIssues(fileKey, fileIssues);
        result.fixed.push(...fixResult.fixed);
        result.skipped.push(...fixResult.skipped);
        result.failed.push(...fixResult.failed);
        if (fixResult.backup) {
          result.backups.push(fixResult.backup);
        }
      } catch (error) {
        console.error(`❌ 修复文件 ${fileKey} 时出错: ${error.message}`);
        result.failed.push({
          file: fileKey,
          error: error.message
        });
      }
    }

    this.printFixSummary(result);
    return result;
  }

  /**
   * 修复单个文件的问题
   * @param {string} fileKey - 文件标识 (language/namespace)
   * @param {ValidationIssue[]} issues - 文件相关的问题列表
   * @returns {Promise<Object>} 修复结果
   */
  async fixFileIssues(fileKey, issues) {
    const [language, namespace] = fileKey.split('/');
    const filePath = this.getFilePath(language, namespace);
    
    const result = {
      fixed: [],
      skipped: [],
      failed: [],
      backup: null
    };

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在，跳过: ${filePath}`);
      return result;
    }

    // 创建备份
    if (this.config.fix.createBackup) {
      try {
        const backupPath = createBackup(filePath, this.config.fix.backupDir);
        result.backup = backupPath;
        console.log(`📋 已创建备份: ${backupPath}`);
      } catch (error) {
        console.warn(`⚠️  创建备份失败: ${error.message}`);
      }
    }

    // 读取原始文件
    let fileData;
    try {
      fileData = readJsonFile(filePath);
    } catch (error) {
      throw new Error(`读取文件失败: ${error.message}`);
    }

    let modified = false;

    // 处理每个问题
    for (const issue of issues) {
      try {
        const fixResult = await this.fixSingleIssue(fileData, issue);
        
        if (fixResult.fixed) {
          result.fixed.push(issue);
          modified = true;
          console.log(`✅ 已修复: ${issue.keyPath} (${issue.type})`);
        } else if (fixResult.skipped) {
          result.skipped.push(issue);
          console.log(`⏭️  已跳过: ${issue.keyPath} (${fixResult.reason})`);
        }
      } catch (error) {
        result.failed.push({
          issue,
          error: error.message
        });
        console.error(`❌ 修复失败: ${issue.keyPath} - ${error.message}`);
      }
    }

    // 保存修改后的文件
    if (modified) {
      try {
        writeJsonFile(filePath, fileData, true);
        console.log(`💾 已保存文件: ${filePath}\n`);
      } catch (error) {
        throw new Error(`保存文件失败: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * 修复单个问题
   * @param {Object} fileData - 文件数据
   * @param {ValidationIssue} issue - 问题
   * @returns {Promise<Object>} 修复结果
   */
  async fixSingleIssue(fileData, issue) {
    // 检查是否为可自动修复的问题类型
    if (!this.config.fix.autoFixTypes.includes(issue.type)) {
      return {
        fixed: false,
        skipped: true,
        reason: '不在自动修复类型列表中'
      };
    }

    switch (issue.type) {
      case ISSUE_TYPES.MISSING_KEY:
        return this.fixMissingKey(fileData, issue);
      
      case ISSUE_TYPES.EXTRA_KEY:
        return this.fixExtraKey(fileData, issue);
      
      default:
        return {
          fixed: false,
          skipped: true,
          reason: '不支持的修复类型'
        };
    }
  }

  /**
   * 修复缺失的翻译键
   * @param {Object} fileData - 文件数据
   * @param {ValidationIssue} issue - 问题
   * @returns {Object} 修复结果
   */
  fixMissingKey(fileData, issue) {
    const keyPath = issue.keyPath;
    const keys = keyPath.split('.');
    
    let current = fileData;
    
    // 创建嵌套结构
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    // 添加缺失的键
    const lastKey = keys[keys.length - 1];
    if (!current.hasOwnProperty(lastKey)) {
      // 根据期望类型设置默认值
      const expectedType = issue.details?.expectedType || 'string';
      
      switch (expectedType) {
        case 'object':
          current[lastKey] = {};
          break;
        case 'array':
          current[lastKey] = [];
          break;
        case 'number':
          current[lastKey] = 0;
          break;
        case 'boolean':
          current[lastKey] = false;
          break;
        default:
          current[lastKey] = this.config.fix.missingKeyPlaceholder;
      }
      
      return { fixed: true };
    }
    
    return {
      fixed: false,
      skipped: true,
      reason: '键已存在'
    };
  }

  /**
   * 修复多余的翻译键
   * @param {Object} fileData - 文件数据
   * @param {ValidationIssue} issue - 问题
   * @returns {Object} 修复结果
   */
  fixExtraKey(fileData, issue) {
    // 多余键的删除需要用户确认，这里只是标记
    if (this.config.fix.interactive) {
      return {
        fixed: false,
        skipped: true,
        reason: '需要用户确认删除'
      };
    }
    
    const keyPath = issue.keyPath;
    const keys = keyPath.split('.');
    
    let current = fileData;
    const parents = [];
    
    // 找到父级对象
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        return {
          fixed: false,
          skipped: true,
          reason: '键路径不存在'
        };
      }
      parents.push({ obj: current, key });
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (current.hasOwnProperty(lastKey)) {
      delete current[lastKey];
      return { fixed: true };
    }
    
    return {
      fixed: false,
      skipped: true,
      reason: '键不存在'
    };
  }

  /**
   * 按文件分组问题
   * @param {ValidationIssue[]} issues - 问题列表
   * @returns {Object} 按文件分组的问题
   */
  groupIssuesByFile(issues) {
    const grouped = {};
    
    for (const issue of issues) {
      const fileKey = `${issue.language}/${issue.namespace}`;
      if (!grouped[fileKey]) {
        grouped[fileKey] = [];
      }
      grouped[fileKey].push(issue);
    }
    
    return grouped;
  }

  /**
   * 获取文件路径
   * @param {string} language - 语言代码
   * @param {string} namespace - 命名空间
   * @returns {string} 文件路径
   */
  getFilePath(language, namespace) {
    return path.join(
      this.config.locales.baseDir,
      language,
      `${namespace}${this.config.locales.fileExtension}`
    );
  }

  /**
   * 打印修复摘要
   * @param {Object} result - 修复结果
   */
  printFixSummary(result) {
    console.log('\n📊 修复摘要');
    console.log('='.repeat(30));
    console.log(`✅ 已修复: ${result.fixed.length} 个问题`);
    console.log(`⏭️  已跳过: ${result.skipped.length} 个问题`);
    console.log(`❌ 修复失败: ${result.failed.length} 个问题`);
    console.log(`📋 创建备份: ${result.backups.length} 个文件`);
    
    if (result.failed.length > 0) {
      console.log('\n❌ 修复失败的问题:');
      for (const failure of result.failed) {
        if (failure.issue) {
          console.log(`   - ${failure.issue.keyPath}: ${failure.error}`);
        } else {
          console.log(`   - ${failure.file}: ${failure.error}`);
        }
      }
    }
    
    if (result.backups.length > 0) {
      console.log('\n📋 备份文件:');
      for (const backup of result.backups) {
        console.log(`   - ${backup}`);
      }
    }
  }
}

/**
 * 创建自动修复器实例
 * @param {Object} config - 配置对象
 * @returns {AutoFixer} 修复器实例
 */
function createAutoFixer(config) {
  return new AutoFixer(config);
}

module.exports = {
  AutoFixer,
  createAutoFixer
};
