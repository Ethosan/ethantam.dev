# ethantam.dev: Privacy

ethantam.dev is the personal site of Ethan Tam. It has no user accounts, no comments, no analytics, and no tracking.

## What is collected

- **Nothing.** The site doesn't ask for your name, email, or any personal information. There are no cookies set for tracking, no analytics scripts, and no ads.
- **This device.** Theme preference (dark/light mode) is saved in your browser's local storage. Clearing your browser data removes it.
- **Stock and crypto prices.** The ticker fetches live quotes from Yahoo Finance through a Cloudflare Worker. The Worker caches quotes at the edge for 60 seconds but does not log which visitor requested which ticker.

## Who else processes data

- **Cloudflare:** hosts the site and the Worker, and caches quote data at the edge.
- **Yahoo Finance:** provides the stock and crypto prices.

## What is not done

- No ads, no analytics, no tracking pixels, no cross-site tracking.
- No selling or sharing of personal data (there isn't any to sell).

## Contact

[eatentam@gmail.com](mailto:eatentam@gmail.com)
