import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createDashboard } from './server.js';
interface WebServerContext {
    webServer: {
        register(route: {
            kind: 'prefix';
            path: string;
            handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
        }): () => void;
    };
    effect(setup: () => () => void): unknown;
}
interface DashboardHostContext {
    inject(services: string[], setup: (context: WebServerContext) => void): unknown;
    get(service: 'webServer'): unknown;
}
type Dashboard = ReturnType<typeof createDashboard>;
export declare function mountDashboard(context: DashboardHostContext, dashboard: Dashboard, options: {
    isDesktop: boolean;
    port: number;
    dataDirectory: string;
}): Promise<void>;
export {};
