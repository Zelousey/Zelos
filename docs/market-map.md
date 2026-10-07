# Globe market map

The globe (`zelos-globe.js`) tints each country by its US-listed ETF's daily move. It also
shows the country's biggest-moving company and the US stocks linked to it.

- **Updates on its own.** `refresh_market_data` builds the map after each close from
  Marketstack end-of-day prices and saves it to `markets/globe`. The globe reads it with one
  public request.
- **Country list:** `scripts/page-src/country_links.py`. `scripts/build_practice.py` copies it
  to `functions/country_links.py` so it ships with the functions.
- **No headlines** until there's a licensed news source.
- **Manual fixes:** `publish_market_map` (protected by a secret) still accepts a full map.
