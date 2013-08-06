var mongoose = require('mongoose'),
	Schema = mongoose.schema,
	request = require('request'),
	assert = require('assert'),
	models = require('./models'),
	async = require('async'),
	util = require('util'),
	elmongo = require('../lib/elmongo'),
	testHelper = require('./helper')

// connect to DB
var connStr = 'mongodb://localhost/elmongo-test'

describe('elmongo plugin', function () {

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
			syncCats: function (next) {
				models.Cat.sync(next)
			},
			waitForYellowStatus: testHelper.waitForYellowStatus,
			insertCats: function (next) {
				var testCats = [];

				testCats[0] = new models.Cat({
					name: 'Puffy',
					breed: 'siamese',
					age: 10
				})

				testCats[1] = new models.Cat({
					name: 'Mango',
					breed: 'siamese',
					age: 15
				})

				testCats[2] = new models.Cat({
					name: 'Siamese',
					breed: 'persian',
					age: 12
				})

				testHelper.insertDocs(testCats, next)
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

	it('Model.search() query with no matches should return empty array', function (done) {
		models.Cat.search({ query: 'nothingShouldMatchThis' }, function (err, results) {
			assert.equal(err, null)
			assert(results)

			if (results.hits.length || results.hits.total) console.log('results', util.inspect(results, true, 10, true))

			assert.equal(results.total, 0)
			assert.equal(results.hits.length, 0)

			return done()
		})
	})

	it('after creating a cat model instance, it should show up in Model.search()', function (done) {

		var cat = new models.Cat({
			name: 'simba'
		})
		cat.save(function (err) {
			assert.equal(err, null)
		})

		cat.on('elmongo-indexed', function (esearchBody) {
			// refresh the index once the document is indexed (so it should be available for search)
			testHelper.refresh(function () {
				// search to make sure the cat got indexed
				models.Cat.search({ query: 'simba' }, function (err, results) {
					testHelper.assertErrNull(err)

					assert.equal(results.total, 1)
					assert.equal(results.hits.length, 1)
					assert(results.hits[0])
					assert.equal(results.hits[0].name, 'simba')

					return done()
				})
			})
		})
	})

	it('Model.search() with * should return all results', function (done) {
		models.Cat.search({ query: '*' }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, 3)
			assert.equal(results.hits.length, 3)

			return done()
		})
	})

	it('elmongo.search() with * should return all results', function (done) {
		elmongo.search({ query: '*', collections: [ 'cats' ] }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, 3)
			assert.equal(results.hits.length, 3)

			return done()
		})
	})

	it('elmongo.search.config() then elmongo.search with * should return all results', function (done) {
		elmongo.search.config({ host: '127.0.0.1', port: 9200 })

		elmongo.search({ query: '*', collections: [ 'cats' ] }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, 3)
			assert.equal(results.hits.length, 3)

			return done()
		})
	})

	it('Model.search() with fuzziness 0.5 should return results for `ismba`', function (done) {
		models.Cat.search({ query: 'ismba', fuzziness: 0.5 }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, 1)
			assert.equal(results.hits.length, 1)

			var firstResult = results.hits[0]

			assert(firstResult)
			assert.equal(firstResult.name, 'simba')

			return done()
		})
	})

	it('Model.search() with fields returns only results that match on that field', function (done) {
		models.Cat.search({ query: 'Siamese', fields: [ 'name' ] }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, 1)
			assert.equal(results.hits.length, 1)

			var firstResult = results.hits[0]

			assert(firstResult)
			assert.equal(firstResult.name, 'Siamese')
			assert.equal(firstResult.breed, 'persian')

			return done()
		})
	})

	it('Model.search() with basic where clause returns results', function (done) {
		var searchOpts = {
			query: '*',
			where: {
				age: 10
			}
		}

		models.Cat.search(searchOpts, function (err, results) {
			testHelper.assertErrNull(err)

			console.log('results', results)

			assert.equal(results.total, 1)
			assert.equal(results.hits.length, 1)

			var firstResult = results.hits[0]

			assert(firstResult)
			assert.equal(firstResult.age, 10)

			return done()
		})
	})

	it('Model.search() with 3 where clauses returns correct results', function (done) {
		var searchOpts = {
			query: '*',
			where: {
				age: 15,
				breed: 'siamese',
				name: 'Mango'
			}
		}

		models.Cat.search(searchOpts, function (err, results) {
			testHelper.assertErrNull(err)

			console.log('results', results)

			assert.equal(results.total, 1)
			assert.equal(results.hits.length, 1)

			var firstResult = results.hits[0]

			assert(firstResult)
			assert.equal(firstResult.age, 15)
			assert.equal(firstResult.breed, 'siamese')
			assert.equal(firstResult.name, 'Mango')

			return done()
		})
	})

	it('Model.search() with `not` clause returns results')

	it('Model.search() with where `or` clause returns results')

	it('Model.search() with where `in` clause returns results')

	it('Model.search() with where `gt` clause returns results')

	it('Model.search() with where `lt` clause returns results')
})
