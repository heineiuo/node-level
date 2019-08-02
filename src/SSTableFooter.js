/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import { Buffer } from 'buffer'
import varint from 'varint'

/**
 * 置于 table 末尾，固定 48 byte，
 * 包含指向各个分区（ data index block 以及 meta index block ）
 * 的偏移量和大小，读取 table 时从末尾开始读取。
 */
export default class TableFooter {
  constructor (buffer:Buffer) {
    this._buffer = buffer || Buffer.alloc(48)
  }

  _buffer:Buffer

  get buffer ():Buffer {
    return this._buffer.slice(this._buffer.length - 48, 48)
  }

  set metaIndexOffset (value:number) {
    const data = {
      ...this.get(),
      metaIndexOffset: value
    }
    this.put(data)
  }

  set metaIndexSize (value:number) {
    const data = {
      ...this.get(),
      metaIndexSize: value
    }
    this.put(data)
  }

  set indexOffset (value:number) {
    const data = {
      ...this.get(),
      indexOffset: value
    }
    this.put(data)
  }

  set indexSize (value:number) {
    const data = {
      ...this.get(),
      indexSize: value
    }
    this.put(data)
  }

  get ():{
    metaIndexOffset: number,
    metaIndexSize: number,
    indexOffset: number,
    indexSize: number
    } {
    if (!this.buffer) {
      return {
        metaIndexOffset: 0,
        metaIndexSize: 0,
        indexOffset: 0,
        indexSize: 0
      }
    }
    const buf = this.buffer
    const metaIndexOffset = varint.decode(buf, 0)
    const metaIndexSize = varint.decode(buf, varint.decode.bytes)
    const indexOffset = varint.decode(buf, varint.decode.bytes)
    const indexSize = varint.decode(buf, varint.decode.bytes)
    return {
      metaIndexOffset,
      metaIndexSize,
      indexOffset,
      indexSize
    }
  }

  put (data: {
    metaIndexOffset: number,
    metaIndexSize: number,
    indexOffset: number,
    indexSize: number
  }): void {
    const handlers = Buffer.concat([
      Buffer.from(varint.encode(data.metaIndexOffset)),
      Buffer.from(varint.encode(data.metaIndexSize)),
      Buffer.from(varint.encode(data.indexOffset)),
      Buffer.from(varint.encode(data.indexSize))
    ])
    const paddingBuf = Buffer.alloc(40 - handlers.length)
    this._buffer = Buffer.concat([
      handlers,
      paddingBuf,
      Buffer.alloc(8)
    ])
  }
}
