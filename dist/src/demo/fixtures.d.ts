import { Engine } from '../companion/index.js';
import { type Scope } from '../memory/index.js';
export declare const DEMO_SCOPE: {
    project: string;
    user: string;
    persona: string;
};
export declare function seedDemo(engine: Engine): void;
export declare function demoStep(engine: Engine, step: number, scope?: Scope): void;
