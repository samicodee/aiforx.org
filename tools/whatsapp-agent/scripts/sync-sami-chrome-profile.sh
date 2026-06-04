#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="${HOME}/Library/Application Support/Google/Chrome"
SOURCE_PROFILE="${SOURCE_ROOT}/Profile 1"
TARGET_ROOT="$(cd "$(dirname "$0")/.." && pwd)/.chrome-profile"
TARGET_PROFILE="${TARGET_ROOT}/Profile 1"

if [[ ! -d "${SOURCE_PROFILE}" ]]; then
  echo "Missing Chrome profile: ${SOURCE_PROFILE}" >&2
  exit 1
fi

mkdir -p "${TARGET_ROOT}"

rsync -a --delete \
  --exclude='Singleton*' \
  --exclude='Crashpad' \
  --exclude='BrowserMetrics*' \
  --exclude='GrShaderCache' \
  --exclude='GraphiteDawnCache' \
  --exclude='ShaderCache' \
  --exclude='Safe Browsing' \
  --exclude='Code Cache' \
  --exclude='GPUCache' \
  --exclude='Cache' \
  --exclude='DawnCache' \
  --exclude='Service Worker/CacheStorage' \
  "${SOURCE_PROFILE}/" "${TARGET_PROFILE}/"

cp "${SOURCE_ROOT}/Local State" "${TARGET_ROOT}/Local State"

echo "Copied SAMI - PERSONAL Chrome profile to ${TARGET_ROOT}"
