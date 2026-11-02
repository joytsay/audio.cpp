#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <string>
#include <vector>

namespace engine::models::nemotron_asr {

inline std::string context_casefold(std::string text) {
    // Fold ASCII names/initials without changing UTF-8 bytes or output spelling.
    for (char & c : text) if (c >= 'A' && c <= 'Z') c += 'a' - 'A';
    return text;
}

// Context is a vocabulary list, not an instruction. Commas/newlines separate
// phrases; legacy "Technical terms: word word" lists use whitespace separators.
inline std::vector<std::string> context_phrases(std::string text) {
    for (const std::string delimiter : {"，", "、", "；"}) {
        size_t pos = 0;
        while ((pos = text.find(delimiter, pos)) != std::string::npos) {
            text.replace(pos, delimiter.size(), ",");
            ++pos;
        }
    }
    const std::string prefix = "technical terms:";
    if (context_casefold(text.substr(0, prefix.size())).compare(prefix) == 0) text.erase(0, prefix.size());
    const bool phrases = text.find_first_of(",;\r\n") != std::string::npos;
    std::vector<std::string> out;
    std::string item;
    auto flush = [&] {
        const auto first = item.find_first_not_of(" \t\r\n");
        if (first != std::string::npos) {
            auto value = item.substr(first, item.find_last_not_of(" \t\r\n") - first + 1);
            if (std::find(out.begin(), out.end(), value) == out.end()) out.push_back(std::move(value));
        }
        item.clear();
    };
    for (unsigned char c : text) {
        if (c == ',' || c == ';' || c == '\r' || c == '\n' || (!phrases && std::isspace(c))) flush();
        else item.push_back(static_cast<char>(c));
    }
    flush();
    return out;
}

// Match token surfaces rather than retokenizing terms: the RNNT can emit
// different BPE segmentations of the same term. State belongs to one utterance
// (and survives streaming chunks). Blanks never enter the text history.
class NemotronContextBias {
public:
    NemotronContextBias() = default;
    NemotronContextBias(std::vector<std::string> phrases, float score)
        : score_(score) {
        for (const auto & phrase : phrases) {
            if (phrase.empty()) continue;
            phrases_.push_back(context_casefold(phrase));
            phrases_.push_back(" " + context_casefold(phrase)); // SentencePiece word boundary.
            max_bytes_ = std::max(max_bytes_, phrase.size() + 1);
        }
    }

    int32_t select(const std::vector<float> & logits, const std::vector<std::string> & pieces,
                   int32_t original, int32_t blank) const {
        // Preserve the acoustic blank decision so a vocabulary list cannot turn
        // silence into words. Only competing speech tokens receive a bonus.
        if (original == blank || phrases_.empty() || score_ == 0.0f) return original;
        if (static_cast<size_t>(original) >= pieces.size() || pieces[original].empty()) return original;
        int32_t best = original;
        float best_score = logits.at(static_cast<size_t>(original));
        const size_t count = std::min(logits.size(), pieces.size());
        for (size_t id = 0; id < count; ++id) {
            if (static_cast<int32_t>(id) == blank || pieces[id].empty()) continue;
            if (logits[id] + score_ <= best_score) continue;
            const float candidate = logits[id] + (continues_phrase(context_casefold(pieces[id])) ? score_ : 0.0f);
            if (candidate > best_score) {
                best_score = candidate;
                best = static_cast<int32_t>(id);
            }
        }
        return best;
    }

    void advance(const std::string & piece) {
        if (phrases_.empty()) return;
        history_ += context_casefold(piece);
        if (history_.size() > max_bytes_) history_.erase(0, history_.size() - max_bytes_);
    }

private:
    bool continues_phrase(const std::string & piece) const {
        for (const auto & phrase : phrases_) {
            // Match every suffix, including overlapping phrases and alternative
            // token segmentations. A mismatch backs off to a fresh term prefix.
            const size_t limit = std::min(history_.size(), phrase.size() - 1);
            for (size_t prefix = 0; prefix <= limit; ++prefix) {
                if (piece.size() > phrase.size() - prefix) continue;
                if (history_.compare(history_.size() - prefix, prefix, phrase, 0, prefix) == 0 &&
                    phrase.compare(prefix, piece.size(), piece) == 0) return true;
            }
        }
        return false;
    }

    std::vector<std::string> phrases_;
    std::string history_;
    size_t max_bytes_ = 0;
    float score_ = 0.0f;
};

} // namespace engine::models::nemotron_asr
