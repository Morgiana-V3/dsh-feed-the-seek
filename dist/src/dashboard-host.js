export async function mountDashboard(context, dashboard, options) {
    // Desktop loads plugins and webServer independently. The injection also remounts
    // the route if that service is replaced, and releases it with its owning fiber.
    context.inject(['webServer'], function mountNativeSettings(webContext) {
        webContext.effect(() => webContext.webServer.register({
            kind: 'prefix',
            path: '/fish-brain',
            handler: (request, response) => dashboard.handle(request, response, '/fish-brain'),
        }));
        console.info('[dsh-feed-the-seek] 已接入 DSH 设置与会话，数据保存在 ' + options.dataDirectory);
    });
    // The desktop settings client always uses the host route. A separate port is
    // only useful in a CLI host that has no web service at startup.
    if (options.isDesktop || context.get('webServer')) {
        return;
    }
    try {
        await dashboard.listen();
        console.info(`[dsh-feed-the-seek] 管理页 http://127.0.0.1:${options.port}`);
    }
    catch {
        console.warn('[dsh-feed-the-seek] 管理端口不可用，记忆插件仍工作；可设置 dashboardPort。');
    }
}
//# sourceMappingURL=dashboard-host.js.map