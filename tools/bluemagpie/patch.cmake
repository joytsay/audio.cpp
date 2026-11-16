# Add BlueMagpie's reference-speaker prefix to the pinned upstream runner.
# The stock continuous-CFM path supports only a null speaker token.
set(header "${CODEC_SOURCE_DIR}/common/tts_runner.h")
set(source "${CODEC_SOURCE_DIR}/common/tts_runner.cpp")
file(READ "${header}" h)
if(NOT h MATCHES "bluemagpie_speaker_embedding")
    string(REPLACE "    std::string ref_text;" "    std::vector<float> bluemagpie_speaker_embedding; // projected centroid + learned speaker-token row\n    std::string ref_text;" h "${h}")
    if(NOT h MATCHES "bluemagpie_speaker_embedding")
        message(FATAL_ERROR "BlueMagpie runner header patch does not match pinned codec.cpp")
    endif()
    file(WRITE "${header}" "${h}")
endif()
file(READ "${source}" s)
if(NOT s MATCHES "a.bluemagpie_speaker_embedding")
    string(REPLACE "const std::vector<llama_token> toks = ch.type" "std::vector<llama_token> toks = ch.type" s "${s}")
    set(needle "        if (toks.empty()) continue;\n        if (n_past + (int32_t) toks.size() + 1 >= n_ctx)")
    set(replacement [=[        if (i == 0 && !a.bluemagpie_speaker_embedding.empty()) {
            if (toks.empty() || std::string(llama_vocab_get_text(vocab, toks.front())) != "<|bm_spk|>" ||
                a.bluemagpie_speaker_embedding.size() != (size_t)c.n_embd || n_seq != 1) {
                out->error = "BlueMagpie speaker prefix does not match the backbone prompt";
                return false;
            }
            if (!decode_embd(lctx, a.bluemagpie_speaker_embedding.data(), c.n_embd, 1, 1, n_past)) {
                out->error = "BlueMagpie speaker-prefix decode failed";
                return false;
            }
            if (c.needs_prompt_hidden) {
                const float * hidden = llama_get_embeddings_ith(lctx, -1);
                if (!hidden) { out->error = "BlueMagpie speaker hidden state is missing"; return false; }
                prompt_hidden.insert(prompt_hidden.end(), hidden, hidden + c.n_embd);
            }
            ++n_past;
            toks.erase(toks.begin());
        }
        if (toks.empty()) continue;
        if (n_past + (int32_t) toks.size() + 1 >= n_ctx)]=])
    string(REPLACE "${needle}" "${replacement}" s "${s}")
    if(NOT s MATCHES "a.bluemagpie_speaker_embedding")
        message(FATAL_ERROR "BlueMagpie runner source patch does not match pinned codec.cpp")
    endif()
    file(WRITE "${source}" "${s}")
endif()

set(backbone_setup "${CODEC_SOURCE_DIR}/cmake/SetupTtsBackbone.cmake")
file(READ "${backbone_setup}" setup)
if(NOT setup MATCHES "CMAKE_CUDA_COMPILER_LAUNCHER")
    string(REPLACE "CMAKE_C_COMPILER_LAUNCHER CMAKE_CXX_COMPILER_LAUNCHER"
        "CMAKE_C_COMPILER_LAUNCHER CMAKE_CXX_COMPILER_LAUNCHER CMAKE_CUDA_COMPILER_LAUNCHER"
        setup "${setup}")
    if(NOT setup MATCHES "CMAKE_CUDA_COMPILER_LAUNCHER")
        message(FATAL_ERROR "BlueMagpie backbone compiler-launcher patch does not match pinned codec.cpp")
    endif()
    file(WRITE "${backbone_setup}" "${setup}")
endif()
