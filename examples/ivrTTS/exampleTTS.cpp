#include "ivrTTS.h"
#include <iostream>
#include <vector>

int main() {
    try {
        ivrTTS tts;

        // Run from examples/ivrTTS, or replace this with an absolute path.
        tts.set_preset_directory("voices");

        tts.create(
            "http://192.168.5.151:8081",
            "zipvoice",
            "lingCL"  // Use "WangSG" for the other voice.
        );

        std::vector<unsigned char> wav =
            tts.run("Hello from our application.");

        // Send wav.data() and wav.size() to a WAV decoder,
        // a network response, or another application component.
        std::cout << "Received " << wav.size() << " WAV bytes\n";

        tts.del();
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
