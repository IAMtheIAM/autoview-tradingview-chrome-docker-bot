"use strict"
/**
 *
 * @returns {*}
 * @constructor
 */
function OKEX() {
	let state = {
		aliases: [
			"OKEX",
		],
		endpoint: "https://www.okex.com/api/v1/",
		fields: {
			public: {
				label: "API Key",
				message: "",
			},
			private: {
				label: "Secret Key",
				message: "",
			},
		},
		name: "OKEX (beta)",
		patterns: [
			/.+(1W|2W|3M)$/, // e.g. BTCUSD3M
		],
		permissions: {
			origins: [
				"https://*.okex.com/*",
			],
		},
		subscriptions: {
			active: [
				// "meuowjznhxlpgcrvftdikaysqb", // OKEX
				// "mjxvfuicaszpygdlwqetbrnkho", // OKEX - Yearly
			],
			inactive: [],
		},
		website: "https://www.okex.com/",
	}

	function* account(futures) {
		if (futures) {
			const cross = yield* post.call(this, "/future_userinfo.do", {}, true) // Cross-Margin Mode
			const fixed = yield* post.call(this, "/future_userinfo_4fix.do", {}, true) // Fixed-Margin Mode
			let balances = Object.assign({}, cross.info, fixed.info)

			for (let code in balances) {
				if (balances.hasOwnProperty(code)) {
					balances[code] = normalize_futures_balance(balances[code])
				}
			}

			return balances
		}

		const response = yield* post.call(this, "/userinfo.do")
		const account = response.info.funds
		let balances = {}

		for (let code in account.free) {
			if (account.free.hasOwnProperty(code)) {
				balances[code] = normalize_balance(account.free[code])
			}
		}

		if (account.hasOwnProperty("borrow")) {
			for (let code in account.borrow) {
				if (account.borrow.hasOwnProperty(code)) {
					balances[code] = normalize_balance(account.borrow[code], balances[code])
				}
			}
		}

		return balances
	}

	function* get(resource, query, isMarginTrading) {
		resource = state.endpoint + resource.replace(/^\/+/, "")

		return yield* this.getRequest(resource, query, null, "json")
	}

	function normalize_balance(amount, ret) {
		function normalize(amount, balance) {
			amount = Number(amount)
			balance = Number(balance) || 0.0

			return (amount + balance).toFixed(8)
		}

		if (typeof ret === "object") {
			ret.available = normalize(amount, ret.available)
			ret.total = normalize(amount, ret.total)
		}
		else {
			ret = {}
			ret.available = normalize(amount)
			ret.total = normalize(amount)
		}

		return ret
	}

	function normalize_futures_balance(obj) {
		let ret = {}

		if (obj.balance) { // fixed-margin
			// balance, rights
			ret.available = Number(obj.balance).toFixed(8)
			ret.total = Number(obj.rights).toFixed(8)
		}
		else { // cross-margin
			// account_rights, keep_deposit, profit_real, profit_unreal, risk_rate
			ret.available = Number(obj.account_rights).toFixed(8)
			ret.total = Number(obj.account_rights + obj.profit_real).toFixed(8)
		}

		return ret
	}

	function normalize_positions(json) {
		let positions = []

		if (json.hasOwnProperty("holding") && json.holding.length > 0) {
			const flatprice = json.force_liqu_price || 0

			json.holding.forEach((position) => {
				if (position.buy_amount > 0) {
					let tmp = {}
					tmp.amount = position.buy_amount
					tmp.available = position.buy_available
					tmp.bond = position.buy_bond || 0 // Fixed
					tmp.contract_id = position.contract_id
					tmp.contract_type = position.contract_type
					tmp.create_date = position.create_date
					tmp.flatprice = position.buy_flatprice || flatprice // Fixed
					tmp.lever_rate = position.lever_rate
					tmp.price_avg = position.buy_price_avg
					tmp.price_cost = position.buy_price_cost
					tmp.profit_lossratio = position.buy_profit_lossratio || 0 // Fixed
					tmp.profit_real = position.buy_profit_real || 0 // Cross
					tmp.symbol = position.symbol
					tmp.type = 1

					positions.push(tmp)
				}

				if (position.sell_amount > 0) {
					let tmp = {}
					tmp.amount = position.sell_amount
					tmp.available = position.sell_available
					tmp.bond = position.sell_bond || 0 // Fixed
					tmp.contract_id = position.contract_id
					tmp.contract_type = position.contract_type
					tmp.create_date = position.create_date
					tmp.flatprice = position.sell_flatprice || flatprice // Fixed
					tmp.lever_rate = position.lever_rate
					tmp.price_avg = position.sell_price_avg
					tmp.price_cost = position.sell_price_cost
					tmp.profit_lossratio = position.sell_profit_lossratio || 0 // Fixed
					tmp.profit_real = position.sell_profit_real || 0 // Cross
					tmp.symbol = position.symbol
					tmp.type = 2

					positions.push(tmp)
				}
			})
		}

		return positions
	}

	function* ordersCancel(order, contract_type) {
		if (typeof order !== "object") {
			throw new TypeError("Invalid order provided: " + typeof order)
		}

		let params = {}
		params.order_id = order.order_id
		params.symbol = order.symbol

		if (contract_type) {
			params.contract_type = contract_type

			return yield* post.call(this, "/future_cancel.do", params, true)
		}

		return yield* post.call(this, "/cancel_order.do", params)
	}

	function* ordersCancelAll(Command) {
		const pair = symbolPair(Command.s)
		let types = []

		// c=order					[1,2,3,4]
		// c=order t=open			[1,2]
		// c=order t=close			[3,4]x

		// b=long c=order			[1,3]
		// b=long c=order t=open	[1]
		// b=long c=order t=close	[3]

		// b=short c=order			[2,4]
		// b=short c=order t=open	[2]
		// b=short c=order t=close	[4]

		if (Command.b) {
			if (Command.t !== "close") {
				types.push(1 + Command.isAsk)
			}
			if (Command.t !== "open") {
				types.push(3 + Command.isAsk)
			}
		}
		else {
			if (Command.t !== "close") {
				types.push(1, 2)
			}
			if (Command.t !== "open") {
				types.push(3, 4)
			}
		}

		const response = yield* ordersOpen.call(this, pair.symbol, pair.contract_type)
		let orders = response.orders

		orders = orders.filter((order) => {
			if (types.indexOf(order.type) === -1) {
				return false // Order Type mismatch
			}
			if (Command.l && Command.l !== parseInt(order.lever_rate)) {
				return false // Leverage mismatch
			}
			if (Command.fp && Command.fp.compare(order.price_avg)) {
				return false // Price mismatch
			}
			if (Command.d) {
				return false // Disabled
			}

			return true
		})

		// Limit the number of cancelled orders by the requested "Cancel Maximum"
		const end = Command.cm.reference(orders.length).resolve(0)
		if (Command.cm.getMax() < orders.length) {
			switch (Command.cmo) {
				case "newest":
					sortByIndex(orders, "create_date", true)
					break
				case "oldest":
					sortByIndex(orders, "create_date")
					break
				case "lowest":
					sortByIndex(orders, "price_avg")
					break
				case "highest":
					sortByIndex(orders, "price_avg", true)
					break
				case "smallest":
					sortByIndex(orders, "amount")
					break
				case "biggest":
					sortByIndex(orders, "amount", true)
					break
				case "random":
					shuffle(orders)
			}
			orders = orders.slice(0, end)
		}

		for (let i = 0; i < orders.length; i++) {
			yield* ordersCancel.call(this, orders[i], pair.contract_type)
		}
	}

	function* ordersOpen(symbol, contract_type) {
		let params = {}
		let resource = "/order_info.do"
		let isMarginTrading = false

		if (contract_type) {
			params.contract_type = contract_type
			params.current_page = 1 // TODO Pagination?
			params.page_length = 50
			params.status = 1 // 1: unfilled, 2: filled

			resource = "/future_order_info.do"
			isMarginTrading = true
		}

		params.order_id = -1 // All unfilled
		params.symbol = symbol

		return yield* post.call(this, resource, params, isMarginTrading)
	}

	function* positionsClose(Command, position) {
		const pair = symbolPair(Command.s)
		const ticker = yield* symbolTicker.call(this, pair.symbol, pair.contract_type)
		if (!ticker) {
			throw new ReferenceError("Ticker (" + pair.symbol + ", " + pair.contract_type + ") not available.")
		}

		const available_precision = (Command.u === "contracts") ? 0 : 4
		const first = (position.type === 1) ? +ticker.sell : +ticker.buy // opposite book
		let price = Command.p.relative(first).resolve(2)
		if (Command.fp) {
			price = Command.fp.resolve(2)
		}

		let params = {}
		params.amount = Command.q.reference(position.available).resolve(available_precision)
		params.api_key = null
		params.contract_type = position.contract_type
		params.lever_rate = position.lever_rate
		if (Command.t === "market") {
			params.match_price = 1
			//params.price = 1
		}
		else {
			//params.match_price = 0
			params.price = price
		}
		params.symbol = position.symbol
		params.type = (position.type === 1) ? 3 : 4

		return yield* post.call(this, "/future_trade.do", params, true)
	}

	function* positionsCloseAll(Command) {
		const pair = symbolPair(Command.s)
		let positions = yield* positionsOpen.call(this, pair.symbol, pair.contract_type)

		positions = positions.filter((position) => {
			if (position.available == 0) {
				return false // Position allocated
			}

			if (Command.isBid && position.type != 1) {
				return false // Book mismatch
			}
			if (Command.isAsk && position.type != 2) {
				return false // Book mismatch
			}
			if (Command.l && Command.l != position.lever_rate) {
				return false // Leverage mismatch
			}
			if (Command.d) {
				return false // Disabled
			}

			return true
		})

		// Limit the number of closed positions by the requested "Close Maximum"
		const end = Command.cm.reference(positions.length).resolve(0)
		if (Command.cm.getMax() < positions.length) {
			switch (Command.cmo) {
				case "newest":
					sortByIndex(positions, "create_date", true)
					break
				case "oldest":
					sortByIndex(positions, "create_date")
					break
				case "lowest":
					sortByIndex(positions, "price_avg")
					break
				case "highest":
					sortByIndex(positions, "price_avg", true)
					break
				case "smallest":
					sortByIndex(positions, "amount")
					break
				case "biggest":
					sortByIndex(positions, "amount", true)
					break
				case "random":
					shuffle(positions)
			}
			positions = positions.slice(0, end)
		}

		for (let i = 0; i < positions.length; i++) {
			yield* positionsClose.call(this, Command, positions[i])
		}
	}

	function* positionsOpen(symbol, contract_type) {
		let params = {}
		params.contract_type = contract_type
		params.symbol = symbol

		let cross = yield* post.call(this, "/future_position.do", params, true)
		cross = normalize_positions(cross)

		params.type = 1
		let fixed = yield* post.call(this, "/future_position_4fix.do", params, true)
		fixed = normalize_positions(fixed)

		let positions = [].concat(cross, fixed)

		return positions
	}

	function* post(resource, parameters, isMarginTrading) {
		resource = state.endpoint + resource.replace(/^\/+/, "")
		parameters = parameters || {}
		parameters = Object.assign({}, parameters) // Detach reference

		const credentials = yield* this.getExchangeCredentials("private")
		parameters.api_key = credentials.public

		const signature = () => {
			if (typeof md5 !== "function") {
				throw new Error("MD5 not supported")
			}

			let signature = []
			Object.keys(parameters).sort().forEach((key) => {
				signature.push(key + "=" + parameters[key])
			})
			signature.push("secret_key=" + credentials.private)
			signature = signature.join("&").replace("%2C", ",")

			return md5(signature).toUpperCase()
		}
		parameters.sign = signature()

		let headers = {}
		headers["Content-Type"] = "application/x-www-form-urlencoded"

		const response = yield* this.postRequest(resource, parameters, headers, "json")
		if (!response.hasOwnProperty("result") || !response.result) {
			switch (response.error_code) {
				case 20022: // Wrong API interface (cross, fixed)
					return {}
			}

			if (!state.hasOwnProperty("error_strings")) {
				const resource = chrome.runtime.getURL("/cache/okex/api_errors.json")
				state.error_strings = yield* this.getRequest(resource, null, null, "json")
			}

			if (state.error_strings.hasOwnProperty(response.error_code)) {
				throw new Error("#" + response.error_code + ": " + state.error_strings[response.error_code])
			}

			throw new Error(this.getExchangeName() + " unexpected response: #" + response.error_code)
		}

		return response
	}

	function symbolPair(symbol) {
		// Fiat to Token, Token Trading
		const regexpA = /^(.+?)[-_/]?(BCH|BTC|CNY|ETH|USD|USDT)$/i
		// Futures
		const regexpB = /^(BCH|BTC|ETC|ETH|LTC)[-_/]?(CNY|USD)(1W|2W|3M)$/i
		const result = regexpA.exec(symbol) || regexpB.exec(symbol)
		let so = {}

		if (!result) {
			throw new Error("Unknown market symbol: " + symbol)
		}

		so.contract_type = null
		so.main = result ? result[2] : ""
		so.pair = result ? result[1] : ""

		if (result[3]) {
			switch (result[3]) {
				case "1W":
					so.contract_type = "this_week"
					break
				case "2W":
					so.contract_type = "next_week"
					break
				case "3M":
					so.contract_type = "quarter"
					break

				default:
					throw new Error("Market symbol is not supported: " + symbol)
			}
		}

		so.precision = 4
		so.symbol = so.pair.toLowerCase() + "_" + so.main.toLowerCase()

		return so
	}

	function* symbolTicker(symbol, contract_type) {
		let query = {}
		query.symbol = symbol

		if (contract_type) {
			query.contract_type = contract_type

			const response = yield* get.call(this, "/future_ticker.do", query, true)
			let ticker = response.ticker
			ticker.per_contract = (Number(ticker.unit_amount) / Number(ticker.last)).toFixed(8)
			ticker.timestamp = response.date

			return ticker
		}

		const response = yield* get.call(this, "/ticker.do", query)
		let ticker = response.ticker
		ticker.timestamp = response.date

		return ticker
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=long q=1%",
			sym: this.getExchangeAlias() + ":BTCUSD1W"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* trade(Command) {
		const pair = symbolPair(Command.s)
		const balances = yield* account.call(this, Command.isMarginTrading)
		const currency = pair.pair.toLowerCase()
		if (!balances.hasOwnProperty(currency)) {
			throw new ReferenceError("Account Balance (" + currency + ") not available.")
		}

		let balance = balances[currency]
		balance = (Command.y === "equity") ? balance.total : balance.available

		const ticker = yield* symbolTicker.call(this, pair.symbol, pair.contract_type)
		if (!ticker) {
			throw new ReferenceError("Ticker (" + pair.symbol + ", " + pair.contract_type + ") not available.")
		}
		const first = Number(Command.isBid ? ticker.buy : ticker.sell)

		Command.p.relative(first)

		if (Command.isMarginTrading) {
			const leverage = Command.l || 10
			let price = Command.p.resolve(2)
			if (Command.fp) {
				price = Command.fp.resolve(2)
			}
			let amount = (balance * leverage).toFixed(8)
			let amount_precision = 4
			if (Command.u === "contracts") {
				amount = Math.floor(amount / ticker.per_contract)
				amount_precision = 0
			}

			let params = {}
			params.amount = Command.q.reference(amount).resolve(amount_precision)
			params.api_key = null
			params.contract_type = pair.contract_type
			params.lever_rate = leverage
			if (Command.t === "market") {
				params.match_price = 1
				//params.price = 1
			} else {
				//params.match_price = 0
				params.price = price
			}
			params.symbol = pair.symbol
			params.type = Command.isBid ? 1 : 2

			if (Command.d) {
				console.log(this.getExchangeName(), params)
				return false // Disabled
			}

			return yield* post.call(this, "/future_trade.do", params, true)
		} else {
			let price = Command.p.resolve(8)
			if (Command.fp) {
				price = Command.fp.resolve(8)
			}

			let params = {}
			params.amount = Command.q.reference(balance).resolve(8)
			params.api_key = null
			params.type = Command.isBid ? "buy" : "sell"
			if (Command.t === "market") {
				// params.price = params.amount
				params.type += "_market"
			} else {
				params.price = price
			}
			params.symbol = pair.symbol

			if (Command.d) {
				console.log(this.getExchangeName(), params)
				return false // Disabled
			}

			return yield* post.call(this, "/trade.do", params)
		}
	}


	return Object.assign(
		{},
		Exchange(state),
		{
			exchangeOrdersCancelAll: ordersCancelAll,
			exchangePositionsCloseAll: positionsCloseAll,
			exchangeTrade: trade,
			getExchangeTestCommand: testCommand,
		}
	)
}
