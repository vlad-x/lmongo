#`elmongo`

##The power of Search for your mongoose collections.


`elmongo` is a mongoose plugin for keeping your collections up-to-date with elasticsearch. The result is amazing searchability across your collections, by giving your mongoose data all the search power of [elasticsearch](http://www.elasticsearch.org).

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

Add your existing data to the search index:
```js
Cat.sync(function (err) {
  // all cats are now searchable in elasticsearch
})
```

Now your Cat schema has all the power of Elasticsearch. Here's how you can search on the model:
```js
Cat.search({ query: 'simba' }, function (err, results) {
  console.log('search results', results)
})
```

You can paginate through the data like so:
```js
Cat.search({ query: '*', page: 1, pageSize: 25 }, function (err, results) {
  // ...
})
```

After the initial `.sync()`, any `Cat` models you create/edit/delete with mongoose will be up-to-date in Elasticsearch. Also, elmongo reindexes with zero downtime. This means that your data will always be available in elasticsearch even if you're in the middle of reindexing.

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