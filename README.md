# QuickStart

<div align="center">
    <h1>QuickStart</h1>
    <p>一个基于 Electron 和 Python 的快速启动工具，帮助您高效管理和启动常用文件</p>
    <p>
        <img src="https://img.shields.io/badge/Electron-16.0+-blue.svg" alt="Electron">
        <img src="https://img.shields.io/badge/Python-3.7+-green.svg" alt="Python">
        <img src="https://img.shields.io/badge/Windows-10+-yellow.svg" alt="Windows">
        <img src="https://img.shields.io/badge/License-MIT-lightgrey.svg" alt="License">
    </p>
    <p>
        <a href="README_EN.md">
            <img src="https://img.shields.io/badge/English-Read%20in%20English-blue" alt="Read in English">
        </a>
    </p>
</div>

> 一些不常用的文件或软件，不想每次使用时翻找目录，又希望保持桌面的整洁，可以试试这个软件
>
> 让您的桌面保持整洁，同时快速访问常用文件！

---

## ✨ 功能特色

- 🚀 **快速启动**：双击即可打开文件或文件夹，支持批量添加和拖放操作
- 📝 **文件备注**：为每个文件添加自定义备注信息，方便识别和管理
- ⚙️ **启动参数**：为可执行文件设置自定义启动参数
- 🌐 **多语言支持**：内置中文和英文界面，随时切换
- 🛡️ **管理员权限**：支持以管理员身份运行程序
- 📂 **右键菜单**：丰富的右键菜单功能，包括打开文件位置、复制路径等
- 🖼️ **文件图标**：自动获取文件系统图标，直观显示文件类型
- 🔄 **排序功能**：支持拖拽调整文件顺序
- 🔍 **扩展名显示**：可选择显示或隐藏文件扩展名
- 🖥️ **托盘集成**：系统托盘图标集成，隐藏窗口也能快速访问
- 🔗 **快捷方式优化**：可选移除快捷方式箭头图标
- 📊 **Git版本管理**：基于Git的版本控制，自动生成更新日志
- 📦 **规范化提交**：支持Conventional Commits提交规范

---

<div align="center">
    <h2>📸 使用截图</h2>
    <p>主界面展示了文件列表和操作按钮</p>
</div>

![主界面示例图](https://img.picui.cn/free/2025/05/15/6825828e6b7a7.png)

---

## 📚 使用指南

### 添加文件或文件夹

- 点击"添加文件"按钮选择文件
- 直接拖放文件到程序窗口

### 启动文件

- 双击列表中的项目打开文件/文件夹

### 右键菜单功能

- **打开** - 打开选中文件或文件夹
- **管理员权限** - 开启/关闭管理员权限运行
- **备注** - 添加或编辑文件备注信息
- **参数** - 设置启动参数（对可执行文件有效）
- **托盘** - 添加到/从系统托盘移除
- **位置** - 打开文件所在文件夹
- **路径** - 复制文件路径到剪贴板
- **排序** - 上移/下移调整文件顺序
- **删除** - 从列表中移除文件

### 系统托盘操作

- 点击托盘图标显示/隐藏主窗口
- 右键托盘图标快速访问已添加的项目

### 设置选项

- **语言** - 切换界面语言 (中文/英文)
- **文件扩展名** - 选择是否显示文件后缀
- **快捷方式箭头** - 选择是否移除箭头图标
- **托盘最小化** - 启用/禁用最小化到托盘

---

## 📋 文件配置

应用的设置和文件信息保存在用户目录下的数据库中：

- 数据库文件：`%APPDATA%\quickstart\quickstart.db`
- 版本信息：`version.json` 和 `version.txt`

---

## 💻 安装与运行

### 普通用户

1. 在 [Releases](https://github.com/AstraSolis/QuickStart/releases/) 页面下载最新版本的安装包
2. 运行安装程序，按照向导完成安装
3. 从开始菜单或桌面快捷方式启动程序

### 开发者

#### 环境要求

- **Node.js v14+**
- **Python 3.7+**
- **Windows 操作系统**
- **Git** (用于版本控制)

#### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/AstraSolis/QuickStart.git

# 进入项目目录
cd QuickStart

# 使用安装脚本（推荐）
python setup.py

# 或者手动安装依赖
# 前端依赖
npm install
# 后端依赖 (确保使用UTF-8编码)
cd backend
pip install flask flask-cors pywin32 Pillow
cd ..
```

> **注意**：如果遇到安装问题，请参考 [安装指南](./README_SETUP.md) 获取详细解决方案。

#### 启动开发环境

```bash
# 使用fix_encoding.py解决中文编码问题后启动
python fix_encoding.py

# 或者使用npm脚本启动
npm run dev
```

#### 构建可执行文件

请参考 [构建指南](./build/README.md) 了解详细的构建步骤和说明。

#### 版本发布

```bash
# 根据提交历史自动决定版本号
npm run release

# 增加补丁版本 (1.0.0 -> 1.0.1)
npm run release:patch

# 增加次版本 (1.0.0 -> 1.1.0)
npm run release:minor

# 增加主版本 (1.0.0 -> 2.0.0)
npm run release:major
```

---

## 🔧 架构说明

- **前端**: Electron + HTML/CSS/JavaScript
- **后端**: Python + Flask REST API
- **数据存储**: SQLite 数据库
- **版本控制**: Git + standard-version

---

## 📂 目录结构

```