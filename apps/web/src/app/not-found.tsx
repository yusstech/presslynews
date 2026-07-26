/**
 * Global fallback for paths outside any locale. The middleware redirects almost
 * everything into a locale, so this is rarely seen — it defines its own
 * <html>/<body> because it renders without the locale root layout.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#FAFAF8',
          color: '#111111',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ letterSpacing: '0.2em', fontSize: 12, color: '#666' }}>404</p>
          <h1 style={{ fontSize: 28 }}>Page not found</h1>
          <a href="/en" style={{ color: '#16213E' }}>
            Go to Pressly
          </a>
        </div>
      </body>
    </html>
  );
}
