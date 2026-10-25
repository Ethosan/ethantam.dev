# ethantam.dev: Privacy

ethantam.dev is the personal site of Ethan Tam. It has no user accounts, no comments, and no tracking. It counts visits with Cloudflare Web Analytics, which sets no cookies.

This page is also published at [ethantam.dev/privacy](https://ethantam.dev/privacy).

## What is collected

- **Nothing.** The site doesn't ask for your name, email, or any personal information. There are no cookies set for tracking and no ads.
- **Visit counts.** Cloudflare Web Analytics counts page views: the page, the site you came from, your country, browser and device type, and how fast the page loaded. It sets no cookies, stores nothing on your device and does not identify you; the numbers are only seen in aggregate.
- **This device.** Theme preference (dark/light mode) is saved in your browser's local storage. Clearing your browser data removes it.
- **Stock and crypto prices.** The ticker streams live quotes over a WebSocket from a Cloudflare Worker, which gets stock prices from Yahoo Finance and crypto prices from Binance (with Coinbase as a backup). Your browser only talks to ethantam.dev for this, unless the Worker can't be reached, in which case it asks CoinGecko for the crypto prices directly. Every visitor gets the same prices, and the Worker doesn't log who is watching.

## Who else processes data

- **Cloudflare:** hosts the site and the Worker, keeps the latest prices in a Durable Object, and counts visits (Web Analytics).
- **Yahoo Finance:** provides the stock prices.
- **Binance and Coinbase:** provide the crypto prices.

## What is not done

- No ads, no tracking pixels, no cross-site tracking, and no analytics beyond the cookie-free visit counts above.
- No selling or sharing of personal data (there isn't any to sell).

## Contact

[contact@ethantam.dev](mailto:contact@ethantam.dev)
