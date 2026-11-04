#pragma once
#include <cmath>
#include <cstdint>
#include <stdexcept>
#include <vector>

namespace engine::runtime {
// Sign-aware repetition penalty, matching transformers' RepetitionPenaltyLogitsProcessor.
// Each previously seen token is penalized once, including tokens in the prompt.
class GreedyTokenSelector {
public:
    GreedyTokenSelector(size_t vocab_size, const std::vector<int32_t> & prompt, float penalty = 1.0f)
        : seen_(vocab_size, false), penalty_(penalty) {
        if (!std::isfinite(penalty) || penalty < 1.0f)
            throw std::invalid_argument("Repetition penalty must be finite and at least 1");
        for (auto token : prompt) observe(token);
    }
    void observe(int32_t token) {
        if (token >= 0 && static_cast<size_t>(token) < seen_.size()) seen_[token] = true;
    }
    int32_t select(const std::vector<float> & logits) const {
        if (logits.empty()) throw std::runtime_error("Cannot select from empty decoder logits");
        auto score = [&](size_t i) {
            const float value = logits[i];
            return i < seen_.size() && seen_[i] ? (value < 0 ? value * penalty_ : value / penalty_) : value;
        };
        size_t best = 0;
        for (size_t i = 1; i < logits.size(); ++i) if (score(i) > score(best)) best = i;
        return static_cast<int32_t>(best);
    }
private:
    std::vector<bool> seen_;
    float penalty_;
};
}
