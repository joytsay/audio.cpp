cmake_minimum_required(VERSION 3.16)
project(ivrTTS VERSION 1.0 LANGUAGES CXX)
find_package(CURL REQUIRED)
add_library(ivrTTS ivrTTS.cpp)
target_compile_features(ivrTTS PUBLIC cxx_std_17)
target_include_directories(ivrTTS PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}>
    $<INSTALL_INTERFACE:include>)
target_link_libraries(ivrTTS PUBLIC CURL::libcurl)
add_executable(ivrtts_cli main.cpp)
target_link_libraries(ivrtts_cli PRIVATE ivrTTS)
include(GNUInstallDirs)
install(TARGETS ivrTTS ivrtts_cli
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(FILES ivrTTS.h DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
