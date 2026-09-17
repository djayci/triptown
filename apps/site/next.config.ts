import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Unindexed until an ARCON vetting route is chosen: the site is shared by direct link with
        // operators and partners only (docs/compliance/games-showcase-site-2026-09-17.md F2).
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  async redirects() {
    // The demos load their files relative to the page (`base: './'`), so they must be opened at
    // index.html, never at a bare or trailing-slash directory URL. These redirects run before the proxy,
    // and the index.html they point at is then gated like every other /play/ file.
    return [
      { source: '/play/:slug', destination: '/play/:slug/index.html', permanent: false },
      { source: '/play/:slug/', destination: '/play/:slug/index.html', permanent: false },
    ];
  },
};

export default config;
