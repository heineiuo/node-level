/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Slice from './Slice'
import varint from 'varint'
import SSTableBlock from './SSTableBlock'
import SSTableDataBlock from './SSTableDataBlock'
import { Buffer } from 'buffer'

export default class TableIndexBlock extends SSTableBlock {
  *dataBlockIterator() {
    for (let dataBlockIndexRecordValue of this.iterator()) {
      /**
       * key=max key of data block
       * value=data block offset,size
       */
      const offset = varint.decode(dataBlockIndexRecordValue.value.buffer)
      const size = varint.decode(
        dataBlockIndexRecordValue.value.buffer,
        varint.decode.bytes
      )
      const dataBlock = new SSTableDataBlock(this.buffer, offset, size)

      yield* dataBlock.iterator()
    }
  }

  *indexIterator() {
    for (let dataBlockIndexRecord of this.iterator()) {
      const { key, value } = dataBlockIndexRecord
      const offset = varint.decode(value.buffer)
      const size = varint.decode(value.buffer, varint.decode.bytes)
      yield {
        key: key.toString(),
        offset,
        size,
      }
    }
  }
}
