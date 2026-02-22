class AppConfig {
  // Default to same-origin so production hosting rewrites (/api/**) work out of the box.
  static const String _defaultApiBaseUrl = '/';
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: _defaultApiBaseUrl,
  );

  static String get normalizedApiBaseUrl {
    if (apiBaseUrl.endsWith('/')) {
      return apiBaseUrl.substring(0, apiBaseUrl.length - 1);
    }
    return apiBaseUrl;
  }

  static Uri apiEndpoint(String path) {
    final sanitizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$normalizedApiBaseUrl$sanitizedPath');
  }
}
