module.exports = factory;

var rss = require('rss');
var _ = require('lodash');

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
  }

  self._app.get(self.route + '*', function(req, res) {
    var resource, projection, criteria;

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
    self._apos.get(req, criteria, function(err, results) {
  
      if (err) {
        return callback(err);
      }

      // create a feed object
      var feed = new rss({
        title: self._app.locals.siteTitle,
        generator: 'Apostrpohe 2',
        description: self._options.description || null,
        site_url: 'http://' + self._app.locals.hostName,
        feed_url: 'http://' + self._app.locals.hostName + req.url
      });

      // console.log(self._apos._aposLocals);
      // console.log(req);

      // loop page results and add them to the feed object
      results.pages.forEach(function(page) {
        // console.log(page);
        var description;
        if (page.areas.body) { // bc for 0.4
          description = self._apos._aposLocals.aposAreaContent(page.areas.body.items, {allowed:['video', 'richText', 'slideshow', 'blockquote']});
        } else {
          description = self._apos._aposLocals.aposAreaContent(page.body.items, {allowed:['video', 'richText', 'slideshow', 'blockquote']});
        }
        feed.item({
          title: page.title,
          description: description,
          categories: page.tags,
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