#`elmongo`

##The Power of Search for Mongoose.


`elmongo` is a [mongoose](http://mongoosejs.com/) plugin that integrates your data with [Elasticsearch](http://www.elasticsearch.org), to give you the full power of highly available, distributed search across your data.

If you have [homebrew](http://brew.sh/), you can install and run Elasticsearch with this one-liner:

```
brew install elasticsearch && elasticsearch
```

Or you can install Elasticsearch and run it in the background with this one-liner (assuming you have a `~/bin` directory):
```
curl http://download.elasticsearch.org/elasticsearch/elasticsearch/elasticsearch-0.90.1.zip -o temp-es.zip && unzip temp-es.zip && rm temp-es.zip && mv elasticsearch-0.90.1 ~/bin/elasticsearch && ~/bin/elasticsearch/bin/elasticsearch
```

#Install

```
npm install elmongo
```

#Usage
```js
var mongoose = require('mongoose'),
    elmongo = require('elmongo'), 
    Schema = mongoose.Schema

var Cat = new Schema({
    name: String
})

// add the elmongo plugin to your collection
Cat.plugin(elmongo)
```

Now add your existing data to the search index:
```js
Cat.sync(function (err) {
  // all cats are now searchable in elasticsearch
})
```

At this point your Cat schema has all the power of Elasticsearch. Here's how you can search on the model:
```js
Cat.search({ query: 'simba' }, function (err, results) {
 	console.log('search results', results)
})

// Perform a fuzzy search
Cat.search({ query: 'Sphinxx', fuzziness: 0.5 }, function (err, results) {
	// ...
})

// Paginate through the data
Cat.search({ query: '*', page: 1, pageSize: 25 }, function (err, results) {
 	// ...
})

// Use `where` clauses to filter the data
Cat.search({ query: 'john', where: { age: 25, breed: 'siamese' } }, function (err, results) {
	// ...
})
```

After the initial `.sync()`, any `Cat` models you create/edit/delete with mongoose will be up-to-date in Elasticsearch. Also, elmongo reindexes with zero downtime. This means that your data will always be available in Elasticsearch even if you're in the middle of reindexing.

#API

##`Model.sync(callback)`

Re-indexes your collection's data in Elasticsearch. You can call this at any time and expect all your collection's data to be available for search once `callback` is called. This is done with zero downtime, so you can keep making search queries even while `.sync()` is running, and your data will be there.

Example:
```js
Cat.sync(function (err) {
	// all existing data in the `cats` collection is searchable now
})
```

##`Model.search(searchOptions, callback)`

Perform a search query on your model. Any values options you provide will override the default search options. The default options are:

```js
{
    query: '*',
    fields: [ '_all' ],	// searches all fields by default
    fuzziness: 0.0,		// exact match by default
    pageSize: 25,
    page: 1
}
```

##`Model.plugin(elmongo[, options])`

Gives your collection `search()` and `sync()` methods, and keeps Elasticsearch up-to-date with your data when you insert/edit/delete documents with mongoose. Takes an optional `options` object to tell `elmongo` the url that Elasticsearch is running at. In `options` you can specify:

 * `host` - the host that Elasticsearch is running on (defaults to `localhost`)
 * `port` - the port that Elasticsearch is listening on (defaults to `9200`)

##`elmongo.search(searchOptions, callback)`

You can use this function to make searches that are not limited to a specific collection. Use this to search across one or several collections at the same time (without making multiple roundtrips to Elasticsearch). The default options are the same as for `Model.search()`, with one extra key: `collections`. You can use it like so:

```js
elmongo.search({ collections: [ 'cats', 'dogs' ], query: '*' }, function (err, results) {
	// ...
})
```

By default, `elmongo.search()` will use `localhost:9200` (the default Elasticsearch configuration). To configure it to use a different url, use `elmongo.search.config(options)`.

##`elmongo.search.config(options)`

Configure the Elasticsearch url that `elmongo` uses to perform a search when `elmongo.search()` is used. This has no effect on the configuration for individual collections - to configure the url for collections, use `Model.plugin()`.

Example:
```js
elmongo.search.config({ host: something.com, port: 9300 })
```


-------

## Running the tests

```
npm test
```

-------

## License 

(The MIT License)

Copyright (c) by Tolga Tezel <tolgatezel11@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.