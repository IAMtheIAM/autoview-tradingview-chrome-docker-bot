"use strict"
let state = {}

document.addEventListener("DOMContentLoaded", run.bind(window, init))

function* account_address_update() {
	const address = document.getElementById("address-pinkcoin").value
	const content = document.getElementById("coupons")
	const handle = content.querySelector("h1")

	alerts_remove(content, ".alert") // Clear alerts

	try {
		// Update Account Address
		yield* PWP().setAccountAddress(address)

		alerts_create(handle, "#alert-success", "Referral Address successfully updated.")
	} catch (ex) {
		alerts_create(handle, "#alert-danger", ex.message)
	}
}

function* action_access_create(event) {
	yield* exchange_access.call(this)
}

function* action_access_save(event) {
	let access = {}
	let accounts = []
	const alias = this.getExchangeAlias(0)
	const content = getState(this).content
	let forms = content.querySelectorAll("form")
	let stored = (yield* Storage("sync").getStorageValue(null)) || {}
	let success = true

	yield* elements_remove.call(this, ".alert") // Clear alerts

	for (let i = 0; i < forms.length; i++) {
		let data = form_data(forms[i])
		data.account = data.account.trim().toUpperCase() // uniform

		// Even if saving an existing account fails,
		// prevent it from being removed in the event it does fail
		accounts.push(data.account)

		try {
			if (access.hasOwnProperty(data.account)) {
				throw new ReferenceError("Account already exists: " + data.account)
			}

			data = this.setExchangeCredentials(data.account, data)
			access[data.account] = data
		}
		catch (err) {
			yield* exchange_alert.call(this, "#alert-danger", err.message)
			success = false
		}
	}

	if (stored.hasOwnProperty("exchanges")) {
		if (stored.exchanges.hasOwnProperty(alias)) {
			for (let account in stored.exchanges[alias]) {
				if (stored.exchanges[alias].hasOwnProperty(account)) {
					if (accounts.indexOf(account) === -1) {
						// Filtered out
						yield* Storage("sync").removeStorageValue("exchanges", alias, account)
					}
					else if (!access.hasOwnProperty(account)) {
						// Persist currently existing account (New save failed)
						access[account] = stored.exchanges[alias][account]
					}
				}
			}
		}
	}
	else {
		stored.exchanges = {}
	}
	stored.exchanges[alias] = access

	if (success) {
		yield* Storage("sync").setStorageValue(stored)

		if (stored.hasOwnProperty(alias)) {
			delete stored[alias] // < 1.0.0
		}

		yield* exchange_alert.call(this, "#alert-success", this.getExchangeName() + " successfully saved.")

		setTimeout(run.bind(this, elements_remove.bind(this, ".alert-success")), 5000)  // Clear alert
	}

	return success
}

function* action_access_test(e) {
	const result = yield* action_access_save.call(this, e)
	if (!result) {
		return false
	}

	const form = e.target.closest("form")
	const data = form_data(form)
	const content = getState(this).content
	const handle = content.querySelector("h1")

	yield* elements_remove.call(this, ".alert") // Clear alerts

	try {
		const cmd = this.getExchangeTestCommand()
		cmd.setParameter("a", data.account)

		gaEvent(this.getExchangeName(), "command", "test")

		yield* this.executeCommand(cmd)

		alerts_create(handle, "#alert-success", "API Credentials (" + data.account + ") successfully tested.")
	} catch (ex) {
		alerts_create(handle, "#alert-danger", data.account + ": " + ex.message)
		// TODO Provide additional information for debugging
		ga("send", "exception", ex.message)
	}
}

function* action_access_remove(e) {
	const alias = this.getExchangeAlias(0)
	const element = e.target
	const account = element.dataset.account || ""

	yield* elements_remove.call(this, ".alert") // Clear alerts

	element.closest("form").remove()

	if (account) {
		yield* Storage("sync").removeStorageValue("exchanges", alias, account)
	}
}

function alerts_remove(content, selectorString) {
	const elements = content.querySelectorAll(selectorString)
	for (let i = 0; i < elements.length; i++) {
		elements[i].remove()
	}
}

function alerts_create(content, templateSelector, message) {
	let alert = new Template(templateSelector)
	alert.data.message = message || "(No message provided)"
	alert.clone(content)
}

function click(e) {
	let element = e.target
	let data = element.dataset

	switch (element.nodeName) {
		case "A":
		case "BUTTON":
			// [target='_blank']
			if (element.hasAttribute("target") && element.getAttribute("target") === "_blank") {
				gaEvent("navigation", "external", element.href, true)
				break
			}

			// [data-page='#id']
			if (data.hasOwnProperty("page")) {
				e.preventDefault() // TODO: content #fragment history
				return page_open(data.page)
			}

			// [data-action='function']
			if (data.hasOwnProperty("action")) {
				if (typeof window[data.action] !== "function") {
					throw new SyntaxError("Action not found: " + data.action)
				}

				let callback = window[data.action]

				// ...[data-exchange='alias']
				if (data.hasOwnProperty("exchange")) {
					let Exchange = Broker().getExchangeByAlias(data.exchange) // global
					if (!Exchange) {
						throw new ReferenceError("Exchange Alias was not found: " + data.exchange)
					}

					// Generator - Exchange context
					callback = callback.bind(Exchange)
				}

				// Event relay
				e.preventDefault()
				return run(callback, e)
			}
		break

		case "SPAN":
		case "STRONG":
			e.preventDefault()
			return element.parentNode.click()
	}
}

function coupons_add(coupon) {
	let row = new Template("[rel='coupon']")
	row.data = {}
	row.data["coupon.code"] = coupon.code
	row.data["coupon.description"] = coupon.description || ""
	row.data["coupon.id"] = coupon.coupon
	row.clone()
}

function* coupons_archive(e) {
	const element = e.target
	const data = element.dataset
	const couponId = data.coupon || 0
	const confirmed = confirm("Are you sure you want to archive this coupon?")

	if (confirmed) {
		element.setAttribute("disabled", "disabled")

		const result = yield* PWP().setCouponDeleted(couponId)
		if (result) {
			const row = element.closest("div[class='form-group']")
			row.parentNode.removeChild(row)
		}
	}
}

function* coupons_generate(e) {
	const element = e.target
	const content = document.getElementById("coupon-assigned")
	const handle = document.getElementById("coupon-generation")

	element.setAttribute("disabled", "disabled")

	alerts_remove(content, ".alert") // Clear alerts

	try {
		const coupon = yield* PWP().getNewCoupon()
		coupons_add(coupon)
	} catch (ex) {
		alerts_create(handle, "#alert-danger", ex.message)
	}

	element.removeAttribute("disabled")
}

function* coupons_update(e) {
	const element = e.target
	const data = element.dataset
	const couponId = data.coupon || 0
	const description = document.getElementById("coupon-" + couponId).value
	const content = document.getElementById("coupon-generation")

	element.setAttribute("disabled", "disabled")

	alerts_remove(content.parentNode, ".alert") // Clear alerts

	if (!couponId) {
		throw new Error("Coupon reference not found")
	}

	try {
		// Coupon (description) update
		yield* PWP().setCouponDescription(couponId, description)

		// Alert: Success
		alerts_create(content, "#alert-success", "Coupon description successfully updated.")
	} catch (ex) {
		// Alert: Error
		alerts_create(content, "#alert-danger", ex.message)
	}

	setTimeout(alerts_remove.bind(this, content.parentNode, ".alert"), 5000) // Clear alerts

	element.removeAttribute("disabled")
}

function* elements_remove(selectorString) {
	let elements = getState(this).content.querySelectorAll(selectorString)
	let l = elements.length

	for (let i = 0; i < l; i++) {
		elements[i].remove()
	}
}

function* exchange_init() {
	const exchanges = Broker().getExchanges()
	for (let i = 0; i < exchanges.length; i++) {
		yield* exchange_page.call(exchanges[i])
	}
}

function* exchange_access(account) {
	account = exchange_access_account.call(this, account)
	const alias = this.getExchangeAlias(0)
	let state = getState(this)

	let access = new Template("[rel='exchange-access']", state.content)
	const credentials = (yield* Storage("sync").getStorageValue("exchanges", alias, account)) || {}

	access.data = state.template_data
	access.data["access.#"] = (state.content.getElementsByTagName("form") || []).length
	access.data["access.account"] = account

	let account_field = new Template("[rel='exchange-access-account']", access)
	account_field.data = state.template_data
	account_field.clone()

	const fields = this.getExchangeFields()
	for (let field in fields) {
		if (fields.hasOwnProperty(field)) {
			let access_field = new Template("[rel='exchange-access-field']", access)
			access_field.data["field.label"] = fields[field].label
			access_field.data["field.message"] = fields[field].message
			access_field.data["field.key"] = field
			access_field.data["field.value"] = credentials.hasOwnProperty(field) ? credentials[field] : ""
			access_field.clone()
		}
	}

	access.clone()
}

function exchange_access_account(account) {
	// If no account name was provided...
	if (!account) {
		// ...use the default...
		account = "*"

		let elements = getState(this).content.querySelectorAll("input[name*='account']") || []
		for (let i = 0; i < elements.length; i++) {
			// ...if it is not already in use
			if (elements[i].value.trim() === "*") {
				account = ""
				break
			}
		}
	}

	return account
}

function* exchange_alert(selectorString, message) {
	let alert = new Template(selectorString)
	let state = getState(this)
	let position = state.content.querySelector("h1")
	alert.data = state.template_data
	alert.data.message = message || ""
	alert.clone(position)
}

function* exchange_buttons() {
	let state = getState(this)
	let granted = state.permissions.granted
	let elements = state.content.querySelectorAll(".btn")
	for (let i = 0; i < elements.length; i++) {
		let element = elements[i]

		element.classList.toggle("hide", !granted)
	}
}

function* exchange_fields() {
	if (getState(this).permissions.granted) {
		const alias = this.getExchangeAlias(0)
		const credentials = (yield* Storage("sync").getStorageValue("exchanges", alias)) || {}
		let accounts = Object.keys(credentials)
		if (accounts.length === 0) {
			accounts.push("*")
		}

		for (let i = 0; i < accounts.length; i++) {
			yield* exchange_access.call(this, accounts[i])
		}
	}
	else {
		yield* elements_remove.call(this, "form")
		yield* elements_remove.call(this, "form")
	}
}

function* exchange_page() {
	// TODO Create multi-dimensional variables (e.g. data:name:level-3)
	const id = this.getExchangeAlias(0).toLowerCase()
	let state = getState(this)

	state.content = document.getElementById("exchange-" + id)
	if (!getState(this).content) {
		// Template: Page
		let page = new Template("#exchange-page")
		page.data = state.template_data
		page.clone()

		state.content = document.getElementById("exchange-" + id)

		// Template: Sidebar
		let link = new Template("#exchange-link")
		link.data = state.template_data
		link.clone()
	}

	// Permissions: Check
	yield* exchange_permissions_check.call(this)
}

function* exchange_permissions_check() {
	const hasPermission = yield* this.exchangeHasPermission()
	const hasSubscription = yield* this.exchangeHasSubscription()

	getState(this).permissions.granted = (hasPermission && hasSubscription)

	if (!hasPermission) {
		yield* exchange_alert.call(this, "#alert-permissions-missing")
	} else if (!hasSubscription) {
		yield* exchange_alert.call(this, "#alert-subscription-missing")
	}

	yield* exchange_buttons.call(this)

	yield* exchange_fields.call(this)
}

function* exchange_remove() {
	// Exchange links
	document.querySelectorAll("#exchange-links li").forEach((element) => element.remove())
	// Exchange pages
	document.querySelectorAll("article.exchange-page").forEach((element) => element.remove())

	// Rebuild
	yield* exchange_init()
}

function form_data(form) {
	let ret = {}

	for (let i = 0; i < form.length; i++) {
		let element = form.elements[i]

		switch (element.type) {
			case "button":
			case "submit":
			break

			default:
				if (element.name) {
					let names = element.name.match(/([^\[\]]+)/g)
					let obj = ret

					for (let j = 0; j < names.length; j++) {
						let name = names[j]

						if (!obj.hasOwnProperty(name)) {
							obj[name] = {}
						}
						if ((j + 1) < names.length) {
							obj = obj[name]
						}
						else {
							obj[name] = element.value
						}
					}
				}
		}
	}

	return ret
}

function getState(exchange) {
	const alias = exchange.getExchangeAlias(0)
	if (!state.hasOwnProperty(alias)) {
		state[alias] = {
			content: null,
			permissions: {
				connected: false,
				granted: false
			},
			template_data: {
				"exchange.alias": exchange.getExchangeAlias(0),
				"exchange.id": exchange.getExchangeAlias(0).toLowerCase(),
				"exchange.name": exchange.getExchangeName(),
				"glyphicon" : exchange.getExchangeStateProperty("glyphicon") || "globe",
			}
		}
	}

	return state[alias]
}

function* init() {
	yield page_open("alert-syntax")

	yield* exchange_init()

	yield* settings_init()
	yield* settings_init_methods()

	yield* pwp_init()

	document.addEventListener("click", click)
}

function page_open(id) {
	let pages = document.querySelectorAll("article")
	if (pages.length <= 0) {
		throw new ReferenceError("No pages found.")
	}

	//
	for (let i = pages.length; i--;) {
		let page = pages[i]
		page.classList.toggle("hide", page.id !== id)
	}

	// Deselect all sidebar links
	let elements = document.querySelectorAll("ul.nav li")
	for (let i = 0; i < elements.length; i++) {
		elements[i].classList.remove("active")
	}

	// Activate initiated link
	let element = document.querySelector("[data-page='" + id + "']")
	element.parentNode.classList.add("active")

	const pageName = element.innerText
	gaEvent("navigation", "page", pageName)
}

function* pwp_init() {
	// TODO Nicer asynchronous requests inside generators
	run(function* () {
		try {
			const account = yield* PWP().getAccount()
			document.getElementById("address-pinkcoin").value = account.referral.destination

			const coupons = yield* PWP().getCouponList()
			coupons.forEach(coupons_add)
		} catch (ex) {
			let element
			element = document.getElementById("settings").querySelector(".page-header")
			alerts_create(element, "#alert-danger", ex.message)

			element = document.getElementById("coupons").querySelector(".page-header")
			alerts_create(element, "#alert-danger", ex.message)
		}
	})
}

function* settings_init() {
	let permissions = yield permissions_all
	permissions.origins = permissions.origins || []
	permissions.permissions = permissions.permissions || []
	const parent = document.getElementById("settings-permissions")
	const items = parent.querySelectorAll("li.list-group-item")

	for (let i = 0; i < items.length; i++) {
		const item = items[i]
		const alias = item.dataset.exchange
		const exchange = Broker().getExchangeByAlias(alias)

		let activated = false
		let granted = false
		let subscriptions = []
		if (exchange) {
			activated = yield* exchange.exchangeHasSubscription()
			granted = yield* exchange.exchangeHasPermission()
			subscriptions = exchange.getExchangeSubscriptions("active")
		}

		let buttonGrant = item.querySelector("[name='grant']")
		let buttonRevoke = item.querySelector("[name='revoke']")
		buttonGrant.classList.add("hide")
		buttonRevoke.classList.add("hide")

		if (subscriptions.length) {
			let buttonSubscriptionStart = item.querySelectorAll("[name='subscription-start']")
			let buttonSubscriptionStop = item.querySelectorAll("[name='subscription-stop']")
			buttonSubscriptionStart.forEach((element) => element.classList.add("hide"))
			buttonSubscriptionStop.forEach((element) => element.classList.add("hide"))

			if (granted) {
				if (activated) {
					buttonSubscriptionStop.forEach((element) => element.classList.remove("hide"))
				} else {
					buttonSubscriptionStart.forEach((element) => element.classList.remove("hide"))
				}
			}
		}

		if (granted) {
			buttonRevoke.classList.remove("hide")
		} else {
			buttonGrant.classList.remove("hide")
		}
	}
}

function* settings_init_methods() {
	let permissions = yield* Storage("sync").getStorageValue("permissions")
	permissions.origins = permissions.origins || []
	permissions.permissions = permissions.permissions || []
	const parent = document.getElementById("settings-permissions-methods")
	const items = parent.querySelectorAll("li.list-group-item")

	for (let i = 0; i < items.length; i++) {
		const item = items[i]
		const data = item.dataset
		const granted = permissions.hasOwnProperty(data.permission) && permissions[data.permission]

		let buttonGrant = item.querySelector("[name='grant']")
		let buttonRevoke = item.querySelector("[name='revoke']")
		buttonGrant.classList.add("hide")
		buttonRevoke.classList.add("hide")

		if (granted) {
			buttonRevoke.classList.remove("hide")
		} else {
			buttonGrant.classList.remove("hide")
		}
	}
}

function* settings_permission_request() {
	const permissions = this.getExchangePermissions()
	const granted = yield permissions_request.bind(this, permissions)

	gaEvent("permissions", "request", this.getExchangeName())

	// Refresh
	yield* settings_init()
	yield* exchange_remove()
}

function* settings_permission_request_google() {
	yield* Storage("sync").setStorageValue("permissions", "google_payments", true)

	yield* settings_init()
	yield* settings_init_methods()
}

function* settings_permission_remove() {
	const permissions = this.getExchangePermissions()
	const revoked = yield permissions_remove.bind(this, permissions)

	if (revoked) {
		const alias = this.getExchangeAlias(0)
		yield* Storage("sync").removeStorageValue("exchanges", alias)
	}

	gaEvent("permissions", "remove", this.getExchangeName())

	// Refresh
	yield* settings_init()
	yield* exchange_remove()
}

function* settings_permission_remove_google() {
	yield* Storage("sync").setStorageValue("permissions", "google_payments", false)

	yield* settings_init()
	yield* settings_init_methods()
}

function* settings_subscription_cancel(e) {
	const element = e.target
	const dialog = element.closest("div[role='dialog']")

	$("#" + dialog.id).modal("hide")
}

function* settings_subscription_create(e) {
	const modal = e.target.closest(".modal-dialog")
	const form = modal.querySelector("form")
	const formData = new FormData(form)
	const gateway = formData.get("gateway")
	const func = "subscription_" + gateway
	const content = modal.querySelector(".modal-header")

	alerts_remove(content.parentNode, ".alert") // Clear alerts

	try {
		if (!gateway) {
			throw new Error("Please select a Payment Method")
		}
		if (!window.hasOwnProperty(func) || typeof window[func] !== "function") {
			throw new Error("Gateway function not defined: " + func)
		}

		form.querySelectorAll(".modal-footer .btn-success").forEach((element) => element.setAttribute("disabled", "disabled"))

		return yield* window[func](form)
	} catch (ex) {
		alerts_create(content, "#alert-danger", ex.message)

		form.querySelectorAll(".modal-footer .btn-success").forEach((element) => element.removeAttribute("disabled"))
	}
}

function* settings_subscription_request(e) {
	const element = e.target
	const data = element.dataset
	const sku = data.subscription
	const title = element.title

	gaEvent("subscriptions", "request", this.getExchangeName())

	let subscription = new Template("#exchange-subscription")
	subscription.data["product.id"] = Math.floor(Date.now() / 1000)
	subscription.data["product.name"] = title
	subscription.data["product.sku"] = sku
	subscription.clone()
	$("#subscription-" + subscription.data["product.id"])
		.on("hidden.bs.modal", function() {
			this.parentNode.removeChild(this)
		})
		.modal({
			backdrop: "static",
		})
}

function* subscription_google(form) {
	const element = form.querySelector("[name='gateway'][value='google']")
	const data = element.dataset
	const sku = data.sku

	gaEvent("subscriptions", "request", "google")

	const dialog = element.closest("div[role='dialog']")
	$("#" + dialog.id).modal("hide")

	try {
		const response = yield* inapp().buy(sku)

		if (response.hasOwnProperty("checkoutOrderId")) {
			yield* PWP().validateCheckoutOrder(sku, response.checkoutOrderId)
		}
	} catch (ex) {
		const content = document.getElementById("settings").querySelector("h1")
		alerts_create(content, "#alert-danger", "Google Subscriptions: " + ex.message)
	}
}

function* subscription_paypal(form) {
	const element = form.querySelector("[name='gateway'][value='paypal']")
	const formData = new FormData(form)
	let data = element.dataset
	const market = data.major_currency + "_" + data.minor_currency

	gaEvent("subscriptions", "request", market)

	data.coupon = formData.get("coupon")

	const purchase = yield* PWP().getNewSubscription(data)
	if (!purchase.hasOwnProperty("location") || !purchase.location) {
		throw new Error("No purchase invoice destination received.")
	}

	window.open(purchase.location)

	const dialog = element.closest("div[role='dialog']")
	$("#" + dialog.id).modal("hide")
}

function* subscription_pwp(form) {
	const element = form.querySelector("[name='gateway'][value='pwp']")
	const formData = new FormData(form)
	let data = element.dataset
	const market = data.major_currency + "_" + data.minor_currency

	gaEvent("subscriptions", "request", market)

	data.coupon = formData.get("coupon")

	const purchase = yield* PWP().getNewSubscription(data)
	if (!purchase.hasOwnProperty("location") || !purchase.location) {
		throw new Error("No purchase invoice destination received.")
	}

	window.open(purchase.location)

	const dialog = element.closest("div[role='dialog']")
	$("#" + dialog.id).modal("hide")
}
