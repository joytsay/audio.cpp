import type { SimulationScenario } from "./knowledge-scenarios";

export const languagePrompt = "請先選語言：中文 1、英文 2。";

const opening = {
  zh: [
    "請進行身分驗證：請問此電話持有人名字是？",
    "請說出您員工編號後 3 碼？",
    "請說出您直屬主管名字？",
    "請問您要回報什麼內容？",
    "請說明您要辦理的事項。要回報工單的話，請說明是例行保養還是現場查修，並提供工單內容。",
  ],
  en: [
    "For identity verification, what is the name of the person who owns this phone?",
    "What are the last three digits of your employee ID?",
    "What is your direct supervisor’s name?",
    "What would you like to report?",
    "Please tell me what you need. For a work order, describe the job and tell me whether it was preventive maintenance or troubleshooting.",
  ],
};

export function createSimulation(id: string) {
  return {
    id,
    sessionId: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join(""),
    language: "zh" as keyof typeof opening,
    step: 0,
    startIndex: 0,
    scenario: null as SimulationScenario | null,
    workOrderId: "",
  };
}

export function advanceSimulationOpening(call: ReturnType<typeof createSimulation>, text: string) {
  if (call.step >= 4) return null;
  if (call.step === 0) {
    const choice = text.normalize("NFKC").replace(/[\s。！？!？，,.]/g, "");
    if (/^(?:2|二|兩|英文2?|英语2?|英語2?|english2?|two)$/i.test(choice)) call.language = "en";
    else if (!/^(?:1|一|壹|中文1?|國語1?|国语1?|chinese1?|mandarin1?|one)$/i.test(choice))
      return languagePrompt;
  }
  if (call.step === 2) {
    const digits = text.normalize("NFKC")
      .replace(/[\s：:。！!，,.-]/g, "")
      .replace(/^(?:(?:我的)?(?:員工|员工)?(?:編號|编号))?(?:[後后][三3][碼码])?(?:是|為)?/, "")
      .replace(/^(?:my)?lastthreedigits(?:are|is)?/i, "");
    const spokenEnglish = /^(?:zero|oh|one|two|three|four|five|six|seven|eight|nine){3}$/i;
    if (!/^[0-9零〇一二兩两三四五六七八九幺]{3}$/.test(digits) && !spokenEnglish.test(digits))
      return opening[call.language][1];
  }
  return opening[call.language][call.step++];
}

export function simulationClarification(call: ReturnType<typeof createSimulation>) {
  return opening[call.language][4];
}

export function simulationPrompt(call: ReturnType<typeof createSimulation>, scenario: SimulationScenario) {
  return [
    `You are the AI voice assistant in this IVR simulation. Follow the selected scenario for this call. Speak only in ${call.language === "en" ? "English" : "Traditional Chinese"} and reply with the next natural spoken turn. Ask only for information that is missing. Use the caller's live details and preserve identifiers, values and units exactly.`,
    scenario.steps,
    "The shared language and identity questions are already finished. This is a simulation with no external actions. Never claim a real dispatch, transfer, work-order submission or verified identity. Describe completion as simulated. Never recite the document, its section heading, or caller dialogue.",
  ].join("\n\n");
}
