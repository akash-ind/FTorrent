'use strict'; 

const net = require('net');
const Buffer = require('buffer').Buffer;
const tracker = require('./tracker');
const Pieces = require('./Pieces');
const Queue = require('./Queue');
const fs = require('fs');
const Path = require('path');
const Message = require(('./message'));

function createPath(path)
{
	if(fs.existsSync(path))
		return;
	fs.mkdirSync(path);
}


module.exports = (torrent, path, multiple) =>{

	let pieces = new Pieces(torrent);
	if(multiple)
	{
		path = path.toString('utf-8');
		createPath(path);
	}
	let files = [];
	if(torrent.info.hasOwnProperty("files"))
	{
		let files_info = torrent.info.files;
		files_info.forEach(file=>{
			let file_path = "";
			if(file.hasOwnProperty("name"))
			{
				file_path = file.name;
			}
			else{
				file_path = file.path.toString().split(" ").join("-");
			}
			let actual_path = Path.join(path, file_path);
			const new_file = fs.openSync(actual_path,'w');
			files.push(new_file);
		})
	}
	else
	{
		const file = fs.openSync(path,'w');
		files.push(file);
	}
	tracker.getPeers(torrent, peers=>{
		peers.forEach(peer=>{
			console.log(peer);
			download(peer, torrent, pieces, files);
		});
	});
}
//Here see we have new queue for each and every peer
function download(peer, torrent, pieces, files) {
	const queue = new Queue(torrent)
	const socket = net.Socket();
	socket.on('error', ()=>{});
	socket.connect(peer.port, peer.ip, ()=>{
		socket.write(Message.buildHandshake(torrent))
		console.log(`Sent Handshake Request to ${peer}`);
	})
	onWholeMsg(socket, msg=>msgHandler(socket, msg, torrent, pieces, queue, files));
}


function msgHandler(socket, msg, torrent, pieces, queue, files)
{
	if(isHandshake(msg))
	{
		console.log("Build interested Message");
		socket.write(Message.buildInterested())
	}
	else{
		const m = Message.parse(msg);
		if(m.id === 0)
		{
			console.log("Choked");
			chokeHandler(socket);
		}
		if(m.id === 1)
		{
			console.log("Unchoked");
			unchokeHandler(socket, pieces, queue);
		}
		if(m.id === 4)
		{
			console.log("Have Handler");
			haveHandler(m.payload, socket, pieces, queue);
		}
		if(m.id === 5)
		{
			console.log("BitField Message");
			bitFieldHandler(m.payload, socket, pieces, queue);
		}
		if(m.id === 7)
		{
			console.log("Piece Message");
			pieceHandler(m.payload, socket, torrent, pieces, queue, files);
		}
	}
}


function haveHandler(payload, socket, pieces, queue)
{
	const piece = payload.readUInt32BE(0)
	const queueEmpty = queue.length() === 0;
	queue.queue(piece);
	if(queueEmpty)
	{
		requestPiece(socket, pieces, queue);	
	}
}

function bitFieldHandler(payload, socket, pieces, queue)
{
	const queueEmpty = queue.length() ===0;
	payload.forEach((byte, i)=>{
		for(let j=0;j<8;j++)
		{
			if(byte%2)
			{
				queue.queue(i*8+7-j);
			}
			else{
				byte = Math.floor(byte/2);
			}
		}
	})
	if(queueEmpty)
	{
		requestPiece(socket, pieces, queue);
	}
}

function requestPiece(socket, pieces, queue)
{
	if(queue.choked)
	{
		return null;
	}
	while(queue.length())
	{
		const pieceBlock = queue.dequeue();
		if(pieces.needed(pieceBlock))
		{
			socket.write(Message.buildRequest(pieceBlock));
			pieces.addRequested(pieceBlock);
			console.log("Request Sent");
			break;
		}
	}
}

function writeFile(files, pieceResp, torrent)
{
	let offset = pieceResp.index*torrent.info['piece length'] + pieceResp.begin;
	const files_info = torrent.info.files;
	let value = 0;
	let i = 0;
	for(i= 0;i<files_info.length;i++)
	{
		value+=files_info[i].length;
		if(value>offset)
			break;
	}
	if(pieceResp.block.length+offset>value)
	{
		const pieceOffset = pieceResp.block.length+offset-value;
		fs.write(files[i+1], pieceResp.block, pieceOffset,
		 pieceResp.block.length-pieceOffset, 0, ()=>{});
		offset = offset - (value-files_info[i].length);
		fs.write(files[i],pieceResp.block, 0, pieceOffset-1, offset, ()=>{});
	}
	else{
		offset = offset - (value-files_info[i].length);
		fs.write(files[i], pieceResp.block, 0, pieceResp.block.length, offset, ()=>{});
	}
}

function pieceHandler(pieceResp, socket, torrent, pieces, queue, files)
{
	console.log(pieceResp)
	pieces.addRecieved(pieceResp);
	writeFile(files, pieceResp, torrent);
	if(pieces.isDone())
	{
		socket.end();
		console.log("Done")
	}
	else{
		requestPiece(socket, pieces, queue);
	}
}

function isHandshake(msg)
{
	//console.log("Checking handshake");
	//console.log(msg.readUInt8(0));
	//console.log(msg.toString('utf-8', 1));
	return msg.length === msg.readUInt8(0)+49 && msg.toString('utf-8', 1, 20) === "BitTorrent protocol"
}


function onWholeMsg(socket, callback)
{
	let savedBuf = Buffer.alloc(0);
	let handshake = true;

	socket.on('data', recvBuffer =>{
		let msgLen = ()=> handshake?savedBuf.readUInt8(0)+49:savedBuf.readUInt32BE(0)+4;

		savedBuf = Buffer.concat([savedBuf, recvBuffer]);
		console.log(`We recieved a handshake= ${handshake} of length ${savedBuf.length}`);
		while(savedBuf.length>=4 && savedBuf.length>=msgLen()){
			callback(savedBuf.slice(0, msgLen()));
			savedBuf = savedBuf.slice(msgLen());
			handshake = false;
		}
	})
}


function chokeHandler(socket)
{
	socket.end();
}

function unchokeHandler(socket, pieces, queue)
{
	//console.log("something Unchoked");
	queue.choked = false;
	//console.log(queue);
	requestPiece(socket, pieces, queue);	//No even if unchoke message is sent later 
	//haveHandler and BitField Handler were adding to queue
}