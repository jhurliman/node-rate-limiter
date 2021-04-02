console.log(' ### Sample 1 - rateLimiter')

var RateLimiter = require('../index.js').RateLimiter;
// from outside the module, you have to use:
// var RateLimiter = require('limiter').RateLimiter;

const MAX_PER_SECONDS=5;

console.log(`new RateLimiter(${MAX_PER_SECONDS}, 'second')`)
const limiter = new RateLimiter(MAX_PER_SECONDS, 'second');

var nbDone = 0;

function waitDone(nbDone, expected) {
  do {}
  while (nbDone<expected);
}

function businessCode(extra) {
  nbDone++;
  console.log(`${nbDone} : businessCode(${extra})`);
  return "CODE RESULT:"+extra;
}

function limitedCall(extra) {
    // Throttle requests
    var result = limiter.removeTokens(1, function(err, remainingRequests) {
      // err will only be set if we request more than the maximum number of
      // requests we set in the constructor

      // remainingRequests tells us how many additional requests could be sent
      // right this moment
      console.log(`limitedCall(${extra}) err=${err} remainingRequests=${remainingRequests}`)
      businessCode(extra);
    });
    console.log("limited==>"+ result);
}

function blockingRemoveToken(count, businessCallback) {
    do {}
    while (!limiter.tryRemoveTokens(count));
    return businessCallback();
}

async function limitedCallBlockingWaitWithResult(extra) {
  var result = await blockingRemoveToken(1, ()=>businessCode(extra));
  console.log("BlockingWaitWithResult==>"+result);
}

function asyncRemoveTokens(count) {// hurliman/node-rate-limiter/issues/63 by sunknudsen
  return new Promise((resolve, reject) => {
    limiter.removeTokens(count, (error, remainingRequests) => {
      if (error) return reject(error)
      resolve(remainingRequests)
    })
  })
}

function limitedCallPromiseWithResult(extra) {
  asyncRemoveTokens(1)
  .then((remainingRequests) => {
    console.log("PromiseWithResult==>" + businessCode(extra));
  })
  .catch((limiterErr) => {
    console.log("PromiseWithResult error==>" + limiterErr);
  });
}

console.log("--------no-rate-limit----------------------------");
for (var i=0;i<10;i++)
     businessCode("business"+i);

console.log("--------limited-call-wait------------------------");
for (var i=0;i<10;i++)
     limitedCall("limited"+i);

console.log("--------limited-call-blocking-wait-with-result---");
for (var i=0;i<10;i++)
     limitedCallBlockingWaitWithResult("blockingWaitWithResult"+i);

console.log("--------limited-call-promise-with-result---------");
for (var i=0;i<10;i++)
     limitedCallPromiseWithResult("promiseWithResult"+i);
