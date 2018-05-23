"use strict"
/**
 *
 * @param {String} [raw]
 * @returns {*}
 * @constructor
 */
function Command(raw) {
	const parameters = {
		a: "Account",
		b: "Book",
		c: "Cancel / Close",
		cm: "Cancel / Close Maximum",
		cmo: "Cancel / Close Maximum Order",
		d: "Disabled",
		delay: "Delay",
		e: "Exchange",
		fp: "Fixed Price",
		h: "Hidden/Iceberg",
		l: "Leverage",
		p: "Price",
		q: "Quantity",
		s: "Symbol",
		shared: "Shared",
		sl: "Stop Loss",
		t: "order Type",
		tp: "Take Profit",
		ts: "Trailing Stop",
		u: "Unit",
		v: "Version",
		y: "Yield",
	}

	function normalize() {
		if (this.a && this.a.indexOf(",") > -1) {
			this.a = this.a.split(",")
		}

		if (this.b) {
			this.isAsk = false
			this.isBid = false
			this.isMarginTrading = false

			switch (this.b) {
				case "long":
					this.isMarginTrading = true
				case "bid":
				case "buy":
					this.isBid = true
					break

				case "short":
					this.isMarginTrading = true
				case "ask":
				case "sell":
					this.isAsk = true
			}
		}
	}

	function parse(str, defaults) {
		if (typeof str !== "string") {
			throw new TypeError("Expecting parameter 1 to be a string: " + typeof str)
		}
		if (typeof defaults !== "object") {
			defaults = {}
		}

		const params = Object.assign({}, defaults) // detach reference
		const reg = /(?:^|\s)([a-z]+)=([^\s]+)/g

		if (!reg.test(str)) {
			return false // Invalid syntax
		}
		reg.lastIndex = 0 // Reset from .test()

		let match
		while (match = reg.exec(str)) {
			params[match[1]] = match[2]
		}

		for (const p in params) {
			if (!params.hasOwnProperty(p) || !parameters.hasOwnProperty(p)) {
				continue // Invalid parameter
			}

			set.call(this, p, params[p])
			normalize.call(this)
		}

		return true
	}

	/**
	 *
	 * @param p
	 * @param value
	 */
	function set(p, value) {
		switch (p) {
			// String, lowercase
			case "b":
			case "c":
			case "cmo":
			case "t":
			case "u":
			case "v":
				this[p] = value.toLowerCase()
				break

			// Boolean
			case "d":
			case "shared":
				this[p] = value === "1"
				break

			// String, uppercase
			case "a":
			case "e":
			case "s":
				this[p] = value.toUpperCase()
				break

			// Numeric
			case "l":
				this[p] = Number(value)
				break

			// Number / Percent
			case "cm":
			case "delay":
			case "fp":
			case "h":
			case "p":
			case "q":
			case "sl":
			case "tp":
			case "ts":
				this[p] = NumberObject(value)
				break

			// Relay
			default:
				this[p] = value
		}
	}


	const self = {
		getCommandParameters: parameters,
		isAsk: false,
		isBid: false,
		isMarginTrading: false,
		parseCommand: parse,
		setParameter: set,
	}

	if (raw) {
		self.parseCommand(raw)
	}

	return self
}
