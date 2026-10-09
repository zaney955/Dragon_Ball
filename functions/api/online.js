export function onRequestGet({ request, env }) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
    return new Response('WebSocket required', { status: 426 });
  if (request.headers.get('Origin') !== new URL(request.url).origin)
    return new Response('Origin not allowed', { status: 403 });
  // Use the existing coordination object directly, without a public workers.dev hop.
  return env.LOBBY.getByName('three-room-lobby-v1').fetch(request);
}
