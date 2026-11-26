(function initUrlMatcher(globalScope) {
  if (globalScope.HandyUrlMatcher) return;

  function escapeRegExpExceptStar(str) {
    return str.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }

  // Compiles a user-supplied URL pattern with `*` wildcards anywhere into a RegExp.
  // Examples:
  //  - "https://example.com/login"
  //  - "https://example.com/users/*"
  //  - "*://*.example.com/*"
  //  - "https://app.com/item/*/edit?tab=*"
  //  - "example.com/dashboard*" (auto-matches any protocol if scheme omitted)
  function compilePattern(rawPattern) {
    const pattern = String(rawPattern || '').trim();
    if (!pattern) return null;

    const effective =
      !pattern.includes('://') && !pattern.startsWith('*')
        ? `*://${pattern}`
        : pattern;

    const regexSource = '^' + escapeRegExpExceptStar(effective).replace(/\*/g, '.*') + '$';
    try {
      return new RegExp(regexSource);
    } catch {
      return null;
    }
  }

  function matchesUrl(pattern, url) {
    if (!url || !pattern) return false;
    const regex = compilePattern(pattern);
    if (!regex) return false;
    return regex.test(url);
  }

  function isSupportedWebUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('file://')
    );
  }

  /**
   * Builds convenient URL scope presets from a live tab URL.
   */
  function buildPresets(rawUrl) {
    if (!isSupportedWebUrl(rawUrl)) {
      return {
        exact: '',
        pathWildcard: '',
        domain: '',
        subdomainWildcard: ''
      };
    }

    try {
      const parsed = new URL(rawUrl);
      const origin = `${parsed.protocol}//${parsed.host}`;
      const pathNoQuery = `${origin}${parsed.pathname}`;
      const parentSlash = pathNoQuery.endsWith('/')
        ? pathNoQuery
        : pathNoQuery.slice(0, pathNoQuery.lastIndexOf('/') + 1);

      const hostParts = parsed.hostname.split('.');
      const rootDomain =
        hostParts.length >= 2 ? hostParts.slice(-2).join('.') : parsed.hostname;

      return {
        exact: rawUrl,
        pathWildcard: `${parentSlash}*`,
        domain: `*://${parsed.host}/*`,
        subdomainWildcard: `*://*.${rootDomain}/*`
      };
    } catch {
      return {
        exact: rawUrl,
        pathWildcard: `${rawUrl}*`,
        domain: '*',
        subdomainWildcard: '*'
      };
    }
  }

  /**
   * Extracts a clean grouping label (hostname or pattern summary) for "All Sites" view.
   */
  function getSiteGroupLabel(rawPattern) {
    const pattern = String(rawPattern || '').trim();
    if (!pattern) return 'Unassigned';
    if (pattern === '*' || pattern === '*://*/*') return 'All Websites (*)';

    const withoutScheme = pattern.replace(/^[a-zA-Z*]+:\/\//, '');
    const hostPart = withoutScheme.split('/')[0] || pattern;
    return hostPart;
  }

  globalScope.HandyUrlMatcher = {
    compilePattern,
    matchesUrl,
    isSupportedWebUrl,
    buildPresets,
    getSiteGroupLabel
  };
})(globalThis);
