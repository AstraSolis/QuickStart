#!/usr/bin/env node

/**
 * QuickStart应用启动状态检查脚本
 * 用于诊断和验证应用启动过程中的各种状态
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 项目根目录
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 关键路径
const PATHS = {
  buildMain: path.join(PROJECT_ROOT, 'build', 'main', 'main.js'),
  buildRenderer: path.join(PROJECT_ROOT, 'build', 'renderer', 'index.html'),
  buildPreload: path.join(PROJECT_ROOT, 'build', 'preload', 'preload.js'),
  packageJson: path.join(PROJECT_ROOT, 'package.json'),
  nodeModules: path.join(PROJECT_ROOT, 'node_modules'),
  electron: path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'),
  crashLog: path.join(PROJECT_ROOT, 'crash.log'),
  debugLog: path.join(PROJECT_ROOT, 'debug.log')
};

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  const color = exists ? 'green' : 'red';
  log(`${status} ${description}: ${filePath}`, color);
  return exists;
}

function checkEnvironment() {
  log('\n🔍 环境检查', 'blue');
  log(`Node.js版本: ${process.version}`);
  log(`平台: ${process.platform}`);
  log(`架构: ${process.arch}`);
  
  // 检查NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'undefined';
  log(`NODE_ENV: ${nodeEnv}`, nodeEnv === 'undefined' ? 'yellow' : 'green');
}

function checkFiles() {
  log('\n📁 文件检查', 'blue');
  
  const checks = [
    [PATHS.packageJson, 'package.json'],
    [PATHS.nodeModules, 'node_modules目录'],
    [PATHS.electron, 'Electron可执行文件'],
    [PATHS.buildMain, '主进程构建文件'],
    [PATHS.buildRenderer, '渲染进程构建文件'],
    [PATHS.buildPreload, '预加载脚本构建文件']
  ];
  
  let allExists = true;
  checks.forEach(([filePath, description]) => {
    if (!checkFileExists(filePath, description)) {
      allExists = false;
    }
  });
  
  return allExists;
}

function checkLogs() {
  log('\n📋 日志检查', 'blue');
  
  // 检查崩溃日志
  if (fs.existsSync(PATHS.crashLog)) {
    log('⚠️  发现崩溃日志文件', 'yellow');
    try {
      const crashContent = fs.readFileSync(PATHS.crashLog, 'utf8');
      const lines = crashContent.trim().split('\n');
      log(`最近的崩溃记录 (最后${Math.min(3, lines.length)}行):`, 'yellow');
      lines.slice(-3).forEach(line => {
        log(`  ${line}`, 'yellow');
      });
    } catch (error) {
      log(`读取崩溃日志失败: ${error.message}`, 'red');
    }
  } else {
    log('✅ 没有发现崩溃日志', 'green');
  }
  
  // 检查调试日志
  if (fs.existsSync(PATHS.debugLog)) {
    log('📝 发现调试日志文件', 'blue');
    try {
      const debugContent = fs.readFileSync(PATHS.debugLog, 'utf8');
      const lines = debugContent.trim().split('\n');
      log(`最近的调试记录 (最后${Math.min(5, lines.length)}行):`, 'blue');
      lines.slice(-5).forEach(line => {
        log(`  ${line}`, 'blue');
      });
    } catch (error) {
      log(`读取调试日志失败: ${error.message}`, 'red');
    }
  } else {
    log('ℹ️  没有发现调试日志', 'blue');
  }
}

function checkPackageJson() {
  log('\n📦 package.json检查', 'blue');
  
  try {
    const packageContent = fs.readFileSync(PATHS.packageJson, 'utf8');
    const packageData = JSON.parse(packageContent);
    
    // 检查关键脚本
    const scripts = packageData.scripts || {};
    const requiredScripts = ['start', 'start:dev', 'dev', 'build'];
    
    requiredScripts.forEach(script => {
      if (scripts[script]) {
        log(`✅ 脚本 "${script}": ${scripts[script]}`, 'green');
      } else {
        log(`❌ 缺少脚本 "${script}"`, 'red');
      }
    });
    
    // 检查主入口
    const main = packageData.main;
    if (main) {
      const mainPath = path.resolve(PROJECT_ROOT, main);
      checkFileExists(mainPath, `主入口文件 (${main})`);
    } else {
      log('❌ package.json中缺少main字段', 'red');
    }
    
  } catch (error) {
    log(`❌ 读取package.json失败: ${error.message}`, 'red');
  }
}

function testElectronLaunch() {
  return new Promise((resolve) => {
    log('\n🚀 Electron启动测试', 'blue');
    
    // 清理旧的日志文件
    [PATHS.crashLog, PATHS.debugLog].forEach(logPath => {
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
      }
    });
    
    const electronProcess = spawn(PATHS.electron, ['.'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    let appStarted = false;

    electronProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      // 检测应用启动成功的标志
      if (text.includes('App is ready') || text.includes('ready-to-show') || text.includes('did-finish-load')) {
        appStarted = true;
        clearTimeout(timeout);
        log('✅ 应用启动成功检测到', 'green');
        resolve(true);
        // 不再强制关闭进程，让应用正常运行
      }
    });

    electronProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // 15秒后强制结束测试（给Electron足够的启动时间）
    const timeout = setTimeout(() => {
      if (!appStarted) {
        electronProcess.kill();
        log('⏰ 启动测试超时 (15秒)', 'yellow');
        resolve(false);
      }
    }, 15000);

    electronProcess.on('close', (code) => {
      clearTimeout(timeout);

      if (appStarted) {
        return; // 如果已经通过启动检测，不需要再处理
      }

      log(`进程退出码: ${code}`, code === 0 ? 'green' : 'red');

      if (output) {
        log('标准输出:', 'blue');
        log(output, 'blue');
      }

      if (errorOutput) {
        log('错误输出:', 'red');
        log(errorOutput, 'red');
      }

      // 检查是否生成了新的日志
      setTimeout(() => {
        checkLogs();
        resolve(code === 0 || appStarted);
      }, 500);
    });
    
    electronProcess.on('error', (error) => {
      clearTimeout(timeout);
      log(`❌ 启动失败: ${error.message}`, 'red');
      resolve(false);
    });
  });
}

async function main() {
  log('🔍 QuickStart应用启动状态检查', 'blue');
  log('=' .repeat(50), 'blue');
  
  // 执行各项检查
  checkEnvironment();
  const filesOk = checkFiles();
  checkPackageJson();
  checkLogs();
  
  if (!filesOk) {
    log('\n❌ 文件检查失败，请先运行 npm run build', 'red');
    process.exit(1);
  }
  
  // 测试Electron启动
  const launchOk = await testElectronLaunch();
  
  log('\n📊 检查结果汇总', 'blue');
  log('=' .repeat(50), 'blue');
  
  if (launchOk) {
    log('🎉 应用启动测试通过！', 'green');
    process.exit(0);
  } else {
    log('❌ 应用启动测试失败，请检查上述错误信息', 'red');
    process.exit(1);
  }
}

// 运行检查
main().catch(error => {
  log(`❌ 检查脚本执行失败: ${error.message}`, 'red');
  process.exit(1);
});
