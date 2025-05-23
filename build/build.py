#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import json
import shutil
import subprocess
import platform
import webbrowser
from pathlib import Path
from typing import Optional, List, Dict, Any

class BuildManager:
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent
        self.build_dir = self.root_dir / "build"
        self.dist_dir = self.root_dir / "dist"
        self.frontend_dir = self.root_dir / "frontend"
        self.backend_dir = self.root_dir / "backend"
        
        # 颜色代码
        self.colors = {
            "reset": "\033[0m",
            "red": "\033[31m",
            "green": "\033[32m",
            "yellow": "\033[33m",
            "blue": "\033[34m",
            "magenta": "\033[35m",
            "cyan": "\033[36m"
        }

    def print_colored(self, text: str, color: str = "reset") -> None:
        """打印彩色文本"""
        print(f"{self.colors.get(color, '')}{text}{self.colors['reset']}")

    def check_path_environment(self) -> None:
        """检查环境变量设置"""
        self.print_colored("\n检查环境变量设置...", "cyan")
        
        # 获取 PATH 环境变量
        path = os.environ.get('PATH', '')
        paths = path.split(os.pathsep)
        
        # 查找 Node.js 相关路径
        node_paths = [p for p in paths if 'node' in p.lower()]
        npm_paths = [p for p in paths if 'npm' in p.lower()]
        
        self.print_colored("\n当前环境变量中的 Node.js 相关路径：", "yellow")
        if node_paths:
            for p in node_paths:
                self.print_colored(f"- {p}", "blue")
        else:
            self.print_colored("未找到 Node.js 相关路径", "red")
            
        self.print_colored("\n当前环境变量中的 npm 相关路径：", "yellow")
        if npm_paths:
            for p in npm_paths:
                self.print_colored(f"- {p}", "blue")
        else:
            self.print_colored("未找到 npm 相关路径", "red")

    def check_npm_installation(self, node_path: str) -> bool:
        """检查 npm 安装并尝试修复"""
        try:
            # 检查 npm.cmd 是否存在
            npm_cmd_path = os.path.join(node_path, "npm.cmd")
            if not os.path.exists(npm_cmd_path):
                self.print_colored(f"\n未找到 npm.cmd 文件: {npm_cmd_path}", "red")
                return False

            # 尝试运行 npm
            try:
                npm_result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
                if npm_result.returncode == 0:
                    self.print_colored(f"✓ npm 已安装: {npm_result.stdout.strip()}", "green")
                    return True
            except FileNotFoundError:
                pass

            # 如果 npm 命令不可用，尝试使用完整路径
            try:
                npm_result = subprocess.run([npm_cmd_path, "--version"], capture_output=True, text=True)
                if npm_result.returncode == 0:
                    self.print_colored(f"✓ npm 已安装: {npm_result.stdout.strip()}", "green")
                    self.print_colored("\n注意: npm 已安装但未添加到 PATH 中", "yellow")
                    self.print_colored("请将以下路径添加到系统环境变量 PATH 中：", "blue")
                    self.print_colored(node_path, "blue")
                    return True
            except Exception:
                pass

            return False
        except Exception as e:
            self.print_colored(f"检查 npm 安装时出错: {str(e)}", "red")
            return False

    def check_node_installation(self) -> bool:
        """检查 Node.js 安装并尝试修复"""
        try:
            # 检查 node 是否安装
            try:
                node_result = subprocess.run(["node", "--version"], capture_output=True, text=True)
                if node_result.returncode != 0:
                    raise FileNotFoundError("Node.js 未安装")
            except FileNotFoundError:
                self.print_colored("\n未检测到 Node.js！", "red")
                self.print_colored("请按照以下步骤安装 Node.js：", "yellow")
                self.print_colored("1. 访问 Node.js 官方网站下载安装包", "blue")
                self.print_colored("2. 选择 LTS（长期支持）版本", "blue")
                self.print_colored("3. 运行安装程序，确保选中 'Add to PATH' 选项", "blue")
                self.print_colored("4. 完成安装后重启终端", "blue")
                self.print_colored("\n正在打开 Node.js 下载页面...", "yellow")
                webbrowser.open("https://nodejs.org/zh-cn/download/")
                return False

            # 获取 Node.js 安装路径
            try:
                node_path = subprocess.run(["where", "node"], capture_output=True, text=True).stdout.strip()
                node_dir = os.path.dirname(node_path)
                self.print_colored(f"\nNode.js 安装路径: {node_dir}", "blue")
                
                # 检查 npm 安装
                if not self.check_npm_installation(node_dir):
                    self.print_colored("\n检测到 Node.js 但未找到 npm！", "red")
                    self.print_colored("这通常意味着 Node.js 安装不完整或环境变量设置有问题。", "yellow")
                    
                    # 检查环境变量
                    self.check_path_environment()
                    
                    self.print_colored("\n请按照以下步骤解决：", "yellow")
                    self.print_colored("1. 检查 Node.js 安装目录（通常在 C:\\Program Files\\nodejs）", "blue")
                    self.print_colored("2. 确认该目录下是否存在 npm.cmd 文件", "blue")
                    self.print_colored("3. 如果存在，请确保该目录已添加到系统环境变量 PATH 中", "blue")
                    self.print_colored("4. 如果不存在，请重新安装 Node.js", "blue")
                    self.print_colored("\n正在打开 Node.js 下载页面...", "yellow")
                    webbrowser.open("https://nodejs.org/zh-cn/download/")
                    return False
                
                return True
            except Exception as e:
                self.print_colored(f"获取 Node.js 路径时出错: {str(e)}", "red")
                return False

        except Exception as e:
            self.print_colored(f"\n检查 Node.js 安装时出错: {str(e)}", "red")
            self.print_colored("\n请确保：", "yellow")
            self.print_colored("1. Node.js 已正确安装", "blue")
            self.print_colored("2. 已将 Node.js 添加到系统环境变量", "blue")
            self.print_colored("3. 已重启终端或命令提示符", "blue")
            self.print_colored("\n正在打开 Node.js 下载页面...", "yellow")
            webbrowser.open("https://nodejs.org/zh-cn/download/")
            return False

    def check_requirements(self) -> bool:
        """检查必要的工具是否安装"""
        self.print_colored("检查必要的工具...", "cyan")
        
        # 首先检查 Node.js 和 npm
        if not self.check_node_installation():
            return False
        
        requirements = {
            "python": ["python", "--version"],
            "upx": ["upx", "--version"]
        }
        
        missing_tools = []
        
        for tool, command in requirements.items():
            try:
                result = subprocess.run(command, capture_output=True, text=True)
                if result.returncode == 0:
                    self.print_colored(f"✓ {tool} 已安装: {result.stdout.strip()}", "green")
                else:
                    missing_tools.append(tool)
            except FileNotFoundError:
                missing_tools.append(tool)
        
        if missing_tools:
            self.print_colored(f"✗ 缺少以下工具: {', '.join(missing_tools)}", "red")
            if "upx" in missing_tools:
                self.print_colored("注意: UPX 是可选的，将使用默认压缩", "yellow")
                missing_tools.remove("upx")
            if missing_tools:
                return False
        return True

    def install_dependencies(self) -> bool:
        """安装项目依赖"""
        self.print_colored("安装项目依赖...", "cyan")
        
        try:
            # 检查 backend/requirements.txt 是否存在
            requirements_path = self.backend_dir / "requirements.txt"
            if not requirements_path.exists():
                self.print_colored(f"错误: 未找到 {requirements_path}", "red")
                return False
            
            # 安装 Python 依赖
            self.print_colored("安装 Python 依赖...", "blue")
            # 读取requirements.txt内容并确保使用UTF-8编码
            try:
                with open(requirements_path, 'r', encoding='utf-8') as f:
                    requirements_content = f.read()
            except UnicodeDecodeError:
                # 如果UTF-8读取失败，尝试使用其他编码
                self.print_colored("警告: requirements.txt文件编码不是UTF-8，尝试使用其他编码读取...", "yellow")
                try:
                    with open(requirements_path, 'r', encoding='latin-1') as f:
                        requirements_content = f.read()
                except Exception as e:
                    self.print_colored(f"读取requirements.txt文件失败: {str(e)}", "red")
                    return False
            
            # 创建一个最小化的临时requirements文件，只包含必要的包名，不包含注释
            packages = []
            for line in requirements_content.splitlines():
                line = line.strip()
                if line and not line.startswith('#'):
                    packages.append(line)
            
            # 直接使用pip安装每个包，而不是使用requirements文件
            for package in packages:
                self.print_colored(f"正在安装: {package}", "blue")
                try:
                    subprocess.run([sys.executable, "-m", "pip", "install", package], check=True)
                except subprocess.CalledProcessError as e:
                    self.print_colored(f"安装 {package} 失败: {str(e)}", "red")
                    return False
            
            # 不再需要删除临时文件，因为我们直接安装包
            
            # 强制使用绝对路径，规避虚拟环境 PATH 问题
            npm_path = r"C:\Program Files\nodejs\npm.cmd"

            # 检查 package.json 是否存在
            package_json_path = self.root_dir / "package.json"
            if not package_json_path.exists():
                self.print_colored(f"错误: 未找到 {package_json_path}", "red")
                return False
            
            # 安装 Node.js 依赖
            self.print_colored("安装 Node.js 依赖...", "blue")
            try:
                subprocess.run([npm_path, "install"], cwd=str(self.root_dir), check=True)
            except subprocess.CalledProcessError as e:
                self.print_colored(f"npm install 失败: {str(e)}", "red")
                return False
            
            # 安装打包工具
            self.print_colored("安装打包工具...", "blue")
            try:
                subprocess.run([npm_path, "install", "--save-dev", "electron-builder"], cwd=str(self.root_dir), check=True)
                subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
            except subprocess.CalledProcessError as e:
                self.print_colored(f"安装打包工具失败: {str(e)}", "red")
                return False
            
            return True
        except Exception as e:
            self.print_colored(f"安装依赖失败: {str(e)}", "red")
            return False

    def build_frontend(self) -> bool:
        """构建前端"""
        self.print_colored("构建前端...", "cyan")
        
        try:
            # 只清理 electron-builder 相关的输出目录
            electron_dirs = [
                self.dist_dir / "win-unpacked",
                self.dist_dir / "QuickStart Setup 1.0.1.exe",
                self.dist_dir / "latest.yml"
            ]
            
            for dir_path in electron_dirs:
                if dir_path.exists():
                    try:
                        if dir_path.is_file():
                            dir_path.unlink()
                        else:
                            shutil.rmtree(dir_path)
                        self.print_colored(f"已清理: {dir_path}", "yellow")
                    except PermissionError:
                        self.print_colored(f"警告: 无法删除 {dir_path}，可能被其他进程占用", "yellow")
                        self.print_colored("请确保所有 Electron 应用已关闭，然后重试", "yellow")
                        return False
                    except Exception as e:
                        self.print_colored(f"清理 {dir_path} 时出错: {str(e)}", "red")
                        return False
            
            # 使用 electron-builder 构建
            try:
                subprocess.run([r"C:\Program Files\nodejs\npm.cmd", "run", "build"], check=True)
                return True
            except subprocess.CalledProcessError as e:
                self.print_colored(f"构建前端失败: {str(e)}", "red")
                return False
                
        except Exception as e:
            self.print_colored(f"构建前端时发生错误: {str(e)}", "red")
            return False

    def build_backend(self) -> bool:
        """构建后端"""
        self.print_colored("构建后端...", "cyan")
        
        try:
            # 使用 PyInstaller 构建
            subprocess.run([
                "pyinstaller",
                str(self.build_dir / "pyinstaller.spec"),
                "--clean"
            ], check=True)
            return True
        except subprocess.CalledProcessError as e:
            self.print_colored(f"构建后端失败: {str(e)}", "red")
            return False

    def copy_extra_files(self) -> bool:
        """复制额外文件"""
        self.print_colored("复制额外文件...", "cyan")
        
        try:
            target_dir = self.dist_dir / "win-unpacked"
            if not target_dir.exists():
                target_dir.mkdir(parents=True)
            
            # 复制配置文件
            for file in ["version.json", "languages.json"]:
                shutil.copy2(self.root_dir / file, target_dir)
            
            # 复制文档文件
            for file in ["README.md", "README_EN.md", "LICENSE"]:
                shutil.copy2(self.root_dir / file, target_dir)
            
            return True
        except Exception as e:
            self.print_colored(f"复制文件失败: {str(e)}", "red")
            return False

    def build(self) -> bool:
        """执行完整的构建流程"""
        self.print_colored("开始打包流程...", "magenta")
        
        steps = [
            (self.check_requirements, "检查环境要求"),
            (self.install_dependencies, "安装依赖"),
            # 先构建后端，确保 dist/backend.exe 存在
            (self.build_backend, "构建后端"),
            # 再构建前端（electron-builder 会自动将 dist/backend.exe 打包进包内）
            (self.build_frontend, "构建前端"),
            (self.copy_extra_files, "复制额外文件")
        ]
        
        for step_func, step_name in steps:
            self.print_colored(f"\n执行: {step_name}", "yellow")
            if not step_func():
                self.print_colored(f"\n打包失败: {step_name} 步骤出错", "red")
                return False
        
        self.print_colored("\n打包完成！", "green")
        self.print_colored(f"输出目录: {self.dist_dir / 'win-unpacked'}", "green")
        return True

def main():
    """主函数"""
    builder = BuildManager()
    success = builder.build()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 