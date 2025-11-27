#!/bin/bash
# Git 编码配置脚本（Git Bash 版本）
# 在 Git Bash 中运行此脚本以配置 Git 编码设置

echo "配置 Git 编码设置..."

# 配置 Git 编码
git config --global core.quotepath false
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8

echo "Git 编码配置完成！"
echo ""
echo "当前 Git 编码配置："
git config --list | grep -E "i18n|encoding|core.quotepath"

