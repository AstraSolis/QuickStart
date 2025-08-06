// scripts/generate-env.js
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

console.log('🔧 检查环境配置文件...');

// 如果 .env 文件不存在，从 .env.example 创建
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env 文件已从 .env.example 创建');
  } else {
    // 创建基础 .env 文件
    const defaultEnv = `# QuickStart 环境配置
NODE_ENV=development

# 渲染进程配置
RENDERER_PORT=3000
PUBLIC_URL=/

# 主进程配置
ELECTRON_START_URL=http://localhost:3000

# 开发配置
ELECTRON_IS_DEV=true
WEBPACK_DEV_SERVER_URL=http://localhost:3000

# 日志配置
LOG_LEVEL=info
ENABLE_LOGGING=true

# 应用配置
APP_DATA_PATH=%APPDATA%\\QuickStartAPP
ENABLE_AUTO_UPDATER=false
`;
    fs.writeFileSync(envPath, defaultEnv);
    console.log('✅ 默认 .env 文件已创建');
  }
} else {
  console.log('✅ .env 文件已存在');
}

// 检查 .env.example 是否存在，如果不存在则创建
if (!fs.existsSync(envExamplePath)) {
  const exampleEnv = `# QuickStart 环境配置示例
# 复制此文件为 .env 并根据需要修改配置

NODE_ENV=development

# 渲染进程配置
RENDERER_PORT=3000
PUBLIC_URL=/

# 主进程配置
ELECTRON_START_URL=http://localhost:3000

# 开发配置
ELECTRON_IS_DEV=true
WEBPACK_DEV_SERVER_URL=http://localhost:3000

# 日志配置
LOG_LEVEL=info
ENABLE_LOGGING=true

# 应用配置
APP_DATA_PATH=%APPDATA%\\QuickStartAPP
ENABLE_AUTO_UPDATER=false
`;
  fs.writeFileSync(envExamplePath, exampleEnv);
  console.log('✅ .env.example 示例文件已创建');
}

console.log('🎉 环境配置检查完成！');
