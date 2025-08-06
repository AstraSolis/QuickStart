/**
 * 翻译键提取器
 * 用于从JSON语言文件中提取所有翻译键的完整路径
 */

const fs = require('fs');
const path = require('path');

/**
 * 翻译键信息
 * @typedef {Object} TranslationKey
 * @property {string} path - 键的完整路径（如: app.buttons.save）
 * @property {string} type - 值的类型（string, object, array, number, boolean）
 * @property {*} value - 键的值
 * @property {number} depth - 嵌套深度
 * @property {boolean} isLeaf - 是否为叶子节点（最终的翻译值）
 */

/**
 * 从对象中递归提取所有键路径
 * @param {Object} obj - 要提取键的对象
 * @param {string} prefix - 键路径前缀
 * @param {number} depth - 当前嵌套深度
 * @returns {TranslationKey[]} 提取的键信息数组
 */
function extractKeysFromObject(obj, prefix = '', depth = 0) {
  const keys = [];
  
  if (!obj || typeof obj !== 'object') {
    return keys;
  }
  
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const valueType = getValueType(value);
    
    // 添加当前键的信息
    const keyInfo = {
      path: fullPath,
      type: valueType,
      value: value,
      depth: depth,
      isLeaf: valueType !== 'object' || value === null
    };
    
    keys.push(keyInfo);
    
    // 如果值是对象且不为null，递归提取子键
    if (valueType === 'object' && value !== null) {
      const childKeys = extractKeysFromObject(value, fullPath, depth + 1);
      keys.push(...childKeys);
    }
  }
  
  return keys;
}

/**
 * 获取值的类型
 * @param {*} value - 要检查类型的值
 * @returns {string} 值的类型
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * 从JSON文件中提取翻译键
 * @param {string} filePath - JSON文件路径
 * @returns {TranslationKey[]} 提取的键信息数组
 */
function extractKeysFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(content);
    
    return extractKeysFromObject(jsonData);
  } catch (error) {
    throw new Error(`提取文件 ${filePath} 的键时出错: ${error.message}`);
  }
}

/**
 * 从语言目录中提取所有命名空间的翻译键
 * @param {string} languageDir - 语言目录路径
 * @param {string[]} namespaces - 命名空间列表
 * @param {string} fileExtension - 文件扩展名
 * @returns {Object} 按命名空间组织的键信息
 */
function extractKeysFromLanguage(languageDir, namespaces, fileExtension = '.json') {
  const result = {};
  
  for (const namespace of namespaces) {
    const filePath = path.join(languageDir, `${namespace}${fileExtension}`);
    
    try {
      result[namespace] = extractKeysFromFile(filePath);
    } catch (error) {
      // 如果文件不存在或解析失败，记录错误但继续处理其他文件
      result[namespace] = {
        error: error.message,
        keys: []
      };
    }
  }
  
  return result;
}

/**
 * 从所有语言中提取翻译键
 * @param {Object} config - 配置对象
 * @returns {Object} 按语言和命名空间组织的键信息
 */
function extractAllKeys(config) {
  const result = {};
  const { baseDir, languages, namespaces, fileExtension } = config.locales;
  
  for (const language of languages) {
    const languageDir = path.join(baseDir, language);
    
    if (!fs.existsSync(languageDir)) {
      result[language] = {
        error: `语言目录不存在: ${languageDir}`,
        namespaces: {}
      };
      continue;
    }
    
    try {
      result[language] = {
        namespaces: extractKeysFromLanguage(languageDir, namespaces, fileExtension)
      };
    } catch (error) {
      result[language] = {
        error: error.message,
        namespaces: {}
      };
    }
  }
  
  return result;
}

/**
 * 获取键的路径列表（仅叶子节点）
 * @param {TranslationKey[]} keys - 键信息数组
 * @returns {string[]} 叶子节点的路径列表
 */
function getLeafKeyPaths(keys) {
  return keys
    .filter(key => key.isLeaf)
    .map(key => key.path);
}

/**
 * 获取键的路径列表（所有节点）
 * @param {TranslationKey[]} keys - 键信息数组
 * @returns {string[]} 所有节点的路径列表
 */
function getAllKeyPaths(keys) {
  return keys.map(key => key.path);
}

/**
 * 按深度分组键
 * @param {TranslationKey[]} keys - 键信息数组
 * @returns {Object} 按深度分组的键
 */
function groupKeysByDepth(keys) {
  const grouped = {};
  
  for (const key of keys) {
    if (!grouped[key.depth]) {
      grouped[key.depth] = [];
    }
    grouped[key.depth].push(key);
  }
  
  return grouped;
}

/**
 * 创建键的树形结构
 * @param {TranslationKey[]} keys - 键信息数组
 * @returns {Object} 树形结构的键
 */
function createKeyTree(keys) {
  const tree = {};
  
  for (const key of keys) {
    const parts = key.path.split('.');
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (!current[part]) {
        current[part] = {
          _meta: {
            path: parts.slice(0, i + 1).join('.'),
            depth: i,
            isLeaf: i === parts.length - 1,
            type: i === parts.length - 1 ? key.type : 'object'
          }
        };
        
        if (i === parts.length - 1) {
          current[part]._meta.value = key.value;
        }
      }
      
      current = current[part];
    }
  }
  
  return tree;
}

module.exports = {
  extractKeysFromObject,
  extractKeysFromFile,
  extractKeysFromLanguage,
  extractAllKeys,
  getLeafKeyPaths,
  getAllKeyPaths,
  groupKeysByDepth,
  createKeyTree,
  getValueType
};
