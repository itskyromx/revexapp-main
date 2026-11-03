export default {
  async fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    // Serve the SPA for direct visits and authentication redirects as well as
    // browsers whose navigation requests fall through to the Worker.
    return env.ASSETS.fetch(request);
  },
}
