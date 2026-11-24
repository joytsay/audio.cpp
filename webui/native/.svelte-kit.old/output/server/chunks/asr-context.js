import { af as ssr_context } from "./index.js";
import "clsx";
import * as ToSimplified from "opencc-js/t2cn";
import * as ToTraditional from "opencc-js/cn2t";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
async function tick() {
}
const family$25 = "ace_step";
const display_name$25 = "ACE-Step";
const description$25 = "Open-source ACE-Step 1.5 music generation model for text-to-music and lyrics-to-song workflows across 50+ languages, with editing routes such as cover generation, repainting, continuation, stem extraction, and vocal-to-BGM conversion.";
const category$25 = "audio_generation";
const status$25 = "supported";
const tasks$25 = ["music", "edit"];
const modes$25 = ["offline"];
const languages$25 = ["50+ languages"];
const capabilities$25 = { "music": ["lyrics"], "edit": ["prompt_editing"] };
const runtime$25 = { "tags": ["gguf"] };
const options$25 = { "request": [{ "name": "route", "type": "enum", "values": ["text2music", "complete", "lego", "extract", "cover", "cover-nofsq", "repaint"], "description": "Generation or editing route.", "required": false, "default": "text2music" }, { "name": "lyrics", "type": "string", "description": "Vocal lyrics.", "required": false }, { "name": "language", "type": "string", "description": "Vocal language; falls back to text input language, then en.", "required": false }, { "name": "duration_sec", "type": "float", "description": "Target seconds; non-positive lets the planner choose. Source-locked routes use source duration.", "required": false, "default": -1 }, { "name": "seed", "type": "int", "description": "Unsigned 32-bit generation seed; random when omitted.", "required": false }, { "name": "negative_prompt", "type": "string", "description": "Negative prompt.", "required": false, "default": "NO USER INPUT" }, { "name": "bpm", "type": "int", "description": "Override planner BPM metadata.", "required": false }, { "name": "keyscale", "type": "string", "description": "Override planner musical key metadata.", "required": false }, { "name": "timesignature", "type": "string", "description": "Override planner time signature metadata.", "required": false }, { "name": "num_inference_steps", "type": "int", "description": "Denoising steps; turbo checkpoints cap this at 8.", "required": false, "default": 8 }, { "name": "guidance_scale", "type": "float", "description": "Diffusion CFG; default 1, or 7 for extract. Ignored by turbo checkpoints.", "required": false }, { "name": "sampler_mode", "type": "enum", "values": ["euler", "heun"], "description": "Diffusion sampler.", "required": false, "default": "euler" }, { "name": "shift", "type": "float", "description": "Diffusion schedule shift; default 1, or 3 for extract.", "required": false }, { "name": "enable_thinking", "type": "bool", "description": "Enable planner thinking where the route and checkpoint support it.", "required": false, "default": true }, { "name": "lm_temperature", "type": "float", "description": "Planner sampling temperature.", "required": false, "default": 0.85 }, { "name": "lm_guidance_scale", "type": "float", "description": "Planner CFG, independent of diffusion guidance.", "required": false, "default": 2 }, { "name": "lm_top_k", "type": "int", "description": "Planner top-k; 0 disables it.", "required": false, "default": 0 }, { "name": "lm_top_p", "type": "float", "description": "Planner nucleus sampling threshold.", "required": false, "default": 0.9 }, { "name": "lm_repetition_penalty", "type": "float", "description": "Planner repetition penalty.", "required": false, "default": 1 }, { "name": "track_name", "type": "string", "description": "Target track for lego or extract.", "required": false }, { "name": "complete_track_classes", "type": "string", "description": "Track class or JSON array of classes for complete.", "required": false }, { "name": "repainting_start", "type": "float", "description": "Repaint start in seconds; required by repaint route.", "required": false }, { "name": "repainting_end", "type": "float", "description": "Repaint end in seconds; required by repaint route.", "required": false }, { "name": "repaint_mode", "type": "enum", "values": ["balanced", "conservative", "aggressive"], "description": "Repaint blend preset; balanced when only strength is supplied.", "required": false }, { "name": "repaint_strength", "type": "float", "description": "Balanced repaint strength, clamped to 0..1; default 0.5 when a preset is supplied.", "required": false }, { "name": "audio_cover_strength", "type": "float", "description": "Cover conditioning strength.", "required": false, "default": 1 }, { "name": "cover_noise_strength", "type": "float", "description": "Cover conditioning noise strength.", "required": false, "default": 0 }, { "name": "retake_seed", "type": "int", "description": "Optional retake seed; -1 clears it.", "required": false }, { "name": "retake_variance", "type": "float", "description": "Retake noise mixing strength.", "required": false, "default": 0 }, { "name": "audio_codes", "type": "string", "description": "ACE semantic code text to bypass planner generation.", "required": false }], "session": [{ "name": "lora", "type": "string", "description": "DiT decoder LoRA/LoKr adapter file or PEFT directory, merged during weight loading.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Adapter strength multiplied by its metadata scale; zero disables the adapter.", "required": false, "default": 1 }, { "name": "weight_type", "type": "enum", "preset": "weight_type_full", "description": "Shared weight storage type.", "required": false, "default": "native" }, { "name": "dit_weight_type", "type": "enum", "preset": "weight_type_full", "description": "DiT override of weight_type; f16 is promoted to bf16.", "required": false }, { "name": "dit_attention", "type": "enum", "values": ["auto", "eager", "flash"], "description": "DiT attention; auto selects flash on supported GPUs and eager on CPU.", "required": false, "default": "auto" }, { "name": "planner_weight_type", "type": "enum", "preset": "weight_type_full", "description": "Planner override of weight_type.", "required": false }, { "name": "planner_prefix_bucketing", "type": "bool", "description": "Bucket planner CFG attention to the valid prefix; false uses full cache capacity.", "required": false, "default": true }, { "name": "planner_fused_projections", "type": "bool", "description": "CUDA packed QKV and gate/up projections with fused SwiGLU; may change generated codes. Off unless enabled by cuda_perf; explicit values override the preset.", "required": false }, { "name": "planner_f16_decode", "type": "bool", "description": "CUDA F16 KV and bucketed decoding for metadata and CFG-off codes. CFG-on code decoding already uses F16 KV. May change generated codes. Off unless enabled by cuda_perf; explicit values override the preset.", "required": false }, { "name": "planner_independent_cfg_prefill", "type": "bool", "description": "CUDA CFG prefill at each branch's actual prompt length instead of shared left padding; may change generated codes. Off unless enabled by cuda_perf; explicit values override the preset.", "required": false }, { "name": "text_encoder_weight_type", "type": "enum", "preset": "weight_type_full", "description": "Text encoder override of weight_type.", "required": false }, { "name": "vae_weight_type", "type": "enum", "preset": "weight_type_full", "description": "VAE override of weight_type.", "required": false }, { "name": "perf_mode", "type": "enum", "values": ["off", "cuda_perf"], "description": "Performance preset; cuda_perf enables CUDA planner fused projections, F16 decode and independent CFG prefill, and VAE tiles of 1024 frames with 64-frame overlap per side. Can change generated codes and VRAM; does not change weight precision. Explicit options override the preset.", "required": false, "default": "off" }, { "name": "vae_tile_frames", "type": "int", "description": "VAE tile capacity in latent frames. Unset keeps backend defaults; 1024 with cuda_perf. Explicit values override the preset.", "required": false, "min": 1 }, { "name": "vae_tile_overlap_frames", "type": "int", "description": "VAE overlap per side in latent frames; must be non-negative and less than half the tile capacity. Unset uses backend defaults; 64 with cuda_perf. Explicit values override the preset.", "required": false, "min": 0 }, { "name": "mem_saver", "type": "bool", "description": "Release staged graphs and caches between phases; later requests may rebuild them.", "required": false, "default": false }], "load": [{ "name": "dit_model_path", "type": "enum", "values": ["acestep-v15-turbo", "acestep-v15-base", "acestep-v15-xl-turbo", "acestep-v15-xl-sft"], "description": "DiT variant in the package; must be installed. Omitted selects from the model filename, falling back to acestep-v15-turbo.", "required": false, "default": "acestep-v15-turbo" }] };
const ui$25 = { "recommended_package": "ace_step_turbo_bf16", "tags": ["Music", "Edit", "GGUF"], "docs": ["docs/models/ace_step.md", "docs/music_generation.md", "docs/gguf.md"] };
const package_defaults$1O = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$26 = [{ "id": "ace_step_turbo_q8_0", "display_name": "ACE-Step 1.5 Turbo Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/turbo/ace-step-1.5-turbo-q8_0.gguf"], "strip_prefix": "ACE-Step1.5-GGUF" }, { "id": "ace_step_turbo_bf16", "display_name": "ACE-Step 1.5 Turbo BF16 GGUF", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/turbo/ace-step-1.5-turbo-bf16.gguf"], "strip_prefix": "ACE-Step1.5-GGUF" }, { "id": "ace_step_base_q8_0", "display_name": "ACE-Step 1.5 Base Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/base/ace-step-1.5-base-q8_0.gguf"], "strip_prefix": "ACE-Step1.5-GGUF" }, { "id": "ace_step_base_bf16", "display_name": "ACE-Step 1.5 Base BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/base/ace-step-1.5-base-bf16.gguf"], "strip_prefix": "ACE-Step1.5-GGUF" }, { "id": "ace_step_xl_turbo_bf16", "display_name": "ACE-Step 1.5 XL Turbo BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/xl-turbo/ace-step-1.5-xl-turbo-bf16.gguf"], "strip_prefix": "ACE-Step1.5-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "CaptainArni/audio.cpp-gguf" } }, { "id": "ace_step_xl_sft_bf16", "display_name": "ACE-Step 1.5 XL SFT BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/xl-sft/ace-step-1.5-xl-sft-bf16.gguf"], "strip_prefix": "ACE-Step1.5-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "CaptainArni/audio.cpp-gguf" } }, { "id": "ace_step_xl_turbo_q8dit", "display_name": "ACE-Step 1.5 XL Turbo Q8_0 DiT GGUF (BF16 planner)", "format": "gguf", "precision": "q8_0", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/xl-turbo-q8dit/ace-step-1.5-xl-turbo-q8dit.gguf"], "strip_prefix": "ACE-Step1.5-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "CaptainArni/audio.cpp-gguf" } }, { "id": "ace_step_xl_sft_q8dit", "display_name": "ACE-Step 1.5 XL SFT Q8_0 DiT GGUF (BF16 planner)", "format": "gguf", "precision": "q8_0", "target_directory": "ACE-Step1.5-GGUF", "files": ["ACE-Step1.5-GGUF/xl-sft-q8dit/ace-step-1.5-xl-sft-q8dit.gguf"], "strip_prefix": "ACE-Step1.5-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "CaptainArni/audio.cpp-gguf" } }];
const sources$25 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "dit_turbo_config": "model:acestep-v15-turbo/config.json", "dit_base_config": "model:acestep-v15-base/config.json", "lm_config": "model:acestep-5Hz-lm-1.7B/config.json", "lm_tokenizer_config": "model:acestep-5Hz-lm-1.7B/tokenizer_config.json", "lm_vocab": "model:acestep-5Hz-lm-1.7B/vocab.json", "lm_merges": "model:acestep-5Hz-lm-1.7B/merges.txt", "lm_tokenizer_json": "model:acestep-5Hz-lm-1.7B/tokenizer.json", "lm_chat_template": "model:acestep-5Hz-lm-1.7B/chat_template.jinja", "text_encoder_config": "model:Qwen3-Embedding-0.6B/config.json", "text_encoder_tokenizer_config": "model:Qwen3-Embedding-0.6B/tokenizer_config.json", "text_encoder_vocab": "model:Qwen3-Embedding-0.6B/vocab.json", "text_encoder_merges": "model:Qwen3-Embedding-0.6B/merges.txt", "text_encoder_tokenizer_json": "model:Qwen3-Embedding-0.6B/tokenizer.json", "text_encoder_chat_template": "model:Qwen3-Embedding-0.6B/chat_template.jinja", "vae_config": "model:vae/config.json" }, "optional_files": { "dit_xl_turbo_config": "model:acestep-v15-xl-turbo/config.json", "dit_xl_sft_config": "model:acestep-v15-xl-sft/config.json" }, "optional_tensors": { "dit_xl_turbo_weights": { "source": "weights:", "prefix": "dit_xl_turbo_weights" }, "dit_xl_turbo_silence_latent": { "source": "weights:", "prefix": "dit_xl_turbo_silence_latent" }, "dit_xl_sft_weights": { "source": "weights:", "prefix": "dit_xl_sft_weights" }, "dit_xl_sft_silence_latent": { "source": "weights:", "prefix": "dit_xl_sft_silence_latent" } }, "tensors": { "dit_turbo_weights": { "source": "weights:", "prefix": "dit_turbo_weights" }, "dit_turbo_silence_latent": { "source": "weights:", "prefix": "dit_turbo_silence_latent" }, "dit_base_weights": { "source": "weights:", "prefix": "dit_base_weights" }, "dit_base_silence_latent": { "source": "weights:", "prefix": "dit_base_silence_latent" }, "lm_weights": { "source": "weights:", "prefix": "lm_weights" }, "text_encoder_weights": { "source": "weights:", "prefix": "text_encoder_weights" }, "vae_weights": { "source": "weights:", "prefix": "vae_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "dit_turbo_config": "model:acestep-v15-turbo/config.json", "dit_base_config": "model:acestep-v15-base/config.json", "lm_config": "model:acestep-5Hz-lm-1.7B/config.json", "lm_tokenizer_config": "model:acestep-5Hz-lm-1.7B/tokenizer_config.json", "lm_vocab": "model:acestep-5Hz-lm-1.7B/vocab.json", "lm_merges": "model:acestep-5Hz-lm-1.7B/merges.txt", "lm_tokenizer_json": "model:acestep-5Hz-lm-1.7B/tokenizer.json", "lm_chat_template": "model:acestep-5Hz-lm-1.7B/chat_template.jinja", "text_encoder_config": "model:Qwen3-Embedding-0.6B/config.json", "text_encoder_tokenizer_config": "model:Qwen3-Embedding-0.6B/tokenizer_config.json", "text_encoder_vocab": "model:Qwen3-Embedding-0.6B/vocab.json", "text_encoder_merges": "model:Qwen3-Embedding-0.6B/merges.txt", "text_encoder_tokenizer_json": "model:Qwen3-Embedding-0.6B/tokenizer.json", "text_encoder_chat_template": "model:Qwen3-Embedding-0.6B/chat_template.jinja", "vae_config": "model:vae/config.json" }, "optional_files": { "dit_xl_turbo_config": "model:acestep-v15-xl-turbo/config.json", "dit_xl_sft_config": "model:acestep-v15-xl-sft/config.json" }, "optional_tensors": { "dit_xl_turbo_weights": "model:acestep-v15-xl-turbo/model.safetensors.index.json", "dit_xl_turbo_silence_latent": "model:acestep-v15-xl-turbo/silence_latent.safetensors", "dit_xl_sft_weights": "model:acestep-v15-xl-sft/model.safetensors.index.json", "dit_xl_sft_silence_latent": "model:acestep-v15-xl-sft/silence_latent.safetensors" }, "tensors": { "dit_turbo_weights": "model:acestep-v15-turbo/model.safetensors", "dit_turbo_silence_latent": "model:acestep-v15-turbo/silence_latent.safetensors", "dit_base_weights": "model:acestep-v15-base/model.safetensors", "dit_base_silence_latent": "model:acestep-v15-base/silence_latent.safetensors", "lm_weights": "model:acestep-5Hz-lm-1.7B/model.safetensors", "text_encoder_weights": "model:Qwen3-Embedding-0.6B/model.safetensors", "vae_weights": "model:vae/diffusion_pytorch_model.safetensors" } }];
const __vite_glob_0_0 = {
  family: family$25,
  display_name: display_name$25,
  description: description$25,
  category: category$25,
  status: status$25,
  tasks: tasks$25,
  modes: modes$25,
  languages: languages$25,
  capabilities: capabilities$25,
  runtime: runtime$25,
  options: options$25,
  ui: ui$25,
  package_defaults: package_defaults$1O,
  packages: packages$26,
  sources: sources$25
};
const schema_version$1F = 1;
const family$24 = "apollo";
const display_name$24 = "Apollo";
const description$24 = "Band-sequence music restoration for compressed audio at 44.1 kHz.";
const category$24 = "audio_tools";
const status$24 = "supported";
const tasks$24 = ["s2s"];
const modes$24 = ["offline"];
const languages$24 = ["language_agnostic"];
const capabilities$24 = { "s2s": ["audio_enhancement"] };
const runtime$24 = { "tags": ["gguf"] };
const options$24 = { "request": [{ "name": "audio_chunk_duration_sec", "type": "float", "description": "Chunk duration in seconds; zero selects upstream whole-file inference. When enabled, the chunk sample count must exceed n_fft/2.", "min": 0, "default": 0, "required": false }, { "name": "audio_chunk_overlap_sec", "type": "float", "description": "Normalized linear crossfade duration; at most half the chunk duration.", "min": 0, "default": 1, "required": false }, { "name": "edge_pad_duration_sec", "type": "float", "description": "Surrounding audio inferred and discarded on each side of a chunk.", "min": 0, "default": 0, "required": false }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; native preserves the GGUF tensor types.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"] }], "load": [] };
const package_defaults$1N = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$25 = [{ "id": "apollo_orig", "display_name": "Apollo GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Apollo-GGUF", "files": ["Apollo-GGUF/apollo-orig.gguf"], "strip_prefix": "Apollo-GGUF" }];
const dependencies$1F = [];
const ui$24 = { "tags": ["GGUF"], "docs": [], "recommended_package": "apollo_orig" };
const sources$24 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" }, "frontend": { "source": "weights:", "prefix": "frontend" } } }];
const __vite_glob_0_1 = {
  schema_version: schema_version$1F,
  family: family$24,
  display_name: display_name$24,
  description: description$24,
  category: category$24,
  status: status$24,
  tasks: tasks$24,
  modes: modes$24,
  languages: languages$24,
  capabilities: capabilities$24,
  runtime: runtime$24,
  options: options$24,
  package_defaults: package_defaults$1N,
  packages: packages$25,
  dependencies: dependencies$1F,
  ui: ui$24,
  sources: sources$24
};
const schema_version$1E = 1;
const family$23 = "ast_audioset";
const display_name$23 = "AST AudioSet";
const description$23 = "MIT Audio Spectrogram Transformer for multi-label classification across 527 AudioSet sound classes.";
const category$23 = "speech_analysis";
const status$23 = "supported";
const tasks$23 = ["classify"];
const modes$23 = ["offline"];
const languages$23 = ["language_agnostic"];
const capabilities$23 = { "classify": ["scores"] };
const dependencies$1E = [];
const options$23 = { "request": [{ "name": "top_k", "type": "int", "description": "Number of highest-scoring AudioSet classes to return.", "required": false, "min": 1, "max": 527, "default": 10 }], "session": [{ "name": "attention", "type": "enum", "description": "Attention lowering; auto selects a supported fast path.", "values": ["auto", "flash", "eager"], "required": false, "default": "auto" }, { "name": "weight_type", "type": "enum", "description": "Weight storage override; native preserves the packaged tensor types.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_k"] }], "load": [] };
const package_defaults$1M = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const runtime$23 = { "tags": ["gguf"] };
const ui$23 = { "recommended_package": "ast_audioset_f32", "tags": ["Classify", "GGUF"], "docs": ["docs/models/ast_audioset.md"] };
const packages$24 = [{ "id": "ast_audioset_f32", "display_name": "AST AudioSet F32 GGUF", "format": "gguf", "precision": "f32", "default": true, "target_directory": "AST-AudioSet-GGUF", "files": ["AST-AudioSet-GGUF/ast-audioset-f32.gguf"], "strip_prefix": "AST-AudioSet-GGUF" }];
const sources$23 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "processor": "model:preprocessor_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "processor": "model:preprocessor_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_2 = {
  schema_version: schema_version$1E,
  family: family$23,
  display_name: display_name$23,
  description: description$23,
  category: category$23,
  status: status$23,
  tasks: tasks$23,
  modes: modes$23,
  languages: languages$23,
  capabilities: capabilities$23,
  dependencies: dependencies$1E,
  options: options$23,
  package_defaults: package_defaults$1M,
  runtime: runtime$23,
  ui: ui$23,
  packages: packages$24,
  sources: sources$23
};
const family$22 = "audio8_asr";
const display_name$22 = "Audio8-ASR-0.1B";
const description$22 = "Audio8-ASR-0.1B compact multilingual ASR (en/zh/yue/ja/ko/fr/de): Qwen3-ASR audio encoder with an MLP-tower adapter and an 8-layer Qwen2-style decoder. 30-second offline transcription windows. Checkpoint license: CC-BY-NC-4.0; GGUF conversion is local-only, no public redistribution is approved.";
const category$22 = "asr";
const status$22 = "community";
const tasks$22 = ["asr"];
const modes$22 = ["offline"];
const languages$22 = ["en", "zh", "yue", "ja", "ko", "fr", "de"];
const capabilities$22 = { "asr": [] };
const options$22 = { "request": [], "session": [{ "name": "repetition_penalty", "type": "float", "description": "Sign-aware repetition penalty to reduce decoder loops. Set 1 for original greedy decoding.", "required": false, "min": 1, "default": 1.1 }, { "name": "weight_type", "type": "enum", "description": "Decoder and adapter weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "audio_encoder_weight_type", "type": "enum", "description": "Audio encoder weight storage type (quantized storage is rejected for the encoder; already-quantized GGUF tensors load as native).", "values": ["native", "f32", "f16"], "required": false, "default": "native" }, { "name": "encoder_graph_arena_mb", "type": "int", "description": "Audio encoder graph arena size in MB. Must be positive; sufficient capacity depends on the graph.", "required": false, "min": 1, "default": 128 }, { "name": "projector_graph_arena_mb", "type": "int", "description": "Adapter (MLP tower + pooling + projector) graph arena size in MB. Must be positive; sufficient capacity depends on the graph.", "required": false, "min": 1, "default": 256 }, { "name": "prefill_graph_arena_mb", "type": "int", "description": "Decoder prefill graph arena size in MB. Must be positive; sufficient capacity depends on the graph.", "required": false, "min": 1, "default": 256 }, { "name": "decode_graph_arena_mb", "type": "int", "description": "Decoder step decode graph arena size in MB. Must be positive; sufficient capacity depends on the graph.", "required": false, "min": 1, "default": 256 }], "load": [] };
const runtime$22 = { "tags": ["gguf", "server", "cuda", "metal", "cpu"] };
const ui$22 = { "recommended_package": "audio8_asr_0_1b_q8_0", "tags": ["ASR", "GGUF"], "docs": ["docs/asr.md", "docs/models/audio8_asr.md"], "summary": "Audio8-ASR-0.1B compact multilingual offline transcription." };
const package_defaults$1L = { "download": { "kind": "unsupported", "reason": "CC-BY-NC-4.0 checkpoint: convert locally with audiocpp_gguf; no public audio.cpp GGUF distribution is approved." } };
const packages$23 = [{ "id": "audio8_asr_0_1b_q8_0", "display_name": "Audio8-ASR-0.1B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Audio8-ASR-0.1B-GGUF", "files": ["Audio8-ASR-0.1B-GGUF/audio8-asr-0.1b-q8_0.gguf"], "strip_prefix": "Audio8-ASR-0.1B-GGUF" }, { "id": "audio8_asr_0_1b_f16", "display_name": "Audio8-ASR-0.1B F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Audio8-ASR-0.1B-GGUF", "files": ["Audio8-ASR-0.1B-GGUF/audio8-asr-0.1b-f16.gguf"], "strip_prefix": "Audio8-ASR-0.1B-GGUF" }, { "id": "audio8_asr_0_1b_safetensors", "display_name": "Audio8-ASR-0.1B HF Safetensors", "format": "safetensors", "precision": "bfloat16", "target_directory": "Audio8-ASR-0.1B-hf", "files": ["config.json", "generation_config.json", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "Audio8/Audio8-ASR-0.1B", "revision": "main", "gated": false } }];
const sources$22 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json", "preprocessor_config": "model:preprocessor_config.json" }, "optional_files": { "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json", "preprocessor_config": "model:preprocessor_config.json" }, "optional_files": { "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_3 = {
  family: family$22,
  display_name: display_name$22,
  description: description$22,
  category: category$22,
  status: status$22,
  tasks: tasks$22,
  modes: modes$22,
  languages: languages$22,
  capabilities: capabilities$22,
  options: options$22,
  runtime: runtime$22,
  ui: ui$22,
  package_defaults: package_defaults$1L,
  packages: packages$23,
  sources: sources$22
};
const schema_version$1D = 1;
const family$21 = "audio8_tts";
const display_name$21 = "Audio8 TTS Preview 0.6B";
const description$21 = "Audio8 TTS Preview 0.6B DualAR text-to-speech model with expressive multilingual speech across yue, zh, nl, en, fr, de, it, ja, ko, pl, and es, automatic language handling, and rapid voice cloning from short reference samples.";
const category$21 = "tts";
const status$21 = "community";
const dependencies$1D = [];
const tasks$21 = ["tts", "clone"];
const modes$21 = ["offline", "streaming"];
const languages$21 = ["auto", "yue", "zh", "nl", "en", "fr", "de", "it", "ja", "ko", "pl", "es"];
const capabilities$21 = { "clone": ["speaker_reference"] };
const runtime$21 = { "tags": ["gguf", "stream"] };
const options$21 = { "request": [{ "name": "reference_text", "type": "string", "description": "Reference transcript used with speaker reference audio.", "required": false }, { "name": "multi_reference_cond", "type": "string", "description": 'Ordered Audio8 TTS reference conditioning pairs as a JSON array: [{"audio":"ref.wav","text":"transcript"}, ...].', "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum semantic tokens to generate; default 1024. Zero selects the default.", "required": false, "min": 0, "default": 1024 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per generated text chunk; default 200.", "required": false, "min": 1, "default": 200 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "preset": "text_chunk_mode_full", "required": false, "default": "word_budget" }, { "name": "top_p", "type": "float", "description": "Top-p sampling value in (0, 1]; default 0.8.", "required": false, "min": 0, "max": 1, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "Top-k sampling value; default 30.", "required": false, "min": 1, "default": 30 }, { "name": "temperature", "type": "float", "description": "Semantic-token sampling temperature in (0, 2); default 0.8.", "required": false, "min": 0, "max": 2, "default": 0.8 }, { "name": "seed", "type": "int", "description": "Sampling seed for reproducible output; omitted uses a random seed.", "required": false, "min": 0 }, { "name": "language", "type": "string", "description": "Language hint for Chinese-script normalization; Cantonese/yue preserves Traditional characters. Inherits structured transcript or voice language when provided.", "required": false }], "session": [{ "name": "mem_saver", "type": "bool", "description": "Release cached AR runtime graphs after each request; default false.", "required": false, "default": false }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; default 1.", "required": false, "min": 0, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "AR matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "codec_weight_type", "type": "enum", "description": "Codec conv/matmul weight storage type; default native.", "preset": "weight_type_codec_q8", "required": false, "default": "native" }, { "name": "ar_graph_arena_mb", "type": "int", "description": "AR runtime graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "ar_weight_context_mb", "type": "int", "description": "AR weight context size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "codec_graph_arena_mb", "type": "int", "description": "Codec encode/decode graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "codec_weight_context_mb", "type": "int", "description": "Codec weight context size in MiB; default 512.", "required": false, "min": 1, "default": 512 }], "load": [] };
const ui$21 = { "recommended_package": "audio8_tts_preview_0_6b_q8_0", "tags": ["TTS", "Clone"], "docs": ["docs/models/audio8_tts.md"] };
const package_defaults$1K = { "download": { "kind": "huggingface_snapshot", "repo": "js-byte/Audio8-TTS-Preview-0.6b-GGUF", "revision": "main", "gated": false } };
const packages$22 = [{ "id": "audio8_tts_preview_0_6b_q8_0", "display_name": "Audio8 TTS Preview 0.6B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Audio8-TTS-Preview-0.6B-GGUF", "files": ["audio8-tts-preview-0.6b-q8_0.gguf"] }];
const sources$21 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "codec_weights": { "source": "weights:", "prefix": "codec_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "model_weights": "model:model.safetensors", "codec_weights": "model:codec.safetensors" } }];
const __vite_glob_0_4 = {
  schema_version: schema_version$1D,
  family: family$21,
  display_name: display_name$21,
  description: description$21,
  category: category$21,
  status: status$21,
  dependencies: dependencies$1D,
  tasks: tasks$21,
  modes: modes$21,
  languages: languages$21,
  capabilities: capabilities$21,
  runtime: runtime$21,
  options: options$21,
  ui: ui$21,
  package_defaults: package_defaults$1K,
  packages: packages$22,
  sources: sources$21
};
const schema_version$1C = 1;
const family$20 = "audio_flamingo";
const display_name$20 = "Audio Flamingo 3 / Next / Music Flamingo";
const description$20 = "Audio Flamingo 3, Audio Flamingo Next, and Music Flamingo for transcription, captioning, and audio questions, with optional PEFT LoRA and SpotSound temporal grounding.";
const category$20 = "asr";
const status$20 = "supported";
const tasks$20 = ["asr"];
const modes$20 = ["offline"];
const languages$20 = ["en"];
const capabilities$20 = {};
const runtime$20 = { "tags": ["gguf"] };
const options$20 = { "request": [{ "name": "instruct", "type": "string", "default": "Transcribe the input speech.", "required": false, "description": "Question or instruction about the input audio." }, { "name": "template_name", "type": "enum", "values": ["default", "temporal_grounding"], "default": "default", "required": false, "description": "Prompt layout. temporal_grounding uses SpotSound timestamp-interleaved audio tokens and wraps instruct or text as an event query; requires Audio Flamingo 3 and at least one second of audio. Use with its matching adapter." }, { "name": "max_tokens", "type": "int", "min": 1, "required": false, "description": "Maximum generated response tokens. Defaults to checkpoint generation configuration (2048 fallback); prompt plus output budget must fit model positions." }, { "name": "do_sample", "type": "bool", "default": false, "required": false, "description": "Sample tokens instead of greedy decoding." }, { "name": "temperature", "type": "float", "default": 1, "required": false, "description": "Sampling temperature. Used only when do_sample=true; must be positive when sampling." }, { "name": "top_k", "type": "int", "default": 50, "required": false, "description": "Sampling candidate count; zero disables top-k filtering. Used only when sampling; nonpositive values disable top-k filtering." }, { "name": "top_p", "type": "float", "default": 1, "required": false, "description": "Nucleus sampling probability. Used only when sampling; zero is accepted and values >=1 disable nucleus filtering." }, { "name": "repetition_penalty", "type": "float", "default": 1, "required": false, "description": "Token repetition penalty. Must be positive." }, { "name": "seed", "type": "int", "default": 42, "required": false, "description": "Sampling seed. Parsed as a signed integer and converted to uint32." }], "session": [{ "name": "weight_type", "type": "enum", "preset": "weight_type_full", "default": "native", "required": false, "description": "Weight storage type; native preserves the packaged tensor types." }, { "name": "lora", "type": "path", "required": false, "description": "Matching PEFT LoRA adapter directory or checkpoint file; merged at session creation. Keep adapter_config.json beside the weights." }, { "name": "lora_scale", "type": "float", "default": 1, "required": false, "description": "Multiplier for the adapter's alpha/r scaling." }], "load": [] };
const package_defaults$1J = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Audio-Flamingo-GGUF", "revision": "main", "gated": false } };
const packages$21 = [{ "id": "audio_flamingo_next_q4_k", "display_name": "Audio Flamingo Next GGUF Q4_K", "default": true, "format": "gguf", "precision": "q4_k", "target_directory": "Audio-Flamingo-GGUF", "files": ["audio-flamingo-next-q4_k.gguf"] }, { "id": "audio_flamingo_next_q8_0", "display_name": "Audio Flamingo Next GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Audio-Flamingo-GGUF", "files": ["audio-flamingo-next-q8_0.gguf"] }, { "id": "audio_flamingo_next_bf16", "display_name": "Audio Flamingo Next GGUF BF16", "format": "gguf", "precision": "bf16", "target_directory": "Audio-Flamingo-GGUF", "files": ["audio-flamingo-next-bf16.gguf"] }, { "id": "audio_flamingo_3_q4_k", "display_name": "Audio Flamingo 3 GGUF Q4_K", "format": "gguf", "precision": "q4_k", "target_directory": "Audio-Flamingo-GGUF", "files": ["audio-flamingo-3-q4_k.gguf"] }, { "id": "audio_flamingo_3_q8_0", "display_name": "Audio Flamingo 3 GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Audio-Flamingo-GGUF", "files": ["audio-flamingo-3-q8_0.gguf"] }, { "id": "audio_flamingo_3_bf16", "display_name": "Audio Flamingo 3 GGUF BF16", "format": "gguf", "precision": "bf16", "target_directory": "Audio-Flamingo-GGUF", "files": ["audio-flamingo-3-bf16.gguf"] }, { "id": "music_flamingo_2601_q8_0", "display_name": "Music Flamingo 2601 GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Audio-Flamingo-GGUF", "files": ["music-flamingo-2601-q8_0.gguf"] }];
const dependencies$1C = [];
const ui$20 = { "tags": ["GGUF"], "docs": ["docs/models/audio_flamingo.md"], "recommended_package": "audio_flamingo_next_q4_k" };
const sources$20 = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "processor_config": "model:processor_config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "chat_template": "model:chat_template.jinja" }, "tensors": { "weights": { "source": "model:model.safetensors" } } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "processor_config": "model:processor_config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "chat_template": "model:chat_template.jinja" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_5 = {
  schema_version: schema_version$1C,
  family: family$20,
  display_name: display_name$20,
  description: description$20,
  category: category$20,
  status: status$20,
  tasks: tasks$20,
  modes: modes$20,
  languages: languages$20,
  capabilities: capabilities$20,
  runtime: runtime$20,
  options: options$20,
  package_defaults: package_defaults$1J,
  packages: packages$21,
  dependencies: dependencies$1C,
  ui: ui$20,
  sources: sources$20
};
const schema_version$1B = 1;
const family$1$ = "audiosr";
const display_name$1$ = "AudioSR";
const description$1$ = "AudioSR performs latent-diffusion audio super-resolution from an input waveform.";
const category$1$ = "audio_tools";
const status$1$ = "experimental";
const tasks$1$ = ["s2s"];
const modes$1$ = ["offline"];
const languages$1$ = ["auto"];
const runtime$1$ = { "tags": ["gguf", "cuda"] };
const capabilities$1$ = { "s2s": ["audio_enhancement"] };
const options$1$ = { "request": [{ "name": "num_inference_steps", "type": "int", "description": "DDIM inference steps. The uniform DDIM schedule must produce exactly this many timesteps; not every count is valid (e.g. 51 fails with 1000 diffusion timesteps).", "required": false, "min": 1, "max": 1e3, "default": 50 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale. Any finite value is accepted.", "required": false, "default": 3.5 }, { "name": "ddim_eta", "type": "float", "description": "DDIM eta; 1.0 matches the official AudioSR default. Must be nonnegative; there is no runtime upper bound.", "required": false, "min": 0, "default": 1 }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Long-audio chunk duration.", "required": false, "min": 1e-3, "default": 15 }, { "name": "audio_chunk_overlap_sec", "type": "float", "description": "Long-audio chunk overlap; must be smaller than audio_chunk_duration_sec, including after rounding to samples.", "required": false, "min": 0, "default": 2 }, { "name": "seed", "type": "int", "description": "Generation seed; omitted or negative values use the fixed seed 42, not a random seed. Zero is a fixed seed.", "required": false, "max": 2147483647, "default": 42 }], "session": [{ "name": "weight_type", "type": "enum", "description": "AudioSR weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }], "load": [] };
const package_defaults$1I = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$20 = [{ "id": "audiosr_basic_f32", "display_name": "AudioSR Basic F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "AudioSR-GGUF", "files": ["AudioSR-GGUF/audiosr-basic-f32.gguf"], "strip_prefix": "AudioSR-GGUF" }];
const dependencies$1B = [];
const ui$1$ = { "recommended_package": "audiosr_basic_f32", "tags": ["GGUF"], "docs": ["docs/models/audiosr.md", "docs/gguf.md"] };
const sources$1$ = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "tensors": { "weights": { "source": "weights:" }, "frontend": { "source": "weights:", "prefix": "frontend" } } }];
const __vite_glob_0_6 = {
  schema_version: schema_version$1B,
  family: family$1$,
  display_name: display_name$1$,
  description: description$1$,
  category: category$1$,
  status: status$1$,
  tasks: tasks$1$,
  modes: modes$1$,
  languages: languages$1$,
  runtime: runtime$1$,
  capabilities: capabilities$1$,
  options: options$1$,
  package_defaults: package_defaults$1I,
  packages: packages$20,
  dependencies: dependencies$1B,
  ui: ui$1$,
  sources: sources$1$
};
const schema_version$1A = 1;
const family$1_ = "auk";
const display_name$1_ = "AuK";
const description$1_ = "Tencent AuK base and AuK-Flash speech generation and editing models.";
const category$1_ = "tts";
const status$1_ = "experimental";
const tasks$1_ = ["tts", "clone", "edit"];
const modes$1_ = ["offline"];
const languages$1_ = ["auto"];
const runtime$1_ = { "tags": ["cuda", "gguf"] };
const ui$1_ = { "recommended_package": "auk_base_f32", "tags": ["TTS", "Edit"], "docs": ["docs/models/auk.md"] };
const capabilities$1_ = { "tts": ["speaker_reference"], "clone": ["speaker_reference"], "edit": ["prompt_editing"] };
const options$1_ = { "request": [{ "name": "instruct", "type": "string", "description": "TTS voice description. Without it, text carries the complete upstream instruction; editing instructions always go in text.", "required": false }, { "name": "duration_sec", "type": "float", "description": "Positive output duration in seconds. Required without reference audio; otherwise defaults to the valid reference duration.", "required": false }, { "name": "num_inference_steps", "type": "int", "description": "Euler sampling steps for AuK base; AuK-Flash always uses its fixed four-step schedule.", "required": false, "min": 1, "default": 32 }, { "name": "guidance_scale", "type": "float", "description": "Batched guidance strength for AuK base; AuK-Flash always disables classifier-free guidance.", "required": false, "default": 2 }, { "name": "sway_sampling_coef", "type": "float", "description": "Sway coefficient for AuK base; ignored by AuK-Flash.", "required": false, "default": -1 }, { "name": "seed", "type": "int", "description": "Nonnegative noise seed, or -1 for a random seed.", "required": false, "min": -1, "default": -1 }], "session": [{ "name": "variant", "type": "enum", "values": ["base", "flash"], "description": "AuK generation schedule; select flash with an AuK-Flash component.", "required": false, "default": "base" }, { "name": "model_gguf", "type": "string", "description": "AuK base or Flash generator GGUF relative to the model root; defaults to the selected variant's F32 file.", "required": false }, { "name": "qwen_gguf", "type": "string", "description": "Qwen2.5-Omni-3B conditioning GGUF relative to the model root.", "required": false, "default": "qwen2.5-omni-3b-bf16.gguf" }, { "name": "vae_gguf", "type": "string", "description": "AuK VAE GGUF relative to the model root.", "required": false, "default": "auk-vae-f32.gguf" }, { "name": "attention", "type": "enum", "values": ["auto", "flash", "eager"], "description": "Flow-model attention mode.", "required": false, "default": "auto" }, { "name": "mem_saver", "type": "bool", "description": "Release Qwen conditioning and generation weights between stages to reduce peak VRAM.", "required": false, "default": false }], "load": [] };
const dependencies$1A = [];
const package_defaults$1H = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/AuK-Base-and-Flash-GGUF", "revision": "main", "gated": false } };
const packages$1$ = [{ "id": "auk_base_f32", "display_name": "AuK Base F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "auk-base-f32.gguf"] }, { "id": "auk_base_f16", "display_name": "AuK Base F16", "format": "gguf", "precision": "f16", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "auk-base-f16.gguf"] }, { "id": "auk_base_q8_0", "display_name": "AuK Base Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "auk-base-q8_0.gguf"] }, { "id": "auk_flash_f32", "display_name": "AuK-Flash F32", "format": "gguf", "precision": "f32", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "auk-flash-f32.gguf"] }, { "id": "auk_flash_f16", "display_name": "AuK-Flash F16", "format": "gguf", "precision": "f16", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "auk-flash-f16.gguf"] }, { "id": "auk_flash_q8_0", "display_name": "AuK-Flash Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "auk-flash-q8_0.gguf"] }, { "id": "auk_qwen_bf16", "display_name": "AuK Qwen BF16", "format": "gguf", "precision": "bf16", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "qwen2.5-omni-3b-bf16.gguf"] }, { "id": "auk_qwen_q8_0", "display_name": "AuK Qwen Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "qwen2.5-omni-3b-q8_0.gguf"] }, { "id": "auk_vae_f32", "display_name": "AuK VAE F32", "format": "gguf", "precision": "f32", "target_directory": "AuK-Base-and-Flash-GGUF", "files": ["config/auk-base.yaml", "config/auk-flash.yaml", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "auk-vae-f32.gguf"] }];
const sources$1_ = [{ "format": "gguf", "roots": { "model": "." }, "files": { "base_config": "model:config/auk-base.yaml", "flash_config": "model:config/auk-flash.yaml", "tokenizer_json": "model:tokenizer/tokenizer.json", "tokenizer_config": "model:tokenizer/tokenizer_config.json" } }];
const __vite_glob_0_7 = {
  schema_version: schema_version$1A,
  family: family$1_,
  display_name: display_name$1_,
  description: description$1_,
  category: category$1_,
  status: status$1_,
  tasks: tasks$1_,
  modes: modes$1_,
  languages: languages$1_,
  runtime: runtime$1_,
  ui: ui$1_,
  capabilities: capabilities$1_,
  options: options$1_,
  dependencies: dependencies$1A,
  package_defaults: package_defaults$1H,
  packages: packages$1$,
  sources: sources$1_
};
const schema_version$1z = 1;
const family$1Z = "bluemagpie";
const display_name$1Z = "BlueMagpie-TTS";
const description$1Z = "Taiwanese Mandarin and mixed English TTS using Barbet + AudioVAE, 48 kHz output, speaker-reference cloning (no transcript), and streaming.";
const category$1Z = "tts";
const status$1Z = "supported";
const tasks$1Z = ["tts", "clone"];
const modes$1Z = ["offline", "streaming"];
const languages$1Z = ["zh", "en"];
const capabilities$1Z = { "clone": ["speaker_reference"] };
const dependencies$1z = [];
const options$1Z = { "request": [{ "name": "seed", "type": "int", "description": "Flow noise seed.", "default": 1234, "min": 0, "max": 2147483647, "required": false }, { "name": "num_inference_steps", "type": "int", "description": "CFM sampling steps.", "default": 10, "min": 1, "max": 100, "required": false }, { "name": "guidance_scale", "type": "float", "description": "CFM classifier-free guidance.", "default": 2, "min": 0, "max": 20, "required": false }, { "name": "stream_chunk_ms", "type": "int", "description": "Audio chunk duration while generation continues.", "default": 320, "min": 40, "max": 5e3, "required": false }, { "name": "segment_bytes", "type": "int", "description": "Sentence-aware UTF-8 segment budget; 0 disables segmentation.", "default": 240, "min": 0, "max": 4096, "required": false }], "session": [{ "name": "max_frames", "type": "int", "description": "Safety cap on generated latent patches per segment.", "default": 512, "min": 1, "max": 4096, "required": false }, { "name": "worker_path", "type": "path", "description": "Override the bundled BlueMagpie helper executable.", "required": false }], "load": [] };
const runtime$1Z = { "tags": ["gguf", "stream"] };
const ui$1Z = { "recommended_package": "bluemagpie_1b_q8_0", "tags": ["TTS", "Clone", "GGUF", "Stream"], "docs": ["docs/models/bluemagpie.md"] };
const package_defaults$1G = { "download": { "kind": "huggingface_snapshot", "repo": "BricksDisplay/BlueMagpie-TTS-GGUF", "revision": "main", "gated": false, "file_sources": { "embedding_model.ckpt": { "repo": "speechbrain/spkrec-ecapa-voxceleb", "path": "embedding_model.ckpt", "revision": "main" } } } };
const packages$1_ = [{ "id": "bluemagpie_1b_q8_0", "display_name": "BlueMagpie 1B Q8_0 + AudioVAE Q8_0", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "BlueMagpie-TTS-Q8_0", "files": ["BlueMagpie-Barbet-1B-q8_0.gguf", "BlueMagpie-AudioVAE-q8_0.gguf", "embedding_model.ckpt"] }, { "id": "bluemagpie_1b_q4_k_m", "display_name": "BlueMagpie 1B Q4_K_M + AudioVAE Q8_0", "default": false, "format": "gguf", "precision": "q4_k_m", "target_directory": "BlueMagpie-TTS-Q4_K_M", "files": ["BlueMagpie-Barbet-1B-q4_k_m.gguf", "BlueMagpie-AudioVAE-q8_0.gguf", "embedding_model.ckpt"] }, { "id": "bluemagpie_1b_q5_k_m", "display_name": "BlueMagpie 1B Q5_K_M + AudioVAE Q8_0", "default": false, "format": "gguf", "precision": "q5_k_m", "target_directory": "BlueMagpie-TTS-Q5_K_M", "files": ["BlueMagpie-Barbet-1B-q5_k_m.gguf", "BlueMagpie-AudioVAE-q8_0.gguf", "embedding_model.ckpt"] }, { "id": "bluemagpie_1b_q6_k", "display_name": "BlueMagpie 1B Q6_K + AudioVAE Q8_0", "default": false, "format": "gguf", "precision": "q6_k", "target_directory": "BlueMagpie-TTS-Q6_K", "files": ["BlueMagpie-Barbet-1B-q6_k.gguf", "BlueMagpie-AudioVAE-q8_0.gguf", "embedding_model.ckpt"] }, { "id": "bluemagpie_1b_f16", "display_name": "BlueMagpie 1B F16 + AudioVAE Q8_0", "default": false, "format": "gguf", "precision": "f16", "target_directory": "BlueMagpie-TTS-F16", "files": ["BlueMagpie-Barbet-1B-f16.gguf", "BlueMagpie-AudioVAE-q8_0.gguf", "embedding_model.ckpt"] }];
const sources$1Z = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "tensors": { "backbone": "weights:", "audiovae": "model:BlueMagpie-AudioVAE-q8_0.gguf" } }];
const __vite_glob_0_8 = {
  schema_version: schema_version$1z,
  family: family$1Z,
  display_name: display_name$1Z,
  description: description$1Z,
  category: category$1Z,
  status: status$1Z,
  tasks: tasks$1Z,
  modes: modes$1Z,
  languages: languages$1Z,
  capabilities: capabilities$1Z,
  dependencies: dependencies$1z,
  options: options$1Z,
  runtime: runtime$1Z,
  ui: ui$1Z,
  package_defaults: package_defaults$1G,
  packages: packages$1_,
  sources: sources$1Z
};
const schema_version$1y = 1;
const family$1Y = "breeze_tts";
const display_name$1Y = "BreezeTTS 2";
const description$1Y = "BreezeTTS 2 native GGUF package for instruction-conditioned text-to-speech and prompt-audio voice cloning with T5Gemma text conditioning, Qwen-style acoustic code generation, depth codebook decoding, and Mimi waveform decoding.";
const category$1Y = "tts";
const status$1Y = "supported";
const tasks$1Y = ["tts", "clone", "design"];
const modes$1Y = ["offline", "streaming"];
const languages$1Y = ["zh", "en"];
const runtime$1Y = { "tags": ["gguf"] };
const dependencies$1y = [];
const capabilities$1Y = { "design": ["voice_design"], "tts": ["style_control"], "clone": ["speaker_reference"] };
const options$1Y = { "request": [{ "name": "instruct", "type": "string", "description": "BreezeTTS generation instruction.", "required": false, "default": "Speak clearly and naturally." }, { "name": "reference_text", "type": "string", "description": "Transcript for prompt/reference audio; required when reference audio codes are used, for either tts or clon.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 600.", "required": false, "min": 1, "default": 600 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated BreezeTTS acoustic frames.", "required": false, "min": 1, "default": 1500 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale.", "required": false, "min": 0, "default": 1 }, { "name": "temperature", "type": "float", "description": "Backbone first-codebook sampling temperature. Must be > 0.", "required": false, "min": 0, "default": 0.9 }, { "name": "depth_temperature", "type": "float", "description": "Depth decoder codebook sampling temperature. Must be > 0.", "required": false, "min": 0, "default": 0.9 }, { "name": "top_k", "type": "int", "description": "Top-k sampling limit; 0 disables top-k filtering. Nonpositive values disable top-k filtering.", "required": false, "default": 50 }, { "name": "top_p", "type": "float", "description": "Positive nucleus sampling cutoff; values >=1 disable nucleus filtering.", "required": false, "min": 0, "default": 1 }, { "name": "seed", "type": "int", "description": "Generation seed.", "required": false, "min": 0, "default": 0 }, { "name": "stream_frames_per_event", "type": "int", "description": "Maximum generated codec frames per streaming audio event; fixed size with stream_chunk_policy=fixed.", "required": false, "min": 1, "default": 16 }, { "name": "stream_lookahead_margin", "type": "int", "description": "Additional trailing codec frames buffered before streaming emission. The decoder is causal; zero minimizes latency.", "required": false, "min": 0, "default": 0 }, { "name": "stream_chunk_policy", "type": "enum", "description": "Streaming chunk schedule: grow emits 1, 2, 4, ... frames up to stream_frames_per_event; fixed uses that size from the first event.", "values": ["grow", "fixed"], "required": false, "default": "grow" }], "session": [{ "name": "weight_type", "type": "enum", "description": "BreezeTTS matmul weight storage type; default native.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_k"] }, { "name": "graph_arena_mb", "type": "int", "description": "Reusable runtime graph arena size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "weight_context_mb", "type": "int", "description": "Weight loading context size in MiB; default 4.", "required": false, "min": 1, "default": 4 }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; set 0 to disable reuse.", "required": false, "min": 0, "default": 1 }, { "name": "attention", "type": "enum", "description": "Attention lowering; auto probes the backend and falls back to eager on GPUs without a flash kernel (e.g. sm70); default auto.", "required": false, "values": ["auto", "flash", "eager"], "default": "auto" }, { "name": "bf16_activations", "type": "enum", "description": "Reference bf16 activation rounding as the official BreezeTTS 2 inference does it. auto = on for CUDA/HIP/Vulkan and off on Metal, where the cast cost is visible even with the fused round-to-bf16 op (~20% slower AR loop); on/off force it either way. On Metal, on also switches the KV cache to bf16 to match the reference implementation.", "required": false, "values": ["auto", "on", "off"], "default": "auto" }, { "name": "perf_mode", "type": "enum", "description": "AR decode preset. off uses the normal defaults (fused_depth, direct_prefill and skip_cache_round enabled on CUDA, Vulkan and Metal); cuda_perf additionally enables batched_cfg on CUDA. Explicit session options override the preset.", "required": false, "values": ["off", "cuda_perf"], "default": "off" }, { "name": "fused_depth", "type": "bool", "description": "Decode each frame's depth codebooks in one backend graph with device-side CFG mixing and sampling. Device sampling uses the per-codebook path's torch random draws, so CUDA output normally matches it token for token. Vulkan/Metal sampling uses a different draw mapping. CUDA, Vulkan and Metal only.", "required": false, "default": true }, { "name": "direct_prefill", "type": "bool", "description": "Offline generation prefills the backbone straight into the decode cache, as streaming does, instead of exporting the KV state to the host and importing it back. Same computation. CUDA, Vulkan and Metal only.", "required": false, "default": true }, { "name": "skip_cache_round", "type": "bool", "description": "Skip re-rounding the F16 KV cache to bf16 after each update, which is an identity because the K/V rows are already bf16-rounded. Applies only with the bf16 reference path and flash attention. CUDA, Vulkan and Metal only.", "required": false, "default": true }, { "name": "round_bf16_fusion", "type": "bool", "description": "Fold the bf16 activation rounding into the CUDA RMS-norm, add and SwiGLU kernels that produce it. Bit-identical to the unfused graph, with fewer kernel launches. CUDA only.", "required": false, "default": false }, { "name": "batched_cfg", "type": "bool", "description": "With guidance_scale != 1, decode the conditional and unconditional backbone branches as one batch-2 step. Batching changes matmul accumulation order, so output differs from the two-runtime path. CUDA only.", "required": false, "default": false }], "load": [] };
const packages$1Z = [{ "id": "breeze_tts_2_q4_0", "display_name": "BreezeTTS 2 Q4_0 GGUF", "default": false, "format": "gguf", "precision": "q4_0", "target_directory": "Breeze-TTS-2-GGUF", "files": ["Breeze-TTS-2-GGUF/breeze-tts-2-q4_0.gguf"], "strip_prefix": "Breeze-TTS-2-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "breeze_tts_2_q8_0", "display_name": "BreezeTTS 2 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Breeze-TTS-2-GGUF", "files": ["Breeze-TTS-2-GGUF/breeze-tts-2-q8_0.gguf"], "strip_prefix": "Breeze-TTS-2-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "breeze_tts_2_bf16", "display_name": "BreezeTTS 2 BF16 GGUF", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "Breeze-TTS-2-GGUF", "files": ["Breeze-TTS-2-GGUF/breeze-tts-2-bf16.gguf"], "strip_prefix": "Breeze-TTS-2-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }];
const ui$1Y = { "recommended_package": "breeze_tts_2_q8_0", "tags": ["TTS", "Clone", "Design", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const sources$1Y = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config_json": "model:config.json", "audio_tokenizer_config_json": "model:audio_tokenizer/config.json", "tokenizer_config_json": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model" } } }];
const __vite_glob_0_9 = {
  schema_version: schema_version$1y,
  family: family$1Y,
  display_name: display_name$1Y,
  description: description$1Y,
  category: category$1Y,
  status: status$1Y,
  tasks: tasks$1Y,
  modes: modes$1Y,
  languages: languages$1Y,
  runtime: runtime$1Y,
  dependencies: dependencies$1y,
  capabilities: capabilities$1Y,
  options: options$1Y,
  packages: packages$1Z,
  ui: ui$1Y,
  sources: sources$1Y
};
const schema_version$1x = 1;
const family$1X = "bs_roformer";
const display_name$1X = "BS-RoFormer";
const description$1X = "Band-Split RoFormer music source-separation model that estimates vocals from explicit non-overlapping frequency bands and derives accompaniment from the input mixture.";
const category$1X = "audio_tools";
const status$1X = "supported";
const tasks$1X = ["sep"];
const modes$1X = ["offline"];
const languages$1X = ["language_agnostic"];
const capabilities$1X = { "sep": ["stems"] };
const options$1X = { "request": [], "session": [{ "name": "weight_type", "type": "enum", "description": "RoFormer weight storage type. Defaults to f32 when the backend requires a host graph plan, otherwise native.", "preset": "weight_type_full", "required": false }, { "name": "num_overlap", "type": "int", "description": "Number of overlapping inference windows; defaults to the package configuration. Lower values improve throughput but can reduce boundary quality.", "required": false, "min": 1 }], "load": [] };
const runtime$1X = { "tags": ["gguf"] };
const sources$1X = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const package_defaults$1F = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1Y = [{ "id": "bs_roformer_q8_0", "display_name": "BS-RoFormer ep368 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "BS-RoFormer-ep368-GGUF", "files": ["BS-RoFormer-ep368-GGUF/bs-roformer-ep368-q8_0.gguf"], "strip_prefix": "BS-RoFormer-ep368-GGUF" }];
const dependencies$1x = [];
const ui$1X = { "recommended_package": "bs_roformer_q8_0", "tags": ["Sep", "GGUF"], "docs": ["docs/audio_tools.md", "docs/gguf.md", "tests/bs_roformer/README.md"] };
const __vite_glob_0_10 = {
  schema_version: schema_version$1x,
  family: family$1X,
  display_name: display_name$1X,
  description: description$1X,
  category: category$1X,
  status: status$1X,
  tasks: tasks$1X,
  modes: modes$1X,
  languages: languages$1X,
  capabilities: capabilities$1X,
  options: options$1X,
  runtime: runtime$1X,
  sources: sources$1X,
  package_defaults: package_defaults$1F,
  packages: packages$1Y,
  dependencies: dependencies$1x,
  ui: ui$1X
};
const schema_version$1w = 1;
const family$1W = "builtin_audio_utils";
const display_name$1W = "Built-in Audio Utilities";
const description$1W = "Built-in denoise, enhancement, and audio super-resolution utilities with separately downloaded weights.";
const category$1W = "audio_tools";
const status$1W = "experimental";
const tasks$1W = ["s2s"];
const modes$1W = ["offline"];
const languages$1W = ["auto"];
const runtime$1W = { "tags": ["cpu", "cuda"] };
const capabilities$1W = { "s2s": ["audio_enhancement"] };
const options$1W = { "request": [], "session": [], "load": [{ "name": "utility", "type": "enum", "values": ["deepfilternet2", "rnnoise", "zipenhancer", "gtcrn", "gtcrn_streaming", "gtcrn_dns3", "gtcrn_vctk", "flashsr"], "required": true, "description": "Utility implementation to load from the model path." }] };
const packages$1X = [];
const dependencies$1w = [];
const ui$1W = { "tags": [], "docs": ["docs/audio_tools.md"] };
const sources$1W = [];
const __vite_glob_0_11 = {
  schema_version: schema_version$1w,
  family: family$1W,
  display_name: display_name$1W,
  description: description$1W,
  category: category$1W,
  status: status$1W,
  tasks: tasks$1W,
  modes: modes$1W,
  languages: languages$1W,
  runtime: runtime$1W,
  capabilities: capabilities$1W,
  options: options$1W,
  packages: packages$1X,
  dependencies: dependencies$1w,
  ui: ui$1W,
  sources: sources$1W
};
const family$1V = "canary_asr";
const schema_version$1v = 1;
const display_name$1V = "Canary 180M Flash";
const description$1V = "NVIDIA Canary multilingual speech recognition and speech translation.";
const category$1V = "asr";
const status$1V = "supported";
const tasks$1V = ["asr"];
const modes$1V = ["offline"];
const languages$1V = ["en", "de", "es", "fr"];
const capabilities$1V = {};
const dependencies$1v = [];
const options$1V = { "request": [{ "name": "language", "type": "string", "description": "Input audio language.", "required": false, "default": "en" }, { "name": "target_language", "type": "string", "description": "Output language: en, de, es, or fr. Defaults to the input language for transcription.", "required": false }, { "name": "punc", "type": "bool", "description": "Generate punctuation and capitalization.", "required": false, "default": true }, { "name": "max_tokens", "type": "int", "description": "Maximum generated tokens per chunk; zero uses the reference encoder-length-based limit.", "required": false, "min": 0, "max": 1015, "default": 0 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Long-form audio chunking mode.", "values": ["auto", "fixed", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum duration of each audio chunk in seconds.", "required": false, "min": 0.02, "max": 40, "default": 40 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Matmul weight storage type.", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"], "required": false, "default": "native" }], "load": [] };
const runtime$1V = { "tags": ["gguf", "cpu", "cuda"] };
const ui$1V = { "tags": ["ASR", "GGUF"], "docs": ["docs/models/canary_asr.md"], "recommended_package": "canary_180m_flash_f32" };
const package_defaults$1E = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1W = [{ "id": "canary_180m_flash_f32", "display_name": "Canary 180M Flash GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Canary-180M-Flash-GGUF", "files": ["Canary-180M-Flash-GGUF/canary-180m-flash-f32.gguf"], "strip_prefix": "Canary-180M-Flash-GGUF" }, { "id": "canary_180m_flash_q8_0", "display_name": "Canary 180M Flash GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Canary-180M-Flash-GGUF", "files": ["Canary-180M-Flash-GGUF/canary-180m-flash-q8_0.gguf"], "strip_prefix": "Canary-180M-Flash-GGUF" }];
const sources$1V = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_spl_tokens": "model:tokenizer_spl_tokens.model", "tokenizer_en": "model:tokenizer_en.model", "tokenizer_de": "model:tokenizer_de.model", "tokenizer_es": "model:tokenizer_es.model", "tokenizer_fr": "model:tokenizer_fr.model" }, "tensors": { "weights": "model:model.safetensors" } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_spl_tokens": "model:tokenizer_spl_tokens.model", "tokenizer_en": "model:tokenizer_en.model", "tokenizer_de": "model:tokenizer_de.model", "tokenizer_es": "model:tokenizer_es.model", "tokenizer_fr": "model:tokenizer_fr.model" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_12 = {
  family: family$1V,
  schema_version: schema_version$1v,
  display_name: display_name$1V,
  description: description$1V,
  category: category$1V,
  status: status$1V,
  tasks: tasks$1V,
  modes: modes$1V,
  languages: languages$1V,
  capabilities: capabilities$1V,
  dependencies: dependencies$1v,
  options: options$1V,
  runtime: runtime$1V,
  ui: ui$1V,
  package_defaults: package_defaults$1E,
  packages: packages$1W,
  sources: sources$1V
};
const schema_version$1u = 1;
const family$1U = "ced";
const display_name$1U = "CED Audio Tagging";
const description$1U = "Consistent Ensemble Distillation ViT audio classifiers for 527 AudioSet sound categories.";
const category$1U = "speech_analysis";
const status$1U = "supported";
const tasks$1U = ["classify"];
const modes$1U = ["offline"];
const languages$1U = ["language_agnostic"];
const capabilities$1U = { "classify": ["scores"] };
const runtime$1U = { "tags": ["gguf"] };
const options$1U = { "request": [{ "name": "top_k", "type": "int", "description": "Number of highest-scoring AudioSet categories returned.", "required": false, "default": 10, "min": 1, "max": 527 }], "session": [{ "name": "attention", "type": "enum", "description": "Attention implementation; auto selects a supported fast path.", "required": false, "default": "auto", "values": ["auto", "flash", "eager"] }, { "name": "weight_type", "type": "enum", "description": "Weight storage override; native preserves packaged tensor types.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_k"] }], "load": [] };
const package_defaults$1D = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1V = [{ "id": "ced_tiny_f32", "display_name": "CED Tiny F32 GGUF", "format": "gguf", "precision": "f32", "default": true, "target_directory": "CED-GGUF", "files": ["CED-GGUF/ced-tiny-f32.gguf"], "strip_prefix": "CED-GGUF" }, { "id": "ced_mini_f32", "display_name": "CED Mini F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "CED-GGUF", "files": ["CED-GGUF/ced-mini-f32.gguf"], "strip_prefix": "CED-GGUF" }, { "id": "ced_small_f32", "display_name": "CED Small F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "CED-GGUF", "files": ["CED-GGUF/ced-small-f32.gguf"], "strip_prefix": "CED-GGUF" }, { "id": "ced_base_f32", "display_name": "CED Base F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "CED-GGUF", "files": ["CED-GGUF/ced-base-f32.gguf"], "strip_prefix": "CED-GGUF" }];
const dependencies$1u = [];
const ui$1U = { "recommended_package": "ced_tiny_f32", "tags": ["Classify", "GGUF"], "docs": ["docs/models/ced.md"] };
const sources$1U = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "processor": "model:preprocessor_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "processor": "model:preprocessor_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_13 = {
  schema_version: schema_version$1u,
  family: family$1U,
  display_name: display_name$1U,
  description: description$1U,
  category: category$1U,
  status: status$1U,
  tasks: tasks$1U,
  modes: modes$1U,
  languages: languages$1U,
  capabilities: capabilities$1U,
  runtime: runtime$1U,
  options: options$1U,
  package_defaults: package_defaults$1D,
  packages: packages$1V,
  dependencies: dependencies$1u,
  ui: ui$1U,
  sources: sources$1U
};
const family$1T = "chatterbox";
const display_name$1T = "Chatterbox";
const description$1T = "Open-source Chatterbox family for expressive TTS and voice conversion, with emotion exaggeration control, fast generation, zero-shot voice cloning, and an integrated multilingual TTS path.";
const category$1T = "tts";
const status$1T = "supported";
const tasks$1T = ["tts", "clone", "vc"];
const modes$1T = ["offline"];
const languages$1T = ["ar", "da", "de", "el", "en", "es", "fi", "fr", "hi", "it", "ko", "ms", "nl", "no", "pl", "pt", "sv", "sw", "tr"];
const options$1T = { "request": [{ "name": "exaggeration", "type": "float", "description": "Emotion exaggeration. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": 0.5 }, { "name": "guidance_scale", "type": "float", "description": "T3 classifier-free guidance scale. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": 0.5 }, { "name": "temperature", "type": "float", "description": "T3 sampling temperature. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": 0.8 }, { "name": "repetition_penalty", "type": "float", "description": "T3 repetition penalty. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": 1.2 }, { "name": "min_p", "type": "float", "description": "Minimum sampling probability. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": 0.05 }, { "name": "top_p", "type": "float", "description": "Nucleus sampling probability. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": 1 }, { "name": "flow_guidance_scale", "type": "float", "description": "S3Gen flow guidance scale. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": 0.7 }, { "name": "max_tokens", "type": "int", "description": "Maximum generated speech tokens. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "min": 1, "default": 384 }, { "name": "do_sample", "type": "bool", "description": "Enable sampling. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": true }, { "name": "stop_on_eos", "type": "bool", "description": "Stop token generation on EOS. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "default": true }, { "name": "num_inference_steps", "type": "int", "description": "Voice conversion flow steps; max_steps is also accepted.", "required": false, "min": 1, "default": 10 }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted chooses a random seed. Captured during clone preparation; changing it on the same prepared session is rejected.", "required": false, "min": 0, "max": 4294967295 }, { "name": "source_audio", "type": "audio_path", "description": "Voice conversion source WAV path; overrides audio_input.", "required": false }, { "name": "target_voice", "type": "audio_path", "description": "Voice conversion target WAV path; overrides the speaker reference.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Framework long-form text chunk size.", "required": false, "default": 128 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; defaults to native.", "required": false, "preset": "weight_type_full" }, { "name": "t3_weight_type", "type": "enum", "description": "T3 weight storage; inherits weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "multilingual_t3", "type": "enum", "description": "Multilingual T3 checkpoint selection.", "required": false, "values": ["v2", "v3"], "default": "v2" }, { "name": "conditionals_cache_slots", "type": "int", "description": "Cached speaker conditionals; zero disables reuse.", "required": false, "min": 0, "default": 1 }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime components.", "required": false, "default": false }, { "name": "encoder_condition_samples", "type": "int", "description": "Maximum reference samples for the T3 tokenizer; the voice encoder still consumes the full 16 kHz reference.", "required": false, "default": 96e3 }, { "name": "decoder_condition_samples", "type": "int", "description": "S3Gen reference sample limit at 24 kHz.", "required": false, "default": 24e4 }, { "name": "t3_speech_cond_prompt_len", "type": "int", "description": "T3 reference speech prompt token limit.", "required": false, "default": 150 }], "load": [] };
const capabilities$1T = { "clone": ["speaker_reference"], "vc": ["speaker_reference"] };
const runtime$1T = { "tags": ["gguf"] };
const ui$1T = { "recommended_package": "chatterbox_q8_0", "tags": ["TTS", "Clone", "VC", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const package_defaults$1C = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1U = [{ "id": "chatterbox_q8_0", "display_name": "Chatterbox Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Chatterbox-GGUF", "files": ["Chatterbox-GGUF/chatterbox-q8_0.gguf"], "strip_prefix": "Chatterbox-GGUF" }, { "id": "chatterbox_f16", "display_name": "Chatterbox F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Chatterbox-GGUF", "files": ["Chatterbox-GGUF/chatterbox-f16.gguf"], "strip_prefix": "Chatterbox-GGUF" }, { "id": "chatterbox_safetensors", "display_name": "Chatterbox Safetensors", "format": "safetensors", "precision": "native", "target_directory": "chatterbox", "files": ["ve.safetensors", "t3_cfg.safetensors", "s3gen.safetensors", "tokenizer.json", "grapheme_mtl_merged_expanded_v1.json", "Cangjie5_TC.json", "conds.pt", "t3_mtl23ls_v2.safetensors", "t3_mtl23ls_v3.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "ResembleAI/chatterbox" } }];
const sources$1T = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "english_tokenizer": "model:tokenizer.json", "multilingual_tokenizer": "model:grapheme_mtl_merged_expanded_v1.json", "cangjie_mapping": "model:Cangjie5_TC.json", "builtin_conditionals": "model:conds.pt" }, "tensors": { "voice_encoder_weights": { "source": "weights:", "prefix": "voice_encoder" }, "s3gen_weights": { "source": "weights:", "prefix": "s3gen" }, "t3_english_weights": { "source": "weights:", "prefix": "t3_english" }, "t3_multilingual_v2_weights": { "source": "weights:", "prefix": "t3_multilingual_v2" }, "t3_multilingual_v3_weights": { "source": "weights:", "prefix": "t3_multilingual_v3" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "english_tokenizer": "model:tokenizer.json", "multilingual_tokenizer": "model:grapheme_mtl_merged_expanded_v1.json", "cangjie_mapping": "model:Cangjie5_TC.json", "builtin_conditionals": "model:conds.pt" }, "tensors": { "voice_encoder_weights": "model:ve.safetensors", "s3gen_weights": "model:s3gen.safetensors", "t3_english_weights": "model:t3_cfg.safetensors", "t3_multilingual_v2_weights": "model:t3_mtl23ls_v2.safetensors", "t3_multilingual_v3_weights": "model:t3_mtl23ls_v3.safetensors" } }];
const __vite_glob_0_14 = {
  family: family$1T,
  display_name: display_name$1T,
  description: description$1T,
  category: category$1T,
  status: status$1T,
  tasks: tasks$1T,
  modes: modes$1T,
  languages: languages$1T,
  options: options$1T,
  capabilities: capabilities$1T,
  runtime: runtime$1T,
  ui: ui$1T,
  package_defaults: package_defaults$1C,
  packages: packages$1U,
  sources: sources$1T
};
const family$1S = "chatterbox_turbo";
const display_name$1S = "Chatterbox Turbo";
const description$1S = "Resemble AI's distilled 350M Chatterbox Turbo: GPT2 T3 backbone, GPT2 BPE tokenizer, and a 2-step meanflow S3Gen decoder for fast English TTS with a built-in voice.";
const category$1S = "tts";
const status$1S = "testing";
const tasks$1S = ["tts"];
const modes$1S = ["offline"];
const languages$1S = ["en"];
const capabilities$1S = {};
const options$1S = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum generated tokens; legacy max_new_tokens remains accepted.", "required": false, "min": 0, "default": 1e3 }, { "name": "temperature", "type": "float", "description": "T3 sampling temperature.", "required": false, "default": 0.8 }, { "name": "top_p", "type": "float", "description": "T3 nucleus sampling cutoff.", "required": false, "default": 0.95 }, { "name": "top_k", "type": "int", "description": "T3 top-k sampling limit.", "required": false, "min": 0, "default": 1e3 }, { "name": "repetition_penalty", "type": "float", "description": "T3 token repetition penalty.", "required": false, "default": 1.2 }, { "name": "seed", "type": "int", "description": "Generation seed.", "required": false, "min": 0, "max": 4294967295, "default": 0 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per text chunk; must be positive.", "required": false, "min": 1, "default": 128 }], "session": [], "load": [] };
const runtime$1S = { "tags": ["gguf"] };
const ui$1S = { "recommended_package": "chatterbox_turbo_q8_0", "tags": ["TTS", "GGUF"], "docs": ["docs/models/chatterbox_turbo.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$1B = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1T = [{ "id": "chatterbox_turbo_q8_0", "display_name": "Chatterbox Turbo Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Chatterbox-Turbo-GGUF", "files": ["Chatterbox-Turbo-GGUF/chatterbox-turbo-q8_0.gguf"], "strip_prefix": "Chatterbox-Turbo-GGUF" }, { "id": "chatterbox_turbo_f16", "display_name": "Chatterbox Turbo F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Chatterbox-Turbo-GGUF", "files": ["Chatterbox-Turbo-GGUF/chatterbox-turbo-f16.gguf"], "strip_prefix": "Chatterbox-Turbo-GGUF" }];
const sources$1S = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "tokenizer_vocab": "model:chatterbox_turbo_vocab.json", "tokenizer_merges": "model:chatterbox_turbo_merges.txt", "tokenizer_special_tokens": "model:chatterbox_turbo_special_tokens.json" }, "tensors": { "t3_turbo_weights": { "source": "weights:", "prefix": "t3" }, "builtin_conditionals_turbo": { "source": "weights:", "prefix": "conds" }, "s3gen_weights": { "source": "weights:", "prefix": "s3gen" } } }];
const __vite_glob_0_15 = {
  family: family$1S,
  display_name: display_name$1S,
  description: description$1S,
  category: category$1S,
  status: status$1S,
  tasks: tasks$1S,
  modes: modes$1S,
  languages: languages$1S,
  capabilities: capabilities$1S,
  options: options$1S,
  runtime: runtime$1S,
  ui: ui$1S,
  package_defaults: package_defaults$1B,
  packages: packages$1T,
  sources: sources$1S
};
const family$1R = "citrinet_asr";
const display_name$1R = "Citrinet ASR";
const description$1R = "NVIDIA CitriNet-family end-to-end English ASR model using a convolutional CTC architecture optimized for transcribing speech segments to text.";
const category$1R = "asr";
const status$1R = "supported";
const tasks$1R = ["asr"];
const modes$1R = ["offline"];
const languages$1R = ["en"];
const capabilities$1R = {};
const options$1R = { "request": [], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type used by the encoder.", "default": "native", "preset": "weight_type_full", "required": false }], "load": [] };
const runtime$1R = { "tags": ["gguf"] };
const ui$1R = { "recommended_package": "citrinet_asr_q8_0", "tags": ["ASR", "GGUF"], "docs": ["docs/asr.md", "docs/gguf.md"] };
const package_defaults$1A = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1S = [{ "id": "citrinet_asr_q8_0", "display_name": "Citrinet ASR Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Citrinet-ASR-GGUF", "files": ["Citrinet-ASR-GGUF/citrinet-asr-q8_0.gguf"], "strip_prefix": "Citrinet-ASR-GGUF" }];
const sources$1R = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:citrinet_256_config.json", "tokenizer": "model:citrinet_256_tokenizer.model" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:citrinet_256_config.json", "tokenizer": "model:citrinet_256_tokenizer.model" }, "tensors": { "weights": "model:citrinet_256.safetensors" } }];
const __vite_glob_0_16 = {
  family: family$1R,
  display_name: display_name$1R,
  description: description$1R,
  category: category$1R,
  status: status$1R,
  tasks: tasks$1R,
  modes: modes$1R,
  languages: languages$1R,
  capabilities: capabilities$1R,
  options: options$1R,
  runtime: runtime$1R,
  ui: ui$1R,
  package_defaults: package_defaults$1A,
  packages: packages$1S,
  sources: sources$1R
};
const family$1Q = "cohere_asr";
const schema_version$1t = 1;
const display_name$1Q = "Cohere Transcribe";
const description$1Q = "Cohere multilingual speech transcription with punctuation control.";
const category$1Q = "asr";
const status$1Q = "supported";
const tasks$1Q = ["asr"];
const modes$1Q = ["offline"];
const languages$1Q = ["en", "fr", "de", "es", "it", "pt", "nl", "pl", "el", "ar", "ja", "zh", "vi", "ko"];
const capabilities$1Q = {};
const dependencies$1t = [];
const options$1Q = { "request": [{ "name": "language", "type": "string", "description": "Input audio language.", "required": false, "default": "en" }, { "name": "punc", "type": "bool", "description": "Generate punctuation and capitalization.", "required": false, "default": true }, { "name": "max_tokens", "type": "int", "description": "Maximum generated tokens per audio chunk.", "required": false, "min": 1, "max": 1014, "default": 256 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Long-form audio chunking mode.", "values": ["auto", "quiet_energy", "fixed", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum duration of each audio chunk in seconds.", "required": false, "min": 0.04, "max": 35, "default": 35 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Matmul weight storage type.", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"], "required": false, "default": "native" }], "load": [] };
const runtime$1Q = { "tags": ["gguf", "cpu", "cuda"] };
const ui$1Q = { "tags": ["ASR", "GGUF"], "docs": ["docs/models/cohere_asr.md"], "recommended_package": "cohere_transcribe_bf16" };
const package_defaults$1z = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1R = [{ "id": "cohere_transcribe_bf16", "display_name": "Cohere Transcribe GGUF BF16", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "Cohere-Transcribe-GGUF", "files": ["Cohere-Transcribe-GGUF/cohere-transcribe-03-2026-bf16.gguf"], "strip_prefix": "Cohere-Transcribe-GGUF" }, { "id": "cohere_transcribe_q8_0", "display_name": "Cohere Transcribe GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Cohere-Transcribe-GGUF", "files": ["Cohere-Transcribe-GGUF/cohere-transcribe-03-2026-q8_0.gguf"], "strip_prefix": "Cohere-Transcribe-GGUF" }, { "id": "cohere_transcribe_q4_0", "display_name": "Cohere Transcribe GGUF Q4_0", "format": "gguf", "precision": "q4_0", "target_directory": "Cohere-Transcribe-GGUF", "files": ["Cohere-Transcribe-GGUF/cohere-transcribe-03-2026-q4_0.gguf"], "strip_prefix": "Cohere-Transcribe-GGUF" }];
const sources$1Q = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "weights": "model:model.safetensors" } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_17 = {
  family: family$1Q,
  schema_version: schema_version$1t,
  display_name: display_name$1Q,
  description: description$1Q,
  category: category$1Q,
  status: status$1Q,
  tasks: tasks$1Q,
  modes: modes$1Q,
  languages: languages$1Q,
  capabilities: capabilities$1Q,
  dependencies: dependencies$1t,
  options: options$1Q,
  runtime: runtime$1Q,
  ui: ui$1Q,
  package_defaults: package_defaults$1z,
  packages: packages$1R,
  sources: sources$1Q
};
const schema_version$1s = 1;
const family$1P = "confucius4_r2t2";
const display_name$1P = "Confucius4-R2T2";
const description$1P = "NetEase Youdao Confucius4-R2T2 real-time ASR: a Qwen3-ASR fine-tune with Longest Stable Prefix (LSP) streaming. Low-latency append-only streaming from 80 ms to 2 s chunks, context and hotword prompts, 30 languages.";
const category$1P = "asr";
const status$1P = "community";
const tasks$1P = ["asr"];
const modes$1P = ["offline", "streaming"];
const languages$1P = ["zh", "en", "yue", "ar", "de", "fr", "es", "pt", "id", "it", "ko", "ru", "th", "vi", "ja", "tr", "hi", "ms", "nl", "sv", "da", "fi", "pl", "cs", "fil", "fa", "el", "hu", "mk", "ro"];
const capabilities$1P = { "asr": ["partial_results"] };
const runtime$1P = { "tags": ["gguf", "stream"] };
const ui$1P = { "recommended_package": "confucius4_r2t2_q8_0", "tags": ["ASR", "Stream"], "docs": ["docs/models/r2t2.md", "docs/asr.md"] };
const package_defaults$1y = { "download": { "kind": "huggingface_snapshot", "repo": "netease-youdao/Confucius4-R2T2", "revision": "main", "gated": false } };
const packages$1Q = [{ "id": "confucius4_r2t2_q8_0", "display_name": "Confucius4-R2T2 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Confucius4-R2T2-GGUF", "files": ["r2t2-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "davidxifeng/Confucius4-R2T2-gguf" } }, { "id": "confucius4_r2t2_f16", "display_name": "Confucius4-R2T2 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Confucius4-R2T2-GGUF", "files": ["r2t2-f16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "davidxifeng/Confucius4-R2T2-gguf" } }, { "id": "confucius4_r2t2_q4_k_m", "display_name": "Confucius4-R2T2 Q4_K_M GGUF", "description": "Community Q4_K_M quantization by NairoDorian (Hugging Face: Nairod785), pinned to a fixed revision; quantization report in QUANTIZATION.md. Quantized derivative work of netease-youdao/Confucius4-R2T2 under the NetEase Youdao Model Use License - see LICENSE, LICENSE_zh and NOTICE in the download repo.", "format": "gguf", "precision": "q4_k_m", "target_directory": "Confucius4-R2T2-Q4_K_M-GGUF", "files": ["r2t2-q4_k_m.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "Nairod785/Confucius4-R2T2-Q4_K_M-GGUF", "revision": "b1ea19256fb77a8d8ab7b091dc75378e15952605", "gated": false } }, { "id": "confucius4_r2t2_safetensors", "display_name": "Confucius4-R2T2 (HF safetensors)", "format": "safetensors", "precision": "native", "target_directory": "Confucius4-R2T2", "files": ["added_tokens.json", "chat_template.json", "config.json", "generation_config.json", "merges.txt", "model.safetensors", "preprocessor_config.json", "special_tokens_map.json", "tokenizer.json", "tokenizer_config.json", "vocab.json"], "download": { "kind": "huggingface_snapshot", "repo": "netease-youdao/Confucius4-R2T2" } }];
const sources$1P = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json", "processor_config": "model:processor_config.json", "chat_template": "model:chat_template.json", "chat_template_jinja": "model:chat_template.jinja", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json", "processor_config": "model:processor_config.json", "chat_template": "model:chat_template.json", "chat_template_jinja": "model:chat_template.jinja", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const options$1P = { "request": [{ "name": "language", "type": "string", "required": false, "default": "Auto", "description": "Recognition language: ISO-639 code (zh/en/ja/...) or canonical name (Chinese/English/...), or Auto for detection." }, { "name": "max_tokens", "type": "int", "required": false, "description": "Offline decode budget. Must be positive. Offline omission uses checkpoint configuration (512 fallback).", "min": 1 }], "session": [{ "name": "chunk_size_ms", "type": "float", "required": false, "default": 320, "description": "Streaming chunk duration in milliseconds; must be positive." }, { "name": "unfixed_chunk_num", "type": "int", "required": false, "default": 2, "description": "Leading chunks decoded without a stable-prefix prompt.", "min": 0 }, { "name": "unfixed_token_num", "type": "int", "required": false, "default": 5, "description": "Tokens rolled back from the accumulated text before it becomes the prefix prompt.", "min": 0 }, { "name": "rollback_punctuation", "type": "bool", "required": false, "default": false, "description": "When punctuation is detected, set rollback to zero and retain the full decoded prefix." }, { "name": "max_tokens", "type": "int", "required": false, "default": 32, "description": "Greedy decode budget per streaming chunk and for the final flush (session-scoped; distinct from the offline request max_tokens).", "min": 1 }, { "name": "audio_encoder_weight_type", "type": "enum", "preset": "weight_type_conv", "required": false, "default": "native", "description": "Audio tower weight storage." }, { "name": "thinker_weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q8_0"], "required": false, "default": "native", "description": "Thinker weight storage." }, { "name": "weight_type", "type": "enum", "preset": "weight_type_full", "required": false, "default": "native", "description": "Alias for thinker_weight_type." }, { "name": "audio_encoder_graph_arena_mb", "type": "int", "required": false, "default": 128, "description": "Audio tower graph arena in MB.", "min": 1 }, { "name": "thinker_prefill_graph_arena_mb", "type": "int", "required": false, "default": 256, "description": "Thinker prefill graph arena in MB.", "min": 1 }, { "name": "thinker_decode_graph_arena_mb", "type": "int", "required": false, "default": 256, "description": "Thinker decode graph arena in MB.", "min": 1 }, { "name": "thinker_weight_context_mb", "type": "int", "required": false, "default": 64, "description": "Thinker weight context in MB.", "min": 1 }], "load": [] };
const dependencies$1s = [];
const __vite_glob_0_18 = {
  schema_version: schema_version$1s,
  family: family$1P,
  display_name: display_name$1P,
  description: description$1P,
  category: category$1P,
  status: status$1P,
  tasks: tasks$1P,
  modes: modes$1P,
  languages: languages$1P,
  capabilities: capabilities$1P,
  runtime: runtime$1P,
  ui: ui$1P,
  package_defaults: package_defaults$1y,
  packages: packages$1Q,
  sources: sources$1P,
  options: options$1P,
  dependencies: dependencies$1s
};
const schema_version$1r = 1;
const family$1O = "confucius4_tts";
const display_name$1O = "Confucius4-TTS";
const description$1O = "Confucius4-TTS is a multilingual voice-cloning TTS model packaged for audio.cpp with offline and streaming generation. It uses reference speech, language-aware text normalization, T2S semantic generation, S2A flow matching, style encoding, semantic audio features, and BigVGAN vocoding.";
const category$1O = "tts";
const status$1O = "experimental";
const tasks$1O = ["tts", "clone"];
const modes$1O = ["offline", "streaming"];
const languages$1O = ["zh", "en", "ja", "ko", "de", "fr", "es", "id", "it", "th", "pt", "ru", "ms", "vi"];
const runtime$1O = { "tags": ["gguf", "stream"] };
const capabilities$1O = { "clone": ["speaker_reference", "long_form"] };
const options$1O = { "request": [{ "name": "language", "type": "string", "description": "Target synthesis language code used by the text frontend; default zh when no request transcript language or style language is provided.", "required": false, "default": "zh" }, { "name": "temperature", "type": "float", "description": "T2S sampling temperature; must be > 0, default 0.8.", "required": false, "min": 0, "default": 0.8 }, { "name": "top_p", "type": "float", "description": "T2S nucleus sampling probability; must be in (0, 1], default 0.8.", "required": false, "min": 0, "max": 1, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "T2S top-k sampling limit; must be positive, default 30.", "required": false, "min": 1, "default": 30 }, { "name": "num_beams", "type": "int", "description": "T2S beam count; default 3. Set 1 for single-beam sampling.", "required": false, "min": 1, "default": 3 }, { "name": "repetition_penalty", "type": "float", "description": "T2S repetition penalty; must be > 0, default 10.0.", "required": false, "min": 0, "default": 10 }, { "name": "max_tokens", "type": "int", "description": "Maximum T2S semantic sequence length including prompt tokens; default 1520.", "required": false, "min": 1, "default": 1520 }, { "name": "num_inference_steps", "type": "int", "description": "S2A flow-matching step count; default 25.", "required": false, "min": 1, "default": 25 }, { "name": "guidance_scale", "type": "float", "description": "S2A classifier-free guidance scale; default 0.7. Negative values select the no-CFG path.", "required": false, "default": 0.7 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum text tokens per generated segment; default 80.", "required": false, "min": 1, "default": 80 }, { "name": "text_chunk_mode", "type": "enum", "description": "word_budget/default selects model-local official_segments. Other modes use the framework splitter with a codepoint budget.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "cross_fade_duration_sec", "type": "float", "description": "Cross-fade duration between generated segments in seconds; default 0.3.", "required": false, "min": 0, "default": 0.3 }, { "name": "edge_fade_duration_sec", "type": "float", "description": "Fade duration applied at segment edges in seconds; default 0.1. Currently validated but not applied to generated audio.", "required": false, "min": 0, "default": 0.1 }, { "name": "edge_pad_duration_sec", "type": "float", "description": "Silence padding applied at segment edges in seconds; default 0.1. Currently validated but not applied to generated audio.", "required": false, "min": 0, "default": 0.1 }, { "name": "seed", "type": "int", "description": "Seed for T2S sampling and S2A noise initialization; default 1234.", "required": false, "min": 0, "default": 1234 }], "session": [{ "name": "graph_arena_mb", "type": "int", "description": "Reusable ggml graph arena size in MiB for Confucius stages; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "weight_context_mb", "type": "int", "description": "Weight loading context size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_type", "type": "enum", "description": "Matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage type; default native.", "preset": "weight_type_conv", "required": false, "default": "native" }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; default 1, set 0 to disable caching.", "required": false, "min": 0, "default": 1 }, { "name": "mem_saver", "type": "bool", "description": "Release staged graphs after request phases; default false.", "required": false, "default": false }], "load": [] };
const package_defaults$1x = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1P = [{ "id": "confucius4_tts_orig", "display_name": "Confucius4-TTS Original-Dtype GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "Confucius4-TTS-GGUF", "files": ["Confucius4-TTS-GGUF/confucius4-tts-orig.gguf"], "strip_prefix": "Confucius4-TTS-GGUF" }];
const dependencies$1r = [];
const ui$1O = { "recommended_package": "confucius4_tts_orig", "tags": ["TTS", "Clone", "GGUF", "Stream"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const sources$1O = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:inference_config.yaml", "tokenizer_model": "model:tokenizer.model", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "special_tokens_map": "model:special_tokens_map.json", "w2v_preprocessor_config": "model:w2v_preprocessor_config.json", "bigvgan_config": "model:bigvgan_config.json" }, "tensors": { "t2s": { "source": "weights:", "prefix": "t2s" }, "s2a": { "source": "weights:", "prefix": "s2a" }, "semantic_encoder": { "source": "weights:", "prefix": "semantic_encoder" }, "semantic_encoder_shaw": { "source": "weights:", "prefix": "semantic_encoder_shaw" }, "semantic_stats": { "source": "weights:", "prefix": "semantic_stats" }, "style_encoder": { "source": "weights:", "prefix": "style_encoder" }, "vocoder": { "source": "weights:", "prefix": "vocoder" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:inference_config.yaml", "tokenizer_model": "model:tokenizer.model", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "special_tokens_map": "model:special_tokens_map.json", "w2v_preprocessor_config": "model:w2v_preprocessor_config.json", "bigvgan_config": "model:bigvgan_config.json" }, "tensors": { "t2s": "model:t2s.safetensors", "s2a": "model:s2a.safetensors", "semantic_encoder": "model:semantic_encoder.safetensors", "semantic_encoder_shaw": "model:semantic_encoder_shaw.safetensors", "semantic_stats": "model:semantic_stats.safetensors", "style_encoder": "model:style_encoder.safetensors", "vocoder": "model:vocoder.safetensors" } }];
const __vite_glob_0_19 = {
  schema_version: schema_version$1r,
  family: family$1O,
  display_name: display_name$1O,
  description: description$1O,
  category: category$1O,
  status: status$1O,
  tasks: tasks$1O,
  modes: modes$1O,
  languages: languages$1O,
  runtime: runtime$1O,
  capabilities: capabilities$1O,
  options: options$1O,
  package_defaults: package_defaults$1x,
  packages: packages$1P,
  dependencies: dependencies$1r,
  ui: ui$1O,
  sources: sources$1O
};
const schema_version$1q = 1;
const family$1N = "controlfoley";
const display_name$1N = "ControlFoley";
const description$1N = "Multimodal Foley audio generation model.";
const category$1N = "audio_tools";
const status$1N = "experimental";
const tasks$1N = ["sfx"];
const modes$1N = ["offline"];
const languages$1N = ["auto"];
const runtime$1N = { "tags": ["gguf"] };
const capabilities$1N = { "sfx": ["prompt_generation"] };
const ui$1N = { "recommended_package": "controlfoley_large_44k_q8_0", "tags": ["SFX", "GGUF"], "docs": ["docs/models/controlfoley.md", "docs/gguf.md"] };
const sources$1N = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "open_clip_vocab": "model:open_clip_vocab.json", "open_clip_merges": "model:open_clip_merges.txt", "open_clip_tokenizer_config": "model:open_clip_tokenizer_config.json" }, "tensors": { "flow": { "source": "weights:", "prefix": "flow" }, "vae": { "source": "weights:", "prefix": "vae" }, "bigvgan": { "source": "weights:", "prefix": "bigvgan" }, "open_clip": { "source": "weights:", "prefix": "open_clip" }, "cav_mae": { "source": "weights:", "prefix": "cav_mae" }, "synchformer": { "source": "weights:", "prefix": "synchformer" }, "clap": { "source": "weights:", "prefix": "clap" }, "mert": { "source": "weights:", "prefix": "mert" }, "musicgen_style": { "source": "weights:", "prefix": "musicgen_style" } } }];
const options$1N = { "request": [{ "name": "duration_sec", "type": "float", "required": false, "default": 8, "min": 0.64, "description": "Target temporal budget." }, { "name": "num_inference_steps", "type": "int", "required": false, "default": 25, "min": 1, "description": "Euler flow inference steps." }, { "name": "guidance_scale", "type": "float", "required": false, "default": 4.5, "min": 0, "description": "Classifier-free guidance strength. Must be > 0. Values strictly between 0 and 1 bypass CFG and negative-prompt conditioning." }, { "name": "negative_prompt", "type": "string", "required": false, "default": "", "description": "Negative text prompt used for the unconditional guidance text branch." }, { "name": "video_file", "type": "path", "required": false, "description": "Optional video path for video-conditioned Foley generation." }, { "name": "mask_away_clip", "type": "bool", "required": false, "default": false, "description": "Disable OpenCLIP video conditioning while keeping visual and sync conditioning." }, { "name": "seed", "type": "int", "required": false, "default": 42, "min": 0, "max": 4294967295, "description": "Generation seed." }], "session": [{ "name": "weight_type", "type": "enum", "required": false, "preset": "weight_type_full", "default": "native", "description": "ControlFoley weight storage type." }], "load": [] };
const package_defaults$1w = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1O = [{ "id": "controlfoley_large_44k_f32", "display_name": "ControlFoley Large 44k F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "ControlFoley-GGUF", "files": ["ControlFoley-GGUF/controlfoley-large-44k-f32.gguf"], "strip_prefix": "ControlFoley-GGUF" }, { "id": "controlfoley_large_44k_q8_0", "display_name": "ControlFoley Large 44k Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "ControlFoley-GGUF", "files": ["ControlFoley-GGUF/controlfoley-large-44k-q8_0.gguf"], "strip_prefix": "ControlFoley-GGUF" }];
const dependencies$1q = [];
const __vite_glob_0_20 = {
  schema_version: schema_version$1q,
  family: family$1N,
  display_name: display_name$1N,
  description: description$1N,
  category: category$1N,
  status: status$1N,
  tasks: tasks$1N,
  modes: modes$1N,
  languages: languages$1N,
  runtime: runtime$1N,
  capabilities: capabilities$1N,
  ui: ui$1N,
  sources: sources$1N,
  options: options$1N,
  package_defaults: package_defaults$1w,
  packages: packages$1O,
  dependencies: dependencies$1q
};
const schema_version$1p = 1;
const family$1M = "cosyvoice3";
const display_name$1M = "CosyVoice3";
const description$1M = "Fun-CosyVoice3 native GGUF package for zero-shot, cross-lingual, and instruction-conditioned text-to-speech using CosyVoice3 speech-token AR generation, causal masked flow mel decoding, CAM++ speaker conditioning, and causal HiFT waveform decoding.";
const category$1M = "tts";
const status$1M = "supported";
const tasks$1M = ["tts", "clone"];
const modes$1M = ["offline"];
const languages$1M = ["zh", "en", "ja", "ko", "de", "es", "fr", "it", "ru", "yue"];
const runtime$1M = { "tags": ["gguf"] };
const dependencies$1p = [];
const capabilities$1M = { "tts": ["speaker_reference", "style_control"], "clone": ["speaker_reference"] };
const options$1M = { "request": [{ "name": "template_name", "type": "enum", "description": "CosyVoice3 request template.", "required": false, "values": ["zero_shot", "cross_lingual", "instruct"], "default": "zero_shot" }, { "name": "reference_text", "type": "string", "description": "Transcript for the prompt audio.", "required": false }, { "name": "instruct", "type": "string", "description": "Instruction text for instruct mode.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 600.", "required": false, "min": 1, "default": 600 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated speech tokens; -1 (default) selects 20 times the target text token count. Explicit limits must be positive.", "required": false, "min": -1, "default": -1 }, { "name": "min_tokens", "type": "int", "description": "Minimum generated speech tokens before stop is accepted; -1 (default) selects twice the target text token count. Must not exceed the resolved maximum.", "required": false, "min": -1, "default": -1 }, { "name": "top_k", "type": "int", "description": "AR speech-token top-k sampling limit; default 25.", "required": false, "min": 1, "default": 25 }, { "name": "num_inference_steps", "type": "int", "description": "Flow decoder Euler steps; default 10.", "required": false, "min": 1, "default": 10 }, { "name": "seed", "type": "int", "description": "Generation seed.", "required": false, "min": 0, "default": 1986 }], "session": [{ "name": "lora", "type": "path", "description": "PEFT adapter with adapter_config.json, or native lora_weights with config.json and speech_embedding/llm_decoder sidecars. Checkpoints may use safetensors or PyTorch containers.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's alpha/r scaling; default 1. Full-weight replacements are not scaled.", "required": false, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "CosyVoice3 matmul weight storage type; default native.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_k"] }, { "name": "graph_arena_mb", "type": "int", "description": "Reusable runtime graph arena size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_context_mb", "type": "int", "description": "Weight loading context size in MiB; default 2048.", "required": false, "min": 1, "default": 2048 }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; set 0 to disable reuse.", "required": false, "min": 0, "default": 4 }, { "name": "mem_saver", "type": "bool", "description": "Release cached runtime graphs after each request to reduce peak VRAM; default false.", "required": false, "default": false }, { "name": "exec_plan", "type": "string", "description": "JSON object of component execution plans. Component: flow. Each plan accepts impl, backend, artifacts, and params. impl is default/ggml/rknn. GGML keeps the session backend. RKNN requires artifacts.main, a comma-separated ladder of estimator engines compiled one per sequence length (tools/rknn/prepare_cosyvoice3_rknn_flow.py), and ENGINE_ENABLE_RKNN; omit backend. An utterance longer than the largest engine runs the CPU graph. Neither implementation takes params.", "required": false, "default": "{}" }], "load": [] };
const packages$1N = [{ "id": "cosyvoice3_q8_0", "display_name": "CosyVoice3 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "CosyVoice3-GGUF", "files": ["CosyVoice3-GGUF/cosyvoice3-q8_0.gguf"], "strip_prefix": "CosyVoice3-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "cosyvoice3_f32", "display_name": "CosyVoice3 F32 GGUF", "default": false, "format": "gguf", "precision": "f32", "target_directory": "CosyVoice3-GGUF", "files": ["CosyVoice3-GGUF/cosyvoice3-f32.gguf"], "strip_prefix": "CosyVoice3-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }];
const ui$1M = { "recommended_package": "cosyvoice3_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const sources$1M = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "cosyvoice3_yaml": "model:cosyvoice3.yaml", "qwen_config": "model:CosyVoice-BlankEN/config.json", "tokenizer_config": "model:CosyVoice-BlankEN/tokenizer_config.json", "vocab_json": "model:CosyVoice-BlankEN/vocab.json", "merges_txt": "model:CosyVoice-BlankEN/merges.txt" }, "tensors": { "llm_weights": { "source": "weights:", "prefix": "llm" }, "flow_weights": { "source": "weights:", "prefix": "flow" }, "hift_weights": { "source": "weights:", "prefix": "hift" }, "campplus_weights": { "source": "weights:", "prefix": "campplus" }, "speech_tokenizer_weights": { "source": "weights:", "prefix": "speech_tokenizer" }, "blank_en_weights": { "source": "weights:", "prefix": "blank_en" } } }];
const __vite_glob_0_21 = {
  schema_version: schema_version$1p,
  family: family$1M,
  display_name: display_name$1M,
  description: description$1M,
  category: category$1M,
  status: status$1M,
  tasks: tasks$1M,
  modes: modes$1M,
  languages: languages$1M,
  runtime: runtime$1M,
  dependencies: dependencies$1p,
  capabilities: capabilities$1M,
  options: options$1M,
  packages: packages$1N,
  ui: ui$1M,
  sources: sources$1M
};
const schema_version$1o = 1;
const family$1L = "crisperwhisper";
const display_name$1L = "CrisperWhisper 2.0";
const description$1L = "Whisper-based verbatim and intended speech transcription.";
const category$1L = "asr";
const status$1L = "supported";
const tasks$1L = ["asr", "align"];
const modes$1L = ["offline", "streaming"];
const languages$1L = ["af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "eu", "fa", "fi", "fo", "fr", "gl", "gu", "ha", "haw", "he", "hi", "hr", "ht", "hu", "hy", "id", "is", "it", "ja", "jw", "ka", "kk", "km", "kn", "ko", "la", "lb", "ln", "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nl", "nn", "no", "oc", "pa", "pl", "ps", "pt", "ro", "ru", "sa", "sd", "si", "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw", "ta", "te", "tg", "th", "tk", "tl", "tr", "tt", "uk", "ur", "uz", "vi", "yi", "yo", "zh"];
const capabilities$1L = { "align": ["word_timestamps"], "asr": ["word_timestamps", "partial_results"] };
const dependencies$1o = [];
const options$1L = { "request": [{ "name": "return_timestamps", "required": false, "type": "bool", "description": "Return word-level timestamps.", "default": false }, { "name": "audio_chunk_mode", "required": false, "type": "enum", "values": ["auto", "fixed", "none"], "description": "Continuation window planning. None requires audio no longer than 30 seconds.", "default": "auto" }, { "name": "audio_chunk_duration_sec", "required": false, "type": "float", "description": "Duration of each encoder window in seconds. Must be positive and greater than overlap.", "max": 30, "default": 30 }, { "name": "audio_chunk_overlap_sec", "required": false, "type": "float", "description": "Audio overlap between continuation windows in seconds. Must be smaller than chunk duration.", "min": 0, "default": 4 }, { "name": "language", "required": false, "type": "string", "description": "Audio language code.", "default": "en" }, { "name": "transcription_mode", "required": false, "type": "enum", "description": "Verbatim speech, intended clean text, or transcript-conditioned verbatimize.", "values": ["verbatim", "intended", "verbatimize"], "default": "verbatim" }, { "name": "max_tokens", "required": false, "type": "int", "description": "Maximum generated tokens per window. Positive budget, additionally bounded by remaining checkpoint text positions after the prompt.", "min": 1, "default": 256 }], "session": [{ "name": "weight_type", "required": false, "type": "enum", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "i8"], "description": "Matmul weight storage type.", "default": "native" }], "load": [] };
const runtime$1L = { "tags": ["gguf"] };
const ui$1L = { "tags": ["ASR", "GGUF"], "docs": ["docs/models/crisperwhisper.md"], "recommended_package": "crisperwhisper_2_large_q8_0" };
const package_defaults$1v = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1M = [{ "id": "crisperwhisper_2_large_bf16", "display_name": "CrisperWhisper 2.0 Large GGUF BF16", "format": "gguf", "precision": "bf16", "target_directory": "CrisperWhisper2.0-GGUF", "files": ["CrisperWhisper2.0-GGUF/crisperwhisper-2-large-bf16.gguf"], "strip_prefix": "CrisperWhisper2.0-GGUF" }, { "id": "crisperwhisper_2_large_q8_0", "display_name": "CrisperWhisper 2.0 Large GGUF Q8_0", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "CrisperWhisper2.0-GGUF", "files": ["CrisperWhisper2.0-GGUF/crisperwhisper-2-large-q8_0.gguf"], "strip_prefix": "CrisperWhisper2.0-GGUF" }, { "id": "crisperwhisper_2_large_q4_k", "display_name": "CrisperWhisper 2.0 Large GGUF Q4_K", "format": "gguf", "precision": "q4_k", "target_directory": "CrisperWhisper2.0-GGUF", "files": ["CrisperWhisper2.0-GGUF/crisperwhisper-2-large-q4_k.gguf"], "strip_prefix": "CrisperWhisper2.0-GGUF" }];
const sources$1L = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt" }, "tensors": { "weights": "model:model.safetensors" } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_22 = {
  schema_version: schema_version$1o,
  family: family$1L,
  display_name: display_name$1L,
  description: description$1L,
  category: category$1L,
  status: status$1L,
  tasks: tasks$1L,
  modes: modes$1L,
  languages: languages$1L,
  capabilities: capabilities$1L,
  dependencies: dependencies$1o,
  options: options$1L,
  runtime: runtime$1L,
  ui: ui$1L,
  package_defaults: package_defaults$1v,
  packages: packages$1M,
  sources: sources$1L
};
const schema_version$1n = 1;
const family$1K = "dots_tts";
const display_name$1K = "DotTTS";
const description$1K = "DotTTS is a multilingual zero-shot TTS, voice-cloning, and speech-editing model family packaged for audio.cpp with SOAR and MeanFlow generation, prompt-audio plus prompt-text prefill, speaker-reference conditioning, language tags, multiple synthesis templates, long-form text chunking, and true streaming audio output.";
const category$1K = "tts";
const status$1K = "supported";
const tasks$1K = ["tts", "clone"];
const modes$1K = ["offline", "streaming"];
const languages$1K = ["multilingual"];
const runtime$1K = { "tags": ["gguf", "stream"] };
const capabilities$1K = { "tts": ["speaker_reference", "style_control", "long_form"], "clone": ["speaker_reference", "style_control", "long_form"] };
const options$1K = { "request": [{ "name": "reference_text", "type": "string", "description": "Transcript for the prompt audio. When set with reference audio, DotTTS uses prompt prefill for higher quality voice cloning.", "required": false }, { "name": "reference_duration_sec", "type": "float", "description": "Optional prompt-audio trim duration before reference conditioning and prompt prefill.", "required": false, "min": 0 }, { "name": "template_name", "type": "enum", "description": "DotTTS synthesis template. tts is normal text-to-speech; instruction_tts adds instruction conditioning; text_to_audio uses a sound-description template; tts_interleave uses the streaming interleave schedule; edit uses the DotTTS Edit source-audio editing schedule and is offline-only.", "values": ["tts", "instruction_tts", "text_to_audio", "tts_interleave", "edit"], "required": false, "default": "tts" }, { "name": "source_audio", "type": "audio_path", "description": "Source WAV path for DotTTS Edit. Required when template_name=edit unless audio_input is supplied by the caller.", "required": false }, { "name": "instruct", "type": "string", "description": "Structured DotTTS Edit instruction. If omitted with template_name=edit, the request text is used as the instruction.", "required": false }, { "name": "source_text", "type": "string", "description": "Optional source transcript override for DotTTS Edit. If omitted, it is rendered from instruction tags.", "required": false }, { "name": "target_text", "type": "string", "description": "Edit target transcript override. When omitted, explicit instruction plus text input uses that text; otherwise the target is rendered from instruction tags.", "required": false }, { "name": "use_xvector", "type": "enum", "description": "DotTTS Edit speaker conditioning mode. auto follows the upstream tag-based behavior; on/off force or disable source-audio speaker conditioning.", "values": ["auto", "on", "off"], "required": false, "default": "auto" }, { "name": "language", "type": "string", "description": "Optional target language tag. none disables language tagging; otherwise pass a language code such as en or zh.", "required": false, "default": "none" }, { "name": "num_inference_steps", "type": "int", "description": "SOAR flow-matching inference step count; default 10.", "required": false, "min": 1, "default": 10 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale used by SOAR flow matching. Default 1.2.", "required": false, "min": 0, "default": 1.2 }, { "name": "speaker_scale", "type": "float", "description": "Multiplier applied to the prompt speaker embedding; default 1.5.", "required": false, "min": 0, "default": 1.5 }, { "name": "sampler_mode", "type": "enum", "description": "SOAR ODE solver method for flow matching. Fixed-step euler is the default and parity baseline.", "values": ["euler", "midpoint", "rk4"], "required": false, "default": "euler" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated audio patch count per generated segment; default 500. In Edit mode source patches consume this budget; it must exceed the source-patch count.", "required": false, "min": 1, "default": 500 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum text codepoints per generated segment for long-form requests; default 320.", "required": false, "min": 1, "default": 320 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode; default tag_aware preserves leading style/control tags across long-form chunks.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "tag_aware" }, { "name": "vocoder_merge_steps", "type": "int", "description": "Streaming vocoder latent patch merge size after the initial unmerged patches; default 4, matching the Python optimized streaming runtime default.", "required": false, "min": 1, "default": 4 }, { "name": "seed", "type": "int", "description": "Seed for prompt latent sampling and flow noise initialization; default 42.", "required": false, "min": 0, "default": 42 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared matmul weight storage type for DotTTS components; default native. Component-specific weight options override this value.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "speaker_encoder_weight_type", "type": "enum", "description": "Speaker encoder matmul weight storage type; defaults to weight_type.", "preset": "weight_type_full", "required": false }, { "name": "codec_weight_type", "type": "enum", "description": "AudioVAE vocoder matmul and recurrent weight storage type; defaults to weight_type.", "preset": "weight_type_full", "required": false }, { "name": "patch_encoder_weight_type", "type": "enum", "description": "Patch encoder transformer matmul weight storage type; defaults to weight_type.", "preset": "weight_type_full", "required": false }, { "name": "llm_weight_type", "type": "enum", "description": "Autoregressive language model matmul weight storage type; defaults to weight_type.", "preset": "weight_type_full", "required": false }, { "name": "flow_weight_type", "type": "enum", "description": "SOAR or MeanFlow DiT flow-matching matmul weight storage type; defaults to weight_type.", "preset": "weight_type_full", "required": false }, { "name": "codec_conv_weight_type", "type": "enum", "description": "Convolution weight storage type; default native.", "preset": "weight_type_conv", "required": false, "default": "native" }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; set 0 to disable reuse.", "required": false, "min": 0, "default": 4 }, { "name": "mem_saver", "type": "bool", "description": "Load DotTTS components by request phase and release their weights/graphs after last use while keeping reference cache slots alive.", "required": false, "default": false }], "load": [] };
const package_defaults$1u = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1L = [{ "id": "dots_tts_soar_q8_0", "display_name": "DotTTS SOAR Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "DotTTS-SOAR-GGUF", "files": ["DotTTS-SOAR-GGUF/dots-tts-soar-q8_0.gguf"], "strip_prefix": "DotTTS-SOAR-GGUF" }, { "id": "dots_tts_soar_bf16", "display_name": "DotTTS SOAR BF16 GGUF", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "DotTTS-SOAR-GGUF", "files": ["DotTTS-SOAR-GGUF/dots-tts-soar-bf16.gguf"], "strip_prefix": "DotTTS-SOAR-GGUF" }, { "id": "dots_tts_mf_q8_0", "display_name": "DotTTS MeanFlow Q8_0 GGUF", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "DotTTS-MF-GGUF", "files": ["DotTTS-MF-GGUF/dots-tts-mf-q8_0.gguf"], "strip_prefix": "DotTTS-MF-GGUF" }, { "id": "dots_tts_mf_bf16", "display_name": "DotTTS MeanFlow BF16 GGUF", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "DotTTS-MF-GGUF", "files": ["DotTTS-MF-GGUF/dots-tts-mf-bf16.gguf"], "strip_prefix": "DotTTS-MF-GGUF" }, { "id": "dots_tts_edit_q8_0", "display_name": "DotTTS Edit Q8_0 GGUF", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "DotTTS-Edit-GGUF", "files": ["DotTTS-Edit-GGUF/dots-tts-edit-q8_0.gguf"], "strip_prefix": "DotTTS-Edit-GGUF" }, { "id": "dots_tts_edit_bf16", "display_name": "DotTTS Edit BF16 GGUF", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "DotTTS-Edit-GGUF", "files": ["DotTTS-Edit-GGUF/dots-tts-edit-bf16.gguf"], "strip_prefix": "DotTTS-Edit-GGUF" }];
const dependencies$1n = [];
const ui$1K = { "recommended_package": "dots_tts_soar_q8_0", "tags": ["TTS", "Clone", "Stream", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const sources$1K = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "llm_config": "model:llm_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt", "added_tokens": "model:added_tokens.json", "special_tokens_map": "model:special_tokens_map.json" }, "tensors": { "core_weights": { "source": "weights:", "prefix": "core" }, "vocoder_weights": { "source": "weights:", "prefix": "vocoder" }, "speaker_encoder_weights": { "source": "weights:", "prefix": "speaker_encoder" }, "latent_stats": { "source": "weights:", "prefix": "latent_stats" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "llm_config": "model:llm_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt", "added_tokens": "model:added_tokens.json", "special_tokens_map": "model:special_tokens_map.json" }, "tensors": { "core_weights": { "source": "model:model.safetensors" }, "vocoder_weights": { "source": "model:vocoder.safetensors" }, "speaker_encoder_weights": { "source": "model:speaker_encoder.safetensors" }, "latent_stats": { "source": "model:latent_stats.safetensors" } } }];
const __vite_glob_0_23 = {
  schema_version: schema_version$1n,
  family: family$1K,
  display_name: display_name$1K,
  description: description$1K,
  category: category$1K,
  status: status$1K,
  tasks: tasks$1K,
  modes: modes$1K,
  languages: languages$1K,
  runtime: runtime$1K,
  capabilities: capabilities$1K,
  options: options$1K,
  package_defaults: package_defaults$1u,
  packages: packages$1L,
  dependencies: dependencies$1n,
  ui: ui$1K,
  sources: sources$1K
};
const schema_version$1m = 1;
const family$1J = "dramabox";
const display_name$1J = "DramaBox";
const description$1J = "DramaBox is an English expressive TTS and voice-cloning model packaged for audio.cpp as a standalone GGUF bundle. It combines Gemma text conditioning, diffusion sampling, reference-audio conditioning, long-form chunking, and 48 kHz stereo output.";
const category$1J = "tts";
const status$1J = "experimental";
const tasks$1J = ["tts", "clone"];
const modes$1J = ["offline"];
const languages$1J = ["en"];
const runtime$1J = { "tags": ["gguf"] };
const capabilities$1J = { "tts": ["speaker_reference", "style_control", "long_form"], "clone": ["speaker_reference", "style_control", "long_form"] };
const options$1J = { "request": [{ "name": "target_voice", "type": "audio_path", "description": "Reference voice WAV path for voice cloning. If omitted, DramaBox generates from text without reference-audio conditioning.", "required": false }, { "name": "negative_prompt", "type": "string", "description": "Negative text conditioning used when guidance_scale enables classifier-free guidance; omitted uses the built-in quality prompt.", "required": false }, { "name": "duration_sec", "type": "float", "description": "Explicit target duration in seconds; default 0 uses the prompt-duration estimator. Above audio_chunk_threshold_sec, long-form generation uses estimated per-chunk durations instead of this explicit target.", "required": false, "min": 0, "default": 0 }, { "name": "num_inference_steps", "type": "int", "description": "Diffusion sampling step count; default comes from config.json, 30 in the current package.", "required": false, "min": 1, "default": 30 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale; default comes from config.json, 2.5 in the current package. Values greater than 1 enable CFG. Negative values disable this guidance branch.", "required": false, "default": 2.5 }, { "name": "spatio_temporal_guidance_scale", "type": "float", "description": "Spatio-temporal guidance scale; default comes from config.json, 1.5 in the current package. Values greater than 0 enable STG. Negative values disable this guidance branch.", "required": false, "default": 1.5 }, { "name": "duration_scale", "type": "float", "description": "Multiplier applied to the estimated prompt duration when duration_sec is 0; default comes from config.json, 1.1 in the current package. The resulting duration has a 3-second floor.", "required": false, "default": 1.1 }, { "name": "reference_duration_sec", "type": "float", "description": "Reference voice crop/repeat duration in seconds; default comes from config.json, 10.0 in the current package. Must be > 0.", "required": false, "min": 0, "default": 10 }, { "name": "guidance_rescale", "type": "string", "description": "Guidance rescale: auto or any negative value derives it from guidance_scale; nonnegative numeric values select an explicit rescale.", "required": false, "default": "auto" }, { "name": "audio_chunk_threshold_sec", "type": "float", "description": "Estimated duration threshold that switches a request to long-form chunking; default 45.0 seconds. Must be > 0.", "required": false, "min": 0, "default": 45 }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Target estimated duration for each long-form chunk; default 37.0 seconds. Must be > 0.", "required": false, "min": 0, "default": 37 }, { "name": "cross_fade_duration_sec", "type": "float", "description": "Equal-power cross-fade between long-form chunks in seconds; default 0.05. Zero still overlaps one sample.", "required": false, "min": 0, "default": 0.05 }, { "name": "seed", "type": "int", "description": "Torch-compatible CUDA noise seed for diffusion sampling; default 42.", "required": false, "min": 0, "default": 42 }], "session": [{ "name": "perf_mode", "type": "enum", "description": "Attention implementation mode. Default off keeps the exact reference-query attention path; flash_attention enables the optimized path.", "values": ["off", "flash_attention"], "required": false, "default": "off" }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime graphs and weights immediately after each request phase to reduce peak and resident VRAM; default false keeps components cached for later reuse.", "required": false, "default": false }], "load": [] };
const package_defaults$1t = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1K = [{ "id": "dramabox_q8_0", "display_name": "DramaBox Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "DramaBox-GGUF", "files": ["DramaBox-GGUF/dramabox-q8_0.gguf"], "strip_prefix": "DramaBox-GGUF" }];
const dependencies$1m = [];
const ui$1J = { "recommended_package": "dramabox_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const sources$1J = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "audio_components_config": "model:audio_components_config.json", "gemma_config": "model:gemma-3-12b-it-bnb-4bit/config.json", "gemma_tokenizer_model": "model:gemma-3-12b-it-bnb-4bit/tokenizer.model", "gemma_tokenizer_json": "model:gemma-3-12b-it-bnb-4bit/tokenizer.json", "gemma_tokenizer_config": "model:gemma-3-12b-it-bnb-4bit/tokenizer_config.json" }, "tensors": { "dit_weights": { "source": "weights:", "prefix": "dit" }, "audio_weights": { "source": "weights:", "prefix": "audio" }, "gemma_weights": { "source": "weights:", "prefix": "gemma" }, "silence_latent": { "source": "weights:", "prefix": "silence" } } }];
const __vite_glob_0_24 = {
  schema_version: schema_version$1m,
  family: family$1J,
  display_name: display_name$1J,
  description: description$1J,
  category: category$1J,
  status: status$1J,
  tasks: tasks$1J,
  modes: modes$1J,
  languages: languages$1J,
  runtime: runtime$1J,
  capabilities: capabilities$1J,
  options: options$1J,
  package_defaults: package_defaults$1t,
  packages: packages$1K,
  dependencies: dependencies$1m,
  ui: ui$1J,
  sources: sources$1J
};
const schema_version$1l = 1;
const family$1I = "echo_tts";
const display_name$1I = "Echo-TTS";
const description$1I = "Echo-TTS is an English zero-shot voice-cloning TTS model packaged for audio.cpp. A 2.8B diffusion transformer generates 80-D latents in PCA space which the Fish S1-DAC decodes to 44.1 kHz audio. Generation is a fixed 29.72 s window (640 latents).";
const category$1I = "tts";
const status$1I = "experimental";
const tasks$1I = ["tts", "clone"];
const modes$1I = ["offline"];
const languages$1I = ["en"];
const runtime$1I = { "tags": ["gguf"] };
const capabilities$1I = { "clone": ["speaker_reference"] };
const options$1I = { "request": [{ "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per text chunk; must be positive, default 300.", "required": false, "min": 1, "default": 300 }, { "name": "text_guidance_scale", "type": "float", "description": "Classifier-free guidance scale on the text condition (independent-cfg only). Advertised range is recommended, not enforced by the parser.", "required": false, "min": 0, "default": 3 }, { "name": "speaker_guidance_scale", "type": "float", "description": "Classifier-free guidance scale on the speaker condition (independent-cfg only). Advertised range is recommended, not enforced by the parser.", "required": false, "min": 0, "default": 8 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale on the text and speaker condition (join-cfg only). Advertised range is recommended, not enforced by the parser.", "required": false, "min": 0, "default": 8 }, { "name": "t_schedule_mode", "type": "enum", "description": "RF Euler timestep schedule: linear or sway; default linear.", "values": ["linear", "sway"], "required": false, "default": "linear" }, { "name": "sway_coeff", "type": "float", "description": "Sway Sampling coefficient; must be finite and produce strictly decreasing timesteps. Default -1.0.", "required": false, "default": -1 }, { "name": "num_inference_steps", "type": "int", "description": "Euler sampler steps. Default 40 for linear timestep schedule, 12 for sway.", "required": false, "min": 1, "default": 40 }, { "name": "truncation_factor", "type": "float", "description": "Initial-noise truncation factor. Advertised range is recommended, not enforced by the parser.", "required": false, "min": 0, "max": 1, "default": 0.8 }, { "name": "speaker_kv_scale", "type": "float", "description": "Force-speaker KV scaling. 1.0 disables; 1.5 is the upstream default when enabled. Advertised range is recommended, not parser-enforced; zero is invalid for reciprocal scaling.", "required": false, "min": 1, "default": 1 }, { "name": "seed", "type": "int", "description": "RNG seed for the initial latent. Negative signed-integer values are treated as zero.", "required": false, "default": 0 }, { "name": "reference_duration_sec", "type": "float", "required": false, "description": "Trim the speaker reference to at most this many seconds before encoding. Shorter references are cheaper and often clone better; upstream's guidance favours around 10 s. Defaults to 15 s. Values above the trained maximum of 297.1 s are clamped. Set per request, or as a session default from CLI or server config. Must be positive.", "default": 15 }, { "name": "max_duration_sec", "type": "float", "description": "Cap the generation window, in seconds (up to 29.7215 s, the trained maximum; larger values are clamped to it). Quantised down to a whole latent frame of 46.44 ms. Left unset, the window is estimated per chunk from text length and widened automatically if the utterance does not finish inside it, which is substantially cheaper for short text. Must be positive; rounded to at least one latent frame.", "required": false, "max": 29.7215 }, { "name": "guidance_interval", "type": "int", "description": "Refresh the two unconditional CFG lanes only every Nth step inside the guidance window, reusing the previous guidance correction in between. 1 reproduces upstream exactly. Worth raising to 2 at 30+ steps, where the correction is still measured 8-10 times across the guided phase (roughly 1.3x fewer denoiser evaluations); not recommended below ~20 steps, where it is already coarsely sampled and staleness shows up as degraded timbre and text adherence.", "required": false, "min": 1, "default": 1 }], "session": [{ "name": "reference_duration_sec", "type": "float", "required": false, "description": "Trim the speaker reference to at most this many seconds before encoding. Shorter references are cheaper and often clone better; upstream's guidance favours around 10 s. Defaults to 15 s. Values above the trained maximum of 297.1 s are clamped. Set per request, or as a session default from CLI or server config. Must be positive.", "default": 15 }, { "name": "reference_cache_slots", "type": "int", "required": false, "description": "How many encoded speaker references to keep. Encoding is linear in reference length, so reusing a voice across requests avoids repeating it. 0 disables caching; default 4." }, { "name": "mem_saver", "type": "bool", "required": false, "description": "Release Fish S1-DAC decode graph space before encoding reference speaker audio and encode graph space after. Avoids having both allocations resident simulaneously at the cost of rebuilding the graphs when a speaker cache-miss occurs.", "default": false }, { "name": "cfg_mode", "type": "enum", "description": "Type of classifier free guidance used.", "values": ["independent", "joint"], "required": false, "default": "independent" }], "load": [] };
const packages$1J = [{ "id": "echo_tts_q8_0", "display_name": "Echo-TTS Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Echo-TTS-GGUF", "files": ["echo-tts-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "dignome/Echo-TTS", "revision": "919681c9906c88963352d5f96e0f732ddd3989ce", "gated": false } }, { "id": "echo_tts_f16", "display_name": "Echo-TTS F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Echo-TTS-GGUF", "files": ["echo-tts-f16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "dignome/Echo-TTS", "revision": "919681c9906c88963352d5f96e0f732ddd3989ce", "gated": false } }];
const dependencies$1l = [];
const ui$1I = { "recommended_package": "echo_tts_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/echo_tts.md"] };
const sources$1I = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "tensors": { "dit_weights": { "source": "weights:", "prefix": "dit_weights" }, "pca": { "source": "weights:", "prefix": "pca" }, "codec_weights": { "source": "weights:", "prefix": "ae" } } }];
const __vite_glob_0_25 = {
  schema_version: schema_version$1l,
  family: family$1I,
  display_name: display_name$1I,
  description: description$1I,
  category: category$1I,
  status: status$1I,
  tasks: tasks$1I,
  modes: modes$1I,
  languages: languages$1I,
  runtime: runtime$1I,
  capabilities: capabilities$1I,
  options: options$1I,
  packages: packages$1J,
  dependencies: dependencies$1l,
  ui: ui$1I,
  sources: sources$1I
};
const schema_version$1k = 1;
const family$1H = "f5_tts";
const display_name$1H = "F5-TTS";
const description$1H = "Community F5-TTS flow-matching diffusion transformer for zero-shot voice cloning, including Arabic via the Habibi-TTS finetune (SWivid). Text conv conditioner, RoPE DiT, CFM sampler, Vocos vocoder.";
const category$1H = "tts";
const status$1H = "community";
const tasks$1H = ["tts", "clone"];
const modes$1H = ["offline"];
const languages$1H = ["en", "ar"];
const runtime$1H = { "tags": ["server"] };
const capabilities$1H = { "clone": ["speaker_reference"] };
const options$1H = { "request": [{ "name": "reference_text", "type": "string", "description": "Transcript matching the reference voice audio; required by F5-TTS zero-shot cloning.", "required": true }, { "name": "dialect", "type": "string", "description": "Habibi dialect token: UNK MSA SAU UAE ALG IRQ EGY MAR OMN TUN LEV SDN LBY; default UNK.", "required": false, "default": "UNK" }, { "name": "sway_sampling_coef", "type": "float", "description": "Sway sampling coefficient for inference timesteps; default -1.0. Advertised bounds are recommended settings, not parser-enforced limits.", "required": false, "min": -5, "max": 5, "default": -1 }, { "name": "speed", "type": "float", "description": "Speech speed multiplier for duration estimation; default 1.0. Generated text chunks shorter than 10 characters use 0.3 instead. Advertised bounds are recommended settings, not parser-enforced limits.", "required": false, "min": 0.5, "max": 2, "default": 1 }, { "name": "seed", "type": "int", "description": "Non-negative noise seed; omitted selects a random seed. Explicit zero is deterministic.", "required": false, "min": 0 }, { "name": "num_inference_steps", "type": "int", "description": "CFM Euler steps (NFE); default 32. The parser rejects nonpositive counts.", "required": false, "min": 1, "default": 32 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance strength; default 2.0. Advertised bounds are recommended settings, not parser-enforced limits.", "required": false, "min": 0, "max": 10, "default": 2 }, { "name": "strip_diacritics", "type": "bool", "description": "Strip Arabic combining marks (harakat/tanwin/shadda/tatweel) before synthesis; Habibi is trained on undiacritized ASR transcripts and garbles diacritized input. Default true.", "required": false, "default": true }], "session": [{ "name": "lora", "type": "path", "description": "PEFT DiT LoRA adapter directory or checkpoint file; merged into session-owned weights and graphs. Vocos is unchanged.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's alpha/r scaling; default 1.", "required": false, "default": 1 }, { "name": "vocos_path", "type": "string", "description": "Path to the Vocos vocoder checkpoint (vocos.safetensors); required unless placed next to the DiT checkpoint.", "required": false }, { "name": "dialect", "type": "string", "description": "Default Habibi dialect token for requests that do not set it; default UNK.", "required": false, "default": "UNK" }, { "name": "frame_budget", "type": "int", "description": "Total mel frames per CFM pass (ref + generated); larger budgets allow sentence-scale chunks at higher VRAM. Must be in [256, 8192]; omitted uses 2048. Explicit zero is not accepted. On CPU the allocated DiT graph pool caps a pass at 960 frames (10.2 s), so larger values are clamped there; CUDA keeps the full range.", "required": false, "min": 256, "max": 8192, "default": 2048 }], "load": [] };
const package_defaults$1s = { "download": { "kind": "huggingface_snapshot", "repo": "trklou/audio.cpp", "revision": "main", "gated": false } };
const packages$1I = [{ "id": "habibi_unified", "display_name": "Habibi-TTS Unified (Arabic, multi-dialect)", "description": "Unified multi-dialect Arabic checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32).", "default": true, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Unified", "files": ["habibi-unified/habibi-unified-orig.gguf", "habibi-unified/vocab.txt"], "strip_prefix": "habibi-unified" }, { "id": "vocos_mel_24khz", "display_name": "Vocos mel 24kHz vocoder (GGUF)", "description": "Standalone Vocos vocoder GGUF for use with the original safetensors checkpoints.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "vocos-mel-24khz", "files": ["vocos-mel-24khz/vocos-mel-24khz-orig.gguf"], "strip_prefix": "vocos-mel-24khz" }, { "id": "habibi_alg", "display_name": "Habibi-TTS ALG specialized checkpoint (GGUF)", "description": "Single-dialect ALG checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32). Stronger ALG accent than the unified model.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Specialized/ALG", "files": ["habibi-alg/habibi-alg-orig.gguf", "habibi-alg/vocab.txt"], "strip_prefix": "habibi-alg" }, { "id": "habibi_egy", "display_name": "Habibi-TTS EGY specialized checkpoint (GGUF)", "description": "Single-dialect EGY checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32). Stronger EGY accent than the unified model.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Specialized/EGY", "files": ["habibi-egy/habibi-egy-orig.gguf", "habibi-egy/vocab.txt"], "strip_prefix": "habibi-egy" }, { "id": "habibi_irq", "display_name": "Habibi-TTS IRQ specialized checkpoint (GGUF)", "description": "Single-dialect IRQ checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32). Stronger IRQ accent than the unified model.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Specialized/IRQ", "files": ["habibi-irq/habibi-irq-orig.gguf", "habibi-irq/vocab.txt"], "strip_prefix": "habibi-irq" }, { "id": "habibi_mar", "display_name": "Habibi-TTS MAR specialized checkpoint (GGUF)", "description": "Single-dialect MAR checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32). Stronger MAR accent than the unified model.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Specialized/MAR", "files": ["habibi-mar/habibi-mar-orig.gguf", "habibi-mar/vocab.txt"], "strip_prefix": "habibi-mar" }, { "id": "habibi_msa", "display_name": "Habibi-TTS MSA specialized checkpoint (GGUF)", "description": "Single-dialect MSA checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32). Stronger MSA accent than the unified model.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Specialized/MSA", "files": ["habibi-msa/habibi-msa-orig.gguf", "habibi-msa/vocab.txt"], "strip_prefix": "habibi-msa" }, { "id": "habibi_sau", "display_name": "Habibi-TTS SAU specialized checkpoint (GGUF)", "description": "Single-dialect SAU checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32). Stronger SAU accent than the unified model.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Specialized/SAU", "files": ["habibi-sau/habibi-sau-orig.gguf", "habibi-sau/vocab.txt"], "strip_prefix": "habibi-sau" }, { "id": "habibi_uae", "display_name": "Habibi-TTS UAE specialized checkpoint (GGUF)", "description": "Single-dialect UAE checkpoint from SWivid/Habibi-TTS, converted to GGUF (DiT transformer + Vocos vocoder namespaces, f32). Stronger UAE accent than the unified model.", "default": false, "format": "gguf", "precision": "orig", "target_directory": "Habibi-TTS/Specialized/UAE", "files": ["habibi-uae/habibi-uae-orig.gguf", "habibi-uae/vocab.txt"], "strip_prefix": "habibi-uae" }];
const dependencies$1k = [];
const ui$1H = { "recommended_package": "habibi_unified", "tags": ["TTS", "Clone"], "docs": ["docs/models/f5_tts.md"] };
const sources$1H = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "vocab": "model:vocab.txt" }, "tensors": { "transformer": { "source": "weights:", "prefix": "transformer" } }, "optional_tensors": { "vocos_vocoder": { "source": "weights:", "prefix": "vocos" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "vocab": "model:vocab.txt" }, "tensors": { "transformer": { "source": "model:model_200000.safetensors", "prefix": "ema_model.transformer" } } }];
const __vite_glob_0_26 = {
  schema_version: schema_version$1k,
  family: family$1H,
  display_name: display_name$1H,
  description: description$1H,
  category: category$1H,
  status: status$1H,
  tasks: tasks$1H,
  modes: modes$1H,
  languages: languages$1H,
  runtime: runtime$1H,
  capabilities: capabilities$1H,
  options: options$1H,
  package_defaults: package_defaults$1s,
  packages: packages$1I,
  dependencies: dependencies$1k,
  ui: ui$1H,
  sources: sources$1H
};
const schema_version$1j = 1;
const family$1G = "firered_audio";
const display_name$1G = "FireRedAudio";
const description$1G = "FireRedAudio native GGUF package for generation paths backed by a Qwen3.5 hybrid backbone, FireRed RedAE conditioning, RedPatchEncoder, RedDiT latent flow, and RedAE waveform decoding.";
const category$1G = "tts";
const status$1G = "experimental";
const tasks$1G = ["asr", "tts", "clone", "design", "edit"];
const modes$1G = ["offline"];
const languages$1G = ["zh", "en"];
const runtime$1G = { "tags": ["gguf"] };
const dependencies$1j = [];
const capabilities$1G = { "tts": ["speaker_reference", "style_control"], "clone": ["speaker_reference"], "design": ["voice_design"], "edit": ["prompt_editing"] };
const options$1G = { "request": [{ "name": "template_name", "type": "enum", "description": "Defaults to voice_design for design, acoustic_edit for generation with input audio, tts_clone for other generation, and asr for ASR.", "required": false, "values": ["tts_clone", "voice_design", "semantic_edit", "acoustic_edit", "asr", "understand"] }, { "name": "reference_text", "type": "string", "description": "Transcript for the prompt audio used by tts_clone.", "required": false }, { "name": "instruct", "type": "string", "description": "Voice/delivery conditioning for generation. ASR/understanding uses the text input as its task prompt, not this option.", "required": false }, { "name": "language", "type": "string", "description": "FireRedAudio generation language tag.", "required": false, "default": "zh" }, { "name": "num_inference_steps", "type": "int", "description": "FireRedAudio DiT flow steps per generated latent patch.", "required": false, "min": 1, "default": 10 }, { "name": "guidance_scale", "type": "float", "description": "FireRedAudio DiT classifier-free guidance scale. Must be > 0.", "required": false, "min": 0, "default": 2 }, { "name": "max_audio_steps", "type": "int", "description": "Maximum generated RedAE latent patches.", "required": false, "min": 1, "default": 750 }, { "name": "min_audio_steps", "type": "int", "description": "Minimum generated RedAE latent patches before eosp can stop generation.", "required": false, "min": 0, "default": 6 }, { "name": "max_text_tokens", "type": "int", "description": "Maximum text-mode tokens before audio mode.", "required": false, "min": 1, "default": 512 }, { "name": "max_tokens", "type": "int", "description": "Output token budget; defaults to 300, or 1024 for understand with enable_thinking=true.", "required": false, "min": 1 }, { "name": "enable_thinking", "type": "bool", "description": "Leave the understanding think block open for chain-of-thought style answers.", "required": false, "default": false }, { "name": "top_k", "type": "int", "description": "Text sampling top-k for understanding.", "required": false, "min": 0, "default": 20 }, { "name": "top_p", "type": "float", "description": "Text sampling top-p for understanding.", "required": false, "min": 0, "max": 1, "default": 0.8 }, { "name": "temperature", "type": "float", "description": "Text sampling temperature for understanding. Understanding-mode sampling requires a positive value; zero does not select greedy decoding.", "required": false, "min": 0, "default": 0.7 }, { "name": "seed", "type": "int", "description": "Unsigned 32-bit generation seed in [0, 4294967295]; default 1234.", "required": false, "min": 0, "max": 4294967295, "default": 1234 }], "session": [{ "name": "weight_type", "type": "enum", "description": "FireRedAudio weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "graph_arena_mb", "type": "int", "description": "Main runtime graph arena size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_context_mb", "type": "int", "description": "Weight loading context size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; set 0 to disable reuse.", "required": false, "min": 0, "default": 2 }, { "name": "mem_saver", "type": "bool", "description": "Release cached runtime graphs after each request to reduce peak VRAM; default false.", "required": false, "default": false }], "load": [] };
const packages$1H = [{ "id": "firered_audio_orig", "display_name": "FireRedAudio Orig GGUF", "format": "gguf", "precision": "orig", "target_directory": "FireRedAudio-GGUF", "files": ["FireRedAudio-GGUF/firered-audio-orig.gguf"], "strip_prefix": "FireRedAudio-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "firered_audio_q8_0", "display_name": "FireRedAudio Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "FireRedAudio-GGUF", "files": ["FireRedAudio-GGUF/firered-audio-q8_0.gguf"], "strip_prefix": "FireRedAudio-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }];
const ui$1G = { "recommended_package": "firered_audio_q8_0", "tags": ["TTS", "Clone", "Design", "GGUF"], "docs": ["docs/models/firered_audio.md", "docs/gguf.md"] };
const sources$1G = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "processor_config": "model:processor_config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model" }, "redae_decoder_weights": { "source": "weights:", "prefix": "redae_decoder" } } }];
const __vite_glob_0_27 = {
  schema_version: schema_version$1j,
  family: family$1G,
  display_name: display_name$1G,
  description: description$1G,
  category: category$1G,
  status: status$1G,
  tasks: tasks$1G,
  modes: modes$1G,
  languages: languages$1G,
  runtime: runtime$1G,
  dependencies: dependencies$1j,
  capabilities: capabilities$1G,
  options: options$1G,
  packages: packages$1H,
  ui: ui$1G,
  sources: sources$1G
};
const schema_version$1i = 1;
const family$1F = "firered_vad";
const display_name$1F = "FireRed VAD";
const description$1F = "DFSMN speech activity detection with offline and causal Stream-VAD checkpoints.";
const category$1F = "audio_tools";
const status$1F = "experimental";
const tasks$1F = ["vad"];
const modes$1F = ["offline", "streaming"];
const languages$1F = ["language_agnostic"];
const capabilities$1F = { "vad": ["speech_segments"] };
const runtime$1F = { "tags": ["gguf"] };
const options$1F = { "request": [{ "name": "threshold", "type": "float", "description": "Speech probability threshold; defaults to 0.4 for VAD and 0.5 for Stream-VAD.", "required": false, "min": 0, "max": 1 }, { "name": "smooth_window_ms", "type": "int", "description": "Trailing probability smoothing window in milliseconds, rounded to the nearest 10 ms. Validation occurs after conversion to 10-ms frames; metadata bounds describe intended settings.", "required": false, "default": 50, "min": 10 }, { "name": "min_speech_duration_ms", "type": "int", "description": "Speech confirmation duration, rounded to the nearest 10 ms; defaults to 200 ms for VAD and 80 ms for Stream-VAD. Validation occurs after conversion to 10-ms frames; metadata bounds describe intended settings.", "required": false, "min": 10 }, { "name": "max_speech_duration_sec", "type": "float", "description": "Maximum speech duration in seconds, rounded to the nearest 10 ms. Validation occurs after conversion to 10-ms frames; metadata bounds describe intended settings.", "required": false, "default": 20, "min": 0.02 }, { "name": "min_silence_duration_ms", "type": "int", "description": "Silence confirmation duration in milliseconds, rounded to the nearest 10 ms. Validation occurs after conversion to 10-ms frames; metadata bounds describe intended settings.", "required": false, "default": 200, "min": 0 }, { "name": "merge_silence_duration_ms", "type": "int", "description": "Merge shorter internal silence gaps in offline VAD; milliseconds rounded to the nearest 10 ms.", "required": false, "default": 0, "min": 0 }, { "name": "speech_pad_ms", "type": "int", "description": "Extend offline VAD segments on each side; milliseconds rounded to the nearest 10 ms.", "required": false, "default": 0, "min": 0 }, { "name": "speech_start_pad_ms", "type": "int", "description": "Stream-VAD start padding in milliseconds, rounded to the nearest 10 ms and at least the smoothing window.", "required": false, "default": 50, "min": 0 }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum network duration per offline chunk in seconds, rounded to the nearest 10 ms; each chunk resets network history, matching upstream.", "required": false, "default": 300, "min": 0.01 }], "session": [], "load": [] };
const package_defaults$1r = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1G = [{ "id": "firered_vad_f32", "display_name": "FireRed VAD GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "FireRedVAD-GGUF", "files": ["FireRedVAD-GGUF/firered-vad-f32.gguf"], "strip_prefix": "FireRedVAD-GGUF" }, { "id": "firered_stream_vad_f32", "display_name": "FireRed Stream-VAD GGUF F32", "format": "gguf", "precision": "f32", "target_directory": "FireRedVAD-GGUF", "files": ["FireRedVAD-GGUF/firered-stream-vad-f32.gguf"], "strip_prefix": "FireRedVAD-GGUF" }];
const dependencies$1i = [];
const ui$1F = { "tags": ["VAD", "GGUF"], "docs": ["docs/models/firered_vad.md"], "recommended_package": "firered_vad_f32" };
const sources$1F = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_28 = {
  schema_version: schema_version$1i,
  family: family$1F,
  display_name: display_name$1F,
  description: description$1F,
  category: category$1F,
  status: status$1F,
  tasks: tasks$1F,
  modes: modes$1F,
  languages: languages$1F,
  capabilities: capabilities$1F,
  runtime: runtime$1F,
  options: options$1F,
  package_defaults: package_defaults$1r,
  packages: packages$1G,
  dependencies: dependencies$1i,
  ui: ui$1F,
  sources: sources$1F
};
const schema_version$1h = 1;
const family$1E = "fireredtts3";
const display_name$1E = "FireRedTTS3";
const description$1E = "FireRedTTS3 family for Base zero-shot voice cloning and Instruct instruction-conditioned TTS, voice design, semantic edit, and acoustic edit with Qwen3 autoregressive hidden-state generation, FireRed DiT latent patch flow, and RedAE waveform decoding.";
const category$1E = "tts";
const status$1E = "experimental";
const tasks$1E = ["tts", "clone", "design"];
const modes$1E = ["offline"];
const languages$1E = ["Chinese", "English", "Cantonese", "Japanese", "Korean", "Spanish", "French", "Russian", "Arabic", "Turkish", "Indonesian", "Portuguese", "Italian", "Dutch", "Vietnamese", "German", "Ukrainian", "Thai", "Polish", "Romanian", "Greek", "Czech", "Finnish", "Hindi", "ZH_Anhui", "ZH_Fujian", "ZH_Gansu", "ZH_Guizhou", "ZH_Hebei", "ZH_Henan", "ZH_Hubei", "ZH_Hunan", "ZH_Jiangxi", "ZH_Liaoning", "ZH_Minnan", "ZH_Ningxia", "ZH_Shaanxi", "ZH_Shandong", "ZH_Shanghai", "ZH_Shanxi", "ZH_Sichuan", "ZH_Tianjin", "ZH_Wenzhou", "ZH_Wu", "ZH_Yunnan"];
const runtime$1E = { "tags": ["gguf"] };
const dependencies$1h = [];
const capabilities$1E = { "tts": ["speaker_reference", "style_control"], "clone": ["speaker_reference", "style_control"], "design": ["voice_design"] };
const options$1E = { "request": [{ "name": "template_name", "type": "enum", "description": "Instruct template; defaults to acoustic_edit with input audio, otherwise instruct_tts.", "required": false, "values": ["instruct_tts", "voice_design", "semantic_edit", "acoustic_edit"] }, { "name": "reference_text", "type": "string", "description": "Transcript for the prompt audio.", "required": false }, { "name": "instruct", "type": "string", "description": "FireRedTTS3 instruction for voice design or edit tasks.", "required": false }, { "name": "language", "type": "string", "description": "Language tag used by FireRedTTS3.", "required": false, "default": "Chinese" }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 80 when hanzi, kana and Hangul outnumber other letters and digits (except edits), otherwise 600.", "required": false, "min": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "num_inference_steps", "type": "int", "description": "FireRed DiT flow steps per generated latent patch.", "required": false, "min": 1, "default": 10 }, { "name": "guidance_scale", "type": "float", "description": "Positive guidance scale; defaults to 1.2 for voice-design/semantic-edit/acoustic-edit templates and 2 otherwise.", "required": false, "min": 0 }, { "name": "stop_threshold", "type": "float", "description": "Stop probability threshold for AR patch generation.", "required": false, "min": 0, "max": 1, "default": 0.5 }, { "name": "seed", "type": "int", "description": "Unsigned 32-bit sampling seed in [0, 4294967295]; defaults to 2 for voice design and 1234 otherwise.", "required": false, "min": 0, "max": 4294967295 }], "session": [{ "name": "weight_type", "type": "enum", "description": "FireRedTTS3 weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "graph_arena_mb", "type": "int", "description": "Main runtime graph arena size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "helper_graph_arena_mb", "type": "int", "description": "Helper graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "weight_context_mb", "type": "int", "description": "Weight loading context size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; set 0 to disable reuse. Applies only to Base; Instruct does not use this cache.", "required": false, "min": 0, "default": 4 }, { "name": "mem_saver", "type": "bool", "description": "Release cached runtime graphs after each request to reduce peak VRAM; default false.", "required": false, "default": false }], "load": [] };
const packages$1F = [{ "id": "fireredtts3_instruct_orig", "display_name": "FireRedTTS3 Instruct Orig GGUF", "format": "gguf", "precision": "orig", "target_directory": "FireRedTTS3-Instruct-GGUF", "files": ["FireRedTTS3-Instruct-GGUF/fireredtts3-instruct-orig.gguf"], "strip_prefix": "FireRedTTS3-Instruct-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "fireredtts3_instruct_q8_0", "display_name": "FireRedTTS3 Instruct Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "FireRedTTS3-Instruct-GGUF", "files": ["FireRedTTS3-Instruct-GGUF/fireredtts3-instruct-q8_0.gguf"], "strip_prefix": "FireRedTTS3-Instruct-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "fireredtts3_base_orig", "display_name": "FireRedTTS3 Base Orig GGUF", "format": "gguf", "precision": "orig", "target_directory": "FireRedTTS3-Base-GGUF", "files": ["FireRedTTS3-Base-GGUF/fireredtts3-base-orig.gguf"], "strip_prefix": "FireRedTTS3-Base-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "fireredtts3_base_q8_0", "display_name": "FireRedTTS3 Base Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "FireRedTTS3-Base-GGUF", "files": ["FireRedTTS3-Base-GGUF/fireredtts3-base-q8_0.gguf"], "strip_prefix": "FireRedTTS3-Base-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }];
const ui$1E = { "recommended_package": "fireredtts3_instruct_q8_0", "tags": ["TTS", "Clone", "Design", "GGUF"], "docs": ["docs/models/fireredtts3.md", "docs/gguf.md"] };
const sources$1E = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "redae_config": "model:redae/config.json", "tokenizer_json": "model:text_tokenizer/tokenizer.json", "tokenizer_config": "model:text_tokenizer/tokenizer_config.json", "vocab_json": "model:text_tokenizer/vocab.json" }, "optional_files": { "base_config": "model:fireredtts3_base/config.json", "instruct_config": "model:fireredtts3_instruct/config.json" }, "tensors": { "redae_weights": { "source": "weights:", "prefix": "redae" } }, "optional_tensors": { "base_weights": { "source": "weights:", "prefix": "base" }, "campplus_weights": { "source": "weights:", "prefix": "campplus" }, "instruct_weights": { "source": "weights:", "prefix": "instruct" } } }];
const __vite_glob_0_29 = {
  schema_version: schema_version$1h,
  family: family$1E,
  display_name: display_name$1E,
  description: description$1E,
  category: category$1E,
  status: status$1E,
  tasks: tasks$1E,
  modes: modes$1E,
  languages: languages$1E,
  runtime: runtime$1E,
  dependencies: dependencies$1h,
  capabilities: capabilities$1E,
  options: options$1E,
  packages: packages$1F,
  ui: ui$1E,
  sources: sources$1E
};
const family$1D = "fish_audio";
const display_name$1D = "Fish Audio S2 Pro";
const description$1D = "Fish Audio S2 Pro text-to-speech model for expressive speech across 80+ languages, with automatic language handling, inline prosody/emotion controls, and rapid voice cloning from short reference samples.";
const category$1D = "tts";
const status$1D = "supported";
const tasks$1D = ["tts", "clone"];
const modes$1D = ["offline", "streaming"];
const languages$1D = ["80+ languages"];
const capabilities$1D = { "clone": ["speaker_reference"] };
const runtime$1D = { "tags": ["gguf"] };
const options$1D = { "request": [{ "name": "reference_text", "type": "string", "description": "Reference transcript; required with inline reference audio.", "required": false }, { "name": "multi_reference_cond", "type": "string", "description": 'Fish Audio ordered JSON array of reference conditioning pairs for one generated speaker: [{"audio":"ref1.wav","text":"Transcript one."},{"audio":"ref2.wav","text":"Transcript two."}]. This is not a multi-speaker dialogue routing option.', "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum Fish Audio semantic tokens to generate; default 1024. Zero selects the default token budget.", "required": false, "min": 0, "default": 1024 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per generated text chunk; default 200.", "required": false, "min": 1, "default": 200 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode; default word_budget.", "preset": "text_chunk_mode_full", "required": false, "default": "word_budget" }, { "name": "top_p", "type": "float", "description": "Top-p sampling value in (0, 1]; default 0.8.", "required": false, "min": 0, "max": 1, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "Top-k sampling value; default 30.", "required": false, "min": 1, "default": 30 }, { "name": "temperature", "type": "float", "description": "Semantic-token sampling temperature in (0, 2); default 0.8.", "required": false, "min": 0, "max": 2, "default": 0.8 }, { "name": "seed", "type": "int", "description": "Sampling seed for reproducible output; omitted uses a random seed.", "required": false, "min": 0 }], "session": [{ "name": "lora", "type": "path", "description": "Prepared Fish Speech adapter checkpoint; merged into slow/fast decoder and embedding weights at session creation. Codec weights are unchanged.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's alpha/r scaling; default 1.", "required": false, "default": 1 }, { "name": "mem_saver", "type": "bool", "description": "Release cached AR runtime graphs after each request; default false.", "required": false, "default": false }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; default 1.", "required": false, "min": 0, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "AR matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "codec_weight_type", "type": "enum", "description": "Codec conv/matmul weight storage type; default native.", "preset": "weight_type_codec_q8", "required": false, "default": "native" }, { "name": "codec_encoder_bf16_compute", "type": "bool", "description": "Use BF16 reference-encoder arithmetic on CUDA with F16/BF16 codec weights; default false. Decoding is unchanged.", "required": false, "default": false }, { "name": "ar_graph_arena_mb", "type": "int", "description": "AR runtime graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "ar_weight_context_mb", "type": "int", "description": "AR weight context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "codec_graph_arena_mb", "type": "int", "description": "Codec encode/decode graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "codec_weight_context_mb", "type": "int", "description": "Codec weight context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }], "load": [] };
const ui$1D = { "recommended_package": "fish_audio_s2_pro_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const package_defaults$1q = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1E = [{ "id": "fish_audio_s2_pro_q8_0", "display_name": "Fish Audio S2 Pro Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Fish-Audio-S2-Pro-GGUF", "files": ["Fish-Audio-S2-Pro-GGUF/fish-audio-s2-pro-q8_0.gguf"], "strip_prefix": "Fish-Audio-S2-Pro-GGUF" }, { "id": "fish_audio_s2_pro_bf16", "display_name": "Fish Audio S2 Pro BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Fish-Audio-S2-Pro-GGUF", "files": ["Fish-Audio-S2-Pro-GGUF/fish-audio-s2-pro-bf16.gguf"], "strip_prefix": "Fish-Audio-S2-Pro-GGUF" }];
const sources$1D = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "codec_weights": { "source": "weights:", "prefix": "codec_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "model_weights": "model:model_audio_cpp.safetensors.index.json", "codec_weights": "model:codec.safetensors" } }];
const __vite_glob_0_30 = {
  family: family$1D,
  display_name: display_name$1D,
  description: description$1D,
  category: category$1D,
  status: status$1D,
  tasks: tasks$1D,
  modes: modes$1D,
  languages: languages$1D,
  capabilities: capabilities$1D,
  runtime: runtime$1D,
  options: options$1D,
  ui: ui$1D,
  package_defaults: package_defaults$1q,
  packages: packages$1E,
  sources: sources$1D
};
const family$1C = "fish_drama3";
const display_name$1C = "Fish Audio Drama 3";
const description$1C = "Fish Audio Drama 3 native MoE speech generation, voice cloning, and continuation.";
const category$1C = "tts";
const status$1C = "experimental";
const tasks$1C = ["tts", "clone"];
const modes$1C = ["offline", "streaming"];
const languages$1C = ["auto"];
const capabilities$1C = { "tts": ["long_form"], "clone": ["speaker_reference"] };
const runtime$1C = { "tags": ["gguf"] };
const options$1C = { "request": [{ "name": "encode_reference_only", "type": "bool", "description": "Prepare reference VQ codes without generating speech. Use the task API to receive drama3_reference_v1 acoustic-token artifacts.", "required": false, "default": false }, { "name": "reference_text", "type": "string", "description": "Transcript of inline reference audio.", "required": false }, { "name": "multi_reference_cond", "type": "string", "description": "Ordered references as JSON: [{text, audio_path or vq_codes}]. Speaker tags 0..15 select voices.", "required": false }, { "name": "references", "type": "string", "description": "Alias of multi_reference_cond.", "required": false }, { "name": "previous_takes", "type": "string", "description": "Continuation/edit history as a JSON array of {text, vq_codes or audio_path}; a string generates that earlier take first.", "required": false }, { "name": "previous_takes_file", "type": "string", "description": "JSON history file containing a take object or an ordered array of earlier takes. Avoids the Windows command-line length limit for VQ grids.", "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum generated acoustic frames per text chunk (about 21.5 frames/second).", "required": false, "min": 1, "default": 1024 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per long-form chunk.", "required": false, "min": 1, "default": 128 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "required": false, "preset": "text_chunk_mode_full", "default": "tag_aware" }, { "name": "temperature", "type": "float", "description": "Main and residual sampling temperature. Zero makes the initial draws greedy; semantic repeat redraws retain the fixed Drama 3 RAS settings.", "required": false, "min": 0, "default": 1 }, { "name": "top_p", "type": "float", "description": "Inclusive nucleus cutoff before top-k filtering, matching Drama 3.", "required": false, "min": 0, "max": 1, "default": 0.9 }, { "name": "top_k", "type": "int", "description": "Top-k candidate count. The default 4097 keeps every candidate (no cap), as Fish's Drama 3 Space does; 30 can stall in long silences.", "required": false, "min": 1, "default": 4097 }, { "name": "seed", "type": "int", "description": "Reproducible native sampling seed.", "required": false, "min": 0 }], "session": [{ "name": "perf_mode", "type": "enum", "description": "AR decode preset. cuda_perf enables fused MoE, 256-row attention buckets and device sampling. F16 KV storage, codec batching/overlap and prefill-cache defaults remain unchanged in both modes. Explicit session options override the preset.", "required": false, "values": ["off", "cuda_perf"], "default": "off" }, { "name": "fused_moe", "type": "bool", "description": "Fuse cached backbone MoE routing and SwiGLU activations. Fused arithmetic may change sampled output; prompt prefill is unchanged.", "required": false, "default": false }, { "name": "kv_cache_alignment", "type": "int", "description": "Cached decode attention prefix bucket size. Values above 1 retain all history while skipping unused KV capacity; execution shapes may change numerical results.", "required": false, "min": 1, "default": 1 }, { "name": "kv_cache_type", "type": "enum", "description": "Storage precision for full-attention backbone KV caches.", "required": false, "values": ["f32", "f16"], "default": "f16" }, { "name": "backbone_prefill_cache_mb", "type": "int", "description": "Bounded cache of backbone prefill graphs, in MiB. Reuses exact shapes and their CUDA captures. One active graph is retained even if larger than this budget. Zero retains only the active graph.", "required": false, "min": 0, "max": 4096, "default": 256 }, { "name": "tower_prefill_cache_mb", "type": "int", "description": "Bounded cache of audio-tower prefill graphs, in MiB. Reuses exact shapes and their CUDA captures. Zero disables it.", "required": false, "min": 0, "max": 4096, "default": 256 }, { "name": "codec_batch_frames", "type": "int", "description": "Streaming codec batch ceiling. Starts at one frame and grows to this size; partial final batches are flushed. Offline decoding is unchanged.", "required": false, "min": 1, "default": 4 }, { "name": "codec_async_decode", "type": "bool", "description": "Overlap streaming codec decoding with AR generation on the dedicated codec backend. Uses a bounded queue and waits for all audio before completing the request.", "required": false, "default": true }, { "name": "device_sampling", "type": "bool", "description": "Enable tower decode and codebook sampling in one cached backend graph. Disabled by default; enabled by cuda_perf unless explicitly overridden. Uses F32 probabilities; sampled outputs may differ from the host sampler.", "required": false, "default": false }, { "name": "profile_first_audio", "type": "bool", "description": "Emit first-audio stage timings to stderr for performance diagnosis. Disabled by default.", "required": false, "default": false }, { "name": "context_length", "type": "int", "description": "Cache capacity for prompt plus generated frames; includes references and history.", "required": false, "min": 1, "default": 2048 }, { "name": "cpu_expert_layers", "type": "int", "description": "Number of the 40 expert banks kept and evaluated on CPU; use 4 for a 24 GB profile or 24 for a 16 GB profile. Dense layers and the tower use the selected backend.", "required": false, "min": 0, "max": 40, "default": 4 }, { "name": "disk_experts", "type": "bool", "description": "Read routed expert weights from GGUF on demand into a bounded cache instead of keeping full expert banks resident. Trades speed for memory; default false.", "required": false, "default": false }, { "name": "pin_experts", "type": "bool", "description": "Keep full expert banks in pinned host RAM for direct cache-miss uploads. Requires disk_experts and pinned host-buffer support; default false.", "required": false, "default": false }, { "name": "expert_cache_size", "type": "int", "description": "Resident expert slots per layer in disk_experts mode; 8 to 256. Larger caches trade memory for fewer disk reads; ignored in resident mode.", "required": false, "min": 8, "max": 256, "default": 32 }, { "name": "disk_expert_read_threads", "type": "int", "description": "Host workers for copying selected GGUF experts into staging when disk_experts is enabled and pin_experts is false. Default 1 preserves serial reads; values above 1 use OpenMP or Apple dispatch.", "required": false, "min": 1, "max": 64, "default": 1 }, { "name": "codec_encoder_f32_accumulation", "type": "bool", "description": "Use F32 accumulation for F16 reference-encoder GEMMs on Vulkan. Try this if voice cloning produces incomplete speech or reaches the token limit. Other backends and codec decoding are unchanged.", "required": false, "default": false }, { "name": "codec_encoder_bf16_compute", "type": "bool", "description": "Use BF16 reference-encoder arithmetic on CUDA with F16/BF16 codec weights; default true. Decoding is unchanged.", "required": false, "default": true }, { "name": "codec_encoder_chunk_samples", "type": "int", "description": "Reference-encoder convolution chunk size in samples at the codec sample rate. Use 0 for full encoding or a positive multiple of 512; default 0.", "required": false, "min": 0, "default": 0 }, { "name": "codec_backend", "type": "enum", "description": "Run the codec on the selected backend or on CPU.", "required": false, "values": ["same", "cpu"], "default": "same" }], "load": [] };
const ui$1C = { "recommended_package": "fish_drama3_q4_experts_q8_backbone", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/fish_drama3.md", "docs/gguf.md"] };
const package_defaults$1p = { "download": { "kind": "huggingface_snapshot", "repo": "Jmica/Drama-3-GGUF", "revision": "main", "gated": false } };
const packages$1D = [{ "id": "fish_drama3_q4_experts_q8_backbone", "display_name": "Drama 3 Q4_K experts / Q8_0 backbone", "description": "Mixed quantization with Q4_K routed experts, Q8_0 backbone matrices, and FP16 audio tower/codec.", "default": true, "format": "gguf", "precision": "q4_k", "target_directory": "Drama-3-GGUF", "files": ["drama-3-backbone-8bit-experts-Q4_K_S.gguf"] }, { "id": "fish_drama3_q3_experts_q8_backbone", "display_name": "Drama 3 Q3_K experts / Q8_0 backbone", "description": "Mixed quantization with Q3_K routed experts, Q8_0 backbone matrices, and FP16 audio tower/codec. Experimental delivery quality.", "format": "gguf", "precision": "q3_k_s", "target_directory": "Drama-3-GGUF", "files": ["drama-3-backbone-8bit-experts-Q3_K_S.gguf"] }, { "id": "fish_drama3_q2_experts_q8_backbone", "display_name": "Drama 3 Q2_K experts / Q8_0 backbone", "description": "Mixed quantization with Q2_K routed experts, Q8_0 backbone matrices, and FP16 audio tower/codec. Use the documented CPU offload settings for smaller GPUs.", "format": "gguf", "precision": "q2_k", "target_directory": "Drama-3-GGUF", "files": ["drama-3-backbone-8bit-experts-Q2_K.gguf"] }, { "id": "fish_drama3_q4_backbone", "display_name": "Drama 3 Q4_K experts / Q4_K backbone", "description": "Q4_K routed experts and backbone matrices, Q4_0 text embedding, and FP16 audio tower/codec. Experimental delivery quality.", "format": "gguf", "precision": "q4_k", "target_directory": "Drama-3-GGUF", "files": ["drama-3-backbone-4bit-experts-Q4_K_S.gguf"] }, { "id": "fish_drama3_small_iq3_xxs", "display_name": "Drama3-small IQ3_XXS", "format": "gguf", "precision": "iq3_xxs", "target_directory": "Drama3-small-GGUF", "files": ["drama3-small-IQ3_XXS.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "pentacoxian-dev/drama3-small-GGUF", "revision": "main", "gated": false } }];
const sources$1C = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "codec_weights": { "source": "weights:", "prefix": "codec_weights" } } }];
const schema_version$1g = 1;
const dependencies$1g = [];
const __vite_glob_0_31 = {
  family: family$1C,
  display_name: display_name$1C,
  description: description$1C,
  category: category$1C,
  status: status$1C,
  tasks: tasks$1C,
  modes: modes$1C,
  languages: languages$1C,
  capabilities: capabilities$1C,
  runtime: runtime$1C,
  options: options$1C,
  ui: ui$1C,
  package_defaults: package_defaults$1p,
  packages: packages$1D,
  sources: sources$1C,
  schema_version: schema_version$1g,
  dependencies: dependencies$1g
};
const schema_version$1f = 1;
const family$1B = "fun_asr_nano";
const display_name$1B = "Fun-ASR-Nano";
const description$1B = "Offline multilingual speech recognition with the FunAudioLLM Fun-ASR-Nano-2512 model.";
const category$1B = "asr";
const status$1B = "wip";
const tasks$1B = ["asr"];
const modes$1B = ["offline"];
const languages$1B = ["auto", "zh", "en", "ja"];
const capabilities$1B = {};
const options$1B = { "request": [{ "name": "language", "type": "string", "description": "Recognition language, or auto to let the model infer it.", "required": false, "default": "auto" }, { "name": "enable_itn", "type": "bool", "description": "Enable inverse text normalization in the transcription prompt.", "required": false, "default": true }, { "name": "max_tokens", "type": "int", "description": "Maximum number of generated transcript tokens.", "required": false, "min": 1, "default": 512 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Audio chunking mode: auto, fixed, or none.", "values": ["auto", "fixed", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Fixed chunk duration in seconds. Must be finite and positive, rounding to at least one input sample.", "required": false, "default": 30 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared model weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "encoder_weight_type", "type": "enum", "description": "Encoder matmul storage; inherits weight_type when omitted.", "required": false, "preset": "weight_type_full" }, { "name": "adaptor_weight_type", "type": "enum", "description": "Adaptor matmul storage; inherits weight_type when omitted.", "required": false, "preset": "weight_type_full" }, { "name": "decoder_weight_type", "type": "enum", "description": "Decoder matmul storage. Without an explicit override, CUDA promotes shared native/f16/q8_0 storage to bf16; other backends inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "encoder_graph_arena_mb", "type": "int", "description": "Encoder graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 512 }, { "name": "adaptor_graph_arena_mb", "type": "int", "description": "Adaptor graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 128 }, { "name": "decoder_prefill_graph_arena_mb", "type": "int", "description": "Decoder prefill graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 256 }, { "name": "decoder_decode_graph_arena_mb", "type": "int", "description": "Decoder cached-step graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 128 }, { "name": "decoder_weight_context_mb", "type": "int", "description": "Decoder weight metadata context. Size in MiB; must be positive.", "required": false, "min": 1, "default": 32 }], "load": [] };
const runtime$1B = { "tags": ["gguf", "server", "cuda", "metal", "cpu"] };
const packages$1C = [{ "id": "fun_asr_nano_2512_q8_0", "display_name": "Fun-ASR-Nano-2512 Q8_0 GGUF", "description": "Standalone audio.cpp GGUF built from the pinned official checkpoint; governed by the FunASR Model Open Source License Agreement v1.1.", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Fun-ASR-Nano-2512-GGUF", "files": ["fun-asr-nano-2512-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "FunAudioLLM/Fun-ASR-Nano-2512-GGUF", "revision": "ce72677f84900f0dc57f498ace253bfb3c9155b6", "gated": false } }, { "id": "fun_asr_nano_2512_f16", "display_name": "Fun-ASR-Nano-2512 F16 GGUF", "description": "Standalone audio.cpp GGUF built from the pinned official checkpoint; governed by the FunASR Model Open Source License Agreement v1.1.", "format": "gguf", "precision": "f16", "target_directory": "Fun-ASR-Nano-2512-GGUF", "files": ["fun-asr-nano-2512-f16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "FunAudioLLM/Fun-ASR-Nano-2512-GGUF", "revision": "ce72677f84900f0dc57f498ace253bfb3c9155b6", "gated": false } }, { "id": "fun_asr_nano_2512_safetensors", "display_name": "Fun-ASR-Nano-2512 HF Safetensors", "description": "Official checkpoint governed by the FunASR Model Open Source License Agreement v1.1.", "format": "safetensors", "precision": "native", "target_directory": "Fun-ASR-Nano-2512-hf", "files": ["chat_template.jinja", "config.json", "generation_config.json", "model.safetensors", "processor_config.json", "tokenizer.json", "tokenizer_config.json"], "download": { "kind": "huggingface_snapshot", "repo": "FunAudioLLM/Fun-ASR-Nano-2512-hf", "revision": "854d88f94205cd17d2afdb24332130d86fbe654a", "gated": false } }];
const dependencies$1f = [];
const ui$1B = { "recommended_package": "fun_asr_nano_2512_q8_0", "tags": ["ASR", "GGUF"], "docs": ["docs/asr.md", "docs/gguf.md"], "summary": "Offline Fun-ASR-Nano transcription from official safetensors or audio.cpp GGUF." };
const sources$1B = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "processor_config": "model:processor_config.json", "tokenizer_json": "model:tokenizer.json" }, "optional_files": { "chat_template_jinja": "model:chat_template.jinja", "tokenizer_config": "model:tokenizer_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "processor_config": "model:processor_config.json", "tokenizer_json": "model:tokenizer.json" }, "optional_files": { "chat_template_jinja": "model:chat_template.jinja", "tokenizer_config": "model:tokenizer_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_32 = {
  schema_version: schema_version$1f,
  family: family$1B,
  display_name: display_name$1B,
  description: description$1B,
  category: category$1B,
  status: status$1B,
  tasks: tasks$1B,
  modes: modes$1B,
  languages: languages$1B,
  capabilities: capabilities$1B,
  options: options$1B,
  runtime: runtime$1B,
  packages: packages$1C,
  dependencies: dependencies$1f,
  ui: ui$1B,
  sources: sources$1B
};
const schema_version$1e = 1;
const family$1A = "gigaam_asr";
const display_name$1A = "GigaAM ASR";
const description$1A = "GigaAM v3 and Multilingual Conformer speech recognition with CTC or RNN-T decoding.";
const category$1A = "asr";
const status$1A = "supported";
const tasks$1A = ["asr"];
const modes$1A = ["offline"];
const languages$1A = ["ru", "kk", "ky", "uz", "en"];
const capabilities$1A = { "asr": ["word_timestamps", "vad_chunking"] };
const dependencies$1e = [];
const options$1A = { "request": [{ "name": "return_timestamps", "type": "bool", "description": "Return word timestamps derived from decoder token emission frames.", "required": false, "default": false }, { "name": "audio_chunk_mode", "type": "enum", "description": "Long-form audio chunking mode.", "values": ["auto", "fixed", "quiet_energy", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum duration of each audio chunk in seconds.", "required": false, "min": 0.02, "max": 25, "default": 25 }], "session": [{ "name": "vad_model_path", "type": "path", "description": "Offline VAD model used only with audio_chunk_mode=vad.", "required": false, "default": "" }, { "name": "weight_type", "type": "enum", "description": "Weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }], "load": [] };
const runtime$1A = { "tags": ["gguf"] };
const ui$1A = { "recommended_package": "gigaam_v3_ctc_f16", "tags": ["ASR", "GGUF"], "docs": ["docs/models/gigaam_asr.md"] };
const package_defaults$1o = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1B = [{ "id": "gigaam_v3_ctc_f16", "display_name": "GigaAM v3 CTC F16 GGUF", "default": true, "format": "gguf", "precision": "f16", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-v3-ctc-f16.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }, { "id": "gigaam_v3_rnnt_f16", "display_name": "GigaAM v3 RNN-T F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-v3-rnnt-f16.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }, { "id": "gigaam_v3_e2e_ctc_f16", "display_name": "GigaAM v3 E2E CTC F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-v3-e2e-ctc-f16.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }, { "id": "gigaam_v3_e2e_rnnt_f16", "display_name": "GigaAM v3 E2E RNN-T F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-v3-e2e-rnnt-f16.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }, { "id": "gigaam_multilingual_ctc_f32", "display_name": "GigaAM Multilingual CTC F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-multilingual-ctc-f32.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }, { "id": "gigaam_multilingual_ctc_f16", "display_name": "GigaAM Multilingual CTC F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-multilingual-ctc-f16.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }, { "id": "gigaam_multilingual_large_ctc_f32", "display_name": "GigaAM Multilingual Large CTC F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-multilingual-large-ctc-f32.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }, { "id": "gigaam_multilingual_large_ctc_f16", "display_name": "GigaAM Multilingual Large CTC F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "GigaAM-ASR-GGUF", "files": ["GigaAM-ASR-GGUF/gigaam-multilingual-large-ctc-f16.gguf"], "strip_prefix": "GigaAM-ASR-GGUF" }];
const sources$1A = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:model.safetensors" } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_33 = {
  schema_version: schema_version$1e,
  family: family$1A,
  display_name: display_name$1A,
  description: description$1A,
  category: category$1A,
  status: status$1A,
  tasks: tasks$1A,
  modes: modes$1A,
  languages: languages$1A,
  capabilities: capabilities$1A,
  dependencies: dependencies$1e,
  options: options$1A,
  runtime: runtime$1A,
  ui: ui$1A,
  package_defaults: package_defaults$1o,
  packages: packages$1B,
  sources: sources$1A
};
const schema_version$1d = 1;
const family$1z = "glm_tts";
const display_name$1z = "GLM-TTS";
const description$1z = "Community Chinese-English zero-shot speech synthesis and voice cloning with native Llama, Whisper-VQ, Flow/DiT, CAMPPlus, and HiFT execution.";
const category$1z = "tts";
const status$1z = "community";
const tasks$1z = ["tts", "clone"];
const modes$1z = ["offline"];
const languages$1z = ["zh", "en"];
const capabilities$1z = { "clone": ["speaker_reference"] };
const options$1z = { "request": [{ "name": "reference_text", "type": "string", "description": "Transcript matching the reference voice audio; required by GLM-TTS zero-shot synthesis.", "required": true }, { "name": "max_tokens", "type": "int", "description": "Maximum generated speech tokens; otherwise the official 2x-to-20x text-token bounds are used. Nonpositive values select the automatic text-derived budget.", "required": false, "default": 0 }, { "name": "temperature", "type": "float", "description": "Speech-token temperature; official default 1.0. Nonpositive values select greedy decoding.", "required": false, "default": 1 }, { "name": "top_k", "type": "int", "description": "Speech-token top-k; official default 25. Nonpositive values disable top-k filtering.", "required": false, "default": 25 }, { "name": "top_p", "type": "float", "description": "Speech-token nucleus threshold; official default 0.8. Out-of-range values are not rejected by the parser.", "required": false, "default": 0.8 }, { "name": "seed", "type": "int", "description": "Speech-token, Flow-noise, and HiFT seed.", "required": false, "min": 0, "default": 0 }, { "name": "num_inference_steps", "type": "int", "description": "Flow Euler steps; defaults to model config, usually official default 10.", "required": false, "min": 1 }, { "name": "flow_guidance_scale", "type": "float", "description": "Flow classifier-free guidance rate; defaults to model config, usually official default 0.7. Negative values are accepted and enter the CFG formula.", "required": false }, { "name": "flow_noise_file", "type": "path", "description": "Optional raw float32 initial Flow noise for parity tests.", "required": false }, { "name": "hift_source_random_file", "type": "path", "description": "Optional raw float32 HiFT phase-uniform and Gaussian values for parity tests.", "required": false }, { "name": "hift_prior_noise_count", "type": "int", "description": "Torch RNG value offset used before HiFT source generation; default 0.", "required": false, "min": 0, "default": 0 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Requested component weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "mem_saver", "type": "bool", "description": "Release reference-only encoders after caching the voice while keeping the generation path warm; default false.", "required": false, "default": false }, { "name": "aggressive_mem_saver", "type": "bool", "description": "Also release Llama, Flow, and HiFT after every stage. Minimizes VRAM but reloads the generation path on every request; default false.", "required": false, "default": false }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-audio cache slots; default 1. Use 0 to disable.", "required": false, "min": 0, "default": 1 }, { "name": "llama_weight_context_mb", "type": "int", "description": "Llama weight metadata context in MiB; default 8192.", "required": false, "min": 1, "default": 8192 }, { "name": "constant_context_mb", "type": "int", "description": "Llama constant tensor context in MiB; default 256.", "required": false, "min": 1, "default": 256 }], "load": [] };
const runtime$1z = { "tags": ["gguf"] };
const sources$1z = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "llama_config": "model:llm/config.json", "llama_generation_config": "model:llm/generation_config.json", "speech_tokenizer_config": "model:speech_tokenizer/config.json", "speech_tokenizer_preprocessor": "model:speech_tokenizer/preprocessor_config.json", "tokenizer_config": "model:vq32k-phoneme-tokenizer/tokenizer_config.json", "tokenizer_vocab": "model:vq32k-phoneme-tokenizer/tokenizer_vocab.json", "tokenizer_merges": "model:vq32k-phoneme-tokenizer/tokenizer_merges.txt", "flow_config": "model:flow/config.yaml", "audio_cpp_config": "model:audio_cpp_config.json" }, "tensors": { "llama_weights": { "source": "weights:", "prefix": "llama_weights" }, "speech_tokenizer_weights": { "source": "weights:", "prefix": "speech_tokenizer_weights" }, "flow_weights": { "source": "weights:", "prefix": "flow_weights" }, "hift_weights": { "source": "weights:", "prefix": "hift_weights" }, "campplus_weights": { "source": "weights:", "prefix": "campplus_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "llama_config": "model:llm/config.json", "llama_generation_config": "model:llm/generation_config.json", "speech_tokenizer_config": "model:speech_tokenizer/config.json", "speech_tokenizer_preprocessor": "model:speech_tokenizer/preprocessor_config.json", "tokenizer_config": "model:vq32k-phoneme-tokenizer/tokenizer_config.json", "tokenizer_vocab": "model:vq32k-phoneme-tokenizer/tokenizer_vocab.json", "tokenizer_merges": "model:vq32k-phoneme-tokenizer/tokenizer_merges.txt", "flow_config": "model:flow/config.yaml", "audio_cpp_config": "model:audio_cpp_config.json" }, "tensors": { "llama_weights": "model:llm/model.safetensors.index.json", "speech_tokenizer_weights": "model:speech_tokenizer/model.safetensors", "flow_weights": "model:flow/model.safetensors", "hift_weights": "model:hift/model.safetensors", "campplus_weights": "model:frontend/campplus.safetensors" } }];
const packages$1A = [{ "id": "glm_tts_q8_0", "display_name": "GLM-TTS mixed Q8_0/F16 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "GLM-TTS-Q8", "files": ["Text to audio (TTS)/GLM-TTS_Q8.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "mirek190/audio.cpp" } }];
const dependencies$1d = [];
const ui$1z = { "recommended_package": "glm_tts_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/glm_tts.md", "docs/reports/glm_tts_validation.md", "docs/gguf.md"] };
const __vite_glob_0_34 = {
  schema_version: schema_version$1d,
  family: family$1z,
  display_name: display_name$1z,
  description: description$1z,
  category: category$1z,
  status: status$1z,
  tasks: tasks$1z,
  modes: modes$1z,
  languages: languages$1z,
  capabilities: capabilities$1z,
  options: options$1z,
  runtime: runtime$1z,
  sources: sources$1z,
  packages: packages$1A,
  dependencies: dependencies$1d,
  ui: ui$1z
};
const schema_version$1c = 1;
const family$1y = "gradium_phonon";
const display_name$1y = "Gradium Phonon";
const description$1y = "Gradium's Phonon text-to-speech: a small flow-matching language model with a Mimi decoder, a descendant of Kyutai's pocket-tts, for real-time local synthesis on CPU and GPU with prepared voices.";
const category$1y = "tts";
const status$1y = "experimental";
const tasks$1y = ["tts"];
const modes$1y = ["offline", "streaming"];
const languages$1y = ["en"];
const runtime$1y = { "tags": ["gguf"] };
const capabilities$1y = { "tts": ["built_in_voices", "long_form"] };
const options$1y = { "request": [{ "name": "frames_after_eos", "type": "int", "description": "Frames kept after EOS, counting the EOS frame; -1 keeps 4 for texts of up to four words and 2 otherwise, as the reference does.", "required": false, "min": -1, "default": -1 }, { "name": "max_frames", "type": "int", "description": "Maximum generated audio frames; zero estimates the cap from text length. Captured during session preparation.", "required": false, "min": 0, "default": 0 }, { "name": "text_chunk_tokens", "type": "int", "description": "Tokenizer tokens per text chunk; must be positive, default 50. Set during preparation and overridable per request.", "required": false, "min": 1, "default": 50 }, { "name": "temperature", "type": "float", "description": "Positive flow noise temperature. Captured during session preparation.", "required": false, "default": 0.3 }, { "name": "seed", "type": "int", "description": "Noise seed; omitted chooses a random seed. Captured during session preparation.", "required": false, "min": 0, "max": 4294967295 }, { "name": "noise_clamp", "type": "float", "description": "Noise clamp; a negative value disables clamping. Captured during session preparation.", "required": false, "default": -1 }, { "name": "eos_threshold", "type": "float", "description": "EOS detection threshold on the EOS logit. Captured during session preparation.", "required": false, "default": 4 }, { "name": "noise_file", "type": "path", "description": "Precomputed noise schedule, raw float32 [frames, 32], used as given. Captured during session preparation.", "required": false }, { "name": "voice_embedding_file", "type": "path", "description": "Voice file: a speaker_wavs latent file such as those of gradium/phonon-voices, or an exported voice state. Captured during session preparation.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Optional per-request character chunk size; otherwise use sentence/token budgeting.", "required": false }, { "name": "export_voice_state_file", "type": "path", "description": "Export the prepared voice state during session preparation.", "required": false }], "session": [{ "name": "voice_state_cache_slots", "type": "int", "description": "Cached prepared voice states; zero disables reuse.", "required": false, "min": 0, "default": 4 }, { "name": "offline_graph_capacity_mode", "type": "enum", "description": "Offline graph capacity policy; CPU/Metal default tiered, other backends double.", "required": false, "values": ["fixed", "double", "tiered", "grow"] }, { "name": "prompt_graph_capacity", "type": "int", "description": "Optional reserved prompt capacity.", "required": false, "min": 1 }, { "name": "generation_graph_capacity", "type": "int", "description": "Optional reserved generation capacity.", "required": false, "min": 1 }, { "name": "weight_type", "type": "enum", "description": "Shared matmul weight storage; component matmul settings inherit it. Convolution storage remains independently native unless overridden.", "required": false, "preset": "weight_type_full" }, { "name": "matmul_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage.", "required": false, "preset": "weight_type_conv", "default": "native" }, { "name": "weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 64 }, { "name": "flow_weight_context_mb", "type": "int", "description": "Flow weight context in MiB; inherits gradium_phonon.weight_context_mb when omitted.", "required": false, "min": 1 }, { "name": "mimi_decoder_weight_context_mb", "type": "int", "description": "Mimi decoder weight context in MiB; inherits gradium_phonon.weight_context_mb when omitted.", "required": false, "min": 1 }, { "name": "flow_weights_view_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "flow_step_graph_arena_mb", "type": "int", "description": "Flow-step host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 256 }, { "name": "mimi_conv_graph_arena_mb", "type": "int", "description": "Mimi convolution host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 32 }, { "name": "mimi_transformer_graph_arena_mb", "type": "int", "description": "Mimi transformer host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 96 }, { "name": "mimi_tail_graph_arena_mb", "type": "int", "description": "Mimi tail host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 512 }, { "name": "mimi_full_chunk_frames", "type": "int", "description": "Full-sequence decoder chunk frames.", "required": false, "min": 1, "default": 90 }, { "name": "mimi_stage2_chunk_frames", "type": "int", "description": "Second-stage decoder chunk frames.", "required": false, "min": 1, "default": 900 }, { "name": "use_full_mimi", "type": "bool", "description": "Use full-sequence Mimi decoding.", "required": false, "default": true }], "load": [] };
const package_defaults$1n = { "download": { "kind": "huggingface_snapshot", "repo": "gradium/phonon-31m-en-audiocpp", "revision": "main", "gated": false } };
const packages$1z = [{ "id": "gradium_phonon_31m_en_q8_0", "display_name": "Phonon 31m English Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "phonon-31m-en", "files": ["phonon-31m-en-q8_0.gguf", "default-voice.safetensors"] }, { "id": "gradium_phonon_31m_en_safetensors", "display_name": "Phonon 31m English Safetensors", "format": "safetensors", "precision": "native", "target_directory": "phonon-31m-en-safetensors", "files": ["config.json", "tokenizer.model", "model.safetensors", "default-voice.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "gradium/phonon-31m-en", "revision": "52433c46975bfa13144c56204c9f4ee1c5b148aa", "gated": false } }];
const dependencies$1c = [];
const ui$1y = { "recommended_package": "gradium_phonon_31m_en_q8_0", "default_voice": "default", "builtin_voices": ["default"], "tags": ["TTS", "GGUF"], "docs": ["docs/models/gradium_phonon.md", "docs/gguf.md"] };
const sources$1y = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_35 = {
  schema_version: schema_version$1c,
  family: family$1y,
  display_name: display_name$1y,
  description: description$1y,
  category: category$1y,
  status: status$1y,
  tasks: tasks$1y,
  modes: modes$1y,
  languages: languages$1y,
  runtime: runtime$1y,
  capabilities: capabilities$1y,
  options: options$1y,
  package_defaults: package_defaults$1n,
  packages: packages$1z,
  dependencies: dependencies$1c,
  ui: ui$1y,
  sources: sources$1y
};
const family$1x = "granite5asr";
const display_name$1x = "Granite Speech 5.0 470M TurboCTC";
const description$1x = "IBM Granite Speech 5.0 TurboCTC 470M parameter Conformer CTC model. The current checkpoint transcribes English, French, German, Spanish, Portuguese, Italian, and Japanese with punctuation and capitalization. An older English-only checkpoint still loads.";
const category$1x = "asr";
const status$1x = "supported";
const tasks$1x = ["asr"];
const modes$1x = ["offline", "streaming"];
const languages$1x = ["en", "fr", "de", "es", "pt", "it", "ja"];
const capabilities$1x = { "asr": ["vad_chunking", "partial_results", "word_timestamps"] };
const options$1x = { "request": [{ "name": "language", "type": "string", "description": "Accepted and ignored. Granite has no language input. A result is labelled en unless decoding emits a trained language token such as <|fr|>.", "required": false, "default": "en" }, { "name": "audio_chunk_mode", "type": "enum", "description": "Offline chunk mode: auto, fixed, vad, or none. VAD requires a regular model file; otherwise fixed chunks are used.", "values": ["auto", "fixed", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Positive maximum audio chunk duration for fixed and VAD chunking.", "required": false, "min": 1e-3, "default": 30 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared model weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "encoder_graph_arena_mb", "type": "int", "description": "Encoder graph arena size in MB. Positive MiB allocation; invalid/nonpositive values resolve to 1024 MiB.", "required": false, "min": 1, "default": 1024 }, { "name": "vad_model_path", "type": "string", "description": "Path to a VAD weight file of any built-in VAD family (e.g. silero_vad_16k.safetensors), not a directory; VAD runs only when this path is a regular file.", "required": false }], "load": [] };
const runtime$1x = { "tags": ["gguf", "server", "stream", "cuda", "metal", "cpu"] };
const ui$1x = { "recommended_package": "granite5asr_q8_0", "tags": ["ASR", "GGUF", "Stream"], "docs": ["docs/models/granite5asr.md", "docs/asr.md", "docs/gguf.md"], "summary": "IBM Granite Speech 5.0 470M TurboCTC multilingual transcription." };
const package_defaults$1m = { "download": { "kind": "huggingface_snapshot", "repo": "ibm-granite/granite-speech-5.0-470m-turboctc", "revision": "main", "gated": false } };
const packages$1y = [{ "id": "granite5asr_q8_0", "display_name": "Granite Speech 5.0 470M TurboCTC Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Granite-Speech-5.0-470M-TurboCTC-GGUF", "files": ["Granite-Speech-5.0-470M-TurboCTC-GGUF/granite-speech-5.0-470m-turboctc-q8_0.gguf"], "strip_prefix": "Granite-Speech-5.0-470M-TurboCTC-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } }, { "id": "granite5asr_safetensors", "display_name": "Granite Speech 5.0 470M TurboCTC Native Safetensors", "format": "safetensors", "precision": "bfloat16", "target_directory": "granite5asr", "files": ["config.json", "tokenizer.json", "model.safetensors"] }];
const sources$1x = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_36 = {
  family: family$1x,
  display_name: display_name$1x,
  description: description$1x,
  category: category$1x,
  status: status$1x,
  tasks: tasks$1x,
  modes: modes$1x,
  languages: languages$1x,
  capabilities: capabilities$1x,
  options: options$1x,
  runtime: runtime$1x,
  ui: ui$1x,
  package_defaults: package_defaults$1m,
  packages: packages$1y,
  sources: sources$1x
};
const schema_version$1b = 1;
const family$1w = "heartmula";
const display_name$1w = "HeartMuLa";
const description$1w = "Open-source music foundation model for generating complete songs from text, lyric prompts, and style tags, with controllable song structure and broad multilingual lyric conditioning.";
const category$1w = "audio_generation";
const status$1w = "supported";
const tasks$1w = ["music"];
const modes$1w = ["offline"];
const languages$1w = ["multilingual"];
const capabilities$1w = { "music": ["lyrics", "style_control"] };
const options$1w = { "request": [{ "name": "lyrics", "type": "string", "description": "Lyrics text.", "required": false }, { "name": "tags", "type": "string", "description": "Comma-separated music tags.", "required": false }, { "name": "duration_sec", "type": "float", "description": "Maximum generated audio duration in seconds; must be > 0 when set; default 120.", "required": false, "min": 0, "default": 120 }, { "name": "temperature", "type": "float", "description": "Audio-token sampling temperature; must be > 0 when set; default 1.0.", "required": false, "min": 0, "default": 1 }, { "name": "top_k", "type": "int", "description": "Audio-token top-k sampling limit; default 50. Must not exceed the active audio vocabulary size.", "required": false, "min": 1, "default": 50 }, { "name": "guidance_scale", "type": "float", "description": "MuLa classifier-free guidance scale; must be > 0 when set; default 1.5.", "required": false, "min": 0, "default": 1.5 }, { "name": "codec_duration_sec", "type": "float", "description": "Codec detokenization chunk duration in seconds; must be > 0 when set; default 29.76.", "required": false, "min": 0, "default": 29.76 }, { "name": "num_inference_steps", "type": "int", "description": "Codec flow solver steps; default 10.", "required": false, "min": 1, "default": 10 }, { "name": "codec_guidance_scale", "type": "float", "description": "Codec classifier-free guidance scale; must be > 0 when set; default 1.25.", "required": false, "min": 0, "default": 1.25 }, { "name": "infinite_mode", "type": "bool", "description": "Generate long outputs by splitting lyrics into bounded HeartMuLa requests.", "required": false, "default": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per text chunk in infinite mode; default 4096.", "required": false, "min": 1, "default": 4096 }, { "name": "infinite_chunk_audio_duration_ms", "type": "int", "description": "Maximum generated audio duration per infinite-mode chunk in milliseconds; default 240000.", "required": false, "min": 1, "default": 24e4 }, { "name": "seed", "type": "int", "description": "Generation seed for reproducible output; default 1234.", "required": false, "min": 0, "default": 1234 }], "session": [{ "name": "weight_type", "type": "enum", "description": "MuLa and codec weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "generator_weight_type", "type": "enum", "description": "MuLa music-token generator weight storage type; defaults to weight_type when set, otherwise native.", "preset": "weight_type_full", "required": false }, { "name": "codec_weight_type", "type": "enum", "description": "Codec weight storage type; defaults to weight_type when set, otherwise native.", "preset": "weight_type_full", "required": false }, { "name": "generator_weight_context_mb", "type": "int", "description": "MuLa music-token generator weight descriptor context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "codec_weight_context_mb", "type": "int", "description": "Codec weight descriptor context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "generator_constant_context_mb", "type": "int", "description": "MuLa music-token generator reusable constant context size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "backbone_prefill_graph_arena_mb", "type": "int", "description": "MuLa music-token generator backbone prefill graph arena size in MiB; default 1536.", "required": false, "min": 1, "default": 1536 }, { "name": "backbone_step_graph_arena_mb", "type": "int", "description": "MuLa music-token generator backbone cached-step graph arena size in MiB; default 1536.", "required": false, "min": 1, "default": 1536 }, { "name": "decoder_prefill_graph_arena_mb", "type": "int", "description": "MuLa music-token generator decoder prefill graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "decoder_step_graph_arena_mb", "type": "int", "description": "MuLa music-token generator decoder cached-step graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "frame_embedding_graph_arena_mb", "type": "int", "description": "MuLa music-token generator frame-embedding graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "flow_estimator_graph_arena_mb", "type": "int", "description": "Codec flow-estimator graph arena size in MiB; default 2048.", "required": false, "min": 1, "default": 2048 }, { "name": "conditioning_graph_arena_mb", "type": "int", "description": "Codec conditioning graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "scalar_decoder_graph_arena_mb", "type": "int", "description": "Codec scalar-decoder graph arena size in MiB; default 1536.", "required": false, "min": 1, "default": 1536 }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime graphs after each request; default false.", "required": false, "default": false }], "load": [] };
const runtime$1w = { "tags": ["gguf"] };
const ui$1w = { "recommended_package": "heartmula_q8_0", "tags": ["Music", "GGUF"], "docs": ["docs/music_generation.md", "docs/gguf.md"] };
const package_defaults$1l = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1x = [{ "id": "heartmula_q8_0", "display_name": "HeartMuLa Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "HeartMuLa-GGUF", "files": ["HeartMuLa-GGUF/heartmula-q8_0.gguf"], "strip_prefix": "HeartMuLa-GGUF" }, { "id": "heartmula_f16", "display_name": "HeartMuLa F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "HeartMuLa-GGUF", "files": ["HeartMuLa-GGUF/heartmula-f16.gguf"], "strip_prefix": "HeartMuLa-GGUF" }];
const dependencies$1b = [];
const sources$1w = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "tokenizer_json": "model:tokenizer.json", "generation_config": "model:gen_config.json", "mula_config": "model:HeartMuLa-oss-3B/config.json", "codec_config": "model:HeartCodec-oss/config.json" }, "tensors": { "mula_weights": { "source": "weights:", "prefix": "mula_weights" }, "codec_weights": { "source": "weights:", "prefix": "codec_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "tokenizer_json": "model:tokenizer.json", "generation_config": "model:gen_config.json", "mula_config": "model:HeartMuLa-oss-3B/config.json", "codec_config": "model:HeartCodec-oss/config.json" }, "tensors": { "mula_weights": "model:HeartMuLa-oss-3B/model.safetensors.index.json", "codec_weights": "model:HeartCodec-oss/model.safetensors.index.json" } }];
const __vite_glob_0_37 = {
  schema_version: schema_version$1b,
  family: family$1w,
  display_name: display_name$1w,
  description: description$1w,
  category: category$1w,
  status: status$1w,
  tasks: tasks$1w,
  modes: modes$1w,
  languages: languages$1w,
  capabilities: capabilities$1w,
  options: options$1w,
  runtime: runtime$1w,
  ui: ui$1w,
  package_defaults: package_defaults$1l,
  packages: packages$1x,
  dependencies: dependencies$1b,
  sources: sources$1w
};
const schema_version$1a = 1;
const family$1v = "higgs_audio_stt";
const display_name$1v = "Higgs Audio v3 STT";
const description$1v = "Boson AI English speech-to-text model combining a Whisper Large v3 speech encoder with a Qwen decoder for robust ASR.";
const category$1v = "asr";
const status$1v = "supported";
const tasks$1v = ["asr"];
const modes$1v = ["offline", "streaming"];
const languages$1v = ["en"];
const capabilities$1v = {};
const dependencies$1a = [];
const options$1v = { "request": [{ "name": "language", "type": "string", "description": "Transcript language code metadata; English is used when omitted.", "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum generated transcript tokens; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "enable_thinking", "type": "bool", "description": "Enable the model thinking prompt; default true.", "required": false, "default": true }, { "name": "audio_chunk_mode", "type": "enum", "description": "Audio chunking mode; default auto uses fixed chunks.", "values": ["auto", "fixed", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Fixed audio chunk duration in seconds; must be > 0 when set; default 4.", "required": false, "min": 0, "default": 4 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared text decoder weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "audio_encoder_weight_type", "type": "enum", "description": "Audio encoder convolution weight storage type; default native.", "preset": "weight_type_conv", "required": false, "default": "native" }, { "name": "text_decoder_weight_type", "type": "enum", "description": "Text decoder matmul weight storage type; defaults to weight_type when set, otherwise native.", "preset": "weight_type_full", "required": false }, { "name": "audio_encoder_graph_arena_mb", "type": "int", "description": "Audio encoder graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "text_decoder_prefill_graph_arena_mb", "type": "int", "description": "Text decoder prefill graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "text_decoder_decode_graph_arena_mb", "type": "int", "description": "Text decoder cached-step graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "text_decoder_weight_context_mb", "type": "int", "description": "Text decoder weight context in MiB; omitted uses 4096 on 64-bit builds or 1024 on 32-bit builds.", "required": false, "min": 1 }], "load": [] };
const runtime$1v = { "tags": ["gguf", "stream"] };
const ui$1v = { "recommended_package": "higgs_audio_stt_q8_0", "tags": ["ASR", "GGUF", "Stream"], "docs": ["docs/models/higgs_audio_stt.md", "docs/asr.md", "docs/gguf.md"] };
const package_defaults$1k = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1w = [{ "id": "higgs_audio_stt_q8_0", "display_name": "Higgs Audio v3 STT Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Higgs-Audio-v3-STT-GGUF", "files": ["Higgs-Audio-v3-STT-GGUF/higgs-audio-v3-stt-q8_0.gguf"], "strip_prefix": "Higgs-Audio-v3-STT-GGUF" }, { "id": "higgs_audio_stt_f16", "display_name": "Higgs Audio v3 STT F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Higgs-Audio-v3-STT-GGUF", "files": ["Higgs-Audio-v3-STT-GGUF/higgs-audio-v3-stt-f16.gguf"], "strip_prefix": "Higgs-Audio-v3-STT-GGUF" }];
const sources$1v = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "preprocessor_config": "model:preprocessor_config.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": ".", "whisper": "../whisper-large-v3" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "preprocessor_config": "whisper:preprocessor_config.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt" }, "tensors": { "weights": "model:model.safetensors.index.json" } }];
const __vite_glob_0_38 = {
  schema_version: schema_version$1a,
  family: family$1v,
  display_name: display_name$1v,
  description: description$1v,
  category: category$1v,
  status: status$1v,
  tasks: tasks$1v,
  modes: modes$1v,
  languages: languages$1v,
  capabilities: capabilities$1v,
  dependencies: dependencies$1a,
  options: options$1v,
  runtime: runtime$1v,
  ui: ui$1v,
  package_defaults: package_defaults$1k,
  packages: packages$1w,
  sources: sources$1v
};
const family$1u = "higgs_audio_tts";
const display_name$1u = "Higgs Audio v3 TTS";
const description$1u = "Boson AI conversational TTS model for expressive speech across 100+ languages, zero-shot voice cloning, and inline control over emotion, style, prosody, pauses, and sound effects.";
const category$1u = "tts";
const status$1u = "supported";
const tasks$1u = ["tts", "clone"];
const modes$1u = ["offline", "streaming"];
const languages$1u = ["100+ languages"];
const options$1u = { "request": [{ "name": "stream_frames_per_event", "type": "int", "description": "Streaming codec frames per event; grow starts at one and increases to this cap. Each frame is 40 ms of audio.", "required": false, "min": 1, "default": 32 }, { "name": "stream_chunk_policy", "type": "enum", "description": "Streaming chunk schedule. The non-causal codec always retains ten frames of left and right context.", "required": false, "values": ["grow", "fixed"], "default": "grow" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated AR tokens; zero uses the default. Must not exceed the configured context length.", "required": false, "min": 0, "default": 2048 }, { "name": "allow_incomplete_generation", "type": "bool", "description": "Return generated audio with a warning instead of failing when max_tokens is reached before EOC. Audio may be truncated or contain silence/noise.", "required": false, "default": false }, { "name": "temperature", "type": "float", "description": "AR sampling temperature. Must be positive.", "required": false, "default": 0.8 }, { "name": "top_p", "type": "float", "description": "AR nucleus sampling probability. Must be positive.", "required": false, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "AR top-k sampling limit.", "required": false, "default": 30, "min": 0 }, { "name": "filter_nan_logits", "type": "bool", "description": "Filter NaN and infinity during greedy and stochastic top-k selection. All-invalid logits still fail.", "required": false, "default": false }, { "name": "repetition_penalty", "type": "float", "description": "Accepted for Python API compatibility; audio sampling does not consume this value. Compatibility-only, but must be finite and positive.", "required": false, "default": 1.1 }, { "name": "seed", "type": "int", "description": "Torch sampling seed; omitted chooses a random seed.", "required": false, "min": 0 }, { "name": "reference_text", "type": "string", "description": "Transcript accompanying reference audio.", "required": false, "default": "" }, { "name": "text_chunk_size", "type": "int", "description": "Framework long-form text chunk size.", "required": false, "default": 1024, "min": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "required": false, "values": ["default", "tag_aware", "japanese", "endline"], "default": "default" }], "session": [{ "name": "reference_prefill_mode", "type": "enum", "description": "Cached-reference prefill attention. auto preserves existing behavior. Try exact if repeated voice-cloning requests produce excessive repetition or unexpectedly long, mostly silent output. May increase prefill time; not a general generation-quality fix. Full-prompt prefill and AR decoding are unchanged.", "required": false, "values": ["auto", "exact"], "default": "auto" }, { "name": "weight_type", "type": "enum", "description": "Weight storage type.", "required": false, "preset": "weight_type_full", "default": "native" }, { "name": "ar_weight_type", "type": "enum", "description": "AR weight storage; inherits weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "codec_weight_type", "type": "enum", "description": "Codec weight storage; inherits weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "ar_weight_context_mb", "type": "int", "description": "AR weight context in MiB; 4096 on 64-bit builds, 1024 on 32-bit builds.", "required": false, "min": 1 }, { "name": "codec_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 1536 }, { "name": "ar_decode_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "codec_decode_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 128 }, { "name": "codec_encode_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "reference_cache_slots", "type": "int", "description": "Encoded reference cache slots; zero disables reuse.", "required": false, "min": 0, "default": 1 }, { "name": "attention", "type": "enum", "description": "Attention lowering preference.", "required": false, "values": ["auto", "flash", "eager"], "default": "auto" }], "load": [] };
const capabilities$1u = { "clone": ["speaker_reference"] };
const runtime$1u = { "tags": ["gguf"] };
const ui$1u = { "recommended_package": "higgs_audio_tts_4b_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/higgs_audio_tts.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$1j = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1v = [{ "id": "higgs_audio_tts_4b_q8_0", "display_name": "Higgs Audio v3 TTS 4B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Higgs-Audio-v3-TTS-4B-GGUF", "files": ["Higgs-Audio-v3-TTS-4B-GGUF/higgs-audio-v3-tts-4b-q8_0.gguf"], "strip_prefix": "Higgs-Audio-v3-TTS-4B-GGUF" }, { "id": "higgs_audio_tts_4b_bf16", "display_name": "Higgs Audio v3 TTS 4B BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Higgs-Audio-v3-TTS-4B-GGUF", "files": ["Higgs-Audio-v3-TTS-4B-GGUF/higgs-audio-v3-tts-4b-bf16.gguf"], "strip_prefix": "Higgs-Audio-v3-TTS-4B-GGUF" }];
const sources$1u = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "chat_template": "model:chat_template.jinja" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "chat_template": "model:chat_template.jinja" }, "tensors": { "weights": "model:model.safetensors.index.json" } }];
const __vite_glob_0_39 = {
  family: family$1u,
  display_name: display_name$1u,
  description: description$1u,
  category: category$1u,
  status: status$1u,
  tasks: tasks$1u,
  modes: modes$1u,
  languages: languages$1u,
  options: options$1u,
  capabilities: capabilities$1u,
  runtime: runtime$1u,
  ui: ui$1u,
  package_defaults: package_defaults$1j,
  packages: packages$1v,
  sources: sources$1u
};
const schema_version$19 = 1;
const family$1t = "htdemucs";
const display_name$1t = "HTDemucs";
const description$1t = "Hybrid Transformer Demucs music source-separation model that combines waveform and spectrogram processing with Transformer layers to split mixtures into vocals, drums, bass, and accompaniment.";
const category$1t = "audio_tools";
const status$1t = "supported";
const tasks$1t = ["sep"];
const modes$1t = ["offline"];
const languages$1t = ["language_agnostic"];
const capabilities$1t = { "sep": ["stems"] };
const options$1t = { "request": [], "session": [{ "name": "weight_type", "type": "enum", "description": "HTDemucs weight storage type; default is f32 for host graph planning, f16 on CUDA, otherwise native.", "preset": "weight_type_full", "required": false }], "load": [] };
const runtime$1t = { "tags": ["gguf"] };
const ui$1t = { "recommended_package": "htdemucs_q8_0", "tags": ["Sep", "GGUF"], "docs": ["docs/audio_tools.md", "docs/gguf.md"] };
const package_defaults$1i = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1u = [{ "id": "htdemucs_q8_0", "display_name": "HTDemucs Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "HTDemucs-GGUF", "files": ["HTDemucs-GGUF/htdemucs-q8_0.gguf"], "strip_prefix": "HTDemucs-GGUF" }, { "id": "htdemucs_f16", "display_name": "HTDemucs F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "HTDemucs-GGUF", "files": ["HTDemucs-GGUF/htdemucs-f16.gguf"], "strip_prefix": "HTDemucs-GGUF" }];
const dependencies$19 = [];
const sources$1t = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "manifest": "model:manifest.json", "submodel_config": "model:955717e8/config.json" }, "tensors": { "submodel_weights": { "source": "weights:", "prefix": "submodel_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "submodel": "955717e8" }, "files": { "manifest": "model:manifest.json", "submodel_config": "submodel:config.json" }, "tensors": { "submodel_weights": "submodel:model.safetensors" } }];
const __vite_glob_0_40 = {
  schema_version: schema_version$19,
  family: family$1t,
  display_name: display_name$1t,
  description: description$1t,
  category: category$1t,
  status: status$1t,
  tasks: tasks$1t,
  modes: modes$1t,
  languages: languages$1t,
  capabilities: capabilities$1t,
  options: options$1t,
  runtime: runtime$1t,
  ui: ui$1t,
  package_defaults: package_defaults$1i,
  packages: packages$1u,
  dependencies: dependencies$19,
  sources: sources$1t
};
const schema_version$18 = 1;
const family$1s = "htdemucs_6stems";
const display_name$1s = "HTDemucs 6-stem";
const description$1s = "Hybrid Transformer Demucs 6-stem source-separation model that combines waveform and spectrogram processing with Transformer layers to split mixtures into drums, bass, vocals, other, guitar, and piano.";
const category$1s = "audio_tools";
const status$1s = "supported";
const tasks$1s = ["sep"];
const modes$1s = ["offline"];
const languages$1s = ["language_agnostic"];
const capabilities$1s = { "sep": ["stems"] };
const options$1s = { "request": [], "session": [{ "name": "weight_type", "type": "enum", "description": "HTDemucs 6-stem weight storage type; default is f32 for host graph planning, f16 on CUDA, otherwise native.", "preset": "weight_type_full", "required": false }], "load": [] };
const runtime$1s = { "tags": ["gguf"] };
const ui$1s = { "recommended_package": "htdemucs_6stems_q8_0", "tags": ["Sep", "GGUF"], "docs": ["docs/audio_tools.md", "docs/gguf.md"] };
const package_defaults$1h = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1t = [{ "id": "htdemucs_6stems_q8_0", "display_name": "HTDemucs 6-stem Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "HTDemucs-6stems-GGUF", "files": ["HTDemucs-6stems-GGUF/htdemucs-6stems-q8_0.gguf"], "strip_prefix": "HTDemucs-6stems-GGUF" }, { "id": "htdemucs_6stems_f16", "display_name": "HTDemucs 6-stem F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "HTDemucs-6stems-GGUF", "files": ["HTDemucs-6stems-GGUF/htdemucs-6stems-f16.gguf"], "strip_prefix": "HTDemucs-6stems-GGUF" }];
const dependencies$18 = [];
const sources$1s = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "manifest": "model:manifest.json", "submodel_config": "model:5c90dfd2/config.json" }, "tensors": { "submodel_weights": { "source": "weights:", "prefix": "submodel_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "submodel": "5c90dfd2" }, "files": { "manifest": "model:manifest.json", "submodel_config": "submodel:config.json" }, "tensors": { "submodel_weights": "submodel:model.safetensors" } }];
const __vite_glob_0_41 = {
  schema_version: schema_version$18,
  family: family$1s,
  display_name: display_name$1s,
  description: description$1s,
  category: category$1s,
  status: status$1s,
  tasks: tasks$1s,
  modes: modes$1s,
  languages: languages$1s,
  capabilities: capabilities$1s,
  options: options$1s,
  runtime: runtime$1s,
  ui: ui$1s,
  package_defaults: package_defaults$1h,
  packages: packages$1t,
  dependencies: dependencies$18,
  sources: sources$1s
};
const family$1r = "hviske_asr";
const schema_version$17 = 1;
const display_name$1r = "Hviske ASR";
const description$1r = "Danish-optimized Conformer encoder-decoder ASR model fine-tuned from the Hviske v5 family, with selectable Cohere ASR language prompts.";
const category$1r = "asr";
const status$1r = "supported";
const tasks$1r = ["asr"];
const modes$1r = ["offline"];
const languages$1r = ["ar", "da", "de", "el", "en", "es", "fr", "it", "ja", "ko", "nl", "pl", "pt", "vi", "zh"];
const capabilities$1r = {};
const dependencies$17 = [];
const options$1r = { "request": [{ "name": "language", "type": "string", "description": "ASR language code; default da.", "required": false, "default": "da" }, { "name": "punc", "type": "bool", "description": "Request punctuation and capitalization together through decoder prompt tokens; default true.", "required": false, "default": true }, { "name": "max_tokens", "type": "int", "description": "Maximum generated transcript tokens; defaults to the model config.", "required": false, "min": 1 }, { "name": "num_beams", "type": "int", "description": "Beam-search beam count; default 1 uses greedy or sampling decode.", "required": false, "min": 1, "default": 1 }, { "name": "length_penalty", "type": "float", "description": "Beam-search length penalty; must be positive when set; default 1.0.", "required": false, "min": 1e-6, "default": 1 }, { "name": "do_sample", "type": "bool", "description": "Enable sampling instead of greedy decode when num_beams is 1; default false.", "required": false, "default": false }, { "name": "temperature", "type": "float", "description": "Decoder sampling temperature; must be positive when set; default 1.0.", "required": false, "min": 1e-6, "default": 1 }, { "name": "top_k", "type": "int", "description": "Top-k sampling limit; default 50, 0 disables top-k.", "required": false, "min": 0, "default": 50 }, { "name": "top_p", "type": "float", "description": "Nucleus sampling limit in (0, 1]; default 1.0.", "required": false, "min": 1e-6, "max": 1, "default": 1 }, { "name": "seed", "type": "int", "description": "Decoder sampling seed; default 0.", "required": false, "min": 0, "default": 0 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Audio chunking mode; default auto uses quiet-energy splitting only when audio exceeds the model clip window.", "values": ["auto", "fixed", "quiet_energy", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum audio chunk duration in seconds; defaults to the model clip window.", "required": false, "min": 1e-6 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage type; defaults to weight_type when set, otherwise native.", "preset": "weight_type_conv", "required": false }, { "name": "weight_context_mb", "type": "int", "description": "Weight descriptor context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "encoder_graph_arena_mb", "type": "int", "description": "Encoder graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "decoder_prefill_graph_arena_mb", "type": "int", "description": "Decoder prefill graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "decoder_decode_graph_arena_mb", "type": "int", "description": "Decoder cached-step graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }], "load": [] };
const runtime$1r = { "tags": ["gguf"] };
const ui$1r = { "recommended_package": "hviske_asr_q8_0", "tags": ["ASR", "GGUF"], "docs": ["docs/asr.md", "docs/gguf.md"] };
const packages$1s = [{ "id": "hviske_asr_q8_0", "display_name": "Hviske v5.3 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Hviske-v5.3-GGUF", "files": ["Audio to text (ASR)/hviske-v5.3_Q8.gguf"], "strip_prefix": "Audio to text (ASR)", "download": { "kind": "huggingface_snapshot", "repo": "mirek190/audio.cpp" } }, { "id": "hviske_asr_safetensors", "display_name": "Hviske v5.3 Safetensors", "format": "safetensors", "precision": "native", "target_directory": "hviske-v5.3", "files": ["config.json", "generation_config.json", "model.safetensors", "tokenizer.model"], "download": { "kind": "huggingface_snapshot", "repo": "syvai/hviske-v5.3" } }];
const sources$1r = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_42 = {
  family: family$1r,
  schema_version: schema_version$17,
  display_name: display_name$1r,
  description: description$1r,
  category: category$1r,
  status: status$1r,
  tasks: tasks$1r,
  modes: modes$1r,
  languages: languages$1r,
  capabilities: capabilities$1r,
  dependencies: dependencies$17,
  options: options$1r,
  runtime: runtime$1r,
  ui: ui$1r,
  packages: packages$1s,
  sources: sources$1r
};
const schema_version$16 = 1;
const family$1q = "hviske_asr_v6";
const display_name$1q = "Hviske v6";
const description$1q = "Danish speech recognition with a rotary Whisper encoder and Qwen3 decoder.";
const category$1q = "asr";
const status$1q = "supported";
const tasks$1q = ["asr"];
const modes$1q = ["offline"];
const languages$1q = ["da"];
const capabilities$1q = {};
const runtime$1q = { "tags": ["gguf"] };
const options$1q = { "request": [{ "name": "audio_chunk_mode", "type": "enum", "description": "auto preserves silence splitting above 30 seconds; silence splits above the configured duration at silence boundaries; fixed splits at the configured duration; none disables splitting and accepts at most 30 seconds.", "required": false, "default": "auto", "values": ["auto", "silence", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum chunk duration when splitting. In auto mode the 30-second trigger remains unchanged.", "required": false, "default": 28, "min": 1e-3, "max": 30 }, { "name": "max_tokens", "type": "int", "description": "Maximum generated tokens per chunk, also capped to eight tokens per audio second plus twelve.", "required": false, "default": 440, "min": 1 }, { "name": "num_beams", "type": "int", "description": "Beam-search width. One selects greedy decoding.", "required": false, "default": 2, "min": 1 }, { "name": "length_penalty", "type": "float", "description": "Exponent used to normalize beam scores by generated length.", "required": false, "default": 1 }, { "name": "cased", "type": "bool", "description": "Request casing separately from punctuation. Both cased and punc must be provided to override automatic formatting.", "required": false }, { "name": "punc", "type": "bool", "description": "Request punctuation only, unlike the combined punctuation/casing control in Canary, Cohere and original Hviske. Both cased and punc must be provided to override automatic formatting.", "required": false }], "session": [{ "name": "weight_type", "type": "enum", "preset": "weight_type_full", "description": "Weight storage override; native preserves the supplied checkpoint types.", "required": false, "default": "native" }], "load": [] };
const packages$1r = [{ "id": "hviske_asr_v6_bf16", "display_name": "Hviske v6 BF16 GGUF", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "Hviske-v6-GGUF", "files": ["Hviske-v6-GGUF/hviske-v6-bf16.gguf"], "strip_prefix": "Hviske-v6-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf" } }, { "id": "hviske_asr_v6_q8_0", "display_name": "Hviske v6 Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Hviske-v6-GGUF", "files": ["Hviske-v6-GGUF/hviske-v6-q8_0.gguf"], "strip_prefix": "Hviske-v6-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf" } }];
const dependencies$16 = [];
const ui$1q = { "recommended_package": "hviske_asr_v6_bf16", "tags": ["ASR", "GGUF"], "docs": ["docs/models/hviske_asr_v6.md"] };
const sources$1q = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": { "source": "model:model.safetensors" } } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_43 = {
  schema_version: schema_version$16,
  family: family$1q,
  display_name: display_name$1q,
  description: description$1q,
  category: category$1q,
  status: status$1q,
  tasks: tasks$1q,
  modes: modes$1q,
  languages: languages$1q,
  capabilities: capabilities$1q,
  runtime: runtime$1q,
  options: options$1q,
  packages: packages$1r,
  dependencies: dependencies$16,
  ui: ui$1q,
  sources: sources$1q
};
const schema_version$15 = 1;
const family$1p = "index_echo";
const display_name$1p = "Index-Echo-S2TT";
const description$1p = "Index-Echo speech-to-text translation with bilingual timestamped subtitles.";
const category$1p = "asr";
const status$1p = "experimental";
const tasks$1p = ["asr"];
const modes$1p = ["offline"];
const languages$1p = ["zh", "en", "es", "ja"];
const runtime$1p = { "tags": ["gguf"] };
const capabilities$1p = {};
const dependencies$15 = [];
const options$1p = { "request": [{ "name": "target_language", "type": "enum", "values": ["en", "es", "ja"], "description": "Translation language for Chinese input audio.", "required": false, "default": "en" }, { "name": "max_tokens", "type": "int", "description": "Maximum translated text tokens per window.", "required": false, "min": 1, "default": 2e3 }, { "name": "temperature", "type": "float", "description": "Sampling temperature; zero selects greedy decoding.", "required": false, "min": 0, "max": 2, "default": 0 }, { "name": "seed", "type": "int", "description": "Sampling seed when temperature is positive.", "required": false, "min": 0, "max": 2147483647, "default": 0 }, { "name": "glossary", "type": "string", "description": "Translation glossary entries.", "required": false }, { "name": "audio_chunk_mode", "type": "enum", "values": ["auto", "quiet_energy", "fixed", "none"], "description": "Long-form audio windowing mode.", "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum audio-window duration.", "required": false, "min": 1, "max": 60, "default": 60 }], "session": [{ "name": "weight_type", "type": "enum", "preset": "weight_type_full", "description": "Weight storage type for runtime matmul operations.", "required": false, "default": "native" }], "load": [] };
const packages$1q = [{ "id": "index_echo_s2tt_2b_orig", "display_name": "Index-Echo-S2TT 2B Original", "default": true, "format": "gguf", "precision": "orig", "target_directory": "Index-Echo-S2TT-GGUF", "files": ["index-echo-s2tt-2b-orig.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Index-Echo-S2TT-GGUF", "revision": "main", "gated": false } }, { "id": "index_echo_s2tt_2b_q8_0", "display_name": "Index-Echo-S2TT 2B Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Index-Echo-S2TT-GGUF", "files": ["index-echo-s2tt-2b-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Index-Echo-S2TT-GGUF", "revision": "main", "gated": false } }, { "id": "index_echo_s2tt_2b_q4_k", "display_name": "Index-Echo-S2TT 2B Q4_K (experimental)", "format": "gguf", "precision": "q4_k", "target_directory": "Index-Echo-S2TT-GGUF", "files": ["index-echo-s2tt-2b-q4_k.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Index-Echo-S2TT-GGUF", "revision": "main", "gated": false } }, { "id": "index_echo_s2tt_9b_orig", "display_name": "Index-Echo-S2TT 9B Original", "format": "gguf", "precision": "orig", "target_directory": "Index-Echo-S2TT-GGUF", "files": ["index-echo-s2tt-9b-orig.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Index-Echo-S2TT-GGUF", "revision": "main", "gated": false } }, { "id": "index_echo_s2tt_9b_q8_0", "display_name": "Index-Echo-S2TT 9B Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Index-Echo-S2TT-GGUF", "files": ["index-echo-s2tt-9b-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Index-Echo-S2TT-GGUF", "revision": "main", "gated": false } }];
const ui$1p = { "recommended_package": "index_echo_s2tt_2b_orig", "tags": ["ASR", "GGUF"], "docs": ["docs/models/index_echo.md"] };
const sources$1p = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "llm_config": "model:llm/config.json", "tokenizer": "model:llm/tokenizer.json", "tokenizer_config": "model:llm/tokenizer_config.json", "audio_config": "model:audio_config.json" }, "optional_files": { "mapper_config": "model:bridge/mapper_config.json" }, "tensors": { "stlm_weights": { "source": "weights:", "prefix": "stlm" }, "audio_weights": { "source": "weights:", "prefix": "audio" }, "connector_weights": { "source": "weights:", "prefix": "connector" } }, "optional_tensors": { "mapper_weights": { "source": "weights:", "prefix": "mapper" } } }];
const __vite_glob_0_44 = {
  schema_version: schema_version$15,
  family: family$1p,
  display_name: display_name$1p,
  description: description$1p,
  category: category$1p,
  status: status$1p,
  tasks: tasks$1p,
  modes: modes$1p,
  languages: languages$1p,
  runtime: runtime$1p,
  capabilities: capabilities$1p,
  dependencies: dependencies$15,
  options: options$1p,
  packages: packages$1q,
  ui: ui$1p,
  sources: sources$1p
};
const family$1o = "index_tts2";
const display_name$1o = "IndexTTS2";
const description$1o = "Zero-shot TTS system with voice cloning, emotion-speaker decoupling, text or audio emotion control, and explicit duration control. Variant v2 covers Chinese and English; variant v2.5 (config version 2.5) adds multilingual tiktoken tokenization with Japanese, Spanish and Arabic support.";
const category$1o = "tts";
const status$1o = "supported";
const tasks$1o = ["tts", "clone"];
const modes$1o = ["offline"];
const languages$1o = ["zh", "en", "ja", "es", "ar"];
const options$1o = { "request": [{ "name": "text", "type": "string", "description": "Fallback target text when text_input is absent; prompt is also accepted.", "required": false }, { "name": "language", "type": "string", "description": "IndexTTS2.5 text language; empty or auto selects from text.", "required": false }, { "name": "emotion_alpha", "type": "float", "description": "Emotion conditioning blend strength.", "required": false, "min": 0, "max": 1, "default": 1 }, { "name": "emotion_vector", "type": "string", "description": "Eight comma-separated finite emotion strengths.", "required": false }, { "name": "use_emotion_text", "type": "bool", "description": "Use text-derived emotion conditioning.", "required": false, "default": false }, { "name": "emotion_text", "type": "string", "description": "Emotion description.", "required": false }, { "name": "use_random_emotion", "type": "bool", "description": "Use random emotion conditioning.", "required": false, "default": false }, { "name": "interval_silence_ms", "type": "int", "description": "Silence between generated segments in milliseconds.", "required": false, "min": 0, "default": 200 }, { "name": "do_sample", "type": "bool", "description": "Enable sampling.", "required": false, "default": true }, { "name": "top_p", "type": "float", "description": "Nucleus sampling probability. Must be in (0, 1].", "required": false, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "Top-k sampling limit.", "required": false, "min": 1, "default": 30 }, { "name": "temperature", "type": "float", "description": "Sampling temperature. Must be positive.", "required": false, "default": 0.8 }, { "name": "length_penalty", "type": "float", "description": "Beam search length penalty.", "required": false, "default": 0 }, { "name": "num_beams", "type": "int", "description": "Beam search width.", "required": false, "min": 1, "default": 3 }, { "name": "repetition_penalty", "type": "float", "description": "Sampling repetition penalty.", "required": false, "default": 10 }, { "name": "max_tokens", "type": "int", "description": "Maximum generated mel tokens.", "required": false, "min": 1, "default": 1500 }, { "name": "duration_scale", "type": "float", "description": "Positive waveform duration rescaling, supported by both IndexTTS2 and IndexTTS2.5.", "required": false, "default": 1 }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted chooses a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "text_chunk_size", "type": "int", "description": "Optional framework long-form text chunk size; omitted keeps the full input together. Must be positive.", "required": false }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "required": false, "values": ["default", "tag_aware", "japanese", "endline"], "default": "default" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; defaults to native.", "required": false, "preset": "weight_type_full" }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage; native on HIP resolves to F16.", "required": false, "preset": "weight_type_conv", "default": "native" }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime graphs.", "required": false, "default": false }, { "name": "speaker_cache_slots", "type": "int", "description": "Reference or emotion cache slots; zero disables reuse.", "required": false, "min": 0, "default": 1 }, { "name": "emotion_cache_slots", "type": "int", "description": "Reference or emotion cache slots; zero disables reuse.", "required": false, "min": 0, "default": 1 }, { "name": "emotion_text_cache_slots", "type": "int", "description": "Reference or emotion cache slots; zero disables reuse.", "required": false, "min": 0, "default": 1 }, { "name": "gpt_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "s2mel_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "reference_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "emotion_text_prefill_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 2048 }, { "name": "emotion_text_decode_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "emotion_text_max_tokens", "type": "int", "description": "Emotion description generation token limit; emotion_text_max_new_tokens is also accepted.", "required": false, "min": 1, "default": 256 }], "load": [] };
const capabilities$1o = { "tts": ["emotion_control"], "clone": ["speaker_reference", "emotion_control"] };
const runtime$1o = { "tags": ["gguf"] };
const ui$1o = { "recommended_package": "index_tts2_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/index_tts2.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$1g = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1p = [{ "id": "index_tts2_q8_0", "display_name": "IndexTTS2 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "IndexTTS2-GGUF", "files": ["IndexTTS2-GGUF/index-tts2-q8_0.gguf"], "strip_prefix": "IndexTTS2-GGUF" }, { "id": "index_tts2_f16", "display_name": "IndexTTS2 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "IndexTTS2-GGUF", "files": ["IndexTTS2-GGUF/index-tts2-f16.gguf"], "strip_prefix": "IndexTTS2-GGUF" }, { "id": "index_tts2_orig", "display_name": "IndexTTS2 Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "IndexTTS2-GGUF", "files": ["IndexTTS2-GGUF/index-tts2-orig.gguf"], "strip_prefix": "IndexTTS2-GGUF" }, { "id": "index_tts2_safetensors", "display_name": "IndexTTS2 Safetensors", "format": "safetensors", "precision": "native", "target_directory": "IndexTTS-2", "files": ["config.yaml", "bpe.model", "gpt.safetensors", "w2v-bert-2.0/config.json", "w2v-bert-2.0/preprocessor_config.json", "bigvgan/config.json", "qwen0.6bemo4-merge/config.json", "qwen0.6bemo4-merge/generation_config.json", "qwen0.6bemo4-merge/tokenizer.json", "qwen0.6bemo4-merge/tokenizer_config.json", "qwen0.6bemo4-merge/vocab.json", "qwen0.6bemo4-merge/merges.txt", "s2mel.safetensors", "feat1.safetensors", "feat2.safetensors", "wav2vec2bert_stats.safetensors", "w2v-bert-2.0/model.safetensors", "semantic_codec_model.safetensors", "campplus.safetensors", "bigvgan/model.safetensors", "qwen0.6bemo4-merge/model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "mlx-community/index-tts2-mlx" } }, { "id": "index_tts2_5_q8_0", "display_name": "IndexTTS2.5 Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "IndexTTS2.5-GGUF", "files": ["IndexTTS2.5-GGUF/index-tts2_5-q8_0.gguf"], "strip_prefix": "IndexTTS2.5-GGUF" }, { "id": "index_tts2_5_f16", "display_name": "IndexTTS2.5 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "IndexTTS2.5-GGUF", "files": ["IndexTTS2.5-GGUF/index-tts2_5-f16.gguf"], "strip_prefix": "IndexTTS2.5-GGUF" }, { "id": "index_tts2_5_orig", "display_name": "IndexTTS2.5 Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "IndexTTS2.5-GGUF", "files": ["IndexTTS2.5-GGUF/index-tts2_5-orig.gguf"], "strip_prefix": "IndexTTS2.5-GGUF" }];
const sources$1o = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.yaml", "wav2vec2bert_config": "model:w2v-bert-2.0/config.json", "wav2vec2bert_preprocessor_config": "model:w2v-bert-2.0/preprocessor_config.json", "bigvgan_config": "model:bigvgan/config.json", "qwen_emotion_config": "model:qwen0.6bemo4-merge/config.json", "qwen_emotion_generation_config": "model:qwen0.6bemo4-merge/generation_config.json", "qwen_emotion_tokenizer": "model:qwen0.6bemo4-merge/tokenizer.json", "qwen_emotion_tokenizer_config": "model:qwen0.6bemo4-merge/tokenizer_config.json", "qwen_emotion_vocab": "model:qwen0.6bemo4-merge/vocab.json", "qwen_emotion_merges": "model:qwen0.6bemo4-merge/merges.txt" }, "optional_files": { "bpe": "model:bpe.model", "tiktoken": "model:multilingual_zh_ja_yue_char_del.tiktoken" }, "tensors": { "gpt": { "source": "weights:", "prefix": "gpt" }, "s2mel": { "source": "weights:", "prefix": "s2mel" }, "speaker_matrix": { "source": "weights:", "prefix": "speaker_matrix" }, "emotion_matrix": { "source": "weights:", "prefix": "emotion_matrix" }, "wav2vec2bert_stats": { "source": "weights:", "prefix": "wav2vec2bert_stats" }, "wav2vec2bert": { "source": "weights:", "prefix": "wav2vec2bert" }, "semantic_codec": { "source": "weights:", "prefix": "semantic_codec" }, "campplus": { "source": "weights:", "prefix": "campplus" }, "bigvgan": { "source": "weights:", "prefix": "bigvgan" }, "qwen_emotion": { "source": "weights:", "prefix": "qwen_emotion" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.yaml", "wav2vec2bert_config": "model:w2v-bert-2.0/config.json", "wav2vec2bert_preprocessor_config": "model:w2v-bert-2.0/preprocessor_config.json", "bigvgan_config": "model:bigvgan/config.json", "qwen_emotion_config": "model:qwen0.6bemo4-merge/config.json", "qwen_emotion_generation_config": "model:qwen0.6bemo4-merge/generation_config.json", "qwen_emotion_tokenizer": "model:qwen0.6bemo4-merge/tokenizer.json", "qwen_emotion_tokenizer_config": "model:qwen0.6bemo4-merge/tokenizer_config.json", "qwen_emotion_vocab": "model:qwen0.6bemo4-merge/vocab.json", "qwen_emotion_merges": "model:qwen0.6bemo4-merge/merges.txt" }, "optional_files": { "bpe": "model:bpe.model", "tiktoken": "model:multilingual_zh_ja_yue_char_del.tiktoken" }, "tensors": { "gpt": "model:gpt.safetensors", "s2mel": "model:s2mel.safetensors", "speaker_matrix": "model:feat1.safetensors", "emotion_matrix": "model:feat2.safetensors", "wav2vec2bert_stats": "model:wav2vec2bert_stats.safetensors", "wav2vec2bert": "model:w2v-bert-2.0/model.safetensors", "semantic_codec": "model:semantic_codec_model.safetensors", "campplus": "model:campplus.safetensors", "bigvgan": "model:bigvgan/model.safetensors", "qwen_emotion": "model:qwen0.6bemo4-merge/model.safetensors" } }];
const __vite_glob_0_45 = {
  family: family$1o,
  display_name: display_name$1o,
  description: description$1o,
  category: category$1o,
  status: status$1o,
  tasks: tasks$1o,
  modes: modes$1o,
  languages: languages$1o,
  options: options$1o,
  capabilities: capabilities$1o,
  runtime: runtime$1o,
  ui: ui$1o,
  package_defaults: package_defaults$1g,
  packages: packages$1p,
  sources: sources$1o
};
const schema_version$14 = 1;
const family$1n = "inflect_v2";
const display_name$1n = "Inflect Micro v2";
const description$1n = "Compact English VITS text-to-speech models with a native GGML inference path and an external eSpeak-ng phonemizer.";
const category$1n = "tts";
const status$1n = "community";
const tasks$1n = ["tts"];
const modes$1n = ["offline"];
const languages$1n = ["en"];
const runtime$1n = { "tags": ["gguf"] };
const capabilities$1n = { "tts": ["long_form"] };
const options$1n = { "request": [{ "name": "speed", "type": "float", "description": "Speech speed multiplier mapped directly to Inflect speed; default 1.0.", "required": false, "min": 0.5, "max": 2, "default": 1 }, { "name": "variation", "type": "float", "description": "Latent Gaussian variation; default 0.667.", "required": false, "min": 0, "max": 1, "default": 0.667 }, { "name": "seed", "type": "int", "description": "Non-negative latent noise seed; default 0.", "required": false, "min": 0, "default": 0 }, { "name": "text_chunk_mode", "type": "enum", "description": "Long-form text chunking mode.", "values": ["word_budget"], "required": false, "default": "word_budget" }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 280.", "required": false, "min": 1, "default": 280 }], "session": [{ "name": "espeak_library_path", "type": "path", "description": "Optional explicit path to the eSpeak-ng shared library.", "required": false }, { "name": "espeak_data_path", "type": "path", "description": "Optional explicit path to the directory containing espeak-ng-data.", "required": false }, { "name": "exec_plan", "type": "string", "description": "JSON object of component execution plans. Component: decoder. Each plan accepts impl, backend, artifacts, and params. impl is default/ggml/rknn. GGML keeps the session backend. RKNN requires artifacts.main and ENGINE_ENABLE_RKNN; omit backend. Neither implementation takes params.", "required": false, "default": "{}" }], "load": [] };
const package_defaults$1f = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1o = [{ "id": "inflect_micro_v2_orig", "display_name": "Inflect Micro v2 Original-Dtype GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "Inflect-Micro-v2-GGUF", "files": ["Inflect-Micro-v2-GGUF/inflect-micro-v2-orig.gguf"], "strip_prefix": "Inflect-Micro-v2-GGUF" }];
const dependencies$14 = [];
const ui$1n = { "recommended_package": "inflect_micro_v2_orig", "tags": ["TTS", "GGUF"], "docs": ["docs/tts.md", "docs/models/inflect_v2.md", "docs/gguf.md"] };
const sources$1n = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_46 = {
  schema_version: schema_version$14,
  family: family$1n,
  display_name: display_name$1n,
  description: description$1n,
  category: category$1n,
  status: status$1n,
  tasks: tasks$1n,
  modes: modes$1n,
  languages: languages$1n,
  runtime: runtime$1n,
  capabilities: capabilities$1n,
  options: options$1n,
  package_defaults: package_defaults$1f,
  packages: packages$1o,
  dependencies: dependencies$14,
  ui: ui$1n,
  sources: sources$1n
};
const schema_version$13 = 1;
const family$1m = "irodori_tts";
const display_name$1m = "Irodori-TTS";
const description$1m = "Japanese TTS with RF and MeanFlow checkpoints, supporting zero-shot voice cloning, automatic duration prediction, multimodal voice design, and emoji-style control.";
const category$1m = "tts";
const status$1m = "supported";
const tasks$1m = ["tts", "clone", "design"];
const modes$1m = ["offline", "streaming"];
const languages$1m = ["ja"];
const capabilities$1m = { "clone": ["speaker_reference"], "design": ["voice_design"] };
const options$1m = { "request": [{ "name": "stream_frames_per_event", "type": "int", "description": "Codec latent frames per streaming audio event; default 12 (0.48 seconds at 25 Hz).", "required": false, "min": 1, "default": 12 }, { "name": "language", "type": "string", "description": "Text language code; Irodori-TTS supports Japanese only.", "required": false, "default": "ja" }, { "name": "instruct", "type": "string", "description": "Natural-language voice or style instruction describing target voice identity, style, or emotion; supported only by caption-conditioned checkpoints. Legacy instruction and caption are accepted as aliases.", "required": false }, { "name": "no_ref", "type": "bool", "description": "Use no-reference generation; default true unless a speaker reference is provided.", "required": false, "default": true }, { "name": "speaker_embedding_file", "type": "path", "description": "Speaker Inversion embedding (*.speaker.safetensors written by Irodori-TTS training) used as the speaker condition instead of reference audio; use it with the base checkpoint it was trained on. Cannot be combined with reference audio or no_ref=true.", "required": false }, { "name": "reference_duration_sec", "type": "float", "description": "Trim reference audio to its first reference_duration_sec seconds before encoding it, as Python Irodori-TTS does; default is the checkpoint's ref_max_seconds (30 when it has none); 0 keeps the whole reference.", "required": false, "min": 0 }, { "name": "t_schedule_mode", "type": "string", "description": "RF Euler timestep schedule: linear or sway; default linear.", "required": false, "default": "linear" }, { "name": "sway_coeff", "type": "float", "description": "Sway Sampling coefficient; must be finite and produce strictly decreasing timesteps. Default -1.0.", "required": false, "default": -1 }, { "name": "num_inference_steps", "type": "int", "description": "Sampling steps; omitted uses 40 for RF checkpoints or 4 for MeanFlow checkpoints.", "required": false, "min": 1 }, { "name": "duration_sec", "type": "float", "description": "Target duration in seconds; omitted or nonpositive values select predicted duration.", "required": false }, { "name": "duration_scale", "type": "float", "description": "Predicted-duration multiplier; must be > 0 when set; default 1.0.", "required": false, "min": 0, "default": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Text chunk policy; word_budget also accepts the legacy spelling default.", "values": ["word_budget", "tag_aware", "japanese", "endline"], "required": false, "default": "endline" }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per text chunk; default 100, or the model text-token window if smaller.", "required": false, "min": 1 }, { "name": "min_duration_sec", "type": "float", "description": "Minimum generated duration in seconds; must be > 0 and no greater than max_duration_sec; default 0.5.", "required": false, "min": 0, "default": 0.5 }, { "name": "max_duration_sec", "type": "float", "description": "Maximum generated duration in seconds; must be at least min_duration_sec; default 30. Must be > 0.", "required": false, "min": 0, "default": 30 }, { "name": "text_guidance_scale", "type": "float", "description": "Text classifier-free guidance scale; default 3.0. Nonpositive values disable the corresponding CFG branch.", "required": false, "default": 3 }, { "name": "speaker_guidance_scale", "type": "float", "description": "Speaker classifier-free guidance scale; default 5.0. Nonpositive values disable the corresponding CFG branch.", "required": false, "default": 5 }, { "name": "caption_guidance_scale", "type": "float", "description": "Caption classifier-free guidance scale; default 3.0. Nonpositive values disable the corresponding CFG branch.", "required": false, "default": 3 }, { "name": "guidance_scale", "type": "float", "description": "Override all classifier-free guidance scales when set. Nonpositive values disable the corresponding CFG branch.", "required": false }, { "name": "guidance_mode", "type": "enum", "description": "Classifier-free guidance combination mode; default independent.", "values": ["independent", "joint", "alternating"], "required": false, "default": "independent" }, { "name": "guidance_min_t", "type": "float", "description": "Minimum diffusion timestep value where guidance is active; default 0.5. The parser does not enforce a nonnegative bound.", "required": false, "default": 0.5 }, { "name": "guidance_max_t", "type": "float", "description": "Maximum diffusion timestep value where guidance is active; default 1.0. The parser does not enforce a nonnegative bound.", "required": false, "default": 1 }, { "name": "seed", "type": "int", "description": "Unsigned 32-bit generation seed in [0, 4294967295]; omitted uses a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "trim_tail", "type": "bool", "description": "Trim trailing silence-like samples; default true.", "required": false, "default": true }], "session": [{ "name": "weight_type", "type": "enum", "description": "Model weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "codec_weight_type", "type": "enum", "description": "DACVAE codec weight storage type; default native.", "preset": "weight_type_codec_q8", "required": false, "default": "native" }, { "name": "codec_backend", "type": "enum", "description": "DACVAE codec execution backend. Use cpu as an opt-in workaround for backend-specific codec decoder issues; default same.", "values": ["same", "cpu"], "required": false, "default": "same" }, { "name": "condition_graph_arena_mb", "type": "int", "description": "Condition encoder graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "rf_graph_arena_mb", "type": "int", "description": "RF sampler graph arena size in MiB; default 768.", "required": false, "min": 1, "default": 768 }, { "name": "codec_graph_arena_mb", "type": "int", "description": "DACVAE codec graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "codec_decode_chunk_steps", "type": "int", "description": "Decode the latent in windows of this many frames (25 per second) so the codec's activation memory stops growing with the output length; 0 decodes the whole sequence at once (default).", "required": false, "min": 0, "default": 0 }, { "name": "codec_decode_overlap_steps", "type": "int", "description": "Latent frames of context decoded on each side of a window and then discarded; default 16.", "required": false, "min": 0, "default": 16 }, { "name": "codec_encode_chunk_steps", "type": "int", "description": "Encode reference audio in windows of this many latent frames (25 per second) so the codec's activation memory stops growing with the reference length; 0 encodes the whole reference at once (default).", "required": false, "min": 0, "default": 0 }, { "name": "codec_encode_overlap_steps", "type": "int", "description": "Latent frames of reference audio encoded as context on each side of a window and then discarded; default 16.", "required": false, "min": 0, "default": 16 }, { "name": "condition_weight_context_mb", "type": "int", "description": "Condition encoder weight context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "rf_weight_context_mb", "type": "int", "description": "RF sampler weight context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "codec_weight_context_mb", "type": "int", "description": "DACVAE codec weight context size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime graphs after request phases; default true.", "required": false, "default": true }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-speaker cache slots; default 1.", "required": false, "min": 0, "default": 1 }], "load": [] };
const dependencies$13 = [];
const runtime$1m = { "tags": ["gguf"] };
const ui$1m = { "recommended_package": "irodori_tts_v4_small_q8_0", "tags": ["TTS", "Clone", "Design", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const package_defaults$1e = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1n = [{ "id": "irodori_tts_v4_small_q8_0", "display_name": "Irodori-TTS v4.1 Small Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Irodori-TTS-v4-Small-GGUF", "files": ["Irodori-TTS-v4-Small-GGUF/irodori-tts-v4-small-q8_0.gguf"], "strip_prefix": "Irodori-TTS-v4-Small-GGUF" }, { "id": "irodori_tts_v4_1_anime_q8_0", "display_name": "Irodori-TTS v4.1 Anime Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Irodori-TTS-v4-Small-GGUF", "files": ["Irodori-TTS-v4-Small-GGUF/irodori-tts-v4.1-anime-q8_0.gguf"], "strip_prefix": "Irodori-TTS-v4-Small-GGUF" }, { "id": "irodori_tts_v4_small_f16", "display_name": "Irodori-TTS v4.1 Small F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Irodori-TTS-v4-Small-GGUF", "files": ["Irodori-TTS-v4-Small-GGUF/irodori-tts-v4-small-f16.gguf"], "strip_prefix": "Irodori-TTS-v4-Small-GGUF" }, { "id": "irodori_tts_600m_v3_voicedesign_q8_0", "display_name": "Irodori-TTS 600M v3 VoiceDesign Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Irodori-TTS-600M-v3-VoiceDesign-GGUF", "files": ["Irodori-TTS-600M-v3-VoiceDesign-GGUF/irodori-tts-600m-v3-voicedesign-q8_0.gguf"], "strip_prefix": "Irodori-TTS-600M-v3-VoiceDesign-GGUF" }, { "id": "irodori_tts_600m_v3_voicedesign_f16", "display_name": "Irodori-TTS 600M v3 VoiceDesign F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Irodori-TTS-600M-v3-VoiceDesign-GGUF", "files": ["Irodori-TTS-600M-v3-VoiceDesign-GGUF/irodori-tts-600m-v3-voicedesign-f16.gguf"], "strip_prefix": "Irodori-TTS-600M-v3-VoiceDesign-GGUF" }, { "id": "irodori_tts_500m_v3_q8_0", "display_name": "Irodori-TTS 500M v3 Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Irodori-TTS-500M-v3-GGUF", "files": ["Irodori-TTS-500M-v3-GGUF/irodori-tts-500m-v3-q8_0.gguf"], "strip_prefix": "Irodori-TTS-500M-v3-GGUF" }, { "id": "irodori_tts_v4_1_small_mf_q8_0", "display_name": "Irodori-TTS v4.1 Small MeanFlow Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Irodori-TTS-v4-Small-GGUF", "files": ["Irodori-TTS-v4-Small-GGUF/irodori-tts-v4.1-small-mf-q8_0.gguf"], "strip_prefix": "Irodori-TTS-v4-Small-GGUF" }, { "id": "irodori_tts_v4_1_small_mf_f16", "display_name": "Irodori-TTS v4.1 Small MeanFlow F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Irodori-TTS-v4-Small-GGUF", "files": ["Irodori-TTS-v4-Small-GGUF/irodori-tts-v4.1-small-mf-f16.gguf"], "strip_prefix": "Irodori-TTS-v4-Small-GGUF" }, { "id": "irodori_tts_500m_v3_f16", "display_name": "Irodori-TTS 500M v3 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Irodori-TTS-500M-v3-GGUF", "files": ["Irodori-TTS-500M-v3-GGUF/irodori-tts-500m-v3-f16.gguf"], "strip_prefix": "Irodori-TTS-500M-v3-GGUF" }];
const sources$1m = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "model_config": "model:model_config.json" }, "optional_files": { "tokenizer_json": "model:tokenizer.json", "tokenizer_v4_json": "model:tokenizer/tokenizer.json", "pretrained_text_config": "model:text_encoder_config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "codec_weights": { "source": "weights:", "prefix": "codec_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "tokenizer": "../llm-jp-3-150m", "codec": "../Semantic-DACVAE-Japanese-32dim" }, "files": { "model_config": "model:model_config.json" }, "optional_files": { "tokenizer_json": "tokenizer:tokenizer.json", "tokenizer_v4_json": "model:tokenizer/tokenizer.json", "pretrained_text_config": "model:text_encoder_config.json" }, "tensors": { "model_weights": "model:model.safetensors", "codec_weights": "codec:weights.safetensors" } }];
const __vite_glob_0_47 = {
  schema_version: schema_version$13,
  family: family$1m,
  display_name: display_name$1m,
  description: description$1m,
  category: category$1m,
  status: status$1m,
  tasks: tasks$1m,
  modes: modes$1m,
  languages: languages$1m,
  capabilities: capabilities$1m,
  options: options$1m,
  dependencies: dependencies$13,
  runtime: runtime$1m,
  ui: ui$1m,
  package_defaults: package_defaults$1e,
  packages: packages$1n,
  sources: sources$1m
};
const schema_version$12 = 1;
const family$1l = "kitten_tts";
const display_name$1l = "KittenTTS Mini 0.8";
const description$1l = "Native KittenTTS Mini 0.8 English text-to-speech with eight built-in voices and shared eSpeak-ng phonemization.";
const category$1l = "tts";
const status$1l = "community";
const tasks$1l = ["tts"];
const modes$1l = ["offline"];
const languages$1l = ["en"];
const runtime$1l = { "tags": ["gguf"] };
const capabilities$1l = { "tts": ["built_in_voices", "long_form"] };
const options$1l = { "request": [{ "name": "voice_id", "type": "enum", "values": ["Bella", "Bruno", "Hugo", "Jasper", "Kiki", "Leo", "Luna", "Rosie", "expr-voice-2-f", "expr-voice-2-m", "expr-voice-3-f", "expr-voice-3-m", "expr-voice-4-f", "expr-voice-4-m", "expr-voice-5-f", "expr-voice-5-m"], "description": "Built-in voice ID or package alias; structured voice input (CLI --voice-id) takes precedence.", "required": false, "default": "expr-voice-5-m" }, { "name": "speed", "type": "float", "description": "Speech speed multiplier; larger values produce faster speech. Must be finite and positive.", "required": false, "default": 1 }, { "name": "seed", "type": "int", "description": "Decoder noise seed for the current request; omitted requests choose a fresh random seed.", "required": false, "min": 0 }, { "name": "text_chunk_mode", "type": "enum", "description": "Long-form text chunking mode.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form chunk.", "required": false, "min": 1, "default": 400 }], "session": [{ "name": "weight_type", "type": "enum", "preset": "weight_type_full", "description": "Storage type for matrix multiplication weights.", "required": false, "default": "native" }, { "name": "conv_weight_type", "type": "enum", "preset": "weight_type_conv", "description": "Storage type for convolution weights.", "required": false, "default": "native" }, { "name": "graph_capacity_mode", "type": "enum", "description": "Offline graph capacity policy.", "values": ["fixed", "tiered", "grow", "double"], "required": false, "default": "fixed" }, { "name": "max_input_tokens", "type": "int", "description": "Maximum predictor input token capacity; defaults to min(512, checkpoint context_length).", "required": false, "min": 1, "max": 512, "default": 512 }, { "name": "pre_tail_tokens", "type": "int", "description": "Optional prebuilt predictor tail token capacity.", "required": false, "min": 0, "max": 512, "default": 0 }, { "name": "espeak_library_path", "type": "path", "description": "Optional explicit path to the eSpeak-ng shared library.", "required": false }, { "name": "espeak_data_path", "type": "path", "description": "Optional explicit path to espeak-ng-data.", "required": false }], "load": [] };
const package_defaults$1d = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1m = [{ "id": "kitten_tts_mini_0_8_orig", "display_name": "KittenTTS Mini 0.8 Original-Dtype GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "KittenTTS-GGUF", "files": ["KittenTTS-GGUF/kitten-tts-mini-0.8-orig.gguf"], "strip_prefix": "KittenTTS-GGUF" }];
const dependencies$12 = [];
const ui$1l = { "recommended_package": "kitten_tts_mini_0_8_orig", "tags": ["TTS", "GGUF"], "builtin_voices": ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"], "default_voice": "Leo", "docs": ["docs/models/kitten_tts.md", "docs/tts.md", "docs/gguf.md"] };
const sources$1l = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "kitten" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:ggml/kitten_tts.safetensors" } }];
const __vite_glob_0_48 = {
  schema_version: schema_version$12,
  family: family$1l,
  display_name: display_name$1l,
  description: description$1l,
  category: category$1l,
  status: status$1l,
  tasks: tasks$1l,
  modes: modes$1l,
  languages: languages$1l,
  runtime: runtime$1l,
  capabilities: capabilities$1l,
  options: options$1l,
  package_defaults: package_defaults$1d,
  packages: packages$1m,
  dependencies: dependencies$12,
  ui: ui$1l,
  sources: sources$1l
};
const schema_version$11 = 1;
const family$1k = "kitten_tts2";
const display_name$1k = "Kitten TTS 2";
const description$1k = "Native multilingual Kitten TTS 2 Qwen3 speech generation, S3 meanflow decoder, and reference-audio voice cloning.";
const category$1k = "tts";
const status$1k = "experimental";
const tasks$1k = ["tts", "clone"];
const modes$1k = ["offline"];
const languages$1k = ["en", "ar", "zh", "fr", "de", "hi", "it", "pt", "ru", "es", "nl", "id", "ja", "ko", "pl", "tr"];
const runtime$1k = { "tags": ["gguf", "cpu"] };
const capabilities$1k = { "tts": ["built_in_voices", "long_form"], "clone": ["speaker_reference"] };
const options$1k = { "request": [{ "name": "voice_id", "type": "enum", "values": ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo", "Matthew", "Elliot", "Willow", "Dolores", "Victor", "Dante", "Alfred", "Saoirse", "Claire", "Raven", "Marcus", "Herbert", "Diana", "Laurence", "Maeve", "Walter", "Edith", "Miles", "Grace", "Reginald", "Iris", "Frank", "Serena", "Julian", "Eleanor", "Otis", "Vincent", "Martha", "Sable", "Victoria", "PreparedBruno", "Arabic", "Chinese", "French", "German", "Hindi", "Italian", "Portuguese", "Russian", "Spanish", "AirportAnnouncer", "ArabicChildSchool", "ArabicFalconer", "ArabicMother", "ArabicNews", "AudiobookNarratorFemale", "BoredTeenager", "CalmHostageNegotiator", "ChineseKidSpringFestival", "ChineseLivestreamSeller", "ChineseNewsCctv", "ChineseXianxiaMaster", "DutchBaker", "DutchGrandpaStory", "DutchWeatherPresenter", "FairytaleNarratorWhimsical", "FrenchDocumentary", "FrenchGrandmereRecette", "FrenchTeacher", "FrenchWaiter", "GermanKidBirthday", "GermanKneipe", "GermanProfessor", "GermanTrainAnnouncement", "GrandmaBedtimeStory", "GriefEulogy", "HindiBollywoodDrama", "HindiCollegeFriends", "HindiDadiKahani", "HindiYogaTeacher", "IndonesianNewsAnchor", "IndonesianTourGuide", "ItalianChildSchool", "ItalianFashionDesigner", "ItalianFootballFan", "ItalianGondolier", "ItalianNonnaKitchen", "ItalianOperaTenor", "JapaneseAnimeHeroine", "JapaneseGrandma", "JapaneseSalarymanApology", "JapaneseTrainConductor", "KoreanGrandpaAdvice", "KoreanKdramaConfession", "KoreanNewsAnchor", "LittleGirlExplaining", "NervousFirstDate", "NewsAnchorFemale", "PilotCabinAnnouncement", "PolishBabciaPierogi", "PolishMountainGuide", "PolishNewsAnchor", "PolishPoetryStudent", "PortugueseBeach", "PortugueseBusiness", "PortugueseFado", "PortugueseGrandpaFarm", "PortugueseKidFutebol", "PortugueseNewsAnchor", "RussianBabushka", "RussianFairyTale", "RussianHockeyCheer", "RussianLiteratureTeacher", "RussianSpaceControl", "RussianTaxiDriver", "SarcasticCoworker", "SchoolboyPresentation", "SpanishAbuela", "SpanishBreakupSad", "SpanishChildCuento", "SpanishNews", "SpanishTango", "TurkishFisherman", "TurkishGrandmaCooking", "TurkishNewsAnchor", "WeatherPresenterCheerful"], "required": false, "default": "Bruno", "description": "Prepared voice name available in the loaded package. A supplied reference clip takes precedence." }, { "name": "preset", "type": "enum", "values": ["stable", "expressive"], "required": false, "default": "stable", "description": "Upstream sampling preset." }, { "name": "temperature", "type": "float", "min": 0, "required": false, "description": "Sampling temperature; zero selects greedy decoding. Otherwise defaults to the preset." }, { "name": "top_k", "type": "int", "min": 0, "required": false, "description": "Top-k sampling cutoff; defaults to the preset." }, { "name": "top_p", "type": "float", "max": 1, "required": false, "description": "Nucleus sampling cutoff; defaults to the preset. Must be in (0, 1]." }, { "name": "min_p", "type": "float", "min": 0, "max": 1, "required": false, "description": "Minimum relative probability; defaults to the preset." }, { "name": "repetition_penalty", "type": "float", "min": 1, "required": false, "default": 1.1, "description": "Penalty over the last 50 generated tokens; silence and ending tokens are exempt." }, { "name": "max_tokens", "type": "int", "min": 1, "max": 8192, "required": false, "description": "Speech-token budget per text chunk. Omitted budgets scale with text length, with a minimum of 200." }, { "name": "seed", "type": "int", "min": 0, "required": false, "description": "Seed for sampling and waveform decoding." }, { "name": "text_chunk_size", "type": "int", "min": 32, "max": 1e3, "required": false, "default": 380, "description": "Maximum Unicode codepoints per framework text chunk." }, { "name": "text_chunk_mode", "type": "enum", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "tag_aware", "description": "Framework long-form text chunking mode." }, { "name": "reference_text", "type": "string", "required": false, "description": "Transcript of the reference audio; required when cloning from a 1–30 second clip." }], "load": [], "session": [{ "name": "exec_plan", "type": "string", "required": false, "default": "{}", "description": "Component execution plan JSON. vocoder accepts impl=ggml (default) or neon with backend=cpu. NEON requires ENGINE_ENABLE_NEON=ON and an AArch64 NEON CPU, and replaces only the HiFT neural convolution stack." }, { "name": "weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q4_0", "q8_0"], "required": false, "default": "native", "description": "Qwen projection storage. native preserves the GGUF's intended tensor types. An explicit override changes projection storage only." }] };
const package_defaults$1c = { "download": { "kind": "huggingface_snapshot", "repo": "dignome/kitten_tts2", "revision": "main", "gated": false } };
const packages$1l = [{ "id": "kitten_tts2_bf16", "display_name": "Kitten TTS 2 BF16 GGUF (Previous Checkpoint)", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "kitten-tts2-v2", "files": ["kitten-tts2-bf16-multilingual.gguf", "LICENSE", "NOTICE", "native/LICENSE", "speaker/LICENSE", "SHA256SUMS"] }, { "id": "kitten_tts2_q8_v2", "display_name": "Kitten TTS 2 Q8 GGUF (Previous Checkpoint)", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "kitten-tts2-v2", "files": ["kitten-tts2-q8-v2-multilingual.gguf", "LICENSE", "NOTICE", "native/LICENSE", "speaker/LICENSE", "SHA256SUMS"] }, { "id": "kitten_tts2_q4", "display_name": "Kitten TTS 2 Hybrid Q4 GGUF (Previous Checkpoint, Experimental)", "default": false, "format": "gguf", "precision": "q4_0", "target_directory": "kitten-tts2-v2", "files": ["kitten-tts2-q4-multilingual.gguf", "LICENSE", "NOTICE", "native/LICENSE", "speaker/LICENSE", "SHA256SUMS"] }, { "id": "kitten_tts2_20261021_q8_0", "display_name": "Kitten TTS 2 2026-10-21 Q8 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "KittenTTS2-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false }, "files": ["KittenTTS2-GGUF/kitten-tts2-20261021-q8_0.gguf"], "strip_prefix": "KittenTTS2-GGUF" }, { "id": "kitten_tts2_20261021_q4_0", "display_name": "Kitten TTS 2 2026-10-21 Q4 GGUF (BF16 Embedding)", "default": false, "format": "gguf", "precision": "q4_0", "target_directory": "KittenTTS2-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false }, "files": ["KittenTTS2-GGUF/kitten-tts2-20261021-q4_0.gguf"], "strip_prefix": "KittenTTS2-GGUF" }];
const dependencies$11 = [];
const ui$1k = { "recommended_package": "kitten_tts2_20261021_q8_0", "min_vram_gb": 7, "tags": ["TTS", "GGUF"], "builtin_voices": ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo", "Matthew", "Elliot", "Willow", "Dolores", "Victor", "Dante", "Alfred", "Saoirse", "Claire", "Raven", "Marcus", "Herbert", "Diana", "Laurence", "Maeve", "Walter", "Edith", "Miles", "Grace", "Reginald", "Iris", "Frank", "Serena", "Julian", "Eleanor", "Otis", "Vincent", "Martha", "Sable", "Victoria", "Arabic", "Chinese", "French", "German", "Hindi", "Italian", "Portuguese", "Russian", "Spanish"], "default_voice": "Bruno", "docs": ["docs/models/kitten_tts2.md"] };
const sources$1k = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "lm_config": "model:lm/config.json", "tokenizer_config": "model:lm/tokenizer_config.json", "tokenizer_json": "model:lm/tokenizer.json", "default_voices": "model:cpp/default/voices.json" }, "tensors": { "language_model": { "source": "weights:", "prefix": "language_model" }, "s3gen": { "source": "weights:", "prefix": "s3gen" }, "speaker": { "source": "weights:", "prefix": "speaker" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "lm_config": "model:lm/config.json", "tokenizer_config": "model:lm/tokenizer_config.json", "tokenizer_json": "model:lm/tokenizer.json", "default_voices": "model:cpp/default/voices.json" }, "tensors": { "language_model": "model:lm/model.safetensors", "s3gen": "model:native/s3gen_meanflow.safetensors", "speaker": "model:speaker/model.safetensors" } }];
const __vite_glob_0_49 = {
  schema_version: schema_version$11,
  family: family$1k,
  display_name: display_name$1k,
  description: description$1k,
  category: category$1k,
  status: status$1k,
  tasks: tasks$1k,
  modes: modes$1k,
  languages: languages$1k,
  runtime: runtime$1k,
  capabilities: capabilities$1k,
  options: options$1k,
  package_defaults: package_defaults$1c,
  packages: packages$1l,
  dependencies: dependencies$11,
  ui: ui$1k,
  sources: sources$1k
};
const schema_version$10 = 1;
const family$1j = "kokoro_tts";
const display_name$1j = "Kokoro 82M";
const description$1j = "Kokoro 82M multilingual text-to-speech with 54 preset voices, optimized native CPU inference, and shared eSpeak-ng phonemization.";
const category$1j = "tts";
const status$1j = "community";
const tasks$1j = ["tts"];
const modes$1j = ["offline", "streaming"];
const languages$1j = ["en-us", "en-gb", "es", "fr-fr", "hi", "it", "ja", "pt-br", "zh"];
const runtime$1j = { "tags": ["gguf", "stream"] };
const capabilities$1j = { "tts": ["built_in_voices", "long_form"] };
const options$1j = { "request": [{ "name": "voice_id", "type": "enum", "values": ["af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa", "bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george", "bm_lewis", "ef_dora", "em_alex", "em_santa", "ff_siwis", "hf_alpha", "hf_beta", "hm_omega", "hm_psi", "if_sara", "im_nicola", "jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo", "pf_dora", "pm_alex", "pm_santa", "zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi", "zm_yunjian", "zm_yunxi", "zm_yunxia", "zm_yunyang"], "description": "Built-in voice ID; structured voice input (CLI --voice-id) takes precedence.", "required": false, "default": "af_heart" }, { "name": "language", "type": "string", "description": "Language selection precedence: voice-style language, transcript language (CLI --language), request-option language, then voice prefix. Must match the first voice in a blend.", "required": false }, { "name": "seed", "type": "int", "description": "Decoder noise seed for the current request; omitted requests choose a fresh random seed.", "required": false, "min": 0 }, { "name": "speed", "type": "float", "description": "Speech speed multiplier; default 1.0. Must be finite and positive.", "required": false, "default": 1 }, { "name": "phonemes", "type": "string_list", "description": "Kokoro-vocabulary phonemes to synthesize directly, bypassing the built-in eSpeak-ng G2P. One entry per chunk: entries are rendered in order and merged into one result, so the caller chooses the split points that only its own G2P knows. Each entry must be at most 510 symbols and must not be empty -- an entry is a chunk to speak, so drop it rather than leaving it blank. Text is still required and its language must still match the voice.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum codepoints per text chunk before synthesis. Default 100 for Chinese and Japanese voices, otherwise 240.", "required": false, "min": 1 }, { "name": "return_timestamps", "type": "bool", "description": "Report where each phoneme group lands in the output, from the durations the model predicts before vocoding. Entries are phoneme groups in Kokoro's own alphabet, not written words, and do not map one-to-one onto the input text: see docs/models/kokoro_tts.md. Default false.", "required": false, "default": false }], "session": [{ "name": "weight_type", "type": "enum", "preset": "weight_type_full", "required": false, "default": "native", "description": "Storage type for matrix multiplication weights." }, { "name": "conv_weight_type", "type": "enum", "preset": "weight_type_conv", "required": false, "default": "native", "description": "Storage type for convolution weights." }, { "name": "weight_context_mb", "type": "int", "description": "Weight loading context size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "predictor_duration_graph_arena_mb", "type": "int", "description": "Predictor duration host graph-metadata arena size in MiB, not device workspace; default 384.", "required": false, "min": 1, "default": 384 }, { "name": "predictor_text_graph_arena_mb", "type": "int", "description": "Predictor text host graph-metadata arena size in MiB, not device workspace; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "predictor_tail_graph_arena_mb", "type": "int", "description": "Predictor tail host graph-metadata arena size in MiB, not device workspace; default 640.", "required": false, "min": 1, "default": 640 }, { "name": "graph_capacity_mode", "type": "enum", "description": "Offline graph capacity policy; default fixed.", "values": ["fixed", "tiered", "grow", "double"], "required": false, "default": "fixed" }, { "name": "max_input_tokens", "type": "int", "description": "Predictor graph input token capacity; default min(512, model context length).", "required": false, "min": 1 }, { "name": "pre_tail_tokens", "type": "int", "description": "Optional prebuilt predictor tail token capacity; default 0.", "required": false, "min": 0, "default": 0 }, { "name": "exec_plan", "type": "string", "description": "JSON object of component execution plans. Component: generator. Each plan accepts impl, backend, artifacts, and params. impl is default/ggml/rknn/neon. GGML keeps the session backend. The complete NEON generator requires a CPU session and ENGINE_ENABLE_NEON=ON on AArch64, without artifacts or params. RKNN requires artifacts.main and ENGINE_ENABLE_RKNN; omit backend. RKNN params: overlap (nonnegative integer, default 0, smaller than the emitted window), gain (boolean, default false; keeps a GGML generator reference).", "required": false, "default": "{}" }], "load": [] };
const package_defaults$1b = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1k = [{ "id": "kokoro_82m_q8_0", "display_name": "Kokoro 82M Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Kokoro-82M-GGUF", "files": ["Kokoro-82M-GGUF/kokoro-82m-q8_0.gguf"], "strip_prefix": "Kokoro-82M-GGUF" }, { "id": "kokoro_82m_bf16", "display_name": "Kokoro 82M BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Kokoro-82M-GGUF", "files": ["Kokoro-82M-GGUF/kokoro-82m-bf16.gguf"], "strip_prefix": "Kokoro-82M-GGUF" }, { "id": "kokoro_82m_generator_rk3588", "display_name": "Kokoro 82M NPU Generator RKNN (RK3588)", "format": "rknn", "precision": "f16", "target_directory": "Kokoro-82M-GGUF", "files": ["rk3588/generator_w512.rknn"], "strip_prefix": "rk3588", "description": "Pre-compiled RK3588 engine for the kokoro_tts RKNN generator sidecar (kokoro_tts.exec_plan, artifacts.main); installs beside the GGUF weights and is named by bare file name. Built by tools/rknn from the Kokoro-82M iSTFTNet generator export; see docs/build/rockchip-npu.md.", "download": { "kind": "huggingface_snapshot", "repo": "wOvANAI/rknn-tts-engines", "revision": "main", "gated": false } }];
const dependencies$10 = [];
const ui$1j = { "recommended_package": "kokoro_82m_q8_0", "tags": ["TTS", "GGUF"], "builtin_voices": ["af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa", "bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george", "bm_lewis", "ef_dora", "em_alex", "em_santa", "ff_siwis", "hf_alpha", "hf_beta", "hm_omega", "hm_psi", "if_sara", "im_nicola", "jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo", "pf_dora", "pm_alex", "pm_santa", "zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi", "zm_yunjian", "zm_yunxi", "zm_yunxia", "zm_yunyang"], "default_voice": "af_heart", "docs": ["tests/kokoro_tts/MULTILINGUAL_GGUF.md"] };
const sources$1j = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "voices": "model:voices.json", "vocabulary": "model:vocab.tsv" }, "tensors": { "weights": { "source": "weights:", "prefix": "kokoro" } } }];
const __vite_glob_0_50 = {
  schema_version: schema_version$10,
  family: family$1j,
  display_name: display_name$1j,
  description: description$1j,
  category: category$1j,
  status: status$1j,
  tasks: tasks$1j,
  modes: modes$1j,
  languages: languages$1j,
  runtime: runtime$1j,
  capabilities: capabilities$1j,
  options: options$1j,
  package_defaults: package_defaults$1b,
  packages: packages$1k,
  dependencies: dependencies$10,
  ui: ui$1j,
  sources: sources$1j
};
const schema_version$$ = 1;
const family$1i = "kroko_asr";
const display_name$1i = "Kroko Community ASR";
const description$1i = "Native Zipformer2 RNN-T transcription for the public free Kroko Community single-language packages, with offline and stateful streaming inference, greedy and modified beam decoding, hotwords, endpoint segments, partial results, and word timestamps.";
const category$1i = "asr";
const status$1i = "community";
const tasks$1i = ["asr"];
const modes$1i = ["offline", "streaming"];
const languages$1i = ["de", "en", "es", "fr", "it", "he", "nl", "pt", "sv", "tr"];
const capabilities$1i = { "asr": ["word_timestamps", "partial_results", "segments"] };
const options$1i = { "request": [{ "name": "language", "type": "string", "description": "Language code matching the selected single-language Kroko package; default auto uses the package language.", "required": false, "default": "auto" }, { "name": "decoding_method", "type": "enum", "description": "RNN-T decoding method; greedy search remains the parity-tested default.", "values": ["greedy_search", "modified_beam_search"], "required": false, "default": "greedy_search" }, { "name": "num_beams", "type": "int", "description": "Maximum active hypotheses retained by modified beam search.", "required": false, "min": 1, "max": 64, "default": 4 }, { "name": "blank_penalty", "type": "float", "description": "Non-negative score subtracted from the RNN-T blank logit.", "required": false, "min": 0, "default": 0 }, { "name": "hotwords", "type": "string", "description": "Slash- or newline-separated natural-text phrases; requires modified beam search.", "required": false }, { "name": "hotwords_score", "type": "float", "description": "Non-negative per-token context boost for hotword phrases.", "required": false, "min": 0, "default": 1.5 }, { "name": "enable_endpoint", "type": "bool", "description": "Enable automatic endpoint speech segments.", "required": false, "default": false }, { "name": "rule1_min_trailing_silence_sec", "type": "float", "description": "Endpoint timeout in seconds even when no speech token was decoded.", "required": false, "min": 0, "default": 2.4 }, { "name": "rule2_min_trailing_silence_sec", "type": "float", "description": "Endpoint silence in seconds after a speech token was decoded.", "required": false, "min": 0, "default": 1.2 }, { "name": "rule3_min_utterance_length_sec", "type": "float", "description": "Maximum utterance duration in seconds before an endpoint.", "required": false, "min": 0, "default": 20 }], "session": [], "load": [] };
const runtime$1i = { "tags": ["gguf", "stream"] };
const sources$1i = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokens": "model:tokens.txt" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokens": "model:tokens.txt" }, "tensors": { "weights": "model:model.safetensors" } }];
const package_defaults$1a = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1j = [{ "id": "kroko_asr_community_q8_0", "display_name": "Kroko Community ASR Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Kroko-ASR-GGUF", "files": ["Kroko-ASR-GGUF/kroko-en-community-64-l-q8_0.gguf"], "strip_prefix": "Kroko-ASR-GGUF" }];
const dependencies$$ = [];
const ui$1i = { "recommended_package": "kroko_asr_community_q8_0", "tags": ["ASR", "GGUF"], "docs": ["docs/asr.md", "docs/models/kroko_asr.md", "docs/gguf.md"] };
const __vite_glob_0_51 = {
  schema_version: schema_version$$,
  family: family$1i,
  display_name: display_name$1i,
  description: description$1i,
  category: category$1i,
  status: status$1i,
  tasks: tasks$1i,
  modes: modes$1i,
  languages: languages$1i,
  capabilities: capabilities$1i,
  options: options$1i,
  runtime: runtime$1i,
  sources: sources$1i,
  package_defaults: package_defaults$1a,
  packages: packages$1j,
  dependencies: dependencies$$,
  ui: ui$1i
};
const schema_version$_ = 1;
const family$1h = "kugelaudio";
const display_name$1h = "KugelAudio-0-Open";
const description$1h = "KugelAudio text-to-speech with bundled preset voices and incremental audio output.";
const category$1h = "tts";
const status$1h = "experimental";
const tasks$1h = ["tts"];
const modes$1h = ["offline", "streaming"];
const languages$1h = ["en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "uk", "cs", "ro", "hu", "sv", "da", "fi", "no", "el", "bg", "sk", "hr", "sr", "tr"];
const runtime$1h = { "tags": ["gguf"] };
const capabilities$1h = { "tts": ["long_form"] };
const options$1h = { "request": [{ "name": "voice_id", "type": "enum", "values": ["default", "clear", "english_female", "english_male"], "description": "Bundled preset voice.", "default": "default", "required": false }, { "name": "num_inference_steps", "type": "int", "description": "Diffusion steps per acoustic frame, from 1 to 1000; omitted uses the checkpoint's diffusion_head_config.ddpm_num_inference_steps.", "min": 1, "max": 1e3, "default": 20, "required": false }, { "name": "guidance_scale", "type": "float", "description": "Diffusion classifier-free guidance; 1 disables the unconditional pass. Any finite value is accepted; negative values enter CFG arithmetic.", "default": 3, "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum autoregressive tokens per text chunk.", "min": 1, "default": 2048, "required": false }, { "name": "do_sample", "type": "bool", "description": "Sample autoregressive speech control tokens instead of greedy decoding.", "default": false, "required": false }, { "name": "temperature", "type": "float", "description": "Autoregressive sampling temperature when do_sample is enabled. Any finite value is accepted; negative values disable sampling.", "default": 1, "required": false }, { "name": "seed", "type": "int", "description": "Random seed; -1 chooses a random seed.", "min": -1, "default": 1234, "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk.", "min": 1, "default": 300, "required": false }, { "name": "text_chunk_mode", "type": "enum", "values": ["default", "tag_aware", "japanese", "endline"], "description": "Framework long-form text splitting mode.", "default": "default", "required": false }], "session": [{ "name": "weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "description": "Weight storage type; native preserves packaged tensor types.", "default": "native", "required": false }], "load": [] };
const package_defaults$19 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1i = [{ "id": "kugelaudio_0_open_bf16", "display_name": "KugelAudio-0-Open BF16 GGUF", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "KugelAudio-0-Open-GGUF", "files": ["KugelAudio-0-Open-GGUF/kugelaudio-0-open-bf16.gguf"], "strip_prefix": "KugelAudio-0-Open-GGUF" }, { "id": "kugelaudio_0_open_q8_0", "display_name": "KugelAudio-0-Open Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "KugelAudio-0-Open-GGUF", "files": ["KugelAudio-0-Open-GGUF/kugelaudio-0-open-q8_0.gguf"], "strip_prefix": "KugelAudio-0-Open-GGUF" }, { "id": "kugelaudio_0_open_q4_k", "display_name": "KugelAudio-0-Open Q4_K GGUF", "default": false, "format": "gguf", "precision": "q4_k", "target_directory": "KugelAudio-0-Open-GGUF", "files": ["KugelAudio-0-Open-GGUF/kugelaudio-0-open-q4_k.gguf"], "strip_prefix": "KugelAudio-0-Open-GGUF" }];
const dependencies$_ = [];
const ui$1h = { "recommended_package": "kugelaudio_0_open_q8_0", "default_voice": "default", "builtin_voices": ["default", "clear", "english_female", "english_male"], "tags": ["TTS", "Stream", "GGUF"], "docs": ["docs/models/kugelaudio.md", "docs/gguf.md"] };
const sources$1h = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:text_tokenizer/tokenizer.json", "tokenizer_config": "model:text_tokenizer/tokenizer_config.json" }, "tensors": { "model_weights": "weights:" } }];
const __vite_glob_0_52 = {
  schema_version: schema_version$_,
  family: family$1h,
  display_name: display_name$1h,
  description: description$1h,
  category: category$1h,
  status: status$1h,
  tasks: tasks$1h,
  modes: modes$1h,
  languages: languages$1h,
  runtime: runtime$1h,
  capabilities: capabilities$1h,
  options: options$1h,
  package_defaults: package_defaults$19,
  packages: packages$1i,
  dependencies: dependencies$_,
  ui: ui$1h,
  sources: sources$1h
};
const schema_version$Z = 1;
const family$1g = "latentsync";
const display_name$1g = "LatentSync 1.6";
const description$1g = "Audio-conditioned lip synchronization of a reference video.";
const category$1g = "audio_generation";
const status$1g = "experimental";
const tasks$1g = ["sfx"];
const modes$1g = ["offline"];
const languages$1g = ["auto"];
const capabilities$1g = {};
const runtime$1g = { "tags": ["gguf"] };
const options$1g = { "request": [{ "name": "reference_video_file", "type": "path", "required": true, "description": "Reference video containing the face to synchronize. Requires FFmpeg on PATH." }, { "name": "num_inference_steps", "required": false, "type": "int", "min": 1, "max": 999, "default": 20, "description": "Number of DDIM denoising steps." }, { "name": "cache_interval", "required": false, "type": "int", "min": 1, "default": 1, "description": "DeepCache refresh interval. One disables caching; three matches the upstream DeepCache preset. Higher values trade output fidelity for speed." }, { "name": "guidance_scale", "required": false, "type": "float", "min": 0, "default": 1.5, "description": "Audio classifier-free guidance scale; values at or below one disable CFG." }, { "name": "frames_per_chunk", "required": false, "type": "int", "min": 1, "max": 24, "default": 16, "description": "Frames processed together by the temporal denoiser." }, { "name": "fps", "required": false, "type": "float", "min": 1, "default": 25, "description": "Video sampling and output frame rate." }, { "name": "seed", "required": false, "type": "int", "min": 0, "default": 1247, "description": "Random seed for latent noise and VAE posterior sampling." }], "session": [{ "name": "weight_type", "required": false, "type": "enum", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "default": "native", "description": "Weight storage type; native preserves packaged tensor types." }, { "name": "vae_cudnn_f16", "required": false, "type": "bool", "default": false, "description": "Use cuDNN FP16 VAE execution on CUDA. Requires a build with GGML_CUDA_CUDNN_CONV2D=ON; VAE weights are converted to FP16." }, { "name": "unet_cudnn_f16", "required": false, "type": "bool", "default": false, "description": "Use cuDNN FP16 convolutions and residual activations in the U-Net on CUDA. Requires a build with GGML_CUDA_CUDNN_CONV2D=ON and FP16 U-Net weights." }, { "name": "mem_saver", "required": false, "type": "bool", "default": false, "description": "Release components between pipeline stages and run CFG branches sequentially to reduce peak VRAM. Reloading the VAE for decoding adds some latency." }], "load": [] };
const package_defaults$18 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/LatentSync-1.6-GGUF", "revision": "main", "gated": false } };
const packages$1h = [{ "id": "latentsync_1_6_q8_0_f16", "display_name": "LatentSync 1.6 Q8/F16", "format": "gguf", "precision": "q8_0", "default": true, "target_directory": "LatentSync-1.6-GGUF", "files": ["latentsync-1.6-q8_0-f16.gguf"] }, { "id": "latentsync_1_6_f16", "display_name": "LatentSync 1.6 F16", "format": "gguf", "precision": "f16", "default": false, "target_directory": "LatentSync-1.6-GGUF", "files": ["latentsync-1.6-f16.gguf"] }, { "id": "latentsync_1_6_f32_f16", "display_name": "LatentSync 1.6 F32/F16", "format": "gguf", "precision": "orig", "default": false, "target_directory": "LatentSync-1.6-GGUF", "files": ["latentsync-1.6-f32-f16.gguf"] }];
const dependencies$Z = [];
const ui$1g = { "recommended_package": "latentsync_1_6_q8_0_f16", "tags": ["GGUF"], "docs": ["docs/models/latentsync.md"] };
const sources$1g = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "detector_config": "model:detector_config.json", "landmark_config": "model:landmark_config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_53 = {
  schema_version: schema_version$Z,
  family: family$1g,
  display_name: display_name$1g,
  description: description$1g,
  category: category$1g,
  status: status$1g,
  tasks: tasks$1g,
  modes: modes$1g,
  languages: languages$1g,
  capabilities: capabilities$1g,
  runtime: runtime$1g,
  options: options$1g,
  package_defaults: package_defaults$18,
  packages: packages$1h,
  dependencies: dependencies$Z,
  ui: ui$1g,
  sources: sources$1g
};
const schema_version$Y = 1;
const family$1f = "lfm2_audio";
const display_name$1f = "LFM2.5-Audio";
const description$1f = "Liquid AI's LFM2.5-Audio, loaded from the llama.cpp-format GGUF components Liquid publishes. ASR: a FastConformer encoder feeds an LFM2 hybrid short-conv/attention backbone. TTS: the backbone generates audio frames through a depthformer, and an LFM2 detokenizer and ISTFT turn them into 24 kHz audio. S2S: a spoken question goes in as for ASR, and the reply comes out as interleaved text and audio.";
const category$1f = "asr";
const status$1f = "experimental";
const tasks$1f = ["asr", "tts", "s2s"];
const modes$1f = ["offline", "streaming"];
const languages$1f = ["en", "ja"];
const capabilities$1f = { "asr": ["vad_chunking"], "tts": ["built_in_voices", "long_form"] };
const options$1f = { "request": [{ "name": "language", "type": "string", "description": "Must match the checkpoint's language (en or ja) when given; each published checkpoint transcribes and speaks one language.", "required": false, "default": "auto" }, { "name": "max_tokens", "type": "int", "description": "ASR: transcript tokens per audio chunk, 512 by default. TTS: audio frames (80 ms each) per text chunk, 512 by default. S2S: text tokens and audio frames of the reply together, 1024 by default. A transcript, a text chunk's speech or a reply that reaches it is cut off there, with a warning on stderr.", "required": false, "min": 1 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Audio chunking mode. auto transcribes input up to audio_chunk_duration_sec whole and splits longer input at pauses found by the bundled VAD (fixed chunks when the VAD model is absent); vad always splits at pauses and skips silence; fixed cuts every audio_chunk_duration_sec; none transcribes the whole input at once.", "values": ["auto", "fixed", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Longest chunk in seconds, at least 1. With fixed chunks, a final piece shorter than 1 second and the chunk before it split their audio evenly.", "required": false, "min": 1, "default": 30 }, { "name": "temperature", "type": "float", "description": "TTS and S2S: audio code sampling temperature, 0.8 by default for TTS and 1.0 for S2S; 0 picks the most likely code.", "required": false, "min": 0 }, { "name": "top_k", "type": "int", "description": "TTS and S2S: sample audio codes from the k most likely, 64 by default for TTS and 4 for S2S; 0 keeps all, 1 is greedy.", "required": false, "min": 0 }, { "name": "text_temperature", "type": "float", "description": "S2S: text token sampling temperature; 0, the default, picks the most likely token, as liquid-audio's README and demo do.", "required": false, "min": 0, "default": 0 }, { "name": "text_top_k", "type": "int", "description": "S2S: with a text_temperature above 0, sample text tokens from the k most likely; 0, the default, keeps all, and 1 is greedy.", "required": false, "min": 0, "default": 0 }, { "name": "seed", "type": "int", "description": "TTS and S2S: sampling seed; omitted requests choose a random seed. TTS text chunk i uses seed + i. S2S text sampling draws from a stream of its own, so with the same seed a reply follows the greedy-text reply until a text token differs.", "required": false, "min": 0 }, { "name": "text_chunk_mode", "type": "enum", "description": "TTS: long-form text chunking mode; japanese for the Japanese checkpoint and default otherwise when omitted.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false }, { "name": "text_chunk_size", "type": "int", "description": "TTS: maximum Unicode codepoints per text chunk, each spoken as its own turn.", "required": false, "min": 1, "default": 200 }, { "name": "stream_frames_per_event", "type": "int", "description": "TTS and S2S streaming: audio frames (80 ms each) per event; each event's audio is final. ASR runs offline only.", "required": false, "min": 1, "default": 1 }, { "name": "return_codes", "type": "bool", "description": "S2S: also return the reply's text tokens and audio codes as an lfm2_audio.reply artifact, to send back as history with the conversation's next turn.", "required": false, "default": false }], "session": [{ "name": "model_gguf", "type": "string", "description": "Backbone GGUF, relative to the model directory. Defaults to the directory's only backbone GGUF.", "required": false, "default": "" }, { "name": "mmproj_gguf", "type": "string", "description": "Audio encoder (mmproj) GGUF, relative to the model directory. Defaults to mmproj-<backbone GGUF name>, or else the directory's only mmproj GGUF.", "required": false, "default": "" }, { "name": "vocoder_gguf", "type": "string", "description": "TTS/S2S vocoder GGUF (depthformer), relative to the model directory. Defaults to vocoder-<backbone GGUF name>, or the directory's only vocoder GGUF.", "required": false, "default": "" }, { "name": "detokenizer_gguf", "type": "string", "description": "TTS/S2S audio detokenizer GGUF, relative to the model directory. Defaults to tokenizer-<backbone GGUF name>, or the directory's only tokenizer GGUF.", "required": false, "default": "" }, { "name": "vad_model_path", "type": "string", "description": "Path to the VAD model (any built-in VAD family; default Silero VAD) used by automatic audio chunking.", "required": false, "default": "assets/framework/models/silero_vad" }, { "name": "max_pass_duration_sec", "type": "float", "description": "Most audio, in seconds, the encoder takes in one pass: an ASR chunk (the whole input with audio_chunk_mode=none) or the S2S question. Longer audio is rejected before it is encoded.", "required": false, "min": 1, "default": 120 }, { "name": "cpu_repack", "type": "bool", "description": "On the CPU, multiply the matrices with the kernels of ggml's CPU extra buffer types where those take the weight's type and shape: the repacked ones take Q4_0 on x86 with AVX2 and Q4_0, Q8_0 and Q6_K on Arm; where ggml's AMX buffer is built, it comes first and also takes F16, Q8_0 and K-quants. Where the token embedding's type is taken, the text head gets a copy of it. Other backends ignore it.", "required": false, "default": true }, { "name": "conversation_cache_slots", "type": "int", "description": "S2S: how many conversations a session keeps the earlier questions' encoder output and prefill blocks of, for their next turns, the least recently used dropped first; 0 keeps none. Each kept conversation takes up to about 350 MiB of host memory at the conversation limit, and a slot that no conversation has used takes nothing. Output does not depend on it.", "required": false, "min": 0, "default": 4 }], "load": [] };
const runtime$1f = { "tags": ["gguf", "cpu", "metal", "cuda"] };
const packages$1g = [{ "id": "lfm2_audio_1_5b_q8_0", "display_name": "LFM2.5-Audio-1.5B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "LFM2.5-Audio-1.5B-GGUF", "files": ["LFM2.5-Audio-1.5B-Q8_0.gguf", "mmproj-LFM2.5-Audio-1.5B-Q8_0.gguf", "vocoder-LFM2.5-Audio-1.5B-Q8_0.gguf", "tokenizer-LFM2.5-Audio-1.5B-Q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM2.5-Audio-1.5B-GGUF", "revision": "7d525f883a077e20afb782f2ff618edcae0e39e4", "gated": false } }, { "id": "lfm2_audio_1_5b_f16", "display_name": "LFM2.5-Audio-1.5B F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "LFM2.5-Audio-1.5B-GGUF", "files": ["LFM2.5-Audio-1.5B-F16.gguf", "mmproj-LFM2.5-Audio-1.5B-F16.gguf", "vocoder-LFM2.5-Audio-1.5B-F16.gguf", "tokenizer-LFM2.5-Audio-1.5B-F16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM2.5-Audio-1.5B-GGUF", "revision": "7d525f883a077e20afb782f2ff618edcae0e39e4", "gated": false } }, { "id": "lfm2_audio_1_5b_q4_0", "display_name": "LFM2.5-Audio-1.5B Q4_0 GGUF", "format": "gguf", "precision": "q4_0", "target_directory": "LFM2.5-Audio-1.5B-GGUF", "files": ["LFM2.5-Audio-1.5B-Q4_0.gguf", "mmproj-LFM2.5-Audio-1.5B-Q4_0.gguf", "vocoder-LFM2.5-Audio-1.5B-Q4_0.gguf", "tokenizer-LFM2.5-Audio-1.5B-Q4_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM2.5-Audio-1.5B-GGUF", "revision": "7d525f883a077e20afb782f2ff618edcae0e39e4", "gated": false } }, { "id": "lfm2_audio_1_5b_jp_q8_0", "display_name": "LFM2.5-Audio-1.5B-JP Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "LFM2.5-Audio-1.5B-JP-GGUF", "files": ["LFM2.5-Audio-1.5B-JP-Q8_0.gguf", "mmproj-LFM2.5-Audio-1.5B-JP-Q8_0.gguf", "vocoder-LFM2.5-Audio-1.5B-JP-Q8_0.gguf", "tokenizer-LFM2.5-Audio-1.5B-JP-Q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF", "revision": "64b96718b341dbd5650f9e85627cecdcbd4ac61b", "gated": false } }, { "id": "lfm2_audio_1_5b_jp_f16", "display_name": "LFM2.5-Audio-1.5B-JP F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "LFM2.5-Audio-1.5B-JP-GGUF", "files": ["LFM2.5-Audio-1.5B-JP-F16.gguf", "mmproj-LFM2.5-Audio-1.5B-JP-F16.gguf", "vocoder-LFM2.5-Audio-1.5B-JP-F16.gguf", "tokenizer-LFM2.5-Audio-1.5B-JP-F16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF", "revision": "64b96718b341dbd5650f9e85627cecdcbd4ac61b", "gated": false } }, { "id": "lfm2_audio_1_5b_jp_f32", "display_name": "LFM2.5-Audio-1.5B-JP F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "LFM2.5-Audio-1.5B-JP-GGUF", "files": ["LFM2.5-Audio-1.5B-JP-F32.gguf", "mmproj-LFM2.5-Audio-1.5B-JP-F32.gguf", "vocoder-LFM2.5-Audio-1.5B-JP-F32.gguf", "tokenizer-LFM2.5-Audio-1.5B-JP-F32.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF", "revision": "64b96718b341dbd5650f9e85627cecdcbd4ac61b", "gated": false } }, { "id": "lfm2_audio_1_5b_jp_q4_0", "display_name": "LFM2.5-Audio-1.5B-JP Q4_0 GGUF", "format": "gguf", "precision": "q4_0", "target_directory": "LFM2.5-Audio-1.5B-JP-GGUF", "files": ["LFM2.5-Audio-1.5B-JP-Q4_0.gguf", "mmproj-LFM2.5-Audio-1.5B-JP-Q4_0.gguf", "vocoder-LFM2.5-Audio-1.5B-JP-Q4_0.gguf", "tokenizer-LFM2.5-Audio-1.5B-JP-Q4_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF", "revision": "64b96718b341dbd5650f9e85627cecdcbd4ac61b", "gated": false } }];
const dependencies$Y = [];
const ui$1f = { "tags": ["ASR", "TTS", "GGUF", "Stream"], "recommended_package": "lfm2_audio_1_5b_q8_0", "docs": ["docs/models/lfm2_audio.md"], "summary": "LFM2.5-Audio transcription, speech and spoken chat (English and Japanese checkpoints) from Liquid's published GGUFs.", "builtin_voices": ["us_male", "us_female", "uk_male", "uk_female"], "default_voice": "us_male" };
const sources$1f = [{ "format": "gguf", "roots": { "model": "." }, "files": {}, "optional_files": {}, "tensors": {} }];
const __vite_glob_0_54 = {
  schema_version: schema_version$Y,
  family: family$1f,
  display_name: display_name$1f,
  description: description$1f,
  category: category$1f,
  status: status$1f,
  tasks: tasks$1f,
  modes: modes$1f,
  languages: languages$1f,
  capabilities: capabilities$1f,
  options: options$1f,
  runtime: runtime$1f,
  packages: packages$1g,
  dependencies: dependencies$Y,
  ui: ui$1f,
  sources: sources$1f
};
const schema_version$X = 1;
const family$1e = "lfm3_audio";
const display_name$1e = "LFM3-Audio";
const description$1e = "Liquid AI's LFM3-Audio-2B, from the llama.cpp-format GGUFs Liquid publishes or the upstream safetensors directory. ASR: a log-mel LFM2 encoder feeds an LFM3 hybrid conv/attention backbone. TTS: the backbone drives a bidirectional MaskGIT depth decoder (12 codebooks, 12.5 Hz) and the LiquidCodec decoder and ISTFT give 24 kHz audio. S2S: a spoken question in, interleaved text and audio out, with client-held multi-turn history.";
const category$1e = "asr";
const status$1e = "experimental";
const tasks$1e = ["asr", "tts", "s2s"];
const modes$1e = ["offline", "streaming"];
const languages$1e = ["en", "ar", "da", "de", "el", "es", "fi", "fr", "he", "it", "ja", "ko", "nl", "pl", "pt", "sv", "tr", "zh"];
const capabilities$1e = { "asr": ["vad_chunking"], "tts": ["built_in_voices", "long_form"] };
const options$1e = { "request": [{ "name": "language", "type": "string", "description": "ASR: ISO code of the spoken language (prompt 'Perform ASR in <English name>.'); auto lets the model infer it ('Perform ASR.'). TTS: picks the default voice of that language when no voice is given.", "required": false, "default": "auto" }, { "name": "max_tokens", "type": "int", "min": 1, "description": "ASR: text tokens per audio chunk (max(512, 8 per second of audio); chat 512, or 2048 with enable_thinking). TTS: audio frames (80 ms) per text chunk (512). S2S: text tokens and frames of the reply together (1024).", "required": false }, { "name": "audio_chunk_mode", "type": "enum", "values": ["auto", "fixed", "vad", "none"], "description": "ASR chunking, as lfm2_audio.", "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "min": 1, "description": "ASR: longest chunk in seconds; auto keeps input up to this long whole and splits longer input at VAD pauses.", "required": false, "default": 300 }, { "name": "max_audio_tail_frames", "type": "int", "min": 0, "description": "S2S: most audio frames after the reply text ends before the turn is closed with an end-of-audio frame; 0 disables the cap.", "required": false, "default": 375 }, { "name": "temperature", "type": "float", "min": 0, "description": "TTS and S2S: audio code temperature; 0 picks the most likely code. The default is the checkpoint's generation_config.json audio_temperature.", "required": false, "default": 1 }, { "name": "top_k", "type": "int", "min": 0, "description": "TTS and S2S: sample audio codes from the k most likely; 0 keeps all. The default is the checkpoint's audio_top_k.", "required": false, "default": 128 }, { "name": "repetition_penalty", "type": "float", "min": 0.01, "description": "TTS and S2S: audio repetition penalty over the last 4096 frames (the checkpoint's audio_repetition_window) of each codebook; must be positive, 1 disables it. The default is the checkpoint's audio_repetition_penalty.", "required": false, "default": 1.1 }, { "name": "text_temperature", "type": "float", "min": 0, "description": "ASR and S2S: text token temperature; 0 is greedy.", "required": false, "default": 0 }, { "name": "text_top_k", "type": "int", "min": 0, "description": "ASR and S2S: sample text tokens from the k most likely; 0 keeps all.", "required": false, "default": 0 }, { "name": "seed", "type": "int", "description": "Sampling seed (random when absent); TTS text chunk i uses seed + i.", "required": false, "min": 0 }, { "name": "text_chunk_mode", "type": "enum", "values": ["default", "tag_aware", "japanese", "endline"], "description": "TTS long-form text chunking (values as text::parse_text_chunk_mode_override accepts).", "required": false }, { "name": "text_chunk_size", "type": "int", "min": 1, "description": "TTS: target characters per text chunk.", "required": false, "default": 200 }, { "name": "stream_frames_per_event", "type": "int", "min": 1, "description": "TTS and S2S streaming: audio frames per event.", "required": false, "default": 1 }, { "name": "return_codes", "type": "bool", "description": "S2S: return the lfm3_audio.reply artifact a client sends back with the next turn.", "required": false, "default": false }, { "name": "chat", "type": "bool", "description": "ASR task: answer the spoken input as a text chat reply instead of transcribing it.", "required": false, "default": false }, { "name": "enable_thinking", "type": "bool", "description": "ASR chat: let the model think first; only the text after </think> is returned.", "required": false, "default": false }], "session": [{ "name": "weight_type", "type": "enum", "values": ["native", "f16", "f32"], "description": "Weight storage at load. native keeps the file's types (BF16 falls back to F16 where the backend lacks BF16). f32 also uses F32 KV caches and explicit attention, for parity checks.", "required": false, "default": "native" }, { "name": "cpu_repack", "type": "bool", "description": "CPU: repack matmul weights for ggml's extra buffer kernels.", "required": false, "default": true }, { "name": "vad_model_path", "type": "string", "description": "VAD model (any built-in VAD family; default Silero VAD) used by ASR audio_chunk_mode auto/vad.", "required": false, "default": "assets/framework/models/silero_vad" }, { "name": "max_pass_duration_sec", "type": "float", "min": 1, "description": "Most audio, in seconds, the encoder takes in one pass (an ASR chunk or the S2S question); longer audio is rejected before it is encoded.", "required": false, "default": 300 }], "load": [] };
const runtime$1e = { "tags": ["gguf", "stream", "cpu", "metal", "cuda"] };
const package_defaults$17 = { "download": { "kind": "huggingface_snapshot", "repo": "LiquidAI/LFM3-Audio-2B-GGUF", "revision": "fcfae9027c00a6f3f872c48a841cfeb77e2b5a1c", "gated": false } };
const packages$1f = [{ "id": "lfm3_audio_2b_q8_0", "display_name": "LFM3-Audio-2B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "LFM3-Audio-2B-GGUF", "files": ["LFM3-Audio-2B-Q8_0.gguf", "mmproj-LFM3-Audio-2B-Q8_0.gguf"] }, { "id": "lfm3_audio_2b_f16", "display_name": "LFM3-Audio-2B F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "LFM3-Audio-2B-GGUF", "files": ["LFM3-Audio-2B-F16.gguf", "mmproj-LFM3-Audio-2B-F16.gguf"] }, { "id": "lfm3_audio_2b_bf16", "display_name": "LFM3-Audio-2B BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "LFM3-Audio-2B-GGUF", "files": ["LFM3-Audio-2B-BF16.gguf", "mmproj-LFM3-Audio-2B-BF16.gguf"] }, { "id": "lfm3_audio_2b_q4_k_m", "display_name": "LFM3-Audio-2B Q4_K_M GGUF (Q8_0 mmproj)", "format": "gguf", "precision": "q4_k_m", "target_directory": "LFM3-Audio-2B-GGUF", "files": ["LFM3-Audio-2B-Q4_K_M.gguf", "mmproj-LFM3-Audio-2B-Q8_0.gguf"] }, { "id": "lfm3_audio_2b_q4_0", "display_name": "LFM3-Audio-2B Q4_0 GGUF (Q8_0 mmproj)", "format": "gguf", "precision": "q4_0", "target_directory": "LFM3-Audio-2B-GGUF", "files": ["LFM3-Audio-2B-Q4_0.gguf", "mmproj-LFM3-Audio-2B-Q8_0.gguf"] }];
const dependencies$X = [];
const ui$1e = { "tags": ["ASR", "TTS", "GGUF", "Stream"], "recommended_package": "lfm3_audio_2b_q8_0", "docs": ["docs/models/lfm3_audio.md"], "summary": "LFM3-Audio transcription, multilingual speech and spoken chat from Liquid's published GGUFs.", "builtin_voices": ["arabic_female", "arabic_male", "danish_female", "danish_male", "german_female", "german_male", "greek_female", "greek_male", "british_english_female", "british_english_male", "american_english_female", "american_english_male", "finnish_female", "finnish_male", "french_female", "french_male", "hebrew_female", "hebrew_male", "italian_female", "italian_male", "japanese_female", "japanese_male", "korean_female", "korean_male", "dutch_female", "dutch_male", "polish_female", "polish_male", "portuguese_female", "portuguese_male", "spanish_female", "spanish_male", "swedish_female", "swedish_male", "turkish_female", "turkish_male", "chinese_female", "chinese_male"], "default_voice": "american_english_female" };
const sources$1e = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_json": "model:tokenizer.json", "codec_config": "model:audio_tokenizer/config.json" }, "tensors": { "model": "model:model.safetensors", "codec": "model:audio_tokenizer/model.safetensors" } }];
const __vite_glob_0_55 = {
  schema_version: schema_version$X,
  family: family$1e,
  display_name: display_name$1e,
  description: description$1e,
  category: category$1e,
  status: status$1e,
  tasks: tasks$1e,
  modes: modes$1e,
  languages: languages$1e,
  capabilities: capabilities$1e,
  options: options$1e,
  runtime: runtime$1e,
  package_defaults: package_defaults$17,
  packages: packages$1f,
  dependencies: dependencies$X,
  ui: ui$1e,
  sources: sources$1e
};
const schema_version$W = 1;
const family$1d = "liveavatar";
const display_name$1d = "LiveAvatar";
const description$1d = "LiveAvatar audio-driven avatar video generation using the Wan2.2 S2V architecture.";
const category$1d = "audio_generation";
const status$1d = "experimental";
const tasks$1d = ["sfx"];
const modes$1d = ["offline", "streaming"];
const languages$1d = ["auto"];
const runtime$1d = { "tags": ["cuda", "gguf", "stream"] };
const capabilities$1d = { "sfx": ["prompt_generation"] };
const options$1d = { "request": [{ "name": "reference_image_file", "type": "string", "description": "Reference image path used as the identity/appearance condition.", "required": true }, { "name": "generation_mode", "type": "enum", "values": ["offline", "liveavatar"], "description": "Use whole-clip generation or LiveAvatar blockwise generation.", "required": false, "default": "offline" }, { "name": "height", "type": "int", "description": "Generated frame height; must be a positive multiple of 16.", "required": false, "min": 16, "default": 480 }, { "name": "width", "type": "int", "description": "Generated frame width; must be a positive multiple of 16.", "required": false, "min": 16, "default": 832 }, { "name": "num_frames", "type": "int", "description": "Frames generated per LiveAvatar segment; must be positive and a multiple of 4 in blockwise mode (streaming or generation_mode=liveavatar).", "required": false, "min": 1, "default": 48 }, { "name": "num_clips", "type": "int", "description": "Maximum LiveAvatar clips to generate from the input audio.", "required": false, "min": 1, "default": 1 }, { "name": "num_inference_steps", "type": "int", "description": "Denoising steps; offline generation uses UniPC, blockwise generation uses Euler. The LiveAvatar DMD adapter is designed for 4 steps.", "required": false, "min": 1, "default": 4 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale; LiveAvatar blockwise generation requires 0.", "required": false, "min": 0, "default": 0 }, { "name": "batched_cfg", "type": "bool", "description": "Run classifier-free guidance in one denoiser graph.", "required": false, "default": true }, { "name": "sage_attention", "type": "bool", "description": "Use CUDA SageAttention when the backend supports it.", "required": false, "default": true }, { "name": "mem_saver", "type": "bool", "description": "Reuse immutable condition data and temporary denoiser graph storage across sequential blocks.", "required": false, "default": true }, { "name": "denoiser_layerwise", "type": "bool", "description": "Run the denoiser in layerwise mode. Offline generation requires batched_cfg=true and guidance_scale > 1.", "required": false, "default": false }, { "name": "denoiser_layerwise_batch", "type": "int", "description": "Layer group size used by layerwise denoising.", "required": false, "min": 1, "default": 16 }, { "name": "vae_encoder_chunk_size", "type": "int", "description": "Cached VAE encoder chunk size.", "required": false, "min": 1, "default": 16 }, { "name": "vae_decoder_tile_size", "type": "int", "description": "Opt-in VAE decoder spatial tile size for large outputs; 0 disables tiling. Enabled tile sizes must be multiples of 8 and larger than the 64-pixel overlap.", "required": false, "min": 0, "default": 0 }, { "name": "target_cache_blocks", "type": "int", "description": "Target KV cache window in block units; 0 keeps the full clip cache.", "required": false, "min": 0, "default": 0 }, { "name": "vae_cache_f16", "type": "bool", "description": "Store cached VAE encoder state in F16.", "required": false, "default": true }, { "name": "shift", "type": "float", "description": "Flow scheduler shift; must be > 0.", "required": false, "min": 0, "default": 3 }, { "name": "negative_prompt", "type": "string", "description": "Negative prompt for classifier-free guidance.", "required": false }, { "name": "seed", "type": "int", "description": "Generation seed.", "required": false, "min": 0, "default": 420 }], "session": [{ "name": "denoiser_weight_streaming", "type": "bool", "description": "Keep denoiser transformer blocks in host memory and stage layer groups on the accelerator.", "required": false, "default": false }], "load": [{ "name": "support_gguf", "type": "string", "description": "Support GGUF containing text_encoder/audio_encoder tensors and the embedded tokenizer sidecar.", "required": false, "default": "Wan2.2-S2V-Support-Q4_K_S-F16.gguf" }, { "name": "vae_gguf", "type": "string", "description": "Wan video VAE component GGUF file relative to the model root.", "required": false, "default": "Wan2.2-S2V-VAE-F16.gguf" }, { "name": "denoiser_gguf", "type": "string", "description": "Denoiser DiT GGUF file relative to the model root.", "required": false, "default": "Wan2.2-S2V-14B-NVFP4-LORA.gguf" }] };
const dependencies$W = [];
const package_defaults$16 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/LiveAvatar-GGUF", "revision": "main", "gated": false } };
const packages$1e = [{ "id": "liveavatar_nvfp4_lora", "display_name": "LiveAvatar NVFP4 LoRA GGUF", "default": true, "format": "gguf", "precision": "native", "target_directory": "LiveAvatar-GGUF", "files": ["Wan2.2-S2V-Support-Q4_K_S-F16.gguf", "Wan2.2-S2V-VAE-F16.gguf", "Wan2.2-S2V-14B-NVFP4-LORA.gguf"] }];
const sources$1d = [{ "format": "gguf", "roots": { "model": "." }, "files": { "tokenizer_model": "model:tokenizer/spiece.model" }, "tensors": { "text_encoder_weights": { "source": "model:Wan2.2-S2V-Support-Q4_K_S-F16.gguf", "prefix": "text_encoder" }, "audio_encoder_weights": { "source": "model:Wan2.2-S2V-Support-Q4_K_S-F16.gguf", "prefix": "audio_encoder" } } }, { "format": "gguf", "roots": { "model": "." }, "tensors": { "vae_weights": { "source": "model:Wan2.2-S2V-VAE-F16.gguf", "prefix": "vae" } } }, { "format": "gguf", "roots": { "model": "." }, "tensors": { "denoiser_weights": { "source": "model:Wan2.2-S2V-14B-NVFP4-LORA.gguf" } } }];
const ui$1d = { "recommended_package": "liveavatar_nvfp4_lora", "tags": ["SFX", "GGUF", "Stream"], "docs": ["docs/models/liveavatar.md"] };
const __vite_glob_0_56 = {
  schema_version: schema_version$W,
  family: family$1d,
  display_name: display_name$1d,
  description: description$1d,
  category: category$1d,
  status: status$1d,
  tasks: tasks$1d,
  modes: modes$1d,
  languages: languages$1d,
  runtime: runtime$1d,
  capabilities: capabilities$1d,
  options: options$1d,
  dependencies: dependencies$W,
  package_defaults: package_defaults$16,
  packages: packages$1e,
  sources: sources$1d,
  ui: ui$1d
};
const schema_version$V = 1;
const family$1c = "magenta_realtime_2";
const display_name$1c = "Magenta RealTime 2";
const description$1c = "Frame-autoregressive stereo music generation with text, audio style, and MIDI conditioning.";
const category$1c = "audio_generation";
const status$1c = "experimental";
const tasks$1c = ["music"];
const modes$1c = ["offline", "streaming"];
const languages$1c = ["auto"];
const runtime$1c = { "tags": ["gguf"] };
const capabilities$1c = { "music": ["instrumental", "style_control"] };
const options$1c = { "request": [{ "name": "duration_sec", "type": "float", "description": "Requested music duration in seconds.", "min": 0.04, "default": 10, "required": false }, { "name": "temperature", "type": "float", "description": "Sampling temperature; zero selects greedy decoding.", "min": 0, "default": 1.3, "required": false }, { "name": "top_k", "type": "int", "description": "Sampling candidate limit; zero keeps all 1024 valid codes.", "min": 0, "max": 1024, "default": 40, "required": false }, { "name": "seed", "type": "int", "description": "Generation seed.", "min": 0, "max": 4294967295, "default": 0, "required": false }, { "name": "guidance_scale", "type": "float", "description": "MusicCoCa style guidance, discretized to the model's trained conditioning tokens.", "min": -1, "max": 7, "default": 3, "required": false }, { "name": "note_guidance_scale", "type": "float", "description": "MIDI note guidance.", "min": -1, "max": 7, "default": 1, "required": false }, { "name": "drum_guidance_scale", "type": "float", "description": "Drum guidance.", "min": -1, "max": 7, "default": 1, "required": false }, { "name": "use_mapper", "type": "bool", "description": "Map text style embeddings into the audio embedding space.", "default": true, "required": false }, { "name": "pianoroll_file", "type": "string", "description": "Optional JSON array of 128 MIDI pitch states per frame at 25 Hz: -1 masked, 0 off, 1 sustain, 2 onset, 3 model chooses.", "required": false }, { "name": "drums", "type": "int", "description": "Drum conditioning: -1 leaves drums unspecified, 0 requests no drums, 1 requests drums.", "required": false, "min": -1, "max": 1, "default": -1 }], "session": [{ "name": "weight_type", "type": "enum", "preset": "weight_type_full", "description": "Transformer weight storage type.", "default": "native", "required": false }], "load": [] };
const package_defaults$15 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Magenta-RealTime-2-GGUF", "revision": "main", "gated": false } };
const packages$1d = [{ "id": "magenta_realtime_2_small_f16", "display_name": "Magenta RealTime 2 Small F16", "format": "gguf", "precision": "f16", "target_directory": "Magenta-RealTime-2-GGUF", "files": ["magenta-rt2-small-f16.gguf"], "default": true }, { "id": "magenta_realtime_2_small_q8_0", "display_name": "Magenta RealTime 2 Small Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Magenta-RealTime-2-GGUF", "files": ["magenta-rt2-small-q8_0.gguf"] }, { "id": "magenta_realtime_2_base_f16", "display_name": "Magenta RealTime 2 Base F16", "format": "gguf", "precision": "f16", "target_directory": "Magenta-RealTime-2-GGUF", "files": ["magenta-rt2-base-f16.gguf"] }, { "id": "magenta_realtime_2_base_q8_0", "display_name": "Magenta RealTime 2 Base Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Magenta-RealTime-2-GGUF", "files": ["magenta-rt2-base-q8_0.gguf"] }];
const dependencies$V = [];
const ui$1c = { "recommended_package": "magenta_realtime_2_small_f16", "tags": ["Music", "GGUF"], "docs": ["docs/models/magenta_realtime_2.md"] };
const sources$1c = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "musiccoca_config": "model:musiccoca.json", "musiccoca_tokenizer": "model:spm.model" }, "tensors": { "weights": { "source": "weights:", "prefix": "generator" }, "musiccoca": { "source": "weights:", "prefix": "musiccoca" } } }];
const __vite_glob_0_57 = {
  schema_version: schema_version$V,
  family: family$1c,
  display_name: display_name$1c,
  description: description$1c,
  category: category$1c,
  status: status$1c,
  tasks: tasks$1c,
  modes: modes$1c,
  languages: languages$1c,
  runtime: runtime$1c,
  capabilities: capabilities$1c,
  options: options$1c,
  package_defaults: package_defaults$15,
  packages: packages$1d,
  dependencies: dependencies$V,
  ui: ui$1c,
  sources: sources$1c
};
const schema_version$U = 1;
const family$1b = "magpie_tts";
const display_name$1b = "MagpieTTS Multilingual 357M";
const description$1b = "NVIDIA MagpieTTS is a multilingual neural text-to-speech model that generates NanoCodec audio tokens from text using baked speaker context embeddings, a decoder-only transformer, and an autoregressive local transformer before decoding the tokens to waveform audio.";
const category$1b = "tts";
const status$1b = "supported";
const tasks$1b = ["tts"];
const modes$1b = ["offline"];
const languages$1b = ["ar-AE", "ar-MSA", "ar-SA", "de", "en", "es", "fr", "hi", "it", "ko", "pt-BR", "vi", "zh"];
const runtime$1b = { "tags": ["gguf"] };
const capabilities$1b = { "tts": ["long_form"] };
const options$1b = { "request": [{ "name": "language", "type": "string", "description": "Target synthesis language code used by the Magpie text frontend; default en.", "required": false, "default": "en" }, { "name": "voice_id", "type": "enum", "description": "Packaged MagpieTTS voice name; default Aria. Numeric speaker index strings are also accepted within the checkpoint speaker count.", "values": ["Aria", "Jason", "John", "Leo", "Sofia"], "required": false, "default": "Aria" }, { "name": "temperature", "type": "float", "description": "Autoregressive audio-token sampling temperature; default 0.6 from the v2607 model config.", "required": false, "min": 0, "default": 0.6 }, { "name": "top_k", "type": "int", "description": "Autoregressive audio-token top-k sampling limit; default 80.", "required": false, "min": 1, "default": 80 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale for Magpie decoder logits; default 2.5.", "required": false, "min": 0, "default": 2.5 }, { "name": "max_tokens", "type": "int", "description": "Maximum Magpie decoder frames per text segment; default 500 from the v2607 model config.", "required": false, "min": 1, "default": 500 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 100 for zh and ko, otherwise 300.", "required": false, "min": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "seed", "type": "int", "description": "Seed for audio-token sampling; default 0.", "required": false, "min": 0, "default": 0 }], "session": [{ "name": "graph_arena_mb", "type": "int", "description": "Reusable ggml graph arena size in MiB for Magpie stages; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_context_mb", "type": "int", "description": "Weight loading context size in MiB; default 2048.", "required": false, "min": 1, "default": 2048 }, { "name": "weight_type", "type": "enum", "description": "Matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage type; default native.", "preset": "weight_type_conv", "required": false, "default": "native" }], "load": [] };
const package_defaults$14 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1c = [{ "id": "magpie_tts_orig", "display_name": "MagpieTTS Multilingual 357M Original-Dtype GGUF", "default": false, "format": "gguf", "precision": "orig", "target_directory": "MagpieTTS-Multilingual-357M-GGUF", "files": ["MagpieTTS-Multilingual-357M-GGUF/magpie-tts-multilingual-357m-orig.gguf"], "strip_prefix": "MagpieTTS-Multilingual-357M-GGUF" }, { "id": "magpie_tts_q8_0", "display_name": "MagpieTTS Multilingual 357M Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MagpieTTS-Multilingual-357M-GGUF", "files": ["MagpieTTS-Multilingual-357M-GGUF/magpie-tts-multilingual-357m-q8_0.gguf"], "strip_prefix": "MagpieTTS-Multilingual-357M-GGUF" }];
const dependencies$U = [];
const ui$1b = { "recommended_package": "magpie_tts_q8_0", "tags": ["TTS", "GGUF"], "docs": ["docs/models/magpie_tts.md", "docs/tts.md", "docs/gguf.md"] };
const sources$1b = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "codec_config": "model:codec_config.json", "speakers": "model:speakers.json" }, "optional_files": { "ipa_dict": "model:ipa_dict.txt", "cmu_dict": "model:cmu_dict.txt", "german_dict": "model:german.dict", "german_heteronyms": "model:german.heteronym", "spanish_dict": "model:spanish.dict", "portuguese_dict": "model:portuguese.dict", "hindi_dict": "model:hindi.dict", "heteronyms": "model:heteronyms", "mandarin_chars": "model:mandarin_data/pinyin_chars.tsv", "mandarin_phrases": "model:mandarin_data/pinyin_phrases.tsv", "mandarin_jieba_dict": "model:mandarin_data/jieba.dict.utf8", "mandarin_hmm": "model:mandarin_data/hmm_model.utf8" }, "tensors": { "model": { "source": "weights:", "prefix": "model" }, "codec": { "source": "weights:", "prefix": "codec" } } }, { "format": "safetensors", "roots": { "model": ".", "codec": "../nemo_nano_codec_22khz_1_89kbps_safetensors" }, "files": { "config": "model:config.json", "codec_config": "codec:config.json", "speakers": "model:41913ebaa70342058574da74293b7630_magpie_tts_multilingual_357m.nemo.speakers.json" }, "optional_files": { "ipa_dict": "model:74b3e832fe914a569fcd42b51d06b2f1_ipa_dict_nv23.05.txt", "cmu_dict": "model:dc7d60d6b15a4651b21c9ca2932b62c6_ipa_cmudict-0.7b_nv23.01.txt", "german_dict": "model:cf01ab5c48c84f3282ef7888263361e5_de_nv230119.dict", "german_heteronyms": "model:c5e4ec2af5a14ce294f4b9edcc936535_de_nv230119.heteronym", "spanish_dict": "model:7dbc31751f224f2486090d59dc95b9f7_es_ES_nv230301.dict", "portuguese_dict": "model:05adc40366e149b69319acd4b28a4919_pt_br_prondict-v1.0.dict", "hindi_dict": "model:339da71c54b046f98cbcf38ef6d4ff67_hindi_phoneme_merged_phoneme_dict.dict", "heteronyms": "model:61d57a4ccb064d1e8e3d9f871c571932_heteronyms-052722" }, "tensors": { "model": "model:model.safetensors", "codec": "codec:model.safetensors" } }];
const __vite_glob_0_58 = {
  schema_version: schema_version$U,
  family: family$1b,
  display_name: display_name$1b,
  description: description$1b,
  category: category$1b,
  status: status$1b,
  tasks: tasks$1b,
  modes: modes$1b,
  languages: languages$1b,
  runtime: runtime$1b,
  capabilities: capabilities$1b,
  options: options$1b,
  package_defaults: package_defaults$14,
  packages: packages$1c,
  dependencies: dependencies$U,
  ui: ui$1b,
  sources: sources$1b
};
const schema_version$T = 1;
const family$1a = "maya1";
const display_name$1a = "Maya1";
const description$1a = "Maya Research's 3B expressive English text-to-speech model with natural-language voice design and inline emotion control.";
const category$1a = "tts";
const status$1a = "supported";
const tasks$1a = ["tts", "design"];
const modes$1a = ["offline"];
const languages$1a = ["en"];
const runtime$1a = { "tags": ["gguf"] };
const capabilities$1a = { "tts": ["voice_design", "emotion_control", "long_form"], "design": ["voice_design"] };
const options$1a = { "request": [{ "name": "instruct", "type": "string", "description": "Natural-language description of the voice, accent, timbre, age, and delivery.", "required": true }, { "name": "max_tokens", "type": "int", "description": "Maximum generated audio-token count per text chunk; default 2048.", "required": false, "min": 1, "default": 2048 }, { "name": "min_tokens", "type": "int", "description": "Minimum generated audio-token count before EOS may stop generation; default 28.", "required": false, "min": 0, "default": 28 }, { "name": "temperature", "type": "float", "description": "Autoregressive sampling temperature; default 0.4. Must be > 0.", "required": false, "min": 0, "default": 0.4 }, { "name": "top_p", "type": "float", "description": "Autoregressive nucleus sampling probability; must be in (0, 1], default 0.9.", "required": false, "min": 0, "max": 1, "default": 0.9 }, { "name": "repetition_penalty", "type": "float", "description": "Autoregressive repetition penalty; default 1.1. Must be > 0.", "required": false, "min": 0, "default": 1.1 }, { "name": "seed", "type": "int", "description": "Sampling and SNAC decoder noise seed; omitted requests choose a random seed.", "required": false, "min": 0 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 300.", "required": false, "min": 1, "default": 300 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework long-form text chunking mode; tag_aware preserves inline emotion tags.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "tag_aware" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared AR and SNAC decoder weight storage type; default native.", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "required": false, "default": "native" }, { "name": "ar_weight_type", "type": "enum", "description": "AR backbone weight storage type; defaults to weight_type.", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "required": false }, { "name": "codec_weight_type", "type": "enum", "description": "SNAC decoder weight storage type; only native or f32 is supported. Inherits weight_type when omitted; set codec_weight_type=f32 explicitly when using another shared weight_type.", "values": ["native", "f32"], "required": false }], "load": [] };
const package_defaults$13 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1b = [{ "id": "maya1_orig", "display_name": "Maya1 Original-Precision GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "Maya1-GGUF", "files": ["Maya1-GGUF/maya1-orig.gguf"], "strip_prefix": "Maya1-GGUF" }, { "id": "maya1_q8_0", "display_name": "Maya1 Q8_0 GGUF", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "Maya1-GGUF", "files": ["Maya1-GGUF/maya1-q8_0.gguf"], "strip_prefix": "Maya1-GGUF" }];
const dependencies$T = [];
const ui$1a = { "recommended_package": "maya1_orig", "tags": ["TTS", "Design", "GGUF"], "docs": ["docs/models/maya1.md", "docs/gguf.md"] };
const sources$1a = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json" }, "tensors": { "model_weights": "weights:", "codec_weights": "weights:" } }];
const __vite_glob_0_59 = {
  schema_version: schema_version$T,
  family: family$1a,
  display_name: display_name$1a,
  description: description$1a,
  category: category$1a,
  status: status$1a,
  tasks: tasks$1a,
  modes: modes$1a,
  languages: languages$1a,
  runtime: runtime$1a,
  capabilities: capabilities$1a,
  options: options$1a,
  package_defaults: package_defaults$13,
  packages: packages$1b,
  dependencies: dependencies$T,
  ui: ui$1a,
  sources: sources$1a
};
const family$19 = "meanvc2";
const schema_version$S = 1;
const display_name$19 = "MeanVC2";
const description$19 = "MeanVC2 is a lightweight streaming zero-shot voice conversion model. The current audio.cpp package covers the recommended 120ms/40ms quality path.";
const category$19 = "voice_conversion";
const status$19 = "supported";
const tasks$19 = ["vc"];
const modes$19 = ["offline", "streaming"];
const languages$19 = ["language_agnostic"];
const capabilities$19 = { "vc": ["speaker_reference"] };
const runtime$19 = { "tags": ["gguf"] };
const options$19 = { "request": [{ "name": "seed", "type": "int", "description": "Random seed for MeanVC2 flow noise; default 42.", "required": false, "min": 0, "default": 42 }], "session": [], "load": [] };
const package_defaults$12 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$1a = [{ "id": "meanvc2_120ms_40ms_f32", "display_name": "MeanVC2 120ms/40ms F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "MeanVC2-GGUF", "files": ["MeanVC2-GGUF/meanvc2-120ms-40ms-fp32.gguf"], "strip_prefix": "MeanVC2-GGUF" }, { "id": "meanvc2_120ms_40ms_q4_k", "display_name": "MeanVC2 120ms/40ms Q4_K GGUF", "default": false, "format": "gguf", "precision": "q4_k", "target_directory": "MeanVC2-GGUF", "files": ["MeanVC2-GGUF/meanvc2-120ms-40ms-q4_k.gguf"], "strip_prefix": "MeanVC2-GGUF" }];
const dependencies$S = [];
const ui$19 = { "recommended_package": "meanvc2_120ms_40ms_f32", "tags": ["VC", "GGUF"], "docs": ["docs/models/meanvc2.md", "docs/audio_tools.md", "docs/gguf.md"] };
const sources$19 = [{ "format": "gguf", "roots": { "weights": "$gguf" }, "tensors": { "vc": { "source": "weights:", "prefix": "vc" }, "vocos": { "source": "weights:", "prefix": "vocos" }, "asr": { "source": "weights:", "prefix": "asr" }, "speaker_wavlm": { "source": "weights:", "prefix": "speaker_wavlm" }, "speaker_ecapa": { "source": "weights:", "prefix": "speaker_ecapa" } } }];
const __vite_glob_0_60 = {
  family: family$19,
  schema_version: schema_version$S,
  display_name: display_name$19,
  description: description$19,
  category: category$19,
  status: status$19,
  tasks: tasks$19,
  modes: modes$19,
  languages: languages$19,
  capabilities: capabilities$19,
  runtime: runtime$19,
  options: options$19,
  package_defaults: package_defaults$12,
  packages: packages$1a,
  dependencies: dependencies$S,
  ui: ui$19,
  sources: sources$19
};
const schema_version$R = 1;
const family$18 = "mel_band_roformer";
const display_name$18 = "Mel-Band RoFormer";
const description$18 = "Music source-separation model that uses mel-scaled overlapping frequency bands and RoFormer attention to estimate stems such as vocals, drums, and accompaniment.";
const category$18 = "audio_tools";
const status$18 = "supported";
const tasks$18 = ["sep"];
const modes$18 = ["offline"];
const languages$18 = ["language_agnostic"];
const capabilities$18 = { "sep": ["stems"] };
const options$18 = { "request": [], "session": [{ "name": "weight_type", "type": "enum", "description": "RoFormer weight storage type. Defaults to f32 when the backend requires a host graph plan, otherwise native.", "preset": "weight_type_full", "required": false }, { "name": "num_overlap", "type": "int", "description": "Number of overlapping inference windows; defaults to the package configuration. Lower values improve throughput but can reduce boundary quality.", "required": false, "min": 1 }], "load": [] };
const runtime$18 = { "tags": ["gguf"] };
const ui$18 = { "recommended_package": "mel_band_roformer_q8_0", "tags": ["Sep", "GGUF"], "docs": ["docs/audio_tools.md", "docs/gguf.md"] };
const package_defaults$11 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$19 = [{ "id": "mel_band_roformer_q8_0", "display_name": "Mel-Band RoFormer Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Mel-Band-RoFormer-GGUF", "files": ["Mel-Band-RoFormer-GGUF/mel-band-roformer-q8_0.gguf"], "strip_prefix": "Mel-Band-RoFormer-GGUF" }, { "id": "mel_band_roformer_f16", "display_name": "Mel-Band RoFormer F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Mel-Band-RoFormer-GGUF", "files": ["Mel-Band-RoFormer-GGUF/mel-band-roformer-f16.gguf"], "strip_prefix": "Mel-Band-RoFormer-GGUF" }, { "id": "mel_band_roformer_safetensors", "display_name": "Mel RoFormer Safetensors", "format": "safetensors", "precision": "native", "target_directory": "mel-roformer-mlx", "files": ["config.json", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "mlx-community/mel-roformer-mlx" } }];
const dependencies$R = [];
const sources$18 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_61 = {
  schema_version: schema_version$R,
  family: family$18,
  display_name: display_name$18,
  description: description$18,
  category: category$18,
  status: status$18,
  tasks: tasks$18,
  modes: modes$18,
  languages: languages$18,
  capabilities: capabilities$18,
  options: options$18,
  runtime: runtime$18,
  ui: ui$18,
  package_defaults: package_defaults$11,
  packages: packages$19,
  dependencies: dependencies$R,
  sources: sources$18
};
const schema_version$Q = 1;
const family$17 = "micro_wake_word";
const display_name$17 = "microWakeWord";
const description$17 = "Streaming wake-word detection for trained microWakeWord MixedNet TFLite models converted to GGUF.";
const category$17 = "audio_tools";
const status$17 = "experimental";
const tasks$17 = ["wake_word"];
const modes$17 = ["offline", "streaming"];
const languages$17 = ["model_dependent"];
const capabilities$17 = { "wake_word": ["speech_segments", "stream_events"] };
const runtime$17 = { "tags": ["gguf", "stream"] };
const options$17 = { "request": [{ "name": "threshold", "type": "float", "description": "Override the converted model manifest's wake-word probability cutoff.", "required": false, "min": 0, "max": 1 }, { "name": "sliding_window_size", "type": "int", "description": "Override the converted model manifest's prediction smoothing window.", "required": false, "min": 1 }], "session": [{ "name": "exec_plan", "type": "string", "description": "JSON component execution plans. Component network accepts impl ggml/neon (default ggml). GGML retains the session backend; neon runs the stateful CNN on CPU and requires ENGINE_ENABLE_NEON=ON and AArch64 NEON. Frontend and detection logic are unchanged. No artifacts or params are used.", "required": false, "default": "{}" }], "load": [] };
const package_defaults$10 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$18 = [{ "id": "micro_wake_word_okay_nabu_f32", "display_name": "microWakeWord Okay Nabu GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "MicroWakeWord-GGUF", "files": ["MicroWakeWord-GGUF/micro-wake-word-okay-nabu-f32.gguf"], "strip_prefix": "MicroWakeWord-GGUF" }];
const dependencies$Q = [];
const ui$17 = { "tags": ["Wake Word", "GGUF", "Stream"], "docs": ["docs/models/micro_wake_word.md"], "recommended_package": "micro_wake_word_okay_nabu_f32" };
const sources$17 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_62 = {
  schema_version: schema_version$Q,
  family: family$17,
  display_name: display_name$17,
  description: description$17,
  category: category$17,
  status: status$17,
  tasks: tasks$17,
  modes: modes$17,
  languages: languages$17,
  capabilities: capabilities$17,
  runtime: runtime$17,
  options: options$17,
  package_defaults: package_defaults$10,
  packages: packages$18,
  dependencies: dependencies$Q,
  ui: ui$17,
  sources: sources$17
};
const schema_version$P = 1;
const family$16 = "midashenglm_gen";
const display_name$16 = "MiDashengLM-Gen";
const description$16 = "DashengLM generative audio model for speech, music, sound effects, and ambience prompts.";
const category$16 = "audio_generation";
const status$16 = "experimental";
const tasks$16 = ["music"];
const modes$16 = ["offline"];
const languages$16 = ["auto"];
const runtime$16 = { "tags": ["gguf", "cuda"] };
const capabilities$16 = { "music": ["instrumental", "style_control"] };
const options$16 = { "request": [{ "name": "duration_sec", "type": "float", "description": "Target audio duration budget; omitted derives from the checkpoint sequence length, hop size and sample rate. Must be finite and positive; no fixed runtime upper cap.", "required": false, "default": 20 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale. Any finite value is accepted.", "required": false, "default": 2 }, { "name": "stop_threshold", "type": "float", "description": "Stop probability threshold. Any finite value is accepted.", "required": false, "default": 0.5 }, { "name": "min_stop_step", "type": "int", "description": "Minimum generated steps before accepting stop.", "required": false, "min": 1, "default": 5 }, { "name": "seed", "type": "int", "description": "Unsigned 32-bit generation seed; default 0 is a fixed seed. Negative values are not accepted.", "required": false, "min": 0, "max": 4294967295, "default": 0 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }], "load": [] };
const package_defaults$$ = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$17 = [{ "id": "midashenglm_gen_f32", "display_name": "MiDashengLM-Gen F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "MiDashengLM-Gen-GGUF", "files": ["MiDashengLM-Gen-GGUF/midashenglm-gen-f32.gguf"], "strip_prefix": "MiDashengLM-Gen-GGUF" }, { "id": "midashenglm_gen_q8_0", "display_name": "MiDashengLM-Gen Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MiDashengLM-Gen-GGUF", "files": ["MiDashengLM-Gen-GGUF/midashenglm-gen-q8_0.gguf"], "strip_prefix": "MiDashengLM-Gen-GGUF" }];
const dependencies$P = [];
const ui$16 = { "recommended_package": "midashenglm_gen_q8_0", "tags": ["Music", "SFX", "GGUF"], "docs": ["docs/models/midashenglm_gen.md", "docs/gguf.md"] };
const sources$16 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "vocab.json": "model:vocab.json", "merges.txt": "model:merges.txt", "tokenizer_config.json": "model:tokenizer_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "vocab.json": "model:vocab.json", "merges.txt": "model:merges.txt", "tokenizer_config.json": "model:tokenizer_config.json" }, "tensors": { "weights": "model:model.safetensors.index.json" } }];
const __vite_glob_0_63 = {
  schema_version: schema_version$P,
  family: family$16,
  display_name: display_name$16,
  description: description$16,
  category: category$16,
  status: status$16,
  tasks: tasks$16,
  modes: modes$16,
  languages: languages$16,
  runtime: runtime$16,
  capabilities: capabilities$16,
  options: options$16,
  package_defaults: package_defaults$$,
  packages: packages$17,
  dependencies: dependencies$P,
  ui: ui$16,
  sources: sources$16
};
const schema_version$O = 1;
const family$15 = "ming3_audio";
const display_name$15 = "Ming 3.0 Audio Tiny";
const description$15 = "Whisper audio encoder and hybrid KDA/MLA mixture-of-experts Thinker, with a separate continuous-latent Talker for spoken responses.";
const category$15 = "asr";
const status$15 = "experimental";
const tasks$15 = ["asr", "s2s", "tts", "clone"];
const modes$15 = ["offline"];
const languages$15 = ["zh", "en"];
const capabilities$15 = { "tts": ["speaker_reference", "built_in_voices"], "clone": ["speaker_reference"] };
const runtime$15 = { "tags": ["gguf"] };
const options$15 = { "request": [{ "name": "system_prompt", "type": "string", "required": false, "description": "Thinker system instruction. When supplied, the user prompt precedes audio as in the official chat examples." }, { "name": "enable_thinking", "type": "bool", "required": false, "default": false, "description": "Enable the Thinker chat template's detailed thinking mode." }, { "name": "prompt", "type": "string", "required": false, "description": "Thinker instruction accompanying the input audio; omitted ASR requests use the official transcription prompt." }, { "name": "max_tokens", "type": "int", "required": false, "default": 256, "min": 1, "description": "Maximum generated Thinker text tokens." }, { "name": "max_audio_tokens", "type": "int", "required": false, "default": 1e3, "min": 1, "description": "Maximum generated Talker acoustic patches per text fragment." }, { "name": "voice_id", "type": "enum", "values": ["US_James", "US_Stella", "灵小柔", "灵楷", "US_Emma", "UK_George", "UK_Charlotte", "灵小安", "灵语汐", "灵小萌", "灵小雅", "花小呗", "灵韵", "妩媚妲己", "灵婉", "灵小月", "灵朵儿", "灵岩", "灵小锋", "灵小川", "灵小甄", "灵小知", "灵小惠", "灵小晴", "灵小琪", "灵梦", "灵恬", "灵小汐", "灵小棠", "灵小梨", "灵舒", "灵娇", "灵小芸", "灵锐", "灵空", "灵宇", "灵朗", "灵旭", "灵骁", "灵江", "悲伤女声", "皮六", "说唱小哥", "蜡笔小新", "悟空", "灵信远_生气", "灵信远_厌恶", "灵信远_惊讶", "灵信远_高兴", "灵信远_恐惧", "灵信远_中性", "灵信远_悲伤", "灵思齐_高兴", "灵思齐_恐惧", "灵思齐_生气", "灵思齐_厌恶", "灵思齐_中性", "灵思齐_惊讶", "灵思齐_悲伤", "灵叙柔_高兴", "灵叙柔_恐惧", "灵叙柔_惊讶", "灵叙柔_悲伤", "灵叙柔_生气", "灵叙柔_中性", "灵叙柔_厌恶", "灵绮木_悲伤", "灵绮木_厌恶", "灵绮木_中性", "灵绮木_恐惧", "灵绮木_惊讶", "灵绮木_高兴", "灵绮木_生气", "灵书悦_恐惧", "灵书悦_厌恶", "灵书悦_高兴", "灵书悦_惊讶", "灵书悦_悲伤", "灵书悦_生气", "灵书悦_中性", "灵渊霆_厌恶", "灵渊霆_中性", "灵渊霆_恐惧", "灵渊霆_惊讶", "灵渊霆_悲伤", "灵渊霆_生气", "灵渊霆_高兴", "灵素心_高兴", "灵素心_惊讶", "灵素心_恐惧", "灵素心_中性", "灵素心_生气", "灵素心_悲伤", "灵素心_厌恶", "灵晓声_惊讶", "灵晓声_厌恶", "灵晓声_高兴", "灵晓声_生气", "灵晓声_中性", "灵晓声_悲伤", "灵风信_生气", "灵风信_中性", "灵风信_厌恶", "灵风信_高兴", "灵风信_惊讶", "灵风信_悲伤", "灵风信_恐惧", "灵采薇_惊讶", "灵采薇_厌恶", "灵采薇_恐惧", "灵采薇_生气", "灵采薇_悲伤", "灵采薇_中性", "灵采薇_高兴", "灵卓然_厌恶", "灵卓然_中性", "灵卓然_恐惧", "灵卓然_惊讶", "灵卓然_高兴", "灵卓然_悲伤", "灵卓然_生气", "灵惜梦_中性", "灵惜梦_厌恶", "灵惜梦_高兴", "灵惜梦_悲伤", "灵惜梦_恐惧", "灵惜梦_惊讶", "灵惜梦_生气", "灵浅忧_高兴", "灵浅忧_生气", "灵浅忧_厌恶", "灵浅忧_悲伤", "灵浅忧_惊讶", "灵浅忧_恐惧", "灵浅忧_中性", "灵昭野_生气", "灵昭野_高兴", "灵昭野_悲伤", "灵昭野_中性", "灵昭野_厌恶", "灵昭野_恐惧", "灵昭野_惊讶", "灵心澜_厌恶", "灵心澜_惊讶", "灵心澜_生气", "灵心澜_中性", "灵心澜_高兴", "灵心澜_悲伤", "灵心澜_恐惧", "灵犀言_悲伤", "灵犀言_厌恶", "灵犀言_恐惧", "灵犀言_中性", "灵犀言_惊讶", "灵犀言_高兴", "灵犀言_生气", "灵语冰_悲伤", "灵语冰_厌恶", "灵语冰_高兴", "灵语冰_恐惧", "灵语冰_惊讶", "灵语冰_中性", "灵语冰_生气", "灵逸风_生气", "灵逸风_悲伤", "灵逸风_惊讶", "灵逸风_中性", "灵逸风_恐惧", "灵逸风_高兴", "灵逸风_厌恶", "灵悦澜_中性", "灵悦澜_高兴", "灵悦澜_厌恶", "灵悦澜_恐惧", "灵悦澜_生气", "灵悦澜_悲伤", "灵悦澜_惊讶", "灵惊鸿_厌恶", "灵惊鸿_高兴", "灵惊鸿_中性", "灵惊鸿_惊讶", "灵惊鸿_恐惧", "灵惊鸿_生气", "灵惊鸿_悲伤", "灵御心_高兴", "灵御心_中性", "灵御心_生气", "灵御心_恐惧", "灵御心_厌恶", "灵御心_惊讶", "灵御心_悲伤", "灵语恬_厌恶", "灵语恬_高兴", "灵语恬_恐惧", "灵语恬_悲伤", "灵语恬_惊讶", "灵语恬_生气", "灵语恬_中性", "灵心恬_厌恶", "灵心恬_惊讶", "灵心恬_悲伤", "灵心恬_中性", "灵心恬_恐惧", "灵心恬_高兴", "灵心恬_生气", "灵惜蕊_惊讶", "灵惜蕊_厌恶", "灵惜蕊_恐惧", "灵惜蕊_高兴", "灵惜蕊_中性", "灵惜蕊_悲伤", "灵惜蕊_生气", "灵语萱_厌恶", "灵语萱_高兴", "灵语萱_惊讶", "灵语萱_恐惧", "灵语萱_生气", "灵语萱_悲伤", "灵语萱_中性", "灵语烟_生气", "灵语烟_恐惧", "灵语烟_中性", "灵语烟_厌恶", "灵语烟_惊讶", "灵语烟_高兴", "灵语烟_悲伤", "灵律雅_恐惧", "灵律雅_生气", "灵律雅_惊讶", "灵律雅_高兴", "灵律雅_厌恶", "灵律雅_中性", "灵律雅_悲伤", "灵惊涛_厌恶", "灵惊涛_恐惧", "灵惊涛_高兴", "灵惊涛_悲伤", "灵惊涛_中性", "灵惊涛_惊讶", "灵惊涛_生气", "灵寒陌_生气", "灵寒陌_厌恶", "灵寒陌_恐惧", "灵寒陌_高兴", "灵寒陌_中性", "灵寒陌_惊讶", "灵寒陌_悲伤", "灵决冥_悲伤", "灵决冥_厌恶", "灵决冥_生气", "灵决冥_中性", "灵决冥_惊讶", "灵决冥_恐惧", "灵决冥_高兴", "灵亦尘_中性", "灵亦尘_厌恶", "灵亦尘_高兴", "灵亦尘_恐惧", "灵亦尘_生气", "灵亦尘_悲伤", "灵亦尘_惊讶", "灵语尘_生气", "灵语尘_高兴", "灵语尘_厌恶", "灵语尘_惊讶", "灵语尘_中性", "灵语尘_悲伤", "灵语尘_恐惧", "灵慈萱_高兴", "灵慈萱_厌恶", "灵慈萱_惊讶", "灵慈萱_生气", "灵慈萱_中性", "灵慈萱_悲伤", "灵慈萱_恐惧", "灵妙音_中性", "灵妙音_悲伤", "灵妙音_惊讶", "灵妙音_厌恶", "灵妙音_生气", "灵妙音_高兴", "灵妙音_恐惧", "灵断尘_悲伤", "灵断尘_高兴", "灵断尘_惊讶", "灵断尘_恐惧", "灵断尘_中性", "灵断尘_生气", "灵断尘_厌恶", "灵悦兮_高兴", "灵悦兮_中性", "灵悦兮_生气", "灵悦兮_惊讶", "灵悦兮_厌恶", "灵悦兮_悲伤", "灵悦兮_恐惧", "灵若虚_恐惧", "灵若虚_惊讶", "灵若虚_中性", "灵若虚_悲伤", "灵若虚_高兴", "灵若虚_厌恶", "灵若虚_生气", "灵熙婉_厌恶", "灵熙婉_生气", "灵熙婉_惊讶", "灵熙婉_高兴", "灵熙婉_中性", "灵熙婉_恐惧", "灵熙婉_悲伤", "灵旭扬_中性", "灵旭扬_生气", "灵旭扬_恐惧", "灵旭扬_高兴", "灵旭扬_惊讶", "灵旭扬_悲伤", "灵旭扬_厌恶", "灵阅川_生气", "灵阅川_悲伤", "灵阅川_高兴", "灵阅川_厌恶", "灵阅川_惊讶", "灵阅川_中性", "灵阅川_恐惧", "灵未央_高兴", "灵未央_中性", "灵未央_惊讶", "灵未央_悲伤", "灵未央_厌恶", "灵未央_恐惧", "灵未央_生气", "灵妩月_厌恶", "灵妩月_生气", "灵妩月_中性", "灵妩月_惊讶", "灵妩月_恐惧", "灵妩月_高兴", "灵妩月_悲伤", "灵梦瑶_中性", "灵梦瑶_恐惧", "灵梦瑶_高兴", "灵梦瑶_悲伤", "灵梦瑶_惊讶", "灵梦瑶_生气", "灵妙声_中性", "灵妙声_恐惧", "灵妙声_高兴", "灵妙声_悲伤", "灵妙声_惊讶", "灵妙声_生气", "灵烈瑶_中性", "灵烈瑶_厌恶", "灵烈瑶_恐惧", "灵烈瑶_悲伤", "灵烈瑶_惊讶", "灵烈瑶_生气", "灵烈瑶_高兴", "灵幽月_中性", "灵幽月_厌恶", "灵幽月_恐惧", "灵幽月_悲伤", "灵幽月_惊讶", "灵幽月_生气", "灵幽月_高兴", "灵悦心_中性", "灵悦心_厌恶", "灵悦心_恐惧", "灵悦心_悲伤", "灵悦心_惊讶", "灵悦心_生气", "灵悦心_高兴", "灵汐月_中性", "灵汐月_厌恶", "灵汐月_恐惧", "灵汐月_悲伤", "灵汐月_惊讶", "灵汐月_生气", "灵汐月_高兴", "灵书意_中性", "灵书意_厌恶", "灵书意_恐惧", "灵书意_悲伤", "灵书意_惊讶", "灵书意_生气", "灵书意_高兴", "灵知远_中性", "灵知远_厌恶", "灵知远_恐惧", "灵知远_悲伤", "灵知远_惊讶", "灵知远_生气", "灵知远_高兴", "灵温言_中性", "灵温言_厌恶", "灵温言_恐惧", "灵温言_悲伤", "灵温言_惊讶", "灵温言_生气", "灵温言_高兴", "灵傲尘_中性", "灵傲尘_厌恶", "灵傲尘_恐惧", "灵傲尘_悲伤", "灵傲尘_生气", "灵傲尘_高兴", "灵佑安_中性", "灵佑安_厌恶", "灵佑安_恐惧", "灵佑安_悲伤", "灵佑安_惊讶", "灵佑安_生气", "灵佑安_高兴", "灵惜晨_中性", "灵惜晨_厌恶", "灵惜晨_恐惧", "灵惜晨_悲伤", "灵惜晨_惊讶", "灵惜晨_生气", "灵惜晨_高兴", "灵宛溪_中性", "灵宛溪_厌恶", "灵宛溪_恐惧", "灵宛溪_悲伤", "灵宛溪_惊讶", "灵宛溪_生气", "灵宛溪_高兴", "灵言澈_中性", "灵言澈_厌恶", "灵言澈_恐惧", "灵言澈_悲伤", "灵言澈_惊讶", "灵言澈_生气", "灵言澈_高兴", "灵溯光_中性", "灵溯光_厌恶", "灵溯光_恐惧", "灵溯光_悲伤", "灵溯光_惊讶", "灵溯光_生气", "灵溯光_高兴", "灵惊弦_中性", "灵惊弦_厌恶", "灵惊弦_恐惧", "灵惊弦_悲伤", "灵惊弦_惊讶", "灵惊弦_生气", "灵惊弦_高兴", "灵嘉肴_中性", "灵嘉肴_厌恶", "灵嘉肴_恐惧", "灵嘉肴_悲伤", "灵嘉肴_惊讶", "灵嘉肴_生气", "灵嘉肴_高兴", "灵黛嗔_中性", "灵黛嗔_厌恶", "灵黛嗔_恐惧", "灵黛嗔_悲伤", "灵黛嗔_惊讶", "灵黛嗔_生气", "灵黛嗔_高兴", "灵孤影_中性", "灵孤影_厌恶", "灵孤影_恐惧", "灵孤影_悲伤", "灵孤影_惊讶", "灵孤影_生气", "灵孤影_高兴", "灵雨汐_中性", "灵雨汐_恐惧", "灵雨汐_高兴", "灵雨汐_悲伤", "灵雨汐_惊讶", "灵雨汐_生气", "蜡笔小新_野原新之助 (小新)", "蜡笔小新_野原美伢 (美伢)", "小猪佩奇_佩奇", "康熙王朝_康熙", "西游记_唐僧", "甄嬛传_四郎", "潜伏_余则成", "水浒传_武松", "水浒传_潘金莲", "雍正王朝_雍正"], "required": false, "description": "Talker built-in voice name; ignored when reference audio is supplied." }, { "name": "reference_text", "type": "string", "required": false, "description": "Reference transcript enabling acoustic-prefix continuation; without it reference audio supplies speaker conditioning only." }, { "name": "language", "type": "string", "required": false, "description": "Talker output language; inferred from its input text when omitted." }, { "name": "seed", "type": "int", "required": false, "min": 0, "default": 42, "description": "Talker flow and reference-posterior sampling seed. Thinker generation is greedy." }, { "name": "guidance_scale", "type": "float", "required": false, "default": 2, "description": "Talker conditioned prediction plus guidance_scale times its difference from the null prediction." }, { "name": "sigma", "type": "float", "required": false, "default": 0.25, "min": 0, "description": "Talker flow SDE noise scale." }, { "name": "temperature", "type": "float", "required": false, "default": 0, "min": 0, "description": "Talker flow sampling temperature; zero still uses seeded initial noise." }, { "name": "raw_text", "type": "bool", "required": false, "default": false, "description": "Synthesize text as one fragment without framework text chunking." }, { "name": "trim_silence", "type": "bool", "required": false, "default": true, "description": "Trim trailing low-energy 100-ms frames per Talker fragment, retaining a 300-ms tail." }, { "name": "text_chunk_size", "type": "int", "required": false, "min": 1, "default": 100, "description": "Talker text chunk budget in Unicode codepoints." }, { "name": "text_chunk_mode", "type": "enum", "required": false, "default": "tag_aware", "values": ["default", "tag_aware", "japanese", "endline"], "description": "Framework Talker text chunking policy." }], "session": [{ "name": "disk_experts", "type": "bool", "required": false, "default": false, "description": "Keep Thinker expert weights outside GPU memory and stage routed experts into a bounded GPU cache; computation stays on the selected backend." }, { "name": "pin_experts", "type": "bool", "required": false, "default": true, "description": "With disk_experts, retain expert payloads in pinned host RAM instead of reading them from the GGUF on each cache miss. Defaults to false on Metal, which uses ordinary host staging." }, { "name": "expert_cache_size", "type": "int", "required": false, "default": 8, "min": 8, "max": 128, "description": "With disk_experts, number of GPU-resident expert slots per routed Thinker layer." }, { "name": "disk_expert_read_threads", "type": "int", "required": false, "default": 1, "min": 1, "max": 64, "description": "Host workers for copying selected GGUF experts into staging when disk_experts is enabled and pin_experts is false. Default 1 preserves serial reads; values above 1 use OpenMP or Apple dispatch." }, { "name": "reference_cache", "type": "bool", "required": false, "default": true, "description": "Reuse speaker features and seeded acoustic conditioning for the most recent reference waveform." }], "load": [] };
const package_defaults$_ = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Ming-3.0-Audio-Tiny-GGUF", "revision": "main", "gated": false } };
const packages$16 = [{ "id": "ming3_audio_tiny_bf16", "display_name": "Ming 3.0 Audio Tiny BF16", "format": "gguf", "precision": "bf16", "default": true, "target_directory": "Ming-3.0-Audio-Tiny-GGUF", "files": ["ming-3.0-audio-tiny-bf16.gguf"] }, { "id": "ming3_audio_tiny_q8_0", "display_name": "Ming 3.0 Audio Tiny Q8_0 Experts", "format": "gguf", "precision": "q8_0", "target_directory": "Ming-3.0-Audio-Tiny-GGUF", "files": ["ming-3.0-audio-tiny-q8_0.gguf"] }, { "id": "ming3_audio_tiny_q4_k", "display_name": "Ming 3.0 Audio Tiny Q4_K Experts", "format": "gguf", "precision": "q4_k", "target_directory": "Ming-3.0-Audio-Tiny-GGUF", "files": ["ming-3.0-audio-tiny-q4_k.gguf"] }];
const dependencies$O = [];
const ui$15 = { "recommended_package": "ming3_audio_tiny_bf16", "tags": ["ASR", "TTS", "GGUF"], "docs": ["docs/models/ming3_audio.md"] };
const sources$15 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "generation_config": "model:generation_config.json", "talker_config": "model:talker/config.json", "talker_llm_config": "model:talker/llm/config.json", "talker_tokenizer_json": "model:talker/llm/tokenizer.json", "talker_tokenizer_config": "model:talker/llm/tokenizer_config.json", "vae_config": "model:talker/vae/config.json" }, "tensors": { "thinker": { "source": "weights:", "prefix": "thinker" }, "talker": { "source": "weights:", "prefix": "talker" }, "vae": { "source": "weights:", "prefix": "vae" }, "speaker": { "source": "weights:", "prefix": "speaker" } } }];
const __vite_glob_0_64 = {
  schema_version: schema_version$O,
  family: family$15,
  display_name: display_name$15,
  description: description$15,
  category: category$15,
  status: status$15,
  tasks: tasks$15,
  modes: modes$15,
  languages: languages$15,
  capabilities: capabilities$15,
  runtime: runtime$15,
  options: options$15,
  package_defaults: package_defaults$_,
  packages: packages$16,
  dependencies: dependencies$O,
  ui: ui$15,
  sources: sources$15
};
const schema_version$N = 1;
const family$14 = "ming3_tts";
const display_name$14 = "Ming 3.0 TTS 0.5B";
const description$14 = "Multilingual continuous-latent speech synthesis with a Qwen backbone, flow-matching acoustic head, CAMPPlus speaker conditioning and an audio VAE.";
const category$14 = "tts";
const status$14 = "supported";
const tasks$14 = ["tts", "clone", "design"];
const modes$14 = ["offline", "streaming"];
const languages$14 = ["zh", "en", "ja", "ko", "de", "fr", "es"];
const capabilities$14 = { "tts": ["long_form", "speaker_reference", "style_control", "emotion_control", "built_in_voices"], "clone": ["long_form", "speaker_reference", "style_control", "emotion_control"], "design": ["voice_design"] };
const runtime$14 = { "tags": ["gguf"] };
const options$14 = { "request": [{ "name": "template_name", "type": "enum", "required": false, "description": "Conditioning template; defaults to voice_design on that route, otherwise tts.", "values": ["tts", "multilingual", "basic", "emotion", "dialect", "ip", "voice_design", "freeform"] }, { "name": "language", "type": "string", "required": false, "description": "Target language name or code; defaults to the request's language (the server's top-level language field, the CLI's --language). Required by multilingual; ignored by dialect." }, { "name": "instruct", "type": "string", "required": false, "description": "Voice description for voice_design; raw conditioning text for freeform or tts." }, { "name": "instruction_schema", "type": "enum", "required": false, "description": "Structured instruction field language; defaults to en for dialect, otherwise zh.", "values": ["en", "zh"] }, { "name": "speed", "type": "enum", "required": false, "description": "Categorical speaking speed for the basic template, not waveform resampling.", "values": ["慢速", "中速", "快速"] }, { "name": "pitch", "type": "enum", "required": false, "description": "Categorical pitch for the basic template.", "values": ["低", "中", "高"] }, { "name": "volume", "type": "enum", "required": false, "description": "Categorical volume for the basic template.", "values": ["低", "中", "高"] }, { "name": "emotion", "type": "string", "required": false, "description": "Emotion label for the emotion template." }, { "name": "dialect", "type": "enum", "required": false, "description": "Dialect for the dialect template.", "values": ["chuanyu dialect", "cantonese"] }, { "name": "voice_id", "type": "enum", "required": false, "description": "Built-in English voice for the ip template.", "values": ["US_Emma", "US_James", "UK_George", "UK_Charlotte"] }, { "name": "reference_text", "type": "string", "required": false, "description": "Transcript accompanying voice_ref; enables the acoustic reference prefix. Without a transcript, only speaker conditioning is used." }, { "name": "speaker_embedding_file", "type": "path_list", "required": false, "description": "CAMPPlus embedding file or list, with shape [192] or [1, 192]. Supersedes voice_ref audio; zero_speaker_embedding takes precedence." }, { "name": "export_speaker_embedding_file", "type": "path", "required": false, "description": "Export the enabled voice_ref CAMPPlus speaker embedding as F32 Safetensors. Requires voice_ref, use_speaker_embedding=true, zero_speaker_embedding=false and no speaker_embedding_file. Does not export acoustic latents or the reference transcript." }, { "name": "use_speaker_embedding", "type": "bool", "required": false, "default": true, "description": "Condition on the reference speaker embedding." }, { "name": "zero_speaker_embedding", "type": "bool", "required": false, "default": false, "description": "Use a zero projected speaker row instead of reference audio conditioning." }, { "name": "max_tokens", "type": "int", "required": false, "default": 1e3, "min": 1, "description": "Maximum generated acoustic patches per text chunk, also limited by the 512-position generation context." }, { "name": "guidance_scale", "type": "float", "required": false, "default": 2, "description": "Flow guidance: conditioned prediction plus guidance_scale times its difference from the null prediction." }, { "name": "sigma", "type": "float", "required": false, "default": 0.25, "min": 0, "description": "Flow SDE noise scale." }, { "name": "temperature", "type": "float", "required": false, "default": 0, "min": 0, "description": "Flow sampling temperature; zero still uses seeded initial noise." }, { "name": "seed", "type": "int", "required": false, "default": 1895, "min": 0, "description": "Reference-posterior and generation noise seed." }, { "name": "raw_text", "type": "bool", "required": false, "default": false, "description": "Send the text as one synthesis fragment without frontend chunking." }, { "name": "text_chunk_size", "type": "int", "required": false, "min": 1, "description": "Framework long-form chunk budget in Unicode codepoints; default 50 when hanzi, kana and Hangul outnumber other letters and digits, otherwise 300; multi-chunk generation without speaker conditioning is capped at 120, including explicit overrides, and anchors later chunks to the first generated voice. Smaller overrides, single-chunk inputs and explicitly conditioned voices retain their chunk size." }, { "name": "text_chunk_mode", "type": "enum", "required": false, "default": "tag_aware", "description": "Framework text chunking policy.", "values": ["default", "tag_aware", "japanese", "endline"] }, { "name": "trim_silence", "type": "bool", "required": false, "default": true, "description": "Trim trailing low-energy 100-ms frames per fragment, retaining a 300-ms tail." }, { "name": "stream_frames_per_event", "type": "int", "description": "Maximum latent patches per streaming audio decode.", "required": false, "default": 4, "min": 1, "max": 64 }, { "name": "stream_chunk_policy", "type": "enum", "description": "Streaming audio chunk schedule.", "required": false, "default": "grow", "values": ["fixed", "grow"] }], "session": [{ "name": "reference_cache", "type": "bool", "required": false, "default": true, "description": "Reuse prepared conditioning for the most recently used reference waveform." }], "load": [] };
const package_defaults$Z = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Ming-3.0-TTS-0.5B-GGUF", "revision": "main", "gated": false } };
const packages$15 = [{ "id": "ming_3_0_tts_0_5b_bf16", "display_name": "Ming 3.0 TTS 0.5B BF16", "format": "gguf", "precision": "bf16", "default": true, "target_directory": "Ming-3.0-TTS-0.5B-GGUF", "files": ["ming-3.0-tts-0.5b-bf16.gguf"] }, { "id": "ming_3_0_tts_0_5b_q8_0", "display_name": "Ming 3.0 TTS 0.5B Q8_0", "format": "gguf", "precision": "q8_0", "default": false, "target_directory": "Ming-3.0-TTS-0.5B-GGUF", "files": ["ming-3.0-tts-0.5b-q8_0.gguf"] }];
const dependencies$N = [];
const ui$14 = { "recommended_package": "ming_3_0_tts_0_5b_bf16", "tags": ["TTS", "GGUF"], "docs": ["docs/models/ming3_tts.md"] };
const sources$14 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json" }, "tensors": { "weights": "weights:", "speaker": { "source": "weights:", "prefix": "speaker" } } }];
const __vite_glob_0_65 = {
  schema_version: schema_version$N,
  family: family$14,
  display_name: display_name$14,
  description: description$14,
  category: category$14,
  status: status$14,
  tasks: tasks$14,
  modes: modes$14,
  languages: languages$14,
  capabilities: capabilities$14,
  runtime: runtime$14,
  options: options$14,
  package_defaults: package_defaults$Z,
  packages: packages$15,
  dependencies: dependencies$N,
  ui: ui$14,
  sources: sources$14
};
const schema_version$M = 1;
const family$13 = "minimax_h3";
const display_name$13 = "MiniMax-H3";
const description$13 = "MiniMax-H3 text-to-audio/video generation through the official T2VA pipeline: Qwen3-VL text conditioning, joint audio/video DiT denoising, and MiniMax-H3 audio/video VAE decode.";
const category$13 = "audio_generation";
const status$13 = "experimental";
const tasks$13 = ["tts", "music", "sfx"];
const modes$13 = ["offline"];
const languages$13 = ["auto"];
const capabilities$13 = { "tts": ["style_control", "multi_speaker"], "music": ["instrumental", "style_control"], "sfx": ["prompt_generation"] };
const runtime$13 = { "tags": ["cuda", "gguf"] };
const ui$13 = { "recommended_package": "minimax_h3_q4_k", "tags": ["TTS", "Music", "SFX", "GGUF"], "docs": ["docs/models/minimax_h3.md", "docs/reports/minimax_h3_performance.md"] };
const options$13 = { "request": [{ "name": "num_inference_steps", "type": "int", "description": "Positive joint DiT denoising step count; default 50.", "required": false, "min": 1, "default": 50 }, { "name": "seed", "type": "int", "description": "Unsigned 32-bit generation seed in [0, 4294967295] for deterministic initial latents; default 42.", "required": false, "min": 0, "max": 4294967295, "default": 42 }, { "name": "height", "type": "int", "description": "Target video canvas height used by the joint T2VA latent layout; omitted or nonpositive values use 768. Smaller positive sizes are rounded up to the supported geometry.", "required": false, "default": 768 }, { "name": "width", "type": "int", "description": "Target video canvas width used by the joint T2VA latent layout; omitted or nonpositive values use 1344. Smaller positive sizes are rounded up to the supported geometry.", "required": false, "default": 1344 }, { "name": "num_frames", "type": "int", "description": "Target video frame count before H3 alignment; omitted or nonpositive values use 124. MiniMax-H3 video is 24 fps; positive counts are rounded to the supported temporal geometry.", "required": false, "default": 124 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale; 1.0 matches the baseline T2VA audio run.", "required": false, "default": 1 }, { "name": "sampler_mode", "type": "enum", "description": "Joint DiT sampler: euler, res_multistep, dpmpp_2m, or unipc.", "values": ["euler", "res_multistep", "dpmpp_2m", "unipc"], "required": false, "default": "euler" }, { "name": "negative_prompt", "type": "string", "description": "Negative prompt used by classifier-free guidance when guidance_scale is not 1.0.", "required": false, "default": " " }, { "name": "flow_shift", "type": "float", "description": "Video FlowMatch scheduler shift.", "required": false, "default": 12 }, { "name": "audio_flow_shift", "type": "float", "description": "Audio FlowMatch scheduler shift.", "required": false, "default": 3 }, { "name": "return_video", "type": "bool", "description": "Decode and return RGB24 video frames as an output artifact.", "required": false, "default": false }, { "name": "text_layerwise", "type": "bool", "description": "Run the prompt encoder with scoped layer-group weights instead of a full prompt encoder weight store.", "required": false, "default": false }, { "name": "text_layerwise_batch", "type": "int", "description": "Prompt encoder layer-group size when text_layerwise is enabled.", "required": false, "min": 1, "default": 1 }, { "name": "dit_layerwise", "type": "bool", "description": "Run the DiT denoiser with scoped prelude, block-group, and final weights instead of a full DiT weight store.", "required": false, "default": false }, { "name": "dit_layerwise_batch", "type": "int", "description": "DiT block-group size when dit_layerwise is enabled.", "required": false, "min": 1, "default": 1 }, { "name": "dit_mlp_chunk_tokens", "type": "int", "description": "Token chunk size for the per-token DiT MLP in layerwise high-resolution mode. Zero disables chunking.", "required": false, "min": 0, "default": 0 }, { "name": "dit_acceleration", "type": "string", "description": "Optional DiT acceleration mode: none, first_block_cache, or spectrum. Requires dit_layerwise=false and sampler_mode=euler; Spectrum additionally requires guidance_scale=1.", "required": false, "default": "none" }, { "name": "first_block_cache_threshold", "type": "float", "description": "First-block cache residual-difference threshold.", "required": false, "min": 0, "default": 0.1 }, { "name": "first_block_cache_start_percent", "type": "float", "description": "Denoising progress fraction where first-block caching begins; must be below end_percent. Used to derive the sigma window when explicit sigma endpoints are omitted.", "required": false, "min": 0, "max": 1, "default": 0.1 }, { "name": "first_block_cache_end_percent", "type": "float", "description": "Denoising progress fraction where first-block caching ends; must exceed start_percent. Used to derive the sigma window when explicit sigma endpoints are omitted.", "required": false, "min": 0, "max": 1, "default": 0.95 }, { "name": "first_block_cache_start_sigma", "type": "float", "description": "Largest video sigma where first-block cache may be used. Supply together with first_block_cache_end_sigma; otherwise both endpoints are derived from the denoising progress fractions and schedule.", "required": false }, { "name": "first_block_cache_end_sigma", "type": "float", "description": "Smallest video sigma where first-block cache may be used. Supply together with first_block_cache_start_sigma; otherwise both endpoints are derived from the denoising progress fractions and schedule.", "required": false }, { "name": "first_block_cache_max_consecutive", "type": "int", "description": "Maximum consecutive first-block cache hits before forcing a full DiT step.", "required": false, "min": 1, "default": 2 }, { "name": "spectrum_warmup_steps", "type": "int", "description": "Full DiT warmup steps before spectrum forecasting may skip steps.", "required": false, "min": 1, "default": 1 }, { "name": "spectrum_initial_window", "type": "float", "description": "Initial spectrum forecast scheduling window.", "required": false, "min": 1, "default": 2 }, { "name": "spectrum_flex_window", "type": "float", "description": "Spectrum forecast window growth after actual DiT steps.", "required": false, "min": 0, "default": 0.75 }, { "name": "spectrum_degree", "type": "int", "description": "Chebyshev polynomial degree for spectrum forecasting.", "required": false, "min": 0, "default": 1 }, { "name": "spectrum_history_size", "type": "int", "description": "Maximum spectrum forecast history rows.", "required": false, "min": 1, "default": 8 }, { "name": "spectrum_ridge_lambda", "type": "float", "description": "Ridge regularization for spectrum forecasting.", "required": false, "min": 0, "default": 0.1 }], "session": [{ "name": "weight_context_mb", "type": "int", "description": "MiniMax-H3 staged weight context size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "mem_saver", "type": "bool", "description": "Release staged DiT, audio VAE, and video VAE weights after their request phase instead of keeping them resident for the session. Prompt encoder weights are always request-scoped.", "required": false, "default": true }], "load": [] };
const dependencies$M = [];
const package_defaults$Y = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$14 = [{ "id": "minimax_h3_q4_k", "display_name": "MiniMax-H3 Q4_K GGUF", "default": true, "format": "gguf", "precision": "q4_k", "target_directory": "MiniMax-H3-Q4-GGUF", "files": ["MiniMax-H3-Q4-GGUF/configuration.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/chat_template.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/merges.txt", "MiniMax-H3-Q4-GGUF/FL2VA/processor/preprocessor_config.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/tokenizer.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/tokenizer_config.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/video_preprocessor_config.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/vocab.json", "MiniMax-H3-Q4-GGUF/text_encoder_q4_k.gguf", "MiniMax-H3-Q4-GGUF/dit.gguf", "MiniMax-H3-Q4-GGUF/audio_vae_folded_f16.gguf", "MiniMax-H3-Q4-GGUF/video_vae.gguf"], "strip_prefix": "MiniMax-H3-Q4-GGUF" }, { "id": "minimax_h3_q4_k_int8_dit", "display_name": "MiniMax-H3 Q4_K GGUF + INT8 ConvRot DiT", "default": false, "format": "gguf", "precision": "q4_k", "target_directory": "MiniMax-H3-Q4-GGUF", "files": ["MiniMax-H3-Q4-GGUF/configuration.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/chat_template.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/merges.txt", "MiniMax-H3-Q4-GGUF/FL2VA/processor/preprocessor_config.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/tokenizer.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/tokenizer_config.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/video_preprocessor_config.json", "MiniMax-H3-Q4-GGUF/FL2VA/processor/vocab.json", "MiniMax-H3-Q4-GGUF/text_encoder_q4_k.gguf", "MiniMax-H3-Q4-GGUF/dit_int8.gguf", "MiniMax-H3-Q4-GGUF/audio_vae_folded_f16.gguf", "MiniMax-H3-Q4-GGUF/video_vae.gguf"], "strip_prefix": "MiniMax-H3-Q4-GGUF" }];
const sources$13 = [{ "format": "gguf", "roots": { "model": "." }, "files": { "configuration": "model:configuration.json", "tokenizer_config": "model:FL2VA/processor/tokenizer_config.json", "tokenizer_json": "model:FL2VA/processor/tokenizer.json", "vocab": "model:FL2VA/processor/vocab.json", "merges": "model:FL2VA/processor/merges.txt", "preprocessor_config": "model:FL2VA/processor/preprocessor_config.json" }, "tensors": { "text_encoder_weights": "model:text_encoder_q4_k.gguf", "dit_weights": "model:dit.gguf", "audio_vae_weights": "model:audio_vae_folded_f16.gguf", "video_vae_weights": "model:video_vae.gguf" } }];
const __vite_glob_0_66 = {
  schema_version: schema_version$M,
  family: family$13,
  display_name: display_name$13,
  description: description$13,
  category: category$13,
  status: status$13,
  tasks: tasks$13,
  modes: modes$13,
  languages: languages$13,
  capabilities: capabilities$13,
  runtime: runtime$13,
  ui: ui$13,
  options: options$13,
  dependencies: dependencies$M,
  package_defaults: package_defaults$Y,
  packages: packages$14,
  sources: sources$13
};
const schema_version$L = 1;
const family$12 = "minimax_music3";
const display_name$12 = "MiniMax Music 3";
const description$12 = "MiniMax Music 3 text-to-music generation with lyrics conditioning.";
const category$12 = "audio_generation";
const status$12 = "experimental";
const tasks$12 = ["music"];
const modes$12 = ["offline"];
const languages$12 = ["auto"];
const capabilities$12 = { "music": ["lyrics", "style_control"] };
const runtime$12 = { "tags": ["gguf"] };
const options$12 = { "request": [{ "name": "lyrics", "type": "string", "description": "Lyrics to sing. Structure tags such as [verse] and [chorus] are supported.", "required": true }, { "name": "duration_sec", "type": "float", "description": "Positive AR frame budget expressed in seconds; not a hard final waveform duration limit.", "required": false, "min": 0.1, "default": 20 }, { "name": "num_inference_steps", "type": "int", "description": "Flow matching Euler steps per chunk.", "required": false, "min": 1, "default": 30 }, { "name": "guidance_scale", "type": "float", "description": "Flow transformer classifier-free guidance scale. Must be > 0.", "required": false, "min": 0, "default": 1.7 }, { "name": "ar_guidance_scale", "type": "float", "description": "Autoregressive semantic and depth CFG scale. Must be > 0.", "required": false, "min": 0, "default": 1.5 }, { "name": "top_k", "type": "int", "description": "Top-k sampling for semantic and residual code sampling.", "required": false, "min": 1, "default": 50 }, { "name": "seed", "type": "int", "description": "Generation seed.", "required": false, "min": 0, "default": 0 }, { "name": "flow_uncond_interval", "type": "int", "description": "Evaluate unconditional flow CFG every N-th step, reusing the guidance delta between evaluations. Values <= 1 disable reuse and evaluate both branches every step.", "required": false, "default": 1 }, { "name": "flow_uncond_warmup", "type": "int", "description": "Initial flow steps that evaluate both CFG branches before guidance-delta reuse; nonpositive values add no warmup.", "required": false, "default": 2 }, { "name": "ensemble_takes", "type": "int", "description": "Independent takes in a batched AR pass using consecutive seeds; flow/vocoder decode each take. Named outputs take_01 through take_NN are emitted only when ensemble_takes > 1; otherwise only primary audio is returned.", "required": false, "min": 1, "max": 16, "default": 1 }, { "name": "ensemble_prefix_frames", "type": "int", "description": "Shared intro frames before ensemble takes fork, approximately 25 frames per second. Zero disables intro locking.", "required": false, "min": 0, "default": 0 }, { "name": "flow_chunk_hop_frames", "type": "int", "description": "Flow chunk hop in AR frames, approximately 25 per second. Zero uses checkpoint configuration; positive values are capped at the configured chunk size.", "required": false, "min": 0, "default": 0 }], "session": [{ "name": "weight_type", "type": "enum", "values": ["native", "bf16", "f16", "q8_0", "q4_0", "q4_k"], "description": "Shared weight storage type.", "required": false, "default": "native" }, { "name": "language_model_gguf", "type": "string", "description": "Language model component GGUF file relative to the model root.", "required": false, "default": "language_model_q4_0.gguf" }, { "name": "rvq_depth_decoder_gguf", "type": "string", "description": "RVQ depth decoder component GGUF file relative to the model root.", "required": false, "default": "rvq_depth_decoder_q8_0.gguf" }, { "name": "flow_transformer_gguf", "type": "string", "description": "Flow transformer component GGUF file relative to the model root.", "required": false, "default": "transformer_q4_0.gguf" }, { "name": "graph_arena_mb", "type": "int", "description": "Host graph-metadata arena size in MiB, not device workspace; legacy graph_context_mb remains accepted.", "required": false, "min": 1, "default": 32 }, { "name": "weight_context_mb", "type": "int", "description": "Weight context size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "mem_saver", "type": "bool", "description": "Load large generation stages only while they are needed to reduce peak VRAM.", "required": false, "default": true }, { "name": "perf_mode", "type": "enum", "values": ["off", "cuda_perf"], "description": "Performance preset. cuda_perf selects attention-prefix buckets of 256 rows. Explicit controls override preset values.", "required": false, "default": "off" }, { "name": "kv_cache_alignment", "type": "int", "description": "Attention-prefix bucket size. 1 preserves full-capacity attention; cuda_perf selects 256. Retains all valid history, but graph shapes may change sampled output. Explicit values override the preset.", "required": false, "min": 1 }, { "name": "pipeline_overlap", "type": "bool", "description": "Overlap AR decoding with condition/flow/vocoder work on a second backend stream. Requires mem_saver=false; mem_saver=true is an error. Long requests and nondefault chunk hops use sequential execution.", "required": false, "default": false }], "load": [] };
const package_defaults$X = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/MiniMax-Music3-GGUF", "revision": "main", "gated": false } };
const packages$13 = [{ "id": "minimax_music3_q4_0", "display_name": "MiniMax Music 3 Q4_0 GGUF", "default": true, "format": "gguf", "precision": "q4_0", "target_directory": "MiniMax-Music3-GGUF", "files": ["config.json", "config/language_model.json", "config/rvq_depth_decoder.json", "config/condition_encoder.json", "config/transformer.json", "config/vocoder.json", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "language_model_q4_0.gguf", "rvq_depth_decoder_q8_0.gguf", "condition_encoder.gguf", "transformer_q4_0.gguf", "vocoder.gguf"] }, { "id": "minimax_music3_q8_0", "display_name": "MiniMax Music 3 Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "MiniMax-Music3-GGUF", "files": ["config.json", "config/language_model.json", "config/rvq_depth_decoder.json", "config/condition_encoder.json", "config/transformer.json", "config/vocoder.json", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "language_model_q8_0.gguf", "rvq_depth_decoder_q8_0.gguf", "condition_encoder.gguf", "transformer_q8_0.gguf", "vocoder.gguf"] }, { "id": "minimax_music3_bf16", "display_name": "MiniMax Music 3 BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "MiniMax-Music3-GGUF", "files": ["config.json", "config/language_model.json", "config/rvq_depth_decoder.json", "config/condition_encoder.json", "config/transformer.json", "config/vocoder.json", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "language_model_bf16.gguf", "rvq_depth_decoder_bf16.gguf", "condition_encoder.gguf", "transformer_bf16.gguf", "vocoder.gguf"] }];
const dependencies$L = [];
const ui$12 = { "recommended_package": "minimax_music3_q4_0", "tags": ["Music", "GGUF"], "docs": ["docs/models/minimax_music3.md", "docs/music_generation.md", "docs/gguf.md"] };
const sources$12 = [{ "format": "gguf", "roots": { "model": "." }, "files": { "root_config": "model:config.json", "language_model_config": "model:config/language_model.json", "depth_decoder_config": "model:config/rvq_depth_decoder.json", "condition_encoder_config": "model:config/condition_encoder.json", "transformer_config": "model:config/transformer.json", "vocoder_config": "model:config/vocoder.json", "tokenizer_json": "model:tokenizer/tokenizer.json", "tokenizer_config": "model:tokenizer/tokenizer_config.json" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "root_config": "model:config.json", "language_model_config": "model:config/language_model.json", "depth_decoder_config": "model:config/rvq_depth_decoder.json", "condition_encoder_config": "model:config/condition_encoder.json", "transformer_config": "model:config/transformer.json", "vocoder_config": "model:config/vocoder.json", "tokenizer_json": "model:tokenizer/tokenizer.json", "tokenizer_config": "model:tokenizer/tokenizer_config.json" }, "tensors": { "language_model_weights": { "source": "model:language_model/model.safetensors.index.json" }, "depth_decoder_weights": { "source": "model:rvq_depth_decoder/diffusion_pytorch_model.safetensors" }, "condition_encoder_weights": { "source": "model:condition_encoder/diffusion_pytorch_model.safetensors" }, "transformer_weights": { "source": "model:transformer/diffusion_pytorch_model.safetensors.index.json" }, "vocoder_weights": { "source": "model:vocoder/diffusion_pytorch_model.safetensors" } } }];
const __vite_glob_0_67 = {
  schema_version: schema_version$L,
  family: family$12,
  display_name: display_name$12,
  description: description$12,
  category: category$12,
  status: status$12,
  tasks: tasks$12,
  modes: modes$12,
  languages: languages$12,
  capabilities: capabilities$12,
  runtime: runtime$12,
  options: options$12,
  package_defaults: package_defaults$X,
  packages: packages$13,
  dependencies: dependencies$L,
  ui: ui$12,
  sources: sources$12
};
const family$11 = "miocodec";
const display_name$11 = "MioCodec";
const description$11 = "Lightweight neural audio codec that encodes 44.1 kHz audio into a low-rate 25 Hz discrete token stream and decodes tokens with speaker conditioning for efficient speech modeling.";
const category$11 = "audio_tools";
const status$11 = "supported";
const tasks$11 = ["vc", "s2s"];
const modes$11 = ["offline"];
const languages$11 = ["language_agnostic"];
const options$11 = { "request": [], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type.", "required": false, "preset": "weight_type_full", "default": "f32" }, { "name": "weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "constant_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "content_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "global_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "wave_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }], "load": [] };
const capabilities$11 = { "codec": ["encode_decode"], "vc": ["speaker_reference"], "s2s": ["speaker_reference"] };
const runtime$11 = { "tags": ["gguf"] };
const ui$11 = { "recommended_package": "miocodec_q8_0", "tags": ["Codec", "VC", "GGUF"], "docs": ["docs/audio_tools.md", "docs/gguf.md"] };
const package_defaults$W = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$12 = [{ "id": "miocodec_q8_0", "display_name": "MioCodec 25Hz 44.1kHz v2 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MioCodec-25Hz-44.1kHz-v2-GGUF", "files": ["MioCodec-25Hz-44.1kHz-v2-GGUF/miocodec-25hz-44khz-v2-q8_0.gguf"], "strip_prefix": "MioCodec-25Hz-44.1kHz-v2-GGUF" }, { "id": "miocodec_f16", "display_name": "MioCodec 25Hz 44.1kHz v2 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "MioCodec-25Hz-44.1kHz-v2-GGUF", "files": ["MioCodec-25Hz-44.1kHz-v2-GGUF/miocodec-25hz-44khz-v2-f16.gguf"], "strip_prefix": "MioCodec-25Hz-44.1kHz-v2-GGUF" }, { "id": "miocodec_orig", "display_name": "MioCodec 25Hz 44.1kHz v2 Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "MioCodec-25Hz-44.1kHz-v2-GGUF", "files": ["MioCodec-25Hz-44.1kHz-v2-GGUF/miocodec-25hz-44khz-v2-orig.gguf"], "strip_prefix": "MioCodec-25Hz-44.1kHz-v2-GGUF" }];
const sources$11 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.yaml" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" }, "wavlm_weights": { "source": "weights:", "prefix": "wavlm_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "wavlm": "wavlm-base-plus-mlx" }, "files": { "config": "model:config.yaml" }, "tensors": { "weights": "model:model.safetensors", "wavlm_weights": "wavlm:weights.safetensors" } }];
const __vite_glob_0_68 = {
  family: family$11,
  display_name: display_name$11,
  description: description$11,
  category: category$11,
  status: status$11,
  tasks: tasks$11,
  modes: modes$11,
  languages: languages$11,
  options: options$11,
  capabilities: capabilities$11,
  runtime: runtime$11,
  ui: ui$11,
  package_defaults: package_defaults$W,
  packages: packages$12,
  sources: sources$11
};
const family$10 = "miotts";
const display_name$10 = "MioTTS";
const description$10 = "Lightweight LLM-based English and Japanese TTS family built on MioCodec, supporting low-latency speech generation and zero-shot voice cloning from short reference audio.";
const category$10 = "tts";
const status$10 = "supported";
const tasks$10 = ["tts", "clone"];
const modes$10 = ["offline"];
const languages$10 = ["en", "ja"];
const options$10 = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum generated tokens; default 700.", "required": false, "min": 1 }, { "name": "top_k", "type": "int", "description": "Generation control; defaults to the checkpoint config.", "required": false }, { "name": "top_p", "type": "float", "description": "Generation control; defaults to the checkpoint config.", "required": false, "min": 0, "max": 1 }, { "name": "temperature", "type": "float", "description": "Generation control; defaults to the checkpoint config.", "required": false, "min": 0, "max": 2 }, { "name": "repetition_penalty", "type": "float", "description": "Generation control; defaults to the checkpoint config.", "required": false, "min": 1, "max": 1.5 }, { "name": "presence_penalty", "type": "float", "description": "Presence penalty; default 0.", "required": false, "min": 0, "max": 1 }, { "name": "frequency_penalty", "type": "float", "description": "Frequency penalty; default 0.", "required": false, "min": 0, "max": 1 }, { "name": "do_sample", "type": "bool", "description": "Generation control; defaults to the checkpoint config.", "required": false }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted chooses a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "best_of_n", "type": "int", "description": "Candidate count, capped by the session maximum; greater than one enables best-of-N.", "required": false, "min": 1 }, { "name": "best_of_n_enabled", "type": "bool", "description": "Override the session best-of-N setting.", "required": false }, { "name": "best_of_n_language", "type": "enum", "description": "ASR language used to rank candidates.", "required": false, "values": ["auto", "en", "ja"] }, { "name": "text_chunk_size", "type": "int", "description": "Framework long-form text chunk size; inherits the session setting.", "required": false, "min": 1 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; defaults to native.", "required": false, "preset": "weight_type_full" }, { "name": "codec_model_path", "type": "path", "description": "MioCodec model path; defaults to sibling MioCodec-25Hz-44.1kHz-v2.", "required": false }, { "name": "best_of_n_asr_model_path", "type": "path", "description": "ASR model path for candidate ranking; defaults to sibling Qwen3-ASR-0.6B.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Default framework text chunk size; 120 when hanzi, kana and Hangul outnumber other letters and digits, otherwise 180.", "required": false }, { "name": "best_of_n_enabled", "type": "bool", "description": "Enable candidate generation and ASR ranking.", "required": false, "default": false }, { "name": "best_of_n_default", "type": "int", "description": "Default candidate count.", "required": false, "min": 1, "default": 1 }, { "name": "best_of_n_max", "type": "int", "description": "Maximum candidate count.", "required": false, "min": 1, "default": 8 }, { "name": "best_of_n_language", "type": "enum", "description": "ASR language used to rank candidates.", "required": false, "values": ["auto", "en", "ja"], "default": "auto" }, { "name": "prefill_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 1024 }, { "name": "decode_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "codec_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "codec_constant_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "global_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "wave_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }], "load": [] };
const capabilities$10 = { "clone": ["speaker_reference"] };
const runtime$10 = { "tags": ["gguf"] };
const ui$10 = { "recommended_package": "miotts_1_7b_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/miotts.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$V = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$11 = [{ "id": "miotts_1_7b_q8_0", "display_name": "MioTTS 1.7B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MioTTS-1.7B-GGUF", "files": ["MioTTS-1.7B-GGUF/miotts-1.7b-q8_0.gguf"], "strip_prefix": "MioTTS-1.7B-GGUF" }, { "id": "miotts_1_7b_bf16", "display_name": "MioTTS 1.7B BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "MioTTS-1.7B-GGUF", "files": ["MioTTS-1.7B-GGUF/miotts-1.7b-bf16.gguf"], "strip_prefix": "MioTTS-1.7B-GGUF" }, { "id": "miotts_1_7b_orig", "display_name": "MioTTS 1.7B Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "MioTTS-1.7B-GGUF", "files": ["MioTTS-1.7B-GGUF/miotts-1.7b-orig.gguf"], "strip_prefix": "MioTTS-1.7B-GGUF" }];
const sources$10 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt" }, "optional_files": { "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt" }, "optional_files": { "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_69 = {
  family: family$10,
  display_name: display_name$10,
  description: description$10,
  category: category$10,
  status: status$10,
  tasks: tasks$10,
  modes: modes$10,
  languages: languages$10,
  options: options$10,
  capabilities: capabilities$10,
  runtime: runtime$10,
  ui: ui$10,
  package_defaults: package_defaults$V,
  packages: packages$11,
  sources: sources$10
};
const schema_version$K = 1;
const family$$ = "mira_tts";
const display_name$$ = "MiraTTS";
const description$$ = "MiraTTS is a community voice-cloning TTS model with a Qwen2 autoregressive speech-token generator, ECAPA/Perceiver speaker tokenizer, conditional acoustic processor, and DAC decoder.";
const category$$ = "tts";
const status$$ = "experimental";
const tasks$$ = ["tts", "clone"];
const modes$$ = ["offline", "streaming"];
const languages$$ = ["en"];
const runtime$$ = { "tags": ["gguf"] };
const capabilities$$ = { "tts": ["speaker_reference"], "clone": ["speaker_reference"] };
const options$$ = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum autoregressive speech tokens; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "temperature", "type": "float", "description": "Sampling temperature; default 0.8. Must be positive.", "required": false, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "Top-k sampling cutoff; default 50.", "required": false, "min": 1, "default": 50 }, { "name": "top_p", "type": "float", "description": "Nucleus sampling probability; default 0.95. Must be positive.", "required": false, "max": 1, "default": 0.95 }, { "name": "min_p", "type": "float", "description": "Minimum probability relative to the most likely token; default 0.05.", "required": false, "min": 0, "max": 1, "default": 0.05 }, { "name": "repetition_penalty", "type": "float", "description": "Autoregressive repetition penalty; default 1.2.", "required": false, "min": 1, "default": 1.2 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum codepoints per progressively emitted streaming segment; default 160.", "required": false, "min": 1, "default": 160 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode used by streaming synthesis.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted requests choose a random seed.", "required": false, "min": 0 }], "session": [{ "name": "reference_cache_slots", "type": "int", "description": "Encoded reference-voice cache slots; default 1. Set to 0 to disable reuse.", "required": false, "min": 0, "default": 1 }, { "name": "backbone_weight_type", "type": "enum", "preset": "weight_type_full", "required": false, "default": "native", "description": "Storage type for the Qwen2 language-model weights." }, { "name": "linear_weight_type", "type": "enum", "preset": "weight_type_full", "required": false, "default": "native", "description": "Storage type for non-convolutional speaker, processor, and decoder weights." }, { "name": "conv_weight_type", "type": "enum", "required": false, "default": "f32", "description": "Storage type for speaker and processor convolution weights. The DAC transposed-convolution decoder remains F32 for CUDA compatibility. Applies to the speaker encoder/acoustic processor; waveform decoder remains f32.", "values": ["native", "f32", "f16", "bf16"] }], "load": [] };
const packages$10 = [];
const dependencies$K = [];
const ui$$ = { "tags": ["TTS", "Clone"], "docs": ["docs/models/mira_tts.md"] };
const sources$$ = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "language_model": { "source": "weights:", "prefix": "language_model" }, "speaker_encoder": { "source": "weights:", "prefix": "speaker_encoder" }, "processor": { "source": "weights:", "prefix": "processor" }, "decoder": { "source": "weights:", "prefix": "decoder" }, "upsampler": { "source": "weights:", "prefix": "upsampler" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "language_model": "model:language_model.safetensors", "speaker_encoder": "model:speaker_encoder.safetensors", "processor": "model:processor.safetensors", "decoder": "model:decoder.safetensors", "upsampler": "model:upsampler.safetensors" } }];
const __vite_glob_0_70 = {
  schema_version: schema_version$K,
  family: family$$,
  display_name: display_name$$,
  description: description$$,
  category: category$$,
  status: status$$,
  tasks: tasks$$,
  modes: modes$$,
  languages: languages$$,
  runtime: runtime$$,
  capabilities: capabilities$$,
  options: options$$,
  packages: packages$10,
  dependencies: dependencies$K,
  ui: ui$$,
  sources: sources$$
};
const schema_version$J = 1;
const family$_ = "mms_forced_aligner";
const display_name$_ = "Meta MMS-300M Forced Aligner";
const description$_ = "Meta MMS-300M multilingual CTC forced aligner (Wav2Vec2ForCTC) that aligns an exact transcript to mono/stereo audio and returns word timestamps. The checkpoint covers 1,130 languages, but this port's native text normalization supports Dutch (nl/nld) and English (en/eng) Latin script only; text_normalization=pre_romanized accepts caller-supplied ASCII romanization, and unsupported non-Latin input is rejected. Checkpoint license: CC-BY-NC-4.0; GGUF conversion is local-only, no public redistribution is approved.";
const category$_ = "speech_analysis";
const status$_ = "community";
const tasks$_ = ["align"];
const modes$_ = ["offline"];
const languages$_ = ["multilingual"];
const capabilities$_ = { "align": ["word_timestamps"] };
const dependencies$J = [];
const options$_ = { "request": [{ "name": "language", "type": "string", "description": "Language code. Built-in normalization supports nl/nld and en/eng; pre_romanized accepts any nonempty code.", "required": true }, { "name": "text_normalization", "type": "enum", "description": "Transcript normalization mode; latin handles Dutch/English Latin script natively, pre_romanized trusts caller-supplied ASCII romanization.", "values": ["latin", "pre_romanized"], "required": false, "default": "latin" }, { "name": "star_frequency", "type": "enum", "description": "Placement of the virtual <star> CTC target between words (segment) or at transcript edges (edges); matches the reference default segment.", "values": ["segment", "edges"], "required": false, "default": "segment" }, { "name": "merge_threshold_sec", "type": "float", "description": "Close gaps at or below this threshold, rounded to alignment frames, by moving the later word start; word entries remain separate. Default 0.0 disables gap closure.", "required": false, "min": 0, "default": 0 }, { "name": "return_timestamps", "type": "bool", "description": "Compatibility option; word timestamps are always returned, including when false.", "required": false, "default": true }], "session": [{ "name": "emission_window_sec", "type": "float", "description": "Center emission window length in seconds used to split long waveforms; must be > 0 and at most 3600. Rounded 16 kHz sample count must be a multiple of 320 (20 ms); default 30.", "required": false, "min": 0.02, "max": 3600, "default": 30 }, { "name": "emission_context_sec", "type": "float", "description": "Left/right context appended to each emission window in seconds; must be nonnegative, at most 3600, and below emission_window_sec. Rounded 16 kHz sample count must be a multiple of 320 (20 ms); default 2.", "required": false, "min": 0, "max": 3600, "default": 2 }, { "name": "max_alignment_cells", "type": "int", "description": "Hard cap on CTC DP cells (frames x states) allocated per request; alignment fails before allocation when exceeded; default 50000000.", "required": false, "min": 1, "default": 5e7 }, { "name": "max_target_tokens", "type": "int", "description": "Hard cap on flattened CTC target tokens per request; default 8192.", "required": false, "min": 1, "default": 8192 }, { "name": "weight_type", "type": "enum", "description": "Weight storage type; default native (tensors kept as stored in the checkpoint).", "preset": "weight_type_conv", "required": false, "default": "native" }], "load": [] };
const runtime$_ = { "tags": ["gguf"] };
const ui$_ = { "recommended_package": "mms_forced_aligner_300m_f16", "tags": ["Align", "GGUF"], "docs": ["docs/models/mms_forced_aligner.md", "docs/speech_analysis.md", "docs/gguf.md"] };
const package_defaults$U = { "download": { "kind": "unsupported", "reason": "CC-BY-NC-4.0 checkpoint: convert locally with audiocpp_gguf; no public audio.cpp GGUF distribution is approved." } };
const packages$$ = [{ "id": "mms_forced_aligner_300m_f16", "display_name": "Meta MMS-300M Forced Aligner F16 GGUF", "default": true, "format": "gguf", "precision": "f16", "target_directory": "MMS-Forced-Aligner-GGUF", "files": ["MMS-Forced-Aligner-GGUF/mms-forced-aligner-f16.gguf"], "strip_prefix": "MMS-Forced-Aligner-GGUF" }, { "id": "mms_forced_aligner_300m_safetensors", "display_name": "Meta MMS-300M Forced Aligner Safetensors", "format": "safetensors", "precision": "native", "target_directory": "mms-300m-1130-forced-aligner", "files": ["config.json", "model.safetensors", "special_tokens_map.json", "tokenizer_config.json", "vocab.json"], "download": { "kind": "huggingface_snapshot", "repo": "MahmoudAshraf/mms-300m-1130-forced-aligner", "revision": "49402e9577b1158620820667c218cd494cc44486", "gated": false } }, { "id": "mms_forced_aligner_300m_q8_0", "display_name": "Meta MMS-300M Forced Aligner Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "MMS-Forced-Aligner-GGUF", "files": ["MMS-Forced-Aligner-GGUF/mms-forced-aligner-q8_0.gguf"], "strip_prefix": "MMS-Forced-Aligner-GGUF" }];
const sources$_ = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "vocab": "model:vocab.json" }, "optional_files": { "special_tokens_map": "model:special_tokens_map.json", "tokenizer_config": "model:tokenizer_config.json", "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "vocab": "model:vocab.json" }, "optional_files": { "special_tokens_map": "model:special_tokens_map.json", "tokenizer_config": "model:tokenizer_config.json", "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_71 = {
  schema_version: schema_version$J,
  family: family$_,
  display_name: display_name$_,
  description: description$_,
  category: category$_,
  status: status$_,
  tasks: tasks$_,
  modes: modes$_,
  languages: languages$_,
  capabilities: capabilities$_,
  dependencies: dependencies$J,
  options: options$_,
  runtime: runtime$_,
  ui: ui$_,
  package_defaults: package_defaults$U,
  packages: packages$$,
  sources: sources$_
};
const schema_version$I = 1;
const family$Z = "moonshine_asr";
const display_name$Z = "Moonshine Streaming ASR";
const description$Z = "Moonshine tiny/small/medium streaming English speech recognition models.";
const category$Z = "asr";
const status$Z = "experimental";
const tasks$Z = ["asr"];
const modes$Z = ["offline", "streaming"];
const languages$Z = ["en"];
const capabilities$Z = { "asr": ["vad_chunking"] };
const options$Z = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum generated transcript tokens. Defaults to audio-duration derived limit. Nonpositive values select the automatic budget.", "required": false, "default": 0 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Long-form audio chunking mode.", "values": ["auto", "fixed", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum duration of each audio chunk in seconds. Must be positive and round to a nonempty sample count.", "required": false, "default": 60 }], "session": [{ "name": "exec_plan", "type": "string", "description": "JSON component execution plans. Component decoder accepts impl default/ggml/neon and optional backend. Default retains GGML on the session backend; neon requires ENGINE_ENABLE_NEON=ON and an AArch64 NEON CPU session. No artifacts or params are used.", "required": false, "default": "{}" }, { "name": "weight_type", "type": "enum", "description": "Shared matmul weight storage type. Omitted uses native, except the CPU encoder with hidden size 620, 10 layers and decoder hidden size 512 uses f16. The decoder defaults to native unless explicitly overridden.", "values": ["native", "f32", "f16"], "required": false }, { "name": "conv_weight_type", "type": "enum", "description": "Frontend convolution weight storage type.", "preset": "weight_type_conv", "required": false }, { "name": "decoder_weight_type", "type": "enum", "description": "Decoder matmul weight storage type; inherits an explicit weight_type setting, otherwise native.", "values": ["native", "f32", "f16"], "required": false }, { "name": "encoder_gelu", "type": "enum", "description": "Encoder GELU lowering.", "values": ["erf", "exact", "tanh", "quick"], "required": false, "default": "quick" }, { "name": "cpu_blas_scheduler", "type": "bool", "description": "Use BLAS/Accelerate for supported CPU encoder matmuls.", "required": false, "default": true }, { "name": "weight_context_mb", "type": "int", "description": "Weight context arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "graph_arena_mb", "type": "int", "description": "Graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "vad_model_path", "type": "path", "description": "VAD model path used by audio_chunk_mode=vad (any built-in VAD family; default Silero VAD).", "required": false, "default": "assets/framework/models/silero_vad" }], "load": [] };
const runtime$Z = { "tags": ["gguf", "cpu", "stream"] };
const ui$Z = { "recommended_package": "moonshine_streaming_tiny_q8_0", "tags": ["ASR", "GGUF", "Stream"], "docs": ["docs/asr.md", "docs/models/moonshine_asr.md", "docs/gguf.md"] };
const package_defaults$T = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$_ = [{ "id": "moonshine_streaming_tiny_q8_0", "display_name": "Moonshine Streaming Tiny Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Moonshine-Streaming-GGUF", "files": ["Moonshine-Streaming-GGUF/moonshine-streaming-tiny-q8_0.gguf"], "strip_prefix": "Moonshine-Streaming-GGUF" }, { "id": "moonshine_streaming_small_q8_0", "display_name": "Moonshine Streaming Small Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Moonshine-Streaming-GGUF", "files": ["Moonshine-Streaming-GGUF/moonshine-streaming-small-q8_0.gguf"], "strip_prefix": "Moonshine-Streaming-GGUF" }, { "id": "moonshine_streaming_medium_q8_0", "display_name": "Moonshine Streaming Medium Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Moonshine-Streaming-GGUF", "files": ["Moonshine-Streaming-GGUF/moonshine-streaming-medium-q8_0.gguf"], "strip_prefix": "Moonshine-Streaming-GGUF" }, { "id": "moonshine_streaming_tiny_safetensors", "display_name": "Moonshine Streaming Tiny Safetensors", "format": "safetensors", "precision": "f32", "target_directory": "moonshine-streaming-tiny", "files": ["config.json", "tokenizer.json", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "moonshine-ai/moonshine-streaming-tiny", "revision": "main", "gated": false } }, { "id": "moonshine_streaming_small_safetensors", "display_name": "Moonshine Streaming Small Safetensors", "format": "safetensors", "precision": "f32", "target_directory": "moonshine-streaming-small", "files": ["config.json", "tokenizer.json", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "moonshine-ai/moonshine-streaming-small", "revision": "main", "gated": false } }, { "id": "moonshine_streaming_medium_safetensors", "display_name": "Moonshine Streaming Medium Safetensors", "format": "safetensors", "precision": "f32", "target_directory": "moonshine-streaming-medium", "files": ["config.json", "tokenizer.json", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "moonshine-ai/moonshine-streaming-medium", "revision": "main", "gated": false } }];
const dependencies$I = [];
const sources$Z = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_72 = {
  schema_version: schema_version$I,
  family: family$Z,
  display_name: display_name$Z,
  description: description$Z,
  category: category$Z,
  status: status$Z,
  tasks: tasks$Z,
  modes: modes$Z,
  languages: languages$Z,
  capabilities: capabilities$Z,
  options: options$Z,
  runtime: runtime$Z,
  ui: ui$Z,
  package_defaults: package_defaults$T,
  packages: packages$_,
  dependencies: dependencies$I,
  sources: sources$Z
};
const schema_version$H = 1;
const family$Y = "moss_transcribe_diarize";
const display_name$Y = "MOSS-Transcribe-Diarize";
const description$Y = "Joint transcription, speaker diarization, and timestamps across 50+ languages with a Whisper encoder and Qwen3 decoder.";
const category$Y = "asr";
const status$Y = "supported";
const tasks$Y = ["asr"];
const modes$Y = ["offline", "streaming"];
const languages$Y = ["auto", "50+ languages"];
const capabilities$Y = { "asr": ["segments", "speaker_turns"] };
const runtime$Y = { "tags": ["gguf"] };
const options$Y = { "request": [{ "name": "max_tokens", "type": "int", "min": 1, "required": false, "description": "Maximum generated transcript tokens. Defaults to checkpoint generation_config.max_new_tokens; must be positive." }, { "name": "instruct", "type": "string", "required": false, "description": "Transcription instruction; empty uses the upstream diarization prompt." }], "session": [], "load": [] };
const package_defaults$S = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$Z = [{ "id": "moss_transcribe_diarize_bf16", "display_name": "MOSS-Transcribe-Diarize GGUF BF16", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "MOSS-Transcribe-Diarize-GGUF", "files": ["MOSS-Transcribe-Diarize-GGUF/moss-transcribe-diarize-bf16.gguf"], "strip_prefix": "MOSS-Transcribe-Diarize-GGUF" }, { "id": "moss_transcribe_diarize_q8_0", "display_name": "MOSS-Transcribe-Diarize GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "MOSS-Transcribe-Diarize-GGUF", "files": ["MOSS-Transcribe-Diarize-GGUF/moss-transcribe-diarize-q8_0.gguf"], "strip_prefix": "MOSS-Transcribe-Diarize-GGUF" }, { "id": "moss_transcribe_diarize_q4_k", "display_name": "MOSS-Transcribe-Diarize GGUF Q4_K", "format": "gguf", "precision": "q4_k", "target_directory": "MOSS-Transcribe-Diarize-GGUF", "files": ["MOSS-Transcribe-Diarize-GGUF/moss-transcribe-diarize-q4_k.gguf"], "strip_prefix": "MOSS-Transcribe-Diarize-GGUF" }];
const dependencies$H = [];
const ui$Y = { "tags": ["GGUF"], "docs": [], "recommended_package": "moss_transcribe_diarize_bf16" };
const sources$Y = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "preprocessor_config": "model:preprocessor_config.json", "processor_config": "model:processor_config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "vocab": "model:vocab.json", "merges": "model:merges.txt" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_73 = {
  schema_version: schema_version$H,
  family: family$Y,
  display_name: display_name$Y,
  description: description$Y,
  category: category$Y,
  status: status$Y,
  tasks: tasks$Y,
  modes: modes$Y,
  languages: languages$Y,
  capabilities: capabilities$Y,
  runtime: runtime$Y,
  options: options$Y,
  package_defaults: package_defaults$S,
  packages: packages$Z,
  dependencies: dependencies$H,
  ui: ui$Y,
  sources: sources$Y
};
const family$X = "moss_tts_local";
const display_name$X = "MOSS-TTS-Local";
const description$X = "Flagship MOSS-TTS model for high-fidelity 31-language and code-switched speech, zero-shot voice cloning, long-form generation, and fine-grained Pinyin, phoneme, and duration control.";
const category$X = "tts";
const status$X = "supported";
const tasks$X = ["tts", "clone"];
const modes$X = ["offline"];
const languages$X = ["ar", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "he", "hi", "hu", "it", "ja", "ko", "mk", "ms", "nl", "pl", "pt", "ro", "ru", "sv", "sw", "th", "tl", "tr", "vi", "yue", "zh"];
const options$X = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum generated audio frames.", "required": false, "min": 1, "default": 4096 }, { "name": "do_sample", "type": "bool", "description": "Enable sampling.", "required": false, "default": true }, { "name": "temperature", "type": "float", "description": "Audio sampling temperature. Must be finite and positive when sampling.", "required": false, "default": 1.7 }, { "name": "top_p", "type": "float", "description": "Audio nucleus sampling probability.", "required": false, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "Audio top-k sampling limit.", "required": false, "default": 25 }, { "name": "repetition_penalty", "type": "float", "description": "Audio repetition penalty. Must be finite and positive when token history is nonempty.", "required": false, "default": 1 }, { "name": "text_temperature", "type": "float", "description": "Text sampling temperature. Must be finite and positive when sampling.", "required": false, "default": 1 }, { "name": "text_top_p", "type": "float", "description": "Text nucleus sampling probability.", "required": false, "default": 1 }, { "name": "text_top_k", "type": "int", "description": "Text top-k sampling limit.", "required": false, "default": 50 }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted chooses a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "text_chunk_size", "type": "int", "description": "Framework long-form text chunk size.", "required": false, "default": 2048, "min": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "required": false, "values": ["default", "tag_aware", "japanese", "endline"], "default": "default" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Backbone weight storage; auto uses F32 on CPU, BF16 on CUDA, native on other backends.", "required": false, "values": ["auto", "native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "default": "auto" }, { "name": "reference_cache_slots", "type": "int", "description": "Encoded reference cache slots; zero disables reuse.", "required": false, "min": 0, "default": 1 }], "load": [] };
const capabilities$X = { "clone": ["speaker_reference"] };
const runtime$X = { "tags": ["gguf"] };
const ui$X = { "recommended_package": "moss_tts_local_v1_5_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/moss_tts_local.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$R = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$Y = [{ "id": "moss_tts_local_v1_5_q8_0", "display_name": "MOSS-TTS-Local v1.5 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MOSS-TTS-Local-v1.5-GGUF", "files": ["MOSS-TTS-Local-v1.5-GGUF/moss-tts-local-v1.5-q8_0.gguf"], "strip_prefix": "MOSS-TTS-Local-v1.5-GGUF" }, { "id": "moss_tts_local_v1_5_bf16", "display_name": "MOSS-TTS-Local v1.5 BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "MOSS-TTS-Local-v1.5-GGUF", "files": ["MOSS-TTS-Local-v1.5-GGUF/moss-tts-local-v1.5-bf16.gguf"], "strip_prefix": "MOSS-TTS-Local-v1.5-GGUF" }];
const sources$X = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "model:audio_tokenizer/config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "audio_tokenizer_weights": { "source": "weights:", "prefix": "audio_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "audio_tokenizer": "audio_tokenizer" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "audio_tokenizer:config.json" }, "tensors": { "model_weights": "model:model.safetensors", "audio_tokenizer_weights": "audio_tokenizer:model.safetensors.index.json" } }];
const __vite_glob_0_74 = {
  family: family$X,
  display_name: display_name$X,
  description: description$X,
  category: category$X,
  status: status$X,
  tasks: tasks$X,
  modes: modes$X,
  languages: languages$X,
  options: options$X,
  capabilities: capabilities$X,
  runtime: runtime$X,
  ui: ui$X,
  package_defaults: package_defaults$R,
  packages: packages$Y,
  sources: sources$X
};
const family$W = "moss_tts_nano";
const display_name$W = "MOSS-TTS-Nano";
const description$W = "Compact deployment-first MOSS-TTS model for real-time multilingual speech generation, lightweight integration, and zero-shot voice cloning.";
const category$W = "tts";
const status$W = "supported";
const tasks$W = ["tts", "clone"];
const modes$W = ["offline", "streaming"];
const languages$W = ["ar", "cs", "da", "de", "el", "en", "es", "fa", "fr", "hu", "it", "ja", "ko", "pl", "pt", "ru", "sv", "tr", "zh"];
const options$W = { "request": [{ "name": "reference_text", "type": "string", "description": "Transcript for reference audio; a nonempty value requires voice reference audio.", "required": false, "default": "" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated audio frames.", "required": false, "min": 1, "default": 300 }, { "name": "active_codebooks", "type": "int", "description": "Active codebooks; defaults to the checkpoint n_vq. Must not exceed checkpoint n_vq; omitted uses n_vq.", "required": false, "min": 1 }, { "name": "do_sample", "type": "bool", "description": "Enable sampling.", "required": false, "default": true }, { "name": "temperature", "type": "float", "description": "Audio sampling temperature. Must be positive, including when do_sample=false.", "required": false, "default": 1.7 }, { "name": "top_p", "type": "float", "description": "Audio nucleus sampling probability.", "required": false, "default": 0.8, "min": 0, "max": 1 }, { "name": "top_k", "type": "int", "description": "Audio top-k sampling limit.", "required": false, "default": 25, "min": 0 }, { "name": "repetition_penalty", "type": "float", "description": "Audio repetition penalty. Must be positive.", "required": false, "default": 1 }, { "name": "text_temperature", "type": "float", "description": "Text sampling temperature. Must be positive, including when do_sample=false.", "required": false, "default": 1.5 }, { "name": "text_top_p", "type": "float", "description": "Text nucleus sampling probability.", "required": false, "default": 1, "min": 0, "max": 1 }, { "name": "text_top_k", "type": "int", "description": "Text top-k sampling limit.", "required": false, "default": 50, "min": 0 }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted chooses a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "text_chunk_size", "type": "int", "description": "Framework long-form text chunk size; default 50 when hanzi, kana and Hangul outnumber other letters and digits, otherwise 256.", "required": false, "min": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "required": false, "values": ["default", "tag_aware", "japanese", "endline"], "default": "default" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type.", "required": false, "preset": "weight_type_full", "default": "native" }, { "name": "global_weight_type", "type": "enum", "description": "Global transformer weight storage; inherits weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "local_frame_weight_type", "type": "enum", "description": "Local frame decoder weight storage; inherits weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "prefill_mode", "type": "enum", "description": "How prompt rows are forwarded: one batched graph (default, fast) or one row at a time through the decode graph. single_row keeps quantized runs on a single kernel family for numerical self-consistency at a one-time prefill latency cost; see the model docs' quantization notes.", "required": false, "values": ["batched", "single_row"], "default": "batched" }, { "name": "global_prefill_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "global_decode_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 128 }, { "name": "global_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "local_frame_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 64 }, { "name": "local_frame_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 128 }, { "name": "audio_tokenizer_encoder_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 64 }, { "name": "audio_tokenizer_decoder_graph_arena_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 64 }, { "name": "audio_tokenizer_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 128 }], "load": [] };
const capabilities$W = { "clone": ["speaker_reference"] };
const runtime$W = { "tags": ["gguf"] };
const ui$W = { "recommended_package": "moss_tts_nano_100m_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/moss_tts_nano.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$Q = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$X = [{ "id": "moss_tts_nano_100m_q8_0", "display_name": "MOSS-TTS-Nano 100M Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MOSS-TTS-Nano-100M-GGUF", "files": ["MOSS-TTS-Nano-100M-GGUF/moss-tts-nano-100m-q8_0.gguf"], "strip_prefix": "MOSS-TTS-Nano-100M-GGUF" }, { "id": "moss_tts_nano_100m_bf16", "display_name": "MOSS-TTS-Nano 100M BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "MOSS-TTS-Nano-100M-GGUF", "files": ["MOSS-TTS-Nano-100M-GGUF/moss-tts-nano-100m-bf16.gguf"], "strip_prefix": "MOSS-TTS-Nano-100M-GGUF" }];
const sources$W = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_model": "model:tokenizer.model", "audio_tokenizer_config": "model:audio_tokenizer/config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "audio_tokenizer_weights": { "source": "weights:", "prefix": "audio_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "audio_tokenizer": "audio_tokenizer" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_model": "model:tokenizer.model", "audio_tokenizer_config": "audio_tokenizer:config.json" }, "tensors": { "model_weights": "model:model.safetensors", "audio_tokenizer_weights": "audio_tokenizer:model.safetensors.index.json" } }];
const __vite_glob_0_75 = {
  family: family$W,
  display_name: display_name$W,
  description: description$W,
  category: category$W,
  status: status$W,
  tasks: tasks$W,
  modes: modes$W,
  languages: languages$W,
  options: options$W,
  capabilities: capabilities$W,
  runtime: runtime$W,
  ui: ui$W,
  package_defaults: package_defaults$Q,
  packages: packages$X,
  sources: sources$W
};
const schema_version$G = 1;
const family$V = "moss_tts_v15";
const display_name$V = "MOSS-TTS-v1.5";
const description$V = "8B delay-pattern MOSS-TTS: zero-shot voice cloning from a short reference, 24 kHz, with an explicit duration budget.";
const category$V = "community";
const status$V = "experimental";
const tasks$V = ["tts", "clone"];
const modes$V = ["offline"];
const languages$V = ["en", "zh"];
const capabilities$V = { "tts": ["speaker_reference", "style_control", "long_form"], "clone": ["speaker_reference"] };
const runtime$V = { "tags": ["gguf"] };
const sources$V = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "model:audio_tokenizer/config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "audio_tokenizer_weights": { "source": "weights:", "prefix": "audio_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "audio_tokenizer": "audio_tokenizer" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "audio_tokenizer:config.json" }, "tensors": { "model_weights": "model:model.safetensors.index.json", "audio_tokenizer_weights": "audio_tokenizer:model.safetensors.index.json" } }];
const options$V = { "request": [{ "name": "min_frames", "type": "int", "required": false, "default": 0, "description": "Minimum generated audio frames per text chunk; nonpositive values derive a text-length-based floor. Separate from duration_frames conditioning." }, { "name": "max_frames", "type": "int", "required": false, "default": 0, "description": "Generated audio-frame ceiling per text chunk; nonpositive values derive a text-length-based ceiling. Runtime raises it to at least the effective min_frames plus the number of codebooks." }, { "name": "instruct", "type": "string", "required": false, "description": "Voice description. Followed only loosely on this checkpoint; a reference recording is far more reliable." }, { "name": "duration_frames", "type": "int", "required": false, "description": "Duration budget in codec frames at 12.5 a second, the model's own '- Tokens:' field. Nonpositive values disable duration conditioning." }, { "name": "language", "type": "string", "required": false, "description": "Full language name; the model does not understand codes like 'en'." }, { "name": "seed", "type": "int", "required": false, "description": "Reproduces a take exactly; default 0. Parsed as signed 32-bit integer then converted to uint32; negative values wrap.", "default": 0 }, { "name": "text_temperature", "type": "float", "required": false, "default": 1.5, "description": "Text-token sampling temperature. Must be finite and positive when sampling." }, { "name": "temperature", "type": "float", "required": false, "description": "Audio sampling temperature; default 1.5. Must be finite and positive when sampling.", "default": 1.5 }, { "name": "top_p", "type": "float", "required": false, "description": "Audio nucleus sampling cutoff; default 0.6.", "default": 0.6 }, { "name": "top_k", "type": "int", "required": false, "description": "Audio top-k; default 50.", "default": 50 }, { "name": "repetition_penalty", "type": "float", "required": false, "description": "Audio repetition penalty; default 1.1. Must be finite and positive when history is nonempty.", "default": 1.1 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 200.", "required": false, "min": 1, "default": 200 }, { "name": "text_chunk_mode", "type": "enum", "description": "Text chunking policy; word_budget also accepts default.", "values": ["word_budget", "tag_aware", "japanese", "endline"], "required": false, "default": "word_budget" }], "session": [{ "name": "weight_type", "type": "enum", "values": ["native", "f32", "bf16", "q8_0"], "required": false, "default": "native", "description": "Backbone and head weight storage; default native, which keeps a GGUF package's own type. Forcing bf16 dequantises a quantised package and costs the VRAM the quantisation was meant to save. f16 is rejected: this backbone produces NaN in it." }], "load": [] };
const ui$V = { "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/moss_tts_v15.md", "docs/tts.md", "docs/gguf.md"], "recommended_package": "moss_tts_v15_q8_0_codec_f16" };
const packages$W = [{ "id": "moss_tts_v15_q8_0_codec_f16", "display_name": "MOSS-TTS-v1.5 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MOSS-TTS-v1.5-GGUF", "files": ["moss_tts_v15_q8_0_codec_f16.gguf"] }, { "id": "moss_tts_v15_q4_k_codec_f16", "display_name": "MOSS-TTS-v1.5 Q4_K GGUF", "default": false, "format": "gguf", "precision": "q4_k", "target_directory": "MOSS-TTS-v1.5-GGUF", "files": ["moss_tts_v15_q4_k_codec_f16.gguf"] }, { "id": "moss_tts_v15_bf16_codec_f16", "display_name": "MOSS-TTS-v1.5 BF16 GGUF", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "MOSS-TTS-v1.5-GGUF", "files": ["moss_tts_v15_bf16_codec_f16.gguf"] }];
const package_defaults$P = { "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/MOSS-TTS-v1.5-GGUF", "revision": "main", "gated": false } };
const dependencies$G = [];
const __vite_glob_0_76 = {
  schema_version: schema_version$G,
  family: family$V,
  display_name: display_name$V,
  description: description$V,
  category: category$V,
  status: status$V,
  tasks: tasks$V,
  modes: modes$V,
  languages: languages$V,
  capabilities: capabilities$V,
  runtime: runtime$V,
  sources: sources$V,
  options: options$V,
  ui: ui$V,
  packages: packages$W,
  package_defaults: package_defaults$P,
  dependencies: dependencies$G
};
const schema_version$F = 1;
const family$U = "moss_ttsd";
const display_name$U = "MOSS-TTSD";
const description$U = "8B delay-pattern dialogue TTS: speaker-tagged conversation in one take, with per-speaker zero-shot voice cloning. 24 kHz, 16 codebooks.";
const category$U = "community";
const status$U = "experimental";
const tasks$U = ["tts", "clone"];
const modes$U = ["offline"];
const languages$U = ["en", "zh"];
const capabilities$U = { "tts": ["speaker_reference", "multi_speaker", "long_form"], "clone": ["speaker_reference", "multi_speaker"] };
const runtime$U = { "tags": ["gguf"] };
const sources$U = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "model:audio_tokenizer/config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "audio_tokenizer_weights": { "source": "weights:", "prefix": "audio_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "audio_tokenizer": "audio_tokenizer" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "audio_tokenizer:config.json" }, "tensors": { "model_weights": "model:model.safetensors.index.json", "audio_tokenizer_weights": "audio_tokenizer:model.safetensors.index.json" } }];
const options$U = { "request": [{ "name": "voice_samples", "type": "string", "required": false, "description": "Per-speaker reference WAV paths, comma separated and positional: the first is [S1], the second [S2]. Leave an entry empty to let that speaker be invented rather than cloned. Cannot be combined with voice_ref." }, { "name": "reference_text", "type": "string", "required": false, "description": "What the reference recordings say, speaker-tagged. Prepended to the dialogue so the continuation carries on from words it has already spoken." }, { "name": "language", "type": "string", "required": false, "description": "Full language name; the model does not understand codes like 'en'." }, { "name": "instruct", "type": "string", "required": false, "description": "Free-text direction for the delivery." }, { "name": "seed", "type": "int", "required": false, "description": "Reproduces a take exactly. Parsed as signed 32-bit integer then converted to uint32; negative values wrap." }, { "name": "text_temperature", "type": "float", "required": false, "default": 1.5, "description": "Text-token sampling temperature. Must be finite and positive when sampling." }, { "name": "temperature", "type": "float", "required": false, "min": 0, "default": 1.5, "description": "Audio sampling temperature; must be > 0, default 1.5." }, { "name": "top_p", "type": "float", "required": false, "min": 0, "default": 0.6, "description": "Audio nucleus sampling cutoff." }, { "name": "top_k", "type": "int", "required": false, "default": 50, "description": "Audio top-k. Nonpositive values disable filtering." }, { "name": "repetition_penalty", "type": "float", "required": false, "min": 0, "default": 1.1, "description": "Audio repetition penalty; must be > 0. Checked when token history is present; default 1.1." }, { "name": "max_frames", "type": "int", "required": false, "description": "Ceiling on generated codec frames at 12.5/s; 0 derives one from the dialogue length. Nonpositive values derive an automatic ceiling." }], "session": [{ "name": "weight_type", "type": "enum", "values": ["native", "f32", "bf16", "q8_0"], "required": false, "default": "native", "description": "Backbone and head weight storage; default native, which keeps a GGUF package's own type. Forcing bf16 dequantises a quantised package and costs the VRAM the quantisation was meant to save. f16 is rejected: this backbone produces NaN in it." }], "load": [] };
const ui$U = { "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/moss_ttsd.md", "docs/tts.md", "docs/gguf.md"], "recommended_package": "moss_ttsd_q8_0_codec_f16" };
const packages$V = [{ "id": "moss_ttsd_q8_0_codec_f16", "display_name": "MOSS-TTSD Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "MOSS-TTSD-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/MOSS-TTSD-GGUF" }, "files": ["moss_ttsd_q8_0_codec_f16.gguf"] }, { "id": "moss_ttsd_q4_k_codec_f16", "display_name": "MOSS-TTSD Q4_K GGUF (f16 heads)", "default": false, "format": "gguf", "precision": "q4_k", "target_directory": "MOSS-TTSD-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/MOSS-TTSD-GGUF" }, "files": ["moss_ttsd_q4_k_codec_f16.gguf"] }, { "id": "moss_ttsd_bf16_codec_f16", "display_name": "MOSS-TTSD BF16 GGUF", "default": false, "format": "gguf", "precision": "bf16", "target_directory": "MOSS-TTSD-GGUF", "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/MOSS-TTSD-GGUF" }, "files": ["moss_ttsd_bf16_codec_f16.gguf"] }];
const package_defaults$O = { "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/MOSS-TTS-v1.5-GGUF", "revision": "main", "gated": false } };
const dependencies$F = [];
const __vite_glob_0_77 = {
  schema_version: schema_version$F,
  family: family$U,
  display_name: display_name$U,
  description: description$U,
  category: category$U,
  status: status$U,
  tasks: tasks$U,
  modes: modes$U,
  languages: languages$U,
  capabilities: capabilities$U,
  runtime: runtime$U,
  sources: sources$U,
  options: options$U,
  ui: ui$U,
  packages: packages$V,
  package_defaults: package_defaults$O,
  dependencies: dependencies$F
};
const family$T = "moss_voicegen";
const display_name$T = "MOSS-VoiceGenerator";
const description$T = "MOSS voice design model: creates a speaker from a written instruction instead of a reference recording, then speaks the supplied text in that voice.";
const category$T = "community";
const status$T = "community";
const tasks$T = ["design"];
const modes$T = ["offline"];
const languages$T = ["en", "zh"];
const capabilities$T = { "design": ["voice_design"] };
const options$T = { "request": [{ "name": "min_frames", "type": "int", "required": false, "default": 0, "description": "Minimum generated audio frames per text chunk; nonpositive values derive a text-length-based floor." }, { "name": "max_frames", "type": "int", "required": false, "default": 0, "description": "Generated audio-frame ceiling per text chunk; nonpositive values derive a text-length-based ceiling. Runtime raises it to at least the effective min_frames plus the number of codebooks." }, { "name": "instruct", "type": "string", "required": false, "description": "Voice description: timbre, age, pace, emotion." }, { "name": "text_temperature", "type": "float", "required": false, "default": 1.5, "description": "Text-token sampling temperature. Must be finite and positive when sampling." }, { "name": "language", "type": "string", "description": "Optional full language name, such as English or Chinese; not an ISO language code.", "required": false }, { "name": "seed", "type": "int", "description": "Generation seed; later text chunks add their chunk index. Parsed as signed 32-bit integer then converted to uint32; negative values wrap.", "required": false, "default": 0 }, { "name": "temperature", "type": "float", "description": "Audio-token sampling temperature. Must be finite and positive when sampling.", "required": false, "default": 1.5 }, { "name": "top_p", "type": "float", "description": "Audio-token nucleus sampling cutoff.", "required": false, "default": 0.6 }, { "name": "top_k", "type": "int", "description": "Audio-token top-k sampling limit.", "required": false, "default": 50 }, { "name": "repetition_penalty", "type": "float", "description": "Audio-token repetition penalty. Must be finite and positive when history is nonempty.", "required": false, "default": 1.1 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per generated text chunk; must be positive.", "required": false, "min": 1, "default": 200 }, { "name": "text_chunk_mode", "type": "enum", "description": "Text chunking policy.", "required": false, "preset": "text_chunk_mode_full", "default": "word_budget" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Backbone weight storage. f16 is not supported.", "required": false, "values": ["native", "f32", "bf16", "q8_0"], "default": "bf16" }], "load": [] };
const runtime$T = { "tags": ["gguf"] };
const ui$T = { "recommended_package": "moss_voicegen_bf16_codec_f16_decode", "tags": ["Voice Design", "GGUF"], "docs": ["docs/models/moss_voicegen.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$N = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$U = [{ "id": "moss_voicegen_bf16_codec_f16_decode", "display_name": "MOSS-VoiceGenerator BF16 GGUF", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "MOSS-VoiceGenerator-GGUF", "files": ["MOSS-VoiceGenerator-GGUF/moss_voicegen_bf16_codec_f16_decode.gguf"], "strip_prefix": "MOSS-VoiceGenerator-GGUF" }];
const sources$T = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "model:audio_tokenizer/config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "audio_tokenizer_weights": { "source": "weights:", "prefix": "audio_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "audio_tokenizer": "audio_tokenizer" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_merges": "model:merges.txt", "audio_tokenizer_config": "audio_tokenizer:config.json" }, "tensors": { "model_weights": "model:model.safetensors", "audio_tokenizer_weights": "audio_tokenizer:model.safetensors.index.json" } }];
const __vite_glob_0_78 = {
  family: family$T,
  display_name: display_name$T,
  description: description$T,
  category: category$T,
  status: status$T,
  tasks: tasks$T,
  modes: modes$T,
  languages: languages$T,
  capabilities: capabilities$T,
  options: options$T,
  runtime: runtime$T,
  ui: ui$T,
  package_defaults: package_defaults$N,
  packages: packages$U,
  sources: sources$T
};
const schema_version$E = 1;
const family$S = "mossformer2";
const display_name$S = "MossFormer2";
const description$S = "MossFormer2 overlapping speech separation at 16 kHz.";
const category$S = "audio_tools";
const status$S = "supported";
const tasks$S = ["sep"];
const modes$S = ["offline"];
const languages$S = ["language_agnostic"];
const capabilities$S = { "sep": ["stems"] };
const runtime$S = { "tags": ["gguf"] };
const options$S = { "request": [{ "name": "audio_chunk_duration_sec", "type": "float", "description": "Separation window duration; zero selects whole-file inference.", "min": 0, "default": 2, "required": false }, { "name": "audio_chunk_overlap_sec", "type": "float", "description": "Overlap between adjacent audio chunks, in seconds; must be smaller than audio_chunk_duration_sec when chunking is enabled. Recommended: 25% of audio_chunk_duration_sec, matching the official Python settings. Overlapping edges are trimmed rather than averaged. Ignored for whole-file inference.", "min": 0, "default": 0.5, "required": false }, { "name": "normalize_output", "type": "bool", "description": "Match each trimmed track RMS to the input as in ClearVoice's NumPy interface.", "default": true, "required": false }], "session": [], "load": [] };
const package_defaults$M = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$T = [{ "id": "mossformer2_ss_16k_f32", "display_name": "MossFormer2 SS 16K F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "MossFormer2-GGUF", "files": ["MossFormer2-GGUF/mossformer2-ss-16k-f32.gguf"], "strip_prefix": "MossFormer2-GGUF" }, { "id": "mossformer2_ss_16k_f16", "display_name": "MossFormer2 SS 16K F16", "default": false, "format": "gguf", "precision": "f16", "target_directory": "MossFormer2-GGUF", "files": ["MossFormer2-GGUF/mossformer2-ss-16k-f16.gguf"], "strip_prefix": "MossFormer2-GGUF" }];
const dependencies$E = [];
const ui$S = { "tags": ["GGUF"], "docs": ["docs/models/mossformer2.md"], "recommended_package": "mossformer2_ss_16k_f32" };
const sources$S = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_79 = {
  schema_version: schema_version$E,
  family: family$S,
  display_name: display_name$S,
  description: description$S,
  category: category$S,
  status: status$S,
  tasks: tasks$S,
  modes: modes$S,
  languages: languages$S,
  capabilities: capabilities$S,
  runtime: runtime$S,
  options: options$S,
  package_defaults: package_defaults$M,
  packages: packages$T,
  dependencies: dependencies$E,
  ui: ui$S,
  sources: sources$S
};
const schema_version$D = 1;
const family$R = "muscriptor";
const display_name$R = "MuScriptor";
const description$R = "MuScriptor is an audio-to-symbolic model that converts music audio into symbolic note events or MIDI files, with instrument constraints, sampling, beam search, batch chunk decoding, and streaming final-result output.";
const category$R = "audio_tools";
const status$R = "supported";
const tasks$R = ["midi"];
const modes$R = ["offline", "streaming"];
const languages$R = ["music"];
const runtime$R = { "tags": ["gguf", "stream"] };
const capabilities$R = {};
const options$R = { "request": [{ "name": "instruments", "type": "string", "description": "Comma-separated instrument group names to constrain generated MIDI events; empty allows all instruments.", "required": false, "default": "" }, { "name": "output_format", "type": "enum", "description": "Primary output serialization written by --out; midi writes a MIDI file, json writes generated note events. Default midi.", "values": ["midi", "json"], "required": false, "default": "midi" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated MIDI-event token count per chunk; default 2000.", "required": false, "min": 1, "default": 2e3 }, { "name": "do_sample", "type": "bool", "description": "Use temperature sampling instead of greedy token selection; default false.", "required": false, "default": false }, { "name": "temperature", "type": "float", "description": "Sampling temperature when do_sample=true; 0 is accepted for compatibility and behaves deterministically, default 1.0.", "required": false, "min": 0, "default": 1 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance coefficient; 1 disables CFG, default 1.0.", "required": false, "default": 1 }, { "name": "batch_size", "type": "int", "description": "Number of audio chunks processed per batch when prelude_forcing=false; default 1.", "required": false, "min": 1, "default": 1 }, { "name": "num_beams", "type": "int", "description": "Beam-search width; 1 disables beam search, default 1. Beam search requires guidance_scale=1, do_sample=false, and an actual graph batch of one.", "required": false, "min": 1, "default": 1 }, { "name": "prelude_forcing", "type": "bool", "description": "Force open-note prelude tokens between sequential chunks; default true.", "required": false, "default": true }, { "name": "seed", "type": "int", "description": "Sampling seed; default 0. Parsed as int64 and converted to uint64; negative values wrap.", "required": false, "default": 0 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Transformer weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "perf_mode", "type": "enum", "description": "Decoder attention mode; flash_attention uses the CUDA fast path, off keeps the exact attention path. Default flash_attention.", "values": ["off", "flash_attention"], "required": false, "default": "flash_attention" }, { "name": "weight_context_mb", "type": "int", "description": "Weight context arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "conditioning_graph_arena_mb", "type": "int", "description": "Condition graph arena size in MiB; default 128.", "required": false, "min": 1, "default": 128 }, { "name": "decoder_prefill_graph_arena_mb", "type": "int", "description": "Decoder prefill graph arena size in MiB; default 768.", "required": false, "min": 1, "default": 768 }, { "name": "decoder_decode_graph_arena_mb", "type": "int", "description": "Decoder cached-step graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }], "load": [] };
const package_defaults$L = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$S = [{ "id": "muscriptor_small_f32", "display_name": "MuScriptor Small F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "MuScriptor-Small-GGUF", "files": ["MuScriptor-Small-GGUF/muscriptor-small-f32.gguf"], "strip_prefix": "MuScriptor-Small-GGUF" }];
const dependencies$D = [];
const ui$R = { "recommended_package": "muscriptor_small_f32", "tags": ["Music", "MIDI", "GGUF", "Stream"], "docs": ["docs/models/muscriptor.md", "docs/gguf.md"] };
const sources$R = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_80 = {
  schema_version: schema_version$D,
  family: family$R,
  display_name: display_name$R,
  description: description$R,
  category: category$R,
  status: status$R,
  tasks: tasks$R,
  modes: modes$R,
  languages: languages$R,
  runtime: runtime$R,
  capabilities: capabilities$R,
  options: options$R,
  package_defaults: package_defaults$L,
  packages: packages$S,
  dependencies: dependencies$D,
  ui: ui$R,
  sources: sources$R
};
const schema_version$C = 1;
const family$Q = "nemotron_3_diar";
const display_name$Q = "Nemotron 3 Diarization";
const description$Q = "NVIDIA eight-speaker streaming diarization model with arrival-order speaker identities and configurable latency profiles.";
const category$Q = "speech_analysis";
const status$Q = "supported";
const tasks$Q = ["diar"];
const modes$Q = ["offline", "streaming"];
const languages$Q = ["multilingual"];
const capabilities$Q = { "diar": ["speaker_turns"] };
const dependencies$C = [];
const options$Q = { "request": [{ "name": "speaker_threshold", "type": "float", "description": "Speaker activity threshold used for turn decoding.", "required": false, "min": 0, "max": 1, "default": 0.5 }, { "name": "speaker_min_frames", "type": "int", "description": "Minimum decoded turn duration in 10 ms output frames.", "required": false, "min": 0, "default": 0 }, { "name": "speaker_pad_frames", "type": "int", "description": "Padding applied to decoded turns in 10 ms output frames.", "required": false, "min": 0, "default": 0 }, { "name": "return_frame_probabilities", "type": "bool", "description": "Attach the raw 10 ms speaker-activity timeline as the speaker_probabilities.safetensors artifact (F32 [frames, speakers] plus streaming-geometry metadata), the input for nemotron_asr speaker tagging.", "required": false, "default": false }], "session": [{ "name": "latency_profile", "type": "enum", "description": "Streaming latency profile: the official very_high, low, very_low and ultra_low presets, asr_la0/3/6/13 for nemotron_asr speaker masking at that ASR lookahead, or custom.", "values": ["very_high", "low", "very_low", "ultra_low", "asr_la0", "asr_la3", "asr_la6", "asr_la13", "custom"], "required": false, "default": "very_high" }, { "name": "spkcache_len", "type": "int", "description": "Speaker-cache length in 80 ms encoder frames for the custom profile.", "required": false, "min": 16 }, { "name": "fifo_len", "type": "int", "description": "FIFO length in 80 ms encoder frames for the custom profile.", "required": false, "min": 0 }, { "name": "chunk_len", "type": "int", "description": "Chunk length in 80 ms encoder frames for the custom profile.", "required": false, "min": 1 }, { "name": "chunk_right_context", "type": "int", "description": "Future context in 80 ms encoder frames for the custom profile.", "required": false, "min": 0 }, { "name": "spkcache_update_period", "type": "int", "description": "FIFO-to-cache update period in 80 ms encoder frames for the custom profile.", "required": false, "min": 1 }, { "name": "attention", "type": "enum", "values": ["auto", "flash", "eager"], "description": "Encoder attention lowering; auto uses flash attention where the backend supports it.", "required": false, "default": "auto" }, { "name": "graph_arena_mb", "type": "int", "description": "Inference graph arena size in MiB.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_context_mb", "type": "int", "description": "Weight context size in MiB.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_type", "type": "enum", "description": "Default model weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }], "load": [] };
const runtime$Q = { "tags": ["gguf", "stream"] };
const ui$Q = { "recommended_package": "nemotron_3_diar_bf16", "tags": ["Diar", "Stream", "GGUF"], "docs": ["docs/models/nemotron_3_diar.md", "docs/speech_analysis.md", "docs/gguf.md"] };
const package_defaults$K = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Nemotron-3-Diarization-GGUF", "revision": "main", "gated": false } };
const packages$R = [{ "id": "nemotron_3_diar_bf16", "display_name": "Nemotron 3 Diarization BF16 GGUF", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "Nemotron-3-Diarization-GGUF", "files": ["nemotron-3-diarization-bf16.gguf"] }, { "id": "nemotron_3_diar_q8_0", "display_name": "Nemotron 3 Diarization Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Nemotron-3-Diarization-GGUF", "files": ["nemotron-3-diarization-q8_0.gguf"] }];
const sources$Q = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "processor": "model:processor_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "processor": "model:processor_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_81 = {
  schema_version: schema_version$C,
  family: family$Q,
  display_name: display_name$Q,
  description: description$Q,
  category: category$Q,
  status: status$Q,
  tasks: tasks$Q,
  modes: modes$Q,
  languages: languages$Q,
  capabilities: capabilities$Q,
  dependencies: dependencies$C,
  options: options$Q,
  runtime: runtime$Q,
  ui: ui$Q,
  package_defaults: package_defaults$K,
  packages: packages$R,
  sources: sources$Q
};
const schema_version$B = 1;
const family$P = "nemotron_asr";
const display_name$P = "Nemotron 3.5 ASR";
const description$P = "NVIDIA 600M streaming ASR model for low-latency and batch transcription across 40 language-locales, with native punctuation, capitalization, automatic language detection, and configurable chunk sizes.";
const category$P = "asr";
const status$P = "supported";
const tasks$P = ["asr"];
const modes$P = ["offline", "streaming"];
const languages$P = ["ar-AR", "bg-BG", "cs-CZ", "da-DK", "de-DE", "el-GR", "en-GB", "en-US", "es-ES", "es-US", "et-EE", "fi-FI", "fr-CA", "fr-FR", "he-IL", "hi-IN", "hr-HR", "hu-HU", "it-IT", "ja-JP", "ko-KR", "lt-LT", "lv-LV", "mt-MT", "nb-NO", "nl-NL", "nn-NO", "pl-PL", "pt-BR", "pt-PT", "ro-RO", "ru-RU", "sk-SK", "sl-SI", "sv-SE", "th-TH", "tr-TR", "uk-UA", "vi-VN", "zh-CN"];
const capabilities$P = {};
const dependencies$B = [];
const options$P = { "request": [{ "name": "context_score", "type": "float", "description": "Logit bonus for terminology supplied in request text. Commas or newlines separate phrases; whitespace separates legacy word lists. Preserves acoustic blank decisions. Zero disables context biasing.", "required": false, "default": 2, "min": 0, "max": 10 }, { "name": "language", "type": "string", "description": "ASR prompt language such as en-US, da-DK, or auto; default is the model's default prompt.", "required": false }, { "name": "lookahead_tokens", "type": "int", "description": "Chunk-limited encoder right context in 80 ms frames; supported values and the default come from processor_config (0, 3, 6 or 13; default 3 for the published model). In masked speaker mode, omission derives lookahead from diarizer geometry (13 fallback).", "required": false, "min": 0 }, { "name": "max_tokens", "type": "int", "description": "Maximum RNNT generated tokens; 0 or omitted uses the model-derived limit.", "required": false, "min": 0, "default": 0 }, { "name": "keep_language_tags", "type": "bool", "description": "Keep language tag tokens in decoded text; default false.", "required": false, "default": false }, { "name": "return_timestamps", "type": "bool", "description": "Compatibility/advisory flag; false does not suppress decoder token timestamps.", "required": false, "default": false }, { "name": "streaming", "type": "bool", "description": "Request a streaming run; must be false for offline sessions.", "required": false, "default": false }, { "name": "speaker_probabilities", "type": "path", "description": "nemotron_3_diar speaker_probabilities.safetensors for the same audio (diarize with return_frame_probabilities=true). Setting it enables speaker-tagged output: speaker turns with text and a SegLST artifact.", "required": false }, { "name": "speaker_mode", "type": "enum", "values": ["masked", "attribution"], "description": "masked runs one ASR stream per active speaker on speaker-masked features (NeMo masked multitalker ASR) and transcribes overlapping speech; attribution assigns each word of one transcript to the most active speaker and is cheaper.", "required": false, "default": "masked" }, { "name": "speaker_mask", "type": "enum", "values": ["mel", "audio"], "description": "Masked mode only: mask log-mel features (NeMo mask_features) or zero the waveform of inactive 80 ms frames.", "required": false, "default": "mel" }, { "name": "speaker_segment_gap_sec", "type": "float", "description": "Start a new segment for a speaker after a pause longer than this; default 1.0 (NeMo sent_break_sec).", "required": false, "min": 0, "default": 1 }, { "name": "speaker_segment_max_sec", "type": "float", "description": "Streaming only: force-close a speaker-turn event after this many seconds; the final result keeps the full segments. Default 10. Must be positive.", "required": false, "default": 10 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "matmul_weight_type", "type": "enum", "description": "Encoder and decoder matmul weight storage type (native, f32, f16, bf16 or q8_0); defaults to weight_type.", "preset": "weight_type_full", "required": false }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage type (native, f32 or f16); default native.", "preset": "weight_type_conv", "required": false, "default": "native" }, { "name": "weight_context_mb", "type": "int", "description": "Weight context arena size in MiB; default 3072.", "required": false, "min": 1, "default": 3072 }, { "name": "encoder_graph_arena_mb", "type": "int", "description": "Encoder graph arena size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "decoder_graph_arena_mb", "type": "int", "description": "Decoder graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "mem_saver", "type": "bool", "description": "Release the offline encoder graph after each offline request; default false.", "required": false, "default": false }], "load": [] };
const runtime$P = { "tags": ["gguf", "stream"] };
const ui$P = { "recommended_package": "nemotron_asr_q8_0", "tags": ["ASR", "GGUF", "Stream"], "docs": ["docs/asr.md", "docs/gguf.md"] };
const package_defaults$J = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$Q = [{ "id": "nemotron_asr_q8_0", "display_name": "Nemotron 3.5 ASR Streaming 0.6B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Nemotron-3.5-ASR-Streaming-0.6B-GGUF", "files": ["Nemotron-3.5-ASR-Streaming-0.6B-GGUF/nemotron-3.5-asr-streaming-0.6b-q8_0.gguf"], "strip_prefix": "Nemotron-3.5-ASR-Streaming-0.6B-GGUF" }, { "id": "nemotron_asr_f16", "display_name": "Nemotron 3.5 ASR Streaming 0.6B F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Nemotron-3.5-ASR-Streaming-0.6B-GGUF", "files": ["Nemotron-3.5-ASR-Streaming-0.6B-GGUF/nemotron-3.5-asr-streaming-0.6b-f16.gguf"], "strip_prefix": "Nemotron-3.5-ASR-Streaming-0.6B-GGUF" }, { "id": "nemotron_asr_safetensors", "display_name": "Nemotron 3.5 ASR Streaming 0.6B Safetensors", "format": "safetensors", "precision": "native", "target_directory": "nemotron-3.5-asr-streaming-0.6b", "files": ["config.json", "model.safetensors", "processor_config.json", "tokenizer.json"], "download": { "kind": "huggingface_snapshot", "repo": "nvidia/nemotron-3.5-asr-streaming-0.6b" } }];
const sources$P = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "processor_config": "model:processor_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "processor_config": "model:processor_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_82 = {
  schema_version: schema_version$B,
  family: family$P,
  display_name: display_name$P,
  description: description$P,
  category: category$P,
  status: status$P,
  tasks: tasks$P,
  modes: modes$P,
  languages: languages$P,
  capabilities: capabilities$P,
  dependencies: dependencies$B,
  options: options$P,
  runtime: runtime$P,
  ui: ui$P,
  package_defaults: package_defaults$J,
  packages: packages$Q,
  sources: sources$P
};
const schema_version$A = 1;
const family$O = "nemotron_transcribe";
const display_name$O = "NVIDIA Nemotron 3.5 Transcribe 30B-A4B";
const description$O = "Experimental community port of the Nemotron-H speech language model for offline transcription, translation, audio questions, language identification, word timestamps and speaker labels.";
const category$O = "asr";
const status$O = "experimental";
const tasks$O = ["asr"];
const modes$O = ["offline"];
const languages$O = ["auto"];
const capabilities$O = { "asr": ["word_timestamps"] };
const runtime$O = { "tags": ["gguf"] };
const options$O = { "request": [{ "name": "instruct", "type": "string", "required": false, "description": "Audio instruction or question. Replaces the template instruction; defaults to text_input when present. Chat controls and audio locators are rejected." }, { "name": "template_name", "type": "enum", "values": ["default", "translation", "audio_qa", "language_id"], "default": "default", "required": false, "description": "Instruction template. Audio Q&A requires instruct or text_input. Timestamps and speakers require the default transcription template." }, { "name": "language", "type": "string", "default": "auto", "required": false, "description": "Source language hint for the default transcription prompt. An explicit instruct replaces this prompt, including its language hint." }, { "name": "target_language", "type": "string", "default": "English", "required": false, "description": "Target language for the translation template." }, { "name": "system_prompt", "type": "string", "required": false, "description": "Optional system message; the trained default is empty." }, { "name": "return_timestamps", "type": "bool", "default": false, "required": false, "description": "Run the checkpoint CTC head for source-language word timestamps. Failed streams return no fabricated word rows." }, { "name": "diarization", "type": "bool", "default": false, "required": false, "description": "Request speaker-tagged transcription, CTC words and speaker activity turns. An explicit instruct must request speaker tags itself." }, { "name": "max_tokens", "type": "int", "min": 1, "required": false, "description": "Maximum generated response tokens. Defaults to generation_config or native duration budget max(24,ceil(6*audio_seconds)+24). Prompt and output must fit max_context." }, { "name": "do_sample", "type": "bool", "default": false, "required": false, "description": "Sample tokens instead of greedy decoding." }, { "name": "temperature", "type": "float", "default": 1, "required": false, "description": "Positive sampling temperature when do_sample is true." }, { "name": "top_k", "type": "int", "min": 0, "default": 0, "required": false, "description": "Sampling candidate count; zero disables top-k filtering." }, { "name": "top_p", "type": "float", "min": 0, "max": 1, "default": 1, "required": false, "description": "Nucleus probability when sampling." }, { "name": "repetition_penalty", "type": "float", "default": 1, "required": false, "description": "Positive token repetition penalty." }, { "name": "seed", "type": "int", "min": 0, "default": 0, "required": false, "description": "Sampling seed." }], "session": [{ "name": "disk_experts", "type": "bool", "default": false, "required": false, "description": "Keep routed expert weights in the GGUF/host memory and stage selected experts through a bounded backend cache. Dense weights and all expert computation remain on the selected backend." }, { "name": "pin_experts", "type": "bool", "default": false, "required": false, "description": "With disk_experts, retain complete native expert banks in pinned host RAM for direct uploads. Requires pinned host-buffer support." }, { "name": "expert_cache_size", "type": "int", "min": 1, "default": 8, "required": false, "description": "Resident expert slots per routed layer with disk_experts. Must cover the model's experts per token and cannot exceed its expert count." }, { "name": "disk_expert_read_threads", "type": "int", "min": 1, "max": 64, "default": 4, "required": false, "description": "Host workers for staging GGUF expert ranges when disk_experts is true and pin_experts is false. Parallel reads require OpenMP or Apple dispatch." }, { "name": "weight_type", "type": "enum", "preset": "weight_type_full", "default": "native", "required": false, "description": "Native preserves mixed packaged tensor types. Changing this may greatly increase model memory." }, { "name": "max_context", "type": "int", "min": 1, "default": 73728, "required": false, "description": "Combined text, audio and output context, bounded by backbone positions. Matches native SALM serving default." }, { "name": "prefill_batch_size", "type": "int", "min": 1, "max": 2048, "default": 64, "required": false, "description": "Text/audio rows per decoder prefill graph." }, { "name": "flash_attention", "type": "bool", "default": true, "required": false, "description": "Use flash attention in the speech and speaker encoders." }, { "name": "encoder_window_size", "type": "int", "min": 1, "max": 5e3, "default": 500, "required": false, "description": "Core encoder window in 80 ms output frames; the native default is 40 seconds." }, { "name": "encoder_left_context", "type": "int", "min": 0, "max": 5e3, "default": 50, "required": false, "description": "Encoder window left context in 80 ms frames." }, { "name": "encoder_right_context", "type": "int", "min": 0, "max": 5e3, "default": 50, "required": false, "description": "Encoder window right context in 80 ms frames." }, { "name": "speaker_cache_size", "type": "int", "min": 16, "max": 5e3, "default": 188, "required": false, "description": "Native serving speaker cache in 80 ms frames, distinct from training configuration. At least two rows per speaker are required." }, { "name": "speaker_fifo_size", "type": "int", "min": 0, "max": 5e3, "default": 40, "required": false, "description": "Recent speaker FIFO size in 80 ms frames." }, { "name": "speaker_update_period", "type": "int", "min": 1, "max": 5e3, "default": 300, "required": false, "description": "Native serving speaker-cache update period in 80 ms frames." }], "load": [] };
const package_defaults$I = { "download": { "kind": "huggingface_snapshot", "repo": "Jmica/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-GGUF", "revision": "304032f14e1e9e4042f5491d2d0194c044710bb7", "gated": false } };
const packages$P = [{ "id": "nemotron_transcribe_iq4_nl", "display_name": "Nemotron 3.5 Transcribe 30B-A4B IQ4_NL experts", "default": true, "format": "gguf", "precision": "iq4_nl", "target_directory": "NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-GGUF", "files": ["nemotron-transcribe-30b-a4b-experts-IQ4_NL.gguf", "mmproj-NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-Encoder-F16.gguf"] }, { "id": "nemotron_transcribe_q4_k", "display_name": "Nemotron 3.5 Transcribe 30B-A4B Q4_K experts", "format": "gguf", "precision": "q4_k", "target_directory": "NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-GGUF", "files": ["nemotron-transcribe-30b-a4b-experts-Q4_K_S.gguf", "mmproj-NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-Encoder-F16.gguf"] }, { "id": "nemotron_transcribe_q3_k", "display_name": "Nemotron 3.5 Transcribe 30B-A4B Q3_K experts", "format": "gguf", "precision": "q3_k", "target_directory": "NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-GGUF", "files": ["nemotron-transcribe-30b-a4b-experts-Q3_K_S.gguf", "mmproj-NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-Encoder-F16.gguf"] }, { "id": "nemotron_transcribe_q2_k", "display_name": "Nemotron 3.5 Transcribe 30B-A4B Q2_K experts", "format": "gguf", "precision": "q2_k", "target_directory": "NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-GGUF", "files": ["nemotron-transcribe-30b-a4b-experts-Q2_K.gguf", "mmproj-NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-Encoder-F16.gguf"] }];
const dependencies$A = [];
const ui$O = { "recommended_package": "nemotron_transcribe_iq4_nl", "tags": ["GGUF"], "docs": ["docs/models/nemotron_transcribe.md"] };
const sources$O = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "backbone_config": "model:llm_backbone/config.json", "generation_config": "model:generation_config.json", "processor_config": "model:processor_config.json", "frontend_window": "model:frontend_window.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json" }, "tensors": { "weights": { "source": "weights:" } } }];
const __vite_glob_0_83 = {
  schema_version: schema_version$A,
  family: family$O,
  display_name: display_name$O,
  description: description$O,
  category: category$O,
  status: status$O,
  tasks: tasks$O,
  modes: modes$O,
  languages: languages$O,
  capabilities: capabilities$O,
  runtime: runtime$O,
  options: options$O,
  package_defaults: package_defaults$I,
  packages: packages$P,
  dependencies: dependencies$A,
  ui: ui$O,
  sources: sources$O
};
const schema_version$z = 1;
const family$N = "neutts";
const display_name$N = "NeuTTS";
const description$N = "NeuTTS is an English text-to-speech family from Neuphonic. The current 2E package uses a Qwen3-style autoregressive speech-token backbone, NeuCodec waveform decoding, built-in speaker prompts, and emotion-token control.";
const category$N = "tts";
const status$N = "supported";
const tasks$N = ["tts"];
const modes$N = ["offline", "streaming"];
const languages$N = ["en"];
const runtime$N = { "tags": ["gguf", "stream"] };
const capabilities$N = { "tts": ["built_in_voices", "emotion_control", "long_form"] };
const options$N = { "request": [{ "name": "voice_id", "type": "enum", "description": "Built-in NeuTTS speaker prompt; default emily.", "values": ["dave", "emily", "greta", "jo", "juliette", "mateo", "paul", "sophie", "steven"], "required": false, "default": "emily" }, { "name": "emotion", "type": "enum", "description": "Optional emotion token inserted between reference text and target text; neutral inserts no emotion token.", "values": ["angry", "disgusted", "sad", "happy", "fearful", "neutral", "surprised"], "required": false, "default": "neutral" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated speech-token count for the autoregressive generator; 0 uses the remaining model context, default 0. Total generation context is capped at min(checkpoint context, 2048).", "required": false, "min": 0, "default": 0 }, { "name": "min_tokens", "type": "int", "description": "Minimum generated speech-token count before EOS may stop generation; default 50.", "required": false, "min": 0, "default": 50 }, { "name": "temperature", "type": "float", "description": "Autoregressive sampling temperature; must be > 0, default 1.0.", "required": false, "min": 0, "default": 1 }, { "name": "top_k", "type": "int", "description": "Autoregressive top-k sampling limit; default 50.", "required": false, "min": 1, "default": 50 }, { "name": "seed", "type": "int", "description": "Autoregressive sampling seed; omitted requests choose a random seed.", "required": false, "min": 0 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode for long-form synthesis.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 600.", "required": false, "min": 1, "default": 600 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared matmul weight storage type for the backbone and codec decoder; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "generator_weight_type", "type": "enum", "description": "Generator weight storage; inherits explicit weight_type, otherwise F32 on CPU and native on other backends.", "preset": "weight_type_full", "required": false }, { "name": "codec_weight_type", "type": "enum", "description": "NeuCodec decoder matmul weight storage type; defaults to weight_type when set, otherwise native.", "preset": "weight_type_full", "required": false }, { "name": "codec_conv_weight_type", "type": "enum", "description": "NeuCodec convolution weight storage type; default native.", "preset": "weight_type_conv", "required": false, "default": "native" }, { "name": "runtime_graph_arena_mb", "type": "int", "description": "Reusable ggml graph arena size in MiB for NeuTTS runtime graphs; default 1024.", "required": false, "min": 1, "default": 1024 }], "load": [] };
const package_defaults$H = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$O = [{ "id": "neutts_2e_orig", "display_name": "NeuTTS 2E Original-Precision GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "NeuTTS-2E-GGUF", "files": ["NeuTTS-2E-GGUF/neutts-2e-orig.gguf"], "strip_prefix": "NeuTTS-2E-GGUF" }];
const dependencies$z = [];
const ui$N = { "recommended_package": "neutts_2e_orig", "tags": ["TTS", "GGUF", "Stream"], "docs": ["docs/tts.md", "docs/models/neutts.md", "docs/gguf.md"] };
const sources$N = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "chat_template": "model:chat_template.jinja", "codec_config": "model:neucodec_config.json", "codec_preprocessor_config": "model:neucodec_preprocessor_config.json", "speaker_text_dave": "model:samples/dave.txt", "speaker_text_emily": "model:samples/emily.txt", "speaker_text_greta": "model:samples/greta.txt", "speaker_text_jo": "model:samples/jo.txt", "speaker_text_juliette": "model:samples/juliette.txt", "speaker_text_mateo": "model:samples/mateo.txt", "speaker_text_paul": "model:samples/paul.txt", "speaker_text_sophie": "model:samples/sophie.txt", "speaker_text_steven": "model:samples/steven.txt" }, "tensors": { "backbone": { "source": "weights:", "prefix": "backbone" }, "codec": { "source": "weights:", "prefix": "codec" }, "speaker_prompts": { "source": "weights:", "prefix": "speaker_prompts" } } }, { "format": "safetensors", "roots": { "model": ".", "codec": "../NeuCodec" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "chat_template": "model:chat_template.jinja", "codec_config": "codec:config.json", "codec_preprocessor_config": "codec:preprocessor_config.json", "speaker_text_dave": "model:samples/dave.txt", "speaker_text_emily": "model:samples/emily.txt", "speaker_text_greta": "model:samples/greta.txt", "speaker_text_jo": "model:samples/jo.txt", "speaker_text_juliette": "model:samples/juliette.txt", "speaker_text_mateo": "model:samples/mateo.txt", "speaker_text_paul": "model:samples/paul.txt", "speaker_text_sophie": "model:samples/sophie.txt", "speaker_text_steven": "model:samples/steven.txt" }, "tensors": { "backbone": "model:model.safetensors", "codec": "codec:model.safetensors", "speaker_prompts": "model:samples/speaker_prompts.safetensors" } }];
const __vite_glob_0_84 = {
  schema_version: schema_version$z,
  family: family$N,
  display_name: display_name$N,
  description: description$N,
  category: category$N,
  status: status$N,
  tasks: tasks$N,
  modes: modes$N,
  languages: languages$N,
  runtime: runtime$N,
  capabilities: capabilities$N,
  options: options$N,
  package_defaults: package_defaults$H,
  packages: packages$O,
  dependencies: dependencies$z,
  ui: ui$N,
  sources: sources$N
};
const family$M = "niagara_asr";
const schema_version$y = 1;
const display_name$M = "Niagara ASR";
const description$M = "ABR Niagara English batch ASR state-space models with attention, greedy CTC decoding, and SentencePiece tokenization.";
const category$M = "asr";
const status$M = "supported";
const tasks$M = ["asr"];
const modes$M = ["offline"];
const languages$M = ["en"];
const capabilities$M = {};
const dependencies$y = [];
const options$M = { "request": [{ "name": "language", "type": "string", "description": "Compatibility-only; recognition is English and output is always labelled en.", "required": false, "default": "en" }, { "name": "audio_chunk_mode", "type": "enum", "description": "Audio chunking mode.", "values": ["none"], "required": false, "default": "none" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Matmul weight storage type.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"] }, { "name": "graph_arena_mb", "type": "int", "description": "Inference graph arena size in MiB.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_context_mb", "type": "int", "description": "Weight descriptor context size in MiB.", "required": false, "min": 1, "default": 256 }], "load": [] };
const runtime$M = { "tags": ["gguf", "cpu"] };
const ui$M = { "recommended_package": "niagara_19m_f32", "tags": ["ASR", "GGUF"], "docs": ["docs/asr.md", "docs/gguf.md"], "summary": "ABR Niagara compact English speech recognition." };
const package_defaults$G = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf" } };
const packages$N = [{ "id": "niagara_19m_f32", "display_name": "Niagara 19M Batch English F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Niagara-ASR-GGUF", "files": ["Niagara-ASR-GGUF/niagara-19m-batch.en-f32.gguf"], "strip_prefix": "Niagara-ASR-GGUF" }, { "id": "niagara_38m_f32", "display_name": "Niagara 38M Batch English F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "Niagara-ASR-GGUF", "files": ["Niagara-ASR-GGUF/niagara-38m-batch.en-f32.gguf"], "strip_prefix": "Niagara-ASR-GGUF" }];
const sources$M = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "preprocessor_config": "model:preprocessor_config.json", "tokenizer_spm": "model:sentencepiece.model" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_85 = {
  family: family$M,
  schema_version: schema_version$y,
  display_name: display_name$M,
  description: description$M,
  category: category$M,
  status: status$M,
  tasks: tasks$M,
  modes: modes$M,
  languages: languages$M,
  capabilities: capabilities$M,
  dependencies: dependencies$y,
  options: options$M,
  runtime: runtime$M,
  ui: ui$M,
  package_defaults: package_defaults$G,
  packages: packages$N,
  sources: sources$M
};
const family$L = "omnivoice";
const display_name$L = "OmniVoice";
const description$L = "Massively multilingual zero-shot TTS model from k2-fsa for 600+ languages, supporting short-reference voice cloning, attribute-based voice design, pronunciation controls, and nonverbal tags.";
const category$L = "tts";
const status$L = "supported";
const tasks$L = ["tts", "clone", "design"];
const modes$L = ["offline", "streaming"];
const languages$L = ["600+ languages"];
const capabilities$L = { "clone": ["speaker_reference"], "design": ["voice_design"] };
const options$L = { "request": [{ "name": "language", "type": "string", "description": "Synthesis language code or label; omitted uses automatic language selection.", "required": false }, { "name": "reference_text", "type": "string", "description": "Transcript for speaker reference audio used in voice cloning.", "required": false }, { "name": "instruct", "type": "string", "description": "Voice-design instruction such as speaker attributes, accent, style, or delivery.", "required": false }, { "name": "seed", "type": "int", "description": "Generation seed for reproducible output; omitted value keeps the session RNG state.", "required": false, "min": 0, "max": 4294967295 }, { "name": "num_inference_steps", "type": "int", "description": "Diffusion language-model inference steps; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale; default 2.0.", "required": false, "default": 2 }, { "name": "speed", "type": "float", "description": "Speech speed multiplier used for target-length estimation; default 1.0.", "required": false, "default": 1 }, { "name": "duration_sec", "type": "float", "description": "Target output duration in seconds; omitted uses the model's estimated duration.", "required": false, "min": 0 }, { "name": "shift", "type": "float", "description": "Diffusion timestep schedule shift; default 0.1.", "required": false, "default": 0.1 }, { "name": "denoise", "type": "bool", "description": "Add the denoise control token when reference audio is present; default true.", "required": false, "default": true }, { "name": "preprocess_prompt", "type": "bool", "description": "Preprocess speaker reference audio before tokenization; default true.", "required": false, "default": true }, { "name": "postprocess_output", "type": "bool", "description": "Apply output postprocessing and trimming; default true.", "required": false, "default": true }, { "name": "layer_penalty_factor", "type": "float", "description": "Layer-order penalty used while selecting masked audio-codebook positions; default 5.0.", "required": false, "default": 5 }, { "name": "position_temperature", "type": "float", "description": "Gumbel temperature for masked-position selection; default 5.0.", "required": false, "default": 5 }, { "name": "class_temperature", "type": "float", "description": "Audio-token class sampling temperature; default 0 for greedy class selection.", "required": false, "min": 0, "default": 0 }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Target chunk duration for automatic long-form splitting; default 15 seconds.", "required": false, "min": 0, "default": 15 }, { "name": "audio_chunk_threshold_sec", "type": "float", "description": "Estimated duration above which long-form generation is split into chunks; default 30 seconds.", "required": false, "min": 0, "default": 30 }, { "name": "text_chunk_size", "type": "int", "description": "Explicit long-form text chunk size in Unicode codepoints. Omitted value uses duration-based automatic chunking.", "required": false, "min": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Text chunking mode; default tag_aware.", "preset": "text_chunk_mode_full", "required": false, "default": "tag_aware" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared generator weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "generator_weight_type", "type": "enum", "description": "Generator weight storage type; defaults to weight_type, which defaults to native.", "preset": "weight_type_full", "required": false }, { "name": "audio_tokenizer_weight_type", "type": "enum", "description": "Audio tokenizer weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "audio_tokenizer_codebook_weight_type", "type": "enum", "description": "Storage type for the audio tokenizer codebooks, codebook score matrix, semantic feature projection, and fc2; default f32.", "values": ["native", "f32", "f16", "bf16"], "required": false, "default": "f32" }, { "name": "audio_tokenizer_graph_arena_mb", "type": "int", "description": "Audio tokenizer graph arena size in MiB; default 128.", "required": false, "min": 1, "default": 128 }, { "name": "generator_prefill_graph_arena_mb", "type": "int", "description": "Generator prefill graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "generator_decode_graph_arena_mb", "type": "int", "description": "Generator decode graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "audio_tokenizer_weight_context_mb", "type": "int", "description": "Audio tokenizer weight context size in MiB; default 128.", "required": false, "min": 1, "default": 128 }, { "name": "generator_weight_context_mb", "type": "int", "description": "Generator weight context size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime graphs after request phases; default false. Cannot be combined with perf_mode=flash_attention.", "required": false, "default": false }, { "name": "perf_mode", "type": "enum", "description": "Generator performance mode; default off keeps the exact-safe attention path. flash_attention requires mem_saver=false.", "preset": "perf_mode_flash_attention", "required": false, "default": "off" }], "load": [] };
const runtime$L = { "tags": ["gguf", "stream"] };
const ui$L = { "recommended_package": "omnivoice_q8_0", "tags": ["TTS", "Clone", "Design", "GGUF", "Stream"], "docs": ["docs/models/omnivoice.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$F = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$M = [{ "id": "omnivoice_q8_0", "display_name": "OmniVoice Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "OmniVoice-GGUF", "files": ["OmniVoice-GGUF/omnivoice-q8_0.gguf"], "strip_prefix": "OmniVoice-GGUF" }, { "id": "omnivoice_bf16", "display_name": "OmniVoice BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "OmniVoice-GGUF", "files": ["OmniVoice-GGUF/omnivoice-bf16.gguf"], "strip_prefix": "OmniVoice-GGUF" }, { "id": "omnivoice_f16", "display_name": "OmniVoice F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "OmniVoice-GGUF", "files": ["OmniVoice-GGUF/omnivoice-f16.gguf"], "strip_prefix": "OmniVoice-GGUF" }, { "id": "omnivoice_safetensors", "display_name": "OmniVoice Safetensors", "format": "safetensors", "precision": "native", "target_directory": "OmniVoice", "files": ["config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json", "audio_tokenizer/config.json", "audio_tokenizer/preprocessor_config.json", "audio_tokenizer/model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "k2-fsa/OmniVoice" } }, { "id": "voicetut_tts_q8_0", "display_name": "VoiceTut-TTS Egyptian Arabic Q8_0 GGUF", "description": "Egyptian Arabic and Arabic-English code-switching fine-tune of OmniVoice from mohammedaly22/VoiceTut-TTS (same architecture and audio tokenizer as OmniVoice). Use language=arz.", "format": "gguf", "precision": "q8_0", "target_directory": "VoiceTut-TTS-GGUF", "files": ["voicetut-tts-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "mohammedaly22/VoiceTut-TTS-GGUF" } }, { "id": "voicetut_tts_f16", "display_name": "VoiceTut-TTS Egyptian Arabic F16 GGUF", "description": "Egyptian Arabic and Arabic-English code-switching fine-tune of OmniVoice from mohammedaly22/VoiceTut-TTS (same architecture and audio tokenizer as OmniVoice). Use language=arz.", "format": "gguf", "precision": "f16", "target_directory": "VoiceTut-TTS-GGUF", "files": ["voicetut-tts-f16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "mohammedaly22/VoiceTut-TTS-GGUF" } }];
const sources$L = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "audio_tokenizer_config": "model:audio_tokenizer/config.json", "audio_tokenizer_preprocessor": "model:audio_tokenizer/preprocessor_config.json" }, "optional_files": { "chat_template": "model:chat_template.jinja" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" }, "audio_tokenizer_weights": { "source": "weights:", "prefix": "audio_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "audio_tokenizer_config": "model:audio_tokenizer/config.json", "audio_tokenizer_preprocessor": "model:audio_tokenizer/preprocessor_config.json" }, "optional_files": { "chat_template": "model:chat_template.jinja" }, "tensors": { "weights": "model:model.safetensors", "audio_tokenizer_weights": "model:audio_tokenizer/model.safetensors" } }];
const __vite_glob_0_86 = {
  family: family$L,
  display_name: display_name$L,
  description: description$L,
  category: category$L,
  status: status$L,
  tasks: tasks$L,
  modes: modes$L,
  languages: languages$L,
  capabilities: capabilities$L,
  options: options$L,
  runtime: runtime$L,
  ui: ui$L,
  package_defaults: package_defaults$F,
  packages: packages$M,
  sources: sources$L
};
const schema_version$x = 1;
const family$K = "open_wake_word";
const display_name$K = "OpenWakeWord";
const description$K = "OpenWakeWord wake-word detection with a shared speech embedding CNN and a converted classifier.";
const category$K = "audio_tools";
const status$K = "experimental";
const tasks$K = ["wake_word"];
const modes$K = ["offline", "streaming"];
const languages$K = ["en"];
const capabilities$K = { "wake_word": ["speech_segments", "stream_events"] };
const runtime$K = { "tags": ["gguf", "stream"] };
const options$K = { "request": [{ "name": "threshold", "type": "float", "required": false, "min": 0, "max": 1, "description": "Wake-word detection probability threshold." }], "session": [{ "name": "exec_plan", "type": "string", "required": false, "default": "{}", "description": "JSON component execution plans. Component embedding accepts impl default/ggml/neon and optional backend. Default retains GGML on the session backend; neon requires ENGINE_ENABLE_NEON=ON and an AArch64 NEON CPU session. No artifacts or params are used." }], "load": [] };
const package_defaults$E = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$L = [{ "id": "open_wake_word_alexa_f32", "display_name": "OpenWakeWord Alexa GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "OpenWakeWord-GGUF", "files": ["OpenWakeWord-GGUF/open-wake-word-alexa-f32.gguf"], "strip_prefix": "OpenWakeWord-GGUF" }];
const dependencies$x = [];
const ui$K = { "tags": ["Wake Word", "GGUF", "Stream"], "docs": ["docs/models/open_wake_word.md"], "recommended_package": "open_wake_word_alexa_f32" };
const sources$K = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_87 = {
  schema_version: schema_version$x,
  family: family$K,
  display_name: display_name$K,
  description: description$K,
  category: category$K,
  status: status$K,
  tasks: tasks$K,
  modes: modes$K,
  languages: languages$K,
  capabilities: capabilities$K,
  runtime: runtime$K,
  options: options$K,
  package_defaults: package_defaults$E,
  packages: packages$L,
  dependencies: dependencies$x,
  ui: ui$K,
  sources: sources$K
};
const schema_version$w = 1;
const family$J = "outetts";
const display_name$J = "Llama-OuteTTS 1.0";
const description$J = "Llama-based open-weight TTS model for 23-language speech synthesis with one-shot voice cloning from short reference audio and automatic word-alignment support.";
const category$J = "tts";
const status$J = "community";
const tasks$J = ["tts", "clone"];
const modes$J = ["offline"];
const languages$J = ["ar", "be", "bn", "de", "en", "es", "fa", "fr", "hu", "it", "ja", "ka", "ko", "lt", "lv", "nl", "pl", "pt", "ru", "sw", "ta", "uk", "zh"];
const capabilities$J = { "clone": ["speaker_reference"] };
const options$J = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum generated audio tokens per chunk. When omitted, OuteTTS estimates a safe value from each chunk.", "required": false, "min": 1 }, { "name": "temperature", "type": "float", "description": "Sampling temperature; default 0.4 for cloning, otherwise model config default.", "required": false, "min": 0 }, { "name": "top_k", "type": "int", "description": "Top-k sampling; default 40 for cloning, otherwise model config default.", "required": false, "min": 0 }, { "name": "top_p", "type": "float", "description": "Nucleus sampling in (0, 1]; default 0.9 for cloning, otherwise model config default.", "required": false, "min": 0, "max": 1 }, { "name": "min_p", "type": "float", "description": "Minimum probability relative to the best token; default 0.05 for cloning, otherwise model config default.", "required": false, "min": 0, "max": 1 }, { "name": "repetition_penalty", "type": "float", "description": "Windowed repetition penalty; must be > 0, default 1.1.", "required": false, "min": 0, "default": 1.1 }, { "name": "repetition_window", "type": "int", "description": "Recent-token penalty window; default 64.", "required": false, "min": 0, "default": 64 }, { "name": "seed", "type": "int", "description": "Sampling seed; cloning defaults to 4099 for native weights and 42 for quantized weights.", "required": false, "min": 0, "max": 4294967295 }, { "name": "reference_text", "type": "string", "description": "Transcript matching the reference voice audio for voice cloning.", "required": false }, { "name": "reference_language", "type": "string", "description": "Language code used to align the reference transcript; omitted inherits the request text language, then falls back to en.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum UTF-8 codepoints per long-form text chunk; default 256. Chunks are split further when required by max_tokens or context budget.", "required": false, "min": 1, "default": 256 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework long-form text chunking mode; default word_budget.", "preset": "text_chunk_mode_full", "required": false, "default": "word_budget" }], "session": [{ "name": "lora", "type": "path", "description": "PEFT LoRA adapter directory or checkpoint file for the same OuteTTS checkpoint; merged into the language model at session creation.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's alpha/r scaling; default 1.", "required": false, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "Language-model weight storage type. Quantized CUDA voice cloning is expanded to F32 in memory for generation correctness.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "nvfp4"] }, { "name": "llama_weight_context_mb", "type": "int", "description": "Language-model weight context size in MiB; default 4096.", "required": false, "min": 1, "default": 4096 }, { "name": "constant_context_mb", "type": "int", "description": "Language-model constant tensor context size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "dac_weight_context_mb", "type": "int", "description": "DAC decoder weight context size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "dac_graph_arena_mb", "type": "int", "description": "DAC decoder graph arena size in MiB; default 1536.", "required": false, "min": 1, "default": 1536 }, { "name": "forced_aligner_path", "type": "path", "description": "Optional Qwen3 Forced Aligner override. Cloning automatically uses the aligner embedded in a standalone OuteTTS GGUF when present.", "required": false }, { "name": "reference_cache_slots", "type": "int", "description": "Prepared reference-profile cache slots; default 1, set 0 to disable.", "required": false, "min": 0, "default": 1 }, { "name": "mem_saver", "type": "bool", "description": "Release cached-step and aligner runtime state after use; default false.", "required": false, "default": false }], "load": [] };
const runtime$J = { "tags": ["gguf"] };
const sources$J = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "special_tokens_map": "model:special_tokens_map.json", "dac_config": "model:dac/config.json" }, "optional_files": { "aligner_config": "model:aligner/config.json", "aligner_generation_config": "model:aligner/generation_config.json", "aligner_tokenizer_config": "model:aligner/tokenizer_config.json", "aligner_preprocessor_config": "model:aligner/preprocessor_config.json", "aligner_processor_config": "model:aligner/processor_config.json", "aligner_chat_template": "model:aligner/chat_template.json", "aligner_chat_template_jinja": "model:aligner/chat_template.jinja", "aligner_vocab": "model:aligner/vocab.json", "aligner_merges": "model:aligner/merges.txt", "aligner_tokenizer_json": "model:aligner/tokenizer.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "dac_weights": { "source": "weights:", "prefix": "dac_weights" }, "aligner_weights": { "source": "weights:", "prefix": "aligner_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "dac": "../DAC.speech.v1.0" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json", "special_tokens_map": "model:special_tokens_map.json", "dac_config": "dac:config.json" }, "tensors": { "model_weights": "model:model.safetensors", "dac_weights": "dac:model.safetensors" } }];
const packages$K = [{ "id": "outetts_1_0_1b_q8_0", "display_name": "Llama-OuteTTS 1.0 1B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Llama-OuteTTS-1.0-1B_Q8", "files": ["Text to audio (TTS)/Llama-OuteTTS-1.0-1B_Q8.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "mirek190/audio.cpp" } }];
const dependencies$w = [];
const ui$J = { "recommended_package": "outetts_1_0_1b_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/outetts.md", "docs/reports/outetts_validation.md", "docs/gguf.md"] };
const __vite_glob_0_88 = {
  schema_version: schema_version$w,
  family: family$J,
  display_name: display_name$J,
  description: description$J,
  category: category$J,
  status: status$J,
  tasks: tasks$J,
  modes: modes$J,
  languages: languages$J,
  capabilities: capabilities$J,
  options: options$J,
  runtime: runtime$J,
  sources: sources$J,
  packages: packages$K,
  dependencies: dependencies$w,
  ui: ui$J
};
const family$I = "owsm";
const schema_version$v = 1;
const display_name$I = "OWSM";
const description$I = "ESPnet Open Whisper-style multilingual speech recognition and speech translation.";
const category$I = "asr";
const status$I = "supported";
const tasks$I = ["asr"];
const modes$I = ["offline", "streaming"];
const languages$I = ["abk", "afr", "amh", "ara", "asm", "ast", "aze", "bak", "bas", "bel", "ben", "bos", "bre", "bul", "cat", "ceb", "ces", "chv", "ckb", "cmn", "cnh", "cym", "dan", "deu", "dgd", "div", "ell", "eng", "epo", "est", "eus", "fas", "fil", "fin", "fra", "frr", "ful", "gle", "glg", "grn", "guj", "hat", "hau", "heb", "hin", "hrv", "hsb", "hun", "hye", "ibo", "ina", "ind", "isl", "ita", "jav", "jpn", "kab", "kam", "kan", "kat", "kaz", "kea", "khm", "kin", "kir", "kmr", "kor", "lao", "lav", "lga", "lin", "lit", "ltz", "lug", "luo", "mal", "mar", "mas", "mdf", "mhr", "mkd", "mlt", "mon", "mri", "mrj", "mya", "myv", "nan", "nep", "nld", "nno", "nob", "npi", "nso", "nya", "oci", "ori", "orm", "ory", "pan", "pol", "por", "pus", "quy", "roh", "ron", "rus", "sah", "sat", "sin", "skr", "slk", "slv", "sna", "snd", "som", "sot", "spa", "srd", "srp", "sun", "swa", "swe", "swh", "tam", "tat", "tel", "tgk", "tgl", "tha", "tig", "tir", "tok", "tpi", "tsn", "tuk", "tur", "twi", "uig", "ukr", "umb", "urd", "uzb", "vie", "vot", "wol", "xho", "yor", "yue", "zho", "zul"];
const capabilities$I = { "asr": ["segments"] };
const dependencies$v = [];
const options$I = { "request": [{ "name": "language", "type": "string", "description": "Input language as an OWSM ISO 639-3 code, such as eng, jpn, or zho; auto detects it from the first window.", "required": false, "default": "eng" }, { "name": "target_language", "type": "string", "description": "Optional OWSM translation target code. Omit for transcription.", "required": false }, { "name": "return_timestamps", "type": "bool", "description": "Return OWSM utterance-level timestamp segments.", "required": false, "default": false }, { "name": "condition_on_previous_text", "type": "bool", "description": "Condition each long-form chunk on the previous chunk transcript.", "required": false, "default": false }, { "name": "num_beams", "type": "int", "description": "Decoder beam width; one selects greedy decoding.", "required": false, "min": 1, "max": 50002, "default": 1 }, { "name": "max_tokens", "type": "int", "description": "Maximum generated tokens per 30-second window; zero uses the model limit.", "required": false, "min": 0, "max": 374, "default": 0 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Long-form audio chunking mode.", "values": ["auto", "fixed", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum duration of each audio window. Must be positive.", "required": false, "max": 30, "default": 30 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Matmul weight storage override.", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"], "required": false, "default": "native" }], "load": [] };
const runtime$I = { "tags": ["gguf"] };
const ui$I = { "tags": ["ASR", "GGUF"], "docs": ["docs/models/owsm.md"], "recommended_package": "owsm_v4_base_102m_f32" };
const package_defaults$D = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$J = [{ "id": "owsm_v4_base_102m_f32", "display_name": "OWSM v4 Base 102M F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-base-102m-f32.gguf"], "strip_prefix": "OWSM-GGUF" }, { "id": "owsm_v4_base_102m_q8_0", "display_name": "OWSM v4 Base 102M Q8_0", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-base-102m-q8_0.gguf"], "strip_prefix": "OWSM-GGUF" }, { "id": "owsm_v4_small_370m_f32", "display_name": "OWSM v4 Small 370M F32", "default": false, "format": "gguf", "precision": "f32", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-small-370m-f32.gguf"], "strip_prefix": "OWSM-GGUF" }, { "id": "owsm_v4_small_370m_q8_0", "display_name": "OWSM v4 Small 370M Q8_0", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-small-370m-q8_0.gguf"], "strip_prefix": "OWSM-GGUF" }, { "id": "owsm_v4_small_370m_q4_k", "display_name": "OWSM v4 Small 370M Q4_K", "default": false, "format": "gguf", "precision": "q4_k", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-small-370m-q4_k.gguf"], "strip_prefix": "OWSM-GGUF" }, { "id": "owsm_v4_medium_1b_f32", "display_name": "OWSM v4 Medium 1B F32", "default": false, "format": "gguf", "precision": "f32", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-medium-1b-f32.gguf"], "strip_prefix": "OWSM-GGUF" }, { "id": "owsm_v4_medium_1b_q8_0", "display_name": "OWSM v4 Medium 1B Q8_0", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-medium-1b-q8_0.gguf"], "strip_prefix": "OWSM-GGUF" }, { "id": "owsm_v4_medium_1b_q4_k", "display_name": "OWSM v4 Medium 1B Q4_K", "default": false, "format": "gguf", "precision": "q4_k", "target_directory": "OWSM-GGUF", "files": ["OWSM-GGUF/owsm-v4-medium-1b-q4_k.gguf"], "strip_prefix": "OWSM-GGUF" }];
const sources$I = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer": "model:bpe.model" }, "tensors": { "weights": "model:model.safetensors" } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer": "model:bpe.model" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_89 = {
  family: family$I,
  schema_version: schema_version$v,
  display_name: display_name$I,
  description: description$I,
  category: category$I,
  status: status$I,
  tasks: tasks$I,
  modes: modes$I,
  languages: languages$I,
  capabilities: capabilities$I,
  dependencies: dependencies$v,
  options: options$I,
  runtime: runtime$I,
  ui: ui$I,
  package_defaults: package_defaults$D,
  packages: packages$J,
  sources: sources$I
};
const family$H = "owsm_ctc";
const schema_version$u = 1;
const display_name$H = "OWSM-CTC";
const description$H = "ESPnet non-autoregressive multilingual speech recognition and speech translation with self-conditioned CTC.";
const category$H = "asr";
const status$H = "supported";
const tasks$H = ["asr"];
const modes$H = ["offline", "streaming"];
const languages$H = ["abk", "afr", "amh", "ara", "asm", "ast", "aze", "bak", "bas", "bel", "ben", "bos", "bre", "bul", "cat", "ceb", "ces", "chv", "ckb", "cmn", "cnh", "cym", "dan", "deu", "dgd", "div", "ell", "eng", "epo", "est", "eus", "fas", "fil", "fin", "fra", "frr", "ful", "gle", "glg", "grn", "guj", "hat", "hau", "heb", "hin", "hrv", "hsb", "hun", "hye", "ibo", "ina", "ind", "isl", "ita", "jav", "jpn", "kab", "kam", "kan", "kat", "kaz", "kea", "khm", "kin", "kir", "kmr", "kor", "lao", "lav", "lga", "lin", "lit", "ltz", "lug", "luo", "mal", "mar", "mas", "mdf", "mhr", "mkd", "mlt", "mon", "mri", "mrj", "mya", "myv", "nan", "nep", "nld", "nno", "nob", "npi", "nso", "nya", "oci", "ori", "orm", "ory", "pan", "pol", "por", "pus", "quy", "roh", "ron", "rus", "sah", "sat", "sin", "skr", "slk", "slv", "sna", "snd", "som", "sot", "spa", "srd", "srp", "sun", "swa", "swe", "swh", "tam", "tat", "tel", "tgk", "tgl", "tha", "tig", "tir", "tok", "tpi", "tsn", "tuk", "tur", "twi", "uig", "ukr", "umb", "urd", "uzb", "vie", "vot", "wol", "xho", "yor", "yue", "zho", "zul"];
const capabilities$H = {};
const dependencies$u = [];
const options$H = { "request": [{ "name": "language", "type": "string", "description": "Input ISO 639-3 language code, such as eng, jpn, or zho. auto uses unknown-language conditioning.", "required": false, "default": "eng" }, { "name": "target_language", "type": "string", "description": "Optional OWSM translation target code. Omit for transcription.", "required": false }, { "name": "audio_chunk_mode", "type": "enum", "description": "Long-form audio chunking mode.", "values": ["auto", "fixed", "none"], "required": false, "default": "auto" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Matmul weight storage override.", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"], "required": false, "default": "native" }], "load": [] };
const runtime$H = { "tags": ["gguf"] };
const ui$H = { "tags": ["ASR", "GGUF"], "docs": ["docs/models/owsm_ctc.md"], "recommended_package": "owsm_ctc_v4_1b_f32" };
const package_defaults$C = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$I = [{ "id": "owsm_ctc_v4_1b_f32", "display_name": "OWSM-CTC v4 1B F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "OWSM-CTC-GGUF", "files": ["OWSM-CTC-GGUF/owsm-ctc-v4-1b-f32.gguf"], "strip_prefix": "OWSM-CTC-GGUF" }, { "id": "owsm_ctc_v4_1b_q8_0", "display_name": "OWSM-CTC v4 1B Q8_0", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "OWSM-CTC-GGUF", "files": ["OWSM-CTC-GGUF/owsm-ctc-v4-1b-q8_0.gguf"], "strip_prefix": "OWSM-CTC-GGUF" }];
const sources$H = [{ "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer": "model:bpe.model" }, "tensors": { "weights": "model:model.safetensors" } }, { "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer": "model:bpe.model" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_90 = {
  family: family$H,
  schema_version: schema_version$u,
  display_name: display_name$H,
  description: description$H,
  category: category$H,
  status: status$H,
  tasks: tasks$H,
  modes: modes$H,
  languages: languages$H,
  capabilities: capabilities$H,
  dependencies: dependencies$u,
  options: options$H,
  runtime: runtime$H,
  ui: ui$H,
  package_defaults: package_defaults$C,
  packages: packages$I,
  sources: sources$H
};
const schema_version$t = 1;
const family$G = "parakeet_tdt";
const display_name$G = "Parakeet-TDT 0.6B v3";
const description$G = "NVIDIA Parakeet-TDT 0.6B v3 FastConformer-TDT ASR covering 25 European languages with automatic language detection. Supports the upstream Transformers-compatible safetensors package and standalone audio.cpp GGUF, with offline full-context, bounded-window long-form, and buffered streaming; the checkpoint uses unlimited bidirectional attention and is not a native cache-aware streaming model.";
const category$G = "asr";
const status$G = "community";
const tasks$G = ["asr"];
const modes$G = ["offline", "streaming"];
const languages$G = ["bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hr", "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "uk"];
const runtime$G = { "tags": ["gguf", "stream"] };
const capabilities$G = { "asr": ["word_timestamps", "partial_results", "vad_chunking"] };
const options$G = { "request": [{ "name": "return_timestamps", "type": "bool", "description": "Accepted for CLI --words-out compatibility. Word timestamps are always returned, including when false or omitted.", "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum TDT generated tokens; 0 or omitted uses the model-derived limit.", "required": false, "min": 0, "default": 0 }, { "name": "keep_language_tags", "type": "bool", "description": "Keep language tag tokens in decoded text; default false.", "required": false, "default": false }, { "name": "audio_chunk_mode", "type": "enum", "description": "Offline audio chunking mode. fixed selects overlapping long-form windows regardless of offline_mode; vad uses the configured VAD model (Silero by default) to skip silence; auto follows offline_mode. Offline input is downmixed and resampled as needed.", "values": ["auto", "fixed", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "VAD maximum chunk duration; omitted inherits the session duration. Fixed/long_form windows use the session setting, not this request override.", "required": false, "min": 1e-3 }, { "name": "hotwords", "type": "string", "description": "Phonon-2 and Underdog Bark 3.0/Pro/Plus: optional native vocabulary bias, comma-separated or a JSON array of strings / word-spoken objects. Up to 25 terms; an explicit empty list disables prompt biasing.", "required": false }, { "name": "hotwords_score", "type": "float", "description": "Phonon-2/Bark native matching-piece logit bonus; duration scores and blank are not biased.", "required": false, "min": 0, "max": 100, "default": 2 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "matmul_weight_type", "type": "enum", "description": "Encoder and decoder matmul weight storage type; defaults to weight_type, which defaults to native. Q8_0 measured 1.79x faster on the tested CPU and changed roughly 8 percent of transcripts without moving aggregate word error rate.", "preset": "weight_type_full", "required": false }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage type; default native.", "preset": "weight_type_conv", "required": false, "default": "native" }, { "name": "perf_mode", "type": "enum", "description": "Encoder attention implementation. Default off uses the validated relative-attention path; flash_attention enables the fused implementation, which was numerically validated but slower on the tested hardware.", "preset": "perf_mode_flash_attention", "required": false, "default": "off" }, { "name": "weight_context_mb", "type": "int", "description": "Weight context arena size in MiB; default 3072.", "required": false, "min": 1, "default": 3072 }, { "name": "encoder_graph_arena_mb", "type": "int", "description": "Encoder graph arena size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "decoder_graph_arena_mb", "type": "int", "description": "Decoder graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Center-region duration for buffered streaming in seconds; default 2. Fixed context windows are re-encoded rather than cache-aware. Also sizes offline fixed/long_form windows.", "required": false, "min": 1e-3, "default": 2 }, { "name": "left_context_sec", "type": "float", "description": "Past context included when re-encoding each buffered-streaming window in seconds; default 10. Also applies to offline fixed/long_form windows.", "required": false, "min": 0, "default": 10 }, { "name": "right_context_sec", "type": "float", "description": "Future lookahead included when re-encoding each buffered-streaming window in seconds; default 2 and adds equivalent partial-result latency. Also applies to offline fixed/long_form windows.", "required": false, "min": 0, "default": 2 }, { "name": "streaming_attention_mode", "type": "enum", "description": "Attention policy inside each buffered window. full_context preserves bidirectional attention over the bounded window.", "values": ["full_context"], "required": false, "default": "full_context" }, { "name": "offline_mode", "type": "enum", "description": "Offline encoder scheduling. full_context encodes the whole utterance, long_form uses bounded overlapping windows, and auto selects long_form beyond audio_chunk_threshold_sec.", "values": ["full_context", "long_form", "auto"], "required": false, "default": "full_context" }, { "name": "audio_chunk_threshold_sec", "type": "float", "description": "Duration threshold used by offline_mode=auto before switching to bounded-window long-form execution; default 30 seconds.", "required": false, "min": 1e-3, "default": 30 }, { "name": "vad_model_path", "type": "path", "description": "VAD model path used by audio_chunk_mode=vad (any built-in VAD family); default assets/framework/models/silero_vad.", "required": false, "default": "assets/framework/models/silero_vad" }], "load": [] };
const package_defaults$B = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$H = [{ "id": "parakeet_tdt_q8_0", "display_name": "Parakeet-TDT 0.6B v3 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Parakeet-TDT-0.6B-v3-GGUF", "files": ["Parakeet-TDT-0.6B-v3-GGUF/parakeet-tdt-0.6b-v3-q8_0.gguf"], "strip_prefix": "Parakeet-TDT-0.6B-v3-GGUF" }, { "id": "parakeet_tdt_f16", "display_name": "Parakeet-TDT 0.6B v3 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Parakeet-TDT-0.6B-v3-GGUF", "files": ["Parakeet-TDT-0.6B-v3-GGUF/parakeet-tdt-0.6b-v3-f16.gguf"], "strip_prefix": "Parakeet-TDT-0.6B-v3-GGUF" }, { "id": "orukeet_q8_0", "display_name": "Orukeet r3 Q8_0 GGUF (Parakeet-TDT 0.6B v3 fine-tune)", "format": "gguf", "precision": "q8_0", "target_directory": "Orukeet-GGUF", "files": ["Orukeet-GGUF/orukeet-q8_0.gguf"], "strip_prefix": "Orukeet-GGUF" }, { "id": "orukeet_f16", "display_name": "Orukeet r3 F16 GGUF (Parakeet-TDT 0.6B v3 fine-tune)", "format": "gguf", "precision": "f16", "target_directory": "Orukeet-GGUF", "files": ["Orukeet-GGUF/orukeet-f16.gguf"], "strip_prefix": "Orukeet-GGUF" }];
const dependencies$t = [];
const ui$G = { "recommended_package": "parakeet_tdt_q8_0", "tags": ["ASR", "GGUF"], "docs": ["docs/models/parakeet_tdt.md", "docs/models/underdog_bark3.md"] };
const sources$G = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "processor_config": "model:processor_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "processor_config": "model:processor_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_91 = {
  schema_version: schema_version$t,
  family: family$G,
  display_name: display_name$G,
  description: description$G,
  category: category$G,
  status: status$G,
  tasks: tasks$G,
  modes: modes$G,
  languages: languages$G,
  runtime: runtime$G,
  capabilities: capabilities$G,
  options: options$G,
  package_defaults: package_defaults$B,
  packages: packages$H,
  dependencies: dependencies$t,
  ui: ui$G,
  sources: sources$G
};
const schema_version$s = 1;
const family$F = "personaplex";
const display_name$F = "PersonaPlex";
const description$F = "PersonaPlex is a Moshi-style full-duplex speech-to-speech conversational model with Mimi audio tokenization, packaged speaker/persona prompts, streaming audio input, text generation, and generated assistant speech.";
const category$F = "tts";
const status$F = "supported";
const tasks$F = ["s2s"];
const modes$F = ["offline", "streaming"];
const languages$F = ["en"];
const runtime$F = { "tags": ["gguf", "stream"] };
const capabilities$F = { "s2s": ["speaker_reference"] };
const options$F = { "request": [{ "name": "voice_id", "type": "enum", "description": "Packaged PersonaPlex voice prompt id such as NATF2 or NATM1. If omitted, NATF2 is used.", "values": ["NATF0", "NATF1", "NATF2", "NATF3", "NATM0", "NATM1", "NATM2", "NATM3", "VARF0", "VARF1", "VARF2", "VARF3", "VARF4", "VARM0", "VARM1", "VARM2", "VARM3", "VARM4"], "required": false, "default": "NATF2" }, { "name": "system_prompt", "type": "string", "description": "System persona prompt. Plain text is wrapped with the required <system> tags.", "required": false }, { "name": "temperature", "type": "float", "description": "Audio token sampling temperature; must be nonnegative, and positive when do_sample=true. Ignored when do_sample=false; default 0.8.", "required": false, "min": 0, "default": 0.8 }, { "name": "text_temperature", "type": "float", "description": "Text token sampling temperature; must be nonnegative, and positive when do_sample=true. Ignored when do_sample=false; default follows temperature.", "required": false, "min": 0 }, { "name": "top_k", "type": "int", "description": "Audio token top-k sampling limit; default 250.", "required": false, "min": 0, "default": 250 }, { "name": "text_top_k", "type": "int", "description": "Text token top-k sampling limit; default follows top_k.", "required": false, "min": 0 }, { "name": "do_sample", "type": "bool", "description": "Enable stochastic token sampling; default true. Set false for greedy decoding.", "required": false, "default": true }, { "name": "seed", "type": "int", "description": "uint32 seed. Session RNG starts at 42424242; explicit values reseed it, while omission on later conversations continues RNG state.", "required": false, "min": 0, "max": 4294967295 }], "session": [{ "name": "graph_arena_mb", "type": "int", "description": "Reusable ggml graph arena size in MiB for PersonaPlex LM, depformer, and Mimi graphs; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "lm_weight_context_mb", "type": "int", "description": "Main LM weight metadata arena size in MiB; default 64.", "required": false, "min": 1, "default": 64 }, { "name": "depformer_weight_context_mb", "type": "int", "description": "Depth transformer weight metadata arena size in MiB; default 64.", "required": false, "min": 1, "default": 64 }, { "name": "mimi_weight_context_mb", "type": "int", "description": "Mimi codec weight metadata arena size in MiB; default 64.", "required": false, "min": 1, "default": 64 }, { "name": "weight_type", "type": "enum", "description": "LM and Mimi matmul weight storage type; default native.", "preset": "weight_type_full", "required": false, "default": "native" }], "load": [] };
const package_defaults$A = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$G = [{ "id": "personaplex_7b_v1_q4_k", "display_name": "PersonaPlex 7B v1 Q4_K GGUF", "default": true, "format": "gguf", "precision": "q4_k", "target_directory": "PersonaPlex-GGUF", "files": ["PersonaPlex-GGUF/personaplex-7b-v1-q4_k.gguf"], "strip_prefix": "PersonaPlex-GGUF" }, { "id": "personaplex_7b_v1_q8_0", "display_name": "PersonaPlex 7B v1 Q8_0 GGUF", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "PersonaPlex-GGUF", "files": ["PersonaPlex-GGUF/personaplex-7b-v1-q8_0.gguf"], "strip_prefix": "PersonaPlex-GGUF" }];
const dependencies$s = [];
const ui$F = { "recommended_package": "personaplex_7b_v1_q4_k", "tags": ["TTS", "Stream", "GGUF"], "docs": ["docs/models/personaplex.md", "docs/tts.md", "docs/gguf.md"] };
const sources$F = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_model": "model:tokenizer_spm_32k_3.model", "voice_NATF0": "model:voices_safetensors/NATF0.safetensors", "voice_NATF1": "model:voices_safetensors/NATF1.safetensors", "voice_NATF2": "model:voices_safetensors/NATF2.safetensors", "voice_NATF3": "model:voices_safetensors/NATF3.safetensors", "voice_NATM0": "model:voices_safetensors/NATM0.safetensors", "voice_NATM1": "model:voices_safetensors/NATM1.safetensors", "voice_NATM2": "model:voices_safetensors/NATM2.safetensors", "voice_NATM3": "model:voices_safetensors/NATM3.safetensors", "voice_VARF0": "model:voices_safetensors/VARF0.safetensors", "voice_VARF1": "model:voices_safetensors/VARF1.safetensors", "voice_VARF2": "model:voices_safetensors/VARF2.safetensors", "voice_VARF3": "model:voices_safetensors/VARF3.safetensors", "voice_VARF4": "model:voices_safetensors/VARF4.safetensors", "voice_VARM0": "model:voices_safetensors/VARM0.safetensors", "voice_VARM1": "model:voices_safetensors/VARM1.safetensors", "voice_VARM2": "model:voices_safetensors/VARM2.safetensors", "voice_VARM3": "model:voices_safetensors/VARM3.safetensors", "voice_VARM4": "model:voices_safetensors/VARM4.safetensors" }, "tensors": { "lm_weights": { "source": "weights:", "prefix": "lm" }, "mimi_weights": { "source": "weights:", "prefix": "mimi" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_model": "model:tokenizer_spm_32k_3.model", "voice_NATF0": "model:voices_safetensors/NATF0.safetensors", "voice_NATF1": "model:voices_safetensors/NATF1.safetensors", "voice_NATF2": "model:voices_safetensors/NATF2.safetensors", "voice_NATF3": "model:voices_safetensors/NATF3.safetensors", "voice_NATM0": "model:voices_safetensors/NATM0.safetensors", "voice_NATM1": "model:voices_safetensors/NATM1.safetensors", "voice_NATM2": "model:voices_safetensors/NATM2.safetensors", "voice_NATM3": "model:voices_safetensors/NATM3.safetensors", "voice_VARF0": "model:voices_safetensors/VARF0.safetensors", "voice_VARF1": "model:voices_safetensors/VARF1.safetensors", "voice_VARF2": "model:voices_safetensors/VARF2.safetensors", "voice_VARF3": "model:voices_safetensors/VARF3.safetensors", "voice_VARF4": "model:voices_safetensors/VARF4.safetensors", "voice_VARM0": "model:voices_safetensors/VARM0.safetensors", "voice_VARM1": "model:voices_safetensors/VARM1.safetensors", "voice_VARM2": "model:voices_safetensors/VARM2.safetensors", "voice_VARM3": "model:voices_safetensors/VARM3.safetensors", "voice_VARM4": "model:voices_safetensors/VARM4.safetensors" }, "tensors": { "lm_weights": "model:model.safetensors", "mimi_weights": "model:tokenizer-e351c8d8-checkpoint125.safetensors" } }];
const __vite_glob_0_92 = {
  schema_version: schema_version$s,
  family: family$F,
  display_name: display_name$F,
  description: description$F,
  category: category$F,
  status: status$F,
  tasks: tasks$F,
  modes: modes$F,
  languages: languages$F,
  runtime: runtime$F,
  capabilities: capabilities$F,
  options: options$F,
  package_defaults: package_defaults$A,
  packages: packages$G,
  dependencies: dependencies$s,
  ui: ui$F,
  sources: sources$F
};
const schema_version$r = 1;
const family$E = "piper_tts";
const display_name$E = "Piper TTS";
const description$E = "Native VITS inference for Piper text-to-speech voices using the shared eSpeak-ng frontend.";
const category$E = "tts";
const status$E = "community";
const tasks$E = ["tts"];
const modes$E = ["offline"];
const languages$E = ["en"];
const runtime$E = { "tags": ["gguf"] };
const capabilities$E = { "tts": ["long_form"] };
const options$E = { "request": [{ "name": "speed", "type": "float", "description": "Speech speed multiplier; larger values produce faster speech.", "required": false, "min": 0.5, "max": 2, "default": 1 }, { "name": "variation", "type": "float", "description": "Acoustic latent noise scale.", "required": false, "min": 0, "max": 1, "default": 0.667 }, { "name": "duration_variation", "type": "float", "description": "Stochastic duration noise scale.", "required": false, "min": 0, "max": 2, "default": 0.8 }, { "name": "seed", "type": "int", "description": "Non-negative generation seed.", "required": false, "min": 0, "default": 1234, "max": 4294967295 }, { "name": "text_chunk_mode", "type": "enum", "description": "Long-form text chunking mode.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form chunk.", "required": false, "min": 1, "default": 280 }], "session": [{ "name": "espeak_library_path", "type": "path", "description": "Optional explicit path to the eSpeak-ng shared library.", "required": false }, { "name": "espeak_data_path", "type": "path", "description": "Optional explicit path to espeak-ng-data.", "required": false }, { "name": "exec_plan", "type": "string", "description": "JSON object of component execution plans. Components: decoder, duration_encoder, duration_flows. Each plan accepts impl, backend, artifacts, and params. impl is default/ggml/rknn. Default keeps existing execution. The decoder's GGML impl supports the session backend; RKNN requires artifacts.main and ENGINE_ENABLE_RKNN, with no backend field. The two duration stages are GGML-only and accept the session backend (device) or cpu (host); with no backend field the text encoder runs on the host on CUDA and on the session backend elsewhere, and the flow graphs run on the session backend. No implementation takes params.", "required": false, "default": "{}" }], "load": [] };
const package_defaults$z = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$F = [{ "id": "piper_lessac_medium_orig", "display_name": "Piper Lessac Medium Original-Dtype GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "Piper-TTS-GGUF", "files": ["Piper-TTS-GGUF/piper-en-us-lessac-medium-orig.gguf"], "strip_prefix": "Piper-TTS-GGUF" }, { "id": "piper_lessac_medium_decoder_rk3588", "display_name": "Piper Lessac Medium NPU Decoder RKNN (RK3588)", "format": "rknn", "precision": "f16", "target_directory": "Piper-TTS-GGUF", "files": ["rk3588/piper-lessac-w93.rknn"], "strip_prefix": "rk3588", "description": "Pre-compiled RK3588 engine for the piper_tts RKNN decoder sidecar (piper_tts.exec_plan, artifacts.main); installs beside the GGUF weights and is named by bare file name. Built by tools/rknn from the en_US-lessac-medium streaming decoder export; see docs/build/rockchip-npu.md.", "download": { "kind": "huggingface_snapshot", "repo": "wOvANAI/rknn-tts-engines", "revision": "main", "gated": false } }];
const dependencies$r = [];
const ui$E = { "recommended_package": "piper_lessac_medium_orig", "tags": ["TTS", "GGUF"], "docs": ["docs/tts.md", "docs/models/piper_tts.md", "docs/gguf.md"] };
const sources$E = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_93 = {
  schema_version: schema_version$r,
  family: family$E,
  display_name: display_name$E,
  description: description$E,
  category: category$E,
  status: status$E,
  tasks: tasks$E,
  modes: modes$E,
  languages: languages$E,
  runtime: runtime$E,
  capabilities: capabilities$E,
  options: options$E,
  package_defaults: package_defaults$z,
  packages: packages$F,
  dependencies: dependencies$r,
  ui: ui$E,
  sources: sources$E
};
const schema_version$q = 1;
const family$D = "plapre";
const display_name$D = "Plapre 3";
const description$D = "Danish speech synthesis with a Llama autoregressive decoder and Kanade audio codec. Streaming emits completed text chunks, not incremental codec frames.";
const category$D = "tts";
const status$D = "supported";
const tasks$D = ["tts", "clone"];
const modes$D = ["offline", "streaming"];
const languages$D = ["da"];
const capabilities$D = { "tts": ["long_form", "speaker_reference", "built_in_voices"], "clone": ["speaker_reference", "long_form"] };
const runtime$D = { "tags": ["gguf", "stream"] };
const options$D = { "request": [{ "name": "voice_id", "type": "enum", "description": "Built-in speaker.", "required": false, "default": "tor", "values": ["tor", "ida", "liv", "ask", "kaj"] }, { "name": "reference_text", "type": "string", "description": "Transcript of the reference audio, used for voice cloning.", "required": false, "default": "" }, { "name": "x_vector_only_mode", "type": "bool", "description": "Use only the reference speaker embedding, without the reference transcript/audio-token prefix.", "required": false, "default": false }, { "name": "word_duration_frames", "type": "string", "description": "JSON array of per-word integer durations, from 0 to 399 frames at 25 Hz. Duration-controlled text is generated in one chunk.", "required": false }, { "name": "context_text", "type": "string", "description": "Previous utterance for prosodic context.", "required": false }, { "name": "context_audio_file", "type": "audio_path", "description": "Optional previous-utterance WAV accompanying context_text.", "required": false }, { "name": "same_speaker", "type": "bool", "description": "Whether context_text belongs to the target speaker.", "required": false, "default": true }, { "name": "pronunciations", "type": "string", "description": 'Ordered JSON array of pronunciation references: [{"word":"morgen","audio_file":"morgen.wav"}]. Up to 10 references, 60 codes each and 200 total codes are used.', "required": false }, { "name": "edit_start_frame", "type": "int", "description": "Start of the masked span in voice_ref, in 25-Hz codec frames. Supply both edit boundaries and the complete desired text.", "required": false, "min": 0 }, { "name": "edit_end_frame", "type": "int", "description": "Exclusive end of the masked span in voice_ref. Editing runs in one text chunk.", "required": false, "min": 0 }, { "name": "max_tokens", "type": "int", "description": "Maximum generated tokens per text chunk; each audio token represents 40 ms.", "required": false, "default": 500, "min": 1 }, { "name": "min_tokens", "type": "int", "description": "Minimum generated tokens before a stop token can be selected.", "required": false, "default": 0, "min": 0 }, { "name": "temperature", "type": "float", "description": "Sampling temperature; zero selects greedy decoding.", "required": false, "default": 0.8, "min": 0 }, { "name": "top_p", "type": "float", "description": "Nucleus sampling probability in (0, 1].", "required": false, "default": 0.95, "min": 0, "max": 1 }, { "name": "top_k", "type": "int", "description": "Top-k sampling; -1 or zero disables filtering.", "required": false, "default": 50, "min": -1 }, { "name": "seed", "type": "int", "description": "Sampling and vocoder noise seed.", "required": false, "default": 0, "min": 0 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk.", "required": false, "default": 300, "min": 1 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking policy.", "required": false, "default": "default", "values": ["default", "tag_aware", "japanese", "endline"] }, { "name": "silence_duration_sec", "type": "float", "description": "Silence inserted between text chunks.", "required": false, "default": 0.1, "min": 0 }], "session": [], "load": [] };
const package_defaults$y = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$E = [{ "id": "plapre_3_bf16", "display_name": "Plapre 3 BF16", "format": "gguf", "precision": "bf16", "default": true, "target_directory": "Plapre-3-GGUF", "files": ["Plapre-3-GGUF/plapre-3-bf16.gguf"], "strip_prefix": "Plapre-3-GGUF" }, { "id": "plapre_3_f32", "display_name": "Plapre 3 F32", "format": "gguf", "precision": "f32", "default": false, "target_directory": "Plapre-3-GGUF", "files": ["Plapre-3-GGUF/plapre-3-f32.gguf"], "strip_prefix": "Plapre-3-GGUF" }];
const dependencies$q = [];
const ui$D = { "recommended_package": "plapre_3_bf16", "builtin_voices": ["tor", "ida", "liv", "ask", "kaj"], "default_voice": "tor", "tags": ["TTS", "GGUF"], "docs": ["docs/models/plapre.md"] };
const sources$D = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "kanade_config": "model:kanade_config.json", "speakers": "model:speakers.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json" }, "tensors": { "ar": "weights:", "speaker_projection": { "source": "weights:", "prefix": "speaker_proj" }, "kanade": { "source": "weights:", "prefix": "kanade" }, "wavlm": { "source": "weights:", "prefix": "wavlm" }, "hift": { "source": "weights:", "prefix": "hift" } } }];
const __vite_glob_0_94 = {
  schema_version: schema_version$q,
  family: family$D,
  display_name: display_name$D,
  description: description$D,
  category: category$D,
  status: status$D,
  tasks: tasks$D,
  modes: modes$D,
  languages: languages$D,
  capabilities: capabilities$D,
  runtime: runtime$D,
  options: options$D,
  package_defaults: package_defaults$y,
  packages: packages$E,
  dependencies: dependencies$q,
  ui: ui$D,
  sources: sources$D
};
const family$C = "pocket_tts";
const display_name$C = "PocketTTS";
const description$C = "Kyutai 100M-parameter CPU-friendly TTS package set for real-time local synthesis and small-footprint voice cloning in English, French, German, Italian, Portuguese, and Spanish.";
const category$C = "tts";
const status$C = "supported";
const tasks$C = ["tts", "clone"];
const modes$C = ["offline", "streaming"];
const languages$C = ["en", "fr", "de", "it", "pt", "es"];
const options$C = { "request": [{ "name": "frames_after_eos", "type": "int", "description": "Extra frames after EOS; -1 uses the model-derived value.", "required": false, "min": -1, "default": -1 }, { "name": "max_frames", "type": "int", "description": "Maximum generated audio frames; zero estimates the cap from text length. Captured during session preparation.", "required": false, "min": 0, "default": 0 }, { "name": "text_chunk_tokens", "type": "int", "description": "Tokenizer tokens per text chunk; must be positive, default 50. Set during preparation and overridable per request.", "required": false, "min": 1, "default": 50 }, { "name": "temperature", "type": "float", "description": "Positive flow noise temperature; defaults to the model configuration. Captured during session preparation.", "required": false }, { "name": "seed", "type": "int", "description": "Noise seed; omitted chooses a random seed. Captured during session preparation.", "required": false, "min": 0, "max": 4294967295 }, { "name": "noise_clamp", "type": "float", "description": "Noise clamp; a negative value disables clamping. Captured during session preparation.", "required": false, "default": -1 }, { "name": "eos_threshold", "type": "float", "description": "EOS detection threshold. Captured during session preparation.", "required": false, "default": -4 }, { "name": "noise_file", "type": "path", "description": "Precomputed noise schedule file. Captured during session preparation.", "required": false }, { "name": "voice_embedding_file", "type": "path", "description": "Precomputed voice-state embedding path. Captured during session preparation.", "required": false }, { "name": "truncate_clone_audio", "type": "bool", "description": "Truncate voice clone audio. Captured during session preparation.", "required": false, "default": false }, { "name": "text_chunk_size", "type": "int", "description": "Optional per-request character chunk size; otherwise use sentence/token budgeting.", "required": false }, { "name": "export_voice_state_file", "type": "path", "description": "Export the prepared voice state during session preparation.", "required": false }], "session": [{ "name": "voice_state_cache_slots", "type": "int", "description": "Cached prepared voice states; zero disables reuse.", "required": false, "min": 0, "default": 4 }, { "name": "offline_graph_capacity_mode", "type": "enum", "description": "Offline graph capacity policy; CPU/Metal default tiered, other backends double.", "required": false, "values": ["fixed", "double", "tiered", "grow"] }, { "name": "prompt_graph_capacity", "type": "int", "description": "Optional reserved prompt capacity.", "required": false, "min": 1 }, { "name": "generation_graph_capacity", "type": "int", "description": "Optional reserved generation capacity.", "required": false, "min": 1 }, { "name": "weight_type", "type": "enum", "description": "Shared matmul weight storage; component matmul settings inherit it. Convolution storage remains independently native unless overridden.", "required": false, "preset": "weight_type_full" }, { "name": "matmul_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage.", "required": false, "preset": "weight_type_conv", "default": "native" }, { "name": "weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 64 }, { "name": "flow_weight_context_mb", "type": "int", "description": "Flow weight context in MiB; inherits pocket_tts.weight_context_mb when omitted.", "required": false, "min": 1 }, { "name": "mimi_encoder_weight_context_mb", "type": "int", "description": "Mimi encoder weight context in MiB; inherits pocket_tts.weight_context_mb when omitted.", "required": false, "min": 1 }, { "name": "mimi_decoder_weight_context_mb", "type": "int", "description": "Mimi decoder weight context in MiB; inherits pocket_tts.weight_context_mb when omitted.", "required": false, "min": 1 }, { "name": "flow_weights_view_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 256 }, { "name": "flow_step_graph_arena_mb", "type": "int", "description": "Flow-step host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 256 }, { "name": "mimi_encoder_graph_arena_mb", "type": "int", "description": "Mimi encoder host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 512 }, { "name": "mimi_conv_graph_arena_mb", "type": "int", "description": "Mimi convolution host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 32 }, { "name": "mimi_transformer_graph_arena_mb", "type": "int", "description": "Mimi transformer host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 96 }, { "name": "mimi_tail_graph_arena_mb", "type": "int", "description": "Mimi tail host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 512 }, { "name": "mimi_full_chunk_frames", "type": "int", "description": "Full-sequence decoder chunk frames.", "required": false, "min": 1, "default": 90 }, { "name": "mimi_stage2_chunk_frames", "type": "int", "description": "Second-stage decoder chunk frames.", "required": false, "min": 1, "default": 900 }, { "name": "use_full_mimi", "type": "bool", "description": "Use full-sequence Mimi decoding.", "required": false, "default": true }], "load": [{ "name": "language", "type": "string", "description": "Model language selection.", "required": false, "default": "english" }] };
const capabilities$C = { "clone": ["speaker_reference"] };
const runtime$C = { "tags": ["gguf"] };
const ui$C = { "recommended_package": "pocket_tts_english_q8_0", "default_voice": "alba", "builtin_voices": ["alba"], "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const package_defaults$x = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$D = [{ "id": "pocket_tts_english_q8_0", "display_name": "PocketTTS English Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "PocketTTS-GGUF/english", "files": ["PocketTTS-GGUF/english/pocket-tts-english-q8_0.gguf", "PocketTTS-GGUF/english/embeddings/alba.safetensors"], "strip_prefix": "PocketTTS-GGUF/english" }, { "id": "pocket_tts_english_bf16", "display_name": "PocketTTS English BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "PocketTTS-GGUF/english", "files": ["PocketTTS-GGUF/english/pocket-tts-english-bf16.gguf", "PocketTTS-GGUF/english/embeddings/alba.safetensors"], "strip_prefix": "PocketTTS-GGUF/english" }, { "id": "pocket_tts_french_q8_0", "display_name": "PocketTTS French Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "PocketTTS-GGUF/french", "files": ["PocketTTS-GGUF/french/pocket-tts-french-q8_0.gguf", "PocketTTS-GGUF/french/embeddings/cosette.safetensors"], "strip_prefix": "PocketTTS-GGUF/french" }, { "id": "pocket_tts_french_bf16", "display_name": "PocketTTS French BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "PocketTTS-GGUF/french", "files": ["PocketTTS-GGUF/french/pocket-tts-french-bf16.gguf", "PocketTTS-GGUF/french/embeddings/cosette.safetensors"], "strip_prefix": "PocketTTS-GGUF/french" }, { "id": "pocket_tts_german_q8_0", "display_name": "PocketTTS German Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "PocketTTS-GGUF/german", "files": ["PocketTTS-GGUF/german/pocket-tts-german-q8_0.gguf"], "strip_prefix": "PocketTTS-GGUF/german" }, { "id": "pocket_tts_german_bf16", "display_name": "PocketTTS German BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "PocketTTS-GGUF/german", "files": ["PocketTTS-GGUF/german/pocket-tts-german-bf16.gguf"], "strip_prefix": "PocketTTS-GGUF/german" }, { "id": "pocket_tts_italian_q8_0", "display_name": "PocketTTS Italian Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "PocketTTS-GGUF/italian", "files": ["PocketTTS-GGUF/italian/pocket-tts-italian-q8_0.gguf"], "strip_prefix": "PocketTTS-GGUF/italian" }, { "id": "pocket_tts_italian_bf16", "display_name": "PocketTTS Italian BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "PocketTTS-GGUF/italian", "files": ["PocketTTS-GGUF/italian/pocket-tts-italian-bf16.gguf"], "strip_prefix": "PocketTTS-GGUF/italian" }, { "id": "pocket_tts_portuguese_q8_0", "display_name": "PocketTTS Portuguese Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "PocketTTS-GGUF/portuguese", "files": ["PocketTTS-GGUF/portuguese/pocket-tts-portuguese-q8_0.gguf"], "strip_prefix": "PocketTTS-GGUF/portuguese" }, { "id": "pocket_tts_portuguese_bf16", "display_name": "PocketTTS Portuguese BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "PocketTTS-GGUF/portuguese", "files": ["PocketTTS-GGUF/portuguese/pocket-tts-portuguese-bf16.gguf"], "strip_prefix": "PocketTTS-GGUF/portuguese" }, { "id": "pocket_tts_spanish_q8_0", "display_name": "PocketTTS Spanish Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "PocketTTS-GGUF/spanish", "files": ["PocketTTS-GGUF/spanish/pocket-tts-spanish-q8_0.gguf"], "strip_prefix": "PocketTTS-GGUF/spanish" }, { "id": "pocket_tts_spanish_bf16", "display_name": "PocketTTS Spanish BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "PocketTTS-GGUF/spanish", "files": ["PocketTTS-GGUF/spanish/pocket-tts-spanish-bf16.gguf"], "strip_prefix": "PocketTTS-GGUF/spanish" }, { "id": "pocket_tts_english_safetensors", "display_name": "PocketTTS English Safetensors", "format": "safetensors", "precision": "native", "target_directory": "pocket-tts", "files": ["languages/english/embeddings/alba.safetensors", "languages/english/embeddings/anna.safetensors", "languages/english/embeddings/azelma.safetensors", "languages/english/embeddings/bill_boerst.safetensors", "languages/english/embeddings/caro_davy.safetensors", "languages/english/embeddings/charles.safetensors", "languages/english/embeddings/cosette.safetensors", "languages/english/embeddings/eponine.safetensors", "languages/english/embeddings/estelle.safetensors", "languages/english/embeddings/eve.safetensors", "languages/english/embeddings/fantine.safetensors", "languages/english/embeddings/george.safetensors", "languages/english/embeddings/giovanni.safetensors", "languages/english/embeddings/jane.safetensors", "languages/english/embeddings/javert.safetensors", "languages/english/embeddings/jean.safetensors", "languages/english/embeddings/juergen.safetensors", "languages/english/embeddings/lola.safetensors", "languages/english/embeddings/marius.safetensors", "languages/english/embeddings/mary.safetensors", "languages/english/embeddings/michael.safetensors", "languages/english/embeddings/paul.safetensors", "languages/english/embeddings/peter_yearsley.safetensors", "languages/english/embeddings/rafael.safetensors", "languages/english/embeddings/stuart_bell.safetensors", "languages/english/embeddings/vera.safetensors", "languages/english/model.safetensors", "languages/english/tokenizer.model"], "download": { "kind": "huggingface_snapshot", "repo": "kyutai/pocket-tts", "gated": true } }];
const sources$C = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "tokenizer": "model:tokenizer.model" }, "optional_files": { "config": "model:config.yaml" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "language": "languages/english" }, "files": { "tokenizer": "language:tokenizer.model" }, "optional_files": { "config": "language:config.yaml" }, "tensors": { "weights": "language:model.safetensors" } }];
const __vite_glob_0_95 = {
  family: family$C,
  display_name: display_name$C,
  description: description$C,
  category: category$C,
  status: status$C,
  tasks: tasks$C,
  modes: modes$C,
  languages: languages$C,
  options: options$C,
  capabilities: capabilities$C,
  runtime: runtime$C,
  ui: ui$C,
  package_defaults: package_defaults$x,
  packages: packages$D,
  sources: sources$C
};
const schema_version$p = 1;
const family$B = "pulsevad";
const display_name$B = "PulseVAD";
const description$B = "Speech activity detection for 16 kHz mono audio with 2.1K student and 81K teacher weights.";
const category$B = "audio_tools";
const status$B = "supported";
const tasks$B = ["vad"];
const modes$B = ["offline"];
const languages$B = ["language_agnostic"];
const capabilities$B = { "vad": ["speech_segments"] };
const runtime$B = { "tags": ["gguf"] };
const options$B = { "request": [{ "name": "threshold", "type": "float", "description": "Speech probability threshold.", "required": false, "default": 0.5, "min": 0, "max": 1 }, { "name": "hop_size_samples", "type": "int", "description": "Window step in samples; 1600 samples is 100 ms at 16 kHz.", "required": false, "default": 1600, "min": 1 }, { "name": "min_speech_duration_ms", "type": "int", "description": "Minimum speech segment duration in milliseconds. Not applied to the short-input path (<3200 samples), which classifies the whole clip by threshold.", "required": false, "default": 100, "min": 0 }, { "name": "min_silence_duration_ms", "type": "int", "description": "Minimum silence before closing a speech segment, in milliseconds.", "required": false, "default": 100, "min": 0 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage override; native preserves the packaged tensor types.", "values": ["native", "f32", "f16", "bf16"], "required": false, "default": "native" }], "load": [] };
const package_defaults$w = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$C = [{ "id": "pulsevad_2_1k_f32", "display_name": "PulseVAD 2.1K GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "PulseVAD-GGUF", "files": ["PulseVAD-GGUF/pulsevad-2.1k-f32.gguf"], "strip_prefix": "PulseVAD-GGUF" }, { "id": "pulsevad_81k_f32", "display_name": "PulseVAD 81K GGUF F32", "format": "gguf", "precision": "f32", "target_directory": "PulseVAD-GGUF", "files": ["PulseVAD-GGUF/pulsevad-81k-f32.gguf"], "strip_prefix": "PulseVAD-GGUF" }];
const dependencies$p = [];
const ui$B = { "tags": ["VAD", "GGUF"], "docs": ["docs/models/pulsevad.md"], "recommended_package": "pulsevad_2_1k_f32" };
const sources$B = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "tensors": { "weights": "model:pulsevad-f32.safetensors" } }];
const __vite_glob_0_96 = {
  schema_version: schema_version$p,
  family: family$B,
  display_name: display_name$B,
  description: description$B,
  category: category$B,
  status: status$B,
  tasks: tasks$B,
  modes: modes$B,
  languages: languages$B,
  capabilities: capabilities$B,
  runtime: runtime$B,
  options: options$B,
  package_defaults: package_defaults$w,
  packages: packages$C,
  dependencies: dependencies$p,
  ui: ui$B,
  sources: sources$B
};
const family$A = "qwen3_asr";
const display_name$A = "Qwen3-ASR";
const description$A = "Qwen ASR model family for language identification and speech recognition across 30 languages, 22 Chinese dialects, and multiple English accents, with robustness for noisy, long-form, and singing audio.";
const category$A = "asr";
const status$A = "supported";
const tasks$A = ["asr"];
const modes$A = ["offline", "streaming"];
const languages$A = ["zh", "en", "yue", "ar", "de", "fr", "es", "pt", "id", "it", "ko", "ru", "th", "vi", "ja", "tr", "hi", "ms", "nl", "sv", "da", "fi", "pl", "cs", "fil", "fa", "el", "hu", "mk", "ro", "zh dialects"];
const capabilities$A = { "asr": ["word_timestamps", "vad_chunking", "partial_results"] };
const options$A = { "request": [{ "name": "language", "type": "string", "description": "Recognition language code or label. Omit to detect language automatically; Auto also selects automatic detection.", "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum generated transcript tokens; omitted uses the checkpoint generation_config.json (512 when absent).", "required": false, "min": 1 }, { "name": "return_timestamps", "type": "bool", "description": "Return word-level timestamps by running Qwen3 ForcedAligner after ASR; default false and requires forced_aligner_path when enabled. Offline only; streaming rejects true even when an aligner is configured.", "required": false, "default": false }, { "name": "audio_chunk_mode", "type": "enum", "description": "Audio chunking mode; default auto uses fixed chunks normally and VAD chunks when timestamps are requested. Offline only; streaming uses fixed-duration windows regardless of this selection.", "values": ["auto", "fixed", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Maximum audio chunk duration in seconds; must be > 0 when chunking or streaming. Ignored with audio_chunk_mode=none offline. Default 30 for streaming and offline transcription, or 15 for offline timestamps/VAD chunking.", "required": false, "min": 0 }, { "name": "clamp_timestamps_to_audio", "type": "bool", "description": "Opt-in guard for word timestamp output: keep repaired forced-aligner word spans inside the local audio chunk. Defaults to false to preserve existing timestamp repair behavior.", "required": false, "default": false }, { "name": "preserve_punctuation", "type": "bool", "description": "Opt-in text output mode for timestamped chunked ASR: preserve ASR punctuation in text_output instead of rebuilding text from aligned words.", "required": false, "default": false }], "session": [{ "name": "perf_mode", "type": "enum", "values": ["off", "cuda_perf"], "description": "Performance preset. cuda_perf selects flash attention, packed projections, f16 KV, 256-token attention alignment and two independent offline chunks per decode batch. Explicit session options override the preset.", "required": false, "default": "off" }, { "name": "attention", "type": "enum", "values": ["mixed", "auto", "eager", "flash"], "description": "Decoder attention preference. Default mixed preserves manual prefill and flash cached decoding; cuda_perf selects flash for both. auto uses the shared backend policy. Explicit values override the preset.", "required": false }, { "name": "packed_projections", "type": "bool", "description": "Pack decoder QKV and gate/up projections without changing weight dtype. Default false, true with cuda_perf. Explicit values override the preset.", "required": false }, { "name": "kv_cache_type", "type": "enum", "values": ["f32", "f16"], "description": "Decoder KV storage. Default f32, f16 with cuda_perf. Explicit values override the preset.", "required": false }, { "name": "kv_cache_alignment", "type": "int", "min": 1, "description": "Cached decoder attention prefix alignment in tokens. Default 1 attends over full cache capacity; cuda_perf uses cached 256-token prefix windows. Explicit values override the preset.", "required": false }, { "name": "offline_batch_size", "type": "int", "min": 1, "max": 2, "description": "Independent offline chunks decoded together. Default 1, 2 with cuda_perf. Does not change chunk boundaries or streaming scheduling. Explicit values override the preset.", "required": false }, { "name": "lora", "type": "path", "description": "PEFT LoRA adapter directory or checkpoint file; merged into matching encoder/decoder weights at session creation.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's alpha/r scaling; default 1.", "required": false, "default": 1 }, { "name": "forced_aligner_path", "type": "path", "description": "Optional Qwen3 ForcedAligner model path required for return_timestamps.", "required": false }, { "name": "vad_model_path", "type": "path", "description": "Optional VAD model path for VAD chunking (any built-in VAD family); default assets/framework/models/silero_vad.", "required": false, "default": "assets/framework/models/silero_vad" }, { "name": "weight_type", "type": "enum", "description": "Shared text decoder weight storage fallback; default native.", "required": false, "default": "native", "preset": "weight_type_full" }, { "name": "audio_encoder_weight_type", "type": "enum", "description": "Audio encoder weight storage type; default native.", "required": false, "default": "native", "preset": "weight_type_conv" }, { "name": "text_decoder_weight_type", "type": "enum", "description": "Text decoder matmul weight storage type; defaults to weight_type when set, otherwise native.", "required": false, "preset": "weight_type_full" }, { "name": "audio_encoder_graph_arena_mb", "type": "int", "description": "Audio encoder graph arena size in MiB; default 128.", "required": false, "min": 1, "default": 128 }, { "name": "text_decoder_prefill_graph_arena_mb", "type": "int", "description": "Text decoder prefill graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "text_decoder_decode_graph_arena_mb", "type": "int", "description": "Text decoder cached-step graph arena size in MiB; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "text_decoder_weight_context_mb", "type": "int", "description": "Text decoder weight context size in MiB; default 64.", "required": false, "min": 1, "default": 64 }], "load": [] };
const runtime$A = { "tags": ["gguf", "stream"] };
const ui$A = { "recommended_package": "qwen3_asr_1_7b_q8_0", "tags": ["ASR", "GGUF", "Stream"], "docs": ["docs/models/qwen3_asr.md", "docs/asr.md", "docs/gguf.md"] };
const package_defaults$v = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$B = [{ "id": "qwen3_asr_1_7b_q8_0", "display_name": "Qwen3-ASR 1.7B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Qwen3-ASR-1.7B-GGUF", "files": ["Qwen3-ASR-1.7B-GGUF/qwen3-asr-1.7b-q8_0.gguf"], "strip_prefix": "Qwen3-ASR-1.7B-GGUF" }, { "id": "qwen3_asr_1_7b_f16", "display_name": "Qwen3-ASR 1.7B F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Qwen3-ASR-1.7B-GGUF", "files": ["Qwen3-ASR-1.7B-GGUF/qwen3-asr-1.7b-f16.gguf"], "strip_prefix": "Qwen3-ASR-1.7B-GGUF" }, { "id": "qwen3_asr_0_6b_q8_0", "display_name": "Qwen3-ASR 0.6B Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Qwen3-ASR-0.6B-GGUF", "files": ["Qwen3-ASR-0.6B-GGUF/qwen3-asr-0.6b-q8_0.gguf"], "strip_prefix": "Qwen3-ASR-0.6B-GGUF" }, { "id": "qwen3_asr_0_6b_f16", "display_name": "Qwen3-ASR 0.6B F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Qwen3-ASR-0.6B-GGUF", "files": ["Qwen3-ASR-0.6B-GGUF/qwen3-asr-0.6b-f16.gguf"], "strip_prefix": "Qwen3-ASR-0.6B-GGUF" }, { "id": "qwen3_asr_1_7b_safetensors", "display_name": "Qwen3-ASR 1.7B HF Safetensors", "format": "safetensors", "precision": "native", "target_directory": "Qwen3-ASR-1.7B-hf", "files": ["config.json", "generation_config.json", "model.safetensors", "processor_config.json", "tokenizer_config.json", "tokenizer.json"], "download": { "kind": "huggingface_snapshot", "repo": "Qwen/Qwen3-ASR-1.7B-hf" } }, { "id": "qwen3_asr_0_6b_safetensors", "display_name": "Qwen3-ASR 0.6B Safetensors", "format": "safetensors", "precision": "native", "target_directory": "Qwen3-ASR-0.6B", "files": ["config.json", "generation_config.json", "model.safetensors", "preprocessor_config.json", "tokenizer_config.json"], "download": { "kind": "huggingface_snapshot", "repo": "Qwen/Qwen3-ASR-0.6B" } }, { "id": "qwencleo_asr_q8_0", "display_name": "QwenCleo-ASR Egyptian Arabic Q8_0 GGUF", "description": "Egyptian Arabic and Arabic-English code-switching fine-tune of Qwen3-ASR-1.7B from mohammedaly22/QwenCleo-ASR. Use language=Arabic.", "format": "gguf", "precision": "q8_0", "target_directory": "QwenCleo-ASR-GGUF", "files": ["qwencleo-asr-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "mohammedaly22/QwenCleo-ASR-GGUF" } }, { "id": "qwencleo_asr_f16", "display_name": "QwenCleo-ASR Egyptian Arabic F16 GGUF", "description": "Egyptian Arabic and Arabic-English code-switching fine-tune of Qwen3-ASR-1.7B from mohammedaly22/QwenCleo-ASR. Use language=Arabic.", "format": "gguf", "precision": "f16", "target_directory": "QwenCleo-ASR-GGUF", "files": ["qwencleo-asr-f16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "mohammedaly22/QwenCleo-ASR-GGUF" } }, { "id": "qwencleo_asr_safetensors", "display_name": "QwenCleo-ASR Egyptian Arabic Safetensors", "description": "Egyptian Arabic and Arabic-English code-switching fine-tune of Qwen3-ASR-1.7B from mohammedaly22/QwenCleo-ASR. Use language=Arabic.", "format": "safetensors", "precision": "native", "target_directory": "QwenCleo-ASR", "files": ["config.json", "generation_config.json", "model.safetensors", "preprocessor_config.json", "tokenizer_config.json", "tokenizer.json", "vocab.json", "merges.txt", "chat_template.json"], "download": { "kind": "huggingface_snapshot", "repo": "mohammedaly22/QwenCleo-ASR" } }];
const sources$A = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json", "processor_config": "model:processor_config.json", "chat_template": "model:chat_template.json", "chat_template_jinja": "model:chat_template.jinja", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json", "processor_config": "model:processor_config.json", "chat_template": "model:chat_template.json", "chat_template_jinja": "model:chat_template.jinja", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_97 = {
  family: family$A,
  display_name: display_name$A,
  description: description$A,
  category: category$A,
  status: status$A,
  tasks: tasks$A,
  modes: modes$A,
  languages: languages$A,
  capabilities: capabilities$A,
  options: options$A,
  runtime: runtime$A,
  ui: ui$A,
  package_defaults: package_defaults$v,
  packages: packages$B,
  sources: sources$A
};
const family$z = "qwen3_forced_aligner";
const display_name$z = "Qwen3 Forced Aligner";
const description$z = "Qwen3 non-autoregressive forced aligner that aligns transcript text to speech and returns word- or character-level timestamps across 11 supported languages.";
const category$z = "speech_analysis";
const status$z = "supported";
const tasks$z = ["align"];
const modes$z = ["offline"];
const languages$z = ["zh", "en", "yue", "fr", "de", "it", "ja", "ko", "pt", "ru", "es"];
const capabilities$z = { "align": ["word_timestamps"] };
const options$z = { "request": [{ "name": "clamp_timestamps_to_audio", "type": "bool", "description": "Opt-in guard for word timestamp output: keep repaired word spans inside the local audio input. Defaults to false to preserve existing timestamp repair behavior.", "required": false, "default": false }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared thinker matmul storage; does not override audio encoder storage.", "required": false, "preset": "weight_type_full", "default": "native" }, { "name": "audio_encoder_weight_type", "type": "enum", "description": "Audio encoder matmul storage.", "required": false, "values": ["native", "f32", "f16"], "default": "native" }, { "name": "thinker_weight_type", "type": "enum", "description": "Thinker matmul storage; inherits weight_type when omitted.", "required": false, "preset": "weight_type_full" }, { "name": "audio_encoder_graph_arena_mb", "type": "int", "description": "Audio encoder graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 128 }, { "name": "thinker_prefill_graph_arena_mb", "type": "int", "description": "Thinker prefill graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 256 }, { "name": "thinker_decode_graph_arena_mb", "type": "int", "description": "Thinker cached-step graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 256 }, { "name": "thinker_weight_context_mb", "type": "int", "description": "Thinker weight metadata context. Size in MiB; must be positive.", "required": false, "min": 1, "default": 64 }], "load": [] };
const runtime$z = { "tags": ["gguf"] };
const ui$z = { "recommended_package": "qwen3_forced_aligner_0_6b_q8_0", "tags": ["Align", "GGUF"], "docs": ["docs/models/qwen3_forced_aligner.md", "docs/gguf.md"] };
const package_defaults$u = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$A = [{ "id": "qwen3_forced_aligner_0_6b_q8_0", "display_name": "Qwen3 Forced Aligner 0.6B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Qwen3-ForcedAligner-0.6B-GGUF", "files": ["Qwen3-ForcedAligner-0.6B-GGUF/qwen3-forced-aligner-0.6b-q8_0.gguf"], "strip_prefix": "Qwen3-ForcedAligner-0.6B-GGUF" }, { "id": "qwen3_forced_aligner_0_6b_f16", "display_name": "Qwen3 Forced Aligner 0.6B F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Qwen3-ForcedAligner-0.6B-GGUF", "files": ["Qwen3-ForcedAligner-0.6B-GGUF/qwen3-forced-aligner-0.6b-f16.gguf"], "strip_prefix": "Qwen3-ForcedAligner-0.6B-GGUF" }, { "id": "qwen3_forced_aligner_0_6b_safetensors", "display_name": "Qwen3 Forced Aligner 0.6B Safetensors", "format": "safetensors", "precision": "native", "target_directory": "Qwen3-ForcedAligner-0.6B", "files": ["config.json", "generation_config.json", "model.safetensors", "preprocessor_config.json", "tokenizer_config.json"], "download": { "kind": "huggingface_snapshot", "repo": "Qwen/Qwen3-ForcedAligner-0.6B" } }];
const sources$z = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json", "processor_config": "model:processor_config.json", "chat_template": "model:chat_template.json", "chat_template_jinja": "model:chat_template.jinja", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json", "processor_config": "model:processor_config.json", "chat_template": "model:chat_template.json", "chat_template_jinja": "model:chat_template.jinja", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_98 = {
  family: family$z,
  display_name: display_name$z,
  description: description$z,
  category: category$z,
  status: status$z,
  tasks: tasks$z,
  modes: modes$z,
  languages: languages$z,
  capabilities: capabilities$z,
  options: options$z,
  runtime: runtime$z,
  ui: ui$z,
  package_defaults: package_defaults$u,
  packages: packages$A,
  sources: sources$z
};
const family$y = "qwen3_tts";
const display_name$y = "Qwen3-TTS";
const description$y = "Qwen3-TTS for controllable 10-language synthesis, 3-second voice cloning, CustomVoice, and VoiceDesign.";
const category$y = "tts";
const status$y = "supported";
const tasks$y = ["tts", "clone", "design"];
const modes$y = ["offline", "streaming"];
const languages$y = ["zh", "en", "ja", "ko", "de", "fr", "ru", "pt", "es", "it"];
const capabilities$y = { "clone": ["speaker_reference"], "design": ["voice_design"] };
const options$y = { "request": [{ "name": "stream_chunk_policy", "type": "enum", "description": "Streaming codec chunk schedule: grow starts with one frame and doubles to stream_frames_per_event; fixed uses that size throughout.", "required": false, "default": "grow", "values": ["grow", "fixed"] }, { "name": "stream_frames_per_event", "type": "int", "description": "Codec frames per fixed streaming event, or the maximum for growing events. Smaller values reduce chunk latency but increase decoding overhead.", "required": false, "default": 12, "min": 1 }, { "name": "language", "type": "string", "description": "Target synthesis language code or label; default auto lets the model infer from text and voice settings.", "required": false, "default": "auto" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated codec frames per text chunk; omitted uses the checkpoint generation_config.json (2048 when absent).", "required": false, "min": 1 }, { "name": "do_sample", "type": "bool", "description": "Sample the main codec stream instead of greedy decoding; default true.", "required": false, "default": true }, { "name": "temperature", "type": "float", "description": "Main codec sampling temperature; must be > 0 when do_sample=true. Ignored when do_sample=false; default 0.9.", "required": false, "min": 0, "default": 0.9 }, { "name": "top_k", "type": "int", "description": "Main codec top-k sampling limit; default 50, 0 disables top-k filtering.", "required": false, "min": 0, "default": 50 }, { "name": "top_p", "type": "float", "description": "Main codec nucleus sampling limit; default 1.0.", "required": false, "min": 0, "max": 1, "default": 1 }, { "name": "repetition_penalty", "type": "float", "description": "Main codec repetition penalty; must be > 0, default 1.05.", "required": false, "min": 0, "default": 1.05 }, { "name": "subtalker_do_sample", "type": "bool", "description": "Enable subtalker sampling for the remaining audio codebooks instead of greedy decoding; default true.", "required": false, "default": true }, { "name": "subtalker_temperature", "type": "float", "description": "Subtalker sampling temperature; must be > 0 when subtalker_do_sample=true. Ignored when subtalker_do_sample=false; default 0.9.", "required": false, "min": 0, "default": 0.9 }, { "name": "subtalker_top_k", "type": "int", "description": "Subtalker top-k sampling limit; default 50, 0 disables top-k filtering.", "required": false, "min": 0, "default": 50 }, { "name": "subtalker_top_p", "type": "float", "description": "Subtalker nucleus sampling limit; default 1.0.", "required": false, "min": 0, "max": 1, "default": 1 }, { "name": "seed", "type": "int", "description": "Codec sampling seed; omitted requests choose a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "reference_text", "type": "string", "description": "Transcript matching the reference audio for voice cloning; required unless x_vector_only_mode=true.", "required": false }, { "name": "x_vector_only_mode", "type": "bool", "description": "Use only the speaker embedding for voice cloning instead of ICL reference codec prompting; default false.", "required": false, "default": false }, { "name": "instruct", "type": "string", "description": "Optional natural-language voice or style instruction for VoiceDesign and CustomVoice variants; empty instructions are accepted.", "required": false }, { "name": "voice_id", "type": "enum", "description": "Named preset speaker from the CustomVoice checkpoint. Legacy speaker remains accepted.", "values": ["aiden", "dylan", "eric", "ono_anna", "ryan", "serena", "sohee", "uncle_fu", "vivian"], "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum UTF-8 codepoints per long-form text chunk; default 8192.", "required": false, "min": 1, "default": 8192 }], "session": [{ "name": "lora", "type": "path", "description": "PEFT LoRA adapter directory or checkpoint file; optional speaker_embedding and tts_config.json sidecars provide a trained custom voice.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's alpha/r scaling; default 1.", "required": false, "default": 1 }, { "name": "mem_saver", "type": "bool", "description": "Release the talker cached-step graph after each request; default false.", "required": false, "default": false }, { "name": "stitch_decode", "type": "bool", "description": "Voice the concatenated speech codes of all text chunks in one decoder pass instead of voicing each chunk separately; default false. Per-chunk voicing re-voices the voice-clone reference once per chunk and restarts the stateful vocoder cache at every chunk boundary; the stitched pass costs device memory proportional to the utterance.", "required": false, "default": false }, { "name": "attention", "type": "enum", "description": "Attention preference; default mixed uses manual prefill and contiguous-K/V flash cached decoding in the talker and code predictor, with eager speech tokenization. auto uses the shared backend policy; eager disables flash; flash uses flash with K/V views. Explicit values override perf_mode.", "values": ["mixed", "auto", "eager", "flash"], "required": false, "default": "mixed" }, { "name": "packed_projections", "type": "bool", "description": "Pack QKV and gate/up projections in the talker and code predictor without changing weight dtype; default false, true with cuda_perf. Explicit values override the preset.", "required": false }, { "name": "kv_cache_write", "type": "enum", "description": "Talker and code-predictor cache writes: standard by default, optimized with cuda_perf. Optimized uses backend-friendly views and I64 indices to allow fusion where supported. Explicit values override the preset.", "values": ["standard", "optimized"], "required": false }, { "name": "kv_cache_type", "type": "enum", "description": "Talker and code-predictor KV storage: f32 by default, f16 with cuda_perf. Explicit values override the preset. F16 reduces cache memory and may change numerical results.", "values": ["f32", "f16"], "required": false }, { "name": "talker_kv_cache_alignment", "type": "int", "description": "Round talker KV capacity to this many rows. Defaults to 1 (no padding), or 256 with perf_mode=cuda_perf. Explicit values override the preset. Larger alignments may use more memory and change numerical results.", "min": 1, "default": 1, "required": false }, { "name": "stream_decoder", "type": "enum", "description": "GGML streaming decoder; stateful carries convolution and attention history and caches graphs for exact chunk lengths. Uses more graph memory and can change audio; default windowed preserves existing behavior.", "values": ["windowed", "stateful"], "default": "windowed", "required": false }, { "name": "perf_mode", "type": "enum", "description": "Performance preset; default off. flash_attention selects flash attention. cuda_perf also selects packed projections, optimized cache writes, f16 KV and convolution weights, stateful streaming decoding, and KV alignment 256. Explicit session options override the preset. May change audio and memory use.", "values": ["off", "flash_attention", "cuda_perf"], "required": false, "default": "off" }, { "name": "voice_prompt_cache_slots", "type": "int", "description": "Voice prompt cache slots; default 1.", "required": false, "min": 0, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "Shared talker matmul weight storage type; default native.", "required": false, "default": "native", "preset": "weight_type_full" }, { "name": "talker_weight_type", "type": "enum", "description": "Talker weight storage type; defaults to weight_type when set, otherwise native.", "required": false, "preset": "weight_type_full" }, { "name": "speech_encoder_weight_type", "type": "enum", "description": "Reference speech encoder matmul weight storage type; default native.", "required": false, "default": "native", "preset": "weight_type_full" }, { "name": "speech_decoder_weight_type", "type": "enum", "description": "Speech decoder matmul weight storage type; default native.", "required": false, "default": "native", "preset": "weight_type_full" }, { "name": "conv_weight_type", "type": "enum", "description": "Speech tokenizer and speaker-encoder convolution weight storage type; default f32.", "required": false, "default": "f32", "preset": "weight_type_conv" }, { "name": "exec_plan", "type": "string", "required": false, "default": "{}", "description": "JSON object of component execution plans. Component: speech_decoder. Each plan accepts impl, backend, artifacts, and params. impl is default/ggml/rknn. GGML supports the session backend. RKNN requires artifacts.main, optionally artifacts.first for the first streaming group, and ENGINE_ENABLE_RKNN; omit backend. RKNN skips GGML decoder weights. Neither implementation takes params." }, { "name": "talker_graph_arena_mb", "type": "int", "description": "Talker graph arena size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "speech_encoder_graph_arena_mb", "type": "int", "description": "Reference speech encoder graph arena size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "speech_decoder_graph_arena_mb", "type": "int", "description": "Speech decoder graph arena size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "speaker_encoder_graph_arena_mb", "type": "int", "description": "Speaker encoder graph arena size in MiB; default 32.", "required": false, "min": 1, "default": 32 }, { "name": "talker_constant_context_mb", "type": "int", "description": "Talker constant tensor context size in MiB; default 4.", "required": false, "min": 1, "default": 4 }, { "name": "code_predictor_constant_context_mb", "type": "int", "description": "Code predictor constant tensor context size in MiB; default 4.", "required": false, "min": 1, "default": 4 }, { "name": "speech_decoder_constant_context_mb", "type": "int", "description": "Speech decoder constant tensor context size in MiB; default 4.", "required": false, "min": 1, "default": 4 }], "load": [] };
const runtime$y = { "tags": ["gguf"] };
const ui$y = { "recommended_package": "qwen3_tts_1_7b_base_q8_0", "tags": ["TTS", "Clone", "Design", "GGUF"], "docs": ["docs/models/qwen3_tts.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$t = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$z = [{ "id": "qwen3_tts_1_7b_base_q8_0", "display_name": "Qwen3 TTS 12Hz 1.7B Base Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Qwen3-TTS-12Hz-1.7B-Base-GGUF", "files": ["Qwen3-TTS-12Hz-1.7B-Base-GGUF/qwen3-tts-12hz-1.7b-base-q8_0_v2.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-1.7B-Base-GGUF" }, { "id": "qwen3_tts_1_7b_base_bf16", "display_name": "Qwen3 TTS 12Hz 1.7B Base BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Qwen3-TTS-12Hz-1.7B-Base-GGUF", "files": ["Qwen3-TTS-12Hz-1.7B-Base-GGUF/qwen3-tts-12hz-1.7b-base-bf16.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-1.7B-Base-GGUF" }, { "id": "qwen3_tts_1_7b_base_orig", "display_name": "Qwen3 TTS 12Hz 1.7B Base Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "Qwen3-TTS-12Hz-1.7B-Base-GGUF", "files": ["Qwen3-TTS-12Hz-1.7B-Base-GGUF/qwen3-tts-12hz-1.7b-base-orig.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-1.7B-Base-GGUF" }, { "id": "qwen3_tts_1_7b_customvoice_q8_0", "display_name": "Qwen3 TTS 12Hz 1.7B CustomVoice Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Qwen3-TTS-12Hz-1.7B-CustomVoice-GGUF", "files": ["Qwen3-TTS-12Hz-1.7B-CustomVoice-GGUF/qwen3-tts-12hz-1.7b-customvoice-q8_0.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-1.7B-CustomVoice-GGUF" }, { "id": "qwen3_tts_1_7b_customvoice_bf16", "display_name": "Qwen3 TTS 12Hz 1.7B CustomVoice BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Qwen3-TTS-12Hz-1.7B-CustomVoice-GGUF", "files": ["Qwen3-TTS-12Hz-1.7B-CustomVoice-GGUF/qwen3-tts-12hz-1.7b-customvoice-bf16.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-1.7B-CustomVoice-GGUF" }, { "id": "qwen3_tts_1_7b_voicedesign_q8_0", "display_name": "Qwen3 TTS 12Hz 1.7B VoiceDesign Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Qwen3-TTS-12Hz-1.7B-VoiceDesign-GGUF", "files": ["Qwen3-TTS-12Hz-1.7B-VoiceDesign-GGUF/qwen3-tts-12hz-1.7b-voicedesign-q8_0.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-1.7B-VoiceDesign-GGUF" }, { "id": "qwen3_tts_1_7b_voicedesign_bf16", "display_name": "Qwen3 TTS 12Hz 1.7B VoiceDesign BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Qwen3-TTS-12Hz-1.7B-VoiceDesign-GGUF", "files": ["Qwen3-TTS-12Hz-1.7B-VoiceDesign-GGUF/qwen3-tts-12hz-1.7b-voicedesign-bf16.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-1.7B-VoiceDesign-GGUF" }, { "id": "qwen3_tts_0_6b_base_q8_0", "display_name": "Qwen3 TTS 12Hz 0.6B Base Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Qwen3-TTS-12Hz-0.6B-Base-GGUF", "files": ["Qwen3-TTS-12Hz-0.6B-Base-GGUF/qwen3-tts-12hz-0.6b-base-q8_0.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-0.6B-Base-GGUF" }, { "id": "qwen3_tts_0_6b_base_bf16", "display_name": "Qwen3 TTS 12Hz 0.6B Base BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Qwen3-TTS-12Hz-0.6B-Base-GGUF", "files": ["Qwen3-TTS-12Hz-0.6B-Base-GGUF/qwen3-tts-12hz-0.6b-base-bf16.gguf"], "strip_prefix": "Qwen3-TTS-12Hz-0.6B-Base-GGUF" }, { "id": "qwen3_tts_1_7b_base_safetensors", "display_name": "Qwen3 TTS 12Hz 1.7B Base Safetensors", "format": "safetensors", "precision": "native", "target_directory": "Qwen3-TTS-12Hz-1.7B-Base", "files": ["config.json", "generation_config.json", "model.safetensors", "speech_tokenizer/config.json", "speech_tokenizer/model.safetensors", "tokenizer_config.json", "vocab.json", "merges.txt"], "download": { "kind": "huggingface_snapshot", "repo": "Qwen/Qwen3-TTS-12Hz-1.7B-Base" } }, { "id": "qwen3_tts_0_6b_base_speech_decoder_rk3588", "display_name": "Qwen3 TTS 12Hz 0.6B NPU Speech Decoder RKNN Pair (RK3588)", "format": "rknn", "precision": "f16", "target_directory": "Qwen3-TTS-12Hz-0.6B-Base-GGUF", "files": ["rk3588/qwen3-tts/vocoder_stateful_16_fp16.rknn", "rk3588/qwen3-tts/vocoder_stateful_64b_fp16.rknn"], "strip_prefix": "rk3588/qwen3-tts", "description": "Pre-compiled RK3588 engine pair (chunk 16 for the first streaming group, chunk 64 for the rest) for the qwen3_tts RKNN speech decoder (qwen3_tts.exec_plan, artifacts.main/first); installs beside the 0.6B GGUF weights and is named by bare file name. Built by tools/rknn from the Qwen3-TTS-12Hz speech tokenizer decoder; see docs/build/rockchip-npu.md.", "download": { "kind": "huggingface_snapshot", "repo": "wOvANAI/rknn-tts-engines", "revision": "main", "gated": false } }];
const sources$y = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt", "speech_tokenizer_config": "model:speech_tokenizer/config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "speech_tokenizer_weights": { "source": "weights:", "prefix": "speech_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_config": "model:tokenizer_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt", "speech_tokenizer_config": "model:speech_tokenizer/config.json" }, "tensors": { "model_weights": "model:model.safetensors", "speech_tokenizer_weights": "model:speech_tokenizer/model.safetensors" } }];
const __vite_glob_0_99 = {
  family: family$y,
  display_name: display_name$y,
  description: description$y,
  category: category$y,
  status: status$y,
  tasks: tasks$y,
  modes: modes$y,
  languages: languages$y,
  capabilities: capabilities$y,
  options: options$y,
  runtime: runtime$y,
  ui: ui$y,
  package_defaults: package_defaults$t,
  packages: packages$z,
  sources: sources$y
};
const schema_version$o = 1;
const family$x = "reuse";
const display_name$x = "RE-USE";
const description$x = "Sample-rate-independent speech restoration with bidirectional Mamba.";
const category$x = "audio_tools";
const status$x = "supported";
const tasks$x = ["s2s"];
const modes$x = ["offline"];
const languages$x = ["language_agnostic"];
const capabilities$x = { "s2s": ["audio_enhancement"] };
const runtime$x = { "tags": ["gguf"] };
const options$x = { "request": [{ "name": "audio_chunk_duration_sec", "type": "float", "description": "Chunk duration in seconds; zero processes the whole recording. When enabled, the chunk sample count must exceed sample_rate/50. Chunking changes bidirectional and normalization context. Native batching requires zero; positive chunk durations are supported only for single requests.", "min": 0, "default": 0, "required": false }, { "name": "audio_chunk_overlap_sec", "type": "float", "description": "Hann-weighted overlap in seconds, shorter than the chunk duration. Applies only to single-request chunking; native batching ignores this setting.", "min": 0, "default": 1, "required": false }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; native preserves GGUF tensor types.", "preset": "weight_type_full", "default": "native", "required": false }], "load": [] };
const package_defaults$s = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/RE-USE-GGUF", "revision": "main", "gated": false } };
const packages$y = [{ "id": "reuse_f32", "display_name": "RE-USE F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "RE-USE-GGUF", "files": ["reuse-f32.gguf"] }, { "id": "reuse_f16", "display_name": "RE-USE F16 GGUF", "default": false, "format": "gguf", "precision": "f16", "target_directory": "RE-USE-GGUF", "files": ["reuse-f16.gguf"] }, { "id": "reuse_q8_0", "display_name": "RE-USE Q8_0 GGUF", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "RE-USE-GGUF", "files": ["reuse-q8_0.gguf"] }];
const dependencies$o = [];
const ui$x = { "recommended_package": "reuse_f32", "tags": ["GGUF"], "docs": ["docs/models/reuse.md", "docs/audio_tools.md", "docs/gguf.md"] };
const sources$x = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_100 = {
  schema_version: schema_version$o,
  family: family$x,
  display_name: display_name$x,
  description: description$x,
  category: category$x,
  status: status$x,
  tasks: tasks$x,
  modes: modes$x,
  languages: languages$x,
  capabilities: capabilities$x,
  runtime: runtime$x,
  options: options$x,
  package_defaults: package_defaults$s,
  packages: packages$y,
  dependencies: dependencies$o,
  ui: ui$x,
  sources: sources$x
};
const schema_version$n = 1;
const family$w = "rvc";
const display_name$w = "RVC";
const description$w = "RVC is an offline retrieval-based voice conversion family packaged for audio.cpp with native HuBERT content features, RMVPE pitch extraction, optional IVF retrieval blending, packaged v1/v2 voices, and support for user-supplied RVC checkpoints.";
const category$w = "voice_conversion";
const status$w = "experimental";
const tasks$w = ["vc"];
const modes$w = ["offline"];
const languages$w = ["language_agnostic"];
const runtime$w = { "tags": ["gguf"] };
const capabilities$w = {};
const options$w = { "request": [{ "name": "voice_id", "type": "enum", "description": "Packaged RVC voice id; default selects the v2 default voice. Ignored when voice_model_path is provided.", "values": ["default", "manthos", "chocola", "fraise"], "required": false, "default": "default" }, { "name": "voice_model_path", "type": "path", "description": "Optional user RVC .pth or .pt voice checkpoint path. When set, this overrides the packaged voice id.", "required": false }, { "name": "pitch_extractor", "type": "enum", "description": "Pitch extraction method for F0-enabled voices; the native path currently supports rmvpe only.", "values": ["rmvpe"], "required": false, "default": "rmvpe" }, { "name": "pitch_file", "type": "path", "description": "Optional CSV F0 override file with time,Hz rows sorted by time.", "required": false }, { "name": "retrieval_index_file", "type": "path", "description": "Optional user FAISS .index retrieval path used when retrieval_blend is greater than 0 for a user voice model.", "required": false }, { "name": "retrieval_blend", "type": "float", "description": "IVF retrieval feature blend rate; default 0 disables retrieval blending.", "required": false, "min": 0, "max": 1, "default": 0 }, { "name": "semitone_shift", "type": "int", "description": "Semitone pitch shift applied before synthesis; default 0.", "required": false, "default": 0 }, { "name": "pitch_filter_radius", "type": "int", "description": "Pitch median-filter switch: values >2 enable a radius-1 filter; values <=2 disable it.", "required": false, "default": 3 }, { "name": "output_sample_rate", "type": "int", "description": "Output sample rate in Hz; default 0 keeps the selected voice model sample rate. Nonpositive values preserve the voice sample rate.", "required": false, "default": 0 }, { "name": "rms_mix_rate", "type": "float", "description": "RMS envelope mix rate applied after conversion; default 0.25.", "required": false, "default": 0.25 }, { "name": "unvoiced_protection", "type": "float", "description": "Unvoiced consonant protection strength; must be in [0, 1], default 0.33.", "required": false, "min": 0, "max": 1, "default": 0.33 }, { "name": "speaker_id", "type": "int", "description": "Speaker embedding id for multi-speaker RVC checkpoints; default 0.", "required": false, "min": 0, "default": 0 }, { "name": "audio_pad_duration_sec", "type": "int", "description": "Long-audio chunk pad duration in seconds; default 1.", "required": false, "min": 1, "default": 1 }, { "name": "split_query_sec", "type": "int", "description": "Quiet-point query window in seconds for long-audio splitting; default 5.", "required": false, "min": 1, "default": 5 }, { "name": "split_center_sec", "type": "int", "description": "Long-audio split center stride in seconds; default 30.", "required": false, "min": 1, "default": 30 }, { "name": "split_threshold_sec", "type": "int", "description": "Input duration in seconds before quiet-point splitting is used; default 32.", "required": false, "min": 1, "default": 32 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Tensor storage type for native RVC, HuBERT, and RMVPE weights; default f32.", "preset": "weight_type_full", "required": false, "default": "f32" }, { "name": "voice_cache_slots", "type": "int", "description": "User voice model cache slots; default 4, set 0 to disable caching.", "required": false, "min": 0, "default": 4 }], "load": [] };
const package_defaults$r = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$x = [{ "id": "rvc_f16", "display_name": "RVC F16 GGUF", "default": true, "format": "gguf", "precision": "f16", "target_directory": "RVC-GGUF", "files": ["RVC-GGUF/rvc-f16.gguf"], "strip_prefix": "RVC-GGUF" }];
const dependencies$n = [];
const ui$w = { "recommended_package": "rvc_f16", "tags": ["VC", "GGUF"], "docs": ["docs/audio_tools.md", "docs/gguf.md"] };
const sources$w = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "voice_v1_chocola_index": "model:voices/v1/chocola/added_IVF732_Flat_nprobe_1.index", "voice_v1_fraise_index": "model:voices/v1/fraise/added_IVF802_Flat_nprobe_1.index", "voice_v2_default_index": "model:voices/v2/default/added_IVF511_Flat_nprobe_1_default_v2.index", "voice_v2_manthos_index": "model:voices/v2/manthos/added_IVF2586_Flat_nprobe_1_manthos_v2.index" }, "tensors": { "support_hubert_base": { "source": "weights:", "prefix": "support_hubert_base" }, "support_rmvpe": { "source": "weights:", "prefix": "support_rmvpe" }, "voice_v1_chocola_checkpoint": { "source": "weights:", "prefix": "voice_v1_chocola_checkpoint" }, "voice_v1_chocola_index_vectors": { "source": "weights:", "prefix": "voice_v1_chocola_index_vectors" }, "voice_v1_fraise_checkpoint": { "source": "weights:", "prefix": "voice_v1_fraise_checkpoint" }, "voice_v1_fraise_index_vectors": { "source": "weights:", "prefix": "voice_v1_fraise_index_vectors" }, "voice_v2_default_checkpoint": { "source": "weights:", "prefix": "voice_v2_default_checkpoint" }, "voice_v2_default_index_vectors": { "source": "weights:", "prefix": "voice_v2_default_index_vectors" }, "voice_v2_manthos_checkpoint": { "source": "weights:", "prefix": "voice_v2_manthos_checkpoint" }, "voice_v2_manthos_index_vectors": { "source": "weights:", "prefix": "voice_v2_manthos_index_vectors" } } }, { "format": "safetensors", "roots": { "safetensors": "../safetensors" }, "files": { "voice_v1_chocola_index": "safetensors:voices/v1/chocola/added_IVF732_Flat_nprobe_1.index", "voice_v1_fraise_index": "safetensors:voices/v1/fraise/added_IVF802_Flat_nprobe_1.index", "voice_v2_default_index": "safetensors:voices/v2/default/added_IVF511_Flat_nprobe_1_default_v2.index", "voice_v2_manthos_index": "safetensors:voices/v2/manthos/added_IVF2586_Flat_nprobe_1_manthos_v2.index" }, "tensors": { "support_hubert_base": "safetensors:support/hubert_base.safetensors", "support_rmvpe": "safetensors:support/rmvpe.safetensors", "voice_v1_chocola_checkpoint": "safetensors:voices/v1/chocola/chocola2333333.safetensors", "voice_v1_chocola_index_vectors": "safetensors:voices/v1/chocola/added_IVF732_Flat_nprobe_1.ivf.safetensors", "voice_v1_fraise_checkpoint": "safetensors:voices/v1/fraise/fraise2333333.safetensors", "voice_v1_fraise_index_vectors": "safetensors:voices/v1/fraise/added_IVF802_Flat_nprobe_1.ivf.safetensors", "voice_v2_default_checkpoint": "safetensors:voices/v2/default/default.safetensors", "voice_v2_default_index_vectors": "safetensors:voices/v2/default/added_IVF511_Flat_nprobe_1_default_v2.ivf.safetensors", "voice_v2_manthos_checkpoint": "safetensors:voices/v2/manthos/manthos.safetensors", "voice_v2_manthos_index_vectors": "safetensors:voices/v2/manthos/added_IVF2586_Flat_nprobe_1_manthos_v2.ivf.safetensors" } }];
const __vite_glob_0_101 = {
  schema_version: schema_version$n,
  family: family$w,
  display_name: display_name$w,
  description: description$w,
  category: category$w,
  status: status$w,
  tasks: tasks$w,
  modes: modes$w,
  languages: languages$w,
  runtime: runtime$w,
  capabilities: capabilities$w,
  options: options$w,
  package_defaults: package_defaults$r,
  packages: packages$x,
  dependencies: dependencies$n,
  ui: ui$w,
  sources: sources$w
};
const schema_version$m = 1;
const family$v = "sam_audio";
const display_name$v = "SAM Audio";
const description$v = "Prompt-conditioned audio separation.";
const category$v = "audio_tools";
const status$v = "supported";
const tasks$v = ["s2s"];
const modes$v = ["offline"];
const languages$v = ["language_agnostic"];
const capabilities$v = {};
const runtime$v = { "tags": ["gguf"] };
const options$v = { "request": [{ "name": "reference_video_file", "type": "path", "description": "Masked video identifying the target source; frames are matched to audio by nearest timestamp. Requires libav runtime libraries. Mutually exclusive with reference_image_file.", "required": false }, { "name": "reference_image_file", "type": "path", "description": "Masked RGB image identifying the target sound source, used as a constant visual prompt throughout the recording. Mask unwanted regions before supplying the image.", "required": false }, { "name": "anchors", "type": "string", "description": 'Optional JSON array of time spans: [["+", start_seconds, end_seconds], ["-", start_seconds, end_seconds]]. Positive spans identify the target; negative spans identify sounds to exclude.', "required": false }, { "name": "seed", "type": "int", "description": "Random seed; -1 selects a random seed.", "min": -1, "max": 4294967295, "default": 42, "required": false }, { "name": "num_inference_steps", "type": "int", "description": "Midpoint integration steps; each step evaluates the denoiser twice.", "min": 1, "default": 16, "required": false }], "session": [{ "name": "memory_bounded", "type": "bool", "description": "Experimental bounded-workspace execution with full recording context. Provisional option name.", "default": false, "required": false }], "load": [] };
const package_defaults$q = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/SAM-Audio-GGUF", "revision": "main", "gated": false } };
const packages$w = [{ "id": "sam_audio_small_f32", "display_name": "SAM Audio Small F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-small-f32.gguf"] }, { "id": "sam_audio_small_bf16", "display_name": "SAM Audio Small BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-small-bf16.gguf"] }, { "id": "sam_audio_small_q8_0", "display_name": "SAM Audio Small Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-small-q8_0.gguf"] }, { "id": "sam_audio_base_f32", "display_name": "SAM Audio Base F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-base-f32.gguf"] }, { "id": "sam_audio_base_bf16", "display_name": "SAM Audio Base BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-base-bf16.gguf"] }, { "id": "sam_audio_base_q8_0", "display_name": "SAM Audio Base Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-base-q8_0.gguf"] }, { "id": "sam_audio_large_f32", "display_name": "SAM Audio Large F32 GGUF", "format": "gguf", "precision": "f32", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-large-f32.gguf"] }, { "id": "sam_audio_large_bf16", "display_name": "SAM Audio Large BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-large-bf16.gguf"] }, { "id": "sam_audio_large_q8_0", "display_name": "SAM Audio Large Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "SAM-Audio-GGUF", "files": ["sam-audio-large-q8_0.gguf"] }];
const dependencies$m = [];
const ui$v = { "recommended_package": "sam_audio_small_f32", "tags": ["GGUF"], "docs": ["docs/models/sam_audio.md", "docs/audio_tools.md", "docs/gguf.md"] };
const sources$v = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "t5_config": "model:t5_config.json", "tokenizer": "model:tokenizer/spiece.model" }, "tensors": { "weights": { "source": "weights:" } } }];
const __vite_glob_0_102 = {
  schema_version: schema_version$m,
  family: family$v,
  display_name: display_name$v,
  description: description$v,
  category: category$v,
  status: status$v,
  tasks: tasks$v,
  modes: modes$v,
  languages: languages$v,
  capabilities: capabilities$v,
  runtime: runtime$v,
  options: options$v,
  package_defaults: package_defaults$q,
  packages: packages$w,
  dependencies: dependencies$m,
  ui: ui$v,
  sources: sources$v
};
const schema_version$l = 1;
const family$u = "samsone";
const display_name$u = "SAMSONE";
const description$u = "Compact audio-language models for audio captioning, question answering, and sound, music, and speech understanding.";
const category$u = "asr";
const status$u = "supported";
const tasks$u = ["asr"];
const modes$u = ["offline"];
const languages$u = ["en"];
const capabilities$u = {};
const runtime$u = { "tags": ["gguf"] };
const options$u = { "request": [{ "name": "instruct", "type": "string", "default": "describe the audio", "required": false, "description": "Question or instruction about the input audio." }, { "name": "max_tokens", "type": "int", "min": 1, "default": 100, "required": false, "description": "Maximum response tokens. Must be positive; audio/prompt tokens plus this budget must fit checkpoint max_position_embeddings." }], "session": [], "load": [] };
const package_defaults$p = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$v = [{ "id": "samsone_99m_bf16", "display_name": "SAMSONE 99M GGUF BF16", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "Samsone-GGUF", "files": ["Samsone-GGUF/samsone-99m-bf16.gguf"], "strip_prefix": "Samsone-GGUF" }, { "id": "samsone_99m_q8_0", "display_name": "SAMSONE 99M GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Samsone-GGUF", "files": ["Samsone-GGUF/samsone-99m-q8_0.gguf"], "strip_prefix": "Samsone-GGUF" }, { "id": "samsone_134m_bf16", "display_name": "SAMSONE 134M GGUF BF16", "format": "gguf", "precision": "bf16", "target_directory": "Samsone-GGUF", "files": ["Samsone-GGUF/samsone-134m-bf16.gguf"], "strip_prefix": "Samsone-GGUF" }, { "id": "samsone_134m_q8_0", "display_name": "SAMSONE 134M GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Samsone-GGUF", "files": ["Samsone-GGUF/samsone-134m-q8_0.gguf"], "strip_prefix": "Samsone-GGUF" }, { "id": "samsone_356m_bf16", "display_name": "SAMSONE 356M GGUF BF16", "format": "gguf", "precision": "bf16", "target_directory": "Samsone-GGUF", "files": ["Samsone-GGUF/samsone-356m-bf16.gguf"], "strip_prefix": "Samsone-GGUF" }, { "id": "samsone_356m_q8_0", "display_name": "SAMSONE 356M GGUF Q8_0", "format": "gguf", "precision": "q8_0", "target_directory": "Samsone-GGUF", "files": ["Samsone-GGUF/samsone-356m-q8_0.gguf"], "strip_prefix": "Samsone-GGUF" }];
const dependencies$l = [];
const ui$u = { "tags": ["GGUF"], "docs": ["docs/models/samsone.md"], "recommended_package": "samsone_99m_bf16" };
const sources$u = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "token_map": "model:token_map.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_103 = {
  schema_version: schema_version$l,
  family: family$u,
  display_name: display_name$u,
  description: description$u,
  category: category$u,
  status: status$u,
  tasks: tasks$u,
  modes: modes$u,
  languages: languages$u,
  capabilities: capabilities$u,
  runtime: runtime$u,
  options: options$u,
  package_defaults: package_defaults$p,
  packages: packages$v,
  dependencies: dependencies$l,
  ui: ui$u,
  sources: sources$u
};
const schema_version$k = 1;
const family$t = "sanotts";
const display_name$t = "sanoTTS Nano";
const description$t = "Very small multilingual text-to-speech across fourteen languages. Two graphs: the nano lineage (duration student, contextual acoustic student to mel-100, noise-fed ConvNeXt-1D decoder with an iSTFT head; voices heart 2.27M and heart-nano 294k, English, 24 kHz) and the deterministic piperlite lineage (duration student, acoustic student to a 192-channel latent, optionally through a calibration adapter, then a 3-stage ConvTranspose1d decoder with dilated residual banks; voices amy, hfc and kristin for English, vi, id, cs, de, es, fr, it, pt, ro, ru, tr, ne and hi at 1.1-1.8M parameters, 22.05 kHz). Uses an external eSpeak-ng phonemizer.";
const category$t = "tts";
const status$t = "community";
const tasks$t = ["tts"];
const modes$t = ["offline"];
const languages$t = ["en", "vi", "id", "cs", "de", "es", "fr", "it", "pt", "ro", "ru", "tr", "ne", "hi"];
const runtime$t = { "tags": ["gguf"] };
const capabilities$t = { "tts": ["long_form"] };
const options$t = { "request": [{ "name": "speed", "type": "float", "description": "Speech speed multiplier; larger is faster. Its reciprocal scales the voice's tuned length scale before the per-token clamp.", "required": false, "min": 0.5, "max": 2, "default": 1 }, { "name": "seed", "type": "int", "description": "Decoder noise seed. The decoder is noise-fed, so a given seed picks one of many valid renderings; 0 derives it from the text as sha256(text)[:8], which is what the reference implementations do. Piperlite voices are deterministic and ignore the seed.", "required": false, "min": 0, "default": 0 }, { "name": "text_chunk_mode", "type": "enum", "description": "Long-form text chunking mode.", "values": ["word_budget"], "required": false, "default": "word_budget" }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per long-form text chunk; default 280.", "required": false, "min": 1, "default": 280 }], "session": [{ "name": "espeak_library_path", "type": "path", "description": "Optional explicit path to the eSpeak-ng shared library.", "required": false }, { "name": "espeak_data_path", "type": "path", "description": "Optional explicit path to the directory containing espeak-ng-data.", "required": false }, { "name": "exec_plan", "type": "string", "description": "JSON object of component execution plans. Component: decoder. Each plan accepts impl, backend, artifacts, and params. impl is default/ggml/neon; no artifacts or params are used. Default retains automatic NEON selection on supported Nano-lineage AArch64 CPU sessions. GGML supports the session backend; explicit NEON requires a Nano-lineage model, AArch64 NEON, and a CPU session.", "required": false, "default": "{}" }], "load": [] };
const package_defaults$o = { "download": { "kind": "huggingface_snapshot", "repo": "ampixa/sanoTTS", "revision": "main", "gated": false } };
const packages$u = [{ "id": "sanotts_heart_nano_orig", "display_name": "sanoTTS heart-nano 294k FP32 GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-heart-nano-GGUF", "files": ["gguf/heart-nano-f32.gguf", "gguf/config.json"], "strip_prefix": "gguf" }, { "id": "sanotts_heart_orig", "display_name": "sanoTTS heart 2.27M FP32 GGUF", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-heart-GGUF", "files": ["gguf/heart/heart-f32.gguf", "gguf/heart/config.json"], "strip_prefix": "gguf/heart" }, { "id": "sanotts_amy_orig", "display_name": "sanoTTS amy 1.46M FP32 GGUF (English, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-amy-GGUF", "files": ["gguf/amy/amy-f32.gguf", "gguf/amy/config.json"], "strip_prefix": "gguf/amy" }, { "id": "sanotts_hfc_orig", "display_name": "sanoTTS hfc 1.83M FP32 GGUF (English, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-hfc-GGUF", "files": ["gguf/hfc/hfc-f32.gguf", "gguf/hfc/config.json"], "strip_prefix": "gguf/hfc" }, { "id": "sanotts_kristin_orig", "display_name": "sanoTTS kristin 1.40M FP32 GGUF (English, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-kristin-GGUF", "files": ["gguf/kristin/kristin-f32.gguf", "gguf/kristin/config.json"], "strip_prefix": "gguf/kristin" }, { "id": "sanotts_vi_orig", "display_name": "sanoTTS vi 1.57M FP32 GGUF (Vietnamese, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-vi-GGUF", "files": ["gguf/vi/vi-f32.gguf", "gguf/vi/config.json"], "strip_prefix": "gguf/vi" }, { "id": "sanotts_id_orig", "display_name": "sanoTTS id 1.56M FP32 GGUF (Indonesian, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-id-GGUF", "files": ["gguf/id/id-f32.gguf", "gguf/id/config.json"], "strip_prefix": "gguf/id" }, { "id": "sanotts_cs_orig", "display_name": "sanoTTS cs 1.57M FP32 GGUF (Czech, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-cs-GGUF", "files": ["gguf/cs/cs-f32.gguf", "gguf/cs/config.json"], "strip_prefix": "gguf/cs" }, { "id": "sanotts_de_orig", "display_name": "sanoTTS de 1.57M FP32 GGUF (German, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-de-GGUF", "files": ["gguf/de/de-f32.gguf", "gguf/de/config.json"], "strip_prefix": "gguf/de" }, { "id": "sanotts_es_orig", "display_name": "sanoTTS es 1.56M FP32 GGUF (Spanish, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-es-GGUF", "files": ["gguf/es/es-f32.gguf", "gguf/es/config.json"], "strip_prefix": "gguf/es" }, { "id": "sanotts_fr_orig", "display_name": "sanoTTS fr 1.57M FP32 GGUF (French, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-fr-GGUF", "files": ["gguf/fr/fr-f32.gguf", "gguf/fr/config.json"], "strip_prefix": "gguf/fr" }, { "id": "sanotts_it_orig", "display_name": "sanoTTS it 1.57M FP32 GGUF (Italian, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-it-GGUF", "files": ["gguf/it/it-f32.gguf", "gguf/it/config.json"], "strip_prefix": "gguf/it" }, { "id": "sanotts_pt_orig", "display_name": "sanoTTS pt 1.57M FP32 GGUF (Portuguese (Brazil), piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-pt-GGUF", "files": ["gguf/pt/pt-f32.gguf", "gguf/pt/config.json"], "strip_prefix": "gguf/pt" }, { "id": "sanotts_ro_orig", "display_name": "sanoTTS ro 1.57M FP32 GGUF (Romanian, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-ro-GGUF", "files": ["gguf/ro/ro-f32.gguf", "gguf/ro/config.json"], "strip_prefix": "gguf/ro" }, { "id": "sanotts_ru_orig", "display_name": "sanoTTS ru 1.57M FP32 GGUF (Russian, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-ru-GGUF", "files": ["gguf/ru/ru-f32.gguf", "gguf/ru/config.json"], "strip_prefix": "gguf/ru" }, { "id": "sanotts_tr_orig", "display_name": "sanoTTS tr 1.56M FP32 GGUF (Turkish, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-tr-GGUF", "files": ["gguf/tr/tr-f32.gguf", "gguf/tr/config.json"], "strip_prefix": "gguf/tr" }, { "id": "sanotts_ne_orig", "display_name": "sanoTTS ne 1.47M FP32 GGUF (Nepali, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-ne-GGUF", "files": ["gguf/ne/ne-f32.gguf", "gguf/ne/config.json"], "strip_prefix": "gguf/ne" }, { "id": "sanotts_hi_orig", "display_name": "sanoTTS hi 1.50M FP32 GGUF (Hindi, piperlite)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "sanoTTS-hi-GGUF", "files": ["gguf/hi/hi-f32.gguf", "gguf/hi/config.json"], "strip_prefix": "gguf/hi" }];
const dependencies$k = [];
const ui$t = { "recommended_package": "sanotts_heart_nano_orig", "tags": ["TTS", "GGUF"], "docs": ["docs/tts.md", "docs/models/sanotts.md", "docs/gguf.md"] };
const sources$t = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_104 = {
  schema_version: schema_version$k,
  family: family$t,
  display_name: display_name$t,
  description: description$t,
  category: category$t,
  status: status$t,
  tasks: tasks$t,
  modes: modes$t,
  languages: languages$t,
  runtime: runtime$t,
  capabilities: capabilities$t,
  options: options$t,
  package_defaults: package_defaults$o,
  packages: packages$u,
  dependencies: dependencies$k,
  ui: ui$t,
  sources: sources$t
};
const family$s = "seed_vc";
const schema_version$j = 1;
const display_name$s = "Seed-VC";
const description$s = "Zero-shot voice conversion and singing voice conversion model for transferring timbre and style from reference audio, with low-latency realtime conversion and optional lightweight fine-tuning.";
const category$s = "voice_conversion";
const status$s = "supported";
const tasks$s = ["vc", "svc"];
const modes$s = ["offline"];
const languages$s = ["language_agnostic"];
const capabilities$s = { "vc": ["speaker_reference"], "svc": ["speaker_reference", "singing"] };
const dependencies$j = [];
const runtime$s = { "tags": ["gguf"] };
const ui$s = { "recommended_package": "seed_vc_mlx_q8_0", "tags": ["VC", "GGUF"], "docs": ["docs/models/seed_vc.md", "docs/audio_tools.md", "docs/gguf.md"] };
const options$s = { "request": [{ "name": "route", "type": "enum", "description": "Select the Seed-VC conversion route. Defaults to v2_vc for VC and v1_svc for SVC.", "values": ["v2_vc", "v1_svc", "v1_whisper_bigvgan_vc", "v1_xlsr_hift_vc"], "required": false }, { "name": "duration_scale", "type": "float", "description": "V1 output duration multiplier; must be finite and positive, default 1.0. V2 validates this option but does not apply it.", "required": false, "min": 0, "default": 1 }, { "name": "num_inference_steps", "type": "int", "description": "Diffusion steps; default 30.", "required": false, "min": 1, "default": 30 }, { "name": "inference_guidance_scale", "type": "float", "description": "V1 classifier-free guidance scale; default 0.7. Any finite value is accepted; V1 disables CFG for nonpositive values.", "required": false, "default": 0.7 }, { "name": "intelligibility_guidance_scale", "type": "float", "description": "V2 classifier-free guidance scale for source-content intelligibility; default 0.7. Any finite value is accepted and used in V2 guidance arithmetic.", "required": false, "default": 0.7 }, { "name": "similarity_guidance_scale", "type": "float", "description": "V2 classifier-free guidance scale for target-speaker similarity; default 0.7. Any finite value is accepted and used in V2 guidance arithmetic.", "required": false, "default": 0.7 }, { "name": "voice_anonymization", "type": "bool", "description": "Use randomized average-voice conditioning instead of target-speaker conditioning for V2 anonymization; default false.", "required": false, "default": false }, { "name": "seed", "type": "int", "description": "Seed for V1/V2 diffusion noise and HiFT stochastic source excitation; omitted requests choose a random seed.", "required": false, "min": 0 }, { "name": "noise_file", "type": "path", "description": "Optional raw f32 noise file for deterministic V1/V2 diffusion noise and XLSR/HiFT source excitation.", "required": false }, { "name": "f0_condition", "type": "bool", "description": "Enable V1 F0 conditioning. Defaults to true for v1_svc and false for the V1 voice-conversion routes.", "required": false }, { "name": "auto_f0_adjust", "type": "bool", "description": "Automatically adjust V1 source pitch toward the target pitch level; default false.", "required": false, "default": false }, { "name": "semitone_shift", "type": "int", "description": "V1 pitch shift in semitones for singing voice conversion; default 0.", "required": false, "default": 0 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared Seed-VC component weight storage type; default native, except RMVPE uses f32 unless overridden.", "preset": "weight_type_full", "required": false, "default": "native" }], "load": [] };
const package_defaults$n = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$t = [{ "id": "seed_vc_mlx_q8_0", "display_name": "SeedVC-MLX Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "SeedVC-MLX-GGUF", "files": ["SeedVC-MLX-GGUF/seed-vc-mlx-q8_0.gguf"], "strip_prefix": "SeedVC-MLX-GGUF" }, { "id": "seed_vc_mlx_f16", "display_name": "SeedVC-MLX F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "SeedVC-MLX-GGUF", "files": ["SeedVC-MLX-GGUF/seed-vc-mlx-f16.gguf"], "strip_prefix": "SeedVC-MLX-GGUF" }, { "id": "seed_vc_mlx_orig", "display_name": "SeedVC-MLX Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "SeedVC-MLX-GGUF", "files": ["SeedVC-MLX-GGUF/seed-vc-mlx-orig.gguf"], "strip_prefix": "SeedVC-MLX-GGUF" }, { "id": "seed_vc_mlx_safetensors", "display_name": "SeedVC-MLX Safetensors", "format": "safetensors", "precision": "native", "target_directory": "SeedVC-MLX", "files": ["seed_vc_manifest.json", "v2/ar.safetensors", "v2/cfm.safetensors", "v2/vc_wrapper.json", "astral/bsq32.json", "astral/bsq2048.json", "v1/svc.json", "v1/whisper_bigvgan.json", "v1/xlsr_hift.json", "hift/config.json", "bigvgan/v2_22khz_80band_256x/config.json", "bigvgan/v2_44khz_128band_512x/config.json", "whisper-small/config.json", "hubert-large-ll60k/config.json", "wav2vec2-xls-r-300m/config.json", "v1/svc.safetensors", "v1/whisper_bigvgan.safetensors", "v1/xlsr_hift.safetensors", "astral/bsq32.safetensors", "astral/bsq2048.safetensors", "campplus/model.safetensors", "rmvpe/model.safetensors", "hift/model.safetensors", "bigvgan/v2_22khz_80band_256x/model.safetensors", "bigvgan/v2_44khz_128band_512x/model.safetensors", "whisper-small/model.safetensors", "hubert-large-ll60k/model.safetensors", "wav2vec2-xls-r-300m/model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "mlx-community/SeedVC-MLX" } }];
const sources$s = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "manifest": "model:seed_vc_manifest.json", "v2_wrapper_config": "model:v2/vc_wrapper.json", "astral_bsq32_config": "model:astral/bsq32.json", "astral_bsq2048_config": "model:astral/bsq2048.json", "v1_svc_config": "model:v1/svc.json", "v1_whisper_bigvgan_config": "model:v1/whisper_bigvgan.json", "v1_xlsr_hift_config": "model:v1/xlsr_hift.json", "hift_config": "model:hift/config.json", "bigvgan_22k_config": "model:bigvgan/v2_22khz_80band_256x/config.json", "bigvgan_44k_config": "model:bigvgan/v2_44khz_128band_512x/config.json", "whisper_small_config": "model:whisper-small/config.json", "hubert_large_config": "model:hubert-large-ll60k/config.json", "wav2vec2_xlsr_config": "model:wav2vec2-xls-r-300m/config.json" }, "tensors": { "v2_ar_weights": { "source": "weights:", "prefix": "v2_ar_weights" }, "v2_cfm_weights": { "source": "weights:", "prefix": "v2_cfm_weights" }, "v1_svc_weights": { "source": "weights:", "prefix": "v1_svc_weights" }, "v1_whisper_bigvgan_weights": { "source": "weights:", "prefix": "v1_whisper_bigvgan_weights" }, "v1_xlsr_hift_weights": { "source": "weights:", "prefix": "v1_xlsr_hift_weights" }, "astral_bsq32_weights": { "source": "weights:", "prefix": "astral_bsq32_weights" }, "astral_bsq2048_weights": { "source": "weights:", "prefix": "astral_bsq2048_weights" }, "campplus_weights": { "source": "weights:", "prefix": "campplus_weights" }, "rmvpe_weights": { "source": "weights:", "prefix": "rmvpe_weights" }, "hift_weights": { "source": "weights:", "prefix": "hift_weights" }, "bigvgan_22k_weights": { "source": "weights:", "prefix": "bigvgan_22k_weights" }, "bigvgan_44k_weights": { "source": "weights:", "prefix": "bigvgan_44k_weights" }, "whisper_small_weights": { "source": "weights:", "prefix": "whisper_small_weights" }, "hubert_large_weights": { "source": "weights:", "prefix": "hubert_large_weights" }, "wav2vec2_xlsr_weights": { "source": "weights:", "prefix": "wav2vec2_xlsr_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "manifest": "model:seed_vc_manifest.json", "v2_wrapper_config": "model:v2/vc_wrapper.json", "astral_bsq32_config": "model:astral/bsq32.json", "astral_bsq2048_config": "model:astral/bsq2048.json", "v1_svc_config": "model:v1/svc.json", "v1_whisper_bigvgan_config": "model:v1/whisper_bigvgan.json", "v1_xlsr_hift_config": "model:v1/xlsr_hift.json", "hift_config": "model:hift/config.json", "bigvgan_22k_config": "model:bigvgan/v2_22khz_80band_256x/config.json", "bigvgan_44k_config": "model:bigvgan/v2_44khz_128band_512x/config.json", "whisper_small_config": "model:whisper-small/config.json", "hubert_large_config": "model:hubert-large-ll60k/config.json", "wav2vec2_xlsr_config": "model:wav2vec2-xls-r-300m/config.json" }, "tensors": { "v2_ar_weights": "model:v2/ar.safetensors", "v2_cfm_weights": "model:v2/cfm.safetensors", "v1_svc_weights": "model:v1/svc.safetensors", "v1_whisper_bigvgan_weights": "model:v1/whisper_bigvgan.safetensors", "v1_xlsr_hift_weights": "model:v1/xlsr_hift.safetensors", "astral_bsq32_weights": "model:astral/bsq32.safetensors", "astral_bsq2048_weights": "model:astral/bsq2048.safetensors", "campplus_weights": "model:campplus/model.safetensors", "rmvpe_weights": "model:rmvpe/model.safetensors", "hift_weights": "model:hift/model.safetensors", "bigvgan_22k_weights": "model:bigvgan/v2_22khz_80band_256x/model.safetensors", "bigvgan_44k_weights": "model:bigvgan/v2_44khz_128band_512x/model.safetensors", "whisper_small_weights": "model:whisper-small/model.safetensors", "hubert_large_weights": "model:hubert-large-ll60k/model.safetensors", "wav2vec2_xlsr_weights": "model:wav2vec2-xls-r-300m/model.safetensors" } }];
const __vite_glob_0_105 = {
  family: family$s,
  schema_version: schema_version$j,
  display_name: display_name$s,
  description: description$s,
  category: category$s,
  status: status$s,
  tasks: tasks$s,
  modes: modes$s,
  languages: languages$s,
  capabilities: capabilities$s,
  dependencies: dependencies$j,
  runtime: runtime$s,
  ui: ui$s,
  options: options$s,
  package_defaults: package_defaults$n,
  packages: packages$t,
  sources: sources$s
};
const schema_version$i = 1;
const family$r = "sense_asr";
const display_name$r = "SenseVoice-Small";
const description$r = "SenseVoice-Small multilingual speech recognition with rich event/emotion/ITN tags via a SAN-M encoder and CTC head, ported to audio.cpp.";
const category$r = "asr";
const status$r = "community";
const tasks$r = ["asr"];
const modes$r = ["offline", "streaming"];
const languages$r = ["auto", "zh", "en", "yue", "ja", "ko", "pt", "ru", "es", "it", "fr", "de", "nl", "pl", "tr", "ar", "hi", "vi", "th", "id", "ms", "fa", "nospeech"];
const capabilities$r = { "asr": ["vad_chunking", "partial_results"] };
const options$r = { "request": [{ "name": "language", "type": "string", "description": "Recognition language, or auto to let the model infer it from the audio.", "required": false, "default": "auto" }, { "name": "enable_itn", "type": "bool", "description": "Enable inverse text normalization (adds the withitn query token).", "required": false, "default": true }, { "name": "keep_tags", "type": "bool", "description": "Keep <|event|>/<|emotion|>/<|language|> tags inline in the output text.", "required": false, "default": false }, { "name": "audio_chunk_mode", "type": "enum", "description": "Offline chunk mode: auto, fixed, vad, or none. Streaming always uses fixed-duration windows.", "values": ["auto", "fixed", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Positive duration rounding to at least one sample; sets fixed windows and the VAD maximum chunk length.", "required": false, "default": 30 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared model weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "encoder_graph_arena_mb", "type": "int", "description": "Encoder graph arena size in MB.", "required": false, "min": 1, "default": 1024 }, { "name": "vad_model_path", "type": "string", "description": "Path to the VAD model (any built-in VAD family; default Silero VAD) used by automatic audio chunking.", "required": false, "default": "assets/framework/models/silero_vad" }], "load": [] };
const runtime$r = { "tags": ["gguf", "server", "stream", "cuda", "metal", "cpu"] };
const packages$s = [{ "id": "sensevoice_small_q8", "display_name": "SenseVoice-Small Q8 GGUF", "description": "audio.cpp GGUF built from the SenseVoice-Small checkpoint via the SenseVoice llama.cpp export script.", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "SenseVoice-Small-GGUF", "files": ["sensevoice-small-q8-audiocpp-v1.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "FunAudioLLM/SenseVoiceSmall-GGUF-audiocpp", "revision": "5c3fcfe748a8714216bc135476d5863084fddb72", "gated": false } }];
const dependencies$i = [];
const ui$r = { "recommended_package": "sensevoice_small_q8", "tags": ["ASR", "GGUF", "Stream"], "docs": ["docs/models/sense_asr.md"], "summary": "SenseVoice-Small transcription with event/emotion tags and ITN." };
const sources$r = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": {}, "optional_files": {}, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_106 = {
  schema_version: schema_version$i,
  family: family$r,
  display_name: display_name$r,
  description: description$r,
  category: category$r,
  status: status$r,
  tasks: tasks$r,
  modes: modes$r,
  languages: languages$r,
  capabilities: capabilities$r,
  options: options$r,
  runtime: runtime$r,
  packages: packages$s,
  dependencies: dependencies$i,
  ui: ui$r,
  sources: sources$r
};
const schema_version$h = 1;
const family$q = "sheetsage2";
const display_name$q = "SheetSage2";
const description$q = "SheetSage2 audio-to-symbolic transcription. This native path consumes an input recording from a self-contained GGUF and emits an ABC score artifact.";
const category$q = "audio_tools";
const status$q = "supported";
const tasks$q = ["midi"];
const modes$q = ["offline"];
const languages$q = ["music"];
const runtime$q = { "tags": ["gguf", "cuda"] };
const capabilities$q = { "midi": ["midi_artifact"] };
const options$q = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum total decoder sequence length; default follows the embedded model context. Omitted uses checkpoint max_output_seq_len.", "required": false, "min": 1 }], "session": [{ "name": "attention_tile_rows", "type": "int", "description": "Query rows per encoder attention tile on any backend; 0 disables tiling. Use 1024 to bound each score tensor below 512 MiB for the 300-second window.", "required": false, "min": 0, "default": 0 }, { "name": "weight_type", "type": "enum", "description": "Encoder and decoder weight storage override.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_k"] }, { "name": "weight_context_mb", "type": "int", "description": "Weight context arena size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "decoder_graph_arena_mb", "type": "int", "description": "Encoder/decoder graph arena size in MiB; default 1536.", "required": false, "min": 1, "default": 1536 }], "load": [] };
const package_defaults$m = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/SheetSage2-GGUF", "revision": "main", "gated": false } };
const packages$r = [{ "id": "sheetsage2_orig", "display_name": "SheetSage2 Original-Dtype GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "SheetSage2-GGUF", "files": ["sheetsage2-orig.gguf"] }];
const dependencies$h = [];
const ui$q = { "recommended_package": "sheetsage2_orig", "tags": ["Music", "MIDI", "GGUF"], "docs": [] };
const sources$q = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": "weights:" } }];
const __vite_glob_0_107 = {
  schema_version: schema_version$h,
  family: family$q,
  display_name: display_name$q,
  description: description$q,
  category: category$q,
  status: status$q,
  tasks: tasks$q,
  modes: modes$q,
  languages: languages$q,
  runtime: runtime$q,
  capabilities: capabilities$q,
  options: options$q,
  package_defaults: package_defaults$m,
  packages: packages$r,
  dependencies: dependencies$h,
  ui: ui$q,
  sources: sources$q
};
const schema_version$g = 1;
const family$p = "sherpa_kws";
const display_name$p = "sherpa-onnx Zipformer KWS";
const description$p = "Streaming Zipformer transducer keyword spotting from sherpa-onnx model exports.";
const category$p = "audio_tools";
const status$p = "experimental";
const tasks$p = ["wake_word"];
const modes$p = ["offline", "streaming"];
const languages$p = ["model_dependent"];
const capabilities$p = { "wake_word": ["speech_segments", "stream_events"] };
const runtime$p = { "tags": ["gguf", "stream"] };
const options$p = { "request": [{ "name": "keywords", "type": "string", "description": "Newline- or slash-separated tokenized keyword rows; each row may include :score, #threshold, and @label fields.", "required": false }, { "name": "max_active_paths", "type": "int", "description": "Maximum keyword decoder hypotheses.", "required": false, "default": 4, "min": 1, "max": 64 }, { "name": "keywords_score", "type": "float", "description": "Default context score added for each matched keyword token. Negative values are accepted but token scores are clamped to at least zero.", "required": false, "default": 1 }, { "name": "keywords_threshold", "type": "float", "description": "Default mean acoustic probability required to trigger a keyword.", "required": false, "default": 0.25, "min": 0, "max": 1 }, { "name": "num_trailing_blanks", "type": "int", "description": "Emit after strictly more than this many trailing blank frames; 1 requires 2 blanks, 0 requires 1.", "required": false, "default": 1, "min": 0 }], "session": [], "load": [] };
const package_defaults$l = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$q = [{ "id": "sherpa_kws_zipformer_zh_en_3m_f32", "display_name": "Sherpa KWS Zipformer Chinese-English 3M GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Sherpa-KWS-GGUF", "files": ["Sherpa-KWS-GGUF/sherpa-kws-zipformer-zh-en-3m-f32.gguf"], "strip_prefix": "Sherpa-KWS-GGUF" }];
const dependencies$g = [];
const ui$p = { "tags": ["Wake Word", "GGUF", "Stream"], "docs": ["docs/models/sherpa_kws.md"], "recommended_package": "sherpa_kws_zipformer_zh_en_3m_f32" };
const sources$p = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokens": "model:tokens.txt", "keywords": "model:keywords.txt" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokens": "model:tokens.txt", "keywords": "model:keywords.txt" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_108 = {
  schema_version: schema_version$g,
  family: family$p,
  display_name: display_name$p,
  description: description$p,
  category: category$p,
  status: status$p,
  tasks: tasks$p,
  modes: modes$p,
  languages: languages$p,
  capabilities: capabilities$p,
  runtime: runtime$p,
  options: options$p,
  package_defaults: package_defaults$l,
  packages: packages$q,
  dependencies: dependencies$g,
  ui: ui$p,
  sources: sources$p
};
const schema_version$f = 1;
const family$o = "sidon";
const display_name$o = "Sidon v0.1";
const description$o = "Single-speaker speech restoration with 48 kHz output.";
const category$o = "audio_tools";
const status$o = "supported";
const tasks$o = ["s2s"];
const modes$o = ["offline"];
const languages$o = ["language_agnostic"];
const capabilities$o = { "s2s": ["audio_enhancement"] };
const runtime$o = { "tags": ["gguf"] };
const options$o = { "request": [], "session": [], "load": [] };
const package_defaults$k = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$p = [{ "id": "sidon_f32", "display_name": "Sidon v0.1 F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Sidon-GGUF", "files": ["Sidon-GGUF/sidon-v0.1-f32.gguf"], "strip_prefix": "Sidon-GGUF" }];
const dependencies$f = [];
const ui$o = { "recommended_package": "sidon_f32", "tags": ["GGUF"], "docs": ["docs/models/sidon.md"] };
const sources$o = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": {}, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_109 = {
  schema_version: schema_version$f,
  family: family$o,
  display_name: display_name$o,
  description: description$o,
  category: category$o,
  status: status$o,
  tasks: tasks$o,
  modes: modes$o,
  languages: languages$o,
  capabilities: capabilities$o,
  runtime: runtime$o,
  options: options$o,
  package_defaults: package_defaults$k,
  packages: packages$p,
  dependencies: dependencies$f,
  ui: ui$o,
  sources: sources$o
};
const schema_version$e = 1;
const family$n = "smart_turn";
const display_name$n = "Smart Turn v3.2";
const description$n = "Audio-native conversational turn-completion detection using a Whisper-Tiny encoder and attention-pooling classifier.";
const category$n = "audio_tools";
const status$n = "supported";
const tasks$n = ["turn"];
const modes$n = ["offline"];
const languages$n = ["auto"];
const capabilities$n = { "turn": ["turn_decision"] };
const runtime$n = { "tags": ["gguf"] };
const options$n = { "request": [{ "name": "threshold", "type": "float", "description": "Completion probability threshold; a decision is complete only when probability exceeds this value.", "required": false, "default": 0.5, "min": 0, "max": 1 }], "session": [], "load": [] };
const package_defaults$j = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$o = [{ "id": "smart_turn_v3_2_f32", "display_name": "Smart Turn v3.2 F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Smart-Turn-v3-GGUF", "files": ["Smart-Turn-v3-GGUF/smart-turn-v3.2-f32.gguf"], "strip_prefix": "Smart-Turn-v3-GGUF" }];
const dependencies$e = [];
const ui$n = { "tags": ["GGUF"], "docs": ["docs/models/smart_turn.md"], "recommended_package": "smart_turn_v3_2_f32" };
const sources$n = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_110 = {
  schema_version: schema_version$e,
  family: family$n,
  display_name: display_name$n,
  description: description$n,
  category: category$n,
  status: status$n,
  tasks: tasks$n,
  modes: modes$n,
  languages: languages$n,
  capabilities: capabilities$n,
  runtime: runtime$n,
  options: options$n,
  package_defaults: package_defaults$j,
  packages: packages$o,
  dependencies: dependencies$e,
  ui: ui$n,
  sources: sources$n
};
const schema_version$d = 1;
const family$m = "soprano_tts";
const display_name$m = "Soprano";
const description$m = "Soprano is an ultra-lightweight (~80M) English-only text-to-speech model. Syntax uses a 17-layer Qwen3-style causal LM (hidden 512, vocab 8192) that autoregressively emits per-frame 512-dimensional features; a non-iterative Vocos-style decoder (ConvNeXt backbone + single ISTFT head, n_fft 2048 / hop 512) turns those features into 32 kHz audio. No diffusion refinement is performed in the decoder.";
const category$m = "tts";
const status$m = "community";
const tasks$m = ["tts"];
const modes$m = ["offline", "streaming"];
const languages$m = ["en"];
const runtime$m = { "tags": ["gguf", "stream"] };
const capabilities$m = { "tts": ["long_form"] };
const options$m = { "request": [{ "name": "max_tokens", "type": "int", "description": "Maximum generated audio frames for the autoregressive LM; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "temperature", "type": "float", "description": "Autoregressive sampling temperature; must be > 0, default 0.3.", "required": false, "min": 0, "default": 0.3 }, { "name": "top_p", "type": "float", "description": "Nucleus sampling probability; default 0.95. Values >=1 disable nucleus filtering.", "required": false, "min": 0, "default": 0.95 }, { "name": "repetition_penalty", "type": "float", "description": "Repetition penalty applied to the LM head; default 1.2. Must be positive; values below 1 are accepted.", "required": false, "default": 1.2 }, { "name": "eos_bias", "type": "float", "description": "Additive bias on the EOS token logit during generation. Positive values make the model stop sooner when speech ends (mitigating runaway generations that hit max_tokens); negative values encourage longer utterances. Default 0 disables the adjustment.", "required": false, "default": 0 }, { "name": "seed", "type": "int", "description": "Autoregressive sampling seed; omitted requests choose a random seed.", "required": false, "min": 0 }], "session": [{ "name": "text_chunk_size", "type": "int", "description": "Maximum codepoints per sentence chunk before the model generates and decodes separately. Smaller values keep prompts short (more reliable EOS) but increase overhead. Default 200.", "required": false, "min": 1, "default": 200 }, { "name": "backbone_weight_type", "type": "enum", "preset": "weight_type_full", "required": false, "default": "f32", "description": "Storage type for the Qwen3 LM backbone weights." }, { "name": "decoder_weight_type", "type": "enum", "preset": "weight_type_conv", "required": false, "default": "f32", "description": "Storage type for the Vocos decoder weights." }], "load": [] };
const package_defaults$i = { "download": { "kind": "huggingface_snapshot", "repo": "WalkingCat/Soprano-1.1-80M-GGUF", "revision": "main", "gated": false } };
const packages$n = [{ "id": "soprano_1_1_80m_q8_0", "display_name": "Soprano-1.1-80M Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Soprano-1.1-80M-GGUF", "files": ["Soprano-1.1-80M-GGUF/soprano-1.1-80m-q8_0.gguf"], "strip_prefix": "Soprano-1.1-80M-GGUF" }, { "id": "soprano_1_1_80m_bf16", "display_name": "Soprano-1.1-80M BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Soprano-1.1-80M-GGUF", "files": ["Soprano-1.1-80M-GGUF/soprano-1.1-80m-bf16.gguf"], "strip_prefix": "Soprano-1.1-80M-GGUF" }];
const dependencies$d = [];
const ui$m = { "recommended_package": "soprano_1_1_80m_q8_0", "tags": ["TTS", "Stream"], "docs": ["docs/models/soprano_tts.md"] };
const sources$m = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "backbone": "weights:", "decoder": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "tokenizer_json": "model:tokenizer.json" }, "tensors": { "backbone": "model:combined.safetensors", "decoder": "model:combined.safetensors" } }];
const __vite_glob_0_111 = {
  schema_version: schema_version$d,
  family: family$m,
  display_name: display_name$m,
  description: description$m,
  category: category$m,
  status: status$m,
  tasks: tasks$m,
  modes: modes$m,
  languages: languages$m,
  runtime: runtime$m,
  capabilities: capabilities$m,
  options: options$m,
  package_defaults: package_defaults$i,
  packages: packages$n,
  dependencies: dependencies$d,
  ui: ui$m,
  sources: sources$m
};
const schema_version$c = 1;
const family$l = "sopro_tts";
const display_name$l = "Sopro V2 Turbo";
const description$l = "Community Sopro V2 Turbo (samuel-vitorino/sopro-v2-turbo): a 120M zero-shot voice-cloning TTS. SentencePiece text tokenizer, style-prefix conditioned autoregressive semantic LM over FSQ tokens, rectified-flow acoustic DiT and a Vocos ISTFT vocoder at 24 kHz.";
const category$l = "tts";
const status$l = "community";
const tasks$l = ["tts", "clone"];
const modes$l = ["offline", "streaming"];
const languages$l = ["en", "pt", "fr", "de"];
const runtime$l = { "tags": ["server"] };
const capabilities$l = { "clone": ["speaker_reference"] };
const options$l = { "request": [{ "name": "language", "type": "string", "description": "Language tag (en, pt, fr, de); omitted inherits transcript language, then the session default.", "required": false }, { "name": "temperature", "type": "float", "description": "Semantic sampling temperature; nonpositive selects greedy decoding. Omitted uses checkpoint generation.temperature.", "required": false }, { "name": "top_p", "type": "float", "description": "Semantic nucleus cutoff; values outside [0,1] are disabled/clamped by the sampler. Omitted uses checkpoint generation.top_p.", "required": false }, { "name": "top_k", "type": "int", "description": "Semantic top-k; nonpositive disables filtering. Omitted uses checkpoint generation.top_k.", "required": false }, { "name": "num_inference_steps", "type": "int", "description": "Positive acoustic sampling steps; omitted uses checkpoint generation.steps.", "required": false, "min": 1 }, { "name": "max_duration_sec", "type": "float", "description": "Positive maximum segment duration; must be >= min_duration_sec. Omitted uses checkpoint generation.max_seconds.", "required": false }, { "name": "min_duration_sec", "type": "float", "description": "Nonnegative minimum duration; must be <= max_duration_sec. Omitted uses checkpoint generation.min_seconds.", "required": false, "min": 0 }, { "name": "reference_duration_sec", "type": "float", "description": "Positive reference window in seconds; omitted uses checkpoint generation.ref_seconds.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Positive codepoint budget per segment; omitted uses checkpoint generation.max_segment_chars.", "required": false, "min": 1 }, { "name": "seed", "type": "int", "description": "Non-negative seed for semantic sampling and the acoustic noise prior; omit for a random seed.", "required": false, "min": 0 }], "session": [{ "name": "language", "type": "string", "description": "Default language tag for requests that do not set one.", "required": false, "default": "" }, { "name": "voice_cache_slots", "type": "int", "description": "Reference voices kept prepared between requests, so a repeated voice skips the encoders and, when streaming, the prompt solve. Output is identical with or without it. A streamed 10 s voice holds about 60 MB. Default 0 (off).", "required": false, "min": 0, "default": 0 }, { "name": "matmul_weight_type", "type": "enum", "preset": "weight_type_full", "description": "Storage type for the matmul weights of every stage (semantic LM, acoustic DiT, encoders, vocoder head).", "required": false, "default": "f32" }, { "name": "conv_weight_type", "type": "enum", "preset": "weight_type_conv", "description": "Storage type for convolution weights (speaker/semantic encoders and the Vocos backbone).", "required": false, "default": "f32" }], "load": [] };
const packages$m = [{ "id": "sopro_v2_turbo_f16", "display_name": "Sopro V2 Turbo F16 GGUF", "description": "Single-file GGUF of all four stages with the config and tokenizer embedded: f16 weights, mel front ends kept in f32.", "default": true, "format": "gguf", "precision": "f16", "target_directory": "sopro-v2-turbo-GGUF", "files": ["sopro-v2-turbo-f16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "samuel-vitorino/sopro-v2-turbo", "revision": "main", "gated": false } }, { "id": "sopro_v2_turbo_safetensors", "display_name": "Sopro V2 Turbo (upstream safetensors)", "description": "Upstream checkpoint from samuel-vitorino/sopro-v2-turbo: config.json, tokenizer.model and the four safetensors stages. Runs directly, no conversion needed.", "format": "safetensors", "precision": "orig", "target_directory": "sopro-v2-turbo", "files": ["config.json", "tokenizer.model", "model.safetensors", "semantic_encoder.safetensors", "speaker_encoder.safetensors", "vocoder.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "samuel-vitorino/sopro-v2-turbo", "revision": "main", "gated": false } }];
const dependencies$c = [];
const ui$l = { "recommended_package": "sopro_v2_turbo_safetensors", "tags": ["TTS", "Clone"], "docs": ["docs/models/sopro_tts.md"] };
const sources$l = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "model": { "source": "weights:", "prefix": "model" }, "semantic_encoder": { "source": "weights:", "prefix": "semantic_encoder" }, "speaker_encoder": { "source": "weights:", "prefix": "speaker_encoder" }, "vocoder": { "source": "weights:", "prefix": "vocoder" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer": "model:tokenizer.model" }, "tensors": { "model": { "source": "model:model.safetensors" }, "semantic_encoder": { "source": "model:semantic_encoder.safetensors" }, "speaker_encoder": { "source": "model:speaker_encoder.safetensors" }, "vocoder": { "source": "model:vocoder.safetensors" } } }];
const __vite_glob_0_112 = {
  schema_version: schema_version$c,
  family: family$l,
  display_name: display_name$l,
  description: description$l,
  category: category$l,
  status: status$l,
  tasks: tasks$l,
  modes: modes$l,
  languages: languages$l,
  runtime: runtime$l,
  capabilities: capabilities$l,
  options: options$l,
  packages: packages$m,
  dependencies: dependencies$c,
  ui: ui$l,
  sources: sources$l
};
const schema_version$b = 1;
const family$k = "sortformer_diar";
const display_name$k = "Sortformer Diarization";
const description$k = "NVIDIA Transformer-based end-to-end speaker diarization model trained primarily on English speech, predicting speaker labels directly from audio and resolving speaker ordering by arrival time for up to four speakers.";
const category$k = "speech_analysis";
const status$k = "supported";
const tasks$k = ["diar"];
const modes$k = ["offline"];
const languages$k = ["en"];
const capabilities$k = { "diar": ["speaker_turns"] };
const dependencies$b = [];
const options$k = { "request": [{ "name": "speaker_threshold", "type": "float", "description": "Speaker activity probability threshold used when decoding speaker turns; default 0.5.", "required": false, "min": 0, "max": 1, "default": 0.5 }, { "name": "speaker_min_frames", "type": "int", "description": "Minimum decoded segment length in model output frames; default 0 disables short-segment filtering.", "required": false, "min": 0, "default": 0 }, { "name": "speaker_pad_frames", "type": "int", "description": "Pad each decoded speaker segment by this many model output frames before filtering and merging; default 0.", "required": false, "min": 0, "default": 0 }], "session": [{ "name": "graph_arena_mb", "type": "int", "description": "Inference graph arena size in MiB; default 512.", "required": false, "min": 1, "default": 512 }, { "name": "weight_context_mb", "type": "int", "description": "Weight context size in MiB; default 128.", "required": false, "min": 1, "default": 128 }, { "name": "session_len_sec", "type": "float", "description": "Base offline graph context length in seconds; must be > 0, default 20.", "required": false, "min": 0, "default": 20 }, { "name": "graph_capacity_mode", "type": "enum", "description": "Offline graph capacity policy; defaults to tiered on host-graph backends and fixed otherwise.", "values": ["fixed", "tiered", "grow", "double"], "required": false }, { "name": "speaker_threshold", "type": "float", "description": "Default speaker activity probability threshold for decoded speaker turns; default 0.5.", "required": false, "min": 0, "max": 1, "default": 0.5 }, { "name": "speaker_min_frames", "type": "int", "description": "Default minimum decoded segment length in model output frames; default 0 disables short-segment filtering.", "required": false, "min": 0, "default": 0 }, { "name": "speaker_pad_frames", "type": "int", "description": "Default decoded segment padding in model output frames; default 0.", "required": false, "min": 0, "default": 0 }, { "name": "weight_type", "type": "enum", "description": "All weight storage type; default f32.", "preset": "weight_type_full", "required": false, "default": "f32" }, { "name": "matmul_weight_type", "type": "enum", "description": "Matmul weight storage type; defaults to weight_type when set, otherwise f32.", "preset": "weight_type_full", "required": false }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage type; defaults to weight_type when set, otherwise f32.", "preset": "weight_type_full", "required": false }], "load": [] };
const runtime$k = { "tags": ["gguf"] };
const ui$k = { "recommended_package": "sortformer_diar_4spk_v1_q8_0", "tags": ["Diar", "GGUF"], "docs": ["docs/audio_tools.md", "docs/gguf.md"] };
const package_defaults$h = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$l = [{ "id": "sortformer_diar_4spk_v1_q8_0", "display_name": "Sortformer Diar 4spk v1 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Sortformer-Diar-4spk-v1-GGUF", "files": ["Sortformer-Diar-4spk-v1-GGUF/sortformer-diar-4spk-v1-q8_0.gguf"], "strip_prefix": "Sortformer-Diar-4spk-v1-GGUF" }, { "id": "sortformer_diar_4spk_v1_f16", "display_name": "Sortformer Diar 4spk v1 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Sortformer-Diar-4spk-v1-GGUF", "files": ["Sortformer-Diar-4spk-v1-GGUF/sortformer-diar-4spk-v1-f16.gguf"], "strip_prefix": "Sortformer-Diar-4spk-v1-GGUF" }, { "id": "sortformer_diar_4spk_v1_safetensors", "display_name": "Sortformer Diar 4spk v1 Safetensors", "format": "safetensors", "precision": "native", "target_directory": "diar_sortformer_4spk-v1", "files": ["config.json", "model.safetensors", "processor_config.json"], "download": { "kind": "huggingface_snapshot", "repo": "nvidia/diar_sortformer_4spk-v1" } }];
const sources$k = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "processor": "model:processor_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "processor": "model:processor_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_113 = {
  schema_version: schema_version$b,
  family: family$k,
  display_name: display_name$k,
  description: description$k,
  category: category$k,
  status: status$k,
  tasks: tasks$k,
  modes: modes$k,
  languages: languages$k,
  capabilities: capabilities$k,
  dependencies: dependencies$b,
  options: options$k,
  runtime: runtime$k,
  ui: ui$k,
  package_defaults: package_defaults$h,
  packages: packages$l,
  sources: sources$k
};
const schema_version$a = 1;
const family$j = "sortformer_diar_v2";
const display_name$j = "Sortformer Diarization v2.1";
const description$j = "NVIDIA Sortformer v2.1 streaming speaker diarization model with four speaker channels, AOSC state, stable arrival-order speaker identities, and bounded-context offline and streaming execution. The model has no published language whitelist: it was trained primarily on English speech, includes non-English meeting data such as AISHELL-4 and AliMeeting, and may degrade on other languages. The checkpoint is governed by the NVIDIA Open Model License and is local-use only until redistribution approval.";
const category$j = "speech_analysis";
const status$j = "community";
const tasks$j = ["diar"];
const modes$j = ["offline", "streaming"];
const languages$j = ["multilingual"];
const capabilities$j = { "diar": ["speaker_turns"] };
const dependencies$a = [];
const options$j = { "request": [{ "name": "speaker_threshold", "type": "float", "description": "Speaker activity threshold used for turn decoding; default 0.5.", "required": false, "min": 0, "max": 1, "default": 0.5 }, { "name": "speaker_min_frames", "type": "int", "description": "Minimum decoded turn duration in 80 ms model frames; default 0.", "required": false, "min": 0, "default": 0 }, { "name": "speaker_pad_frames", "type": "int", "description": "Padding applied to decoded turns in model frames; default 0.", "required": false, "min": 0, "default": 0 }], "session": [{ "name": "graph_arena_mb", "type": "int", "description": "Inference graph arena size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "weight_context_mb", "type": "int", "description": "Weight context size in MiB; default 1024.", "required": false, "min": 1, "default": 1024 }, { "name": "geometry", "type": "enum", "description": "Streaming geometry preset; default uses the checkpoint geometry.", "values": ["model", "streaming", "very_high_latency", "high_latency", "low_latency"], "required": false, "default": "model" }, { "name": "weight_type", "type": "enum", "description": "Default storage type for all model weights; default f32. With bf16/q8_0, also set conv_weight_type explicitly to native/f32/f16; convolution storage cannot inherit bf16/q8_0.", "preset": "weight_type_full", "required": false, "default": "f32" }, { "name": "matmul_weight_type", "type": "enum", "description": "Matmul weight storage type; defaults to weight_type.", "preset": "weight_type_full", "required": false }, { "name": "conv_weight_type", "type": "enum", "description": "Convolution weight storage type; defaults to weight_type.", "preset": "weight_type_conv", "required": false }], "load": [] };
const runtime$j = { "tags": ["gguf", "stream"] };
const ui$j = { "recommended_package": "sortformer_diar_v2_1_f32_gguf_local", "tags": ["Diar", "Stream", "GGUF"], "docs": ["docs/models/sortformer_diar_v2.md", "docs/speech_analysis.md", "docs/gguf.md"] };
const package_defaults$g = { "download": { "kind": "unsupported", "reason": "NVIDIA Open Model License checkpoint: convert or stage locally until redistribution approval is complete." } };
const packages$k = [{ "id": "sortformer_diar_v2_1_f32_local", "display_name": "Sortformer Diar v2.1 F32 local package", "format": "safetensors", "precision": "f32", "target_directory": "Sortformer-Diar-v2.1-local", "files": ["Sortformer-Diar-v2.1-local/config.json", "Sortformer-Diar-v2.1-local/processor_config.json", "Sortformer-Diar-v2.1-local/model.safetensors"], "strip_prefix": "Sortformer-Diar-v2.1-local" }, { "id": "sortformer_diar_v2_1_f32_gguf_local", "display_name": "Sortformer Diar v2.1 F32 GGUF local package", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Sortformer-Diar-v2.1-local", "files": ["Sortformer-Diar-v2.1-local/sortformer-v2.1-f32.gguf"], "strip_prefix": "Sortformer-Diar-v2.1-local" }, { "id": "sortformer_diar_v2_1_f16_mixed_gguf_local", "display_name": "Sortformer Diar v2.1 mixed F16/F32 GGUF local package", "format": "gguf", "precision": "f16", "target_directory": "Sortformer-Diar-v2.1-local", "files": ["Sortformer-Diar-v2.1-local/sortformer-v2.1-f16-mixed.gguf"], "strip_prefix": "Sortformer-Diar-v2.1-local" }];
const sources$j = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "processor": "model:processor_config.json" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "processor": "model:processor_config.json" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_114 = {
  schema_version: schema_version$a,
  family: family$j,
  display_name: display_name$j,
  description: description$j,
  category: category$j,
  status: status$j,
  tasks: tasks$j,
  modes: modes$j,
  languages: languages$j,
  capabilities: capabilities$j,
  dependencies: dependencies$a,
  options: options$j,
  runtime: runtime$j,
  ui: ui$j,
  package_defaults: package_defaults$g,
  packages: packages$k,
  sources: sources$j
};
const family$i = "stable_audio";
const display_name$i = "Stable Audio 3";
const description$i = "Stability AI generative audio model family for text-to-music, sound effects, audio-to-audio editing, inpainting, continuation, variable-length generation, and LoRA personalization.";
const category$i = "audio_generation";
const status$i = "supported";
const tasks$i = ["music", "sfx", "edit"];
const modes$i = ["offline"];
const languages$i = ["en"];
const options$i = { "request": [{ "name": "prompt", "type": "string", "description": "Fallback text prompt when text_input is absent; pipe separates batch prompts.", "required": false }, { "name": "negative_prompt", "type": "string", "description": "Negative prompt; pipe separates batch prompts.", "required": false }, { "name": "duration_sec", "type": "float", "description": "Positive duration in seconds; batch requests also accept a comma-separated string matching the prompt count, not a JSON array.", "required": false, "default": 120 }, { "name": "batch_size", "type": "int", "description": "Prompt batch size.", "required": false, "min": 1, "default": 1 }, { "name": "num_inference_steps", "type": "int", "description": "Diffusion steps.", "required": false, "min": 1, "default": 8 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale.", "required": false, "default": 1 }, { "name": "apg_scale", "type": "float", "description": "Adaptive projected guidance scale.", "required": false, "default": 1 }, { "name": "sampler_mode", "type": "enum", "description": "Stable Audio 3 diffusion sampler.", "required": false, "values": ["pingpong", "euler"] }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted chooses a random seed.", "required": false, "min": 0 }, { "name": "duration_padding_sec", "type": "float", "description": "Generated padding before truncation.", "required": false, "min": 0, "default": 6 }, { "name": "truncate_output_to_duration", "type": "bool", "description": "Trim decoded audio to requested duration.", "required": false, "default": true }, { "name": "chunked_decode", "type": "bool", "description": "Decode audio in chunks.", "required": false, "default": true }, { "name": "init_noise_level", "type": "float", "description": "Audio-conditioned generation strength in [0, 1].", "required": false, "min": 0, "max": 1, "default": 1 }, { "name": "audio_input_kind", "type": "enum", "description": "How to use audio_input.", "required": false, "values": ["init_audio", "inpaint_audio"], "default": "init_audio" }, { "name": "inpaint_mask_start_sec", "type": "string", "description": "Comma-separated inpaint region starts in seconds.", "required": false }, { "name": "inpaint_mask_end_sec", "type": "string", "description": "Comma-separated inpaint region ends in seconds.", "required": false }], "session": [{ "name": "max_batch", "type": "int", "description": "Maximum prompt batch size.", "required": false, "min": 1, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "Weight storage type; defaults to native.", "required": false, "preset": "weight_type_full" }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime graphs after each request.", "required": false, "default": false }], "load": [] };
const capabilities$i = { "music": ["lyrics"], "sfx": ["prompt_generation"], "edit": ["prompt_editing"] };
const runtime$i = { "tags": ["gguf"] };
const ui$i = { "recommended_package": "stable_audio_3_medium_q8_0", "tags": ["Music", "SFX", "Edit", "GGUF"], "docs": ["docs/models/stable_audio.md", "docs/music_generation.md", "docs/gguf.md"] };
const package_defaults$f = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$j = [{ "id": "stable_audio_3_medium_q8_0", "display_name": "Stable Audio 3 Medium Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Stable-Audio-3-Medium-GGUF", "files": ["Stable-Audio-3-Medium-GGUF/stable-audio-3-medium-q8_0.gguf"], "strip_prefix": "Stable-Audio-3-Medium-GGUF" }, { "id": "stable_audio_3_medium_f16", "display_name": "Stable Audio 3 Medium F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Stable-Audio-3-Medium-GGUF", "files": ["Stable-Audio-3-Medium-GGUF/stable-audio-3-medium-f16.gguf"], "strip_prefix": "Stable-Audio-3-Medium-GGUF" }, { "id": "stable_audio_3_small_music_q8_0", "display_name": "Stable Audio 3 Small Music Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Stable-Audio-3-Small-Music-GGUF", "files": ["Stable-Audio-3-Small-Music-GGUF/stable-audio-3-small-music-q8_0.gguf"], "strip_prefix": "Stable-Audio-3-Small-Music-GGUF" }, { "id": "stable_audio_3_small_music_f16", "display_name": "Stable Audio 3 Small Music F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Stable-Audio-3-Small-Music-GGUF", "files": ["Stable-Audio-3-Small-Music-GGUF/stable-audio-3-small-music-f16.gguf"], "strip_prefix": "Stable-Audio-3-Small-Music-GGUF" }, { "id": "stable_audio_3_small_sfx_q8_0", "display_name": "Stable Audio 3 Small SFX Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Stable-Audio-3-Small-SFX-GGUF", "files": ["Stable-Audio-3-Small-SFX-GGUF/stable-audio-3-small-sfx-q8_0.gguf"], "strip_prefix": "Stable-Audio-3-Small-SFX-GGUF" }, { "id": "stable_audio_3_small_sfx_f16", "display_name": "Stable Audio 3 Small SFX F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Stable-Audio-3-Small-SFX-GGUF", "files": ["Stable-Audio-3-Small-SFX-GGUF/stable-audio-3-small-sfx-f16.gguf"], "strip_prefix": "Stable-Audio-3-Small-SFX-GGUF" }, { "id": "stable_audio_3_medium_safetensors", "display_name": "Stable Audio 3 Medium Safetensors", "format": "safetensors", "precision": "native", "target_directory": "stable-audio-3-medium", "files": ["model_config.json", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "stabilityai/stable-audio-3-medium", "gated": true } }, { "id": "stable_audio_3_small_music_safetensors", "display_name": "Stable Audio 3 Small Music Safetensors", "format": "safetensors", "precision": "native", "target_directory": "stable-audio-3-small-music", "files": ["model_config.json", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "stabilityai/stable-audio-3-small-music", "gated": true } }, { "id": "stable_audio_3_small_sfx_safetensors", "display_name": "Stable Audio 3 Small SFX Safetensors", "format": "safetensors", "precision": "native", "target_directory": "stable-audio-3-small-sfx", "files": ["model_config.json", "model.safetensors"], "download": { "kind": "huggingface_snapshot", "repo": "stabilityai/stable-audio-3-small-sfx", "gated": true } }];
const sources$i = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "model_config": "model:model_config.json", "t5_config": "model:t5gemma-b-b-ul2/config.json", "t5_tokenizer_json": "model:t5gemma-b-b-ul2/tokenizer.json", "t5_tokenizer_model": "model:t5gemma-b-b-ul2/tokenizer.model", "t5_tokenizer_config": "model:t5gemma-b-b-ul2/tokenizer_config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "t5_weights": { "source": "weights:", "prefix": "t5_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "t5": "t5gemma-b-b-ul2" }, "files": { "model_config": "model:model_config.json", "t5_config": "t5:config.json", "t5_tokenizer_json": "t5:tokenizer.json", "t5_tokenizer_model": "t5:tokenizer.model", "t5_tokenizer_config": "t5:tokenizer_config.json" }, "tensors": { "model_weights": "model:model.safetensors", "t5_weights": "t5:model.safetensors" } }];
const __vite_glob_0_115 = {
  family: family$i,
  display_name: display_name$i,
  description: description$i,
  category: category$i,
  status: status$i,
  tasks: tasks$i,
  modes: modes$i,
  languages: languages$i,
  options: options$i,
  capabilities: capabilities$i,
  runtime: runtime$i,
  ui: ui$i,
  package_defaults: package_defaults$f,
  packages: packages$j,
  sources: sources$i
};
const family$h = "supertonic";
const display_name$h = "Supertonic 3";
const description$h = "Supertone on-device TTS model designed for fast local speech synthesis across 31 languages, with preset voices and compact deployment for browser, mobile, and desktop applications.";
const category$h = "tts";
const status$h = "supported";
const tasks$h = ["tts"];
const modes$h = ["offline", "streaming"];
const languages$h = ["en", "ko", "ja", "ar", "bg", "cs", "da", "de", "el", "es", "et", "fi", "fr", "hi", "hr", "hu", "id", "it", "lt", "lv", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "uk", "vi"];
const capabilities$h = { "tts": ["built_in_voices", "long_form"] };
const runtime$h = { "tags": ["gguf", "stream"] };
const options$h = { "request": [{ "name": "voice_id", "type": "enum", "values": ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"], "default": "M1", "description": "Built-in voice preset; --voice-id takes precedence.", "required": false }, { "name": "num_inference_steps", "type": "int", "min": 1, "default": 8, "description": "Flow denoising steps.", "required": false }, { "name": "speed", "type": "float", "min": 0, "default": 1.05, "description": "Positive speech speed multiplier; voice.style.speaking_rate takes precedence.", "required": false }, { "name": "seed", "type": "int", "min": 0, "max": 4294967295, "default": 1234, "description": "Noise seed.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Framework text chunk size; defaults to 120 for Korean/Japanese, otherwise 300.", "required": false }, { "name": "text_chunk_mode", "type": "enum", "values": ["default", "tag_aware", "japanese", "endline"], "default": "default", "description": "Framework text chunking mode.", "required": false }], "session": [{ "name": "weight_type", "type": "enum", "preset": "weight_type_full", "default": "native", "description": "Weight storage type.", "required": false }, { "name": "style_cache_slots", "type": "int", "min": 0, "default": 4, "description": "Cached preset style slots; zero disables reuse.", "required": false }], "load": [] };
const ui$h = { "recommended_package": "supertonic_3_orig", "tags": ["TTS", "GGUF", "Stream"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const package_defaults$e = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$i = [{ "id": "supertonic_3_q8_0", "display_name": "Supertonic 3 Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "Supertonic-3-GGUF", "files": ["Supertonic-3-GGUF/supertonic-3-q8_0.gguf"], "strip_prefix": "Supertonic-3-GGUF" }, { "id": "supertonic_3_f16", "display_name": "Supertonic 3 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Supertonic-3-GGUF", "files": ["Supertonic-3-GGUF/supertonic-3-f16.gguf"], "strip_prefix": "Supertonic-3-GGUF" }, { "id": "supertonic_3_orig", "display_name": "Supertonic 3 Original-Dtype GGUF", "default": true, "format": "gguf", "precision": "orig", "target_directory": "Supertonic-3-GGUF", "files": ["Supertonic-3-GGUF/supertonic-3-orig.gguf"], "strip_prefix": "Supertonic-3-GGUF" }, { "id": "supertonic_3_safetensors", "display_name": "Supertonic 3 Safetensors", "format": "safetensors", "precision": "native", "target_directory": "supertonic-3", "files": ["config/tts.json", "config/unicode_indexer.json", "ggml/supertonic.safetensors", "voice_styles/F1.json", "voice_styles/F2.json", "voice_styles/F3.json", "voice_styles/F4.json", "voice_styles/F5.json", "voice_styles/M1.json", "voice_styles/M2.json", "voice_styles/M3.json", "voice_styles/M4.json", "voice_styles/M5.json"], "download": { "kind": "huggingface_snapshot", "repo": "mlx-community/supertonic-3-mlx" } }];
const sources$h = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "tts_config": "model:config/tts.json", "unicode_indexer": "model:config/unicode_indexer.json", "voice_style_F1": "model:voice_styles/F1.json", "voice_style_F2": "model:voice_styles/F2.json", "voice_style_F3": "model:voice_styles/F3.json", "voice_style_F4": "model:voice_styles/F4.json", "voice_style_F5": "model:voice_styles/F5.json", "voice_style_M1": "model:voice_styles/M1.json", "voice_style_M2": "model:voice_styles/M2.json", "voice_style_M3": "model:voice_styles/M3.json", "voice_style_M4": "model:voice_styles/M4.json", "voice_style_M5": "model:voice_styles/M5.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "tts_config": "model:config/tts.json", "unicode_indexer": "model:config/unicode_indexer.json", "voice_style_F1": "model:voice_styles/F1.json", "voice_style_F2": "model:voice_styles/F2.json", "voice_style_F3": "model:voice_styles/F3.json", "voice_style_F4": "model:voice_styles/F4.json", "voice_style_F5": "model:voice_styles/F5.json", "voice_style_M1": "model:voice_styles/M1.json", "voice_style_M2": "model:voice_styles/M2.json", "voice_style_M3": "model:voice_styles/M3.json", "voice_style_M4": "model:voice_styles/M4.json", "voice_style_M5": "model:voice_styles/M5.json" }, "tensors": { "weights": "model:ggml/supertonic.safetensors" } }];
const __vite_glob_0_116 = {
  family: family$h,
  display_name: display_name$h,
  description: description$h,
  category: category$h,
  status: status$h,
  tasks: tasks$h,
  modes: modes$h,
  languages: languages$h,
  capabilities: capabilities$h,
  runtime: runtime$h,
  options: options$h,
  ui: ui$h,
  package_defaults: package_defaults$e,
  packages: packages$i,
  sources: sources$h
};
const schema_version$9 = 1;
const family$g = "tf_gridnet";
const display_name$g = "TF-GridNet";
const description$g = "Time-frequency GridNet overlapping speech separation.";
const category$g = "audio_tools";
const status$g = "supported";
const tasks$g = ["sep"];
const modes$g = ["offline"];
const languages$g = ["language_agnostic"];
const capabilities$g = { "sep": ["stems"] };
const runtime$g = { "tags": ["gguf"] };
const options$g = { "request": [{ "name": "audio_chunk_duration_sec", "type": "float", "description": "Separation window duration; zero selects whole-file inference. When enabled, the chunk sample count must exceed n_fft/2.", "min": 0, "default": 2.4, "required": false }, { "name": "audio_chunk_overlap_sec", "type": "float", "description": "Nonnegative overlap used to match speaker order and stitch adjacent windows. When chunking is enabled, overlap sample count must be > 0 and smaller than the chunk. Ignored for whole-file inference.", "min": 0, "default": 1.6, "required": false }, { "name": "normalize_output", "type": "bool", "description": "Normalize each separated waveform to a peak of 0.9, as in ESPnet's example.", "default": true, "required": false }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"] }], "load": [] };
const package_defaults$d = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$h = [{ "id": "tf_gridnet_wsj0_2mix_f32", "display_name": "TF-GridNet WSJ0-2mix F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "TF-GridNet-GGUF", "files": ["TF-GridNet-GGUF/tf-gridnet-wsj0-2mix-f32.gguf"], "strip_prefix": "TF-GridNet-GGUF" }];
const dependencies$9 = [];
const ui$g = { "tags": ["GGUF"], "docs": ["docs/models/tf_gridnet.md"], "recommended_package": "tf_gridnet_wsj0_2mix_f32" };
const sources$g = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" }, "frontend": { "source": "weights:", "prefix": "frontend" } } }];
const __vite_glob_0_117 = {
  schema_version: schema_version$9,
  family: family$g,
  display_name: display_name$g,
  description: description$g,
  category: category$g,
  status: status$g,
  tasks: tasks$g,
  modes: modes$g,
  languages: languages$g,
  capabilities: capabilities$g,
  runtime: runtime$g,
  options: options$g,
  package_defaults: package_defaults$d,
  packages: packages$h,
  dependencies: dependencies$9,
  ui: ui$g,
  sources: sources$g
};
const family$f = "tone_color_vc";
const schema_version$8 = 1;
const display_name$f = "Tone Color VC";
const description$f = "Standalone voice conversion with a reference speaker recording.";
const category$f = "voice_conversion";
const status$f = "experimental";
const tasks$f = ["vc"];
const modes$f = ["offline"];
const languages$f = ["language_agnostic"];
const capabilities$f = { "vc": ["speaker_reference"] };
const runtime$f = { "tags": ["gguf"] };
const options$f = { "request": [{ "name": "seed", "type": "int", "required": false, "description": "Random seed for posterior sampling; -1 chooses a random seed.", "default": 1234, "min": -1 }, { "name": "temperature", "type": "float", "required": false, "description": "Posterior sampling noise scale.", "default": 0.3, "min": 0 }], "session": [{ "name": "exec_plan", "type": "string", "required": false, "default": "{}", "description": "Component execution plan: decoder accepts default/ggml/neon. Default retains the session backend. The complete NEON HiFi-GAN decoder requires a CPU session and ENGINE_ENABLE_NEON=ON on AArch64. No artifacts or params." }], "load": [] };
const package_defaults$c = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$g = [{ "id": "tone_color_vc_f32", "display_name": "Tone Color VC F32 GGUF", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Tone-Color-VC-GGUF", "files": ["Tone-Color-VC-GGUF/tone-color-vc-f32.gguf"], "strip_prefix": "Tone-Color-VC-GGUF" }, { "id": "tone_color_vc_f16", "display_name": "Tone Color VC F16 GGUF", "default": false, "format": "gguf", "precision": "f16", "target_directory": "Tone-Color-VC-GGUF", "files": ["Tone-Color-VC-GGUF/tone-color-vc-f16.gguf"], "strip_prefix": "Tone-Color-VC-GGUF" }];
const dependencies$8 = [];
const ui$f = { "recommended_package": "tone_color_vc_f32", "tags": ["VC", "GGUF"], "docs": ["docs/models/tone_color_vc.md"] };
const sources$f = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" } } }];
const __vite_glob_0_118 = {
  family: family$f,
  schema_version: schema_version$8,
  display_name: display_name$f,
  description: description$f,
  category: category$f,
  status: status$f,
  tasks: tasks$f,
  modes: modes$f,
  languages: languages$f,
  capabilities: capabilities$f,
  runtime: runtime$f,
  options: options$f,
  package_defaults: package_defaults$c,
  packages: packages$g,
  dependencies: dependencies$8,
  ui: ui$f,
  sources: sources$f
};
const schema_version$7 = 1;
const family$e = "universr";
const display_name$e = "UniverSR";
const description$e = "Complex-STFT flow-matching audio super-resolution to 48 kHz.";
const category$e = "audio_tools";
const status$e = "supported";
const tasks$e = ["s2s"];
const modes$e = ["offline"];
const languages$e = ["language_agnostic"];
const capabilities$e = { "s2s": ["audio_enhancement"] };
const runtime$e = { "tags": ["gguf"] };
const options$e = { "request": [{ "name": "audio_chunk_duration_sec", "type": "float", "description": "Independent audio segments concatenated after inference; zero processes the whole file. Chunking changes global normalization context.", "min": 0, "default": 0, "required": false }, { "name": "input_sample_rate", "type": "int", "description": "Effective input bandwidth sample rate: 8000, 12000, 16000, or 24000 Hz.", "required": false }, { "name": "sampler_mode", "type": "enum", "description": "Fixed-step ODE integration method.", "values": ["euler", "midpoint", "rk4"], "default": "midpoint", "required": false }, { "name": "num_inference_steps", "type": "int", "description": "ODE integration steps.", "min": 1, "default": 4, "required": false }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale; zero disables guidance.", "min": 0, "default": 1.5, "required": false }, { "name": "seed", "type": "int", "description": "Initial flow noise seed.", "min": 0, "default": 42, "required": false }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; native preserves the GGUF tensor types.", "required": false, "default": "native", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k"] }], "load": [] };
const package_defaults$b = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$f = [{ "id": "universr_audio_orig", "display_name": "UniverSR Audio GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "UniverSR-GGUF", "files": ["UniverSR-GGUF/universr-audio-orig.gguf"], "strip_prefix": "UniverSR-GGUF" }, { "id": "universr_speech_orig", "display_name": "UniverSR Speech GGUF F32", "format": "gguf", "precision": "f32", "target_directory": "UniverSR-GGUF", "files": ["UniverSR-GGUF/universr-speech-orig.gguf"], "strip_prefix": "UniverSR-GGUF" }];
const dependencies$7 = [];
const ui$e = { "tags": ["GGUF"], "docs": [], "recommended_package": "universr_audio_orig" };
const sources$e = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" }, "frontend": { "source": "weights:", "prefix": "frontend" } } }];
const __vite_glob_0_119 = {
  schema_version: schema_version$7,
  family: family$e,
  display_name: display_name$e,
  description: description$e,
  category: category$e,
  status: status$e,
  tasks: tasks$e,
  modes: modes$e,
  languages: languages$e,
  capabilities: capabilities$e,
  runtime: runtime$e,
  options: options$e,
  package_defaults: package_defaults$b,
  packages: packages$f,
  dependencies: dependencies$7,
  ui: ui$e,
  sources: sources$e
};
const family$d = "vevo2";
const display_name$d = "Vevo2";
const description$d = "Unified controllable framework for English and Chinese speech and singing voice generation, voice conversion, and editing, with tokenizers that disentangle content, prosody, melody, style, and timbre.";
const category$d = "voice_conversion";
const status$d = "supported";
const tasks$d = ["tts", "music", "vc", "edit", "svc", "s2s"];
const modes$d = ["offline"];
const languages$d = ["en", "zh"];
const capabilities$d = { "music": ["lyrics"], "vc": ["speaker_reference"], "svc": ["speaker_reference", "singing"], "s2s": ["speaker_reference"], "edit": ["prompt_editing"] };
const runtime$d = { "tags": ["gguf"] };
const options$d = { "request": [{ "name": "route", "type": "enum", "description": "Generation route; omitted selects the task default.", "required": false, "values": ["zero_shot_tts", "text_to_singing", "svs", "style_preserved_vc", "style_preserved_svc", "style_converted_vc", "style_converted_svc", "editing", "singing_style_conversion", "humming_to_singing", "instrument_to_singing"] }, { "name": "source_audio", "type": "audio_path", "description": "Source audio file for conversion or editing.", "required": false }, { "name": "target_voice", "type": "audio_path", "description": "Target voice audio file; overrides structured speaker audio.", "required": false }, { "name": "prosody_ref", "type": "audio_path", "description": "Prosody or melody reference audio file.", "required": false }, { "name": "style_ref", "type": "audio_path", "description": "Style reference audio file.", "required": false }, { "name": "target_text", "type": "string", "description": "Text or lyrics; overrides structured text input.", "required": false }, { "name": "style_ref_text", "type": "string", "description": "Style-reference transcript; reference_text is also accepted.", "required": false }, { "name": "use_prosody_code", "type": "bool", "description": "Use prosody codes; default depends on route and requires prosody audio when enabled.", "required": false }, { "name": "use_pitch_shift", "type": "bool", "description": "Align reference pitch to the target voice; default depends on route.", "required": false }, { "name": "source_shift_steps", "type": "int", "description": "Manual source reference pitch shift in semitones.", "required": false, "default": 0 }, { "name": "prosody_shift_steps", "type": "int", "description": "Manual prosody reference pitch shift in semitones.", "required": false, "default": 0 }, { "name": "style_shift_steps", "type": "int", "description": "Manual style reference pitch shift in semitones.", "required": false, "default": 0 }, { "name": "duration_sec", "type": "float", "description": "Rescale prosody-code conditioning to this duration; not a general output-length limit. Legacy target_duration_seconds is accepted.", "required": false }, { "name": "reference_duration_sec", "type": "float", "description": "Trim target voice reference before conditioning. Legacy reference_duration_seconds is accepted.", "required": false, "min": 0 }, { "name": "temperature", "type": "float", "description": "Positive AR sampling temperature; default comes from the checkpoint.", "required": false }, { "name": "top_k", "type": "int", "description": "AR top-k sampling; default comes from the checkpoint.", "required": false }, { "name": "top_p", "type": "float", "description": "AR nucleus sampling; default comes from the checkpoint.", "required": false }, { "name": "repetition_penalty", "type": "float", "description": "Positive AR repetition penalty; default comes from the checkpoint.", "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum generated AR tokens.", "required": false, "min": 1, "default": 500 }, { "name": "num_inference_steps", "type": "int", "description": "Flow-matching denoising steps.", "required": false, "min": 1, "default": 32 }, { "name": "seed", "type": "int", "description": "Sampling seed; random when omitted.", "required": false, "min": 0, "max": 4294967295 }, { "name": "text_chunk_size", "type": "int", "description": "Character budget per text chunk.", "required": false, "min": 1, "default": 128 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Source-audio chunking for style_preserved_vc/svc requires audio_chunk_duration_sec. Auto uses fixed chunks; none disables chunking.", "required": false, "values": ["auto", "fixed", "none"], "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Source-audio chunk duration for style_preserved_vc/svc; zero or omitted keeps one-shot processing.", "required": false, "min": 0 }, { "name": "cross_fade_duration_sec", "type": "float", "description": "Source chunk overlap and output crossfade; must be smaller than chunk duration.", "required": false, "default": 1 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared matmul storage override; omitted preserves component defaults.", "required": false, "values": ["native", "f32", "f16", "bf16", "q8_0"] }, { "name": "conv_weight_type", "type": "enum", "description": "Shared convolution storage override; omitted preserves native storage.", "required": false, "values": ["native", "f32", "f16"] }], "load": [{ "name": "whisper_model_path", "type": "path", "description": "External Whisper model directory for feature extraction when not bundled.", "required": false }] };
const ui$d = { "recommended_package": "vevo2_q8_0", "tags": ["TTS", "Music", "VC", "Edit", "GGUF"], "docs": ["docs/models/vevo2.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$a = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$e = [{ "id": "vevo2_q8_0", "display_name": "Vevo2 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Vevo2-GGUF", "files": ["Vevo2-GGUF/vevo2-q8_0.gguf"], "strip_prefix": "Vevo2-GGUF" }, { "id": "vevo2_f16", "display_name": "Vevo2 F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "Vevo2-GGUF", "files": ["Vevo2-GGUF/vevo2-f16.gguf"], "strip_prefix": "Vevo2-GGUF" }, { "id": "vevo2_orig", "display_name": "Vevo2 Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "Vevo2-GGUF", "files": ["Vevo2-GGUF/vevo2-orig.gguf"], "strip_prefix": "Vevo2-GGUF" }];
const sources$d = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "ar_config": "model:contentstyle_modeling/posttrained/config.json", "ar_amphion_config": "model:contentstyle_modeling/posttrained/amphion_config.json", "ar_generation_config": "model:contentstyle_modeling/posttrained/generation_config.json", "ar_tokenizer_config": "model:contentstyle_modeling/posttrained/tokenizer_config.json", "ar_tokenizer_json": "model:contentstyle_modeling/posttrained/tokenizer.json", "ar_vocab": "model:contentstyle_modeling/posttrained/vocab.json", "ar_merges": "model:contentstyle_modeling/posttrained/merges.txt", "ar_added_tokens": "model:contentstyle_modeling/posttrained/added_tokens.json", "ar_special_tokens": "model:contentstyle_modeling/posttrained/special_tokens_map.json", "fm_config": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa/config.json", "fm_text_config": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa_text/config.json", "vocoder_config": "model:vocoder/config.json", "whisper_config": "model:whisper-medium/config.json" }, "tensors": { "content_style_tokenizer_weights": { "source": "weights:", "prefix": "content_style_tokenizer_weights" }, "prosody_tokenizer_weights": { "source": "weights:", "prefix": "prosody_tokenizer_weights" }, "ar_weights": { "source": "weights:", "prefix": "ar_weights" }, "fm_weights": { "source": "weights:", "prefix": "fm_weights" }, "fm_whisper_stats": { "source": "weights:", "prefix": "fm_whisper_stats" }, "fm_text_weights": { "source": "weights:", "prefix": "fm_text_weights" }, "fm_text_whisper_stats": { "source": "weights:", "prefix": "fm_text_whisper_stats" }, "vocoder_weights_0": { "source": "weights:", "prefix": "vocoder_weights_0" }, "vocoder_weights_1": { "source": "weights:", "prefix": "vocoder_weights_1" }, "vocoder_weights_2": { "source": "weights:", "prefix": "vocoder_weights_2" }, "whisper_weights": { "source": "weights:", "prefix": "whisper_weights" } } }, { "format": "safetensors", "roots": { "model": ".", "whisper": "../whisper-medium" }, "files": { "ar_config": "model:contentstyle_modeling/posttrained/config.json", "ar_amphion_config": "model:contentstyle_modeling/posttrained/amphion_config.json", "ar_generation_config": "model:contentstyle_modeling/posttrained/generation_config.json", "ar_tokenizer_config": "model:contentstyle_modeling/posttrained/tokenizer_config.json", "ar_tokenizer_json": "model:contentstyle_modeling/posttrained/tokenizer.json", "ar_vocab": "model:contentstyle_modeling/posttrained/vocab.json", "ar_merges": "model:contentstyle_modeling/posttrained/merges.txt", "ar_added_tokens": "model:contentstyle_modeling/posttrained/added_tokens.json", "ar_special_tokens": "model:contentstyle_modeling/posttrained/special_tokens_map.json", "fm_config": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa/config.json", "fm_text_config": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa_text/config.json", "vocoder_config": "model:vocoder/config.json", "whisper_config": "whisper:config.json" }, "tensors": { "content_style_tokenizer_weights": "model:tokenizer/contentstyle_fvq16384_12.5hz/model.safetensors", "prosody_tokenizer_weights": "model:tokenizer/prosody_fvq512_6.25hz/model.safetensors", "ar_weights": "model:contentstyle_modeling/posttrained/model.safetensors", "fm_weights": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa/model.safetensors", "fm_whisper_stats": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa/whisper_stats.safetensors", "fm_text_weights": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa_text/model.safetensors", "fm_text_whisper_stats": "model:acoustic_modeling/fm_emilia101k_singnet7k_repa_text/whisper_stats.safetensors", "vocoder_weights_0": "model:vocoder/model.safetensors", "vocoder_weights_1": "model:vocoder/model_1.safetensors", "vocoder_weights_2": "model:vocoder/model_2.safetensors", "whisper_weights": "whisper:model.safetensors" } }];
const __vite_glob_0_120 = {
  family: family$d,
  display_name: display_name$d,
  description: description$d,
  category: category$d,
  status: status$d,
  tasks: tasks$d,
  modes: modes$d,
  languages: languages$d,
  capabilities: capabilities$d,
  runtime: runtime$d,
  options: options$d,
  ui: ui$d,
  package_defaults: package_defaults$a,
  packages: packages$e,
  sources: sources$d
};
const schema_version$6 = 1;
const family$c = "vibeasr";
const display_name$c = "VibeVoice-ASR-BitNet";
const description$c = "VibeASR.cpp's CPU-first VibeVoice ASR port: an INT8 (I8_S) audio VAE encoder feeding a ternary (I2_S) Qwen2 decoder, ported to audio.cpp.";
const category$c = "asr";
const status$c = "community";
const tasks$c = ["asr"];
const modes$c = ["offline"];
const languages$c = ["en", "zh", "fr", "it", "ko", "pt", "vi"];
const capabilities$c = {};
const options$c = { "request": [{ "name": "output_format", "type": "enum", "description": "Prompt suffix asked of the decoder: plain transcription text, or JSON rows with Start/End/Speaker/Content.", "values": ["text", "json"], "required": false, "default": "text" }, { "name": "context", "type": "string", "description": "Extra context injected into the prompt (names, jargon) to bias the transcription.", "required": false, "default": "" }, { "name": "max_tokens", "type": "int", "description": "Cap on decoded tokens for one request.", "required": false, "min": 1, "default": 1024 }], "session": [{ "name": "encoder_graph_arena_mb", "type": "int", "description": "VAE encoder graph arena size in MB. Must be positive; sufficient capacity depends on the graph.", "required": false, "min": 1, "default": 64 }, { "name": "prefill_graph_arena_mb", "type": "int", "description": "Decoder prefill graph arena size in MB. Must be positive; sufficient capacity depends on the graph.", "required": false, "min": 1, "default": 256 }, { "name": "decode_graph_arena_mb", "type": "int", "description": "Decoder single-step graph arena size in MB. Must be positive; sufficient capacity depends on the graph.", "required": false, "min": 1, "default": 256 }], "load": [] };
const runtime$c = { "tags": ["gguf", "cpu"] };
const packages$d = [{ "id": "vibeasr_bitnet_i2_s", "display_name": "VibeVoice-ASR-BitNet I8_S encoder + I2_S decoder", "description": "Upstream VibeASR.cpp GGUF package. The two GGUFs carry the VibeASR ggml fork's type ids and need one pass of tools/community_models/convert_vibeasr_gguf.py --in-place before audio.cpp can load them.", "default": true, "format": "gguf", "precision": "native", "target_directory": "VibeVoice-ASR-BitNet", "files": ["vibeasr-vae-encoder-i8_s.gguf", "vibeasr-lm-i2_s-embed-q6_k.gguf", "tokenizer.json", "tokenizer_config.json"], "download": { "kind": "huggingface_snapshot", "repo": "microsoft/VibeVoice-ASR-BitNet", "revision": "main", "gated": false } }];
const dependencies$6 = [];
const ui$c = { "recommended_package": "vibeasr_bitnet_i2_s", "tags": ["ASR", "GGUF"], "docs": ["docs/models/vibeasr.md"], "summary": "INT8 encoder plus ternary Qwen2 decoder transcription on CPU." };
const sources$c = [{ "format": "gguf", "roots": { "model": "." }, "files": { "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": {}, "tensors": { "vae_weights": "model:vibeasr-vae-encoder-i8_s.gguf", "lm_weights": "model:vibeasr-lm-i2_s-embed-q6_k.gguf" } }];
const __vite_glob_0_121 = {
  schema_version: schema_version$6,
  family: family$c,
  display_name: display_name$c,
  description: description$c,
  category: category$c,
  status: status$c,
  tasks: tasks$c,
  modes: modes$c,
  languages: languages$c,
  capabilities: capabilities$c,
  options: options$c,
  runtime: runtime$c,
  packages: packages$d,
  dependencies: dependencies$6,
  ui: ui$c,
  sources: sources$c
};
const family$b = "vibevoice";
const display_name$b = "VibeVoice";
const description$b = "Microsoft long-form multi-speaker TTS model for expressive conversational audio such as podcasts, supporting up to 90 minutes of speech with as many as four speakers.";
const category$b = "tts";
const status$b = "supported";
const tasks$b = ["tts"];
const modes$b = ["offline", "streaming"];
const languages$b = ["en", "zh"];
const options$b = { "request": [{ "name": "voice_samples", "type": "string", "description": "Comma-separated reference WAV paths ordered by speaker ID; cannot be combined with voice_ref.", "required": false }, { "name": "num_inference_steps", "type": "int", "description": "Diffusion steps; defaults to the checkpoint configuration.", "required": false, "min": 1 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale.", "required": false, "min": 0, "default": 1.3 }, { "name": "max_length_times", "type": "float", "description": "Positive generation length multiplier.", "required": false, "default": 2 }, { "name": "max_tokens", "type": "int", "description": "Maximum generated tokens; zero uses the model-derived limit.", "required": false, "min": 0, "default": 0 }, { "name": "do_sample", "type": "bool", "description": "Enable sampling.", "required": false, "default": false }, { "name": "temperature", "type": "float", "description": "Positive sampling temperature.", "required": false, "default": 1 }, { "name": "top_k", "type": "int", "description": "Top-k sampling limit; zero disables filtering.", "required": false, "min": 0, "default": 50 }, { "name": "top_p", "type": "float", "description": "Nucleus probability in (0, 1].", "required": false, "default": 1 }, { "name": "seed", "type": "int", "description": "Sampling seed.", "required": false, "min": 0, "max": 4294967295, "default": 1234 }, { "name": "prompt_noise_file", "type": "path", "description": "F32 prompt acoustic noise file.", "required": false }, { "name": "diffusion_noise_file", "type": "path", "description": "F32 initial diffusion noise file.", "required": false }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "tokenizer_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "connector_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "decoder_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "diffusion_head_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "lora", "type": "path", "description": "Decoder adapter file or PEFT directory applied when creating the session; do not also supply the load option.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Session adapter scale override; omitted uses lora_alpha / r. Must be strictly positive when an adapter is supplied.", "required": false }], "load": [{ "name": "lora", "type": "path", "description": "Decoder adapter file or PEFT directory, merged at load time.", "required": false }, { "name": "lora_scale", "type": "float", "description": "LoRA scale override; omitted uses lora_alpha / r. Must be strictly positive when an adapter is supplied.", "required": false }] };
const capabilities$b = { "tts": ["multi_speaker", "long_form"] };
const runtime$b = { "tags": ["gguf"] };
const ui$b = { "recommended_package": "vibevoice_1_5b_q8_0", "tags": ["TTS", "GGUF"], "docs": ["docs/tts.md", "docs/gguf.md"] };
const package_defaults$9 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$c = [{ "id": "vibevoice_1_5b_q8_0", "display_name": "VibeVoice 1.5B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "VibeVoice-1.5B-GGUF", "files": ["VibeVoice-1.5B-GGUF/vibevoice-1.5b-q8_0.gguf"], "strip_prefix": "VibeVoice-1.5B-GGUF" }, { "id": "vibevoice_1_5b_bf16", "display_name": "VibeVoice 1.5B BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "VibeVoice-1.5B-GGUF", "files": ["VibeVoice-1.5B-GGUF/vibevoice-1.5b-bf16.gguf"], "strip_prefix": "VibeVoice-1.5B-GGUF" }, { "id": "vibevoice_7b_q8_0", "display_name": "VibeVoice 7B Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "VibeVoice-7B-GGUF", "files": ["vibevoice-7b-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/VibeVoice-7B-GGUF", "revision": "main", "gated": false } }];
const sources$b = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "preprocessor_config": "model:preprocessor_config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt" }, "tensors": { "model_weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "preprocessor_config": "model:preprocessor_config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt" }, "tensors": { "model_weights": "model:model.safetensors.index.json" } }];
const __vite_glob_0_122 = {
  family: family$b,
  display_name: display_name$b,
  description: description$b,
  category: category$b,
  status: status$b,
  tasks: tasks$b,
  modes: modes$b,
  languages: languages$b,
  options: options$b,
  capabilities: capabilities$b,
  runtime: runtime$b,
  ui: ui$b,
  package_defaults: package_defaults$9,
  packages: packages$c,
  sources: sources$b
};
const family$a = "vibevoice_asr";
const display_name$a = "VibeVoice ASR";
const description$a = "Microsoft long-form speech-to-text model that processes up to 60 minutes of audio in one pass and produces structured transcripts with speakers, timestamps, content, hotwords, and 50+ language support.";
const category$a = "asr";
const status$a = "supported";
const tasks$a = ["asr"];
const modes$a = ["offline"];
const languages$a = ["auto", "51 languages"];
const options$a = { "request": [{ "name": "context", "type": "string", "description": "Context hint; context_info is also accepted.", "required": false }, { "name": "language", "type": "string", "description": "ASR language label.", "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum generated text tokens.", "required": false, "min": 1, "default": 32768 }, { "name": "temperature", "type": "float", "description": "Sampling temperature; zero uses deterministic decoding.", "required": false, "min": 0, "default": 0 }, { "name": "top_p", "type": "float", "description": "Nucleus probability in (0, 1].", "required": false, "default": 1 }, { "name": "top_k", "type": "int", "description": "Top-k sampling limit; zero disables filtering.", "required": false, "min": 0, "default": 50 }, { "name": "num_beams", "type": "int", "description": "Deterministic beam search width.", "required": false, "min": 1, "default": 1 }, { "name": "repetition_penalty", "type": "float", "description": "Positive generation repetition penalty.", "required": false, "default": 1 }, { "name": "seed", "type": "int", "description": "Acoustic latent sampling seed.", "required": false, "min": 0, "default": 1234 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Pre-encoder audio splitting; auto uses fixed chunks.", "required": false, "values": ["auto", "fixed", "vad", "none"], "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Positive audio chunk duration in seconds.", "required": false, "default": 1200 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "tokenizer_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "connector_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "decoder_weight_type", "type": "enum", "description": "Weight storage type; component-specific settings inherit weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "tokenizer_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 512 }, { "name": "connector_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 128 }, { "name": "decoder_weight_context_mb", "type": "int", "description": "Decoder weight context in MiB; 4096 on 64-bit builds, 1024 on 32-bit builds.", "required": false, "min": 1 }, { "name": "max_history_steps", "type": "int", "description": "Maximum retained decoder history; zero uses the model limit. Cannot exceed checkpoint position capacity; zero uses that capacity.", "required": false, "default": 0, "min": 0 }, { "name": "vad_model_path", "type": "path", "description": "VAD model (any built-in VAD family; default Silero VAD) used with audio_chunk_mode=vad.", "required": false, "default": "assets/framework/models/silero_vad" }], "load": [] };
const capabilities$a = { "asr": ["segments", "speaker_turns", "vad_chunking"] };
const runtime$a = { "tags": ["gguf"] };
const ui$a = { "recommended_package": "vibevoice_asr_q8_0", "tags": ["ASR", "GGUF"], "docs": ["docs/asr.md", "docs/gguf.md"] };
const package_defaults$8 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$b = [{ "id": "vibevoice_asr_q8_0", "display_name": "VibeVoice ASR Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "VibeVoice-ASR-GGUF", "files": ["VibeVoice-ASR-GGUF/vibevoice-asr-q8_0.gguf"], "strip_prefix": "VibeVoice-ASR-GGUF" }, { "id": "vibevoice_asr_f16", "display_name": "VibeVoice ASR F16 GGUF", "format": "gguf", "precision": "f16", "target_directory": "VibeVoice-ASR-GGUF", "files": ["VibeVoice-ASR-GGUF/vibevoice-asr-f16.gguf"], "strip_prefix": "VibeVoice-ASR-GGUF" }];
const sources$a = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "model_weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "model_weights": "model:model.safetensors.index.json" } }];
const __vite_glob_0_123 = {
  family: family$a,
  display_name: display_name$a,
  description: description$a,
  category: category$a,
  status: status$a,
  tasks: tasks$a,
  modes: modes$a,
  languages: languages$a,
  options: options$a,
  capabilities: capabilities$a,
  runtime: runtime$a,
  ui: ui$a,
  package_defaults: package_defaults$8,
  packages: packages$b,
  sources: sources$a
};
const family$9 = "vibevoice_asr_streaming";
const display_name$9 = "VibeVoice ASR Streaming";
const description$9 = "Microsoft VibeVoice ASR Streaming models (7B and 1.5B) for chunked streaming speech-to-text with persistent decoder state.";
const category$9 = "asr";
const status$9 = "supported";
const tasks$9 = ["asr"];
const modes$9 = ["offline", "streaming"];
const languages$9 = ["en", "zh", "es", "pt", "de", "ja", "ko", "fr", "ru", "it"];
const capabilities$9 = { "asr": ["speaker_turns"] };
const options$9 = { "request": [{ "name": "language", "type": "string", "description": "ASR language label; empty unless provided in the request.", "required": false, "default": "" }, { "name": "context", "type": "string", "description": "Extra context or hotwords injected into the streaming prompt.", "required": false, "default": "" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated transcript tokens per chunk.", "required": false, "min": 1, "default": 256 }, { "name": "temperature", "type": "float", "description": "Sampling temperature; 0 uses deterministic decoding.", "required": false, "min": 0, "default": 0 }, { "name": "top_p", "type": "float", "description": "Nucleus sampling probability.", "required": false, "min": 1e-3, "max": 1, "default": 1 }, { "name": "top_k", "type": "int", "description": "Top-k sampling limit; default 50. Zero disables top-k filtering.", "required": false, "min": 0, "default": 50 }, { "name": "num_beams", "type": "int", "description": "Compatibility-only; this checkpoint ignores beam search and uses its incremental decoder.", "required": false, "min": 1, "default": 1 }, { "name": "repetition_penalty", "type": "float", "description": "Generation repetition penalty.", "required": false, "min": 1e-3, "default": 1 }, { "name": "seed", "type": "int", "description": "Acoustic latent sampling seed; default 1234.", "required": false, "default": 1234 }, { "name": "audio_chunk_mode", "type": "enum", "description": "Compatibility-only; ignored in offline and streaming modes. Processor chunk/lookahead settings determine segmentation.", "values": ["auto", "fixed", "vad", "none"], "required": false, "default": "auto" }, { "name": "audio_chunk_duration_sec", "type": "float", "description": "Compatibility-only; ignored in offline and streaming modes. Processor settings determine segmentation.", "required": false, "min": 1e-3, "default": 1200 }], "session": [{ "name": "weight_type", "type": "enum", "description": "Shared component weight storage.", "required": false, "preset": "weight_type_full", "default": "native" }, { "name": "tokenizer_weight_type", "type": "enum", "description": "Speech tokenizer weight storage; inherits weight_type when omitted.", "required": false, "preset": "weight_type_full" }, { "name": "connector_weight_type", "type": "enum", "description": "Speech connector weight storage; inherits weight_type when omitted.", "required": false, "preset": "weight_type_full" }, { "name": "decoder_weight_type", "type": "enum", "description": "Text decoder weight storage; inherits weight_type when omitted.", "required": false, "preset": "weight_type_full" }, { "name": "tokenizer_weight_context_mb", "type": "int", "description": "Speech tokenizer weight metadata context. Size in MiB; must be positive.", "required": false, "min": 1, "default": 512 }, { "name": "connector_weight_context_mb", "type": "int", "description": "Speech connector weight metadata context. Size in MiB; must be positive.", "required": false, "min": 1, "default": 128 }, { "name": "decoder_weight_context_mb", "type": "int", "description": "Text decoder weight metadata context. Default 4096 on 64-bit builds and 1024 on 32-bit builds. Size in MiB; must be positive.", "required": false, "min": 1 }, { "name": "max_history_steps", "type": "int", "description": "Decoder history limit; zero uses the model position capacity. Must be nonnegative and not exceed that capacity.", "required": false, "min": 0, "default": 0 }], "load": [] };
const runtime$9 = { "tags": ["gguf"] };
const ui$9 = { "recommended_package": "vibevoice_asr_streaming_7b_q8_0", "tags": ["ASR", "Streaming", "GGUF"], "docs": ["docs/asr.md", "docs/gguf.md"] };
const package_defaults$7 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/VibeVoice-ASR-Streaming-7B-GGUF", "revision": "main", "gated": false } };
const packages$a = [{ "id": "vibevoice_asr_streaming_7b_q8_0", "display_name": "VibeVoice ASR Streaming 7B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "VibeVoice-ASR-Streaming-7B-GGUF", "files": ["vibevoice-asr-streaming-7b-q8_0.gguf"] }, { "id": "vibevoice_asr_streaming_7b_bf16", "display_name": "VibeVoice ASR Streaming 7B BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "VibeVoice-ASR-Streaming-7B-GGUF", "files": ["vibevoice-asr-streaming-7b-bf16.gguf"] }, { "id": "vibevoice_asr_streaming_7b_q4_k", "display_name": "VibeVoice ASR Streaming 7B Q4_K GGUF", "format": "gguf", "precision": "q4_k", "target_directory": "VibeVoice-ASR-Streaming-7B-GGUF", "files": ["vibevoice-asr-streaming-7b-q4_k.gguf"] }, { "id": "vibevoice_asr_streaming_1_5b_q8_0", "display_name": "VibeVoice ASR Streaming 1.5B Q8_0 GGUF", "format": "gguf", "precision": "q8_0", "target_directory": "VibeVoice-ASR-Streaming-1.5B-GGUF", "files": ["vibevoice-asr-streaming-1.5b-q8_0.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/VibeVoice-ASR-Streaming-1.5B-GGUF", "revision": "main", "gated": false } }, { "id": "vibevoice_asr_streaming_1_5b_bf16", "display_name": "VibeVoice ASR Streaming 1.5B BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "VibeVoice-ASR-Streaming-1.5B-GGUF", "files": ["vibevoice-asr-streaming-1.5b-bf16.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/VibeVoice-ASR-Streaming-1.5B-GGUF", "revision": "main", "gated": false } }, { "id": "vibevoice_asr_streaming_1_5b_q4_k", "display_name": "VibeVoice ASR Streaming 1.5B Q4_K GGUF", "format": "gguf", "precision": "q4_k", "target_directory": "VibeVoice-ASR-Streaming-1.5B-GGUF", "files": ["vibevoice-asr-streaming-1.5b-q4_k.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "christopherthompson81/VibeVoice-ASR-Streaming-1.5B-GGUF", "revision": "main", "gated": false } }];
const sources$9 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "model_weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_vocab": "model:vocab.json", "tokenizer_merges": "model:merges.txt" }, "optional_files": { "preprocessor_config": "model:preprocessor_config.json" }, "tensors": { "model_weights": "model:model.safetensors.index.json" } }];
const __vite_glob_0_124 = {
  family: family$9,
  display_name: display_name$9,
  description: description$9,
  category: category$9,
  status: status$9,
  tasks: tasks$9,
  modes: modes$9,
  languages: languages$9,
  capabilities: capabilities$9,
  options: options$9,
  runtime: runtime$9,
  ui: ui$9,
  package_defaults: package_defaults$7,
  packages: packages$a,
  sources: sources$9
};
const family$8 = "vieneu_v3_turbo";
const display_name$8 = "VieNeu-TTS v3 Turbo";
const description$8 = "On-device Vietnamese/English TTS (48 kHz) with instant voice cloning from 3-5 s of reference audio, by Phạm Nguyễn Ngọc Bảo (pnnbao97). Takes SEA-G2P phonemes as text input.";
const category$8 = "tts";
const status$8 = "community";
const tasks$8 = ["tts", "clone"];
const modes$8 = ["offline"];
const languages$8 = ["vi", "en"];
const capabilities$8 = { "clone": ["speaker_reference"] };
const runtime$8 = { "tags": ["gguf"] };
const options$8 = { "request": [{ "name": "auto_frame_cap", "type": "bool", "description": "Cap the generation budget using the chunk's phoneme count. Legacy frame_cap remains accepted.", "required": false, "default": true }, { "name": "text_chunk_min_size", "type": "int", "description": "Phoneme-string chunks shorter than this character count join a neighbour. Legacy text_chunk_min remains accepted.", "required": false, "default": 20 }, { "name": "speaker_embedding_file", "type": "path", "description": "File containing a comma-separated 192-dimensional speaker embedding.", "required": false }, { "name": "speaker_embedding", "type": "string", "description": "Inline comma-separated 192-dimensional speaker embedding.", "required": false }, { "name": "reference_codes", "type": "string", "description": "Pre-encoded reference codes in row-major order, comma- or space-separated; codebooks per frame come from the checkpoint.", "required": false }, { "name": "reference_codes_file", "type": "path", "description": "Pre-encoded reference codes, one frame per line. Replaces audio encoding and can be used with a speaker embedding instead of reference audio.", "required": false }, { "name": "x_vector_only_mode", "type": "bool", "description": "Clone using only the speaker embedding. Defaults to true for embedding-only input, otherwise false.", "required": false }, { "name": "encode_reference_only", "type": "bool", "description": "Encode reference audio and return an acoustic-tokens artifact without generating speech.", "required": false, "default": false }, { "name": "max_tokens", "type": "int", "description": "Maximum generated frames per text chunk; uses the checkpoint max_new_tokens setting (300 fallback). Each frame represents 80 ms.", "required": false, "min": 1 }, { "name": "do_sample", "type": "bool", "description": "Enable sampling for all codebooks unless subtalker_do_sample overrides later codebooks.", "required": false, "default": true }, { "name": "temperature", "type": "float", "description": "Sampling temperature for all codebooks unless overridden for the subtalker.", "required": false, "default": 0.8 }, { "name": "top_k", "type": "int", "description": "Top-k sampling limit for all codebooks unless overridden for the subtalker.", "required": false, "default": 25 }, { "name": "top_p", "type": "float", "description": "Nucleus cutoff within top-k candidates, unless overridden for the subtalker.", "required": false, "default": 0.95 }, { "name": "repetition_penalty", "type": "float", "description": "Repetition penalty applied independently to each codebook.", "required": false, "default": 1.2 }, { "name": "repetition_window", "type": "int", "description": "Recent frames remembered per codebook for repetition penalties; zero uses all history.", "required": false, "min": 0, "default": 64 }, { "name": "babble_retries", "type": "int", "description": "Regenerations for short chunks that exceed their text; zero disables the guard.", "required": false, "min": 0, "default": 2 }, { "name": "subtalker_temperature", "type": "float", "description": "Temperature override for later codebooks; omitted or negative inherits temperature.", "required": false }, { "name": "subtalker_top_k", "type": "int", "description": "Top-k override for later codebooks; omitted or negative inherits top_k.", "required": false }, { "name": "subtalker_top_p", "type": "float", "description": "Nucleus cutoff override for later codebooks; omitted or negative inherits top_p.", "required": false }, { "name": "subtalker_do_sample", "type": "bool", "description": "Sampling override for later codebooks; inherits do_sample when omitted.", "required": false }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted draws a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum character budget per phoneme-string chunk; must be positive.", "required": false, "min": 1, "default": 200 }], "session": [{ "name": "g2p_dict_file", "type": "path", "description": "SEA-G2P dictionary file (sea_g2p.bin). When set, input is Vietnamese/English text rather than precomputed phonemes.", "required": false }, { "name": "g2p_library", "type": "path", "description": "SEA-G2P shared library used with g2p_dict_file; searched by library name when omitted.", "required": false }, { "name": "mem_saver", "type": "bool", "description": "Release the talker cached-step graph after each request.", "required": false, "default": false }, { "name": "voice_prompt_cache_slots", "type": "int", "description": "Prepared voice-prompt cache slots; zero disables caching.", "required": false, "min": 0, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "Shared talker matmul storage.", "required": false, "preset": "weight_type_full", "default": "native" }, { "name": "conv_weight_type", "type": "enum", "description": "Speaker encoder convolution weight storage.", "required": false, "values": ["native", "f32", "f16"], "default": "f32" }, { "name": "talker_weight_type", "type": "enum", "description": "Talker matmul storage; inherits weight_type when omitted.", "required": false, "preset": "weight_type_full" }, { "name": "talker_graph_arena_mb", "type": "int", "description": "Talker graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 256 }, { "name": "speech_decoder_graph_arena_mb", "type": "int", "description": "Codec decoder graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 32 }, { "name": "speaker_encoder_graph_arena_mb", "type": "int", "description": "Speaker encoder graph metadata arena. Size in MiB; must be positive.", "required": false, "min": 1, "default": 32 }, { "name": "talker_constant_context_mb", "type": "int", "description": "Talker constant metadata context. Size in MiB; must be positive.", "required": false, "min": 1, "default": 4096 }, { "name": "code_predictor_constant_context_mb", "type": "int", "description": "Code predictor constant metadata context. Size in MiB; must be positive.", "required": false, "min": 1, "default": 1536 }, { "name": "speech_decoder_constant_context_mb", "type": "int", "description": "Codec decoder constant metadata context. Size in MiB; must be positive.", "required": false, "min": 1, "default": 1536 }], "load": [] };
const ui$8 = { "recommended_package": "vieneu_v3_turbo_q8_0", "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/models/vieneu_v3_turbo.md", "docs/tts.md", "docs/gguf.md"] };
const packages$9 = [{ "id": "vieneu_v3_turbo_q8_0", "display_name": "VieNeu-TTS v3 Turbo Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "VieNeu-TTS-v3-Turbo-GGUF", "files": ["gguf/vieneu-v3-turbo-q8_0.gguf", "gguf/voices/manifest.json", "gguf/voices/minh_quan_pro/ref_codes.txt", "gguf/voices/minh_quan_pro/speaker.emb.txt"], "download": { "kind": "huggingface_snapshot", "repo": "pnnbao-ump/VieNeu-TTS-v3-Turbo" }, "strip_prefix": "gguf" }, { "id": "vieneu_v3_turbo_bf16", "display_name": "VieNeu-TTS v3 Turbo BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "VieNeu-TTS-v3-Turbo-GGUF", "files": ["gguf/vieneu-v3-turbo-bf16.gguf", "gguf/voices/manifest.json", "gguf/voices/minh_quan_pro/ref_codes.txt", "gguf/voices/minh_quan_pro/speaker.emb.txt"], "download": { "kind": "huggingface_snapshot", "repo": "pnnbao-ump/VieNeu-TTS-v3-Turbo" }, "strip_prefix": "gguf" }, { "id": "vietneu_tts_v3_turbo_q8_0", "display_name": "VieNeu-TTS v3 Turbo Q8_0 GGUF (first community port, July 2026 weights)", "format": "gguf", "precision": "q8_0", "target_directory": "VieNeu-TTS-v3-Turbo-GGUF-2026-07", "files": ["model.gguf"], "download": { "kind": "huggingface_snapshot", "repo": "phuocnguyen90/VieNeu-TTS-v3-Turbo-GGUF" } }];
const sources$8 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "speech_tokenizer_config": "model:speech_tokenizer/config.json" }, "optional_files": { "generation_config": "model:generation_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json", "special_tokens_map": "model:special_tokens_map.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" }, "speech_tokenizer_weights": { "source": "weights:", "prefix": "speech_tokenizer_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "speech_tokenizer_config": "model:speech_tokenizer/config.json" }, "optional_files": { "generation_config": "model:generation_config.json", "vocab": "model:vocab.json", "merges": "model:merges.txt", "tokenizer_json": "model:tokenizer.json", "special_tokens_map": "model:special_tokens_map.json" }, "tensors": { "model_weights": "model:model.safetensors", "speech_tokenizer_weights": "model:speech_tokenizer/model.safetensors" } }];
const __vite_glob_0_125 = {
  family: family$8,
  display_name: display_name$8,
  description: description$8,
  category: category$8,
  status: status$8,
  tasks: tasks$8,
  modes: modes$8,
  languages: languages$8,
  capabilities: capabilities$8,
  runtime: runtime$8,
  options: options$8,
  ui: ui$8,
  packages: packages$9,
  sources: sources$8
};
const schema_version$5 = 1;
const family$7 = "voxcpm1";
const display_name$7 = "VoxCPM1";
const description$7 = "OpenBMB VoxCPM 0.5B tokenizer-free TTS model supporting short-reference voice cloning and streaming output (16kHz).";
const category$7 = "tts";
const status$7 = "supported";
const tasks$7 = ["tts", "clone"];
const modes$7 = ["offline", "streaming"];
const languages$7 = ["zh", "en", "ja", "ko"];
const capabilities$7 = { "clone": ["speaker_reference"] };
const dependencies$5 = [];
const options$7 = { "request": [{ "name": "text_chunk_mode", "type": "enum", "description": "Text chunking mode; default tag_aware.", "preset": "text_chunk_mode_full", "required": false, "default": "tag_aware" }, { "name": "seed", "type": "int", "description": "Random seed for MiniCPM and diffusion sampling.", "required": false }, { "name": "max_tokens", "type": "int", "description": "Maximum MiniCPM output tokens; default 4096. Zero selects model max_length; negative counts are rejected.", "required": false, "default": 4096 }, { "name": "min_tokens", "type": "int", "description": "Minimum MiniCPM output tokens before an EOS stop is honored; default 2.", "required": false, "default": 2 }, { "name": "num_inference_steps", "type": "int", "description": "CFM diffusion sampling steps; default 10. Must be positive.", "required": false, "default": 10 }, { "name": "guidance_scale", "type": "float", "description": "CFM classifier-free guidance rate. Must be nonnegative.", "required": false, "default": 2 }, { "name": "retry_badcase", "type": "bool", "description": "Retry when generation is detected as a bad case; defaults to true offline and false in streaming. Streaming ignores an explicit true value with a warning.", "required": false }, { "name": "retry_badcase_max_times", "type": "int", "description": "Maximum total generation attempts when retrying bad cases, including the initial attempt; default 3. Must be positive.", "required": false, "default": 3 }, { "name": "retry_badcase_ratio_threshold", "type": "float", "description": "Bad-case ratio threshold for retry decisions. Must be positive.", "required": false }, { "name": "prompt_text", "type": "string", "description": "Text prompt for prompt-continuation voice cloning.", "required": false }, { "name": "reference_text", "type": "string", "description": "Alias for prompt_text; text prompt for prompt-continuation voice cloning.", "required": false }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per offline text chunk; must be positive. Does not control streaming chunk cadence.", "required": false, "min": 1, "default": 2048 }, { "name": "stream_decode_patches", "type": "int", "description": "Adjacent audio patches per streaming decoder call (80 ms each). Batching reduces repeated causal-context decoding.", "required": false, "min": 1, "max": 16, "default": 4 }, { "name": "language", "type": "string", "description": "Language hint for Chinese-script normalization; Cantonese/yue preserves Traditional characters. Inherits structured transcript or voice language when provided.", "required": false }], "session": [{ "name": "lora", "type": "path", "description": "Native LoRA directory or checkpoint file with adjacent lora_config.json; merged into generator weights at session creation.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's configured alpha/r scaling; default 1.", "required": false, "default": 1 }, { "name": "mem_saver", "type": "bool", "description": "Use tighter graph workspaces and release request runtime graphs; default false.", "required": false, "default": false }, { "name": "prompt_cache_slots", "type": "int", "description": "Prompt and prompt-audio embedding cache slots; default 1.", "required": false, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "Model weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "audiovae_weight_type", "type": "enum", "description": "AudioVAE weight storage type.", "preset": "weight_type_full", "required": false, "default": "native" }, { "name": "weight_context_mb", "type": "int", "description": "Model weight graph context size in MB.", "required": false }, { "name": "text_embedding_graph_arena_mb", "type": "int", "description": "Text embedding host graph-metadata arena size in MiB, not device workspace.", "required": false }, { "name": "lm_step_graph_arena_mb", "type": "int", "description": "LM step host graph-metadata arena size in MiB, not device workspace.", "required": false }, { "name": "projection_graph_arena_mb", "type": "int", "description": "Projection host graph-metadata arena size in MiB, not device workspace.", "required": false }, { "name": "local_encoder_graph_arena_mb", "type": "int", "description": "Local encoder host graph-metadata arena size in MiB, not device workspace.", "required": false }, { "name": "dit_graph_arena_mb", "type": "int", "description": "DiT estimator host graph-metadata arena size in MiB, not device workspace.", "required": false }, { "name": "audiovae_weight_context_mb", "type": "int", "description": "AudioVAE weight graph context size in MB.", "required": false }, { "name": "audiovae_graph_arena_mb", "type": "int", "description": "AudioVAE decoder host graph-metadata arena size in MiB, not device workspace.", "required": false }, { "name": "audiovae_encoder_graph_arena_mb", "type": "int", "description": "AudioVAE encoder host graph-metadata arena size in MiB, not device workspace.", "required": false }, { "name": "audiovae_latent_capacity", "type": "int", "description": "AudioVAE decoder latent frame capacity.", "required": false }, { "name": "audiovae_encoder_sample_capacity", "type": "int", "description": "AudioVAE encoder sample capacity.", "required": false }], "load": [] };
const runtime$7 = { "tags": ["gguf", "stream"] };
const ui$7 = { "recommended_package": "voxcpm1_0_5b_q8_0", "tags": ["TTS", "Clone", "GGUF", "Stream"], "docs": ["docs/models/voxcpm1.md", "docs/tts.md", "docs/gguf.md"] };
const package_defaults$6 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$8 = [{ "id": "voxcpm1_0_5b_q8_0", "display_name": "VoxCPM 0.5B Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "VoxCPM1-GGUF", "files": ["VoxCPM1-GGUF/voxcpm-0.5b-q8_0-audiovae-f16.gguf"], "strip_prefix": "VoxCPM1-GGUF" }];
const sources$7 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json" }, "optional_files": { "special_tokens_map": "model:special_tokens_map.json" }, "tensors": { "weights": { "source": "weights:" }, "audiovae_weights": { "source": "weights:" } } }];
const __vite_glob_0_126 = {
  schema_version: schema_version$5,
  family: family$7,
  display_name: display_name$7,
  description: description$7,
  category: category$7,
  status: status$7,
  tasks: tasks$7,
  modes: modes$7,
  languages: languages$7,
  capabilities: capabilities$7,
  dependencies: dependencies$5,
  options: options$7,
  runtime: runtime$7,
  ui: ui$7,
  package_defaults: package_defaults$6,
  packages: packages$8,
  sources: sources$7
};
const family$6 = "voxcpm2";
const display_name$6 = "VoxCPM2";
const description$6 = "OpenBMB tokenizer-free TTS model supporting 30 languages and 9 Chinese dialects, with 48 kHz output, natural-language voice design, controllable short-reference voice cloning, and expressive style guidance.";
const category$6 = "tts";
const status$6 = "supported";
const tasks$6 = ["tts", "clone", "design"];
const modes$6 = ["offline", "streaming"];
const languages$6 = ["ar", "my", "zh", "zh dialects", "da", "nl", "en", "fi", "fr", "de", "el", "he", "hi", "id", "it", "ja", "km", "ko", "lo", "ms", "no", "pl", "pt", "ru", "es", "sw", "sv", "tl", "th", "tr", "vi"];
const options$6 = { "request": [{ "name": "min_tokens", "type": "int", "description": "Minimum generated audio tokens.", "required": false, "min": 0, "default": 2 }, { "name": "max_tokens", "type": "int", "description": "Maximum generated audio tokens. Zero resolves to model max_length; requires min_tokens <= resolved max_tokens <= model limit.", "required": false, "min": 0, "default": 4096 }, { "name": "num_inference_steps", "type": "int", "description": "Flow sampling steps. Must be positive.", "required": false, "default": 10 }, { "name": "guidance_scale", "type": "float", "description": "Classifier-free guidance scale. Must be nonnegative.", "required": false, "default": 2 }, { "name": "retry_badcase", "type": "bool", "description": "Retry detected bad generations. Offline only; streaming requires false.", "required": false, "default": true }, { "name": "retry_badcase_max_times", "type": "int", "description": "Total attempts including the initial attempt, not extra retries; must be positive.", "required": false, "default": 3 }, { "name": "retry_badcase_ratio_threshold", "type": "float", "description": "Bad-case audio/text length ratio threshold. Must be positive.", "required": false, "default": 6 }, { "name": "seed", "type": "int", "description": "Sampling seed.", "required": false, "min": 0, "max": 4294967295, "default": 1234 }, { "name": "cfm_noise_file", "type": "path", "description": "Precomputed flow noise file.", "required": false }, { "name": "stream_chunk_policy", "type": "enum", "description": "Streaming decoder cadence: grow emits one patch first, then doubles toward stream_frames_per_event; fixed uses the configured size. Ignored offline.", "required": false, "values": ["grow", "fixed"], "default": "grow" }, { "name": "stream_frames_per_event", "type": "int", "description": "Maximum generated latent patches per streaming decoder event. Set to 1 for one-patch emission. Ignored offline.", "required": false, "min": 1, "default": 4 }, { "name": "stream_left_context", "type": "int", "description": "Previous patches decoded as streaming left context.", "required": false, "min": 0, "max": 8, "default": 3 }, { "name": "ultimate_clone", "type": "bool", "description": "Use the voice reference itself as the continuation prompt. Requires reference audio and reference_text or prompt_text; cannot be combined with explicit prompt audio.", "required": false, "default": false }, { "name": "prompt_text", "type": "string", "description": "Transcript for continuation prompt audio, distinct from the base voice reference.", "required": false }, { "name": "chunk_strategy", "type": "enum", "description": "Long-form continuation or independent generation per chunk. Offline only.", "required": false, "values": ["continuation", "stateless"], "default": "continuation" }, { "name": "text_chunk_size", "type": "int", "description": "Framework long-form text chunk size. Offline only.", "required": false, "default": 2048 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode. Offline only.", "required": false, "values": ["default", "tag_aware", "japanese", "endline"], "default": "tag_aware" }], "session": [{ "name": "audiovae_tile_frames", "type": "int", "description": "Opt-in causal AudioVAE tiling. Maximum new latent frames per tile; zero preserves full decoding.", "required": false, "default": 0, "min": 0 }, { "name": "perf_mode", "type": "enum", "description": "Opt-in packed attention and MLP projections. May change numerical results; off preserves standard execution.", "required": false, "values": ["off", "cuda_perf"], "default": "off" }, { "name": "lora", "type": "path", "description": "Native LoRA directory or checkpoint file with adjacent lora_config.json; merged into generator weights at session creation.", "required": false }, { "name": "lora_scale", "type": "float", "description": "Multiplier for the adapter's configured alpha/r scaling; default 1.", "required": false, "default": 1 }, { "name": "weight_type", "type": "enum", "description": "Language-model weight storage; does not override AudioVAE storage.", "required": false, "preset": "weight_type_full" }, { "name": "audiovae_weight_type", "type": "enum", "description": "AudioVAE weight storage; defaults independently to native, not the shared weight_type.", "required": false, "preset": "weight_type_full" }, { "name": "prompt_cache_slots", "type": "int", "description": "Cached encoded prompt slots; zero disables reuse.", "required": false, "min": 0, "default": 1 }, { "name": "mem_saver", "type": "bool", "description": "Release staged runtime graphs.", "required": false, "default": true }, { "name": "weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 3072 }, { "name": "text_embedding_graph_arena_mb", "type": "int", "description": "Text embedding host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 64 }, { "name": "lm_step_graph_arena_mb", "type": "int", "description": "LM step host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 1024 }, { "name": "projection_graph_arena_mb", "type": "int", "description": "Projection host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 256 }, { "name": "local_encoder_graph_arena_mb", "type": "int", "description": "Local encoder host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 512 }, { "name": "dit_graph_arena_mb", "type": "int", "description": "DiT estimator host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 1024 }, { "name": "audiovae_weight_context_mb", "type": "int", "description": "Context or graph arena size in MiB.", "required": false, "min": 1, "default": 768 }, { "name": "audiovae_graph_arena_mb", "type": "int", "description": "AudioVAE decoder host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 1024 }, { "name": "audiovae_encoder_graph_arena_mb", "type": "int", "description": "AudioVAE encoder host graph-metadata arena size in MiB, not device workspace.", "required": false, "min": 1, "default": 1024 }, { "name": "audiovae_latent_capacity", "type": "int", "description": "Optional decoder graph reservation in latent frames, reused by shorter requests and doubled when exceeded; omitted builds the graph at each request's own frame count.", "required": false, "min": 1 }, { "name": "exec_plan", "type": "string", "description": "JSON component execution plans. audiovae: impl=default/ggml; backend must match the session; no artifacts. params.threads is a nonnegative int: positive values require a CPU session and enable a dedicated AudioVAE backend with streaming decode overlap; also controls offline decoding and prompt encoding threads. Omitted/0 shares the session backend.", "required": false, "default": "{}" }, { "name": "audiovae_encoder_sample_capacity", "type": "int", "description": "Reserved encoder sample capacity.", "required": false, "min": 1, "default": 24e4 }], "load": [] };
const capabilities$6 = { "clone": ["speaker_reference"], "design": ["voice_design"] };
const runtime$6 = { "tags": ["gguf", "stream"] };
const ui$6 = { "recommended_package": "voxcpm2_q8_0", "tags": ["TTS", "Clone", "Design", "GGUF", "Stream"], "docs": ["docs/tts.md", "docs/gguf.md", "docs/models/vocalrender.md"] };
const package_defaults$5 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$7 = [{ "id": "voxcpm2_q8_0", "display_name": "VoxCPM2 Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "VoxCPM2-GGUF", "files": ["VoxCPM2-GGUF/voxcpm2-q8_0.gguf"], "strip_prefix": "VoxCPM2-GGUF" }, { "id": "voxcpm2_bf16", "display_name": "VoxCPM2 BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "VoxCPM2-GGUF", "files": ["VoxCPM2-GGUF/voxcpm2-bf16.gguf"], "strip_prefix": "VoxCPM2-GGUF" }, { "id": "voxcpm2_orig", "display_name": "VoxCPM2 Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "VoxCPM2-GGUF", "files": ["VoxCPM2-GGUF/voxcpm2-orig.gguf"], "strip_prefix": "VoxCPM2-GGUF" }, { "id": "voxcpm2_vocalrender_pro", "display_name": "VocalRender-Pro (VoxCPM2) Original-Dtype GGUF", "format": "gguf", "precision": "orig", "target_directory": "VoxCPM2-GGUF", "files": ["VoxCPM2-GGUF/finetune/vocalrender-pro-orig.gguf"], "strip_prefix": "VoxCPM2-GGUF" }, { "id": "voxcpm2_safetensors", "display_name": "VoxCPM2 Safetensors", "format": "safetensors", "precision": "native", "target_directory": "VoxCPM2", "files": ["config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json"], "download": { "kind": "huggingface_snapshot", "repo": "OpenBMB/VoxCPM2" } }];
const sources$6 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "special_tokens_map": "model:special_tokens_map.json" }, "tensors": { "weights": { "source": "weights:", "prefix": "weights" }, "audiovae_weights": { "source": "weights:", "prefix": "audiovae_weights" } } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_config": "model:tokenizer_config.json", "tokenizer_json": "model:tokenizer.json", "special_tokens_map": "model:special_tokens_map.json" }, "tensors": { "weights": "model:model.safetensors", "audiovae_weights": "model:audiovae.safetensors" } }];
const __vite_glob_0_127 = {
  family: family$6,
  display_name: display_name$6,
  description: description$6,
  category: category$6,
  status: status$6,
  tasks: tasks$6,
  modes: modes$6,
  languages: languages$6,
  options: options$6,
  capabilities: capabilities$6,
  runtime: runtime$6,
  ui: ui$6,
  package_defaults: package_defaults$5,
  packages: packages$7,
  sources: sources$6
};
const family$5 = "voxtral_realtime";
const display_name$5 = "Voxtral Mini 4B Realtime";
const description$5 = "Mistral 13-language realtime ASR model with a natively streaming causal audio encoder, configurable low-latency transcription delay, and accuracy competitive with offline open-source systems.";
const category$5 = "asr";
const status$5 = "supported";
const tasks$5 = ["asr"];
const modes$5 = ["offline", "streaming"];
const languages$5 = ["en", "zh", "hi", "es", "ar", "fr", "pt", "ru", "de", "ja", "ko", "it", "nl"];
const options$5 = { "request": [{ "name": "max_tokens", "type": "int", "min": 1, "description": "Maximum generated transcript tokens; omitted uses the audio-derived limit. Offline decoding only; ignored by live streaming.", "required": false }, { "name": "do_sample", "type": "bool", "default": false, "description": "Sample rather than greedily decode.", "required": false }, { "name": "temperature", "type": "float", "min": 0, "default": 1, "description": "Sampling temperature; must be > 0.", "required": false }, { "name": "top_p", "type": "float", "min": 0, "max": 1, "default": 1, "description": "Nucleus sampling probability in (0, 1].", "required": false }, { "name": "top_k", "type": "int", "min": 0, "default": 50, "description": "Top-k sampling limit; zero disables filtering.", "required": false }, { "name": "seed", "type": "int", "min": 0, "default": 1234, "description": "Sampling seed.", "required": false }], "session": [{ "name": "weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "default": "native", "description": "Shared weight storage type.", "required": false }, { "name": "audio_encoder_weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "description": "Audio encoder weight storage; inherits weight_type.", "required": false }, { "name": "text_decoder_weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "description": "Text decoder weight storage; inherits weight_type.", "required": false }, { "name": "audio_encoder_graph_arena_mb", "type": "int", "min": 1, "default": 512, "description": "Audio encoder graph arena in MiB.", "required": false }, { "name": "audio_encoder_weight_context_mb", "type": "int", "min": 1, "default": 128, "description": "Audio encoder weight context in MiB.", "required": false }, { "name": "text_decoder_prefill_graph_arena_mb", "type": "int", "min": 1, "default": 512, "description": "Decoder prefill graph arena in MiB. Decoder uses the maximum of prefill and decode arena settings.", "required": false }, { "name": "text_decoder_decode_graph_arena_mb", "type": "int", "min": 1, "default": 512, "description": "Decoder step graph arena in MiB. Decoder uses the maximum of prefill and decode arena settings.", "required": false }, { "name": "text_decoder_weight_context_mb", "type": "int", "min": 1, "default": 128, "description": "Decoder weight context in MiB.", "required": false }, { "name": "stream_decode_cache_steps", "type": "int", "default": 1024, "description": "Streaming decoder cache capacity in 80 ms steps. Must be positive and no greater than checkpoint sliding_window.", "required": false }, { "name": "stream_batch_tokens", "type": "int", "min": 1, "default": 1, "description": "Audio tokens per streaming encoder forward.", "required": false }], "load": [] };
const capabilities$5 = { "asr": ["partial_results"] };
const runtime$5 = { "tags": ["gguf", "stream"] };
const ui$5 = { "recommended_package": "voxtral_realtime_q8_0", "tags": ["ASR", "GGUF", "Stream"], "docs": ["docs/models/voxtral_realtime.md", "docs/asr.md", "docs/gguf.md"] };
const package_defaults$4 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$6 = [{ "id": "voxtral_realtime_q8_0", "display_name": "Voxtral Mini 4B Realtime Q8_0 GGUF", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Voxtral-Mini-4B-Realtime-2602-GGUF", "files": ["Voxtral-Mini-4B-Realtime-2602-GGUF/voxtral-mini-4b-realtime-2602-q8_0.gguf"], "strip_prefix": "Voxtral-Mini-4B-Realtime-2602-GGUF" }, { "id": "voxtral_realtime_q4_k", "display_name": "Voxtral Mini 4B Realtime Q4_K GGUF", "format": "gguf", "precision": "q4_k", "target_directory": "Voxtral-Mini-4B-Realtime-2602-GGUF", "files": ["Voxtral-Mini-4B-Realtime-2602-GGUF/voxtral-mini-4b-realtime-2602-q4_k.gguf"], "strip_prefix": "Voxtral-Mini-4B-Realtime-2602-GGUF" }, { "id": "voxtral_realtime_bf16", "display_name": "Voxtral Mini 4B Realtime BF16 GGUF", "format": "gguf", "precision": "bf16", "target_directory": "Voxtral-Mini-4B-Realtime-2602-GGUF", "files": ["Voxtral-Mini-4B-Realtime-2602-GGUF/voxtral-mini-4b-realtime-2602-bf16.gguf"], "strip_prefix": "Voxtral-Mini-4B-Realtime-2602-GGUF" }];
const sources$5 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "processor_config": "model:processor_config.json", "tekken": "model:tekken.json" }, "optional_files": { "params": "model:params.json", "readme": "model:README.md" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "generation_config": "model:generation_config.json", "processor_config": "model:processor_config.json", "tekken": "model:tekken.json" }, "optional_files": { "params": "model:params.json", "readme": "model:README.md" }, "tensors": { "weights": "model:model.safetensors" } }];
const __vite_glob_0_128 = {
  family: family$5,
  display_name: display_name$5,
  description: description$5,
  category: category$5,
  status: status$5,
  tasks: tasks$5,
  modes: modes$5,
  languages: languages$5,
  options: options$5,
  capabilities: capabilities$5,
  runtime: runtime$5,
  ui: ui$5,
  package_defaults: package_defaults$4,
  packages: packages$6,
  sources: sources$5
};
const schema_version$4 = 1;
const family$4 = "voxtral_tts";
const display_name$4 = "Voxtral 4B TTS";
const description$4 = "Mistral's Ministral-based autoregressive and flow-matching TTS model with 20 embedded preset voices.";
const category$4 = "tts";
const status$4 = "supported";
const tasks$4 = ["tts"];
const modes$4 = ["offline", "streaming"];
const languages$4 = ["en", "fr", "es", "de", "it", "pt", "nl", "ar", "hi"];
const runtime$4 = { "tags": ["gguf"] };
const capabilities$4 = { "tts": ["built_in_voices", "long_form"] };
const options$4 = { "request": [{ "name": "voice_id", "type": "enum", "description": "Embedded preset voice; the released checkpoint does not contain the encoder needed for reference-audio cloning.", "values": ["casual_female", "casual_male", "cheerful_female", "neutral_female", "neutral_male", "pt_male", "pt_female", "nl_male", "nl_female", "it_male", "it_female", "fr_male", "fr_female", "es_male", "es_female", "de_male", "de_female", "ar_male", "hi_male", "hi_female"], "required": false, "default": "casual_male" }, { "name": "max_tokens", "type": "int", "description": "Maximum generated audio frames per text chunk; each frame represents 80 ms.", "required": false, "min": 1, "default": 2048 }, { "name": "num_inference_steps", "type": "int", "description": "Euler integration steps for the per-frame acoustic flow model.", "required": false, "min": 1, "default": 7 }, { "name": "guidance_scale", "type": "float", "description": "Acoustic classifier-free guidance scale; the AR backbone does not use CFG.", "required": false, "min": 0, "default": 1.2 }, { "name": "seed", "type": "int", "description": "Acoustic noise seed; omitted requests select a random seed.", "required": false, "min": 0 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per framework long-form text chunk.", "required": false, "min": 1, "default": 300 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "values": ["default", "tag_aware", "japanese", "endline"], "required": false, "default": "default" }], "session": [{ "name": "weight_type", "type": "enum", "description": "Weight storage type; native preserves the package's tensor types.", "values": ["native", "f32", "f16", "bf16", "q4_0", "q4_1", "q5_0", "q5_1", "q2_k", "q3_k", "q4_k", "q5_k", "q6_k", "q8_0", "nvfp4"], "required": false, "default": "native" }, { "name": "kv_cache_type", "type": "enum", "description": "AR key/value cache storage type.", "values": ["f32", "f16", "bf16"], "required": false, "default": "f16" }], "load": [] };
const package_defaults$3 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$5 = [{ "id": "voxtral_4b_tts_2603_bf16", "display_name": "Voxtral 4B TTS 2603 BF16 GGUF", "default": true, "format": "gguf", "precision": "bf16", "target_directory": "Voxtral-4B-TTS-2603-GGUF", "files": ["Voxtral-4B-TTS-2603-GGUF/voxtral-4b-tts-2603-bf16.gguf"], "strip_prefix": "Voxtral-4B-TTS-2603-GGUF" }, { "id": "voxtral_4b_tts_2603_q8_0", "display_name": "Voxtral 4B TTS 2603 Q8_0 GGUF", "default": false, "format": "gguf", "precision": "q8_0", "target_directory": "Voxtral-4B-TTS-2603-GGUF", "files": ["Voxtral-4B-TTS-2603-GGUF/voxtral-4b-tts-2603-q8_0.gguf"], "strip_prefix": "Voxtral-4B-TTS-2603-GGUF" }];
const dependencies$4 = [];
const ui$4 = { "recommended_package": "voxtral_4b_tts_2603_bf16", "tags": ["TTS", "GGUF"], "docs": ["docs/models/voxtral_tts.md", "docs/gguf.md"] };
const sources$4 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:params.json", "tokenizer_json": "model:tokenizer.json", "tokenizer_config": "model:tokenizer_config.json" }, "tensors": { "model_weights": "weights:" } }];
const __vite_glob_0_129 = {
  schema_version: schema_version$4,
  family: family$4,
  display_name: display_name$4,
  description: description$4,
  category: category$4,
  status: status$4,
  tasks: tasks$4,
  modes: modes$4,
  languages: languages$4,
  runtime: runtime$4,
  capabilities: capabilities$4,
  options: options$4,
  package_defaults: package_defaults$3,
  packages: packages$5,
  dependencies: dependencies$4,
  ui: ui$4,
  sources: sources$4
};
const schema_version$3 = 1;
const family$3 = "whistle_asr";
const display_name$3 = "Whistle ASR";
const description$3 = "Whistle offline speech recognition with FP32 GGUF weights, a GGML encoder and a host decoder.";
const category$3 = "asr";
const status$3 = "experimental";
const tasks$3 = ["asr"];
const modes$3 = ["offline"];
const languages$3 = ["en", "de", "fr", "es", "it", "nl", "pl"];
const runtime$3 = { "tags": ["gguf"] };
const capabilities$3 = {};
const options$3 = { "request": [{ "name": "language", "type": "string", "description": "Force one supported language; omit to detect the language.", "required": false }], "session": [{ "name": "exec_plan", "type": "string", "description": "JSON component execution plans. Component decoder accepts impl native/neon (default native), both on CPU independently of the encoder backend. The experimental neon implementation accelerates the vocabulary projection with the framework NEON library and requires ENGINE_ENABLE_NEON=ON and AArch64 NEON. No artifacts or params are used.", "required": false, "default": "{}" }], "load": [] };
const package_defaults$2 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/audio.cpp-gguf", "revision": "main", "gated": false } };
const packages$4 = [{ "id": "whistle_asr_f32", "display_name": "Whistle ASR GGUF F32", "default": true, "format": "gguf", "precision": "f32", "target_directory": "Whistle-GGUF", "files": ["Whistle-GGUF/whistle-f32.gguf"], "strip_prefix": "Whistle-GGUF" }];
const dependencies$3 = [];
const ui$3 = { "tags": ["ASR", "GGUF"], "docs": ["docs/models/whistle_asr.md"], "recommended_package": "whistle_asr_f32" };
const sources$3 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "config": "model:config.json", "tokenizer_blob": "model:tokenizer.blob", "mel_filterbank": "model:mel_filterbank_80.f32", "hadamard_perm1": "model:hadamard_perm1.f32", "hadamard_perm2": "model:hadamard_perm2.f32" }, "tensors": { "weights": "weights:" } }, { "format": "safetensors", "roots": { "model": "." }, "files": { "config": "model:config.json", "tokenizer_blob": "model:tokenizer.blob", "mel_filterbank": "model:mel_filterbank_80.f32", "hadamard_perm1": "model:hadamard_perm1.f32", "hadamard_perm2": "model:hadamard_perm2.f32" }, "tensors": { "weights": "model:whistle.safetensors" } }];
const __vite_glob_0_130 = {
  schema_version: schema_version$3,
  family: family$3,
  display_name: display_name$3,
  description: description$3,
  category: category$3,
  status: status$3,
  tasks: tasks$3,
  modes: modes$3,
  languages: languages$3,
  runtime: runtime$3,
  capabilities: capabilities$3,
  options: options$3,
  package_defaults: package_defaults$2,
  packages: packages$4,
  dependencies: dependencies$3,
  ui: ui$3,
  sources: sources$3
};
const schema_version$2 = 1;
const family$2 = "xtts_v2";
const display_name$2 = "XTTS v2";
const description$2 = "Coqui XTTS v2 cross-lingual text-to-speech with voice cloning: GPT-2 mel-code generator, perceiver conditioning resampler, HiFi-GAN decoder, and speaker encoder.";
const category$2 = "tts";
const status$2 = "community";
const tasks$2 = ["tts"];
const modes$2 = ["offline"];
const languages$2 = ["en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh-cn", "hu", "ko", "ja", "hi"];
const capabilities$2 = { "tts": ["speaker_reference"] };
const options$2 = { "request": [{ "name": "language", "type": "string", "description": "Source language for text conditioning (e.g. 'en'); also selects tokenizer normalization.", "required": false, "default": "en" }, { "name": "temperature", "type": "float", "description": "AR sampling temperature; official default 0.75.", "required": false, "min": 0, "default": 0.75 }, { "name": "top_k", "type": "int", "description": "AR top-k sampling; official default 50.", "required": false, "min": 0, "default": 50 }, { "name": "top_p", "type": "float", "description": "AR nucleus sampling threshold; official default 0.85.", "required": false, "min": 0, "max": 1, "default": 0.85 }, { "name": "repetition_penalty", "type": "float", "description": "AR repetition penalty; official default 10.0.", "required": false, "min": 1, "default": 10 }, { "name": "max_mel_tokens", "type": "int", "description": "Maximum mel codes to generate; official default 605.", "required": false, "min": 1, "default": 605 }, { "name": "seed", "type": "int", "description": "Sampling seed; omitted selects a random seed.", "required": false, "min": 0, "max": 4294967295 }, { "name": "text_chunk_size", "type": "int", "description": "Maximum Unicode codepoints per framework text chunk; default 256.", "required": false, "min": 1, "default": 256 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "preset": "text_chunk_mode_full", "required": false, "default": "word_budget" }], "session": [{ "name": "conditionals_cache_slots", "type": "int", "description": "Prepared voice-conditioning cache slots; 0 disables caching.", "required": false, "min": 0, "default": 1 }], "load": [] };
const runtime$2 = { "tags": ["gguf"] };
const sources$2 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "vocoder": "model:xtts-v2-vocoder-f16.gguf" }, "tensors": { "gpt_weights": { "source": "weights:" }, "vocoder_weights": { "source": "model:xtts-v2-vocoder-f16.gguf" } } }];
const packages$3 = [{ "id": "xtts_v2_gguf_q8_0", "display_name": "XTTS v2 GGUF (Q8_0)", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "XTTS-v2-Q8", "files": ["q8_0/xtts-v2-gpt-q8_0.gguf", "q8_0/xtts-v2-vocoder-f16.gguf", "q8_0/mel_norms.bin"], "download": { "kind": "huggingface_snapshot", "repo": "onicubag/xTTSv2-GGUF" }, "strip_prefix": "q8_0" }, { "id": "xtts_v2_gguf", "display_name": "XTTS v2 GGUF (Original)", "default": false, "format": "gguf", "precision": "orig", "target_directory": "XTTS-v2", "files": ["xtts-v2-gpt.gguf", "xtts-v2-vocoder-f16.gguf", "mel_norms.bin"], "download": { "kind": "huggingface_snapshot", "repo": "onicubag/xTTSv2-GGUF" } }, { "id": "xtts_v2_gguf_q4_k_m", "display_name": "XTTS v2 GGUF (Q4_K_M)", "default": false, "format": "gguf", "precision": "q4_k_m", "target_directory": "XTTS-v2-Q4_K_M", "files": ["q4_k_m/xtts-v2-gpt-q4_k_m.gguf", "q4_k_m/xtts-v2-vocoder-f16.gguf", "q4_k_m/mel_norms.bin"], "download": { "kind": "huggingface_snapshot", "repo": "onicubag/xTTSv2-GGUF" }, "strip_prefix": "q4_k_m" }];
const dependencies$2 = [];
const ui$2 = { "tags": ["TTS", "Clone", "GGUF"], "docs": ["docs/community_models/xtts_v2.md"], "recommended_package": "xtts_v2_gguf_q8_0" };
const __vite_glob_0_131 = {
  schema_version: schema_version$2,
  family: family$2,
  display_name: display_name$2,
  description: description$2,
  category: category$2,
  status: status$2,
  tasks: tasks$2,
  modes: modes$2,
  languages: languages$2,
  capabilities: capabilities$2,
  options: options$2,
  runtime: runtime$2,
  sources: sources$2,
  packages: packages$3,
  dependencies: dependencies$2,
  ui: ui$2
};
const schema_version$1 = 1;
const family$1 = "yue2";
const display_name$1 = "YuE2";
const description$1 = "YuE2 music generation model with symbolic ABC planning, semantic codec generation, NAR acoustic flow synthesis, and Oobleck VAE decode.";
const category$1 = "audio_generation";
const status$1 = "supported";
const tasks$1 = ["music"];
const modes$1 = ["offline"];
const languages$1 = ["en"];
const capabilities$1 = { "music": ["lyrics", "style_control"] };
const runtime$1 = { "tags": ["gguf"] };
const dependencies$1 = [];
const ui$1 = { "recommended_package": "yue2_main_q8_0", "tags": ["Music", "GGUF"], "docs": ["docs/models/yue2.md", "docs/music_generation.md", "docs/gguf.md"] };
const options$1 = { "request": [{ "name": "style", "type": "string", "description": "Song style/tags.", "required": true }, { "name": "lyrics", "type": "string", "description": "Lyrics text. Leave empty for instrumental generation; if omitted, the CLI text input is used.", "required": false }, { "name": "cot", "type": "enum", "values": ["off", "melody", "full"], "description": "Symbolic planning route. off skips ABC generation; melody/full generate or consume ABC before music tokens.", "required": false, "default": "full" }, { "name": "stop_after", "type": "enum", "values": ["abc", "semantic", "audio"], "description": "Last stage to run. abc writes the generated score only; semantic also writes the semantic token export; audio renders the full song.", "required": false, "default": "audio" }, { "name": "abc", "type": "string", "description": "External ABC score text for melody/full routes.", "required": false }, { "name": "abc_file", "type": "string", "description": "Path to an external ABC score file for melody/full routes.", "required": false }, { "name": "semantic_prefix", "type": "string", "description": "JSON array of semantic codec indices to force as the start of the music stream.", "required": false }, { "name": "semantic_prefix_file", "type": "string", "description": "Path to a JSON array of semantic codec indices to force as the start of the music stream.", "required": false }, { "name": "nar_noise_file", "type": "string", "description": "Path to a raw float32 noise file for NAR generation, shaped [frames,64].", "required": false }, { "name": "export_semantic", "type": "bool", "description": "Attach the semantic token stream as a semantic artifact (JSON array of codec indices); default false.", "required": false, "default": false }, { "name": "guidance_scale", "type": "float", "description": "Semantic classifier-free guidance scale. Default follows the upstream route defaults. Omitted defaults to 1.01 with cot=off, otherwise 1.0.", "required": false, "min": 0, "max": 20 }, { "name": "seed", "type": "int", "description": "Generation seed. Must be nonnegative and less than 2^63.", "required": false, "min": 0, "default": 1234 }, { "name": "num_inference_steps", "type": "int", "description": "NAR midpoint ODE steps.", "required": false, "min": 1, "default": 8 }, { "name": "abc_temperature", "type": "float", "description": "ABC planner sampling temperature.", "required": false, "min": 0, "max": 5 }, { "name": "abc_top_p", "type": "float", "description": "ABC planner nucleus sampling probability. Must be in (0, 1].", "required": false, "max": 1 }, { "name": "abc_top_k", "type": "int", "description": "ABC planner top-k sampling limit.", "required": false, "min": 1 }, { "name": "abc_repetition_penalty", "type": "float", "description": "ABC planner repetition penalty. Must be positive.", "required": false }, { "name": "abc_penalty_window", "type": "int", "description": "ABC planner repetition penalty window.", "required": false, "min": 1 }, { "name": "abc_min_tokens", "type": "int", "description": "Minimum ABC planner tokens before EOS is accepted.", "required": false, "min": 0 }, { "name": "abc_max_tokens", "type": "int", "description": "Maximum ABC planner tokens. Zero is allowed when min_tokens is also zero.", "required": false, "min": 0 }, { "name": "semantic_temperature", "type": "float", "description": "Semantic codec sampling temperature.", "required": false, "min": 0, "max": 5 }, { "name": "semantic_top_p", "type": "float", "description": "Semantic codec nucleus sampling probability. Must be in (0, 1].", "required": false, "max": 1 }, { "name": "semantic_top_k", "type": "int", "description": "Semantic codec top-k sampling limit.", "required": false, "min": 1 }, { "name": "semantic_repetition_penalty", "type": "float", "description": "Semantic codec repetition penalty. Must be positive.", "required": false }, { "name": "semantic_penalty_window", "type": "int", "description": "Semantic codec repetition penalty window.", "required": false, "min": 1 }, { "name": "semantic_min_tokens", "type": "int", "description": "Minimum semantic tokens before EOS is accepted.", "required": false, "min": 0 }, { "name": "semantic_max_tokens", "type": "int", "description": "Maximum semantic codec tokens. Zero is allowed when min_tokens is also zero.", "required": false, "min": 0 }], "session": [{ "name": "ar_lora", "type": "string", "description": "AR adapter safetensors file; native, PEFT, and ComfyUI LoRA layouts. Absolute path or relative to the model root. Requires session reload.", "required": false }, { "name": "ar_lora_scale", "type": "float", "description": "AR LoRA delta scale; zero disables the adapter. Requires session reload.", "required": false, "default": 1 }, { "name": "nar_lora", "type": "string", "description": "NAR adapter safetensors file. Absolute path or relative to the model root. Requires session reload.", "required": false }, { "name": "nar_lora_scale", "type": "float", "description": "NAR LoRA delta scale; full vae2llm/llm2vae replacements are unscaled. Zero disables the entire adapter. Requires session reload.", "required": false, "default": 1 }, { "name": "weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_k"], "description": "Shared weight storage type.", "required": false, "default": "native" }, { "name": "model_weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_k"], "description": "YuE2 MoT weight storage type. Omitted inherits weight_type.", "required": false }, { "name": "model_gguf", "type": "string", "description": "Yue2 main AR/NAR component GGUF file relative to the model root.", "required": false, "default": "yue2-3b-q8_0.gguf" }, { "name": "vae_gguf", "type": "string", "description": "Yue2 VAE component GGUF file relative to the model root.", "required": false, "default": "yue2-vae-f16.gguf" }, { "name": "vae_weight_type", "type": "enum", "values": ["native", "f32", "f16", "bf16", "q8_0", "q4_0", "q4_k"], "description": "YuE2 VAE weight storage type. Omitted inherits weight_type.", "required": false }, { "name": "model_weight_context_mb", "type": "int", "description": "YuE2 MoT weight context size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "vae_weight_context_mb", "type": "int", "description": "YuE2 VAE weight context size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "ar_prefill_graph_arena_mb", "type": "int", "description": "AR prefill graph arena size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "ar_decode_graph_arena_mb", "type": "int", "description": "AR one-token decode graph arena size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "nar_graph_arena_mb", "type": "int", "description": "NAR acoustic flow graph arena size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "vae_graph_arena_mb", "type": "int", "description": "VAE decode graph arena size in MiB.", "required": false, "min": 1, "default": 32 }, { "name": "attention", "type": "enum", "description": "NAR acoustic-flow attention lowering; auto selects the backend-appropriate implementation.", "required": false, "values": ["auto", "flash", "eager"], "default": "auto" }, { "name": "perf_mode", "type": "enum", "description": "Performance preset; cuda_perf packs AR projections, aligns KV capacity to 256 tokens, retains stages and caps VAE tiles at 512 frames. Explicit controls override the preset. May change audio and substantially increase peak VRAM.", "values": ["off", "cuda_perf"], "required": false, "default": "off" }, { "name": "packed_projections", "type": "bool", "description": "Pack AR QKV and gate/up projections without changing weight dtype. Default false, true with cuda_perf. Explicit values override the preset.", "required": false }, { "name": "kv_cache_alignment", "type": "int", "description": "AR KV capacity alignment in tokens; values above 1 also use cached CUDA CFG attention windows of this size. Default 1, or 256 with cuda_perf; may use more memory and change numerics. Explicit values override the preset.", "required": false, "min": 1 }, { "name": "mem_saver", "type": "bool", "description": "Release AR/NAR runtimes and VAE graphs after generation. Default true, false with cuda_perf. Disabling retains stages and can substantially increase peak VRAM.", "required": false }, { "name": "vae_tile_frames", "type": "int", "description": "Latent core frames per VAE tile; defaults to model configuration, capped at 512 with cuda_perf. Explicit values override the cap. The halo is unchanged; different boundaries can change numerical results.", "required": false, "min": 1 }, { "name": "attention_tile_rows", "type": "int", "description": "Query rows per eager NAR attention tile; nonpositive values select automatic tiling to keep each score matrix below 3 GiB.", "required": false, "default": 0 }], "load": [] };
const package_defaults$1 = { "download": { "kind": "huggingface_snapshot", "repo": "audio-cpp/Yue2-3B-GGUF", "revision": "main", "gated": false } };
const packages$2 = [{ "id": "yue2_main_q8_0", "display_name": "Yue2 3B Main Q8_0", "default": true, "format": "gguf", "precision": "q8_0", "target_directory": "Yue2-3B-GGUF", "files": ["sidecars/yue2-model-config.json", "sidecars/yue2-generation-config.json", "sidecars/yue2-qwen.tiktoken", "sidecars/yue2-vae-config.json", "yue2-3b-q8_0.gguf"] }, { "id": "yue2_main_bf16", "display_name": "Yue2 3B Main BF16", "format": "gguf", "precision": "bf16", "target_directory": "Yue2-3B-GGUF", "files": ["sidecars/yue2-model-config.json", "sidecars/yue2-generation-config.json", "sidecars/yue2-qwen.tiktoken", "sidecars/yue2-vae-config.json", "yue2-3b-bf16.gguf"] }, { "id": "yue2_main_q4_0", "display_name": "Yue2 3B Main Q4_0", "format": "gguf", "precision": "q4_0", "target_directory": "Yue2-3B-GGUF", "files": ["sidecars/yue2-model-config.json", "sidecars/yue2-generation-config.json", "sidecars/yue2-qwen.tiktoken", "sidecars/yue2-vae-config.json", "yue2-3b-q4_0.gguf"] }, { "id": "yue2_vae_f16", "display_name": "Yue2 VAE F16", "format": "gguf", "precision": "f16", "target_directory": "Yue2-3B-GGUF", "files": ["sidecars/yue2-model-config.json", "sidecars/yue2-generation-config.json", "sidecars/yue2-qwen.tiktoken", "sidecars/yue2-vae-config.json", "yue2-vae-f16.gguf"] }, { "id": "yue2_vae_f32", "display_name": "Yue2 VAE F32", "format": "gguf", "precision": "f32", "target_directory": "Yue2-3B-GGUF", "files": ["sidecars/yue2-model-config.json", "sidecars/yue2-generation-config.json", "sidecars/yue2-qwen.tiktoken", "sidecars/yue2-vae-config.json", "yue2-vae-f32.gguf"] }];
const sources$1 = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "model_config": "model:sidecars/yue2-model-config.json", "generation_config": "model:sidecars/yue2-generation-config.json", "tiktoken": "model:sidecars/yue2-qwen.tiktoken", "vae_config": "model:sidecars/yue2-vae-config.json" }, "tensors": { "model_weights": { "source": "weights:", "prefix": "model_weights" } } }, { "format": "safetensors", "roots": { "model": "YuE2-3B", "vae": "YuE2-Vae" }, "files": { "model_config": "model:config.json", "generation_config": "model:yue2_generation_config.json", "tiktoken": "model:qwen.tiktoken", "vae_config": "vae:config.json" }, "tensors": { "model_weights": "model:model.safetensors", "vae_weights": "vae:model.safetensors" } }];
const __vite_glob_0_132 = {
  schema_version: schema_version$1,
  family: family$1,
  display_name: display_name$1,
  description: description$1,
  category: category$1,
  status: status$1,
  tasks: tasks$1,
  modes: modes$1,
  languages: languages$1,
  capabilities: capabilities$1,
  runtime: runtime$1,
  dependencies: dependencies$1,
  ui: ui$1,
  options: options$1,
  package_defaults: package_defaults$1,
  packages: packages$2,
  sources: sources$1
};
const schema_version = 1;
const family = "zipvoice";
const display_name = "ZipVoice";
const description = "Community ZipVoice / ZipVoice-Distill flow-matching TTS with a TTSZipformer backbone (U-Net downsampling stacks, compact relative position attention), duration prediction from prompt ratio, Euler solver with t-shift and classifier-free guidance, and Vocos mel-24kHz vocoder (k2-fsa/ZipVoice).";
const category = "tts";
const status = "community";
const tasks = ["tts", "clone"];
const modes = ["offline", "streaming"];
const languages = ["en", "zh"];
const runtime = { "tags": ["server", "stream"] };
const capabilities = { "clone": ["speaker_reference"] };
const options = { "request": [{ "name": "reference_text", "type": "string", "description": "Transcript matching the reference voice audio; required for zero-shot cloning.", "required": true }, { "name": "text_chunk_size", "type": "int", "description": "Maximum characters per generated text chunk; default 128.", "required": false, "min": 1, "default": 128 }, { "name": "text_chunk_mode", "type": "enum", "description": "Framework text chunking mode.", "preset": "text_chunk_mode_full", "required": false, "default": "word_budget" }, { "name": "guidance_scale", "type": "float", "description": "Guidance scale; inherits the session default (3.0 for both variants). ZipVoice-Distill uses a guidance-scale embedding; ZipVoice uses batched CFG. Zero disables guidance. Any finite nonnegative value is accepted.", "required": false, "min": 0, "default": 3 }, { "name": "num_inference_steps", "type": "int", "description": "Euler ODE steps; inherits the session default (8 for both variants).", "required": false, "min": 1, "max": 64, "default": 8 }, { "name": "shift", "type": "float", "description": "Shift timesteps toward low SNR (smaller = stronger shift); default 0.5. Must be finite and positive.", "required": false, "default": 0.5 }, { "name": "speed", "type": "float", "description": "Speech speed multiplier applied through the prompt-duration ratio; default 1.0. Must be finite and positive.", "required": false, "default": 1 }, { "name": "feat_scale", "type": "float", "description": "Feature scale applied to log-mel features; default 0.1 (reference default). Must be finite and positive.", "required": false, "default": 0.1 }, { "name": "target_rms", "type": "float", "description": "Target RMS for prompt loudness normalization; 0 disables. Default 0.1. Negative values disable normalization; values above 1 are accepted.", "required": false, "default": 0.1 }, { "name": "seed", "type": "int", "description": "Noise seed; default 666 (reference default).", "required": false, "min": 0, "default": 666 }, { "name": "language", "type": "string", "description": "espeak language for phonemization; default en-us.", "required": false, "default": "en-us" }], "session": [{ "name": "vocos_path", "type": "string", "description": "Path to the Vocos vocoder checkpoint (vocos.safetensors or GGUF); required unless bundled in the model GGUF or placed next to the checkpoint.", "required": false }, { "name": "guidance_scale", "type": "float", "description": "Default guidance scale for requests that do not set it; must be finite and nonnegative.", "required": false, "min": 0, "default": 3 }, { "name": "num_inference_steps", "type": "int", "description": "Default Euler steps for requests that do not set it.", "required": false, "min": 1, "max": 64, "default": 8 }, { "name": "shift", "type": "float", "description": "Default timestep shift for requests that do not set it; must be finite and positive.", "required": false, "default": 0.5 }, { "name": "espeak_library_path", "type": "string", "description": "Path to the espeak-ng shared library (e.g. /opt/homebrew/lib/libespeak-ng.dylib) for tokenizer=espeak.", "required": false }, { "name": "espeak_data_path", "type": "string", "description": "Path to the espeak-ng data directory or package for tokenizer=espeak.", "required": false }], "load": [] };
const package_defaults = { "download": { "kind": "huggingface_snapshot", "repo": "davidxifeng/zipvoice-gguf", "revision": "main", "gated": false } };
const packages$1 = [{ "id": "zipvoice_distill_gguf", "display_name": "ZipVoice-Distill GGUF (local conversion)", "description": "Self-contained GGUF: flow-matching model, bundled Vocos vocoder and the embedded text-frontend sidecars (tokens, config, zh tables) in one file. Converted from k2-fsa/ZipVoice with export_zipvoice_zh_dict.py + convert_zipvoice.py.", "default": true, "format": "gguf", "precision": "orig", "target_directory": "ZipVoice-Distill-GGUF", "files": ["zipvoice-distill-orig.gguf"] }, { "id": "zipvoice_distill_q8_0", "display_name": "ZipVoice-Distill GGUF (Q8_0)", "description": "Self-contained Q8_0 GGUF with bundled Vocos and embedded text-frontend sidecars.", "format": "gguf", "precision": "q8_0", "target_directory": "ZipVoice-Distill-GGUF", "files": ["zipvoice-distill-q8_0.gguf"] }];
const dependencies = [];
const ui = { "recommended_package": "zipvoice_distill_gguf", "tags": ["TTS", "Clone"], "docs": ["docs/models/zipvoice.md"] };
const sources = [{ "format": "gguf", "roots": { "model": ".", "weights": "$gguf" }, "files": { "tokens": "model:tokens.txt", "model_config": "model:model.json" }, "optional_files": { "zh_chars": "model:zh_chars.tsv", "zh_phrases": "model:zh_phrases.tsv", "zh_syllables": "model:zh_syllables.tsv", "zh_jieba_dict": "model:zh_jieba_dict.txt", "zh_hmm_model": "model:zh_hmm_model.txt" }, "tensors": { "model": { "source": "weights:", "prefix": "model" } }, "optional_tensors": { "vocos_vocoder": { "source": "weights:", "prefix": "vocos" } } }];
const __vite_glob_0_133 = {
  schema_version,
  family,
  display_name,
  description,
  category,
  status,
  tasks,
  modes,
  languages,
  runtime,
  capabilities,
  options,
  package_defaults,
  packages: packages$1,
  dependencies,
  ui,
  sources
};
const models = /* @__PURE__ */ JSON.parse('[{"id":"ace-step","display_name":"ACE-Step 1.5 (music gen)","family":"ace_step","path":"models/Ace-Step1.5","task":"gen","mode":"offline","download_id":"ace_step","default_text":"upbeat pop music with bright vocals and energetic drums","session_options":{"ace_step.mem_saver":"true","ace_step.dit_weight_type":"q8_0","ace_step.text_encoder_weight_type":"q8_0","ace_step.planner_weight_type":"q8_0"},"min_vram_gb":8},{"id":"ming3-tts","display_name":"Ming 3.0 TTS 0.5B","family":"ming3_tts","path":"models/Ming-3.0-TTS-0.5B-GGUF","task":"tts","mode":"offline","download_id":"ming_3_0_tts_0_5b_bf16","default_options":{"language":"en"},"default_text":"Good evening. The harbor is quiet tonight."},{"id":"ming3-tts-clone","display_name":"Ming 3.0 TTS 0.5B Clone","family":"ming3_tts","path":"models/Ming-3.0-TTS-0.5B-GGUF","task":"clon","mode":"offline","download_id":"ming_3_0_tts_0_5b_bf16","default_options":{"language":"en"},"input_hint_en":"Upload a reference voice. Its transcript is optional and enables acoustic-prefix conditioning."},{"id":"ming3-tts-design","display_name":"Ming 3.0 TTS 0.5B Voice Design","family":"ming3_tts","path":"models/Ming-3.0-TTS-0.5B-GGUF","task":"vdes","mode":"offline","download_id":"ming_3_0_tts_0_5b_bf16","default_options":{"language":"en"}},{"id":"ming3-audio-asr","display_name":"Ming 3.0 Audio Tiny ASR","family":"ming3_audio","path":"models/Ming-3.0-Audio-Tiny-GGUF","task":"asr","mode":"offline","download_id":"ming3_audio_tiny_bf16"},{"id":"ming3-audio-understanding","display_name":"Ming 3.0 Audio Tiny Understanding","family":"ming3_audio","path":"models/Ming-3.0-Audio-Tiny-GGUF","task":"asr","workflow":"analysis","mode":"offline","download_id":"ming3_audio_tiny_bf16","default_options":{"prompt":"Describe the sounds in this recording."}},{"id":"ming3-audio-response","display_name":"Ming 3.0 Audio Tiny Spoken Response","family":"ming3_audio","path":"models/Ming-3.0-Audio-Tiny-GGUF","task":"s2s","mode":"offline","download_id":"ming3_audio_tiny_bf16","default_options":{"voice_id":"US_James","language":"en"}},{"id":"ming3-audio-tts","display_name":"Ming 3.0 Audio Tiny TTS","family":"ming3_audio","path":"models/Ming-3.0-Audio-Tiny-GGUF","task":"tts","mode":"offline","download_id":"ming3_audio_tiny_bf16","default_options":{"voice_id":"US_James","language":"en"}},{"id":"ming3-audio-clone","display_name":"Ming 3.0 Audio Tiny Clone","family":"ming3_audio","path":"models/Ming-3.0-Audio-Tiny-GGUF","task":"clon","mode":"offline","download_id":"ming3_audio_tiny_bf16","default_options":{"language":"en"},"input_hint_en":"Upload a reference voice. Add its transcript to enable acoustic-prefix conditioning."},{"id":"xtts-v2","display_name":"XTTS v2","family":"xtts_v2","path":"models/XTTS-v2-Q8","task":"tts","mode":"offline","download_id":"xtts_v2_gguf_q8_0","input_hint_en":"Upload a reference voice for multilingual speech synthesis."},{"id":"latentsync","display_name":"LatentSync 1.6 Lip Sync","family":"latentsync","path":"models/LatentSync-1.6-GGUF","task":"gen","mode":"offline","download_id":"latentsync_1_6_q8_0_f16","arena":false,"input_hint_en":"Choose a face video and driving speech audio."},{"id":"apollo","display_name":"Apollo","family":"apollo","path":"models/Apollo-GGUF","task":"s2s","mode":"offline","download_id":"apollo_orig"},{"id":"ast-audioset","display_name":"AST AudioSet","family":"ast_audioset","path":"models/AST-AudioSet-GGUF/ast-audioset-f32.gguf","task":"cls","mode":"offline","download_id":"ast_audioset_f32"},{"id":"audio-flamingo-3","display_name":"Audio Flamingo 3","family":"audio_flamingo","path":"models/Audio-Flamingo-GGUF/audio-flamingo-3-q4_k.gguf","task":"asr","mode":"offline","download_id":"audio_flamingo_3_q4_k","workflow":"analysis"},{"id":"audio-flamingo-next","display_name":"Audio Flamingo Next","family":"audio_flamingo","path":"models/Audio-Flamingo-GGUF/audio-flamingo-next-q4_k.gguf","task":"asr","mode":"offline","download_id":"audio_flamingo_next_q4_k","workflow":"analysis"},{"id":"audio8-asr","display_name":"Audio8 ASR 0.1B (local setup)","family":"audio8_asr","path":"models/Audio8-ASR-0.1B-GGUF/audio8-asr-0.1b-q8_0.gguf","task":"asr","mode":"offline","manual_setup":true,"weights_url":"https://huggingface.co/Audio8/Audio8-ASR-0.1B","setup_url":"https://github.com/0xShug0/audio.cpp/blob/main/docs/models/audio8_asr.md","input_hint_en":"**Audio8 ASR 0.1B**: offline transcription in en/zh/yue/ja/ko/fr/de. Convert your checkpoint locally and place Audio8-ASR-0.1B-GGUF/audio8-asr-0.1b-q8_0.gguf inside the selected models folder. This model has no one-click GGUF download."},{"id":"audio8-tts-0.1b-bf16","display_name":"Audio8 TTS Preview 0.1B (BF16, local setup)","family":"audio8_tts","path":"models/Audio8-TTS-Preview-0.1B-GGUF/audio8-tts-preview-0.1b-bf16.gguf","task":"tts","mode":"offline","manual_setup":true,"weights_url":"https://huggingface.co/Edge0/Audio8-TTS-Preview-0.1b","setup_url":"https://github.com/0xShug0/audio.cpp/blob/main/docs/models/audio8_tts.md","input_hint_en":"**Audio8 TTS Preview 0.1B (BF16)**: primarily Chinese and English TTS with optional reference audio and transcript for voice cloning. Convert the main checkpoint and codec locally; place Audio8-TTS-Preview-0.1B-GGUF/audio8-tts-preview-0.1b-bf16.gguf inside the selected models folder. This is a local conversion entry; synthesis quality must be validated on your deployment."},{"id":"audio8-tts-0.1b-q8_0","display_name":"Audio8 TTS Preview 0.1B (Q8_0, local setup)","family":"audio8_tts","path":"models/Audio8-TTS-Preview-0.1B-GGUF/audio8-tts-preview-0.1b-q8_0.gguf","task":"tts","mode":"offline","manual_setup":true,"weights_url":"https://huggingface.co/Edge0/Audio8-TTS-Preview-0.1b","setup_url":"https://github.com/0xShug0/audio.cpp/blob/main/docs/models/audio8_tts.md","input_hint_en":"**Audio8 TTS Preview 0.1B (Q8_0)**: primarily Chinese and English TTS with optional reference audio and transcript for voice cloning. Convert the main checkpoint and codec locally; place Audio8-TTS-Preview-0.1B-GGUF/audio8-tts-preview-0.1b-q8_0.gguf inside the selected models folder. This is a local conversion entry; synthesis quality must be validated on your deployment."},{"id":"audio8-tts","display_name":"Audio8 TTS Preview 0.6B (tts 克隆, GGUF Q8)","display_name_en":"Audio8 TTS Preview 0.6B (tts + clone, GGUF Q8)","family":"audio8_tts","path":"models/Audio8-TTS-Preview-0.6B-GGUF","task":"tts","mode":"offline","download_id":"audio8_tts_preview_0_6b_q8_0","min_vram_gb":4,"input_hint":"**Audio8 TTS Preview 0.6B**：多语种 TTS / 零样本克隆（支持 yue/zh/nl/en/fr/de/it/ja/ko/pl/es/auto）；上传参考音色+参考文本即克隆，留空为普通 TTS；长文本自动分句。","input_hint_en":"**Audio8 TTS Preview 0.6B**: multilingual TTS and zero-shot clone (yue/zh/nl/en/fr/de/it/ja/ko/pl/es/auto). Upload a reference voice + transcript to clone; leave empty for plain TTS. Long text is chunked automatically."},{"id":"audiosr","display_name":"AudioSR (audio super-resolution)","family":"audiosr","path":"models/AudioSR-GGUF/audiosr-basic-f32.gguf","task":"s2s","mode":"offline","download_id":"audiosr_basic_f32","min_vram_gb":8,"input_hint_en":"**AudioSR**: upload a source audio file to generate a super-resolved output."},{"id":"auk-edit","display_name":"AuK (audio editing, community)","family":"auk","path":"models/AuK-Base-and-Flash-GGUF","task":"gen","mode":"offline","arena":false,"download_id":"auk_base_f32","default_text":"Remove the background noise and make the voice clearer.","min_vram_gb":20,"input_hint_en":"**AuK audio editing** (community): upload source audio and describe the requested speech, singing, acoustic, paralinguistic, enhancement, or separation edit."},{"id":"auk-tts","display_name":"AuK (speech generation, community)","family":"auk","path":"models/AuK-Base-and-Flash-GGUF","task":"tts","mode":"offline","arena":false,"download_id":"auk_base_f32","default_text":"The next train leaves in ten minutes.","min_vram_gb":20,"input_hint_en":"**AuK** (community): enter text plus a voice description, or provide an optional reference voice for zero-shot speech generation. Select compatible Base or AuK-Flash, Qwen, and VAE components before loading."},{"id":"breeze-tts-clone","display_name":"BreezeTTS 2 Clone","family":"breeze_tts","path":"models/Breeze-TTS-2-GGUF/breeze-tts-2-q8_0.gguf","task":"clon","mode":"offline","download_id":"breeze_tts_2_q8_0","min_vram_gb":8,"input_hint_en":"**BreezeTTS 2 Clone**: upload a reference voice and provide the matching reference transcript."},{"id":"breeze-tts","display_name":"BreezeTTS 2 VoiceDesign","family":"breeze_tts","path":"models/Breeze-TTS-2-GGUF/breeze-tts-2-q8_0.gguf","task":"vdes","mode":"offline","download_id":"breeze_tts_2_q8_0","min_vram_gb":8,"input_hint_en":"**BreezeTTS 2 VoiceDesign**: enter text and describe the target voice in Model parameters. No reference voice is required."},{"id":"bs-roformer","display_name":"BS-RoFormer (sep 人声分离)","display_name_en":"BS-RoFormer (vocal separation)","family":"bs_roformer","path":"models/BS-RoFormer-ep368-GGUF/bs-roformer-ep368-q8_0.gguf","task":"sep","mode":"offline","download_id":"bs_roformer_q8_0","min_vram_gb":3},{"id":"canary-asr","display_name":"Canary 180M Flash","family":"canary_asr","path":"models/Canary-180M-Flash-GGUF","task":"asr","mode":"offline","download_id":"canary_180m_flash_f32"},{"id":"ced-base","display_name":"CED Base","family":"ced","path":"models/CED-GGUF/ced-base-f32.gguf","task":"cls","mode":"offline","download_id":"ced_base_f32"},{"id":"ced-mini","display_name":"CED Mini","family":"ced","path":"models/CED-GGUF/ced-mini-f32.gguf","task":"cls","mode":"offline","download_id":"ced_mini_f32"},{"id":"ced-small","display_name":"CED Small","family":"ced","path":"models/CED-GGUF/ced-small-f32.gguf","task":"cls","mode":"offline","download_id":"ced_small_f32"},{"id":"ced-tiny","display_name":"CED Tiny","family":"ced","path":"models/CED-GGUF/ced-tiny-f32.gguf","task":"cls","mode":"offline","download_id":"ced_tiny_f32"},{"id":"chatterbox-vc","display_name":"Chatterbox (vc 声音转换)","display_name_en":"Chatterbox (voice conversion)","family":"chatterbox","path":"models/chatterbox","task":"vc","mode":"offline","download_id":"chatterbox","min_vram_gb":12,"input_hint":"**Chatterbox VC**：上传源语音和目标音色参考；模型保留源语音内容，将说话人音色转换为目标音色，输出 24kHz 单声道。","input_hint_en":"**Chatterbox VC**: upload source speech and a target-voice reference. It preserves the source content and converts the speaker identity; output is 24 kHz mono."},{"id":"chatterbox","display_name":"Chatterbox (voice clone)","family":"chatterbox","path":"models/chatterbox","task":"clon","mode":"offline","download_id":"chatterbox","min_vram_gb":12},{"id":"chatterbox-turbo","display_name":"Chatterbox Turbo (tts)","family":"chatterbox_turbo","path":"models/Chatterbox-Turbo-GGUF/chatterbox-turbo-q8_0.gguf","task":"tts","mode":"offline","download_id":"chatterbox_turbo_q8_0","min_vram_gb":4,"input_hint_en":"**Chatterbox Turbo**: fast English TTS with the built-in voice. No reference voice is required."},{"id":"citrinet-asr","display_name":"Citrinet ASR (asr)","family":"citrinet_asr","path":"models/citrinet","task":"asr","mode":"offline","download_id":"citrinet_asr","min_vram_gb":2},{"id":"cohere-asr","display_name":"Cohere Transcribe","family":"cohere_asr","path":"models/Cohere-Transcribe-GGUF","task":"asr","mode":"offline","download_id":"cohere_transcribe_bf16"},{"id":"r2t2-asr","display_name":"Confucius4-R2T2 (asr, 实时流式)","display_name_en":"Confucius4-R2T2 (asr, real-time streaming)","family":"confucius4_r2t2","path":"models/Confucius4-R2T2-GGUF/r2t2-q8_0.gguf","task":"asr","mode":"offline","download_id":"confucius4_r2t2_q8_0","min_vram_gb":5,"input_hint":"**Confucius4-R2T2**：网易有道实时流式 ASR，Qwen3-ASR-1.7B 微调，LSP 稳定前缀解码；提交文本永不回改，支持 80ms-2s 分块；Q8_0 GGUF（2.3G，自包含单文件），也支持 F16。","input_hint_en":"**Confucius4-R2T2**: NetEase Youdao real-time streaming ASR, a Qwen3-ASR 1.7B fine-tune with Longest Stable Prefix decoding. Committed text is never revised; 80 ms-2 s chunks; Q8_0 GGUF (2.3 GB, self-contained single file), F16 also available."},{"id":"confucius4-tts","display_name":"Confucius4-TTS (voice clone, GGUF)","display_name_en":"Confucius4-TTS (voice clone, GGUF)","family":"confucius4_tts","path":"models/Confucius4-TTS-GGUF","task":"clon","mode":"offline","download_id":"confucius4_tts_orig","min_vram_gb":8,"input_hint":"**Confucius4-TTS**：需要参考音色；当前中文/英语路径更可靠，非中英语种仍在验证中。","input_hint_en":"**Confucius4-TTS**: requires a reference voice. Chinese/English are the most reliable paths; other languages are still being validated."},{"id":"controlfoley","display_name":"ControlFoley (Foley/SFX)","family":"controlfoley","path":"models/ControlFoley-GGUF/controlfoley-large-44k-q8_0.gguf","task":"gen","mode":"offline","download_id":"controlfoley_large_44k_q8_0","min_vram_gb":12,"request_options":["video"],"input_hint_en":"**ControlFoley**: Foley generation from text, video, text+video, audio+video, or video only. Upload video in the Video field; upload source audio for AC-V2A."},{"id":"cosyvoice3","display_name":"CosyVoice3 Clone","family":"cosyvoice3","path":"models/CosyVoice3-GGUF/cosyvoice3-q8_0.gguf","task":"clon","mode":"offline","download_id":"cosyvoice3_q8_0","min_vram_gb":8,"input_hint_en":"**CosyVoice3 Clone**: upload a reference voice and provide the matching reference transcript. Use `template_name` for zero-shot or cross-lingual requests."},{"id":"cosyvoice3-instruct","display_name":"CosyVoice3 Instruct","family":"cosyvoice3","path":"models/CosyVoice3-GGUF/cosyvoice3-q8_0.gguf","task":"tts","mode":"offline","download_id":"cosyvoice3_q8_0","min_vram_gb":8,"input_hint_en":"**CosyVoice3 Instruct**: upload a reference voice, provide its transcript, and set `template_name=instruct` with an instruction."},{"id":"crisperwhisper","display_name":"CrisperWhisper 2.0 Large","family":"crisperwhisper","path":"models/CrisperWhisper2.0-GGUF/crisperwhisper-2-large-q8_0.gguf","task":"asr","mode":"offline","download_id":"crisperwhisper_2_large_q8_0"},{"id":"crisperwhisper-align","display_name":"CrisperWhisper 2.0 Large (alignment)","family":"crisperwhisper","path":"models/CrisperWhisper2.0-GGUF/crisperwhisper-2-large-q8_0.gguf","task":"align","mode":"offline","download_id":"crisperwhisper_2_large_q8_0","workflow":"analysis"},{"id":"deepfilternet2","display_name":"DeepFilterNet2","family":"builtin_audio_utils","task":"s2s","workflow":"enhancement","mode":"offline","path":"models/Audio-Utilities/deepfilternet2/deepfilternet2.safetensors","load_options":{"utility":"deepfilternet2"},"weights_url":"https://raw.githubusercontent.com/0xShug0/audio.cpp/main/assets/framework/audio_utilities/deepfilternet2/deepfilternet2.safetensors"},{"id":"dots-tts-meanflow","display_name":"DotTTS MeanFlow (tts + clone)","family":"dots_tts","path":"models/DotTTS-MF-GGUF","task":"tts","mode":"offline","download_id":"dots_tts_mf_q8_0","min_vram_gb":8},{"id":"dots-tts-soar","display_name":"DotTTS SOAR (tts + clone)","family":"dots_tts","path":"models/DotTTS-SOAR-GGUF","task":"tts","mode":"offline","download_id":"dots_tts_soar_q8_0","min_vram_gb":8},{"id":"dramabox","display_name":"DramaBox (tts 克隆, GGUF Q8)","display_name_en":"DramaBox (tts + clone, GGUF Q8)","family":"dramabox","path":"models/DramaBox-GGUF","task":"tts","mode":"offline","download_id":"dramabox_q8_0","min_vram_gb":16,"input_hint":"**DramaBox**：英语 TTS / voice clone；上传参考音色可克隆，长文本建议写清楚说话人描述。","input_hint_en":"**DramaBox**: English TTS and voice clone. Upload a reference voice to clone; for long text, keep speaker wording explicit."},{"id":"echo-tts","display_name":"Echo-TTS (voice clone)","family":"echo_tts","path":"models/Echo-TTS-GGUF","task":"clon","mode":"offline","download_id":"echo_tts_q8_0","min_vram_gb":8,"input_hint_en":"**Echo-TTS**: English zero-shot cloning at 44.1 kHz. Upload a reference voice -- no transcript needed. Output is CC-BY-NC-SA and may not be used commercially."},{"id":"firered-stream-vad","display_name":"FireRed Stream-VAD","family":"firered_vad","path":"models/FireRedVAD-GGUF/firered-stream-vad-f32.gguf","task":"vad","mode":"offline","download_id":"firered_stream_vad_f32"},{"id":"firered-vad","display_name":"FireRed VAD","family":"firered_vad","path":"models/FireRedVAD-GGUF/firered-vad-f32.gguf","task":"vad","mode":"offline","download_id":"firered_vad_f32"},{"id":"firered-audio-asr","display_name":"FireRedAudio (ASR / audio QA)","family":"firered_audio","path":"models/FireRedAudio-GGUF/firered-audio-q8_0.gguf","task":"asr","mode":"offline","download_id":"firered_audio_q8_0","min_vram_gb":10,"input_hint_en":"**FireRedAudio ASR**: upload audio, then use the text box as the transcription or audio-understanding instruction."},{"id":"firered-audio-acoustic-edit","display_name":"FireRedAudio Acoustic Edit","family":"firered_audio","path":"models/FireRedAudio-GGUF/firered-audio-q8_0.gguf","task":"gen","mode":"offline","download_id":"firered_audio_q8_0","min_vram_gb":10,"input_hint_en":"**FireRedAudio Acoustic Edit**: upload source audio and use a trained acoustic instruction such as `shift the pitch by 3 steps`."},{"id":"firered-audio-tts","display_name":"FireRedAudio Clone","family":"firered_audio","path":"models/FireRedAudio-GGUF/firered-audio-q8_0.gguf","task":"clon","mode":"offline","download_id":"firered_audio_q8_0","min_vram_gb":10,"input_hint_en":"**FireRedAudio Clone**: upload a reference voice and provide the matching reference transcript. For no-reference voice design, use the VoiceDesign entry."},{"id":"firered-audio-semantic-edit","display_name":"FireRedAudio Semantic Edit","family":"firered_audio","path":"models/FireRedAudio-GGUF/firered-audio-q8_0.gguf","task":"gen","mode":"offline","download_id":"firered_audio_q8_0","min_vram_gb":10,"input_hint_en":"**FireRedAudio Semantic Edit**: upload source audio and describe the content edit in Model parameters."},{"id":"firered-audio-vdesign","display_name":"FireRedAudio VoiceDesign","family":"firered_audio","path":"models/FireRedAudio-GGUF/firered-audio-q8_0.gguf","task":"vdes","mode":"offline","download_id":"firered_audio_q8_0","min_vram_gb":10,"input_hint_en":"**FireRedAudio VoiceDesign**: describe the target voice in Voice description, then enter the text to synthesize."},{"id":"fireredtts3-base","display_name":"FireRedTTS3 Base (voice clone)","family":"fireredtts3","path":"models/FireRedTTS3-Base-GGUF/fireredtts3-base-q8_0.gguf","task":"clon","mode":"offline","download_id":"fireredtts3_base_q8_0","min_vram_gb":8,"input_hint_en":"**FireRedTTS3 Base**: zero-shot voice cloning. Upload a reference voice and provide the matching reference transcript."},{"id":"fireredtts3-instruct","display_name":"FireRedTTS3 Instruct Clone","family":"fireredtts3","path":"models/FireRedTTS3-Instruct-GGUF/fireredtts3-instruct-q8_0.gguf","task":"clon","mode":"offline","download_id":"fireredtts3_instruct_q8_0","min_vram_gb":8,"input_hint_en":"**FireRedTTS3 Instruct Clone**: official Instruct `generate_tts` path. Upload a reference voice and provide the matching reference transcript. For no-reference voice design, use the VoiceDesign entry."},{"id":"fireredtts3-instruct-vdesign","display_name":"FireRedTTS3 Instruct VoiceDesign","family":"fireredtts3","path":"models/FireRedTTS3-Instruct-GGUF/fireredtts3-instruct-q8_0.gguf","task":"vdes","mode":"offline","download_id":"fireredtts3_instruct_q8_0","min_vram_gb":8,"input_hint_en":"**FireRedTTS3 VoiceDesign**: describe the target voice in Voice description, then enter the text to synthesize."},{"id":"fish-drama3","display_name":"Fish Audio Drama 3","family":"fish_drama3","path":"models/Drama-3-GGUF/drama-3-backbone-4bit-experts-Q4_K_S.gguf","task":"tts","mode":"offline","arena":false,"download_id":"fish_drama3_q4_backbone","min_vram_gb":8,"session_options":{"fish_drama3.disk_experts":"true","fish_drama3.pin_experts":"true","fish_drama3.expert_cache_size":"8","fish_drama3.cpu_expert_layers":"0","fish_drama3.codec_backend":"same","fish_drama3.context_length":"4096"},"request_options":["reference_text","multi_reference_cond","text_chunk_size","temperature","top_p","top_k","max_tokens","seed"]},{"id":"fish-drama3-small","display_name":"Fish Audio Drama3-small","family":"fish_drama3","path":"models/Drama3-small-GGUF/drama3-small-IQ3_XXS.gguf","task":"tts","mode":"offline","arena":false,"download_id":"fish_drama3_small_iq3_xxs","min_vram_gb":7,"session_options":{"fish_drama3.disk_experts":"true","fish_drama3.pin_experts":"true","fish_drama3.expert_cache_size":"8","fish_drama3.cpu_expert_layers":"0","fish_drama3.codec_backend":"same","fish_drama3.context_length":"4096"}},{"id":"fish-audio-s2-pro","display_name":"Fish Audio S2 Pro (tts 克隆/控制标记, GGUF Q8)","display_name_en":"Fish Audio S2 Pro (tts + clone/control tags, GGUF Q8)","family":"fish_audio","path":"models/Fish-Audio-S2-Pro-GGUF","task":"tts","mode":"offline","download_id":"fish_audio_s2_pro","min_vram_gb":8,"input_hint":"**Fish Audio S2 Pro**：Q8_0 GGUF 包；中英+自动语种；上传参考音色即克隆；正文里可写行内控制标记（如 (laugh)）。","input_hint_en":"**Fish Audio S2 Pro**: Q8_0 GGUF package; English/Chinese plus auto language. Upload a reference voice to clone; inline control tags such as (laugh) can be written in the text."},{"id":"flashsr","display_name":"FlashSR","family":"builtin_audio_utils","task":"s2s","workflow":"enhancement","mode":"offline","path":"models/Audio-Utilities/flashsr/flashsr.safetensors","load_options":{"utility":"flashsr"},"weights_url":"https://raw.githubusercontent.com/0xShug0/audio.cpp/main/assets/framework/audio_utilities/flashsr/flashsr.safetensors"},{"id":"fun-asr-nano","display_name":"Fun-ASR-Nano 2512 (asr, GGUF Q8)","display_name_en":"Fun-ASR-Nano 2512 (asr, GGUF Q8)","family":"fun_asr_nano","path":"models/Fun-ASR-Nano-2512-GGUF","task":"asr","mode":"offline","download_id":"fun_asr_nano_2512_q8_0","min_vram_gb":4,"input_hint":"**Fun-ASR-Nano**：轻量离线 ASR；支持 auto/中文/英语/日语。","input_hint_en":"**Fun-ASR-Nano**: lightweight offline ASR; supports auto, Chinese, English and Japanese."},{"id":"gigaam-multilingual","display_name":"GigaAM Multilingual","family":"gigaam_asr","task":"asr","mode":"offline","path":"models/GigaAM-ASR-GGUF/gigaam-multilingual-ctc-f16.gguf","download_id":"gigaam_multilingual_ctc_f16"},{"id":"gigaam-multilingual-large","display_name":"GigaAM Multilingual Large","family":"gigaam_asr","task":"asr","mode":"offline","path":"models/GigaAM-ASR-GGUF/gigaam-multilingual-large-ctc-f16.gguf","download_id":"gigaam_multilingual_large_ctc_f16"},{"id":"gigaam-v3-ctc","display_name":"GigaAM v3 CTC","family":"gigaam_asr","task":"asr","mode":"offline","path":"models/GigaAM-ASR-GGUF/gigaam-v3-ctc-f16.gguf","download_id":"gigaam_v3_ctc_f16"},{"id":"gigaam-v3-e2e-ctc","display_name":"GigaAM v3 E2E CTC","family":"gigaam_asr","task":"asr","mode":"offline","path":"models/GigaAM-ASR-GGUF/gigaam-v3-e2e-ctc-f16.gguf","download_id":"gigaam_v3_e2e_ctc_f16"},{"id":"gigaam-v3-e2e-rnnt","display_name":"GigaAM v3 E2E RNN-T","family":"gigaam_asr","task":"asr","mode":"offline","path":"models/GigaAM-ASR-GGUF/gigaam-v3-e2e-rnnt-f16.gguf","download_id":"gigaam_v3_e2e_rnnt_f16"},{"id":"gigaam-v3-rnnt","display_name":"GigaAM v3 RNN-T","family":"gigaam_asr","task":"asr","mode":"offline","path":"models/GigaAM-ASR-GGUF/gigaam-v3-rnnt-f16.gguf","download_id":"gigaam_v3_rnnt_f16"},{"id":"glm-tts","display_name":"GLM-TTS (tts 克隆, 社区)","display_name_en":"GLM-TTS (tts + clone, community)","family":"glm_tts","path":"models/GLM-TTS","task":"tts","mode":"offline","download_id":"glm_tts","min_vram_gb":8,"input_hint":"**GLM-TTS**（社区模型）：中英 TTS / voice clone；上传参考音色即克隆。","input_hint_en":"**GLM-TTS** (community): Chinese/English TTS and voice clone. Upload a reference voice to clone."},{"id":"gradium-phonon-31m-en","display_name":"Gradium Phonon 31m English (tts)","family":"gradium_phonon","path":"models/phonon-31m-en","task":"tts","mode":"offline","download_id":"gradium_phonon_31m_en_q8_0","min_vram_gb":1},{"id":"granite5asr","display_name":"Granite Speech 5.0 470M TurboCTC (asr)","display_name_en":"Granite Speech 5.0 470M TurboCTC (asr)","family":"granite5asr","path":"models/Granite-Speech-5.0-470M-TurboCTC-GGUF/granite-speech-5.0-470m-turboctc-q8_0.gguf","task":"asr","mode":"offline","download_id":"granite5asr_q8_0","min_vram_gb":4,"input_hint":"**Granite Speech 5.0 TurboCTC**：IBM 470M 英语 ASR；超快 Conformer CTC 转写；支持长音频自动分段与流式模式。","input_hint_en":"**Granite Speech 5.0 TurboCTC**: IBM 470M English ASR with ultra-fast Conformer CTC architecture, supporting long-form audio segmentation and streaming mode."},{"id":"gtcrn-dns3","display_name":"GTCRN DNS3","family":"builtin_audio_utils","task":"s2s","workflow":"enhancement","mode":"offline","path":"models/Audio-Utilities/gtcrn/gtcrn_dns3.safetensors","load_options":{"utility":"gtcrn_dns3"},"weights_url":"https://raw.githubusercontent.com/0xShug0/audio.cpp/main/assets/framework/audio_utilities/gtcrn/gtcrn_dns3.safetensors"},{"id":"gtcrn-streaming","display_name":"GTCRN Streaming","family":"builtin_audio_utils","task":"s2s","workflow":"enhancement","mode":"offline","path":"models/Audio-Utilities/gtcrn/gtcrn_streaming.safetensors","load_options":{"utility":"gtcrn_streaming"},"weights_url":"https://raw.githubusercontent.com/0xShug0/audio.cpp/main/assets/framework/audio_utilities/gtcrn/gtcrn_streaming.safetensors"},{"id":"gtcrn-vctk","display_name":"GTCRN VCTK","family":"builtin_audio_utils","task":"s2s","workflow":"enhancement","mode":"offline","path":"models/Audio-Utilities/gtcrn/gtcrn_vctk.safetensors","load_options":{"utility":"gtcrn_vctk"},"weights_url":"https://raw.githubusercontent.com/0xShug0/audio.cpp/main/assets/framework/audio_utilities/gtcrn/gtcrn_vctk.safetensors"},{"id":"heartmula","display_name":"HeartMuLa 3B (music gen)","family":"heartmula","path":"models/HeartMuLa","task":"gen","mode":"offline","download_id":"heartmula","session_options":{"heartmula.mem_saver":"true"},"min_vram_gb":24},{"id":"higgs-audio-stt","display_name":"Higgs Audio v3 STT (asr, 英语)","display_name_en":"Higgs Audio v3 STT (asr, English)","family":"higgs_audio_stt","path":"models/higgs-audio-v3-stt","task":"asr","mode":"offline","download_id":"higgs_audio_stt","min_vram_gb":8,"input_hint":"**Higgs Audio STT**：英语转写；可在文本框填指令（默认相当于 Transcribe the speech.）；离线模式自动切分长音频。","input_hint_en":"**Higgs Audio STT**: English transcription. The text box accepts an instruction; offline mode automatically chunks long audio."},{"id":"higgs-audio-tts","display_name":"Higgs Audio v3 TTS 4B (tts 克隆, GGUF Q8)","display_name_en":"Higgs Audio v3 TTS 4B (tts + clone, GGUF Q8)","family":"higgs_audio_tts","path":"models/Higgs-Audio-v3-TTS-4B-GGUF","task":"tts","mode":"offline","download_id":"higgs_audio_v3_tts_4b","min_vram_gb":6,"input_hint":"**Higgs Audio v3 TTS**：Q8_0 GGUF 包（权重已量化，不用再设 weight_type）；上传参考音色即声音克隆，留空用默认音色；长文本自动分段。","input_hint_en":"**Higgs Audio v3 TTS**: Q8_0 GGUF package (already quantized — no weight_type needed). Upload a reference voice to clone, or leave it empty for the default voice; long text is chunked automatically."},{"id":"htdemucs","display_name":"HTDemucs (sep 音源分离)","display_name_en":"HTDemucs (source separation)","family":"htdemucs","path":"models/htdemucs","task":"sep","mode":"offline","download_id":"htdemucs","min_vram_gb":3},{"id":"htdemucs_6stems","display_name":"HTDemucs 6-stem (sep 音源分离)","display_name_en":"HTDemucs 6-stem (source separation)","family":"htdemucs_6stems","path":"models/htdemucs_6stems","task":"sep","mode":"offline","download_id":"htdemucs_6stems","min_vram_gb":4},{"id":"hviske-asr","display_name":"Hviske v5.3 (asr, 丹麦语)","display_name_en":"Hviske v5.3 (asr, Danish)","family":"hviske_asr","path":"models/hviske-v5.3","task":"asr","mode":"offline","download_id":"hviske_asr","min_vram_gb":6,"input_hint":"**Hviske ASR**：丹麦语专用；模型侧自动分段。","input_hint_en":"**Hviske ASR**: dedicated Danish transcription with automatic model-side segmentation."},{"id":"hviske-v6","display_name":"Hviske v6 (Danish ASR)","family":"hviske_asr_v6","path":"models/Hviske-v6-GGUF/hviske-v6-bf16.gguf","task":"asr","mode":"offline","download_id":"hviske_asr_v6_bf16"},{"id":"index-echo-2b","display_name":"Index-Echo S2TT 2B","family":"index_echo","path":"models/Index-Echo-S2TT-GGUF/index-echo-s2tt-2b-orig.gguf","task":"asr","mode":"offline","download_id":"index_echo_s2tt_2b_orig"},{"id":"index-echo-9b","display_name":"Index-Echo S2TT 9B","family":"index_echo","path":"models/Index-Echo-S2TT-GGUF/index-echo-s2tt-9b-orig.gguf","task":"asr","mode":"offline","download_id":"index_echo_s2tt_9b_orig"},{"id":"index-tts2","display_name":"IndexTTS2 (tts 中英克隆+情感)","display_name_en":"IndexTTS2 (tts, zh/en clone + emotion)","family":"index_tts2","path":"models/IndexTTS-2","task":"tts","mode":"offline","download_id":"index_tts2","min_vram_gb":8},{"id":"index-tts2.5","display_name":"IndexTTS2.5 (tts 多语种克隆+情感, GGUF Q8)","display_name_en":"IndexTTS2.5 (tts, zh/en/ja/es/ar clone + emotion, GGUF Q8)","family":"index_tts2","path":"models/IndexTTS2.5-GGUF","task":"tts","mode":"offline","download_id":"index_tts2_5_q8_0","min_vram_gb":8,"input_hint":"**IndexTTS2.5**：中/英/日/西/阿零样本克隆；上传参考音色即克隆；可在『其它参数(JSON)』里传 `lang`（默认 auto：含汉字按中文，否则按英文）与情感选项。许可证为 bilibili Model Use License（非 OSI），商用前请确认条款。","input_hint_en":"**IndexTTS2.5**: zero-shot cloning in zh/en/ja/es/ar. Upload a reference voice to clone; pass `lang` (default auto: zh when the text contains Han characters, otherwise en) and emotion options through the JSON box. Weights are under the bilibili Model Use License (not OSI-approved) — check terms before commercial use."},{"id":"inflect-v2","display_name":"Inflect Micro v2 (tts 英语, 社区)","display_name_en":"Inflect Micro v2 (en tts, community)","family":"inflect_v2","path":"models/Inflect-Micro-v2","task":"tts","mode":"offline","download_id":"inflect_micro_v2","min_vram_gb":2,"input_hint":"**Inflect Micro v2**（社区模型）：英语离线 TTS；Micro 是默认包，Nano 可通过模型管理器另装后手动选择路径。","input_hint_en":"**Inflect Micro v2** (community): English offline TTS. Micro is the default package; Nano can be installed separately and selected manually."},{"id":"irodori-tts-v3-500m","display_name":"Irodori-TTS 500M v3 (tts 日语)","display_name_en":"Irodori-TTS 500M v3 (ja tts)","family":"irodori_tts","path":"models/Irodori-TTS-500M-v3-GGUF","task":"tts","mode":"offline","download_id":"irodori_tts_500m_v3_q8_0","min_vram_gb":4},{"id":"irodori-tts-v3-vdesign","display_name":"Irodori-TTS 600M v3 VoiceDesign (vdes 日语)","display_name_en":"Irodori-TTS 600M v3 VoiceDesign (ja vdes)","family":"irodori_tts","path":"models/Irodori-TTS-600M-v3-VoiceDesign-GGUF","task":"vdes","mode":"offline","download_id":"irodori_tts_600m_v3_voicedesign_q8_0","min_vram_gb":4,"input_hint":"**Irodori-TTS v3 VoiceDesign**（日语）：『音色描述』用日语 caption 描述音色（如「落ち着いた大人の男性。深く響く声。」），文本填要念的日语内容，无需参考音频。","input_hint_en":"**Irodori-TTS v3 VoiceDesign**: provide a Japanese voice caption and Japanese synthesis text. No reference recording is required."},{"id":"irodori-tts","display_name":"Irodori-TTS v4.1 Small (tts 日语, GGUF Q8)","display_name_en":"Irodori-TTS v4.1 Small (ja tts, GGUF Q8)","family":"irodori_tts","path":"models/Irodori-TTS-v4-Small-GGUF","task":"tts","mode":"offline","download_id":"irodori_tts_v4_small_q8_0","min_vram_gb":4,"input_hint":"**Irodori-TTS v4.1 Small**：日语 TTS；可不上传参考音色直接生成，也可上传参考音色进行克隆；可在声音设计页用日语 caption 描述音色。","input_hint_en":"**Irodori-TTS v4.1 Small**: Japanese TTS. Generate without a reference voice, clone from an uploaded reference, or use the voice-design page with a Japanese voice caption."},{"id":"irodori-tts-vdesign","display_name":"Irodori-TTS v4.1 Small VoiceDesign (vdes 日语, GGUF Q8)","display_name_en":"Irodori-TTS v4.1 Small VoiceDesign (ja vdes, GGUF Q8)","family":"irodori_tts","path":"models/Irodori-TTS-v4-Small-GGUF","task":"vdes","mode":"offline","download_id":"irodori_tts_v4_small_q8_0","min_vram_gb":4,"input_hint":"**Irodori-TTS v4.1 VoiceDesign**（日语）：『音色描述』用日语 caption 描述音色（如「落ち着いた大人の男性。深く響く声。」），文本填要念的日语内容，无需参考音频。","input_hint_en":"**Irodori-TTS v4.1 VoiceDesign**: provide a Japanese voice caption and Japanese synthesis text. No reference recording is required."},{"id":"kitten-tts2","display_name":"Kitten TTS 2","family":"kitten_tts2","path":"models/kitten-tts2/kitten-tts2-q8-v2-multilingual.gguf","task":"tts","mode":"offline","download_id":"kitten_tts2_q8_v2","min_vram_gb":7,"input_hint":"Multilingual speech: choose a matching language preset or supply a reference clip and its transcript. Write numbers and abbreviations as spoken words."},{"id":"kitten-tts2-20261021","display_name":"Kitten TTS 2 (2026-10-21)","family":"kitten_tts2","path":"models/KittenTTS2-GGUF","task":"tts","mode":"offline","download_id":"kitten_tts2_20261021_q8_0","input_hint_en":"Updated multilingual checkpoint. Choose Q8 or Q4, then a voice preset or reference recording."},{"id":"kitten-tts","display_name":"KittenTTS Mini 0.8 (tts 英语, 社区)","display_name_en":"KittenTTS Mini 0.8 (en tts, community)","family":"kitten_tts","path":"models/KittenTTS-GGUF/kitten-tts-mini-0.8-orig.gguf","task":"tts","mode":"offline","download_id":"kitten_tts_mini_0_8_orig","min_vram_gb":1,"input_hint":"**KittenTTS Mini 0.8**（社区模型）：轻量英语 TTS，内置八种音色，不需要上传参考音频。","input_hint_en":"**KittenTTS Mini 0.8** (community): lightweight English TTS with eight built-in voices; no reference audio is needed."},{"id":"kokoro-tts","display_name":"Kokoro 82M (tts, preset voices)","family":"kokoro_tts","path":"models/Kokoro-82M-GGUF/kokoro-82m-q8_0.gguf","task":"tts","mode":"offline","download_id":"kokoro_82m_q8_0","min_vram_gb":1,"input_hint_en":"**Kokoro 82M**: multilingual TTS with built-in preset voices. Choose a language and voice; no reference audio is needed."},{"id":"kroko-asr","display_name":"Kroko Community ASR (asr, GGUF Q8)","display_name_en":"Kroko Community ASR (asr, GGUF Q8)","family":"kroko_asr","path":"models/Kroko-ASR-GGUF","task":"asr","mode":"offline","download_id":"kroko_asr_community_q8_0","min_vram_gb":4,"input_hint":"**Kroko Community ASR**：GGUF Q8 包；离线转写，支持时间戳。","input_hint_en":"**Kroko Community ASR**: GGUF Q8 package for offline transcription with timestamps."},{"id":"kugelaudio","display_name":"KugelAudio-0-Open","family":"kugelaudio","path":"models/KugelAudio-0-Open-GGUF/kugelaudio-0-open-q8_0.gguf","task":"tts","mode":"offline","download_id":"kugelaudio_0_open_q8_0","builtin_voices":["default","clear","english_female","english_male"],"default_voice":"default"},{"id":"lfm2-audio-asr","display_name":"LFM2.5-Audio 1.5B (asr, community)","family":"lfm2_audio","path":"models/LFM2.5-Audio-1.5B-GGUF","task":"asr","mode":"offline","download_id":"lfm2_audio_1_5b_q8_0","min_vram_gb":4,"input_hint_en":"**LFM2.5-Audio** (community): Liquid AI\'s English speech recognition from Liquid\'s published GGUFs. Audio longer than 30 s is split at pauses. Leave language empty."},{"id":"lfm2-audio-s2s","display_name":"LFM2.5-Audio 1.5B (s2s, community)","family":"lfm2_audio","path":"models/LFM2.5-Audio-1.5B-GGUF","task":"s2s","mode":"offline","download_id":"lfm2_audio_1_5b_q8_0","min_vram_gb":4,"builtin_voices":[],"default_voice":"","input_hint_en":"**LFM2.5-Audio** (community): Liquid AI\'s English spoken chat from Liquid\'s published GGUFs. Record or choose a spoken question under Source audio and press Run: the reply streams in as speech and text, and each Run continues the conversation until New conversation. Replies use liquid-audio\'s system prompt, `Respond with interleaved text and audio.`"},{"id":"lfm2-audio-tts","display_name":"LFM2.5-Audio 1.5B (tts, community)","family":"lfm2_audio","path":"models/LFM2.5-Audio-1.5B-GGUF","task":"tts","mode":"offline","download_id":"lfm2_audio_1_5b_q8_0","min_vram_gb":4,"default_text":"The next train leaves in ten minutes.","input_hint_en":"**LFM2.5-Audio** (community): Liquid AI\'s English speech from Liquid\'s published GGUFs, with four built-in voices (US or UK, male or female); no reference audio."},{"id":"lfm2-audio-jp-asr","display_name":"LFM2.5-Audio 1.5B JP (asr, community)","family":"lfm2_audio","path":"models/LFM2.5-Audio-1.5B-JP-GGUF","task":"asr","mode":"offline","download_id":"lfm2_audio_1_5b_jp_q8_0","min_vram_gb":4,"input_hint_en":"**LFM2.5-Audio JP** (community): Liquid AI\'s Japanese speech recognition from Liquid\'s published GGUFs. Audio longer than 30 s is split at pauses. Leave language empty."},{"id":"lfm2-audio-jp-s2s","display_name":"LFM2.5-Audio 1.5B JP (s2s, community)","family":"lfm2_audio","path":"models/LFM2.5-Audio-1.5B-JP-GGUF","task":"s2s","mode":"offline","download_id":"lfm2_audio_1_5b_jp_q8_0","min_vram_gb":4,"builtin_voices":[],"default_voice":"","input_hint_en":"**LFM2.5-Audio JP** (community): Liquid AI\'s Japanese spoken chat from Liquid\'s published GGUFs. Record or choose a spoken question under Source audio and press Run: the reply streams in as speech and text, and each Run continues the conversation until New conversation. Replies use liquid-audio\'s system prompt, `Respond with interleaved text and audio.`"},{"id":"lfm2-audio-jp-tts","display_name":"LFM2.5-Audio 1.5B JP (tts, community)","family":"lfm2_audio","path":"models/LFM2.5-Audio-1.5B-JP-GGUF","task":"tts","mode":"offline","download_id":"lfm2_audio_1_5b_jp_q8_0","min_vram_gb":4,"builtin_voices":[],"default_voice":"","default_text":"今日は天気がいいので、公園まで散歩に行きました。","input_hint_en":"**LFM2.5-Audio JP** (community): Liquid AI\'s Japanese speech from Liquid\'s published GGUFs, in the checkpoint\'s one voice; no reference audio."},{"id":"lfm3-audio-asr","display_name":"LFM3-Audio 2B (asr, community)","family":"lfm3_audio","path":"models/LFM3-Audio-2B-GGUF/LFM3-Audio-2B-Q8_0.gguf","task":"asr","mode":"offline","download_id":"lfm3_audio_2b_q8_0","min_vram_gb":4,"input_hint_en":"**LFM3-Audio** (community): Liquid AI\'s LFM3-Audio-2B from Liquid\'s published GGUFs. Speech recognition in 18 languages: leave language empty or set auto to detect it. The chat parameter answers the spoken input as text instead of transcribing it."},{"id":"lfm3-audio-s2s","display_name":"LFM3-Audio 2B (s2s, community)","family":"lfm3_audio","path":"models/LFM3-Audio-2B-GGUF/LFM3-Audio-2B-Q8_0.gguf","task":"s2s","mode":"offline","download_id":"lfm3_audio_2b_q8_0","min_vram_gb":4,"builtin_voices":[],"default_voice":"","input_hint_en":"**LFM3-Audio** (community): Liquid AI\'s LFM3-Audio-2B from Liquid\'s published GGUFs. Record or choose a spoken question under Source audio and press Run: the reply streams in as speech and text, and each Run continues the conversation until New conversation. Replies use the system prompt `Respond with interleaved text and audio.`"},{"id":"lfm3-audio-tts","display_name":"LFM3-Audio 2B (tts, community)","family":"lfm3_audio","path":"models/LFM3-Audio-2B-GGUF/LFM3-Audio-2B-Q8_0.gguf","task":"tts","mode":"offline","download_id":"lfm3_audio_2b_q8_0","min_vram_gb":4,"default_text":"The next train leaves in ten minutes.","input_hint_en":"**LFM3-Audio** (community): Liquid AI\'s LFM3-Audio-2B from Liquid\'s published GGUFs. Speech in 38 built-in voices across 19 languages; no reference audio."},{"id":"liveavatar","display_name":"LiveAvatar (audio to video, 社区)","display_name_en":"LiveAvatar (audio to video, community)","family":"liveavatar","path":"models/LiveAvatar-GGUF","task":"gen","mode":"offline","download_id":"liveavatar_nvfp4_lora","default_text":"A cheerful green cyclops baker in a warm rustic bakery, smiling and speaking to the camera while holding a tray of freshly baked pies. High-quality animated film style, expressive face, natural gestures, warm cinematic lighting.","min_vram_gb":24,"input_hint":"**LiveAvatar**（社区模型）：上传驱动音频和参考人物图像，再输入场景描述以生成动画视频。","input_hint_en":"**LiveAvatar** (community): upload driving audio and a reference portrait, then describe the subject and scene to generate an animated video."},{"id":"outetts","display_name":"Llama-OuteTTS 1.0 1B (tts 克隆, 社区)","display_name_en":"Llama-OuteTTS 1.0 1B (tts + clone, community)","family":"outetts","path":"models/Llama-OuteTTS-1.0-1B","task":"tts","mode":"offline","download_id":"outetts_1_0_1b","min_vram_gb":4,"input_hint":"**OuteTTS 1.0 1B**（社区模型）：23 种语言，DAC 编解码；上传参考音色即克隆。","input_hint_en":"**OuteTTS 1.0 1B** (community): 23 languages, IBM DAC codec. Upload a reference voice to clone."},{"id":"magenta-rt2","display_name":"Magenta RealTime 2 (music gen)","family":"magenta_realtime_2","path":"models/Magenta-RealTime-2-GGUF","task":"gen","mode":"offline","download_id":"magenta_realtime_2_small_f16","default_text":"disco funk"},{"id":"magpie-tts","display_name":"MagpieTTS Multilingual 357M v2607 (tts, preset voices)","display_name_en":"MagpieTTS Multilingual 357M v2607 (tts, preset voices)","family":"magpie_tts","path":"models/MagpieTTS-Multilingual-357M-GGUF","task":"tts","mode":"offline","download_id":"magpie_tts_q8_0","min_vram_gb":4,"input_hint":"**MagpieTTS**：多语种离线 TTS；使用打包 speaker map 里的 `voice_id`，不需要上传参考音频。当前 GGUF 包不包含日语 phoneme 表，因此日语路径不可用。","input_hint_en":"**MagpieTTS**: multilingual offline TTS with packaged speaker prompts selected by `voice_id`; no reference upload is needed. The current GGUF package does not include the Japanese phoneme table, so Japanese is not available."},{"id":"marblenet-vad","display_name":"MarbleNet VAD (vad, bundled)","family":"marblenet_vad","path":"assets/framework/models/marblenet_vad","task":"vad","mode":"offline","min_vram_gb":1},{"id":"maya1","display_name":"Maya1","family":"maya1","task":"tts","mode":"offline","path":"models/Maya1-GGUF/maya1-q8_0.gguf","download_id":"maya1_q8_0","arena":false},{"id":"meanvc2","display_name":"MeanVC2 (voice conversion)","display_name_en":"MeanVC2 (voice conversion)","family":"meanvc2","path":"models/MeanVC2-GGUF/meanvc2-120ms-40ms-fp32.gguf","task":"vc","mode":"offline","download_id":"meanvc2_120ms_40ms_f32","min_vram_gb":6,"input_hint":"**MeanVC2**：上传源语音和目标音色参考；默认 120 ms / 40 ms checkpoint 使用 F32 GGUF。","input_hint_en":"**MeanVC2**: upload source speech and a target-voice reference. The default 120 ms / 40 ms checkpoint uses F32 GGUF."},{"id":"mel-band-roformer","display_name":"Mel-Band RoFormer (sep 人声分离)","display_name_en":"Mel-Band RoFormer (vocal separation)","family":"mel_band_roformer","path":"models/mel-roformer-mlx","task":"sep","mode":"offline","download_id":"mel_band_roformer","min_vram_gb":3},{"id":"micro-wake-word","display_name":"microWakeWord (Okay Nabu)","family":"micro_wake_word","path":"models/MicroWakeWord-GGUF/micro-wake-word-okay-nabu-f32.gguf","task":"wake","mode":"offline","download_id":"micro_wake_word_okay_nabu_f32"},{"id":"midashenglm-gen","display_name":"MiDashengLM-Gen (audio generation)","family":"midashenglm_gen","path":"models/MiDashengLM-Gen-GGUF/midashenglm-gen-q8_0.gguf","task":"gen","mode":"offline","download_id":"midashenglm_gen_q8_0","min_vram_gb":8,"input_hint_en":"**MiDashengLM-Gen**: text-conditioned audio generation. The duration field controls the generation budget."},{"id":"minimax-h3","display_name":"MiniMax-H3 Q4 (sound generation)","family":"minimax_h3","path":"models/MiniMax-H3-Q4-GGUF/dit.gguf","task":"gen","mode":"offline","download_id":"minimax_h3","min_vram_gb":20,"default_options":{"num_inference_steps":12,"height":32,"width":32,"num_frames":241,"guidance_scale":1,"dit_acceleration":"none","return_video":false},"input_hint_en":"MiniMax-H3 uses a joint audio/video DiT. The default Q4 DiT is the quality-first choice; the optional CUDA-only INT8 ConvRot DiT trades slightly more VRAM for higher speed. Native Studio uses 12 denoising steps, a 32x32 latent canvas, quality-first full-DiT execution, and disables video decoding for practical audio-only generation on a 24 GB GPU."},{"id":"minimax-music3","display_name":"MiniMax-Music3 (song gen)","family":"minimax_music3","path":"models/MiniMax-Music3-GGUF","task":"gen","mode":"offline","download_id":"minimax_music3_q4_0","min_vram_gb":12},{"id":"miocodec","display_name":"MioCodec (vc; codec dependency)","family":"miocodec","path":"models/MioCodec-25Hz-44.1kHz-v2","task":"vc","mode":"offline","download_id":"miocodec_25hz_44k_v2","min_vram_gb":3},{"id":"miotts","display_name":"MioTTS 1.7B (tts; needs MioCodec)","family":"miotts","path":"models/MioTTS-1.7B","task":"tts","mode":"offline","download_id":"miotts_1_7b","min_vram_gb":8},{"id":"moonshine-asr-medium","display_name":"Moonshine Streaming Medium (asr, GGUF Q8)","display_name_en":"Moonshine Streaming Medium (asr, GGUF Q8)","family":"moonshine_asr","path":"models/Moonshine-Streaming-GGUF/moonshine-streaming-medium-q8_0.gguf","task":"asr","mode":"offline","download_id":"moonshine_streaming_medium_q8_0","min_vram_gb":2,"input_hint":"**Moonshine Streaming Medium**：英语 ASR，GGUF Q8 包；支持离线与流式模式。","input_hint_en":"**Moonshine Streaming Medium**: English ASR GGUF Q8 package with offline and streaming support."},{"id":"moonshine-asr-small","display_name":"Moonshine Streaming Small (asr, GGUF Q8)","display_name_en":"Moonshine Streaming Small (asr, GGUF Q8)","family":"moonshine_asr","path":"models/Moonshine-Streaming-GGUF/moonshine-streaming-small-q8_0.gguf","task":"asr","mode":"offline","download_id":"moonshine_streaming_small_q8_0","min_vram_gb":2,"input_hint":"**Moonshine Streaming Small**：英语 ASR，GGUF Q8 包；支持离线与流式模式。","input_hint_en":"**Moonshine Streaming Small**: English ASR GGUF Q8 package with offline and streaming support."},{"id":"moonshine-asr-tiny","display_name":"Moonshine Streaming Tiny (asr, GGUF Q8)","display_name_en":"Moonshine Streaming Tiny (asr, GGUF Q8)","family":"moonshine_asr","path":"models/Moonshine-Streaming-GGUF/moonshine-streaming-tiny-q8_0.gguf","task":"asr","mode":"offline","download_id":"moonshine_streaming_tiny_q8_0","min_vram_gb":1,"input_hint":"**Moonshine Streaming Tiny**：英语 ASR，轻量 GGUF Q8 包；支持离线与流式模式。","input_hint_en":"**Moonshine Streaming Tiny**: lightweight English ASR GGUF Q8 package with offline and streaming support."},{"id":"moss-transcribe-diarize","display_name":"MOSS-Transcribe-Diarize","family":"moss_transcribe_diarize","path":"models/MOSS-Transcribe-Diarize-GGUF","task":"asr","mode":"offline","download_id":"moss_transcribe_diarize_bf16"},{"id":"moss-tts-v15","display_name":"MOSS-TTS v1.5 8B (tts 克隆, 社区)","display_name_en":"MOSS-TTS v1.5 8B (tts + clone, community)","family":"moss_tts_v15","path":"models/MOSS-TTS-v1.5-GGUF/moss_tts_v15_q8_0_codec_f16.gguf","task":"tts","mode":"offline","download_id":"moss_tts_v15_q8_0_codec_f16","min_vram_gb":18,"input_hint":"**MOSS-TTS v1.5 8B**（社区模型）：中英 TTS；上传短参考音频进行声音克隆，留空则使用模型生成的音色。Q8 克隆约需 18 GB 显存。","input_hint_en":"**MOSS-TTS v1.5 8B** (community): English/Chinese TTS. Upload a short reference clip for voice cloning, or leave it empty for a model-generated voice. Q8 cloning needs about 18 GB VRAM."},{"id":"moss-tts-local","display_name":"MOSS-TTS-Local v1.5 (tts)","family":"moss_tts_local","path":"models/MOSS-TTS-Local-Transformer-v1.5","task":"tts","mode":"offline","download_id":"moss_tts_local_v1_5","min_vram_gb":8},{"id":"moss-tts-nano","display_name":"MOSS-TTS-Nano 100M (tts)","family":"moss_tts_nano","path":"models/MOSS-TTS-Nano-100M","task":"tts","mode":"offline","download_id":"moss_tts_nano_100m","min_vram_gb":2},{"id":"moss-ttsd","display_name":"MOSS-TTSD","family":"moss_ttsd","task":"tts","mode":"offline","path":"models/MOSS-TTSD-GGUF/moss_ttsd_q8_0_codec_f16.gguf","download_id":"moss_ttsd_q8_0_codec_f16","arena":false,"default_text":"[S1] Hello, how are you? [S2] I am doing well, thank you."},{"id":"moss-voicegen","display_name":"MOSS-VoiceGenerator","family":"moss_voicegen","task":"vdes","mode":"offline","path":"models/MOSS-VoiceGenerator-GGUF/moss_voicegen_bf16_codec_f16_decode.gguf","download_id":"moss_voicegen_bf16_codec_f16_decode","arena":false},{"id":"mossformer2","display_name":"MossFormer2 (two-speaker separation)","family":"mossformer2","path":"models/MossFormer2-GGUF/mossformer2-ss-16k-f32.gguf","task":"sep","mode":"offline","download_id":"mossformer2_ss_16k_f32"},{"id":"muscriptor-small","display_name":"MuScriptor Small (audio to MIDI)","family":"muscriptor","path":"models/MuScriptor-Small-GGUF","task":"midi","mode":"offline","download_id":"muscriptor_small_f32","min_vram_gb":4},{"id":"nemotron-3-diar","display_name":"Nemotron 3 Diarization","family":"nemotron_3_diar","path":"models/Nemotron-3-Diarization-GGUF/nemotron-3-diarization-bf16.gguf","task":"diar","mode":"offline","download_id":"nemotron_3_diar_bf16","min_vram_gb":2,"input_hint_en":"**Nemotron 3 Diarization**: upload speech audio to produce speaker turns for up to eight speakers. It supports offline and streaming diarization."},{"id":"nemotron-asr","display_name":"Nemotron 3.5 ASR 0.6B (asr, 100+语种)","display_name_en":"Nemotron 3.5 ASR 0.6B (asr, 100+ languages)","family":"nemotron_asr","path":"models/nemotron-3.5-asr-streaming-0.6b","task":"asr","mode":"offline","download_id":"nemotron_asr","min_vram_gb":4,"input_hint":"**Nemotron ASR**：100+ 语种，语种码为 BCP-47（如 en-US / zh-CN），留空=auto；模型自带长音频处理。","input_hint_en":"**Nemotron ASR**: supports more than 100 languages using BCP-47 codes such as en-US or zh-CN. Leave language blank for automatic detection; long audio is handled by the model. Context text biases terminology during decoding: separate words with spaces, or phrases with commas/newlines."},{"id":"neutts-2e","display_name":"NeuTTS 2E (tts, preset voices)","family":"neutts","path":"models/NeuTTS-2E-GGUF","task":"tts","mode":"offline","download_id":"neutts_2e_orig","min_vram_gb":4},{"id":"niagara-asr-19m","display_name":"Niagara ASR 19M (asr)","display_name_en":"Niagara ASR 19M (asr)","family":"niagara_asr","path":"models/Niagara-ASR-GGUF/niagara-19m-batch.en-f32.gguf","task":"asr","mode":"offline","download_id":"niagara_19m_f32","min_vram_gb":1,"input_hint":"**Niagara ASR 19M**：ABR 英语离线 ASR，F32 GGUF 权重。","input_hint_en":"**Niagara ASR 19M**: ABR English offline ASR with F32 GGUF weights."},{"id":"niagara-asr-38m","display_name":"Niagara ASR 38M (asr)","display_name_en":"Niagara ASR 38M (asr)","family":"niagara_asr","path":"models/Niagara-ASR-GGUF/niagara-38m-batch.en-f32.gguf","task":"asr","mode":"offline","download_id":"niagara_38m_f32","min_vram_gb":1,"input_hint":"**Niagara ASR 38M**：ABR 英语离线 ASR，F32 GGUF 权重。","input_hint_en":"**Niagara ASR 38M**: ABR English offline ASR with F32 GGUF weights."},{"id":"omnivoice","display_name":"OmniVoice (tts)","family":"omnivoice","path":"models/OmniVoice","task":"tts","mode":"offline","download_id":"omnivoice","min_vram_gb":10},{"id":"open-wake-word","display_name":"OpenWakeWord (Alexa)","family":"open_wake_word","path":"models/OpenWakeWord-GGUF/open-wake-word-alexa-f32.gguf","task":"wake","mode":"offline","download_id":"open_wake_word_alexa_f32"},{"id":"orukeet","display_name":"Orukeet r3 (asr, Parakeet 微调)","display_name_en":"Orukeet r3 (asr, Parakeet fine-tune)","family":"parakeet_tdt","path":"models/Orukeet-GGUF/orukeet-q8_0.gguf","task":"asr","mode":"offline","download_id":"orukeet_q8_0","min_vram_gb":4,"input_hint":"**Orukeet r3**：Parakeet-TDT 0.6B v3 微调权重，同引擎/同分词器；CC BY-SA 4.0，留空=自动语种。","input_hint_en":"**Orukeet r3**: fine-tuned Parakeet-TDT 0.6B v3 weights on the same engine and tokenizer; CC BY-SA 4.0, leave language empty for auto."},{"id":"owsm-base","display_name":"OWSM v4 Base 102M","family":"owsm","path":"models/OWSM-GGUF/owsm-v4-base-102m-f32.gguf","task":"asr","mode":"offline","download_id":"owsm_v4_base_102m_f32"},{"id":"owsm-medium","display_name":"OWSM v4 Medium 1B","family":"owsm","path":"models/OWSM-GGUF/owsm-v4-medium-1b-f32.gguf","task":"asr","mode":"offline","download_id":"owsm_v4_medium_1b_f32"},{"id":"owsm-small","display_name":"OWSM v4 Small 370M","family":"owsm","path":"models/OWSM-GGUF/owsm-v4-small-370m-f32.gguf","task":"asr","mode":"offline","download_id":"owsm_v4_small_370m_f32"},{"id":"owsm-ctc","display_name":"OWSM-CTC v4 1B","family":"owsm_ctc","path":"models/OWSM-CTC-GGUF/owsm-ctc-v4-1b-f32.gguf","task":"asr","mode":"offline","download_id":"owsm_ctc_v4_1b_f32"},{"id":"parakeet-tdt","display_name":"Parakeet-TDT 0.6B v3 (asr, 流式)","display_name_en":"Parakeet-TDT 0.6B v3 (asr + streaming)","family":"parakeet_tdt","path":"models/parakeet-tdt-0.6b-v3","task":"asr","mode":"offline","download_id":"parakeet_tdt","min_vram_gb":4,"input_hint":"**Parakeet-TDT**：离线/长音频/流式 ASR；支持多种欧洲语言，留空=自动。","input_hint_en":"**Parakeet-TDT**: offline, long-form and streaming ASR for many European languages; leave language empty for auto."},{"id":"personaplex","display_name":"PersonaPlex 7B v1 (speech conversation)","display_name_en":"PersonaPlex 7B v1 (speech conversation)","family":"personaplex","path":"models/PersonaPlex-GGUF","task":"s2s","mode":"offline","download_id":"personaplex_7b_v1_q4_k","min_vram_gb":8,"request_options":["voice_id","system_prompt","temperature","text_temperature","top_k","text_top_k","do_sample","seed"],"input_hint":"**PersonaPlex**：上传用户语音，模型返回语音回复；文本框可填写 assistant system/persona prompt；`voice_id` 选择打包音色，也可上传参考音色覆盖。","input_hint_en":"**PersonaPlex**: upload user speech and receive a spoken response. The text box provides the assistant system/persona prompt; `voice_id` selects a packaged voice, and an uploaded reference voice overrides it."},{"id":"piper-tts","display_name":"Piper Lessac Medium (tts 英语, 社区)","display_name_en":"Piper Lessac Medium (en tts, community)","family":"piper_tts","path":"models/Piper-TTS-GGUF/piper-en-us-lessac-medium-orig.gguf","task":"tts","mode":"offline","download_id":"piper_lessac_medium_orig","min_vram_gb":1,"input_hint":"**Piper Lessac Medium**（社区模型）：轻量英语 TTS，使用打包的 Lessac 音色，不需要上传参考音频。","input_hint_en":"**Piper Lessac Medium** (community): lightweight English TTS with the packaged Lessac voice; no reference audio is needed."},{"id":"plapre","display_name":"Plapre 3 (Danish TTS)","family":"plapre","path":"models/Plapre-3-GGUF/plapre-3-bf16.gguf","task":"tts","mode":"offline","download_id":"plapre_3_bf16","default_text":"Godmorgen. Solen skinner, og vi tager en tur til havnen."},{"id":"pocket-tts","display_name":"Pocket TTS (tts)","family":"pocket_tts","path":"models/pocket-tts","task":"tts","mode":"offline","download_id":"pocket_tts","min_vram_gb":2},{"id":"pulsevad-2.1k","display_name":"PulseVAD 2.1K","family":"pulsevad","path":"models/PulseVAD-GGUF","task":"vad","mode":"offline","download_id":"pulsevad_2_1k_f32"},{"id":"pulsevad-81k","display_name":"PulseVAD 81K","family":"pulsevad","path":"models/PulseVAD-GGUF","task":"vad","mode":"offline","download_id":"pulsevad_81k_f32"},{"id":"qwen3-forced-aligner","display_name":"Qwen3 Forced Aligner (align)","family":"qwen3_forced_aligner","path":"models/Qwen3-ForcedAligner-0.6B","task":"align","mode":"offline","download_id":"qwen3_forced_aligner_0_6b","min_vram_gb":3},{"id":"qwen3-asr","display_name":"Qwen3-ASR 0.6B (asr)","family":"qwen3_asr","path":"models/Qwen3-ASR-0.6B","task":"asr","mode":"offline","download_id":"qwen3_asr_0_6b","min_vram_gb":3},{"id":"qwen3-asr-1.7b","display_name":"Qwen3-ASR 1.7B HF (asr)","family":"qwen3_asr","path":"models/Qwen3-ASR-1.7B-hf","task":"asr","mode":"offline","download_id":"qwen3_asr_1_7b_hf","min_vram_gb":6,"input_hint":"**Qwen3-ASR 1.7B**（HF 原生权重，免转换）：精度高于 0.6B；长音频自动分段转写；8G 卡显存偏紧，长音频建议先短段试跑。","input_hint_en":"**Qwen3-ASR 1.7B**: native Hugging Face weights with no conversion required. It is more accurate than the 0.6B model and automatically chunks long audio; test short clips first on an 8 GB GPU."},{"id":"qwen3-tts","display_name":"Qwen3-TTS 0.6B (tts)","family":"qwen3_tts","path":"models/Qwen3-TTS-12Hz-0.6B-Base","task":"tts","mode":"offline","download_id":"qwen3_tts_0_6b_base","min_vram_gb":5},{"id":"qwen3-tts-1.7b","display_name":"Qwen3-TTS 1.7B Base (tts)","family":"qwen3_tts","path":"models/Qwen3-TTS-12Hz-1.7B-Base","task":"tts","mode":"offline","download_id":"qwen3_tts_1_7b_base","min_vram_gb":8},{"id":"qwen3-tts-1.7b-custom","display_name":"Qwen3-TTS 1.7B CustomVoice (tts)","family":"qwen3_tts","path":"models/Qwen3-TTS-12Hz-1.7B-CustomVoice","task":"tts","mode":"offline","download_id":"qwen3_tts_1_7b_custom_voice","min_vram_gb":8},{"id":"qwen3-tts-1.7b-vdesign","display_name":"Qwen3-TTS 1.7B VoiceDesign (vdes)","family":"qwen3_tts","path":"models/Qwen3-TTS-12Hz-1.7B-VoiceDesign","task":"vdes","mode":"offline","download_id":"qwen3_tts_1_7b_voice_design","min_vram_gb":8,"input_hint":"**Qwen3-TTS VoiceDesign**：在『音色描述』里用文字描述想要的声音（如“低沉磁性的中年男声，语速偏慢”），配上要念的文本即可，无需参考音频。","input_hint_en":"**Qwen3-TTS VoiceDesign**: describe the desired voice, then enter the text to synthesize. No reference recording is required."},{"id":"reuse","display_name":"RE-USE","family":"reuse","path":"models/RE-USE-GGUF/reuse-f32.gguf","task":"s2s","mode":"offline","download_id":"reuse_f32","workflow":"enhancement"},{"id":"rnnoise","display_name":"RNNoise","family":"builtin_audio_utils","task":"s2s","workflow":"enhancement","mode":"offline","path":"models/Audio-Utilities/rnnoise/rnnoise10Gb_15.safetensors","load_options":{"utility":"rnnoise"},"weights_url":"https://raw.githubusercontent.com/0xShug0/audio.cpp/main/assets/framework/audio_utilities/rnnoise/rnnoise10Gb_15.safetensors"},{"id":"rvc","display_name":"RVC (vc, GGUF F16)","display_name_en":"RVC (voice conversion, GGUF F16)","family":"rvc","path":"models/RVC-GGUF","task":"vc","mode":"offline","download_id":"rvc_f16","min_vram_gb":4,"input_hint":"**RVC**：所选 GGUF 即目标音色；上传源语音即可转换；索引/音高等选项可用 JSON 传。","input_hint_en":"**RVC**: the selected GGUF is the target voice; upload source speech to convert. Index and pitch options can be passed through the JSON box."},{"id":"sam-audio-base","display_name":"SAM Audio Base","family":"sam_audio","task":"s2s","workflow":"separation","mode":"offline","path":"models/SAM-Audio-GGUF/sam-audio-base-q8_0.gguf","download_id":"sam_audio_base_q8_0","default_text":"man speaking"},{"id":"sam-audio-large","display_name":"SAM Audio Large","family":"sam_audio","task":"s2s","workflow":"separation","mode":"offline","path":"models/SAM-Audio-GGUF/sam-audio-large-q8_0.gguf","download_id":"sam_audio_large_q8_0","default_text":"man speaking"},{"id":"sam-audio-small","display_name":"SAM Audio Small","family":"sam_audio","task":"s2s","workflow":"separation","mode":"offline","path":"models/SAM-Audio-GGUF/sam-audio-small-q8_0.gguf","download_id":"sam_audio_small_q8_0","default_text":"man speaking"},{"id":"samsone-99m","display_name":"SAMSONE 99M","family":"samsone","task":"asr","workflow":"analysis","arena":false,"mode":"offline","path":"models/Samsone-GGUF/samsone-99m-q8_0.gguf","download_id":"samsone_99m_q8_0"},{"id":"samsone-134m","display_name":"SAMSONE 134M","family":"samsone","task":"asr","workflow":"analysis","arena":false,"mode":"offline","path":"models/Samsone-GGUF/samsone-134m-q8_0.gguf","download_id":"samsone_134m_q8_0"},{"id":"samsone-356m","display_name":"SAMSONE 356M","family":"samsone","task":"asr","workflow":"analysis","arena":false,"mode":"offline","path":"models/Samsone-GGUF/samsone-356m-q8_0.gguf","download_id":"samsone_356m_q8_0"},{"id":"sanotts","display_name":"sanoTTS voice family (tts, community)","family":"sanotts","path":"models/sanoTTS-heart-nano-GGUF/heart-nano-f32.gguf","task":"tts","mode":"offline","download_id":"sanotts_heart_nano_orig","min_vram_gb":1},{"id":"seed-vc-svc","display_name":"Seed-VC (svc 歌声转换)","display_name_en":"Seed-VC (singing voice conversion)","family":"seed_vc","path":"models/SeedVC-MLX","task":"svc","mode":"offline","download_id":"seed_vc","min_vram_gb":4,"input_hint":"**Seed-VC 歌声转换 (svc)**：上传源歌声 + 目标歌手参考音色，默认 route=v1_svc（带 F0 条件）。可在『其它参数(JSON)』里调 `auto_f0_adjust` / `semi_tone_shift` / `f0_condition`。","input_hint_en":"**Seed-VC singing conversion**: upload source singing and a target-singer reference. The default route is v1_svc with F0 conditioning."},{"id":"seed-vc","display_name":"Seed-VC (vc 语音转换)","display_name_en":"Seed-VC (voice conversion)","family":"seed_vc","path":"models/SeedVC-MLX","task":"vc","mode":"offline","download_id":"seed_vc","min_vram_gb":4},{"id":"sense-asr","display_name":"SenseVoice-Small (asr, 流式, 社区)","display_name_en":"SenseVoice-Small (asr + streaming, community)","family":"sense_asr","path":"models/SenseVoice-Small-GGUF","task":"asr","mode":"offline","download_id":"sensevoice_small_q8","min_vram_gb":4,"input_hint":"**SenseVoice-Small**（社区模型）：多语种 ASR，事件/情感/语言标签，ITN 可开关；离线与流式模式。","input_hint_en":"**SenseVoice-Small** (community): multilingual ASR with event/emotion/language tags, optional ITN; offline and streaming modes."},{"id":"sheetsage2","display_name":"SheetSage2 (audio to ABC)","family":"sheetsage2","path":"models/SheetSage2-GGUF/sheetsage2-orig.gguf","task":"midi","mode":"offline","download_id":"sheetsage2_orig","min_vram_gb":8,"input_hint_en":"**SheetSage2**: upload a song or instrumental recording to transcribe it into an ABC score artifact."},{"id":"sherpa-kws","display_name":"Sherpa Zipformer KWS (Chinese / English)","family":"sherpa_kws","path":"models/Sherpa-KWS-GGUF/sherpa-kws-zipformer-zh-en-3m-f32.gguf","task":"wake","mode":"offline","download_id":"sherpa_kws_zipformer_zh_en_3m_f32"},{"id":"sidon","display_name":"Sidon","family":"sidon","path":"models/Sidon-GGUF/sidon-v0.1-f32.gguf","task":"s2s","mode":"offline","download_id":"sidon_f32","workflow":"enhancement"},{"id":"silero-vad","display_name":"Silero VAD (vad, bundled)","family":"silero_vad","path":"assets/framework/models/silero_vad","task":"vad","mode":"offline","min_vram_gb":1},{"id":"smart-turn","display_name":"Smart Turn v3.2","family":"smart_turn","path":"models/Smart-Turn-v3-GGUF/smart-turn-v3.2-f32.gguf","task":"turn","mode":"offline","download_id":"smart_turn_v3_2_f32","workflow":"analysis"},{"id":"soprano-tts","display_name":"Soprano TTS (tts)","family":"soprano_tts","path":"models/Soprano-1.1-80M-GGUF","task":"tts","mode":"offline","download_id":"soprano_1_1_80m_q8_0","min_vram_gb":1},{"id":"sopro-tts","display_name":"Sopro V2 Turbo (tts + clone)","family":"sopro_tts","path":"models/sopro-v2-turbo-GGUF/sopro-v2-turbo-f16.gguf","task":"tts","mode":"offline","download_id":"sopro_v2_turbo_f16","min_vram_gb":2,"request_options":["language","temperature","top_p","top_k","num_inference_steps","max_seconds","min_seconds","ref_seconds","text_chunk_size","seed"]},{"id":"sortformer-diar","display_name":"Sortformer Diarization 4spk (diar)","family":"sortformer_diar","path":"models/diar_sortformer_4spk-v1","task":"diar","mode":"offline","download_id":"sortformer_diar_4spk_v1","min_vram_gb":2},{"id":"stable-audio-medium","display_name":"Stable Audio 3 Medium (gen)","family":"stable_audio","path":"models/stable-audio-3-medium","task":"gen","mode":"offline","download_id":"stable_audio_3_medium","session_options":{"stable_audio.mem_saver":"true"},"min_vram_gb":10},{"id":"stable-audio-small-music","display_name":"Stable Audio 3 Small Music (gen)","family":"stable_audio","path":"models/stable-audio-3-small-music","task":"gen","mode":"offline","download_id":"stable_audio_3_small_music","min_vram_gb":4},{"id":"stable-audio-small-sfx","display_name":"Stable Audio 3 Small SFX (gen)","family":"stable_audio","path":"models/stable-audio-3-small-sfx","task":"gen","mode":"offline","download_id":"stable_audio_3_small_sfx","min_vram_gb":4},{"id":"supertonic","display_name":"Supertonic 3 (tts 预置音色/多语种)","display_name_en":"Supertonic 3 (tts, preset voices)","family":"supertonic","path":"models/supertonic-3","task":"tts","mode":"offline","download_id":"supertonic_3","min_vram_gb":2},{"id":"tf-gridnet","display_name":"TF-GridNet (two-speaker separation)","family":"tf_gridnet","path":"models/TF-GridNet-GGUF/tf-gridnet-wsj0-2mix-f32.gguf","task":"sep","mode":"offline","download_id":"tf_gridnet_wsj0_2mix_f32"},{"id":"tone-color-vc","display_name":"Tone Color VC","family":"tone_color_vc","task":"vc","mode":"offline","path":"models/Tone-Color-VC-GGUF/tone-color-vc-f32.gguf","download_id":"tone_color_vc_f32"},{"id":"universr-audio","display_name":"UniverSR Audio","family":"universr","path":"models/UniverSR-GGUF","task":"s2s","mode":"offline","download_id":"universr_audio_orig"},{"id":"universr-speech","display_name":"UniverSR Speech","family":"universr","path":"models/UniverSR-GGUF","task":"s2s","mode":"offline","download_id":"universr_speech_orig"},{"id":"vevo2-s2s","display_name":"Vevo2 (s2s 语音编辑, GGUF Q8)","display_name_en":"Vevo2 (speech editing, GGUF Q8)","family":"vevo2","path":"models/Vevo2-GGUF","task":"s2s","mode":"offline","download_id":"vevo2_gguf","min_vram_gb":6,"input_hint":"**Vevo2 语音编辑 (s2s)**：上传要编辑的源语音，并在『其它参数(JSON)』里填 `{\\"target_text\\": \\"替换后的完整句子\\"}`（编辑保持原说话人音色，可不上传目标音色）。","input_hint_en":"**Vevo2 speech editing**: upload source speech and set target_text to the complete replacement sentence in Additional options. Editing preserves the original speaker and does not require a target-voice reference."},{"id":"vevo2-svc","display_name":"Vevo2 (svc 歌声转换, GGUF Q8)","display_name_en":"Vevo2 (singing voice conversion, GGUF Q8)","family":"vevo2","path":"models/Vevo2-GGUF","task":"svc","mode":"offline","download_id":"vevo2_gguf","min_vram_gb":6,"input_hint":"**Vevo2 歌声转换 (svc)**：上传源歌声 + 目标歌手参考音色，默认 route=style_preserved_svc。style_converted_svc / singing_style_conversion 等风格转换 route 需在『其它参数(JSON)』里补 `style_ref`（服务器本地 wav 路径）/ `style_ref_text` / `target_text`。","input_hint_en":"**Vevo2 singing conversion**: upload source singing and a target-singer reference. The default route is style_preserved_svc; style-conversion routes also accept style_ref, style_ref_text and target_text in Additional options."},{"id":"vevo2","display_name":"Vevo2 (vc 语音转换, GGUF Q8)","display_name_en":"Vevo2 (voice conversion, GGUF Q8)","family":"vevo2","path":"models/Vevo2-GGUF","task":"vc","mode":"offline","download_id":"vevo2_gguf","min_vram_gb":6},{"id":"vibevoice","display_name":"VibeVoice 1.5B/7B (tts, long-form/multi-speaker)","family":"vibevoice","path":"models/VibeVoice-1.5B","task":"tts","mode":"offline","download_id":"vibevoice_1_5b","min_vram_gb":7},{"id":"vibevoice-7b","display_name":"VibeVoice 7B (tts, long-form/multi-speaker)","family":"vibevoice","path":"models/VibeVoice-7B-GGUF","task":"tts","mode":"offline","download_id":"vibevoice_7b_q8_0","min_vram_gb":16},{"id":"vibevoice-asr","display_name":"VibeVoice ASR (asr, 多语种+说话人分段)","display_name_en":"VibeVoice ASR (asr, multilingual + speaker turns)","family":"vibevoice_asr","path":"models/VibeVoice-ASR","task":"asr","mode":"offline","download_id":"vibevoice_asr","min_vram_gb":20,"input_hint":"**VibeVoice ASR**：自动语种，可输出分段/说话人轮次；文本框可填上下文提示（如 The recording is a meeting conversation.）。权重 17.3G，8G 卡跑不动。","input_hint_en":"**VibeVoice ASR**: automatic language detection with segment and speaker-turn output. The text box accepts a context prompt. Its 17.3 GB weights require substantially more than 8 GB VRAM."},{"id":"vibevoice-asr-streaming-1.5b","display_name":"VibeVoice ASR Streaming 1.5B (asr, 多语种+流式)","display_name_en":"VibeVoice ASR Streaming 1.5B (asr, multilingual + streaming)","family":"vibevoice_asr_streaming","path":"models/VibeVoice-ASR-Streaming-1.5B-GGUF/vibevoice-asr-streaming-1.5b-q8_0.gguf","task":"asr","mode":"offline","download_id":"vibevoice_asr_streaming_1_5b_q8_0","min_vram_gb":6,"input_hint":"**VibeVoice ASR Streaming 1.5B**：7B 的较小版本，功能相同，显存占用更低，准确率略低；文本框可填上下文提示。","input_hint_en":"**VibeVoice ASR Streaming 1.5B**: the smaller sibling of the 7B with the same features, lower VRAM use, and somewhat lower accuracy. The text box accepts a context prompt."},{"id":"vibevoice-asr-streaming-7b","display_name":"VibeVoice ASR Streaming 7B (asr, 多语种+流式)","display_name_en":"VibeVoice ASR Streaming 7B (asr, multilingual + streaming)","family":"vibevoice_asr_streaming","path":"models/VibeVoice-ASR-Streaming-7B-GGUF/vibevoice-asr-streaming-7b-q8_0.gguf","task":"asr","mode":"offline","download_id":"vibevoice_asr_streaming_7b_q8_0","min_vram_gb":18,"input_hint":"**VibeVoice ASR Streaming 7B**：多语种 ASR，支持长音频流式解码和说话人轮次；文本框可填上下文提示。","input_hint_en":"**VibeVoice ASR Streaming 7B**: multilingual ASR with long-audio streaming decode and speaker-turn output. The text box accepts a context prompt."},{"id":"vieneu-tts","display_name":"VieNeu-TTS v3 Turbo (tts 越南语, 社区)","display_name_en":"VieNeu-TTS v3 Turbo (vi tts, community)","family":"vieneu_v3_turbo","path":"models/VieNeu-TTS-v3-Turbo","task":"tts","mode":"offline","download_id":"vieneu_v3_turbo_v3_turbo","min_vram_gb":4,"input_hint":"**VieNeu-TTS v3 Turbo**（社区模型）：越南语 / 英语；上传参考音色即克隆。","input_hint_en":"**VieNeu-TTS v3 Turbo** (community): Vietnamese and English. Upload a reference voice to clone."},{"id":"bluemagpie","display_name":"BlueMagpie-TTS 1B (tts + clone)","family":"bluemagpie","path":"models/BlueMagpie-TTS-Q8_0","task":"tts","mode":"offline","download_id":"bluemagpie_1b_q8_0","min_vram_gb":4},{"id":"voxcpm1","display_name":"VoxCPM1 0.5B (tts + clone)","family":"voxcpm1","path":"models/VoxCPM1-GGUF","task":"tts","mode":"offline","download_id":"voxcpm1_0_5b_q8_0","min_vram_gb":4},{"id":"voxcpm2","display_name":"VoxCPM2 (tts)","family":"voxcpm2","path":"models/VoxCPM2","task":"tts","mode":"offline","download_id":"voxcpm2","session_options":{"voxcpm2.weight_type":"q8_0"},"min_vram_gb":6},{"id":"voxtral-realtime","display_name":"Voxtral Mini 4B Realtime (asr, 自动语种+流式)","display_name_en":"Voxtral Mini 4B Realtime (asr, auto + streaming)","family":"voxtral_realtime","path":"models/Voxtral-Mini-4B-Realtime-2602-GGUF","task":"asr","mode":"offline","download_id":"voxtral_realtime","min_vram_gb":8},{"id":"voxtral-tts","display_name":"Voxtral 4B TTS","family":"voxtral_tts","path":"models/Voxtral-4B-TTS-2603-GGUF/voxtral-4b-tts-2603-bf16.gguf","task":"tts","mode":"offline","download_id":"voxtral_4b_tts_2603_bf16","default_text":"The next train leaves in ten minutes. Please wait by platform five."},{"id":"whistle-asr","display_name":"Whistle ASR","family":"whistle_asr","path":"models/Whistle-GGUF/whistle-f32.gguf","task":"asr","mode":"offline","download_id":"whistle_asr_f32"},{"id":"yue2","display_name":"Yue2 3B (song gen)","family":"yue2","path":"models/Yue2-3B-GGUF","task":"gen","mode":"offline","download_id":"yue2_main_q8_0","default_text":"[Verse]\\nSoft morning light is touching the window.\\nI hear the city waking below.\\n[Chorus]\\nStay with the rhythm, let it carry us home.\\nSing with the sunrise, we are never alone.","min_vram_gb":12,"input_hint_en":"**Yue2 3B**: provide lyrics and a style prompt. The default inference combo is Main Q8_0 + VAE F16; choose other main/VAE files from Model parameters before loading."},{"id":"zipenhancer","display_name":"ZipEnhancer","family":"builtin_audio_utils","task":"s2s","workflow":"enhancement","mode":"offline","path":"models/Audio-Utilities/zipenhancer/zipenhancer.safetensors","load_options":{"utility":"zipenhancer"},"weights_url":"https://raw.githubusercontent.com/0xShug0/audio.cpp/main/assets/framework/audio_utilities/zipenhancer/zipenhancer.safetensors"},{"id":"zipvoice","display_name":"ZipVoice (中英零样本克隆)","display_name_en":"ZipVoice (zh/en zero-shot cloning)","family":"zipvoice","path":"models/ZipVoice-Distill-GGUF","task":"clon","mode":"offline","download_id":"zipvoice_distill_gguf","min_vram_gb":4,"input_hint":"**ZipVoice**：中/英零样本声音克隆（k2-fsa TTSZipformer flow-matching + Vocos，蒸馏版 8 步采样）。上传参考音频，并在『参考文本’里填入它的逐字转写——参考音频与参考文本必须配对；合成文本支持中文、英文及混排。权重 Apache-2.0。","input_hint_en":"**ZipVoice**: zero-shot voice cloning in zh/en (k2-fsa TTSZipformer flow matching + Vocos, distilled 8-step sampling). Upload a reference clip and put its exact transcript in the reference-text box — the clip and the transcript must match; synthesis text supports zh/en/mixed. Weights are Apache-2.0."}]');
const rawCatalog = {
  models
};
const bluemagpie = [{ "name": "seed", "type": "number", "label": "seed", "default": 1234, "minimum": 0, "maximum": 2147483647, "step": 1, "info": "Flow noise seed." }, { "name": "num_inference_steps", "type": "number", "label": "num inference steps", "default": 10, "minimum": 1, "maximum": 100, "step": 1, "info": "CFM sampling steps." }, { "name": "guidance_scale", "type": "slider", "label": "guidance scale", "default": 2, "minimum": 0, "maximum": 20, "step": 0.1, "info": "CFM classifier-free guidance." }, { "name": "stream_chunk_ms", "type": "number", "label": "stream chunk ms", "default": 320, "minimum": 40, "maximum": 5e3, "step": 1, "info": "Audio chunk duration while generation continues." }, { "name": "segment_bytes", "type": "number", "label": "segment bytes", "default": 240, "minimum": 0, "maximum": 4096, "step": 1, "info": "Sentence-aware UTF-8 segment budget; 0 disables segmentation." }];
const ming3_tts = [{ "name": "template_name", "type": "text", "label": "Prompt template", "placeholder": "Automatic" }, { "name": "voice_id", "type": "text", "label": "IP voice name", "placeholder": "US_James (IP template only)" }, { "name": "temperature", "type": "number", "label": "Temperature", "default": 0, "minimum": 0, "step": 0.1 }, { "name": "guidance_scale", "type": "number", "label": "Guidance scale", "default": 2, "step": 0.1 }, { "name": "sigma", "type": "number", "label": "SDE noise scale", "default": 0.25, "minimum": 0, "step": 0.05 }, { "name": "trim_silence", "type": "bool", "label": "Trim trailing silence", "default": true }];
const ming3_audio = [{ "name": "voice_id", "type": "text", "label": "Voice name", "placeholder": "US_James" }, { "name": "prompt", "type": "text", "label": "Audio task prompt", "placeholder": "Use task default" }, { "name": "system_prompt", "type": "text", "label": "System prompt" }, { "name": "enable_thinking", "type": "bool", "label": "Enable thinking", "default": false }, { "name": "max_audio_tokens", "type": "number", "label": "Maximum acoustic patches per chunk", "default": 1e3, "minimum": 1, "step": 1 }, { "name": "temperature", "type": "number", "label": "Temperature", "default": 0, "minimum": 0, "step": 0.1 }, { "name": "guidance_scale", "type": "number", "label": "Guidance scale", "default": 2, "step": 0.1 }, { "name": "disk_experts", "scope": "session", "session_option": "ming3_audio.disk_experts", "type": "bool", "label": "Offload expert weights", "default": false }, { "name": "pin_experts", "scope": "session", "session_option": "ming3_audio.pin_experts", "type": "bool", "label": "Keep experts in pinned host RAM", "default": false }];
const xtts_v2 = [{ "name": "temperature", "type": "slider", "label": "Temperature", "default": 0.75, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "Top-k", "default": 50, "minimum": 0, "step": 1 }, { "name": "top_p", "type": "slider", "label": "Top-p", "default": 0.85, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "repetition_penalty", "type": "number", "label": "Repetition penalty", "default": 10, "minimum": 1, "step": 0.5 }, { "name": "max_mel_tokens", "type": "number", "label": "Maximum mel tokens", "default": 605, "minimum": 1, "step": 1 }];
const latentsync = [{ "name": "num_inference_steps", "type": "number", "label": "Denoising steps", "default": 20, "minimum": 1, "maximum": 999, "step": 1 }, { "name": "cache_interval", "type": "number", "label": "DeepCache interval", "default": 1, "minimum": 1, "step": 1 }, { "name": "guidance_scale", "type": "number", "label": "Guidance scale", "default": 1.5, "minimum": 0, "step": 0.1 }, { "name": "frames_per_chunk", "type": "number", "label": "Frames per chunk", "default": 16, "minimum": 1, "maximum": 24, "step": 1 }, { "name": "fps", "type": "number", "label": "Frames per second", "default": 25, "minimum": 1, "step": 1 }, { "name": "mem_saver", "scope": "session", "session_option": "latentsync.mem_saver", "type": "bool", "label": "Memory saver", "default": false }];
const ast_audioset = [{ "name": "top_k", "type": "number", "label": "Top classes", "default": 10, "minimum": 1, "maximum": 527, "step": 1 }];
const ced = [{ "name": "top_k", "type": "number", "label": "Top classes", "default": 10, "minimum": 1, "maximum": 527, "step": 1 }];
const fish_drama3 = [{ "name": "text_chunk_size", "type": "number", "label": "Characters per chunk", "default": 128, "minimum": 1, "step": 1, "info": "Smaller chunks reduce waveform-decoder peak memory; larger chunks reduce repeated prefills." }, { "name": "temperature", "type": "slider", "label": "Temperature", "default": 1, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "Top-p", "default": 0.9, "minimum": 0.01, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "Top-k", "default": 4097, "minimum": 1, "step": 1 }, { "name": "disk_experts", "type": "bool", "scope": "session", "session_option": "fish_drama3.disk_experts", "label": "Offload expert weights", "default": true, "info": "Keep only selected expert weights on the GPU. Expert computation stays on the selected backend; changing this reloads the model." }, { "name": "pin_experts", "type": "bool", "scope": "session", "session_option": "fish_drama3.pin_experts", "label": "Preload experts in pinned host RAM", "default": true, "info": "Requires expert offload. Faster uploads, but holds the full expert banks in pinned host RAM." }, { "name": "expert_cache_size", "type": "number", "scope": "session", "session_option": "fish_drama3.expert_cache_size", "label": "GPU expert slots per layer", "default": 8, "minimum": 8, "maximum": 256, "step": 1 }, { "name": "context_length", "type": "number", "scope": "session", "session_option": "fish_drama3.context_length", "label": "Context capacity", "default": 4096, "minimum": 1, "step": 1, "info": "Prompt and generated frames share this capacity, including all voice references and dialogue history." }];
const firered_vad = [{ "name": "threshold", "type": "number", "label": "Speech threshold", "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "min_silence_duration_ms", "type": "number", "label": "Minimum silence (ms)", "default": 200, "minimum": 0, "step": 10 }, { "name": "speech_pad_ms", "type": "number", "label": "Speech padding (ms)", "default": 0, "minimum": 0, "step": 10 }];
const hviske_asr_v6 = [{ "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "silence", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Chunk duration (s)", "default": 28, "minimum": 1e-3, "maximum": 30, "step": 0.1 }, { "name": "max_tokens", "type": "number", "label": "Maximum tokens", "default": 440, "minimum": 1, "step": 1 }, { "name": "num_beams", "type": "number", "label": "Beam count", "default": 2, "minimum": 1, "step": 1 }, { "name": "length_penalty", "type": "number", "label": "Length penalty", "default": 1, "minimum": 0, "step": 0.1 }];
const micro_wake_word = [{ "name": "threshold", "type": "number", "label": "Detection threshold", "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "sliding_window_size", "type": "number", "label": "Sliding window frames", "minimum": 1, "step": 1 }];
const open_wake_word = [{ "name": "threshold", "type": "number", "label": "Detection threshold", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.05 }];
const plapre = [{ "name": "temperature", "type": "number", "label": "Temperature", "default": 0.8, "minimum": 0, "step": 0.05 }, { "name": "top_p", "type": "number", "label": "Top-p", "default": 0.95, "minimum": 0.01, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "Top-k", "default": 50, "minimum": -1, "step": 1 }, { "name": "x_vector_only_mode", "type": "bool", "label": "Reference speaker embedding only", "default": false }];
const mossformer2 = [{ "name": "audio_chunk_duration_sec", "type": "number", "label": "Chunk duration (s, 0 = whole recording)", "default": 2, "minimum": 0, "step": 0.1 }, { "name": "audio_chunk_overlap_sec", "type": "number", "label": "Chunk overlap (s)", "default": 0.5, "minimum": 0, "step": 0.1 }, { "name": "normalize_output", "type": "bool", "label": "Normalize output", "default": true }];
const sherpa_kws = [{ "name": "keywords", "type": "text", "label": "Keyword tokens (one phrase per line)", "lines": 3, "placeholder": "Leave empty to use embedded keywords" }, { "name": "max_active_paths", "type": "number", "label": "Active decoding paths", "default": 4, "minimum": 1, "step": 1 }, { "name": "keywords_score", "type": "number", "label": "Keyword score", "default": 1, "minimum": 0, "step": 0.1 }, { "name": "keywords_threshold", "type": "number", "label": "Keyword threshold", "default": 0.25, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "num_trailing_blanks", "type": "number", "label": "Trailing blanks", "default": 1, "minimum": 0, "step": 1 }];
const tf_gridnet = [{ "name": "audio_chunk_duration_sec", "type": "number", "label": "Chunk duration (s, 0 = whole recording)", "default": 2.4, "minimum": 0, "step": 0.1 }, { "name": "audio_chunk_overlap_sec", "type": "number", "label": "Chunk overlap (s)", "default": 1.6, "minimum": 0, "step": 0.1 }, { "name": "normalize_output", "type": "bool", "label": "Normalize output", "default": true }];
const voxtral_tts = [{ "name": "voice_id", "type": "choice", "label": "Voice preset", "default": "casual_male", "choices": ["casual_female", "casual_male", "cheerful_female", "neutral_female", "neutral_male", "pt_male", "pt_female", "nl_male", "nl_female", "it_male", "it_female", "fr_male", "fr_female", "es_male", "es_female", "de_male", "de_female", "ar_male", "hi_male", "hi_female"] }, { "name": "num_inference_steps", "type": "number", "label": "Diffusion steps", "default": 7, "minimum": 1, "step": 1 }, { "name": "guidance_scale", "type": "number", "label": "Guidance scale", "default": 1.2, "minimum": 0, "step": 0.1 }, { "name": "max_tokens", "type": "number", "label": "Maximum tokens", "default": 2048, "minimum": 1, "step": 1 }];
const kugelaudio = [{ "name": "num_inference_steps", "type": "number", "label": "Diffusion steps", "default": 20, "minimum": 1, "maximum": 1e3, "step": 1 }, { "name": "guidance_scale", "type": "number", "label": "Guidance scale", "default": 3, "minimum": 0, "step": 0.1 }, { "name": "max_tokens", "type": "number", "label": "Maximum tokens", "default": 2048, "minimum": 1, "step": 1 }, { "name": "do_sample", "type": "bool", "label": "Sample AR tokens", "default": false }, { "name": "temperature", "type": "number", "label": "Temperature", "default": 1, "minimum": 0, "step": 0.1 }, { "name": "text_chunk_size", "type": "number", "label": "Text chunk size", "default": 300, "minimum": 1, "step": 1 }, { "name": "text_chunk_mode", "type": "choice", "label": "Text chunk mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }];
const crisperwhisper = [{ "name": "transcription_mode", "type": "choice", "label": "Transcription mode", "default": "verbatim", "choices": ["verbatim", "intended", "verbatimize"] }, { "name": "return_timestamps", "type": "bool", "label": "Word timestamps", "default": false }, { "name": "max_tokens", "type": "number", "label": "Maximum tokens", "default": 256, "minimum": 1, "maximum": 439, "step": 1 }, { "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Chunk duration (s)", "default": 30, "minimum": 0.02, "maximum": 30, "step": 0.1 }, { "name": "audio_chunk_overlap_sec", "type": "number", "label": "Chunk overlap (s)", "default": 4, "minimum": 0, "step": 0.1 }];
const index_echo = [{ "name": "target_language", "type": "choice", "label": "Translation language", "default": "en", "choices": ["en", "es", "ja"] }, { "name": "max_text_tokens", "type": "number", "label": "Maximum text tokens", "default": 2e3, "minimum": 1, "step": 1 }, { "name": "temperature", "type": "number", "label": "Temperature", "default": 0, "minimum": 0, "maximum": 2, "step": 0.1 }, { "name": "glossary", "type": "text", "label": "Glossary", "default": "" }, { "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "quiet_energy", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Chunk duration (s)", "default": 60, "minimum": 1, "maximum": 60, "step": 1 }];
const audio_flamingo = [{ "name": "instruct", "type": "text", "label": "Question or instruction", "default": "Transcribe the input speech.", "lines": 3 }, { "name": "max_tokens", "type": "number", "label": "Maximum tokens", "default": 2048, "minimum": 1, "step": 1 }, { "name": "do_sample", "type": "bool", "label": "Sample tokens", "default": false }, { "name": "temperature", "type": "number", "label": "Temperature", "default": 1, "minimum": 0.01, "step": 0.1 }, { "name": "top_k", "type": "number", "label": "Top K", "default": 50, "minimum": 0, "step": 1 }, { "name": "top_p", "type": "number", "label": "Top P", "default": 1, "minimum": 0.01, "maximum": 1, "step": 0.05 }, { "name": "repetition_penalty", "type": "number", "label": "Repetition penalty", "default": 1, "minimum": 0.01, "step": 0.05 }];
const owsm = [{ "name": "language", "type": "text", "label": "Input language (ISO 639-3)", "default": "eng", "placeholder": "eng, jpn, zho, auto" }, { "name": "target_language", "type": "text", "label": "Translation language (ISO 639-3)", "default": "" }, { "name": "return_timestamps", "type": "bool", "label": "Timestamp segments", "default": false }, { "name": "condition_on_previous_text", "type": "bool", "label": "Condition on previous text", "default": false }, { "name": "beam_size", "type": "number", "label": "Beam size", "default": 1, "minimum": 1, "maximum": 50002, "step": 1 }, { "name": "max_tokens", "type": "number", "label": "Maximum tokens (0 = model limit)", "default": 0, "minimum": 0, "maximum": 374, "step": 1 }, { "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Chunk duration (s)", "default": 30, "minimum": 0.2, "maximum": 30, "step": 0.1 }];
const owsm_ctc = [{ "name": "language", "type": "text", "label": "Input language (ISO 639-3)", "default": "eng", "placeholder": "eng, jpn, zho, auto" }, { "name": "target_language", "type": "text", "label": "Translation language (ISO 639-3)", "default": "" }, { "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "fixed", "none"] }];
const reuse = [{ "name": "audio_chunk_duration_sec", "type": "number", "label": "Chunk duration (s, 0 = whole recording)", "default": 0, "minimum": 0, "step": 1 }, { "name": "audio_chunk_overlap_sec", "type": "number", "label": "Chunk overlap (s)", "default": 1, "minimum": 0, "step": 0.1 }];
const smart_turn = [{ "name": "threshold", "type": "number", "label": "Completion threshold", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.05 }];
const maya1 = [{ "name": "instruct", "type": "text", "label": "Voice description", "default": "Warm female voice with an American accent and conversational pacing.", "lines": 3 }, { "name": "temperature", "type": "number", "label": "Temperature", "default": 0.4, "minimum": 0.01, "step": 0.05 }, { "name": "top_p", "type": "number", "label": "Top P", "default": 0.9, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "repetition_penalty", "type": "number", "label": "Repetition penalty", "default": 1.1, "minimum": 0.01, "step": 0.05 }];
const gigaam_asr = [{ "name": "return_timestamps", "type": "bool", "label": "Word timestamps", "default": false }, { "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "fixed", "quiet_energy", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Audio chunk duration (s)", "default": 25, "minimum": 0.02, "maximum": 25, "step": 0.1 }];
const samsone = [{ "name": "instruct", "type": "text", "label": "Question or instruction", "default": "describe the audio", "lines": 3 }, { "name": "max_tokens", "type": "number", "label": "Maximum tokens", "default": 100, "minimum": 1, "maximum": 512, "step": 1 }];
const sam_audio = [{ "name": "num_inference_steps", "type": "number", "label": "Inference steps", "default": 16, "minimum": 1, "step": 1 }, { "name": "anchors", "type": "text", "label": "Time anchors (JSON)", "default": "", "placeholder": '[["+",0.5,2.0],["-",3.0,4.0]]' }];
const tone_color_vc = [{ "name": "temperature", "type": "number", "label": "Temperature", "default": 0.3, "minimum": 0, "step": 0.05 }];
const moss_ttsd = [{ "name": "instruct", "type": "text", "label": "Delivery instruction", "default": "" }, { "name": "temperature", "type": "number", "label": "Temperature", "default": 1.5, "minimum": 0, "step": 0.1 }, { "name": "top_p", "type": "number", "label": "Top P", "default": 0.6, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "Top K", "default": 50, "minimum": 0, "step": 1 }, { "name": "repetition_penalty", "type": "number", "label": "Repetition penalty", "default": 1.1, "minimum": 0, "step": 0.05 }, { "name": "max_frames", "type": "number", "label": "Maximum audio frames (0 = automatic)", "default": 0, "minimum": 0, "step": 1 }];
const moss_voicegen = [{ "name": "temperature", "type": "number", "label": "Temperature", "default": 1.5, "minimum": 0, "step": 0.1 }, { "name": "top_p", "type": "number", "label": "Top P", "default": 0.6, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "Top K", "default": 50, "minimum": 0, "step": 1 }, { "name": "repetition_penalty", "type": "number", "label": "Repetition penalty", "default": 1.1, "minimum": 0, "step": 0.05 }];
const nemotron_asr = [{ "name": "context_score", "type": "number", "label": "Terminology strength", "default": 2, "minimum": 0, "maximum": 10, "step": 0.5, "info": "Bias competing speech tokens toward the Context prompt. Zero disables biasing; higher values may introduce incorrect terms." }];
const canary_asr = [{ "name": "target_language", "type": "choice", "label": "Target language", "default": "", "choices": ["", "en", "de", "es", "fr"] }, { "name": "pnc", "type": "bool", "label": "Punctuation and capitalization", "default": true }, { "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Audio chunk duration (s)", "default": 40, "minimum": 0.02, "maximum": 40, "step": 0.1 }];
const cohere_asr = [{ "name": "pnc", "type": "bool", "label": "Punctuation and capitalization", "default": true }, { "name": "audio_chunk_mode", "type": "choice", "label": "Audio chunk mode", "default": "auto", "choices": ["auto", "quiet_energy", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Audio chunk duration (s)", "default": 35, "minimum": 0.04, "maximum": 35, "step": 0.1 }];
const moss_transcribe_diarize = [{ "name": "instruct", "type": "text", "label": "Instruction", "default": "", "lines": 3 }];
const apollo = [{ "name": "audio_chunk_duration_sec", "type": "number", "label": "Audio chunk duration (s)", "default": 0, "minimum": 0, "step": 1 }, { "name": "audio_chunk_overlap_sec", "type": "number", "label": "Audio chunk overlap (s)", "default": 1, "minimum": 0, "step": 0.1 }, { "name": "edge_pad_duration_sec", "type": "number", "label": "Edge padding (s)", "default": 0, "minimum": 0, "step": 0.1 }];
const universr = [{ "name": "input_sample_rate", "type": "choice", "label": "Input bandwidth (Hz)", "default": "", "choices": ["", 8e3, 12e3, 16e3, 24e3] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "Audio chunk duration (s)", "default": 0, "minimum": 0, "step": 1 }, { "name": "sampler_mode", "type": "choice", "label": "Sampler", "default": "midpoint", "choices": ["euler", "midpoint", "rk4"] }, { "name": "num_inference_steps", "type": "number", "label": "Inference steps", "default": 4, "minimum": 1, "step": 1 }, { "name": "guidance_scale", "type": "number", "label": "Guidance scale", "default": 1.5, "minimum": 0, "step": 0.1 }];
const liveavatar = [{ "name": "reference_image_path", "type": "text", "label": "Reference image", "default": "" }, { "name": "generation_mode", "type": "choice", "label": "Generation mode", "default": "offline", "choices": ["offline", "liveavatar"] }, { "name": "height", "type": "number", "label": "Height", "default": 480, "minimum": 16, "step": 16, "precision": 0 }, { "name": "width", "type": "number", "label": "Width", "default": 832, "minimum": 16, "step": 16, "precision": 0 }, { "name": "num_frames", "type": "number", "label": "Frames per clip", "default": 48, "minimum": 1, "step": 1, "precision": 0 }, { "name": "num_clips", "type": "number", "label": "Maximum clips", "default": 1, "minimum": 1, "step": 1, "precision": 0 }, { "name": "num_inference_steps", "type": "number", "label": "Denoising steps", "default": 4, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "Guidance scale", "default": 0, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "shift", "type": "slider", "label": "Scheduler shift", "default": 3, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "negative_prompt", "type": "text", "label": "Negative prompt", "default": "" }, { "name": "fused_cfg", "type": "bool", "label": "Fused CFG", "default": true }, { "name": "sage_attention", "type": "bool", "label": "SageAttention", "default": true }, { "name": "memory_saver", "type": "bool", "label": "Memory saver", "default": true }, { "name": "denoiser_layerwise", "type": "bool", "label": "Layerwise denoiser", "default": false }, { "name": "denoiser_layerwise_batch", "type": "number", "label": "Layerwise batch", "default": 16, "minimum": 1, "step": 1, "precision": 0 }, { "name": "vae_encoder_chunk_size", "type": "number", "label": "VAE encoder chunk", "default": 16, "minimum": 1, "step": 1, "precision": 0 }, { "name": "vae_decoder_tile_size", "type": "number", "label": "VAE decoder tile", "default": 0, "minimum": 0, "step": 16, "precision": 0 }, { "name": "target_cache_blocks", "type": "number", "label": "Target cache blocks", "default": 2, "minimum": 0, "step": 1, "precision": 0 }, { "name": "vae_cache_f16", "type": "bool", "label": "F16 VAE cache", "default": true }, { "name": "denoiser_weight_streaming", "type": "bool", "scope": "session", "session_option": "liveavatar.denoiser_weight_streaming", "label": "Stream denoiser weights", "default": false }];
const pulsevad = [{ "name": "threshold", "type": "slider", "label": "Speech threshold", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "hop_size_samples", "type": "number", "label": "Hop size (samples)", "default": 1600, "minimum": 1, "step": 1 }, { "name": "min_speech_duration_ms", "type": "number", "label": "Minimum speech (ms)", "default": 100, "minimum": 0, "step": 1 }, { "name": "min_silence_duration_ms", "type": "number", "label": "Minimum silence (ms)", "default": 100, "minimum": 0, "step": 1 }];
const echo_tts = [{ "name": "num_inference_steps", "type": "slider", "label": "num_inference_steps", "label_en": "Sampling steps", "default": 40, "minimum": 8, "maximum": 40, "step": 1, "precision": 0, "info": "Euler sampler steps." }, { "name": "text_guidance_scale", "type": "slider", "label": "text_guidance_scale", "label_en": "Text guidance", "default": 3, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "speaker_guidance_scale", "type": "slider", "label": "speaker_guidance_scale", "label_en": "Speaker guidance", "default": 8, "minimum": 0, "maximum": 15, "step": 0.1 }, { "name": "truncation_factor", "type": "slider", "label": "truncation_factor", "label_en": "Noise truncation", "default": 0.8, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "guidance_interval", "type": "slider", "label": "guidance_interval", "label_en": "Guidance interval", "default": 1, "minimum": 1, "maximum": 3, "step": 1, "precision": 0, "info": "Refresh the unconditional CFG lanes every Nth guided step. Higher is faster and works best with more steps; 1 is highest fidelity." }, { "name": "reference_duration_sec", "type": "slider", "label": "reference_duration_sec", "label_en": "Reference trim (s)", "default": 15, "minimum": 1, "maximum": 60, "step": 1, "info": "Trim the speaker reference before encoding. Around 10 s usually clones best." }, { "name": "seed", "type": "number", "label": "seed", "label_en": "Seed", "default": 0, "minimum": 0, "step": 1, "precision": 0 }];
const _comment = "WebUI TTS 高级参数控件配置：按模型 family 动态生成控件（gr.render）。每项字段：name=选项键；type=slider|number|bool|text|choice；scope=session 时写入 session_options，否则随请求 options 透传给模型；label/info=显示文案；default=默认值(应等于模型默认，已按 src/models/<family>/*.cpp 校对)；minimum/maximum/step=数值范围；precision=0 表示整数；choices=下拉候选。seed/max_tokens 已有专用输入框，勿在此重复；参考文本用『参考文本』框(reference_text)；文件路径/parity 类参数(如 *_noise_file)未纳入，可用『其它参数(JSON)』兜底框传。";
const qwen3_tts = [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 0.9, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 0, "step": 1, "precision": 0 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 1, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "repetition_penalty", "type": "slider", "label": "repetition_penalty", "default": 1.05, "minimum": 1, "maximum": 2, "step": 0.01 }, { "name": "do_sample", "type": "bool", "label": "do_sample", "default": true }, { "name": "instruct", "type": "text", "label": "instruct（仅 VoiceDesign/CustomVoice）", "default": "", "placeholder": "风格/音色指令，Base 版忽略" }, { "name": "speaker", "type": "text", "label": "speaker（仅 CustomVoice）", "default": "", "placeholder": "内置音色名，其它版忽略" }];
const vibevoice = [{ "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0, "info": "扩散步数（官方默认 10），越大越慢越稳" }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 1.3, "minimum": 0, "maximum": 5, "step": 0.1, "info": "CFG 引导强度" }, { "name": "max_length_times", "type": "number", "label": "max_length_times", "default": 2, "minimum": 0.1, "step": 0.1, "info": "最大输出长度倍数" }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 1, "minimum": 0.05, "maximum": 2, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 1, "minimum": 0.05, "maximum": 1, "step": 0.01 }, { "name": "do_sample", "type": "bool", "label": "do_sample", "default": false }, { "name": "voice_samples", "type": "text", "label": "voice_samples（多说话人，逗号分隔 wav，≤4）", "default": "", "placeholder": "D:/a.wav,D:/b.wav — 用此项时勿再上传参考音色" }];
const voxcpm2 = [{ "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0, "info": "CFM/DiT 步数" }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "tag_aware", "choices": ["default", "tag_aware", "japanese", "endline"] }, { "name": "min_tokens", "type": "number", "label": "min_tokens", "default": 2, "minimum": 0, "step": 1, "precision": 0 }, { "name": "retry_badcase", "type": "bool", "label": "retry_badcase（自动重试异常输出）", "default": true }];
const voxcpm1 = [{ "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0, "info": "CFM/DiT 步数" }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "min_tokens", "type": "number", "label": "min_tokens", "default": 2, "minimum": 0, "step": 1, "precision": 0 }, { "name": "retry_badcase", "type": "bool", "label": "retry_badcase（自动重试异常输出）", "default": true }];
const miotts = [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 0, "step": 1, "precision": 0 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 1, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "repetition_penalty", "type": "slider", "label": "repetition_penalty", "default": 1, "minimum": 1, "maximum": 1.5, "step": 0.01 }, { "name": "best_of_n", "type": "number", "label": "best_of_n（候选数，>1 自动开启）", "default": 1, "minimum": 1, "maximum": 8, "step": 1, "precision": 0 }];
const chatterbox = [{ "name": "exaggeration", "type": "slider", "label": "exaggeration", "default": 0.5, "minimum": 0, "maximum": 2, "step": 0.05, "info": "改动后需重新『加载模型』才生效" }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.05, "info": "改动后需重新『加载模型』才生效" }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "repetition_penalty", "type": "slider", "label": "repetition_penalty", "default": 1.2, "minimum": 1, "maximum": 2, "step": 0.01 }];
const kokoro_tts = [{ "name": "speed", "type": "slider", "label": "speed（语速倍率）", "label_en": "speed (speech rate)", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }];
const kitten_tts = [{ "name": "speed", "type": "slider", "label": "speed（语速倍率）", "label_en": "speed (speech rate)", "default": 1, "minimum": 0.01, "maximum": 2, "step": 0.05 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size（长文本分段字符数）", "label_en": "text_chunk_size", "default": 400, "minimum": 32, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }];
const piper_tts = [{ "name": "speed", "type": "slider", "label": "speed（语速倍率）", "label_en": "speed (speech rate)", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "variation", "type": "slider", "label": "variation（音色变化）", "label_en": "variation", "default": 0.667, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "duration_variation", "type": "slider", "label": "duration_variation（时长变化）", "label_en": "duration_variation", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size（长文本分段字符数）", "label_en": "text_chunk_size", "default": 280, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }];
const omnivoice = [{ "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 32, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "speed", "type": "slider", "label": "speed", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "instruct", "type": "text", "label": "instruct（风格/音色指令）", "default": "", "placeholder": "如：以轻快的语气朗读" }];
const sense_asr = [{ "name": "enable_itn", "type": "bool", "label": "enable_itn（逆文本规范化）", "label_en": "enable_itn", "default": true }, { "name": "keep_tags", "type": "bool", "label": "keep_tags（保留语言/情绪/事件标签）", "label_en": "keep_tags", "default": false }, { "name": "audio_chunk_mode", "type": "choice", "label": "audio_chunk_mode", "default": "auto", "choices": ["auto", "fixed", "none"] }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "audio_chunk_duration_sec", "default": 30, "minimum": 1e-3, "step": 1 }];
const lfm2_audio = [{ "name": "audio_chunk_mode", "type": "choice", "label": "audio_chunk_mode", "default": "auto", "choices": ["auto", "vad", "fixed", "none"], "info_en": "auto keeps audio up to audio_chunk_seconds whole and splits longer audio at pauses; none transcribes it in one pass, which the model handles up to about a minute." }, { "name": "audio_chunk_seconds", "type": "number", "label": "audio_chunk_seconds", "default": 30, "minimum": 1, "step": 1 }, { "name": "max_tokens", "type": "number", "label": "max_tokens", "default": 512, "minimum": 1, "step": 1, "precision": 0, "info_en": "Transcript tokens allowed per chunk; a transcript that reaches it is cut off there." }];
const lfm3_audio = [{ "name": "audio_chunk_mode", "type": "choice", "label": "audio_chunk_mode", "default": "auto", "choices": ["auto", "vad", "fixed", "none"], "info_en": "auto keeps audio up to audio_chunk_duration_sec whole and splits longer audio at VAD pauses; none transcribes it in one pass." }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "audio_chunk_duration_sec", "minimum": 1, "step": 1, "info_en": "Longest chunk in seconds; empty uses 300 or lfm3_audio.max_pass_duration_sec, whichever is lower." }, { "name": "chat", "type": "bool", "label": "chat", "default": false, "info_en": "Answer the spoken input as a text chat reply instead of transcribing it." }, { "name": "enable_thinking", "type": "bool", "label": "enable_thinking", "default": false, "info_en": "Needs chat. Let the model think first; only the text after </think> is returned." }, { "name": "max_tokens", "type": "number", "label": "max_tokens", "minimum": 1, "step": 1, "precision": 0, "info_en": "Text tokens allowed per chunk; empty uses 512 or 8 per second of audio, whichever is more (chat 512, 2048 with thinking). A reply that reaches it is cut off there." }];
const confucius4_r2t2 = [{ "name": "chunk_size_ms", "type": "slider", "scope": "session", "session_option": "confucius4_r2t2.chunk_size_ms", "label": "chunk_size_ms（流式分块毫秒）", "label_en": "chunk_size_ms (streaming chunk, ms)", "default": 320, "minimum": 80, "maximum": 2e3, "step": 10, "precision": 0, "info": "80-2000ms：越小延迟越低；320ms 在 Apple Silicon 上延迟与速度较均衡。", "info_en": "80-2000 ms. Lower means lower latency; 320 ms balances latency and speed on Apple Silicon." }, { "name": "unfixed_chunk_num", "type": "number", "scope": "session", "session_option": "confucius4_r2t2.unfixed_chunk_num", "label": "unfixed_chunk_num（前 N 块不用稳定前缀）", "label_en": "unfixed_chunk_num (leading chunks without prefix)", "default": 2, "minimum": 0, "maximum": 10, "step": 1, "precision": 0, "info": "开头若干块不使用已识别文本作为前缀提示。", "info_en": "Leading chunks that decode without a stable-prefix prompt." }, { "name": "unfixed_token_num", "type": "number", "scope": "session", "session_option": "confucius4_r2t2.unfixed_token_num", "label": "unfixed_token_num（回滚 token 数）", "label_en": "unfixed_token_num (rollback tokens)", "default": 5, "minimum": 0, "maximum": 20, "step": 1, "precision": 0, "info": "作为前缀前从累积文本回滚的 token 数，用于降低边界抖动。", "info_en": "Tokens rolled back from the accumulated text before it is used as the prefix prompt." }, { "name": "rollback_punctuation", "type": "bool", "scope": "session", "session_option": "confucius4_r2t2.rollback_punctuation", "label": "rollback_punctuation（句末标点不回滚）", "label_en": "rollback_punctuation (keep trailing punctuation)", "default": false, "info": "输出已以标点结尾时不再回滚 token。", "info_en": "Do not roll back tokens when the output already ends with punctuation." }, { "name": "max_new_tokens", "type": "number", "scope": "session", "session_option": "confucius4_r2t2.max_tokens", "label": "max_new_tokens（每分块解码上限）", "label_en": "max_new_tokens (per-chunk decode budget)", "default": 32, "minimum": 1, "maximum": 256, "step": 1, "precision": 0, "info": "每个流式分块的贪婪解码上限（会话级，区别于离线 max_tokens）。", "info_en": "Greedy decode budget per streaming chunk (session-scoped; distinct from offline max_tokens)." }];
const pocket_tts = [{ "name": "frames_after_eos", "type": "number", "label": "frames_after_eos（-1=自动）", "default": -1, "minimum": -1, "step": 1, "precision": 0 }];
const gradium_phonon = [{ "name": "frames_after_eos", "type": "number", "label": "frames_after_eos（-1=自动）", "label_en": "frames_after_eos (-1 = auto)", "default": -1, "minimum": -1, "step": 1, "precision": 0 }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.3, "minimum": 0.05, "maximum": 1, "step": 0.05 }];
const neutts = [{ "name": "voice_id", "type": "choice", "label": "voice_id（内置音色）", "label_en": "voice_id (built-in voice)", "default": "emily", "choices": ["dave", "emily", "greta", "jo", "juliette", "mateo", "paul", "sophie", "steven"] }, { "name": "emotion", "type": "choice", "label": "emotion（情绪）", "label_en": "emotion", "default": "neutral", "choices": ["angry", "disgusted", "sad", "happy", "fearful", "neutral", "surprised"] }];
const magpie_tts = [{ "name": "language", "type": "choice", "label": "language", "default": "en", "choices": ["en", "ar-AE", "ar-MSA", "ar-SA", "de", "es", "fr", "hi", "it", "ko", "pt-BR", "vi", "zh"] }, { "name": "voice_id", "type": "choice", "label": "voice_id（打包音色）", "label_en": "voice_id (packaged voice)", "default": "Aria", "choices": ["Aria", "Jason", "John", "Leo", "Sofia"] }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.6, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 80, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2.5, "minimum": 0, "maximum": 6, "step": 0.1 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 300, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }];
const breeze_tts = [{ "name": "instruction", "type": "text", "label": "instruction", "label_en": "Instruction", "default": "", "placeholder": "Describe the target voice for VoiceDesign." }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 600, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 1, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.9, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "depth_temperature", "type": "slider", "label": "depth_temperature", "default": 0.9, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 0, "step": 1, "precision": 0 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 1, "minimum": 0, "maximum": 1, "step": 0.01 }];
const cosyvoice3 = [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "zero_shot", "choices": ["zero_shot", "cross_lingual", "instruct"] }, { "name": "instruction", "type": "text", "label": "instruction", "label_en": "Instruction", "default": "", "placeholder": "Used by template_name=instruct." }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 600, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "min_tokens", "type": "number", "label": "min_tokens", "default": 0, "minimum": 0, "step": 1, "precision": 0 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 25, "minimum": 1, "step": 1, "precision": 0 }];
const inflect_v2 = [{ "name": "speaking_rate", "type": "slider", "label": "speaking_rate（语速倍率）", "label_en": "speaking_rate", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "variation", "type": "slider", "label": "variation（音色变化）", "label_en": "variation", "default": 0.667, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size（长文本分段字符数）", "label_en": "text_chunk_size", "default": 280, "minimum": 1, "step": 1, "precision": 0 }];
const sanotts = [{ "name": "speaking_rate", "type": "slider", "label": "speaking_rate（语速倍率）", "label_en": "speaking_rate", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size（长文本分段字符数）", "label_en": "text_chunk_size", "default": 280, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "word_budget", "choices": ["word_budget"] }];
const dramabox = [{ "name": "negative_prompt", "type": "text", "label": "negative_prompt（负向提示）", "label_en": "negative_prompt", "default": "", "placeholder": "留空=模型内置质量提示", "placeholder_en": "Blank = built-in quality prompt" }, { "name": "duration_sec", "type": "number", "label": "duration_sec（0=自动估时）", "label_en": "duration_sec (0 = auto)", "default": 0, "minimum": 0, "step": 0.5 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 30, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2.5, "minimum": 0, "maximum": 8, "step": 0.1 }, { "name": "spatio_temporal_guidance_scale", "type": "slider", "label": "spatio_temporal_guidance_scale", "default": 1.5, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "duration_scale", "type": "slider", "label": "duration_scale（自动估时倍率）", "label_en": "duration_scale", "default": 1.1, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "reference_duration_sec", "type": "number", "label": "reference_duration_sec（参考音频裁剪/重复秒数）", "label_en": "reference_duration_sec", "default": 10, "minimum": 0, "step": 0.5 }, { "name": "guidance_rescale", "type": "text", "label": "guidance_rescale", "default": "auto", "placeholder": "auto 或数值" }, { "name": "audio_chunk_threshold_sec", "type": "number", "label": "audio_chunk_threshold_sec（长文本阈值）", "label_en": "audio_chunk_threshold_sec", "default": 45, "minimum": 0, "step": 1 }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "audio_chunk_duration_sec（长文本分段目标时长）", "label_en": "audio_chunk_duration_sec", "default": 37, "minimum": 0, "step": 1 }, { "name": "cross_fade_duration_sec", "type": "number", "label": "cross_fade_duration_sec（分段交叉淡化）", "label_en": "cross_fade_duration_sec", "default": 0.05, "minimum": 0, "step": 0.01 }];
const confucius4_tts = [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 0.8, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 30, "minimum": 1, "step": 1, "precision": 0 }, { "name": "num_beams", "type": "number", "label": "num_beams", "default": 3, "minimum": 1, "step": 1, "precision": 0 }, { "name": "repetition_penalty", "type": "slider", "label": "repetition_penalty", "default": 10, "minimum": 0, "maximum": 20, "step": 0.1 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 25, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 0.7, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 80, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }, { "name": "cross_fade_duration_sec", "type": "number", "label": "cross_fade_duration_sec", "default": 0.3, "minimum": 0, "step": 0.05 }, { "name": "edge_fade_duration_sec", "type": "number", "label": "edge_fade_duration_sec", "default": 0.1, "minimum": 0, "step": 0.05 }, { "name": "edge_pad_duration_sec", "type": "number", "label": "edge_pad_duration_sec", "default": 0.1, "minimum": 0, "step": 0.05 }];
const ace_step = [{ "name": "lora", "type": "text", "scope": "session", "session_option": "ace_step.lora", "label": "LoRA adapter", "default": "", "info": "Adapter file or PEFT directory on the server; relative paths use the model root." }, { "name": "lora_scale", "type": "number", "scope": "session", "session_option": "ace_step.lora_scale", "label": "LoRA strength", "default": 1, "step": 0.1, "info": "Multiplies the adapter metadata scale; zero disables the adapter." }, { "name": "route", "type": "choice", "label": "route（操作类型）", "default": "text2music", "choices": ["text2music", "complete", "lego", "extract", "cover", "cover-nofsq", "repaint", "remix"], "info": "cover/remix=换词翻唱，非 text2music 需上传源音频；详见 webui/README.md" }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 8, "minimum": 1, "maximum": 20, "step": 1, "precision": 0, "info": "扩散步数（turbo 上限 20）；remix 路由不填时默认 16，其他路由默认 8" }, { "name": "shift", "type": "slider", "label": "shift（时间步弯曲）", "default": 3, "minimum": 1, "maximum": 5, "step": 0.5, "info": "原版 turbo 默认 3.0；1.0 会明显劣化 remix 换词咬字" }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 1, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "audio_cover_strength", "type": "slider", "label": "【cover】audio_cover_strength", "default": 1, "minimum": 0, "maximum": 1, "step": 0.05, "info": "1=贴近原曲，0=自由发挥；建议 0.5" }, { "name": "cover_noise_strength", "type": "slider", "label": "【cover】cover_noise_strength", "default": 0, "minimum": 0, "maximum": 1, "step": 0.05, "info": "保旋律强度；推荐 0.1~0.25" }, { "name": "source_caption", "type": "text", "label": "【remix】source_caption", "default": "", "placeholder": "源歌曲描述；『🔍 分析』自动填" }, { "name": "source_lyrics", "type": "text", "lines": 4, "label": "【remix】source_lyrics", "default": "", "placeholder": "源歌曲原歌词；『🔍 分析』自动填" }, { "name": "flow_edit_n_min", "type": "slider", "label": "【remix】flow_edit_n_min", "default": 0, "minimum": 0, "maximum": 1, "step": 0.05, "info": "调大更保源曲、换词更弱" }, { "name": "flow_edit_n_max", "type": "slider", "label": "【remix】flow_edit_n_max", "default": 1, "minimum": 0, "maximum": 1, "step": 0.05, "info": "唱不出新歌词时降到 0.7~0.9" }, { "name": "flow_edit_n_avg", "type": "number", "label": "【remix】flow_edit_n_avg", "default": 2, "minimum": 1, "maximum": 4, "step": 1, "precision": 0, "info": "每步多次采样取平均（remix 默认 2）；1=最快" }, { "name": "bpm", "type": "number", "label": "【曲谱】BPM", "default": 0, "minimum": 0, "step": 1, "precision": 0, "info": "0=不指定" }, { "name": "keyscale", "type": "text", "label": "【曲谱】keyscale", "default": "", "placeholder": "如 F major" }, { "name": "timesignature", "type": "text", "label": "【曲谱】timesignature", "default": "", "placeholder": "如 4" }];
const minimax_music3 = [{ "name": "num_inference_steps", "type": "number", "label": "Flow steps per window", "default": 30, "minimum": 1, "maximum": 200, "step": 1, "precision": 0, "info": "Flow-matching Euler steps per 200-frame denoising window." }, { "name": "guidance_scale", "type": "slider", "label": "Flow guidance scale", "default": 1.7, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "ar_guidance_scale", "type": "slider", "label": "AR guidance scale", "default": 1.5, "minimum": 0, "maximum": 10, "step": 0.1, "info": "Classifier-free guidance of the semantic and residual code sampling." }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 1, "maximum": 1024, "step": 1, "precision": 0 }];
const auk = [{ "name": "model_gguf", "type": "choice", "scope": "session", "session_option": "auk.model_gguf", "label": "model_gguf", "label_en": "Generator weights", "default": "auk-base-f32.gguf", "choices": ["auk-base-f32.gguf", "auk-base-f16.gguf", "auk-base-q8_0.gguf", "auk-flash-f32.gguf", "auk-flash-f16.gguf", "auk-flash-q8_0.gguf"], "info": "Selects Base or AuK-Flash automatically. Reload the model after changing this value." }, { "name": "qwen_gguf", "type": "choice", "scope": "session", "session_option": "auk.qwen_gguf", "label": "qwen_gguf", "label_en": "Qwen conditioner", "default": "qwen2.5-omni-3b-bf16.gguf", "choices": ["qwen2.5-omni-3b-bf16.gguf", "qwen2.5-omni-3b-q8_0.gguf"], "info": "Reload the model after changing this value." }, { "name": "vae_gguf", "type": "choice", "scope": "session", "session_option": "auk.vae_gguf", "label": "vae_gguf", "label_en": "VAE weights", "default": "auk-vae-f32.gguf", "choices": ["auk-vae-f32.gguf"], "info": "Reload the model after changing this value." }, { "name": "attention", "type": "choice", "scope": "session", "session_option": "auk.attention", "label": "attention", "label_en": "Attention", "default": "auto", "choices": ["auto", "flash", "eager"], "info": "Flow-model attention mode. Reload the model after changing this value." }, { "name": "mem_saver", "type": "bool", "scope": "session", "session_option": "auk.mem_saver", "label": "mem_saver", "label_en": "Memory saver", "default": false, "info": "Release Qwen and generation weights between stages. Warm requests reload weights and rebuild graphs." }, { "name": "instruct", "type": "text", "label": "instruct", "label_en": "Voice description", "default": "", "placeholder": "A warm male voice speaking clear English.", "info": "Optional for TTS only. Without it, text carries the complete upstream instruction." }, { "name": "duration_sec", "type": "number", "label": "duration_sec", "label_en": "Output duration (s)", "default": "", "minimum": 0.02, "step": 0.02, "info": "Required for speech generation without reference audio; otherwise the reference duration is used." }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "label_en": "Sampling steps", "default": 32, "minimum": 1, "step": 1, "precision": 0, "info": "Base Euler steps. AuK-Flash always uses its fixed four-step schedule." }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "label_en": "Guidance scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1, "info": "Base guidance strength. AuK-Flash disables classifier-free guidance." }, { "name": "sway_sampling_coef", "type": "number", "label": "sway_sampling_coef", "label_en": "Sway coefficient", "default": -1, "step": 0.1, "info": "Base sampling schedule sway. AuK-Flash uses its fixed time grid." }];
const yue2 = [{ "name": "ar_lora", "type": "text", "scope": "session", "session_option": "yue2.ar_lora", "label": "ar_lora", "label_en": "AR LoRA adapter", "default": "", "placeholder": "/path/to/ar_lora_inst_v3abc.safetensors", "info": "Unfused AR adapter for score and semantic planning; relative paths resolve against the model root. Reload the model after changing this value." }, { "name": "ar_lora_scale", "type": "number", "scope": "session", "session_option": "yue2.ar_lora_scale", "label": "ar_lora_scale", "label_en": "AR LoRA strength", "default": 1, "step": 0.1, "info": "Scales the AR adapter deltas; 0 disables it. Reload the model after changing this value." }, { "name": "nar_lora", "type": "text", "scope": "session", "session_option": "yue2.nar_lora", "label": "nar_lora", "label_en": "NAR LoRA adapter", "default": "", "placeholder": "/path/to/nar_lora_joint_v4.safetensors", "info": "Unfused NAR adapter for acoustic detail; relative paths resolve against the model root. Reload the model after changing this value." }, { "name": "nar_lora_scale", "type": "number", "scope": "session", "session_option": "yue2.nar_lora_scale", "label": "nar_lora_scale", "label_en": "NAR LoRA strength", "default": 1, "step": 0.1, "info": "Scales the LoRA deltas only; any full vae2llm/llm2vae projection replacements in the adapter stay at full strength. 0 disables the entire adapter. Reload the model after changing this value." }, { "name": "main_gguf", "type": "choice", "scope": "session", "session_option": "yue2.model_gguf", "label": "main_gguf", "label_en": "Main weights", "default": "yue2-3b-q8_0.gguf", "choices": ["yue2-3b-q8_0.gguf", "yue2-3b-q4_0.gguf", "yue2-3b-bf16.gguf"], "info": "Reload the model after changing this value." }, { "name": "vae_gguf", "type": "choice", "scope": "session", "session_option": "yue2.vae_gguf", "label": "vae_gguf", "label_en": "VAE weights", "default": "yue2-vae-f16.gguf", "choices": ["yue2-vae-f16.gguf", "yue2-vae-f32.gguf"], "info": "Reload the model after changing this value." }, { "name": "style", "type": "text", "label": "style", "label_en": "Style", "default": "English, indie pop, bright acoustic guitar, soft drums, warm lead vocal, polished demo mix", "placeholder": "English, city pop, groovy bass, synth, energetic vocal" }, { "name": "abc", "type": "text", "label": "abc", "label_en": "ABC score", "default": "", "placeholder": "Optional ABC notation. Use cot=melody or cot=full.", "lines": 4 }, { "name": "abc_file", "type": "text", "label": "abc_file", "label_en": "ABC file path", "default": "", "placeholder": "/path/to/score.abc" }, { "name": "cot", "type": "choice", "label": "cot", "label_en": "Planning route", "default": "off", "choices": ["off", "melody", "full"], "info": "off = direct generation; melody/full use or generate ABC planning." }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "label_en": "Semantic guidance", "default": 1.01, "minimum": 0, "maximum": 5, "step": 0.01 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "label_en": "NAR steps", "default": 8, "minimum": 1, "maximum": 64, "step": 1, "precision": 0 }, { "name": "abc_temperature", "type": "slider", "label": "abc_temperature", "label_en": "ABC temperature", "default": 0.7, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "abc_top_p", "type": "slider", "label": "abc_top_p", "label_en": "ABC top-p", "default": 0.9, "minimum": 0.01, "maximum": 1, "step": 0.01 }, { "name": "abc_top_k", "type": "number", "label": "abc_top_k", "label_en": "ABC top-k", "default": 30, "minimum": 1, "step": 1, "precision": 0 }, { "name": "abc_repetition_penalty", "type": "slider", "label": "abc_repetition_penalty", "label_en": "ABC repetition penalty", "default": 1.005, "minimum": 0.1, "maximum": 2, "step": 1e-3 }, { "name": "abc_penalty_window", "type": "number", "label": "abc_penalty_window", "label_en": "ABC penalty window", "default": 100, "minimum": 1, "step": 1, "precision": 0 }, { "name": "abc_min_tokens", "type": "number", "label": "abc_min_tokens", "label_en": "ABC min tokens", "default": 32, "minimum": 0, "step": 1, "precision": 0 }, { "name": "abc_max_tokens", "type": "number", "label": "abc_max_tokens", "label_en": "ABC max tokens", "default": 4096, "minimum": 1, "step": 1, "precision": 0 }, { "name": "semantic_temperature", "type": "slider", "label": "semantic_temperature", "label_en": "Semantic temperature", "default": 1, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "semantic_top_p", "type": "slider", "label": "semantic_top_p", "label_en": "Semantic top-p", "default": 0.95, "minimum": 0.01, "maximum": 1, "step": 0.01 }, { "name": "semantic_top_k", "type": "number", "label": "semantic_top_k", "label_en": "Semantic top-k", "default": 100, "minimum": 1, "step": 1, "precision": 0 }, { "name": "semantic_repetition_penalty", "type": "slider", "label": "semantic_repetition_penalty", "label_en": "Semantic repetition penalty", "default": 1.2, "minimum": 0.1, "maximum": 2, "step": 0.01 }, { "name": "semantic_penalty_window", "type": "number", "label": "semantic_penalty_window", "label_en": "Semantic penalty window", "default": 50, "minimum": 1, "step": 1, "precision": 0 }, { "name": "semantic_min_tokens", "type": "number", "label": "semantic_min_tokens", "label_en": "Semantic min tokens", "default": 200, "minimum": 0, "step": 1, "precision": 0 }, { "name": "semantic_max_tokens", "type": "number", "label": "semantic_max_tokens", "label_en": "Semantic max tokens", "default": 9e3, "minimum": 1, "step": 1, "precision": 0 }];
const minimax_h3 = [{ "name": "num_inference_steps", "type": "number", "label": "Denoising steps", "default": 12, "minimum": 1, "maximum": 50, "step": 1, "precision": 0, "info": "Twelve denoising steps provide a practical quality and performance balance." }, { "name": "num_frames", "type": "number", "label": "Output frames", "default": 241, "minimum": 5, "maximum": 1441, "step": 4, "precision": 0, "info": "Approximately 24 frames per output second; 241 frames produces about 10 seconds of audio." }, { "name": "guidance_scale", "type": "slider", "label": "Guidance scale", "default": 1, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "sampler", "type": "choice", "label": "Sampler", "default": "euler", "choices": ["euler", "res_multistep", "dpmpp_2m", "unipc"] }, { "name": "dit_acceleration", "type": "choice", "label": "DiT acceleration", "default": "none", "choices": ["none", "spectrum", "first_block_cache"], "info": "None uses the quality-first full-DiT path. Acceleration modes are experimental and may distort some outputs." }, { "name": "return_video", "type": "bool", "label": "Decode video", "default": false, "info": "Disabled by default to reduce memory use and return audio only." }];
const stable_audio = [{ "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 8, "minimum": 1, "step": 1, "precision": 0, "info": "RF 扩散步数" }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 1, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "audio_input_kind", "type": "choice", "label": "audio_input_kind（仅上传源音频时生效）", "default": "init_audio", "choices": ["init_audio", "inpaint_audio"] }, { "name": "init_noise_level", "type": "slider", "label": "init_noise_level（init_audio 强度）", "default": 1, "minimum": 0, "maximum": 1, "step": 0.05 }];
const seed_vc = [{ "name": "route", "type": "choice", "label": "route（转换路径）", "default": "", "choices": ["", "v2_vc", "v1_whisper_bigvgan_vc", "v1_xlsr_hift_vc", "v1_svc"], "info": "留空=按任务默认" }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 30, "minimum": 1, "step": 1, "precision": 0, "info": "CFM 扩散步数" }, { "name": "length_adjust", "type": "slider", "label": "length_adjust（时长伸缩）", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "intelligibility_cfg_rate", "type": "slider", "label": "intelligibility_cfg_rate（仅 v2_vc）", "default": 0.7, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "similarity_cfg_rate", "type": "slider", "label": "similarity_cfg_rate（仅 v2_vc）", "default": 0.7, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "inference_cfg_rate", "type": "slider", "label": "inference_cfg_rate（仅 v1 路径）", "default": 0.7, "minimum": 0, "maximum": 1, "step": 0.05 }];
const rvc = [{ "name": "voice_id", "type": "choice", "label": "voice_id（打包音色）", "label_en": "voice_id", "default": "default", "choices": ["default", "manthos", "chocola", "fraise"] }, { "name": "voice_model_path", "type": "text", "label": "voice_model_path（自定义 RVC .pth/.pt）", "label_en": "voice_model_path", "default": "", "placeholder": "留空=使用打包音色" }, { "name": "retrieval_index_path", "type": "text", "label": "retrieval_index_path（FAISS index）", "label_en": "retrieval_index_path", "default": "", "placeholder": "可选 .index 路径" }, { "name": "retrieval_blend", "type": "slider", "label": "retrieval_blend", "default": 0, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "semitone_shift", "type": "number", "label": "semitone_shift（半音变调）", "label_en": "semitone_shift", "default": 0, "step": 1, "precision": 0 }, { "name": "pitch_filter_radius", "type": "number", "label": "pitch_filter_radius", "default": 3, "minimum": 0, "step": 1, "precision": 0 }, { "name": "output_sample_rate", "type": "number", "label": "output_sample_rate（0=跟随音色）", "label_en": "output_sample_rate (0 = voice default)", "default": 0, "minimum": 0, "step": 1e3, "precision": 0 }, { "name": "rms_mix_rate", "type": "slider", "label": "rms_mix_rate", "default": 0.25, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "unvoiced_protection", "type": "slider", "label": "unvoiced_protection", "default": 0.33, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "speaker_id", "type": "number", "label": "speaker_id", "default": 0, "minimum": 0, "step": 1, "precision": 0 }, { "name": "audio_pad_duration_sec", "type": "number", "label": "audio_pad_duration_sec", "default": 1, "minimum": 1, "step": 1, "precision": 0 }, { "name": "split_query_sec", "type": "number", "label": "split_query_sec", "default": 5, "minimum": 1, "step": 1, "precision": 0 }, { "name": "split_center_sec", "type": "number", "label": "split_center_sec", "default": 30, "minimum": 1, "step": 1, "precision": 0 }, { "name": "split_threshold_sec", "type": "number", "label": "split_threshold_sec", "default": 32, "minimum": 1, "step": 1, "precision": 0 }];
const meanvc2 = [{ "name": "seed", "type": "number", "label": "seed", "default": 42, "minimum": 0, "step": 1, "precision": 0 }];
const personaplex = [{ "name": "voice_id", "type": "choice", "label": "voice_id（打包音色）", "label_en": "voice_id (packaged voice)", "default": "NATF2", "choices": ["NATF0", "NATF1", "NATF2", "NATF3", "NATM0", "NATM1", "NATM2", "NATM3", "VARF0", "VARF1", "VARF2", "VARF3", "VARF4", "VARM0", "VARM1", "VARM2", "VARM3", "VARM4"] }, { "name": "system_prompt", "type": "text", "label": "system_prompt", "default": "", "placeholder": "Leave blank to use the text box as the system prompt." }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "text_temperature", "type": "slider", "label": "text_temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 250, "minimum": 0, "step": 1, "precision": 0 }, { "name": "text_top_k", "type": "number", "label": "text_top_k", "default": 250, "minimum": 0, "step": 1, "precision": 0 }, { "name": "do_sample", "type": "bool", "label": "do_sample", "default": true }];
const vevo2 = [{ "name": "route", "type": "choice", "label": "route（任务路线）", "default": "", "choices": ["", "style_preserved_vc", "style_converted_vc", "style_preserved_svc", "style_converted_svc", "singing_style_conversion", "editing"], "info": "留空=按任务默认；详见 webui/README.md" }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 32, "minimum": 1, "step": 1, "precision": 0, "info": "流匹配步数" }, { "name": "use_pitch_shift", "type": "choice", "label": "use_pitch_shift（自动音高对齐）", "default": "", "choices": ["", "true", "false"], "info": "留空=按路线默认" }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "audio_chunk_duration_sec（源音频分段秒数）", "default": 0, "minimum": 0, "step": 1, "info": "0=关闭；仅用于 source-audio VC/SVC 路线" }, { "name": "cross_fade_duration_sec", "type": "number", "label": "cross_fade_duration_sec（分段重叠/淡化秒数）", "default": 1, "minimum": 0, "step": 0.1, "info": "source-audio 分段启用时作为输入重叠和输出交叉淡化时长" }, { "name": "temperature", "type": "slider", "label": "temperature（AR 路线用）", "default": 0.7, "minimum": 0, "maximum": 2, "step": 0.05, "info": "默认取自模型 generation_config.json" }, { "name": "top_k", "type": "number", "label": "top_k（AR 路线用）", "default": 20, "minimum": 0, "step": 1, "precision": 0, "info": "默认取自模型 generation_config.json" }, { "name": "top_p", "type": "slider", "label": "top_p（AR 路线用）", "default": 0.8, "minimum": 0, "maximum": 1, "step": 0.01 }];
const heartmula = [{ "name": "tags", "type": "text", "label": "tags（逗号分隔）", "default": "pop", "placeholder": "pop,bright,drums,female vocals", "info": "风格/情绪/乐器/人声标签" }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 1, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 0, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale（MuLa CFG）", "default": 1.5, "minimum": 0, "maximum": 5, "step": 0.1 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps（codec 步数）", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "infinite_mode", "type": "bool", "label": "infinite_mode（长输出分段生成）", "default": false }, { "name": "codec_guidance_scale", "type": "slider", "label": "codec_guidance_scale", "default": 1.25, "minimum": 0, "maximum": 5, "step": 0.05 }];
const index_tts2 = [{ "name": "lang", "type": "choice", "label": "lang（语种提示, 仅 IndexTTS2.5 模型）", "label_en": "lang (language hint, IndexTTS2.5 models only)", "default": "auto", "choices": ["auto", "zh", "en", "ja", "es", "ar"], "info": "仅对 IndexTTS2.5（多语种）模型生效：auto 含汉字按中文，否则按英文；日/西/阿建议显式选择", "info_en": "Only applies to IndexTTS2.5 (multilingual) models: auto picks zh when the text contains Han characters, otherwise en; set ja/es/ar explicitly" }, { "name": "emotion_text", "type": "text", "label": "emotion_text（情绪参考文本）", "label_en": "emotion_text (emotion reference text)", "default": "", "placeholder": "例：你吓死我了！你是鬼吗？", "placeholder_en": "e.g. You scared me to death!", "info": "填写后自动开启情感条件（use_emotion_text）", "info_en": "Setting this enables emotion conditioning." }, { "name": "emotion_alpha", "type": "slider", "label": "emotion_alpha（情感强度）", "label_en": "emotion_alpha", "default": 1, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "use_emotion_text", "type": "bool", "label": "use_emotion_text（从朗读文本推断情感）", "label_en": "use_emotion_text (infer from text)", "default": false }, { "name": "use_random_emotion", "type": "bool", "label": "use_random_emotion（随机情感）", "label_en": "use_random_emotion", "default": false }, { "name": "interval_silence_ms", "type": "number", "label": "interval_silence_ms（分段间静音）", "label_en": "interval_silence_ms", "default": 200, "minimum": 0, "step": 50, "precision": 0 }, { "name": "duration_factor", "type": "slider", "label": "duration_factor（语速/时长倍率，>1 更慢，<1 更快）", "label_en": "duration_factor (duration multiplier; >1 slower, <1 faster)", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05, "info": "对齐官方 IndexTTS2.5 的 duration_factor：缩放输出时长，不改变音色/内容", "info_en": "Matches official IndexTTS2.5 duration_factor: scales output duration without changing timbre or content" }];
const zipvoice = [{ "name": "guidance_scale", "type": "slider", "label": "guidance_scale（引导强度，0=关闭）", "label_en": "guidance_scale (0 disables CFG)", "default": 3, "minimum": 0, "maximum": 10, "step": 0.5 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps（Euler 步数）", "label_en": "num_inference_steps", "default": 8, "minimum": 1, "maximum": 64, "step": 1, "precision": 0 }, { "name": "t_shift", "type": "slider", "label": "t_shift（时间步偏移，越小越偏低 SNR）", "label_en": "t_shift (timestep shift)", "default": 0.5, "minimum": 0.05, "maximum": 1, "step": 0.05 }, { "name": "speed", "type": "slider", "label": "speed（语速倍率）", "label_en": "speed (duration multiplier)", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "lang", "type": "text", "label": "lang（英文段 espeak 语言）", "label_en": "lang (espeak voice for English runs)", "default": "en-us", "placeholder": "en-us" }];
const irodori_tts = [{ "name": "num_inference_steps", "type": "number", "label": "num_inference_steps（RF 扩散步数）", "label_en": "num_inference_steps", "default": 40, "minimum": 1, "step": 1, "precision": 0 }, { "name": "duration_sec", "type": "number", "label": "duration_sec（0=模型自动预测时长）", "label_en": "duration_sec (0 = auto)", "default": 0, "minimum": 0, "step": 0.5 }, { "name": "duration_scale", "type": "slider", "label": "duration_scale（语速倒数，越大越慢）", "label_en": "duration_scale", "default": 1, "minimum": 0.5, "maximum": 2, "step": 0.05 }];
const moss_tts_local = [{ "name": "do_sample", "type": "bool", "label": "do_sample", "default": true }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 1.7, "minimum": 0, "maximum": 2.5, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 0.8, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 25, "minimum": 0, "step": 1, "precision": 0 }, { "name": "repetition_penalty", "type": "slider", "label": "repetition_penalty", "default": 1, "minimum": 1, "maximum": 2, "step": 0.01 }];
const moss_tts_v15 = [{ "name": "instruct", "type": "text", "label": "instruct（音色描述）", "label_en": "instruct (voice description)", "default": "", "placeholder": "参考音频比文字描述更可靠", "placeholder_en": "A reference recording is more reliable than a description." }, { "name": "language", "type": "choice", "label": "language（语言）", "label_en": "language", "default": "", "choices": ["", "English", "Chinese"] }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 1.5, "minimum": 0, "maximum": 3, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 0.6, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 0, "step": 1, "precision": 0 }, { "name": "repetition_penalty", "type": "slider", "label": "repetition_penalty", "default": 1.1, "minimum": 1, "maximum": 2, "step": 0.01 }];
const moss_tts_nano = [{ "name": "do_sample", "type": "bool", "label": "do_sample", "default": true }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 1.7, "minimum": 0, "maximum": 2.5, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 0.8, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 25, "minimum": 0, "step": 1, "precision": 0 }, { "name": "repetition_penalty", "type": "slider", "label": "repetition_penalty", "default": 1, "minimum": 1, "maximum": 2, "step": 0.01 }];
const audiosr = [{ "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 50, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 3.5, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "ddim_eta", "type": "slider", "label": "ddim_eta", "default": 1, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "audio_chunk_duration_sec", "type": "number", "label": "audio_chunk_duration_sec", "default": 15, "minimum": 1, "step": 1 }, { "name": "audio_chunk_overlap_sec", "type": "number", "label": "audio_chunk_overlap_sec", "default": 2, "minimum": 0, "step": 0.5 }];
const controlfoley = [{ "name": "duration_sec", "type": "number", "label": "duration_sec", "default": 8, "minimum": 0.1, "step": 0.5 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 25, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 4.5, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "negative_prompt", "type": "text", "label": "negative_prompt", "default": "", "placeholder": "optional negative prompt" }, { "name": "mask_away_clip", "type": "bool", "label": "mask_away_clip", "default": false }];
const midashenglm_gen = [{ "name": "duration_sec", "type": "number", "label": "duration_sec", "default": 20, "minimum": 0.1, "step": 0.5 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "stop_threshold", "type": "slider", "label": "stop_threshold", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "min_stop_step", "type": "number", "label": "min_stop_step", "default": 5, "minimum": 0, "step": 1, "precision": 0 }];
const sopro_tts = [{ "name": "language", "type": "choice", "label": "language", "label_en": "Language tag", "default": "", "choices": ["", "en", "pt", "fr", "de"], "info": "Optional <|lang_xx|> tag; helps pronunciation on ambiguous text." }, { "name": "temperature", "type": "slider", "label": "temperature", "label_en": "Temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "top_p", "label_en": "Top-p", "default": 0.9, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "top_k", "label_en": "Top-k", "default": 25, "minimum": 0, "step": 1, "precision": 0, "info": "0 disables top-k truncation." }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "label_en": "Acoustic steps", "default": 2, "minimum": 1, "maximum": 32, "step": 1, "precision": 0, "info": "Rectified-flow Euler steps for the acoustic head." }, { "name": "max_seconds", "type": "number", "label": "max_seconds", "label_en": "Max seconds per segment", "default": 30, "minimum": 1, "maximum": 60, "step": 0.5, "precision": 1 }, { "name": "min_seconds", "type": "number", "label": "min_seconds", "label_en": "Min seconds per segment", "default": 0.4, "minimum": 0, "maximum": 10, "step": 0.1, "precision": 1, "info": "Must not exceed max_seconds." }, { "name": "ref_seconds", "type": "number", "label": "ref_seconds", "label_en": "Reference seconds", "default": 10, "minimum": 1, "maximum": 30, "step": 0.5, "precision": 1, "info": "Reference window used for cloning." }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "label_en": "Segment size", "default": 300, "minimum": 20, "maximum": 2e3, "step": 10, "precision": 0, "info": "Max codepoints per synthesis segment." }];
const supertonic = [{ "name": "voice", "type": "choice", "label": "voice（预置音色：M 男声 / F 女声）", "label_en": "voice (M = male, F = female presets)", "default": "M1", "choices": ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"] }, { "name": "speaking_rate", "type": "slider", "label": "speaking_rate（语速倍率）", "label_en": "speaking_rate", "default": 1.05, "minimum": 0.5, "maximum": 2, "step": 0.05 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps（流匹配步数）", "label_en": "num_inference_steps", "default": 8, "minimum": 1, "step": 1, "precision": 0 }];
const audio8_tts = [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 0.7, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 0.9, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 0, "step": 1, "precision": 0 }, { "name": "max_tokens", "type": "number", "label": "max_tokens", "default": 1024, "minimum": 1, "step": 1, "precision": 0 }];
const rawParams = {
  bluemagpie,
  ming3_tts,
  ming3_audio,
  xtts_v2,
  latentsync,
  ast_audioset,
  ced,
  fish_drama3,
  firered_vad,
  hviske_asr_v6,
  micro_wake_word,
  open_wake_word,
  plapre,
  mossformer2,
  sherpa_kws,
  tf_gridnet,
  voxtral_tts,
  kugelaudio,
  crisperwhisper,
  index_echo,
  audio_flamingo,
  owsm,
  owsm_ctc,
  reuse,
  smart_turn,
  maya1,
  gigaam_asr,
  samsone,
  sam_audio,
  tone_color_vc,
  moss_ttsd,
  moss_voicegen,
  nemotron_asr,
  canary_asr,
  cohere_asr,
  moss_transcribe_diarize,
  apollo,
  universr,
  liveavatar,
  pulsevad,
  echo_tts,
  _comment,
  qwen3_tts,
  vibevoice,
  voxcpm2,
  voxcpm1,
  miotts,
  chatterbox,
  "chatterbox-vc": [{ "name": "s3gen_cfg_rate", "type": "slider", "label": "s3gen_cfg_rate（音色引导强度）", "label_en": "s3gen_cfg_rate (voice guidance)", "default": 0.7, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps（生成步数）", "label_en": "num_inference_steps", "default": 10, "minimum": 1, "maximum": 100, "step": 1, "precision": 0 }],
  kokoro_tts,
  kitten_tts,
  piper_tts,
  omnivoice,
  sense_asr,
  "lfm2-audio-tts": [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Audio code sampling temperature; 0 is greedy." }, { "name": "top_k", "type": "number", "label": "top_k", "default": 64, "minimum": 0, "step": 1, "precision": 0 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 200, "minimum": 32, "step": 1, "precision": 0, "info_en": "Codepoints of text per spoken turn." }],
  "lfm2-audio-jp-tts": [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 0.8, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Audio code sampling temperature; 0 is greedy." }, { "name": "top_k", "type": "number", "label": "top_k", "default": 64, "minimum": 0, "step": 1, "precision": 0 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 200, "minimum": 32, "step": 1, "precision": 0, "info_en": "Codepoints of text per spoken turn." }],
  "lfm2-audio-s2s": [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 1, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Audio code sampling temperature; 0 is greedy." }, { "name": "top_k", "type": "number", "label": "top_k", "default": 4, "minimum": 0, "step": 1, "precision": 0 }, { "name": "text_temperature", "type": "slider", "label": "text_temperature", "default": 0, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Text token sampling temperature; 0 picks the most likely token, as liquid-audio does." }, { "name": "text_top_k", "type": "number", "label": "text_top_k", "default": 0, "minimum": 0, "step": 1, "precision": 0, "info_en": "With text_temperature above 0, sample text tokens from the k most likely; 0 keeps all." }],
  "lfm2-audio-jp-s2s": [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 1, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Audio code sampling temperature; 0 is greedy." }, { "name": "top_k", "type": "number", "label": "top_k", "default": 4, "minimum": 0, "step": 1, "precision": 0 }, { "name": "text_temperature", "type": "slider", "label": "text_temperature", "default": 0, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Text token sampling temperature; 0 picks the most likely token, as liquid-audio does." }, { "name": "text_top_k", "type": "number", "label": "text_top_k", "default": 0, "minimum": 0, "step": 1, "precision": 0, "info_en": "With text_temperature above 0, sample text tokens from the k most likely; 0 keeps all." }],
  lfm2_audio,
  "lfm3-audio-tts": [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 1, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Audio code temperature; 0 picks the most likely code." }, { "name": "top_k", "type": "number", "label": "top_k", "default": 128, "minimum": 0, "step": 1, "precision": 0, "info_en": "Sample audio codes from the k most likely; 0 keeps all." }, { "name": "repetition_penalty", "type": "number", "label": "repetition_penalty", "default": 1.1, "minimum": 0.01, "step": 0.05, "info_en": "Audio repetition penalty over the last 4096 frames of each codebook; must be positive, 1 disables it." }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 200, "minimum": 1, "step": 1, "precision": 0, "info_en": "Target characters per text chunk; each chunk is its own spoken turn." }],
  "lfm3-audio-s2s": [{ "name": "temperature", "type": "slider", "label": "temperature", "default": 1, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Audio code temperature; 0 picks the most likely code." }, { "name": "top_k", "type": "number", "label": "top_k", "default": 128, "minimum": 0, "step": 1, "precision": 0, "info_en": "Sample audio codes from the k most likely; 0 keeps all." }, { "name": "repetition_penalty", "type": "number", "label": "repetition_penalty", "default": 1.1, "minimum": 0.01, "step": 0.05, "info_en": "Audio repetition penalty over the last 4096 frames of each codebook; must be positive, 1 disables it." }, { "name": "text_temperature", "type": "slider", "label": "text_temperature", "default": 0, "minimum": 0, "maximum": 2, "step": 0.05, "info_en": "Text token temperature; 0 is greedy." }, { "name": "text_top_k", "type": "number", "label": "text_top_k", "default": 0, "minimum": 0, "step": 1, "precision": 0, "info_en": "Sample text tokens from the k most likely; 0 keeps all." }, { "name": "max_audio_tail_frames", "type": "number", "label": "max_audio_tail_frames", "default": 375, "minimum": 0, "step": 1, "precision": 0, "info_en": "Most audio frames after the reply text ends before the turn is closed with an end-of-audio frame; 0 disables the cap." }],
  lfm3_audio,
  confucius4_r2t2,
  pocket_tts,
  gradium_phonon,
  neutts,
  magpie_tts,
  breeze_tts,
  "breeze-tts": [{ "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 600, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 1, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.9, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "depth_temperature", "type": "slider", "label": "depth_temperature", "default": 0.9, "minimum": 0, "maximum": 2, "step": 0.05 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 50, "minimum": 0, "step": 1, "precision": 0 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 1, "minimum": 0, "maximum": 1, "step": 0.01 }],
  cosyvoice3,
  inflect_v2,
  sanotts,
  dramabox,
  confucius4_tts,
  ace_step,
  minimax_music3,
  auk,
  yue2,
  minimax_h3,
  stable_audio,
  seed_vc,
  rvc,
  meanvc2,
  personaplex,
  vevo2,
  heartmula,
  index_tts2,
  zipvoice,
  irodori_tts,
  moss_tts_local,
  moss_tts_v15,
  moss_tts_nano,
  audiosr,
  controlfoley,
  midashenglm_gen,
  "fireredtts3-base": [{ "name": "language", "type": "choice", "label": "language", "default": "Chinese", "choices": ["Chinese", "English", "Cantonese", "Japanese", "Korean", "Spanish", "French", "Russian", "Arabic", "Turkish", "Indonesian", "Portuguese", "Italian", "Dutch", "Vietnamese", "German", "Ukrainian", "Thai", "Polish", "Romanian", "Greek", "Czech", "Finnish", "Hindi", "ZH_Anhui", "ZH_Fujian", "ZH_Gansu", "ZH_Guizhou", "ZH_Hebei", "ZH_Henan", "ZH_Hubei", "ZH_Hunan", "ZH_Jiangxi", "ZH_Liaoning", "ZH_Minnan", "ZH_Ningxia", "ZH_Shaanxi", "ZH_Shandong", "ZH_Shanghai", "ZH_Shanxi", "ZH_Sichuan", "ZH_Tianjin", "ZH_Wenzhou", "ZH_Wu", "ZH_Yunnan"] }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "stop_threshold", "type": "slider", "label": "stop_threshold", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.05 }],
  "fireredtts3-instruct": [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "instruct_tts", "choices": ["instruct_tts"] }, { "name": "language", "type": "choice", "label": "language", "default": "Chinese", "choices": ["Chinese", "English", "Cantonese", "Japanese", "Korean", "Spanish", "French", "Russian", "Arabic", "Turkish", "Indonesian", "Portuguese", "Italian", "Dutch", "Vietnamese", "German", "Ukrainian", "Thai", "Polish", "Romanian", "Greek", "Czech", "Finnish", "Hindi", "ZH_Anhui", "ZH_Fujian", "ZH_Gansu", "ZH_Guizhou", "ZH_Hebei", "ZH_Henan", "ZH_Hubei", "ZH_Hunan", "ZH_Jiangxi", "ZH_Liaoning", "ZH_Minnan", "ZH_Ningxia", "ZH_Shaanxi", "ZH_Shandong", "ZH_Shanghai", "ZH_Shanxi", "ZH_Tianjin", "ZH_Wenzhou", "ZH_Wu", "ZH_Yunnan"] }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "stop_threshold", "type": "slider", "label": "stop_threshold", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.05 }, { "name": "text_chunk_size", "type": "number", "label": "text_chunk_size", "default": 600, "minimum": 1, "step": 1, "precision": 0 }, { "name": "text_chunk_mode", "type": "choice", "label": "text_chunk_mode", "default": "default", "choices": ["default", "tag_aware", "japanese", "endline"] }],
  "fireredtts3-instruct-vdesign": [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "voice_design", "choices": ["voice_design"] }, { "name": "language", "type": "choice", "label": "language", "default": "Chinese", "choices": ["Chinese", "English", "Cantonese", "Japanese", "Korean", "Spanish", "French", "Russian", "Arabic", "Turkish", "Indonesian", "Portuguese", "Italian", "Dutch", "Vietnamese", "German", "Ukrainian", "Thai", "Polish", "Romanian", "Greek", "Czech", "Finnish", "Hindi", "ZH_Anhui", "ZH_Fujian", "ZH_Gansu", "ZH_Guizhou", "ZH_Hebei", "ZH_Henan", "ZH_Hubei", "ZH_Hunan", "ZH_Jiangxi", "ZH_Liaoning", "ZH_Minnan", "ZH_Ningxia", "ZH_Shaanxi", "ZH_Shandong", "ZH_Shanghai", "ZH_Shanxi", "ZH_Tianjin", "ZH_Wenzhou", "ZH_Wu", "ZH_Yunnan"] }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "stop_threshold", "type": "slider", "label": "stop_threshold", "default": 0.5, "minimum": 0, "maximum": 1, "step": 0.05 }],
  "firered-audio-tts": [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "tts_clone", "choices": ["tts_clone"] }, { "name": "language", "type": "choice", "label": "language", "default": "zh", "choices": ["zh", "en"] }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "max_new_audio_steps", "type": "number", "label": "max_new_audio_steps", "default": 750, "minimum": 1, "step": 1, "precision": 0 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 20, "minimum": 0, "step": 1, "precision": 0 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 0.8, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.7, "minimum": 0, "maximum": 2, "step": 0.05 }],
  "firered-audio-vdesign": [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "voice_design", "choices": ["voice_design"] }, { "name": "language", "type": "choice", "label": "language", "default": "zh", "choices": ["zh", "en"] }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "max_new_audio_steps", "type": "number", "label": "max_new_audio_steps", "default": 750, "minimum": 1, "step": 1, "precision": 0 }],
  "firered-audio-semantic-edit": [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "semantic_edit", "choices": ["semantic_edit"] }, { "name": "language", "type": "choice", "label": "language", "default": "zh", "choices": ["zh", "en"] }, { "name": "instruction", "type": "text", "label": "instruction", "default": "", "placeholder": "delete '比普通的茶叶要'" }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "max_new_audio_steps", "type": "number", "label": "max_new_audio_steps", "default": 750, "minimum": 1, "step": 1, "precision": 0 }, { "name": "max_new_text_tokens", "type": "number", "label": "max_new_text_tokens", "default": 512, "minimum": 1, "step": 1, "precision": 0 }],
  "firered-audio-acoustic-edit": [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "acoustic_edit", "choices": ["acoustic_edit"] }, { "name": "language", "type": "choice", "label": "language", "default": "zh", "choices": ["zh", "en"] }, { "name": "instruction", "type": "text", "label": "instruction", "default": "shift the pitch by 3 steps", "placeholder": "shift the pitch by 3 steps" }, { "name": "num_inference_steps", "type": "number", "label": "num_inference_steps", "default": 10, "minimum": 1, "step": 1, "precision": 0 }, { "name": "guidance_scale", "type": "slider", "label": "guidance_scale", "default": 2, "minimum": 0, "maximum": 10, "step": 0.1 }, { "name": "max_new_audio_steps", "type": "number", "label": "max_new_audio_steps", "default": 750, "minimum": 1, "step": 1, "precision": 0 }],
  "firered-audio-asr": [{ "name": "template_name", "type": "choice", "label": "template_name", "default": "asr", "choices": ["asr", "understand"] }, { "name": "language", "type": "choice", "label": "language", "default": "zh", "choices": ["zh", "en"] }, { "name": "enable_thinking", "type": "bool", "label": "enable_thinking", "default": false }, { "name": "max_new_tokens", "type": "number", "label": "max_new_tokens", "default": 512, "minimum": 1, "step": 1, "precision": 0 }, { "name": "top_k", "type": "number", "label": "top_k", "default": 20, "minimum": 0, "step": 1, "precision": 0 }, { "name": "top_p", "type": "slider", "label": "top_p", "default": 0.8, "minimum": 0, "maximum": 1, "step": 0.01 }, { "name": "temperature", "type": "slider", "label": "temperature", "default": 0.7, "minimum": 0, "maximum": 2, "step": 0.05 }],
  sopro_tts,
  supertonic,
  audio8_tts
};
const specModules = /* @__PURE__ */ Object.assign({
  "../../../../model_specs/ace_step.json": __vite_glob_0_0,
  "../../../../model_specs/apollo.json": __vite_glob_0_1,
  "../../../../model_specs/ast_audioset.json": __vite_glob_0_2,
  "../../../../model_specs/audio8_asr.json": __vite_glob_0_3,
  "../../../../model_specs/audio8_tts.json": __vite_glob_0_4,
  "../../../../model_specs/audio_flamingo.json": __vite_glob_0_5,
  "../../../../model_specs/audiosr.json": __vite_glob_0_6,
  "../../../../model_specs/auk.json": __vite_glob_0_7,
  "../../../../model_specs/bluemagpie.json": __vite_glob_0_8,
  "../../../../model_specs/breeze_tts.json": __vite_glob_0_9,
  "../../../../model_specs/bs_roformer.json": __vite_glob_0_10,
  "../../../../model_specs/builtin_audio_utils.json": __vite_glob_0_11,
  "../../../../model_specs/canary_asr.json": __vite_glob_0_12,
  "../../../../model_specs/ced.json": __vite_glob_0_13,
  "../../../../model_specs/chatterbox.json": __vite_glob_0_14,
  "../../../../model_specs/chatterbox_turbo.json": __vite_glob_0_15,
  "../../../../model_specs/citrinet_asr.json": __vite_glob_0_16,
  "../../../../model_specs/cohere_asr.json": __vite_glob_0_17,
  "../../../../model_specs/confucius4_r2t2.json": __vite_glob_0_18,
  "../../../../model_specs/confucius4_tts.json": __vite_glob_0_19,
  "../../../../model_specs/controlfoley.json": __vite_glob_0_20,
  "../../../../model_specs/cosyvoice3.json": __vite_glob_0_21,
  "../../../../model_specs/crisperwhisper.json": __vite_glob_0_22,
  "../../../../model_specs/dots_tts.json": __vite_glob_0_23,
  "../../../../model_specs/dramabox.json": __vite_glob_0_24,
  "../../../../model_specs/echo_tts.json": __vite_glob_0_25,
  "../../../../model_specs/f5_tts.json": __vite_glob_0_26,
  "../../../../model_specs/firered_audio.json": __vite_glob_0_27,
  "../../../../model_specs/firered_vad.json": __vite_glob_0_28,
  "../../../../model_specs/fireredtts3.json": __vite_glob_0_29,
  "../../../../model_specs/fish_audio.json": __vite_glob_0_30,
  "../../../../model_specs/fish_drama3.json": __vite_glob_0_31,
  "../../../../model_specs/fun_asr_nano.json": __vite_glob_0_32,
  "../../../../model_specs/gigaam_asr.json": __vite_glob_0_33,
  "../../../../model_specs/glm_tts.json": __vite_glob_0_34,
  "../../../../model_specs/gradium_phonon.json": __vite_glob_0_35,
  "../../../../model_specs/granite5asr.json": __vite_glob_0_36,
  "../../../../model_specs/heartmula.json": __vite_glob_0_37,
  "../../../../model_specs/higgs_audio_stt.json": __vite_glob_0_38,
  "../../../../model_specs/higgs_audio_tts.json": __vite_glob_0_39,
  "../../../../model_specs/htdemucs.json": __vite_glob_0_40,
  "../../../../model_specs/htdemucs_6stems.json": __vite_glob_0_41,
  "../../../../model_specs/hviske_asr.json": __vite_glob_0_42,
  "../../../../model_specs/hviske_asr_v6.json": __vite_glob_0_43,
  "../../../../model_specs/index_echo.json": __vite_glob_0_44,
  "../../../../model_specs/index_tts2.json": __vite_glob_0_45,
  "../../../../model_specs/inflect_v2.json": __vite_glob_0_46,
  "../../../../model_specs/irodori_tts.json": __vite_glob_0_47,
  "../../../../model_specs/kitten_tts.json": __vite_glob_0_48,
  "../../../../model_specs/kitten_tts2.json": __vite_glob_0_49,
  "../../../../model_specs/kokoro_tts.json": __vite_glob_0_50,
  "../../../../model_specs/kroko_asr.json": __vite_glob_0_51,
  "../../../../model_specs/kugelaudio.json": __vite_glob_0_52,
  "../../../../model_specs/latentsync.json": __vite_glob_0_53,
  "../../../../model_specs/lfm2_audio.json": __vite_glob_0_54,
  "../../../../model_specs/lfm3_audio.json": __vite_glob_0_55,
  "../../../../model_specs/liveavatar.json": __vite_glob_0_56,
  "../../../../model_specs/magenta_realtime_2.json": __vite_glob_0_57,
  "../../../../model_specs/magpie_tts.json": __vite_glob_0_58,
  "../../../../model_specs/maya1.json": __vite_glob_0_59,
  "../../../../model_specs/meanvc2.json": __vite_glob_0_60,
  "../../../../model_specs/mel_band_roformer.json": __vite_glob_0_61,
  "../../../../model_specs/micro_wake_word.json": __vite_glob_0_62,
  "../../../../model_specs/midashenglm_gen.json": __vite_glob_0_63,
  "../../../../model_specs/ming3_audio.json": __vite_glob_0_64,
  "../../../../model_specs/ming3_tts.json": __vite_glob_0_65,
  "../../../../model_specs/minimax_h3.json": __vite_glob_0_66,
  "../../../../model_specs/minimax_music3.json": __vite_glob_0_67,
  "../../../../model_specs/miocodec.json": __vite_glob_0_68,
  "../../../../model_specs/miotts.json": __vite_glob_0_69,
  "../../../../model_specs/mira_tts.json": __vite_glob_0_70,
  "../../../../model_specs/mms_forced_aligner.json": __vite_glob_0_71,
  "../../../../model_specs/moonshine_asr.json": __vite_glob_0_72,
  "../../../../model_specs/moss_transcribe_diarize.json": __vite_glob_0_73,
  "../../../../model_specs/moss_tts_local.json": __vite_glob_0_74,
  "../../../../model_specs/moss_tts_nano.json": __vite_glob_0_75,
  "../../../../model_specs/moss_tts_v15.json": __vite_glob_0_76,
  "../../../../model_specs/moss_ttsd.json": __vite_glob_0_77,
  "../../../../model_specs/moss_voicegen.json": __vite_glob_0_78,
  "../../../../model_specs/mossformer2.json": __vite_glob_0_79,
  "../../../../model_specs/muscriptor.json": __vite_glob_0_80,
  "../../../../model_specs/nemotron_3_diar.json": __vite_glob_0_81,
  "../../../../model_specs/nemotron_asr.json": __vite_glob_0_82,
  "../../../../model_specs/nemotron_transcribe.json": __vite_glob_0_83,
  "../../../../model_specs/neutts.json": __vite_glob_0_84,
  "../../../../model_specs/niagara_asr.json": __vite_glob_0_85,
  "../../../../model_specs/omnivoice.json": __vite_glob_0_86,
  "../../../../model_specs/open_wake_word.json": __vite_glob_0_87,
  "../../../../model_specs/outetts.json": __vite_glob_0_88,
  "../../../../model_specs/owsm.json": __vite_glob_0_89,
  "../../../../model_specs/owsm_ctc.json": __vite_glob_0_90,
  "../../../../model_specs/parakeet_tdt.json": __vite_glob_0_91,
  "../../../../model_specs/personaplex.json": __vite_glob_0_92,
  "../../../../model_specs/piper_tts.json": __vite_glob_0_93,
  "../../../../model_specs/plapre.json": __vite_glob_0_94,
  "../../../../model_specs/pocket_tts.json": __vite_glob_0_95,
  "../../../../model_specs/pulsevad.json": __vite_glob_0_96,
  "../../../../model_specs/qwen3_asr.json": __vite_glob_0_97,
  "../../../../model_specs/qwen3_forced_aligner.json": __vite_glob_0_98,
  "../../../../model_specs/qwen3_tts.json": __vite_glob_0_99,
  "../../../../model_specs/reuse.json": __vite_glob_0_100,
  "../../../../model_specs/rvc.json": __vite_glob_0_101,
  "../../../../model_specs/sam_audio.json": __vite_glob_0_102,
  "../../../../model_specs/samsone.json": __vite_glob_0_103,
  "../../../../model_specs/sanotts.json": __vite_glob_0_104,
  "../../../../model_specs/seed_vc.json": __vite_glob_0_105,
  "../../../../model_specs/sense_asr.json": __vite_glob_0_106,
  "../../../../model_specs/sheetsage2.json": __vite_glob_0_107,
  "../../../../model_specs/sherpa_kws.json": __vite_glob_0_108,
  "../../../../model_specs/sidon.json": __vite_glob_0_109,
  "../../../../model_specs/smart_turn.json": __vite_glob_0_110,
  "../../../../model_specs/soprano_tts.json": __vite_glob_0_111,
  "../../../../model_specs/sopro_tts.json": __vite_glob_0_112,
  "../../../../model_specs/sortformer_diar.json": __vite_glob_0_113,
  "../../../../model_specs/sortformer_diar_v2.json": __vite_glob_0_114,
  "../../../../model_specs/stable_audio.json": __vite_glob_0_115,
  "../../../../model_specs/supertonic.json": __vite_glob_0_116,
  "../../../../model_specs/tf_gridnet.json": __vite_glob_0_117,
  "../../../../model_specs/tone_color_vc.json": __vite_glob_0_118,
  "../../../../model_specs/universr.json": __vite_glob_0_119,
  "../../../../model_specs/vevo2.json": __vite_glob_0_120,
  "../../../../model_specs/vibeasr.json": __vite_glob_0_121,
  "../../../../model_specs/vibevoice.json": __vite_glob_0_122,
  "../../../../model_specs/vibevoice_asr.json": __vite_glob_0_123,
  "../../../../model_specs/vibevoice_asr_streaming.json": __vite_glob_0_124,
  "../../../../model_specs/vieneu_v3_turbo.json": __vite_glob_0_125,
  "../../../../model_specs/voxcpm1.json": __vite_glob_0_126,
  "../../../../model_specs/voxcpm2.json": __vite_glob_0_127,
  "../../../../model_specs/voxtral_realtime.json": __vite_glob_0_128,
  "../../../../model_specs/voxtral_tts.json": __vite_glob_0_129,
  "../../../../model_specs/whistle_asr.json": __vite_glob_0_130,
  "../../../../model_specs/xtts_v2.json": __vite_glob_0_131,
  "../../../../model_specs/yue2.json": __vite_glob_0_132,
  "../../../../model_specs/zipvoice.json": __vite_glob_0_133
});
const packages = Object.values(specModules).flatMap(
  (spec) => (spec.packages || []).map((entry) => ({ ...entry, family: spec.family }))
);
const specsByFamily = new Map(Object.values(specModules).map((spec) => [spec.family, spec]));
const modelModes = Object.fromEntries(Object.values(specModules).map((spec) => [spec.family, spec.modes || []]));
const modelCapabilities = Object.fromEntries(Object.values(specModules).map((spec) => [spec.family, [...new Set(Object.values(spec.capabilities || {}).flat())]]));
const exposeAllGgufPackageFamilies = /* @__PURE__ */ new Set([
  "ming3_tts",
  "ming3_audio",
  "latentsync",
  "xtts_v2",
  "canary_asr",
  "cohere_asr",
  "moss_transcribe_diarize",
  "confucius4_r2t2",
  "audiosr",
  "controlfoley",
  "breeze_tts",
  "cosyvoice3",
  "firered_audio",
  "fireredtts3",
  "irodori_tts",
  "kitten_tts2",
  "kokoro_tts",
  "meanvc2",
  "midashenglm_gen",
  "sanotts",
  "mossformer2",
  "plapre",
  "voxtral_tts"
]);
const hanCharacters = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
function englishUiText(preferred, fallback) {
  for (const value of [preferred, fallback]) {
    if (value && !hanCharacters.test(value)) return value;
  }
  return "";
}
function parameterLabel(name, preferred, fallback) {
  return englishUiText(preferred, fallback) || name.replace(/_/g, " ");
}
const cleanPath = (value) => value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^models\//i, "").replace(/\/$/, "").toLowerCase();
const cleanId = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function preferredPackage(entries) {
  return entries.find((entry) => entry.default) || entries.find((entry) => entry.precision === "q8_0") || entries[0];
}
function relatedPackages(entry) {
  const family2 = packages.filter((candidate) => candidate.family === entry.family);
  if (!family2.length) return [];
  if (entry.family === "bluemagpie") return family2;
  if (entry.family === "ace_step" || entry.family === "minimax_music3") return family2;
  if (!entry.download_id) return family2;
  const exact = family2.find((candidate) => candidate.id === entry.download_id);
  if (exact) {
    const stem = exact.id.replace(/_(?:q8_0|q8|f16|fp16|bf16|safetensors|orig)$/i, "");
    const matches = family2.filter((candidate) => candidate.id.replace(/_(?:q8_0|q8|f16|fp16|bf16|safetensors|orig)$/i, "") === stem);
    return matches.length ? matches : [exact];
  }
  const legacyId = cleanId(entry.download_id);
  const legacyMatches = family2.filter((candidate) => {
    const currentId = cleanId(candidate.id);
    return currentId.startsWith(legacyId) || legacyId.startsWith(currentId);
  });
  if (legacyMatches.length) return legacyMatches;
  const target = cleanPath(entry.path);
  const targetMatches = family2.filter((candidate) => cleanPath(candidate.target_directory) === target);
  if (targetMatches.length) {
    const stems = new Set(targetMatches.map((candidate) => candidate.id.replace(/_(?:q8_0|q8|f16|fp16|bf16|safetensors|orig)$/i, "")));
    const matches = family2.filter((candidate) => stems.has(
      candidate.id.replace(/_(?:q8_0|q8|f16|fp16|bf16|safetensors|orig)$/i, "")
    ));
    return matches.length ? matches : targetMatches;
  }
  return family2;
}
function relatedExposeAllGgufPackages(entry) {
  const family2 = packages.filter((candidate) => candidate.family === entry.family && candidate.format === "gguf");
  if (!family2.length) return [];
  if (entry.family === "sanotts" || entry.family === "xtts_v2") return family2;
  if (!entry.download_id) return family2;
  const exact = family2.find((candidate) => candidate.id === entry.download_id);
  if (!exact) return relatedPackages(entry);
  const matches = family2.filter((candidate) => candidate.target_directory === exact.target_directory);
  return matches.length ? matches : [exact];
}
function exposedPackageRank(entry, selectedId) {
  if (selectedId && entry.id === selectedId) return 0;
  if (entry.default) return 1;
  if (["q4_k", "q4_0", "q8_0", "q8"].includes(entry.precision)) return 2;
  if (["f16", "fp16", "bf16"].includes(entry.precision)) return 3;
  if (entry.precision === "f32") return 4;
  if (entry.precision === "orig") return 5;
  return 6;
}
function packageLabel(entry) {
  if (entry.family === "sanotts") {
    if (entry.id.includes("_heart_nano_")) return "Heart Nano";
    if (entry.id.includes("_heart_")) return "Heart";
    if (entry.id.includes("_amy_")) return "Amy";
    if (entry.id.includes("_hfc_")) return "HFC";
    if (entry.id.includes("_kristin_")) return "Kristin";
    if (entry.id.includes("_vi_")) return "Vietnamese";
    if (entry.id.includes("_id_")) return "Indonesian";
    if (entry.id.includes("_cs_")) return "Czech";
    if (entry.id.includes("_de_")) return "German";
    if (entry.id.includes("_es_")) return "Spanish";
    if (entry.id.includes("_fr_")) return "French";
    if (entry.id.includes("_it_")) return "Italian";
    if (entry.id.includes("_pt_")) return "Portuguese (Brazil)";
    if (entry.id.includes("_ro_")) return "Romanian";
    if (entry.id.includes("_ru_")) return "Russian";
    if (entry.id.includes("_tr_")) return "Turkish";
    if (entry.id.includes("_ne_")) return "Nepali";
    if (entry.id.includes("_hi_")) return "Hindi";
  }
  if (entry.family === "ace_step") {
    const precision = entry.precision === "bf16" ? "BF16" : ["q8_0", "q8"].includes(entry.precision) ? "Q8" : entry.precision.toUpperCase();
    if (entry.id.includes("_xl_turbo_")) return `GGUF Turbo XL ${precision}`;
    if (entry.id.includes("_xl_sft_")) return `GGUF Turbo XL SFT ${precision}`;
    if (entry.id.includes("_turbo_")) return `GGUF Turbo ${precision}`;
    return `GGUF ${precision}`;
  }
  if (entry.family === "irodori_tts" && entry.id.includes("_anime_")) return "Anime Q8";
  if (entry.family === "yue2") {
    if (entry.id === "yue2_main_q8_0") return "Main Q8_0";
    if (entry.id === "yue2_main_q4_0") return "Main Q4_0";
    if (entry.id === "yue2_main_bf16") return "Main BF16";
    if (entry.id === "yue2_vae_f16") return "VAE F16";
    if (entry.id === "yue2_vae_f32") return "VAE F32";
    return entry.display_name || "Yue2 component";
  }
  if (entry.family === "auk") {
    if (entry.id === "auk_base_f32") return "Base F32";
    if (entry.id === "auk_base_f16") return "Base F16";
    if (entry.id === "auk_base_q8_0") return "Base Q8_0";
    if (entry.id === "auk_flash_f32") return "AuK-Flash F32";
    if (entry.id === "auk_flash_f16") return "AuK-Flash F16";
    if (entry.id === "auk_flash_q8_0") return "AuK-Flash Q8_0";
    if (entry.id === "auk_qwen_bf16") return "Qwen BF16";
    if (entry.id === "auk_qwen_q8_0") return "Qwen Q8_0";
    if (entry.id === "auk_vae_f32") return "VAE F32";
    return entry.display_name || "AuK component";
  }
  if (entry.format === "safetensors") return "Safetensors";
  if (entry.id.includes("int8_dit")) return "GGUF Q4 ConvRot";
  if (entry.precision === "q4_k" || entry.precision === "q4_0") return "GGUF Q4";
  if (entry.precision === "q8_0" || entry.precision === "q8") return "GGUF Q8";
  if (entry.precision === "bf16") return "GGUF BF16";
  if (entry.precision === "f16" || entry.precision === "fp16") return "GGUF FP16";
  return `GGUF ${entry.precision.toUpperCase()}`;
}
function packageModelPath(entry) {
  const modelFile = entry.format === "gguf" ? entry.files?.find((file) => file.toLowerCase().endsWith(".gguf")) : void 0;
  if (!modelFile) {
    return `models/${entry.target_directory}`;
  }
  let relative = modelFile.replace(/\\/g, "/");
  const prefix = (entry.strip_prefix || "").replace(/\\/g, "/").replace(/\/$/, "");
  if (prefix && relative.startsWith(`${prefix}/`)) relative = relative.slice(prefix.length + 1);
  return `models/${entry.target_directory}/${relative}`.replace(/\/+/g, "/");
}
function installChoices(entry) {
  if (entry.manual_setup) return [];
  if ([
    "maya1",
    "gigaam_asr",
    "samsone",
    "sam_audio",
    "tone_color_vc",
    "moss_ttsd",
    "moss_voicegen",
    "kugelaudio",
    "crisperwhisper",
    "index_echo",
    "audio_flamingo",
    "owsm",
    "owsm_ctc",
    "reuse",
    "sidon",
    "smart_turn"
  ].includes(entry.family)) {
    const stem = (entry.download_id || "").replace(/_(?:q8_0|q4_k|bf16|f16|f32|orig)(?:_codec_f16(?:_decode)?)?$/, "");
    return packages.filter((candidate) => candidate.family === entry.family && candidate.format === "gguf" && candidate.id.replace(/_(?:q8_0|q4_k|bf16|f16|f32|orig)(?:_codec_f16(?:_decode)?)?$/, "") === stem).sort((left, right) => Number(right.id === entry.download_id) - Number(left.id === entry.download_id)).map((candidate) => ({
      id: candidate.id,
      label: packageLabel(candidate),
      path: packageModelPath(candidate),
      format: candidate.format,
      precision: candidate.precision
    }));
  }
  const exposesAllGguf = exposeAllGgufPackageFamilies.has(entry.family);
  if (entry.family === "auk") {
    const related2 = packages.filter((candidate) => candidate.family === entry.family && candidate.format === "gguf");
    const order = /* @__PURE__ */ new Map([
      ["auk_base_f32", 0],
      ["auk_base_f16", 1],
      ["auk_base_q8_0", 2],
      ["auk_flash_f32", 3],
      ["auk_flash_f16", 4],
      ["auk_flash_q8_0", 5],
      ["auk_qwen_bf16", 6],
      ["auk_qwen_q8_0", 7],
      ["auk_vae_f32", 8]
    ]);
    return related2.sort((left, right) => (order.get(left.id) ?? 99) - (order.get(right.id) ?? 99)).map((candidate) => ({
      id: candidate.id,
      label: packageLabel(candidate),
      path: packageModelPath(candidate),
      format: candidate.format,
      precision: candidate.precision
    }));
  }
  if (entry.family === "yue2") {
    const related2 = packages.filter((candidate) => candidate.family === entry.family && candidate.format === "gguf");
    const order = /* @__PURE__ */ new Map([
      ["yue2_main_q8_0", 0],
      ["yue2_main_q4_0", 1],
      ["yue2_main_bf16", 2],
      ["yue2_vae_f16", 3],
      ["yue2_vae_f32", 4]
    ]);
    return related2.filter((candidate) => candidate.format === "gguf").sort((left, right) => (order.get(left.id) ?? 99) - (order.get(right.id) ?? 99)).map((candidate) => ({
      id: candidate.id,
      label: packageLabel(candidate),
      path: packageModelPath(candidate),
      format: candidate.format,
      precision: candidate.precision
    }));
  }
  const related = exposesAllGguf ? relatedExposeAllGgufPackages(entry) : relatedPackages(entry);
  if (entry.family === "ace_step" || entry.family === "minimax_music3" || entry.family === "bluemagpie" || exposesAllGguf) {
    return related.filter((candidate) => candidate.format === "gguf").sort((left, right) => exposesAllGguf ? exposedPackageRank(left, entry.download_id) - exposedPackageRank(right, entry.download_id) : Number(right.default === true) - Number(left.default === true)).map((candidate) => ({
      id: candidate.id,
      label: packageLabel(candidate),
      path: packageModelPath(candidate),
      format: candidate.format,
      precision: candidate.precision
    }));
  }
  const q8 = preferredPackage(related.filter((candidate) => candidate.format === "gguf" && ["q8_0", "q8"].includes(candidate.precision)));
  const fp16 = preferredPackage(related.filter((candidate) => candidate.format === "gguf" && ["f16", "fp16"].includes(candidate.precision))) || preferredPackage(related.filter((candidate) => candidate.format === "gguf" && candidate.precision === "bf16"));
  const otherGguf = !q8 && !fp16 ? related.filter((candidate) => candidate.format === "gguf") : [];
  return [q8, fp16, ...otherGguf].filter((candidate) => candidate !== void 0).map((candidate) => ({
    id: candidate.id,
    label: packageLabel(candidate),
    path: packageModelPath(candidate),
    format: candidate.format,
    precision: candidate.precision
  }));
}
const catalog = rawCatalog.models.flatMap((entry) => {
  const choices = installChoices(entry);
  if (entry.download_id && choices.length === 0) return [];
  const installPackage = choices[0];
  const spec = specsByFamily.get(entry.family);
  return [{
    ...entry,
    display_name: englishUiText(entry.display_name_en, entry.display_name) || entry.id,
    input_hint: englishUiText(entry.input_hint_en, entry.input_hint),
    download_id: installPackage?.id || entry.download_id,
    install_packages: choices,
    path: installPackage?.path || entry.path,
    request_options: spec?.options?.request?.map((option) => option.name),
    required_request_options: spec?.options?.request?.filter((option) => option.required === true).map((option) => option.name),
    // A catalog entry may narrow the family's voices, e.g. one checkpoint of
    // a family that speaks with a single voice.
    builtin_voices: entry.builtin_voices ?? spec?.ui?.builtin_voices,
    default_voice: entry.default_voice ?? spec?.ui?.default_voice
  }];
});
const parameterCatalog = Object.fromEntries(
  Object.entries(rawParams).filter((entry) => Array.isArray(entry[1])).map(([family2, specs]) => [
    family2,
    specs.map((spec) => ({
      ...spec,
      label: parameterLabel(spec.name, spec.label_en, spec.label),
      placeholder: englishUiText(spec.placeholder_en, spec.placeholder),
      info: englishUiText(spec.info_en, spec.info)
    }))
  ])
);
for (const [family2, spec] of specsByFamily) {
  const adapter = spec.options?.session?.find((option) => option.name === "lora");
  const strength = spec.options?.session?.find((option) => option.name === "lora_scale");
  const controls = parameterCatalog[family2] || [];
  if (!adapter || !strength || controls.some((control) => control.session_option === `${family2}.lora`)) continue;
  parameterCatalog[family2] = [
    ...controls,
    {
      name: "lora",
      group: "lora",
      scope: "session",
      session_option: `${family2}.lora`,
      type: "text",
      label: "Adapter path",
      default: "",
      info: adapter.description
    },
    {
      name: "lora_scale",
      group: "lora",
      scope: "session",
      session_option: `${family2}.lora_scale`,
      type: "number",
      label: "Strength",
      default: strength.default ?? "",
      minimum: strength.min,
      maximum: strength.max,
      step: 0.1,
      info: strength.description
    }
  ];
}
ToSimplified.Converter({ from: "tw", to: "cn" });
ToTraditional.Converter({ from: "cn", to: "tw" });
export {
  modelCapabilities as a,
  catalog as c,
  modelModes as m,
  onDestroy as o,
  parameterCatalog as p,
  tick as t
};
