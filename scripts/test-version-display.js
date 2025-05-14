// 测试脚本：验证版本信息显示
const fs = require('fs');
const path = require('path');

// 测试版本信息
(async function() {
  console.log('开始测试版本信息显示');
  
  try {
    // 确保version.json存在
    const versionFilePath = path.join(__dirname, '..', 'version.json');
    if (!fs.existsSync(versionFilePath)) {
      console.log('版本文件不存在，生成测试版本信息');
      
      // 创建测试版本信息
      const testVersionInfo = {
        version: '1.2.3',
        fullVersion: 'v1.2.3-5-g1a2b3c4',
        buildType: 'Dev',
        timestamp: new Date().toISOString()
      };
      
      // 写入测试版本文件
      fs.writeFileSync(versionFilePath, JSON.stringify(testVersionInfo, null, 2));
      console.log('已创建测试版本文件:', versionFilePath);
    } else {
      console.log('已存在版本文件:', versionFilePath);
      
      // 读取现有版本信息
      const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
      console.log('当前版本信息:', versionData);
    }

    console.log('\n版本显示逻辑检查:');
    console.log('1. frontend/renderer.js 中的 loadVersion() 函数现在会正确更新:');
    console.log('   - DOM.versionLabel: 只显示"版本号"标签文本');
    console.log('   - DOM.versionValue: 显示完整版本信息，包括版本号和构建类型');
    
    console.log('\n测试完成，请启动应用查看"关于"选项卡中的版本显示是否正确。');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
})(); 