import 'package:geolocator/geolocator.dart';

import '../models/by_the_riverside_models.dart';

class LocationOutcome {
  const LocationOutcome({required this.gps, required this.message});

  final GpsCoords? gps;
  final String message;
}

abstract class LocationService {
  Future<LocationOutcome> requestCurrentLocation();
}

class GeolocatorLocationService implements LocationService {
  @override
  Future<LocationOutcome> requestCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return const LocationOutcome(
        gps: null,
        message: 'Location unavailable. Select a river manually.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      return const LocationOutcome(
        gps: null,
        message: 'Location denied. Select a river manually.',
      );
    }

    if (permission == LocationPermission.deniedForever) {
      return const LocationOutcome(
        gps: null,
        message: 'Location denied permanently. Select a river manually.',
      );
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 8),
        ),
      );

      return LocationOutcome(
        gps: GpsCoords(
          lat: position.latitude,
          lon: position.longitude,
          accuracy: position.accuracy,
        ),
        message: 'Location acquired.',
      );
    } catch (_) {
      return const LocationOutcome(
        gps: null,
        message: 'Unable to get location. Select a river manually.',
      );
    }
  }
}
