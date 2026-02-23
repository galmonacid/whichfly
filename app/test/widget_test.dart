import 'package:flutter_test/flutter_test.dart';
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
    this.failRiverOptions = false,
  });

  final List<RiverOption> options;
  final RiverSuggestion suggestion;
  final ByTheRiversideRecommendation recommendation;
  final bool failRiverOptions;

  String? lastRiverName;
  String? lastRiverReachId;
  String? lastWaterLevel;
  GpsCoords? lastGps;
  bool? lastFishRising;

  String? lastPlanningRiverName;
  String? lastPlanningRiverReachId;
  String? lastPlanningDate;

  @override
  Future<List<RiverOption>> fetchRiverOptions() async {
    if (failRiverOptions) {
      throw const ApiException('Unable to load river options.');
    }
    return options;
  }

  @override
  Future<ByTheRiversideRecommendation> fetchByTheRiversideRecommendation({
    required String riverName,
    String? riverReachId,
    required String waterLevel,
    GpsCoords? gps,
    bool? fishRising,
  }) async {
    lastRiverName = riverName;
    lastRiverReachId = riverReachId;
    lastWaterLevel = waterLevel;
    lastGps = gps;
    lastFishRising = fishRising;
    return recommendation;
  }

  @override
  Future<ByTheRiversideRecommendation> fetchPlanningRecommendation({
    required String riverName,
    String? riverReachId,
    required String plannedDate,
  }) async {
    lastPlanningRiverName = riverName;
    lastPlanningRiverReachId = riverReachId;
    lastPlanningDate = plannedDate;
    return recommendation;
  }

  @override
  Future<RiverSuggestion> suggestRiver({required GpsCoords gps}) async =>
      suggestion;
}

void main() {
  testWidgets('shows manual selector when location is denied', (
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
        gps: null,
        message: 'Location denied. Select a river manually.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await tester.pumpAndSettle();

    expect(
      find.text('Location denied. Select a river manually.'),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('manualRiverSearchField')),
      findsOneWidget,
    );
  });

  testWidgets('shows manual selector when location is denied forever', (
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
        gps: null,
        message: 'Location denied permanently. Select a river manually.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await tester.pumpAndSettle();

    expect(
      find.text('Location denied permanently. Select a river manually.'),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('manualRiverSearchField')),
      findsOneWidget,
    );
  });

  testWidgets('loads and renders by the riverside recommendation after confirm', (
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

    expect(
      find.byKey(const ValueKey<String>('confirmRiverButton')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey<String>('confirmRiverButton')));
    await tester.pumpAndSettle();

    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('getFlyRecommendationButton')),
    );
    await tester.tap(
      find.byKey(const ValueKey<String>('getFlyRecommendationButton')),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey<String>('primaryPatternText')),
      findsOneWidget,
    );
    expect(find.text('Pheasant Tail Nymph'), findsOneWidget);
    expect(
      find.text(
        'Low confidence. If you can, add one quick observation to improve the call.',
      ),
      findsOneWidget,
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('toggleContextButton')),
    );
    await tester.tap(find.byKey(const ValueKey<String>('toggleContextButton')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey<String>('contextPanel')), findsOneWidget);

    expect(api.lastRiverName, 'River Test');
    expect(api.lastWaterLevel, 'normal');
    expect(api.lastFishRising, isNull);
    expect(api.lastGps, isNotNull);
  });

  testWidgets('falls back to manual selector when GPS suggestion is unknown', (
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
        name: 'Unknown',
        confidence: 'low',
        distanceM: null,
        source: 'unknown',
      ),
      recommendation: _sampleRecommendation,
    );
    final location = FakeLocationService(
      const LocationOutcome(
        gps: GpsCoords(lat: 40.4168, lon: -3.7038, accuracy: 35),
        message: 'Location acquired.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'No nearby UK river found from location. Select a river manually.',
      ),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('manualRiverSearchField')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('confirmRiverButton')),
      findsNothing,
    );
  });

  testWidgets('shows matching river suggestions while typing', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(800, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final api = FakeWhichFlyApi(
      options: const [
        RiverOption(
          label: 'River Itchen - Upper section',
          riverName: 'River Itchen',
          reachId: 'river_itchen_upper',
        ),
        RiverOption(
          label: 'River Test - Upper section',
          riverName: 'River Test',
          reachId: 'river_test_upper',
        ),
      ],
      suggestion: const RiverSuggestion(
        name: '',
        confidence: 'low',
        distanceM: null,
        source: 'unknown',
      ),
      recommendation: _sampleRecommendation,
    );
    final location = FakeLocationService(
      const LocationOutcome(
        gps: null,
        message: 'Location denied. Select a river manually.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey<String>('manualRiverSearchField')),
      'itch',
    );
    await tester.pumpAndSettle();

    expect(find.text('River Itchen - Upper section'), findsOneWidget);
    expect(find.text('River Test - Upper section'), findsNothing);

    await tester.tap(find.text('River Itchen - Upper section'));
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey<String>('getFlyRecommendationButton')),
    );
    await tester.pumpAndSettle();

    expect(api.lastRiverName, 'River Itchen');
    expect(api.lastRiverReachId, 'river_itchen_upper');
  });

  testWidgets('shows river catalog retry when options fail to load', (
    WidgetTester tester,
  ) async {
    final api = FakeWhichFlyApi(
      options: const [],
      suggestion: const RiverSuggestion(
        name: '',
        confidence: 'low',
        distanceM: null,
        source: 'unknown',
      ),
      recommendation: _sampleRecommendation,
      failRiverOptions: true,
    );
    final location = FakeLocationService(
      const LocationOutcome(
        gps: null,
        message: 'Location denied. Select a river manually.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey<String>('manualRiverTextField')),
      findsOneWidget,
    );
    expect(
      find.text(
        'Unable to load river catalog. Check API connection and retry.',
      ),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('retryRiverOptionsButton')),
      findsOneWidget,
    );
  });

  testWidgets('loads planning recommendation in planning mode', (
    WidgetTester tester,
  ) async {
    final api = FakeWhichFlyApi(
      options: const [
        RiverOption(
          label: 'River Itchen - Upper section',
          riverName: 'River Itchen',
          reachId: 'river_itchen_upper',
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
        gps: null,
        message: 'Location denied. Select a river manually.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey<String>('modePlanningButton')));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey<String>('planningDateField')),
      findsOneWidget,
    );

    await tester.enterText(
      find.byKey(const ValueKey<String>('planningDateField')),
      '2026-04-15',
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('getPlanningRecommendationButton')),
    );
    await tester.tap(
      find.byKey(const ValueKey<String>('getPlanningRecommendationButton')),
    );
    await tester.pumpAndSettle();

    expect(api.lastPlanningRiverName, 'River Itchen');
    expect(api.lastPlanningRiverReachId, 'river_itchen_upper');
    expect(api.lastPlanningDate, '2026-04-15');
    expect(find.text('Pheasant Tail Nymph'), findsOneWidget);
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
