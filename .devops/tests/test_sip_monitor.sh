#!/usr/bin/env bash
# Requires a C++17 compiler and libjson-c development files; no PBX needed.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
binary="$(mktemp /tmp/sip-monitor-test.XXXXXX)"
trap 'rm -f "$binary"' EXIT
c++ -std=c++17 -O1 -ffunction-sections -fdata-sections \
  -Iapp/server -Iinclude -Iexternal/cJSON -Iexternal/ggml/include -Iexamples/ivrTTS \
  .devops/tests/test_sip_monitor.cpp src/framework/io/json.cpp external/cJSON/cJSON.c \
  app/server/http.cpp -Wl,--gc-sections -ljson-c -pthread -o "$binary"
"$binary"
