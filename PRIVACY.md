# ethantam.dev: Privacy

ethantam.dev is the personal site of Ethan Tam. It has no user accounts, no comments, and no tracking. It counts visits with Cloudflare Web Analytics, which sets no cookies, and keeps a note of CV downloads and QR code scans, without names, IP addresses or cookies.

This page is also published at [ethantam.dev/privacy](https://ethantam.dev/privacy).

## What is collected

- **Nothing.** The site doesn't ask for your name, email, or any personal information. There are no cookies set for tracking and no ads.
- **Visit counts.** Cloudflare Web Analytics counts page views: the page, the site you came from, your country, browser and device type, and how fast the page loaded. It sets no cookies, stores nothing on your device and does not identify you; the numbers are only seen in aggregate.
- **CV downloads and QR scans.** When someone downloads the CV as a PDF, or opens this site from one of its QR codes, the site notes the time, the city, country and network (the internet provider, or the company or university whose network it is) that Cloudflare places the connection in, the kind of device and browser, and for a download the site or page that linked to it. It keeps no IP address and sets no cookie. So that one person doing it twice counts once, it makes a code from the IP address and browser mixed with a random value that is replaced every day, so the code can't be turned back into either, and clears the code after a day. These notes are kept for a year and only Ethan sees them.
- **This device.** Theme preference (dark/light mode) is saved in your browser's local storage. Clearing your browser data removes it.
- **Stock and crypto prices.** The ticker streams live quotes over a WebSocket from a Cloudflare Worker, which gets stock prices from Yahoo Finance and crypto prices from Binance (with Coinbase as a backup). Your browser only talks to ethantam.dev for this, unless the Worker can't be reached, in which case it asks CoinGecko for the crypto prices directly. Every visitor gets the same prices, and the Worker doesn't log who is watching.

## Who else processes data

- **Cloudflare:** hosts the site and the Worker, keeps the latest prices in a Durable Object, counts visits (Web Analytics), and keeps the notes of CV downloads and QR scans in another Durable Object.
- **Yahoo Finance:** provides the stock prices.
- **Binance and Coinbase:** provide the crypto prices.

## What is not done

- No ads, no tracking pixels, no cross-site tracking, and no analytics beyond the cookie-free counts above.
- No selling or sharing of personal data (there isn't any to sell).

## Contact

[contact@ethantam.dev](mailto:contact@ethantam.dev)
