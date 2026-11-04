// Only display a factor explicitly reported by the model endpoint. In particular,
// token throughput from a text LLM is not an audio real-time factor.
export function reportedRtf(response: unknown): number | null {
  if (!response || typeof response !== "object") return null;
  const body = response as Record<string, any>;
  const values = [
    body.timing?.rtf,
    body.timings?.rtf,
    body.rtf,
    body.result?.timing?.rtf,
    body.result?.timings?.rtf,
    body.result?.rtf,
  ];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      return value;
  }
  return null;
}

export function rtfLabel(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value.toFixed(4)
    : "—";
}
