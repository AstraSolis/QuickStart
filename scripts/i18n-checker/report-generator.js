/**
 * 报告生成器
 * 用于生成不同格式的i18next翻译键一致性检查报告
 */

const fs = require('fs');
const path = require('path');
const { SEVERITY_LEVELS, groupIssuesBySeverity, groupIssuesByLanguage, groupIssuesByNamespace } = require('./structure-validator');

/**
 * 生成控制台报告
 * @param {ValidationIssue[]} issues - 验证问题列表
 * @param {Object} config - 配置对象
 * @param {Object} stats - 统计信息
 */
function generateConsoleReport(issues, config, stats) {
  console.log('\n🔍 i18next翻译键一致性检查报告');
  console.log('=====================================\n');
  
  // 显示统计信息
  console.log('📊 检查统计：');
  console.log(`- 检查语言: ${config.locales.languages.join(', ')} (${config.locales.languages.length}种)`);
  console.log(`- 检查命名空间: ${config.locales.namespaces.join(', ')} (${config.locales.namespaces.length}个)`);
  console.log(`- 参考语言: ${config.locales.referenceLang}`);
  console.log(`- 总翻译键数: ${stats.totalKeys.toLocaleString()}`);
  console.log(`- 检查文件数: ${stats.totalFiles}`);
  
  if (issues.length === 0) {
    console.log('\n✅ 恭喜！所有翻译文件结构完全一致，未发现任何问题。');
    return;
  }
  
  console.log(`\n❌ 发现问题: ${issues.length} 个\n`);
  
  // 按严重级别分组显示
  const groupedBySeverity = groupIssuesBySeverity(issues);
  
  for (const severity of [SEVERITY_LEVELS.CRITICAL, SEVERITY_LEVELS.HIGH, SEVERITY_LEVELS.MEDIUM, SEVERITY_LEVELS.LOW]) {
    const severityIssues = groupedBySeverity[severity];
    if (severityIssues.length === 0) continue;
    
    const icon = getSeverityIcon(severity);
    const color = getSeverityColor(severity);
    
    console.log(`${icon} ${severity} 级别问题 (${severityIssues.length}个):`);
    
    for (const issue of severityIssues) {
      const location = issue.namespace ? `${issue.language}/${issue.namespace}.json` : issue.language;
      const keyInfo = issue.keyPath ? ` '${issue.keyPath}'` : '';
      console.log(`  ${location}:${keyInfo} ${issue.message}`);
      
      if (config.report.verbose && issue.details) {
        console.log(`    详细信息: ${JSON.stringify(issue.details, null, 2)}`);
      }
    }
    console.log('');
  }
  
  // 显示修复建议
  if (issues.length > 0) {
    console.log('💡 修复建议:');
    console.log('- 运行 `npm run i18n:fix` 尝试自动修复部分问题');
    console.log('- 查看详细的HTML报告: `npm run i18n:check:report`');
    console.log('- 手动检查并修复类型不匹配和结构问题\n');
  }
}

/**
 * 生成JSON报告
 * @param {ValidationIssue[]} issues - 验证问题列表
 * @param {Object} config - 配置对象
 * @param {Object} stats - 统计信息
 * @returns {Object} JSON报告对象
 */
function generateJsonReport(issues, config, stats) {
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      config: {
        languages: config.locales.languages,
        namespaces: config.locales.namespaces,
        referenceLang: config.locales.referenceLang
      }
    },
    statistics: stats,
    summary: {
      totalIssues: issues.length,
      issuesBySeverity: Object.fromEntries(
        Object.values(SEVERITY_LEVELS).map(severity => [
          severity,
          issues.filter(issue => issue.severity === severity).length
        ])
      ),
      issuesByType: {},
      issuesByLanguage: {},
      issuesByNamespace: {}
    },
    issues: issues,
    groupedIssues: {
      bySeverity: groupIssuesBySeverity(issues),
      byLanguage: groupIssuesByLanguage(issues),
      byNamespace: groupIssuesByNamespace(issues)
    }
  };
  
  // 计算按类型分组的统计
  for (const issue of issues) {
    report.summary.issuesByType[issue.type] = (report.summary.issuesByType[issue.type] || 0) + 1;
    report.summary.issuesByLanguage[issue.language] = (report.summary.issuesByLanguage[issue.language] || 0) + 1;
    report.summary.issuesByNamespace[issue.namespace] = (report.summary.issuesByNamespace[issue.namespace] || 0) + 1;
  }
  
  return report;
}

/**
 * 生成HTML报告
 * @param {ValidationIssue[]} issues - 验证问题列表
 * @param {Object} config - 配置对象
 * @param {Object} stats - 统计信息
 * @returns {string} HTML报告内容
 */
function generateHtmlReport(issues, config, stats) {
  const jsonReport = generateJsonReport(issues, config, stats);
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>i18next翻译键一致性检查报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .header .subtitle { opacity: 0.9; margin-top: 8px; }
        .content { padding: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 32px; font-weight: bold; color: #495057; }
        .stat-label { color: #6c757d; margin-top: 5px; }
        .severity-critical { color: #dc3545; }
        .severity-high { color: #fd7e14; }
        .severity-medium { color: #ffc107; }
        .severity-low { color: #28a745; }
        .issue-group { margin-bottom: 30px; }
        .issue-group h3 { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; }
        .issue-item { background: #f8f9fa; margin-bottom: 10px; padding: 15px; border-radius: 6px; border-left: 4px solid #dee2e6; }
        .issue-item.critical { border-left-color: #dc3545; }
        .issue-item.high { border-left-color: #fd7e14; }
        .issue-item.medium { border-left-color: #ffc107; }
        .issue-item.low { border-left-color: #28a745; }
        .issue-header { display: flex; justify-content: between; align-items: center; margin-bottom: 8px; }
        .issue-title { font-weight: 600; }
        .issue-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        .issue-location { color: #6c757d; font-size: 14px; }
        .issue-details { margin-top: 10px; padding: 10px; background: white; border-radius: 4px; font-family: monospace; font-size: 12px; }
        .no-issues { text-align: center; padding: 60px; color: #28a745; }
        .no-issues .icon { font-size: 64px; margin-bottom: 20px; }
        .filter-tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #e9ecef; }
        .filter-tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; }
        .filter-tab.active { border-bottom-color: #667eea; color: #667eea; }
        .search-box { width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid #ced4da; border-radius: 4px; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 i18next翻译键一致性检查报告</h1>
            <div class="subtitle">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
        </div>
        
        <div class="content">
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${config.locales.languages.length}</div>
                    <div class="stat-label">检查语言</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${config.locales.namespaces.length}</div>
                    <div class="stat-label">命名空间</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalKeys.toLocaleString()}</div>
                    <div class="stat-label">总翻译键</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number ${issues.length === 0 ? 'severity-low' : 'severity-critical'}">${issues.length}</div>
                    <div class="stat-label">发现问题</div>
                </div>
            </div>
            
            ${issues.length === 0 ? generateNoIssuesHtml() : generateIssuesHtml(jsonReport)}
        </div>
    </div>
    
    <script>
        const reportData = ${JSON.stringify(jsonReport, null, 2)};
        
        function filterIssues(filterType, filterValue) {
            // 实现过滤功能
        }
        
        function searchIssues(searchTerm) {
            // 实现搜索功能
        }
    </script>
</body>
</html>`;
}

/**
 * 生成无问题时的HTML内容
 * @returns {string} HTML内容
 */
function generateNoIssuesHtml() {
  return `
    <div class="no-issues">
        <div class="icon">✅</div>
        <h2>恭喜！所有翻译文件结构完全一致</h2>
        <p>未发现任何翻译键不一致问题，您的国际化配置非常完善。</p>
    </div>
  `;
}

/**
 * 生成问题列表的HTML内容
 * @param {Object} jsonReport - JSON报告对象
 * @returns {string} HTML内容
 */
function generateIssuesHtml(jsonReport) {
  const { groupedIssues } = jsonReport;
  let html = '<div class="filter-tabs">';
  html += '<div class="filter-tab active" onclick="showAllIssues()">全部问题</div>';
  html += '<div class="filter-tab" onclick="showBySeverity()">按严重级别</div>';
  html += '<div class="filter-tab" onclick="showByLanguage()">按语言</div>';
  html += '<div class="filter-tab" onclick="showByNamespace()">按命名空间</div>';
  html += '</div>';
  
  html += '<input type="text" class="search-box" placeholder="搜索问题..." onkeyup="searchIssues(this.value)">';
  
  html += '<div id="issues-container">';
  
  // 按严重级别显示问题
  for (const severity of [SEVERITY_LEVELS.CRITICAL, SEVERITY_LEVELS.HIGH, SEVERITY_LEVELS.MEDIUM, SEVERITY_LEVELS.LOW]) {
    const severityIssues = groupedIssues.bySeverity[severity];
    if (severityIssues.length === 0) continue;
    
    html += `<div class="issue-group">`;
    html += `<h3>${getSeverityIcon(severity)} ${severity} 级别问题 (${severityIssues.length}个)</h3>`;
    
    for (const issue of severityIssues) {
      html += generateIssueItemHtml(issue);
    }
    
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

/**
 * 生成单个问题项的HTML
 * @param {ValidationIssue} issue - 问题对象
 * @returns {string} HTML内容
 */
function generateIssueItemHtml(issue) {
  const location = issue.namespace ? `${issue.language}/${issue.namespace}.json` : issue.language;
  const keyInfo = issue.keyPath ? ` '${issue.keyPath}'` : '';
  
  return `
    <div class="issue-item ${issue.severity.toLowerCase()}">
        <div class="issue-header">
            <div class="issue-title">${issue.message}</div>
            <span class="issue-badge severity-${issue.severity.toLowerCase()}">${issue.type}</span>
        </div>
        <div class="issue-location">${location}${keyInfo}</div>
        ${issue.details ? `<div class="issue-details">${JSON.stringify(issue.details, null, 2)}</div>` : ''}
    </div>
  `;
}

/**
 * 获取严重级别图标
 * @param {string} severity - 严重级别
 * @returns {string} 图标
 */
function getSeverityIcon(severity) {
  const icons = {
    [SEVERITY_LEVELS.CRITICAL]: '🚨',
    [SEVERITY_LEVELS.HIGH]: '⚠️',
    [SEVERITY_LEVELS.MEDIUM]: '⚡',
    [SEVERITY_LEVELS.LOW]: 'ℹ️'
  };
  return icons[severity] || '❓';
}

/**
 * 获取严重级别颜色
 * @param {string} severity - 严重级别
 * @returns {string} 颜色代码
 */
function getSeverityColor(severity) {
  const colors = {
    [SEVERITY_LEVELS.CRITICAL]: '\x1b[31m', // 红色
    [SEVERITY_LEVELS.HIGH]: '\x1b[33m',     // 黄色
    [SEVERITY_LEVELS.MEDIUM]: '\x1b[36m',   // 青色
    [SEVERITY_LEVELS.LOW]: '\x1b[32m'       // 绿色
  };
  return colors[severity] || '\x1b[0m';
}

/**
 * 保存报告到文件
 * @param {string} content - 报告内容
 * @param {string} filePath - 文件路径
 * @param {string} format - 报告格式
 */
function saveReportToFile(content, filePath, format) {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 写入文件
    if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    } else {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    
    console.log(`📄 报告已保存到: ${filePath}`);
  } catch (error) {
    console.error(`❌ 保存报告失败: ${error.message}`);
  }
}

module.exports = {
  generateConsoleReport,
  generateJsonReport,
  generateHtmlReport,
  saveReportToFile
};
