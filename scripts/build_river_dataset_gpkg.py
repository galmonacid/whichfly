#!/usr/bin/env python3
import os
import sqlite3
import struct
import sys
from pathlib import Path
from math import radians, sin, cos, atan2, sqrt

EARTH_RADIUS_M = 6371000
LONG_RIVER_M = 80000
MEDIUM_RIVER_M = 30000
MIN_SUGGESTABLE_LENGTH_M = int(os.getenv("MIN_SUGGESTABLE_LENGTH_M", "3000"))
EXCLUDE_NAME_TOKENS = [token.strip().lower() for token in os.getenv(
    "EXCLUDE_NAME_TOKENS",
    "ditch,drain,dyke,channel,culvert,spillway,sluice"
).split(",") if token.strip()]
ALLOWED_FORMS = {form.strip().lower() for form in os.getenv(
    "ALLOWED_FORMS",
    "inlandRiver"
).split(",") if form.strip()}

DEFAULT_GB_GPKG = "data/sources/gb_open_rivers.gpkg"
DEFAULT_GB_FALLBACK = "data/sources/oprvrs_gb.gpkg"
DEFAULT_NI_GPKG = "data/sources/ni_rivers.gpkg"
DEFAULT_OUT = "data/uk_river_reaches.json"

GB_PRIMARY_FIELDS = [field.strip() for field in os.getenv(
    "GB_PRIMARY_FIELDS",
    "watercourse_name_alternative"
).split(",") if field.strip()]
GB_ALT_FIELDS = [field.strip() for field in os.getenv(
    "GB_ALT_FIELDS",
    "watercourse_name"
).split(",") if field.strip()]
NI_PRIMARY_FIELDS = [field.strip() for field in os.getenv(
    "NI_PRIMARY_FIELDS",
    "name,Name,river_name,RIVER_NAME"
).split(",") if field.strip()]
NI_ALT_FIELDS = [field.strip() for field in os.getenv(
    "NI_ALT_FIELDS",
    ""
).split(",") if field.strip()]

GB_LAYER = os.getenv("GB_LAYER", "watercourse_link")
NI_LAYER = os.getenv("NI_LAYER", None)


def slugify(value: str) -> str:
    value = value.lower()
    cleaned = []
    prev_dash = False
    for ch in value:
        if ch.isalnum():
            cleaned.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                cleaned.append("-")
                prev_dash = True
    slug = "".join(cleaned).strip("-")
    return slug or "river"


def haversine_distance(lat1, lon1, lat2, lon2):
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_M * c


def planar_distance(x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    return sqrt(dx * dx + dy * dy)


def line_length(coords, srs_id=None):
    total = 0.0
    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1]
        lon2, lat2 = coords[i]
        if srs_id == 27700:
            total += planar_distance(lon1, lat1, lon2, lat2)
        else:
            total += haversine_distance(lat1, lon1, lat2, lon2)
    return total


def coordinate_at_distance(coords, target_distance, srs_id=None):
    travelled = 0.0
    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1]
        lon2, lat2 = coords[i]
        if srs_id == 27700:
            segment_length = planar_distance(lon1, lat1, lon2, lat2)
        else:
            segment_length = haversine_distance(lat1, lon1, lat2, lon2)
        if travelled + segment_length >= target_distance:
            ratio = 0.0 if segment_length == 0 else (target_distance - travelled) / segment_length
            lon = lon1 + (lon2 - lon1) * ratio
            lat = lat1 + (lat2 - lat1) * ratio
            return lon, lat
        travelled += segment_length
    return coords[-1]


def parse_gpkg_geometry(blob: bytes):
    if blob is None or len(blob) < 8:
        return [], None
    magic = blob[:2]
    if magic != b"GP":
        return [], None
    srs_id = struct.unpack("<i", blob[4:8])[0]
    flags = blob[3]
    envelope_indicator = (flags >> 1) & 0x07
    envelope_bytes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get(envelope_indicator, 0)
    offset = 8 + envelope_bytes
    if offset >= len(blob):
        return [], srs_id
    return parse_wkb(blob, offset), srs_id


def parse_wkb(blob: bytes, offset: int):
    if offset >= len(blob):
        return []
    byte_order = blob[offset]
    endian = "<" if byte_order == 1 else ">"
    offset += 1
    if offset + 4 > len(blob):
        return []
    geom_type = struct.unpack(endian + "I", blob[offset:offset + 4])[0]
    offset += 4

    base_type = geom_type % 1000 if geom_type >= 1000 else geom_type
    dims = 2
    if 1000 <= geom_type < 2000:
        dims = 3
    elif 2000 <= geom_type < 3000:
        dims = 3
    elif 3000 <= geom_type < 4000:
        dims = 4

    if base_type == 2:
        return [parse_linestring(blob, offset, endian, dims)[0]]
    if base_type == 5:
        return parse_multilinestring(blob, offset, endian, dims)
    return []


def parse_linestring(blob: bytes, offset: int, endian: str, dims: int):
    if offset + 4 > len(blob):
        return [], offset
    num_points = struct.unpack(endian + "I", blob[offset:offset + 4])[0]
    offset += 4
    coords = []
    for _ in range(num_points):
        if offset + 8 * dims > len(blob):
            break
        values = struct.unpack(endian + "d" * dims, blob[offset:offset + 8 * dims])
        lon = values[0]
        lat = values[1]
        coords.append((lon, lat))
        offset += 8 * dims
    return coords, offset


def parse_multilinestring(blob: bytes, offset: int, endian: str, dims: int):
    if offset + 4 > len(blob):
        return []
    num_lines = struct.unpack(endian + "I", blob[offset:offset + 4])[0]
    offset += 4
    lines = []
    for _ in range(num_lines):
        if offset >= len(blob):
            break
        sub_byte_order = blob[offset]
        sub_endian = "<" if sub_byte_order == 1 else ">"
        offset += 1
        if offset + 4 > len(blob):
            break
        sub_type = struct.unpack(sub_endian + "I", blob[offset:offset + 4])[0]
        offset += 4
        sub_base = sub_type % 1000 if sub_type >= 1000 else sub_type
        sub_dims = 2
        if 1000 <= sub_type < 2000:
            sub_dims = 3
        elif 2000 <= sub_type < 3000:
            sub_dims = 3
        elif 3000 <= sub_type < 4000:
            sub_dims = 4
        if sub_base != 2:
            return lines
        coords, offset = parse_linestring(blob, offset, sub_endian, sub_dims)
        if coords:
            lines.append(coords)
    return lines


def extract_name(values):
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def osgb36_to_wgs84(easting, northing):
    # Airy 1830 ellipsoid and OSGB36 -> WGS84 Helmert transform.
    a = 6377563.396
    b = 6356256.909
    F0 = 0.9996012717
    lat0 = radians(49)
    lon0 = radians(-2)
    N0 = -100000
    E0 = 400000
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)

    lat = lat0
    M = 0.0
    while abs(northing - N0 - M) >= 0.00001:
        lat = (northing - N0 - M) / (a * F0) + lat
        Ma = (1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * (lat - lat0)
        Mb = (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * sin(lat - lat0) * cos(lat + lat0)
        Mc = ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * sin(2 * (lat - lat0)) * cos(2 * (lat + lat0))
        Md = (35 / 24) * n ** 3 * sin(3 * (lat - lat0)) * cos(3 * (lat + lat0))
        M = b * F0 * (Ma - Mb + Mc - Md)

    cos_lat = cos(lat)
    sin_lat = sin(lat)
    nu = a * F0 / sqrt(1 - e2 * sin_lat * sin_lat)
    rho = a * F0 * (1 - e2) / ((1 - e2 * sin_lat * sin_lat) ** 1.5)
    eta2 = nu / rho - 1
    tan_lat = sin_lat / cos_lat
    sec_lat = 1 / cos_lat
    dE = easting - E0

    VII = tan_lat / (2 * rho * nu)
    VIII = tan_lat / (24 * rho * nu ** 3) * (5 + 3 * tan_lat ** 2 + eta2 - 9 * tan_lat ** 2 * eta2)
    IX = tan_lat / (720 * rho * nu ** 5) * (61 + 90 * tan_lat ** 2 + 45 * tan_lat ** 4)
    X = sec_lat / nu
    XI = sec_lat / (6 * nu ** 3) * (nu / rho + 2 * tan_lat ** 2)
    XII = sec_lat / (120 * nu ** 5) * (5 + 28 * tan_lat ** 2 + 24 * tan_lat ** 4)
    XIIA = sec_lat / (5040 * nu ** 7) * (61 + 662 * tan_lat ** 2 + 1320 * tan_lat ** 4 + 720 * tan_lat ** 6)

    lat_osgb = lat - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6
    lon_osgb = lon0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7

    # Convert OSGB36 lat/lon to cartesian coordinates.
    nu_osgb = a / sqrt(1 - e2 * sin(lat_osgb) ** 2)
    x1 = nu_osgb * cos(lat_osgb) * cos(lon_osgb)
    y1 = nu_osgb * cos(lat_osgb) * sin(lon_osgb)
    z1 = (nu_osgb * (1 - e2)) * sin(lat_osgb)

    # Helmert transform to WGS84.
    tx = 446.448
    ty = -125.157
    tz = 542.060
    s = 20.4894 * 1e-6
    rx = radians(0.1502 / 3600)
    ry = radians(0.2470 / 3600)
    rz = radians(0.8421 / 3600)

    x2 = tx + (1 + s) * x1 + (-rz) * y1 + (ry) * z1
    y2 = ty + (rz) * x1 + (1 + s) * y1 + (-rx) * z1
    z2 = tz + (-ry) * x1 + (rx) * y1 + (1 + s) * z1

    # Convert cartesian to WGS84 lat/lon.
    a_wgs = 6378137.0
    b_wgs = 6356752.3141
    e2_wgs = 1 - (b_wgs * b_wgs) / (a_wgs * a_wgs)
    p = sqrt(x2 * x2 + y2 * y2)
    lat = atan2(z2, p * (1 - e2_wgs))
    for _ in range(10):
        nu_wgs = a_wgs / sqrt(1 - e2_wgs * sin(lat) ** 2)
        lat_next = atan2(z2 + e2_wgs * nu_wgs * sin(lat), p)
        if abs(lat_next - lat) < 1e-12:
            break
        lat = lat_next
    lon = atan2(y2, x2)

    return (lon * 180 / 3.141592653589793, lat * 180 / 3.141592653589793)


def reach_count_for_length(length_m):
    if length_m > LONG_RIVER_M:
        return 3
    if length_m > MEDIUM_RIVER_M:
        return 2
    return 1


def pick_reach_points(midpoints, reach_count):
    if not midpoints:
        return []
    lats = [pt[1] for pt in midpoints]
    lons = [pt[0] for pt in midpoints]
    lat_span = max(lats) - min(lats)
    lon_span = max(lons) - min(lons)
    axis = 1 if lat_span >= lon_span else 0
    ordered = sorted(midpoints, key=lambda pt: pt[axis])
    if reach_count == 1:
        return [ordered[len(ordered) // 2]]
    if reach_count == 2:
        return [ordered[len(ordered) // 3], ordered[(2 * len(ordered)) // 3]]
    return [ordered[len(ordered) // 4], ordered[len(ordered) // 2], ordered[(3 * len(ordered)) // 4]]


def pick_name(values, columns, fields):
    for field in fields:
        if field in columns:
            value = values[columns.index(field)]
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def looks_welsh(name):
    lower = name.lower()
    return lower.startswith("afon ") or lower.startswith("nant ")


def looks_river_name(name):
    lower = name.lower()
    return lower.startswith("river ") or lower.startswith("afon ") or lower.startswith("nant ")


def choose_primary_and_alt(primary_candidate, alt_candidate):
    if primary_candidate and alt_candidate:
        primary_is_river = looks_river_name(primary_candidate)
        alt_is_river = looks_river_name(alt_candidate)
        alt_is_welsh = looks_welsh(alt_candidate)
        if primary_is_river and alt_is_welsh:
            return primary_candidate, alt_candidate
        if alt_is_river and not primary_is_river:
            return alt_candidate, primary_candidate
        return primary_candidate, alt_candidate
    if primary_candidate:
        return primary_candidate, None
    if alt_candidate:
        return alt_candidate, None
    return None, None


def ingest_gpkg(path, layer, primary_fields, alt_fields, source_label):
    if not path or not Path(path).exists():
        return None
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    if not layer:
        cur.execute("SELECT table_name FROM gpkg_contents WHERE data_type='features' LIMIT 1")
        row = cur.fetchone()
        layer = row[0] if row else None
    if not layer:
        conn.close()
        return None

    cur.execute(f"PRAGMA table_info({layer})")
    columns = [col[1] for col in cur.fetchall()]
    if "geometry" not in columns:
        conn.close()
        return None

    primary_fields = [field for field in primary_fields if field in columns]
    alt_fields = [field for field in alt_fields if field in columns]
    if not primary_fields and not alt_fields:
        conn.close()
        return None

    extra_fields = [field for field in ("form", "fictitious") if field in columns]
    select_cols = ["geometry"] + sorted(set(primary_fields + alt_fields + extra_fields))
    query = f"SELECT {', '.join(select_cols)} FROM {layer}"
    select_columns = select_cols[1:]

    river_data = {}
    skipped = 0
    for row in cur.execute(query):
        geom_blob = row[0]
        values = list(row[1:])
        primary = pick_name(values, select_columns, primary_fields)
        alt = pick_name(values, select_columns, alt_fields)
        primary, alt = choose_primary_and_alt(primary, alt)
        form_value = None
        fictitious_value = None
        if "form" in select_columns:
            form_value = values[select_columns.index("form")]
        if "fictitious" in select_columns:
            fictitious_value = values[select_columns.index("fictitious")]

        if form_value and str(form_value).strip().lower() not in ALLOWED_FORMS:
            skipped += 1
            continue
        if fictitious_value not in (None, "", "0", 0, False):
            skipped += 1
            continue

        if not primary or geom_blob is None:
            skipped += 1
            continue
        lines, srs_id = parse_gpkg_geometry(geom_blob)
        if not lines:
            skipped += 1
            continue

        alt_name = alt if alt and alt != primary else None
        bucket = river_data.setdefault(primary, {
            "midpoints": [],
            "length": 0.0,
            "source": source_label,
            "alt_name": alt_name
        })
        if alt_name and not bucket.get("alt_name"):
            bucket["alt_name"] = alt_name
        for coords in lines:
            if len(coords) < 2:
                continue
            length = line_length(coords, srs_id)
            bucket["length"] += length
            midpoint = coordinate_at_distance(coords, length / 2, srs_id)
            if srs_id == 27700:
                midpoint = osgb36_to_wgs84(midpoint[0], midpoint[1])
            bucket["midpoints"].append(midpoint)

    conn.close()
    return {"river_data": river_data, "skipped": skipped}


def name_is_excluded(name):
    lower = name.lower()
    return any(token in lower for token in EXCLUDE_NAME_TOKENS)


def build_output(buckets):
    output = []
    for river_name, info in buckets.items():
        midpoints = info["midpoints"]
        if not midpoints:
            continue
        reach_count = reach_count_for_length(info["length"])
        total_length_m = info["length"]
        suggestable = total_length_m >= MIN_SUGGESTABLE_LENGTH_M and not name_is_excluded(river_name)
        if not suggestable:
            continue
        picks = pick_reach_points(midpoints, reach_count)
        river_id = slugify(river_name)
        for idx, (lon, lat) in enumerate(picks, start=1):
            label = "single" if reach_count == 1 else f"reach_{idx}_of_{reach_count}"
            entry = {
                "river_id": river_id,
                "river_name": river_name,
                "reach_id": f"{river_id}-{idx}",
                "reach_label": label,
                "reach_rank": idx,
                "lat": lat,
                "lon": lon,
                "source": info["source"],
                "total_length_m": round(total_length_m),
                "suggestable": True
            }
            if info.get("alt_name"):
                entry["river_name_alt"] = info["alt_name"]
            output.append(entry)
    return output


def main():
    gb_path = os.getenv("GB_GPKG") or (DEFAULT_GB_GPKG if Path(DEFAULT_GB_GPKG).exists() else DEFAULT_GB_FALLBACK)
    ni_path = os.getenv("NI_GPKG") or DEFAULT_NI_GPKG
    out_path = os.getenv("RIVER_DATASET_OUT") or DEFAULT_OUT

    if not Path(gb_path).exists():
        print(f"GB GPKG not found: {gb_path}")
        sys.exit(1)

    gb_result = ingest_gpkg(gb_path, GB_LAYER, GB_PRIMARY_FIELDS, GB_ALT_FIELDS, "os_open_rivers")
    if not gb_result:
        print("Failed to read GB dataset. Check layer/name fields.")
        sys.exit(1)

    buckets = gb_result["river_data"]
    total_skipped = gb_result["skipped"]

    ni_result = ingest_gpkg(ni_path, NI_LAYER, NI_PRIMARY_FIELDS, NI_ALT_FIELDS, "ni_rivers")
    if ni_result:
        for river_name, info in ni_result["river_data"].items():
            if river_name in buckets:
                buckets[river_name]["midpoints"].extend(info["midpoints"])
                buckets[river_name]["length"] += info["length"]
            else:
                buckets[river_name] = info
        total_skipped += ni_result["skipped"]
    else:
        print("NI dataset not found or unreadable. Output will be GB-only.")

    output = build_output(buckets)
    Path(out_path).write_text(json_dumps(output))
    print(f"Wrote {len(output)} reach entries to {out_path}")
    print(f"Skipped {total_skipped} features without names/lines.")
    print("TODO: Validate reach ordering and NI coverage before release.")


def json_dumps(data):
    import json
    return json.dumps(data, indent=2) + "\n"


if __name__ == "__main__":
    main()
