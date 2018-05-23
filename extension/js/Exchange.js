"use strict"
/**
 *
 * @param state
 * @returns {*}
 * @constructor
 */
function Exchange(state) {
	state = state || {}

	function* executeCommand(Command) {
		if (typeof Command !== "object") {
			throw new TypeError("Invalid Command object provided: " + typeof Command)
		}

		// this.setExchangeAccount(Command.a)
		state.account = Command.a

		// Cancel / Close
		switch (Command.c) {
			case "order":
			return yield* this.exchangeOrdersCancelAll(Command)

			case "position":
			return yield* this.exchangePositionsCloseAll(Command)
		}

		// order Type
		switch (Command.t) {
			case "fok": // Fill Or Kill
			case "ioc": // Immediate Or Cancel
			case "limit":
			case "market":
			case "post": // Post Only
			return yield* this.exchangeTrade(Command)
		}

		throw new SyntaxError("Empty Command executed.")
	}

	function getAlias(index) {
		if (state.hasOwnProperty("aliases") && state.aliases.hasOwnProperty(index)) {
			return state.aliases[index]
		}

		return null
	}

	function getAliases() {
		if (!state.hasOwnProperty("aliases")) {
			throw new ReferenceError("Exchange Aliases is not configured.")
		}
		if (!(state.aliases instanceof Array)) {
			throw new TypeError("Invalid Exchange Aliases: " + typeof state.aliases)
		}

		return state.aliases
	}

	function* getCredentials(requiredField) {
		requiredField = requiredField || "public"

		const account = state.account
		if (!account) {
			throw new Error("No Account provided.")
		}

		const permission = yield* hasPermission()
		if (!permission) {
			throw new ReferenceError(this.getExchangeName() + ": Additional permissions required.")
		}

		const subscription = yield* hasSubscription()
		if (!subscription) {
			throw new ReferenceError(this.getExchangeName() + ": An active subscription is required.")
		}

		const alias = getAlias(0)
		const credentials = (yield* Storage("sync").getStorageValue("exchanges", alias)) || {}
		const accounts = Object.keys(credentials)
		if (!credentials || !credentials.hasOwnProperty(account) || !credentials[account].hasOwnProperty(requiredField)) {
			throw new ReferenceError(this.getExchangeName() + " API Account \"" + account + "\" was not found within: " + accounts.join(", "))
		}

		return credentials[account]
	}

	function getFields() {
		if (state.hasOwnProperty("fields")) {
			return state.fields
		}

		throw new ReferenceError("Exchange Fields are not configured.")
	}

	function getName() {
		if (state.hasOwnProperty("name")) {
			return state.name
		}

		throw new ReferenceError("Exchange Name is not configured")
	}

	function getPatterns() {
		return state.hasOwnProperty("patterns") ? state.patterns : []
	}

	function getPermissions() {
		if (state.hasOwnProperty("permissions")) {
			return state.permissions
		}

		throw new ReferenceError("Exchange Permissions are not configured.")
	}

	function getStateProperty(property) {
		switch (property) {
			case "glyphicon":
				if (state.hasOwnProperty(property)) {
					return state[property]
				}
		}

		return null
	}

	function getSubscriptions(key) {
		if (state.hasOwnProperty("subscriptions")) {
			if (arguments.length > 0) {
				if (typeof key !== "string") {
					throw new TypeError("Invalid Subscription key: " + typeof key)
				} else if (!state.subscriptions.hasOwnProperty(key)) {
					throw new ReferenceError("Invalid Subscription key: " + key)
				}

				return state.subscriptions[key]
			}

			return state.subscriptions
		}

		throw new ReferenceError("Exchange Subscriptions are not configured.")
	}

	function getWebsite() {
		if (state.hasOwnProperty("website")) {
			return state.website
		}

		throw new ReferenceError("Exchange Website is not configured.")
	}

	function* hasCredentials() {
		const alias = getAlias(0)
		const credentials = (yield* Storage("sync").getStorageValue("exchanges", alias)) || {}
		const accounts = Object.keys(credentials)

		return accounts.length || 0
	}

	function* hasPermission() {
		const permissions = getPermissions()
		const granted = yield permissions_check.bind(this, permissions)

		return granted
	}

	function* hasSubscription() {
		// List of possible subscriptions
		let subscriptions = getSubscriptions()
		subscriptions = [].concat(subscriptions.active, subscriptions.inactive)
		if (subscriptions.length === 0) {
			return true
		}

		// List of active subscriptions
		let purchases = []
		try {
			const google_payments = (yield* Storage("sync").getStorageValue("permissions", "google_payments")) || false
			if (google_payments) {
				const cws_purchases = yield* inapp().getPurchases()
				purchases = [].concat(purchases, cws_purchases)

				yield* PWP().checkPurchases(purchases)
			}
		} catch (ex) {
			// TODO console.warn("Google", ex.message)
		}
		try {
			const pwp_purchases = yield* PWP().getExchangeSubscriptions()
			purchases = [].concat(purchases, pwp_purchases)
		} catch (ex) {
			// TODO console.warn("Pay with Pink", ex.message)
		}

		// Active subscription within available subscriptions
		for (let i = 0; i < purchases.length; i++) {
			const purchase = purchases[i]
			if (purchase.state === "ACTIVE" && subscriptions.indexOf(purchase.sku) > -1) {
				return true
			}
		}

		return false
	}

	function* overload(func) {
		throw new Error(getName() + "." + func + "() has not been implemented.")
	}

	function* setAccount(account) {
		if (typeof account !== "string") {
			throw new TypeError("Invalid account provided: " + typeof account)
		}

		state.account = account
	}

	function setCredentials(account, obj) {
		if (typeof account !== "string") {
			throw new TypeError("Account was not a string: " + typeof account)
		}
		if (!account.length || !account.trim()) {
			throw new SyntaxError("Account was not provided.")
		}

		let data = {
			account: account,
		}
		for (let field in state.fields) {
			if (state.fields.hasOwnProperty(field)) {
				if (obj.hasOwnProperty(field)) {
					if (typeof obj[field] !== "string") {
						throw new TypeError("Field was not a string: " + typeof obj[field])
					}
					if (!obj[field].length || !obj[field].trim()) {
						throw new SyntaxError("Field was not provided: " + state.fields[field].label)
					}
					data[field] = obj[field].trim()
				}
				else {
					throw new SyntaxError("Field was not provided: " + state.fields[field].label)
				}
			}
		}

		return data
	}

	return Object.assign(
		{},
		// Queue(state),
		// RateLimit(state), // API Throttling
		Request(), // API Calling
		{
			exchangeHasCredentials: hasCredentials,
			exchangeHasPermission: hasPermission,
			exchangeHasSubscription: hasSubscription,
			exchangeOrdersCancelAll: overload.bind(this, "exchangeOrdersCancelAll"),
			exchangePositionsCloseAll: overload.bind(this, "exchangePositionsCloseAll"),
			exchangeTime: overload.bind(this, "exchangeTime"),
			exchangeTrade: overload.bind(this, "exchangeTrade"),
			executeCommand: executeCommand,
			getExchangeAlias: getAlias,
			getExchangeAliases: getAliases,
			getExchangeCredentials: getCredentials,
			getExchangeName: getName,
			getExchangeFields: getFields,
			getExchangeStateProperty: getStateProperty,
			getExchangeTestCommand: () => {
				throw new Error(getName() + ".getExchangeTestCommand() has not been implemented.")
			},
			getExchangePatterns: getPatterns,
			getExchangePermissions: getPermissions,
			getExchangeSubscriptions: getSubscriptions,
			getExchangeWebsite: getWebsite,
			setExchangeAccount: setAccount,
			setExchangeCredentials: setCredentials,
		}
	)
}
