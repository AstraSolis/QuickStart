#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
修复Windows环境下的编码问题
此脚本应该在启动主应用程序之前运行
"""

import os
import sys
import locale
import subprocess

def main():
    """主函数，设置环境变量并启动应用程序"""
    # 设置环境变量
    os.environ["PYTHONIOENCODING"] = "utf-8"
    os.environ["PYTHONLEGACYWINDOWSSTDIO"] = "utf-8"
    
    # 设置控制台代码页为UTF-8
    if sys.platform == "win32":
        subprocess.run("chcp 65001", shell=True)
    
    # 启动主应用程序
    result = subprocess.run("npm start", shell=True)
    
    # 返回应用程序的退出码
    return result.returncode

if __name__ == "__main__":
    sys.exit(main()) 