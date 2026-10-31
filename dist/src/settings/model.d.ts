import { z } from 'zod';
export declare const Settings: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    learning: z.ZodDefault<z.ZodBoolean>;
    growth: z.ZodDefault<z.ZodBoolean>;
    emotion: z.ZodDefault<z.ZodBoolean>;
    retrievalMode: z.ZodDefault<z.ZodEnum<{
        local: "local";
        semantic: "semantic";
    }>>;
    embeddingUrl: z.ZodDefault<z.ZodString>;
    embeddingModel: z.ZodDefault<z.ZodString>;
    embeddingProtocol: z.ZodDefault<z.ZodEnum<{
        auto: "auto";
        openai: "openai";
        ollama: "ollama";
        doubao: "doubao";
    }>>;
    embeddingDimensions: z.ZodDefault<z.ZodNumber>;
    embeddingKeyEnv: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type Settings = z.infer<typeof Settings>;
