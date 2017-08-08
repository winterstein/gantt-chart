
import C from '../C.js';
import _ from 'lodash';
import {assert,assMatch} from 'sjtest';
import {yessy, getUrlVars, parseHash, modifyHash, toTitleCase} from 'wwutils';

/**
 * Hold data in a simple json tree, and provide some utility methods to update it - and to attach a listener.
 * E.g. in a top-of-the-app React container, you might do `DataStore.addListener((mystate) => this.setState(mystate));`
 */
class Store {	

	constructor() {
		this.callbacks = [];
		// init the "canonical" categories		
		this.appstate = {
			data:{}, 
			/** 
			 * What are you looking at? 
			 * This is for transient focus. It is NOT for navigation parameters
			 *  -- location and getUrlValue() are better for navigational focus.
			*/
			focus:{}, 
			/** e.g. form settings */
			widget:{}, 
			/**
			 * nav state, stored in the url (this gives nice shareable deep-linking urls)
			 */
			location:{}, 
			misc:{}
		};
		// init url vars
		this.parseUrlVars(window.location);
		// and listen to changes
		window.addEventListener('hashchange', e => {
			console.warn("hash change - update DataStore", window.location);
			this.parseUrlVars(window.location);
			return true;
		});
	}

	/**
	 * Keep navigation state in the url, after the hash, so we have shareable urls.
	 * To set a nav variable, use setUrlValue(key, value);
	 */
	parseUrlVars(url) {		
		let {path, params} = parseHash();
		// peel off eg publisher/myblog		
		let location = {};
		location.path = path;
		let page = path? path[0] : null;
		if (page) {
			// page/slug? DEPRECATED If so, store in DataStore focus
			const ptype = toTitleCase(page); // hack publisher -> Publisher			
			this.setValue(['focus', ptype], path[1]);			
		}
		location.page = page;
		if (path.length > 2) location.slug = path[1];
		if (path.length > 3) location.subslug = path[2];		
		location.params = params;
		this.update({location});
	}

	/**
	 * Set a key=value in the url for navigation. This modifies the window.location and DataStore.appstore.location.params, and does an update.
	 * @param {String} key 
	 * @param {String} value 
	 */
	setUrlValue(key, value) {
		assMatch(key, String);
		if (value) assMatch(value, "String|Boolean|Number");
		// update the url
		let newParams = {};
		newParams[key] = value;
		modifyHash(null, newParams);
		// update the datastore
		DataStore.setValue(['location', 'params', key], value);
	}

	/**
	 * Convenience for appstate.location.params.key. This is to match setUrlValue.
	 * @param {String} key 
	 */
	getUrlValue(key) {
		assMatch(key, String);
		return DataStore.getValue(['location', 'params', key]);
	}

	/**
	 * It is a good idea to wrap your callback in _.debounce()
	 */
	addListener(callback) {
		this.callbacks.push(callback);
	}

	/**
	 * Update and trigger the on-update callbacks.
	 * @param newState {?Object} This will do an overwrite merge with the existing state.
	 * Note: This means you cannot delete/clear an object using this - use direct modification instead.
	 * Can be null, which still triggers the on-update callbacks.
	 */
	update(newState) {
		console.log('update', newState);
		if (newState) {
			_.merge(this.appstate, newState);
		}
		this.callbacks.forEach(fn => fn(this.appstate));
	}

	/**
	 * Convenience for getting from the data sub-node (as opposed to e.g. focus or misc) of the state tree.
	 * type, id
	 * @returns a "data-item", such as a person or document, or undefined.
	 */
	getData(type, id) {
		assert(C.TYPES.has(type));
		assert(id, type);
		return this.appstate.data[type][id];
	}

	getValue(...path) {
		assert(_.isArray(path), path);
		// If a path array was passed in, use it correctly.
		if (path.length===1 && _.isArray(path[0])) {
			path = path[0];
		}
		assert(this.appstate[path[0]], 
			path[0]+" is not a node in appstate - As a safety check against errors, the root node must already exist to use getValue()");		
		let tip = this.appstate;
		for(let pi=0; pi < path.length; pi++) {
			let pkey = path[pi];			
			assert(pkey || pkey===0, path); // no falsy in a path - except that 0 is a valid key
			let newTip = tip[pkey];
			// Test for hard null -- falsy are valid values
			if (newTip===null || newTip===undefined) return null;
			tip = newTip;
		}
		return tip;
	}

	/**
	 * Update a single path=value.
	 * 
	 * Unlike update(), this can set {} or null values.
	 * 
	 * It also has a hack, where edits to [data, type, id, ...] (i.e. edits to data items) will
	 * also set the modified flag, [data, type, id, modified] = true.
	 * This is a total hack, but handy.
	 * 
	 * @param {String[]} path This path will be created if it doesn't exist (except if value===null)
	 * @param {*} value 
	 * @param {boolean} update Set to false to switch off sending out an update
	 */
	// TODO handle setValue(pathbit, pathbit, pathbit, value) too
	setValue(path, value, update = true) {
		assert(_.isArray(path), path+" is not an array.");
		assert(this.appstate[path[0]], 
			path[0]+" is not a node in appstate - As a safety check against errors, the root node must already exist to use setValue()");
		// console.log('DataStore.setValue', path, value);
		let tip = this.appstate;
		for(let pi=0; pi < path.length; pi++) {
			let pkey = path[pi];
			if (pi === path.length-1) {
				tip[pkey] = value;
				break;
			}
			assert(pkey || pkey===0, "falsy in path "+path.join(" -> ")); // no falsy in a path - except that 0 is a valid key
			let newTip = tip[pkey];
			if ( ! newTip) {
				if (value===null) {
					// don't make path for null values
					return;
				}
				newTip = tip[pkey] = {};
			}
			tip = newTip;
		}
		// HACK: update a data value => mark it as modified
		if (path[0] === 'data' && path.length > 3 && DataStore.DATA_MODIFIED_PROPERTY) {
			// chop path down to [data, type, id]
			let modPath = path.slice(0, 3).concat(DataStore.DATA_MODIFIED_PROPERTY);
			// avoid infinite loopyness
			if ( ! _.isEqual(path, modPath)) {
				this.setValue(modPath, true, false);
			}
		}
		if (update) {
			this.update();
		}
	}

	/**
	* Set widget.thing.show
	 * @param {String} thing The name of the widget.
	 * @param {Boolean} showing 
	 */
	setShow(thing, showing) {
		assMatch(thing, String);
		this.setValue(['widget', thing, 'show'], showing);
	}

	/**
	 * Convenience for widget.thing.show
	 * @param {String} widgetName 
	 * @returns {boolean} true if widget is set to show
	 */
	getShow(widgetName) {
		assMatch(widgetName, String);
		return this.getValue('widget', widgetName, 'show');
	}


	/**
	 * Get hits from the cargo, and store them under data.type.id
	 * @param {*} res 
	 */
	updateFromServer(res) {
		console.log("updateFromServer", res);
		if ( ! res.cargo) {			
			return res; // return for chaining .then()
		}
		// must be bound to the store
		assert(this && this.appstate, "Use with .bind(DataStore)");
		let hits = res.cargo && res.cargo.hits;
		if ( ! hits && res.cargo) {			
			hits = [res.cargo]; // just the one?
		}
		let itemstate = {data:{}};
		hits.forEach(item => {
			try {
				let type = getType(item);
				if ( ! type) {
					// 
					console.log("skip server object", item);
					return;
				}
				assert(C.TYPES.has(type), item);
				let typemap = itemstate.data[type];
				if ( ! typemap) {
					typemap = {};
					itemstate.data[type] = typemap;
				}
				if (item.id) {
					typemap[item.id] = item;
				} else if (item["@id"]) {
					// bleurgh, thing.org style ids -- which are asking for trouble :(
					typemap[item["@id"]] = item;
				} else {
					console.warn("No id?!", item, "from", res);
				}
			} catch(err) {
				// swallow and carry on
				console.error(err);
			}
		});
		this.update(itemstate);
		return res;
	}

} // ./Store

const getType = (item) => item && item['@type'];

const DataStore = new Store();
// switch on data item edits => modified flag
DataStore.DATA_MODIFIED_PROPERTY = 'modified';
export default DataStore;
// accessible to debug
if (typeof(window) !== 'undefined') window.DataStore = DataStore;

/**
 * Store all the state in one big object??
 */
DataStore.update({
	data: {
		Charity: {},
		User: {}
	},
	draft: {
		Charity: {},
		User: {}
	},
	focus: {
		Charity: null,
		User: null,
	},	
	widget: {},
	misc: {
	},
	/** status of server requests, for displaying 'loading' spinners 
	 * Normally: transient.$item_id.status
	*/
	transient: {}
});
