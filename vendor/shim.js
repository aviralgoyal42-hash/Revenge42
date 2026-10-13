// Minimal shims replacing csTimer's app-level globals, so the vendored
// solver sources run standalone outside the csTimer application.
"use strict";

var DEBUG = false;

var $ = {
	isArray: Array.isArray,
	now: function () { return Date.now(); }
};

// csTimer's scramble registry. Registration is chainable and we ignore it.
var scrMgr = { reg: function reg() { return reg; } };

// Only touched by the last-layer image helpers, never on the solve path.
var image = { llImage: { drawImage: function () {} } };

// scramble_444 calls into the 3x3x3 stage through this name.
//
// These arguments are taken verbatim from TPR-4x4x4-Solver's Search.java:
//
//     String sol = search333.solution(facelet, 21, 1000000, 500, 0);
//
// The last one matters. probeMin = 500 makes min2phase keep searching after
// it finds a solution, so it returns the shortest it saw within 500 probes
// rather than the first one it stumbled on. An earlier version of this shim
// called min2phase.solve(), whose default probeMin is 0, which returns that
// first solution and costs roughly a move. That handicapped the baseline
// this project measures itself against, so it is fixed here.
var scramble_333 = {
	solvFacelet: function (facelet) {
		return new min2phase.Search().solution(facelet, 21, 1000000, 500, 0);
	}
};
