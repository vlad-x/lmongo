var request = require('request'),
    mongoose = require('mongoose'),
    util = require('util'),
    url = require('url'),
    helpers = require('./helpers'),
    sync = require('./sync')

// turn off request pooling
request.defaults({ agent:false })

// cache elasticsearch url options for elmongo.search() to use
var elasticUrlOptions = null

/**
 * Attach mongoose plugin for elasticsearch indexing
 * 
 * @param  {Object} schema      mongoose schema
 * @param  {Object} options     elasticsearch options object. Keys: host, port, index, type
 */
module.exports = elmongo = function (schema, options) {

    // attach methods to schema
    schema.methods.index = index
    schema.methods.unindex = unindex

    schema.statics.sync = function (cb) {
        options = helpers.mergeModelOptions(options, this)

        return sync.call(this, schema, options, cb)
    }

    schema.statics.search = function (searchOpts, cb) {
        options = helpers.mergeModelOptions(options, this)

        var searchUri = helpers.makeTypeUri(options) + '/_search?search_type=query_then_fetch'

        return helpers.doSearchAndNormalizeResults(searchUri, searchOpts, cb)
    }

    // attach mongoose middleware hooks
    schema.post('save', function () {
        options = helpers.mergeModelOptions(options, this)
        this.index(options)
    })
    schema.post('remove', function () {
        options = helpers.mergeModelOptions(options, this)
        this.unindex(options)
    })
}

/**
 * Search across multiple collections. Same usage as model search, but with an extra key on `searchOpts` - `collections`
 * @param  {Object}   searchOpts
 * @param  {Function} cb
 */
elmongo.search = function (searchOpts, cb) {
    // merge elasticsearch url config options
    elasticUrlOptions = helpers.mergeOptions(elasticUrlOptions)

    // determine collections to search on
    var collections = searchOpts.collections && searchOpts.collections.length ? searchOpts.collections : [ '_all' ]

    var searchUri = helpers.makeDomainUri(elasticUrlOptions) + '/' + collections.join(',') + '/_search?search_type=query_then_fetch'

    return helpers.doSearchAndNormalizeResults(searchUri, searchOpts, cb)
}

/**
 * Configure the Elasticsearch url options for `elmongo.search()`.
 * 
 * @param  {Object} options
 */
elmongo.search.config = function (options) {
    elasticUrlOptions = helpers.mergeSearchOptions(options)
}

/**
 * Index a document in elasticsearch (create if not existing)
 *
 * @param  {Object} options     elasticsearch options object. Keys: host, port, index, type
 */
function index (options) {
    var self = this
    // strip mongoose-added functions and serialize the doc
    var esearchDoc = helpers.serialize(this.toObject())

    var indexUri = helpers.makeDocumentUri(options, self)

    var reqOpts = {
        method: 'PUT',
        url: indexUri,
        body: JSON.stringify(esearchDoc)
    }

    // console.log('index:', indexUri)

    helpers.backOffRequest(reqOpts, function (err, res, body) {
        if (err) {
            var error = new Error('Elasticsearch document indexing error: '+util.inspect(err, true, 10, true))
            error.details = err

            self.emit('error', error)
            return
        }

        self.emit('elmongo-indexed', body)
    })
}

/**
 * Remove a document from elasticsearch
 *
 * @param  {Object} options     elasticsearch options object. Keys: host, port, index, type
 */
function unindex (options) {
    var self = this

    var unindexUri = helpers.makeDocumentUri(options, self)

    // console.log('unindex:', unindexUri)

    var reqOpts = {
        method: 'DELETE',
        url: unindexUri
    }

    helpers.backOffRequest(reqOpts, function (err, res, body) {
        if (err) {
            var error = new Error('Elasticsearch document index deletion error: '+util.inspect(err, true, 10, true))
            error.details = err

            self.emit('error', error)
            return
        }

        self.emit('elmongo-unindexed', body)
    })
}

