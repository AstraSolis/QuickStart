<div align="center">
    <h1>QuickStart</h1>
    <p>一个基于 PyQt5 的桌面应用程序，用于快速启动文件</p>
    <p>
        <img src="https://img.shields.io/badge/Python-3.7+-blue.svg" alt="Python">
        <img src="https://img.shields.io/badge/Windows-10+-green.svg" alt="Windows">
        <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
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

- 🚀 **快速启动**：通过拖拽或选择快速添加到列表中，双击即可启动。
- 📝 **文件备注**：为文件添加自定义备注，方便识别。
- ⚙️ **启动参数**：为程序或脚本添加自定义启动参数。
- 🌐 **多语言支持**：支持多语言切换，界面动态刷新。
- 🛡️ **管理员权限**：指定文件以管理员权限启动。
- 📂 **右键菜单**：支持打开文件位置、删除文件等操作。
- 🖼️ **文件图标支持**：智能解析文件类型并显示对应图标（支持 `.lnk` 和 `.url`）。
- 🔄 **自动保存**：所有更改自动保存到配置文件。

---

<div align="center">
    <h2>📸 使用截图</h2>
</div>

![主界面](https://github.com/user-attachments/assets/971d5aae-d738-439b-9e49-72c60c6c392b)

---

## 📋 文件配置

应用的文件信息保存在 `config.json` 文件中，结构如下：

```json
{
    "language": "中文",
    "show_extensions": true,
    "remove_arrow": true,
    "minimize_to_tray": true,
    "tray_items": [
        {
            "name": "example.exe",
            "path": "C:/path/to/example.exe",
            "is_dir": false,
            "remark": "示例文件",
            "admin": false,
            "params": ""
        }
    ]
}
```

### 配置说明

- `language`: 界面语言（"中文"/"English"）
- `show_extensions`: 是否显示文件扩展名
- `remove_arrow`: 是否移除快捷方式箭头
- `minimize_to_tray": true`: 最小化到系统托盘
- `tray_items`: 文件列表
  - `name`: 显示名称
  - `path`: 文件路径
  - `is_dir`: 是否为文件夹
  - `remark`: 备注信息
  - `admin`: 是否以管理员权限运行
  - `params`: 启动参数

---

## 💻 安装与运行

### 普通用户

1. 在[Releases](https://github.com/AstraSolis/QuickStart/releases/)下载最新版本的 `QuickStart.exe`
2. 将文件保存到任意目录
3. 双击运行即可

> 注意：首次运行时会自动生成 `config.json` 配置文件

### 开发者

#### 环境要求

- **Python 3.7+**
- **Windows 操作系统**（支持管理员权限运行）
- 以下 Python 库：
  - `PyQt5`
  - `pywin32`

#### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/AstraSolis/QuickStart.git

# 进入项目目录
cd QuickStart

# 安装依赖
pip install -r requirements.txt
```

#### 运行源码

```bash
python QuickStart.py
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

---

## 📝 开源协议

本项目采用 GPL-3.0 许可证 - 查看 [LICENSE](https://github.com/AstraSolis/QuickStart/blob/master/LICENSE) 文件了解详情

---

<div align="center">
    <p>⭐ 如果你喜欢这个项目，请给它一个 Star！</p>
    <p>欢迎提出建议和反馈！</p>
</div>

