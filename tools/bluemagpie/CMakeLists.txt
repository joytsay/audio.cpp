cmake_minimum_required(VERSION 3.20)
project(audiocpp_bluemagpie_worker LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CODEC_TTS_SERVER OFF CACHE BOOL "" FORCE)
# codec.cpp forwards CMAKE_SYSTEM_NAME to its nested backbone build, which
# makes CMake treat native ARM as cross compilation. Portable kernels avoid
# try_run probes there (and don't accidentally enable SVE on Jetson).
set(GGML_NATIVE OFF CACHE BOOL "Portable helper CPU kernels" FORCE)
set(GGML_AVX512 OFF CACHE BOOL "Do not require AVX512 in the helper" FORCE)
# The helper runs on one GPU. CUDA development images may contain NCCL while
# the Jetson runtime image does not; never acquire that optional dependency.
# FORCE also repairs previously configured build caches that enabled it.
set(GGML_CUDA_NCCL OFF CACHE BOOL "BlueMagpie does not require multi-GPU collectives" FORCE)
set(GGML_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(GGML_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
include("${CMAKE_CURRENT_SOURCE_DIR}/patch.cmake")
add_subdirectory("${CODEC_SOURCE_DIR}" codec EXCLUDE_FROM_ALL)
add_executable(audiocpp-bluemagpie-worker worker.cpp)
target_link_libraries(audiocpp-bluemagpie-worker PRIVATE codec_tts_runner "${TTS_BACKBONE_SO}")
if(GGML_CUDA)
    # The backbone is a separate shared library, so its private CUDA-driver
    # link interface is not propagated here. Explicit linkage also resolves
    # cuMem*/cuDevice* against the toolkit stub during driver-less image builds.
    find_package(CUDAToolkit REQUIRED)
    target_link_libraries(codec_tts_runner INTERFACE CUDA::cuda_driver)
endif()
# codec.cpp owns its ggml; this executable never links audio.cpp's ggml.
set_target_properties(audiocpp-bluemagpie-worker PROPERTIES BUILD_RPATH "${CMAKE_BINARY_DIR}/ttsbackbone;${CMAKE_BINARY_DIR}/codec/ggml/src")
add_custom_command(TARGET audiocpp-bluemagpie-worker POST_BUILD
    COMMAND "${CMAKE_COMMAND}" -DWORKER=$<TARGET_FILE:audiocpp-bluemagpie-worker>
        -DBUILD_ROOT=${CMAKE_BINARY_DIR} -DOUTPUT_DIR=${WORKER_OUTPUT_DIR} -DCODEC_SOURCE_DIR=${CODEC_SOURCE_DIR}
        -P "${CMAKE_CURRENT_SOURCE_DIR}/stage.cmake")
