interface ModelInfo {
    reasoning?: {
        efforts: {
            id: string;
        }[];
    };
}
interface ModelRuntime {
    resolveModelInfo?: (provider: string, model: string, signal: AbortSignal) => Promise<ModelInfo>;
}
export declare function learningCallOptions(runtime: ModelRuntime, provider: string, model: string, signal: AbortSignal): Promise<{
    reasoningEffort?: string;
}>;
export {};
