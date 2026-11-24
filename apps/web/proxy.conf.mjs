// Dev proxy: /api goes to the API on 3000, so the web app and the API share one origin.
// Better Auth takes the client IP for its rate limit from x-forwarded-for, so the proxy sets it to
// the address it actually sees and drops whatever the client sent, as the production proxy must.
// (apps/web-e2e/proxy.e2e.json passes the header through on purpose: test scenarios pick an IP.)

/** Replaces x-forwarded-for on the outgoing request with the client's socket address. */
export function forwardClientIp(proxyReq, req) {
  proxyReq.setHeader('x-forwarded-for', req.socket.remoteAddress ?? '');
}

export default {
  '/api': {
    target: 'http://localhost:3000',
    secure: false,
    configure: (proxy) => proxy.on('proxyReq', forwardClientIp),
  },
};
