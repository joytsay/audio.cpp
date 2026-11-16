file(MAKE_DIRECTORY "${OUTPUT_DIR}")
file(COPY "${WORKER}" DESTINATION "${OUTPUT_DIR}")
# Keep dependencies together and preserve their versioned sonames.
file(GLOB_RECURSE libs "${BUILD_ROOT}/*.so" "${BUILD_ROOT}/*.so.*" "${BUILD_ROOT}/*.dylib")
foreach(lib IN LISTS libs)
    file(COPY "${lib}" DESTINATION "${OUTPUT_DIR}")
endforeach()

# Inspect the staged ELF files rather than relying only on CMake flags. The
# codec and isolated backbone must both be independent of the build image's
# optional NCCL installation.
if(CMAKE_HOST_SYSTEM_NAME STREQUAL "Linux")
    find_program(BLUEMAGPIE_READELF NAMES readelf llvm-readelf REQUIRED)
    file(GLOB staged_files "${OUTPUT_DIR}/*")
    foreach(binary IN LISTS staged_files)
        if(IS_DIRECTORY "${binary}" OR IS_SYMLINK "${binary}")
            continue()
        endif()
        execute_process(COMMAND "${BLUEMAGPIE_READELF}" -d "${binary}"
            RESULT_VARIABLE status OUTPUT_VARIABLE dynamic ERROR_VARIABLE error)
        if(NOT status EQUAL 0)
            message(FATAL_ERROR "Cannot inspect BlueMagpie runtime dependency ${binary}: ${error}")
        endif()
        if(dynamic MATCHES "NEEDED[^\n]*libnccl")
            message(FATAL_ERROR "BlueMagpie runtime unexpectedly depends on NCCL: ${binary}. Reconfigure both backends with GGML_CUDA_NCCL=OFF.")
        endif()
    endforeach()
endif()

foreach(project codec ggml llama)
    if(project STREQUAL "codec")
        set(source "${CODEC_SOURCE_DIR}")
    elseif(project STREQUAL "ggml")
        set(source "${CODEC_SOURCE_DIR}/ggml")
    else()
        set(source "${CODEC_SOURCE_DIR}/common/third-party/llama.cpp")
    endif()
    file(MAKE_DIRECTORY "${OUTPUT_DIR}/licenses/${project}")
    file(COPY "${source}/LICENSE" DESTINATION "${OUTPUT_DIR}/licenses/${project}")
endforeach()
if(EXISTS "${CODEC_SOURCE_DIR}/common/third-party/llama.cpp/licenses")
    file(COPY "${CODEC_SOURCE_DIR}/common/third-party/llama.cpp/licenses/"
         DESTINATION "${OUTPUT_DIR}/licenses/llama/third-party")
endif()
