# Gold Sniper: XAUUSD indicator for TradingView

An intraday gold indicator for the **1m, 5m and 15m** charts, written in Pine Script v6. It works out the day's bias, reads volume and order flow, finds four types of setups, and draws each trade the same way as the reference screenshots: a **Buy/Sell** label, a green take-profit box, a red stop-loss box and a **Long TP / Short TP** label when the target is hit. It learns from the result of every setup it finds.

| File | What it is |
|---|---|
| `GoldSniper_Indicator.pine` | The indicator to trade from. It draws the trades and sends alerts. |
| `GoldSniper_Strategy.pine` | The same logic as a `strategy()`, for the Strategy Tester (to check the win rate). |
| `src/GoldSniper_core.pine` | The single source both files are built from. |
| `build.py` | Regenerates both files from the core. Run it after any edit: `python3 gold-sniper/build.py` |

> **Edit the core, not the generated files.** Logic only for the indicator or only for the strategy sits between `// ==== BEGIN IND/STRAT` and `// ==== END …` markers.

---

## Install (about 2 minutes)

1. Open TradingView, then a chart of **XAUUSD** (OANDA, FOREX.com, etc.) or **COMEX:GC1!**.
2. Open the **Pine Editor** at the bottom of the screen.
3. Delete everything in the editor, paste the full contents of `GoldSniper_Indicator.pine`, then click **Save** and **Add to chart**.
4. Make the chart look like the screenshots: **Chart settings → Symbol**, set the bullish body, border and wick to `#FFFFFF` and the bearish ones to `#5D606B`. Under **Canvas**, set the background to `#0F0F0F` and turn the grid off.
5. Switch between 1m, 5m and 15m. The settings for each timeframe load automatically.

To backtest, open a new Pine Editor tab, paste `GoldSniper_Strategy.pine`, add it to the chart, and open the **Strategy Tester** tab.

> These scripts were written and syntax-checked outside TradingView. If the Pine Editor shows a compile error, copy the error message and line number back to Claude Code and it will fix it.

---

## Signal mode (Setups → Signal mode)

| Mode | What you get |
|---|---|
| **Frequent** (default) | Many signals through the day. All sessions are open and setup rules are looser. If no real level fits, it uses a fixed minimum-RR target. The threshold is still tuned to your *Target win rate*. Optional: *Flip on opposite signal*. |
| **Balanced** | Fewer signals. The threshold is tuned to your *Target win rate*. Session toggles apply and nothing flips. |
| **Sniper** | Only the highest-scoring setups. The threshold never drops below 60. |

More signals means a lower win rate per trade. Compare the dashboard's **Expectancy** and **Profit factor** between modes, not just the win rate.

## The unified strategy: order flow + 5-pillar confluence

Every candidate trade, from any setup, goes through the same checklist.

**1. Order Flow score (0–100, 50 = neutral)**, read from the 1-minute bars inside each candle:

| Part | Weight | What it means |
|---|---|---|
| Delta % | 25 | Who was aggressive in this candle (buy vs sell volume) |
| CVD slope | 20 | Who has been in control over the last 5 bars |
| Bar VPOC | 15 | Where the most volume traded inside the candle. For a long, volume traded at the low and price closed away from it: buyers absorbed the sellers. |
| Trapped traders | 15 | The previous candle's heavy aggressive sellers are underwater because this candle closed above its high (or the reverse) |
| Absorption | 10 | Heavy volume and a small body, closing on the trade's side |
| Stacked aggression | 10 | 4+ consecutive 1-minute bars on the same side |
| Relative volume | 5 | Size is in the market |

If the score is below *Min order-flow score* (45), the trade is **vetoed** because order flow is working against it.

**2. Five confluence pillars.** Each pillar the trade meets adds one to its grade:
1. **Bias:** the daily bias agrees with the trade.
2. **Location:** price is at a key level (PDH/PDL, session range, value area, VWAP band, anchored VWAP, order block, gap or sweep).
3. **Trigger:** one of the five setups fired.
4. **Order flow:** the score is 60 or more.
5. **Regime:** the setup suits the current market. Pullbacks and trend flips need a trend, fades need a mean-reverting market, and breakouts need compression.

The grade (**A+** = 5/5, **A** = 4/5, **B** = 3/5) shows on the Entry price tag and in the Buy/Sell tooltip. *Min confluence pillars* defaults to 3. Sniper mode requires 4. Set it to **4 or 5 for the highest win rate**.

The order-flow score, trapped-trader flag, stacked-aggression flag and grade are also inputs to the learning model. It learns how much each one matters on your chart.

On a **1m chart** there is only one 1-minute bar inside each candle, so the order-flow parts use body-based estimates. Order flow is most informative on **5m and 15m**.

## Scalping timeframes (1–7 minutes)

On 1m to 7m charts, the indicator favours **more signals** while keeping the win rate above 50%:

| Setting | 1–7m (Frequent mode) | 8–15m |
|---|---|---|
| Target win rate the threshold tunes to | **55%** (*Target win rate on 1–7m charts*) | 70% |
| Lowest threshold allowed | 35 | 40 |
| Confluence pillars needed | **2 of 5** | 3 of 5 |
| Order-flow veto below | 40 | 45 |

With about 1:1 targets (*High win rate* style), a 55% win rate still makes money. The threshold only drops to a level where the last 300 setups actually met 55% with positive expectancy, so signals increase as far as the data allows and no further. Presets cover every minute timeframe: 1–2m use the 1m settings, 3–7m the 5m settings, and 8–15m the 15m settings.

## Target style (Setups → Target style)

| Style | Targets | Effect |
|---|---|---|
| **High win rate** (default) | Nearest real level at ≥ 1:1, placed slightly in front of the level. Stops get 30% more buffer. | Highest hit rate |
| **Balanced** | ≥ 1:1.5 (1:1.8 on 15m) | Middle ground |
| **Big RR** | ≥ 1:2 | Wins less often, but wins are bigger |

The adaptive threshold always aims for *Target win rate* (default **70%**). Each time it re-tunes, it picks the lowest score whose last 300 setups met that win rate with positive expectancy.

## The five setups in plain English

**E. Trend Flip (the most frequent setup)**
An ATR trailing trend (Supertrend: factor 2.0 on 1m, 2.5 on 5m, 3.0 on 15m) flips direction. The flip candle must close in the direction of the move with buying or selling pressure (delta) behind it. The higher timeframes can't be strongly against it. The stop goes behind the last 5-bar swing. In Balanced and Sniper modes it also needs the daily bias on its side and price on the right side of VWAP.


**A. Liquidity Sweep Reversal (the main setup)**
Stop-losses build up above obvious highs and below obvious lows: yesterday's high/low, last week's high/low, the Asian range, the London range, and equal highs/lows. Big players push price through those levels to fill their orders. The setup needs four things in a row:
1. Price wicks through one of those levels and **closes back inside**.
2. The sweep comes with **real volume**: relative volume ≥ 1.2, absorption, or delta divergence.
3. Within a few bars, a **forceful candle breaks the last small swing** the other way.
4. The trade enters on that break, or with a limit order at the gap it left behind (setting *Sweep entry*).

The stop goes beyond the sweep's wick.

**B. Trend Pullback Continuation**
The market is trending (measured by the efficiency ratio and Hurst exponent), and the higher timeframes agree with the chart's own structure. Price pulls back into VWAP, the VWAP 1σ band, an unfilled fair-value gap or an order block. Then a rejection candle forms with buying pressure for a long, or selling pressure for a short. With the *Premium/Discount filter* on, longs are only taken in the lower half of the current swing range and shorts in the upper half.

**C. Compression Breakout**
The Bollinger Bands sit inside the Keltner Channel for 10+ bars while ATR is in its bottom 30%. Gold is coiling. A breakout candle with relative volume ≥ 1.8, delta in the same direction and agreement with the daily bias triggers the trade. By default it waits for a **retest** of the broken edge.

**D. VWAP Band Fade** (only when the market is mean-reverting)
Price stretches **2σ+ away from VWAP** into a key level (prior value area, PDH/PDL, session high/low, liquidity pool). It shows absorption or delta divergence, and the trade fades it back toward VWAP or the 1σ band.

### Filters every trade must pass
- No signals during **news blackouts**: the automatic NFP blackout plus up to 5 news times you enter yourself.
- No signals in **dead zones** (11:00–13:30 and 16:00–19:00 New York time) or the Asia session (both are settings).
- No signals when ATR is less than 3× your spread (not enough movement).
- After 85% of the average daily range is used up, only mean-reversion trades are allowed.
- On 1m, the 5m and 15m structure must agree (*MTF confluence*).
- One trade at a time. Cooldown after a loss. Max 3 losses per day.

### Stop loss and take profit
- **Stop:** placed behind structure plus an ATR buffer. Stops tighter than 0.5 ATR are widened. If the structural stop would need more than 2.5 ATR, the trade is **skipped** rather than squeezed.
- **Target:** the **nearest real level** that gives at least the minimum RR (1.5 on 1m and 5m, 1.8 on 15m). That level must also sit within 70% of the room left in today's average daily range. Candidate levels are liquidity pools, VWAP bands, the prior POC/VAH/VAL, PDH/PDL/PWH/PWL, the session ranges, swing and weekly anchored VWAPs, today's high/low and opposing gaps. **If no level qualifies, there is no trade.** This rule does the most to keep the hit rate up.
- **TP1 / breakeven (optional):** at 1R the stop moves to entry. A dotted line marks 1R.

---

## How it works out today's direction

The **daily bias score** runs from −100 to +100:

| Part | Weight |
|---|---|
| Trend on the two higher timeframes (swing structure + EMA 50/200) | 25 + 25 |
| Price above yesterday's high / below yesterday's low | 15 |
| Price above / below the midnight New York open | 10 |
| US dollar (DXY) and US 10-year yields on the 1H (only when gold's 50-hour correlation with DXY is below −0.3) | 15 |
| Day opened above / below / inside yesterday's value area | 10 |

Above +20 is **BULLISH**, below −20 is **BEARISH**, and anything in between is **NEUTRAL**.

| Chart | Higher timeframes used for the bias |
|---|---|
| 1m | 15m + 1H |
| 5m | 1H + 4H |
| 15m | 4H + Daily |

---

## How the learning works

- Every setup that passes the filters becomes a **shadow trade**, whether it's shown or not. The script follows each one until it hits TP, SL or the time limit.
- A logistic-regression model scores each setup from 27 features: bias, structure, relative volume, delta, absorption, sweep, displacement, gaps and order blocks, VWAP z-score, regime, session, premium/discount, dollar agreement, setup type, RR, target distance and divergences. The score is the **estimated chance of hitting TP before SL**.
- When a shadow trade closes, the weights are updated with its result. Results only count on the bar where TP or SL is actually hit, so it never peeks at future bars.
- Every 20 closed shadow trades, the **adaptive threshold** is re-tuned. It picks the lowest score whose recent win rate meets your *Target win rate* with positive expectancy, kept between 60 and 90.
- A setup whose last 30 qualified trades have negative expectancy is **switched off** for display. It keeps being tracked in the background and switches back on once it recovers.
- **Warm-up:** nothing is shown until 30 shadow trades have closed.

**Limitation:** Pine Script can't save anything between chart reloads. Each time the chart loads, the script re-learns from all the history on the chart, bar by bar. More history means a better-trained model. On TradingView plans that load more bars, use the most history you can.

---

## Reading the dashboard (top right)

| Row | Meaning |
|---|---|
| Daily bias | BULLISH / BEARISH / NEUTRAL and the score |
| Regime | Trending / Mean-reverting / Compression / Normal, plus the ATR percentile |
| Session | The current session, or "News blackout" |
| ADR used | How much of the average daily range today has already covered |
| Threshold | The score a setup currently needs to be shown |
| Trades, win rate, avg RR, profit factor, expectancy, max loss streak | **Measured** results of the trades the indicator actually showed on this chart. Win rate = wins ÷ (wins + losses). Breakeven exits and flat timeouts count as scratches (S). |
| Best / worst setup, best combo | Which setups, and which setup + session pairs, are actually earning |
| Model | Warm-up progress or the number of trades learned |

---

## Is it hitting 60–70%? How to measure and tune it

**The script does not promise a win rate.** It measures one. To check yours:

1. Load each timeframe (1m, 5m, 15m) with as much history as your plan allows.
2. Read **Win rate** and **Expectancy** on the dashboard.
3. Run `GoldSniper_Strategy.pine` in the Strategy Tester:
   - Set **commission** in the strategy settings to your broker's cost.
   - Slippage defaults to 2 ticks.
   - The strategy enters at the next bar's open, while the indicator's stats use the signal bar's close, so the two will differ slightly.
4. Do a **walk-forward test**. Pick settings using the *Backtest from/to* window on older data, then move the window forward and check that the results hold **without changing anything**.

If it's below target:

| Change | Effect |
|---|---|
| Raise **Target win rate** or **Threshold floor** | Fewer, more selective signals |
| Raise the **min RR** (manual presets) | Bigger winners but a lower hit rate. Lowering it does the reverse. |
| Turn off weak setups (see *Worst setup*) or sessions (Asia, transition, NY PM) | Removes setups and times that lose money |
| Turn on **TP1 → breakeven** | Fewer full losses, more scratches |
| Leave **MTF confluence** on for 1m | Big reduction in noise |

Win rate and RR trade off against each other. 60–70% at 1:1.5+ is a demanding target. Trust **expectancy** (average R per trade) more than win rate alone.

---

## Limits (please read)

- No strategy wins forever. Gold's behaviour changes with news, central-bank flows and volatility regimes.
- Results depend on your broker's price feed, spread and execution. Spot XAUUSD uses broker tick volume. COMEX GC1! gives real futures volume but may be delayed on free TradingView plans; then the script falls back to chart volume.
- Pine Script can't read an economic calendar. Enter CPI, FOMC and other big releases in *News time 1–5*.
- The 1-minute intrabar data used for volume delta only covers the most recent part of history. Older bars use an estimate.
- **Forward-test on a demo account for at least 2–4 weeks before risking real money**, and risk only a small percentage per trade.

---

## Alerts

- Create an alert with **"Any alert() function call"**. It sends a JSON message for every entry, limit order, TP and SL:
  ```json
  {"symbol":"XAUUSD","tf":"5","event":"entry","side":"buy","entry":2650.25,"sl":2647.10,"tp":2655.80,"rr":1.76,"score":74,"setup":"Sweep Reversal","session":"NY AM"}
  ```
- There are also simple alert conditions for Buy, Sell, Long TP, Short TP, Long SL and Short SL.
