'use strict';

const fs = require('fs');
const bencode = require('bencode');
const crypto = require('crypto');
const bignum = require('bignum');


module.exports.BLOCK_LEN = Math.pow(2, 14);

module.exports.pieceLen = (torrent, pieceIndex)=>{
	const totalLen = bignum.fromBuffer(this.size(torrent)).toNumber();
	const pieceLen = torrent.info['piece length'];

	const lastPieceLength = totalLen%pieceLen;
	const lastPieceIndex = Math.floor(totalLen/pieceLen);

	return pieceIndex === lastPieceIndex?lastPieceLength:pieceLen;
}

module.exports.blocksPerPiece = (torrent, pieceIndex)=>{
	const pieceLength = this.pieceLen(torrent, pieceIndex);
	return Math.ceil(pieceLength/this.BLOCK_LEN);
}

module.exports.blockLen = (torrent, pieceIndex, blockIndex)=>{
	const pieceLength = this.pieceLen(torrent, pieceIndex);
	const blocks = this.blocksPerPiece(torrent, pieceIndex);

	const lastBlockLength = pieceLength%this.BLOCK_LEN;
	return blocks===blockIndex+1?lastBlockLength:this.BLOCK_LEN;
}


module.exports.open = (filepath)=>{
	return bencode.decode(fs.readFileSync(filepath));
}

module.exports.size = torrent=>{
	const size = torrent.info.files?
		torrent.info.files.map(file=>file.length).reduce((a,b)=>a+b):
		torrent.info.length;

	return bignum.toBuffer(size, {size:8})	
}

module.exports.infoHash = torrent=>{
	const info = bencode.encode(torrent.info);
	return crypto.createHash('sha1').update(info).digest();
}