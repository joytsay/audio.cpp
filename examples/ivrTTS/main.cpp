#include "ivrTTS.h"
#include <fstream>
#include <iostream>
#include <string>

int main(int argc, char** argv) {
    if (argc < 2 || std::string(argv[1]) == "--help") {
        std::cout << "Usage:\n"
            "  ivrtts_cli run URL MODEL OUTPUT.wav TEXT [VOICE]\n"
            "  ivrtts_cli clone URL MODEL OUTPUT.wav TEXT REFERENCE.wav TRANSCRIPT\n"
            "  ivrtts_cli interactive URL MODEL [VOICE]\n";
        return argc < 2 ? 1 : 0;
    }
    try {
        const std::string command = argv[1];
        ivrTTS client;
        auto save = [](const std::string& path, const auto& bytes) {
            std::ofstream file(path, std::ios::binary);
            if (!file || !file.write(reinterpret_cast<const char*>(bytes.data()), bytes.size()))
                throw std::runtime_error("cannot write output: " + path);
            file.close();
            if (!file) throw std::runtime_error("cannot finish output: " + path);
            std::cout << "Saved " << bytes.size() << " bytes to " << path << '\n';
        };
        if (command == "run" && (argc == 6 || argc == 7)) {
            client.create(argv[2], argv[3], argc == 7 ? argv[6] : "");
            save(argv[4], client.run(argv[5]));
        } else if (command == "clone" && argc == 8) {
            client.create(argv[2], argv[3]);
            save(argv[4], client.clone(argv[5], argv[6], argv[7]));
        } else if (command == "interactive" && (argc == 4 || argc == 5)) {
            const std::string voice = argc == 5 ? argv[4] : "";
            client.create(argv[2], argv[3], voice);
            auto read = [](const char* prompt, std::string& value) {
                std::cout << prompt << std::flush;
                return bool(std::getline(std::cin, value));
            };
            std::string action, text, output, reference, transcript;
            while (read("Command (run/clone/create/del/quit): ", action)) {
                try {
                    if (action == "quit") break;
                    if (action == "del") { client.del(); continue; }
                    if (action == "create") { client.create(argv[2], argv[3], voice); continue; }
                    if (action != "run" && action != "clone") {
                        std::cout << "Unknown command\n"; continue;
                    }
                    if (!read("Text: ", text) || !read("Output WAV: ", output)) break;
                    if (action == "run") save(output, client.run(text));
                    else {
                        if (!read("Reference WAV: ", reference) || !read("Reference transcript: ", transcript)) break;
                        save(output, client.clone(text, reference, transcript));
                    }
                } catch (const std::exception& error) { std::cerr << error.what() << '\n'; }
            }
        } else throw std::runtime_error("invalid arguments; use --help");
        client.del();
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n'; return 1;
    }
}
