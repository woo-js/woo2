/// <reference types="cypress" />
import { WorkerScope, SymObjectObserver, SymScopeProto } from '../../../src/worker/workerScope.ts';
import { Defer } from '../utils.ts';

describe('WorkScope作用域', () => {
  let scope: WorkerScope;
  beforeEach(() => {
    cy.visit('/dev/index.html');
    localStorage.__DEV = {};
  });

  it('从类创建scope', () => {
    scope = new WorkerScope(
      'cid-test',
      class {
        a = 1;
      }
    );

    cy.log('scope 1', scope.$rootScope);
    cy.wrap(scope.$rootScope).then(() => {
      // 确认对象属性为get/set
      expect(scope.$rootScope, '检测属性转换为get/set').ownPropertyDescriptor('a').include.keys('get', 'set');
    });
  });

  context('依赖变更直接属性', () => {
    it('scope直接属性赋值触发回调', async () => {
      let defer = new Defer();
      let ret = scope.traceCall(
        'test-call-01',
        () => {
          return scope.$rootScope.a;
        },
        v=>defer.resolve(v)
      );

      cy.log('初始化变量: a=', ret);
      cy.wrap(scope.$rootScope).then(() => {
        scope.$rootScope.a = 2;
      });
      cy.wrap(defer.promise).then(() => {
        expect(scope.$rootScope.a, `获取变量执行结果=2, 耗时:${defer.duration}`).to.be.eq(2);
      });
    });

    it('scope监控不存在属性,当后续赋值时应能监控到变更', () => {
      let defer = new Defer();
      let ret = scope.traceCall(
        'test-call-02',
        () => {
          // debugger
          return scope.$rootScope.b;
        },
        v=>defer.resolve(v)
      );

      cy.log('初始化变量: b=', ret);
      cy.wrap(scope.$rootScope).then(() => {
        scope.$rootScope.b = 99;
      });
      cy.log('scope= ', scope.$rootScope);
      cy.wrap(defer.promise).then(() => {
        expect(scope.$rootScope.b, `获取变量执行结果=99, 耗时:${defer.duration}`).to.be.eq(99);
      });
    });

  });

  context('添加和更改对象', () => {
    it('scope添加对象obj1,标准流程,先添加，再跟踪，再变更', () => {
      let defer = new Defer();

      cy.wrap(scope.$rootScope).then(() => {
        // debugger
        scope.$rootScope.obj1 = {};
        cy.log('增加新对象-obj1', scope.$rootScope.obj1);
        scope.traceCall(
          'test-call-obj2',
          () => {
            return scope.$rootScope.obj1;
          },
          v=>defer.resolve(v)
        );

        // 确定对象属性为get/set
        expect(scope.$rootScope, '检测属性转换为get/set').ownPropertyDescriptor('obj1').include.keys('get', 'set');
      });

      cy.wrap(scope.$rootScope).then(() => {
        cy.log('修改obj1');
        scope.$rootScope.obj1 = { a: 1, b: 2, c: 3 };
      });

      cy.wrap(defer.promise).then(() => {
        expect(scope.$rootScope.obj1.a, `获取obj1执行结果, 耗时:${defer.duration}`).to.be.eq(1);
      });
    });

    it('scope添加对象obj2,先跟踪，再添加', () => {
      let defer = new Defer();
      cy.wrap(scope.$rootScope).then(() => {
        // debugger
        cy.log('增加新对象-obj2', scope.$rootScope.obj2);
        scope.traceCall(
          'test-call-obj2',
          () => {
            return scope.$rootScope.obj2;
          },
          v=>defer.resolve(v)
        );

        // 确定对象属性为get/set
        expect(scope.$rootScope, '检测属性转换为get/set').ownPropertyDescriptor('obj2').include.keys('get', 'set');
      });

      cy.wrap(scope.$rootScope).then(() => {
        cy.log('修改obj2');
        scope.$rootScope.obj2 = { a: 1, b: 2, c: 3 };
      });

      cy.wrap(defer.promise).then((v:any) => {
        expect(v.a, `获取obj2执行结果, 耗时:${defer.duration}`).to.be.eq(1);
      });

    });

    
    it('scope添加对象obj3,跟踪子属性，再全部替换此对象,先前的跟踪将得到响应', () => {
      let defer = new Defer();
      cy.wrap(scope.$rootScope).then(() => {
        // debugger
        scope.$rootScope.obj3 = { a: 1, b: 2, c: 3 };
        scope.traceCall(
          'test-call-obj3.a',
          () => {
            return scope.$rootScope.obj3.a;
          },
          v=>defer.resolve(v)
        );

        // 确定对象属性为get/set
        expect(scope.$rootScope, '检测属性转换为get/set').ownPropertyDescriptor('obj2').include.keys('get', 'set');
      });

      cy.wrap(scope.$rootScope).then(() => {
        cy.log('修改obj3');
        scope.$rootScope.obj3 = { a: 11, b: 22, c: 33 };
      });

      cy.wrap(defer.promise).then(v => {
        expect(v, `获取obj3执行结果, 耗时:${defer.duration}`).to.be.eq(11);
      });

    });


    
    it('scope添加复杂对象obj4,跟踪子属性，再全部替换此对象,先前的跟踪将得到响应', () => {
      let defer = new Defer();
      cy.wrap(scope.$rootScope).then(() => {
        // debugger
        scope.$rootScope.obj3 = { a: 1, b: 2, c: 3 , d: { d1: 11, d2: 12, d3: 13, e: { e1: 21, e2: 22, e3: 23 } }};
        scope.traceCall(
          'test-call-obj3.a',
          () => {
            return scope.$rootScope.obj3.d.e.e1;
          },
          v=>defer.resolve(v)
        );

        // 确定对象属性为get/set
        expect(scope.$rootScope, '检测属性转换为get/set').ownPropertyDescriptor('obj2').include.keys('get', 'set');
      });

      cy.wrap(scope.$rootScope).then(() => {
        cy.log('修改obj3');
        scope.$rootScope.obj3 = { a: 11, b: 22, c: 33,d:{d1:99,e:{e1:999}} };
      });

      cy.wrap(defer.promise).then(v => {
        expect(v, `获取obj3执行结果, 耗时:${defer.duration}`).to.be.eq(999);
      });

    });



    
    it('scope添加数组,添加数组内容,监控数组元素,得到响应', () => {
      let defer = new Defer<any>();
      cy.wrap(scope.$rootScope).then(() => {
        // debugger
        scope.$rootScope.arr1 = [];
        scope.traceCall(
          'test-call-obj3.arr1',
          () => {
            return scope.$rootScope.arr1;
          },
          v=>defer.resolve(v)
        );
      });

      cy.wrap(scope.$rootScope).then(() => {
        cy.log('修改arr1');
        (scope.$rootScope.arr1 as Array<any>).push(1);
      });

      cy.wrap(defer.promise).then((v:any) => {
        expect(v.length, `获取obj3执行结果, 耗时:${defer.duration}`).to.be.eq(1);
      });

    });


  });
});
