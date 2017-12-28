var getMilliseconds = function() {
 if (typeof process === 'undefined') {
   return new Date().getTime();
 }

 var [seconds, nanoseconds] = process.hrtime();
 return seconds * 1e3 +  Math.floor(nanoseconds / 1e6);
}

module.exports = getMilliseconds;
