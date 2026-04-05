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

    // 404
    app.innerHTML = `
      <div class="page" style="text-align:center;padding-top:60px">
        <h1>Page Not Found</h1>
        <p class="subtitle">The page you're looking for doesn't exist.</p>
        <button class="btn btn-primary mt-3" onclick="Router.navigate('/')">Go Home</button>
      </div>
    `;
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
        e.preventDefault();
        this.navigate(link.getAttribute('href'));
      }
    });

    this.resolve();
  },
};
