# Separate CMake build and process: the published Barbet GGUF needs patched
# llama.cpp, and both upstream projects use ggml with incompatible ABIs.
include(ExternalProject)
set(AUDIOCPP_BLUEMAGPIE_CODEC_SOURCE "" CACHE PATH "Existing pinned codec.cpp checkout (with submodules); empty downloads it")
set(AUDIOCPP_BLUEMAGPIE_BUILD_JOBS 0 CACHE STRING "BlueMagpie compiler jobs; 0 inherits CMAKE_BUILD_PARALLEL_LEVEL or uses the processor count")
set(_bm_source "${AUDIOCPP_BLUEMAGPIE_CODEC_SOURCE}")
if(NOT _bm_source)
    set(_bm_source "${CMAKE_BINARY_DIR}/bluemagpie-codec-src")
    ExternalProject_Add(bluemagpie_codec_source
        DOWNLOAD_COMMAND ${CMAKE_COMMAND} -DSOURCE_DIR=${_bm_source}
            -DREVISION=d5e385229ea5a0f48fff696fed4699a852aa43b7
            -P ${CMAKE_CURRENT_SOURCE_DIR}/tools/bluemagpie/fetch.cmake
        SOURCE_DIR "${_bm_source}"
        CONFIGURE_COMMAND "" BUILD_COMMAND "" INSTALL_COMMAND "" UPDATE_COMMAND "")
    set(_bm_dep bluemagpie_codec_source)
endif()
set(_bm_args "")
foreach(backend CUDA HIP VULKAN METAL)
    list(APPEND _bm_args -DGGML_${backend}=${ENGINE_ENABLE_${backend}})
endforeach()
foreach(option CMAKE_C_COMPILER CMAKE_CXX_COMPILER CMAKE_C_COMPILER_LAUNCHER CMAKE_CXX_COMPILER_LAUNCHER CMAKE_CUDA_COMPILER_LAUNCHER CMAKE_TOOLCHAIN_FILE CMAKE_CUDA_COMPILER CMAKE_CUDA_ARCHITECTURES CMAKE_OSX_ARCHITECTURES)
    if(DEFINED ${option})
        string(REPLACE ";" "|" _bm_value "${${option}}")
        list(APPEND _bm_args "-D${option}=${_bm_value}")
    endif()
endforeach()
ExternalProject_Add(bluemagpie_backend
    DEPENDS ${_bm_dep}
    SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/tools/bluemagpie"
    BINARY_DIR "${CMAKE_BINARY_DIR}/bluemagpie-backend"
    LIST_SEPARATOR |
    CMAKE_ARGS -DCODEC_SOURCE_DIR=${_bm_source} -DCMAKE_BUILD_TYPE=Release
        -DGGML_CUDA_NCCL=OFF
        -DWORKER_OUTPUT_DIR=${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/bluemagpie ${_bm_args}
    BUILD_COMMAND ${CMAKE_COMMAND} -DBUILD_DIR=<BINARY_DIR>
        -DJOBS=${AUDIOCPP_BLUEMAGPIE_BUILD_JOBS} -P ${CMAKE_CURRENT_SOURCE_DIR}/tools/bluemagpie/build.cmake
    INSTALL_COMMAND "" UPDATE_COMMAND ""
    BUILD_ALWAYS ON
    BUILD_BYPRODUCTS "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/bluemagpie/audiocpp-bluemagpie-worker")
add_dependencies(engine_model_bluemagpie bluemagpie_backend)
target_compile_definitions(engine_model_bluemagpie PRIVATE
    AUDIOCPP_BLUEMAGPIE_WORKER="${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/bluemagpie/audiocpp-bluemagpie-worker")
