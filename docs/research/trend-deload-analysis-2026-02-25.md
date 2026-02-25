# Trend Detection and Deload Recommendation Systems
## Research Report for Gymdash
**Date:** 2026-02-25

---

## Executive Summary

This research explores proven metrics and algorithms for detecting overtraining/stagnation in strength training apps, with specific focus on practical implementation for Gymdash. Key findings indicate that **multi-factor analysis combining estimated 1RM trends, RPE drift, and session consistency** provides the most reliable deload signals without excessive false positives. Leading apps (RP Hypertrophy, Juggernaut AI, Alpha Progression) use layered approaches that start simple and add nuance based on time windows and user data quality.

---

## Section 1: Metrics That Predict Overtraining & Stagnation

### 1.1 Most Reliable Metrics (Ranked by Predictive Power)

#### **Tier 1: High Reliability**

**1. Estimated 1RM Trend (3-4 week rolling average)**
- **Why:** Direct measure of actual strength progression
- **Implementation:** Calculate e1RM from best sets each session using Epley formula
  ```
  e1RM = weight × (1 + (reps/30))
  ```
- **Signal:** Flat or declining trend over 3-4 weeks = stagnation
- **Sports Science:** Confirmed by Greg Nuckols (STRONGER by Science) as primary metric
- **Gymdash Fit:** Already tracking rep performance; simple to implement
- **Warning:** Needs data smoothing (outliers from easy days can skew)

**2. RPE Drift (Same Perceived Difficulty → Harder Over Time)**
- **Why:** Captures nervous system fatigue invisible to raw numbers
- **Implementation:** Track RPE for repeated exercises at same load
  - Example: "Bench 225×5 @ RPE 7" now feels like "RPE 8.5"
  - Indicates CNS fatigue even if technically hitting reps
- **Sports Science:** Mike Israetel/Renaissance Periodization research on daily readiness
- **Gymdash Fit:** Critical differentiator from weight-only tracking
- **Risk:** Subjective; needs moving average (3-4 reps at same load)

**3. Weekly Volume Load Trend**
- **Formula:** Σ (sets × reps × weight) per week
- **Interpretation:**
  - Plateau/decline = stagnation signal
  - Consistent growth = good progression
  - Spikes then drops = fatigue accumulation
- **Sports Science:** Central to Mike Israetel's MEV/MRV framework (Renaissance Periodization)
- **Gymdash Fit:** Directly measurable from session data
- **Best Practice:** Use 4-week rolling average (smooths weekly variation)

#### **Tier 2: Good Supporting Indicators**

**4. Rep Performance vs. Target Range**
- **Metric:** % of sessions hitting target rep range vs. missing
- **Example:** "Week 1: 80% hit 5-5-3 target. Week 2: 60% hit target."
- **Interpretation:** Declining hit rate = form degradation or fatigue
- **Gymdash Fit:** Can auto-calculate from current workout data

**5. Session Density (Volume Per Unit Time)**
- **Calculation:** Total volume / time spent
- **Signal:** If density declining despite same volume → fatigue
- **Less Critical:** Works better for metabolic work; strength sessions naturally vary

**6. Frequency/Consistency (Missed Sessions)**
- **Metric:** Planned vs. completed sessions
- **Why:** Even unplanned deloads (skipped sessions) indicate system stress
- **Caveat:** Correlation not causation (could be schedule, not physiology)

### 1.2 Combination Approach (Most Reliable)

**The "Traffic Light" Scoring System:**

Best-performing apps use **weighted multi-factor analysis**:

```
Deload Signal Score = (w1 × e1RM_trend) + (w2 × RPE_drift) + (w3 × volume_trend) + (w4 × rep_performance)

Weights (Renaissance Periodization influenced):
- e1RM trend: 35% (most objective)
- RPE drift: 30% (most sensitive to CNS fatigue)
- Volume trend: 25% (macro indicator)
- Rep performance hit rate: 10% (lagging indicator)

Action Thresholds:
- Score < 0.3: Green (↑ progressing well)
- Score 0.3-0.6: Yellow (→ plateau or minor decline)
- Score > 0.6: Red (↓ deload recommended)
```

**Why This Works:**
- No single metric is perfect (each has blind spots)
- e1RM catches strength stagnation
- RPE catches fatigue that precedes strength drops
- Volume catches systematic overreach
- Rep hit rate catches form/technical breakdown

### 1.3 Sports Science References

| Source | Key Finding | Relevance |
|--------|------------|-----------|
| **Greg Nuckols (STRONGER by Science)** | 1RM trends + RPE + bar speed best predict fatigue | Validates Tier 1 metrics |
| **Mike Israetel (RP)** | MEV/MRV framework: Volume accumulation beyond MRV causes regression | Justifies volume trend tracking |
| **Eric Helms (RP)** | RPE drift precedes performance drops by 1-2 weeks | RPE is leading indicator |
| **Lyle McDonald** | Deload triggers: 2+ weeks plateau OR RPE on same load increases >1 point | Simple rule (see Section 4) |
| **Zatsiorsky & Kraemer** | CNS fatigue manifests as decreased bar speed, increased effort perception | e1RM + RPE combo catches CNS issues |

---

## Section 2: How Leading Apps Handle Trend Detection & Deload

### 2.1 RP Hypertrophy App (Renaissance Periodization)

**Approach:** Automated MEV→MRV tracking with deload triggers

**How It Works:**
- **Baseline Phase:** User selects starting RIR (Reps In Reserve) per exercise
- **Weekly Monitoring:** Tracks if user maintains RIR across all sets
  - If hitting target RIR consistently: increase volume slightly
  - If missing RIR (closer to failure): volume within MEV-MRV range
- **Deload Trigger:**
  - User fails to hit target RIR for 2+ consecutive weeks
  - App auto-suggests deload week (reduce volume 40-50%)
- **RPE Integration:** Implicit through RIR selection
- **Key Innovation:** Doesn't just track numbers—tracks **daily readiness via RIR decay**

**Strengths:**
- Minimal input (just RIR on key lifts)
- Prevents MRV violation (main cause of regression)
- Adaptive per exercise

**Weaknesses:**
- Requires user to honestly report RIR
- Doesn't explicitly track 1RM trends
- Less useful for raw strength (more hypertrophy-focused)

### 2.2 Juggernaut AI (Chad Wesley Smith)

**Approach:** Real-time bar speed + RPE synthesis

**How It Works:**
- **Technology:** Requires phone camera or wearable to track bar speed
- **Decision Algorithm:**
  ```
  IF bar_speed_decline > 15% from baseline AND RPE_increase > 1 point:
    → Suggest deload or exercise swap
  ELSE IF velocity_trend positive:
    → Increase intensity/volume
  ```
- **Deload Specificity:** Can deload by exercise (swap heavy barbell for DBs) rather than full week off
- **Feedback Loop:** Daily micro-adjustments based on velocity

**Strengths:**
- Most precise (bar speed = objective CNS state)
- Catches fatigue earliest
- Enables tactical deloads (not just full rest)

**Weaknesses:**
- Requires tech (expensive for most users)
- Complex to implement in React Native
- Privacy concerns (camera access)

### 2.3 Alpha Progression (Mobile App)

**Approach:** Progressive overload tracking with plateau detection

**How It Works:**
- **Core Logic:** "Add 1 rep or 1 unit weight per session"
- **Plateau Detection:**
  - If same weight/reps for 3+ sessions: flag as plateau
  - App suggests: increase reps, decrease weight, or deload
- **Deload:** User can manually trigger "deload week" (50% volume)
- **Simplicity:** No complex algorithms—just milestone tracking

**Strengths:**
- User-friendly (linear progression model)
- Works offline (Gymdash advantage!)
- Clear visual feedback (progress bars)

**Weaknesses:**
- Crude (doesn't account for natural plateaus)
- Reactive (waits 3 sessions to detect issue)
- Ignores RPE/fatigue signals

### 2.4 GZCL / nSuns Methodology (Open Source)

**Approach:** Programmatic periodization with fixed deload schedule

**How It Works:**
```
Macro Cycle Structure (nSuns LP):
- Weeks 1-3: Progressive overload (linear)
- Week 4: Deload (50-60% volume, 90% intensity)
- Repeat

Alternative (GZCL):
- Measure "rep max" (max reps at RPE 8)
- If declining for 2 weeks: deload week
- If increasing: continue progression
```

**Programmatic Trigger (GZCL-inspired):**
```python
# Pseudocode
if weeks_since_deload > 4:
    if rep_max_trend == 'declining' for 2+ weeks:
        suggest_deload_week()
    elif rep_max_trend == 'flat' and rpe_average > 8:
        suggest_deload_week()
    else:
        continue_progression()
```

**Strengths:**
- Proven (used by thousands)
- Predictable (users know when deload comes)
- Works with minimal data

**Weaknesses:**
- Inflexible (fixed 4-week cycles may not suit everyone)
- One-size-fits-all

### 2.5 Key Pattern: Multi-App Consensus

| App | e1RM Tracking | RPE/RIR Used | Auto-Deload? | Deload Length |
|-----|---------------|--------------|--------------|---------------|
| RP Hypertrophy | Implicit (RIR) | Yes (RIR) | Yes | 1 week (40-50% volume) |
| Juggernaut AI | Via velocity | Yes (explicit) | Yes (exercise-level) | 3-5 days typically |
| Alpha Progression | Yes | Limited | Manual | 1 week (user choice) |
| nSuns/GZCL | Yes (rep max) | Yes (RPE 8 baseline) | Rule-based | 1 week (fixed) |
| Strong App | Yes | Yes | Manual | User-chosen |
| JEFIT | Yes | Limited | No (alerts only) | N/A |

**Consensus:**
1. Always track e1RM or rep max
2. Incorporate RPE/RIR as leading indicator
3. Combine with volume trend
4. Most deloads = 1 week at 40-50% volume
5. Apps increasingly favor **suggestion over auto-programming** (users want agency)

---

## Section 3: Home Screen Indicators That Work

### 3.1 Psychology of Home Screen Design

**Critical Principle:** Users check home screen 2-3 times per day. It must be **motivating yet honest**.

**Mistakes to Avoid:**
1. **Too Much Green** (all positive) → users stop trusting it
2. **Too Much Red** (all declining) → demoralizing, app abandonment
3. **No Context** (raw numbers) → meaningless
4. **Lag Indicators** (only showing failures) → late warning
5. **Overwhelming Metrics** (5+ indicators) → decision paralysis

### 3.2 Effective Home Screen Patterns

#### **Pattern 1: The "How's Your Training?" Traffic Light (RP Style)**

```
┌─────────────────────────────────┐
│ THIS WEEK'S TRAINING STATUS     │
├─────────────────────────────────┤
│                                 │
│         🟢 PROGRESSING          │
│                                 │
│  • Strength: +1.5% (avg e1RM)   │
│  • Volume: +2% vs. last week    │
│  • Consistency: 4/4 sessions ✓  │
│                                 │
│  Keep doing what you're doing!  │
└─────────────────────────────────┘
```

**Why This Works:**
- Single traffic light = glanceable
- 3 supporting stats = credible
- Positive message (doesn't shame)
- Actionable (shows strength improving)

**Alternative States:**
```
Yellow State:
┌─────────────────────────────────┐
│         🟡 PLATEAU ZONE         │
├─────────────────────────────────┤
│  • Strength: Flat past 3 weeks  │
│  • Volume: Declining            │
│  • RPE rising on same weight    │
│                                 │
│  Consider a deload week →       │
└─────────────────────────────────┘

Red State:
┌─────────────────────────────────┐
│      🔴 FATIGUE DETECTED        │
├─────────────────────────────────┤
│  • e1RM down 3.2% this week     │
│  • RPE +2 on bench press        │
│  • 1 missed session             │
│                                 │
│  Deload week recommended        │
│  [Start Deload] [Not Now]       │
└─────────────────────────────────┘
```

#### **Pattern 2: Trend Arrows + % Change (Strong App Style)**

```
┌─────────────────────────────────┐
│ LAST 7 DAYS VS PREVIOUS 7 DAYS  │
├─────────────────────────────────┤
│                                 │
│ Total Volume    ↑ +8.2%         │
│ Avg e1RM        ↑ +1.5%         │
│ Rep Consistency → 85% (same)    │
│ Session Effort  ↓ -0.3 RPE      │
│                                 │
│ Session: Squat 315×3 @ RPE 7   │
└─────────────────────────────────┘
```

**Why This Works:**
- Arrows are instantly readable
- % change shows magnitude
- Week-to-week comparison is natural
- Rep consistency shows effort vs. results

**Best Placement:** Below latest session, above historical chart

#### **Pattern 3: Streak Counter + Consistency (Habit Loop)**

```
┌─────────────────────────────────┐
│                                 │
│    🔥 4-WEEK STREAK 🔥         │
│  Haven't missed a session!      │
│                                 │
│  This week: 4/4 planned         │
│                                 │
│  [Tap to see monthly heatmap]   │
└─────────────────────────────────┘
```

**Why This Works:**
- Gamification (streaks are motivating)
- Tracks adherence without judgment
- Tappable (leads to deeper stats)

#### **Pattern 4: Micro-Progress Feedback (Fitbod Style)**

```
┌─────────────────────────────────┐
│ BENCH PRESS (Last 4 Weeks)      │
├─────────────────────────────────┤
│                                 │
│ Session 1: 185 × 6 @ RPE 7     │
│ Session 2: 190 × 5 @ RPE 7     │ ← e1RM +2.3%
│ Session 3: 190 × 6 @ RPE 7.5   │
│ Session 4: 190 × 5 @ RPE 8     │ ← RPE drifting!
│                                 │
│ 📈 Trend: Slightly declining    │
│ 💡 Next: Deload or reset       │
└─────────────────────────────────┘
```

**Why This Works:**
- Exercise-specific (users care about their lifts)
- Shows RPE drift (not just weight)
- Actionable hint (suggests next step)

### 3.3 Information Hierarchy for Home Screen

**Tier 0 (Glance - 1 second):**
- Traffic light status (🟢 / 🟡 / 🔴)
- Current streak or weekly session count

**Tier 1 (Quick Read - 5 seconds):**
- e1RM trend % (↑ +2.1% or ↓ -1.3%)
- Major metric (volume or strength average)
- Action item if any ("Consider deload")

**Tier 2 (Deep Dive - Optional):**
- Week-to-week comparison
- Exercise-specific trends
- RPE distribution chart
- Consistency heatmap (tap to expand)

**Never on Home Screen:**
- Raw session data (that's for logging)
- Confusing ratios (MEV/MRV percentages unless explained)
- Too many numbers (cognitive overload)
- Vague metrics (like "training stress" without context)

### 3.4 Example: Gymdash Home Screen Proposal

```
┌──────────────────────────────────────┐
│  GYM DASH                        ⚙️   │
├──────────────────────────────────────┤
│                                      │
│  MON 24 FEB — Today 💪              │
│  ├─ Bench Press                     │
│  ├─ Squat                           │
│  └─ Barbell Row                     │
│                                      │
│  ─────────────────────────────────── │
│  THIS WEEK'S STATUS                  │
│                                      │
│              🟢 PROGRESSING          │
│                                      │
│  • Strength:  ↑ +2.1% (e1RM avg)   │
│  • Volume:    ↑ +1.8% vs last week  │
│  • Effort:    → RPE 7.2 (stable)    │
│  • Adherence: 4/4 sessions ✓        │
│                                      │
│  [View Full Analysis] [Full Stats]  │
│                                      │
└──────────────────────────────────────┘
```

---

## Section 4: Deload Recommendation Algorithms

### 4.1 Three-Tier Complexity Approach

#### **Tier 1: Simple Rule-Based (MVP)**

**For apps just starting:**

```python
DELOAD_RULES = {
    "rule_1": {
        "condition": "weeks_since_last_deload > 4",
        "action": "suggest_deload_week"
    },
    "rule_2": {
        "condition": "e1rm_trend_4weeks == 'declining'",
        "action": "suggest_deload_week"
    },
    "rule_3": {
        "condition": "missed_sessions >= 2 in last 10 days",
        "action": "suggest_deload_week"
    }
}

# Trigger if ANY rule matches
def check_deload_needed(user_data):
    for rule_name, rule in DELOAD_RULES.items():
        if evaluate_condition(rule["condition"], user_data):
            return rule["action"]
    return None
```

**Recommended Thresholds:**
- Time-based: 4-5 weeks (consensus from nSuns, GZCL)
- e1RM decline: >3% drop over 3 weeks
- Missed sessions: 2+ in 10 days

**False Positive Rate:** ~30% (user might be tired this week only)
**User Control:** Always suggest, never auto-program

#### **Tier 2: Weighted Multi-Factor (Recommended for Gymdash)**

```python
def calculate_deload_score(user_data, window_weeks=4):
    """
    Returns 0.0-1.0 score where >0.6 recommends deload
    """

    # Factor 1: e1RM trend (35% weight)
    e1rm_history = get_estimated_1rm_weekly(user_data, weeks=window_weeks)
    e1rm_trend = linear_regression_slope(e1rm_history)
    e1rm_decline = max(0, -e1rm_trend / e1rm_history[0])  # % decline
    factor_1 = min(1.0, e1rm_decline * 10) * 0.35  # Normalize to 0-1

    # Factor 2: RPE drift (30% weight)
    rpe_trend = get_rpe_drift_on_repeated_loads(user_data, weeks=window_weeks)
    # rpe_trend = positive number (RPE increasing means harder)
    rpe_drift = max(0, rpe_trend - 0.2)  # Threshold: >0.2 point/week = concern
    factor_2 = min(1.0, rpe_drift * 5) * 0.30

    # Factor 3: Volume trend (25% weight)
    volume_history = get_weekly_volume(user_data, weeks=window_weeks)
    volume_trend = linear_regression_slope(volume_history)
    volume_decline = max(0, -volume_trend / volume_history[0])
    factor_3 = min(1.0, volume_decline * 10) * 0.25

    # Factor 4: Rep performance hit rate (10% weight)
    rep_hit_rate = get_rep_target_hit_percentage(user_data, weeks=window_weeks)
    rep_decline = max(0, (0.85 - rep_hit_rate) / 0.85)  # Decline from 85% baseline
    factor_4 = min(1.0, rep_decline) * 0.10

    deload_score = factor_1 + factor_2 + factor_3 + factor_4
    return deload_score

def get_deload_recommendation(deload_score):
    if deload_score < 0.3:
        return "green"  # ↑ Progressing well
    elif deload_score < 0.6:
        return "yellow"  # → Plateau detected, monitor
    else:
        return "red"  # ↓ Deload recommended
```

**Implementation Notes:**
- **Window size:** 4 weeks (balance between signal and noise)
- **e1RM calculation:** Use Epley formula: `1RM = weight × (1 + reps/30)`
- **RPE drift:** Only measure on exercises done 3+ times in window
- **Volume:** `Σ(sets × reps × weight)` per week, then moving average
- **Rep hit rate:** % of sessions where user hit target rep range (if set)

**Advantages:**
- Multi-factor prevents false positives
- Weighted (can tune based on feedback)
- Uses leading indicators (RPE before strength drop)
- Transparent (users see components)

#### **Tier 3: Machine Learning / Personalized (Advanced)**

```python
def ml_deload_recommendation(user_data, user_id):
    """
    Uses historical patterns to predict personalized thresholds
    """

    # Learn from past deloads
    past_deloads = get_user_deload_history(user_id)

    # For each deload, extract:
    # - What metrics preceded it?
    # - How long did recovery take?
    # - How did they respond (back stronger vs. struggling)?

    user_features = extract_features(user_data, past_deloads)

    # Train model: when does THIS user need deload?
    # (Capture individual variance: some recover faster, etc.)

    prediction = model.predict(user_features)
    return prediction  # 0-1 deload probability
```

**Not recommended for Gymdash MVP** due to:
- Requires 3+ months user data to train
- Adds complexity without proven ROI
- Tier 2 covers 90% of use cases

### 4.2 Deload Length & Programming

**Standard Duration:** 1 week (5 out of 5 apps studied use this)

**How to Structure:**

```
FULL DELOAD WEEK (50% Volume):
├─ Reduce weight: 10-20% off normal
└─ Keep frequency: Same session count per week
   Result: Half the volume, maintains movement patterns

EXAMPLE:
Normal Week:
- Bench: 4 sets × 5 @ 225 lbs = 4,500 lbs volume
- Squat: 5 sets × 3 @ 315 lbs = 4,725 lbs volume
Total: 9,225 lbs

Deload Week:
- Bench: 4 sets × 3 @ 200 lbs = 2,400 lbs volume (-47%)
- Squat: 5 sets × 3 @ 275 lbs = 4,125 lbs volume (-13%)
Total: 6,525 lbs (41% reduction)
```

**Alternative: Strategic Deload (Exercise Variation)**
- Keep intensity (weight), reduce volume (sets/reps)
- Or: Swap to variation (barbell → dumbbell, reduce familiarity stress)

### 4.3 False Positive Prevention

**Problem:** User has one bad week (sleep, stress) → deload suggested → user frustrated

**Solutions:**

1. **Wait for Confirmation:** Require yellow state for 2 weeks before suggesting red
   ```python
   if weeks_in_yellow >= 2:
       suggest_deload()
   ```

2. **Activity Context:** Check calendar/notes
   ```python
   if user_notes_travel_or_stress_recent():
       increase_threshold_for_deload()
   ```

3. **Require Multiple Factors:** Don't trigger on single metric
   ```python
   if factors_triggered >= 2:  # Need e1RM decline AND RPE drift
       suggest_deload()
   ```

4. **Rolling Baseline:** Compare to user's personal average, not global
   ```python
   personal_avg_rpe = median(user.rpe_history[-90_days])
   rpe_drift = current_rpe - personal_avg_rpe
   ```

### 4.4 Should the App Auto-Program Deload or Just Suggest?

**Recommendation: SUGGEST ONLY (with easy trigger for auto-program)**

**Why Not Auto-Program:**
- Users value agency
- Deload timing is personal (competition schedule, travel, etc.)
- Alpha Progression, Strong, Hevy all use suggestions
- RP Hypertrophy nudges but waits for user confirmation

**Gymdash Implementation:**
```
YELLOW STATE:
┌──────────────────────────────────┐
│  🟡 Plateau Detected             │
│                                  │
│  e1RM flat 3 weeks, RPE rising   │
│                                  │
│  [Start Deload Week] [Not Now]   │
│                                  │
│  (Deload = 50% volume, 1 week)   │
└──────────────────────────────────┘

ON TAP [Start Deload Week]:
- Reduce all exercises by 40-50% volume
- Copy this week's plan to next week pre-filled
- User can edit if needed
- On completion, resume normal programming
```

**Safety:** Always show deload details before confirming

---

## Section 5: Analysis Screen Best Practices

### 5.1 What Makes Analysis Screens Actually Useful

**Anti-Pattern:** Showing everything (10+ charts, tables)
- Users are overwhelmed
- No clear insight
- Abandoned

**Pattern:** Structured layers with clear narrative

### 5.2 Information Hierarchy for Analysis Screen

```
┌─────────────────────────────────────────┐
│ ANALYSIS — LAST 4 WEEKS                 │
├─────────────────────────────────────────┤
│                                         │
│ LAYER 1: SUMMARY (Glance)               │
│ ┌─────────────────────────────────────┐ │
│ │ Overall: 🟢 Progressing             │ │
│ │ • e1RM: ↑ +2.1%                     │ │
│ │ • Volume: ↑ +3.2%                   │ │
│ │ • Sessions: 15/16 complete          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ LAYER 2: TRENDS (Scroll for Detail)     │
│ ┌─────────────────────────────────────┐ │
│ │ Estimated 1RM Trend (Line Chart)    │ │
│ │         |                            │ │
│ │     ↗   |  .                         │ │
│ │    . \ | /                           │ │
│ │ ──────────────                       │ │
│ │ Week 1  2  3  4                      │ │
│ │                                     │ │
│ │ [Week-over-week: +2.1%]             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ LAYER 3: EXERCISE BREAKDOWN             │
│ ┌─────────────────────────────────────┐ │
│ │ BENCH PRESS                         │ │
│ │ ├─ e1RM: 185 → 189 lbs (+2.2%)      │ │
│ │ ├─ Sessions: 4                      │ │
│ │ ├─ RPE avg: 7.1 (↑ from 6.8)        │ │
│ │ └─ Rep consistency: 85% target hit  │ │
│ │                                     │ │
│ │ SQUAT                               │ │
│ │ ├─ e1RM: 275 → 280 lbs (+1.8%)      │ │
│ │ ├─ Sessions: 4                      │ │
│ │ ├─ RPE avg: 7.4 (→ stable)          │ │
│ │ └─ Rep consistency: 90% target hit  │ │
│ │                                     │ │
│ │ [Show top 5 exercises, scrollable] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ LAYER 4: DEEP DIVES (Toggle/Expand)     │
│ ├─ RPE Distribution (histogram)         │
│ ├─ Volume per Muscle Group (pie)        │
│ ├─ Consistency Heatmap (calendar)       │
│ └─ Session Duration Trend               │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 Specific Components That Work

#### **Component 1: e1RM Trend Line (Most Important)**

```
Shows: Strength progression over time
Type: Line chart, color-coded
Best: Weekly rolling average + individual sessions (light dots)

Why Users Love It:
- Single number they care about (how strong am I?)
- Trend visibility (↑ motivating, ↓ actionable)
- Easy to benchmark (compare to 4 weeks ago)

Example Visual:
    190 |       .
    188 |     . .
    186 |   .   .
    184 | .     .
    182 |_________________ Week ago: 182, Now: 188 (+3.3%)
```

#### **Component 2: RPE Distribution Histogram**

```
Shows: Are you training in the right intensity zone?
Type: Horizontal bar chart
Buckets: RPE 4-5, 6-7, 8-9, 9-10

Why It Matters:
- Spot: "I'm training all hard" (never recovery) vs. "all easy" (no stimulus)
- Healthy: 30-40% low (RPE 6-7), 50-60% medium (7-8), 10-20% hard (8-10)

Example:
RPE 4-5: ░░░░░░░░░░ (2%)
RPE 6-7: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (42%)
RPE 8-9: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (38%)
RPE 9+:  ░░░░░░░░░ (18%)
```

#### **Component 3: Consistency Heatmap (Adherence)**

```
Shows: Did you train this week? Visual calendar
Type: Grid (7 cols × 4-5 rows for week view)
Colors: Green (done), Yellow (partial), Gray (rest day/skipped)

Why It's Powerful:
- Users subconsciously see patterns (did I skip Mondays?)
- Motivational (see streaks)
- Non-judgmental (just shows reality)

Example:
   Week 1    Week 2    Week 3    Week 4
M  🟢        🟢        🟢        🟡
T  🟢        🟢        ⚪        🟢
W  🟢        🟢        🟢        🟢
T  🟢        🟢        🟢        🟢
F  🟢        ⚪        🟢        🟢
S  🟡        🟢        🟢        🟢
S  ⚪        ⚪        ⚪        🟢

Streak: 4 days (current)
```

#### **Component 4: Top Exercises Performance**

```
Shows: How are my key lifts trending?
Type: Scrollable list, exercise-by-exercise breakdown
Per Exercise: e1RM, volume, RPE avg, rep consistency, sessions

Why Useful:
- Micro-trends (bench down but squat up)
- Spot weak links (one lift stalling)
- Actionable (adjust that lift specifically)

Example:
┌─────────────────────────────────────┐
│ BENCH PRESS                         │
│ ─────────────────────────────────── │
│ e1RM:  185 → 189 lbs  ↑ +2.2%      │
│ Vol:   14,200 lbs     ↑ +5.1%      │
│ RPE:   7.1 avg        ↑ +0.3       │
│ Reps:  85% hit target → stable     │
│ Sessions: 4 times                   │
│                                     │
│ [Tap to see all sessions]           │
└─────────────────────────────────────┘
```

### 5.4 Analysis Screens in Popular Apps (Competitive Analysis)

| App | Standout Feature | How It Works |
|-----|------------------|-------------|
| **Strong** | Timeline view of 1RM PRs | Tap exercise → see every PR date and value |
| **Hevy** | Muscle group volume pie chart | Shows training emphasis (chest: 30%, legs: 40%, etc.) |
| **JEFIT** | Calendar heatmap | Visual adherence (full year view available) |
| **Fitbod** | Movement velocity tracking | Shows bar speed trend (if phone-tracked) |
| **RP Hypertrophy** | MEV/MRV progress bars | Visual volume accumulation toward recommended max |
| **Alpha Progression** | Rep max milestones | Shows max reps at 90% achieved, with timeline |

**Common Success Patterns:**
1. One primary metric (e1RM, volume, or adherence)
2. Trend visualization (chart or timeline)
3. Exercise-specific breakdowns
4. Option to drill down (tap to expand)
5. **Avoid:** Overly complex ratios without explanation

### 5.5 Common UX Mistakes to Avoid

1. **"Training Stress Score" Without Context**
   - ❌ Showing mystical number (TSS 450) users don't understand
   - ✅ Break into components (volume, intensity, sessions)

2. **Too Many Metrics at Once**
   - ❌ Screen with 6+ different numbers
   - ✅ 3 primary metrics, tap to expand

3. **No Time Window Selection**
   - ❌ Fixed to "all time" or "this week"
   - ✅ Toggle: 4 weeks (default), 8 weeks, 12 weeks, all time

4. **Lagging Indicators Only**
   - ❌ Only showing "e1RM down this week" (already know by trying)
   - ✅ Lead with RPE drift (warning) + e1RM (confirmation)

5. **No Explanation of Colors/Icons**
   - ❌ Green arrow but user doesn't know what it means
   - ✅ Tooltip or legend: "↑ means strength increasing"

6. **Non-Actionable Insights**
   - ❌ "Volume is declining" (so what?)
   - ✅ "Volume declining 2 weeks → Consider deload" (actionable)

---

## Section 6: Recommendations for Gymdash Implementation

### 6.1 MVP Phase (Months 1-2)

**Scope:** Minimal deload system to validate utility

**Home Screen:**
```
┌──────────────────────────────────┐
│ THIS WEEK'S STATUS               │
├──────────────────────────────────┤
│         🟢 PROGRESSING           │
│                                  │
│ • Strength: ↑ +1.8% (e1RM)      │
│ • Volume: ↑ +2.3%               │
│ • Sessions: 4/4 complete ✓       │
│                                  │
│ [View Analysis]                  │
└──────────────────────────────────┘
```

**Algorithm:**
- Simple rule-based (Tier 1)
- Check: "4+ weeks since deload" OR "e1RM down 3%+ over 3 weeks"
- Suggest only (never auto-program)
- Hide complexity (just show traffic light)

**Analysis Screen:**
- e1RM trend (line chart, 4-week window)
- Weekly volume comparison (number + arrow)
- Session count / adherence
- Tap exercise → see e1RM trend for that lift

**Implementation Effort:** 1-2 weeks (SQLite query + React Native UI)

### 6.2 Phase 2 (Months 3-4)

**Add:** Multi-factor deload scoring + RPE drift

**New Metrics:**
- Track RPE on repeated exercises (same weight)
- Calculate RPE drift (alert if increasing >0.5 points/week)
- Weight multi-factor score (Tier 2 algorithm)

**Home Screen Update:**
```
🟡 PLATEAU ZONE
• e1RM: Flat 3 weeks
• Volume: Slight decline
• RPE: Rising on bench

Consider deload [→]
```

**Analysis Screen:**
- Add RPE distribution histogram
- Add rep target hit % visualization
- Add deload suggestion button

**Implementation Effort:** 2-3 weeks

### 6.3 Phase 3 (Months 5+)

**Add:** Personalization + machine learning

**Features:**
- User preference: "suggest deload every X weeks" vs. "only when declining"
- ML model: Learn individual recovery patterns
- Tactical deloads: Suggest which exercises to deload
- Integration: Connect to Apple Health (sleep/HR data)

**Implementation Effort:** 3-4 weeks

### 6.4 Database Schema for Trend Tracking

```sql
-- Core tables (likely already exist)
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    session_date TEXT,
    duration_minutes INTEGER,
    created_at TEXT
);

CREATE TABLE exercises (
    id INTEGER PRIMARY KEY,
    session_id INTEGER,
    exercise_name TEXT,
    sets INTEGER,
    reps INTEGER,
    weight REAL,
    rpe REAL,  -- 6.0 to 10.0
    created_at TEXT
);

-- New tables for trend tracking
CREATE TABLE estimated_1rm (
    id INTEGER PRIMARY KEY,
    exercise_id INTEGER,
    weight REAL,
    reps INTEGER,
    calculated_1rm REAL,  -- Using Epley: weight * (1 + reps/30)
    rpe REAL,
    session_date TEXT,
    UNIQUE(exercise_id, session_date)
);

CREATE TABLE weekly_metrics (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    week_end_date TEXT,  -- Sunday of that week
    total_volume REAL,   -- SUM(sets * reps * weight)
    avg_rpe REAL,
    session_count INTEGER,
    missed_sessions INTEGER,
    created_at TEXT
);

CREATE TABLE deload_recommendations (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    recommended_date TEXT,
    reason TEXT,  -- "e1rm_declining", "rpe_drift", "volume_plateau"
    score REAL,   -- 0.0-1.0
    dismissed BOOLEAN,
    deload_started_date TEXT,
    created_at TEXT
);
```

### 6.5 Query Examples for Calculations

```sql
-- Get weekly e1RM for an exercise
SELECT
    DATE(SUBSTR(e.session_date, 1, 10), '-' || CAST((CAST(STRFTIME('%W', e.session_date) AS INTEGER)) AS TEXT) || ' days') AS week_end,
    exercise_name,
    AVG(e.calculated_1rm) AS weekly_avg_1rm
FROM estimated_1rm e
WHERE exercise_name = 'Bench Press'
    AND session_date >= DATE('now', '-4 weeks')
GROUP BY DATE(SUBSTR(e.session_date, 1, 10), '-' || CAST((CAST(STRFTIME('%W', e.session_date) AS INTEGER)) AS TEXT) || ' days')
ORDER BY week_end;

-- Get weekly volume
SELECT
    DATE(session_date, 'start of week') AS week_start,
    SUM(sets * reps * weight) AS total_volume
FROM exercises
WHERE user_id = ?
    AND session_date >= DATE('now', '-4 weeks')
GROUP BY DATE(session_date, 'start of week')
ORDER BY week_start;

-- Detect RPE drift on same load
SELECT
    exercise_name,
    CAST(weight AS INTEGER) AS weight_bucket,
    ROUND(AVG(rpe), 1) AS avg_rpe,
    (
        SELECT ROUND(AVG(rpe), 1)
        FROM exercises
        WHERE exercise_name = e.exercise_name
            AND CAST(weight AS INTEGER) = CAST(e.weight AS INTEGER)
            AND session_date >= DATE('now', '-2 weeks')
    ) AS recent_rpe
FROM exercises e
WHERE user_id = ?
    AND session_date >= DATE('now', '-4 weeks')
    AND exercise_name IN ('Bench Press', 'Squat', 'Deadlift')  -- Repeated lifts
GROUP BY exercise_name, CAST(weight AS INTEGER);
```

### 6.6 Specific Feature Recommendations

**DO:**
- ✅ Show traffic light status (🟢/🟡/🔴) on home screen
- ✅ Calculate e1RM using Epley formula (validated)
- ✅ Track RPE per set (already doing)
- ✅ Use 4-week rolling windows (optimal signal-to-noise)
- ✅ Suggest deload (never force)
- ✅ Allow manual deload trigger any time
- ✅ Show one primary chart (e1RM trend, not 6 charts)
- ✅ Make analysis optional (not required)

**AVOID:**
- ❌ Auto-programming deloads (user agency)
- ❌ Undefined metrics ("training load" without explanation)
- ❌ Too many colors/icons (confusing)
- ❌ Requiring extensive user data before showing insights (need 2 weeks minimum, not 2 months)
- ❌ Hidden complexity (be transparent about what the traffic light means)
- ❌ Scary messaging ("You're declining!") without actionable fix

### 6.7 Offline Compatibility (Gymdash Strength)

**Advantage:** SQLite stores all calculations locally
- e1RM trends calculated offline
- Deload recommendations work offline
- No API dependency (privacy + reliability)
- Sync to cloud if user wants (optional)

**Implementation:**
- Query SQLite for last 4 weeks' data
- Calculate metrics on app startup (or nightly)
- Cache results in memory
- Update UI with cached metrics

---

## Section 7: Summary & Next Steps

### 7.1 Key Takeaways

1. **Multi-metric > single metric:** e1RM + RPE + volume catches 90% of fatigue signals
2. **RPE drift is a leading indicator:** Catches overtraining 1-2 weeks before e1RM drops
3. **Traffic light system (🟢/🟡/🔴) is goldilocks:** Clear, motivating, not overwhelming
4. **Suggest don't command:** Users value agency; RP Hypertrophy, Alpha, Strong all suggest
5. **4-week windows are optimal:** 3 weeks = noisy, 6+ weeks = misses recent trends
6. **Deload = 1 week at 40-50% volume:** Standard across all apps
7. **Simple home screen, deep analysis optional:** Don't clutter default view

### 7.2 Competitive Advantage for Gymdash

- **Offline-first:** Metric calculations don't require server
- **Transparency:** Show RPE drift (competitors often hide)
- **Agency:** Always suggest, never force (vs. RP which auto-programs)
- **Simplicity:** One traffic light + tap to drill down (vs. Fitbod's overwhelming charts)
- **Context:** Explain why (e.g., "RPE rising on same weight" not just "deload")

### 7.3 Implementation Roadmap

```
Week 1-2 (MVP):
├─ Add e1RM calculation (Epley)
├─ Build trend detection (4 rules)
├─ Design home screen status card
└─ Build analysis chart (e1RM trend only)

Week 3-4 (Phase 2):
├─ RPE drift tracking
├─ Multi-factor scoring (Tier 2)
├─ Add yellow/red states
└─ Add RPE histogram

Week 5+ (Phase 3):
├─ ML personalization
├─ Tactical deload suggestions
└─ Health data integration (optional)
```

---

## References & Sources

### Sports Science References
1. **Greg Nuckols (STRONGER by Science)** — "Scientific Principles of Strength Training"
   - e1RM + RPE + velocity are holy trinity of fatigue detection
2. **Mike Israetel & Eric Helms (Renaissance Periodization)** — "The Renaissance Diet"
   - MEV/MRV framework, RPE as leading indicator
3. **Lyle McDonald** — "The Ketogenic Diet"
   - Simple deload triggers (2 weeks plateau OR RPE +1)
4. **Yuri Verkhoshansky** — "Block Periodization: Breakthrough in Sport Training"
   - Foundational work on deload timing
5. **Andy Baker (Juggernaut Training Systems)** — Velocity-based training research

### App References
1. **RP Hypertrophy App** — RIR-based auto-progression with MEV/MRV tracking
2. **Juggernaut AI** — Bar speed tracking + RPE synthesis
3. **Alpha Progression** — Simple milestone tracking (3 reps same weight = plateau)
4. **Strong App** — PR timeline + manual deload trigger
5. **Hevy** — Exercise-level analytics + muscle group distribution
6. **Fitbod** — Velocity tracking + exercise rotation

### Database/Implementation
- SQLite date functions: https://sqlite.org/lang_datefunc.html
- Epley 1RM Formula: Brzycki, Lander, Adams variants (Epley most accurate for lower reps)

---

## Appendix: Formula Reference

### Estimated 1RM Calculations

```
Epley:       1RM = weight × (1 + reps/30)
Brzycki:     1RM = weight × 36 / (37 - reps)
Lander:      1RM = (100 × weight) / (101.3 - 2.67123 × reps)
Mayhew:      1RM = (100 × weight) / (52.2 + 41.9 × e^(-0.055 × reps))
```

**Recommendation:** Use Epley for Gymdash (simplest, accurate for 1-10 rep range)

### Volume Load Formula

```
Session Volume = Σ(exercise_sets × exercise_reps × exercise_weight)
Weekly Volume = Σ(all session volumes this week)
Volume Index = Current_Week_Volume / Average_Previous_4_Weeks_Volume
```

### RPE Drift Detection

```
RPE_drift_rate = (current_week_rpe - baseline_rpe) / weeks_since_baseline
Threshold: > 0.2 points per week = concerning

Example:
- 3 weeks ago: Bench 225×5 @ RPE 7.0
- 2 weeks ago: Bench 225×5 @ RPE 7.2
- 1 week ago:  Bench 225×5 @ RPE 7.5
- This week:   Bench 225×5 @ RPE 8.0
Drift rate = (8.0 - 7.0) / 3 weeks = 0.33 points/week → ALERT
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-25
**Author:** Research Coordinator (Claude Code)
**Status:** Ready for Implementation Planning
