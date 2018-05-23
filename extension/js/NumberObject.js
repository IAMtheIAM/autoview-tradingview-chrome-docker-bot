"use strict"
/**
 *
 * @param {String} str
 * @returns {*}
 * @constructor
 */
function NumberObject(str) {
	// e.g. -10, 10%, 10-20%
	const reg = /^(-?(?:\d+|\d*\.\d+))(%)?(?:-(-?(?:\d+|\d*\.\d+))(%)?)?$/
	const res = reg.exec("" + str) || []

	let state = {}
	state.isPercent = Boolean(res[2] || res[4])
	state.isRange = typeof res[3] !== "undefined"
	state.min = Number(res[1]) || 0
	state.max = state.isRange ? Number(res[3]) : state.min

	// Silently correct high-low scenario
	if (state.max < state.min) {
		const tmp = state.max
		state.max = state.min
		state.min = tmp
	}

	if (state.isPercent) {
		// int => float
		state.min /= 100
		state.max /= 100
	}

	function perform(action, x) {
		x = validateNumber(x)

		switch (action) {
			case "/":
				state.min /= x
				state.max /= x
				break
			case "*":
				state.min *= x
				state.max *= x
				break
			case "+":
				state.min += x
				state.max += x
				break
			case "-":
				state.min -= x
				state.max -= x
				break
			case "<":
				if (state.max > x) {
					state.max = x
					state.min = Math.min(state.min, x)
				}
				break
			case ">":
				if (state.min < x) {
					state.max = Math.max(state.max, x)
					state.min = x
				}
				break
		}

		return self
	}

	function validateNumber(x) {
		const n = Number(x)
		if (isNaN(n)) {
			throw new TypeError("Invalid number provided: " + typeof x + " " + x)
		}
		return n
	}

	const self = {
		add: (x) => perform("+", x),
		compare: (x) => {
			x = validateNumber(x)

			if (x < state.min) {
				return -1
			}
			if (x > state.max) {
				return 1
			}
			return 0 // Within range
		},
		div: (x) => perform("/", x),
		getMax: () => state.max,
		getMin: () => state.min,
		getIsPercent: () => state.isPercent,
		highest: (x) => perform("<", x),
		lowest: (x) => perform(">", x),
		mul: (x) => perform("*", x),
		reference: (x) => {
			if (state.isPercent) {
				self.mul(x)
			}
			self.highest(x)

			return self
		},
		relative: (x) => {
			if (state.isPercent) {
				self.mul(x)
			}
			self.add(x)

			return self
		},
		reset: () => NumberObject(str),
		resolve: (precision) => {
			if (typeof precision === "undefined") {
				precision = 2
			} else if (typeof precision !== "number") {
				throw new TypeError("Invalid precision provided: " + typeof precision)
			}

			const decimals = Math.max(0, parseInt(precision, 10))
			const stepping = precision - decimals
			let result = state.isRange
				? rand_num_float(state.min, state.max, decimals)
				: state.max.toFixed(decimals)

			if (stepping) {
				// Round down to ensure sufficient funds
				result = (Math.floor(result / stepping) * stepping).toFixed(decimals)
			}

			return result
		},
		sub: (x) => perform("-", x)
	}

	return self
}
