/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
/* global Generator */

import crc32 from 'buffer-crc32'
import varint from 'varint'
import { Buffer } from 'buffer'
import Slice from './Slice'
import SSTableRecord from './SSTableRecord'
import { type Options } from './Options'
import { CompressionTypes } from './Format'

export default class SSTableBlock {
  constructor (buffer?:Buffer = Buffer.from([]), offset?:number, size?:number) {
    this._buffer = buffer
    this._offset = offset || 0
    this._size = size || (this._buffer.length - this._offset)
  }

  _size:number
  _offset:number
  _buffer:Buffer

  get buffer ():Buffer {
    return this._buffer
  }

  get size ():number {
    return this._size
  }

  get offset ():number {
    return this._offset
  }

  get crc32 ():Buffer {
    return this._buffer.slice(this.offset + this._size - 4)
  }

  get compressionType ():number {
    return this._buffer.slice(this.offset + this._size - 5, this.offset + this._size - 4)
  }

  get estimateSize ():number {
    return this.size * 2
  }

  * iterator (options?:Options):Generator<any, void, void> {
    let recordSizeSummary:number = 0
    while (true) {
      if (recordSizeSummary >= this.size - 5) {
        // console.log('SSTableBlock iterator done because offset is: ' + offset + ' and size is ' + this._size + ' and record.size is ' + record.size + ' and data is ' + JSON.stringify(data))
        return
      }
      const record = new SSTableRecord(this.buffer, this.offset + recordSizeSummary)
      const data = record.get(options)
      yield data
      // console.log('SSTableBlock iterator increase with offset ' + offset + ' and fixed-size ' + this._size + ' and record.size is ' + record.size)
      recordSizeSummary += record.size
    }
  }

  append (data:{ key:Slice, value:Slice }):void {
    const record = new SSTableRecord()
    record.put(data.key, data.value)
    let body
    if (this._buffer && this._size > 5) {
      body = Buffer.concat([
        this._buffer.slice(0, this._size - 5),
        record.buffer
      ])
    } else {
      body = record.buffer
    }

    const compressionType = Buffer.from(varint.encode(CompressionTypes.get('none').value))
    const crc32buffer = crc32(body)
    this._buffer = Buffer.concat([
      body,
      compressionType,
      crc32buffer
    ])
    this._offset = 0
    this._size = this._buffer.length
  }
}
