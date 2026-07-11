// Loaded as an external module script. A browser-free pass (or setContent with no base URL)
// never runs this; only a real navigation does. That is exactly the case this exercises.
document.getElementById("root").innerHTML = `
  <nav class="nav">
    <span class="logo">Critical</span>
    <a href="/features">Features</a>
    <a href="/pricing">Pricing</a>
  </nav>
  <header class="hero">
    <h1>Rendered by an external module script</h1>
    <p>Loaded over HTTP, executed by the browser.</p>
    <a class="cta" href="/start">Get started</a>
  </header>
  <footer class="footer">
    <div class="copyright">© 2026 Critical</div>
  </footer>`;
