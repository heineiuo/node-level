/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import { Entry, InternalKeyComparator } from './Format'

export default class IteratorMerger {
  constructor(
    icmp: InternalKeyComparator,
    list: AsyncIterableIterator<Entry>[],
    num: number
  ) {
    this._icmp = icmp
    this._list = list
    this._num = num
    this._cache = new Array(num)
  }

  private _icmp: InternalKeyComparator
  private _list: AsyncIterableIterator<Entry>[]
  private _num: number
  private _cache: (IteratorResult<Entry> | null)[]

  public async *iterator(): AsyncIterableIterator<Entry> {
    assert(this._num >= 0)
    if (this._num === 0) {
      return
    }
    if (this._num === 1) {
      yield* this._list[0]
      return
    }
    while (true) {
      const smallest = await this.findSmallest(this._list)
      if (!smallest) break
      yield smallest
    }
  }

  private async findSmallest(
    list: AsyncIterableIterator<Entry>[]
  ): Promise<Entry | null> {
    let smallest = null
    let hit = -1

    for (let i = 0; i < this._num; i++) {
      let child = this._cache[i] || (await this._list[i].next())
      this._cache[i] = child
      if (!child.done) {
        if (smallest === null) {
          smallest = child.value
          hit = i
        } else if (this._icmp.compare(child.value.key, smallest.key) < 0) {
          smallest = child.value
          hit = i
        }
      }
    }
    for (let i = 0; i < this._num; i++) {
      if (i === hit) {
        this._cache[i] = null
      }
    }
    return smallest
  }
}
