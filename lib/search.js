var helpers = require('./helpers')

/**
 * Search the collection
 *
 * @param  {Mongoose schema}    schema      - mongoose schema
 * @param  {Object}             options     - elmongo options (optional)
 * @param  {Object|String}      searchOpts  - user-supplied search options
 * @param  {Function}           cb          - optional
 */
module.exports = function search (schema, options, searchOpts, cb) {
    var self = this

    searchOpts = helpers.mergeSearchOptions(searchOpts)

    var searchUri = helpers.makeTypeUri(options) + '/_search?'

    var esearchBody = {
        match: {
            _all: searchOpts.query
        }
    }

    var reqOpts = {
        method: 'POST',
        url: searchUri
    }

    helpers.backOffRequest(reqOpts, function (err, res, body) {
        if (err) {
            var error = new Error('Elasticsearch search error')
            error.details = err

            return cb(error)
        }

        if (body.hits && body.hits.hits) {
            return cb(null, body.hits.hits)
        }

        // failure scenario - unexpected elasticsearch reply
        var error = new Error('Unexpected Elasticsearch reply')
        error.elasticsearchReply = body

        return cb(error)
    })
}