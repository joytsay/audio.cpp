# Apply one explicit limit to the helper and its nested backbone CMake build.
# 0 selects the caller's environment, then the available processor count.
if(NOT DEFINED JOBS OR JOBS STREQUAL "0")
    if(DEFINED ENV{CMAKE_BUILD_PARALLEL_LEVEL} AND NOT "$ENV{CMAKE_BUILD_PARALLEL_LEVEL}" STREQUAL "")
        set(JOBS "$ENV{CMAKE_BUILD_PARALLEL_LEVEL}")
    else()
        include(ProcessorCount)
        ProcessorCount(JOBS)
        if(NOT JOBS)
            set(JOBS 1)
        endif()
    endif()
endif()
if(NOT JOBS MATCHES "^[1-9][0-9]*$")
    message(FATAL_ERROR "BlueMagpie build jobs must be a positive integer, or 0 for automatic selection")
endif()
message(STATUS "Building BlueMagpie backend with -j${JOBS}")
execute_process(
    COMMAND "${CMAKE_COMMAND}" -E env "CMAKE_BUILD_PARALLEL_LEVEL=${JOBS}"
        "${CMAKE_COMMAND}" --build "${BUILD_DIR}" --target audiocpp-bluemagpie-worker --parallel "${JOBS}"
    RESULT_VARIABLE status)
if(NOT status EQUAL 0)
    message(FATAL_ERROR "BlueMagpie backend build failed (${status})")
endif()
