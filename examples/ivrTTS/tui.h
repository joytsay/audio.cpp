#pragma once
#include <string>
int run_tui(const std::string& url, const std::string& model,
            const std::string& voices, int rate = 0, int channels = 1);
