#!/usr/bin/env bash
set -Eeuo pipefail

audio_pid=""
llama_pid=""
bootstrap_pid=""

shutdown() {
    trap - EXIT INT TERM
    for pid in "$bootstrap_pid" "$llama_pid" "$audio_pid"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null || true
}
trap shutdown EXIT INT TERM

mkdir -p /app/models /app/llama-models

/app/audiocpp_server \
    --config /app/all-in-one-server.json \
    --ui-management \
    --max-loaded-models "${AUDIOCPP_MAX_LOADED_MODELS:-1}" \
    --idle-unload-ms "${AUDIOCPP_IDLE_UNLOAD_MS:-60000}" &
audio_pid=$!

LD_LIBRARY_PATH="/opt/llama.cpp${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}" \
/opt/llama.cpp/llama-server \
    --host 0.0.0.0 \
    --port 8082 \
    --models-dir /app/llama-models \
    --models-max "${LLAMA_MODELS_MAX:-1}" \
    --ctx-size "${LLAMA_CTX_SIZE:-4096}" \
    --n-gpu-layers "${LLAMA_GPU_LAYERS:-99}" &
llama_pid=$!

# Bootstrap weights without delaying the WebUI. All three audio installs use the
# native C++ manager. Set either variable to an empty string to disable downloads.
bootstrap_models() {
    local packages="${AUDIOCPP_BOOTSTRAP_PACKAGES:-sortformer_diar_4spk_v1_q8_0,qwen3_asr_0_6b_q8_0,pocket_tts_english_q8_0}"
    if [[ -n "$packages" ]]; then
        local package
        IFS=',' read -r -a package_list <<< "$packages"
        for package in "${package_list[@]}"; do
            [[ -z "$package" ]] && continue
            echo "[all-in-one] ensuring audio model package: $package"
            /app/audiocpp_model_manager install "$package" --models-dir /app/models || \
                echo "[all-in-one] audio package failed (retry from Models page): $package" >&2
        done
    fi

    local llama_model="${LLAMA_BOOTSTRAP_MODEL:-bartowski/Qwen2.5-3B-Instruct-GGUF:Q4_K_M}"
    if [[ -n "$llama_model" ]]; then
        if [[ "$llama_model" == *'"'* || "$llama_model" == *$'\n'* || "$llama_model" == *$'\r'* ]]; then
            echo "[all-in-one] LLAMA_BOOTSTRAP_MODEL contains unsupported characters" >&2
            return 1
        fi
        until curl -fsS http://127.0.0.1:8082/health >/dev/null; do
            if ! kill -0 "$llama_pid" 2>/dev/null; then
                return 1
            fi
            sleep 1
        done
        local model_inventory
        model_inventory="$(curl -fsS http://127.0.0.1:8082/models || true)"
        if [[ "$model_inventory" == *"$llama_model"* ]]; then
            echo "[all-in-one] llama.cpp model is available: $llama_model"
            return 0
        fi

        echo "[all-in-one] requesting llama.cpp model download: $llama_model"
        if ! curl -fsS http://127.0.0.1:8082/models \
            -H 'Content-Type: application/json' \
            -d "{\"model\":\"${llama_model}\"}" >/dev/null; then
            echo "[all-in-one] llama model download failed (retry from LLM page)" >&2
            return 1
        fi
        echo "[all-in-one] llama.cpp model download started; it will load on the first LLM request"
    fi
}
bootstrap_models &
bootstrap_pid=$!

echo "[all-in-one] WebUI: http://0.0.0.0:8081"
echo "[all-in-one] audio.cpp REST worker: http://0.0.0.0:8081/v1"
echo "[all-in-one] llama.cpp REST worker: http://0.0.0.0:8082/v1"

set +e
wait -n "$audio_pid" "$llama_pid"
status=$?
set -e
echo "[all-in-one] a required worker exited with status $status" >&2
exit "$status"
