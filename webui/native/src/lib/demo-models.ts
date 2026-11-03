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

export const LFM_DEMO_FILENAME = "LiquidAI_LFM2.5-1.2B-Instruct-Q4_K_M.gguf";
export const LFM_DEMO_REF =
  "bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M";
export interface DemoLlmModel extends OpenAIModel {
  label?: string;
  requiresDownload?: boolean;
}
export const isDemoLfmModel = (id: string) =>
  /LFM2[._-]?5.*1[._-]?2B.*Q4_K_M/i.test(id);

function modelIdentityPath(path: string, modelsRoot: string): string {
  let normalized = path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
  if (normalized.startsWith("models/"))
    normalized = modelsRoot.replace(/\/$/, "") + "/" + normalized.slice(7);
  const assets = normalized.match(/(?:^|\/)(assets\/framework\/models\/.+)$/);
  return assets ? assets[1] : normalized;
}
const taskGroup = (task: string) =>
  ["tts", "clon"].includes(task)
    ? "tts"
    : ["asr", "stt"].includes(task)
      ? "asr"
      : task;

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
    const identity = modelIdentityPath(path, root.models_root);
    if (
      result.some(
        (m) =>
          m.family === entry.family &&
          taskGroup(m.task) === taskGroup(entry.task) &&
          modelIdentityPath(m.path, root.models_root) === identity,
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
      const identity = modelIdentityPath(model.path, root.models_root);
      // A server may register both a package folder and its resolved GGUF, or
      // register the same model repeatedly under UI/demo aliases.
      if (
        result.some((m) => {
          if (
            m.family !== model.family ||
            taskGroup(m.task) !== taskGroup(model.task)
          )
            return false;
          const known = modelIdentityPath(m.path, root.models_root);
          return (
            known === identity ||
            (!/\.gguf$/i.test(identity) &&
              /\.gguf$/i.test(known) &&
              known.startsWith(identity + "/")) ||
            (!/\.gguf$/i.test(known) &&
              /\.gguf$/i.test(identity) &&
              identity.startsWith(known + "/"))
          );
        })
      )
        continue;
      add(
        {
          ...entry,
          ...model,
          display_name:
            entry?.display_name_en || entry?.display_name || model.id,
        },
        model.path,
        `registered:${model.id}`,
        entry?.id === model.id
          ? entry.display_name_en || entry.display_name
          : `${entry?.display_name_en || entry?.display_name || model.family} · ${model.id}`,
      );
    }
  }
  return result.sort((a, b) => a.label.localeCompare(b.label));
}

export async function discoverDemoLlmModels(
  base: string,
): Promise<DemoLlmModel[]> {
  const result: DemoLlmModel[] = (await endpointRouterModels(base))
    .filter((m) => m.id && !/embedding|rerank/i.test(m.id))
    .filter(
      (m, index, all) => all.findIndex((other) => other.id === m.id) === index,
    )
    .map((m) => ({
      ...m,
      label: isDemoLfmModel(m.id) ? LFM_DEMO_FILENAME : m.id,
    }));
  if (!result.some((m) => isDemoLfmModel(m.id)))
    result.unshift({
      id: LFM_DEMO_REF,
      label: LFM_DEMO_FILENAME,
      requiresDownload: true,
    });
  return result;
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
