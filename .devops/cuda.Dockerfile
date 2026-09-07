# audio.cpp — CUDA Dockerfile
#
# Usage:
#   docker build -f .devops/cuda.Dockerfile -t local/audiocpp:full-cuda .

# ── BUILD: Compile all release binaries with CUDA ─────────────────────────────
ARG UBUNTU_VERSION=24.04
ARG CUDA_VERSION=12.9.2
ARG BUILD_DATE=N/A
ARG APP_VERSION=N/A
ARG APP_REVISION=N/A
ARG GCC_VERSION=14
ARG LLAMA_CPP_REF=5202104b59ada9005db079eea43882a2b7bf5802

ARG BASE_CUDA_DEV_CONTAINER=docker.io/nvidia/cuda:${CUDA_VERSION}-devel-ubuntu${UBUNTU_VERSION}
ARG BASE_CUDA_RUN_CONTAINER=docker.io/nvidia/cuda:${CUDA_VERSION}-runtime-ubuntu${UBUNTU_VERSION}

FROM ${BASE_CUDA_DEV_CONTAINER} AS build

ARG GCC_VERSION=14
ARG AUDIOCPP_VERSION=dev
ARG AUDIOCPP_MODEL_SET=full
ARG AUDIOCPP_MODELS=
ARG AUDIOCPP_CPU_ALL_VARIANTS=ON
ARG BUILD_JOBS=0
# CUDA architectures to compile for.
# - default = the portable default list from CMakeLists.txt
# - for a custom arch set build with --build-arg CUDA_DOCKER_ARCH="89-real;...".
ARG CUDA_DOCKER_ARCH=default

# Install build toolchain
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc-${GCC_VERSION} g++-${GCC_VERSION} cmake ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV CC=gcc-${GCC_VERSION} CXX=g++-${GCC_VERSION} CUDAHOSTCXX=g++-${GCC_VERSION}

WORKDIR /app
COPY . .

RUN if [ "${CUDA_DOCKER_ARCH}" != "default" ]; then \
        ADDITIONAL_CMAKE_ARGS="-DCMAKE_CUDA_ARCHITECTURES=${CUDA_DOCKER_ARCH}"; \
    fi && \
    cmake -S . -B build \
        -DCMAKE_BUILD_TYPE=Release \
        -DAUDIOCPP_MODEL_SET="${AUDIOCPP_MODEL_SET}" \
        -DAUDIOCPP_MODELS="${AUDIOCPP_MODELS}" \
        -DENGINE_ENABLE_CPU_ALL_VARIANTS="${AUDIOCPP_CPU_ALL_VARIANTS}" \
        -DENGINE_ENABLE_CUDA=ON \
        -DENGINE_ENABLE_CUDA_GRAPHS=ON \
        -DGGML_CUDA_NCCL=OFF \
        -DENGINE_ENABLE_VULKAN=OFF \
        -DENGINE_ENABLE_OPENMP=ON \
        -DAUDIOCPP_BUILD_NATIVE_MODEL_MANAGER=ON \
        -DAUDIOCPP_VERSION="${AUDIOCPP_VERSION}" \
        -DENGINE_BUILD_EXAMPLES=OFF \
        -DENGINE_BUILD_TESTS=OFF \
        -DENGINE_BUILD_WARMBENCH=OFF \
        ${ADDITIONAL_CMAKE_ARGS} \
        -DCMAKE_EXE_LINKER_FLAGS=-Wl,--allow-shlib-undefined && \
    if [ "${BUILD_JOBS}" = "0" ]; then BUILD_JOBS="$(nproc)"; fi && \
    cmake --build build --parallel "${BUILD_JOBS}" \
        --target audiocpp_cli \
        --target audiocpp_server \
        --target audiocpp_model_manager \
        --target model_perf

# Collect shared libraries
RUN mkdir -p /app/lib && \
    find build -name "*.so*" -exec cp -P {} /app/lib \;

# Collect binaries + multiplexer into /app/full
RUN mkdir -p /app/full && \
    cp build/bin/audiocpp_cli build/bin/audiocpp_server build/bin/audiocpp_model_manager \
       build/bin/model_perf /app/full/ && \
    cp .devops/entrypoint.sh /app/full/entrypoint.sh && \
    chmod +x /app/full/entrypoint.sh

# ── LLAMA.CPP: Build for the same CUDA runtime and Jetson architecture ───────
# A prebuilt CUDA image may contain PTX produced by a toolkit newer than the
# JetPack driver. Building here avoids that mismatch and emits native SM87 code.
FROM ${BASE_CUDA_DEV_CONTAINER} AS llama-build

ARG GCC_VERSION=14
ARG CUDA_DOCKER_ARCH=default
ARG BUILD_JOBS=0
ARG LLAMA_CPP_REF

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc-${GCC_VERSION} g++-${GCC_VERSION} build-essential cmake git \
        ca-certificates libcurl4-openssl-dev libssl-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV CC=gcc-${GCC_VERSION} CXX=g++-${GCC_VERSION} CUDAHOSTCXX=g++-${GCC_VERSION}

WORKDIR /src
RUN mkdir llama.cpp && \
    cd llama.cpp && \
    git init && \
    git remote add origin https://github.com/ggml-org/llama.cpp.git && \
    git fetch --depth=1 origin "${LLAMA_CPP_REF}" && \
    git checkout --detach FETCH_HEAD

WORKDIR /src/llama.cpp
RUN if [ "${CUDA_DOCKER_ARCH}" != "default" ]; then \
        ADDITIONAL_CMAKE_ARGS="-DCMAKE_CUDA_ARCHITECTURES=${CUDA_DOCKER_ARCH}"; \
    fi && \
    cmake -S . -B build \
        -DCMAKE_BUILD_TYPE=Release \
        -DGGML_NATIVE=OFF \
        -DGGML_CUDA=ON \
        -DGGML_CUDA_NCCL=OFF \
        -DGGML_BACKEND_DL=ON \
        -DGGML_CPU_ALL_VARIANTS=OFF \
        -DLLAMA_BUILD_SERVER=ON \
        -DLLAMA_BUILD_TESTS=OFF \
        -DLLAMA_BUILD_EXAMPLES=OFF \
        -DLLAMA_BUILD_UI=OFF \
        -DLLAMA_USE_PREBUILT_UI=OFF \
        ${ADDITIONAL_CMAKE_ARGS} \
        -DCMAKE_EXE_LINKER_FLAGS=-Wl,--allow-shlib-undefined && \
    if [ "${BUILD_JOBS}" = "0" ]; then BUILD_JOBS="$(nproc)"; fi && \
    cmake --build build --config Release --parallel "${BUILD_JOBS}" --target llama-server && \
    mkdir -p /out && \
    cp build/bin/llama-server /out/ && \
    find build -name "*.so*" -exec cp -P {} /out/ \;

# ── BASE: Shared runtime (NVIDIA CUDA + common libs) ──────────────────────────
FROM ${BASE_CUDA_RUN_CONTAINER} AS base

ARG BUILD_DATE=N/A
ARG APP_VERSION=N/A
ARG APP_REVISION=N/A
ARG IMAGE_URL=N/A
ARG IMAGE_SOURCE=N/A

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$APP_REVISION \
      org.opencontainers.image.title="audio.cpp" \
      org.opencontainers.image.description="An all-in-one, pure C++ inference engine for audio models, powered by ggml" \
      org.opencontainers.image.url=$IMAGE_URL \
      org.opencontainers.image.source=$IMAGE_SOURCE

# Runtime deps: OpenMP threading, curl (healthcheck), ffmpeg (audio I/O),
# python3 for the native WebUI's spec-backed model installer.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgomp1 curl ffmpeg python3 ca-certificates && \
    apt-get autoremove -y && \
    apt-get clean -y && \
    rm -rf /tmp/* /var/tmp/* && \
    find /var/cache/apt/archives /var/lib/apt/lists -not -name lock -type f -delete && \
    find /var/cache -type f -delete

# Docker Hub's CUDA images provide this account, while NVIDIA's Jetson-specific
# L4T CUDA runtime does not. Keep the final image non-root with either base.
RUN if ! id -u ubuntu >/dev/null 2>&1; then \
        useradd --create-home --shell /bin/bash ubuntu; \
    fi

COPY --from=build /app/lib/ /app

WORKDIR /app

# ── FULL: All binaries + entrypoint.sh multiplexer ────────────────────────────
FROM base AS full

COPY --from=build /app/full /app
COPY model_specs/ /app/model_specs/
COPY tools/model_manager_v2.py /app/tools/model_manager_v2.py

RUN mkdir -p /app/models && chown ubuntu:ubuntu /app/models

USER ubuntu

ENTRYPOINT ["/app/entrypoint.sh"]

# ── ALL-IN-ONE: embedded Svelte UI + audio.cpp + llama.cpp workers ──────
FROM full AS all-in-one

USER root

# Keep llama.cpp's ggml libraries separate from audio.cpp's ggml libraries.
COPY --from=llama-build /out/ /opt/llama.cpp/
COPY .devops/all-in-one-entrypoint.sh /app/all-in-one-entrypoint.sh
COPY .devops/all-in-one-server.json /app/all-in-one-server.json

RUN chmod +x /app/all-in-one-entrypoint.sh && \
    mkdir -p /app/models /app/llama-models && \
    chown -R ubuntu:ubuntu /app/models /app/llama-models

USER ubuntu

EXPOSE 8081 8082

ENTRYPOINT ["/app/all-in-one-entrypoint.sh"]
