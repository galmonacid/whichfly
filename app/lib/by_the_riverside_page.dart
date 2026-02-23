import 'package:flutter/material.dart';

import 'models/by_the_riverside_models.dart';
import 'services/location_service.dart';
import 'services/whichfly_api.dart';

enum AppMode { byTheRiverside, planning }

class _UiPalette {
  static const Color text = Color(0xFF2E2A24);
  static const Color muted = Color(0xFF6B6256);
  static const Color subhead = Color(0xFF4E473E);
  static const Color primary = Color(0xFF2F4B3D);
  static const Color pageTop = Color(0xFFF5F2EA);
  static const Color pageMid = Color(0xFFE5E1D6);
  static const Color pageBottom = Color(0xFFD6D2C6);
  static const Color toggleBg = Color(0xFFEFECE4);
  static const Color toggleBorder = Color(0xFFD9D0C2);
  static const Color confidenceBg = Color(0xFFF2EDE3);
  static const Color confidenceBorder = Color(0xFFC8C0B4);
}

class ByTheRiversidePage extends StatefulWidget {
  const ByTheRiversidePage({
    super.key,
    required this.api,
    required this.locationService,
  });

  final WhichFlyApi api;
  final LocationService locationService;

  @override
  State<ByTheRiversidePage> createState() => _ByTheRiversidePageState();
}

class _ByTheRiversidePageState extends State<ByTheRiversidePage> {
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

  AppMode _mode = AppMode.byTheRiverside;
  String _riverStatus = 'Requesting location...';
  String _waterLevel = 'normal';
  String _fishRising = 'unknown';

  bool _showManualSelector = false;
  bool _showContext = false;
  bool _isLoadingRecommendation = false;
  bool _isLoadingRiverOptions = false;

  String? _requestError;
  String? _riverOptionsError;
  ByTheRiversideRecommendation? _recommendation;

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
    setState(() {
      _isLoadingRiverOptions = true;
      _riverOptionsError = null;
    });

    try {
      final options = await widget.api.fetchRiverOptions();
      if (!mounted) return;
      setState(() {
        _riverOptions = options;
        _isLoadingRiverOptions = false;
        _planningSelection =
            _planningSelection ?? (options.isNotEmpty ? options.first : null);
        if (_planningSelection != null &&
            _planningRiverController.text.trim().isEmpty) {
          _planningRiverController.text = _planningSelection!.label;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _riverOptions = <RiverOption>[];
        _isLoadingRiverOptions = false;
        _riverOptionsError =
            'Unable to load river catalog. Check API connection and retry.';
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
      final suggestionName = suggestion.name.trim();
      if (suggestionName.isEmpty || suggestionName.toLowerCase() == 'unknown') {
        setState(() {
          _riverStatus =
              'No nearby UK river found from location. Select a river manually.';
          _showManualSelector = true;
        });
        if (_riverOptions.isEmpty && !_isLoadingRiverOptions) {
          _loadRiverOptions();
        }
        return;
      }
      setState(() {
        _suggestedRiver = suggestionName;
        _confirmedRiver = null;
        _showManualSelector = false;
        _riverStatus = 'Suggested river: $suggestionName';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _riverStatus = 'Unable to suggest a river. Select a river manually.';
        _showManualSelector = true;
        _suggestedRiver = null;
        _confirmedRiver = null;
      });
      if (_riverOptions.isEmpty && !_isLoadingRiverOptions) {
        _loadRiverOptions();
      }
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
    if (_riverOptions.isEmpty && !_isLoadingRiverOptions) {
      _loadRiverOptions();
    }
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

  (String riverName, String? reachId)? _selectedByTheRiversideRiverContext() {
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

  Future<void> _getByTheRiversideRecommendation() async {
    final context = _selectedByTheRiversideRiverContext();
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
      final recommendation = await widget.api.fetchByTheRiversideRecommendation(
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

  bool _queryMatchesOption(String query, RiverOption option) {
    final normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.isEmpty) return false;
    return normalizedQuery == option.label.toLowerCase() ||
        normalizedQuery == option.riverName.toLowerCase();
  }

  List<RiverOption> _filteredRiverOptions(String query) {
    final normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.isEmpty) return <RiverOption>[];

    return _riverOptions
        .where(
          (option) =>
              option.label.toLowerCase().contains(normalizedQuery) ||
              option.riverName.toLowerCase().contains(normalizedQuery),
        )
        .take(8)
        .toList();
  }

  Widget _buildRiverSearchField({
    required Key fieldKey,
    required TextEditingController controller,
    required RiverOption? selectedOption,
    required ValueChanged<RiverOption?> onSelectionChanged,
  }) {
    final query = controller.text.trim();
    final suggestions = _filteredRiverOptions(query);
    final showSuggestions =
        query.isNotEmpty &&
        (selectedOption == null || !_queryMatchesOption(query, selectedOption));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          key: fieldKey,
          controller: controller,
          decoration: const InputDecoration(labelText: 'River name'),
          onChanged: (value) {
            if (selectedOption != null &&
                !_queryMatchesOption(value, selectedOption)) {
              onSelectionChanged(null);
              return;
            }
            setState(() {});
          },
        ),
        if (showSuggestions) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _UiPalette.toggleBorder),
              color: Colors.white.withOpacity(0.7),
            ),
            child: suggestions.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text(
                      'No rivers match that search.',
                      key: ValueKey<String>('riverSearchNoResultsText'),
                      style: TextStyle(color: _UiPalette.muted),
                    ),
                  )
                : Column(
                    children: suggestions
                        .map(
                          (option) => ListTile(
                            key: ValueKey<String>(
                              'riverSuggestion-${option.reachId ?? option.riverName}',
                            ),
                            dense: true,
                            title: Text(option.label),
                            onTap: () {
                              controller.text = option.label;
                              controller.selection = TextSelection.collapsed(
                                offset: controller.text.length,
                              );
                              onSelectionChanged(option);
                              FocusScope.of(context).unfocus();
                            },
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
      ],
    );
  }

  String _contextRiverLabel() {
    if (_mode == AppMode.planning) {
      final planningContext = _selectedPlanningRiverContext();
      return _planningSelection?.label ?? planningContext?.$1 ?? 'Unavailable';
    }
    final byTheRiversideContext = _selectedByTheRiversideRiverContext();
    return _confirmedRiver ??
        _manualSelection?.label ??
        byTheRiversideContext?.$1 ??
        'Unavailable';
  }

  @override
  Widget build(BuildContext context) {
    final recommendation = _recommendation;
    final isPlanning = _mode == AppMode.planning;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -1),
            radius: 1.25,
            colors: [
              _UiPalette.pageTop,
              _UiPalette.pageMid,
              _UiPalette.pageBottom,
            ],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 36),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildPageHeader(),
                    const SizedBox(height: 20),
                    if (isPlanning)
                      _buildPlanningCard()
                    else
                      _buildByTheRiversideCard(),
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
                                  : _getByTheRiversideRecommendation),
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
                          color: _UiPalette.confidenceBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _UiPalette.confidenceBorder,
                            style: BorderStyle.solid,
                          ),
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
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPageHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: _UiPalette.primary,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'WHICHFLY',
              style: TextStyle(
                color: _UiPalette.text,
                letterSpacing: 2.8,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        const Text(
          'Fly choice for UK river trout',
          style: const TextStyle(
            color: _UiPalette.subhead,
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Choose your mode to get recommendations.',
          style: TextStyle(color: _UiPalette.muted, fontSize: 14),
        ),
        const SizedBox(height: 14),
        _buildModeToggle(),
      ],
    );
  }

  Widget _buildModeToggle() {
    return Container(
      decoration: BoxDecoration(
        color: _UiPalette.toggleBg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _UiPalette.toggleBorder),
      ),
      padding: const EdgeInsets.all(6),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _buildModeButton(
            key: const ValueKey<String>('modeRiversideButton'),
            selected: _mode == AppMode.byTheRiverside,
            label: 'By the riverside',
            onPressed: () => _setMode(AppMode.byTheRiverside),
          ),
          _buildModeButton(
            key: const ValueKey<String>('modePlanningButton'),
            selected: _mode == AppMode.planning,
            label: 'Planning a trip',
            onPressed: () => _setMode(AppMode.planning),
          ),
        ],
      ),
    );
  }

  Widget _buildModeButton({
    required Key key,
    required bool selected,
    required String label,
    required VoidCallback onPressed,
  }) {
    return TextButton(
      key: key,
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: selected
            ? const Color(0xFFF5F1E8)
            : _UiPalette.subhead,
        backgroundColor: selected ? _UiPalette.primary : Colors.transparent,
        textStyle: const TextStyle(fontSize: 15),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      ),
      child: Text(label),
    );
  }

  Widget _buildByTheRiversideCard() {
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
              if (_isLoadingRiverOptions)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: LinearProgressIndicator(minHeight: 3),
                ),
              if (_riverOptions.isNotEmpty)
                _buildRiverSearchField(
                  fieldKey: const ValueKey<String>('manualRiverSearchField'),
                  controller: _manualRiverController,
                  selectedOption: _manualSelection,
                  onSelectionChanged: (value) {
                    setState(() {
                      _manualSelection = value;
                    });
                  },
                )
              else
                TextField(
                  key: const ValueKey<String>('manualRiverTextField'),
                  controller: _manualRiverController,
                  decoration: const InputDecoration(labelText: 'River name'),
                ),
              if (_riverOptions.isEmpty && _riverOptionsError != null) ...[
                const SizedBox(height: 8),
                Text(
                  _riverOptionsError!,
                  style: const TextStyle(color: Colors.red),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  key: const ValueKey<String>('retryRiverOptionsButton'),
                  onPressed: _isLoadingRiverOptions ? null : _loadRiverOptions,
                  child: const Text('Retry river catalog'),
                ),
              ],
            ],
            const SizedBox(height: 14),
            const Text('Water level'),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              key: const ValueKey<String>('waterLevelDropdown'),
              initialValue: _waterLevel,
              isExpanded: true,
              decoration: const InputDecoration(),
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
              isExpanded: true,
              decoration: const InputDecoration(),
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
              'Planning a trip',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            const Text('River'),
            const SizedBox(height: 6),
            if (_riverOptions.isNotEmpty)
              _buildRiverSearchField(
                fieldKey: const ValueKey<String>('planningRiverSearchField'),
                controller: _planningRiverController,
                selectedOption: _planningSelection,
                onSelectionChanged: (value) {
                  setState(() {
                    _planningSelection = value;
                  });
                },
              )
            else
              TextField(
                key: const ValueKey<String>('planningRiverTextField'),
                controller: _planningRiverController,
                decoration: const InputDecoration(labelText: 'River name'),
              ),
            if (_riverOptions.isEmpty && _riverOptionsError != null) ...[
              const SizedBox(height: 8),
              Text(
                _riverOptionsError!,
                style: const TextStyle(color: Colors.red),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                key: const ValueKey<String>('retryPlanningRiverOptionsButton'),
                onPressed: _isLoadingRiverOptions ? null : _loadRiverOptions,
                child: const Text('Retry river catalog'),
              ),
            ],
            const SizedBox(height: 14),
            const Text('Date'),
            const SizedBox(height: 6),
            TextField(
              key: const ValueKey<String>('planningDateField'),
              controller: _planningDateController,
              decoration: const InputDecoration(hintText: 'YYYY-MM-DD'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecommendationCard(
    ByTheRiversideRecommendation? recommendation, {
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

  Widget _buildContextCard(ByTheRiversideRecommendation recommendation) {
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
