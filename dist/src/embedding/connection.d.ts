export declare function testEmbeddingConnection(input: unknown, resolveSavedKey?: (url: string) => Promise<string | undefined>): Promise<{
    ok: boolean;
    dimensions: number;
    elapsedMs: number;
}>;
