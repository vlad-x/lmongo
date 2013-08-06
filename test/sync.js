var assert = require('assert'),
	testHelper = require('./helper'),
	models = require('./models'),
	async = require('async'),
	mongodb = require('mongodb'),
	mongoose = require('mongoose'),
	ObjectID = mongodb.ObjectID,
	mongoClient = mongodb.MongoClient,
	request = require('request')

var connStr = 'mongodb://localhost/elmongo-test'

describe('Model.sync()', function () {
	before(function (done) {
		async.series({
			connectMongo: function (next) {
				mongoose.connect(connStr, next)
			},
			dropCollections: testHelper.dropCollections,
			checkSearchRunning: function (next) {
				// make sure elasticsearch is running
				request('http://localhost:9200', function (err, res, body) {
					assert.equal(err, null)
					assert(body)

					var parsedBody = JSON.parse(body)
					assert.equal(parsedBody.ok, true)
					assert.equal(parsedBody.status, 200)

					return next()
				})
			},
			refreshIndex: testHelper.refresh
		}, done)
	})

	after(function (done) {
		async.series({
			dropCollections: testHelper.dropCollections,
			refreshIndex: testHelper.refresh,
			disconnectMongo: function (next) {
				mongoose.disconnect()
				return next()
			}
		}, done)
	})

	it('inserting a `cat` model directly using mongodb driver should show up in Model.search() after Model.sync() is called', function (done) {

		var catObj = {
			name: 'nomnom',
			_id: new ObjectID()
		}

		var db = null

		async.series({
			connectMongo: function (next) {
				mongoClient.connect(connStr, function (err, connectedDb) {
					assert.equal(err, null)

					db = connectedDb
					return next()
				})
			},
			insertCat: function (next) {
				db.collection('cats').insert(catObj, next)
			},
			syncCat: function (next) {
				models.Cat.sync(next)
			},
			// refresh: exports.refresh,
			searchCat: function (next) {
				models.Cat.search({ query: 'nomnom' }, function (err, results) {
					testHelper.assertErrNull(err)

					assert(results)
					assert.equal(results.total, 1)
					assert.equal(results.hits.length, 1)

					var firstResult = results.hits[0]

					assert(firstResult)
					assert.equal(firstResult.name, 'nomnom')

					return next()
				})
			},
			closeMongo: function (next) {
				db.close()
				return next()
			}
		}, function (err) {
			testHelper.assertErrNull(err)
			return done()
		})
	})
})