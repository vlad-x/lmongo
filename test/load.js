/**
 * 		Load tests for elmongo to ensure sanity during lots of load
 */
var mongoose = require('mongoose'),
	Schema = mongoose.schema,
	request = require('request'),
	assert = require('assert'),
	models = require('./models'),
	async = require('async'),
	mongodb = require('mongodb'),
	ObjectID = mongodb.ObjectID,
	util = require('util'),
	elmongo = require('../lib/elmongo'),
	testHelper = require('./helper')

var connStr = 'mongodb://localhost/elmongo-test'

describe('elmongo load tests', function () {

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
			}
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

	it('insert 10K cats into the DB, reindexing while searching should keep returning results', function (done) {
		var numDocs = 10*1000

		async.series({
			insert10KCats: function (next) {
				console.log('\nsaving %s docs to the DB', numDocs)
				testHelper.insertNDocs(numDocs, models.Cat, next)
			},
			refresh: testHelper.refresh,
			reindexWhileSearching: function (next) {
				var searchesPassed = 0

				// perform a search query every 50ms during reindexing
				var interval = setInterval(function () {
					models.Cat.search({ query: '*', pageSize: 25 }, function (err, results) {
						testHelper.assertErrNull(err)

						assert.equal(results.total, 10000)
						assert.equal(results.hits.length, 25)
						searchesPassed++
					})
				}, 50)

				// kick off reindexing while searches are being performed
				models.Cat.sync(function (err) {
					testHelper.assertErrNull(err)

					clearInterval(interval)

					console.log('performed %s successful searches during reindexing', searchesPassed)

					return next()
				})
			}
		}, done)
	})
})
