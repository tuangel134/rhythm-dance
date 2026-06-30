#!/bin/bash
# Construye el APK del juego: compila el cliente web (vite), lo embebe en los
# assets de Android y arma el APK debug. El dist/ esta en .gitignore, por eso
# se reconstruye y copia aqui antes de compilar.
set -e
ROOT="/home/angel/Descargas/juego musica/rhythm-dance"
cd "$ROOT"

echo "==> 1/3 build cliente web (vite)"
npm run build:client

echo "==> 2/3 embebiendo dist en assets de Android"
rm -rf android/app/src/main/assets/dist
mkdir -p android/app/src/main/assets
cp -r dist android/app/src/main/assets/dist

echo "==> 3/3 assembleDebug (gradle)"
cd android
ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk \
  /home/angel/.gradle/wrapper/dists/gradle-9.5.0-bin/bvnork1r7n8i6kp5cnkibsc9q/gradle-9.5.0/bin/gradle \
  :app:assembleDebug --console=plain --offline

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
cp "$APK" "$HOME/Descargas/rhythm-dance-OFFLINE.apk"
echo "==> LISTO: $HOME/Descargas/rhythm-dance-OFFLINE.apk"
