import 'package:flutter/material.dart';

import 'models/right_now_models.dart';
import 'services/location_service.dart';
import 'services/whichfly_api.dart';

enum AppMode { rightNow, planning }

class RightNowPage extends StatefulWidget {
  const RightNowPage({
    super.key,
    required this.api,
    required this.locationService,
  });

  final WhichFlyApi api;
  final LocationService locationService;

  @override
  State<RightNowPage> createState() => _RightNowPageState();
}

class _RightNowPageState extends State<RightNowPage> {
  final TextEditingController _manualRiverController = TextEditingController();
  final TextEditingController _planningRiverController =
      TextEditingController();
  final TextEditingController _planningDateController = TextEditingController();

  List<RiverOption> _riverOptions = <RiverOption>[];
  RiverOption? _manualSelection;
  RiverOption? _planningSelection;
  GpsCoords? _gps;
  String? _suggestedRiver;
  String? _confirmedRiver;

  AppMode _mode = AppMode.rightNow;
  String _riverStatus = 'Requesting location...';
  String _waterLevel = 'normal';
  String _fishRising = 'unknown';

  bool _showManualSelector = false;
  bool _showContext = false;
  bool _isLoadingRecommendation = false;

  String? _requestError;
  RightNowRecommendation? _recommendation;

  @override
  void initState() {
    super.initState();
    _planningDateController.text = _formatDate(DateTime.now());
    _loadRiverOptions();
    _requestLocationAndSuggestion();
  }

  @override
  void dispose() {
    _manualRiverController.dispose();
    _planningRiverController.dispose();
    _planningDateController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime date) {
    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  Future<void> _loadRiverOptions() async {
    try {
      final options = await widget.api.fetchRiverOptions();
      if (!mounted) return;
      setState(() {
        _riverOptions = options;
        _planningSelection =
            _planningSelection ?? (options.isNotEmpty ? options.first : null);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _riverOptions = <RiverOption>[];
      });
    }
  }

  Future<void> _requestLocationAndSuggestion() async {
    final location = await widget.locationService.requestCurrentLocation();
    if (!mounted) return;

    if (location.gps == null) {
      setState(() {
        _gps = null;
        _riverStatus = location.message;
        _showManualSelector = true;
        _suggestedRiver = null;
        _confirmedRiver = null;
      });
      return;
    }

    setState(() {
      _gps = location.gps;
    });

    try {
      final suggestion = await widget.api.suggestRiver(gps: location.gps!);
      if (!mounted) return;
      if (suggestion.name.isEmpty) {
        setState(() {
          _riverStatus = 'Unable to suggest a river. Select a river manually.';
          _showManualSelector = true;
        });
        return;
      }
      setState(() {
        _suggestedRiver = suggestion.name;
        _confirmedRiver = null;
        _showManualSelector = false;
        _riverStatus = 'Suggested river: ${suggestion.name}';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _riverStatus = 'Unable to suggest a river. Select a river manually.';
        _showManualSelector = true;
        _suggestedRiver = null;
        _confirmedRiver = null;
      });
    }
  }

  void _confirmSuggestedRiver() {
    if (_suggestedRiver == null) return;
    setState(() {
      _confirmedRiver = _suggestedRiver;
      _riverStatus = 'Suggested river: $_suggestedRiver (confirmed)';
    });
  }

  void _switchToManualSelection() {
    setState(() {
      _showManualSelector = true;
      _confirmedRiver = null;
      _riverStatus = 'Choose a river.';
    });
  }

  void _setMode(AppMode mode) {
    setState(() {
      _mode = mode;
      _requestError = null;
      _recommendation = null;
      _showContext = false;
    });
  }

  bool? _fishRisingValue() {
    if (_fishRising == 'yes') return true;
    if (_fishRising == 'no') return false;
    return null;
  }

  (String riverName, String? reachId)? _selectedRightNowRiverContext() {
    if (_confirmedRiver != null && _confirmedRiver!.isNotEmpty) {
      return (_confirmedRiver!, null);
    }

    if (_manualSelection != null) {
      return (_manualSelection!.riverName, _manualSelection!.reachId);
    }

    final manualName = _manualRiverController.text.trim();
    if (manualName.isNotEmpty) {
      return (manualName, null);
    }

    return null;
  }

  (String riverName, String? reachId)? _selectedPlanningRiverContext() {
    if (_planningSelection != null) {
      return (_planningSelection!.riverName, _planningSelection!.reachId);
    }

    final manualName = _planningRiverController.text.trim();
    if (manualName.isNotEmpty) {
      return (manualName, null);
    }

    return null;
  }

  Future<void> _getRightNowRecommendation() async {
    final context = _selectedRightNowRiverContext();
    if (context == null) {
      setState(() {
        _requestError = 'Select a river to continue.';
        _recommendation = null;
      });
      return;
    }

    setState(() {
      _isLoadingRecommendation = true;
      _requestError = null;
      _recommendation = null;
      _showContext = false;
    });

    try {
      final recommendation = await widget.api.fetchRightNowRecommendation(
        riverName: context.$1,
        riverReachId: context.$2,
        waterLevel: _waterLevel,
        gps: _gps,
        fishRising: _fishRisingValue(),
      );
      if (!mounted) return;
      setState(() {
        _recommendation = recommendation;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _requestError = error.toString().replaceFirst('Exception: ', '');
        _recommendation = null;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingRecommendation = false;
        });
      }
    }
  }

  Future<void> _getPlanningRecommendation() async {
    final context = _selectedPlanningRiverContext();
    final plannedDate = _planningDateController.text.trim();

    if (context == null || plannedDate.isEmpty) {
      setState(() {
        _requestError = 'Select a date and river to continue.';
        _recommendation = null;
      });
      return;
    }

    setState(() {
      _isLoadingRecommendation = true;
      _requestError = null;
      _recommendation = null;
      _showContext = false;
    });

    try {
      final recommendation = await widget.api.fetchPlanningRecommendation(
        riverName: context.$1,
        riverReachId: context.$2,
        plannedDate: plannedDate,
      );
      if (!mounted) return;
      setState(() {
        _recommendation = recommendation;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _requestError = error.toString().replaceFirst('Exception: ', '');
        _recommendation = null;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingRecommendation = false;
        });
      }
    }
  }

  String _formatValue(num? value, {String suffix = ''}) {
    if (value == null) return 'Unavailable';
    return '${value.toString()}$suffix';
  }

  String _formatDaylight(bool? value) {
    if (value == null) return 'Unavailable';
    return value ? 'Yes' : 'No';
  }

  String _fishRisingLabel() {
    if (_fishRising == 'yes') return 'Yes';
    if (_fishRising == 'no') return 'No';
    return 'Not sure';
  }

  String _contextRiverLabel() {
    if (_mode == AppMode.planning) {
      final planningContext = _selectedPlanningRiverContext();
      return _planningSelection?.label ?? planningContext?.$1 ?? 'Unavailable';
    }
    final rightNowContext = _selectedRightNowRiverContext();
    return _confirmedRiver ??
        _manualSelection?.label ??
        rightNowContext?.$1 ??
        'Unavailable';
  }

  @override
  Widget build(BuildContext context) {
    final recommendation = _recommendation;
    final isPlanning = _mode == AppMode.planning;

    return Scaffold(
      appBar: AppBar(title: const Text('whichFly')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildModeToggle(),
            const SizedBox(height: 16),
            Text(
              isPlanning ? 'Planning a trip' : 'By the riverside now',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              isPlanning
                  ? 'Planning flow for UK river trout.'
                  : 'Right now flow for UK river trout.',
            ),
            const SizedBox(height: 20),
            if (isPlanning) _buildPlanningCard() else _buildRightNowCard(),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: ValueKey<String>(
                  isPlanning
                      ? 'getPlanningRecommendationButton'
                      : 'getFlyRecommendationButton',
                ),
                onPressed: _isLoadingRecommendation
                    ? null
                    : (isPlanning
                          ? _getPlanningRecommendation
                          : _getRightNowRecommendation),
                child: Text(
                  _isLoadingRecommendation
                      ? 'Loading...'
                      : (isPlanning
                            ? 'Get planning fly recommendation'
                            : 'Get fly recommendation'),
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (recommendation?.confidence == 'low')
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: const Text(
                  'Low confidence. If you can, add one quick observation to improve the call.',
                ),
              ),
            _buildRecommendationCard(
              recommendation,
              emptyMessage: isPlanning
                  ? 'Select a date and river to request a recommendation.'
                  : 'Select water level and request a recommendation.',
            ),
            if (recommendation != null) ...[
              const SizedBox(height: 12),
              TextButton(
                key: const ValueKey<String>('toggleContextButton'),
                onPressed: () {
                  setState(() {
                    _showContext = !_showContext;
                  });
                },
                child: Text(
                  _showContext ? 'Hide context' : 'Show context used',
                ),
              ),
            ],
            if (_showContext && recommendation != null)
              _buildContextCard(recommendation),
          ],
        ),
      ),
    );
  }

  Widget _buildModeToggle() {
    return Row(
      children: [
        Expanded(
          child: FilledButton(
            key: const ValueKey<String>('modeRiversideButton'),
            onPressed: () => _setMode(AppMode.rightNow),
            style: FilledButton.styleFrom(
              backgroundColor: _mode == AppMode.rightNow
                  ? null
                  : Colors.grey.shade300,
              foregroundColor: _mode == AppMode.rightNow
                  ? null
                  : Colors.black87,
            ),
            child: const Text('By the riverside now'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FilledButton(
            key: const ValueKey<String>('modePlanningButton'),
            onPressed: () => _setMode(AppMode.planning),
            style: FilledButton.styleFrom(
              backgroundColor: _mode == AppMode.planning
                  ? null
                  : Colors.grey.shade300,
              foregroundColor: _mode == AppMode.planning
                  ? null
                  : Colors.black87,
            ),
            child: const Text('Planning a trip'),
          ),
        ),
      ],
    );
  }

  Widget _buildRightNowCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Conditions',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            const Text('River'),
            const SizedBox(height: 6),
            Text(_riverStatus, key: const ValueKey<String>('riverStatusText')),
            const SizedBox(height: 8),
            if (_suggestedRiver != null &&
                _confirmedRiver == null &&
                !_showManualSelector)
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton(
                    key: const ValueKey<String>('confirmRiverButton'),
                    onPressed: _confirmSuggestedRiver,
                    child: const Text('Confirm'),
                  ),
                  OutlinedButton(
                    key: const ValueKey<String>('changeRiverButton'),
                    onPressed: _switchToManualSelection,
                    child: const Text('Change'),
                  ),
                ],
              ),
            if (_confirmedRiver != null)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  key: const ValueKey<String>('changeRiverButton'),
                  onPressed: _switchToManualSelection,
                  child: const Text('Change river'),
                ),
              ),
            if (_showManualSelector) ...[
              const SizedBox(height: 8),
              if (_riverOptions.isNotEmpty)
                DropdownButtonFormField<RiverOption>(
                  key: const ValueKey<String>('manualRiverDropdown'),
                  initialValue: _manualSelection,
                  decoration: const InputDecoration(
                    labelText: 'Select river',
                    border: OutlineInputBorder(),
                  ),
                  items: _riverOptions
                      .map(
                        (option) => DropdownMenuItem<RiverOption>(
                          value: option,
                          child: Text(option.label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _manualSelection = value;
                    });
                  },
                )
              else
                TextField(
                  key: const ValueKey<String>('manualRiverTextField'),
                  controller: _manualRiverController,
                  decoration: const InputDecoration(
                    labelText: 'River name',
                    border: OutlineInputBorder(),
                  ),
                ),
            ],
            const SizedBox(height: 14),
            const Text('Water level'),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              key: const ValueKey<String>('waterLevelDropdown'),
              initialValue: _waterLevel,
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'low', child: Text('Low')),
                DropdownMenuItem(value: 'normal', child: Text('Normal')),
                DropdownMenuItem(value: 'high', child: Text('High')),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  _waterLevel = value;
                });
              },
            ),
            const SizedBox(height: 14),
            const Text('Are fish rising?'),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              key: const ValueKey<String>('fishRisingDropdown'),
              initialValue: _fishRising,
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'yes', child: Text('Yes')),
                DropdownMenuItem(value: 'no', child: Text('No')),
                DropdownMenuItem(value: 'unknown', child: Text('Not sure')),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  _fishRising = value;
                });
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanningCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Planning',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            const Text('River'),
            const SizedBox(height: 6),
            if (_riverOptions.isNotEmpty)
              DropdownButtonFormField<RiverOption>(
                key: const ValueKey<String>('planningRiverDropdown'),
                initialValue: _planningSelection,
                decoration: const InputDecoration(
                  labelText: 'Select river',
                  border: OutlineInputBorder(),
                ),
                items: _riverOptions
                    .map(
                      (option) => DropdownMenuItem<RiverOption>(
                        value: option,
                        child: Text(option.label),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  setState(() {
                    _planningSelection = value;
                  });
                },
              )
            else
              TextField(
                key: const ValueKey<String>('planningRiverTextField'),
                controller: _planningRiverController,
                decoration: const InputDecoration(
                  labelText: 'River name',
                  border: OutlineInputBorder(),
                ),
              ),
            const SizedBox(height: 14),
            const Text('Date'),
            const SizedBox(height: 6),
            TextField(
              key: const ValueKey<String>('planningDateField'),
              controller: _planningDateController,
              decoration: const InputDecoration(
                hintText: 'YYYY-MM-DD',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecommendationCard(
    RightNowRecommendation? recommendation, {
    required String emptyMessage,
  }) {
    if (_isLoadingRecommendation) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (_requestError != null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            _requestError!,
            style: const TextStyle(color: Colors.red),
          ),
        ),
      );
    }

    if (recommendation == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(emptyMessage),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Suggested river: ${recommendation.riverName}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            Text(
              recommendation.primaryPattern,
              key: const ValueKey<String>('primaryPatternText'),
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            Text(
              '${recommendation.primaryType} · size ${recommendation.primarySize}',
            ),
            const SizedBox(height: 12),
            Text(recommendation.explanation),
            const SizedBox(height: 14),
            const Text(
              'Alternatives',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            ...recommendation.alternatives.map(
              (alternative) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${alternative.pattern} (${alternative.type}, size ${alternative.size}) ${alternative.when}',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContextCard(RightNowRecommendation recommendation) {
    final context = recommendation.context;
    final weather = context.weather;
    final daylight = context.daylight;

    final isPlanning = _mode == AppMode.planning;
    final fishLabel = isPlanning ? 'Unavailable' : _fishRisingLabel();
    final plannedDate = isPlanning
        ? (_planningDateController.text.trim().isEmpty
              ? 'Unavailable'
              : _planningDateController.text.trim())
        : null;

    return Card(
      key: const ValueKey<String>('contextPanel'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Inputs', style: TextStyle(fontWeight: FontWeight.w600)),
            Text('River: ${_contextRiverLabel()}'),
            Text('Fish rising: $fishLabel'),
            if (plannedDate != null) Text('Date: $plannedDate'),
            const SizedBox(height: 10),
            const Text(
              'Weather',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            Text(
              'Temperature: ${_formatValue(weather.temperatureC, suffix: ' C')}',
            ),
            Text(
              'Precipitation: ${_formatValue(weather.precipitationMm, suffix: ' mm')}',
            ),
            Text(
              'Cloud cover: ${_formatValue(weather.cloudCoverPct, suffix: ' %')}',
            ),
            Text(
              'Wind: ${_formatValue(weather.windSpeedKph, suffix: ' km/h')}',
            ),
            const SizedBox(height: 10),
            const Text(
              'Daylight',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            Text('Daylight: ${_formatDaylight(daylight.isDaylight)}'),
            Text(
              'Minutes to sunset: ${_formatValue(daylight.minutesToSunset)}',
            ),
          ],
        ),
      ),
    );
  }
}
