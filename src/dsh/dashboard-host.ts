import type { IncomingMessage, ServerResponse } from 'node:http'
import type { createDashboard } from '../dashboard/index.js'

interface WebServerContext {
  webServer: {
    register(route: {
      kind: 'prefix'
      path: string
      handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>
    }): () => void
  }
  effect(setup: () => () => void): unknown
}

interface DashboardHostContext {
  inject(services: string[], setup: (context: WebServerContext) => void): unknown
  get(service: 'webServer'): unknown
}

type Dashboard = ReturnType<typeof createDashboard>

export async function mountDashboard(
  context: DashboardHostContext,
  dashboard: Dashboard,
  options: { isDesktop: boolean; port: number; dataDirectory: string },
) {
  // Desktop loads plugins and webServer independently. The injection also remounts
  // the route if that service is replaced, and releases it with its owning fiber.
  context.inject(['webServer'], function mountNativeSettings(webContext) {
    webContext.effect(() =>
      webContext.webServer.register({
        kind: 'prefix',
        path: '/fish-brain',
        handler: (request, response) => dashboard.handle(request, response, '/fish-brain'),
      }),
    )
    console.info('[dsh-feed-the-seek] 已接入 DSH 设置与会话，数据保存在 ' + options.dataDirectory)
  })

  // The desktop settings client always uses the host route. A separate port is
  // only useful in a CLI host that has no web service at startup.
  if (options.isDesktop || context.get('webServer')) {
    return
  }

  try {
    await dashboard.listen()
    console.info(`[dsh-feed-the-seek] 管理页 http://127.0.0.1:${options.port}`)
  } catch {
    console.warn('[dsh-feed-the-seek] 管理端口不可用，记忆插件仍工作；可设置 dashboardPort。')
  }
}
