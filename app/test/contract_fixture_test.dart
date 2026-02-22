import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:whichfly_app/main.dart';
import 'package:whichfly_app/models/right_now_models.dart';
import 'package:whichfly_app/services/location_service.dart';
import 'package:whichfly_app/services/whichfly_api.dart';

class _FakeLocationService implements LocationService {
  const _FakeLocationService(this.outcome);

  final LocationOutcome outcome;

  @override
  Future<LocationOutcome> requestCurrentLocation() async => outcome;
}

class _FakeWhichFlyApi implements WhichFlyApi {
  const _FakeWhichFlyApi({
    required this.options,
    required this.suggestion,
    required this.recommendation,
  });

  final List<RiverOption> options;
  final RiverSuggestion suggestion;
  final RightNowRecommendation recommendation;

  @override
  Future<List<RiverOption>> fetchRiverOptions() async => options;

  @override
  Future<RightNowRecommendation> fetchRightNowRecommendation({
    required String riverName,
    String? riverReachId,
    required String waterLevel,
    GpsCoords? gps,
    bool? fishRising,
  }) async => recommendation;

  @override
  Future<RightNowRecommendation> fetchPlanningRecommendation({
    required String riverName,
    String? riverReachId,
    required String plannedDate,
  }) async => recommendation;

  @override
  Future<RiverSuggestion> suggestRiver({required GpsCoords gps}) async =>
      suggestion;
}

Future<Map<String, dynamic>> _loadGoldenResponseFixture() async {
  final file = File('../contracts/fixtures/right_now_response.golden.json');
  final exists = await file.exists();
  expect(
    exists,
    isTrue,
    reason:
        'Missing contract fixture at contracts/fixtures/right_now_response.golden.json',
  );

  final decoded = jsonDecode(await file.readAsString());
  expect(
    decoded,
    isA<Map<String, dynamic>>(),
    reason: 'Fixture must be a JSON object matching RightNowResponse schema.',
  );

  return (decoded as Map<dynamic, dynamic>).cast<String, dynamic>();
}

Future<void> _drainFrames(WidgetTester tester) async {
  // Avoid unbounded pumpAndSettle loops when the widget tree schedules frames.
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  late Map<String, dynamic> goldenFixture;
  late RightNowRecommendation goldenRecommendation;

  setUpAll(() async {
    goldenFixture = await _loadGoldenResponseFixture();
    goldenRecommendation = RightNowRecommendation.fromJson(goldenFixture);
  });

  test('golden response fixture parses with contract-critical fields', () async {
    final fixture = goldenFixture;

    expect(
      fixture.containsKey('river'),
      isTrue,
      reason: 'Contract drift: missing top-level `river`.',
    );
    expect(
      fixture.containsKey('primary'),
      isTrue,
      reason: 'Contract drift: missing top-level `primary`.',
    );
    expect(
      fixture.containsKey('alternatives'),
      isTrue,
      reason: 'Contract drift: missing top-level `alternatives`.',
    );
    expect(
      fixture.containsKey('explanation'),
      isTrue,
      reason: 'Contract drift: missing top-level `explanation`.',
    );
    expect(
      fixture.containsKey('confidence'),
      isTrue,
      reason: 'Contract drift: missing top-level `confidence`.',
    );
    expect(
      fixture.containsKey('context_used'),
      isTrue,
      reason: 'Contract drift: missing top-level `context_used`.',
    );

    final parsed = goldenRecommendation;
    expect(
      parsed.riverName,
      'River Test',
      reason: 'Fixture drift: expected river.name to remain `River Test`.',
    );
    expect(
      parsed.primaryPattern,
      'Pheasant Tail Nymph',
      reason:
          'Fixture drift: expected primary.pattern to remain `Pheasant Tail Nymph`.',
    );
    expect(
      parsed.primaryType,
      'nymph',
      reason: 'Fixture drift: expected primary.type to remain `nymph`.',
    );
    expect(
      parsed.primarySize,
      14,
      reason: 'Fixture drift: expected primary.size to remain `14`.',
    );
    expect(
      parsed.confidence,
      'medium',
      reason: 'Fixture drift: expected confidence to remain `medium`.',
    );
    expect(
      parsed.alternatives.length,
      2,
      reason: 'Contract drift: expected exactly 2 alternatives in fixture.',
    );
    expect(
      parsed.alternatives[1].pattern,
      'Parachute Adams',
      reason: 'Fixture drift: expected second alternative pattern.',
    );
    expect(
      parsed.context.daylight.minutesToSunset,
      95,
      reason: 'Fixture drift: expected context_used.daylight.minutes_to_sunset.',
    );
  });

  testWidgets('golden response fixture renders in right-now UI', (
    WidgetTester tester,
  ) async {
    final api = _FakeWhichFlyApi(
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
      recommendation: goldenRecommendation,
    );
    final location = _FakeLocationService(
      const LocationOutcome(
        gps: GpsCoords(lat: 51.05, lon: -1.31, accuracy: 25),
        message: 'Location acquired.',
      ),
    );

    await tester.pumpWidget(WhichFlyApp(api: api, locationService: location));
    await _drainFrames(tester);

    await tester.tap(find.byKey(const ValueKey<String>('confirmRiverButton')));
    await _drainFrames(tester);
    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('getFlyRecommendationButton')),
    );
    await _drainFrames(tester);
    await tester.tap(
      find.byKey(const ValueKey<String>('getFlyRecommendationButton')),
    );
    await _drainFrames(tester);

    expect(
      find.byKey(const ValueKey<String>('primaryPatternText')),
      findsOneWidget,
      reason: 'Render drift: primary pattern widget not found.',
    );
    expect(
      find.text('Pheasant Tail Nymph'),
      findsOneWidget,
      reason: 'Render drift: primary pattern text not rendered from fixture.',
    );
    expect(
      find.text('Parachute Adams (dry, size 16) If fish start rising near the surface'),
      findsOneWidget,
      reason: 'Render drift: second alternative text not rendered from fixture.',
    );
    expect(
      find.textContaining('A proven nymph pattern is a conservative default'),
      findsOneWidget,
      reason: 'Render drift: explanation text not rendered from fixture.',
    );
    expect(
      find.text(
        'Low confidence. If you can, add one quick observation to improve the call.',
      ),
      findsNothing,
      reason:
          'Render drift: low-confidence disclaimer should not show for medium confidence fixture.',
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('toggleContextButton')),
    );
    await _drainFrames(tester);
    await tester.tap(find.byKey(const ValueKey<String>('toggleContextButton')));
    await _drainFrames(tester);
    expect(
      find.byKey(const ValueKey<String>('contextPanel')),
      findsOneWidget,
      reason: 'Render drift: context panel not shown.',
    );
    expect(
      find.text('Temperature: 8.2 C'),
      findsOneWidget,
      reason: 'Render drift: context weather temperature mismatch.',
    );
    expect(
      find.text('Minutes to sunset: 95.0'),
      findsOneWidget,
      reason: 'Render drift: context daylight minutes mismatch.',
    );
  });
}
