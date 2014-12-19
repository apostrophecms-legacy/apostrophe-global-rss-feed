module.exports = factory;

var rss = require('rss');
var _ = require('lodash');
var $ = require('cheerio');

function factory(options, callback) {
  return new Construct(options, callback);
}

function Construct(options, callback) {
  var self = this;
  // Add a bunch of methods to self here, then...

  self._app = options.app;
  self._apos = options.apos;
  self._site = options.site;
  self._options = options;
  self._apos.mixinModuleAssets(self, 'rssFeed', __dirname, options);
  self.route = self._options.route || '/apos-global-rss-feed/';

  self.render = function(name, data) {
    return self._apos.partial(name, data, __dirname + '/views');
  };

  self.whitelistResources = function(resource) {
    var good = ['tag', 'id', 'slug'];
    return _.contains(good, resource);
  };

  self.getVideoUrls = function(items){
    var videos = [];
    var videoUrls = [];

    videos = _.filter(items, function(item){
      return item.type === 'video';
    });

    videos.forEach(function(video) { 
      videoUrls.push(video.video);
    });

    return videoUrls;
  };

  self.getVideoEmbeds = function(urls) {
    var embeds = [];

    urls.forEach(function(url) {
      var embedStr = '<iframe width="854" height="510" src frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';

      if (url.match(/youtube/gi)) {
        var videoUrl = '//www.youtube.com/embed/' + url.split('v=')[1];
        embedStr = embedStr.replace(/src/gi, 'src="' + videoUrl + '"');
      } else if(url.match(/vimeo/gi)) {
        var videoUrl = '//player.vimeo.com/video/VIDEOID?badge=0&amp;color=ffffff';
        videoUrl = videoUrl.replace(/VIDEOID/gi, url.split('com/')[1]);
        embedStr = embedStr.replace(/src/gi, 'src="' + videoUrl + '"');
      } else {
        embedStr = embedStr.replace(/src/gi, 'src="' + url + '"');
      }
      embeds.push(embedStr);
    });

    return embeds;
  }

  self._app.get(self.route + '*', function(req, res) {
    var resource, projection, criteria;
    var options = {};
    options.sort = self._options.sort || { start: -1, publishedAt: -1, createdAt: -1 };
    options.limit = self._apos.sanitizeInteger(self._options.limit) || 100;

    // parse request
    var path = req.url.split('/');
    path.shift();
    path.shift();
    resource = path[0];
    path.shift();
    projection = path[0];

    // method whitelist check. if its not here, beat it
    if (self.whitelistResources(resource) === false) {
      res.statusCode = 405;
      return res.send('405 Method Not Allowed');
    }

    // Check for identifier
    if (!projection) {
      res.statusCode = 400;
      return res.send('400 Bad Request. Need an identifier');
    }

    // un-sluggify tags
    if (resource === 'tag' && projection) {
      projection = projection.replace('-', ' ');
    }
    
    // convert resources to mongo'y stuff
    if (resource === 'tag') { resource = 'tags'; }
    if (resource === 'id') { resource = '_id'; }


    // setup criteria object
    criteria = {};
    if (resource === 'tags') {
      criteria[resource] = {$in: [projection]};
    } else {
      criteria[resource] = projection;
    }
    

    // go get
    self._apos.get(req, criteria, options, function(err, results) {
  
      if (err) {
        return callback(err);
      }

      // create a feed object
      var feed = new rss({
        title: self._app.locals.siteTitle,
        generator: 'Apostrophe 2',
        description: self._options.description || null,
        site_url: 'http://' + self._app.locals.hostName,
        feed_url: 'http://' + self._app.locals.hostName + req.url
      });
      // console.log(self._apos._aposLocals);

      // loop page results and add them to the feed object
      results.pages.forEach(function(page) {

        var description;
        var videoUrls = [];
        var enclosure = {};

        if (page.areas.body) { // bc for 0.4
          description = self._apos._aposLocals.aposAreaContent(page.areas.body.items, {allowed:['richText', 'slideshow', 'blockquote']});
          videoUrls = self.getVideoUrls(page.areas.body.items);
        }

        if (page.body) {
          description = self._apos._aposLocals.aposAreaContent(page.body.items, {allowed:['richText', 'slideshow', 'blockquote']});
          videoUrls = self.getVideoUrls(page.body.items);
        }


        if (videoUrls.length) {
          var videoEmbeds = self.getVideoEmbeds(videoUrls);
          enclosure = {url:videoUrls[0]};
        }

        // description = description.concat(videoEmbeds);

        feed.item({
          title: page.title,
          description: description,
          enclosure: enclosure,
          categories: page.tags,
          date: page.publishedAt || page.start || page.createdAt,
          url: 'http://' + req.headers.host + '/apos-pages/search-result/?slug=' + page.slug
        });

      })

      // send to browser
      res.set('Content-Type', 'text/xml');
      return res.send(feed.xml());
    });
  });


  // Invoke the callback. This must happen on next tick or later!
  if (callback) {
    return process.nextTick(function() {
      return callback(null);
    });
  }
}

// Export the constructor so others can subclass
factory.Construct = Construct;