var request = require('request'),
    mongoose = require('mongoose'),
    util = require('util'),
    url = require('url'),
    helpers = require('./helpers'),
    search = require('./search')
    sync = require('./sync')

// turn off request pooling
request.defaults({ agent:false })

/**
 * Attach mongoose plugin for elasticsearch indexing
 * 
 * @param  {Object} schema      mongoose schema
 * @param  {Object} options     elasticsearch options object. Keys: host, port, index, type
 */
module.exports = function (schema, options) {
    // attach methods to schema
    schema.methods.index = index
    schema.methods.unindex = unindex

    schema.statics.sync = function (cb) {
        options = helpers.mergeOptions(options, this)

        return sync.call(this, schema, options, cb)
    }

    schema.statics.search = function (searchOpts, cb) {
        options = helpers.mergeOptions(options, this)
        
        return search.call(this, schema, options, searchOpts, cb)
    }

    // attach mongoose middleware hooks
    schema.post('save', function () {
        this.index(options)
    })
    schema.post('remove', function () {
        this.unindex(options)
    })
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
    var reqBody = JSON.stringify(esearchDoc)

    var indexUri = helpers.makeDocumentUri(options, self)

    var reqOpts = {
        method: 'PUT',
        url: indexUri,
        body: reqBody
    }

    helpers.backOffRequest(reqOpts, function (err, res, body) {
        if (err) {
            var error = new Error('Elasticsearch document indexing error')
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

    var reqOpts = {
        method: 'DELETE',
        url: unindexUri
    }

    helpers.backOffRequest(reqOpts, function (err, res, body) {
        if (err) {
            var error = new Error('Elasticsearch document index deletion error')
            error.details = err

            self.emit('error', error)
            return
        }

        self.emit('elmongo-unindexed', body)
    })
}

