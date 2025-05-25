# 设置错误时停止执行
$ErrorActionPreference = "Stop"

# 定义颜色函数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# 检查必要的工具是否安装
function Check-Requirements {
    Write-ColorOutput Green "检查必要的工具..."
    
    # 检查 Python
    try {
        $pythonVersion = python --version
        Write-ColorOutput Green "Python 已安装: $pythonVersion"
    }
    catch {
        Write-ColorOutput Red "错误: Python 未安装或未添加到 PATH"
        exit 1
    }
    
    # 检查 Node.js
    try {
        $nodeVersion = node --version
        Write-ColorOutput Green "Node.js 已安装: $nodeVersion"
    }
    catch {
        Write-ColorOutput Red "错误: Node.js 未安装或未添加到 PATH"
        exit 1
    }
    
    # 检查 npm
    try {
        $npmVersion = npm --version
        Write-ColorOutput Green "npm 已安装: $npmVersion"
    }
    catch {
        Write-ColorOutput Red "错误: npm 未安装或未添加到 PATH"
        exit 1
    }
    
    # 检查 UPX
    try {
        $upxVersion = upx --version
        Write-ColorOutput Green "UPX 已安装: $upxVersion"
    }
    catch {
        Write-ColorOutput Yellow "警告: UPX 未安装，将使用默认压缩"
    }
}

# 安装依赖
function Install-Dependencies {
    Write-ColorOutput Green "安装项目依赖..."
    
    # 安装 Python 依赖
    Write-ColorOutput Green "安装 Python 依赖..."
    python -m pip install -r requirements.txt
    
    # 安装 Node.js 依赖
    Write-ColorOutput Green "安装 Node.js 依赖..."
    npm install
    
    # 安装打包工具
    Write-ColorOutput Green "安装打包工具..."
    npm install --save-dev electron-builder
    python -m pip install pyinstaller
}

# 构建前端
function Build-Frontend {
    Write-ColorOutput Green "构建前端..."
    
    # 清理旧的构建文件
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
    }
    
    # 使用 electron-builder 构建
    npm run build
}

# 构建后端
function Build-Backend {
    Write-ColorOutput Green "构建后端..."
    
    # 检查UPX是否可用
    $upxAvailable = $false
    $upxPath = $null
    
    try {
        $upxVersion = upx --version
        $upxAvailable = $true
        $upxPath = (Get-Command upx).Path
        Write-ColorOutput Green "已检测到UPX，将用于压缩可执行文件"
        Write-ColorOutput Green "UPX版本: $upxVersion"
    }
    catch {
        Write-ColorOutput Yellow "未检测到UPX，将使用默认压缩"
    }
    
    # 构建命令
    $buildCmd = "pyinstaller build/pyinstaller.spec --clean"
    
    # 如果UPX可用，添加相关参数
    if ($upxAvailable) {
        $upxDir = Split-Path -Parent $upxPath
        $buildCmd += " --upx-dir `"$upxDir`""
        # 设置UPX环境变量以使用最高压缩级别
        $env:UPX = "--best --lzma"
        Write-ColorOutput Green "已设置UPX使用最高压缩级别"
    }
    
    # 使用 PyInstaller 构建
    Invoke-Expression $buildCmd
}

# 复制额外文件
function Copy-ExtraFiles {
    Write-ColorOutput Green "复制额外文件..."
    
    # 复制配置文件
    Copy-Item "version.json" "dist/win-unpacked/"
    Copy-Item "languages.json" "dist/win-unpacked/"
    
    # 复制 README 文件
    Copy-Item "README.md" "dist/win-unpacked/"
    Copy-Item "README_EN.md" "dist/win-unpacked/"
    Copy-Item "LICENSE" "dist/win-unpacked/"
}

# 主函数
function Main {
    Write-ColorOutput Green "开始打包流程..."
    
    # 检查环境
    Check-Requirements
    
    # 安装依赖
    Install-Dependencies
    
    # 先构建后端，确保 dist/backend.exe 存在
    Build-Backend
    
    # 再构建前端（electron-builder 会自动将 dist/backend.exe 打包进包内）
    Build-Frontend
    
    # 复制额外文件
    Copy-ExtraFiles
    
    Write-ColorOutput Green "打包完成！"
    Write-ColorOutput Green "输出目录: dist/win-unpacked/"
}

# 执行主函数
Main 