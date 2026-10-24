# ethantam.dev: Privacy

ethantam.dev is the personal site of Ethan Tam. It has no user accounts, no comments, no analytics, and no tracking.

This page is also published at [ethantam.dev/privacy](https://ethantam.dev/privacy).

## What is collected

- **Nothing.** The site doesn't ask for your name, email, or any personal information. There are no cookies set for tracking, no analytics scripts, and no ads.
- **This device.** Theme preference (dark/light mode) is saved in your browser's local storage. Clearing your browser data removes it.
- **Stock and crypto prices.** The ticker streams live quotes over a WebSocket from a Cloudflare Worker, which gets stock prices from Yahoo Finance and crypto prices from Binance (with Coinbase as a backup). Your browser only talks to ethantam.dev for this, unless the Worker can't be reached, in which case it asks CoinGecko for the crypto prices directly. Every visitor gets the same prices, and the Worker doesn't log who is watching.

## Who else processes data

- **Cloudflare:** hosts the site and the Worker, and keeps the latest prices in a Durable Object.
- **Yahoo Finance:** provides the stock prices.
- **Binance and Coinbase:** provide the crypto prices.

## What is not done

- No ads, no analytics, no tracking pixels, no cross-site tracking.
- No selling or sharing of personal data (there isn't any to sell).

## Contact

[contact@ethantam.dev](mailto:contact@ethantam.dev)
