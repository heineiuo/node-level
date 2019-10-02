/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from 'buffer'
import varint from 'varint'
import Slice from './Slice'
import BloomFilter from './BloomFilter'
import { Filter, kFilterBase, BlockContents } from './SSTableFormat'
import assert from 'assert'
import { MetaBlockEntry } from './SSTableFormat'
import TableBlock from './SSTableBlock'
import { FilterPolicy } from './Options'
import { decodeFixed32 } from './Coding'

// MetaBlock format is different with other blocks
// filter_index = (blockOffset / kFilterBase);
export default class SSTableFilterBlock {
  constructor(policy: FilterPolicy, data: Slice) {
    this._buffer = data.buffer
    this._policy = policy
    this._num = 0
    this._baseLg = 0

    const n = data.size
    if (n < 5) return // 1 byte for base_lg_ and 4 for start of offset array
    this._baseLg = data.buffer[data.length - 1]

    const lastWord = decodeFixed32(data.buffer.slice(n - 5))
    if (lastWord > n - 5) return
    this._buffer = data.buffer
    this._data = 0
    this._offset = lastWord
    this._num = (n - 5 - lastWord) / 4
  }

  private _buffer: Buffer //
  private _data!: number // Pointer to filter data (at block-start)
  private _offset!: number // Pointer to beginning of offset array (at block-end)
  private _size!: number
  private _policy: FilterPolicy
  private _num: number // Number of entries in offset array
  private _baseLg: number // Encoding parameter (see kFilterBaseLg in .cc file)

  get size(): number {
    return this._size
  }

  get buffer(): Buffer {
    return this._buffer
  }

  get beginningOfOffset(): number {
    let buf
    if (this._offset === 0 && this._size === this._buffer.length) {
      buf = this._buffer
    } else {
      buf = this._buffer.slice(this._offset, this._size)
    }
    return varint.decode(buf, buf.length - 2)
  }

  public keyMayMatch(blockOffset: number, key: Slice): boolean {
    let index = blockOffset >> this._baseLg
    if (index < this._num) {
      const start = decodeFixed32(this._buffer.slice(this._offset + index * 4))
      const limit = decodeFixed32(
        this._buffer.slice(this._offset + index * 4 + 4)
      )
      if (start <= limit && limit <= this._offset - this._data) {
        const filter = new Slice(
          this._buffer.slice(this._data + start, limit - start)
        )
        return this._policy.keyMayMatch(key, filter)
      } else if (start == limit) {
        // Empty filters do not match any keys
        return false
      }
    }
    return true // Errors are treated as potential matches
  }

  public *filterIterator(): IterableIterator<Filter> {
    let filterStart = this._offset
    let filterEnd = 0
    for (let offsetResult of this.offsetIterator()) {
      filterEnd = offsetResult
      const filter = new BloomFilter(this.buffer.slice(filterStart, filterEnd))
      filterStart += offsetResult
      yield filter
    }
  }

  private *offsetIterator() {
    const start = this.beginningOfOffset
    const offsetTotalCount = this._size - 2 - start
    let count = 0
    while (count < offsetTotalCount) {
      const offset = varint.decode(this._buffer.slice(start + count))
      count += 1
      yield offset
    }
  }
}

// A "metaindex" block.  It contains one entry for every other meta
// block where the key is the name of the meta block and the value is a
// BlockHandle pointing to that meta block.
export class TableMetaIndexBlock extends TableBlock {
  get filterKey(): string {
    return `filter.leveldb.BuiltinBloomFilter2`
  }

  // get() {
  //   let key = new Slice()
  //   let value = new Slice()
  //   for (let entry of this.iterator()) {
  //     key = entry.key
  //     value = entry.value
  //     break
  //   }

  //   assert(key.length > 0)
  //   assert(value.length > 0)
  //   const offset = varint.decode(value.buffer)
  //   const size = varint.decode(value.buffer, varint.decode.bytes)
  //   return {
  //     key,
  //     offset,
  //     size,
  //   }
  // }

  *metaBlockEntryIterator(): IterableIterator<MetaBlockEntry> {
    for (let record of this.iterator()) {
      const { value, key } = record
      const offset = varint.decode(value.buffer)
      const size = varint.decode(value.buffer, varint.decode.bytes)
      const metaBlockEntry = {} as MetaBlockEntry
      metaBlockEntry.handle = { offset, size }
      metaBlockEntry.name = key.toString()
      yield metaBlockEntry
    }
  }
}
