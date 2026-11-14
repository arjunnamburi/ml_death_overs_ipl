# Ball-by-Ball Outcome Prediction in the IPL Death Overs

Can you predict what happens on a single death-over IPL ball (a dot, 1, 2, 3, 4, 6 or a wicket) before it is bowled? I built a model that gives a probability for each of the seven outcomes, froze it, and tested it once on the unseen 2026 season. **It predicts 2026 death-over balls 2.1% better than the basic match situation (phase, wickets fallen and innings), and most of that gain comes from reading the scorecard finely, not from knowing who is playing: all the detailed player context together adds only about 0.4% on top of a fine scorecard.**

I did this project as part of my Machine Learning course (ES335).

**[Website (full report)](https://arjunnamburi.github.io/ml_death_overs_ipl/)** · Frozen before the test: [`freeze-v1`](https://github.com/arjunnamburi/ml_death_overs_ipl/tree/freeze-v1) (Oct 30, 2026) · Single test run: [`test-2026`](https://github.com/arjunnamburi/ml_death_overs_ipl/tree/test-2026) (Oct 31, 2026) · [Data (Google Drive)](https://drive.google.com/drive/folders/16A6cz5QAymtBwujH6ZhJ_ZSF0Rq0aQUi) · [How to run it](#how-to-run-it-end-to-end)

---

## Research question

Using only information available before each delivery, how well can the probabilities of the seven outcomes of a death-over IPL delivery (0, 1, 2, 3, 4 or 6 runs, or a wicket) be predicted for an unseen season (2026), and how much of that comes from detailed context (batter, bowler, matchup history, momentum, chase pressure) beyond the basic match situation of phase, wickets fallen and innings?

In other words: how well can a model predict each ball of the last five overs of an IPL innings, and is it the match situation or the players that make it predictable?

---
## My approach

1. **Data and Labels.** I used every legal ball from 2008 to 2026, with seven outcome classes (0, 1, 2, 3, 4, 6, W). Rain-affected matches are set aside as a separate slice.
2. **Features.** I built 87 features, each using only what was known before the ball, in three kinds: the scorecard; in-match context (momentum, chase pressure, partnership, the bowler's spell); and player and venue history from earlier matches, shrunk toward the player's type when there is little data.
3. **Models.** A ladder from simple to complex: B0 (fixed outcome shares), B1 (shares by match situation), a multinomial logistic regression, then XGBoost. Each step's gain can be explained, and a model worse than B1 would point to a bug.
4. **Tuning.** I tuned on 2024, chose models on 2025, froze every choice, and scored 2026 exactly once. Every comparison uses a paired bootstrap over whole matches.
5. **Evaluation.** Calibration, group ablations and a Shapley split, 22 situation slices, and the worst-predicted balls with each feature's contribution.

---
## Results on 2026 (the unseen test season)

All scores are mean log-loss per legal ball (lower is better). Intervals are 95% match-level paired bootstrap intervals (2,000 resamples) for the difference from B1.

| Model | Death balls (3,583) | Difference from B1 | All balls (16,282) | Difference from B1 |
|---|---|---|---|---|
| B0: outcome shares of the training seasons | 1.6434 | +0.0417 | 1.5461 | +0.0257 |
| B1: basic match situation (phase × wickets band × innings) | 1.6017 | | 1.5204 | |
| Logistic regression with history, vector-scaled | 1.5764 | −0.0254 [−0.0367, −0.0147] | 1.4813 | −0.0391 [−0.0455, −0.0331] |
| **XGBoost with history (final model)** | **1.5680** | **−0.0338 [−0.0468, −0.0212]** | **1.4787** | **−0.0417 [−0.0482, −0.0358]** |

At the death, XGBoost is 2.1% better than B1, and it also beats the logistic regression: −0.0084 [−0.0143, −0.0029].

**Where the gain comes from at the death.** Starting from B1, I added one kind of information at a time and refit XGBoost. The last column averages each kind's contribution over every order of adding them (Shapley shares).

| Step | Death log-loss | Change | Shapley share of the gain |
|---|---|---|---|
| B1 | 1.6017 | | |
| + finer scorecard (exact balls and wickets left, run rate, totals, the current batter's and bowler's figures) | 1.5739 | −0.0278 | 53% |
| + player type (batting hand, bowling style, matchup) | 1.5735 | −0.0004 (can't be told from zero) | 2% |
| + in-match context (momentum, chase pressure, partnership, bowler's spell) | 1.5677 | −0.0058 | 35% |
| + player and venue history (the final model) | 1.5680 | +0.0002 (can't be told from zero) | 10% |

An XGBoost model trained on the 17 scorecard features alone (B1+) is only 0.0060 behind the full model at the death (−0.0060 [−0.0124, +0.0005]), which one season can't tell from zero. Six of those 17 features are the current batter's and bowler's figures in the match, so how the features are grouped affects these shares.

### The three claims in my proposal: 1 of 3 met

I made a project proposal on October 15th, about a month before I submitted this project, before I had trained XGBoost and before any model saw 2026. In it, I said: "On 2026 death-over balls, a useful answer means:"

| Claim | Verdict | Why |
|---|---|---|
| "(1) lower mean log-loss than a match-situation baseline, with the 95% paired bootstrap interval for the difference entirely below zero." | **Met** | XGBoost minus B1: −0.0338 [−0.0468, −0.0212]. |
| "(2) calibrated probabilities: among balls given about a 10% wicket chance, about 10% are wickets, and likewise for each outcome;" | **Not met** | At the death, XGBoost predicts too few dots (2.2 points under) and too many wickets (1.0 point over), both outside error. 2026 had more death dots than 2025 (21.8% vs 19.2%). Temperature scaling doesn't close either gap. On all balls, 6 of 7 outcomes are within error. |
| "(3) knowing which context matters: removing a feature group makes log-loss worse, with the paired interval above zero." | **Not met** | At the death, removing any one group doesn't make log-loss clearly worse, because the groups overlap and cover for each other. The Shapley shares in the second table above were needed to answer it. |


---

## The website

This website covers the results and evaluation part of this project more extensively: https://arjunnamburi.github.io/ml_death_overs_ipl/

- **[Report](https://arjunnamburi.github.io/ml_death_overs_ipl/):** the full write-up (data, preprocessing, methods, evaluation, results, errors, limitations), with 18 "How it works" boxes that explain each method and why I chose it.
- **[Match Replay](https://arjunnamburi.github.io/ml_death_overs_ipl/site/replay.html):** four 2026 matches, ball by ball through the death overs, with XGBoost, the logistic regression and B1 side by side and what actually happened.
- **[Worst-Predicted Balls](https://arjunnamburi.github.io/ml_death_overs_ipl/site/worst.html):** the 2026 death balls the model got most wrong, with each feature's push on the prediction and a hypothesis for each ball.
- **[Extras](https://arjunnamburi.github.io/ml_death_overs_ipl/site/extras.html):** which players the model reads best and worst, the most and least predictable 2026 matches, the ablation detail, and all 87 features.

Every page also reads without JavaScript.

---

## Highlights

**Five decisions that shaped the project**
- **Time split, tested once.** Train on 2008-2024, choose on 2025, freeze, then score 2026 exactly once.
- **Match-level paired bootstrap** for every comparison, because balls in one match aren't independent.
- **Seven outcome classes on legal balls only,** predicted as probabilities and scored by log-loss, not accuracy.
- **No player names as features.** Players enter as types and as historical rates shrunk toward their type.
- **All-overs vs death-only, decided by evidence.** One XGBoost model serves every ball, because trees can grow death-specific branches.

**Four failures**
- **Free hits:** XGBoost gives a 5.9% wicket chance on a free hit, because min_child_weight = 100 stops any wicket tree from splitting on such a rare flag.
- **Lost chases:** it over-predicts sixes when the required rate is above 18 (12.0% vs 8.6%).
- **The 2026 death shift:** more dots and fewer wickets than 2025, which every model missed, so claim 2 wasn't met.
- **The detailed context matters less than I expected:** about 0.4% on top of a fine scorecard at the death.


<details>
<summary><b>All important decisions</b></summary>

**Data and label**
- **Legal balls only.** I trained and scored on legal balls only. Wides and no-balls stay in the data, so the momentum, free-hit and previous-ball features see them, but they aren't predicted: whether they happen depends on the bowler's control rather than the situation, and their outcomes don't fit the seven classes.
- **Seven unordered classes.** I predict 0, 1, 2, 3, 4, 6 and Wicket as seven separate classes, rather than runs as a count plus a separate wicket model. 5 runs became 4 and 7 became 6 (a boundary plus an extra). 3s stay as their own class because they rotate the strike.
- **Rain-affected matches.** I found 50 rain-affected matches with four rules and checked each one by hand. They are kept out of training and validation and scored separately as a failure slice.
- **No player, team or venue names as features.** A batter with 40 balls of data would just be memorised. Players enter as types (batting hand, bowling style) and as historical rates shrunk toward their type, which generalise to players the model has barely seen.
- **Player labels from Gemini, checked by hand.** I labelled each player's batting hand and bowling type with the Gemini API, then checked 100 players by hand against ESPNcricinfo and labelled the 15 it missed myself.

**Features**
- **Full innings first, then the death.** I computed every feature on the full innings and only then picked out the death balls, so death-over features still see the earlier overs.
- **A strict "before this ball" rule.** No column that reveals the current ball's outcome ever enters the features. Each feature group has its own checks, several of them against a slow, plain-Python version on 100 random innings.
- **Windows stay empty until full.** Rolling windows (for example, runs in the last 12 deliveries) are missing until the window is full, instead of summing a partial window that makes the start of every innings look like a collapse.
- **`balls_per_wicket_remaining`.** I built this ratio because it is the attack-or-defend trade-off batters actually think about. It became the model's most important feature, in training and on 2026.
- **Ratio features.** I added strike rate and economy as features because a tree can't divide one column by another.
- **Dropping redundant features.** I dropped is_powerplay, is_new_batter and three bowler-workload flags, because a tree can already split on the columns they come from.
- **History window.** A player's history is the two previous seasons plus this season up to the previous match. The current match is excluded, since the in-match features cover it.
- **Shrinkage.** A player's rate is pulled toward their type's average, harder when they have fewer balls: (n × player rate + k × type rate) / (n + k). k = 100 was set by hand, not tuned.

**Evaluation and modelling**
- **Time split.** Train on 2008-2024, validate on 2025, test on 2026, split by whole matches. A random split would hide the scoring drift that a real forecaster faces.
- **Log-loss on death balls as the headline.** Not accuracy: always predicting "1" already gets about 40% accuracy.
- **A baseline ladder** (B0, B1, logistic regression, XGBoost), so every gain can be explained and bugs show up as "worse than B1".
- **Match-level paired bootstrap** for every comparison. Balls in one match aren't independent, and treating them as independent understated the uncertainty almost 3 times (±0.006 instead of ±0.016 on all 2025 balls).
- **Keeping 2025 clean.** XGBoost's early stopping and settings were chosen on 2024. The logistic regression's regularisation wasn't tuned at all, because every value I tried scored the same.
- **All-overs vs death-only, decided by evidence.** The death-only logistic regression beat the all-overs one (−0.0072 at the 2025 death), but the death-only XGBoost didn't (+0.0004), because trees can grow death-specific branches inside one model. So one XGBoost model serves every ball.
- **Shallow trees.** My first XGBoost fit (depth 6) overfit, with a 0.115 gap between training and 2024 log-loss. Depth 4 with leaves of at least 100 "weight" (min_child_weight) did best on 2024.
- **XGBoost left uncalibrated.** Temperature and vector scaling learned on 2024 made XGBoost worse on 2025, because its biases flip direction between seasons. The logistic regression kept vector scaling, because its overconfidence is built in and carries over from season to season.
- **No recency weighting.** Weighting recent seasons more, or training on only the last 3 or 5 seasons, did worse, so older seasons still carry useful information.
- **No reweighting of rare classes.** Threes are 0.2% of balls, but reweighting them would deliberately miscalibrate the probabilities, which works against a log-loss objective.
- **Pre-registration.** I froze the claims, the planned comparisons and the slice testing rule (Bonferroni over 44 tests) at the `freeze-v1` tag, then scored 2026 exactly once at `test-2026`.
- **Replay matches chosen by a rule.** The four replay matches were picked by a rule written before looking at any per-match death result.
- **Dropping the bowling simulator.** My original idea was a Monte Carlo simulator for choosing death bowlers. When I swapped 54 bowlers into the same 1,494 chase balls, the best and worst plans differed by only 0.11 runs from over 17, below the 1-run bar I had set in advance, so I dropped it.
- **Keeping the matchup features.** They showed no measurable contribution, but neither season clearly supported dropping them.

</details>

<details>
<summary><b>All failures, bugs and limitations</b></summary>

**Bugs I found and fixed in the data**
- **A duplicated delivery.** One delivery had been duplicated and removed after the running totals were built, which pushed the totals one ball ahead in 4 matches. I found it because `balls_remaining` reached 0 a ball early, and fixed it by rebuilding the totals from the per-ball columns.
- **Retired hurt counted as a wicket.** 19 retired-hurt balls were labelled as wickets. I fixed them and made a rule: never use "player_out is filled" to mean a wicket fell.
- **Wrong player labels.** The Gemini labels had at least 19 batting-hand errors, which I found by cross-checking and fixed. One wrong bowling type (VG Arora labelled left-arm pace instead of right-arm) was found only after the test, so it stays in the frozen model.
- **Clipping wiped out free hits.** Clipping features at their 99.5th percentile silently turned every free hit into 0, because a rare yes/no flag's 99.5th percentile is 0. I fixed it by clipping only features with more than 20 distinct values.
- **Early free hits.** Before 2016 only front-foot no-balls gave a free hit, and the data can't tell no-ball types apart, so some early "free hits" weren't. I accepted this as small noise.
- **A data bug:** clipping at the 99.5th percentile silently turned every free hit into 0.


**Where the model fails, and what the claims showed**
- **Scoring drift.** 2025 and 2026 have about 67% more sixes than the training seasons. Models trained on the past under-predict boundaries, and the season features only partly follow the change.
- **Free hits.** XGBoost gives a 5.9% wicket chance on a free hit, when a batter can only be run out. None of its 301 wicket trees splits on the free-hit flag: each free hit adds only about 0.11 to a wicket leaf's weight, so all ~1,060 training free hits together fall below the 100 a leaf needs (min_child_weight). A setting I chose to stop overfitting caused a rule-of-the-game failure.
- **Lost chases.** When the required rate is above 18, XGBoost over-predicts sixes (12.0% predicted vs 8.6% actual in 2026, and the same direction in 2025). It learned "more pressure, more sixes" from close chases, which isn't true once the chase is lost and the tail is batting.
- **Calibration at the death (claim 2).** 2026 had more death dots and fewer wickets, and every model, calibrated or not, missed that shift.
- **Which group matters (claim 3).** Removing one feature group at a time can't show where the death gain comes from, because the groups overlap. I needed a Shapley analysis that averages over every order.
- **History at the death isn't stable.** Player history helped at the 2025 death but added nothing at the 2026 death.
- **The detailed context matters less than I expected.** A scorecard-only XGBoost gets almost all of the gain; all the detailed context adds only about 0.4% at the death, which can't be told from zero.
- **Recency weighting made things worse,** the opposite of what I expected.
- **A single ball is mostly chance.** Fours and sixes never get more than a 37% predicted chance, and only 6 of 850 wickets in 2026 were given more than 22%.
- **Bowlers look alike to the model.** Across 54 death bowlers, predicted economy spans only 0.52 runs per over, which is why the simulator was dropped.

</details>

<details>
<summary><b>Everything I learned</b></summary>

- **Log-loss has a floor set by the season itself.** "It is an IPL ball: 1.668. It is a death ball: 1.612." Knowing which question you're answering is half the score, and the entropy of the outcomes tells you how much is left to win.
- **A comparison needs a paired interval, not two separate ones.** Two models' intervals overlapped while the paired test was clear, because one match's luck hits both models.
- **Calibration and discrimination are different jobs.** Calibration fixed the logistic regression's built-in overconfidence, but it couldn't fix XGBoost's season-level bias, which flipped direction between seasons.
- **Trees beat a linear model only where effects multiply.** XGBoost's edge over the logistic regression is at the death and with 6+ wickets down, where wickets left, balls left and who is batting interact. Elsewhere a calibrated logistic regression was level.
- **Every hyperparameter has side effects.** min_child_weight = 100 stopped overfitting, and it also made XGBoost blind to free-hit wickets.
- **Most bugs were in the data, not the model.** The duplicated delivery, retired hurt, short overs and the clipping bug all came out of checks against slow, plain versions of the same calculation.
- **Pre-registering made "not met" a result.** Two of my three claims weren't met, and that is reported rather than hidden.
- **Scope is a decision.** I dropped the simulator I started with when a check I had set in advance said it would be flat.

</details>

---

## How to run it end to end

Everything ran in Google Colab. The notebooks read and write one folder, set at the top of each notebook:

```python
DATA = '/content/drive/MyDrive/IPL PROJECT ALL DOCS/data/'
```

### 1. Get the data (choose one)

**Option A, recommended: my data folder.** Download it from **[Google Drive data folder](https://drive.google.com/drive/folders/16A6cz5QAymtBwujH6ZhJ_ZSF0Rq0aQUi)** and put it in your own Google Drive at `MyDrive/IPL PROJECT ALL DOCS/data/` (or change `DATA` at the top of each notebook). It has the cleaned dataset (`prog3.csv`), the feature table, the saved models and every prediction file, so you can start at any step below. A shortcut to a shared folder is read-only, and the notebooks write files, so use a copy.

**Option B: from the raw Kaggle data.** Download `IPL.csv` from the Kaggle [IPL Dataset](https://www.kaggle.com/datasets/chaitu20/ipl-dataset2008-2025) (CC0; despite its name it includes 2026), for example with `kagglehub.dataset_download('chaitu20/ipl-dataset2008-2025')`. Then run the data-preparation notebooks in `archive_notebooks/` (step 2). The Gemini step needs your own API key in a Colab secret named `GEM_API`, and a new run won't give exactly my labels, so use my corrected labels in `data/player_metadata_updated.csv` instead (saved as `player_metadata.csv`).

### 2. Data preparation (`archive_notebooks/`, Option B only)

| Order | Notebook | Reads | Writes |
|---|---|---|---|
| 1 | `ML_Project_IPL.ipynb` | `IPL.csv` | cleaned columns, running totals, label; `player_metadata.csv` (Gemini) |
| 2 | `ML_Project_IPL_2_with_renames.ipynb` | `prog1.csv` (the output of step 1) | `prog2.csv`, `prog2_renamed.csv` |
| 3 | `ML_Project_IPL_3.ipynb` | `prog2_renamed.csv` | `prog3.csv`, `rain_affected_matches.csv` |

`prog1.csv`, `prog2.csv` and `prog2_renamed.csv` are also in the Drive folder under `data/archive/`. `ML_Project_IPL_2.ipynb` and `ML_Project_sg1.ipynb` are earlier versions, replaced by `ML_Project_IPL_2_with_renames.ipynb` and `notebooks/features.ipynb`.

### 3. Main pipeline (`notebooks/`, in this order)

| Order | Notebook | What it does | Main outputs |
|---|---|---|---|
| 1 | `features.ipynb` | Rebuilds everything from `prog3.csv`: data fixes, label, split, all 87 features, with a check after each group | `ipl_features.parquet`, `feature_list.json` |
| 2 | `models.ipynb` | B0, B1, logistic regression, XGBoost; tuning on 2024, validation on 2025, calibration, recency weighting, 2025 slices; writes the frozen choices | `freeze.json`, `calibration.json`, `results.csv`, `slices_2025.csv`, model files |
| 3 | `test_2026.ipynb` | Refits on 2008-2025 and scores 2026 once | `results_2026.csv`, `paired_2026.csv`, `preregistered_2026.csv`, `slices_2026.csv`, `ece_2026.csv`, `xgb_X-hist_2026.json` |
| 4 | `post_freeze_checks.ipynb` | Group and block ablations, the death ladder, rain matches, temperature check | `ablation_*.csv`, `ladder_2026.csv`, `rain_scored*.csv`, `temperature_*.csv` |
| 5 | `error_analysis.ipynb` | Worst-predicted balls and per-feature contributions | `worst_balls_2026.csv`, `push_*.csv`, `balls_2026_explained.parquet` |
| 6 | `review_checks.ipynb` | Raw-data checks, the Shapley split (16 refits), B1+ | `shapley_2026.csv` |
| 7 | `analysis_nb.ipynb` | 2025 player tables | `players_*_2025.csv` |
| 8 | `h1_checks.ipynb` | Checks the worst-ball hypotheses across the 2026 death | `site/data/h1_checks_2026.csv` |
| 9 | `site_export.ipynb`, `site_build.ipynb`, `site_figures.ipynb` | Exports the website's data and draws its figures | `data/replay/`, `site/data/`, `site/img/`, `img/` |

Steps 1 to 3 reproduce the headline. Steps 4 to 9 reproduce the analyses and the website.

### 4. Check the numbers

After `test_2026.ipynb`, `results_2026.csv` should show these death-ball log-losses: XGBoost 1.5680, logistic regression (vector-scaled) 1.5764, B1 1.6017, B0 1.6434. Its first check cell should print 244,269 training, 15,809 validation and 16,282 test balls.

**Use a GPU runtime** (Runtime > Change runtime type > GPU). XGBoost was trained on a Colab GPU (`device='cuda'` in `models`, `test_2026`, `post_freeze_checks`, `error_analysis`, `review_checks` and `site_export`). On Nov 14, I reran the pipeline from `prog3.csv`. The feature table came out byte-identical, and on a GPU the 2026 XGBoost refit gave the same 301 trees and the same predictions. Without a GPU, XGBoost falls back to the CPU, which trains slightly different trees: the 2026 XGBoost log-loss moves by about 0.001 (all balls 1.4797 instead of 1.4787, death 1.5678 instead of 1.5680). That is enough to turn the all-balls XGBoost vs logistic regression comparison from "XGBoost better" to "can't tell", though the death results and all six pre-registered verdicts stay the same. The baselines and the logistic regression don't depend on the GPU. The saved model `xgb_X-hist_2026.json` in the data folder gives my exact 2026 predictions on either.

### Environment

Python 3.13 in Google Colab. The packages the project imports, with exact versions, are in [`requirements.txt`](requirements.txt), taken from my Colab runtime on Nov 14, 2026. XGBoost is 3.4.1, the same version that ran the 2026 test. In Colab: `!pip install -r requirements.txt`.

---

## Repository layout

| Path | What it holds |
|---|---|
| `index.html`, `site/`, `img/`, `404.html` | The website (GitHub Pages, served from the repo root) |
| `notebooks/` | The main pipeline (above) |
| `archive_notebooks/` | Data preparation from the raw Kaggle file |
| `data/` | Small results files the website reads, the frozen `freeze.json`, the hand-reviewed rain list and the player labels |
| `data/replay/` | Ball-by-ball data for the four replay matches |

Large files (`prog3.csv`, `ipl_features.parquet`, model files, prediction bundles) are only in the Drive folder, because they are too big for GitHub and can all be rebuilt by the notebooks.

## Data

The Kaggle "IPL Dataset" by Chaitanya (`IPL.csv`, CC0 public domain), with every IPL match from 2008 to 2026: 295,732 deliveries, or 295,553 after removing 179 super-over rows. I had used the same dataset for practice analysis about nine months before this project. Player batting hands and bowling types were added with the Gemini API and checked against ESPNcricinfo.

## AI use

I used Claude (Anthropic) throughout the project. It ran checks on the dataset and on the exported results, helped write the code in the notebooks and for the website, and helped write the documentation and the website's text. I chose the research question and made every design decision. I ran and verified every notebook cell in Google Colab, hand-checked the player labels against ESPNcricinfo, and reviewed and merged every change to this repository. I used the Gemini API (`gemini-3.5-flash-lite`) to label each player's batting hand and bowling type, in batches of 100 names returning JSON; the prompt is in `archive_notebooks/ML_Project_IPL.ipynb`.

## Libraries

XGBoost, scikit-learn, pandas, NumPy, SciPy, Matplotlib, PyArrow, joblib, kagglehub, the Google Gen AI SDK, and Google Colab. Full credits and references are in section 12 of the website.
