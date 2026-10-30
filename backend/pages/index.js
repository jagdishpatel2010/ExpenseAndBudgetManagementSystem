/**
 * Minimal landing page for the backend.
 *
 * The backend is API-only; this page just confirms the server is running and
 * lists the available API groups so a developer hitting the root URL in a
 * browser gets useful feedback.
 */
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, lineHeight: 1.6 }}>
      <h1>Expense &amp; Budget API</h1>
      <p>The backend is running. REST endpoints are served under <code>/api</code>.</p>
      <ul>
        <li><code>/api/health</code></li>
        <li><code>/api/auth/register</code>, <code>/api/auth/login</code>, <code>/api/auth/me</code></li>
        <li><code>/api/transactions</code>, <code>/api/transactions/[id]</code></li>
        <li><code>/api/categories</code>, <code>/api/budgets</code></li>
        <li><code>/api/summary</code>, <code>/api/charts</code>, <code>/api/reports/monthly</code></li>
        <li><code>/api/notifications</code>, <code>/api/profile</code></li>
        <li><code>/api/admin/*</code></li>
      </ul>
    </main>
  );
}
