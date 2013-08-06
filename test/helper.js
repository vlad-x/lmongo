/**
 * 
 * Helper functions for tests
 * 
 */
var assert = require('assert'),
	util = require('util'),
	request = require('request'),
	async = require('async'),
	models = require('./models')

/**
 * Force a refresh on all indices so we an expect elasticsearch to be up-to-date
 * 
 * @param  {Function} cb
 */
exports.refresh = function (cb) {
	request('http://localhost:9200/_refresh', function (err, res, body) {
		assert.equal(err, null)
		var parsedBody = JSON.parse(body)
		assert.equal(parsedBody.ok, true)
		return cb()
	})
}

exports.waitForYellowStatus = function (cb) {
	request('http://localhost:9200/_cluster/health?wait_for_status=yellow&timeout=50s', function (err, res, body) {
		assert.equal(err, null)
		return cb()
	})
}

/**
 * Assert that `err` is null, output a helpful error message if not.
 * 
 * @param  {Any type} err
 */
exports.assertErrNull = function (err) {
	if (err) console.log('err:', util.inspect(err, true, 10, true))
	assert.equal(err, null)
}

/**
 * Insert a Mongoose document, or an Array of them, call `cb` on completion.
 * 
 * @param  {Array|Object}   docs
 * @param  {Function} cb
 */
exports.insertDocs = function (docs, cb) {
	if (!Array.isArray(docs)) {
		docs = [ docs ]
	}

	async.each(docs, function (doc, docNext) {
		if (!doc.save) {
			return docNext(new Error('Invalid argument: `docs` is expected to be a Mongoose document, or array of them'))
		}

		doc.save(function (err) {
			if (err) { 
				return cb(err)
			}

			doc.on('elmongo-indexed', function (esearchBody) {
				if (!esearchBody || !esearchBody.ok) {
					var error = new Error('elmongo-index error: '+esearchBody)
					error.esearchBody = esearchBody

					return docNext(error)
				}
				
				return docNext()
			})
		})
	}, cb)
}

/**
 * Insert `n` instances of `model` into the DB, call `cb` on completion.
 * @param  {Number}   n
 * @param  {Object}   model
 * @param  {Function} cb
 */
exports.insertNDocs = function (n, model, cb) {
	var modelsToSave = []

	for (var i = 0; i < n; i++) {
		var instance = new model({
			name: 'model '+i
		})

		modelsToSave.push(instance)
	}

	exports.insertDocs(modelsToSave, cb)
}

/**
 * Drop all test collections from the DB, call `cb` on completion.
 * 
 * @param  {Function} cb
 */
exports.dropCollections = function (cb) {

	// drop all collections from `models` in parallel
	var deletionFns = Object.keys(models).map(function (modelName) {
		var model = models[modelName];

		return function (modelNext) {

			model.find().exec(function (err, documents) {
				if (err) {
					return modelNext(err)
				}

				documents.forEach(function (doc) {
					doc.remove()
				})

				return modelNext()
			})
		}
	})

	async.parallel(deletionFns, cb)
}