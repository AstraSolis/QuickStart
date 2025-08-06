/**
 * 工具函数
 * 提供i18next检查器的通用工具函数
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {boolean} 文件是否存在
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath - 目录路径
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 读取JSON文件
 * @param {string} filePath - JSON文件路径
 * @returns {Object} 解析后的JSON对象
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`读取JSON文件失败 ${filePath}: ${error.message}`);
  }
}

/**
 * 写入JSON文件
 * @param {string} filePath - 文件路径
 * @param {Object} data - 要写入的数据
 * @param {boolean} pretty - 是否格式化输出
 */
function writeJsonFile(filePath, data, pretty = true) {
  try {
    ensureDirectoryExists(path.dirname(filePath));
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`写入JSON文件失败 ${filePath}: ${error.message}`);
  }
}

/**
 * 计算文件的MD5哈希值
 * @param {string} filePath - 文件路径
 * @returns {string} MD5哈希值
 */
function calculateFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    throw new Error(`计算文件哈希失败 ${filePath}: ${error.message}`);
  }
}

/**
 * 创建文件备份
 * @param {string} filePath - 原文件路径
 * @param {string} backupDir - 备份目录
 * @returns {string} 备份文件路径
 */
function createBackup(filePath, backupDir) {
  try {
    if (!fileExists(filePath)) {
      throw new Error(`原文件不存在: ${filePath}`);
    }
    
    ensureDirectoryExists(backupDir);
    
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${fileName}.backup.${timestamp}`;
    const backupPath = path.join(backupDir, backupFileName);
    
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  } catch (error) {
    throw new Error(`创建备份失败: ${error.message}`);
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 格式化时间持续
 * @param {number} milliseconds - 毫秒数
 * @returns {string} 格式化后的时间
 */
function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

/**
 * 获取文件统计信息
 * @param {string} filePath - 文件路径
 * @returns {Object} 文件统计信息
 */
function getFileStats(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      formattedSize: formatFileSize(stats.size),
      modified: stats.mtime,
      created: stats.birthtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    return null;
  }
}

/**
 * 深度克隆对象
 * @param {*} obj - 要克隆的对象
 * @returns {*} 克隆后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  
  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    }
  };
}

/**
 * 异步延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} Promise对象
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 并发限制执行异步任务
 * @param {Array} tasks - 任务数组
 * @param {number} concurrency - 并发数量
 * @returns {Promise<Array>} 执行结果数组
 */
async function limitConcurrency(tasks, concurrency) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    const promise = Promise.resolve(task()).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

/**
 * 安全的JSON解析
 * @param {string} jsonString - JSON字符串
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析结果或默认值
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 生成唯一ID
 * @param {number} length - ID长度
 * @returns {string} 唯一ID
 */
function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证语言代码格式
 * @param {string} langCode - 语言代码
 * @returns {boolean} 是否为有效的语言代码
 */
function isValidLanguageCode(langCode) {
  // 支持 ISO 639-1 (en) 和 BCP 47 (en-US, zh-CN) 格式
  const langCodeRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
  return langCodeRegex.test(langCode);
}

/**
 * 标准化语言代码
 * @param {string} langCode - 语言代码
 * @returns {string} 标准化后的语言代码
 */
function normalizeLanguageCode(langCode) {
  if (!langCode) return '';
  
  // 转换为小写，然后处理地区代码
  const parts = langCode.toLowerCase().split('-');
  if (parts.length === 2) {
    return `${parts[0]}-${parts[1].toUpperCase()}`;
  }
  return parts[0];
}

/**
 * 获取相对路径
 * @param {string} from - 起始路径
 * @param {string} to - 目标路径
 * @returns {string} 相对路径
 */
function getRelativePath(from, to) {
  return path.relative(from, to).replace(/\\/g, '/');
}

module.exports = {
  fileExists,
  ensureDirectoryExists,
  readJsonFile,
  writeJsonFile,
  calculateFileHash,
  createBackup,
  formatFileSize,
  formatDuration,
  getFileStats,
  deepClone,
  debounce,
  throttle,
  sleep,
  limitConcurrency,
  safeJsonParse,
  generateId,
  isValidLanguageCode,
  normalizeLanguageCode,
  getRelativePath
};
