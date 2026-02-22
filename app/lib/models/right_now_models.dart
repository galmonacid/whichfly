class GpsCoords {
  const GpsCoords({
    required this.lat,
    required this.lon,
    required this.accuracy,
  });

  final double lat;
  final double lon;
  final double accuracy;

  Map<String, dynamic> toJson() => {
    'lat': lat,
    'lon': lon,
    'accuracy': accuracy,
  };
}

class RiverOption {
  const RiverOption({
    required this.label,
    required this.riverName,
    required this.reachId,
  });

  final String label;
  final String riverName;
  final String? reachId;

  factory RiverOption.fromJson(Map<String, dynamic> json) {
    return RiverOption(
      label: (json['label'] ?? '').toString(),
      riverName: (json['river_name'] ?? '').toString(),
      reachId: json['reach_id']?.toString(),
    );
  }
}

class RiverSuggestion {
  const RiverSuggestion({
    required this.name,
    required this.confidence,
    required this.distanceM,
    required this.source,
  });

  final String name;
  final String confidence;
  final double? distanceM;
  final String source;

  factory RiverSuggestion.fromJson(Map<String, dynamic> json) {
    return RiverSuggestion(
      name: (json['name'] ?? '').toString(),
      confidence: (json['confidence'] ?? '').toString(),
      distanceM: (json['distance_m'] as num?)?.toDouble(),
      source: (json['source'] ?? '').toString(),
    );
  }
}

class RecommendationAlternative {
  const RecommendationAlternative({
    required this.pattern,
    required this.type,
    required this.size,
    required this.when,
  });

  final String pattern;
  final String type;
  final int size;
  final String when;

  factory RecommendationAlternative.fromJson(Map<String, dynamic> json) {
    return RecommendationAlternative(
      pattern: (json['pattern'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      size: (json['size'] as num?)?.toInt() ?? 0,
      when: (json['when'] ?? '').toString(),
    );
  }
}

class WeatherContext {
  const WeatherContext({
    required this.temperatureC,
    required this.precipitationMm,
    required this.cloudCoverPct,
    required this.windSpeedKph,
  });

  final double? temperatureC;
  final double? precipitationMm;
  final double? cloudCoverPct;
  final double? windSpeedKph;

  factory WeatherContext.fromJson(Map<String, dynamic> json) {
    return WeatherContext(
      temperatureC: (json['temperature_c'] as num?)?.toDouble(),
      precipitationMm: (json['precipitation_mm'] as num?)?.toDouble(),
      cloudCoverPct: (json['cloud_cover_pct'] as num?)?.toDouble(),
      windSpeedKph: (json['wind_speed_kph'] as num?)?.toDouble(),
    );
  }
}

class DaylightContext {
  const DaylightContext({
    required this.isDaylight,
    required this.minutesToSunset,
  });

  final bool? isDaylight;
  final double? minutesToSunset;

  factory DaylightContext.fromJson(Map<String, dynamic> json) {
    return DaylightContext(
      isDaylight: json['is_daylight'] as bool?,
      minutesToSunset: (json['minutes_to_sunset'] as num?)?.toDouble(),
    );
  }
}

class RecommendationContext {
  const RecommendationContext({required this.weather, required this.daylight});

  final WeatherContext weather;
  final DaylightContext daylight;

  factory RecommendationContext.fromJson(Map<String, dynamic> json) {
    return RecommendationContext(
      weather: WeatherContext.fromJson(
        (json['weather'] as Map<String, dynamic>? ?? <String, dynamic>{}),
      ),
      daylight: DaylightContext.fromJson(
        (json['daylight'] as Map<String, dynamic>? ?? <String, dynamic>{}),
      ),
    );
  }
}

class RightNowRecommendation {
  const RightNowRecommendation({
    required this.riverName,
    required this.primaryPattern,
    required this.primaryType,
    required this.primarySize,
    required this.explanation,
    required this.confidence,
    required this.alternatives,
    required this.context,
  });

  final String riverName;
  final String primaryPattern;
  final String primaryType;
  final int primarySize;
  final String explanation;
  final String confidence;
  final List<RecommendationAlternative> alternatives;
  final RecommendationContext context;

  factory RightNowRecommendation.fromJson(Map<String, dynamic> json) {
    final river = json['river'] as Map<String, dynamic>? ?? <String, dynamic>{};
    final primary =
        json['primary'] as Map<String, dynamic>? ?? <String, dynamic>{};
    final alternatives = json['alternatives'] as List<dynamic>? ?? <dynamic>[];

    return RightNowRecommendation(
      riverName: (river['name'] ?? '').toString(),
      primaryPattern: (primary['pattern'] ?? '').toString(),
      primaryType: (primary['type'] ?? '').toString(),
      primarySize: (primary['size'] as num?)?.toInt() ?? 0,
      explanation: (json['explanation'] ?? '').toString(),
      confidence: (json['confidence'] ?? '').toString(),
      alternatives: alternatives
          .whereType<Map<String, dynamic>>()
          .map(RecommendationAlternative.fromJson)
          .toList(),
      context: RecommendationContext.fromJson(
        (json['context_used'] as Map<String, dynamic>? ?? <String, dynamic>{}),
      ),
    );
  }
}
