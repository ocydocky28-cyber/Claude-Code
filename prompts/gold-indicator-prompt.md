# Prompt for Claude Code: "Gold Sniper" XAUUSD Indicator (TradingView Pine Script v6)

> Copy everything below the line into Claude Code. Attach the 4 reference screenshots with it.

---

## ROLE

You are a senior quantitative developer and former prop-desk gold (XAUUSD / COMEX GC) trader. You write production-quality **TradingView Pine Script v6**. You think like a quant: every signal must have a measurable reason, every parameter must be justified, and nothing may repaint or peek into the future.

## GOAL

Build a TradingView indicator for **gold only** (XAUUSD spot, also works on GC1! futures) that:

1. Works out the market's **bias for the day** (where price is likely to go today).
2. Reads **volume / order flow** to see where large players are active.
3. Uses the **maths quants and floor traders actually use** (VWAP and its standard-deviation bands, volume profile, z-scores, volatility regimes, liquidity concepts, statistical expectancy).
4. Produces **high-quality Buy / Sell signals on the 1m, 5m and 15m timeframes**: only when the analysis lines up, as often as the market honestly allows.
5. Draws each trade **exactly like the reference screenshots**: entry point, green take-profit box, red stop-loss box, and a "Long TP" / "Short TP" label when the target is hit.
6. **Learns from its own results**: it tracks every signal it gave, sees which conditions won and which lost, and adjusts its scoring so later signals improve.
7. Aims for a **60–70% win rate with at least 1:1.5 risk-to-reward**, and reports its real measured stats on the chart so I can see if it gets there.

Deliver **two files**:
- `GoldSniper_Indicator.pine`: the visual indicator with alerts.
- `GoldSniper_Strategy.pine`: the same logic as a `strategy()` so I can backtest it in TradingView's Strategy Tester (with spread/commission), to prove the win rate before I trade it live.

Put the shared logic in the same order in both files so they stay in sync.

---

## HARD RULES (non-negotiable)

- **Pine Script v6** (`//@version=6`). It must compile with zero errors or warnings in the TradingView Pine Editor.
- **No repainting.** Signals fire only on confirmed bars (`barstate.isconfirmed`). Every `request.security()` for a higher timeframe uses `lookahead = barmerge.lookahead_off` with the `[1]` offset pattern so it only uses closed HTF bars. No `lookahead_on` anywhere.
- **No future data in the learning engine.** A trade's result only goes into the stats on the bar where its TP or SL was actually hit.
- Stay within Pine limits: `max_boxes_count=500`, `max_labels_count=500`, `max_lines_count=500`, `max_bars_back` set sensibly. Delete the oldest drawings when near the limits.
- Use `var` / `varip` correctly and keep loops bounded so the script stays fast on 1m charts with 20k+ bars.
- Every input has a tooltip that explains it in plain English.
- Put a comment above each section explaining **why** it exists (the trading logic), not just what the code does.

### Be honest about what Pine can and cannot do (build the best real version, never fake it)

- **"Insider info"**: no indicator can see real insider or private order data, and trading on actual insider information is illegal. Replace it with the legal proxies institutions leave on the chart: unusual-volume spikes, volume delta / absorption, liquidity sweeps of obvious highs and lows, order blocks, fair-value gaps, and how gold reacts to the US Dollar Index (DXY) and US 10-year yields. Label this section **"Smart Money Footprint"**.
- **Gold volume**: spot XAUUSD only has *tick* volume, which differs by broker. Add an input `Volume Source` = `Chart` / `COMEX:GC1!` so I can pull real futures volume from GC1! while viewing XAUUSD. Default to `COMEX:GC1!`, and fall back to chart volume if it's unavailable.
- **"Learning"**: Pine keeps no memory between reloads. Do the learning **online across all loaded history**: the script walks bar by bar through history, takes every signal, records the result, and updates its weights as it goes. By the time it reaches the live bar it has "trained" on thousands of past signals, without lookahead. Explain this in a comment block at the top.
- **News**: Pine can't read an economic calendar. Add a manual **News Blackout** input (up to 5 date/time windows plus the number of minutes before and after each) and an automatic blackout on the first Friday of the month at 08:30 New York time (NFP). No new signals during blackouts.
- **Win rate**: never hard-code or show a made-up number. The dashboard shows only **measured** results from the script's own tracked trades.

---

## 1. SESSION & DAILY BIAS ENGINE ("Where is gold going today?")

All session times are in **America/New_York** via `time(timeframe.period, session, "America/New_York")`.

| Session | NY time | Purpose |
|---|---|---|
| Asia | 19:00–00:00 | Builds the range that London/NY usually sweep |
| London | 02:00–05:00 | First real move of the day, often a fake-out of Asia |
| NY AM | 08:00–11:00 | Highest volume and best signals for gold |
| NY PM | 13:30–16:00 | Lower quality, needs a higher score |
| Dead zones | 11:00–13:30, 16:00–19:00 | No new signals by default (toggle) |

Compute and keep for each day:
- Previous Day High / Low / Close (PDH / PDL / PDC), Previous Week High / Low.
- Asian Range high / low and its size in ATR terms.
- Today's open (midnight NY) and the London open price.
- **ADR(14)** (average daily range) and **how much of today's ADR is used up**. Once >85% of ADR is used, block continuation trades and allow only mean-reversion trades.

**Daily Bias Score (−100 to +100)**, combining:
1. **HTF structure**: 4H and 1H market structure (higher highs/higher lows vs lower highs/lower lows from confirmed pivots), plus 1H EMA 50 vs EMA 200 alignment.
2. **Position against the prior day**: price above PDH → bullish, below PDL → bearish, inside → neutral/range.
3. **Daily open rule**: price above/below today's open in NY session.
4. **Intermarket**: `TVC:DXY` and `TVC:US10Y` 1H trend. Gold usually moves the opposite way to both. If DXY and yields are both rising, cut long scores; both falling, cut short scores. Calculate a rolling 50-bar correlation between gold and DXY returns and only apply this filter when the correlation is below −0.3 (when the relationship is actually in force).
5. **Prior-day Volume Profile**: open above the prior Value Area → bullish acceptance; below → bearish; inside → expect rotation toward POC.

Show the bias on the dashboard as **BULLISH / BEARISH / NEUTRAL** with the score.

---

## 2. VOLUME & ORDER-FLOW ENGINE

- **Session VWAP** (reset at 18:00 NY = gold futures day) with **±1σ, ±2σ, ±3σ bands** using volume-weighted standard deviation.
- **Anchored VWAPs** from: the start of the week, the prior day's high and low, and the most recent confirmed swing high/low.
- **Volume Delta**: use `request.security_lower_tf()` to get intrabar data (1-second or 1-tick on paid plans, falling back to the lowest timeframe available) and classify each intrabar's volume as buy or sell by close vs open. Build **Cumulative Volume Delta (CVD)** per session. If lower-TF data isn't available, approximate delta per bar with `volume * (close - open) / (high - low)`.
- **Relative Volume (RVOL)**: current bar volume ÷ the average volume at **the same time of day** over the last 20 sessions (time-of-day normalized, because gold's volume is very different at 03:00 vs 09:30). RVOL > 1.5 = institutional activity.
- **Absorption**: high RVOL with a small candle body (<30% of range) at a key level means big orders soaking up the move → reversal warning.
- **Delta divergence**: price makes a new high but CVD does not (or the reverse for lows) → exhaustion.
- **Session Volume Profile** (rolling, current and previous day): POC, VAH, VAL (70% value area), computed from bars binned into price rows (default 50 rows). Draw prior-day POC/VAH/VAL as thin lines (toggle).

---

## 3. SMART MONEY FOOTPRINT (legal "insider" proxies)

- **Liquidity pools**: equal highs/lows (within 0.1 × ATR), PDH/PDL, Asian high/low, session highs/lows. Store them in arrays.
- **Liquidity sweep**: the wick goes through a pool and the candle **closes back inside**, with RVOL > 1.2. This is the main reversal trigger: big players fill orders against stop-losses.
- **Market Structure Shift (MSS) / Change of Character (CHoCH)**: after a sweep, price closes past the last opposing internal swing point with displacement (body > 1.2 × ATR(14) or 2 consecutive strong candles).
- **Fair Value Gaps (FVG)**: 3-candle imbalances bigger than 0.25 × ATR. Track them until they are filled 50%.
- **Order Blocks**: the last opposite-colour candle before a displacement move that broke structure. Valid until price closes through it.
- **Premium / Discount**: inside the current dealing range (last major swing high to low) only take longs in the discount half and shorts in the premium half, unless it's a breakout setup.

---

## 4. QUANT MATHS LAYER

- **Volatility regime**: ATR(14) percentile rank over the last 500 bars. Low (<20th percentile) = compression, normal, high (>80th) = expansion. Scale stops and targets by regime.
- **Trend vs mean-reversion regime**: use **Kaufman Efficiency Ratio (ER, 20)** and **Hurst exponent estimate (rescaled-range, 100 bars)**. ER > 0.35 or H > 0.55 = trending → prefer continuation setups. ER < 0.2 or H < 0.45 = mean-reverting → prefer VWAP-band fade setups.
- **VWAP z-score**: (close − VWAP) / σ. |z| > 2 at a liquidity level with absorption = high-quality fade.
- **Linear-regression slope** (50 bars) normalized by ATR for trend strength.
- **Bollinger/Keltner squeeze** for breakout timing.
- **RSI(14) divergence** on confirmed pivots, as a confluence only, never as a signal on its own.
- **Expectancy**: for every setup type keep `E = WinRate × AvgWin_R − LossRate × AvgLoss_R`. Setups with negative expectancy over their last 30 trades get **switched off automatically** until their recent results recover (keep tracking them "shadow" style without showing them).

---

## 5. SETUP TYPES (the actual trades)

Each setup builds a **confluence score from 0–100** using weighted features (see the learning engine). A signal only fires when **score ≥ the adaptive threshold** (default 70) **and** every hard filter passes.

### A. Liquidity Sweep Reversal (main setup, best for NY AM and London)
1. Price sweeps a liquidity pool (Asian H/L, PDH/PDL, equal highs/lows, session H/L).
2. Closes back inside, with RVOL ≥ 1.2 and/or absorption and/or delta divergence.
3. MSS on the entry timeframe within the next N bars (default 6).
4. **Entry**: on the bar that confirms the MSS, or a limit at the FVG / order block left by the displacement (input: `Market on confirmation` / `Limit at FVG`).
5. Bias filter: fires with the daily bias, or against it only when the sweep is of PDH/PDL with a score ≥ 85.

### B. Trend Pullback Continuation (trending regime)
1. HTF bias and entry-TF structure both agree. ER/Hurst say trending.
2. Price pulls back into VWAP, VWAP ±1σ, an unfilled FVG or a fresh order block, in the discount zone for longs and premium for shorts.
3. Rejection candle with positive delta (longs) / negative delta (shorts).
4. **Entry**: close of the rejection candle.

### C. Compression Breakout (squeeze regime, NY open)
1. Squeeze on (Bollinger inside Keltner) for ≥ 10 bars, ATR percentile < 30.
2. Breakout candle closes outside the range with RVOL ≥ 1.8 and delta agreeing with the direction.
3. Agrees with daily bias.
4. **Entry**: retest of the broken range edge (or on close if the retest option is off).

### D. VWAP Band Fade (mean-reverting regime only)
1. |VWAP z-score| ≥ 2, price at or beyond ±2σ and at a liquidity level or prior VAH/VAL.
2. Absorption or delta divergence present.
3. **TP** at VWAP or the ±1σ band, whichever gives RR ≥ 1.5.

### Hard filters for all setups
- Not inside a news blackout or dead zone (toggle).
- Spread filter: input `Max spread (points)`, default 0.35 for XAUUSD. Skip if `ATR(14) < 3 × spread` (not enough room to move).
- **One open trade at a time per timeframe**; no new signal in the same direction until the current one has finished.
- Cooldown of N bars after a loss (default 3).
- Max 3 losses per day per timeframe, then stop until the next session (circuit breaker).

---

## 6. MULTI-TIMEFRAME BEHAVIOUR (1m / 5m / 15m)

The indicator detects `timeframe.period` and loads tuned defaults automatically:

| | 1m | 5m | 15m |
|---|---|---|---|
| HTF bias from | 15m + 1H | 1H + 4H | 4H + D |
| Swing pivot length | 3 | 4 | 5 |
| SL ATR buffer | 0.3 × ATR | 0.25 × ATR | 0.2 × ATR |
| Min score | 75 | 70 | 68 |
| Min RR | 1.5 | 1.5 | 1.8 |
| Max trade length (bars) | 60 | 48 | 32 |

- Add an option **"MTF Confluence"**: on 1m, only show signals that agree with the current 5m and 15m bias (from `request.security` of the 5m/15m bias score). This cuts noise on 1m a lot.
- On any other timeframe show a warning in the dashboard: "Optimised for 1m / 5m / 15m".

---

## 7. STOP LOSS & TAKE PROFIT LOGIC (good RR that actually gets hit)

**Stop Loss**: placed behind structure, never at a random fixed distance:
- Sweep setup: beyond the sweep wick + SL buffer (ATR-based, see table).
- Pullback/OB/FVG setups: beyond the far edge of the zone + buffer.
- Clamp the SL between 0.5 × ATR and 2.5 × ATR. If the structural stop is bigger than the max, **skip the trade** (don't make the stop artificially smaller).

**Take Profit**: target the **next real liquidity / level** in the trade's direction, not a fixed multiple:
- Candidates: opposing liquidity pool, VWAP or σ band, prior POC/VAH/VAL, PDH/PDL, unfilled FVG edge.
- Pick the **nearest candidate that gives RR ≥ the minimum RR** and is **less than 70% of the remaining ADR away**. If none qualify, **don't take the trade**. This is the key to a high win rate: only take trades where a realistic target sits at a good RR.
- Optional TP1 at 1R (partial close / move SL to breakeven) shown as a thin dashed line inside the green box. Input to choose whether a TP1 hit followed by breakeven counts as a win, a scratch, or a loss in the stats. **Default: scratch** (honest).

---

## 8. SELF-LEARNING ENGINE

Make it an **online logistic-regression scorer**:

1. **Features** (each normalized to 0–1 or −1..+1) for every candidate signal: bias alignment, HTF structure agreement, RVOL, delta agreement, absorption, sweep present, MSS displacement strength, FVG/OB present, VWAP z-score, ER, Hurst, ATR percentile, session (one-hot: London / NY AM / NY PM / Asia), premium/discount position, DXY agreement, setup type (one-hot), RR available, distance to target in ADR %.
2. **Score** = `sigmoid(w · x + b)` × 100 = estimated win probability.
3. **Initial weights**: sensible hand-tuned priors I can read in the code (e.g. sweep + MSS + bias alignment heaviest), so it works well from the first bar.
4. **Update**: when a tracked trade closes, `w += lr × (y − p) × x` with `y = 1` for a TP hit and `0` for an SL hit. Learning rate input default 0.02, with L2 regularization 0.001 so weights don't blow up.
5. **Shadow trades**: track and learn from **every candidate signal that passed the hard filters**, even ones under the threshold that weren't shown, so the model learns from the full set and not only what it displayed (otherwise it learns a biased sample).
6. **Adaptive threshold**: every 20 closed trades, re-tune the threshold over the last 100 closed shadow trades: choose the lowest threshold (to get the most trades) whose win rate is ≥ the input `Target Win Rate` (default 65%) **and** whose expectancy is positive. Clamp between 60 and 90.
7. **Per-session and per-setup memory**: separate win-rate counters per setup type × session so the dashboard can show which ones work.
8. **Warm-up**: no signals are displayed until at least 30 shadow trades have closed (input), so the model has some data first.

Keep the weights in `var array<float>` and comment each feature index clearly.

---

## 9. VISUALS (must match the reference screenshots)

Assume a black chart background. Exact look:

- **Buy signal**: green rounded label with white bold text **"Buy"**, `label.style_label_up`, placed **below** the entry candle's low. Colour `#2ECC71` (bright green).
- **Sell signal**: red label with white text **"Sell"**, `label.style_label_down`, **above** the entry candle's high. Colour `#F23645`.
- **Entry line**: thin **blue/purple** horizontal line (`#5B6CD8`, width 1) at the entry price, from the entry bar to the bar where the trade closes.
- **Take-profit box**: from the entry line to the TP price. Fill dark green `color.new(#1B5E20, 60)` (looks like `#15291A` on black), no border, with a **solid bright green line** (`#2ECC71`, width 2) along the TP edge.
- **Stop-loss box**: from the entry line to the SL price. Fill dark red/maroon `color.new(#7F1D1D, 60)` (looks like `#3A0E14` on black), no border, with a **solid red line** (`#F23645`, width 2) along the SL edge.
- Boxes **start at the entry bar and extend right bar by bar while the trade is open**, then **stop at the bar where TP or SL is hit** (as in the screenshots, the box ends at the exit candle).
- **Long TP hit**: magenta label `#D500F9` with white text **"Long TP"**, `label.style_label_down`, above the bar that hit TP.
- **Short TP hit**: same magenta, text **"Short TP"**, `label.style_label_up`, below the bar that hit TP.
- **SL hit**: grey label `#787B86` with **"Long SL" / "Short SL"** (toggle, on by default; I need to see losses too).
- **Timeout** (max trade length reached): close the box at that bar with a small grey "Exit" label.
- Labels have no extra text clutter. Optional toggle: show RR and score in a tooltip on the Buy/Sell label (e.g. `Score 78 | RR 1:2.1 | Sweep Reversal | NY AM`).
- Optional (off by default so the chart stays clean like the screenshots): VWAP + bands, prior-day POC/VAH/VAL, Asian range box, liquidity levels.
- Recommended chart colours (put this in a comment at the top): bullish candles white `#FFFFFF`, bearish candles grey `#5D606B`, wicks matching, background `#0F0F0F`, grid off.

### Dashboard (table, top-right, toggle, small text, dark theme)
- Daily Bias: BULLISH / BEARISH / NEUTRAL (+score)
- Regime: Trending / Mean-Reverting / Compression, plus ATR percentile
- Session: current session name / "Blackout" / "Dead zone"
- ADR used: xx%
- Current signal threshold (adaptive)
- **Measured stats** for this chart's timeframe: total trades, wins, losses, scratches, **win rate %**, average RR, profit factor, expectancy (R), max consecutive losses
- Best setup and worst setup (by expectancy, last 50)
- Model status: "Warming up (n/30)" / "Active"

---

## 10. ALERTS

- `alertcondition` + `alert()` (with `alert.freq_once_per_bar_close`) for: Buy, Sell, Long TP, Short TP, Long SL, Short SL.
- Message as JSON with: `{"symbol","tf","side","entry","sl","tp","rr","score","setup","session"}` so it can be used with webhooks.

---

## 11. STRATEGY VERSION (for proof)

`GoldSniper_Strategy.pine` uses the same logic with:
- `strategy.entry` / `strategy.exit` with the exact same SL/TP prices.
- Defaults: `initial_capital=10000`, `default_qty_type=strategy.percent_of_equity`, risk 1% per trade via position sizing from the SL distance, `commission_type=strategy.commission.cash_per_contract`, slippage 2 ticks, `process_orders_on_close=false`, `calc_on_every_tick=false`.
- Date-range inputs so I can do **walk-forward testing**: tune on one period, then check the next period without changing anything.

---

## 12. HOW TO WORK

1. First, write a short **plan** listing the modules and the order you'll build them in. Then build them.
2. Build in this order: inputs → sessions/levels → volume engine → structure/liquidity → quant layer → setups → SL/TP → trade tracker → learning engine → visuals → dashboard → alerts → strategy file.
3. After writing the code, **review it yourself line by line** for: Pine v6 syntax, repainting, lookahead, array index errors, `na` handling on the first bars, and drawing-object limits. Fix everything you find.
4. If you can't run Pine locally, say so, and give me exact steps to paste it into the TradingView Pine Editor, add it to an XAUUSD chart, and run the Strategy Tester on 1m, 5m and 15m.
5. Write a `README.md` explaining: each setup in plain English, every input, how the learning works, how to read the dashboard, and the **limits** (no strategy wins forever; results depend on broker data, spread and news; always forward-test on a demo account for at least 2–4 weeks before using real money).
6. Don't tell me the indicator "has" a 60–70% win rate. Tell me how to **measure** it with the dashboard and the Strategy Tester, and which inputs to adjust (threshold, min RR, sessions, setups on/off) if it's below target.

## SUCCESS CRITERIA

- Compiles in TradingView with no errors on Pine v6.
- No repainting: signals and boxes never change after the bar closes (I'll check with Bar Replay).
- The chart looks like the 4 reference screenshots.
- Fewer signals but higher quality on 1m; more frequent but still filtered on 5m/15m.
- The dashboard shows real measured stats, and the Strategy Tester results match the indicator's stats within a few %.
