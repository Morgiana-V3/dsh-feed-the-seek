// Leave output length to the host/provider defaults instead of imposing a plugin cap.
// Only request a reasoning effort the actual host model advertises.
export async function learningCallOptions(runtime, provider, model, signal) {
    if (!runtime.resolveModelInfo) {
        return {};
    }
    try {
        const info = await runtime.resolveModelInfo(provider, model, signal);
        if (info.reasoning?.efforts.some((effort) => effort.id === 'low')) {
            return { reasoningEffort: 'low' };
        }
    }
    catch (error) {
        if (signal.aborted) {
            throw error;
        }
    }
    return {};
}
//# sourceMappingURL=model-options.js.map