"use strict"
/**
 *
 * @param {Object} [obj]
 * @returns {{description: (*|string), commands: Command[], eid: number, id: (*|number), period: {length: Number, value: (*|string)}}}
 * @constructor
 */
function Alert(obj) {
	const symbol = (obj.sym || ":").split(":")
	const description = obj.desc || ""
	const defaults = {
		a: "*",
		cm: "100%",
		cmo: "oldest",
		e: symbol[0],
		p: 0,
		q: "100%",
		s: symbol[1],
		t: "limit",
		u: "contracts",
		y: "balance",
	}

	/**
	 *
	 * @param {String} raw
	 * @param {Object} [defaults]
	 * @returns {Command[]}
	 */
	function parseRaw(raw, defaults) {
		const lines = raw.split(/[\n|]/)
		let commands = []

		lines.forEach((line) => {
			let command = Command()
			let result = command.parseCommand(line, defaults)

			// Multiple parameters per option is supported externally only
			// Create a (new) command for each of the values (?:1 => 1:1)
			if (command.a instanceof Array) {
				command.a.forEach((account) => {
					let cmd = Object.assign(Command(), command)
					cmd.a = account

					commands.push(cmd)
				})
			}
			else if (result) {
				commands.push(command)
			}
		})

		return commands
	}

	/**
	 * @param {String} str
	 * @returns {{length: Number, value: (*|string)}}
	 */
	function resolution(str) {
		const reg = /^(\d*)(D|W|M)?$/
		const res = reg.exec(str)
		let ret = {
			length: parseInt(res[1] || 0, 10),
			value: res[2] || ""
		}

		if (isNaN(ret.length)) {
			if (ret.value.length > 0) {
				ret.length = 1
			}
			else if (ret.length <= 0) {
				throw new SyntaxError("Invalid resolution: " + str)
			}
		}

		return ret
	}

	return {
		description: description,
		commands: parseRaw(description, defaults),
		eid: obj.aid ? (obj.id || 0) : 0,
		id: obj.aid || obj.id || 0,
		period: resolution(obj.res || "")
	}
}
