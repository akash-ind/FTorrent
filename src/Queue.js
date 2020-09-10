'use strict';
const tp = require('./torrent-parser');

module.exports = class{
	constructor(torrent)
	{
		this._torrent = torrent;
		this._queue = [];
		this.choked = true;
	}


	queue(pieceIndex)
	{
		const blocks = tp.blocksPerPiece(this._torrent, pieceIndex)
		for(let i =0;i<blocks;i++)
		{
			const pieceBlock = {
				index:pieceIndex,
				begin:i*tp.BLOCK_LEN,
				length:tp.blockLen(this._torrent, pieceIndex, i)
			}
			this._queue.push(pieceBlock);
		}
	}

	dequeue()
	{
		return this._queue.shift();
	}

	peek()
	{
		return this._queue[0];
	}

	length()
	{
		return this._queue.length;
	}

}