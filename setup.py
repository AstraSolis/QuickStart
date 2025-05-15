#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
QuickStart项目安装脚本
此脚本解决Windows环境下的编码问题并自动安装所需依赖
"""

import os
import sys
import subprocess
import codecs
import locale
import platform
import json

def set_encoding():
    """设置系统编码为UTF-8"""
    print("设置系统编码为UTF-8...")
    os.environ["PYTHONIOENCODING"] = "utf-8"
    
    if sys.platform == "win32":
        # 设置控制台代码页为UTF-8
        subprocess.run("chcp 65001", shell=True)
        print("已将控制台代码页设置为UTF-8 (65001)")

def check_package_json_deps():
    """检查package.json是否有husky相关依赖"""
    try:
        with codecs.open("package.json", "r", encoding="utf-8") as f:
            package_data = json.load(f)
        
        dev_deps = package_data.get("devDependencies", {})
        return ("husky" in dev_deps and 
                "@commitlint/cli" in dev_deps and 
                "@commitlint/config-conventional" in dev_deps)
    except Exception as e:
        print(f"检查package.json失败: {e}")
        return False

def install_npm_dependencies():
    """安装npm依赖"""
    print("正在安装npm依赖...")
    result = subprocess.run("npm install", shell=True)
    
    # 检查husky是否存在于package.json但安装失败
    if result.returncode != 0 or not check_package_json_deps():
        print("正在尝试手动安装husky依赖...")
        subprocess.run("npm install --save-dev husky @commitlint/cli @commitlint/config-conventional", shell=True)
        subprocess.run("npx husky install", shell=True)
        return True
    
    return result.returncode == 0

def install_python_dependencies():
    """安装Python依赖"""
    print("正在安装Python依赖...")
    try:
        # 首先尝试直接安装主要依赖
        print("直接安装主要依赖...")
        deps = ["flask", "flask-cors", "pywin32", "Pillow"]
        for dep in deps:
            print(f"安装 {dep}...")
            subprocess.run(f"{sys.executable} -m pip install {dep}", shell=True)
        
        print("Python依赖安装完成！")
        return True
    except Exception as e:
        print(f"Python依赖安装失败: {e}")
        print("请尝试手动运行: pip install flask flask-cors pywin32 Pillow")
        return False

def main():
    """主函数"""
    print(f"欢迎使用QuickStart项目安装脚本")
    print(f"系统信息: {platform.platform()}")
    print(f"Python版本: {sys.version}")
    print(f"默认编码: {sys.getdefaultencoding()}")
    print(f"本地编码: {locale.getpreferredencoding()}")
    
    # 设置编码
    set_encoding()
    
    # 安装依赖
    npm_success = install_npm_dependencies()
    python_success = install_python_dependencies()
    
    if npm_success and python_success:
        print("\n安装成功！你可以通过以下命令启动项目:")
        print("npm run dev")
    else:
        print("\n安装过程中遇到了一些问题，请查看上面的错误信息。")
        print("可以尝试按照README_SETUP.md中的手动安装步骤进行操作。")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 