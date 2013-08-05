var request = require('request'),
    mongoose = require('mongoose'),
    ObjectId = mongoose.Types.ObjectId,
    util = require('util'),
    url = require('url')

/**
 * Sends an http request using `reqOpts`, calls `cb` upon completion.
 * Upon ECONNRESET, backs off linearly in increments of 500ms with some noise to reduce concurrency.
 * 
 * @param  {Object}   reqOpts   request options object
 * @param  {Function} cb        Signature: function (err, res, body)
 */
exports.backOffRequest = function (reqOpts, cb) {
    var maxAttempts = 3
    var backOffRate = 500

    function makeAttempts (attempts) {
        attempts++

        request(reqOpts, function (err, res, body) {
            if (err) {
                if (
                    (err.code === 'ECONNRESET' || err.code === 'EPIPE')
                 && attempts <= maxAttempts
                 ) {
                    var waitTime = backOffRate*attempts+Math.random()*backOffRate

                    setTimeout(function () {
                        makeAttempts(attempts)
                    }, waitTime)
                    return
                } else {
                    var error = new Error('elasticsearch request error')
                    error.details = err
                    error.attempts = attempts
                    error.reqOpts = reqOpts

                    return cb(error)
                }
            }

            // parse the response body as JSON
            try {
                var parsedBody = JSON.parse(body)  
            } catch (parseErr) {
                var error = new Error('Elasticsearch did not send back a valid JSON reply: '+util.inspect(body, true, 10, true))
                error.elasticsearchReply = body
                error.reqOpts = reqOpts
                error.details = parseErr

                return cb(error)
            }

            // success case
            return cb(err, res, parsedBody)
        })
    }

    makeAttempts(0)
}

/**
 * Performs deep-traversal on `thing` and converts
 * any object ids to hex strings, and dates to ISO strings.
 * 
 * @param  {Any type} thing
 */
exports.serialize = function (thing) {
    if (Array.isArray(thing)) {
        return thing.map(exports.serialize)
    } else if (thing instanceof ObjectId) {
        return thing.toHexString()
    } else if (thing instanceof Date) {
        return thing.toISOString()
    } else if (typeof thing === 'object' && thing !== null) {
        Object
        .keys(thing)
        .forEach(function (key) {
            thing[key] = exports.serialize(thing[key])
        })
        return thing
    } else {
        return thing
    }
}

/**
 * Merge the default elmongo options with the user-supplied options object
 *
 * @param  {Object} options (optional)
 * @param  {Object}
 * @return {Object}
 */
exports.mergeOptions = function (options, model) {

    // use lower-case model name as elasticsearch type
    var type = model.collection.name.toLowerCase()

    // default options
    var defaultOptions = {
        host: 'localhost',
        port: 9200,
        index: 'index',
        type: type
    }

    if (!options)
        return defaultOptions

    // if user specifies an `options` value, ensure it's an object
    if (typeof options !== 'object') {
        throw new Error('elmongo options was specified, but is not an object. Got:'+util.inspect(options, true, 10, true))
    }

    var mergedOptions = {}

    // merge the user's `options` object with `defaultOptions`
    Object
    .keys(options)
    .forEach(function (key) {
        var optionValue = options[key];

        mergedOptions[key] = options[key] || defaultOptions[key]
    })

    return mergedOptions
}

/**
 * Merge the default elmongo search options with the user-supplied `searchOpts`
 * @param  {[type]} options
 * @param  {[type]} document
 * @return {[type]}
 */
exports.mergeSearchOptions = function (searchOpts) {
    console.log('mergeSearchOptions', searchOpts)

    return searchOpts
}

/**
 * Form the elasticsearch URI for indexing/deleting a document
 * 
 * @param  {Object} options
 * @param  {Mongoose document} doc
 * @return {String}
 */
exports.makeDocumentUri = function (options, doc) {
    var typeUri = exports.makeTypeUri(options)

    var docUri = typeUri+'/'+doc._id

    return docUri
}

/**
 * Form the elasticsearch URI for the index/type of the document
 * 
 * @param  {Object} options
 * @return {String}
 */
exports.makeTypeUri = function (options) {
    var indexUri = exports.makeIndexUri(options)

    var typeUri = indexUri + '/' + options.type

    return typeUri
}

exports.makeIndexUri = function (options) {
    var domainUri = exports.makeDomainUri(options)

    var indexUri = domainUri + '/' + options.type

    return indexUri
}

exports.makeDomainUri = function (options) {
    var domainUri = url.format({
        protocol: 'http',
        hostname: options.host,
        port: options.port
    })

    return domainUri
}

exports.makeAliasUri = function (options) {
    var domainUri = exports.makeDomainUri(options)

    var aliasUri = domainUri + '/_aliases'

    return aliasUri
}

exports.makeBulkIndexUri = function (options, index) {
    var domainUri = exports.makeDomainUri(options)

    var bulkIndexUri = domainUri + '/' + index + '/_bulk'

    return bulkIndexUri
}