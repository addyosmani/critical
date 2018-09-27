/* eslint-env jest node */
const {
  mapAsync,
  reduceAsync,
  filterAsync,
  forEachAsync,
} = require('../src/array');

const waitFor = (ms) => new Promise(r => setTimeout(r, ms));
const waitRandom = () => waitFor(Math.floor(Math.random() * Math.floor(50)));

test('async map', async () => {
  const afunc = async value => {
    await waitRandom();
    return value * value;
  };
  const func = value => value * value;
  const array = [1,2,3,4,5,6,7,8];
  const expected = array.map(func);

  const result1 = await mapAsync(array, v => func(v));
  const result2 = await mapAsync(array, v => afunc(v));

  expect(result1).toEqual(expected);
  expect(result2).toEqual(expected);
});

test('async map (default)', async () => {
  const array = [1,2,3,4,5,6,7,8];

  const result = await mapAsync(array);
  expect(result).toEqual(array);
});

test('async map (empty)', async () => {
  const result = await mapAsync();
  expect(result).toEqual([]);
});

test('async reduce', async () => {
  const afunc = async (res, value, index) => {
    await waitRandom();
    return [...res, value * index];
  };
  const func = (res, value, index) => [...res, value * index];
  const array = [1,2,3,4,5,6,7,8];
  const expected = array.reduce(func, []);

  const result1 = await reduceAsync(array, func, []);
  const result2 = await reduceAsync(array, afunc, []);

  expect(result1).toEqual(expected);
  expect(result2).toEqual(expected);
});

test('async reduce (default)', async () => {
  const array = [1,2,3,4,5,6,7,8];

  const result = await reduceAsync(array);
  expect(result).toEqual(undefined);
});

test('async reduce (empty)', async () => {
  const result = await reduceAsync();
  expect(result).toEqual(undefined);
});

test('async filter', async () => {
  const afunc = async value => {
    await waitRandom();
    return value % 2;
  };
  const func = value => value % 2;
  const array = [1,2,3,4,5,6,7,8];
  const expected = array.filter(func);

  const result1 = await filterAsync(array, func);
  const result2 = await filterAsync(array, afunc);

  expect(result1).toEqual(expected);
  expect(result2).toEqual(expected);
});

test('async filter (default)', async () => {
  const array = [1,0,3,false,5,undefined,7,null];

  const result = await filterAsync(array);
  expect(result).toEqual([1,3,5,7]);
});

test('async filter (empty)', async () => {
  const result = await filterAsync();
  expect(result).toEqual([]);
});

test('async forEach', async () => {
  const array = [1,2,3,4,5,6,7,8];
  const expected = [];
  const result1 = [];
  const result2 = [];
  array.forEach(v => expected.push(v));

  await forEachAsync(array, v => result1.push(v));
  await forEachAsync(array, async v => {
    await waitRandom();
    result2.push(v);
  });

  expect(result1).toEqual(expected);
  expect(result2).toEqual(expected);
});
