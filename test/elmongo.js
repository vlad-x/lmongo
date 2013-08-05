var mongoose = require('mongoose'),
	Schema = mongoose.schema,
	request = require('request'),
	assert = require('assert'),
	models = require('./models'),
	async = require('async'),
	mongodb = require('mongodb'),
	ObjectID = mongodb.ObjectID

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
				models.Cat.sync(next)
			},
			searchCat: function (next) {
				models.Cat.search({ query: 'nomnom' }, function (err, results) {

				})
			}
		}, done)
	})

	it.skip('after creating a cat model instance, it should show up in search', function (done) {
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
				models.Cat.search({ query: 'simba' }, function (err, searchResults) {
					assert.equal(err, null)

					console.log('searchResults', searchResults)
					return done()
				})
			})
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