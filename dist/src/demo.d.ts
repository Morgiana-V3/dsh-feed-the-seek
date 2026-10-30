import { Engine } from './engine.js';
import { type Scope } from './types.js';
export declare const DEMO_SCOPE: {
    project: string;
    user: string;
    persona: string;
};
export declare function seedDemo(engine: Engine): void;
export declare function demoStep(engine: Engine, step: number, scope?: Scope): void;
