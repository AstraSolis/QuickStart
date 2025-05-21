# 打包说明文档

本文档说明如何使用打包脚本将项目打包为可分发的应用程序。

## 环境要求

- Python 3.8+
- Node.js 16+
- npm 8+
- UPX (可选，用于压缩可执行文件)

## 打包步骤

### 方法一：使用 Python 脚本（推荐）

1. 确保已安装所有必要的工具：
   ```powershell
   # 检查 Python 版本
   python --version
   
   # 检查 Node.js 版本
   node --version
   
   # 检查 npm 版本
   npm --version
   ```

2. 运行 Python 打包脚本：
   ```powershell
   # 在项目根目录下执行
   python build/build.py
   ```

   脚本会自动执行以下步骤：
   - 检查环境要求
   - 安装项目依赖
   - 构建前端（使用 electron-builder）
   - 构建后端（使用 PyInstaller）
   - 复制必要的配置文件
   - 生成最终的可执行文件

### 方法二：使用 PowerShell 脚本

1. 运行 PowerShell 打包脚本：
   ```powershell
   # 在项目根目录下执行
   .\build\build.ps1
   ```

### 方法三：手动打包

如果需要手动控制打包过程，可以使用以下 npm 脚本：

```bash
# 构建 Windows 版本
npm run build:win

# 构建 macOS 版本
npm run build:mac

# 构建 Linux 版本
npm run build:linux
```

## 打包输出

打包完成后，可以在 `dist` 目录下找到以下内容：
- `win-unpacked/`: 未打包的应用程序目录
- `QuickStart Setup.exe`: Windows 安装程序

## 配置文件说明

### electron-builder.json

前端打包配置文件，主要设置：
- 应用程序 ID 和名称
- 输出目录
- 需要包含的文件
- Windows 特定配置
- NSIS 安装程序配置

### pyinstaller.spec

后端打包配置文件，主要设置：
- Python 入口文件
- 需要包含的数据文件
- 依赖项
- 输出选项
- UPX 压缩选项

## 注意事项

1. 确保所有依赖都已正确安装
2. 确保 `version.json` 和 `languages.json` 文件存在且内容正确
3. 如果使用 UPX 压缩，确保已正确安装并添加到 PATH
4. 打包过程中如果遇到问题，请查看控制台输出的错误信息

## 常见问题

1. **问题**: 打包后的应用无法启动
   **解决方案**: 检查 `dist/win-unpacked` 目录下是否包含所有必要的文件

2. **问题**: 缺少某些依赖
   **解决方案**: 在 `pyinstaller.spec` 的 `hiddenimports` 列表中添加缺失的依赖

3. **问题**: 资源文件未正确打包
   **解决方案**: 检查 `electron-builder.json` 和 `pyinstaller.spec` 中的 `files` 和 `datas` 配置

4. **问题**: Python 脚本执行失败
   **解决方案**: 
   - 确保 Python 环境变量正确设置
   - 检查是否有足够的权限执行脚本
   - 查看详细的错误输出信息 