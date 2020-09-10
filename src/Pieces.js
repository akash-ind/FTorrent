'use strict';

const tp = require('./torrent-parser');

module.exports = class{
	constructor(torrent){
		function buildPiecesArray()
		{
			const nPieces = torrent.info.pieces.length/20;
			const arr = new Array(nPieces).fill(null);
			return arr.map((_, i)=> new Array(tp.blocksPerPiece(torrent, i)).fill(false));

		}

		this._requested = buildPiecesArray();
		this._recieved = buildPiecesArray();
	}

	addRequested(piece)
	{
		const blockIndex = piece.begin/tp.BLOCK_LEN;
		this._requested[piece.index][blockIndex] = true;
	}
	addRecieved(piece)
	{
		const blockIndex = piece.begin/tp.BLOCK_LEN;
		this._recieved[piece.index][blockIndex] = true;
	}
	needed(piece)
	{
		if(this._requested.every(block=>block.every(i=>i))){
			this._requested = this._recieved.map(block=>block.slice());
		}
		return !this._requested[piece]
	}
	isDone()
	{
		return this._recieved.every(block=>block.every(i=>i));
	}
}