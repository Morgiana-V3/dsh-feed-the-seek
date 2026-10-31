import { type IncomingMessage, type ServerResponse } from 'node:http';
import { Engine } from '../companion/index.js';
import { Scope } from '../memory/index.js';
export declare function createDashboard(engine: Engine, options: {
    demo: boolean;
    port: number;
    retry?: (scope: Scope) => void;
}): {
    server: import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
    handle: (request: IncomingMessage, response: ServerResponse, mountPath?: string) => Promise<void>;
    listen: () => Promise<void>;
};
