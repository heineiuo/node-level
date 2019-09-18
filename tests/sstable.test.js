const fs = require('fs').promises
const path = require('path')
const Slice = require('../src/Slice').default
const SSTable = require('../src/SSTable').default
const SSTableBuilder = require('../src/SSTableBuilder').default

function padLeft(str, total = 10) {
  if (str.length < total) {
    return padLeft(`0${str}`, total)
  }
  return str
}

function sortedKey(index) {
  return new Slice(`key${padLeft(String(index))}`)
}

function randomValue(index) {
  return new Slice(`value${padLeft(String(index))}`)
}


test('sstable', async () => {
  await fs.mkdir(path.resolve(__dirname, '../.db'), { recursive: true })
  const tablePath = path.resolve(__dirname, '../.db/0001.ldb')
  // await fs.writeFile(tablePath, Buffer.alloc(0))
  const file = await fs.open(tablePath, 'w')
  const tableWritter = new SSTableBuilder(file)

  let i = 0
  while (i < 5000) {
    await tableWritter.add(sortedKey(i), randomValue(i))
    i++
  }

  await tableWritter.close()

  const ldbPath = path.resolve(__dirname, '../.db/0001.ldb')
  const buf = await fs.readFile(ldbPath)
  const table = new SSTable(buf)
  // console.log(table._footer.get())

  let count = 0
  for (let result  of table.dataBlockIterator()) {
    count ++
  }
  console.log(count)
  expect(table.get(sortedKey(1))).toBe('value0000000001')
})