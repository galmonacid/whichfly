import 'package:flutter/material.dart';

import 'config/app_config.dart';
import 'by_the_riverside_page.dart';
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
        useMaterial3: true,
        fontFamily: 'Georgia',
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF2F4B3D),
          onPrimary: Color(0xFFF9F7F0),
          secondary: Color(0xFF4E473E),
          onSecondary: Color(0xFFF9F7F0),
          surface: Color(0xFFFDFBF6),
          onSurface: Color(0xFF2E2A24),
        ),
        scaffoldBackgroundColor: Colors.transparent,
        cardTheme: const CardThemeData(
          color: Color(0xFFFDFBF6),
          surfaceTintColor: Colors.transparent,
          shadowColor: Color.fromRGBO(45, 39, 30, 0.08),
          elevation: 8,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(18)),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(10)),
            borderSide: BorderSide(color: Color(0xFFC8C0B4)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(10)),
            borderSide: BorderSide(color: Color(0xFFC8C0B4)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(10)),
            borderSide: BorderSide(color: Color(0xFF2F4B3D)),
          ),
          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
        textTheme: const TextTheme(
          bodyMedium: TextStyle(color: Color(0xFF2E2A24)),
          titleLarge: TextStyle(
            color: Color(0xFF2E2A24),
            fontWeight: FontWeight.w700,
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF2F4B3D),
            foregroundColor: const Color(0xFFF9F7F0),
            shape: const StadiumBorder(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            textStyle: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF2F4B3D),
            side: const BorderSide(color: Color(0xFF2F4B3D)),
            shape: const StadiumBorder(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF4E473E),
            shape: const StadiumBorder(),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          ),
        ),
      ),
      home: ByTheRiversidePage(
        api: api ?? HttpWhichFlyApi(baseUrl: AppConfig.normalizedApiBaseUrl),
        locationService: locationService ?? GeolocatorLocationService(),
      ),
    );
  }
}
