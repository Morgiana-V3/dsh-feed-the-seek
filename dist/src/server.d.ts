import { type IncomingMessage, type ServerResponse } from 'node:http';
import { Engine } from './engine.js';
export declare function createDashboard(engine: Engine, options: {
    demo: boolean;
    port: number;
    retry?: () => void;
    sessions?: () => {
        id: string;
        project: string;
        persona: string;
        enabled: boolean;
    }[];
}): {
    server: import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
    handle: (req: IncomingMessage, res: ServerResponse, mountPath?: string) => Promise<void>;
    listen: () => Promise<void>;
};
