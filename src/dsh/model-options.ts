interface ModelInfo {
  reasoning?: { efforts: { id: string }[] }
}

interface ModelRuntime {
  resolveModelInfo?: (provider: string, model: string, signal: AbortSignal) => Promise<ModelInfo>
}

// Leave output length to the host/provider defaults instead of imposing a plugin cap.
// Only request a reasoning effort the actual host model advertises.
export async function learningCallOptions(
  runtime: ModelRuntime,
  provider: string,
  model: string,
  signal: AbortSignal,
): Promise<{ reasoningEffort?: string }> {
  if (!runtime.resolveModelInfo) {
    return {}
  }
  try {
    const info = await runtime.resolveModelInfo(provider, model, signal)
    if (info.reasoning?.efforts.some((effort) => effort.id === 'low')) {
      return { reasoningEffort: 'low' }
    }
  } catch (error) {
    if (signal.aborted) {
      throw error
    }
  }
  return {}
}
