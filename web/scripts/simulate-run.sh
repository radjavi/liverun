#!/bin/bash
# Simulates a ~5 min run through Nørrebro, Copenhagen
# Usage: ./scripts/simulate-run.sh [base_url]

BASE_URL="${1:-http://localhost:49305}"

# Create a new run
echo "Creating run..."
RUN_ID=$(curl -s -X POST "$BASE_URL/api/runs" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Run ID: $RUN_ID"
echo ""

# End run on exit (Ctrl+C or kill)
cleanup() {
  echo ""
  echo ""
  echo "Stopping run..."
  curl -s -X PATCH "$BASE_URL/api/runs/$RUN_ID" > /dev/null
  echo "Run ended. ID: $RUN_ID"
  exit 0
}
trap cleanup INT TERM

# Route through Nørrebro (lat,lng waypoints)
WAYPOINTS=(
  "55.68950,12.55300"
  "55.68980,12.55380"
  "55.69020,12.55480"
  "55.69070,12.55560"
  "55.69130,12.55620"
  "55.69200,12.55680"
  "55.69260,12.55760"
  "55.69310,12.55850"
  "55.69350,12.55960"
  "55.69380,12.56080"
  "55.69420,12.56180"
  "55.69470,12.56260"
  "55.69530,12.56320"
  "55.69600,12.56360"
  "55.69680,12.56400"
  "55.69750,12.56450"
  "55.69800,12.56540"
  "55.69830,12.56650"
  "55.69850,12.56770"
  "55.69880,12.56890"
  "55.69920,12.56980"
  "55.69970,12.57050"
  "55.70040,12.57100"
  "55.70120,12.57130"
  "55.70200,12.57150"
  "55.70270,12.57200"
  "55.70320,12.57290"
  "55.70350,12.57400"
  "55.70370,12.57520"
  "55.70400,12.57630"
  "55.70450,12.57720"
  "55.70520,12.57780"
  "55.70600,12.57820"
  "55.70680,12.57850"
  "55.70750,12.57900"
  "55.70810,12.57970"
  "55.70860,12.58060"
  "55.70920,12.58150"
  "55.70990,12.58220"
  "55.71060,12.58260"
  "55.71130,12.58300"
  "55.71190,12.58360"
  "55.71230,12.58450"
  "55.71260,12.58560"
  "55.71300,12.58670"
  "55.71350,12.58750"
  "55.71420,12.58800"
  "55.71500,12.58830"
  "55.71570,12.58870"
  "55.71630,12.58940"
  "55.71680,12.59030"
  "55.71720,12.59140"
  "55.71770,12.59250"
  "55.71830,12.59340"
  "55.71900,12.59400"
  "55.71970,12.59440"
  "55.72040,12.59480"
  "55.72100,12.59540"
  "55.72150,12.59630"
  "55.72200,12.59720"
)

TOTAL=${#WAYPOINTS[@]}
DIST=0
ELEV_GAIN=0
PREV_LAT=""
PREV_LNG=""
PREV_ALT=""

# Deterministic HR per waypoint: warm up → steady → push → final push
hr_for_index() {
  local i=$1
  local pct=$((i * 100 / TOTAL))
  local offset=$((i % 5))
  if [ $pct -lt 15 ]; then
    echo $((140 + pct))
  elif [ $pct -lt 70 ]; then
    echo $((152 + offset))
  elif [ $pct -lt 85 ]; then
    echo $((165 + offset))
  else
    echo $((170 + (pct - 85)))
  fi
}

# Deterministic altitude per waypoint: gentle hills
altitude_for_index() {
  local i=$1
  local pct=$((i * 100 / TOTAL))
  # Simulate gentle rolling hills: base 10m, peak ~30m around 50%
  echo "$(echo "scale=1; 10 + 20 * s($pct * 3.14159 / 100)" | bc -l)"
}

# Deterministic cadence per waypoint: 170-185 spm
cadence_for_index() {
  local i=$1
  local pct=$((i * 100 / TOTAL))
  local offset=$((i % 3))
  if [ $pct -lt 15 ]; then
    echo $((170 + offset))
  elif [ $pct -lt 70 ]; then
    echo $((178 + offset))
  elif [ $pct -lt 85 ]; then
    echo $((182 + offset))
  else
    echo $((184 + offset))
  fi
}

# Deterministic pace per waypoint: start slow → find rhythm → push → final push
pace_for_index() {
  local i=$1
  local pct=$((i * 100 / TOTAL))
  if [ $pct -lt 15 ]; then
    echo "$(echo "scale=1; 5.8 - $pct * 0.05" | bc -l)"
  elif [ $pct -lt 70 ]; then
    echo "5.0"
  elif [ $pct -lt 85 ]; then
    echo "4.6"
  else
    echo "$(echo "scale=1; 4.4 - ($pct - 85) * 0.03" | bc -l)"
  fi
}

# Interpolation: 80 sub-steps between each waypoint pair → 100ms each
STEPS=80
TOTAL_POINTS=$(( (TOTAL - 1) * STEPS + 1 ))

echo "Starting simulated run ($TOTAL_POINTS points, ~$(( TOTAL_POINTS / 10 ))s)..."
echo "Press Ctrl+C to stop early"
echo ""

POINT_NUM=0

for i in $(seq 0 $((TOTAL - 2))); do
  IFS=',' read -r LAT1 LNG1 <<< "${WAYPOINTS[$i]}"
  IFS=',' read -r LAT2 LNG2 <<< "${WAYPOINTS[$((i + 1))]}"

  # Compute HR, pace, altitude, cadence once per waypoint segment, interpolate between
  HR_START=${HR_END:-$(hr_for_index $i)}
  HR_END=$(hr_for_index $((i + 1)))
  PACE_START=${PACE_END:-$(pace_for_index $i)}
  PACE_END=$(pace_for_index $((i + 1)))
  ALT_START=${ALT_END:-$(altitude_for_index $i)}
  ALT_END=$(altitude_for_index $((i + 1)))
  CAD_START=${CAD_END:-$(cadence_for_index $i)}
  CAD_END=$(cadence_for_index $((i + 1)))

  for s in $(seq 0 $((STEPS - 1))); do
    T=$(echo "scale=4; $s / $STEPS" | bc -l)
    LAT=$(echo "$LAT1 + ($LAT2 - $LAT1) * $T" | bc -l)
    LNG=$(echo "$LNG1 + ($LNG2 - $LNG1) * $T" | bc -l)

    if [ -n "$PREV_LAT" ]; then
      DLAT=$(echo "($LAT - $PREV_LAT) * 111320" | bc -l)
      DLNG=$(echo "($LNG - $PREV_LNG) * 56000" | bc -l)
      SEG=$(echo "sqrt($DLAT * $DLAT + $DLNG * $DLNG)" | bc -l)
      DIST=$(echo "$DIST + $SEG" | bc -l)
    fi
    PREV_LAT=$LAT
    PREV_LNG=$LNG

    # Smooth interpolation between waypoint values
    HR=$(echo "$HR_START + ($HR_END - $HR_START) * $T" | bc -l | xargs printf "%.0f")
    PACE=$(echo "scale=1; $PACE_START + ($PACE_END - $PACE_START) * $T" | bc -l)
    ALT=$(echo "$ALT_START + ($ALT_END - $ALT_START) * $T" | bc -l)
    CAD=$(echo "$CAD_START + ($CAD_END - $CAD_START) * $T" | bc -l | xargs printf "%.0f")

    # Track elevation gain and compute GAP
    if [ -n "$PREV_ALT" ]; then
      ALT_DELTA=$(echo "$ALT - $PREV_ALT" | bc -l)
      IS_POSITIVE=$(echo "$ALT_DELTA > 0.1" | bc -l)
      if [ "$IS_POSITIVE" -eq 1 ]; then
        ELEV_GAIN=$(echo "$ELEV_GAIN + $ALT_DELTA" | bc -l)
      fi
      # Grade = altitude_delta / horizontal_distance (approximate)
      H_DIST=$(echo "sqrt(($DLAT * $DLAT) + ($DLNG * $DLNG))" | bc -l 2>/dev/null)
      if [ -n "$H_DIST" ] && [ "$(echo "$H_DIST > 1" | bc -l)" -eq 1 ]; then
        GRADE=$(echo "$ALT_DELTA / $H_DIST" | bc -l)
      else
        GRADE="0"
      fi
    else
      GRADE="0"
    fi
    PREV_ALT=$ALT
    # Minetti GAP cost factor (simplified): cost = 155.4i^5 - 30.4i^4 - 43.3i^3 + 46.3i^2 + 19.5i + 3.6
    COST=$(echo "scale=4; 155.4 * $GRADE^5 - 30.4 * $GRADE^4 - 43.3 * $GRADE^3 + 46.3 * $GRADE^2 + 19.5 * $GRADE + 3.6" | bc -l 2>/dev/null || echo "3.6")
    FLAT_COST="3.6"
    COST_FACTOR=$(echo "scale=4; $COST / $FLAT_COST" | bc -l 2>/dev/null || echo "1")
    # Clamp cost factor minimum to 0.5
    if [ "$(echo "$COST_FACTOR < 0.5" | bc -l 2>/dev/null)" = "1" ]; then COST_FACTOR="0.5"; fi
    GAP=$(echo "scale=1; $PACE / $COST_FACTOR" | bc -l 2>/dev/null || echo "$PACE")

    DIST_INT=$(printf "%.0f" "$DIST")
    ELEV_INT=$(printf "%.0f" "$ELEV_GAIN")
    TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    POINT_NUM=$((POINT_NUM + 1))

    curl -s -X POST "$BASE_URL/api/track" \
      -H "Content-Type: application/json" \
      -d "{\"runId\":\"$RUN_ID\",\"latitude\":$LAT,\"longitude\":$LNG,\"altitude\":$ALT,\"heartRate\":$HR,\"pace\":$PACE,\"distanceMeters\":$DIST_INT,\"cadence\":$CAD,\"elevationGain\":$ELEV_INT,\"gradeAdjustedPace\":$GAP,\"recordedAt\":\"$TS\"}" > /dev/null

    printf "\r  Point %3d/%d | HR: %d bpm | Pace: %s /km | GAP: %s /km | Cad: %d spm | Elev: %sm | Dist: %sm" \
      $POINT_NUM $TOTAL_POINTS $HR $PACE $GAP $CAD $ELEV_INT $DIST_INT

    sleep 0.1
  done
done

# Send final waypoint
IFS=',' read -r LAT LNG <<< "${WAYPOINTS[$((TOTAL - 1))]}"
if [ -n "$PREV_LAT" ]; then
  DLAT=$(echo "($LAT - $PREV_LAT) * 111320" | bc -l)
  DLNG=$(echo "($LNG - $PREV_LNG) * 56000" | bc -l)
  SEG=$(echo "sqrt($DLAT * $DLAT + $DLNG * $DLNG)" | bc -l)
  DIST=$(echo "$DIST + $SEG" | bc -l)
fi
HR=$(hr_for_index $((TOTAL - 1)))
PACE=$(pace_for_index $((TOTAL - 1)))
ALT=$(altitude_for_index $((TOTAL - 1)))
CAD=$(cadence_for_index $((TOTAL - 1)))
DIST_INT=$(printf "%.0f" "$DIST")
ELEV_INT=$(printf "%.0f" "$ELEV_GAIN")
GAP=$PACE  # Flat at final point
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
POINT_NUM=$((POINT_NUM + 1))

curl -s -X POST "$BASE_URL/api/track" \
  -H "Content-Type: application/json" \
  -d "{\"runId\":\"$RUN_ID\",\"latitude\":$LAT,\"longitude\":$LNG,\"altitude\":$ALT,\"heartRate\":$HR,\"pace\":$PACE,\"distanceMeters\":$DIST_INT,\"cadence\":$CAD,\"elevationGain\":$ELEV_INT,\"gradeAdjustedPace\":$GAP,\"recordedAt\":\"$TS\"}" > /dev/null

printf "\r  Point %3d/%d | HR: %d bpm | Pace: %s /km | GAP: %s /km | Cad: %d spm | Elev: %sm | Dist: %sm" \
  $POINT_NUM $TOTAL_POINTS $HR $PACE $GAP $CAD $ELEV_INT $DIST_INT

echo ""
echo ""

# End the run
curl -s -X PATCH "$BASE_URL/api/runs/$RUN_ID" > /dev/null
echo "Run finished! ID: $RUN_ID"
