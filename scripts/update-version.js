const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

/**
 * 从Git获取版本信息并更新version.txt
 * 支持以下格式:
 * - 如果在发布标签上: v1.2.3
 * - 如果在开发中: v1.2.3-n-gxxxxx (n是自上次标签以来的提交数，xxxxx是当前commit的哈希前缀)
 */
function updateVersion() {
  try {
    console.log('正在获取Git版本信息...');
    
    // 检查是否在Git仓库中
    try {
      execSync('git rev-parse --is-inside-work-tree');
    } catch (error) {
      console.warn('警告: 不是Git仓库，使用package.json中的版本');
      const packageJson = require('../package.json');
      fs.writeFileSync('version.txt', packageJson.version);
      return packageJson.version;
    }

    // 尝试获取最近的标签
    let version;
    try {
      // 获取最近的标签
      version = execSync('git describe --tags --abbrev=0').toString().trim();
    } catch (error) {
      console.warn('警告: 找不到Git标签，使用package.json中的版本');
      const packageJson = require('../package.json');
      version = packageJson.version;
    }

    // 获取当前提交的完整描述（包括距离标签的提交数和哈希）
    let fullVersionInfo;
    try {
      fullVersionInfo = execSync('git describe --tags').toString().trim();
    } catch (error) {
      fullVersionInfo = version;
    }

    // 检查是否在开发中（有未发布的更改）
    const isDevelopment = fullVersionInfo !== version;
    const buildType = isDevelopment ? 'Dev' : 'Release';

    // 创建完整版本信息
    const versionInfo = {
      version: version.startsWith('v') ? version.substring(1) : version,
      fullVersion: fullVersionInfo,
      buildType: buildType,
      timestamp: new Date().toISOString()
    };

    // 将版本信息写入文件
    const versionJson = JSON.stringify(versionInfo, null, 2);
    fs.writeFileSync('version.json', versionJson);
    
    // 兼容旧版本，仍然创建version.txt
    fs.writeFileSync('version.txt', versionInfo.version);

    console.log(`已更新版本信息: ${versionInfo.version} (${buildType})`);
    return versionInfo;
  } catch (error) {
    console.error('更新版本信息失败:', error);
    const fallbackVersion = '1.0.0';
    fs.writeFileSync('version.txt', fallbackVersion);
    return { version: fallbackVersion, buildType: 'Unknown' };
  }
}

// 如果直接运行脚本则执行更新
if (require.main === module) {
  updateVersion();
}

module.exports = { updateVersion }; 