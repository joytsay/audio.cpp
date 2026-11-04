import type { DemoAudioModel } from "./demo-models";

export interface DemoSettings {
  schema_version: 1;
  vad_enabled?: boolean;
  asr_enabled?: boolean;
  llm_enabled?: boolean;
  tts_enabled?: boolean;
  vad_model_task?: string;
  asr_model_task?: string;
  tts_model_task?: string;
  vad_model_key?: string;
  vad_model_id?: string;
  vad_model_family?: string;
  vad_model_path?: string;
  asr_model_key?: string;
  asr_model_id?: string;
  asr_model_family?: string;
  asr_model_path?: string;
  tts_model_key?: string;
  tts_model_id?: string;
  tts_model_family?: string;
  tts_model_path?: string;
  vad_load_options?: Record<string, string>;
  vad_session_options?: Record<string, string>;
  asr_load_options?: Record<string, string>;
  asr_session_options?: Record<string, string>;
  tts_load_options?: Record<string, string>;
  tts_session_options?: Record<string, string>;
  vad_threshold?: number;
  vad_window_ms?: number;
  llm_model?: string;
  tts_streaming?: boolean;
  tts_voice_id?: string;
  tts_reference_text?: string;
  tts_test_text?: string;
}
export type AudioStage = "vad" | "asr" | "tts";
const pathIdentity = (path: string) =>
  path.replace(/\\/g, "/").replace(/\/+$/, "");
export function savedAudioModel(
  settings: DemoSettings,
  stage: AudioStage,
  models: DemoAudioModel[],
): DemoAudioModel | undefined {
  const family = settings[`${stage}_model_family`],
    key = settings[`${stage}_model_key`],
    path = settings[`${stage}_model_path`];
  const candidates = models.filter((model) =>
    stage === "tts"
      ? ["tts", "clon"].includes(model.task)
      : stage === "asr"
        ? ["asr", "stt"].includes(model.task)
        : model.task === "vad",
  );
  const eligible = candidates.filter(
    (model) => !family || model.family === family,
  );
  return (
    eligible.find((model) => key && model.key === key) ||
    eligible.find(
      (model) => path && pathIdentity(model.path) === pathIdentity(path),
    )
  );
}
export function audioModelSettings(
  stage: AudioStage,
  model: DemoAudioModel | undefined,
): Partial<DemoSettings> {
  return {
    [`${stage}_model_task`]: model?.task || stage,
    [`${stage}_model_key`]: model?.key || "",
    [`${stage}_model_id`]: model?.id || "",
    [`${stage}_model_family`]: model?.family || "",
    [`${stage}_model_path`]: model?.path || "",
    [`${stage}_load_options`]: model?.load_options || {},
    [`${stage}_session_options`]: model?.session_options || {},
  };
}
