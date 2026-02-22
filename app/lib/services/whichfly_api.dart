import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/by_the_riverside_models.dart';

abstract class WhichFlyApi {
  Future<List<RiverOption>> fetchRiverOptions();

  Future<RiverSuggestion> suggestRiver({required GpsCoords gps});

  Future<ByTheRiversideRecommendation> fetchByTheRiversideRecommendation({
    required String riverName,
    String? riverReachId,
    required String waterLevel,
    GpsCoords? gps,
    bool? fishRising,
  });

  Future<ByTheRiversideRecommendation> fetchPlanningRecommendation({
    required String riverName,
    String? riverReachId,
    required String plannedDate,
  });
}

class ApiException implements Exception {
  const ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class HttpWhichFlyApi implements WhichFlyApi {
  HttpWhichFlyApi({http.Client? client, String? baseUrl})
    : _client = client ?? http.Client(),
      _baseUrl = (baseUrl ?? AppConfig.normalizedApiBaseUrl);

  final http.Client _client;
  final String _baseUrl;

  Uri _endpoint(String path) {
    final sanitizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$_baseUrl$sanitizedPath');
  }

  @override
  Future<List<RiverOption>> fetchRiverOptions() async {
    final response = await _client
        .get(_endpoint('/api/rivers'))
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) {
      throw ApiException('Unable to load river options.');
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final options = json['options'] as List<dynamic>? ?? <dynamic>[];
    return options
        .whereType<Map<String, dynamic>>()
        .map(RiverOption.fromJson)
        .where(
          (option) => option.label.isNotEmpty && option.riverName.isNotEmpty,
        )
        .toList();
  }

  @override
  Future<RiverSuggestion> suggestRiver({required GpsCoords gps}) async {
    final response = await _client
        .post(
          _endpoint('/api/river-suggestion'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'gps': gps.toJson()}),
        )
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) {
      throw ApiException('Unable to suggest a river.');
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final river = json['river'] as Map<String, dynamic>?;
    if (river == null) {
      throw const ApiException('No river suggestion returned.');
    }
    return RiverSuggestion.fromJson(river);
  }

  @override
  Future<ByTheRiversideRecommendation> fetchByTheRiversideRecommendation({
    required String riverName,
    String? riverReachId,
    required String waterLevel,
    GpsCoords? gps,
    bool? fishRising,
  }) async {
    final payload = <String, dynamic>{
      'waterLevel': waterLevel,
      'riverName': riverName,
      'observations': {'fishRising': fishRising},
    };
    if (riverReachId != null && riverReachId.isNotEmpty) {
      payload['riverReachId'] = riverReachId;
    }
    if (gps != null) {
      payload['gps'] = gps.toJson();
    }

    final response = await _client
        .post(
          _endpoint('/api/recommendation'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 12));

    if (response.statusCode != 200) {
      String message = 'Unable to load recommendation.';
      try {
        final err = jsonDecode(response.body) as Map<String, dynamic>;
        final details = err['details'];
        if (details is List && details.isNotEmpty) {
          message = details.first.toString();
        } else if (err['error'] is String) {
          message = err['error'].toString();
        }
      } catch (_) {
        // Keep generic message on parse failures.
      }
      throw ApiException(message);
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return ByTheRiversideRecommendation.fromJson(json);
  }

  @override
  Future<ByTheRiversideRecommendation> fetchPlanningRecommendation({
    required String riverName,
    String? riverReachId,
    required String plannedDate,
  }) async {
    final payload = <String, dynamic>{
      'mode': 'planning',
      'plannedDate': plannedDate,
      'riverName': riverName,
    };
    if (riverReachId != null && riverReachId.isNotEmpty) {
      payload['riverReachId'] = riverReachId;
    }

    final response = await _client
        .post(
          _endpoint('/api/recommendation'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 12));

    if (response.statusCode != 200) {
      String message = 'Unable to load recommendation.';
      try {
        final err = jsonDecode(response.body) as Map<String, dynamic>;
        final details = err['details'];
        if (details is List && details.isNotEmpty) {
          message = details.first.toString();
        } else if (err['error'] is String) {
          message = err['error'].toString();
        }
      } catch (_) {
        // Keep generic message on parse failures.
      }
      throw ApiException(message);
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return ByTheRiversideRecommendation.fromJson(json);
  }
}
