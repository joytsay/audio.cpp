#include "engine/models/nemotron_asr/context_bias.h"

#include <iostream>
#include <stdexcept>

using namespace engine::models::nemotron_asr;
void require(bool ok, const char * message) {
    if (!ok) throw std::runtime_error(message);
}
int main() {
    const std::vector<std::string> pieces{"", " other", " Geo", "Vision", "George", "維", "修", " wrong", " GeoVision"};
    std::vector<float> logits(pieces.size(), -20.0f);
    logits[1] = 4.0f;
    logits[2] = 3.0f;
    logits[4] = 2.5f;
    NemotronContextBias bias({"GeoVision", "維修"}, 2.0f);
    require(bias.select(logits, pieces, 1, 0) == 2, "context must change a competing speech token");
    require(bias.select(logits, pieces, 0, 0) == 0, "blank must remain blank");
    auto special_pieces = pieces;
    special_pieces[1].clear();
    require(bias.select(logits, special_pieces, 1, 0) == 1, "special/language tokens must remain unchanged");
    NemotronContextBias disabled({"GeoVision"}, 0.0f), empty({}, 2.0f);
    require(disabled.select(logits, pieces, 1, 0) == 1, "zero score must preserve original token");
    require(empty.select(logits, pieces, 1, 0) == 1, "empty context must preserve original token");
    bias.advance(" Geo");
    logits.assign(pieces.size(), -20.0f);
    logits[7] = 4; logits[3] = 3;
    require(bias.select(logits, pieces, 7, 0) == 3, "phrase continuation across streaming chunks");
    NemotronContextBias other_stream({"GeoVision"}, 2.0f);
    require(other_stream.select(logits, pieces, 7, 0) == 7, "context history must be stream-local");
    bias.advance("Vision");
    require(bias.select(logits, pieces, 7, 0) == 7, "completed phrases must not repeat their suffix");
    bias.advance(" wrong");
    logits.assign(pieces.size(), -20.0f); logits[1] = 4; logits[8] = 3;
    require(bias.select(logits, pieces, 1, 0) == 8, "alternative BPE segmentation and mismatch backoff");
    logits.assign(pieces.size(), -20.0f); logits[1] = 4; logits[5] = 3;
    require(bias.select(logits, pieces, 1, 0) == 5, "UTF-8 term start");
    bias.advance("維");
    logits[5] = -20; logits[6] = 3;
    require(bias.select(logits, pieces, 1, 0) == 6, "UTF-8 term continuation");
    require(context_phrases("Technical terms: 維修 保養 VFD FAN SN").size() == 5, "legacy hotword CSV format");
    require(context_phrases("GeoVision, Jane Smith\n維修;GeoVision") ==
        std::vector<std::string>({"GeoVision", "Jane Smith", "維修"}), "phrase delimiters and deduplication");
    require(context_phrases(" \t\n").empty(), "empty lists must be ignored");
    // Nemotron's real vocabulary has a word-boundary lowercase x (id 12972),
    // uppercase X (394), 光 (6999), 机 (5834), 機 (7260), and no ▁X token.
    const std::vector<std::string> xray_pieces{"", " S", " x", "光", "机", "機", "关"};
    NemotronContextBias xray({"X光機", "X光机"}, 6.0f);
    std::vector<float> xray_logits{0, 8, 3, -20, -20, -20, -20};
    require(xray.select(xray_logits, xray_pieces, 1, 0) == 2,
        "X光機 must boost the real lowercase word-boundary x token");
    NemotronContextBias weak_xray({"X光機", "X光机"}, 2.0f);
    require(weak_xray.select(xray_logits, xray_pieces, 1, 0) == 1,
        "a weak score need not overcome the acoustic margin");
    xray.advance(" x");
    xray_logits = {0, -20, -20, 3, -20, -20, 8};
    require(xray.select(xray_logits, xray_pieces, 6, 0) == 3, "光 must follow lowercase x");
    xray.advance("光");
    xray_logits = {0, -20, -20, -20, 3, 2, 8};
    require(xray.select(xray_logits, xray_pieces, 6, 0) == 4, "Simplified alias must complete X光机");
    require(context_phrases("X光機，T5、維修；FAN") ==
        std::vector<std::string>({"X光機", "T5", "維修", "FAN"}), "Chinese list separators");
    std::cout << "PASS: terminology changes token selection; blank/disabled parity; streaming state; phrase backoff; UTF-8; list parsing\n";
}
