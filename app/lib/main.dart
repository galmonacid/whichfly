import 'package:flutter/material.dart';

import 'config/app_config.dart';
import 'right_now_page.dart';
import 'services/location_service.dart';
import 'services/whichfly_api.dart';

void main() {
  runApp(const WhichFlyApp());
}

class WhichFlyApp extends StatelessWidget {
  const WhichFlyApp({super.key, this.api, this.locationService});

  final WhichFlyApi? api;
  final LocationService? locationService;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'whichFly',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1E6A5B)),
      ),
      home: RightNowPage(
        api: api ?? HttpWhichFlyApi(baseUrl: AppConfig.normalizedApiBaseUrl),
        locationService: locationService ?? GeolocatorLocationService(),
      ),
    );
  }
}
