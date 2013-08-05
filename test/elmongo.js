var mongoose = require('mongoose'),
	Schema = mongoose.schema,
	request = require('request'),
	assert = require('assert'),
	models = require('./models'),
	async = require('async'),
	mongodb = require('mongodb'),
	ObjectID = mongodb.ObjectID,
	util = require('util')

// connect to db
mongoose.connect('mongodb://localhost/elmongo-test')

describe('elmongo plugin', function () {
	before(function (done) {
		// make sure elasticsearch is running
		request('http://localhost:9200', function (err, res, body) {
			assert.equal(err, null)
			assert(body)

			var parsedBody = JSON.parse(body)
			assert.equal(parsedBody.ok, true)
			assert.equal(parsedBody.status, 200)

			return done()
		})
	})

	after(function (done) {
		async.series({
			dropCollections: function (next) {
				var deletionFns = Object.keys(models).map(function (modelName) {
					var model = models[modelName];

					return function (modelNext) {
						model.remove({}, modelNext)
					}
				})

				async.parallel(deletionFns, next)
			},
			refreshIndex: exports.refresh
		}, done)
	})

	it('initial request on /index/cat should receive `No handler` message from elasticsearch', function (done) {
		request('http://localhost:9200/index/cat', function (err, res, body) {
			assert.equal(err, null)
			assert.equal(body, 'No handler found for uri [/index/cat] and method [GET]')
			
			return done()
		})
	})

	it('inserting a `cat` model directly using mongodb driver should show up in search after .sync is called', function (done) {

		var catObj = {
			name: 'nomnom',
			_id: new ObjectID()
		}

		async.series({
			insertCat: function (next) {
				mongoose.connection.collection('cats').insert(catObj, next)
			},
			syncCat: function (next) {
				models.Cat.sync(function (err) {
					return next()
				})
			},
			refresh: exports.refresh,
			searchCat: function (next) {
				models.Cat.search({ query: 'nomnom' }, function (err, results) {
					exports.assertErrNull(err)
					
					assert(results)
					assert.equal(results.length, 1)

					var firstResult = results[0]

					assert(firstResult)
					assert.equal(firstResult.name, 'nomnom')

					return next()
				})
			}
		}, done)
	})

	it('query with no matches should return empty array', function (done) {
		models.Cat.search({ query: 'nothingShouldMatchThis' }, function (err, results) {
			assert.equal(err, null)
			assert(results)
			assert.equal(results.length, 0, 'results.length !== 0: '+util.inspect(results, true, 10, true))

			return done()
		})
	})

	it('after creating a cat model instance, it should show up in search', function (done) {
		var cat = new models.Cat({
			name: 'simba'
		})
		cat.save(function (err) {
			assert.equal(err, null)
		})

		cat.on('elmongo-indexed', function (esearchBody) {
			// refresh the index once the document is indexed (so it should be available for search)
			exports.refresh(function () {
				// search to make sure the cat got indexed
				models.Cat.search({ query: 'simba' }, function (err, results) {
					exports.assertErrNull(err)

					assert.equal(results.length, 1)
					assert(results[0])
					assert.equal(results[0].name, 'simba')

					return done()
				})
			})
		})
	})

	it('query with * should return 2 results', function (done) {
		models.Cat.search({ query: '*' }, function (err, results) {
			exports.assertErrNull(err)

			assert.equal(results.length, 2)

			return done()
		})
	})
})

/**
 * Force a refresh on all indices so we an expect elasticsearch to be up-to-date
 * @param  {Function} cb - Completion callback
 */
exports.refresh = function (cb) {
	request('http://localhost:9200/_refresh', function (err, res, body) {
		assert.equal(err, null)
		var parsedBody = JSON.parse(body)
		assert.equal(parsedBody.ok, true)
		return cb()
	})
}

exports.assertErrNull = function (err) {
	assert.equal(err, null, 'err:'+util.inspect(err, true, 10, true))
}