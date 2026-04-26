// ═══════════════════════════════════════════════════════
// CrewCast — Client-Side Router
// ═══════════════════════════════════════════════════════

const Router = {
  routes: [],
  currentPage: null,

  add(path, handler) {
    this.routes.push({ path, handler });
  },

  navigate(path, replace = false) {
    if (replace) {
      history.replaceState(null, '', path);
    } else {
      history.pushState(null, '', path);
    }
    this.resolve();
  },

  resolve() {
    const path = location.pathname;
    const app = document.getElementById('app');

    // Clear admin mode class — admin pages re-add it via UI.adminShell()
    document.body.classList.remove('admin-mode');

    for (const route of this.routes) {
      const match = this.matchPath(route.path, path);
      if (match) {
        this.currentPage = route.path;
        route.handler(app, match.params);
        return;
      }
    }

    // 404 — render INSIDE the appropriate shell so the user isn't dead-ended
    // (sidebar disappearing made missed-route bugs look worse than they were).
    this.currentPage = null;
    const notFoundBody = `
      <div class="page" style="text-align:center;padding-top:60px">
        <h1>Page Not Found</h1>
        <p class="subtitle">The page you're looking for doesn't exist.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
          <button class="btn btn-secondary" onclick="history.back()">← Go Back</button>
          <button class="btn btn-primary" onclick="Router.navigate('/')">Go Home</button>
        </div>
      </div>
    `;

    // Keep the logged-in user inside their shell so sidebar / bottom-nav remain.
    try {
      if (typeof API !== 'undefined' && API.isLoggedIn && API.isLoggedIn() && typeof UI !== 'undefined') {
        if (API.isAdmin && API.isAdmin() && typeof UI.adminShell === 'function') {
          app.innerHTML = UI.adminShell(null, notFoundBody);
          return;
        }
        // Employee view: bottom-nav wrapper (fallback to plain if not available)
        if (typeof UI.employeeNav === 'function') {
          app.innerHTML = `${notFoundBody}${UI.employeeNav(null)}`;
          return;
        }
      }
    } catch (_) { /* fall through to plain */ }

    app.innerHTML = notFoundBody;
  },

  matchPath(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return { params };
  },

  init() {
    window.addEventListener('popstate', () => this.resolve());

    // Intercept all link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link && link.href.startsWith(location.origin) && !link.hasAttribute('download') && !link.hasAttribute('target')) {
        const href = link.getAttribute('href');
        // Skip hash-only links (e.g. href="#" used as a no-op for onclick handlers).
        // The router was eating these clicks and re-rendering the page, which
        // wiped out any UI toggles the onclick handler had just performed.
        if (!href || href === '#' || href.startsWith('#')) return;
        e.preventDefault();
        this.navigate(href);
      }
    });

    this.resolve();
  },
};
