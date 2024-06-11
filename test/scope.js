const util = require('util');

class AAA {
  a1 = 999;

  test() {
    this.a1++;
    console.log('a1=', this.a1);
  }
  test1() {
    this.a1 = 0;
  }
}

let a = new AAA();

a.test();

a.__proto__ = new Proxy(a.__proto__, {
  get: function (target, prop) {
    console.log('proto get', prop);
    return target[prop];
  },
  set: function (target, prop, value) {
    console.log('proto set', prop, value);
    Reflect.defineProperty(a, prop, { value: value, enumerable: true, writable: true, configurable: true });
  },
});

// util.inspect(a)
console.log('=== 1');
a.test();
console.log('=== 2');
a.test1();
console.log('=== 3');
a.b1 = 9999;
console.log('=== 4');
a.b1 += 100;
a.a1 += 100;
console.log('=== a',JSON.stringify(a));