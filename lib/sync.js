/*
    Sync a collection's data into elasticsearch (with zero downtime)
 */
var request = require('request'),
    async = require('async'),
    util = require('util'),
    mongoose = require('mongoose'),
    url = require('url'),
    helpers = require('./helpers')

request.defaults({agent:false})

//how many docs to index at a time in bulk
var BATCH_SIZE = 100

module.exports = function (schema, options, cb) {
    var self = this
    var versionedUri = (helpers.makeIndexUri(options) + '-' + new Date().toISOString()).toLowerCase()
    var type = options.type

    var docsToIndex = null

    var versionedIndexName = url.parse(versionedUri).pathname.slice(1)

    async.series({
        // create an elasticsearch index, versioned with the current timestamp
        createVersionedIndex: function (next) {

            // index creation options
            var body = {
                settings: {
                    index: {
                        analysis: {
                           analyzer: {
                              default: {
                                type: 'custom',
                                // ensure full emails/urls are not tokenized
                                tokenizer: 'uax_url_email',
                                // searching should be case-insensitive
                                filter: [ 'lowercase' ]
                              }
                           }
                        }
                     }
                }
            }

            var reqOpts = {
                method: 'PUT',
                url: versionedUri,
                body: JSON.stringify(body)
            }

            helpers.backOffRequest(reqOpts, function (err, res, body) {
                if (err) {
                    return cb(err)
                }

                if (!body || !body.ok) {
                    var error = new Error('Unexpected index creation reply: '+body)
                    error.body = body

                    return next(error)
                }

                return next()
            })
        },
        // get a count of how many documents we have to index
        countDocs: function (next) {
            self.count().exec(function (err, count) {
                if (err) {
                    return next(err)
                }

                docsToIndex = count

                return next()
            })
        },
        // populate the newly created index with this collection's documents
        populateVersionedIndex: function (next) {
            // if no documents to index, skip population
            if (!docsToIndex) {
                return next()
            }

            // stream docs - and upload in batches of size BATCH_SIZE
            var docStream = self.find().stream()

            // elasticsearch commands to perform batch-indexing
            var commandSequence = [];

            docStream.on('data', function (doc) {
                if (!doc) {
                    return
                }

                // get rid of mongoose-added functions
                doc = helpers.serialize(doc.toObject())

                var selfStream = this
                var strObjectId = doc._id

                var command = {
                    index: {
                        _index: versionedIndexName,
                        _type: type,
                        _id: strObjectId
                    }
                }

                // append elasticsearch command and JSON-ified doc to command
                commandSequence.push(command)
                commandSequence.push(doc)

                if (commandSequence.length === BATCH_SIZE) {
                    // pause the stream of incoming docs until we're done
                    // indexing the batch in elasticsearch
                    selfStream.pause()

                    exports.bulkIndexRequest(versionedIndexName, commandSequence, options, function (err) {
                        if (err) {
                            return next(err)
                        }

                        // empty our commandSequence
                        commandSequence = []

                        // keep streaming now that we're ready to accept more
                        selfStream.resume()
                    })
                }
            })

            docStream.on('close', function () {
                // take care of the rest of the docs left in the buffer
                exports.bulkIndexRequest(versionedIndexName, commandSequence, options, function (err) {
                    if (err) {
                        return next(err)
                    }

                    // empty docBuffer
                    commandSequence = []

                    return next()
                })
            })
        },
        // get existing aliases for this collection
        getExistingAliases: function (next) {
            console.log('getExistingAliases')

            var reqOpts = {
                method: 'GET',
                url: helpers.makeAliasUri(options)
            }

            helpers.backOffRequest(reqOpts, function (err, res, body) {
                if (err) {
                    return next(err)
                }

                console.log('existing aliases', body)
            })
        },
        // create an alias from the collection's index to the versioned index
        createAlias: function (next) {
            var reqOpts = {
                method: 'POST',
                url: helpers.makeAliasUri(options)
            }

            var body = {
                actions: [
                    {
                        add: {
                            alias: options.type,
                            index: versionedIndexName
                        }
                    }
                ]
            }

            console.log('time to create the alias!')
        }
    }, cb)
}

/**
 * Run a bulk index request using `commandSequence`, then pass control to `callback`.
 *
 * @param  {Array}      commandSequence array of elasticsearch indexing commands
 * @param  {Function}   callback        completion callback. Signature: function (err)
 * @api private
 */
exports.bulkIndexRequest = function (indexName, commandSequence, options, callback) {
    // finalize request body as newline-separated JSON docs
    var body = commandSequence.map(JSON.stringify).join('\n')+'\n'

    var bulkIndexUri = helpers.makeBulkIndexUri(options, indexName)

    var reqOpts = {
        method: 'POST',
        url: bulkIndexUri,
        body: body
    }

    // console.log('bulk index reqOpts', util.inspect(reqOpts, true, 10, true))

    helpers.backOffRequest(reqOpts, function (err, res, body) {
        if (err) {
            return callback(err)
        }

        if (body.error) {
            var error = new Error('Elasticsearch sent an error reply back after bulk indexing.')
            error.elasticsearchReply = parsedBody
            error.commandSequence = commandSequence
            error.indexName = indexName
            return callback(error)
        }

        return callback(null)
    })
}
