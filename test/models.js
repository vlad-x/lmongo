/**
 * This file contains mongoose models used in elmongo tests
 */

var mongoose = require('mongoose'),
	Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId,
	elmongo = require('../lib/elmongo')

/**
* Model definition
*/

var Cat = new Schema({
	name: { type: String },
	age: { type: Number },
	breed: { type: String },
	owner: { type: ObjectId, ref: 'Person' }
})

Cat.plugin(elmongo)

var Person = new Schema({
	name: { type: String },
	email: { type: String }
})

Person.plugin(elmongo)

exports.Cat = mongoose.model('Cat', Cat)
exports.Person = mongoose.model('Person', Person)
