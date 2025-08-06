/**
 * 结构验证器
 * 用于比较不同语言文件的翻译键结构，识别不一致问题
 */

const { getLeafKeyPaths, getAllKeyPaths, getValueType } = require('./key-extractor');

/**
 * 验证问题类型
 */
const ISSUE_TYPES = {
  MISSING_KEY: 'MISSING_KEY',           // 缺失翻译键
  EXTRA_KEY: 'EXTRA_KEY',               // 多余翻译键
  TYPE_MISMATCH: 'TYPE_MISMATCH',       // 类型不匹配
  STRUCTURE_MISMATCH: 'STRUCTURE_MISMATCH' // 结构不匹配
};

/**
 * 严重级别
 */
const SEVERITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

/**
 * 验证问题
 * @typedef {Object} ValidationIssue
 * @property {string} type - 问题类型
 * @property {string} severity - 严重级别
 * @property {string} language - 语言代码
 * @property {string} namespace - 命名空间
 * @property {string} keyPath - 键路径
 * @property {string} message - 问题描述
 * @property {Object} details - 详细信息
 */

/**
 * 比较两个键列表，找出差异
 * @param {string[]} referenceKeys - 参考键列表
 * @param {string[]} targetKeys - 目标键列表
 * @returns {Object} 差异信息
 */
function compareKeyLists(referenceKeys, targetKeys) {
  const referenceSet = new Set(referenceKeys);
  const targetSet = new Set(targetKeys);
  
  const missingKeys = referenceKeys.filter(key => !targetSet.has(key));
  const extraKeys = targetKeys.filter(key => !referenceSet.has(key));
  
  return {
    missing: missingKeys,
    extra: extraKeys,
    common: referenceKeys.filter(key => targetSet.has(key))
  };
}

/**
 * 验证键的类型一致性
 * @param {TranslationKey[]} referenceKeys - 参考键信息
 * @param {TranslationKey[]} targetKeys - 目标键信息
 * @returns {Object[]} 类型不匹配的键
 */
function validateKeyTypes(referenceKeys, targetKeys) {
  const mismatches = [];
  const targetKeyMap = new Map(targetKeys.map(key => [key.path, key]));
  
  for (const refKey of referenceKeys) {
    const targetKey = targetKeyMap.get(refKey.path);
    
    if (targetKey && refKey.type !== targetKey.type) {
      mismatches.push({
        keyPath: refKey.path,
        expectedType: refKey.type,
        actualType: targetKey.type,
        expectedValue: refKey.value,
        actualValue: targetKey.value
      });
    }
  }
  
  return mismatches;
}

/**
 * 验证单个命名空间的结构
 * @param {Object} referenceNamespace - 参考命名空间数据
 * @param {Object} targetNamespace - 目标命名空间数据
 * @param {string} language - 语言代码
 * @param {string} namespace - 命名空间名称
 * @param {Object} config - 配置对象
 * @returns {ValidationIssue[]} 验证问题列表
 */
function validateNamespaceStructure(referenceNamespace, targetNamespace, language, namespace, config) {
  const issues = [];
  
  // 检查是否有错误
  if (referenceNamespace.error) {
    issues.push({
      type: ISSUE_TYPES.STRUCTURE_MISMATCH,
      severity: SEVERITY_LEVELS.CRITICAL,
      language: config.locales.referenceLang,
      namespace,
      keyPath: '',
      message: `参考语言文件错误: ${referenceNamespace.error}`,
      details: { error: referenceNamespace.error }
    });
    return issues;
  }
  
  if (targetNamespace.error) {
    issues.push({
      type: ISSUE_TYPES.STRUCTURE_MISMATCH,
      severity: SEVERITY_LEVELS.CRITICAL,
      language,
      namespace,
      keyPath: '',
      message: `目标语言文件错误: ${targetNamespace.error}`,
      details: { error: targetNamespace.error }
    });
    return issues;
  }
  
  const referenceKeys = Array.isArray(referenceNamespace.keys) ? referenceNamespace.keys :
                        Array.isArray(referenceNamespace) ? referenceNamespace : [];
  const targetKeys = Array.isArray(targetNamespace.keys) ? targetNamespace.keys :
                     Array.isArray(targetNamespace) ? targetNamespace : [];
  
  // 比较键列表
  const leafComparison = compareKeyLists(
    getLeafKeyPaths(referenceKeys),
    getLeafKeyPaths(targetKeys)
  );
  
  // 添加缺失键问题
  for (const missingKey of leafComparison.missing) {
    if (!shouldIgnoreKey(missingKey, config)) {
      issues.push({
        type: ISSUE_TYPES.MISSING_KEY,
        severity: config.rules.severity.missingKey,
        language,
        namespace,
        keyPath: missingKey,
        message: `缺失翻译键: ${missingKey}`,
        details: {
          referenceLang: config.locales.referenceLang,
          expectedType: getReferenceKeyType(missingKey, referenceKeys)
        }
      });
    }
  }
  
  // 添加多余键问题
  for (const extraKey of leafComparison.extra) {
    if (!shouldIgnoreKey(extraKey, config)) {
      issues.push({
        type: ISSUE_TYPES.EXTRA_KEY,
        severity: config.rules.severity.extraKey,
        language,
        namespace,
        keyPath: extraKey,
        message: `多余翻译键: ${extraKey}`,
        details: {
          actualType: getTargetKeyType(extraKey, targetKeys)
        }
      });
    }
  }
  
  // 验证类型一致性
  const typeMismatches = validateKeyTypes(referenceKeys, targetKeys);
  for (const mismatch of typeMismatches) {
    if (!shouldIgnoreKey(mismatch.keyPath, config)) {
      issues.push({
        type: ISSUE_TYPES.TYPE_MISMATCH,
        severity: config.rules.severity.typeMismatch,
        language,
        namespace,
        keyPath: mismatch.keyPath,
        message: `类型不匹配: 期望 ${mismatch.expectedType}, 实际 ${mismatch.actualType}`,
        details: mismatch
      });
    }
  }
  
  return issues;
}

/**
 * 验证所有语言的结构
 * @param {Object} allKeys - 所有语言的键数据
 * @param {Object} config - 配置对象
 * @returns {ValidationIssue[]} 所有验证问题
 */
function validateAllStructures(allKeys, config) {
  const issues = [];
  const referenceLang = config.locales.referenceLang;
  const referenceData = allKeys[referenceLang];
  
  if (!referenceData) {
    issues.push({
      type: ISSUE_TYPES.STRUCTURE_MISMATCH,
      severity: SEVERITY_LEVELS.CRITICAL,
      language: referenceLang,
      namespace: '',
      keyPath: '',
      message: `参考语言 ${referenceLang} 的数据不存在`,
      details: { availableLanguages: Object.keys(allKeys) }
    });
    return issues;
  }
  
  // 验证每种语言
  for (const [language, languageData] of Object.entries(allKeys)) {
    if (language === referenceLang) continue;
    if (config.rules.ignoreLanguages.includes(language)) continue;
    
    if (languageData.error) {
      issues.push({
        type: ISSUE_TYPES.STRUCTURE_MISMATCH,
        severity: SEVERITY_LEVELS.CRITICAL,
        language,
        namespace: '',
        keyPath: '',
        message: `语言数据错误: ${languageData.error}`,
        details: { error: languageData.error }
      });
      continue;
    }
    
    // 验证每个命名空间
    for (const namespace of config.locales.namespaces) {
      if (config.rules.ignoreNamespaces.includes(namespace)) continue;
      
      const referenceNamespace = referenceData.namespaces[namespace];
      const targetNamespace = languageData.namespaces[namespace];
      
      const namespaceIssues = validateNamespaceStructure(
        referenceNamespace,
        targetNamespace,
        language,
        namespace,
        config
      );
      
      issues.push(...namespaceIssues);
    }
  }
  
  return issues;
}

/**
 * 检查是否应该忽略某个键
 * @param {string} keyPath - 键路径
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否应该忽略
 */
function shouldIgnoreKey(keyPath, config) {
  return config.rules.ignorePatterns.some(pattern => pattern.test(keyPath));
}

/**
 * 获取参考键的类型
 * @param {string} keyPath - 键路径
 * @param {TranslationKey[]} keys - 键列表
 * @returns {string} 键类型
 */
function getReferenceKeyType(keyPath, keys) {
  const key = keys.find(k => k.path === keyPath);
  return key ? key.type : 'unknown';
}

/**
 * 获取目标键的类型
 * @param {string} keyPath - 键路径
 * @param {TranslationKey[]} keys - 键列表
 * @returns {string} 键类型
 */
function getTargetKeyType(keyPath, keys) {
  const key = keys.find(k => k.path === keyPath);
  return key ? key.type : 'unknown';
}

/**
 * 按严重级别分组问题
 * @param {ValidationIssue[]} issues - 问题列表
 * @returns {Object} 按严重级别分组的问题
 */
function groupIssuesBySeverity(issues) {
  const grouped = {
    [SEVERITY_LEVELS.CRITICAL]: [],
    [SEVERITY_LEVELS.HIGH]: [],
    [SEVERITY_LEVELS.MEDIUM]: [],
    [SEVERITY_LEVELS.LOW]: []
  };
  
  for (const issue of issues) {
    grouped[issue.severity].push(issue);
  }
  
  return grouped;
}

/**
 * 按语言分组问题
 * @param {ValidationIssue[]} issues - 问题列表
 * @returns {Object} 按语言分组的问题
 */
function groupIssuesByLanguage(issues) {
  const grouped = {};
  
  for (const issue of issues) {
    if (!grouped[issue.language]) {
      grouped[issue.language] = [];
    }
    grouped[issue.language].push(issue);
  }
  
  return grouped;
}

/**
 * 按命名空间分组问题
 * @param {ValidationIssue[]} issues - 问题列表
 * @returns {Object} 按命名空间分组的问题
 */
function groupIssuesByNamespace(issues) {
  const grouped = {};
  
  for (const issue of issues) {
    if (!grouped[issue.namespace]) {
      grouped[issue.namespace] = [];
    }
    grouped[issue.namespace].push(issue);
  }
  
  return grouped;
}

module.exports = {
  ISSUE_TYPES,
  SEVERITY_LEVELS,
  compareKeyLists,
  validateKeyTypes,
  validateNamespaceStructure,
  validateAllStructures,
  groupIssuesBySeverity,
  groupIssuesByLanguage,
  groupIssuesByNamespace
};
