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

/**
 * 
 * Basic tests for Elmongo functionality - load tests are done in load.js
 * 
 */
describe('elmongo plugin', function () {

	// array of test cat models that tests in this suite share
	var testCats = [];

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

				testHelper.saveDocs(testCats, next)
			},
			refreshIndex: testHelper.refresh
		}, done)
	})

	after(function (done) {
		async.series({
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

		var testCat = null

		async.series({
			addCat: function (next) {
				testCat = new models.Cat({
					name: 'simba'
				})

				testHelper.saveDocs([ testCat ], next)
			},
			refreshIndex: testHelper.refresh,
			doSearch: function (next) {
				// search to make sure the cat got indexed
				models.Cat.search({ query: 'simba' }, function (err, results) {
					testHelper.assertErrNull(err)

					assert.equal(results.total, 1)
					assert.equal(results.hits.length, 1)
					assert(results.hits[0])
					assert.equal(results.hits[0].name, 'simba')

					return next()
				})
			},
			cleanup: function (next) {
				testHelper.removeDocs([ testCat ], next)
			},
			refreshIndex: testHelper.refresh
		}, done)
	})

	it('creating a cat model instance and editing properties should be reflected in Model.search()', function (done) {

		var testCat = null

		async.series({
			addCat: function (next) {
				testCat = new models.Cat({
					name: 'Tolga',
					breed: 'turkish',
					age: 5
				})

				testHelper.saveDocs([ testCat ], next)
			},
			refreshIndex: testHelper.refresh,
			// search to make sure the cat got indexed
			doSearch: function (next) {
				models.Cat.search({ query: 'Tolga', fields: [ 'name' ] }, function (err, results) {
					testHelper.assertErrNull(err)

					assert.equal(results.total, 1)
					assert.equal(results.hits.length, 1)
					assert(results.hits[0])
					assert.equal(results.hits[0].name, 'Tolga')

					return next()
				})
			},
			// update the `testCat` model
			update: function (next) {
				models.Cat.findById(testCat._id).exec(function (err, cat) {
					assert.equal(err, null)

					assert(cat)
					cat.age = 7
					cat.breed = 'bengal'

					testHelper.saveDocs([ cat ], next)
				})
			},
			wait: function (next) {
				// wait 3s for age update
				setTimeout(next, 3000)
			},
			refreshIndex: testHelper.refresh,
			checkUpdates: function (next) {
					models.Cat.search({ query: 'tolga', fields: [ 'name' ] }, function (err, results) {
						assert.equal(err, null)

						// console.log('results after update', results)

						assert.equal(results.total, 1)
						assert.equal(results.hits.length, 1)

						var firstResult = results.hits[0]

						assert(firstResult)
						assert.equal(firstResult.name, 'Tolga')
						assert.equal(firstResult.age, 7)
						assert.equal(firstResult.breed, 'bengal')

						return next()
					})
			},
			cleanup: function (next) {
				testHelper.removeDocs([ testCat ], next)
			},
			refreshIndex: testHelper.refresh
		}, done)
	})

	it('creating a cat model instance and updating an array property should be reflected in Model.search()', function (done) {

		var testCat = null

		var testToys = [ 'scratcher', 'rubber duck' ];

		async.series({
			addCat: function (next) {
				testCat = new models.Cat({
					name: 'Tolga',
					breed: 'turkish',
					age: 5
				})

				testHelper.saveDocs([ testCat ], next)
			},
			refreshIndex: testHelper.refresh,
			// search to make sure the cat got indexed
			doSearch: function (next) {
				models.Cat.search({ query: 'Tolga', fields: [ 'name' ] }, function (err, results) {
					testHelper.assertErrNull(err)

					assert.equal(results.total, 1)
					assert.equal(results.hits.length, 1)
					assert(results.hits[0])
					assert.equal(results.hits[0].name, 'Tolga')

					return next()
				})
			},
			// update the model
			update: function (next) {
				models.Cat.findById(testCat._id).exec(function (err, cat) {
					assert.equal(err, null)

					assert(cat)
					cat.toys = testToys
					cat.markModified('toys')

					testHelper.saveDocs([ cat ], next)
				})
			},
			wait: function (next) {
				// wait 3s for age update
				setTimeout(next, 3000)
			},
			refreshIndex: testHelper.refresh,
			checkAge: function (next) {
					models.Cat.search({ query: 'tolga', fields: [ 'name' ] }, function (err, results) {
						assert.equal(err, null)

						// console.log('results after toys update', util.inspect(results, true, 10, true))

						assert.equal(results.total, 1)
						assert.equal(results.hits.length, 1)

						var firstResult = results.hits[0]

						assert(firstResult)
						assert.equal(firstResult.name, 'Tolga')
						assert.deepEqual(firstResult.toys, testToys)

						return next()
					})
			},
			cleanup: function (next) {
				testHelper.removeDocs([ testCat ], next)
			},
			refreshIndex: testHelper.refresh
		}, done)
	})

	it('Model.search() with * should return all results', function (done) {

		setTimeout(function () {

			models.Cat.search({ query: '*' }, function (err, results) {
				testHelper.assertErrNull(err)

				assert.equal(results.total, testCats.length)
				assert.equal(results.hits.length, testCats.length)

				return done()
			})


		}, 5000)
	})

	it('elmongo.search() with * should return all results', function (done) {
		elmongo.search({ query: '*', collections: [ 'cats' ] }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, testCats.length)
			assert.equal(results.hits.length, testCats.length)

			return done()
		})
	})

	it('elmongo.search.config() then elmongo.search with * should return all results', function (done) {
		elmongo.search.config({ host: '127.0.0.1', port: 9200 })

		elmongo.search({ query: '*', collections: [ 'cats' ] }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, testCats.length)
			assert.equal(results.hits.length, testCats.length)

			return done()
		})
	})

	it('Model.search() with fuzziness 0.5 should return results for `Mangoo`', function (done) {
		models.Cat.search({ query: 'Mangoo', fuzziness: 0.5 }, function (err, results) {
			testHelper.assertErrNull(err)

			assert.equal(results.total, 1)
			assert.equal(results.hits.length, 1)

			var firstResult = results.hits[0]

			assert(firstResult)
			assert.equal(firstResult.name, 'Mango')

			return done()
		})
	})

	it('Model.search() with fuzziness 0.5 and with fields should return fuzzy matches for that field', function (done) {
		models.Cat.search({ query: 'siameez', fuzziness: 0.5, fields: [ 'breed'] }, function (err, results) {
			testHelper.assertErrNull(err)

			var siameseTestCats = testCats.filter(function (testCat) { return testCat.breed === 'siamese' })

			assert.equal(results.total, siameseTestCats.length)
			assert.equal(results.hits.length, siameseTestCats.length)

			assert(results.hits.every(function (hit) {
				return hit.breed === 'siamese'
			}))

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

	it.skip('Model.search() with `not` clause returns correct results', function (done) {
		var searchOpts = {
			query: '*',
			where: { age: { not: 10 } }
		}

		var numTestCatsExpected = testCats.filter(function (testCat) { return testCat.age !== 10 }).length

		models.Cat.search(searchOpts, function (err, results) {
			testHelper.assertErrNull(err)

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

	it('Model.search() with where `or` clause returns results')

	it('Model.search() with where `in` clause returns results')

	it('Model.search() with where `gt` clause returns results')

	it('Model.search() with where `lt` clause returns results')
})
