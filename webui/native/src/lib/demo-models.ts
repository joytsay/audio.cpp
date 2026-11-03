import { catalog } from "./catalog";
import { getModelsRoot, modelPackageSizes, models, pathStatus } from "./api";
import { endpointRouterModels, type OpenAIModel } from "./openai";
import type { CatalogEntry, StringMap } from "./types";

export interface DemoAudioModel {
  key: string;
  id: string;
  label: string;
  family: string;
  task: string;
  mode: string;
  path: string;
  load_options?: StringMap;
  session_options?: StringMap;
  builtin_voices?: string[];
  default_voice?: string;
}

export async function discoverDemoAudioModels(): Promise<DemoAudioModel[]> {
  const [root, inventory, registered] = await Promise.all([
    getModelsRoot(),
    modelPackageSizes(),
    models(),
  ]);
  const resolve = (path: string) =>
    path.startsWith("models/")
      ? `${root.models_root.replace(/\/$/, "")}/${path.slice(7)}`
      : path;
  const result: DemoAudioModel[] = [];
  const add = (
    entry: CatalogEntry,
    path: string,
    key: string,
    label: string,
    load_options = entry.load_options,
    session_options = entry.session_options,
  ) => {
    if (
      result.some(
        (m) =>
          m.path === path &&
          m.family === entry.family &&
          m.task === entry.task &&
          m.mode === entry.mode,
      )
    )
      return;
    result.push({
      key,
      id: entry.id,
      label,
      family: entry.family,
      task: entry.task,
      mode: entry.mode || "offline",
      path,
      load_options,
      session_options,
      builtin_voices: entry.builtin_voices,
      default_voice: entry.default_voice,
    });
  };
  for (const entry of catalog.filter((e) =>
    ["vad", "asr", "stt", "tts", "clon"].includes(e.task),
  )) {
    for (const choice of entry.install_packages || []) {
      const installed = inventory.data.find(
        (row) => row.id === choice.id && row.installed,
      );
      if (!installed) continue;
      const target = installed.load_target;
      add(
        { ...entry, family: target?.family || entry.family },
        target?.model_path || resolve(choice.path),
        `package:${entry.id}:${choice.id}`,
        `${entry.display_name_en || entry.display_name} · ${choice.label}`,
        target?.load_options || choice.load_options || entry.load_options,
        target?.session_options || {
          ...entry.session_options,
          ...choice.session_options,
        },
      );
    }
  }
  // Manual GGUFs have no install package. Check actual files, including bundled VAD.
  const local = catalog.filter(
    (e) => e.manual_setup || (e.task === "vad" && !e.install_packages?.length),
  );
  const localStatus = await Promise.all(
    local.map(async (entry) => {
      const path = resolve(entry.path);
      return { entry, path, status: await pathStatus(path) };
    }),
  );
  for (const { entry, path, status } of localStatus) {
    if (status.exists)
      add(
        entry,
        path,
        `local:${entry.id}`,
        entry.display_name_en || entry.display_name,
      );
  }
  for (const model of registered) {
    if (
      !["vad", "asr", "stt", "tts", "clon"].includes(model.task) ||
      !model.path
    )
      continue;
    const entry = catalog.find(
      (e) =>
        e.id === model.id ||
        (e.family === model.family && e.task === model.task),
    );
    if (model.loaded || (await pathStatus(model.path)).exists) {
      add(
        {
          ...entry,
          ...model,
          display_name:
            entry?.display_name_en || entry?.display_name || model.id,
        },
        model.path,
        `registered:${model.id}`,
        entry?.display_name_en || entry?.display_name || model.id,
      );
    }
  }
  return result.sort((a, b) => a.label.localeCompare(b.label));
}

export async function discoverDemoLlmModels(
  base: string,
): Promise<OpenAIModel[]> {
  // Router IDs, including local filenames/aliases, are the identifiers accepted by inference.
  return (await endpointRouterModels(base)).filter(
    (m) => m.id && !/embedding|rerank/i.test(m.id),
  );
}

export function preferredDemoModel(
  entries: DemoAudioModel[],
  current: string,
  preferred: string,
): string {
  return (
    entries.find((m) => m.key === current)?.key ||
    entries.find((m) => m.id === preferred)?.key ||
    entries[0]?.key ||
    ""
  );
}
