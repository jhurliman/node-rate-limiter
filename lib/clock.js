var getMilliseconds = function() {
  var tuple = process.hrtime();

  var seconds = tuple[0];
  var nanoseconds = tuple[1];

  return seconds * 1000 + Math.floor(nanoseconds / 1000 / 1000);
};

module.exports = getMilliseconds;
