#!/bin/bash
# 生成安卓正式签名密钥（只需要做一次）。会提示你设置密码、填写名字等信息。
# 生成后：
#   1. 把 android/keystore.properties.example 复制成 android/keystore.properties，填上刚设的密码
#   2. 把 android/naiwa-release.jks 和密码备份到安全的地方（丢了就再也无法更新这个应用）
set -e
cd "$(dirname "$0")/../android"
if [ -f naiwa-release.jks ]; then
  echo "android/naiwa-release.jks 已经存在，不重复生成（覆盖会导致以后无法更新已发布的应用）"
  exit 1
fi
JAVA_HOME="$(/usr/libexec/java_home -v 22 2>/dev/null || /usr/libexec/java_home)"
"$JAVA_HOME/bin/keytool" -genkeypair -v -keystore naiwa-release.jks -alias naiwa -keyalg RSA -keysize 2048 -validity 10000
echo
echo "✅ 已生成 android/naiwa-release.jks"
echo "下一步：复制 android/keystore.properties.example 为 android/keystore.properties 并填上密码，然后运行 npm run android:release"
