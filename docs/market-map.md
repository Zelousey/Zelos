# Globe market map

Hovering a country on any Zelos globe shows:

- the country's move for the day (its US-listed iShares/Global X country ETF, in USD), which also tints that country's dots red or green;
- the day's biggest mover among companies based there, with a headline when one explains it;
- the US-tradable stocks with a business link to that country's companies (customer, supplier, competitor, parent);
- the companies based there, flagging the ones that aren't US-listed (e.g. Samsung Electronics).

Clicking pins the full card. Market 3D also lists the biggest country moves.

## Where the data comes from

- `scripts/page-src/country_links.py`: the hand-checked list of countries, ETFs, local companies and linked US-listed stocks. Every ticker was checked as tradable on Robinhood. Edit this to add countries or links.
- `data/globe-markets.json`: the static snapshot the site ships with (fallback).
- Firestore `markets/globe`: the live copy, written by the `publish_market_map` Cloud Function. The globe reads it with one public GET and falls back to the static file.

## Daily refresh (after the 4:00 pm ET close)

This is designed to run as a scheduled Claude task with the Robinhood connector, the same way the scan skills run:

1. `git clone https://github.com/Zelousey/zelos && cd zelos`
2. `python3 scripts/moves_from_robinhood.py --symbols` prints every symbol needed (~145).
3. With Robinhood: `get_equity_historicals` (interval `day`, start ~2 months back, 10 symbols per call) and one `get_equity_quotes` call for all symbols. Save each raw result as JSON.
4. `python3 scripts/moves_from_robinhood.py --after-close --quotes quotes.json --bars bars*.json > moves.json`
5. For the ~5 biggest movers among country companies, `get_equity_news` (limit 3) and keep the most relevant headline as `{"SYM": {"title", "publisher", "published"}}` in `headlines.json`. Only use a headline that actually explains the move.
6. `ZELOS_MARKET_MAP_URL=<publish_market_map URL> ZELOS_PUBLISH_SECRET=<secret> python3 scripts/build_market_map.py moves.json --headlines headlines.json --publish`

Deploy the function first: `firebase deploy --only functions:publish_market_map,firestore:rules` (see `docs/deploying-functions.md`).

## Framing

Everything on the card is general market information, identical for every visitor. Links describe documented business relationships, never a prediction or a suggestion to trade. Keep new `why` lines in that register.
