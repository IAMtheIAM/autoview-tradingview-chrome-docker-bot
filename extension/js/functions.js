"use strict"

/**
 *
 * @param {Object} target
 * @returns {*}
 */
Object.assignDeep = function(target /* values */) {
	const isOwnProperty = Object.prototype.hasOwnProperty
	const isEnumerable = Object.prototype.propertyIsEnumerable

	function extendSymbols(target, objects) {
		if (target === null || typeof target === "undefined") {
			throw new TypeError("Invalid object provided: " + typeof target)
		}

		if (typeof objects === "undefined" || typeof Symbol === "undefined") {
			return target
		}
		if (typeof Object.getOwnPropertySymbols !== "function") {
			return target
		}

		target = Object(target)
		const length = arguments.length

		for (let i = 1; i < length; i++) {
			const value = Object(arguments[i])
			const names = Object.getOwnPropertySymbols(value)

			for (let j = 0; j < names.length; j++) {
				const name = names[j]

				if (isEnumerable.call(value, name)) {
					target[key] = value[key]
				}
			}
		}

		return target
	}

	function extend(target, object) {
		if (target) {
			extendSymbols(target, object)
		}

		for (let key in object) {
			if (isOwnProperty.call(object, key)) {
				let value = object[key]
				if (typeof value === "object") {
					target[key] = Object.assignDeep(target[key] || {}, value)
				} else {
					target[key] = value
				}
			}
		}

		return target
	}

	target = target || {}

	const length = arguments.length
	if (length === 1) {
		return target
	}

	for (let i = 1; i < length; i++) {
		const value = arguments[i]
		if (target === null || (typeof target !== "function" && typeof target !== "object")) {
			target = value
		}
		if (typeof value === "object" || typeof value === "function") {
			extend(target, value)
		}
	}

	return target
}


function clipboard(format, data) {
	const tmp = document.oncopy;

	document.oncopy = function clipboard_oncopy(e) {
		e.clipboardData.setData(format, data);
		e.preventDefault();
	};
	document.execCommand("copy", false, null);
	alert("Copied to Clipboard");

	document.oncopy = tmp;
}

// http://stackoverflow.com/a/20334744/3022603
function decimals(n) {
	const a = Math.abs(n);
	let x = a;
	let d = 1;

	while (!Number.isInteger(x) && isFinite(x)) {
		x = a * Math.pow(10, d);
		d++;
	}

	return d - 1;
}

function getObjectStack(value, ...keys) {
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i]
		if (value === null || !value.hasOwnProperty(key)) {
			return null
		}

		value = value[key]
	}

	return value
}

function parseQuery(str) {
	if (typeof str !== "string") {
		throw new TypeError("Invalid string provided");
	}

	const a = str.split("&");
	const l = a.length;
	const query = {};

	for (let i = 0; i < l; i++) {
		let b = a[i].split("=");
		query[urldecode(b[0] || "")] = urldecode(b[1] || "");
	}

	return query;
}

// Thanks: http://phpjs.org/functions/mt_rand/
function rand_num(min, max) {
	switch (arguments.length) {
		case 0:
			min = 0;
			max = 2147483647;
		break;

		case 1:
		throw new SyntaxError("0 or 2 parameters required");

		default:
			min = parseInt(min, 10);
			max = parseInt(max, 10);
	}

	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rand_num_float(min, max, precision) {
	const d = Math.max(decimals(min), decimals(max));
	if (typeof precision === "undefined" || precision < 0) {
		precision = d
	}
	const m = Math.pow(10, d + 1);
	const r = rand_num(min * m, max * m);

	return (r / m).toFixed(precision);
}

function run(generator, ...args) {
	// Spread deconstructor not implemented in Chrome
	// i.e. let it = generator(...args);
	let it = generator.apply(this, args);

	function next(err, arg) {
		if (err) {
			it.throw(err);
		}

		let result;
		try {
			result = it.next(arg);
		}
		catch (err) {
			return it.throw(err);
		}

		if (result.done) {
			return arg;
		}
		if (typeof result.value === "function") {
			return result.value(next);
		}

		return setTimeout(next, 10, null, result.value);
	}

	next();
}

function safeJSON(str) {
	try {
		const json = JSON.parse(str);
		if (typeof json === "object" && json !== null) {
			return json;
		}
	}
	catch(e) {}

	return {};
}

function serialize(obj, prefix) {
	let ret = [];

	for (let p in obj) {
		if (obj.hasOwnProperty(p)) {
			let k = (prefix) ? prefix + "[" + p + "]" : p;
			let v = obj[p];

			ret.push(typeof v === "object"
				? serialize(v, k)
				: encodeURIComponent(k) + "=" + encodeURIComponent(v)
			);
		}
	}

	return ret.join("&");
}

function setObjectStack(...args) {
	let value = args.length ? args.pop() : null
	while (args.length) {
		let tmp = {}
		tmp[args.pop()] = value
		value = tmp
	}

	return value
}

function shuffle(array) {
	let m = array.length
	// While there elements to shuffle...
	while (m) {
		// Pick a remaining element…
		let i = Math.floor(Math.random() * m--)
		// And swap it with the current element.
		let t = array[m]
		array[m] = array[i]
		array[i] = t
	}

	return array
}

function sleep(seconds, callback) {
	if (typeof seconds !== "number" || isNaN(seconds) || seconds <= 0) {
		console.warn("Invalid delay provided: " + seconds)
		seconds = 0
	} else {
		console.info(seconds, "second delay")
	}
	setTimeout(callback, seconds * 1000)
}

function sortByIndex(array, index, reverse) {
	if (typeof index === "string") {
		index = [index]
	}

	array.sort((a, b) => {
		let c = a
		let d = b
		index.forEach((key) => {
			if (!c.hasOwnProperty(key)) {
				throw new ReferenceError("A Index was not found: " + index.join("."))
			}
			if (!d.hasOwnProperty(key)) {
				throw new ReferenceError("B Index was not found: " + index.join("."))
			}

			c = c[key]
			d = d[key]
		})

		if (c === d) {
			return 0 // equal
		}
		if (c < d) {
			return (reverse)
				? 1 // a after b
				: -1 // a before b
		}
		return (reverse)
			? -1 // a before b
			: 1 // a after b
	})
}

function str_rand(length) {
	if (typeof length !== "number" || length !== parseInt(length, 10) || length <= 0) {
		throw new SyntaxError("Invalid length provided");
	}

	let ret = [];
	while (length--) {
		let rand = rand_num(0, 61);
		if (rand < 10) {
			rand += 48;
		}
		else if (rand < 36) {
			rand += 55;
		}
		else if (rand < 62) {
			rand += 61;
		}

		ret.push(String.fromCharCode(rand));
	}

	return ret.join("");
}

function ucfirst(str) {
	if (typeof str !== "string") {
		throw new SyntaxError("Invalid string provided");
	}

	return str.charAt(0).toUpperCase() + str.substring(1);
}

function urldecode(str) {
	if (typeof str !== "string") {
		throw new SyntaxError("Invalid string provided");
	}

	str = str.replace(/%(?![\da-f]{2})/gi);
	str = str.replace(/\+/g, "%20");

	return decodeURIComponent(str);
}
