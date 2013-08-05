var util = require('util'),
    helpers = require('./helpers')

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

    var searchUri = helpers.makeTypeUri(options) + '/_search?search_type=query_then_fetch'

    // console.log('searchOpts', searchOpts)

    var body = {
        query: {
            multi_match: {
                query: searchOpts.query,
                fields: searchOpts.fields,
                fuzziness: 0.4,
                // if analyzer causes zero terms to be produced from the query, return all results
                zero_terms_query: 'all'
            }
        }
    }

    body.from = searchOpts.page ? (searchOpts.page - 1) * searchOpts.pageSize : 0
    body.size = searchOpts.pageSize

    // console.log('\nsearch body', util.inspect(body, true, 10, true))

    var reqOpts = {
        method: 'POST',
        url: searchUri,
        body: JSON.stringify(body)
    }

    helpers.backOffRequest(reqOpts, function (err, res, body) {
        if (err) {
            var error = new Error('Elasticsearch search error')
            error.details = err

            return cb(error)
        }

        if (body.hits && body.hits.hits) {

            var results = body.hits.hits.map(function (hit) {
                return hit._source
            })

            return cb(null, results)
        }

        // failure scenario - unexpected elasticsearch reply
        var error = new Error('Unexpected Elasticsearch reply')
        error.elasticsearchReply = body

        return cb(error)
    })
}