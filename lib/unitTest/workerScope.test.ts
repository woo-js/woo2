import { WorkerScope } from '../src/workerScope';
import { expect,test } from '@jest/globals';


test('adds 1 + 2 to equal 3', async () => {
  let scope = new WorkerScope(undefined) as any;
  scope.a = 'abcde';


  console.log(JSON.stringify(scope,null,2))
  console.log(scope.a)
  expect(true);
});