/** 
 * Wrapper for server calls.
 *
 */
import _ from 'lodash';
import $ from 'jquery';
import {SJTest, assert, assMatch} from 'sjtest';
import C from '../C.js';

import Login from 'you-again';

const ServerIO = {};
export default ServerIO;

// for debug
window.ServerIO = ServerIO;
