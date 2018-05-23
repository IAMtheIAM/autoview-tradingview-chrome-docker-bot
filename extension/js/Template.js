"use strict";
window.Template = (function(document) {
	const regex = /{([^{}]+)}/;

	// Format each attribute on the element
	function attributes(element) {
		let attributes = element.attributes || [];
		const l = attributes.length;

		for (let i = 0; i < l; i++) {
			let attribute = attributes[i];

			attribute.value = format.call(this, attribute.value);
		}
	}

	// Pass each element (node) into the callback function
	// Note: This will recursively iterate through the element's entire tree
	function children(element, callback) {
		const childNodes = element.childNodes || [];
		const l = childNodes.length;

		for (let i = 0; i < l; i++) {
			let child = childNodes[i];

			callback(child);
			children(child, callback); // recursive
		}
	}

	// Process the provided element, based on type
	function content(element) {
		switch (element.nodeType) {
			case Node.TEXT_NODE: // 3
			case Node.PROCESSING_INSTRUCTION_NODE: // 7
			case Node.COMMENT_NODE: // 8
				element.nodeValue = format.call(this, element.nodeValue);
		}
	}

	function format(str) {
		if (typeof this.data !== "object") {
			throw new ReferenceError("No instantiated data access.");
		}

		let match;
		while (match = regex.exec(str)) {
			if (this.data.hasOwnProperty(match[1])) {
				str = str.replace(match[0], this.data[match[1]]);
			} else {
				break; // Nothing to do?
			}
		}

		return str;
	}


	// Constructor
	function Template(selector, parentTemplate) {
		this.context = document;
		this.data = {};

		if (parentTemplate instanceof Template) {
			this.data = parentTemplate.data;
			this.context = parentTemplate.content;
		}
		else if (parentTemplate instanceof HTMLElement) {
			this.context = parentTemplate
		}

		this.template = this.context.querySelector(selector);
		if (!this.template) {
			throw new ReferenceError("Template was not found: " + selector);
		}

		this.content = document.importNode(this.template.content, true); // deep copy
	}

	Template.prototype.clone = function(context) {
		context = (context) ? context.nextSibling : this.template;

		children(this.content, attributes.bind(this));
		children(this.content, content.bind(this));

		return context.parentNode.insertBefore(this.content, context);
	}

	return Template;
}(document));
