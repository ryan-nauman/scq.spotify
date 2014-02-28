window.g = {};

g.debug = false;

g.cnt = 0;
g.qlen = 0;
g.q = [];
g.ctx = null;
g.idx = null;
g.qlist = null;
g.firstPlay = false;
g.mode = 2;

g.temp = null;

String.prototype.paddingLeft = function (paddingValue) {
   return String(paddingValue + this).slice(-paddingValue.length);
};