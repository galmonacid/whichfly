import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter/widgets.dart';

import 'package:whichfly_app/main.dart';
import 'package:whichfly_app/models/by_the_riverside_models.dart';
import 'package:whichfly_app/services/location_service.dart';
import 'package:whichfly_app/services/whichfly_api.dart';

class FakeLocationService implements LocationService {
  FakeLocationService(this.outcome);

  final LocationOutcome outcome;

  @override
  Future<LocationOutcome> requestCurrentLocation() async => outcome;
}

class FakeWhichFlyApi implements WhichFlyApi {
  FakeWhichFlyApi({
    required this.options,
    required this.suggestion,
    required this.recommendation,
  });

  final List<RiverOption> options;
  final RiverSuggestion suggestion;
  final ByTheRiversideRecommendation recommendation;

  @override
  Future<List<RiverOption>> fetchRiverOptions() async => options;

  @override
  Future<ByTheRiversideRecommendation> fetchByTheRiversideRecommendation({
    required String riverName,
    String? riverReachId,
    required String waterLevel,
    GpsCoords? gps,
    bool? fishRising,
  }) async {
    return recommendation;
  }

  @override
  Future<ByTheRiversideRecommendation> fetchPlanningRecommendation({
    required String riverName,
    String? riverReachId,
    required String plannedDate,
  }) async {
    return recommendation;
  }

  @override
  Future<RiverSuggestion> suggestRiver({required GpsCoords gps}) async =>
      suggestion;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('happy path shows recommendation in by-the-riverside mode', (
    WidgetTester tester,
  ) async {
    final api = FakeWhichFlyApi(
      options: const [
        RiverOption(
          label: 'River Test - Upper section',
          riverName: 'River Test',
          reachId: 'river_test_upper',
        ),
      ],
      suggestion: const RiverSuggestion(
        name: 'River Test',
        confidence: 'high',
        distanceM: 1200,
        source: 'gps_suggested',
      ),
      recommendation: _sampleRecommendation,
    );
    final location = FakeLocationService(
      const LocationOutcome(
        gps: GpsCoords(lat: 51.05, lon: -1.31, accuracy: 25),
        message: 'Location acquired.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey<String>('confirmRiverButton')));
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey<String>('getFlyRecommendationButton')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Pheasant Tail Nymph'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('primaryPatternText')),
      findsOneWidget,
    );
  });
}

const ByTheRiversideRecommendation
_sampleRecommendation = ByTheRiversideRecommendation(
  riverName: 'River Test',
  primaryPattern: 'Pheasant Tail Nymph',
  primaryType: 'nymph',
  primarySize: 14,
  explanation:
      'A proven nymph pattern is a conservative default for mixed river trout conditions when no strong hatch signal is confirmed.',
  confidence: 'low',
  alternatives: [
    RecommendationAlternative(
      pattern: "Hare's Ear Nymph",
      type: 'nymph',
      size: 14,
      when: 'If fish are not taking the primary nymph',
    ),
  ],
  context: RecommendationContext(
    weather: WeatherContext(
      temperatureC: 8.2,
      precipitationMm: 0,
      cloudCoverPct: 40,
      windSpeedKph: 12,
    ),
    daylight: DaylightContext(isDaylight: true, minutesToSunset: 95),
  ),
);
