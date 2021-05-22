console.log(' ### Sample - rateLimiter with promise')

var RateLimiter = require('../index.js').RateLimiter;
// from outside the module, you have to use:
// var RateLimiter = require('limiter').RateLimiter;

const MAX_PER_SECONDS=10;

console.log(`new RateLimiter(${MAX_PER_SECONDS}, 'second')`)
const limiter = new RateLimiter(MAX_PER_SECONDS, 'second');

var nbDoneAll = 0;
var nbDone = 0;

function waitDone(nbDone, expected) {
  do {}
  while (nbDone<expected);
}

function businessCode(extra) {
  nbDone++;nbDoneAll++;
  // console.log(`${nbDone} : businessCode(${extra})`);
  return Promise.resolve("RESULT:"+extra);
}


function asyncRemoveTokens(count) {// hurliman/node-rate-limiter/issues/63 by sunknudsen
  return new Promise((resolve, reject) => {
    limiter.removeTokens(count, (error, remainingRequests) => {
      if (error) return reject(error)
      resolve(remainingRequests)
    })
  })
}

async function limitedCallPromiseWithResult(extra) {
  await asyncRemoveTokens(1)
  .then((remainingRequests) => {
    businessCode(extra)
     .then((result)=>console.log("PromiseWithResult==>" + result));
  })
  .catch((limiterErr) => {
    console.log("PromiseWithResult error==>" + limiterErr);
  });
}

var nbDone = 0;
const start = new Date();

async function countEachSecond() {
  if (nbDone < 0) {
    return;
  }
  const duration = new Date() - start;
  console.log(`duration: ${duration}ms => ${nbDone} / ${nbDoneAll}`)
  nbDone = 0;
  setTimeout(countEachSecond, 1000);
}

async function testPromise() {
  await countEachSecond();
  for (var i=0;i<200;i++) {
       await limitedCallPromiseWithResult("promiseWithResult"+i);
  }
  const duration = new Date() - start;
  console.log(`duration: ${duration}ms ${nbDone} / ${nbDoneAll}`);
  nbDone = -1;
}


testPromise();