# apostrophe-global-rss-feed

## Hold up, I already have RSS feeds, right?
You do, Apostrophe natively creates RSS feeds out of snippet'y thing and even lets you filter them. This module exposes a route that makes a generic apos.get call on the aposPages collection that allows the results of the feed to be a mix of content types, which Apostrophe _doesn't_ do by default.

## Usage

```javascript
var site = require('apostrophe-site')({
	modules: {
    'apostrophe-rss-feed': {
      description: 'foo' // optional description attached to all feeds
      route: '/feed/' // optional route where the feeds like, default is /apos-rss-feed/
    },
	}
})
```

## Resource Format
The module has a whitelist of resources it will run an apos.get against, otherwise it will return a `405 Method Not Allowed`. The current array of allowed resources are `['tag', 'id', 'slug']`. All resources need an identifier for search against, otherwise `400 Bad Request is thrown`. 

A properly formatted request looks like `/apos-rss-feed/tag/fashion-design`
